import type {
  HealthResponse,
  SchemaResponse,
  SamplePatientsResponse,
  PredictionResponse,
  MetricsResponse
} from '../types/api';

const DEFAULT_PROD_API = 'https://cardia-api-6gif.onrender.com';
const rawApiBase =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? DEFAULT_PROD_API : '/api');
const cleanBase = rawApiBase.replace(/\/+$/, '');
export const API_BASE = cleanBase.endsWith('/api') || cleanBase === '/api' ? cleanBase : `${cleanBase}/api`;
export const IS_CLOUD_BACKEND = !API_BASE.includes('localhost') && !API_BASE.startsWith('/api');

export class ApiError extends Error {
  errorCode?: string;
  statusCode?: number;

  constructor(message: string, errorCode?: string, statusCode?: number) {
    super(message);
    this.name = 'ApiError';
    this.errorCode = errorCode;
    this.statusCode = statusCode;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    const errorMsg = data?.message || `Request failed with status ${res.status}`;
    const errorCode = data?.error_code || 'UNKNOWN_ERROR';
    throw new ApiError(errorMsg, errorCode, res.status);
  }

  return data as T;
}

export async function checkHealth(timeoutMs?: number): Promise<HealthResponse> {
  const timeout = timeoutMs ?? (IS_CLOUD_BACKEND ? 30000 : 8000);
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(timeout) });
    return await handleResponse<HealthResponse>(res);
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    const isTimeout = err?.name === 'TimeoutError' || err?.message?.includes('timeout');
    if (isTimeout && IS_CLOUD_BACKEND) {
      throw new ApiError(
        'Cloud backend is waking from sleep (cold start in progress).',
        'COLD_START'
      );
    }
    throw new ApiError(
      IS_CLOUD_BACKEND
        ? `Unable to connect to cloud backend at ${API_BASE}.`
        : 'Unable to connect to cardiovascular prediction backend.',
      'CONNECTION_REFUSED'
    );
  }
}

export async function checkHealthWithRetry(
  maxRetries = 2,
  onStatusUpdate?: (status: string) => void
): Promise<HealthResponse> {
  let lastError: any;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 1 && onStatusUpdate) {
        onStatusUpdate(`Waking cloud backend (attempt ${attempt}/${maxRetries})...`);
      }
      const timeoutMs = IS_CLOUD_BACKEND ? (attempt === 1 ? 15000 : 45000) : 8000;
      const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(timeoutMs) });
      return await handleResponse<HealthResponse>(res);
    } catch (err: any) {
      lastError = err;
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }
    }
  }

  if (lastError instanceof ApiError) throw lastError;
  const isTimeout = lastError?.name === 'TimeoutError' || lastError?.message?.includes('timeout');
  if (isTimeout && IS_CLOUD_BACKEND) {
    throw new ApiError(
      'Cloud backend is taking longer than usual to spin up. Please click [ RETRY ] in a moment.',
      'COLD_START'
    );
  }
  throw new ApiError(
    IS_CLOUD_BACKEND
      ? `Unable to connect to cloud backend at ${API_BASE}.`
      : 'Unable to connect to cardiovascular prediction backend.',
    'CONNECTION_REFUSED'
  );
}

export async function fetchSchema(): Promise<SchemaResponse> {
  const timeout = IS_CLOUD_BACKEND ? 45000 : 15000;
  const res = await fetch(`${API_BASE}/schema`, { signal: AbortSignal.timeout(timeout) });
  return await handleResponse<SchemaResponse>(res);
}

export async function fetchSamplePatients(): Promise<SamplePatientsResponse> {
  const timeout = IS_CLOUD_BACKEND ? 45000 : 15000;
  const res = await fetch(`${API_BASE}/sample-patients`, { signal: AbortSignal.timeout(timeout) });
  return await handleResponse<SamplePatientsResponse>(res);
}

export async function fetchMetrics(): Promise<MetricsResponse> {
  const timeout = IS_CLOUD_BACKEND ? 45000 : 15000;
  const res = await fetch(`${API_BASE}/metrics`, { signal: AbortSignal.timeout(timeout) });
  return await handleResponse<MetricsResponse>(res);
}

export async function predictRisk(features: Record<string, any>): Promise<PredictionResponse> {
  // Client-side guard: Never transmit forbidden target keys
  const sanitized = { ...features };
  const forbidden = ['Cath', 'LAD', 'LCX', 'RCA', 'cath', 'lad', 'lcx', 'rca', 'cad', 'CAD', 'Exertional CP'];
  for (const f of forbidden) {
    delete sanitized[f];
  }

  const res = await fetch(`${API_BASE}/predict`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(sanitized)
  });

  return await handleResponse<PredictionResponse>(res);
}

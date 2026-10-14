import type {
  HealthResponse,
  SchemaResponse,
  SamplePatientsResponse,
  PredictionResponse,
  MetricsResponse
} from '../types/api';

const rawApiBase = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '/api';
const cleanBase = rawApiBase.replace(/\/+$/, '');
const API_BASE = cleanBase.endsWith('/api') || cleanBase === '/api' ? cleanBase : `${cleanBase}/api`;

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

export async function checkHealth(): Promise<HealthResponse> {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(4000) });
    return await handleResponse<HealthResponse>(res);
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    throw new ApiError('Unable to connect to cardiovascular prediction backend.', 'CONNECTION_REFUSED');
  }
}

export async function fetchSchema(): Promise<SchemaResponse> {
  const res = await fetch(`${API_BASE}/schema`);
  return await handleResponse<SchemaResponse>(res);
}

export async function fetchSamplePatients(): Promise<SamplePatientsResponse> {
  const res = await fetch(`${API_BASE}/sample-patients`);
  return await handleResponse<SamplePatientsResponse>(res);
}

export async function fetchMetrics(): Promise<MetricsResponse> {
  const res = await fetch(`${API_BASE}/metrics`);
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

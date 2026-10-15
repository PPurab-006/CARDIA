import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import { Header } from './components/Header';
import { ClinicalForm } from './components/ClinicalForm';
import { HeartViewer } from './components/HeartViewer';
import { RiskDashboard } from './components/RiskDashboard';
import { FeatureExplanations } from './components/FeatureExplanations';
import { ModelMetricsModal } from './components/ModelMetricsModal';
import { SafetyDisclaimer } from './components/SafetyDisclaimer';
import {
  checkHealthWithRetry,
  fetchSchema,
  fetchSamplePatients,
  fetchMetrics,
  predictRisk,
  API_BASE,
  IS_CLOUD_BACKEND,
  ApiError
} from './lib/api';
import type {
  HealthResponse,
  SchemaResponse,
  SamplePatientsResponse,
  SamplePatientProfile,
  MetricsResponse,
  PredictionResponse,
  FeatureNumericMeta
} from './types/api';
import {
  AlertTriangle,
  RefreshCw,
  XCircle,
  ClipboardList,
  Activity,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

type MobileSection = 'form' | 'heart' | 'results';

// Session persistence helper for desktop collapsible panels
const getStoredCollapse = (key: string, defaultValue: boolean): boolean => {
  try {
    const val = sessionStorage.getItem(`cardia_panel_${key}`);
    return val !== null ? val === 'true' : defaultValue;
  } catch {
    return defaultValue;
  }
};

const setStoredCollapse = (key: string, value: boolean) => {
  try {
    sessionStorage.setItem(`cardia_panel_${key}`, String(value));
  } catch {}
};

export const App: React.FC = () => {
  // Backend & Metadata State
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState<boolean>(true);
  const [healthError, setHealthError] = useState<string | null>(null);

  const [schema, setSchema] = useState<SchemaResponse | null>(null);
  const [samplePatients, setSamplePatients] = useState<SamplePatientsResponse | null>(null);
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [metricsLoading, setMetricsLoading] = useState<boolean>(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [isMetricsOpen, setIsMetricsOpen] = useState<boolean>(false);

  // Form State
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Prediction State
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null);
  const [isPredicting, setIsPredicting] = useState<boolean>(false);
  const [predictError, setPredictError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState<boolean>(false);

  // 3D Vessel Interaction
  const [selectedVessel, setSelectedVessel] = useState<string | null>(null);

  // Desktop Collapsible Panels State
  const [isLeftCollapsed, setIsLeftCollapsed] = useState<boolean>(() =>
    getStoredCollapse('left', false)
  );
  const [isRightCollapsed, setIsRightCollapsed] = useState<boolean>(() =>
    getStoredCollapse('right', false)
  );
  const [isPredictionCollapsed, setIsPredictionCollapsed] = useState<boolean>(() =>
    getStoredCollapse('prediction', false)
  );
  const [isAttributionCollapsed, setIsAttributionCollapsed] = useState<boolean>(() =>
    getStoredCollapse('attribution', false)
  );
  const [isMetricsInlineCollapsed, setIsMetricsInlineCollapsed] = useState<boolean>(() =>
    getStoredCollapse('metrics_inline', true)
  );
  const [isHeroCollapsed, setIsHeroCollapsed] = useState<boolean>(() =>
    getStoredCollapse('hero', false)
  );

  // Desktop Breakpoint Detection (>= 1200px)
  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1200 : true
  );

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1200);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const showHeroCollapsed = isDesktop && isHeroCollapsed;
  const showLeftCollapsed = isDesktop && isLeftCollapsed;
  const showRightCollapsed = isDesktop && isRightCollapsed;
  const showPredictionCollapsed = isDesktop && isPredictionCollapsed;
  const showAttributionCollapsed = isDesktop && isAttributionCollapsed;
  const showMetricsInlineCollapsed = isDesktop && isMetricsInlineCollapsed;

  // Mobile Section Navigation
  const [mobileSection, setMobileSection] = useState<MobileSection>('form');

  // Initial Load: Health, Schema, Sample Patients, Metrics with cold-start handling
  const [wakeStatus, setWakeStatus] = useState<string | null>(null);

  const loadInitialData = useCallback(async () => {
    setHealthLoading(true);
    setHealthError(null);
    setWakeStatus(null);
    setMetricsLoading(true);
    setMetricsError(null);
    try {
      // Step 1: Health check with cold-start retries
      const healthData = await checkHealthWithRetry(2, (status) => setWakeStatus(status));
      setHealth(healthData);
      setWakeStatus(null);

      // Step 2: Once backend is online, fetch schema, sample patients, and metrics in parallel
      const [schemaData, samplesData, metricsData] = await Promise.all([
        fetchSchema(),
        fetchSamplePatients(),
        fetchMetrics()
      ]);

      setSchema(schemaData);
      setSamplePatients(samplesData);
      setMetrics(metricsData);
      setMetricsLoading(false);

      // Initialize default values from schema if not already set
      setFormValues((prev) => {
        if (Object.keys(prev).length > 0) return prev;
        const initialForm: Record<string, any> = {};
        Object.entries(schemaData.features).forEach(([key, meta]) => {
          initialForm[key] = meta.default;
        });
        return initialForm;
      });
    } catch (err: any) {
      setHealth(null);
      setHealthError(err.message || 'Backend connection failed');
      setMetricsLoading(false);
      setMetricsError(err.message || 'Failed to load metrics');
    } finally {
      setHealthLoading(false);
      setWakeStatus(null);
    }
  }, []);

  const loadHealth = loadInitialData;

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Client-Side Realtime Validation
  const validateValues = useCallback(
    (values: Record<string, any>, currentSchema: SchemaResponse | null) => {
      if (!currentSchema) return {};
      const errors: Record<string, string> = {};

      Object.entries(currentSchema.features).forEach(([key, meta]) => {
        const val = values[key];
        if (meta.type === 'numeric') {
          const numMeta = meta as FeatureNumericMeta;
          if (val === '' || val === undefined || val === null || isNaN(Number(val))) {
            errors[key] = 'Required numeric field';
          } else {
            const num = Number(val);
            if (key === 'Age') {
              if (num < 18 || num > 100) {
                errors[key] = 'Age must be between 18 and 100';
              }
            } else {
              if (num < numMeta.min || num > numMeta.max) {
                errors[key] = `Must be between ${numMeta.min} and ${numMeta.max}`;
              }
            }
          }
        } else if (meta.type === 'categorical') {
          if (!val || val === '') {
            errors[key] = 'Please select a valid option';
          }
        }
      });

      return errors;
    },
    []
  );

  // Form value change handler
  const handleFormChange = (updated: Record<string, any>) => {
    setFormValues(updated);
    if (prediction) {
      setIsStale(true);
    }
    const errors = validateValues(updated, schema);
    setValidationErrors(errors);
  };

  // Reset form to schema baseline defaults
  const handleResetForm = () => {
    if (!schema) return;
    const initialForm: Record<string, any> = {};
    Object.entries(schema.features).forEach(([key, meta]) => {
      initialForm[key] = meta.default;
    });
    setFormValues(initialForm);
    setSelectedSampleId(null);
    setValidationErrors({});
    setPrediction(null);
    setIsStale(false);
    setPredictError(null);
    setSelectedVessel(null);
  };

  // Load sample patient profile
  const handleLoadSample = (sample: SamplePatientProfile) => {
    if (!schema) return;
    const merged = { ...formValues, ...sample.profile };
    setFormValues(merged);
    setSelectedSampleId(sample.id);
    if (prediction) {
      setIsStale(true);
    }
    const errors = validateValues(merged, schema);
    setValidationErrors(errors);
  };

  // Submit Run Analysis to backend
  const handleSubmitAnalysis = async () => {
    if (!schema) return;

    // Validate all fields before sending
    const errors = validateValues(formValues, schema);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      setPredictError('Please resolve out-of-range form values before running analysis.');
      return;
    }

    setIsPredicting(true);
    setPredictError(null);

    try {
      const result = await predictRisk(formValues);
      setPrediction(result);
      setIsStale(false);
      // Auto-navigate to results on mobile after successful prediction
      setMobileSection('results');
    } catch (err: any) {
      console.error('Prediction request failed:', err);
      if (err instanceof ApiError) {
        setPredictError(`${err.message} (${err.errorCode || err.statusCode || 'ERROR'})`);
      } else {
        setPredictError(err.message || 'Failed to complete cardiovascular risk analysis');
      }
    } finally {
      setIsPredicting(false);
    }
  };

  return (
    <div className="cardia-app-shell">
      {/* 1. Header */}
      <Header
        health={health}
        healthLoading={healthLoading}
        healthError={healthError}
        onResetForm={handleResetForm}
        onOpenMetrics={() => setIsMetricsOpen(true)}
        onRecheckHealth={loadHealth}
      />

      {/* Top Alert Banner for Connection Error */}
      {healthError && (
        <div className="top-system-alert">
          <AlertTriangle size={15} />
          <span>
            <strong>SYS.ERR // BACKEND UNREACHABLE:</strong>{' '}
            {IS_CLOUD_BACKEND ? (
              <>
                Cloud API is unreachable or waking from sleep at <code>{API_BASE}</code>.
                Free-tier cloud containers sleep after inactivity.
              </>
            ) : (
              <>
                Flask API is offline on <code>localhost:5000</code>. Start with{' '}
                <code>python src/api/app.py</code>.
              </>
            )}
          </span>
          <button
            type="button"
            onClick={loadInitialData}
            disabled={healthLoading}
            className="alert-retry-btn"
          >
            {healthLoading ? '[ CONNECTING... ]' : '[ RETRY ]'}
          </button>
        </div>
      )}

      {/* Cold Start Waking Progress Indicator */}
      {healthLoading && wakeStatus && (
        <div className="top-system-alert waking-alert">
          <RefreshCw size={14} className="spin" />
          <span>
            <strong>SYS.STATUS // WAKING CLOUD BACKEND:</strong> {wakeStatus} Free-tier instances take ~30–45s to boot.
          </span>
        </div>
      )}

      {/* Hero / Research Overview Ribbon (Collapsible on Desktop) */}
      <section
        className={`research-hero-banner ${showHeroCollapsed ? 'is-collapsed' : ''}`}
        aria-label="Research Overview"
      >
        <div className="hero-top-row">
          <div className="hero-kicker-row">
            <span className="hero-kicker-tag">[ TRACK A // MULTIMODAL CARDIO ]</span>
            <span className="hero-kicker-dot" />
            <span className="hero-kicker-sub">3D ANATOMICAL RECONSTRUCTION &amp; MULTI-VESSEL STENOSIS</span>
          </div>
          <button
            type="button"
            className="panel-collapse-btn desktop-only"
            onClick={() => {
              const next = !isHeroCollapsed;
              setIsHeroCollapsed(next);
              setStoredCollapse('hero', next);
            }}
            aria-expanded={!showHeroCollapsed}
            aria-controls="hero-content-body"
            aria-label={showHeroCollapsed ? 'Expand research overview ribbon' : 'Collapse research overview ribbon'}
            title={showHeroCollapsed ? 'Expand research overview ribbon' : 'Collapse research overview ribbon'}
          >
            {showHeroCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>

        {!showHeroCollapsed ? (
          <div id="hero-content-body" className="hero-expanded-body">
            <h1 className="hero-headline">CARDIOVASCULAR AI DECISION SYSTEM</h1>
            <p className="hero-summary">
              End-to-end multi-target clinical machine learning pipeline predicting overall CAD along with vessel-specific stenosis across LAD, LCX, and RCA branches from 54 multi-modal clinical covariates. Evaluated via stratified 5-fold cross-validation with zero target leakage on the Z-Alizadeh Sani cohort (n=303) and mapped onto interactive 3D human coronary anatomy.
            </p>
            <div className="hero-metadata-strip">
              <div className="metadata-chip">
                <span className="chip-key">DATASET:</span>
                <span className="chip-val">UCI-411 (Z-Alizadeh Sani)</span>
              </div>
              <div className="metadata-chip">
                <span className="chip-key">COHORT:</span>
                <span className="chip-val">n=303 Patients</span>
              </div>
              <div className="metadata-chip">
                <span className="chip-key">COVARIATES:</span>
                <span className="chip-val">54 Multimodal</span>
              </div>
              <div className="metadata-chip">
                <span className="chip-key">VALIDATION:</span>
                <span className="chip-val">Stratified 5-Fold CV</span>
              </div>
              <div className="metadata-chip">
                <span className="chip-key">TARGETS:</span>
                <span className="chip-val">CAD &bull; LAD &bull; LCX &bull; RCA</span>
              </div>
              <div className="metadata-chip">
                <span className="chip-key">3D ATLAS:</span>
                <span className="chip-val">BodyParts3D (FMA7088)</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="hero-compact-strip">
            <span className="hero-compact-title">CARDIOVASCULAR AI DECISION SYSTEM</span>
            <span className="hero-compact-sep">&bull;</span>
            <span className="hero-compact-meta">
              UCI-411 (n=303) &bull; 54 Covariates &bull; Stratified 5-Fold CV &bull; Zero Leakage Audited &bull; BodyParts3D
            </span>
          </div>
        )}
      </section>

      {/* Mobile Section Navigator (hidden on desktop) */}
      <nav className="mobile-section-nav" aria-label="Section Navigation">
        <div className="mobile-nav-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mobileSection === 'form'}
            className={`mobile-nav-tab ${mobileSection === 'form' ? 'active' : ''}`}
            onClick={() => setMobileSection('form')}
          >
            <ClipboardList size={12} />
            <span>01 INPUT</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobileSection === 'heart'}
            className={`mobile-nav-tab ${mobileSection === 'heart' ? 'active' : ''}`}
            onClick={() => setMobileSection('heart')}
          >
            <Activity size={12} />
            <span>02 ATLAS</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobileSection === 'results'}
            className={`mobile-nav-tab ${mobileSection === 'results' ? 'active' : ''}`}
            onClick={() => setMobileSection('results')}
          >
            <BarChart3 size={12} />
            <span>03 RESULTS</span>
            {prediction && !isStale && (
              <span className="mobile-result-dot" />
            )}
          </button>
        </div>
      </nav>

      {/* Main 3-Column Workstation Layout */}
      <main
        className={`workstation-main-layout ${showLeftCollapsed ? 'left-collapsed' : ''} ${showRightCollapsed ? 'right-collapsed' : ''}`}
      >
        {/* Left Column: Clinical Form & Synthetic Patient Picker (Collapsible on Desktop) */}
        <section
          className={`workstation-col col-left ${showLeftCollapsed ? 'is-collapsed-col' : ''} ${mobileSection === 'form' ? 'mobile-active' : ''}`}
          aria-label="Clinical Input Features"
        >
          {/* Collapsed Rail (Desktop Only) */}
          <div
            className="collapsed-vertical-rail desktop-only"
            onClick={() => {
              setIsLeftCollapsed(false);
              setStoredCollapse('left', false);
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setIsLeftCollapsed(false);
                setStoredCollapse('left', false);
              }
            }}
            aria-label="Expand clinical input covariates panel"
            title="Click to expand Clinical Input Covariates"
          >
            <div className="rail-top-action">
              <button
                type="button"
                className="panel-collapse-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsLeftCollapsed(false);
                  setStoredCollapse('left', false);
                }}
                aria-expanded={false}
                aria-controls="panel-content-01"
                aria-label="Expand clinical input covariates panel"
              >
                <ChevronRight size={14} />
              </button>
            </div>
            <div className="rail-badge-wrap">
              <span className="section-index-badge">01</span>
            </div>
            <span className="rail-vertical-text">CLINICAL INPUTS</span>
            <div className="rail-bottom-meta">
              <span className="rail-count-pill" title={`${schema?.feature_count || 54} features`}>
                {schema ? `${schema.feature_count}F` : '54F'}
              </span>
              {selectedSampleId && (
                <span className="rail-active-pill" title="Synthetic profile active">
                  ACTIVE
                </span>
              )}
            </div>
          </div>

          {/* Full Clinical Form Card */}
          <div id="panel-content-01" className="col-panel-card col-panel-full">
            <div className="col-card-header">
              <div className="col-card-title-group">
                <span className="section-index-badge">01</span>
                <h2 className="col-card-title">CLINICAL INPUT COVARIATES</h2>
              </div>
              <div className="header-actions-right">
                <span className="feature-count-pill">
                  {schema ? `${schema.feature_count} FEATURES` : 'LOADING…'}
                </span>
                <button
                  type="button"
                  className="panel-collapse-btn desktop-only"
                  onClick={() => {
                    setIsLeftCollapsed(true);
                    setStoredCollapse('left', true);
                  }}
                  aria-expanded={true}
                  aria-controls="panel-content-01"
                  aria-label="Collapse clinical input panel"
                  title="Collapse clinical input panel"
                >
                  <ChevronLeft size={14} />
                </button>
              </div>
            </div>
            <ClinicalForm
              schema={schema}
              samplePatients={samplePatients}
              formValues={formValues}
              onFormChange={handleFormChange}
              onSubmit={handleSubmitAnalysis}
              onReset={handleResetForm}
              onLoadSample={handleLoadSample}
              selectedSampleId={selectedSampleId}
              isLoading={isPredicting}
              validationErrors={validationErrors}
            />
          </div>
        </section>

        {/* Center Column: 3D Heart Visualizer (PERMANENTLY EXPANDED & VISIBLE) */}
        <section
          className={`workstation-col col-center ${mobileSection === 'heart' ? 'mobile-active' : ''}`}
          aria-label="Interactive 3D Heart Visualizer"
        >
          <div className="col-panel-card heart-canvas-card">
            <div className="col-card-header heart-header">
              <div className="col-card-title-group">
                <span className="section-index-badge">02</span>
                <h2 className="col-card-title">3D CORONARY ARBORIZATION</h2>
              </div>
              <span className="canvas-hint">DRAG &bull; SCROLL &bull; CLICK VESSEL</span>
            </div>

            <HeartViewer
              vesselColormap={prediction?.vessel_colormap}
              selectedVessel={selectedVessel}
              onSelectVessel={setSelectedVessel}
              predictionsAvailable={!!prediction}
            />
          </div>
        </section>

        {/* Right Column: Prediction Engine, Attribution & Audit (Collapsible on Desktop) */}
        <section
          className={`workstation-col col-right ${showRightCollapsed ? 'is-collapsed-col' : ''} ${mobileSection === 'results' ? 'mobile-active' : ''}`}
          aria-label="Prediction Results and Explanations"
        >
          {/* Collapsed Rail (Desktop Only) */}
          <div
            className="collapsed-vertical-rail desktop-only right-rail"
            onClick={() => {
              if (!isDesktop) return;
              setIsRightCollapsed(false);
              setStoredCollapse('right', false);
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setIsRightCollapsed(false);
                setStoredCollapse('right', false);
              }
            }}
            aria-label="Expand results, attribution and audit sidebar"
            title="Click to expand Results & Audit Sidebar"
          >
            <div className="rail-top-action">
              <button
                type="button"
                className="panel-collapse-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsRightCollapsed(false);
                  setStoredCollapse('right', false);
                }}
                aria-expanded={false}
                aria-controls="panel-content-right"
                aria-label="Expand right sidebar"
              >
                <ChevronLeft size={14} />
              </button>
            </div>
            <div className="rail-badge-wrap">
              <span className="section-index-badge">03-05</span>
            </div>
            <span className="rail-vertical-text">RESULTS &amp; AUDIT</span>
            <div className="rail-bottom-meta">
              {prediction ? (
                <span
                  className={`rail-count-pill ${prediction.predictions?.CAD?.risk_level === 'High' ? 'alert-pill' : ''}`}
                  title={`CAD: ${((prediction.predictions?.CAD?.probability ?? 0) * 100).toFixed(1)}%`}
                >
                  {((prediction.predictions?.CAD?.probability ?? 0) * 100).toFixed(0)}%
                </span>
              ) : (
                <span className="rail-count-pill" title="Awaiting inference">
                  STANDBY
                </span>
              )}
            </div>
          </div>

          {/* Full Expanded Right Column Content */}
          <div id="panel-content-right" className="col-panel-full col-right-stack">
            {/* Desktop Dock Header for Collapsing Sidebar */}
            <div className="col-dock-bar desktop-only">
              <span className="col-dock-title">RESEARCH RESULTS &amp; AUDIT</span>
              <button
                type="button"
                className="panel-collapse-btn"
                onClick={() => {
                  setIsRightCollapsed(true);
                  setStoredCollapse('right', true);
                }}
                aria-expanded={true}
                aria-label="Collapse right sidebar"
                title="Collapse right sidebar into compact rail"
              >
                <ChevronRight size={14} />
              </button>
            </div>

            {predictError && (
              <div className="prediction-error-banner">
                <XCircle size={16} />
                <span>{predictError}</span>
              </div>
            )}

            {/* Panel 03: Risk Prediction Cards */}
            <div className={`col-panel-card risk-card-panel ${showPredictionCollapsed ? 'is-collapsed' : ''}`}>
              <div
                className="col-card-header header-interactive-toggle"
                onClick={() => {
                  if (!isDesktop) return;
                  const next = !isPredictionCollapsed;
                  setIsPredictionCollapsed(next);
                  setStoredCollapse('prediction', next);
                }}
              >
                <div className="col-card-title-group">
                  <span className="section-index-badge">03</span>
                  <h2 className="col-card-title">PREDICTION ENGINE</h2>
                </div>
                <div className="header-actions-right">
                  {prediction ? (
                    <span
                      className={`summary-status-pill ${prediction.predictions?.CAD?.risk_level === 'High' ? 'highlight' : ''}`}
                    >
                      CAD: {((prediction.predictions?.CAD?.probability ?? 0) * 100).toFixed(1)}%
                    </span>
                  ) : (
                    <span className="summary-status-pill muted">AWAITING</span>
                  )}
                  <button
                    type="button"
                    className="panel-collapse-btn desktop-only"
                    onClick={(e) => {
                      e.stopPropagation();
                      const next = !isPredictionCollapsed;
                      setIsPredictionCollapsed(next);
                      setStoredCollapse('prediction', next);
                    }}
                    aria-expanded={!showPredictionCollapsed}
                    aria-controls="panel-content-03"
                    aria-label={showPredictionCollapsed ? 'Expand prediction engine' : 'Collapse prediction engine'}
                    title={showPredictionCollapsed ? 'Expand prediction engine' : 'Collapse prediction engine'}
                  >
                    {showPredictionCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                  </button>
                </div>
              </div>

              <div id="panel-content-03" className="panel-collapsible-body">
                <RiskDashboard
                  prediction={prediction}
                  loading={isPredicting}
                  selectedVessel={selectedVessel}
                  onSelectVessel={setSelectedVessel}
                  isStale={isStale}
                />
              </div>
            </div>

            {/* Panel 04: Feature Explanations & Model Interpretability */}
            <div className={`col-panel-card explanations-card-panel ${showAttributionCollapsed ? 'is-collapsed' : ''}`}>
              <div
                className="col-card-header header-interactive-toggle"
                onClick={() => {
                  if (!isDesktop) return;
                  const next = !isAttributionCollapsed;
                  setIsAttributionCollapsed(next);
                  setStoredCollapse('attribution', next);
                }}
              >
                <div className="col-card-title-group">
                  <span className="section-index-badge">04</span>
                  <h2 className="col-card-title">FEATURE ATTRIBUTION</h2>
                </div>
                <div className="header-actions-right">
                  {prediction ? (
                    <span className="summary-status-pill">
                      TOP: {prediction.explanations?.CAD?.[0]?.feature || 'SHAP'}
                    </span>
                  ) : (
                    <span className="summary-status-pill muted">STANDBY</span>
                  )}
                  <button
                    type="button"
                    className="panel-collapse-btn desktop-only"
                    onClick={(e) => {
                      e.stopPropagation();
                      const next = !isAttributionCollapsed;
                      setIsAttributionCollapsed(next);
                      setStoredCollapse('attribution', next);
                    }}
                    aria-expanded={!showAttributionCollapsed}
                    aria-controls="panel-content-04"
                    aria-label={showAttributionCollapsed ? 'Expand feature attribution' : 'Collapse feature attribution'}
                    title={showAttributionCollapsed ? 'Expand feature attribution' : 'Collapse feature attribution'}
                  >
                    {showAttributionCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                  </button>
                </div>
              </div>

              <div id="panel-content-04" className="panel-collapsible-body">
                <FeatureExplanations
                  prediction={prediction}
                  loading={isPredicting}
                />
              </div>
            </div>

            {/* Panel 05: Model Evaluation & CV Audit (Inline Collapsible) */}
            <div className={`col-panel-card metrics-inline-panel ${showMetricsInlineCollapsed ? 'is-collapsed' : ''}`}>
              <div
                className="col-card-header header-interactive-toggle"
                onClick={() => {
                  if (!isDesktop) return;
                  const next = !isMetricsInlineCollapsed;
                  setIsMetricsInlineCollapsed(next);
                  setStoredCollapse('metrics_inline', next);
                }}
              >
                <div className="col-card-title-group">
                  <span className="section-index-badge">05</span>
                  <h2 className="col-card-title">MODEL EVALUATION &amp; CV AUDIT</h2>
                </div>
                <div className="header-actions-right">
                  <span className="summary-status-pill">5-FOLD CV</span>
                  <button
                    type="button"
                    className="panel-collapse-btn desktop-only"
                    onClick={(e) => {
                      e.stopPropagation();
                      const next = !isMetricsInlineCollapsed;
                      setIsMetricsInlineCollapsed(next);
                      setStoredCollapse('metrics_inline', next);
                    }}
                    aria-expanded={!showMetricsInlineCollapsed}
                    aria-controls="panel-content-05"
                    aria-label={showMetricsInlineCollapsed ? 'Expand model evaluation panel' : 'Collapse model evaluation panel'}
                    title={showMetricsInlineCollapsed ? 'Expand model evaluation panel' : 'Collapse model evaluation panel'}
                  >
                    {showMetricsInlineCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                  </button>
                </div>
              </div>

              <div id="panel-content-05" className="panel-collapsible-body inline-metrics-body">
                <div className="inline-metrics-summary-grid">
                  <div className="inline-metric-item">
                    <span className="metric-item-target">[CAD] OVERALL</span>
                    <span className="metric-item-value">92.8% AUC</span>
                    <span className="metric-item-algo">RandomForest</span>
                  </div>
                  <div className="inline-metric-item">
                    <span className="metric-item-target">[LAD] ARTERY</span>
                    <span className="metric-item-value">83.7% AUC</span>
                    <span className="metric-item-algo">GradientBoosting</span>
                  </div>
                  <div className="inline-metric-item">
                    <span className="metric-item-target">[LCX] ARTERY</span>
                    <span className="metric-item-value">71.3% AUC</span>
                    <span className="metric-item-algo">RandomForest</span>
                  </div>
                  <div className="inline-metric-item">
                    <span className="metric-item-target">[RCA] ARTERY</span>
                    <span className="metric-item-value">70.9% AUC</span>
                    <span className="metric-item-algo">LogisticRegression</span>
                  </div>
                </div>
                <div className="inline-metrics-footer">
                  <span className="inline-audit-badge">ZERO TARGET LEAKAGE AUDITED (n=303)</span>
                  <button
                    type="button"
                    className="btn-open-full-modal"
                    onClick={() => setIsMetricsOpen(true)}
                  >
                    [ VIEW FULL AUDIT MODAL &rarr; ]
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Persistent Clinical Safety Disclaimer */}
      <footer className="workstation-footer">
        <SafetyDisclaimer />
      </footer>

      {/* Model Performance Cross-Validation Modal */}
      <ModelMetricsModal
        isOpen={isMetricsOpen}
        onClose={() => setIsMetricsOpen(false)}
        metricsData={metrics}
        loading={metricsLoading}
        error={metricsError}
      />
    </div>
  );
};

export default App;

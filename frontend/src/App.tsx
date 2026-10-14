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
  checkHealth,
  fetchSchema,
  fetchSamplePatients,
  fetchMetrics,
  predictRisk,
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
import { AlertTriangle, XCircle, ClipboardList, Activity, BarChart3 } from 'lucide-react';

type MobileSection = 'form' | 'heart' | 'results';

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

  // Mobile Section Navigation
  const [mobileSection, setMobileSection] = useState<MobileSection>('form');

  // Initial Load: Health, Schema, Sample Patients, Metrics
  const loadHealth = useCallback(async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const data = await checkHealth();
      setHealth(data);
    } catch (err: any) {
      setHealth(null);
      setHealthError(err.message || 'Backend connection failed');
    } finally {
      setHealthLoading(false);
    }
  }, []);

  const loadInitialData = useCallback(async () => {
    await loadHealth();

    try {
      const schemaData = await fetchSchema();
      setSchema(schemaData);

      // Initialize default values from schema
      const initialForm: Record<string, any> = {};
      Object.entries(schemaData.features).forEach(([key, meta]) => {
        initialForm[key] = meta.default;
      });
      setFormValues(initialForm);
    } catch (err: any) {
      console.error('Failed to load schema:', err);
    }

    try {
      const samplesData = await fetchSamplePatients();
      setSamplePatients(samplesData);
    } catch (err: any) {
      console.error('Failed to load sample profiles:', err);
    }

    try {
      setMetricsLoading(true);
      const metricsData = await fetchMetrics();
      setMetrics(metricsData);
    } catch (err: any) {
      setMetricsError(err.message || 'Failed to load metrics');
    } finally {
      setMetricsLoading(false);
    }
  }, [loadHealth]);

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
            <strong>SYS.ERR // BACKEND UNREACHABLE:</strong> Flask API is offline on{' '}
            <code>localhost:5000</code>. Start with <code>python src/api/app.py</code>.
          </span>
          <button type="button" onClick={loadHealth} className="alert-retry-btn">
            [ RETRY ]
          </button>
        </div>
      )}

      {/* Hero / Research Overview Ribbon */}
      <section className="research-hero-banner" aria-label="Research Overview">
        <div className="hero-headline-block">
          <div className="hero-kicker-row">
            <span className="hero-kicker-tag">[ TRACK A // MULTIMODAL CARDIO ]</span>
            <span className="hero-kicker-dot" />
            <span className="hero-kicker-sub">3D ANATOMICAL RECONSTRUCTION &amp; MULTI-VESSEL STENOSIS</span>
          </div>
          <h1 className="hero-headline">
            CARDIOVASCULAR AI DECISION SYSTEM
          </h1>
          <p className="hero-summary">
            End-to-end multi-target clinical machine learning pipeline predicting overall CAD along with vessel-specific stenosis across LAD, LCX, and RCA branches from 54 multi-modal clinical covariates. Evaluated via stratified 5-fold cross-validation with zero target leakage on the Z-Alizadeh Sani cohort (n=303) and mapped onto interactive 3D human coronary anatomy.
          </p>
        </div>

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
      <main className="workstation-main-layout">
        {/* Left Column: Clinical Form & Synthetic Patient Picker */}
        <section
          className={`workstation-col col-left ${mobileSection === 'form' ? 'mobile-active' : ''}`}
          aria-label="Clinical Input Features"
        >
          <div className="col-panel-card">
            <div className="col-card-header">
              <div className="col-card-title-group">
                <span className="section-index-badge">01</span>
                <h2 className="col-card-title">CLINICAL INPUT COVARIATES</h2>
              </div>
              <span className="feature-count-pill">
                {schema ? `${schema.feature_count} FEATURES` : 'LOADING…'}
              </span>
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

        {/* Center Column: 3D Heart Visualizer */}
        <section
          className={`workstation-col col-center ${mobileSection === 'heart' ? 'mobile-active' : ''}`}
          aria-label="Interactive 3D Heart"
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

        {/* Right Column: Risk Dashboard & Feature Explanations */}
        <section
          className={`workstation-col col-right ${mobileSection === 'results' ? 'mobile-active' : ''}`}
          aria-label="Prediction Results and Explanations"
        >
          {predictError && (
            <div className="prediction-error-banner">
              <XCircle size={16} />
              <span>{predictError}</span>
            </div>
          )}

          {/* Risk Prediction Cards */}
          <div className="col-panel-card risk-card-panel">
            <div className="col-card-header">
              <div className="col-card-title-group">
                <span className="section-index-badge">03</span>
                <h2 className="col-card-title">PREDICTION ENGINE</h2>
              </div>
              {prediction && (
                <span className="timestamp-pill">INFERENCE READY</span>
              )}
            </div>

            <RiskDashboard
              prediction={prediction}
              loading={isPredicting}
              selectedVessel={selectedVessel}
              onSelectVessel={setSelectedVessel}
              isStale={isStale}
            />
          </div>

          {/* Feature Explanations & Model Interpretability */}
          <div className="col-panel-card explanations-card-panel">
            <div className="col-card-header">
              <div className="col-card-title-group">
                <span className="section-index-badge">04</span>
                <h2 className="col-card-title">FEATURE ATTRIBUTION</h2>
              </div>
            </div>
            <FeatureExplanations
              prediction={prediction}
              loading={isPredicting}
            />
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

import React, { useState, useMemo } from 'react';
import type {
  SchemaResponse,
  SamplePatientsResponse,
  SamplePatientProfile,
  FeatureNumericMeta,
  FeatureCategoricalMeta
} from '../types/api';
import {
  User,
  HeartPulse,
  Stethoscope,
  Activity,
  FlaskConical,
  Radio,
  Sparkles,
  RotateCcw,
  AlertCircle,
  AlertTriangle,
  Play,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface ClinicalFormProps {
  schema: SchemaResponse | null;
  samplePatients: SamplePatientsResponse | null;
  formValues: Record<string, any>;
  onFormChange: (updated: Record<string, any>) => void;
  onSubmit: () => void;
  onReset: () => void;
  onLoadSample: (sample: SamplePatientProfile) => void;
  selectedSampleId: string | null;
  isLoading: boolean;
  validationErrors: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Clinical Domain Groupings for the 54 Alizadeh-Sani features
// ---------------------------------------------------------------------------
const CATEGORY_MAP: Record<string, { label: string; shortLabel: string; icon: React.ReactNode; features: string[] }> = {
  demographics: {
    label: 'Demographics & Vitals',
    shortLabel: 'Demo',
    icon: <User size={13} />,
    features: ['Age', 'Sex', 'Weight', 'Length', 'BMI', 'BP', 'PR']
  },
  history: {
    label: 'Cardiovascular History',
    shortLabel: 'History',
    icon: <HeartPulse size={13} />,
    features: [
      'DM', 'HTN', 'Current Smoker', 'EX-Smoker', 'FH',
      'Obesity', 'DLP', 'CRF', 'CVA', 'CHF', 'Airway disease', 'Thyroid Disease'
    ]
  },
  symptoms: {
    label: 'Symptoms & Bedside Exam',
    shortLabel: 'Symptoms',
    icon: <Stethoscope size={13} />,
    features: [
      'Typical Chest Pain', 'Atypical', 'Nonanginal', 'LowTH Ang',
      'Dyspnea', 'Function Class', 'Edema', 'Weak Peripheral Pulse',
      'Lung rales', 'Systolic Murmur', 'Diastolic Murmur'
    ]
  },
  ecg: {
    label: 'Electrocardiogram (ECG)',
    shortLabel: 'ECG',
    icon: <Activity size={13} />,
    features: ['Q Wave', 'St Elevation', 'St Depression', 'Tinversion', 'LVH', 'Poor R Progression', 'BBB']
  },
  labs: {
    label: 'Laboratory Biochemistry',
    shortLabel: 'Labs',
    icon: <FlaskConical size={13} />,
    features: ['FBS', 'CR', 'TG', 'LDL', 'HDL', 'BUN', 'ESR', 'HB', 'K', 'Na', 'WBC', 'Lymph', 'Neut', 'PLT']
  },
  echo: {
    label: 'Echocardiography (TTE)',
    shortLabel: 'Echo',
    icon: <Radio size={13} />,
    features: ['EF-TTE', 'Region RWMA', 'VHD']
  }
};

const CATEGORY_ORDER = ['demographics', 'history', 'symptoms', 'ecg', 'labs', 'echo'];

// Age cohort: observed dataset spans ages ~30–86, warn non-blockingly if outside that range
const AGE_COHORT_MIN = 30;
const AGE_COHORT_MAX = 86;

const formatBound = (val: number | undefined | null): string => {
  if (val === undefined || val === null || isNaN(val)) return '';
  return Number.isInteger(val) ? val.toString() : Number(val.toFixed(1)).toString();
};

export const ClinicalForm: React.FC<ClinicalFormProps> = ({
  schema,
  samplePatients,
  formValues,
  onFormChange,
  onSubmit,
  onReset,
  onLoadSample,
  selectedSampleId,
  isLoading,
  validationErrors
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('demographics');

  // Categorize features based on the schema
  const categorizedFeatures = useMemo(() => {
    if (!schema) return {};

    const categorized: Record<string, string[]> = {
      demographics: [],
      history: [],
      symptoms: [],
      ecg: [],
      labs: [],
      echo: [],
      other: []
    };

    const assigned = new Set<string>();

    Object.entries(CATEGORY_MAP).forEach(([catKey, meta]) => {
      meta.features.forEach((feat) => {
        if (schema.ordered_features.includes(feat)) {
          categorized[catKey].push(feat);
          assigned.add(feat);
        }
      });
    });

    // Catch any remaining features from schema
    schema.ordered_features.forEach((feat) => {
      if (!assigned.has(feat)) {
        categorized.other.push(feat);
      }
    });

    return categorized;
  }, [schema]);

  const handleFieldChange = (field: string, rawVal: any, type: 'numeric' | 'categorical') => {
    let finalVal = rawVal;
    if (type === 'numeric') {
      const parsed = parseFloat(rawVal);
      finalVal = isNaN(parsed) ? '' : parsed;
    }
    onFormChange({
      ...formValues,
      [field]: finalVal
    });
  };

  const hasErrors = Object.keys(validationErrors).length > 0;

  // Age cohort warning (non-blocking)
  const ageVal = Number(formValues['Age']);
  const showAgeCohortWarning =
    !isNaN(ageVal) && ageVal >= 18 && ageVal <= 100 &&
    (ageVal < AGE_COHORT_MIN || ageVal > AGE_COHORT_MAX);

  // Category step navigation
  const currentIndex = CATEGORY_ORDER.indexOf(activeCategory);
  const prevCategoryKey = currentIndex > 0 ? CATEGORY_ORDER[currentIndex - 1] : null;
  const nextCategoryKey = currentIndex < CATEGORY_ORDER.length - 1 ? CATEGORY_ORDER[currentIndex + 1] : null;

  return (
    <div className="clinical-form-panel">
      {/* Synthetic Profile Loader */}
      <div className="sample-patient-dock">
        <div className="sample-dock-header">
          <div className="dock-title-group">
            <Sparkles size={13} className="text-acid" />
            <span className="dock-title">SYNTHETIC CLINICAL PROFILE</span>
          </div>
          <span className="synthetic-badge">[ DEMO COHORT ]</span>
        </div>

        <select
          className="sample-select-dropdown"
          value={selectedSampleId || ''}
          onChange={(e) => {
            const sid = e.target.value;
            const found = samplePatients?.samples.find((s) => s.id === sid);
            if (found) {
              onLoadSample(found);
            }
          }}
          aria-label="Load synthetic clinical profile"
        >
          <option value="" disabled>
            — SELECT A SYNTHETIC PATIENT PROFILE —
          </option>
          {samplePatients?.samples.map((sample) => (
            <option key={sample.id} value={sample.id}>
              {sample.label} — {sample.summary}
            </option>
          ))}
        </select>
        <p className="synthetic-disclaimer-micro">
          * Synthetic profiles illustrate pipeline behavior only &bull; Zero real patient PHI.
        </p>
      </div>

      {/* 6 Accessible Clinical Categories — 3x2 Responsive Grid */}
      <div className="form-category-nav-wrapper">
        <div className="form-category-grid" role="tablist" aria-label="Clinical feature categories">
          {CATEGORY_ORDER.map((key) => {
            const cat = CATEGORY_MAP[key];
            const count = categorizedFeatures[key]?.length || 0;
            const isActive = activeCategory === key;
            const errorCount = (categorizedFeatures[key] || []).filter(
              (f) => !!validationErrors[f]
            ).length;

            return (
              <button
                key={key}
                type="button"
                role="tab"
                id={`cat-tab-${key}`}
                aria-selected={isActive}
                aria-controls={`cat-panel-${key}`}
                className={`cat-tab-btn ${isActive ? 'active' : ''} ${errorCount > 0 ? 'has-error' : ''}`}
                onClick={() => setActiveCategory(key)}
                title={`${cat.label} (${count} features)`}
              >
                <span className="tab-icon">{cat.icon}</span>
                <span className="tab-label">{cat.shortLabel}</span>
                {errorCount > 0 ? (
                  <span className="tab-err-badge" title={`${errorCount} validation errors`}>
                    {errorCount}
                  </span>
                ) : (
                  <span className="tab-count">{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Form Fields Grid */}
      <div
        className="form-fields-scroll-area"
        id={`cat-panel-${activeCategory}`}
        role="tabpanel"
        aria-labelledby={`cat-tab-${activeCategory}`}
      >
        {!schema ? (
          <div className="form-loading-placeholder">
            <span className="spinner" />
            <span>Loading feature schema…</span>
          </div>
        ) : (
          <>
            <div className="fields-category-header">
              <span className="category-full-title">
                {CATEGORY_MAP[activeCategory]?.label}
              </span>
              <span className="category-meta-count">
                {categorizedFeatures[activeCategory]?.length || 0} features
              </span>
            </div>

            <div className="fields-grid">
              {(categorizedFeatures[activeCategory] || []).map((featName) => {
                const meta = schema.features[featName];
                if (!meta) return null;
                const currentVal = formValues[featName] !== undefined ? formValues[featName] : '';
                const error = validationErrors[featName];

                if (meta.type === 'categorical') {
                  const catMeta = meta as FeatureCategoricalMeta;
                  return (
                    <div key={featName} className={`form-field-group ${error ? 'field-error' : ''}`}>
                      <label className="field-label" htmlFor={`field-${featName}`}>
                        <span className="field-name">{featName}</span>
                      </label>
                      <select
                        id={`field-${featName}`}
                        className="field-input field-select"
                        value={currentVal}
                        onChange={(e) => handleFieldChange(featName, e.target.value, 'categorical')}
                      >
                        {catMeta.options.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                      {error && <span className="field-err-msg">{error}</span>}
                    </div>
                  );
                }

                // Numeric Feature
                const numMeta = meta as FeatureNumericMeta;
                const step = numMeta.max > 100 ? '1' : numMeta.max > 10 ? '0.1' : '0.01';
                const isAgeField = featName === 'Age';

                return (
                  <div key={featName} className={`form-field-group ${error ? 'field-error' : ''}`}>
                    <label className="field-label" htmlFor={`field-${featName}`}>
                      <span className="field-name">{featName}</span>
                      <span className="field-bounds-hint">
                        [{formatBound(numMeta.min)} // {formatBound(numMeta.max)}]
                      </span>
                    </label>
                    <input
                      id={`field-${featName}`}
                      type="number"
                      step={step}
                      min={numMeta.min}
                      max={numMeta.max}
                      className="field-input field-number"
                      value={typeof currentVal === 'number' && !Number.isInteger(currentVal) ? Number(currentVal.toFixed(2)) : currentVal}
                      placeholder={formatBound(numMeta.default)}
                      onChange={(e) => handleFieldChange(featName, e.target.value, 'numeric')}
                    />
                    {error && <span className="field-err-msg">{error}</span>}

                    {/* Age cohort extrapolation warning (non-blocking) */}
                    {isAgeField && showAgeCohortWarning && (
                      <div className="age-cohort-warning" role="note">
                        <AlertTriangle size={13} className="warning-icon" />
                        <span>
                          <strong>CAUTION // EXTRAPOLATION:</strong> Age {ageVal} is outside observed training cohort (30–86 yrs). Outputs are statistical extrapolations.
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Stepper buttons to easily navigate between categories */}
            <div className="category-step-nav">
              {prevCategoryKey ? (
                <button
                  type="button"
                  className="btn-step-prev"
                  onClick={() => setActiveCategory(prevCategoryKey)}
                >
                  <ChevronLeft size={13} />
                  <span>PREV: {CATEGORY_MAP[prevCategoryKey].shortLabel.toUpperCase()}</span>
                </button>
              ) : <div />}

              <span className="category-step-counter">
                [ {currentIndex + 1} / {CATEGORY_ORDER.length} ]
              </span>

              {nextCategoryKey ? (
                <button
                  type="button"
                  className="btn-step-next"
                  onClick={() => setActiveCategory(nextCategoryKey)}
                >
                  <span>NEXT: {CATEGORY_MAP[nextCategoryKey].shortLabel.toUpperCase()}</span>
                  <ChevronRight size={13} />
                </button>
              ) : <div />}
            </div>
          </>
        )}
      </div>

      {/* Global Validation Banner if any blocking errors exist */}
      {hasErrors && (
        <div className="form-validation-summary" role="alert">
          <AlertCircle size={14} />
          <span>
            <strong>VAL.ERR // </strong>
            {Object.keys(validationErrors).length} field
            {Object.keys(validationErrors).length > 1 ? 's' : ''} out of allowed clinical bounds.
          </span>
        </div>
      )}

      {/* Form Action Controls */}
      <div className="form-actions-bar">
        <button
          type="button"
          className="btn-form-reset"
          onClick={onReset}
          disabled={isLoading}
          title="Reset all fields to dataset defaults"
        >
          <RotateCcw size={13} />
          <span>[ RESET ]</span>
        </button>

        <button
          type="button"
          className="btn-form-submit"
          onClick={onSubmit}
          disabled={isLoading || hasErrors || !schema}
          aria-busy={isLoading}
        >
          {isLoading ? (
            <>
              <span className="spinner-sm" />
              <span>COMPUTING INFERENCE…</span>
            </>
          ) : (
            <>
              <Play size={13} fill="currentColor" />
              <span>[ RUN MULTI-VESSEL ANALYSIS → ]</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

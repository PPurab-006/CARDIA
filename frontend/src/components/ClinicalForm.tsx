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
  Play
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
    shortLabel: 'Demographics',
    icon: <User size={13} />,
    features: ['Age', 'Sex', 'Weight', 'Length', 'BMI', 'BP', 'PR']
  },
  history: {
    label: 'Cardiovascular History',
    shortLabel: 'Hx',
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

// Age cohort: dataset spans ages ~30–86, warn if outside that range
const AGE_COHORT_MIN = 30;
const AGE_COHORT_MAX = 86;

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

  return (
    <div className="clinical-form-panel">
      {/* Sample Patient Loader */}
      <div className="sample-patient-dock">
        <div className="sample-dock-header">
          <div className="dock-title-group">
            <Sparkles size={13} className="text-cyan" />
            <span className="dock-title">Synthetic Profile</span>
          </div>
          <span className="synthetic-badge">Illustration Only</span>
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
            — Select a synthetic profile —
          </option>
          {samplePatients?.samples.map((sample) => (
            <option key={sample.id} value={sample.id}>
              {sample.label} — {sample.summary}
            </option>
          ))}
        </select>
        <p className="synthetic-disclaimer-micro">
          Synthetic profiles illustrate pipeline behavior only — not real patients.
        </p>
      </div>

      {/* Category Tabs — horizontal scroll row */}
      <div className="form-category-tabs" role="tablist" aria-label="Clinical feature categories">
        {Object.entries(CATEGORY_MAP).map(([key, cat]) => {
          const count = categorizedFeatures[key]?.length || 0;
          if (count === 0) return null;
          const isActive = activeCategory === key;
          const hasErrorInCat = (categorizedFeatures[key] || []).some(
            (f) => !!validationErrors[f]
          );

          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`cat-tab-btn ${isActive ? 'active' : ''} ${hasErrorInCat ? 'has-error' : ''}`}
              onClick={() => setActiveCategory(key)}
              title={cat.label}
            >
              <span className="tab-icon">{cat.icon}</span>
              <span className="tab-label">{cat.shortLabel}</span>
              {hasErrorInCat ? (
                <span className="tab-err-dot" title="Validation errors" />
              ) : (
                <span className="tab-count">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active Form Fields Grid */}
      <div className="form-fields-scroll-area">
        {!schema ? (
          <div className="form-loading-placeholder">
            <span className="spinner" />
            <span>Loading feature schema…</span>
          </div>
        ) : (
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
                      [{numMeta.min}–{numMeta.max}]
                    </span>
                  </label>
                  <input
                    id={`field-${featName}`}
                    type="number"
                    step={step}
                    min={numMeta.min}
                    max={numMeta.max}
                    className="field-input field-number"
                    value={currentVal}
                    placeholder={`${numMeta.default}`}
                    onChange={(e) => handleFieldChange(featName, e.target.value, 'numeric')}
                  />
                  {error && <span className="field-err-msg">{error}</span>}
                  {/* Age cohort warning (non-blocking) */}
                  {isAgeField && showAgeCohortWarning && (
                    <div className="age-cohort-warning" role="note">
                      <AlertTriangle size={12} />
                      <span>
                        Age {ageVal} is outside the training cohort range (30–86 yrs). Predictions
                        are extrapolated and may be less reliable.
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Global Validation Banner if any errors exist */}
      {hasErrors && (
        <div className="form-validation-summary">
          <AlertCircle size={13} />
          <span>
            {Object.keys(validationErrors).length} field
            {Object.keys(validationErrors).length > 1 ? 's' : ''} exceed valid range. Correct
            highlighted values before running analysis.
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
          <span>Reset</span>
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
              <span>Analyzing…</span>
            </>
          ) : (
            <>
              <Play size={14} fill="currentColor" />
              <span>Run Analysis</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

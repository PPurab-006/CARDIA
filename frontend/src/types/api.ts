export interface FeatureNumericMeta {
  type: 'numeric';
  min: number;
  max: number;
  default: number;
}

export interface FeatureCategoricalMeta {
  type: 'categorical';
  options: string[];
  default: string;
}

export type FeatureMeta = FeatureNumericMeta | FeatureCategoricalMeta;

export interface SchemaResponse {
  status: string;
  targets: Record<string, string>;
  feature_count: number;
  ordered_features: string[];
  features: Record<string, FeatureMeta>;
}

export interface SamplePatientProfile {
  id: string;
  label: string;
  summary: string;
  profile: Record<string, any>;
}

export interface SamplePatientsResponse {
  status: string;
  synthetic_notice: string;
  samples: SamplePatientProfile[];
}

export interface TargetPrediction {
  probability: number;
  predicted_class: number;
  risk_level: 'Low' | 'Moderate' | 'High';
  color_hex: string;
  risk_label: string;
  model_architecture: string;
  cv_roc_auc: number | null;
}

export interface VesselVisualization {
  name: string;
  probability: number;
  risk_level: 'Low' | 'Moderate' | 'High';
  color_hex: string;
}

export interface ExplanationItem {
  feature: string;
  contribution_score: number;
  direction: 'increases_risk' | 'decreases_risk';
  patient_value: string | null;
}

export interface PredictionResponse {
  status: string;
  predictions: {
    CAD: TargetPrediction;
    LAD: TargetPrediction;
    LCX: TargetPrediction;
    RCA: TargetPrediction;
  };
  vessel_colormap: {
    LAD: VesselVisualization;
    LCX: VesselVisualization;
    RCA: VesselVisualization;
  };
  explanations: {
    CAD?: ExplanationItem[];
    LAD?: ExplanationItem[];
    LCX?: ExplanationItem[];
    RCA?: ExplanationItem[];
  };
  global_top_features: Record<string, string[]>;
  disclaimer: string;
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  models_loaded: Record<string, string>;
  feature_count: number;
  dataset_provenance: {
    dataset: string;
    uci_id: number;
    doi: string;
    sample_size: number;
  };
}

export interface TargetMetricInfo {
  target: string;
  target_description: string;
  selected_model: string;
  cross_validation: string;
  metrics: {
    accuracy: number;
    precision: number;
    recall: number;
    f1: number;
    roc_auc: number;
    pos_support: number;
    neg_support: number;
    total_support: number;
  };
  selection_rationale: string;
}

export interface MetricsResponse {
  status: string;
  validation_method: string;
  cohort_size: number;
  metrics: Record<string, TargetMetricInfo>;
}

import type { TargetPrediction, PredictionResponse } from '../types/api';
import { Heart, Activity, AlertCircle, Info } from 'lucide-react';

interface RiskDashboardProps {
  prediction: PredictionResponse | null;
  loading: boolean;
  selectedVessel: string | null;
  onSelectVessel: (vesselKey: string | null) => void;
  isStale: boolean;
}

export const RiskDashboard: React.FC<RiskDashboardProps> = ({
  prediction,
  loading,
  selectedVessel,
  onSelectVessel,
  isStale
}) => {
  if (!prediction && !loading) {
    return (
      <div className="risk-dashboard-empty">
        <div className="empty-content">
          <Heart size={32} className="text-slate-muted" />
          <h3 className="empty-title">Awaiting Clinical Analysis</h3>
          <p className="empty-text">
            Configure patient clinical features in the left panel or select a synthetic profile, then click <strong>Run Analysis</strong> to compute multi-target risk predictions.
          </p>
        </div>
      </div>
    );
  }

  const cad = prediction?.predictions.CAD;
  const lad = prediction?.predictions.LAD;
  const lcx = prediction?.predictions.LCX;
  const rca = prediction?.predictions.RCA;

  const renderCard = (
    key: string,
    title: string,
    target: TargetPrediction | undefined,
    isVessel: boolean
  ) => {
    if (!target) return null;
    const isSelected = selectedVessel === key;
    const probPct = (target.probability * 100).toFixed(1);
    const isHigh = target.risk_level === 'High';
    const isMod = target.risk_level === 'Moderate';

    const getRiskColor = () => {
      if (isHigh) return '#ef4444';
      if (isMod) return '#f59e0b';
      return '#10b981';
    };

    const color = getRiskColor();

    return (
      <div
        key={key}
        className={`risk-card ${isVessel ? 'vessel-card' : 'cad-card'} ${isSelected ? 'selected' : ''}`}
        onClick={() => {
          if (isVessel) {
            onSelectVessel(isSelected ? null : key);
          }
        }}
        role={isVessel ? 'button' : undefined}
        tabIndex={isVessel ? 0 : undefined}
      >
        <div className="risk-card-header">
          <div className="risk-card-title-group">
            <span className="target-code-tag">{key}</span>
            <span className="target-title-text">{title}</span>
          </div>
          <span
            className="risk-badge"
            style={{
              backgroundColor: `${color}20`,
              color: color,
              borderColor: `${color}50`
            }}
          >
            {target.risk_label}
          </span>
        </div>

        <div className="risk-card-metric-row">
          <div className="prob-display">
            <span className="prob-value" style={{ color }}>
              {probPct}%
            </span>
            <span className="prob-subtext">Estimated Probability</span>
          </div>

          <div className="classification-display">
            <span className="class-label">Binary Model Class:</span>
            <span className={`class-value ${target.predicted_class === 1 ? 'positive' : 'negative'}`}>
              {target.predicted_class === 1 ? (isVessel ? 'Stenosis (≥50%)' : 'CAD Positive') : (isVessel ? 'Normal (<50%)' : 'Normal')}
            </span>
          </div>
        </div>

        {/* Progress Fill Meter */}
        <div className="risk-meter-track">
          <div
            className="risk-meter-bar"
            style={{
              width: `${Math.min(100, target.probability * 100)}%`,
              backgroundColor: color
            }}
          />
        </div>

        <div className="risk-card-footer">
          <span className="model-spec">
            <Activity size={11} className="inline-icon" />
            {target.model_architecture}
          </span>
          {target.cv_roc_auc && (
            <span className="auc-spec">CV AUC: {(target.cv_roc_auc * 100).toFixed(1)}%</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`risk-dashboard-container ${loading ? 'loading-opacity' : ''}`}>
      {isStale && (
        <div className="stale-warning-banner">
          <AlertCircle size={14} className="text-amber" />
          <span>Inputs modified since last run. Click <strong>Run Analysis</strong> to recalculate.</span>
        </div>
      )}

      {/* Primary CAD Overview Card */}
      <div className="cad-overview-section">
        {renderCard('CAD', 'Overall Coronary Artery Disease', cad, false)}
      </div>

      {/* Multi-Vessel Stenosis Section */}
      <div className="vessel-predictions-section">
        <div className="section-header-row">
          <h4 className="vessel-section-title">Vessel-Specific Stenosis (≥50% Diameter)</h4>
          <span className="vessel-sub-hint">Click a vessel card to highlight in 3D</span>
        </div>

        <div className="vessel-cards-grid">
          {renderCard('LAD', 'Left Anterior Descending', lad, true)}
          {renderCard('LCX', 'Left Circumflex Artery', lcx, true)}
          {renderCard('RCA', 'Right Coronary Artery', rca, true)}
        </div>
      </div>

      {/* Honest Scientific Calibration & Illustrative Categories Notice */}
      <div className="risk-methodology-note">
        <Info size={13} className="info-icon" />
        <p>
          <strong>Calibration Note:</strong> Risk scores are statistical probabilities computed by models trained on n=303 cohort. They are not formally calibrated clinical probabilities. "Low/Moderate/High" bands are illustrative visualization tiers (&lt;30%, 30–60%, &gt;60%), not validated diagnostic decision boundaries.
        </p>
      </div>
    </div>
  );
};

import React from 'react';
import type { TargetPrediction, PredictionResponse } from '../types/api';
import { Heart, Activity, AlertCircle, AlertTriangle, Info } from 'lucide-react';

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
          <Heart size={26} className="text-muted" />
          <h3 className="empty-title">[ AWAITING INFERENCE ]</h3>
          <p className="empty-text">
            Configure patient clinical features and click <strong>[ RUN MULTI-VESSEL ANALYSIS ]</strong> to compute multi-vessel CAD risk.
          </p>
        </div>
      </div>
    );
  }

  const cad = prediction?.predictions.CAD;
  const lad = prediction?.predictions.LAD;
  const lcx = prediction?.predictions.LCX;
  const rca = prediction?.predictions.RCA;

  const getRiskColor = (riskLevel: string | undefined) => {
    if (riskLevel === 'High') return '#ef4444';
    if (riskLevel === 'Moderate') return '#f59e0b';
    return '#10b981';
  };

  const renderCard = (
    key: string,
    title: string,
    target: TargetPrediction | undefined,
    isVessel: boolean
  ) => {
    if (!target) return null;
    const isSelected = selectedVessel === key;
    const probPct = (target.probability * 100).toFixed(1);
    const color = getRiskColor(target.risk_level);

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
        onKeyDown={isVessel ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelectVessel(isSelected ? null : key);
          }
        } : undefined}
        aria-pressed={isVessel ? isSelected : undefined}
        aria-label={isVessel ? `${title} — ${probPct}% probability, ${target.risk_label}` : undefined}
      >
        <div className="risk-card-header">
          <div className="risk-card-title-group">
            <span className="target-code-tag">[{key}]</span>
            <span className="target-title-text">{title}</span>
          </div>
          <span
            className="risk-badge"
            style={{
              backgroundColor: `${color}18`,
              color: color,
              borderColor: color
            }}
          >
            {target.risk_label.toUpperCase()}
          </span>
        </div>

        <div className="risk-card-metric-row">
          <div className="prob-display">
            <span className="prob-value font-mono font-bold" style={{ color }}>
              {probPct}%
            </span>
            <span className="prob-subtext">PREDICTED PROBABILITY</span>
          </div>

          <div className="classification-display">
            <span className="class-label">CLASSIFICATION:</span>
            <span className={`class-value ${target.predicted_class === 1 ? 'positive' : 'negative'}`}>
              {target.predicted_class === 1
                ? isVessel ? 'STENOSIS ≥50%' : 'CAD POSITIVE'
                : isVessel ? 'NORMAL <50%' : 'NORMAL'}
            </span>
          </div>
        </div>

        {/* Progress Fill Meter */}
        <div className="risk-meter-track" aria-hidden="true">
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
            <Activity size={10} className="inline-icon" />
            MODEL: {target.model_architecture}
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
          <AlertCircle size={13} />
          <span>
            <strong>INPUTS MODIFIED // </strong> Inference stale — click <strong>[ RUN MULTI-VESSEL ANALYSIS ]</strong> to update.
          </span>
        </div>
      )}

      {/* Extrapolation Warning Banner */}
      {prediction?.warnings && prediction.warnings.length > 0 && (
        <div className="extrapolation-warning-banner" role="status">
          <AlertTriangle size={13} className="warning-icon text-amber" />
          <div className="warning-text-group">
            {prediction.warnings.map((w, i) => (
              <span key={i} className="warning-text"><strong>[ WARNING ]:</strong> {w}</span>
            ))}
          </div>
        </div>
      )}

      {/* Primary CAD Overview Card */}
      <div className="cad-overview-section">
        {renderCard('CAD', 'Overall Coronary Artery Disease', cad, false)}
      </div>

      {/* Multi-Vessel Stenosis Section */}
      <div className="vessel-predictions-section">
        <div className="section-header-row">
          <h4 className="vessel-section-title">VESSEL-SPECIFIC STENOSIS (≥50% DIAMETER)</h4>
          <span className="vessel-sub-hint">[ CLICK TO HIGHLIGHT IN 3D ]</span>
        </div>

        <div className="vessel-cards-grid">
          {renderCard('LAD', 'Left Anterior Descending', lad, true)}
          {renderCard('LCX', 'Left Circumflex', lcx, true)}
          {renderCard('RCA', 'Right Coronary Artery', rca, true)}
        </div>
      </div>

      {/* Calibration Note */}
      <div className="risk-methodology-note">
        <Info size={12} className="info-icon" aria-hidden="true" />
        <p>
          <strong>CALIBRATION NOTE:</strong> Risk scores from n=303 cohort. Bands (&lt;30%/30–60%/&gt;60%)
          are illustrative tiers, not validated clinical decision thresholds.
        </p>
      </div>
    </div>
  );
};

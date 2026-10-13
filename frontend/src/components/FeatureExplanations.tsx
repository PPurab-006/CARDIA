import React, { useState } from 'react';
import type { ExplanationItem, PredictionResponse } from '../types/api';
import { TrendingUp, TrendingDown, HelpCircle, Layers, BarChart3 } from 'lucide-react';

interface FeatureExplanationsProps {
  prediction: PredictionResponse | null;
  loading: boolean;
}

export const FeatureExplanations: React.FC<FeatureExplanationsProps> = ({
  prediction,
  loading
}) => {
  const [activeTab, setActiveTab] = useState<'CAD' | 'LAD'>('CAD');

  if (!prediction && !loading) {
    return (
      <div className="explanations-empty">
        <BarChart3 size={24} className="text-slate-muted" />
        <p className="empty-subtext">Feature attributions appear here following prediction analysis.</p>
      </div>
    );
  }

  const explanations = prediction?.explanations;
  const currentItems: ExplanationItem[] = (explanations && explanations[activeTab]) || [];
  const globalTop = prediction?.global_top_features?.[activeTab] || [];

  // Determine maximum contribution score for relative scaling
  const maxScore = Math.max(...currentItems.map((item) => item.contribution_score), 0.05);

  return (
    <div className={`feature-explanations-card ${loading ? 'loading-opacity' : ''}`}>
      <div className="explanations-header">
        <div className="header-title-row">
          <div className="title-with-icon">
            <BarChart3 size={16} className="text-cyan" />
            <h4 className="explanations-title">Feature Attribution & Interpretability</h4>
          </div>

          {/* Target Tabs */}
          <div className="target-toggle-pills">
            <button
              type="button"
              className={`toggle-pill ${activeTab === 'CAD' ? 'active' : ''}`}
              onClick={() => setActiveTab('CAD')}
            >
              Overall CAD
            </button>
            <button
              type="button"
              className={`toggle-pill ${activeTab === 'LAD' ? 'active' : ''}`}
              onClick={() => setActiveTab('LAD')}
            >
              LAD Stenosis
            </button>
          </div>
        </div>
      </div>

      <div className="explanations-body">
        {/* Methodology & Attribution Caveat */}
        <div className="attribution-caveat-box">
          <HelpCircle size={14} className="caveat-icon text-cyan" />
          <p className="caveat-text">
            <strong>Attribution vs. Causation:</strong> Scores reflect local tree model feature contributions (computed via tree-path surrogate / SHAP-approximation). A positive contribution indicates that this patient's value elevated the model's output probability; it does <strong>not</strong> establish biological causation or a treatable clinical cause.
          </p>
        </div>

        {/* Patient-Specific Local Explanations */}
        <div className="local-attributions-container">
          <h5 className="sub-section-title">
            Patient-Specific Local Contributions ({activeTab} Target)
          </h5>

          {currentItems.length === 0 ? (
            <p className="no-data-hint">No local attributions returned for this target.</p>
          ) : (
            <div className="attribution-bars-list">
              {currentItems.map((item, idx) => {
                const isRiskInc = item.direction === 'increases_risk';
                const pct = Math.min(100, Math.round((item.contribution_score / maxScore) * 100));

                return (
                  <div key={`${item.feature}-${idx}`} className="attribution-row">
                    <div className="attr-meta-col">
                      <div className="attr-feature-name">
                        <span className="feature-title">{item.feature}</span>
                        {item.patient_value !== null && (
                          <span className="patient-val-badge">Val: {item.patient_value}</span>
                        )}
                      </div>
                      <div className="attr-dir-badge">
                        {isRiskInc ? (
                          <span className="dir-indicator risk-up">
                            <TrendingUp size={11} /> Elevates Risk
                          </span>
                        ) : (
                          <span className="dir-indicator risk-down">
                            <TrendingDown size={11} /> Lowers Risk
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="attr-bar-col">
                      <div className="attr-bar-track">
                        <div
                          className={`attr-bar-fill ${isRiskInc ? 'fill-danger' : 'fill-protective'}`}
                          style={{ width: `${Math.max(6, pct)}%` }}
                        />
                      </div>
                      <span className="attr-score-text">
                        {(item.contribution_score * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Global Reference Feature Importance */}
        {globalTop.length > 0 && (
          <div className="global-importance-footer">
            <div className="global-header">
              <Layers size={13} className="text-slate-muted" />
              <span className="global-label">Top Global Features in Trained {activeTab} Model:</span>
            </div>
            <div className="global-pills-wrap">
              {globalTop.slice(0, 6).map((feat, i) => (
                <span key={i} className="global-feature-pill">
                  {i + 1}. {feat}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

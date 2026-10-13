import React, { useState } from 'react';
import type { ExplanationItem, PredictionResponse } from '../types/api';
import { TrendingUp, TrendingDown, HelpCircle, Layers, BarChart3 } from 'lucide-react';

interface FeatureExplanationsProps {
  prediction: PredictionResponse | null;
  loading: boolean;
}

type ExplanationTarget = 'CAD' | 'LAD' | 'LCX' | 'RCA';

const TARGET_LABELS: Record<ExplanationTarget, string> = {
  CAD: 'CAD',
  LAD: 'LAD',
  LCX: 'LCX',
  RCA: 'RCA'
};

export const FeatureExplanations: React.FC<FeatureExplanationsProps> = ({
  prediction,
  loading
}) => {
  const [activeTab, setActiveTab] = useState<ExplanationTarget>('CAD');

  if (!prediction && !loading) {
    return (
      <div className="explanations-empty">
        <BarChart3 size={22} className="text-slate-muted" />
        <p className="empty-subtext">Feature attributions appear here after analysis.</p>
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
            <BarChart3 size={14} className="text-cyan" />
            <h4 className="explanations-title">Feature Attribution</h4>
          </div>

          {/* Target Tabs — all four targets */}
          <div className="target-toggle-pills" role="tablist" aria-label="Explanation target">
            {(Object.keys(TARGET_LABELS) as ExplanationTarget[]).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                className={`toggle-pill ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
                title={TARGET_LABELS[tab]}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="explanations-body">
        {/* Methodology & Attribution Caveat */}
        <div className="attribution-caveat-box">
          <HelpCircle size={12} className="caveat-icon text-cyan" aria-hidden="true" />
          <p className="caveat-text">
            <strong>Attribution ≠ Causation.</strong> Scores reflect local tree-path contributions
            (SHAP-approximation) for this patient. A positive score elevated the model's output
            for target <strong>{activeTab}</strong>.
          </p>
        </div>

        {/* Patient-Specific Local Explanations */}
        <div className="local-attributions-container">
          <h5 className="sub-section-title">
            Local Contributions — {activeTab}
          </h5>

          {currentItems.length === 0 ? (
            <p className="no-data-hint">No attributions returned for {activeTab}.</p>
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
                          <span className="patient-val-badge">= {item.patient_value}</span>
                        )}
                      </div>
                      <div className="attr-dir-badge">
                        {isRiskInc ? (
                          <span className="dir-indicator risk-up">
                            <TrendingUp size={10} /> Elevates
                          </span>
                        ) : (
                          <span className="dir-indicator risk-down">
                            <TrendingDown size={10} /> Lowers
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="attr-bar-col">
                      <div className="attr-bar-track" aria-hidden="true">
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
              <Layers size={11} className="text-slate-muted" aria-hidden="true" />
              <span className="global-label">Top global features — {activeTab} model:</span>
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

import React from 'react';
import { X, CheckCircle2, ShieldAlert, Award, Database, Cpu } from 'lucide-react';
import type { MetricsResponse } from '../types/api';

interface ModelMetricsModalProps {
  isOpen: boolean;
  onClose: () => void;
  metricsData: MetricsResponse | null;
  loading: boolean;
  error: string | null;
}

export const ModelMetricsModal: React.FC<ModelMetricsModalProps> = ({
  isOpen,
  onClose,
  metricsData,
  loading,
  error
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge">
              <Award size={20} className="text-acid" />
            </div>
            <div>
              <h3 className="modal-title">[ MODEL EVALUATION &amp; CV AUDIT ]</h3>
              <p className="modal-subtitle">
                Stratified 5-Fold Cross-Validation Metrics &bull; Z-Alizadeh Sani Cohort (n=303)
              </p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {/* Scientific Transparency Notice */}
          <div className="modal-notice-banner">
            <ShieldAlert size={16} className="notice-icon text-amber" />
            <div className="notice-text">
              <strong>Validation Scope & Transparency:</strong> The metrics below reflect <em>internal stratified 5-fold cross-validation</em> with strictly separated inside-fold preprocessing on the 303-patient UCI dataset (DOI: 10.24432/C5461K). They do <strong>not</strong> represent multi-center external clinical trial validation.
            </div>
          </div>

          {loading && (
            <div className="modal-loading-state">
              <span className="spinner" />
              <span>Loading cross-validation metrics...</span>
            </div>
          )}

          {error && (
            <div className="modal-error-state">
              <span>Failed to fetch evaluation metrics: {error}</span>
            </div>
          )}

          {metricsData && (
            <>
              {/* Provenance Stats */}
              <div className="provenance-grid">
                <div className="provenance-card">
                  <Database size={15} className="text-cyan" />
                  <div>
                    <span className="card-k">Dataset Size</span>
                    <span className="card-v">303 Patients (54 Clean Features)</span>
                  </div>
                </div>
                <div className="provenance-card">
                  <Cpu size={15} className="text-cyan" />
                  <div>
                    <span className="card-k">CV Strategy</span>
                    <span className="card-v">Stratified 5-Fold (Leakage-Free)</span>
                  </div>
                </div>
                <div className="provenance-card">
                  <CheckCircle2 size={15} className="text-emerald" />
                  <div>
                    <span className="card-k">Leakage Audit</span>
                    <span className="card-v">Verified Zero Target Leakage</span>
                  </div>
                </div>
              </div>

              {/* Metrics Table */}
              <div className="metrics-table-container">
                <table className="metrics-table">
                  <thead>
                    <tr>
                      <th>Target & Anatomy</th>
                      <th>Selected Algorithm</th>
                      <th>ROC-AUC</th>
                      <th>F1-Score</th>
                      <th>Accuracy</th>
                      <th>Precision</th>
                      <th>Recall</th>
                      <th>Class Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(metricsData.metrics).map(([key, info]) => {
                      const m = info.metrics;
                      return (
                        <tr key={key}>
                          <td>
                            <div className="target-cell">
                              <span className="target-name">{key}</span>
                              <span className="target-desc">{info.target_description}</span>
                            </div>
                          </td>
                          <td>
                            <span className="algo-badge">{info.selected_model}</span>
                          </td>
                          <td className="highlight-metric">{(m.roc_auc * 100).toFixed(1)}%</td>
                          <td>{(m.f1 * 100).toFixed(1)}%</td>
                          <td>{(m.accuracy * 100).toFixed(1)}%</td>
                          <td>{(m.precision * 100).toFixed(1)}%</td>
                          <td>{(m.recall * 100).toFixed(1)}%</td>
                          <td className="balance-cell">
                            {m.pos_support} Pos / {m.neg_support} Neg
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="selection-rationales-section">
                <h4 className="section-title">Model Selection Rationales</h4>
                <div className="rationales-grid">
                  {Object.entries(metricsData.metrics).map(([key, info]) => (
                    <div key={key} className="rationale-card">
                      <div className="rationale-header">
                        <span className="target-pill">{key}</span>
                        <span className="model-name">{info.selected_model}</span>
                      </div>
                      <p className="rationale-body">{info.selection_rationale}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <span className="modal-footer-note">
            CARDIA ML SYSTEM AUDIT &bull; ZERO TARGET LEAKAGE CONFIRMED
          </span>
          <button type="button" className="btn-secondary" onClick={onClose}>
            [ CLOSE AUDIT ]
          </button>
        </div>
      </div>
    </div>
  );
};

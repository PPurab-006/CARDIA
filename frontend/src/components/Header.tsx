import React from 'react';
import { Activity, RefreshCw, BarChart2, ShieldCheck, Wifi, WifiOff } from 'lucide-react';
import type { HealthResponse } from '../types/api';

interface HeaderProps {
  health: HealthResponse | null;
  healthLoading: boolean;
  healthError: string | null;
  onResetForm: () => void;
  onOpenMetrics: () => void;
  onRecheckHealth: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  health,
  healthLoading,
  healthError,
  onResetForm,
  onOpenMetrics,
  onRecheckHealth
}) => {
  const isConnected = !!health && !healthError;

  return (
    <header className="app-header">
      <div className="header-brand-group">
        <div className="header-logo-container">
          <div className="header-logo-block">
            <Activity size={20} className="logo-icon" />
          </div>
          <div className="brand-text-block">
            <div className="brand-title-row">
              <span className="brand-name">CARDIA</span>
              <span className="brand-version-tag">ML-SYS // V1.0</span>
              <span className="prototype-badge">
                <ShieldCheck size={11} />
                NON-DIAGNOSTIC PROTO
              </span>
            </div>
            <p className="brand-subtitle">
              Cardiovascular Risk Prediction &amp; 3D Coronary Arborization Visualizer
            </p>
          </div>
        </div>
      </div>

      <div className="header-controls-group">
        {/* Real Backend Connectivity Status */}
        <button
          type="button"
          onClick={onRecheckHealth}
          className={`connection-status-pill ${isConnected ? 'online' : healthLoading ? 'checking' : 'offline'}`}
          title={isConnected ? `Connected to ${health?.service} v${health?.version}. Click to recheck.` : healthError || 'Backend unreachable'}
        >
          {isConnected ? (
            <>
              <span className="status-ping" />
              <Wifi size={13} />
              <span className="status-text">SYS.API // ONLINE</span>
            </>
          ) : healthLoading ? (
            <>
              <RefreshCw size={13} className="spin" />
              <span className="status-text">CHECKING API...</span>
            </>
          ) : (
            <>
              <WifiOff size={13} />
              <span className="status-text">API // OFFLINE</span>
            </>
          )}
        </button>

        {/* Validation Metrics Trigger */}
        <button
          type="button"
          onClick={onOpenMetrics}
          className="header-action-btn"
          title="Inspect cross-validation metrics across all 4 targets"
        >
          <BarChart2 size={14} />
          <span>[ MODEL EVALUATION ]</span>
        </button>

        {/* Reset Patient Form */}
        <button
          type="button"
          onClick={onResetForm}
          className="header-action-btn btn-reset"
          title="Reset all patient input features to cohort baseline defaults"
        >
          <RefreshCw size={13} />
          <span>[ RESET PATIENT ]</span>
        </button>
      </div>
    </header>
  );
};

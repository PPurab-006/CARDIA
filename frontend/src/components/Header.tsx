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
          <div className="header-logo-pulse">
            <Activity size={22} className="logo-icon" />
          </div>
          <div>
            <div className="brand-title-row">
              <h1 className="brand-name">CARDIA</h1>
              <span className="prototype-badge">
                <ShieldCheck size={12} />
                Educational Prototype
              </span>
            </div>
            <p className="brand-subtitle">
              Cardiovascular Risk Visualization & Multi-Vessel Stenosis AI Workstation
            </p>
          </div>
        </div>
      </div>

      <div className="header-controls-group">
        {/* Backend Connectivity Status */}
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
              <span>Backend Connected</span>
            </>
          ) : healthLoading ? (
            <>
              <RefreshCw size={13} className="spin" />
              <span>Checking API...</span>
            </>
          ) : (
            <>
              <WifiOff size={13} />
              <span>API Offline</span>
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
          <BarChart2 size={15} />
          <span>Model Evaluation</span>
        </button>

        {/* Reset Patient Form */}
        <button
          type="button"
          onClick={onResetForm}
          className="header-action-btn"
          title="Reset all patient input features to cohort baseline defaults"
        >
          <RefreshCw size={14} />
          <span>Reset Patient</span>
        </button>
      </div>
    </header>
  );
};

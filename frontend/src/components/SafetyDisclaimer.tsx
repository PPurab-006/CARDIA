import React from 'react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';

interface SafetyDisclaimerProps {
  compact?: boolean;
}

export const SafetyDisclaimer: React.FC<SafetyDisclaimerProps> = ({ compact = false }) => {
  if (compact) {
    return (
      <div className="disclaimer-banner compact">
        <ShieldAlert size={14} className="disclaimer-icon" />
        <span>
          <strong>Clinical Safety Notice:</strong> Educational & decision-support prototype only. Predictions do not constitute a clinical diagnosis.
        </span>
      </div>
    );
  }

  return (
    <div className="disclaimer-banner full">
      <div className="disclaimer-header">
        <AlertTriangle size={16} className="disclaimer-icon text-amber" />
        <span className="disclaimer-title">STATUTORY CLINICAL SAFETY NOTICE</span>
      </div>
      <p className="disclaimer-text">
        <strong>Educational and decision-support prototype only.</strong> Predictions are not a diagnosis and must not replace professional medical evaluation or formal diagnostic imaging (e.g., coronary catheter angiography, CCTA). Models trained on UCI Z-Alizadeh Sani cohort (n=303). Vessel highlights represent statistical probability scores (&ge;50% luminal stenosis), not observed patient plaque coordinates.
      </p>
    </div>
  );
};

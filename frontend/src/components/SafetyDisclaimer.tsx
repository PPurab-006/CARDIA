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
          <strong>[ STATUTORY NOTICE ]:</strong> Educational &amp; decision-support prototype only &bull; Non-diagnostic.
        </span>
      </div>
    );
  }

  return (
    <div className="disclaimer-banner full">
      <div className="disclaimer-header">
        <AlertTriangle size={15} className="disclaimer-icon text-amber" />
        <span className="disclaimer-title">[ STATUTORY CLINICAL NOTICE // NON-DIAGNOSTIC PROTOTYPE ]</span>
      </div>
      <p className="disclaimer-text">
        <strong>Educational and decision-support prototype only.</strong> Model predictions are statistical likelihood estimates and do not constitute a medical diagnosis, clinical directive, or substitute for physician evaluation or formal invasive diagnostic angiography (ICA / CCTA). Models trained on the UCI Z-Alizadeh Sani cohort (n=303, DOI: 10.24432/C5461K). Anatomical vessel highlights represent statistical probability scores (&ge;50% luminal stenosis), not observed patient plaque coordinates.
      </p>
    </div>
  );
};

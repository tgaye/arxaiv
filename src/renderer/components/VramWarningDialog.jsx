// src/renderer/components/VramWarningDialog.jsx
import React from 'react';
import { IconAlertTriangle, IconX } from '@tabler/icons-react';

const VramWarningDialog = ({ isOpen, onClose, onProceed, modelName, estimatedVram, availableVram }) => {
  if (!isOpen) return null;
  
  const usagePercentage = (estimatedVram / availableVram) * 100;
  const isHighRisk = usagePercentage > 90;

  return (
    <div className="vram-warning-overlay">
      <div className="vram-warning-dialog">
        <div className="warning-header">
          <IconAlertTriangle size={24} color="#ff9800" />
          <h2>VRAM Usage Warning</h2>
          <button className="close-button" onClick={onClose}>
            <IconX size={20} />
          </button>
        </div>
        
        <div className="warning-content">
          <p>
            <strong>Model:</strong> {modelName}
          </p>
          <p>
            <strong>Estimated VRAM Required:</strong> {estimatedVram} MB ({usagePercentage.toFixed(1)}% of available)
          </p>
          <p>
            <strong>Available VRAM:</strong> {availableVram} MB
          </p>
          
          {isHighRisk && (
            <div className="high-risk-warning">
              <IconAlertTriangle size={18} />
              <span>Loading this model may cause system instability or crashes</span>
            </div>
          )}
          
          <p>Do you want to proceed with loading this model?</p>
        </div>
        
        <div className="warning-footer">
          <button className="cancel-button" onClick={onClose}>Cancel</button>
          <button 
            className={`proceed-button ${isHighRisk ? 'high-risk' : ''}`} 
            onClick={onProceed}
          >
            Proceed Anyway
          </button>
        </div>
      </div>
    </div>
  );
};

export default VramWarningDialog;
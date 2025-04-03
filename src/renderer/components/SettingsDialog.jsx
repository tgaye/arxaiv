// src/renderer/components/SettingsDialog.jsx
import React, { useState, useEffect } from 'react';
import { IconSettings, IconX } from '@tabler/icons-react';

const SettingsDialog = ({ isOpen, onClose, onSave }) => {
  const [vramThreshold, setVramThreshold] = useState(80);

  useEffect(() => {
    if (isOpen) {
      // Load current settings
      console.log('About to call getVramWarningThreshold');
      window.api.getVramWarningThreshold()
        .then(threshold => {
          console.log('Received threshold:', threshold);
          setVramThreshold(threshold * 100);
        })
        .catch(error => {
          console.error('Error getting threshold:', error);
        });
    }
  }, [isOpen]);

  const handleSave = () => {
    const thresholdDecimal = vramThreshold / 100;
    window.api.setVramWarningThreshold(thresholdDecimal)
      .then(() => {
        onSave();
        onClose();
      });
  };

  if (!isOpen) return null;

  return (
    <div className="settings-overlay">
      <div className="settings-dialog">
        <div className="settings-header">
          <h2><IconSettings size={32} /> Settings</h2>
          <button className="close-button" onClick={onClose}>
            <IconX size={32} />
          </button>
        </div>
        
        <div className="settings-content">
          <div className="settings-section">
            <h3>GPU Resource Management</h3>
            
            <div className="settings-item">
              <label>
                Maximum VRAM Usage Warning Threshold
                <div className="threshold-value">{vramThreshold}%</div>
              </label>
              <input
                type="range"
                min="50"
                max="95"
                step="5"
                value={vramThreshold}
                onChange={(e) => setVramThreshold(parseInt(e.target.value))}
              />
              <div className="setting-description">
                You'll receive warnings when models may exceed this percentage of your available VRAM
              </div>
            </div>
          </div>
        </div>
        
        <div className="settings-footer">
          <button className="cancel-button" onClick={onClose}>Cancel</button>
          <button className="save-button" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
};

export default SettingsDialog;
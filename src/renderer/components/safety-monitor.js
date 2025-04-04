// src/renderer/components/safety-monitor.js
import React, { useState, useEffect } from 'react';
import { IconAlertTriangle, IconAlertCircle, IconCircleCheck, IconX } from '@tabler/icons-react';

// Safety monitor component that displays warnings and manages resource errors
const SafetyMonitor = () => {
  const [warnings, setWarnings] = useState([]);
  const [criticalError, setCriticalError] = useState(null);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [systemHealth, setSystemHealth] = useState(null);
  const [healthCheckInterval, setHealthCheckInterval] = useState(null);
  
  useEffect(() => {
    // Listen for safety warnings from main process
    const unsubscribeWarning = window.api.onSafetyWarning((warning) => {
      console.log('Safety warning received:', warning);
      
      // Add warning to list with unique ID
      const warningWithId = {
        ...warning,
        id: Date.now(),
        timestamp: Date.now()
      };
      
      setWarnings(prev => [...prev, warningWithId]);
      
      // Auto-dismiss warnings after 10 seconds
      setTimeout(() => {
        setWarnings(prev => prev.filter(w => w.id !== warningWithId.id));
      }, 10000);
      
      // If this is a critical warning, we should trigger emergency recovery
      if (warning.severity === 'critical') {
        handleEmergencyRecovery(`Critical resource warning: ${warning.message}`);
      }
    });
    
    // Listen for critical errors
    const unsubscribeCritical = window.api.onCriticalError((error) => {
      console.error('Critical error received:', error);
      setCriticalError(error);
    });
    
    // Listen for app shutdown events
    const unsubscribeShutdown = window.api.onAppShutdown(() => {
      console.log('App is shutting down');
      setCriticalError({
        type: 'shutdown',
        message: 'Application is shutting down to protect system resources',
        instructions: 'Please wait while the application safely closes'
      });
    });
    
    // Listen for recovery mode status changes
    const unsubscribeRecovery = window.api.onRecoveryModeChange((status) => {
      console.log('Recovery mode status changed:', status);
      setRecoveryMode(status.active);
      
      if (status.active) {
        // Add a recovery mode warning
        const recoveryWarning = {
          id: `recovery-${Date.now()}`,
          type: 'recovery-mode',
          message: 'Application is in recovery mode to protect system resources',
          severity: 'warning',
          timestamp: Date.now()
        };
        
        setWarnings(prev => [...prev, recoveryWarning]);
      } else {
        // Remove any recovery mode warnings
        setWarnings(prev => prev.filter(w => w.type !== 'recovery-mode'));
      }
    });
    
    // Start periodic system health checks
    const interval = setInterval(async () => {
      try {
        const health = await window.api.getSystemHealth();
        if (health.success) {
          setSystemHealth(health.health);
          
          // Check for concerning health metrics
          checkHealthMetrics(health.health);
        }
      } catch (error) {
        console.error('Error checking system health:', error);
      }
    }, 5000); // Check every 5 seconds
    
    setHealthCheckInterval(interval);
    
    // Cleanup
    return () => {
      if (unsubscribeWarning) unsubscribeWarning();
      if (unsubscribeCritical) unsubscribeCritical();
      if (unsubscribeShutdown) unsubscribeShutdown();
      if (unsubscribeRecovery) unsubscribeRecovery();
      if (healthCheckInterval) clearInterval(healthCheckInterval);
    };
  }, []);
  
  // Check health metrics for concerning patterns
  const checkHealthMetrics = (health) => {
    // Check GPU metrics
    if (health.gpu && health.gpu.metrics && health.gpu.metrics.length > 0) {
      const primaryGpu = health.gpu.metrics[0];
      
      // Check for upward trend in VRAM usage
      if (health.gpu.trend === 'rapidly-increasing' && primaryGpu.vramUsagePercent > 60) {
        // Add a proactive warning
        const trendWarning = {
          id: `trend-${Date.now()}`,
          type: 'vram-trend',
          message: `VRAM usage trending upward (${primaryGpu.vramUsagePercent.toFixed(1)}%)`,
          severity: 'notice',
          timestamp: Date.now()
        };
        
        setWarnings(prev => {
          // Only add if we don't already have a trend warning
          if (!prev.some(w => w.type === 'vram-trend')) {
            return [...prev, trendWarning];
          }
          return prev;
        });
      }
    }
    
    // Check process metrics
    if (health.processes && health.processes.totalProcessesFailed > 3) {
      // Add a warning about process failures
      const processWarning = {
        id: `process-${Date.now()}`,
        type: 'process-failures',
        message: `Multiple process failures detected (${health.processes.totalProcessesFailed})`,
        severity: 'warning',
        timestamp: Date.now()
      };
      
      setWarnings(prev => {
        // Only add if we don't already have a process warning
        if (!prev.some(w => w.type === 'process-failures')) {
          return [...prev, processWarning];
        }
        return prev;
      });
    }
  };
  
  // Handle emergency recovery mode
  const handleEmergencyRecovery = async (reason) => {
    try {
      console.log('Triggering emergency recovery mode:', reason);
      
      // Notify user
      const emergencyWarning = {
        id: `emergency-${Date.now()}`,
        type: 'emergency-recovery',
        message: 'Entering emergency recovery mode to protect system resources',
        details: reason,
        severity: 'critical',
        timestamp: Date.now()
      };
      
      setWarnings(prev => [...prev, emergencyWarning]);
      
      // Request emergency recovery from main process
      const result = await window.api.enterEmergencyRecovery();
      
      if (!result.success) {
        console.error('Failed to enter emergency recovery mode:', result.error);
      }
    } catch (error) {
      console.error('Error triggering emergency recovery:', error);
    }
  };
  
  // Handle dismissing a warning
  const dismissWarning = (id) => {
    setWarnings(prev => prev.filter(w => w.id !== id));
  };
  
  // Don't render anything if no warnings or errors
  if (warnings.length === 0 && !criticalError && !recoveryMode) {
    return null;
  }
  
  // Render critical error overlay
  if (criticalError) {
    return (
      <div className="critical-error-overlay">
        <div className="critical-error-dialog">
          <div className="critical-error-header">
            <IconAlertCircle size={24} color="#ef4444" />
            <h2>Critical Error</h2>
          </div>
          <div className="critical-error-content">
            <p>{criticalError.message}</p>
            {criticalError.instructions && (
              <p className="instructions">{criticalError.instructions}</p>
            )}
          </div>
        </div>
      </div>
    );
  }
  
  // Render recovery mode indicator
  if (recoveryMode) {
    return (
      <div className="recovery-mode-banner">
        <IconAlertTriangle size={18} color="#f97316" />
        <span>Recovery Mode Active - Limited Functionality Available</span>
      </div>
    );
  }
  
  // Render warnings
  return (
    <div className="safety-warnings-container">
      {warnings.map(warning => (
        <div 
          key={warning.id} 
          className={`safety-warning ${warning.severity}`}
        >
          {warning.severity === 'critical' && <IconAlertCircle size={18} />}
          {warning.severity === 'warning' && <IconAlertTriangle size={18} />}
          {warning.severity === 'notice' && <IconCircleCheck size={18} />}
          
          <div className="warning-content">
            <div className="warning-message">{warning.message}</div>
            {warning.details && (
              <div className="warning-details">{warning.details}</div>
            )}
          </div>
          
          <button 
            className="dismiss-warning" 
            onClick={() => dismissWarning(warning.id)}
          >
            <IconX size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};

export default SafetyMonitor;
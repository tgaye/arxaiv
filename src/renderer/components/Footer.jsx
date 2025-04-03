// src/renderer/components/Footer.jsx
import React, { useState, useEffect } from 'react';
import { IconDeviceDesktop } from '@tabler/icons-react';

const Footer = () => {
  const [gpuStats, setGpuStats] = useState([]);
  const [gpuCount, setGpuCount] = useState(0);

  useEffect(() => {
    // Initial GPU info
    const fetchGpuInfo = async () => {
      try {
        const info = await window.api.getGPUInfo();
        console.log('Fetched GPU info:', info);
        
        if (info) {
          setGpuCount(info.gpuCount);
          if (info.gpuInfo && info.gpuInfo.length > 0) {
            setGpuStats(info.gpuInfo);
          }
        }
      } catch (error) {
        console.error('Error fetching GPU info:', error);
      }
    };
  
    // Fetch initial data
    fetchGpuInfo();
    
    // Set up polling interval (every 1 second)
    const interval = setInterval(fetchGpuInfo, 1000);
    
    // Clean up interval on component unmount
    return () => {
      clearInterval(interval);
    };
  }, []);

  // Format memory sizes
  const formatMemory = (bytes) => {
    if (!bytes) return '0 MB';
    const mb = bytes / (1024 * 1024);
    return `${Math.round(mb)} MB`;
  };

  return (
    <div className="gpu-footer">
      <div className="gpu-info">
        <IconDeviceDesktop size={16} />
        <span className="gpu-count">{gpuCount} GPU{gpuCount !== 1 ? 's' : ''}</span>
        
        {gpuStats.map((gpu, index) => (
          <div key={index} className="gpu-stat">
            <div className="gpu-name">{gpu.name}</div>
            <div className="gpu-utilization">
            <div className="utilization-bar">
              <div 
                className={`utilization-fill ${
                  gpu.vramUsagePercent > 90 ? 'critical' : 
                  gpu.vramUsagePercent > 70 ? 'warning' : ''
                }`}
                style={{ width: `${gpu.vramUsagePercent}%` }}
              />
            </div>
              <div className="utilization-text">{gpu.utilizationGpu || 0}%</div>
            </div>
            <div className="gpu-memory">
              {formatMemory(gpu.memoryUsed)} / {formatMemory(gpu.memoryTotal)}
            </div>
            {gpu.temperature && (
              <div className="gpu-temp">{gpu.temperature}°C</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Footer;
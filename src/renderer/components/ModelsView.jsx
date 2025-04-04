import React, { useState, useEffect } from 'react';
import { 
  IconFolder, 
  IconLoader, 
  IconAlertTriangle,
  IconSelector, 
  IconArrowUp, 
  IconArrowDown, 
  IconCheck 
} from '@tabler/icons-react';

const ModelsSortDropdown = ({ onSort }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentSort, setCurrentSort] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');

  const sortOptions = [
    { 
      key: 'size', 
      label: 'Size', 
      getValue: (model) => {
        const sizeMatch = model.size.match(/(\d+(\.\d+)?)\s*([A-Z]{2})/);
        if (sizeMatch) {
          const value = parseFloat(sizeMatch[1]);
          const unit = sizeMatch[3];
          return unit === 'GB' ? value : value / 1024;
        }
        return 0;
      }
    },
    { 
      key: 'parameters', 
      label: 'Parameters', 
      getValue: (model) => {
        const paramTag = model.params;
        if (paramTag) {
          return parseFloat(paramTag.replace('B', ''));
        }
        return 0;
      }
    },
    { 
      key: 'filename', 
      label: 'Filename', 
      getValue: (model) => {
        return model.name.toLowerCase();
      }
    }
  ];

  const toggleDropdown = () => setIsOpen(!isOpen);

  const handleSortSelect = (option) => {
    if (currentSort === option.key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setCurrentSort(option.key);
      setSortDirection('asc');
    }

    onSort(option, sortDirection === 'asc' ? 'desc' : 'asc');
    setIsOpen(false);
  };

  return (
    <div className="models-sort-container">
      <div 
        className={`models-sort-trigger ${isOpen ? 'active' : ''}`}
        onClick={toggleDropdown}
      >
        <IconSelector size={16} />
        Sort
      </div>
      {isOpen && (
        <div className="models-sort-dropdown open">
          {sortOptions.map((option) => (
            <div 
              key={option.key}
              className={`models-sort-option ${currentSort === option.key ? 'active' : ''}`}
              onClick={() => handleSortSelect(option)}
            >
              {option.label}
              {currentSort === option.key && (
                <div className="models-sort-icon">
                  <IconArrowUp 
                    size={16} 
                    className={`sort-direction-icon ${sortDirection === 'asc' ? 'active' : ''}`}
                  />
                  <IconArrowDown 
                    size={16} 
                    className={`sort-direction-icon ${sortDirection === 'desc' ? 'active' : ''}`}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ModelsView = ({ models, onSelectModel, modelDirectory, onSelectModelDirectory }) => {
  const [loading, setLoading] = useState(false);
  const [apiReady, setApiReady] = useState(false);
  const [sortedModels, setSortedModels] = useState([]);
  const [gpuInfo, setGpuInfo] = useState(null);

  useEffect(() => {
    // Fetch GPU info when component mounts
    const fetchGPUInfo = async () => {
      try {
        const info = await window.api.getGPUInfo();
        setGpuInfo(info);
      } catch (error) {
        console.error('Error fetching GPU info:', error);
      }
    };

    fetchGPUInfo();
  }, []);

  useEffect(() => {
    // Initialize sorted models when models prop changes
    setSortedModels(models);
  }, [models]);

  useEffect(() => {
    // Check if API is ready after a short delay to ensure Electron has initialized
    const timer = setTimeout(() => {
      const isApiReady = window.api && typeof window.api.selectModelDirectory === 'function';
      console.log("API ready check:", isApiReady);
      setApiReady(isApiReady);
    }, 1000);
   
    return () => clearTimeout(timer);
  }, []);

  const isModelTooLarge = (modelSize, totalMemory, usedMemory) => {
    // Parse model size with unit conversion
    const sizeMatch = modelSize.match(/(\d+(\.\d+)?)\s*([A-Z]{2})/);
    let modelSizeBytes = 0;
  
    if (sizeMatch) {
      const value = parseFloat(sizeMatch[1]);
      const unit = sizeMatch[3];
  
      if (unit === 'GB') {
        modelSizeBytes = value * 1024 * 1024 * 1024;
      } else if (unit === 'MB') {
        modelSizeBytes = value * 1024 * 1024;
      }
    }
  
    // Calculate available memory
    const availableMemory = totalMemory - usedMemory;
  
    // Check if model is more than 50% of available memory
    return modelSizeBytes > (availableMemory * 0.4);
  };

  const handleSelectDirectory = async () => {
    setLoading(true);
    try {
      // Check if API is ready
      if (!window.api || !window.api.selectModelDirectory) {
        console.error("API not ready, cannot select directory");
        alert("Application is still initializing. Please try again in a moment.");
        return;
      }
     
      await onSelectModelDirectory();
    } catch (error) {
      console.error('Error selecting directory:', error);
      alert(`Error selecting directory: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (sortOption, direction) => {
    const sorted = [...models].sort((a, b) => {
      const valueA = sortOption.getValue(a);
      const valueB = sortOption.getValue(b);
      
      // For string-based sorting (filename)
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return direction === 'asc' 
          ? valueA.localeCompare(valueB)
          : valueB.localeCompare(valueA);
      }
      
      // For numeric sorting (size, parameters)
      return direction === 'asc' 
        ? valueA - valueB 
        : valueB - valueA;
    });

    setSortedModels(sorted);
  };

  const renderModelCard = (model) => {
    const gpuData = gpuInfo?.gpuInfo?.[0] || {};
    const totalMemory = gpuData.memoryTotal || (12 * 1024 * 1024 * 1024);
    const usedMemory = gpuData.memoryUsed || 0;
    
    // Check if model is too large based on available memory
    const isLargeModel = isModelTooLarge(model.size, totalMemory, usedMemory);
    
    return (
      <div 
        key={model.path} 
        className={`model-card ${isLargeModel ? 'model-card-warning' : ''} ${model.isDefault ? 'model-card-default' : ''}`}
        onClick={() => {
          // If it's a large model, set as selected but trigger warning first
          if (isLargeModel) {
            // Trigger the VRAM warning in the parent component
            onSelectModel(model, true);
          } else {
            // Normal model selection
            onSelectModel(model);
          }
        }}
      >
        <div className="model-card-header">
          <h3>{model.name}</h3>
          {isLargeModel && (
            <div className="model-size-warning" title="Model may exceed available VRAM">
              <IconAlertTriangle size={16} color="#ff6b6b" />
            </div>
          )}
          {model.isDefault && (
            <div className="model-default-indicator" title="Default model">
              <IconCheck size={16} color="#7ee787" />
            </div>
          )}
        </div>
        <p>Size: {model.size}</p>
        <div className="tags-container">
          {model.arch && <span className="tag">{model.arch}</span>}
          {model.params && <span className="tag">{model.params}</span>}
          {!model.arch && !model.params && (
            <>
              <span className="tag">Unknown</span>
              <span className="tag">Unknown</span>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="model-directory-selector">
        <button
          onClick={handleSelectDirectory}
          disabled={loading || !apiReady}
        >
          {loading ? (
            <IconLoader size={16} style={{ marginRight: '4px' }} className="spinning" />
          ) : (
            <IconFolder size={16} style={{ marginRight: '4px' }} />
          )}
          Select Directory
        </button>
        <div className="model-directory-path">
          {modelDirectory || 'Default models directory'}
        </div>
      </div>
      
      <ModelsSortDropdown onSort={handleSort} />
      
      {sortedModels.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">
            No models found
          </div>
          <div className="empty-state-hint">
            Select a directory with .bin, .gguf, or .ggml model files
          </div>
        </div>
      ) : (
        <div className="models-grid">
          {sortedModels.map(renderModelCard)}
        </div>
      )}
    </div>
  );
};

export default ModelsView;
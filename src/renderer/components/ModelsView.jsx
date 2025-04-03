import React, { useState, useEffect } from 'react';
import { IconFolder, IconLoader } from '@tabler/icons-react';


const ModelsView = ({ models, onSelectModel, modelDirectory, onSelectModelDirectory }) => {
  const [loading, setLoading] = useState(false);
  const [apiReady, setApiReady] = useState(false);

  useEffect(() => {
    // Check if API is ready after a short delay to ensure Electron has initialized
    const timer = setTimeout(() => {
      const isApiReady = window.api && typeof window.api.selectModelDirectory === 'function';
      console.log("API ready check:", isApiReady);
      setApiReady(isApiReady);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
      
      {models.length === 0 ? (
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
        {models.map((model) => (
          <div 
            key={model.path} 
            className="model-card"
            onClick={() => onSelectModel(model)}
          >
            <h3>{model.name}</h3>
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
        ))}
      </div>
      )}
    </div>
  );
};

export default ModelsView;
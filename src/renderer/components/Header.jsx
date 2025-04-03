import React from 'react';
import { IconFiles, IconTrash, IconSettings, IconBrandGithub } from '@tabler/icons-react';
import SearchBar from './SearchBar';

const Header = ({ 
  activeView, 
  selectedModel, 
  onDuplicate, 
  onClearAll, 
  onOpenSettings,
  onSearchSubmit 
}) => {
  return (
    <div className="chat-header">
      <div className="header-left">
      <div className="app-branding">
        Arx<span className="ai-highlight">AI</span>v
      </div>
      
        
      {activeView === 'chat' && selectedModel && (
        <div className="model-info">
          <div className="model-name">{selectedModel.name || 'No model'}</div>
          {selectedModel.arch && <div className="badge">{selectedModel.arch}</div>}
          {selectedModel.params && <div className="badge">{selectedModel.params}</div>}
        </div>
      )}
      {activeView === 'models' && (
        <div className="section-title">Models Directory</div>
      )}
      {activeView === 'paper' && (
        <div className="section-title">Paper Analysis</div>
      )}
    </div>
          
      <div className="header-right">
        {activeView === 'chat' && (
          <>
            <button className="header-button" onClick={onDuplicate} title="Duplicate conversation">
              <IconFiles size={18} />
            </button>
            <button className="header-button" onClick={onClearAll} title="Clear conversation">
              <IconTrash size={18} />
            </button>
          </>
        )}
        {activeView === 'paper' && (
          <button className="header-button" title="View on GitHub">
            <IconBrandGithub size={18} />
          </button>
        )}
        <button 
          className="header-button" 
          onClick={onOpenSettings} 
          title="Settings"
        >
          <IconSettings size={32} />
        </button>
      </div>
    </div>
  );
};

export default Header;
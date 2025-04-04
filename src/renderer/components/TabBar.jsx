// src/renderer/components/TabBar.jsx
import React from 'react';
import { IconX, IconDeviceFloppy, IconCircle } from '@tabler/icons-react';
import path from 'path';

const TabBar = ({
  openFiles,
  activeFileIndex,
  onCloseFile,
  onChangeActiveFile,
  onSaveFile
}) => {
  const handleCloseClick = (e, index) => {
    e.stopPropagation();
    onCloseFile(index);
  };

  const handleSaveClick = (e, index) => {
    e.stopPropagation();
    onSaveFile(index);
  };

  return (
    <div className="tab-bar">
      <div className="tab-list">
        {openFiles.map((file, index) => (
          <div 
            key={file.path}
            className={`tab ${activeFileIndex === index ? 'active' : ''}`}
            onClick={() => onChangeActiveFile(index)}
          >
            <span className="tab-name">
              {file.name}
            </span>
            
            {file.isDirty && (
              <>
                <button 
                  className="tab-save-button"
                  onClick={(e) => handleSaveClick(e, index)}
                  title="Save file"
                >
                  <IconDeviceFloppy size={14} />
                </button>
                <span className="unsaved-indicator">
                  <IconCircle size={8} />
                </span>
              </>
            )}
            
            <button 
              className="tab-close-button"
              onClick={(e) => handleCloseClick(e, index)}
              title="Close tab"
            >
              <IconX size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TabBar;
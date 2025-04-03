// src/renderer/components/ContextFilesManager.jsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { IconFiles, IconX, IconChevronUp, IconChevronDown, IconTrash, IconFileText, IconEye } from '@tabler/icons-react';

const ContextFilesManager = ({ onContextFilesChange }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [contextFiles, setContextFiles] = useState([]);
  const dropAreaRef = useRef(null);

  const previewFile = (fileId) => {
    // Find the file
    const file = contextFiles.find(f => f.id === fileId);
    if (file) {
      // Simple alert preview for now - could be replaced with a modal
      alert(`File Preview: ${file.name}\n\n${file.content.slice(0, 500)}${file.content.length > 500 ? '...' : ''}`);
    }
  };

  // Handle file activation/deactivation
  const toggleFileActive = (fileId) => {
    setContextFiles(prevFiles => 
      prevFiles.map(file => 
        file.id === fileId ? { ...file, active: !file.active } : file
      )
    );
  };

  // Handle file removal
  const removeFile = (fileId) => {
    setContextFiles(prevFiles => {
      const newFiles = prevFiles.filter(file => file.id !== fileId);
      return newFiles;
    });
  };

  // Process the added files
// Process the added files
const processFiles = async (files) => {
    const filesList = Array.from(files);
    const validFiles = filesList.filter(file => file.type === 'text/plain' || file.name.endsWith('.txt'));
    
    for (const file of validFiles) {
      // Change from 10KB (10240 bytes) to 2MB (2097152 bytes)
      if (file.size > 2097152) { // 2MB limit
        alert(`File ${file.name} exceeds the 2MB limit`);
        continue;
      }
  
      try {
        const content = await readFileContent(file);
        const newFile = {
          id: Date.now() + Math.random().toString(36).substring(2, 9),
          name: file.name,
          content,
          size: file.size,
          active: true,
          dateAdded: new Date()
        };
        
        setContextFiles(prev => [...prev, newFile]);
      } catch (error) {
        console.error('Error reading file:', error);
      }
    }
  };

  // Read file content
  const readFileContent = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  };

  // Handle drag events
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === dropAreaRef.current) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  // Handle file selection via input
  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };


    const activeFiles = useMemo(() => {
        return contextFiles.filter(file => file.active);
    }, [contextFiles]);
    
    useEffect(() => {
        if (onContextFilesChange) {
        onContextFilesChange(activeFiles);
        }
    }, [activeFiles, onContextFilesChange]);

  return (
    <div className={`context-files-manager ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div 
        className="context-files-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="context-files-title">
          <IconFiles size={16} />
          <span>Context Files</span>
          <span className="context-files-count">
            {contextFiles.filter(f => f.active).length}/{contextFiles.length}
          </span>
        </div>
        {isExpanded ? (
          <IconChevronDown size={16} />
        ) : (
          <IconChevronUp size={16} />
        )}
      </div>

      {isExpanded && (
        <div className="context-files-content">
          <div 
            ref={dropAreaRef}
            className={`context-files-dropzone ${isDragging ? 'dragging' : ''}`}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <IconFileText size={24} />
            <p>Drag & drop .txt files here</p>
            <p className="context-files-limit">Max 10KB per file</p>
            <label className="context-files-upload-btn">
              Browse Files
              <input 
                type="file" 
                multiple 
                accept=".txt,text/plain" 
                onChange={handleFileSelect} 
                style={{ display: 'none' }}
              />
            </label>
          </div>

          {contextFiles.length > 0 && (
            <div className="context-files-list">
                {/* Remove this redundant condition - it's already checked above */}
                {contextFiles.map(file => (
                <div 
                    key={file.id} 
                    className={`context-file-item ${file.active ? 'active' : 'inactive'}`}
                >
                    <div className="context-file-checkbox">
                    <input 
                        type="checkbox" 
                        checked={file.active}
                        onChange={() => toggleFileActive(file.id)}
                        id={`file-${file.id}`}
                    />
                    <label htmlFor={`file-${file.id}`}></label>
                    </div>
                    <div className="context-file-info">
                    <div className="context-file-name">{file.name}</div>
                    <div className="context-file-details">
                        <span className="context-file-size">
                        {file.size < 1024 * 1024 
                            ? `${(file.size / 1024).toFixed(1)} KB` 
                            : `${(file.size / (1024 * 1024)).toFixed(2)} MB`}
                        </span>
                    </div>
                    </div>
                    <div className="context-file-actions">
                    <button 
                        className="context-file-preview-btn" 
                        onClick={() => previewFile(file.id)}
                        aria-label="Preview file"
                    >
                        <IconEye size={16} />
                    </button>
                    <button 
                        className="context-file-remove" 
                        onClick={() => removeFile(file.id)}
                        aria-label="Remove file"
                    >
                        <IconTrash size={16} />
                    </button>
                    </div>
                </div>
                ))}
            </div>
            )}
        </div>
      )}
    </div>
  );
};

export default ContextFilesManager;
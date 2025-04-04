// src/renderer/components/FileExplorer.jsx
import React, { useState, useEffect } from 'react';
import { 
  IconFolder, 
  IconFolderOpen, 
  IconFile, 
  IconFileCode, 
  IconFileText, 
  IconChevronRight, 
  IconChevronDown,
  IconLoader,
  IconArrowUp
} from '@tabler/icons-react';
import path from 'path';

const FileExplorer = ({
  currentDirectory,
  setCurrentDirectory,
  directoryContents,
  onOpenFile,
  isLoading
}) => {
  const [expandedFolders, setExpandedFolders] = useState({});
  const [folderContents, setFolderContents] = useState({});

  // Add useEffect to handle empty directory
  useEffect(() => {
    if (currentDirectory === '') {
      // If no directory is set, default to a basic path
      setCurrentDirectory('C:/Users');
    }
  }, [currentDirectory, setCurrentDirectory]);

  const toggleFolder = async (folderPath) => {
    const newExpandedFolders = { ...expandedFolders };
    
    if (expandedFolders[folderPath]) {
      // Collapse folder
      newExpandedFolders[folderPath] = false;
    } else {
      // Expand folder
      newExpandedFolders[folderPath] = true;
      
      // Load folder contents if we haven't yet
      if (!folderContents[folderPath]) {
        try {
          const contents = await window.api.listDirectory(folderPath);
          setFolderContents({
            ...folderContents,
            [folderPath]: contents
          });
        } catch (error) {
          console.error(`Error loading contents for ${folderPath}:`, error);
        }
      }
    }
    
    setExpandedFolders(newExpandedFolders);
  };

  const handleFileClick = (filePath) => {
    onOpenFile(filePath);
  };

  const navigateUp = () => {
    const parentDir = path.dirname(currentDirectory);
    if (parentDir !== currentDirectory) {
      setCurrentDirectory(parentDir);
    }
  };

  const getFileIcon = (fileName) => {
    const extension = path.extname(fileName).toLowerCase();
    
    if (['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.c', '.cpp', '.cs'].includes(extension)) {
      return <IconFileCode size={14} />;
    } else if (['.txt', '.md', '.json', '.xml', '.html', '.css'].includes(extension)) {
      return <IconFileText size={14} />;
    } else {
      return <IconFile size={14} />;
    }
  };

  return (
    <div className="sidebar-file-explorer">
      {!currentDirectory || currentDirectory === '' ? (
        <div className="empty-directory-prompt">
          <p>No directory selected</p>
          <button 
            className="select-directory-button"
            onClick={() => setCurrentDirectory('C:/Users')}
          >
            Select Directory
          </button>
        </div>
      ) : (
        <>
          <div className="directory-navigator">
            <button className="nav-up-button" onClick={navigateUp} title="Navigate Up">
              <IconArrowUp size={12} />
            </button>
            <div className="current-directory" title={currentDirectory}>
              {currentDirectory.length > 20 
                ? '...' + currentDirectory.substring(currentDirectory.length - 20) 
                : currentDirectory}
            </div>
          </div>
          
          <div className="file-list">
            {isLoading ? (
              <div className="loading-indicator">
                <IconLoader size={16} className="spinning" />
                <span>Loading...</span>
              </div>
            ) : directoryContents.length === 0 ? (
              <div className="empty-directory">Empty directory</div>
            ) : (
              directoryContents.map((item) => (
                <FileItem 
                  key={item.path}
                  item={item}
                  expanded={expandedFolders[item.path] || false}
                  onToggleFolder={toggleFolder}
                  onFileClick={handleFileClick}
                  folderContents={folderContents[item.path] || []}
                  getFileIcon={getFileIcon}
                  expandedFolders={expandedFolders}
                  allFolderContents={folderContents}
                  depth={0}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
};

const FileItem = ({ 
  item, 
  expanded, 
  onToggleFolder, 
  onFileClick, 
  folderContents,
  getFileIcon, 
  expandedFolders,
  allFolderContents,
  depth 
}) => {
  // Reduce indentation for deep files
  const paddingLeft = 4 + (depth * 8);
  const maxNameLength = 18 - depth; // Reduce max name length based on depth
  
  if (item.isDirectory) {
    const displayName = item.name.length > maxNameLength 
      ? item.name.substring(0, maxNameLength - 3) + '...' 
      : item.name;
      
    return (
      <div className="directory-item">
        <div 
          className={`directory-header ${expanded ? 'expanded' : ''}`}
          style={{ paddingLeft: `${paddingLeft}px` }}
          onClick={() => onToggleFolder(item.path)}
          title={item.name} // Show full name on hover
        >
          <span className="directory-chevron">
            {expanded ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
          </span>
          <span className="directory-icon">
            {expanded ? <IconFolderOpen size={14} /> : <IconFolder size={14} />}
          </span>
          <span className="directory-name">{displayName}</span>
        </div>
        
        {expanded && (
          <div className="directory-contents">
            {folderContents.map((subItem) => (
              <FileItem
                key={subItem.path}
                item={subItem}
                expanded={expandedFolders[subItem.path] || false}
                onToggleFolder={onToggleFolder}
                onFileClick={onFileClick}
                folderContents={allFolderContents[subItem.path] || []}
                getFileIcon={getFileIcon}
                expandedFolders={expandedFolders}
                allFolderContents={allFolderContents}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  } else {
    const displayName = item.name.length > maxNameLength 
      ? item.name.substring(0, maxNameLength - 3) + '...' 
      : item.name;
      
    return (
      <div 
        className="file-item"
        style={{ paddingLeft: `${paddingLeft + 12}px` }}
        onClick={() => onFileClick(item.path)}
        title={item.name} // Show full name on hover
      >
        <span className="file-icon">
          {getFileIcon(item.name)}
        </span>
        <span className="file-name">{displayName}</span>
      </div>
    );
  }
};

export default FileExplorer;
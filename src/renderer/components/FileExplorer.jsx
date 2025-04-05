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
  isLoading,
  storageKey = 'lastDirectory' 
}) => {
  const [expandedFolders, setExpandedFolders] = useState({});
  const [folderContents, setFolderContents] = useState({});
  const [activeFolder, setActiveFolder] = useState(null);

  useEffect(() => {
    const savedEditorDir = localStorage.getItem('lastEditorDirectory');
    if (savedEditorDir && (!currentDirectory || currentDirectory === '')) {
      setCurrentDirectory(savedEditorDir);
    } else if (currentDirectory === '') {
      setCurrentDirectory('C:/Users');
    }
  }, []);

  useEffect(() => {
    if (currentDirectory) {
      localStorage.setItem(storageKey, currentDirectory);
    }
  }, [currentDirectory]);

  const toggleFolder = async (folderPath) => {
    const isExpanding = !expandedFolders[folderPath];
    const newExpandedFolders = { ...expandedFolders };

    newExpandedFolders[folderPath] = isExpanding;

    if (isExpanding) {
      const parts = folderPath.split(path.sep);
      let current = '';
      parts.forEach((part) => {
        if (!part) return;
        current = current ? path.join(current, part) : part;
        newExpandedFolders[current] = true;
      });
    }

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

    setExpandedFolders(newExpandedFolders);
    setActiveFolder(folderPath);
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

  const handleDirectoryNavigatorClick = async () => {
    try {
      const result = await window.api.selectCodeDirectory(); // 👈 NEW ipc route
      if (result.success && result.path) {
        setCurrentDirectory(result.path);
        setActiveFolder(result.path);
        
        setExpandedFolders({});
        setFolderContents({});
  
        const contents = await window.api.listDirectory(result.path);
        setFolderContents({
          [result.path]: contents
        });
  
        // Save last code directory
        localStorage.setItem('lastEditorDirectory', result.path); // 🔑 uniquely named
      }
    } catch (error) {
      console.error('Error selecting code directory:', error);
    }
  };

  const getFileIcon = (fileName) => {
    const extension = path.extname(fileName).toLowerCase();

    if ([
      '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.c', '.cpp', '.cs'
    ].includes(extension)) {
      return <IconFileCode size={14} />;
    } else if ([
      '.txt', '.md', '.json', '.xml', '.html', '.css'
    ].includes(extension)) {
      return <IconFileText size={14} />;
    } else {
      return <IconFile size={14} />;
    }
  };

  const isInExpandedPath = (itemPath) => {
    return Object.keys(expandedFolders).some(expandedPath => {
      return expandedFolders[expandedPath] && itemPath.startsWith(expandedPath + path.sep);
    });
  };

  return (
    <div className="sidebar-file-explorer">
      {!currentDirectory || currentDirectory === '' ? (
        <div className="empty-directory-prompt">
          <p>No directory selected</p>
          <button 
            className="select-directory-button"
            onClick={handleDirectoryNavigatorClick}
          >
            Select Directory
          </button>
        </div>
      ) : (
        <>
          <div 
            className="directory-navigator"
            onClick={handleDirectoryNavigatorClick}
            style={{ cursor: 'pointer' }}
            title="Click to change directory"
          >
            <button 
              className="nav-up-button" 
              onClick={(e) => {
                e.stopPropagation();
                navigateUp();
              }} 
              title="Navigate Up"
            >
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
                  isExpanded={expandedFolders[item.path] || isInExpandedPath(item.path)}
                  activeFolder={activeFolder}
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
  depth,
  isExpanded,
  activeFolder
}) => {
  const paddingLeft = 4 + (depth * 8);
  const maxNameLength = 18 - depth;
  const isActive = activeFolder === item.path;

  if (item.isDirectory) {
    const displayName = item.name.length > maxNameLength 
      ? item.name.substring(0, maxNameLength - 3) + '...' 
      : item.name;

    return (
      <div className="directory-item">
        <div 
          className={`directory-header ${expanded ? 'expanded' : ''} ${isActive ? 'active' : ''}`}
          style={{ 
            paddingLeft: `${paddingLeft}px`,
            color: isExpanded ? 'var(--text-primary)' : 'var(--accent)' 
          }}
          onClick={() => onToggleFolder(item.path)}
          title={item.name}
        >
          <span className="directory-chevron" style={{ color: 'inherit' }}>
            {expanded ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
          </span>
          <span className="directory-icon" style={{ color: 'inherit' }}>
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
                isExpanded={true}
                activeFolder={activeFolder}
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
        style={{ 
          paddingLeft: `${paddingLeft + 12}px`,
          color: isExpanded ? 'var(--text-primary)' : 'var(--accent)'
        }}
        onClick={() => onFileClick(item.path)}
        title={item.name}
      >
        <span className="file-icon" style={{ color: 'inherit' }}>
          {getFileIcon(item.name)}
        </span>
        <span className="file-name">{displayName}</span>
      </div>
    );
  }
};

export default FileExplorer;
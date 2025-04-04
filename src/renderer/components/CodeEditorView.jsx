// src/renderer/components/CodeEditorView.jsx
import React, { useState, useEffect } from 'react';
import TabBar from './TabBar';
import Editor from './Editor';
import { IconRefresh, IconFolderPlus, IconFilePlus } from '@tabler/icons-react';

const CodeEditorView = ({
  currentDirectory,
  setCurrentDirectory,
  openFiles,
  activeFileIndex,
  onOpenFile,
  onFileContentChange,
  onCloseFile,
  onSaveFile,
  onChangeActiveFile
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [directoryContents, setDirectoryContents] = useState([]);

  useEffect(() => {
    if (currentDirectory) {
      loadDirectoryContents(currentDirectory);
    }
  }, [currentDirectory]);

  const loadDirectoryContents = async (dirPath) => {
    try {
      setIsLoading(true);
      const contents = await window.api.listDirectory(dirPath);
      setDirectoryContents(contents);
    } catch (error) {
      console.error('Error loading directory contents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    if (currentDirectory) {
      loadDirectoryContents(currentDirectory);
    }
  };

  const handleCreateFile = async () => {
    // Simple prompt for file name
    const fileName = prompt('Enter new file name:');
    if (!fileName) return;

    try {
      const filePath = `${currentDirectory}/${fileName}`;
      await window.api.writeFile(filePath, '');
      await loadDirectoryContents(currentDirectory);
      onOpenFile(filePath);
    } catch (error) {
      console.error('Error creating file:', error);
    }
  };

  const handleCreateFolder = async () => {
    const folderName = prompt('Enter new folder name:');
    if (!folderName) return;

    try {
      const folderPath = `${currentDirectory}/${folderName}`;
      await window.api.createDirectory(folderPath);
      await loadDirectoryContents(currentDirectory);
    } catch (error) {
      console.error('Error creating folder:', error);
    }
  };

  return (
    <div className="code-editor-view">
      {/* The file explorer is now handled by the sidebar,
          so we just need the editor part here */}
      <div className="editor-container">
        <div className="editor-toolbar">
          <button 
            className="editor-action-button" 
            onClick={handleRefresh}
            title="Refresh"
          >
            <IconRefresh size={14} />
          </button>
          <button 
            className="editor-action-button" 
            onClick={handleCreateFile}
            title="New File"
          >
            <IconFilePlus size={14} />
          </button>
          <button 
            className="editor-action-button" 
            onClick={handleCreateFolder}
            title="New Folder"
          >
            <IconFolderPlus size={14} />
          </button>
        </div>
        
        <TabBar 
          openFiles={openFiles}
          activeFileIndex={activeFileIndex}
          onCloseFile={onCloseFile}
          onChangeActiveFile={onChangeActiveFile}
          onSaveFile={onSaveFile}
        />
        
        <Editor 
          file={openFiles[activeFileIndex]}
          onContentChange={onFileContentChange}
        />
      </div>
    </div>
  );
};

export default CodeEditorView;
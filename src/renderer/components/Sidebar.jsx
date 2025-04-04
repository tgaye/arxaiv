// src/renderer/components/Sidebar.jsx
import React from 'react';
import { IconPlus, IconMessage, IconDatabase, IconArticle, IconCode } from '@tabler/icons-react';
import FileExplorer from './FileExplorer';

const Sidebar = ({ 
  conversations, 
  activeConversationId, 
  onSelectConversation, 
  onNewChat, 
  onShowModels,
  onShowPaperView,
  onShowCodeEditor,
  activeView,
  // Add these new props for file explorer
  currentDirectory,
  setCurrentDirectory,
  directoryContents,
  onOpenFile,
  isLoadingDirectory
}) => {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className={`nav-item ${activeView === 'chat' ? 'active' : ''}`} 
            onClick={onNewChat} 
            style={{ padding: '4px', borderRadius: '4px' }} 
            title="New Chat"
          >
            <IconPlus size={16} />
          </button>
          <button 
            className={`nav-item ${activeView === 'models' ? 'active' : ''}`} 
            onClick={onShowModels} 
            style={{ padding: '4px', borderRadius: '4px' }} 
            title="Models"
          >
            <IconDatabase size={16} />
          </button>
          <button 
            className={`nav-item ${activeView === 'paper' ? 'active' : ''}`} 
            onClick={onShowPaperView} 
            style={{ padding: '4px', borderRadius: '4px' }} 
            title="Research Papers"
          >
            <IconArticle size={16} />
          </button>
          
          <button 
            className={`nav-item ${activeView === 'code-editor' ? 'active' : ''}`} 
            onClick={onShowCodeEditor} 
            style={{ padding: '4px', borderRadius: '4px' }} 
            title="Code Editor"
          >
            <IconCode size={16} />
          </button>
        </div>
      </div>
      
      <div className="sidebar-content">
        {activeView === 'code-editor' ? (
          // Show file explorer in sidebar when in code editor view
          <FileExplorer
            currentDirectory={currentDirectory}
            setCurrentDirectory={setCurrentDirectory}
            directoryContents={directoryContents}
            onOpenFile={onOpenFile}
            isLoading={isLoadingDirectory}
          />
        ) : (
          // Otherwise show conversations
          conversations.map(conversation => (
            <div 
              key={conversation.id} 
              className={`nav-item ${activeConversationId === conversation.id ? 'active' : ''}`}
              onClick={() => onSelectConversation(conversation.id)}
            >
              <IconMessage size={18} style={{ marginRight: '8px' }} />
              <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {conversation.title}
              </div>
              {conversation.tokens > 0 && (
                <div className="token-counter">
                  {conversation.tokens} tokens
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Sidebar;
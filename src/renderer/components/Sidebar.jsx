import React from 'react';
import { IconPlus, IconMessage, IconDatabase, IconArticle } from '@tabler/icons-react';

const Sidebar = ({ 
  conversations, 
  activeConversationId, 
  onSelectConversation, 
  onNewChat, 
  onShowModels,
  onShowPaperView 
}) => {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="nav-item" onClick={onNewChat} style={{ padding: '6px', borderRadius: '4px' }} title="New Chat">
            <IconPlus size={22} />
          </button>
          <button className="nav-item" onClick={onShowModels} style={{ padding: '6px', borderRadius: '4px' }} title="Models">
            <IconDatabase size={22} />
          </button>
          <button className="nav-item" onClick={onShowPaperView} style={{ padding: '6px', borderRadius: '4px' }} title="Research Papers">
            <IconArticle size={22} />
          </button>
        </div>
      </div>
      <div className="sidebar-content">
        {conversations.map(conversation => (
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
        ))}
      </div>
    </div>
  );
};

export default Sidebar;
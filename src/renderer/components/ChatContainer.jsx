// src/renderer/components/ChatContainer.jsx
import React, { useState, useRef, useEffect } from 'react';
import { IconSend, IconWorld } from '@tabler/icons-react';
import SearchBar from './SearchBar';

const ChatContainer = ({ messages, onSendMessage, selectedModel, onSearchSubmit, onExploreClick }) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = () => {
    if (input.trim()) {
      onSendMessage(input);
      setInput('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <div className="chat-container" ref={chatContainerRef}>
        {messages.length === 0 && (
          <div className="empty-state">
            <div className="search-container">
              <h3 className="search-title">Quick Search™</h3>
              <SearchBar 
                onSubmit={onSearchSubmit} 
                placeholder="Enter arxiv URL (https://arxiv.org/pdf/XXXX.XXXXX)" 
              />
              <p className="search-description">
                Enter an arxiv URL to analyze research papers with AI
              </p>
            </div>
          </div>
        )}
        
        {messages.map((message) => (
          <div 
            key={message.id} 
            className={`message ${message.role === 'user' ? 'user' : 'ai'}`}
          >
            <div style={{ marginBottom: '4px', fontSize: '0.8rem', opacity: 0.7 }}>
              {message.role === 'user' ? 'User>' : 'AI>'}
            </div>
            <div style={{ whiteSpace: 'pre-wrap' }}>
              {message.content}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="input-container">
        <div className="input-actions">
          {messages.length > 0 && (
            <button 
              className="action-button explore-button" 
              onClick={onExploreClick}
              title="Explore - View conversation as a web page"
            >
              🌐
            </button>
          )}
        </div>
        <div className="input-box">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message and press Enter to send ..."
            rows={1}
          />
          <button className="send-button" onClick={handleSend}>
            <IconSend size={16} />
          </button>
        </div>
      </div>
    </>
  );
};

export default ChatContainer;
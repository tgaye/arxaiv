// src/renderer/components/App.jsx
import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import ChatContainer from './ChatContainer';
import ModelsView from './ModelsView';
import PaperView from './PaperView';
import ExploreView from './ExploreView';
import Footer from './Footer';
import SettingsDialog from './SettingsDialog';

const App = () => {
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [activeView, setActiveView] = useState('models'); // 'chat', 'models', 'paper', or 'explore'
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [modelDirectory, setModelDirectory] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [currentPaper, setCurrentPaper] = useState(null);
  const [exploreContent, setExploreContent] = useState(null); // Store generated HTML
  const [isGeneratingHTML, setIsGeneratingHTML] = useState(false);
  
  useEffect(() => {
    const loadModels = async () => {
      const modelsList = await window.api.getModels();
      setModels(modelsList);
    };

    loadModels();
  }, []);

  const handleNewChat = () => {
    if (!selectedModel || !isModelLoaded) return;
    
    const newConversation = {
      id: Date.now().toString(),
      title: `Chat ${conversations.length + 1}`,
      messages: [],
      tokens: 0,
      modelId: selectedModel.path,
      summary: '', // Track conversation summary
    };
    
    setConversations([...conversations, newConversation]);
    setActiveConversationId(newConversation.id);
    setActiveView('chat');
  };

  const handleSelectConversation = (conversationId) => {
    setActiveConversationId(conversationId);
    setActiveView('chat');
  };

  const handleShowModels = () => {
    setActiveView('models');
  };

  const handleShowPaperView = () => {
    setActiveView('paper');
  };

  const handleSelectModel = async (model) => {
    setSelectedModel(model);
    
    try {
      const result = await window.api.loadModel(model.path);
      if (result.success) {
        setIsModelLoaded(true);
        handleNewChat();
      } else {
        console.error('Failed to load model:', result.error);
      }
    } catch (error) {
      console.error('Error loading model:', error);
    }
  };

  const handleSendMessage = async (message) => {
    if (!activeConversationId || !selectedModel) return;
    
    // Add user message to conversation
    const userMessage = { role: 'user', content: message, id: Date.now() };
    
    setConversations(prev => {
      return prev.map(conv => {
        if (conv.id === activeConversationId) {
          return {
            ...conv,
            messages: [...conv.messages, userMessage],
            title: message.slice(0, 20) + (message.length > 20 ? '...' : ''),
          };
        }
        return conv;
      });
    });
    
    // Create a placeholder for AI response
    const aiMessageId = Date.now() + 1;
    const aiPlaceholder = { role: 'assistant', content: '', id: aiMessageId };
    
    setConversations(prev => {
      return prev.map(conv => {
        if (conv.id === activeConversationId) {
          return { ...conv, messages: [...conv.messages, aiPlaceholder] };
        }
        return conv;
      });
    });
    
    // Set up response chunk handler
    const removeResponseListener = window.api.onResponseChunk(({ chunk, conversationId }) => {
      if (conversationId !== activeConversationId) return;
      
      setConversations(prev => {
        return prev.map(conv => {
          if (conv.id === conversationId) {
            const updatedMessages = conv.messages.map(msg => {
              if (msg.id === aiMessageId) {
                return { ...msg, content: msg.content + chunk };
              }
              return msg;
            });
            return { ...conv, messages: updatedMessages };
          }
          return conv;
        });
      });
    });
    
    // Send message to backend
    try {
      await window.api.sendMessage({ 
        message, 
        conversationId: activeConversationId 
      });
      
      // Clean up listener
      removeResponseListener();
      
      // After message is complete, generate a summary in the background
      const activeConversation = conversations.find(c => c.id === activeConversationId);
      if (activeConversation && activeConversation.messages.length > 4) {
        // At least 2 exchanges (4 messages) before generating summary
        try {
          window.api.generateConversationSummary({
            conversationId: activeConversationId,
            messages: [...activeConversation.messages, { role: 'assistant', content: chunk, id: aiMessageId }]
          });
        } catch (error) {
          console.error('Error generating summary:', error);
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      removeResponseListener();
    }
  };

  const handleExploreClick = () => {
    console.log("Explore button clicked");
    
    // Switch to explore view
    setActiveView('explore');
    
    // Set a loading state briefly to simulate some processing
    setIsGeneratingHTML(true);
    
    // Create a Safari-like landing page template
    const staticHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ArxAIv Browser</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro", "Helvetica Neue", Helvetica, Arial, sans-serif;
            background-color: #f5f5f7;
            color: #333;
            line-height: 1.5;
          }
          
          .browser-container {
            max-width: 100%;
            height: 100vh;
            display: flex;
            flex-direction: column;
          }
          
          .browser-toolbar {
            background: linear-gradient(to bottom, #e8e8e8, #d8d8d8);
            border-bottom: 1px solid #bbb;
            padding: 10px;
            display: flex;
            align-items: center;
            height: 44px;
          }
          
          .browser-controls {
            display: flex;
            gap: 8px;
            margin-right: 10px;
          }
          
          .browser-button {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            border: none;
          }
          
          .browser-button.close {
            background-color: #ff5f57;
          }
          
          .browser-button.minimize {
            background-color: #ffbd2e;
          }
          
          .browser-button.maximize {
            background-color: #28c940;
          }
          
          .address-bar {
            flex: 1;
            background-color: white;
            border-radius: 5px;
            border: 1px solid #ccc;
            padding: 6px 10px;
            font-size: 13px;
            display: flex;
            align-items: center;
          }
          
          .address-bar-icon {
            color: #999;
            margin-right: 5px;
          }
          
          .browser-content {
            flex: 1;
            background-color: white;
            padding: 20px;
            overflow: auto;
          }
          
          .welcome-page {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            text-align: center;
            padding: 0 20px;
          }
          
          .logo {
            font-size: 72px;
            margin-bottom: 20px;
            background: linear-gradient(90deg, #4f8bf9, #9d55ff);
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-fill-color: transparent;
            font-weight: bold;
          }
          
          .welcome-title {
            font-size: 28px;
            margin-bottom: 15px;
            color: #1d1d1f;
            font-weight: 500;
          }
          
          .welcome-subtitle {
            font-size: 18px;
            color: #86868b;
            max-width: 600px;
            margin-bottom: 30px;
          }
          
          .favorites {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 30px;
            max-width: 800px;
            width: 100%;
            margin-top: 40px;
          }
          
          .favorite-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-decoration: none;
            transition: all 0.2s ease;
          }
          
          .favorite-item:hover {
            transform: scale(1.05);
          }
          
          .favorite-icon {
            width: 60px;
            height: 60px;
            background-color: #f0f0f0;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            font-size: 24px;
          }
          
          .favorite-title {
            color: #1d1d1f;
            font-size: 14px;
            margin-top: 6px;
          }
          
          .search-container {
            width: 100%;
            max-width: 584px;
            margin-bottom: 40px;
          }
          
          .search-box {
            width: 100%;
            padding: 12px 24px;
            font-size: 16px;
            border-radius: 24px;
            border: 1px solid #dfe1e5;
            outline: none;
            box-shadow: 0 1px 6px rgba(32,33,36,0.28);
            transition: all 0.2s ease;
          }
          
          .search-box:focus {
            box-shadow: 0 1px 10px rgba(32,33,36,0.28);
            border-color: rgba(223,225,229,0);
          }
          
          .footer {
            font-size: 13px;
            color: #86868b;
            margin-top: 40px;
            padding: 20px;
          }
        </style>
      </head>
      <body>
        <div class="browser-container">
          <div class="browser-toolbar">
            <div class="browser-controls">
              <div class="browser-button close"></div>
              <div class="browser-button minimize"></div>
              <div class="browser-button maximize"></div>
            </div>
            <div class="address-bar">
              <span class="address-bar-icon">🔒</span>
              https://arxaiv.ai/welcome
            </div>
          </div>
          
          <div class="browser-content">
            <div class="welcome-page">
              <div class="logo"></div>
              <h1 class="welcome-title">Welcome to ArxAIv Browser</h1>
              <p class="welcome-subtitle">Explore the fascinating world of AI-powered research and conversation visualization</p>
              
              <div class="search-container">
                <input type="text" class="search-box" placeholder="Search or enter website name" />
              </div>
              
              <div class="favorites">
                <a href="#" class="favorite-item">
                  <div class="favorite-icon">📊</div>
                  <span class="favorite-title">Analytics</span>
                </a>
                <a href="#" class="favorite-item">
                  <div class="favorite-icon">📚</div>
                  <span class="favorite-title">Library</span>
                </a>
                <a href="#" class="favorite-item">
                  <div class="favorite-icon">🧠</div>
                  <span class="favorite-title">AI Models</span>
                </a>
                <a href="#" class="favorite-item">
                  <div class="favorite-icon">📝</div>
                  <span class="favorite-title">Papers</span>
                </a>
                <a href="#" class="favorite-item">
                  <div class="favorite-icon">💬</div>
                  <span class="favorite-title">Chat</span>
                </a>
                <a href="#" class="favorite-item">
                  <div class="favorite-icon">⚙️</div>
                  <span class="favorite-title">Settings</span>
                </a>
              </div>
              
              <div class="footer">
                © ${new Date().getFullYear()} ArxAIv Browser • Privacy Policy • Terms of Use
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
    
    console.log("HTML content created, length:", staticHtml.length);
    
    // Set the HTML content
    setExploreContent(staticHtml);
    console.log("HTML content set in state");
    
    // Turn off loading state after a short delay to simulate processing
    setTimeout(() => {
      setIsGeneratingHTML(false);
      console.log("Loading state turned off");
    }, 800);
  };

  // Listen for conversation summary updates
  useEffect(() => {
    const unsubscribe = window.api.onConversationSummary(({ conversationId, summary }) => {
      setConversations(prev => {
        return prev.map(conv => {
          if (conv.id === conversationId) {
            return { ...conv, summary };
          }
          return conv;
        });
      });
    });
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleDuplicateConversation = () => {
    if (!activeConversationId) return;
    
    const activeConversation = conversations.find(conv => conv.id === activeConversationId);
    if (!activeConversation) return;
    
    const duplicateConversation = {
      ...activeConversation,
      id: Date.now().toString(),
      title: `${activeConversation.title} (copy)`,
    };
    
    setConversations([...conversations, duplicateConversation]);
    setActiveConversationId(duplicateConversation.id);
  };

  const handleClearConversation = () => {
    if (!activeConversationId) return;
    
    setConversations(prev => {
      return prev.map(conv => {
        if (conv.id === activeConversationId) {
          return { ...conv, messages: [], summary: '' };
        }
        return conv;
      });
    });
  };

  const handleSelectModelDirectory = async () => {
    const result = await window.api.selectModelDirectory();
    if (result.success) {
      setModelDirectory(result.path);
      // Refresh models list
      const modelsList = await window.api.getModels();
      setModels(modelsList);
    }
  };

  const handleSearchSubmit = async (query) => {
    // For now, just log the search query
    console.log('Search submitted:', query);
    
    // This would eventually call the arxiv service
    // For now, just set a dummy paper and switch to paper view
    if (query.includes('arxiv.org')) {
      // Simulate loading a paper
      const dummyPaper = {
        title: "ArxAIv: A Terminal-Inspired Interface for Academic Research",
        authors: ["Researcher One", "Researcher Two"],
        date: "2023-03-15",
        url: query,
        abstract: "This is a placeholder abstract for demonstration purposes. In the actual implementation, this would be the real abstract extracted from the arxiv paper.",
        githubUrl: "https://github.com/example/research-repo",
        citation: "Researcher One, Researcher Two. (2023). ArxAIv: A Terminal-Inspired Interface for Academic Research. arXiv preprint arXiv:2303.12345.",
        downloadPdf: () => console.log("Downloading PDF..."),
        cloneRepository: () => console.log("Cloning repository..."),
      };
      
      setCurrentPaper(dummyPaper);
      setActiveView('paper');
    }
  };

  const activeConversation = conversations.find(conv => conv.id === activeConversationId);
  
  return (
    <div className="app-container">
      <Sidebar 
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        onShowModels={handleShowModels}
        onShowPaperView={handleShowPaperView}
      />
        
      <div className="main-content glow-effect">
        
        <Header 
          activeView={activeView}
          selectedModel={selectedModel || {}}
          onDuplicate={handleDuplicateConversation}
          onClearAll={handleClearConversation}
          onOpenSettings={() => setShowSettings(true)}
          onSearchSubmit={handleSearchSubmit}
        />
        
        {activeView === 'chat' && activeConversation ? (
          <ChatContainer 
            messages={activeConversation.messages}
            onSendMessage={handleSendMessage}
            selectedModel={selectedModel || {}}
            onSearchSubmit={handleSearchSubmit}
            onExploreClick={handleExploreClick}
          />
        ) : activeView === 'models' ? (
          <ModelsView 
            models={models}
            onSelectModel={handleSelectModel}
            modelDirectory={modelDirectory}
            onSelectModelDirectory={handleSelectModelDirectory}
          />
        ) : activeView === 'paper' ? (
          <PaperView paper={currentPaper} />
        ) : activeView === 'explore' ? (
          <ExploreView 
            html={exploreContent} 
            isLoading={isGeneratingHTML}
            conversationId={activeConversationId}
          />
        ) : null}

        <SettingsDialog
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          onSave={() => {
            // Refresh any settings-dependent components
          }}
        />
                
        <Footer />
      </div>
    </div>
  );
};

export default App;
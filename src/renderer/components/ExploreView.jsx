// src/renderer/components/ExploreView.jsx
import React, { useRef, useEffect, useState } from 'react';
import { IconRefresh, IconDownload } from '@tabler/icons-react';

const ExploreView = ({ html, isLoading, conversationId }) => {
  const iframeRef = useRef(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [localHtml, setLocalHtml] = useState(html);
  const cspTag = `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; frame-src 'self' data: blob:;">`;
 
  // Effect to set HTML content using srcdoc attribute
  useEffect(() => {
    if (html && iframeRef.current) {
      try {
        // Set loading state
        setIframeLoaded(false);
        setLocalHtml(html);
        const htmlWithCSP = html.replace('<head>', `<head>${cspTag}`);

        // Set the srcdoc attribute of the iframe
        iframeRef.current.srcdoc = htmlWithCSP;
        
      } catch (error) {
        console.error('Error setting iframe content:', error);
      }
    }
  }, [html]);

  // Effect to load page1.html after 10 seconds
  useEffect(() => {
    if (iframeLoaded && !isTransitioning) {
      const timer = setTimeout(async () => {
        try {
          setIsTransitioning(true);
          
          // Read the HTML file from the specified path
          const result = await window.api.readHtmlFile('src/webpages/page1.html');
          
          if (result.success) {
            // Trigger fade-out animation
            if (iframeRef.current) {
              iframeRef.current.classList.add('fade-out');
              
              // Wait for animation to complete before changing content
              setTimeout(() => {
                // Update iframe content
                iframeRef.current.srcdoc = result.content;
                setLocalHtml(result.content);
                
                // After a brief delay, trigger fade-in animation
                setTimeout(() => {
                  iframeRef.current.classList.remove('fade-out');
                  iframeRef.current.classList.add('fade-in');
                  
                  // Reset classes after animation completes
                  setTimeout(() => {
                    iframeRef.current.classList.remove('fade-in');
                    setIsTransitioning(false);
                  }, 600);
                }, 100);
              }, 600); // Match this duration to your CSS transition time
            }
          } else {
            console.error('Failed to load HTML file:', result.error);
            setIsTransitioning(false);
          }
        } catch (error) {
          console.error('Error during transition:', error);
          setIsTransitioning(false);
        }
      }, 10000); // 10 seconds delay
      
      return () => clearTimeout(timer);
    }
  }, [iframeLoaded]);

  const handleRefresh = () => {
    if (iframeRef.current && localHtml) {
      setIframeLoaded(false);
      // Reset the srcdoc attribute
      iframeRef.current.srcdoc = localHtml;
    }
  };

  const handleDownload = () => {
    if (!localHtml) return;
    
    // Create a Blob from the HTML content
    const blob = new Blob([localHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    // Create a temporary link and trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = `arxaiv-web-${conversationId || 'export'}.html`;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  };

  return (
    <div className="explore-view">
      <div className="explore-toolbar">
        <button
          className="toolbar-button"
          onClick={handleRefresh}
          disabled={isLoading || isTransitioning}
        >
          <IconRefresh size={16} />
          <span>Refresh</span>
        </button>
        
        <button
          className="toolbar-button"
          onClick={handleDownload}
          disabled={!localHtml || isLoading || isTransitioning}
        >
          <IconDownload size={16} />
          <span>Download HTML</span>
        </button>
        
        {isTransitioning && (
          <span className="transition-indicator">Transitioning...</span>
        )}
      </div>
      
      <div className="fade-container">
        {isLoading && (
          <div className={`loading-overlay ${iframeLoaded ? 'fade-out' : ''}`}>
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>Loading web page...</p>
              <div className="loading-detail">
                <small>Preparing browser view</small>
              </div>
            </div>
          </div>
        )}
        
        <iframe
          ref={iframeRef}
          className={`explore-iframe ${iframeLoaded ? 'loaded' : ''}`}
          title="ArxAIv Browser"
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-modals allow-downloads allow-orientation-lock allow-pointer-lock allow-presentation allow-top-navigation"
          onLoad={() => {
            console.log("Iframe content loaded");
            setIframeLoaded(true);
          }}
        ></iframe>
      </div>
    </div>
  );
};

export default ExploreView;
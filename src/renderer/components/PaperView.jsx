// src/renderer/components/PaperView.jsx
import React from 'react';
import { IconExternalLink, IconBrandGithub, IconClipboard, IconDownload } from '@tabler/icons-react';

const PaperView = ({ paper }) => {
  // If no paper is loaded yet
  if (!paper) {
    return (
      <div className="paper-view-container empty-state">
        <div className="empty-state-title">
          No paper loaded
        </div>
        <div className="empty-state-subtitle">
          Use the search bar above to enter an arxiv URL
        </div>
        <div className="empty-state-hint">
          Example: https://arxiv.org/pdf/2303.08774
        </div>
      </div>
    );
  }

  return (
    <div className="paper-view-container">
      <div className="paper-header">
        <h2 className="paper-title">{paper.title}</h2>
        <div className="paper-meta">
          <span className="paper-authors">{paper.authors.join(', ')}</span>
          <span className="paper-date">{paper.date}</span>
          <div className="paper-actions">
            <button className="paper-action-button" onClick={() => window.open(paper.url, '_blank')}>
              <IconExternalLink size={16} />
              <span>View on Arxiv</span>
            </button>
            {paper.githubUrl && (
              <button className="paper-action-button" onClick={() => window.open(paper.githubUrl, '_blank')}>
                <IconBrandGithub size={16} />
                <span>View GitHub</span>
              </button>
            )}
            <button className="paper-action-button" onClick={() => navigator.clipboard.writeText(paper.citation)}>
              <IconClipboard size={16} />
              <span>Copy Citation</span>
            </button>
            <button className="paper-action-button" onClick={() => paper.downloadPdf()}>
              <IconDownload size={16} />
              <span>Download PDF</span>
            </button>
          </div>
        </div>
      </div>
      
      <div className="paper-content">
        <div className="paper-abstract">
          <h3>Abstract</h3>
          <p>{paper.abstract}</p>
        </div>
        
        {paper.githubUrl && (
          <div className="paper-github">
            <h3>GitHub Repository</h3>
            <div className="github-info">
              <IconBrandGithub size={20} />
              <a href={paper.githubUrl} target="_blank" rel="noopener noreferrer">
                {paper.githubUrl.replace('https://github.com/', '')}
              </a>
              <button className="clone-button" onClick={() => paper.cloneRepository()}>
                Clone Repository
              </button>
            </div>
          </div>
        )}
        
        <div className="paper-summary">
          <h3>AI Summary</h3>
          {paper.summary ? (
            <div className="summary-content">{paper.summary}</div>
          ) : (
            <div className="summary-loading">
              Generating summary with LLM...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaperView;
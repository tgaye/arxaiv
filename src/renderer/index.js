window.addEventListener('error', (e) => {
  console.error('[window.onerror]', e);
});

import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/index.css';
import App from './components/App';
import * as monaco from 'monaco-editor';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
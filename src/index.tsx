import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import storage from './utils/storage';
import { ErrorBoundary } from './components/ErrorBoundary';

// Initialize storage API on window for app-wide access
window.storage = storage;

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

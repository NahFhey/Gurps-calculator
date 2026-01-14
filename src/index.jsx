import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import storage from './utils/storage';

// Initialize storage API on window for app-wide access
window.storage = storage;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

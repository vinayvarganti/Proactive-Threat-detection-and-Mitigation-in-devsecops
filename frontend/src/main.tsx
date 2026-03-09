import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './config/axios.config'; // Configure axios globally

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

import React from 'react';
import ReactDOM from 'react-dom/client';
import './i18n/config';
import { appLog } from '@/services/debug/appLog';
import App from './App';
import './styles/globals.css';

appLog.init();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

import React from 'react';
import ReactDOM from 'react-dom/client';
import './i18n/config';
import { appLog } from '@/services/debug/appLog';
import App from './App';

// OpenAEC stylebook fonts (self-hosted via @fontsource, bundled with app for offline use)
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';

import './styles/globals.css';

appLog.init();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

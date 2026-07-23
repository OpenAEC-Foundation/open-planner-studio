import React from 'react';
import ReactDOM from 'react-dom/client';
// De module-side-effect (i18n.init met en) draait synchroon bij deze import; initLocale()
// laadt daarna de actieve taal-chunk vóór de eerste paint (geen Engelse flits).
import { initLocale } from './i18n/config';
import { appLog } from '@/services/debug/appLog';
import App from './App';

// OpenAEC stylebook fonts (self-hosted via @fontsource, bundled with app for offline use)
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/600.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';

import './styles/globals.css';

appLog.init();

// Dev-only self-test haak (window.__OPS__) voor geautomatiseerd testen via Playwright MCP.
// DEV-guard + dynamische import zodat dit volledig uit productie-builds verdwijnt.
if (import.meta.env.DEV) {
  void import('@/utils/devBridge').then(({ installDevBridge }) => installDevBridge());
}

// Wacht tot de actieve taal geladen is voordat we renderen (voorkomt een Engelse flits).
// Faalt de taal-load, dan valt i18next terug op de eager 'en'-resources en renderen we alsnog.
initLocale()
  .catch(() => { /* taal-load faalde → en-fallback; toch renderen */ })
  .finally(() => {
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  });

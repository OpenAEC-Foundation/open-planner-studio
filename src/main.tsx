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

// Zelftesthaak (window.__OPS__) voor geautomatiseerd testen via Playwright MCP en de expliciete
// productiebenchmark. Gewone productiebuilds zetten VITE_OPS_BENCH_BRIDGE niet en tree-shaken de
// dynamische import dus nog steeds volledig weg; de benchmarkbuild gebruikt wel React/Vite PROD.
if (import.meta.env.DEV || import.meta.env.VITE_OPS_BENCH_BRIDGE === '1') {
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

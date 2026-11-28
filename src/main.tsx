import React from 'react';
import ReactDOM from 'react-dom/client';
import { initLocale } from './i18n/config';
import { appLog } from '@/services/debug/appLog';
import { installSiteAppTools } from '@/services/mcp/siteAppTools';
import { PLATFORM_BUILD } from '@/utils/buildFlags';
import { hydrateSiteHostSettings } from '@/services/fileAccess/siteHostSettings';
import { showFatalError } from './startup/fatalError';

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
import './components/icons/icons.css';

appLog.init();

const hostSettingsReady = hydrateSiteHostSettings();

if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('fakeSite') === '1') {
  void import('@/services/fileAccess/fakeSiteHost').then(({ installFakeSiteHost }) => installFakeSiteHost());
}

hostSettingsReady
  .then(() => initLocale())
  .catch(() => {})
  .then(() => {
    if (PLATFORM_BUILD) installSiteAppTools();
    return Promise.all([
      import('./App'),
      import('./startup/initialSettings').then(({ loadSettingsBeforeFirstRender }) => loadSettingsBeforeFirstRender()),
    ]);
  })
  .then(([{ default: App }]) => {
    ReactDOM.createRoot(document.getElementById('root')!, { onUncaughtError: showFatalError }).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    installDevHooks();
  })
  .catch(showFatalError);

function installDevHooks(): void {
  if (import.meta.env.DEV || import.meta.env.VITE_OPS_BENCH_BRIDGE === '1') {
    void import('@/utils/devBridge').then(({ installDevBridge }) => installDevBridge());
  }

  const qaScene = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('qaScene') : null;
  if (qaScene) {
    void import('@/utils/qaScenes').then(({ runQaScene }) => runQaScene(qaScene)).catch(e => console.error(e));
  }

}

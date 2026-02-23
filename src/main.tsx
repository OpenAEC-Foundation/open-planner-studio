import React from 'react';
import ReactDOM from 'react-dom/client';
import './i18n/config';
import App from './App';
import './styles/globals.css';
import { readIFC } from '@/services/ifc/ifcReader';
import { useAppStore } from '@/state/appStore';

async function loadExampleAndStart() {
  try {
    const resp = await fetch('/examples/oosterhoutse-baai-drijvende-woningen.ifc');
    if (resp.ok) {
      const text = await resp.text();
      const data = readIFC(text);
      const store = useAppStore.getState();
      store.loadState(data);
      store.setViewStartDate(data.project.startDate);
      store.runCPM();
    }
  } catch (e) {
    console.warn('Could not load example:', e);
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

loadExampleAndStart();

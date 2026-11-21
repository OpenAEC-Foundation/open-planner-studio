// De opslagworker (#804 stap 4): de gewone writer en de merge, zonder store-singleton, DOM, bestandstoegang of Tauri.
// De merge heropent de planning in een eigen storecontext (`ifcMergePlanning.ts`); die fabriek wordt gekoppeld bij het
// laden van `appStoreFactory.ts`, dus deze import is nodig. Nooit `appStore.ts`: dat maakt de app-singleton.
import '@/state/appStoreFactory';
import { handleIfcSaveRequest, type IfcSaveRequest, type IfcSaveResponse } from './ifcSaveProtocol';

const post = (response: IfcSaveResponse, transfer: ArrayBuffer[] = []) => self.postMessage(response, { transfer });
// METING #804: de haak van de rekencode; de hoofdthread schrijft de regel (`ifcSaveWorker.ts`), met deze klok.
const meting = (label: string) => self.postMessage({ meting804: label, t: Date.now() });
(globalThis as { __opsMeting804?: (label: string) => void }).__opsMeting804 = meting; // METING

async function answer(request: IfcSaveRequest): Promise<void> {
  meting('verzoek ontvangen (kopie van de bron staat in de worker)'); // METING
  const { response, transfer } = await handleIfcSaveRequest(request);
  meting('klaar met rekenen, antwoord versturen'); // METING
  try {
    post(response, transfer);
    meting('antwoord verstuurd'); // METING
  } catch (error) {
    // Een veld van een fout dat niet over de grens kan: dan de fout zonder dat veld, nooit zonder antwoord.
    if (!('error' in response)) throw error;
    post({ id: request.id, error: { ...response.error, data: {} } });
  }
}

self.onmessage = ({ data }: MessageEvent<IfcSaveRequest>) => { void answer(data); };

// Het script draait en de imports zijn geladen: vanaf nu is een fout of een time-out een fout, geen startprobleem.
post({ started: true });

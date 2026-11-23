// De opslagworker (#804 stap 4): de gewone writer en de merge, zonder store-singleton, DOM, bestandstoegang of Tauri.
// De merge heropent de planning in een eigen storecontext (`ifcMergePlanning.ts`); die fabriek wordt gekoppeld bij het
// laden van `appStoreFactory.ts`, dus deze import is nodig. Nooit `appStore.ts`: dat maakt de app-singleton.
import '@/state/appStoreFactory';
import { handleIfcSaveRequest, type IfcSaveRequest, type IfcSaveResponse } from './ifcSaveProtocol';

const post = (response: IfcSaveResponse, transfer: ArrayBuffer[] = []) => self.postMessage(response, { transfer });

async function answer(request: IfcSaveRequest): Promise<void> {
  const { response, transfer } = await handleIfcSaveRequest(request);
  try {
    post(response, transfer);
  } catch (error) {
    // Een veld van een fout dat niet over de grens kan: dan de fout zonder dat veld, nooit zonder antwoord.
    if (!('error' in response)) throw error;
    post({ id: request.id, error: { ...response.error, data: {} } });
  }
}

self.onmessage = ({ data }: MessageEvent<IfcSaveRequest>) => { void answer(data); };

// Het script draait en de imports zijn geladen: vanaf nu is een fout of een time-out een fout, geen startprobleem.
post({ started: true });

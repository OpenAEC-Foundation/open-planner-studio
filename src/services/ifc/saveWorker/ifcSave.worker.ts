import '@/state/appStoreFactory';
import { handleIfcSaveRequest, type IfcSaveResponse, type IfcSaveWorkerRequest } from './ifcSaveProtocol';

const post = (response: IfcSaveResponse, transfer: ArrayBuffer[] = []) => self.postMessage(response, { transfer });

async function answer(request: IfcSaveWorkerRequest): Promise<void> {
  const { response, transfer } = await handleIfcSaveRequest(request);
  try {
    post(response, transfer);
  } catch (error) {
    if (!('error' in response)) throw error;
    post({ id: request.id, error: { ...response.error, data: {} } });
  }
}

self.onmessage = ({ data }: MessageEvent<IfcSaveWorkerRequest>) => { void answer(data); };

post({ started: true });

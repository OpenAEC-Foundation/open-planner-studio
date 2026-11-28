import { createForeignScanHandler, type ForeignScanWorkerRequest } from './foreignScanHandler';

const handle = createForeignScanHandler((response, transfer) => self.postMessage(response, { transfer }));
self.onmessage = ({ data }: MessageEvent<ForeignScanWorkerRequest>) => handle(data);

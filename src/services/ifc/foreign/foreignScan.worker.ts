// Scanner en indeling buiten de hoofdthread (#804 fase 1a, §4.13: 300 MB kost ongeveer 6 s), en de modelscan van de
// doelscan (knownbug 1758). De handler staat in `foreignScanHandler.ts`.
import { createForeignScanHandler, type ForeignScanWorkerRequest } from './foreignScanHandler';

const handle = createForeignScanHandler((response, transfer) => self.postMessage(response, { transfer }));
self.onmessage = ({ data }: MessageEvent<ForeignScanWorkerRequest>) => handle(data);

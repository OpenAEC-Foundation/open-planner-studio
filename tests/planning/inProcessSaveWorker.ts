// De opslagworker als dubbel in dit proces (#804 stap 4 en 5), voor `check-save-worker.ts` en `check-ifc-document-save.ts`.
// Hij draait de echte handler en verstuurt berichten zoals een browser: een kopie (`structuredClone`), en wat in de
// overdrachtslijst staat, is daarna aan de kant van de afzender leeg. Zo is te zien wat gekopieerd en wat overgedragen
// wordt. De handler laadt pas bij het eerste antwoord, na de kale browseromgeving van de proef.
import type { IfcSaveRequest, IfcSaveResponse } from '@/services/ifc/saveWorker/ifcSaveProtocol';
import type { IfcSaveWorkerPort } from '@/services/ifc/saveWorker/ifcSaveWorker';

/** `auto`: meldt `started` en antwoordt met de echte handler. `manual`: de proef bepaalt. `silent`: start nooit. */
export class InProcessWorker implements IfcSaveWorkerPort {
  onmessage: Worker['onmessage'] = null;
  onerror: Worker['onerror'] = null;
  onmessageerror: Worker['onmessageerror'] = null;
  readonly requests: IfcSaveRequest[] = [];
  /** De buffers die de worker teruggaf, zoals hij ze daarna nog ziet (overgedragen = leeg). */
  readonly sentBack: Uint8Array[] = [];
  terminated = false;
  private startedSent = false;
  constructor(private readonly mode: 'auto' | 'manual' | 'silent' = 'auto') {}
  postMessage(message: unknown, options?: StructuredSerializeOptions | Transferable[]) {
    const transfer = Array.isArray(options) ? options : options?.transfer ?? [];
    const request = structuredClone(message as IfcSaveRequest, { transfer });
    this.requests.push(request);
    if (this.mode === 'auto') setTimeout(() => { this.start(); void this.answer(this.requests.length - 1); }, 0);
  }
  start() {
    if (this.startedSent || this.terminated) return;
    this.startedSent = true;
    this.emit({ started: true });
  }
  async answer(index: number) {
    const { handleIfcSaveRequest } = await import('@/services/ifc/saveWorker/ifcSaveProtocol');
    const { response, transfer } = await handleIfcSaveRequest(this.requests[index]!);
    if (this.terminated) return;
    const views = 'result' in response && response.result.kind !== 'merge-unchanged'
      ? response.result.kind === 'writer' ? [response.result.bytes] : [response.result.prepared.bytes] : [];
    const delivered = structuredClone(response, { transfer });
    this.sentBack.push(...views);
    this.emit(delivered);
  }
  emit(data: IfcSaveResponse) {
    this.onmessage?.call(this as unknown as Worker, { data } as MessageEvent<IfcSaveResponse>);
  }
  fail(message: string) {
    this.onerror?.call(this as unknown as Worker, { message, preventDefault: () => undefined } as ErrorEvent);
  }
  terminate() { this.terminated = true; }
}

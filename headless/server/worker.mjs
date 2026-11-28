import { parentPort } from 'node:worker_threads';
import { openIfc, PlannerCoreError } from '@openaec/open-planner-core';

for (const method of ['log', 'info', 'warn', 'error', 'debug', 'trace']) console[method] = () => {};

parentPort.on('message', async ({ text, output }) => {
  try {
    const doc = await openIfc(text);
    const summary = doc.schedule();
    parentPort.postMessage(output === 'ifc' ? { ok: true, ifc: doc.toIfc() } : { ok: true, summary });
  } catch (err) {
    if (err instanceof PlannerCoreError) {
      parentPort.postMessage({ ok: false, code: err.code, message: err.message, details: { ...err.details } });
    } else {
      parentPort.postMessage({ ok: false, code: 'INTERNAL', message: 'Internal error during the calculation' });
    }
  }
});

// Rekenworker van de headless API (zie server.mjs). Eén bericht = één IFC doorrekenen met het
// gebouwde pakket; het antwoord is altijd `{ ok: true, … }` of `{ ok: false, code, message, details? }`.
// Loopt in een eigen thread, zodat de server bij een timeout de worker kan beëindigen.
import { parentPort } from 'node:worker_threads';
import { openIfc, openIfcBytes, PlannerCoreError } from '@openaec/open-planner-core';

// De kern logt soms id's of namen uit het bestand (bijv. een relatie-id bij een te grote
// samenvattingsrelatie). Die horen niet in de serverlogs: console hier stil, en de server gooit
// de stdout/stderr van deze worker bovendien weg (server.mjs, `Calculator`).
for (const method of ['log', 'info', 'warn', 'error', 'debug', 'trace']) console[method] = () => {};

parentPort.on('message', async ({ text, bytes, output }) => {
  try {
    const asBytes = bytes !== undefined;
    const doc = asBytes ? await openIfcBytes(bytes) : await openIfc(text);
    const summary = doc.schedule();
    if (output !== 'ifc') {
      parentPort.postMessage({ ok: true, summary });
    } else if (!asBytes) {
      parentPort.postMessage({ ok: true, ifc: doc.toIfc() });
    } else {
      const ifcBytes = await doc.toIfcBytes();
      parentPort.postMessage({ ok: true, ifcBytes }, [ifcBytes.buffer]);
    }
  } catch (err) {
    if (err instanceof PlannerCoreError) {
      parentPort.postMessage({ ok: false, code: err.code, message: err.message, details: { ...err.details } });
    } else {
      parentPort.postMessage({ ok: false, code: 'INTERNAL', message: 'Internal error during the calculation' });
    }
  }
});

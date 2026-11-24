// Rekenworker van de headless API (zie server.mjs). Eén bericht = één IFC doorrekenen met het
// gebouwde pakket; het antwoord is altijd `{ ok: true, … }` of `{ ok: false, code, message, details? }`.
// Loopt in een eigen thread, zodat de server bij een timeout de worker kan beëindigen.
import { parentPort } from 'node:worker_threads';
import { openIfc, openIfcBytes, planningDifference, PlannerCoreError } from '@openaec/open-planner-core';

// De kern logt soms id's of namen uit het bestand (bijv. een relatie-id bij een te grote
// samenvattingsrelatie). Die horen niet in de serverlogs: console hier stil, en de server gooit
// de stdout/stderr van deze worker bovendien weg (server.mjs, `Calculator`).
for (const method of ['log', 'info', 'warn', 'error', 'debug', 'trace']) console[method] = () => {};

parentPort.on('message', async ({ text, bytes, output }) => {
  let doc;
  let summary;
  try {
    doc = await openIfc(text ?? Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('utf8'));
    summary = doc.schedule();
    parentPort.postMessage(output === 'ifc' ? { ok: true, ifc: doc.toIfc() } : { ok: true, summary: withoutForeignContent(summary) });
  } catch (err) {
    if (err instanceof PlannerCoreError) {
      const mainAnswer = { ok: false, code: err.code, message: err.message, details: { ...err.details } };
      const refusedModel = err.readRefusal === 'building-model';
      const refusedForeign = output === 'ifc' && err.code === 'IFC_WRITE_FAILED' && err.details.reason === 'foreign';
      if (bytes !== undefined && (refusedModel || refusedForeign)) {
        parentPort.postMessage({ ...mainAnswer, provisional: true });
        const preserved = await viaBytesRoute(bytes, output, refusedModel ? null : { doc, summary });
        if (preserved?.summary) return parentPort.postMessage({ ok: true, summary: preserved.summary });
        if (preserved?.ifcBytes) return parentPort.postMessage({ ok: true, ifcBytes: preserved.ifcBytes }, [preserved.ifcBytes.buffer]);
      }
      parentPort.postMessage(mainAnswer);
    } else {
      parentPort.postMessage({ ok: false, code: 'INTERNAL', message: 'Internal error during the calculation' });
    }
  }
});

function withoutForeignContent({ foreignContent, ...summary }) {
  return summary;
}

async function viaBytesRoute(bytes, output, textReading) {
  try {
    const doc = await openIfcBytes(bytes);
    const summary = doc.schedule();
    if (summary.foreignContent === null) return null;
    if (textReading && (!sameSummary(textReading.summary, summary) || planningDifference(textReading.doc, doc) !== null)) return null;
    return output === 'ifc' ? { ifcBytes: await doc.toIfcBytes() } : { summary };
  } catch {
    return null;
  }
}

function sameSummary(text, bytes) {
  return JSON.stringify({ ...text, foreignContent: null }) === JSON.stringify({ ...bytes, foreignContent: null });
}

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
  let summary;
  try {
    const doc = await openIfc(text ?? Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('utf8'));
    summary = doc.schedule();
    const bytesSummary = bytes !== undefined && output !== 'ifc' ? (await openIfcBytes(bytes)).schedule() : null;
    parentPort.postMessage(output === 'ifc' ? { ok: true, ifc: doc.toIfc() } : { ok: true, summary: bytesSummary?.foreignContent ? bytesSummary : summary });
  } catch (err) {
    if (err instanceof PlannerCoreError) {
      const preserved = keepsForeignContent(err, bytes, output) ? await preservedOrWhyNot(bytes, summary) : {};
      if (preserved.ifcBytes) return parentPort.postMessage({ ok: true, ifcBytes: preserved.ifcBytes }, [preserved.ifcBytes.buffer]);
      const message = preserved.whyNot ? `${err.message} The preserved bytes are not returned: ${preserved.whyNot}.` : err.message;
      parentPort.postMessage({ ok: false, code: err.code, message, details: { ...err.details } });
    } else {
      parentPort.postMessage({ ok: false, code: 'INTERNAL', message: 'Internal error during the calculation' });
    }
  }
});

function keepsForeignContent(err, bytes, output) {
  return bytes !== undefined && output === 'ifc' && err.code === 'IFC_WRITE_FAILED' && err.details?.reason === 'foreign';
}

async function preservedOrWhyNot(bytes, textSummary) {
  try {
    const doc = await openIfcBytes(bytes);
    const summary = doc.schedule();
    if (summary.foreignContent === null) return {};
    const differences = scheduleDifferences(textSummary, summary);
    if (differences.length > 0) return { whyNot: `the bytes route reads this file differently (${differences.join(', ')})` };
    return { ifcBytes: await doc.toIfcBytes() };
  } catch (err) {
    return { whyNot: err instanceof PlannerCoreError ? err.message : 'the bytes route failed' };
  }
}

function scheduleDifferences(text, bytes) {
  const differs = (a, b) => JSON.stringify(a) !== JSON.stringify(b);
  return Object.keys(text).filter(key => key !== 'foreignContent' && differs(text[key], bytes[key]))
    .flatMap(key => key === 'project' || key === 'counts'
      ? Object.keys(text[key]).filter(field => differs(text[key][field], bytes[key][field])).map(field => `${key}.${field}`)
      : [key]);
}

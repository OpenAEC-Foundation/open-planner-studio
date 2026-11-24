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
      const fallback = bytes === undefined ? null
        : err.readRefusal === 'building-model' ? await viaBytesRoute(bytes, output)
        : output === 'ifc' && err.code === 'IFC_WRITE_FAILED' && err.details.reason === 'foreign' ? await viaBytesRoute(bytes, output, { doc, summary })
        : null;
      if (fallback?.summary) return parentPort.postMessage({ ok: true, summary: fallback.summary });
      if (fallback?.ifcBytes) return parentPort.postMessage({ ok: true, ifcBytes: fallback.ifcBytes }, [fallback.ifcBytes.buffer]);
      const message = fallback?.differences
        ? `${err.message} The preserved bytes are not returned: the bytes route reads this file differently (${fallback.differences.join(', ')}).`
        : err.message;
      parentPort.postMessage({ ok: false, code: err.code, message, details: { ...err.details } });
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
    if (textReading) {
      const differences = [...scheduleDifferences(textReading.summary, summary), planningDifference(textReading.doc, doc)].filter(Boolean);
      if (differences.length > 0) return { differences };
    }
    return output === 'ifc' ? { ifcBytes: await doc.toIfcBytes() } : { summary };
  } catch {
    return null;
  }
}

function scheduleDifferences(text, bytes) {
  const differs = (a, b) => JSON.stringify(a) !== JSON.stringify(b);
  return Object.keys(text).filter(key => key !== 'foreignContent' && differs(text[key], bytes[key]))
    .flatMap(key => key === 'project' || key === 'counts'
      ? Object.keys(text[key]).filter(field => differs(text[key][field], bytes[key][field])).map(field => `${key}.${field}`)
      : [key]);
}

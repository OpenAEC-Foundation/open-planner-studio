// Uitsluitend voor de begrensde CI-meting: dezelfde echte store-route op twee exacte commits.
// Tijdmetingen zijn bewijsmateriaal; gelijkheid van invoer/uitvoer en undo zijn de poorten.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { performance } from 'node:perf_hooks';
import { createAppStoreContext, type AppState } from '@/state/appStoreFactory';
import { createRecognitionFixture, installRecognitionFixture, legacyRecognition } from './recognition-fixture';

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function documentItems(s: AppState) {
  return { resources: s.resources, calendars: s.calendars, calendar: s.calendar };
}

function measureRecognition(s: AppState, expectedHash: string): number[] {
  // Eén opwarmronde; volledige aanroep, inclusief indexbouw en alle voorstelobjecten.
  assert.equal(hash(s.computeRecognition()), expectedHash);
  return Array.from({ length: 5 }, () => {
    const start = performance.now();
    const candidates = s.computeRecognition();
    const duration = performance.now() - start;
    assert.equal(hash(candidates), expectedHash);
    return duration;
  });
}

const revision = process.env.OPS_RECOGNITION_REVISION;
const variant = process.env.OPS_RECOGNITION_VARIANT;
const outputPath = process.argv[2];
assert(revision && /^[a-f0-9]{40}$/.test(revision), 'Een exacte broncommit is verplicht');
assert(variant === 'base' || variant === 'head', 'Basis/head is verplicht');
assert(outputPath, 'Een uitvoerbestand is verplicht');

const cases = [1000, 5000].map(size => {
  const fixture = createRecognitionFixture(size);
  const inputHash = hash(fixture);
  const { store } = createAppStoreContext({ emitHostEvents: false });
  installRecognitionFixture(store, fixture);
  const initialState = store.getState();
  const initialItemsHash = hash(documentItems(initialState));
  const expected = legacyRecognition(initialState);
  const proposalHash = hash(expected);
  const samplesMs = measureRecognition(initialState, proposalHash);
  assert.equal(store.getState(), initialState, 'Herkenning moet de store ongemoeid laten');

  // Vier echte bevestigingen, verdeeld over beide itemsoorten; de hele voorsteluitvoer is hierboven
  // vergeleken. Koppelen zelf is geen onderdeel van de gemeten optimalisatie.
  const links = expected.flatMap(c => c.suggestedPoolId !== null && /^project-[rc]-[01]$/.test(c.projectId)
    ? [{ kind: c.kind, projectId: c.projectId, poolId: c.suggestedPoolId }] : []);
  assert.equal(links.length, 4);
  store.getState().linkRecognizedItems(links);
  const linked = store.getState();
  assert.equal(linked.resources[0].libraryOrigin?.libraryItemId, 'pool-r-0');
  assert.equal(linked.resources[0].costPerHour, 50);
  assert.equal(linked.resources[0].maxUnits, 1);
  assert.equal(linked.calendars[0].libraryOrigin?.libraryItemId, 'pool-c-0');
  assert.equal(linked.calendars[0].workStartHour, 7);
  assert.equal(linked.historyEvents.filter(e => e.state === 'applied').length, 1);
  const linkedItemsHash = hash(documentItems(linked));
  const linkedProposalHash = hash(linked.computeRecognition());
  store.getState().undo();
  const undoItemsHash = hash(documentItems(store.getState()));
  assert.equal(undoItemsHash, initialItemsHash, 'Undo moet alle itemvelden en de kalendercache herstellen');
  assert.equal(hash(store.getState().computeRecognition()), proposalHash, 'Undo moet het hele voorstel herstellen');

  store.setState(s => {
    for (const items of [s.resources, s.calendars]) {
      for (const item of items) item.libraryOrigin = { companyId: 'vreemd', libraryItemId: 'bestaand', poolVersion: 1 };
    }
  });
  const stampedSamplesMs = measureRecognition(store.getState(), hash([]));
  return {
    sizePerKind: size, inputHash, initialItemsHash, proposalCount: expected.length, proposalHash,
    linkedItemsHash, linkedProposalHash, undoItemsHash, samplesMs, stampedSamplesMs,
  };
});

writeFileSync(outputPath, JSON.stringify({
  revision, variant, node: process.version, platform: process.platform, arch: process.arch,
  cpu: cpus()[0]?.model, cases,
}, null, 2) + '\n');
console.log(`${variant} ${revision}: beide groottes, volledige voorstellen en toepassen/undo geslaagd (exit 0)`);

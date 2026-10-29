// Corpusvrije dekking van het testcontract voor knownbugs 175 (MPP-corpus) en 181.
// Geen omgevingscorpus of schijf-fixtures: scopekeuze is puur, MPP-bytes zijn synthetisch.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { MppUnsupportedError } from '@/services/mpp/errors';
import { readMPP } from '@/services/mpp/mppReader';
import { readMppCorpusEntry, resolveMppCrawlScopes } from './mppCorpus';
import {
  buildNestedCfb, encodeCompObjFileFormat, encodePropsEntries, minimalMpp14Bytes,
} from './mppFixtures';

const diffs: string[] = [];
let checks = 0;
function check(label: string, run: () => void): void {
  checks++;
  try { run(); } catch (err) {
    diffs.push(`${label}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

const defaultRoot = '/home/nozzit/open-aec/voor claude/testdata-crawl';
check('geen configuratie: historische brede root en rooktestsubmap', () => {
  assert.deepEqual(resolveMppCrawlScopes({}), {
    root: defaultRoot, smoke: join(defaultRoot, 'crawl-mpp'),
  });
});
for (const root of ['/corpus/testdata-crawl', '/niet-aanwezig', '/pad met spaties/crawl/']) {
  check(`rootoverride ${root}: rooktestscope volgt de root`, () => {
    const env = Object.freeze({ OPS_MPP_CRAWL: root });
    assert.deepEqual(resolveMppCrawlScopes(env), { root, smoke: join(root, 'crawl-mpp') });
  });
}
check('alleen rooktestoverride: brede F4-root blijft op het standaardpad', () => {
  assert.deepEqual(resolveMppCrawlScopes({ OPS_MPP_CRAWL_SMOKE: '/losse/rooktestset' }), {
    root: defaultRoot, smoke: '/losse/rooktestset',
  });
});
check('beide overrides: onafhankelijke scopes, geen extra submap onder de rooktestoverride', () => {
  assert.deepEqual(resolveMppCrawlScopes({
    OPS_MPP_CRAWL: '/brede/root', OPS_MPP_CRAWL_SMOKE: '/andere/map',
  }), { root: '/brede/root', smoke: '/andere/map' });
});
check('oude directe submapoverride wordt niet op mapnaam stilzwijgend gerepareerd', () => {
  assert.deepEqual(resolveMppCrawlScopes({ OPS_MPP_CRAWL: '/data/crawl-mpp' }), {
    root: '/data/crawl-mpp', smoke: join('/data/crawl-mpp', 'crawl-mpp'),
  });
});
check('migratie van oude submapoverride: brede root plus exact dezelfde rooktestmap', () => {
  assert.deepEqual(resolveMppCrawlScopes({
    OPS_MPP_CRAWL: '/data', OPS_MPP_CRAWL_SMOKE: '/data/crawl-mpp',
  }), { root: '/data', smoke: '/data/crawl-mpp' });
});

function container(fileFormat: string, props = encodePropsEntries([])): Uint8Array {
  return buildNestedCfb({
    '\x01CompObj': { data: encodeCompObjFileFormat(fileFormat) },
    Props14: { data: props },
  });
}
const supported = minimalMpp14Bytes({ startDays: 15000, finishDays: 15002, projectStartDays: 15000 });
check('echte readMPP met MPP14 blijft ondersteund en levert de fixturetaak', () => {
  const entry = readMppCorpusEntry(supported, readMPP);
  assert.equal(entry.kind, 'supported');
  if (entry.kind === 'supported') {
    assert.equal(entry.value.tasks.length, 1);
    assert.equal(entry.value.tasks[0].name, 'B');
  }
});
check('ondersteund resultaat wordt zonder vervanging doorgegeven', () => {
  const value = { tasks: ['behouden'] };
  assert.deepEqual(readMppCorpusEntry(supported, () => value), { kind: 'supported', value });
  const entry = readMppCorpusEntry(supported, () => value);
  assert.ok(entry.kind === 'supported' && entry.value === value);
});

for (const variant of ['MPP8', 'MPP9', 'MPP12'] as const) {
  const bytes = container(`MSProject.${variant}`);
  check(`${variant}: echte readMPP weigert met de verwachte versieclassificatie`, () => {
    assert.deepEqual(readMppCorpusEntry(bytes, readMPP), { kind: 'legacy', variant });
  });
  check(`${variant}: een onverwacht accepterende lezer is een regressie`, () => {
    assert.throws(() => readMppCorpusEntry(bytes, () => ({ tasks: [] })), /werd gelezen/);
  });
  for (const err of [
    new Error('willekeurige leesfout'),
    new MppUnsupportedError('MPP_ENCRYPTED', 'Versleuteld'),
    Object.assign(new Error('MPP_LEGACY'), { mppCode: 'MPP_LEGACY' }),
    { name: 'MppUnsupportedError', mppCode: 'MPP_LEGACY' },
    'MPP_LEGACY',
    null,
  ]) {
    check(`${variant}: alleen de echte getypeerde legacy-afwijzing telt als bewust geweigerd (${String(err)})`, () => {
      assert.throws(() => readMppCorpusEntry(bytes, () => { throw err; }), (actual: unknown) => actual === err);
    });
  }
}
for (const err of [
  new Error('leesregressie'),
  new MppUnsupportedError('MPP_LEGACY', 'Onterechte legacyclassificatie op MPP14'),
  new MppUnsupportedError('MPP_ENCRYPTED', 'Geen versieafwijzing'),
]) {
  check(`MPP14: iedere fout blijft fout, ook MPP_LEGACY (${err.name})`, () => {
    assert.throws(() => readMppCorpusEntry(supported, () => { throw err; }), (actual: unknown) => actual === err);
  });
}
check('versleuteld MPP14 wordt niet als legacy overgeslagen', () => {
  const encrypted = container('MSProject.MPP14', encodePropsEntries([
    { key: 893386752, data: Uint8Array.of(1) },
    { key: 893386756, data: new Uint8Array(16).fill(0xab) },
  ]));
  assert.throws(() => readMppCorpusEntry(encrypted, readMPP),
    (err: unknown) => err instanceof MppUnsupportedError && err.mppCode === 'MPP_ENCRYPTED');
});
check('MPP14 met ontbrekende taakstreams blijft een structurele fout', () => {
  const incomplete = buildNestedCfb({
    '\x01CompObj': { data: encodeCompObjFileFormat('MSProject.MPP14') },
    Props14: { data: encodePropsEntries([]) },
    '   114': { children: { Props: { data: encodePropsEntries([]) } } },
  });
  assert.throws(() => readMppCorpusEntry(incomplete, readMPP),
    (err: unknown) => err instanceof Error && !(err instanceof MppUnsupportedError));
});
for (const bytes of [new Uint8Array(8), container('MSProject.MPP4')]) {
  check('kapot CFB of onbekende variant wordt nooit vrijgesteld, ook niet bij een legacyfout van de lezer', () => {
    let called = false;
    assert.throws(() => readMppCorpusEntry(bytes, () => {
      called = true;
      throw new MppUnsupportedError('MPP_LEGACY', 'Mag niet bereikt worden');
    }));
    assert.equal(called, false);
  });
}

if (diffs.length === 0) {
  console.log(`OK  mpp-corpus-contract: alle ${checks} corpusvrije checks groen`);
  process.exit(0);
}
console.log(`XX  mpp-corpus-contract: ${diffs.length} afwijking(en) van ${checks}`);
for (const diff of diffs) console.log(`   - ${diff}`);
process.exit(1);

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { IfcxReadError } from '@/services/ifc/ifcx/ifcxErrors';
import { readIfcxModelSource } from '@/services/ifc/ifcx/modelSource';

function fixture(name: string): Buffer {
  return readFileSync(new URL(`../fixtures/ifcx/extern/${name}.ifcx`, import.meta.url));
}

await test('Een externe modelkop en twee exacte productpaden zonder geometrie of planning', async () => {
  const source = await readIfcxModelSource(fixture('gevel'));
  assert.deepEqual(source.header, { id: 'urn:voorbeeld:atelier:gevel', author: 'Atelier Gevel' });
  assert.deepEqual(Object.fromEntries(source.elements), {
    'Gevel/West': { ifcClass: 'IfcWall', name: 'Buitenmuur' },
    'Gevel/west': { ifcClass: 'IfcWindow' },
  });
});

await test('De laatste lokale waarde van elk attribuut bepaalt klasse en naam', async () => {
  const source = await readIfcxModelSource(fixture('bijdragen'));
  assert.deepEqual(Object.fromEntries(source.elements), {
    Kozijn: { ifcClass: 'IfcWindowType', name: 'Kozijn café' },
    Latei: { ifcClass: 'IfcBeam', name: 'Boven het kozijn' },
  });
});

await test('Bij een import telt alleen het lokaal geclassificeerde dak', async () => {
  const source = await readIfcxModelSource(fixture('met-import'));
  assert.deepEqual(Object.fromEntries(source.elements), {
    'Aanbouw/Dak': { ifcClass: 'IfcRoof', name: 'Nieuw dak' },
  });
});

await test('Een taak, resource en los label leveren samen een geldige lege index', async () => {
  const source = await readIfcxModelSource(fixture('zonder-bouwdelen'));
  assert.equal(source.elements.size, 0);
});

await test('Eén gewijzigde spatie geeft een andere SHA-256 en dezelfde index', async () => {
  const bytes = fixture('gevel');
  const original = await readIfcxModelSource(bytes);
  assert.equal(original.sha256, createHash('sha256').update(bytes).digest('hex'));
  const space = bytes.indexOf(0x20);
  assert.ok(space >= 0);
  bytes[space] = 0x09;
  const changed = await readIfcxModelSource(bytes);
  assert.equal(changed.sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.notEqual(changed.sha256, original.sha256);
  assert.deepEqual(changed.elements, original.elements);
});

await test('Ook de UTF-8-BOM hoort bij de oorspronkelijke modelbytes', async () => {
  const bytes = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), fixture('gevel')]);
  const source = await readIfcxModelSource(bytes);
  assert.equal(source.sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.deepEqual(source.elements, (await readIfcxModelSource(fixture('gevel'))).elements);
});

function readError(code: IfcxReadError['code'], reason: RegExp) {
  return (error: unknown) => error instanceof IfcxReadError && error.code === code && reason.test(error.message);
}

await test('Ongeldige UTF-8 midden in een geldige JSON-waarde wordt geweigerd', async () => {
  const bytes = fixture('gevel');
  const label = bytes.indexOf('Buitenmuur');
  assert.ok(label >= 0);
  bytes[label] = 0xff;
  await assert.rejects(readIfcxModelSource(bytes), readError('not-ifcx', /UTF-8/));
});

await test('Ongeldige JSON wordt geweigerd', async () => {
  await assert.rejects(readIfcxModelSource(Buffer.from('{')), readError('not-ifcx', /JSON/));
});

await test('JSON zonder IFCX-kop of zonder data wordt geweigerd', async () => {
  for (const value of [{ data: [] }, { header: { ifcxVersion: 'ifcx_alpha' } }]) {
    await assert.rejects(readIfcxModelSource(Buffer.from(JSON.stringify(value))), readError('not-ifcx', /IFCX/));
  }
});

await test('Een onbekende IFCX-versie heeft de bestaande versiecode', async () => {
  const text = fixture('gevel').toString('utf8').replace('ifcx_alpha', 'ifcx_beta');
  await assert.rejects(readIfcxModelSource(Buffer.from(text)), readError('version', /ifcx_beta/));
});

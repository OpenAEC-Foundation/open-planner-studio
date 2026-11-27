import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readIfcx, writeIfcx, classifyIfcx, IfcxReadError, IfcxWriteRefusedError } from '@/services/ifc/ifcx';
import type { TaskElementLinks } from '@/services/ifc/foreign/elementLinks';
import { selfCheckDifferences } from '@/services/ifc/ifcx/selfCheck';
import { CLOCK, documentOf, encode } from './ifcxProof';

const dir = join(import.meta.dirname, '../fixtures/ifcx/eigen');
const base = readIfcx(readFileSync(join(dir, 'datumgevallen.ifcx')));
const modelSource = { fileName: 'model.ifcx', sha256: 'aae60d0a5231fba6b5e4fb5b151b0e87ced8e0b5e06ef5725d2db3c1b526fc04' };
const id = base.tasks[0].id;
const wall = 'e671b834-a918-42c4-9901-000000000001';
const windowPath = '/gevel/Raam-02';
const links: TaskElementLinks = new Map([[id, [
  { direction: 'output', target: wall, found: true },
  { direction: 'output', target: windowPath, found: false },
]]]);
const text = writeIfcx({ ...base, modelSource, elementLinks: links }, CLOCK);
const version = (file: string) => documentOf(file).data[0].attributes['openaec::ops::document'].formatVersion;
assert.equal(version(text), '1.2.0');
const back = readIfcx(encode(text));
assert.deepEqual(back.modelSource, modelSource);
const unchecked = new Map([[id, [wall, windowPath].map(target => ({ direction: 'output' as const, target, found: false }))]]);
assert.deepEqual(back.elementLinks, unchecked);
assert.equal(writeIfcx(back, CLOCK), text);
const disk = documentOf(text);
assert.deepEqual(disk.imports, []);
assert.equal(disk.header.ifcxVersion, 'ifcx_alpha');
assert.equal(disk.header.dataVersion, '1.0.0');
const sourceAttr = 'openaec::ops::modelSource', linkAttr = 'openaec::links';
const activity = disk.data.find(entry => entry.attributes['openaec::ops::task']?.id === id)!;
assert.deepEqual(activity.attributes[linkAttr], [wall, windowPath].map(target => ({ relation: 'schedules', target })));
assert.deepEqual(disk.schemas[sourceAttr], { value: { dataType: 'Object', objectRestrictions: {
  values: { fileName: { dataType: 'String' }, sha256: { dataType: 'String' } },
} } });
assert.deepEqual(disk.schemas[linkAttr], { value: { dataType: 'Array', arrayRestrictions: { value: {
  dataType: 'Object', objectRestrictions: { values: { relation: { dataType: 'String' }, target: { dataType: 'Reference' } } },
} } } });
const fixture = join(dir, 'planning-met-model.ifcx');
if (process.env.OPS_IFCX_FIXTURES_WRITE === '1') writeFileSync(fixture, text);
assert.equal(readFileSync(fixture, 'utf8'), text);

function refused(file: string, code: IfcxReadError['code'], field?: string) {
  assert.throws(() => readIfcx(encode(file)), error =>
    error instanceof IfcxReadError && error.code === code && (!field || error.place.field === field));
}
function changed(file: string, before: string, after: string) {
  assert.ok(file.includes(before), before);
  return file.replace(before, after);
}
const older = writeIfcx(base, CLOCK);
assert.equal(version(older), '1.0.0');
const sourceOnly = writeIfcx({ ...base, modelSource }, CLOCK);
const linksOnly = writeIfcx({ ...base, elementLinks: links }, CLOCK);
for (const file of [sourceOnly, linksOnly]) {
  assert.equal(version(file), '1.2.0');
  assert.equal(writeIfcx(readIfcx(encode(file)), CLOCK), file);
  for (const old of ['1.0.0', '1.1.0']) refused(changed(file, '"formatVersion":"1.2.0"', '"formatVersion":"' + old + '"'), 'invalid');
}
assert.equal(documentOf(sourceOnly).schemas[linkAttr], undefined);
assert.equal(documentOf(linksOnly).schemas[sourceAttr], undefined);
assert.equal(writeIfcx({ ...base, elementLinks: new Map([[id, []]]) }, CLOCK), older);
const afterRemoval = {
  ...base, tasks: base.tasks.filter(task => task.id !== id),
  sequences: base.sequences.filter(sequence => sequence.predecessorId !== id && sequence.successorId !== id),
};
assert.equal(writeIfcx({ ...afterRemoval, elementLinks: links }, CLOCK), writeIfcx(afterRemoval, CLOCK));
refused(changed(older, '"formatVersion":"1.0.0"', '"formatVersion":"1.2.0"'), 'invalid');
const canada = { ...base, calendar: { ...base.calendar, generation: {
  ruleSetId: 'CA' as const, region: 'QC', generatedFromYear: 2029, generatedToYear: 2029,
} } };
const canadaText = writeIfcx(canada, CLOCK);
const canadaModel = writeIfcx({ ...canada, modelSource }, CLOCK);
assert.equal(version(canadaText), '1.1.0');
assert.equal(version(canadaModel), '1.2.0');
assert.deepEqual(documentOf(canadaModel).schemas['openaec::ops::calendar'], documentOf(canadaText).schemas['openaec::ops::calendar']);
assert.notDeepEqual(documentOf(canadaModel).schemas['openaec::ops::calendar'], disk.schemas['openaec::ops::calendar']);
assert.equal(writeIfcx(readIfcx(encode(canadaModel)), CLOCK), canadaModel);

for (const fileName of ['', '../model.ifcx', 'map/model.ifcx', 'map\\model.ifcx', 'C:model.ifcx',
  'https://voorbeeld.test/model.ifcx', 'file:model.ifcx', 'model.ifc', 'mod\nel.ifcx', 'model.ifcx\n']) {
  const source = { ...modelSource, fileName };
  refused(changed(text, JSON.stringify(modelSource), JSON.stringify(source)), 'invalid', 'fileName');
  assert.throws(() => writeIfcx({ ...base, modelSource: source }, CLOCK), IfcxWriteRefusedError);
}
const mixedCase = { ...modelSource, fileName: 'Bouwdeel A.IfCx' };
assert.deepEqual(readIfcx(encode(writeIfcx({ ...base, modelSource: mixedCase }, CLOCK))).modelSource, mixedCase);
assert.equal(writeIfcx({ ...base, modelSource: { sha256: modelSource.sha256, fileName: modelSource.fileName } }, CLOCK), sourceOnly);
for (const sha256 of ['a'.repeat(63), 'a'.repeat(65), 'G'.repeat(64), modelSource.sha256.toUpperCase()]) {
  const source = { ...modelSource, sha256 };
  refused(changed(text, JSON.stringify(modelSource), JSON.stringify(source)), 'invalid', 'sha256');
  assert.throws(() => writeIfcx({ ...base, modelSource: source }, CLOCK), IfcxWriteRefusedError);
}
const extra = { ...modelSource, localPath: 'map/model.ifcx' };
refused(changed(text, JSON.stringify(modelSource), JSON.stringify(extra)), 'newer-profile', 'localPath');
assert.throws(() => writeIfcx({ ...base, modelSource: extra }, CLOCK), IfcxWriteRefusedError);
for (const target of ['', '/', 'map\\raam', 'https://voorbeeld.test/model.ifcx', 'raam\u0000']) {
  refused(changed(text, JSON.stringify(windowPath), JSON.stringify(target)), 'invalid', '[1].target');
  assert.throws(() => writeIfcx({ ...base, elementLinks: new Map([[id, [{ direction: 'output', found: false, target }]]]) }, CLOCK), IfcxWriteRefusedError);
}
refused(changed(text, '"relation":"schedules"', '"relation":"onbekend"'), 'invalid', '[0].relation');
assert.throws(() => writeIfcx({ ...base, elementLinks: new Map([[id, [{ direction: 'input', found: true, target: wall }]]]) }, CLOCK),
  error => error instanceof IfcxWriteRefusedError && error.code === 'unsupported');
const calendarPath = disk.data[0].attributes['openaec::ops::document'].calendar;
for (const target of [wall, windowPath]) {
  refused(text.split('"calendar":' + JSON.stringify(calendarPath)).join('"calendar":' + JSON.stringify(target)), 'invalid', 'calendar');
}
for (const [attribute, to] of [[sourceAttr, activity.path], [linkAttr, disk.data[0].path]]) {
  const wrongNode = documentOf(text);
  const from = wrongNode.data.find(entry => attribute in entry.attributes)!;
  wrongNode.data.find(entry => entry.path === to)!.attributes[attribute] = from.attributes[attribute];
  delete from.attributes[attribute];
  refused(JSON.stringify(wrongNode), 'foreign');
}
refused(changed(text, '"' + sourceAttr + '":{', '"openaec::ops::toekomst":{}, "' + sourceAttr + '":{'), 'newer-profile');
for (const newer of ['1.3.0', '1.9.0', '2.0.0']) {
  const file = changed(text, '"formatVersion":"1.2.0"', '"formatVersion":"' + newer + '"');
  for (const future of [file, changed(file, '"imports": []', '"imports": [{}]'), changed(file, '"relation":"schedules"', '"relation":0')]) {
    refused(future, 'newer-profile');
    assert.equal(classifyIfcx(encode(future)), 'unreadable');
  }
}
for (const version of ['1.3', '1.02.0', '1.2.1']) {
  refused(changed(older, '"formatVersion":"1.0.0"', '"formatVersion":"' + version + '"'), 'invalid');
}
const noVersion = changed(older, '"formatVersion":"1.0.0",', '');
refused(noVersion, 'invalid');
refused(changed(noVersion, '"imports": []', '"imports": [{}]'), 'foreign');
const futureWorkplan = documentOf(changed(older, '"formatVersion":"1.0.0"', '"formatVersion":"1.3.0"'));
const workplan = futureWorkplan.data[0];
const duplicate = { path: workplan.path, attributes: { 'openaec::ops::document': workplan.attributes['openaec::ops::document'] } };
refused(JSON.stringify({ ...futureWorkplan, data: [...futureWorkplan.data, duplicate] }), 'foreign');
const foreign = { path: '/ander-programma', attributes: duplicate.attributes };
refused(JSON.stringify({ ...futureWorkplan, data: [foreign, ...futureWorkplan.data.slice(1)] }), 'foreign');
refused(JSON.stringify({ ...futureWorkplan, data: [duplicate, ...futureWorkplan.data.slice(1)] }), 'foreign');
assert.ok(selfCheckDifferences(back, { ...back, modelSource: mixedCase }).some(path => path.startsWith('modelSource.fileName:')));
assert.ok(selfCheckDifferences(back, { ...back, elementLinks: undefined }).some(path => path.startsWith('elementLinks:')));
console.log('IFCX 1.2.0: bron, externe koppelingen, versie, weigeringen en bytegetrouwe rondgang geslaagd');

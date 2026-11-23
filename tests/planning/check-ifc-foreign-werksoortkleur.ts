// Issue #856 (besluit 21 november 2026) op de route voor IFC met vreemde inhoud (#804, flag `ifcForeignContent`):
// de kleur van een eigen werksoort staat in `OPS_TaskTypes` (veld `color` per definitie), en de writer schrijft haar
// altijd. Een eigen bestand van vóór dat veld, met een vreemd deel, opent zoals eerst en krijgt bij openen een vaste
// kleur; de verliescontrole telt die kleur als de enige toevoeging (`sameTaskTypes` en `explainOwnMapGrowth` in
// `lossCheck.ts`). Opslaan moet dan gewoon kunnen, met en zonder bewerking van de werksoorten; het vreemde deel blijft
// byte voor byte, de uitvoer draagt de kleur, en heropenen geeft dezelfde kleuren. Een bestand met het veld houdt precies
// die kleur, ook als het de kleur is die het lezen zelf zou afleiden.
import assert from 'node:assert/strict';
import {
  applyEdit, cloneDomain, fixedCatalogEdits, mergeProblems, openForeign, ordinaryEdits, plannerEdits, savedCatalogStart,
  type Domain, type EditKind, type Opened,
} from './ifcMergeKern';
import { asciiJson } from '@/services/ifc/ifcPsets';
import { SOURCES, bytesOf, clock, finish, idsAt, latin1, ok, read, save, se, summary, withWall } from './ifcEigenKern';

const colorsOf = (d: Domain) => Object.fromEntries((d.customTaskTypes ?? []).map(t => [t.id, t.color]).sort(([a], [b]) => (a < b ? -1 : 1)));
const withoutColorField = (b: Uint8Array) => bytesOf(latin1(b).replace(/,"color":"#[0-9A-Fa-f]{6}"/g, ''));

// Drie bronnen uit hetzelfde eigen bestand met twee werksoorten en een wand van een ander programma:
// - `standard`: zoals de writer van nu schrijft, met de kleuren die het lezen ook zelf zou afleiden;
// - `old`: dezelfde zonder kleurveld, de vorm van vóór het veld;
// - `custom`: met bewaarde kleuren die het lezen nooit zelf afleidt.
const standard = await savedCatalogStart(SOURCES.eigen);
ok('bron van nu: elke werksoort draagt haar kleur', (latin1(standard).match(/"color":"#/g) ?? []).length === 2);
const old = withoutColorField(standard);
ok('oude bron: geen kleurveld', !latin1(old).includes('"color"'));
const custom = bytesOf(latin1(standard).replace(/("name":"Type 0 7d","color":)"#[0-9A-Fa-f]{6}"/, '$1"#123456"')
  .replace(/("name":"Type 1 7d","color":)"#[0-9A-Fa-f]{6}"/, '$1"#654321"'));
ok('bron met eigen kleuren: beide kleuren staan erin', latin1(custom).includes('"color":"#123456"') && latin1(custom).includes('"color":"#654321"'));
// De echte oude writer (een fixture van vóór het veld), met een wand.
const oldWriter = withWall(read('tests/planning/fixtures/ifc-arity-oude-writer.ifc'));
const taskTypesLine = (b: Uint8Array) => /'TaskTypes',\$,IFCTEXT\([^\n]*/.exec(latin1(b))?.[0] ?? '';
ok('oude writer: definities zonder kleurveld', taskTypesLine(oldWriter).includes('"definitions":[{') && !taskTypesLine(oldWriter).includes('"color"'));

// Een naam met een niet-ASCII-teken: de writer schrijft het als `\u00e9` (`asciiJson`). Die vorm moet de verliescontrole
// als verliesloos herkennen.
const accented = bytesOf(latin1(old).replace('"name":"Type 0 7d"', '"name":"Sloop \\\\u00e9n afvoer"')
  .replace(/'Type 0 7d'/g,"'Sloop \\X2\\00E9\\X0\\n afvoer'")); // ook de typenaam op de taak (ObjectType)
ok('bron met accent: de naam staat er als JSON-escape', latin1(accented).includes('Sloop \\\\u00e9n afvoer'));
// Een dubbele sleutel in een definitie (een ander programma, of met de hand): de lezer houdt alleen de laatste naam. De
// aangevulde kleur mag die eerste naam nooit stil laten verdwijnen (review ronde 2 van optie 2, punt 1).
const doubled = bytesOf(latin1(old).replace('"name":"Type 0 7d"', '"name":"Oorspronkelijke naam","name":"Type 0 7d"'));
ok('bron met dubbele sleutel: beide namen staan erin', latin1(doubled).includes('"name":"Oorspronkelijke naam","name":"Type 0 7d"'));

/** Hoe de writer een JSON-waarde in de STEP-tekst zet: `asciiJson`, dan elke backslash verdubbeld. */
const stepJson = (value: unknown) => asciiJson(JSON.stringify(value)).replace(/\\/g, '\\\\');

let n = 1;
async function attempt(label: string, source: Uint8Array, edit: (d: Domain, o: Opened) => Promise<Domain> | Domain) {
  idsAt(++n * 50_000); clock.start();
  const opened = await openForeign(source);
  assert(opened.ifcSource?.foreign, `${label}: echte vreemde bytes-openroute`);
  const shown = colorsOf(opened);
  const d = await edit(cloneDomain(opened), opened);
  const o = await save(d, opened.ifcSource);
  console.log(`UITKOMST ${label}: ${summary(o)}`);
  ok(`${label}: schrijft`, o.ok, o.ok ? '' : `${o.kinds.join(',')}: ${o.detail}`);
  if (!o.ok) return;
  ok(`${label}: vreemd deel byte voor byte`, mergeProblems(source, o.bytes).length === 0, mergeProblems(source, o.bytes).slice(0, 2).join('; '));
  const reread = await openForeign(o.bytes);
  const expected = colorsOf(d);
  ok(`${label}: heropend dezelfde kleuren`, JSON.stringify(colorsOf(reread)) === JSON.stringify(expected),
    `${JSON.stringify(colorsOf(reread))} !== ${JSON.stringify(expected)}`);
  for (const [id, color] of Object.entries(shown)) {
    if (id in expected) ok(`${label}: ${id} houdt de kleur van het openen`, expected[id] === color);
  }
  const used = new Set(d.tasks.map(t => t.customTaskTypeId).filter(Boolean));
  const written = (d.customTaskTypes ?? []).filter(t => used.has(t.id));
  ok(`${label}: elke gebruikte werksoort staat met haar kleur in het bestand`,
    written.every(t => latin1(o.bytes).includes(stepJson({ id: t.id, name: t.name, color: t.color }))));
}

const beschrijving = se(s => { s.setProject({ description: 'Alleen de projectbeschrijving is gewijzigd' }); });
const nieuwType = (d: Domain) => applyEdit(fixedCatalogEdits(d)[1], d);
const wisselen = (d: Domain) => applyEdit(fixedCatalogEdits(d)[2], d);
const hernoemd = (d: Domain) => { d.customTaskTypes![0].name = 'Hernoemde werksoort'; return d; };
const ordinary = (kind: EditKind) => (d: Domain, o: Opened) => applyEdit([...plannerEdits(o, 1), ...ordinaryEdits(o)].find(e => e.kind === kind)!, d);

// Zelfde oude bestand twee keer openen: dezelfde, verschillende kleuren, ook zonder opslaan.
idsAt(++n * 50_000); clock.start();
const first = colorsOf(await openForeign(old));
ok('oude bron: twee eigen werksoorten met een kleur', Object.values(first).length === 2 && Object.values(first).every(Boolean));
ok('oude bron: elke keer openen dezelfde kleuren', JSON.stringify(colorsOf(await openForeign(old))) === JSON.stringify(first));
ok('oude bron: de kleuren zijn verschillend', new Set(Object.values(first)).size === 2);

for (const [name, source] of [['oude bron', old], ['bron van nu', standard], ['bron met eigen kleuren', custom]] as const) {
  await attempt(`${name}, niets aan de werksoorten`, source, beschrijving);
  await attempt(`${name}, nieuwe werksoort`, source, nieuwType);
  await attempt(`${name}, taak wisselt van werksoort`, source, wisselen);
  await attempt(`${name}, werksoort hernoemd`, source, hernoemd);
}
await attempt('bron met accent, nieuwe werksoort', accented, nieuwType);
await attempt('bron met accent, niets aan de werksoorten', accented, beschrijving);
for (const [label, edit] of [['niets aan de werksoorten', beschrijving], ['nieuwe werksoort', nieuwType]] as const) {
  idsAt(++n * 50_000); clock.start();
  const opened = await openForeign(doubled);
  const o = await save(await edit(cloneDomain(opened)), opened.ifcSource!);
  console.log(`UITKOMST bron met dubbele sleutel, ${label}: ${summary(o)}`);
  ok(`bron met dubbele sleutel, ${label}: weigert, of houdt de eerste naam`, !o.ok || latin1(o.bytes).includes('Oorspronkelijke naam'),
    o.ok ? 'geschreven zonder de eerste naam' : '');
}
for (const kind of ['relatie-erbij', 'taak-erbij', 'taak-wissen'] as const) {
  await attempt(`oude writer, ${kind}`, oldWriter, ordinary(kind));
}

idsAt(++n * 50_000); clock.start();
ok('bron met eigen kleuren: openen houdt precies de bewaarde kleur',
  JSON.stringify(Object.values(colorsOf(await openForeign(custom)))) === JSON.stringify(['#123456', '#654321']));

finish();

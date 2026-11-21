// Issue #856 (besluit 21 november 2026) op de route voor IFC met vreemde inhoud (#804, flag `ifcForeignContent`):
// de kleur van een eigen werksoort staat in `OPS_TaskTypes` (veld `color` per definitie). Een eigen bestand van vóór
// dat veld, met een vreemd deel, opent zoals eerst en krijgt bij openen een vaste kleur. Opslaan moet dan gewoon
// kunnen, met en zonder bewerking van de werksoorten; het vreemde deel blijft byte voor byte, en heropenen geeft
// dezelfde kleuren. Een bestand met het veld houdt precies die kleur. De writer schrijft het veld alleen als het lezen de
// kleuren anders niet terug zou geven (`taskTypeDefinitionsForFile`); zo blijft een oud bestand zonder bewerking van de
// werksoorten in de oude vorm, en blijft `OPS_TaskTypes` gedragen.
import assert from 'node:assert/strict';
import { applyEdit, cloneDomain, fixedCatalogEdits, mergeProblems, openForeign, savedCatalogStart, type Domain } from './ifcMergeKern';
import { SOURCES, bytesOf, clock, finish, idsAt, latin1, ok, save, se, summary } from './ifcEigenKern';

const colorsOf = (d: Domain) => Object.fromEntries((d.customTaskTypes ?? []).map(t => [t.id, t.color]).sort(([a], [b]) => (a < b ? -1 : 1)));

// De beginstand: twee werksoorten, op volgorde van id aangemaakt. Hun kleuren volgen dus uit het lezen, en de writer
// schrijft geen kleurveld: dit is precies de vorm van een bestand van vóór het veld.
const old = await savedCatalogStart(SOURCES.eigen);
ok('oude bron: geen kleurveld', !latin1(old).includes('"color"'));
// Dezelfde bron met bewaarde kleuren die het lezen niet zou afleiden.
const withColor = bytesOf(latin1(old)
  .replace('"name":"Type 0 7d"}', '"name":"Type 0 7d","color":"#123456"}')
  .replace('"name":"Type 1 7d"}', '"name":"Type 1 7d","color":"#654321"}'));
ok('bron met kleur: het veld staat in het bestand', latin1(withColor).includes('"color":"#123456"') && latin1(withColor).includes('"color":"#654321"'));

let n = 1;
async function attempt(label: string, source: Uint8Array, edit: (d: Domain) => Promise<Domain> | Domain) {
  idsAt(++n * 50_000); clock.start();
  const opened = await openForeign(source);
  assert(opened.ifcSource?.foreign, `${label}: echte vreemde bytes-openroute`);
  const shown = colorsOf(opened);
  const d = await edit(cloneDomain(opened));
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
  return o.bytes;
}

const beschrijving = se(s => { s.setProject({ description: 'Alleen de projectbeschrijving is gewijzigd' }); });
const nieuwType = (d: Domain) => applyEdit(fixedCatalogEdits(d)[1], d);
const wisselen = (d: Domain) => applyEdit(fixedCatalogEdits(d)[2], d);

// Zelfde bestand twee keer openen: dezelfde kleuren, ook zonder opslaan.
idsAt(++n * 50_000); clock.start();
const first = colorsOf(await openForeign(old));
ok('oude bron: twee eigen werksoorten met een kleur', Object.values(first).length === 2 && Object.values(first).every(Boolean));
ok('oude bron: elke keer openen dezelfde kleuren', JSON.stringify(colorsOf(await openForeign(old))) === JSON.stringify(first));
ok('oude bron: de kleuren zijn verschillend', new Set(Object.values(first)).size === 2);

const unchanged = await attempt('oude bron, niets aan de werksoorten', old, beschrijving);
if (unchanged) ok('oude bron, niets aan de werksoorten: de werksoorten blijven in de oude vorm', !latin1(unchanged).includes('"color"'));
await attempt('oude bron, nieuwe werksoort', old, nieuwType);
await attempt('oude bron, taak wisselt van werksoort', old, wisselen);
await attempt('oude bron, werksoort hernoemd', old, d => { d.customTaskTypes![0].name = 'Hernoemde werksoort'; return d; });
for (const [label, edit] of [['niets aan de werksoorten', beschrijving], ['nieuwe werksoort', nieuwType]] as const) {
  const out = await attempt(`bron met kleur, ${label}`, withColor, edit);
  if (out) ok(`bron met kleur, ${label}: de bewaarde kleuren staan er precies`, latin1(out).includes('"color":"#123456"') && latin1(out).includes('"color":"#654321"'));
}

idsAt(++n * 50_000); clock.start();
const exact = await openForeign(withColor);
ok('bron met kleur: openen houdt precies de bewaarde kleur', JSON.stringify(Object.values(colorsOf(exact))) === JSON.stringify(['#123456', '#654321']));

finish();

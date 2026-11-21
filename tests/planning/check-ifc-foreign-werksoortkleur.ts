// Issue #856 (besluit 21 november 2026) op de route voor IFC met vreemde inhoud (#804, flag `ifcForeignContent`):
// de kleur van een eigen werksoort staat in `OPS_TaskTypes` (veld `color` per definitie). Een eigen bestand van vóór
// dat veld, met een vreemd deel, opent zoals eerst en krijgt bij openen een vaste kleur. Opslaan moet dan gewoon
// kunnen, met en zonder bewerking van de werksoorten; het vreemde deel blijft byte voor byte, en heropenen geeft
// dezelfde kleuren. Een bestand met het veld houdt precies die kleur.
import assert from 'node:assert/strict';
import { applyEdit, cloneDomain, fixedCatalogEdits, mergeProblems, openForeign, savedCatalogStart, type Domain } from './ifcMergeKern';
import { SOURCES, bytesOf, clock, finish, idsAt, latin1, ok, save, se, summary } from './ifcEigenKern';

const colorsOf = (d: Domain) => Object.fromEntries((d.customTaskTypes ?? []).map(t => [t.id, t.color]));
const withoutColorField = (b: Uint8Array) => bytesOf(latin1(b).replace(/,"color":"#[0-9A-Fa-f]{6}"/g, ''));

const withColor = await savedCatalogStart(SOURCES.eigen);
ok('bron met kleur: het veld staat in het bestand', latin1(withColor).includes('"color":"#'));
const old = withoutColorField(withColor);
ok('oude bron: geen kleurveld meer', !latin1(old).includes('"color"'));

let n = 0;
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
  ok(`${label}: het bestand draagt nu de kleur`, latin1(o.bytes).includes('"color":"#'));
}

const beschrijving = se(s => { s.setProject({ description: 'Alleen de projectbeschrijving is gewijzigd' }); });
const nieuwType = (d: Domain) => applyEdit(fixedCatalogEdits(d)[1], d);
const wisselen = (d: Domain) => applyEdit(fixedCatalogEdits(d)[2], d);

// Zelfde bestand twee keer openen: dezelfde kleuren, ook zonder opslaan.
idsAt(0); clock.start();
const first = colorsOf(await openForeign(old));
ok('oude bron: twee eigen werksoorten met een kleur', Object.values(first).length === 2 && Object.values(first).every(Boolean));
ok('oude bron: elke keer openen dezelfde kleuren', JSON.stringify(colorsOf(await openForeign(old))) === JSON.stringify(first));
ok('oude bron: de kleuren zijn verschillend', new Set(Object.values(first)).size === 2);

await attempt('oude bron, niets aan de werksoorten', old, beschrijving);
await attempt('oude bron, nieuwe werksoort', old, nieuwType);
await attempt('oude bron, taak wisselt van werksoort', old, wisselen);
await attempt('oude bron, werksoort hernoemd', old, d => { d.customTaskTypes![0].name = 'Hernoemde werksoort'; return d; });
await attempt('bron met kleur, niets aan de werksoorten', withColor, beschrijving);
await attempt('bron met kleur, nieuwe werksoort', withColor, nieuwType);

idsAt(0); clock.start();
const exact = await openForeign(withColor);
ok('bron met kleur: openen houdt precies de bewaarde kleur',
  (exact.customTaskTypes ?? []).every(t => latin1(withColor).includes(`"id":"${t.id}","name":"${t.name}","color":"${t.color}"`)));

finish();

#!/usr/bin/env node
import esbuild from 'esbuild';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const GEBRUIK = 'gebruik: node scripts/ifcx/ifc5-controle.mjs <validator|compositie> <map van IFC5-development> <bestand.ifcx>...';
const MAX_GENOEMD = 5;

async function referentieVan(ifc5Map) {
  const kern = resolve(ifc5Map, 'src/ifcx-core');
  const werkmap = mkdtempSync(join(tmpdir(), 'ops-ifc5-'));
  try {
    const bundel = join(werkmap, 'ifc5.mjs');
    await esbuild.build({
      stdin: { contents: "export { LoadIfcxFile } from './workflows';", resolveDir: kern, loader: 'ts', sourcefile: 'ops-ifc5-ingang.ts' },
      bundle: true,
      platform: 'node',
      format: 'esm',
      outfile: bundel,
      logLevel: 'warning',
    });
    return await import(pathToFileURL(bundel).href);
  } finally {
    rmSync(werkmap, { recursive: true, force: true });
  }
}

function verwachteNodes(bestand) {
  const perPad = new Map();
  for (const entry of bestand.data) {
    perPad.set(entry.path, { ...(perPad.get(entry.path) ?? {}), ...(entry.attributes ?? {}) });
  }
  return perPad;
}

const genoemd = paden => paden.slice(0, MAX_GENOEMD).join(', ') + (paden.length > MAX_GENOEMD ? ` en nog ${paden.length - MAX_GENOEMD}` : '');

function validator({ LoadIfcxFile }, bestand) {
  const nodes = verwachteNodes(bestand);
  LoadIfcxFile(bestand, true, true);
  const attributen = [...nodes.values()].reduce((som, attributes) => som + Object.keys(attributes).length, 0);
  return { problemen: [], samenvatting: `${attributen} attributen op ${nodes.size} paden gevalideerd` };
}

function compositie({ LoadIfcxFile }, bestand) {
  const verwacht = verwachteNodes(bestand);
  const wortels = LoadIfcxFile(bestand, false, true).children;
  const problemen = [];
  const ontbreekt = [...verwacht.keys()].filter(pad => !wortels.has(pad));
  if (ontbreekt.length > 0) problemen.push(`${ontbreekt.length} paden ontbreken na de compositie: ${genoemd(ontbreekt)}`);
  const extra = [...wortels.keys()].filter(pad => !verwacht.has(pad));
  if (extra.length > 0) problemen.push(`${extra.length} onverwachte nodes na de compositie: ${genoemd(extra)}`);
  const anders = [];
  for (const [pad, node] of wortels) {
    if (!verwacht.has(pad)) continue;
    if (node.children.size > 0 || !isDeepStrictEqual(Object.fromEntries(node.attributes), verwacht.get(pad))) anders.push(pad);
  }
  if (anders.length > 0) problemen.push(`${anders.length} nodes met andere attributen of met kinderen na de compositie: ${genoemd(anders)}`);
  return { problemen, samenvatting: `${wortels.size} nodes, elk pad een eigen node met zijn eigen attributen` };
}

const CONTROLES = { validator, compositie };

async function main() {
  const [soort, ifc5Map, ...bestanden] = process.argv.slice(2);
  if (!CONTROLES[soort] || !ifc5Map || bestanden.length === 0) {
    console.error(GEBRUIK);
    return 2;
  }
  let referentie;
  try {
    referentie = await referentieVan(ifc5Map);
  } catch (error) {
    console.error(`De code van IFC5-development in ${ifc5Map} laadt niet: ${error instanceof Error ? error.message : String(error)}`);
    return 2;
  }
  let afgekeurd = 0;
  for (const pad of bestanden) {
    let bestand;
    try {
      bestand = JSON.parse(readFileSync(pad, 'utf8'));
    } catch (error) {
      console.error(`${pad} is niet te lezen als JSON: ${error instanceof Error ? error.message : String(error)}`);
      return 2;
    }
    let uitkomst;
    try {
      uitkomst = CONTROLES[soort](referentie, bestand);
    } catch (error) {
      uitkomst = { problemen: [`${error?.name ?? 'Error'}: ${error instanceof Error ? error.message : String(error)}`] };
    }
    if (uitkomst.problemen.length > 0) {
      afgekeurd++;
      console.log(`XX ${pad}: ${uitkomst.problemen.join('; ')}`);
    } else {
      console.log(`OK ${pad}: ${uitkomst.samenvatting}`);
    }
  }
  console.log(`IFC5-development (${soort}): ${bestanden.length - afgekeurd} goedgekeurd, ${afgekeurd} afgekeurd`);
  return afgekeurd > 0 ? 1 : 0;
}

process.exitCode = await main();

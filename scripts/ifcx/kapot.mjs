#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const GEBRUIK = 'gebruik: node scripts/ifcx/kapot.mjs <goed bestand.ifcx> <uitmap>';

function stringsIn(waarde, gevonden = new Set()) {
  if (typeof waarde === 'string') gevonden.add(waarde);
  else if (Array.isArray(waarde)) for (const item of waarde) stringsIn(item, gevonden);
  else if (waarde && typeof waarde === 'object') for (const item of Object.values(waarde)) stringsIn(item, gevonden);
  return gevonden;
}

function zonderSchema(bestand) {
  const naam = bestand.data.flatMap(entry => Object.keys(entry.attributes ?? {})).find(attribuut => bestand.schemas[attribuut]);
  if (!naam) return undefined;
  delete bestand.schemas[naam];
  return `het schema van ${naam} ontbreekt`;
}

function padMetSchuine(bestand) {
  const elders = new Map(bestand.data.map(entry => [entry, stringsIn(entry.attributes ?? {})]));
  const doel = bestand.data.find(entry => bestand.data.some(ander => ander !== entry && elders.get(ander).has(entry.path)));
  if (!doel) return undefined;
  const oud = doel.path;
  doel.path = `/${oud}`;
  return `het pad ${oud} heet ${doel.path}; de verwijzingen ernaar blijven ${oud}`;
}

function verkeerdeWaarde(bestand) {
  for (const entry of bestand.data) {
    for (const [naam, waarde] of Object.entries(entry.attributes ?? {})) {
      const velden = bestand.schemas[naam]?.value?.objectRestrictions?.values ?? {};
      const veld = Object.keys(velden).find(sleutel => velden[sleutel].dataType === 'String' && typeof waarde?.[sleutel] === 'string');
      if (!veld) continue;
      waarde[veld] = 1;
      return `${entry.path} ${naam}.${veld} is een getal in plaats van tekst`;
    }
  }
  return undefined;
}

const VARIANTEN = { 'kapot-schema': zonderSchema, 'kapot-pad': padMetSchuine, 'kapot-waarde': verkeerdeWaarde };

function main() {
  const [bron, uitmap] = process.argv.slice(2);
  if (!bron || !uitmap) {
    console.error(GEBRUIK);
    return 2;
  }
  const tekst = readFileSync(bron, 'utf8');
  mkdirSync(uitmap, { recursive: true });
  for (const [naam, maakKapot] of Object.entries(VARIANTEN)) {
    const bestand = JSON.parse(tekst);
    const wat = maakKapot(bestand);
    if (!wat) {
      console.error(`${naam}: ${bron} heeft niets om kapot te maken`);
      return 2;
    }
    writeFileSync(join(uitmap, `${naam}.ifcx`), `${JSON.stringify(bestand, null, 2)}\n`);
    console.log(`${naam}.ifcx: ${wat}`);
  }
  return 0;
}

process.exitCode = main();

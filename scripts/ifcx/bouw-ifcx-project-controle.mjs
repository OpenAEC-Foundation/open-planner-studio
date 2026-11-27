#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

const MANIFEST = resolve('scripts/ifcx/ifcx-project-controle/Cargo.toml');
const MAP = dirname(MANIFEST);

const binnenHetProgramma = bestand => {
  const pad = relative(MAP, resolve(MAP, bestand));
  return pad !== '' && !pad.startsWith('..') && !isAbsolute(pad);
};

function plaatsen(bericht) {
  return (bericht.spans ?? [])
    .filter(span => span.is_primary && binnenHetProgramma(span.file_name))
    .map(span => `${relative(process.cwd(), resolve(MAP, span.file_name))}:${span.line_start}:${span.column_start}`);
}

function meldingen(uitvoer) {
  const eigen = [];
  let verborgen = 0;
  for (const regel of uitvoer.split('\n')) {
    if (!regel.startsWith('{')) continue;
    let bericht;
    try {
      bericht = JSON.parse(regel);
    } catch {
      continue;
    }
    if (bericht.reason !== 'compiler-message') continue;
    if (bericht.manifest_path !== MANIFEST) {
      verborgen++;
      continue;
    }
    const { level, code } = bericht.message;
    eigen.push(`${level}${code?.code ? `[${code.code}]` : ''} ${plaatsen(bericht.message).join(', ') || '(zonder plaats)'}`);
  }
  return { eigen, verborgen };
}

function main() {
  const bouw = spawnSync('cargo', ['build', '--quiet', '--message-format=json', '--manifest-path', MANIFEST], {
    encoding: 'utf8',
    maxBuffer: 1 << 28,
  });
  if (bouw.error) {
    console.error(`cargo start niet (${bouw.error.code ?? bouw.error.name})`);
    return 2;
  }
  const { eigen, verborgen } = meldingen(bouw.stdout ?? '');
  for (const melding of eigen) console.log(melding);
  if (verborgen > 0) console.log(`${verborgen} meldingen van de compiler over afhankelijkheden niet getoond.`);
  if (bouw.status !== 0) {
    console.log(`cargo build faalde (uitgang ${bouw.status}). Alleen het niveau, de foutcode en de plaats in het controleprogramma staan in de log; de tekst van cargo en de compiler niet, omdat die inhoud van ifcx-explorer kan bevatten.`);
    return 1;
  }
  console.log('Het controleprogramma is gebouwd.');
  return 0;
}

process.exitCode = main();

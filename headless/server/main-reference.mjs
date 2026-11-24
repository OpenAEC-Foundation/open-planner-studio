#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { answerDigest, BYTES_TYPE, corpusCases, REQUESTS } from './smoke-corpus.mjs';

const [baseArg, token, mainCommit, outFile] = process.argv.slice(2);
if (!baseArg || !token || !mainCommit || !outFile) {
  console.error('usage: node main-reference.mjs <baseUrl van de server van main> <token> <commit van main> <uitvoerbestand>');
  process.exit(2);
}
const base = baseArg.replace(/\/+$/, '');

async function answer(path, body, type, kind) {
  const res = await fetch(`${base}${path}`, { method: 'POST', body, headers: { Authorization: `Bearer ${token}`, 'Content-Type': type } });
  const text = Buffer.from(await res.arrayBuffer()).toString('utf8');
  const retryAfter = res.headers.get('retry-after');
  const record = { status: res.status, type: res.headers.get('content-type'), ...(retryAfter === null ? {} : { retryAfter }) };
  return res.status === 200 ? { ...record, sha256: answerDigest(text, kind, res.status, body) } : { ...record, body: text };
}

const cases = {};
let unequal = 0;
for (const { label, body, textTypes } of corpusCases()) {
  const record = {};
  for (const [path, kind] of REQUESTS) {
    for (const type of [...textTypes, BYTES_TYPE]) {
      const seen = await answer(path, body, type, kind);
      if (!record[kind]) record[kind] = seen;
      else if (JSON.stringify(record[kind]) !== JSON.stringify(seen)) {
        unequal++;
        console.error(`${label}: ${path} als ${type} wijkt af binnen main zelf`);
      }
    }
  }
  cases[label] = record;
}
if (unequal > 0) {
  console.error(`${unequal} antwoorden van main verschilden per ingang of herhaling; geen referentie geschreven`);
  process.exit(1);
}
const lines = Object.entries(cases).map(([label, record]) => `    ${JSON.stringify(label)}: ${JSON.stringify(record)}`);
writeFileSync(outFile, `{\n  "main": ${JSON.stringify(mainCommit)},\n  "cases": {\n${lines.join(',\n')}\n  }\n}\n`);
console.log(`${lines.length} gevallen van ${mainCommit} geschreven naar ${outFile}`);

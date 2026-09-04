#!/usr/bin/env node
/**
 * Stuur één opdracht naar het dev-only Tauri ops-testkanaal en wacht op het antwoord.
 *
 * Gebruik:
 *   node scripts/ops-test-client.mjs /absoluut/pad/naar/ops-test '{"id":"x","op":"ping"}'
 *
 * De opdracht wordt atomair gepubliceerd. Een antwoord telt alleen als het hetzelfde id draagt,
 * zodat een achtergebleven res.json van een eerdere run nooit als bewijs kan worden aangezien.
 */
import { readFile, rename, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const [, , rawBaseDir, rawCommand] = process.argv;
if (!rawBaseDir || !rawCommand) {
  console.error('Gebruik: node scripts/ops-test-client.mjs <ops-test-map> <json-opdracht>');
  process.exit(64);
}

const baseDir = resolve(rawBaseDir);
let command;
try {
  command = JSON.parse(rawCommand);
} catch (error) {
  console.error(`Ongeldige JSON-opdracht: ${String(error)}`);
  process.exit(64);
}
if (!command || typeof command !== 'object' || typeof command.id !== 'string' || !command.id) {
  console.error('De opdracht moet een niet-leeg string-id bevatten.');
  process.exit(64);
}

const cmdPath = join(baseDir, 'cmd.json');
const tempPath = join(baseDir, `cmd.tmp-${process.pid}`);
const responsePath = join(baseDir, 'res.json');
await writeFile(tempPath, `${JSON.stringify(command)}\n`, 'utf8');
await rename(tempPath, cmdPath);

const deadline = Date.now() + 15_000;
for (;;) {
  try {
    const response = JSON.parse(await readFile(responsePath, 'utf8'));
    if (response?.id === command.id) {
      process.stdout.write(`${JSON.stringify(response)}\n`);
      process.exit(response.ok === true ? 0 : 2);
    }
  } catch {
    // De poller heeft nog geen antwoord gepubliceerd of schrijft het momenteel atomair weg.
  }
  if (Date.now() >= deadline) {
    console.error(`Geen antwoord voor opdracht ${command.id} binnen 15000 ms.`);
    process.exit(3);
  }
  await new Promise(resolveWait => setTimeout(resolveWait, 100));
}

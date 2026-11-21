#!/usr/bin/env node
// METING #804 (meet-branch): wie houdt een grote buffer vast? Leest een V8-heap-snapshot (`meet-na-opslag.ts` met
// OPS_HEAPSNAPSHOT) en geeft voor elke buffer van minstens --min bytes de kortste keten van vasthouders tot een wortel.
//   node scripts/proef/vasthouders.mjs <bestand.heapsnapshot> [--min=1000000]
import { readFileSync } from 'node:fs';

const [file, ...rest] = process.argv.slice(2);
const min = Number((rest.find(a => a.startsWith('--min=')) ?? '--min=1000000').slice(6));
const snap = JSON.parse(readFileSync(file, 'utf8'));
const { node_fields, edge_fields, node_types, edge_types } = snap.snapshot.meta;
const NF = node_fields.length, EF = edge_fields.length;
const nType = node_fields.indexOf('type'), nName = node_fields.indexOf('name'), nSize = node_fields.indexOf('self_size');
const nEdges = node_fields.indexOf('edge_count'), nId = node_fields.indexOf('id');
const eType = edge_fields.indexOf('type'), eName = edge_fields.indexOf('name_or_index'), eTo = edge_fields.indexOf('to_node');
const nodes = snap.nodes, edges = snap.edges, strings = snap.strings;
const count = nodes.length / NF;
const typeOf = i => node_types[0][nodes[i * NF + nType]];
const nameOf = i => strings[nodes[i * NF + nName]];
// Omgekeerde kanten: per doel (knoopnummer) de lijst van (bron, kantnaam). Zwakke kanten tellen niet als vasthouden.
const retainers = Array.from({ length: count }, () => []);
let e = 0;
for (let i = 0; i < count; i++) {
  const n = nodes[i * NF + nEdges];
  for (let k = 0; k < n; k++, e += EF) {
    const type = edge_types[0][edges[e + eType]];
    if (type === 'weak') continue;
    const to = edges[e + eTo] / NF;
    const name = type === 'element' || type === 'hidden' ? `[${edges[e + eName]}]` : strings[edges[e + eName]];
    retainers[to].push([i, `${type}:${name}`]);
  }
}
const label = i => `${typeOf(i)} ${String(nameOf(i)).slice(0, 60)} @${nodes[i * NF + nId]}`;
for (let i = 0; i < count; i++) {
  if (nodes[i * NF + nSize] < min) continue;
  // Kortste weg naar een wortel (knoop 0 is de synthetische wortel).
  const prev = new Map([[i, null]]);
  const queue = [i];
  let found = null;
  while (queue.length && found === null) {
    const cur = queue.shift();
    for (const [from, via] of retainers[cur]) {
      if (prev.has(from)) continue;
      prev.set(from, [cur, via]);
      if (from === 0) { found = from; break; }
      queue.push(from);
    }
  }
  console.log(`\n== ${label(i)} self_size=${nodes[i * NF + nSize]}`);
  if (found === null) { console.log('  (geen weg naar een wortel)'); continue; }
  const path = [];
  for (let cur = found; prev.get(cur) !== null; cur = prev.get(cur)[0]) path.push(`${label(cur)} --${prev.get(cur)[1]}-->`);
  for (const step of path.slice(-25)) console.log("  " + step);
}

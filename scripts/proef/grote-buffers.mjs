#!/usr/bin/env node
// METING #804 (meet-branch): elk ArrayBuffer-object in een V8-heap-snapshot met een backing store van minstens --min
// bytes, met zijn kortste keten van vasthouders (sterke kanten) tot de wortel.
//   node scripts/proef/grote-buffers.mjs <bestand.heapsnapshot> [--min=1000000]
import { readFileSync } from 'node:fs';
const [file, ...rest] = process.argv.slice(2);
const min = Number((rest.find(a => a.startsWith('--min=')) ?? '--min=1000000').slice(6));
const snap = JSON.parse(readFileSync(file, 'utf8'));
const { node_fields, edge_fields, node_types, edge_types } = snap.snapshot.meta;
const NF = node_fields.length, EF = edge_fields.length;
const f = n => node_fields.indexOf(n), g = n => edge_fields.indexOf(n);
const [nType, nName, nSize, nEdges, nId] = ['type', 'name', 'self_size', 'edge_count', 'id'].map(f);
const [eType, eName, eTo] = ['type', 'name_or_index', 'to_node'].map(g);
const { nodes, edges, strings } = snap;
const count = nodes.length / NF;
const typeOf = i => node_types[0][nodes[i * NF + nType]], nameOf = i => strings[nodes[i * NF + nName]];
const firstEdge = new Uint32Array(count + 1);
for (let i = 0, e = 0; i < count; i++) { firstEdge[i] = e; e += nodes[i * NF + nEdges] * EF; }
firstEdge[count] = edges.length;
const edgeName = e => { const t = edge_types[0][edges[e + eType]]; return t === 'element' || t === 'hidden' ? `[${edges[e + eName]}]` : strings[edges[e + eName]]; };
const retainers = Array.from({ length: count }, () => []);
for (let i = 0; i < count; i++) for (let e = firstEdge[i]; e < firstEdge[i + 1]; e += EF) {
  const t = edge_types[0][edges[e + eType]];
  if (t === 'weak') continue;
  retainers[edges[e + eTo] / NF].push([i, `${t}:${edgeName(e)}`]);
}
const label = i => `${typeOf(i)} ${String(nameOf(i)).slice(0, 70)} @${nodes[i * NF + nId]}`;
for (let i = 0; i < count; i++) {
  if (typeOf(i) !== 'object' || nameOf(i) !== 'ArrayBuffer') continue;
  let store = 0;
  for (let e = firstEdge[i]; e < firstEdge[i + 1]; e += EF) if (edgeName(e) === 'backing_store') store = nodes[(edges[e + eTo] / NF) * NF + nSize];
  if (store < min) continue;
  const prev = new Map([[i, null]]), queue = [i];
  let found = null;
  while (queue.length && found === null) {
    const cur = queue.shift();
    for (const [from, via] of retainers[cur]) {
      if (prev.has(from)) continue;
      prev.set(from, [cur, via]);
      if (from === 0) { found = 0; break; }
      queue.push(from);
    }
  }
  console.log(`\n== ${label(i)} backing_store=${store}`);
  if (found === null) { console.log('  (geen weg naar de wortel)'); continue; }
  const path = [];
  for (let cur = found; prev.get(cur) !== null; cur = prev.get(cur)[0]) path.push(`${label(cur)} --${prev.get(cur)[1]}-->`);
  for (const step of path.slice(-30)) console.log('  ' + step);
}

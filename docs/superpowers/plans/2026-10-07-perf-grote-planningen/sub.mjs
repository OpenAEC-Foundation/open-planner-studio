// node sub.mjs <profiel> <functienaam> [topN] — self-tijd van alles ONDER die functie
import fs from 'node:fs';
const [file, fn, topArg] = process.argv.slice(2);
const top = Number(topArg ?? 20);
const p = JSON.parse(fs.readFileSync(file, 'utf8'));
const byId = new Map(p.nodes.map(n => [n.id, n]));
const parent = new Map();
for (const n of p.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
const short = (url) => { if (!url) return '(native)'; let u = url.replace(/^https?:\/\/[^/]+/, '').replace(/\?.*$/, ''); const i = u.indexOf('/src/'); if (i >= 0) u = u.slice(i + 1); return u.replace(/^\/node_modules\/\.vite\/deps\//, 'deps/'); };
const key = (n) => `${short(n.callFrame.url)}:${n.callFrame.functionName || '(anon)'}`;
const self = new Map(); const childIncl = new Map(); let total = 0;
for (let i = 0; i < p.samples.length; i++) {
  const d = (p.timeDeltas[i + 1] ?? 0) / 1000;
  const n = byId.get(p.samples[i]);
  // pad naar boven; zoek fn
  const chain = [];
  for (let id = n.id; id !== undefined; id = parent.get(id)) chain.push(byId.get(id));
  const idx = chain.findIndex(x => x.callFrame.functionName === fn);
  if (idx < 0) continue;
  total += d;
  self.set(key(n), (self.get(key(n)) ?? 0) + d);
  if (idx > 0) { const c = key(chain[idx - 1]); childIncl.set(c, (childIncl.get(c) ?? 0) + d); }
}
const fmt = m => [...m].sort((a, b) => b[1] - a[1]).slice(0, top).map(([k, v]) => `${String(Math.round(v)).padStart(7)} ms  ${k}`).join('\n');
console.log(`onder ${fn}: ${Math.round(total)} ms\n-- directe kinderen (incl)\n${fmt(childIncl)}\n-- self\n${fmt(self)}`);

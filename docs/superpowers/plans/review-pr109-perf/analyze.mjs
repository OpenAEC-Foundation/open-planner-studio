// node analyze.mjs <profiel.cpuprofile> [topN] [--incl-filter=src/]
import fs from 'node:fs';
const [file, topArg, ...rest] = process.argv.slice(2);
const top = Number(topArg ?? 15);
const filt = (rest.find(a => a.startsWith('--incl-filter=')) ?? '--incl-filter=src/').split('=')[1];
const p = JSON.parse(fs.readFileSync(file, 'utf8'));
const byId = new Map(p.nodes.map(n => [n.id, n]));
const parent = new Map();
for (const n of p.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
const short = (url) => {
  if (!url) return '(native)';
  let u = url.replace(/^https?:\/\/[^/]+/, '').replace(/\?.*$/, '');
  const i = u.indexOf('/src/'); if (i >= 0) u = u.slice(i + 1);
  u = u.replace(/^\/node_modules\/\.vite\/deps\//, 'deps/');
  return u;
};
const key = (n) => `${short(n.callFrame.url)}:${n.callFrame.functionName || '(anon)'}:${n.callFrame.lineNumber + 1}`;
const self = new Map(); const incl = new Map();
let total = 0;
for (let i = 0; i < p.samples.length; i++) {
  const d = (p.timeDeltas[i + 1] ?? 0) / 1000; // delta tot volgende sample
  const n = byId.get(p.samples[i]);
  const k = key(n);
  if (n.callFrame.functionName === '(idle)') continue;
  total += d;
  self.set(k, (self.get(k) ?? 0) + d);
  const seen = new Set();
  for (let id = n.id; id !== undefined; id = parent.get(id)) {
    const kk = key(byId.get(id));
    if (seen.has(kk)) continue; seen.add(kk);
    incl.set(kk, (incl.get(kk) ?? 0) + d);
  }
}
const fmt = (m, f = () => true) => [...m].filter(([k]) => f(k)).sort((a, b) => b[1] - a[1]).slice(0, top)
  .map(([k, v]) => `${String(Math.round(v)).padStart(8)} ms  ${(100 * v / total).toFixed(1).padStart(5)}%  ${k}`).join('\n');
console.log(`== ${file}\nbusy (niet-idle) ${Math.round(total)} ms`);
console.log('-- SELF top'); console.log(fmt(self, k => !k.startsWith('(native):(program)') && !k.startsWith('(native):(garbage')));
console.log('   (program)/(GC):', Math.round(self.get('(native):(program):0') ?? 0), Math.round(self.get('(native):(garbage collector):0') ?? 0));
console.log(`-- INCLUSIEF top (filter ${filt})`); console.log(fmt(incl, k => k.includes(filt)));

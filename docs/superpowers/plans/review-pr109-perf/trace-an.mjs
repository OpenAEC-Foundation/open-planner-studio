import fs from 'node:fs';
const ev = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).traceEvents;
const tn = new Map();
for (const e of ev) if (e.ph === 'M' && e.name === 'thread_name') tn.set(`${e.pid}:${e.tid}`, e.args.name);
const agg = new Map();
for (const e of ev) if (e.ph === 'X' && e.dur > 0) { const k = `${tn.get(`${e.pid}:${e.tid}`) ?? e.tid} | ${e.name}`; agg.set(k, (agg.get(k) ?? 0) + e.dur / 1000); }
console.log([...agg].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([k, v]) => `${Math.round(v).toString().padStart(7)}  ${k}`).join('\n'));
const commits = ev.filter(e => e.name === 'Commit' && e.ph === 'X').map(e => ({ ms: Math.round(e.dur / 1000), args: JSON.stringify(e.args).slice(0, 400) }));
console.log(JSON.stringify(commits.filter(c => c.ms > 100).slice(0, 5), null, 1));
// wat gebeurt er binnen de grootste Commit op dezelfde thread
const big = ev.filter(e => e.name === 'Commit' && e.ph === 'X').sort((a, b) => b.dur - a.dur)[0];
if (big) {
  const inner = new Map();
  for (const e of ev) if (e.ph === 'X' && e.ts >= big.ts && e.ts + (e.dur ?? 0) <= big.ts + big.dur && e !== big) { const k = `${tn.get(`${e.pid}:${e.tid}`) ?? e.tid} | ${e.name}`; inner.set(k, (inner.get(k) ?? 0) + (e.dur ?? 0) / 1000); }
  console.log('BINNEN grootste commit', Math.round(big.dur / 1000), 'ms:\n' + [...inner].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([k, v]) => `${Math.round(v).toString().padStart(7)}  ${k}`).join('\n'));
}

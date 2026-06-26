// ONAFHANKELIJKE werkdag-referentie (eigen implementatie, NIET de app-motor).
// Schone kalender: ma-vr werkdagen, geen feestdagen. Voor het narekenen van verwachte datums.
const DOW = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
function iso(d) { return d.toISOString().slice(0, 10); }
function addDays(d, n) { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; }
function isWork(d, holidays = new Set()) { const g = d.getUTCDay(); return g >= 1 && g <= 5 && !holidays.has(iso(d)); }

// Werkdag-index → datum, startend op of na anchor. index 1 = eerste werkdag.
function workdayTable(anchorISO, count = 45, holidays = new Set()) {
  const out = [];
  let d = new Date(anchorISO + 'T00:00:00Z');
  while (!isWork(d, holidays)) d = addDays(d, 1);
  for (let i = 1; i <= count; i++) {
    out.push({ wd: i, date: iso(d), dow: DOW[d.getUTCDay()] });
    // volgende werkdag
    do { d = addDays(d, 1); } while (!isWork(d, holidays));
  }
  return out;
}

const anchor = process.argv[2] || '2026-06-01';
const a = new Date(anchor + 'T00:00:00Z');
console.log(`anchor ${anchor} = ${DOW[a.getUTCDay()]}, is werkdag: ${isWork(a)}`);
console.log('werkdag-tabel (schone kalender, ma-vr):');
for (const r of workdayTable(anchor, 30)) console.log(`  wd${r.wd}\t${r.date}\t${r.dow}`);

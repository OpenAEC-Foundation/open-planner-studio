// De ingebouwde benchmark-generator (Instellingen → Benchmark) — bewaakt dat de gegenereerde
// planning een ECHT netwerk is en dat het aantal resources doet wat het belooft.
//
// AANLEIDING. De generator maakte al relaties én resources, maar de relaties waren puur
// willekeurige kanten (~1,3 per leaf-taak) en lieten daardoor een staart leaf-taken ZONDER enige
// relatie achter. Die taken legt de solver meteen op de projectstart, dus ze zeggen niets over hoe
// de app zich met een echt netwerk gedraagt — precies de vraag waarvoor je een benchmark draait.
// Het aantal resources stond bovendien vast op de acht poolrollen en was niet instelbaar, dus
// "wat kost de resourcebelasting zelf" was niet te meten.
//
// De generator is deterministisch (mulberry32-seed), dus dit is toetsbaar zonder tijdmeting.
//
// WAT DE SABOTAGES LATEN ZIEN (acht gedraaid). Rood worden bij: de ruggengraat weghalen, de
// round-robin voor subfasen weghalen, het richtingsguard in `addEdge` omdraaien, `resourceCount`
// negeren, de klemming weghalen, het rondenummer in de naam weghalen, `task.resourceIds` niet meer
// bijwerken, en het resource-aantal in de seed mengen. Twee eerlijke kanttekeningen:
//   - De round-robin voor BLADEREN is niet los aantoonbaar. Bij de aangeboden groottes gaan ~90%
//     van de taken over ~6,5% ouders, dus puur loten dekt in de praktijk toch elke ouder. Hij staat
//     er als garantie, niet omdat de loting het misdoet.
//   - Check 2 (acyclisch) wordt pas rood als de richtingscontrole ÉN de aanroeprichting allebei
//     fout zijn — de aanroepers geven op zichzelf nooit een achterwaarts paar door. Dat is precies
//     wat een end-to-end-assertie hoort te doen: hij toetst de uitkomst, niet één mechanisme.
//
// Draait via run.sh. Exit 0 = alles groen.
import './domStub';
import {
  generateBenchmarkProject, BENCHMARK_SIZES, BENCHMARK_RESOURCE_COUNTS, DEFAULT_RESOURCE_COUNT,
} from '@/services/benchmark/generateProject';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};
const truthy = (label: string, got: boolean) => {
  checks++;
  if (!got) diffs.push(`${label}: verwacht waar, kreeg onwaar`);
};

// ── 1. Elke leaf-taak zit in het relatienetwerk ──────────────────────────────
// Over ALLE aangeboden groottes, want de oude bug werd juist bij de grote zichtbaar.
for (const size of BENCHMARK_SIZES) {
  const g = generateBenchmarkProject(size);
  const leaves = g.tasks.filter(t => t.childIds.length === 0);
  const inNetwerk = new Set<string>();
  for (const s of g.sequences) { inNetwerk.add(s.predecessorId); inNetwerk.add(s.successorId); }
  const los = leaves.filter(t => !inNetwerk.has(t.id));
  eq(`1 [${size}] geen enkele leaf-taak zonder relatie`, los.length, 0);

  // Verzameltaken doen bewust NIET mee — hun datums zijn een rollup. Dat is geen omissie maar een
  // keuze, en zonder deze check zou "elke taak een relatie" ongemerkt kunnen doorslaan naar
  // verzameltaken toe.
  const summaries = g.tasks.filter(t => t.childIds.length > 0);
  const summaryInNetwerk = summaries.filter(t => inNetwerk.has(t.id));
  eq(`1a [${size}] verzameltaken blijven buiten het netwerk`, summaryInNetwerk.length, 0);

  // De verdichting bovenop de ruggengraat moet er ook echt zijn: een kale ketting is n-1 kanten.
  truthy(`1b [${size}] er zit verdichting bovenop de ruggengraat`, g.sequences.length > leaves.length - 1);
}

// ── 2. De graaf blijft acyclisch ─────────────────────────────────────────────
// De ruggengraat kiest per opvolger een EERDERE voorganger; dat garandeert acyclisch, maar het is
// precies de eigenschap die stukgaat als iemand het venster ooit "beide kanten op" maakt.
{
  const g = generateBenchmarkProject(1000);
  const index = new Map(g.tasks.map((t, i) => [t.id, i]));
  const fout = g.sequences.filter(s => (index.get(s.predecessorId) ?? -1) >= (index.get(s.successorId) ?? -1));
  eq('2 elke relatie loopt van een eerder- naar een later-aangemaakte taak', fout.length, 0);
}

// ── 3. Het aantal resources is instelbaar ────────────────────────────────────
for (const n of BENCHMARK_RESOURCE_COUNTS) {
  const g = generateBenchmarkProject(500, { resourceCount: n });
  eq(`3 [${n}] precies zoveel resources`, g.resources.length, n);
  eq(`3a [${n}] geen dubbele resource-id's`, new Set(g.resources.map(r => r.id)).size, n);
  eq(`3b [${n}] geen dubbele resourcenamen`, new Set(g.resources.map(r => r.name)).size, n);
  // Elke toewijzing moet naar een BESTAANDE resource wijzen — een verweesde toewijzing vergiftigt
  // writeIFC (guidOf leest resourceId.length) en zou de benchmark stil laten falen.
  const bekend = new Set(g.resources.map(r => r.id));
  eq(`3c [${n}] geen verweesde toewijzingen`, g.assignments.filter(a => !bekend.has(a.resourceId)).length, 0);
  if (n === 0) {
    eq('3d nul resources ⇒ nul toewijzingen', g.assignments.length, 0);
    eq('3e nul resources ⇒ geen taak met resourceIds',
      g.tasks.filter(t => t.resourceIds.length > 0).length, 0);
  } else {
    truthy(`3f [${n}] er zijn wél toewijzingen`, g.assignments.length > 0);
  }
  // De taak-kant en de toewijzingen-kant moeten het eens zijn (dubbele boekhouding in het model).
  const uitTaken = g.tasks.flatMap(t => t.resourceIds.map(r => `${t.id}>${r}`)).sort();
  const uitAsg = g.assignments.map(a => `${a.taskId}>${a.resourceId}`).sort();
  eq(`3g [${n}] taak.resourceIds en assignments zijn het eens`, uitTaken, uitAsg);
}

// Boven de acht poolrollen worden de rollen hergebruikt met een rondenummer; het TYPE moet dan de
// rol blijven volgen, anders wordt de typeverdeling bij veel resources scheef.
{
  const g = generateBenchmarkProject(500, { resourceCount: 25 });
  eq('4 de eerste ronde houdt de kale rolnaam', g.resources[0]?.name, g.resources[0]?.name.replace(/ \d+$/, ''));
  eq('4a de tweede ronde krijgt een rondenummer', g.resources[8]?.name, `${g.resources[0]?.name} 2`);
  eq('4b en hetzelfde type als de rol', g.resources[8]?.type, g.resources[0]?.type);
  eq('4c en dezelfde capaciteit', g.resources[8]?.maxUnits, g.resources[0]?.maxUnits);
}

// Buiten bereik wordt geklemd, niet doorgelaten.
{
  eq('5 negatief aantal klemt naar 0', generateBenchmarkProject(100, { resourceCount: -5 }).resources.length, 0);
  eq('5a absurd aantal klemt naar 2000', generateBenchmarkProject(100, { resourceCount: 99999 }).resources.length, 2000);
  eq('5b weglaten geeft de standaard', generateBenchmarkProject(100).resources.length, DEFAULT_RESOURCE_COUNT);
}

// ── 6. Determinisme ──────────────────────────────────────────────────────────
// De hele belofte van deze generator: twee runs met dezelfde invoer zijn bit-identiek, anders zijn
// twee metingen niet vergelijkbaar.
{
  const a = generateBenchmarkProject(500, { resourceCount: 25 });
  const b = generateBenchmarkProject(500, { resourceCount: 25 });
  eq('6 twee runs met dezelfde opties zijn identiek', JSON.stringify(a) === JSON.stringify(b), true);

  const c = generateBenchmarkProject(500, { resourceCount: 25, seed: 12345 });
  eq('6a een andere seed geeft andere data', JSON.stringify(a) === JSON.stringify(c), false);
  eq('6b maar wel evenveel taken', c.tasks.length, a.tasks.length);
  eq('6c en evenveel resources', c.resources.length, a.resources.length);

  // Het aantal resources mag de STRUCTUUR niet veranderen — anders vergelijk je bij een andere
  // resource-instelling ook een andere planning, en is de meting nutteloos.
  const d = generateBenchmarkProject(500, { resourceCount: 0 });
  eq('7 taken zijn identiek bij een ander aantal resources',
    JSON.stringify(a.tasks.map(t => ({ ...t, resourceIds: [] }))),
    JSON.stringify(d.tasks.map(t => ({ ...t, resourceIds: [] }))));
  eq('7a relaties zijn identiek bij een ander aantal resources',
    JSON.stringify(a.sequences), JSON.stringify(d.sequences));
}

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK: benchmark-generator — ${checks} checks groen`);
} else {
  console.log(`XX benchmark-generator — ${diffs.length} van ${checks} checks rood:`);
  for (const d of diffs) console.log(`   XX ${d}`);
  process.exit(1);
}

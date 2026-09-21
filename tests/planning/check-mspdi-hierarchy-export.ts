// Issue #159 — WBS-hiërarchie en duur in de MS-Project-XML- en CSV-export.
//
// De melding: na export naar MS Project stond elke volgende samenvattingstaak GENEST in de vorige
// en vielen alle bladtaken onder de laatste samenvatting; sommige taken kwamen als 0-daagse mijlpaal
// binnen; dagduren werden fractioneel. De oorzaken in de code, elk met een check hieronder:
//
//  1. `<OutlineLevel>` kwam uit `wbsCode.split('.').length` en de `<Task>`-volgorde uit de store.
//     MS Project reconstrueert de boom uit OutlineLevel + DOCUMENTVOLGORDE — een IFC-import draagt
//     de vrije `IfcTask.Identification` als wbsCode (hernummeren gebeurt niet bij laden) en kan
//     "samenvattingen eerst, dan bladen" geordend zijn. Nu: diepte uit de echte ouderketen, taken
//     diepte-eerst (`flattenOrder`), en de LEZER herbouwt de boom uit `<OutlineLevel>` (WBS-terugval).
//  2. Een samenvatting met duur 0 kreeg `<Milestone>1</Milestone>`. Nu nooit voor een samenvatting.
//  3. De dagduur werd geschreven als `dagen × PROJECT-hpd`, terwijl `readMSPDI` (en MS Project's
//     planning) met de TAAK-kalender rekent: 7 dagen op een 24/7-taakkalender bij een 8u-project →
//     `PT56H` → 2,33 dagen terug. Nu `dagen × effHpd`, symmetrisch met de lezer.
//  4. CSV kende geen niveau-kolom: 'Outline Level' erbij (na WBS), rijen diepte-eerst, en `readCSV`
//     herbouwt de boom daaruit (WBS-terugval blijft).
//
// Draait via run.sh. Exit 0 = alles groen.
import { writeMSPDI } from '@/services/msproject/mspdiWriter';
import { readMSPDI } from '@/services/msproject/mspdiReader';
import { writeCSV } from '@/services/csv/csvWriter';
import { readCSV } from '@/services/csv/csvReader';
import { flattenOrder, outlineDepths } from '@/utils/wbs';
import { rebuildOutlineHierarchy } from '@/services/importNormalize';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import type { Project } from '@/types/project';
import { installDOMParser } from './xmldom-shim';

installDOMParser();

let checks = 0;
let fails = 0;
function assert(cond: boolean, msg: string): void {
  checks++;
  if (!cond) { fails++; console.log(`XX ${msg}`); }
}
function eq(name: string, got: unknown, want: unknown): void {
  assert(JSON.stringify(got) === JSON.stringify(want), `${name}: kreeg ${JSON.stringify(got)} ≠ verwacht ${JSON.stringify(want)}`);
}

// ── Fixtures ────────────────────────────────────────────────────────────────────────────────
const H8: WorkCalendar = {
  id: 'cal-h8', name: 'Standaard', description: 'ma-vr 08-16', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
};
// Dag-kalender (geen `workTime`) met 24 uur per dag, zoals het 24/7-preset (`shiftPresets.ts`).
const H24: WorkCalendar = {
  id: 'cal-247', name: '24/7', description: 'continu', workDays: [1, 2, 3, 4, 5, 6, 7],
  workStartHour: 0, workEndHour: 24, hoursPerDay: 24, holidays: [],
};
const project: Project = {
  id: 'p', name: 'Hiërarchie', description: '', startDate: '2026-09-07', endDate: '2026-10-30',
  calendarId: 'cal-h8', createdAt: '2026-09-07T00:00', modifiedAt: '2026-09-07T00:00', author: 'T', company: 'C',
};
const mk = (id: string, name: string, wbs: string, days: number, parentId: string | null, childIds: string[], extra: Partial<Task> = {}): Task => ({
  id, name, description: '', wbsCode: wbs, taskType: 'CONSTRUCTION', status: 'NOT_STARTED', isMilestone: false,
  priority: 500, parentId, childIds,
  time: {
    durationType: 'WORKTIME', durationUnit: 'days', scheduleDuration: days,
    scheduleStart: '2026-09-07', scheduleFinish: '2026-09-11', earlyStart: '2026-09-07', earlyFinish: '2026-09-11',
    lateStart: '2026-09-07', lateFinish: '2026-09-11', freeFloat: 0, totalFloat: 0, isCritical: false, completion: 0,
  },
  resourceIds: [], ...extra,
});

// De boom uit de melding: één wortel, vier samenvattingen op niveau 2, bladen op niveau 3 — maar in
// de STORE-volgorde "samenvattingen eerst, dan bladen" en met vrije-tekst-codes (IFC-Identification).
//   R
//   ├─ S1 ─ a, b
//   ├─ S2 ─ c, d
//   ├─ S3 ─ e
//   └─ S4 ─ f, M (mijlpaal)
const treeTasks = (): Task[] => [
  mk('R', 'Project', 'PRJ', 40, null, ['S1', 'S2', 'S3', 'S4']),
  mk('S1', 'Voorbereiding', 'A', 10, 'R', ['a', 'b']),
  mk('S2', 'Ruwbouw', 'B', 20, 'R', ['c', 'd']),
  mk('S3', 'Gevel', 'C', 5, 'R', ['e']),
  mk('S4', 'Oplevering', 'D', 5, 'R', ['f', 'M']),
  mk('a', 'Bouwplaats inrichten', 'A-01', 3, 'S1', []),
  mk('b', 'Vergunningen', 'A-02', 7, 'S1', []),
  mk('c', 'Fundering', 'B-01', 10, 'S2', []),
  mk('d', 'Casco', 'B-02', 10, 'S2', []),
  mk('e', 'Kozijnen', 'C-01', 5, 'S3', []),
  mk('f', 'Schoonmaak', 'D-01', 5, 'S4', []),
  mk('M', 'Sleuteloverdracht', 'D-02', 0, 'S4', [], { isMilestone: true }),
];
const WANT_ORDER = ['R', 'S1', 'a', 'b', 'S2', 'c', 'd', 'S3', 'e', 'S4', 'f', 'M'];
const WANT_DEPTH: Record<string, number> = { R: 1, S1: 2, a: 3, b: 3, S2: 2, c: 3, d: 3, S3: 2, e: 3, S4: 2, f: 3, M: 3 };

/** Ouder-naam per taak-naam + gesorteerde kind-namen — structuurvergelijking los van id's én van
 *  de lijstvolgorde (op naam gesorteerd, want de teruggelezen lijst staat diepte-eerst). */
function shape(tasks: readonly Task[]): Record<string, { parent: string | null; children: string[] }> {
  const byId = new Map(tasks.map(t => [t.id, t]));
  const out: Record<string, { parent: string | null; children: string[] }> = {};
  for (const t of [...tasks].sort((a, b) => a.name.localeCompare(b.name))) {
    out[t.name] = {
      parent: t.parentId ? (byId.get(t.parentId)?.name ?? '?') : null,
      children: t.childIds.map(id => byId.get(id)?.name ?? '?').sort(),
    };
  }
  return out;
}

/** Per <Task>-blok (UID ≥ 1) de velden die MS Project voor de boom gebruikt, in documentvolgorde. */
function taskBlocks(xml: string): { name: string; outlineLevel: number; summary: number; milestone: number; duration: string; uid: number; id: number }[] {
  const get = (blk: string, tag: string) => (blk.match(new RegExp(`<${tag}>([^<]*)</${tag}>`)) ?? [])[1] ?? '';
  const out: ReturnType<typeof taskBlocks> = [];
  const re = /<Task>([\s\S]*?)<\/Task>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const uid = Number(get(m[1], 'UID'));
    if (uid === 0) continue;
    out.push({
      name: get(m[1], 'Name'), outlineLevel: Number(get(m[1], 'OutlineLevel')), summary: Number(get(m[1], 'Summary')),
      milestone: Number(get(m[1], 'Milestone')), duration: get(m[1], 'Duration'), uid, id: Number(get(m[1], 'ID')),
    });
  }
  return out;
}

// ── 1. MSPDI: OutlineLevel + volgorde uit de echte boom ─────────────────────────────────────
{
  const tasks = treeTasks();
  eq('1a flattenOrder levert de diepte-eerst-volgorde', flattenOrder(tasks).map(t => t.id), WANT_ORDER);
  eq('1b outlineDepths uit de ouderketen, niet uit de wbsCode', Object.fromEntries(outlineDepths(tasks)), WANT_DEPTH);

  const xml = writeMSPDI(project, H8, tasks, [], [], []);
  const blocks = taskBlocks(xml);
  const nameToId = new Map(tasks.map(t => [t.name, t.id]));
  eq('1c <Task>-blokken staan diepte-eerst (ouders vóór kinderen)', blocks.map(b => nameToId.get(b.name)), WANT_ORDER);
  eq('1d <OutlineLevel> = echte diepte per taak', blocks.map(b => [nameToId.get(b.name), b.outlineLevel]), WANT_ORDER.map(id => [id, WANT_DEPTH[id]]));
  eq('1e UID/ID lopen op in documentvolgorde', blocks.map(b => [b.uid, b.id]), WANT_ORDER.map((_, i) => [i + 1, i + 1]));
  eq('1f <Summary> volgt childIds', blocks.map(b => b.summary), WANT_ORDER.map(id => (WANT_DEPTH[id] < 3 ? 1 : 0)));
  assert(xml.includes('<WBS>A-01</WBS>'), '1g de vrije WBS-code blijft als tekst in <WBS> staan');

  // Terug via readMSPDI: de boom moet identiek zijn, hoewel geen enkele WBS-code een punt draagt.
  const back = readMSPDI(xml);
  eq('1h readMSPDI herbouwt de boom uit <OutlineLevel> (geen gepunte WBS nodig)', shape(back.tasks), shape(tasks));
  eq('1i teruggelezen taakvolgorde = diepte-eerst', back.tasks.map(t => t.name), WANT_ORDER.map(id => tasks.find(t => t.id === id)!.name));
}

// ── 2. Samenvatting is nooit een mijlpaal ───────────────────────────────────────────────────
{
  const tasks = treeTasks();
  // Bestand van vóór #145 / IFC met `$`-duur op de samenvatting: duur 0 op een taak mét kinderen.
  tasks.find(t => t.id === 'S3')!.time.scheduleDuration = 0;
  const xml = writeMSPDI(project, H8, tasks, [], [], []);
  const blocks = taskBlocks(xml);
  const s3 = blocks.find(b => b.name === 'Gevel')!;
  const m = blocks.find(b => b.name === 'Sleuteloverdracht')!;
  eq('2a samenvatting met duur 0 → Milestone 0', s3.milestone, 0);
  eq('2b …en Summary 1', s3.summary, 1);
  eq('2c echte mijlpaal (blad, duur 0) blijft Milestone 1', m.milestone, 1);
  const back = readMSPDI(xml);
  eq('2d teruggelezen: samenvatting geen mijlpaal', back.tasks.find(t => t.name === 'Gevel')!.isMilestone, false);
  eq('2e teruggelezen: blad-mijlpaal wél', back.tasks.find(t => t.name === 'Sleuteloverdracht')!.isMilestone, true);
}

// ── 3. Dagduur in uren van de TAAK-kalender ─────────────────────────────────────────────────
{
  const tasks = [
    mk('p', 'Op projectkalender', '1', 5, null, []),
    mk('q', 'Op 24/7-kalender', '2', 7, null, [], { calendarId: 'cal-247' }),
  ];
  const xml = writeMSPDI(project, H8, tasks, [], [], [], [H24]);
  const blocks = taskBlocks(xml);
  eq('3a 5 dagen × 8u (projectkalender) → PT40H', blocks[0].duration, 'PT40H0M0S');
  eq('3b 7 dagen × 24u (taakkalender) → PT168H, niet PT56H', blocks[1].duration, 'PT168H0M0S');
  const back = readMSPDI(xml);
  eq('3c round-trip projectkalender-taak: 5 dagen', back.tasks[0].time.scheduleDuration, 5);
  eq('3d round-trip 24/7-taak: 7 dagen (was 2,33)', back.tasks[1].time.scheduleDuration, 7);
}

// ── 4. CSV: Outline Level-kolom, diepte-eerst, en terug ─────────────────────────────────────
{
  const tasks = treeTasks();
  const csv = writeCSV(project, H8, tasks, [], [], []);
  const lines = csv.replace(/^﻿/, '').split('\r\n').filter(Boolean);
  const header = lines[0].split(';');
  eq('4a kolom "Outline Level" direct na WBS', header.slice(1, 4), ['WBS', 'Outline Level', 'Name']);
  const rows = lines.slice(1).map(l => l.split(';'));
  eq('4b rijen diepte-eerst', rows.map(r => r[0]), WANT_ORDER);
  eq('4c niveau per rij uit de ouderketen', rows.map(r => Number(r[2])), WANT_ORDER.map(id => WANT_DEPTH[id]));
  const back = readCSV(csv);
  eq('4d readCSV herbouwt de boom uit de niveau-kolom (vrije WBS-codes)', shape(back.tasks), shape(tasks));

  // Zonder de kolom (CSV van een andere tool / oudere export): gepunte WBS blijft de terugval.
  const dotted = treeTasks().map(t => ({ ...t, wbsCode: { R: '1', S1: '1.1', a: '1.1.1', b: '1.1.2', S2: '1.2', c: '1.2.1', d: '1.2.2', S3: '1.3', e: '1.3.1', S4: '1.4', f: '1.4.1', M: '1.4.2' }[t.id]! }));
  const legacy = writeCSV(project, H8, dotted, [], [], []).replace(/^﻿/, '').split('\r\n').filter(Boolean)
    .map(l => { const c = l.split(';'); c.splice(2, 1); return c.join(';'); }).join('\r\n') + '\r\n';
  assert(!legacy.split('\r\n')[0].includes('Outline Level'), '4e opzet: legacy-CSV zonder niveau-kolom');
  eq('4f readCSV zonder niveau-kolom: boom uit gepunte WBS', shape(readCSV(legacy).tasks), shape(dotted));
}

// ── 5. Lezer-terugval en -voorrang ──────────────────────────────────────────────────────────
{
  const tasks = treeTasks();
  const xml = writeMSPDI(project, H8, tasks, [], [], []);
  // Legacy-bestand zonder <OutlineLevel> maar mét gepunte WBS: de WBS-afleiding blijft werken.
  const dottedWbs: Record<string, string> = { PRJ: '1', A: '1.1', 'A-01': '1.1.1', 'A-02': '1.1.2', B: '1.2', 'B-01': '1.2.1', 'B-02': '1.2.2', C: '1.3', 'C-01': '1.3.1', D: '1.4', 'D-01': '1.4.1', 'D-02': '1.4.2' };
  const legacy = xml
    .replace(/<WBS>([^<]*)<\/WBS>/g, (_, w: string) => `<WBS>${dottedWbs[w] ?? w}</WBS>`)
    .replace(/^\s*<OutlineLevel>[1-9]\d*<\/OutlineLevel>\r?\n/gm, '');
  assert(!/<OutlineLevel>[1-9]/.test(legacy), '5a opzet: geen taak-OutlineLevel meer in het legacy-bestand');
  eq('5b zonder OutlineLevel: boom uit gepunte WBS', shape(readMSPDI(legacy).tasks), shape(tasks));

  // OutlineLevel aanwezig maar tegenstrijdig met de gepunte WBS: het niveau wint (MS Project-semantiek).
  const conflicting = xml.replace(/<WBS>([^<]*)<\/WBS>/g, '<WBS>9.9.9.9</WBS>');
  eq('5c OutlineLevel wint van een onzinnige gepunte WBS', shape(readMSPDI(conflicting).tasks), shape(tasks));

  // De helper zelf: een gat in de niveaus ⇒ false en niets aangeraakt.
  const flat = [mk('x', 'x', 'x', 1, null, []), mk('y', 'y', 'y', 1, null, [])];
  eq('5d rebuildOutlineHierarchy weigert een ontbrekend niveau', rebuildOutlineHierarchy(flat, [1, undefined]), false);
  eq('5e …en laat de taken ongemoeid', flat.map(t => t.parentId), [null, null]);
  // Sprong van meer dan één niveau (1 → 3): tolerant, de laatste ondiepere taak wordt ouder.
  const jump = [mk('x', 'x', 'x', 1, null, []), mk('y', 'y', 'y', 1, null, [])];
  eq('5f niveausprong 1 → 3 is tolerant', rebuildOutlineHierarchy(jump, [1, 3]), true);
  eq('5g …met de ondiepere taak als ouder', [jump[1].parentId, jump[0].childIds], ['x', ['y']]);
}

if (fails === 0) {
  console.log(`check-mspdi-hierarchy-export: alles groen (${checks} checks)`);
  process.exit(0);
} else {
  console.log(`check-mspdi-hierarchy-export: ${fails}/${checks} checks gefaald`);
  process.exit(1);
}

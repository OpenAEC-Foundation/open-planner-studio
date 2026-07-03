// Kern van de voorbeeld-generator (zonder side-effects): bouwt elke voorbeeldplanning declaratief
// op via de ECHTE Zustand-store (addTask/addSequence/addResource/assignResource/setCalendar/…),
// draait de ECHTE `runCPM()` voor kalender-correcte datums en serialiseert met de ECHTE `writeIFC`.
// Zowel de generator (generate-examples.ts) als de verificatie (verify-examples.ts) importeren dit,
// zodat "definitie → bestand" en "bestand → assert" langs exact dezelfde spec-set lopen.
//
// Jaar-onafhankelijk: projecten ankeren op "eerste maandag van maart, volgend jaar"; feestdagen
// (incl. Pasen-afgeleiden + bouwvak) worden per jaar berekend.
import { useAppStore } from '@/state/appStore';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { createDefaultTaskTime } from '@/types/task';
import { addBusinessDays, formatDate, isoDayOfWeek } from '@/utils/dateUtils';
import type { Holiday, WorkCalendar } from '@/types/calendar';
import type { CustomFieldType } from '@/types/structure';
import topologies from './example-topologies.json';
import { SHOWCASES } from './showcases';
import type { ProjectSpec, CalSpec } from './spec';

const S = () => useAppStore.getState();

// ── Kalender & feestdagen (per jaar berekend) ──────────────────────────────────────────────
/** Paaszondag (Meeus/Jones/Butcher, Gregoriaans). */
function easterSunday(y: number): Date {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(y, month - 1, day));
}
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
const iso = (d: Date) => formatDate(d);
const oneDay = (name: string, d: Date): Holiday => ({ name, startDate: iso(d), endDate: iso(d) });

/** Nederlandse officiële feestdagen voor een jaar (Pasen-afgeleiden + vaste dagen). */
function nlHolidays(year: number): Holiday[] {
  const easter = easterSunday(year);
  let kings = new Date(Date.UTC(year, 3, 27)); // 27 april; op zondag → 26 april
  if (isoDayOfWeek(kings) === 7) kings = new Date(Date.UTC(year, 3, 26));
  return [
    oneDay('Nieuwjaar', new Date(Date.UTC(year, 0, 1))),
    oneDay('Goede Vrijdag', addDays(easter, -2)),
    { name: 'Pasen', startDate: iso(easter), endDate: iso(addDays(easter, 1)) },
    oneDay('Koningsdag', kings),
    oneDay('Bevrijdingsdag', new Date(Date.UTC(year, 4, 5))),
    oneDay('Hemelvaart', addDays(easter, 39)),
    { name: 'Pinksteren', startDate: iso(addDays(easter, 49)), endDate: iso(addDays(easter, 50)) },
    { name: 'Kerst', startDate: iso(new Date(Date.UTC(year, 11, 25))), endDate: iso(new Date(Date.UTC(year, 11, 26))) },
  ];
}

/** Bouwvak (benadering regio Noord): drie weken vanaf de 4e maandag van juli. */
function bouwvak(year: number): Holiday {
  let d = new Date(Date.UTC(year, 6, 1));
  while (isoDayOfWeek(d) !== 1) d = addDays(d, 1); // 1e maandag
  d = addDays(d, 21); // 4e maandag
  return { name: 'Bouwvak (regio Noord)', startDate: iso(d), endDate: iso(addDays(d, 20)) };
}

/** Eerste maandag van maart, volgend jaar (relatief aan de generatiedatum). */
export function anchorDate(): Date {
  const year = new Date().getFullYear() + 1;
  let d = new Date(Date.UTC(year, 2, 1));
  while (isoDayOfWeek(d) !== 1) d = addDays(d, 1);
  return d;
}

/** Feestdagenset die de looptijd van een project dekt (ankerjaar + volgend jaar) + bouwvak. */
function holidaysForSpan(anchor: Date): Holiday[] {
  const y = anchor.getUTCFullYear();
  return [...nlHolidays(y), bouwvak(y), ...nlHolidays(y + 1), bouwvak(y + 1)];
}

function buildCalendar(anchor: Date, cal?: CalSpec): WorkCalendar {
  const workDays = cal?.workDays ?? [1, 2, 3, 4, 5];
  const holidays = [...holidaysForSpan(anchor), ...(cal?.extraHolidays ?? [])];
  return {
    id: 'cal-default',
    name: cal?.name ?? 'Bouwkalender NL',
    description: cal?.description ?? 'Standaard bouwkalender: ma-vr 07:00-16:00',
    workDays,
    workStartHour: 7,
    workEndHour: 16,
    hoursPerDay: 8,
    holidays,
  };
}

// ── Bouwer: rijd de echte store op basis van een ProjectSpec ────────────────────────────────
/** n werkdagen ná het anker als ISO-datum (n=0 → anker). Voor constraint/deadline-datums. */
function offset(anchor: Date, n: number): string {
  return formatDate(addBusinessDays(anchor, n + 1));
}

export interface BuildResult {
  ifc: string;
  stats: {
    tasks: number; milestones: number; sequences: number; resources: number;
    assignments: number; codeTypes: number; customFields: number;
    critical: number; leaves: number;
  };
}

export function build(spec: ProjectSpec): BuildResult {
  const anchor = new Date(anchorDate().getTime() + (spec.anchorShiftDays ?? 0) * 86400000);
  const anchorIso = formatDate(anchor);

  S().newProject();
  S().setCalendar(buildCalendar(anchor, spec.calendar));
  S().setProject({
    name: spec.name,
    description: spec.description ?? '',
    startDate: anchorIso,
    author: spec.author ?? 'Projectleider',
    company: spec.company ?? 'Bouwbedrijf BV',
  });

  // Activity-code-types + waarden
  const codeTypeIds: Record<string, string> = {};
  const codeValueIds: Record<string, string> = {}; // "type::code" → valueId
  for (const ct of spec.codeTypes ?? []) {
    const tid = S().addActivityCodeType(ct.name);
    codeTypeIds[ct.name] = tid;
    for (const v of ct.values) {
      const vid = S().addActivityCodeValue(tid, { code: v.code, description: v.description, color: v.color });
      codeValueIds[`${ct.name}::${v.code}`] = vid;
    }
  }
  // Custom fields
  const fieldIds: Record<string, string> = {};
  for (const f of spec.fields ?? []) {
    fieldIds[f.name] = S().addCustomField(f.name, f.type as CustomFieldType);
  }

  // Resources (eventueel met eigen kalender / stappen / ploeg-parent)
  const resIds: Record<string, string> = {};
  for (const r of spec.resources ?? []) {
    let calendarId: string | undefined;
    if (r.calendar) {
      const base = buildCalendar(anchor, r.calendar);
      const { id: _id, ...rest } = base;
      void _id;
      calendarId = S().addResourceCalendar({ ...rest, name: r.calendar.name ?? `${r.name} kalender` });
    }
    const steps = r.steps?.map(s => ({ from: offset(anchor, s.fromDay), maxUnits: s.maxUnits }));
    resIds[r.name] = S().addResource({
      name: r.name,
      type: r.type ?? 'LABOR',
      description: r.description ?? '',
      maxUnits: r.maxUnits ?? 1,
      ...(r.costPerHour !== undefined ? { costPerHour: r.costPerHour } : {}),
      ...(r.unitOfMeasure ? { unitOfMeasure: r.unitOfMeasure } : {}),
      ...(calendarId ? { calendarId } : {}),
      ...(steps && steps.length ? { availabilitySteps: steps } : {}),
      ...(r.parent ? { parentId: resIds[r.parent] } : {}),
    });
  }

  // Taken (ouders vóór kinderen: spec.tasks staat al in boomvolgorde)
  const taskIds: Record<string, string> = {};
  let milestones = 0;
  for (const t of spec.tasks) {
    if (t.milestone) milestones++;
    const dur = t.milestone ? 0 : (t.dur ?? 5);
    const constraint = t.constraint
      ? { type: t.constraint.type as any, ...(t.constraint.offsetDay !== undefined ? { date: offset(anchor, t.constraint.offsetDay) } : {}) }
      : undefined;
    const id = S().addTask({
      name: t.name,
      isMilestone: !!t.milestone,
      parentId: t.parent ? taskIds[t.parent] : null,
      taskType: (t.taskType as any) ?? 'CONSTRUCTION',
      time: createDefaultTaskTime(anchorIso, dur),
      ...(t.milestoneKind ? { milestoneKind: t.milestoneKind } : {}),
      ...(t.mandatory ? { mandatory: true } : {}),
      ...(t.priority !== undefined ? { priority: t.priority } : {}),
      ...(constraint ? { constraint } : {}),
      ...(t.deadlineDay !== undefined ? { deadline: offset(anchor, t.deadlineDay) } : {}),
      ...(t.description ? { description: t.description } : {}),
    });
    taskIds[t.key] = id;
    for (const [typeName, code] of Object.entries(t.codes ?? {})) {
      const tid = codeTypeIds[typeName]; const vid = codeValueIds[`${typeName}::${code}`];
      if (tid && vid) S().setTaskActivityCode(id, tid, vid);
    }
    for (const [fname, value] of Object.entries(t.fields ?? {})) {
      const fid = fieldIds[fname];
      if (fid) S().setTaskCustomField(id, fid, value as any);
    }
  }

  // Relaties
  for (const l of spec.links ?? []) {
    const pred = taskIds[l.pred], succ = taskIds[l.succ];
    if (!pred || !succ) throw new Error(`[${spec.slug}] onbekende relatie ${l.pred} → ${l.succ}`);
    S().addSequence({
      predecessorId: pred, successorId: succ, type: (l.type as any) ?? 'FINISH_START',
      lagDays: l.lag ?? 0,
      ...(l.lagUnit ? { lagUnit: l.lagUnit as any } : {}),
      ...(l.lagPercent !== undefined ? { lagPercent: l.lagPercent } : {}),
    });
  }

  // Toewijzingen (alleen leaf/non-mijlpaal — assignResource is leaf-bewust)
  for (const t of spec.tasks) {
    for (const a of t.assign ?? []) {
      const rid = resIds[a.res];
      if (!rid) throw new Error(`[${spec.slug}] taak "${t.name}": onbekende resource "${a.res}"`);
      S().assignResource(taskIds[t.key], rid, a.units, a.curve as any);
    }
  }

  S().runCPM();

  const st = S();
  const leaves = st.tasks.filter(t => t.childIds.length === 0);
  const critical = leaves.filter(t => t.time.isCritical).length;
  const ifcContent = writeIFC(
    st.project, st.calendar, st.tasks, st.sequences, st.resources, st.assignments,
    st.activityCodeTypes, st.customFieldDefs, st.resourceCalendars,
  );
  return {
    ifc: ifcContent,
    stats: {
      tasks: st.tasks.length, milestones, sequences: st.sequences.length,
      resources: st.resources.length, assignments: st.assignments.length,
      codeTypes: st.activityCodeTypes.length, customFields: st.customFieldDefs.length,
      critical, leaves: leaves.length,
    },
  };
}

// ── Verrijking van de 20 bestaande topologieën → ProjectSpec ────────────────────────────────
interface TopoChild { name: string; duration?: number; taskType?: string; isCritical?: boolean; milestone?: boolean; depType?: string; lag?: number }
interface TopoPhase { name: string; wbs: string; taskType?: string; children: TopoChild[] }
interface TopoDef { id: string; name: string; description?: string; author?: string; company?: string; phases: TopoPhase[] }

/** Kalenders variëren: infra/water-achtige projecten krijgen een 6-daagse week (ma-za). */
const SIX_DAY = new Set([4, 8, 11, 13, 15, 17]); // 0-based index → 05,09,12,14,16,18

function startKind(name: string): 'START' | 'FINISH' | undefined {
  if (/\bstart\b|aanvang|begin\b/i.test(name)) return 'START';
  if (/gereed|oplever|opgeleverd|dicht|klaar|punt|voltooid|afgerond|einde/i.test(name)) return 'FINISH';
  return undefined;
}
const isMandatoryMs = (name: string) => /inspectie|keuring|controle|oplever|opgeleverd|goedkeuring|acceptatie/i.test(name);

/** Zet een flat phases/children-topologie om naar een ProjectSpec met échte fase-overlap
 *  (SS/FF/leads/%-lag) zodat er een realistisch kritiek pad mét float ontstaat i.p.v. 44/45
 *  kritiek. Intra-fase blijft een FS-keten (opeenvolgende ambachten); fasegrenzen overlappen. */
export function topologyToSpec(def: TopoDef, index: number): ProjectSpec {
  const tasks: ProjectSpec['tasks'] = [];
  const links: NonNullable<ProjectSpec['links']> = [];
  const phaseFirst: string[] = [];
  const phaseLastReal: string[] = [];
  const phaseWorkdays: number[] = [];

  def.phases.forEach((phase, pi) => {
    const pkey = `p${pi}`;
    tasks.push({ name: phase.name, key: pkey, taskType: phase.taskType });
    let prev: string | null = null;
    let prevReal: string | null = null;
    let firstKey: string | null = null;
    let sum = 0;
    phase.children.forEach((child, ci) => {
      const key = `${pkey}_${ci}`;
      const ms = !!child.milestone;
      const dur = ms ? 0 : (child.duration ?? 5);
      sum += dur;
      tasks.push({
        name: child.name, key, parent: pkey,
        taskType: child.taskType ?? phase.taskType,
        dur: ms ? undefined : dur,
        ...(ms ? { milestone: true } : {}),
        ...(ms && startKind(child.name) ? { milestoneKind: startKind(child.name) } : {}),
        ...(ms && isMandatoryMs(child.name) ? { mandatory: true } : {}),
      });
      if (firstKey === null) firstKey = key;
      if (prev) {
        // Intra-fase: FS-keten; respecteer een expliciete SS-relatie uit de bron-topologie.
        if (child.depType === 'SS') links.push({ pred: prev, succ: key, type: 'START_START', lag: child.lag ?? 0 });
        else links.push({ pred: prev, succ: key, lag: child.lag ?? 0 });
      }
      prev = key;
      if (!ms) prevReal = key;
    });
    phaseFirst.push(firstKey ?? `${pkey}_0`);
    phaseLastReal.push(prevReal ?? firstKey ?? `${pkey}_0`);
    phaseWorkdays.push(sum);
  });

  // Fasegrenzen: roteer relatietypes zodat álle vier types + leads + één %-lag voorkomen.
  const n = def.phases.length;
  for (let pi = 1; pi < n; pi++) {
    const predReal = phaseLastReal[pi - 1];
    const predFirst = phaseFirst[pi - 1];
    const succFirst = phaseFirst[pi];
    const predLen = phaseWorkdays[pi - 1];
    const last = pi === n - 1; // laatste fase (oplevering) → strak sequentieel
    const style = last ? 0 : (pi % 4);
    if (style === 1) {
      // SS + halve fase-lag: opvolgerfase start halverwege de voorganger (overlap).
      links.push({ pred: predFirst, succ: succFirst, type: 'START_START', lag: Math.max(1, Math.round(predLen * 0.5)) });
    } else if (style === 2) {
      // %-lag (SS + % van voorgangerduur) — MS-Project-semantiek, per CPM-run herberekend.
      links.push({ pred: predFirst, succ: succFirst, type: 'START_START', lagPercent: 40 });
    } else if (style === 3) {
      // FS + lead (negatieve lag = fast-track): opvolger start enkele dagen vóór einde voorganger.
      links.push({ pred: predReal, succ: succFirst, lag: -Math.max(1, Math.round(predLen * 0.2)) });
    } else {
      // FS strak (style 0 en de laatste fase).
      links.push({ pred: predReal, succ: succFirst, lag: 0 });
    }
    // Extra FF-koppeling op één middenfase zodat ook FINISH_FINISH voorkomt.
    if (pi === Math.floor(n / 2) && !last) {
      links.push({ pred: predReal, succ: phaseLastReal[pi], type: 'FINISH_FINISH', lag: 2 });
    }
  }

  return {
    slug: (topologies as any).filenames[index],
    name: def.name,
    description: def.description,
    author: def.author,
    company: def.company,
    category: 'basic',
    calendar: SIX_DAY.has(index)
      ? { workDays: [1, 2, 3, 4, 5, 6], name: 'Infrakalender ma-za', description: 'Infra/water: ma-za' }
      : undefined,
    tasks, links,
  };
}

/** Alle specs in publicatievolgorde: eerst de drie showcases, dan de 20 basisvoorbeelden. */
export function allSpecs(): ProjectSpec[] {
  const defs: TopoDef[] = (topologies as any).defs;
  const basics = defs.map((d, i) => topologyToSpec(d, i));
  return [...SHOWCASES, ...basics];
}

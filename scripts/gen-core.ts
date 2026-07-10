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
import { readIFC } from '@/services/ifc/ifcReader';
import { createDefaultTaskTime } from '@/types/task';
import { addBusinessDays, formatDate, isoDayOfWeek } from '@/utils/dateUtils';
// `easterSunday` verhuisde naar de gedeelde feestdagen-engine (fase 2.8a, §3.1); één bron voor
// app én voorbeeld-generator. De NL-feestdagen-set hieronder blijft bewust lokaal: de examples
// bevatten Bevrijdingsdag ELK jaar (niet lustrum-only) en een vaste bouwvak, precies zoals de
// bestaande gouden voorbeelden — herbedraden naar generateHolidays zou die byte-identiek breken.
import { easterSunday } from '@/engine/calendar/holidays';
import type { Holiday, WorkCalendar } from '@/types/calendar';
import type { CustomFieldType } from '@/types/structure';
import { generateId } from '@/utils/id';
import topologies from './example-topologies.json';
import { SHOWCASES } from './showcases';
import { TERREIN_ONDERAANNEMER, ANCHOR_TASK_NAME, buildGrootSpec } from './showcase-groot';
import type { ProjectSpec, CalSpec, TaskSpec, LinkSpec } from './spec';

const S = () => useAppStore.getState();

// ── Kalender & feestdagen (per jaar berekend) ──────────────────────────────────────────────
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

/** Zet een werkdag-offset + kalenderdagen-duur (CalSpec.extraHolidays) om naar een absolute
 *  ISO-periode t.o.v. het anker — zelfde jaar-onafhankelijke conventie als `offset()` hieronder,
 *  vervroegd gedefinieerd zodat `buildCalendar` er ook vóór de `offset`-declaratie gebruik van
 *  kan maken (function-declaraties zijn hoisted). */
function extraHolidayRange(anchor: Date, h: { name: string; fromDay: number; calendarDays: number }): Holiday {
  const start = addBusinessDays(anchor, h.fromDay + 1);
  return { name: h.name, startDate: iso(start), endDate: iso(addDays(start, h.calendarDays - 1)) };
}

function buildCalendar(anchor: Date, cal?: CalSpec): WorkCalendar {
  const workDays = cal?.workDays ?? [1, 2, 3, 4, 5];
  const extraHolidays = (cal?.extraHolidays ?? []).map(h => extraHolidayRange(anchor, h));
  const holidays = [...holidaysForSpan(anchor), ...extraHolidays];
  return {
    id: 'cal-default',
    name: cal?.name ?? 'Bouwkalender NL',
    description: cal?.description ?? 'Standaard bouwkalender: ma-vr 07:00-16:00',
    workDays,
    workStartHour: 7,
    workEndHour: 16,
    hoursPerDay: 8,
    holidays,
    // Uren-planning (fase 2.10, golf 2): aanwezig ⇒ UUR-kalender (`WorkCalendar.workTime`,
    // `calendar.ts:17-19`). Afwezig ⇒ byte-identiek dag-kalender (bestaand gedrag).
    ...(cal?.workTime ? { workTime: cal.workTime } : {}),
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
  // Reken-opties (fase 2.10, golf 2: near-critical + float paths) — vóór de eerste runCPM.
  if (spec.schedulingOptions) S().setProject({ schedulingOptions: spec.schedulingOptions });

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
      calendarId = S().addCalendar({ ...rest, name: r.calendar.name ?? `${r.name} kalender` });
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

  // Kalender-bibliotheek voor taak-specifieke uur-kalenders (fase 2.10, golf 2, `TaskSpec.
  // calendarKey`) — zelfde `addCalendar`-patroon als de resource-kalenders hierboven.
  const taskCalendarIds: Record<string, string> = {};
  for (const [key, cal] of Object.entries(spec.calendars ?? {})) {
    const base = buildCalendar(anchor, cal);
    const { id: _id, ...rest } = base;
    void _id;
    taskCalendarIds[key] = S().addCalendar({ ...rest, name: cal.name ?? key });
  }

  // Taken (ouders vóór kinderen: spec.tasks staat al in boomvolgorde). Herbruikbaar zodat een
  // rebaseline-mutatie (golf 2, hieronder) dezelfde opbouwlogica kan hergebruiken.
  const taskIds: Record<string, string> = {};
  let milestones = 0;
  const addSpecTask = (t: TaskSpec): string => {
    if (t.milestone) milestones++;
    const dur = t.milestone ? 0 : (t.dur ?? 5);
    const time = createDefaultTaskTime(anchorIso, dur);
    if (t.durMinutes !== undefined) time.durationMinutes = t.durMinutes;
    const constraint = t.constraint
      ? {
          type: t.constraint.type as any,
          ...(t.constraint.offsetDay !== undefined ? { date: offset(anchor, t.constraint.offsetDay) } : {}),
          ...(t.constraint.hard ? { hard: true } : {}),
        }
      : undefined;
    const constraint2 = t.constraint2
      ? { type: t.constraint2.type as any, ...(t.constraint2.offsetDay !== undefined ? { date: offset(anchor, t.constraint2.offsetDay) } : {}) }
      : undefined;
    const id = S().addTask({
      name: t.name,
      isMilestone: !!t.milestone,
      parentId: t.parent ? taskIds[t.parent] : null,
      taskType: (t.taskType as any) ?? 'CONSTRUCTION',
      time,
      ...(t.milestoneKind ? { milestoneKind: t.milestoneKind } : {}),
      ...(t.mandatory ? { mandatory: true } : {}),
      ...(t.priority !== undefined ? { priority: t.priority } : {}),
      ...(constraint ? { constraint } : {}),
      ...(constraint2 ? { constraint2 } : {}),
      ...(t.hammock ? { isHammock: true } : {}),
      ...(t.deadlineDay !== undefined ? { deadline: offset(anchor, t.deadlineDay) } : {}),
      ...(t.description ? { description: t.description } : {}),
      ...(t.calendarKey ? { calendarId: taskCalendarIds[t.calendarKey] } : {}),
      // Aantekeningen (fase 2.10, item 1): de builder genereert de id's, spec geeft alleen
      // tekst + afvink-status (`scripts/spec.ts:TaskSpec.notes`).
      ...(t.notes && t.notes.length
        ? { notes: t.notes.map(n => ({ id: generateId('note'), text: n.text, done: n.done })) }
        : {}),
    });
    taskIds[t.key] = id;
    // Externe koppeling (fase 2.10, golf 2): via de ECHTE `addExternalLink`-actie, ná `addTask`
    // — precies het app-patroon (taak eerst aanmaken, dan koppelen), niet via de addTask-partial.
    if (t.externalLink) S().addExternalLink(id, t.externalLink);
    for (const [typeName, code] of Object.entries(t.codes ?? {})) {
      const tid = codeTypeIds[typeName]; const vid = codeValueIds[`${typeName}::${code}`];
      if (tid && vid) S().setTaskActivityCode(id, tid, vid);
    }
    for (const [fname, value] of Object.entries(t.fields ?? {})) {
      const fid = fieldIds[fname];
      if (fid) S().setTaskCustomField(id, fid, value as any);
    }
    return id;
  };
  for (const t of spec.tasks) addSpecTask(t);

  const addSpecLink = (l: LinkSpec) => {
    const pred = taskIds[l.pred], succ = taskIds[l.succ];
    if (!pred || !succ) throw new Error(`[${spec.slug}] onbekende relatie ${l.pred} → ${l.succ}`);
    S().addSequence({
      predecessorId: pred, successorId: succ, type: (l.type as any) ?? 'FINISH_START',
      lagDays: l.lag ?? 0,
      ...(l.lagUnit ? { lagUnit: l.lagUnit as any } : {}),
      ...(l.lagPercent !== undefined ? { lagPercent: l.lagPercent } : {}),
    });
  };
  // Relaties
  for (const l of spec.links ?? []) addSpecLink(l);

  // Toewijzingen (alleen leaf/non-mijlpaal — assignResource is leaf-bewust)
  for (const t of spec.tasks) {
    for (const a of t.assign ?? []) {
      const rid = resIds[a.res];
      if (!rid) throw new Error(`[${spec.slug}] taak "${t.name}": onbekende resource "${a.res}"`);
      S().assignResource(taskIds[t.key], rid, a.units, a.curve as any);
    }
  }

  S().runCPM();

  // Baseline(s) (fase 2.10, item 19 + golf 2 rebaseline): opgeslagen via de echte `saveBaseline`-
  // actie. Een `mutationBefore` op een entry past een gescripte scope-mutatie toe (extra taken/
  // relaties/duurverlenging) + een tussentijdse `runCPM()` vóórdat DIE baseline wordt opgeslagen
  // — het twee-fasen-patroon (opbouw → runCPM → snapshot → mutatie → runCPM → snapshot) dat het
  // rebaseline-scenario (Contract → meerwerk → Herbaseline) nodig heeft.
  const baselineIds: Record<string, string> = {};
  for (const b of spec.baselines ?? []) {
    const m = b.mutationBefore;
    if (m) {
      for (const t of m.addTasks ?? []) addSpecTask(t);
      for (const l of m.addLinks ?? []) addSpecLink(l);
      for (const e of m.extendDurations ?? []) {
        const id = taskIds[e.key];
        if (!id) throw new Error(`[${spec.slug}] extendDurations: onbekende taak "${e.key}"`);
        const task = S().tasks.find(x => x.id === id);
        if (!task) throw new Error(`[${spec.slug}] extendDurations: taak "${e.key}" niet in store`);
        S().updateTask(id, { time: { ...task.time, scheduleDuration: e.dur } });
      }
      S().runCPM();
    }
    baselineIds[b.name] = S().saveBaseline(b.name);
  }
  if (spec.activeBaselineName) {
    const id = baselineIds[spec.activeBaselineName];
    if (!id) throw new Error(`[${spec.slug}] activeBaselineName "${spec.activeBaselineName}" komt niet voor in baselines`);
    S().setActiveBaseline(id);
  }

  // Voortgang/statusdatum (fase 2.10, item 20): via de ECHTE store-acties (zelfde invarianten
  // als de UI — auto-actualStart, completion-clamping, COMPLETED-status). De statusdatum moet
  // vóór de tweede `runCPM()` gezet zijn: de solver gebruikt `project.statusDate` als data-date
  // in de forward pass (`scheduleSlice.ts:runCPM` → `dataDate: s.project.statusDate`,
  // `CPMSolver.ts:558-592`), dus alleen dan werkt voortgang door in de herberekende datums.
  let needsRecompute = false;
  if (spec.statusDay !== undefined) {
    S().setStatusDate(offset(anchor, spec.statusDay));
    needsRecompute = true;
  }
  // Ook meerwerk-taken uit een `mutationBefore` kunnen voortgang dragen — itereer over ALLE
  // bekende keys (spec.tasks + eventuele baseline-mutaties), niet alleen spec.tasks.
  const allTaskSpecs = [...spec.tasks, ...(spec.baselines ?? []).flatMap(b => b.mutationBefore?.addTasks ?? [])];
  for (const t of allTaskSpecs) {
    if (t.completion === undefined && t.actualStartDay === undefined && t.actualFinishDay === undefined) continue;
    needsRecompute = true;
    const id = taskIds[t.key];
    if (t.actualStartDay !== undefined) {
      const ok = S().setActualStart(id, offset(anchor, t.actualStartDay));
      if (!ok) throw new Error(`[${spec.slug}] taak "${t.name}": actualStartDay ligt ná statusDay (geweigerd door setActualStart)`);
    }
    if (t.completion !== undefined) S().setTaskProgress(id, t.completion);
    if (t.actualFinishDay !== undefined) {
      const ok = S().setActualFinish(id, offset(anchor, t.actualFinishDay));
      if (!ok) throw new Error(`[${spec.slug}] taak "${t.name}": actualFinishDay ligt ná statusDay (geweigerd door setActualFinish)`);
    }
  }
  if (needsRecompute) S().runCPM();

  const st = S();
  const leaves = st.tasks.filter(t => t.childIds.length === 0);
  const critical = leaves.filter(t => t.time.isCritical).length;
  const ifcContent = writeIFC(
    st.project, st.calendar, st.tasks, st.sequences, st.resources, st.assignments,
    st.activityCodeTypes, st.customFieldDefs, st.calendars,
    st.baselines, st.activeBaselineId,
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

/** Bouwt het externe-koppeling-bronbestand (fase 2.10, golf 2, §4.2) ÉÉN keer, leest het
 *  meteen terug via de ECHTE `readIFC` (exact het patroon van `ExternalLinkDialog`: bron
 *  read-only parsen, anker bevriezen) en construeert daarmee de GROOT-spec met een vooraf-
 *  berekend `ExternalLink`-object. Puur qua datums: `build()` is deterministisch (zelfde anker,
 *  zelfde CPM-netwerk ⇒ zelfde vroege datums) ongeacht hoe vaak dit bronbestand hierna nog eens
 *  gebouwd wordt door de aanroeper (bv. `generate-examples.ts` bouwt het NOGMAALS om het echt
 *  weg te schrijven) — alleen het (niet-geverifieerde) project-/taak-id verschilt per build, dus
 *  de consistentie-check in `verify-examples.ts` matcht bewust op TAAKNAAM, niet op id.
 */
function buildGrootWithExternalSource(): { groot: ProjectSpec; terrain: ProjectSpec } {
  const terrainBuild = build(TERREIN_ONDERAANNEMER);
  const parsed = readIFC(terrainBuild.ifc);
  const anchorTask = parsed.tasks.find(t => t.name === ANCHOR_TASK_NAME);
  if (!anchorTask) throw new Error(`extern bronbestand: ankertaak "${ANCHOR_TASK_NAME}" niet gevonden`);
  const groot = buildGrootSpec({
    anchorDate: anchorTask.time.earlyFinish || anchorTask.time.scheduleFinish,
    sourceProjectId: parsed.project.id,
    sourceProjectName: parsed.project.name,
    sourceTaskId: anchorTask.id,
    sourceTaskName: anchorTask.name,
  });
  return { groot, terrain: TERREIN_ONDERAANNEMER };
}

/** Alle specs in publicatievolgorde: de showcases (incl. GROOT), het NIET-PUBLIC externe-
 *  koppeling-bronbestand, dan de 20 basisvoorbeelden. */
export function allSpecs(): ProjectSpec[] {
  const defs: TopoDef[] = (topologies as any).defs;
  const basics = defs.map((d, i) => topologyToSpec(d, i));
  const { groot, terrain } = buildGrootWithExternalSource();
  return [...SHOWCASES, groot, terrain, ...basics];
}

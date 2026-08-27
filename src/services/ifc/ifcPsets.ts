import type {
  Task, ConstraintType, TaskSplitGap, TaskTimephasedContour, TimephasedContourPeriod, MspTaskType,
} from '@/types/task';

/**
 * IFC-pset-registry (fase 3, tweede helft van P11 uit docs/superpowers/modulariteit-audit.md,
 * bevinding A2/F2). Vóór dit bestand leefde het OPS_*-round-trip-contract in ~15 losse
 * write/extract-paren die alleen gekoppeld waren door gedupliceerde pset-naam-string-literals plus
 * de conventie "reader = spiegel van writer". Eén typo in een naam of een divergentie tussen write
 * en read faalde STIL (de reader matchte gewoon niet). Hier is per pset één bron:
 *
 *  - `PSET`: elke pset-NAAM als gedeelde constante. Writer én reader importeren die; nergens staat
 *    nog een los `'OPS_...'`-literal in de code (alleen in prozacommentaar).
 *  - `PER_TASK_PSETS`: de ACHT per-taak-psets die exact hetzelfde stramien volgen
 *    (Constraints/ExternalLink/Hammock/Milestone/Leveling/TaskNotes/TaskAppearance/Analysis). Hun
 *    write- én read-kant zijn hier GECO-LOKEERD in één descriptor: `write(task)` levert de
 *    property-lijst (of `null`/`[]` = golden rule ⇒ niets schrijven), `apply(task, props)` zet de
 *    gelezen properties terug. De writer itereert over de lijst; de reader dispatcht per naam via
 *    `PER_TASK_PSET_BY_NAME`. Zo kunnen naam-koppeling én write/read-paring niet meer divergeren.
 *
 * De niet-taak-psets (ProjectSettings/StructureMeta/CustomFields/ActivityCodes op project-niveau;
 * Resource/Assignments per resource/taak-in-eigen-vorm; Baselines/SchedulingOptions op de
 * IfcWorkSchedule; Calendar per kalender) hebben elk een AFWIJKENDE vorm — project-globaal, een
 * autoritaire JSON-blob, of read-logica die cross-object-maps (typeByName/defByName/guidToTaskId)
 * nodig heeft. Die delen daarom alléén de NAAM-constante; hun write/read blijft in
 * ifcWriter/ifcReader. Over-abstractie zou daar niets winnen.
 *
 * Dit bestand importeert alleen uit `@/types` ⇒ geen import-cyclus met reader/writer (die
 * importeren úit dit bestand).
 */
export const PSET = {
  // Per-taak (de acht met een descriptor in PER_TASK_PSETS).
  Constraints: 'OPS_Constraints',
  ExternalLink: 'OPS_ExternalLink',
  Hammock: 'OPS_Hammock',
  Milestone: 'OPS_Milestone',
  Leveling: 'OPS_Leveling',
  TaskNotes: 'OPS_TaskNotes',
  TaskAppearance: 'OPS_TaskAppearance',
  Analysis: 'OPS_Analysis',
  // Z14 (etappe "nul afwijkingen") — vier NIEUWE per-taak-psets, zelfde registry-patroon.
  /** Werkonderbrekingen (`Task.splitGaps`) — één autoritatief JSON-veld, ExternalLink/TaskNotes-patroon. */
  Splits: 'OPS_TaskSplits',
  /** Handmatig-gepland-vlag (`Task.manuallyScheduled`) — losse getypte prop, Hammock/Milestone-patroon. */
  Manual: 'OPS_ManualScheduling',
  /** MSP's eigen resume/stop-instanten (`TaskTime.resume`/`stop`, Z12) — losse getypte props. */
  Resume: 'OPS_Resume',
  // Z14b (eigenaarsbesluit/-principe 2026-08-18) — drie NIEUWE per-taak-psets, zelfde registry-patroon.
  /** Het Z8-venster (`Task.timephasedFinishFloor`/`timephasedStartAnchor`/`timephasedDurationWalks`)
   *  — AFGELEIDE sturing, wordt bij een inhoudelijke bewerking weer ontkoppeld (zie
   *  `taskDefaults.ts`'s `clearTimephasedWindow`). NIET hetzelfde pset als `Timephased` hierboven
   *  (dat draagt het PER-ASSIGNMENT `workWindowStart`/`Finish`-paar, een ander veld). */
  Window: 'OPS_TimephasedWindow',
  /** `Task.timephasedDurationWalks` (LAAG 4) — AFWIJKENDE vorm (alleen naam gedeeld, geen
   *  `PerTaskPset`-descriptor): `resourceCalendarId` is een kalender-verwijzing die bij inlezen een
   *  NIEUW id krijgt, dus write/read hebben allebei toegang tot de kalender-bibliotheek nodig — die
   *  heeft de generieke `PerTaskPset`-vorm niet. Zie `ifcWriter.writeTimephasedDurationWalksMeta`/
   *  `ifcReader.extractTimephasedDurationWalksMeta`. */
  DurationWalks: 'OPS_TimephasedDurationWalks',
  /** De RAUWE, gedecodeerde .mpp-contourperiodes (`Task.timephasedContours`) — de bron ONDER het
   *  Z8-venster; wordt NOOIT door een bewerking gewist (eigenaarsprincipe). */
  Contours: 'OPS_TimephasedContours',
  /** MSP's eigen Task Type + Effort-Driven-vlag (`Task.mspTaskType`/`effortDriven`) — puur data,
   *  geen rekengedrag (eigenaarsbesluit 2026-08-18, punt 1). */
  MspTaskType: 'OPS_MspTaskType',
  // Structuur/waarden op project- of taak-niveau (afwijkende vorm — alleen naam gedeeld).
  ProjectSettings: 'OPS_ProjectSettings',
  StructureMeta: 'OPS_StructureMeta',
  CustomFields: 'OPS_CustomFields',
  ActivityCodes: 'OPS_ActivityCodes',
  // Per-resource / per-taak-assignment (afwijkende vorm — alleen naam gedeeld).
  Resource: 'OPS_Resource',
  Assignments: 'OPS_Assignments',
  /** Z14 — per-assignment timephased-venster (`ResourceAssignment.workWindowStart`/`Finish`), eigen
   *  JSON-blob-pset op de taak (zelfde `writeBaselineMeta`-vorm), NAAST (niet in) `OPS_Assignments`
   *  — dat pipe-formaat blijft ongewijzigd. */
  Timephased: 'OPS_Timephased',
  // Op de IfcWorkSchedule (autoritaire JSON-blob — alleen naam gedeeld).
  Baselines: 'OPS_Baselines',
  SchedulingOptions: 'OPS_SchedulingOptions',
  // Per kalender (afwijkende vorm — alleen naam gedeeld).
  Calendar: 'OPS_Calendar',
  // Bedrijfsbibliotheek-pool als autoritatief JSON-blob op het IfcProject (spec B1, §4).
  Library: 'OPS_Library',
} as const;

/**
 * Gedeelde STEP-waarde-formatters (verhuisd uit ifcWriter zodat de per-taak-descriptors hun eigen
 * getypte IFC-waarden kunnen opbouwen). De writer importeert ze nu HIERvandaan — één bron, geen
 * duplicaat dat kan divergeren. Byte-identiek aan de vroegere lokale ifcWriter-versies.
 */
export function ifcStr(s: string): string {
  if (!s) return '$';
  return `'${s.replace(/'/g, "''")}'`;
}
export function ifcBool(b: boolean): string {
  return b ? '.T.' : '.F.';
}

/** Eén IFCPROPERTYSINGLEVALUE binnen een pset. `value` is de REEDS-geformatteerde getypte IFC-waarde
 *  (bv. `IFCLABEL('SNET')`); de writer verpakt 'm als `IFCPROPERTYSINGLEVALUE(name,$,value,$)`. */
export interface PropSpec {
  name: string;
  value: string;
}

/** Een gelezen property zoals de reader 'm aanlevert: naam + reeds-geparste waarde. */
export interface ReadProp {
  name: string;
  value: unknown;
}

/** Descriptor voor één per-taak-pset: NAAM + GUID-seeds + geco-lokeerde write/read. */
export interface PerTaskPset {
  name: string;
  /** ifcGuid-seed-prefix voor de IFCPROPERTYSET-GlobalId (writer appended `task.id`). */
  psetSeed: string;
  /** ifcGuid-seed-prefix voor de IFCRELDEFINESBYPROPERTIES-GlobalId. */
  relSeed: string;
  /** Golden rule: `null` of lege lijst ⇒ niets geschreven (bit-gelijk met bestaande bestanden). */
  write(task: Task): PropSpec[] | null;
  /** Zet de gelezen (reeds naar {name,value} geparste) IFCPROPERTYSINGLEVALUE-props terug op de taak. */
  apply(task: Task, props: ReadProp[]): void;
}

/** Geldige constraint-types (writer schrijft ASAP niet; reader valideert hiertegen). */
const CONSTRAINT_VALID: ConstraintType[] = ['ASAP', 'ALAP', 'SNET', 'SNLT', 'FNET', 'FNLT', 'MSO', 'MFO'];

/**
 * De acht per-taak-psets. VOLGORDE IS BINDEND: de writer schrijft ze in deze volgorde (spiegelt de
 * vroegere aanroepvolgorde in `writeIFC`), wat de byte-identieke STEP-uitvoer bewaakt. De reader
 * dispatcht op naam en is volgorde-ongevoelig.
 */
export const PER_TASK_PSETS: PerTaskPset[] = [
  // 1. Fase 2.3/2.9 — datum-constraint (+ harde pin + secundaire, P6-native soft) + deadline. IfcTaskTime
  //    heeft geen constraint-/deadline-slots. ASAP (default) wordt niet geschreven.
  {
    name: PSET.Constraints, psetSeed: 'pset_cst_', relSeed: 'rel_cst_',
    write(task) {
      const props: PropSpec[] = [];
      const c = task.constraint;
      if (c && c.type !== 'ASAP') {
        props.push({ name: 'ConstraintType', value: `IFCLABEL(${ifcStr(c.type)})` });
        if (c.date) props.push({ name: 'ConstraintDate', value: `IFCDATE(${ifcStr(c.date)})` });
        if (c.hard) props.push({ name: 'Hard', value: 'IFCBOOLEAN(.T.)' });
      }
      const c2 = task.constraint2;
      if (c2 && c2.type !== 'ASAP') {
        props.push({ name: 'ConstraintType2', value: `IFCLABEL(${ifcStr(c2.type)})` });
        if (c2.date) props.push({ name: 'ConstraintDate2', value: `IFCDATE(${ifcStr(c2.date)})` });
      }
      if (task.deadline) props.push({ name: 'Deadline', value: `IFCDATE(${ifcStr(task.deadline)})` });
      return props;
    },
    apply(task, props) {
      let ctype: string | undefined; let cdate: string | undefined; let hard = false;
      let ctype2: string | undefined; let cdate2: string | undefined;
      for (const { name, value } of props) {
        // Hard is een IFCBOOLEAN — niet overslaan met de string-guard hieronder.
        if (name === 'Hard') { if (value === true) hard = true; continue; }
        if (typeof value !== 'string') continue;
        if (name === 'ConstraintType') ctype = value;
        else if (name === 'ConstraintDate') cdate = value;
        else if (name === 'ConstraintType2') ctype2 = value;
        else if (name === 'ConstraintDate2') cdate2 = value;
        else if (name === 'Deadline') task.deadline = value;
      }
      if (ctype && CONSTRAINT_VALID.includes(ctype as ConstraintType)) {
        task.constraint = {
          type: ctype as ConstraintType,
          ...(cdate ? { date: cdate } : {}),
          ...(hard ? { hard: true } : {}),
        };
      }
      // Secundaire constraint is altijd soft (geen hard-veld).
      if (ctype2 && CONSTRAINT_VALID.includes(ctype2 as ConstraintType)) {
        task.constraint2 = { type: ctype2 as ConstraintType, ...(cdate2 ? { date: cdate2 } : {}) };
      }
    },
  },
  // 2. Fase 2.9 (§4.5/§6) — externe (cross-project) dependencies als één autoritatief JSON-veld.
  {
    name: PSET.ExternalLink, psetSeed: 'pset_extl_', relSeed: 'rel_extl_',
    write(task) {
      const links = task.externalLinks;
      if (!links || links.length === 0) return null;
      return [{ name: 'Links', value: `IFCTEXT(${ifcStr(JSON.stringify(links))})` }];
    },
    apply(task, props) {
      for (const { name, value } of props) {
        if (name !== 'Links' || typeof value !== 'string' || !value) continue;
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed) && parsed.length > 0) task.externalLinks = parsed;
        } catch { /* corrupte JSON: negeren i.p.v. de load te breken. */ }
      }
    },
  },
  // 3. Fase 2.9 (§3.2/§6) — hammock/LOE-vlag (geen native IfcTaskTypeEnum-waarde).
  {
    name: PSET.Hammock, psetSeed: 'pset_hmk_', relSeed: 'rel_hmk_',
    write(task) {
      return task.isHammock ? [{ name: 'IsHammock', value: 'IFCBOOLEAN(.T.)' }] : null;
    },
    apply(task, props) {
      for (const { name, value } of props) if (name === 'IsHammock' && value === true) task.isHammock = true;
    },
  },
  // 4. Fase 2.4 — mijlpaalsoort + verplicht-vlag (IfcTaskTypeEnum kent geen start/finish-onderscheid).
  {
    name: PSET.Milestone, psetSeed: 'pset_ms_', relSeed: 'rel_ms_',
    write(task) {
      if (!task.isMilestone) return null;
      const props: PropSpec[] = [];
      if (task.milestoneKind === 'START' || task.milestoneKind === 'FINISH') {
        props.push({ name: 'MilestoneKind', value: `IFCLABEL(${ifcStr(task.milestoneKind)})` });
      }
      if (task.mandatory) props.push({ name: 'Mandatory', value: 'IFCBOOLEAN(.T.)' });
      return props;
    },
    apply(task, props) {
      for (const { name, value } of props) {
        if (name === 'MilestoneKind' && (value === 'START' || value === 'FINISH')) task.milestoneKind = value;
        else if (name === 'Mandatory' && value === true) task.mandatory = true;
      }
    },
  },
  // 5. Fase 2.5 — nivelleer-vertraging (geen native per-taak-slot; §7.6/§7.7: undefined/0 schrijft niets).
  //    Z14: uitgebreid met de Z0-subdag-precisie (`levelingDelayMinutes`/`levelingDelayElapsed`) —
  //    zelfde pset, twee EXTRA optionele props. Golden rule blijft intact: een taak met alleen het
  //    bestaande `levelingDelay` (hele werkdagen) schrijft byte-identiek dezelfde ÉÉN property als
  //    vóór deze uitbreiding; de twee nieuwe props verschijnen alleen wanneer ze ook echt gezet zijn.
  {
    name: PSET.Leveling, psetSeed: 'pset_lvl_', relSeed: 'rel_lvl_',
    write(task) {
      const props: PropSpec[] = [];
      if (task.levelingDelay) props.push({ name: 'LevelingDelay', value: `IFCINTEGER(${Math.round(task.levelingDelay)})` });
      if (task.levelingDelayMinutes != null) {
        props.push({ name: 'LevelingDelayMinutes', value: `IFCINTEGER(${Math.round(task.levelingDelayMinutes)})` });
      }
      if (task.levelingDelayElapsed) props.push({ name: 'LevelingDelayElapsed', value: 'IFCBOOLEAN(.T.)' });
      return props.length > 0 ? props : null;
    },
    apply(task, props) {
      for (const { name, value } of props) {
        // Boolean-guard vóór een eventuele string-guard (precedent: `Hard` in PSET.Constraints) —
        // hier zijn alle drie de props al zelf-discriminerend per naam, dus geen gedeelde continue-guard.
        if (name === 'LevelingDelay') {
          if (typeof value === 'number' && Number.isFinite(value)) task.levelingDelay = Math.round(value);
        } else if (name === 'LevelingDelayMinutes') {
          if (typeof value === 'number' && Number.isFinite(value)) task.levelingDelayMinutes = Math.round(value);
        } else if (name === 'LevelingDelayElapsed') {
          if (value === true) task.levelingDelayElapsed = true;
        }
      }
    },
  },
  // 6. Fase 2.10 (item 1) — taak-aantekeningen (checklist) als één autoritatief JSON-veld.
  {
    name: PSET.TaskNotes, psetSeed: 'pset_notes_', relSeed: 'rel_notes_',
    write(task) {
      const notes = task.notes;
      if (!notes || notes.length === 0) return null;
      return [{ name: 'Notes', value: `IFCTEXT(${ifcStr(JSON.stringify(notes))})` }];
    },
    apply(task, props) {
      for (const { name, value } of props) {
        if (name !== 'Notes' || typeof value !== 'string' || !value) continue;
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed) && parsed.length > 0) task.notes = parsed;
        } catch { /* corrupte JSON: negeren i.p.v. de load te breken. */ }
      }
    },
  },
  // 7. Fase 3 (H2) — taak-kleur (IfcTask heeft geen native kleur-attribuut).
  {
    name: PSET.TaskAppearance, psetSeed: 'pset_appear_', relSeed: 'rel_appear_',
    write(task) {
      return task.color ? [{ name: 'Color', value: `IFCTEXT(${ifcStr(task.color)})` }] : null;
    },
    apply(task, props) {
      for (const { name, value } of props) if (name === 'Color' && typeof value === 'string' && value) task.color = value;
    },
  },
  // 8. Fase 3 (H2) — fase-2.9-analyse-uitvoer (interfererende float / bijna-kritiek / float-path).
  {
    name: PSET.Analysis, psetSeed: 'pset_ana_', relSeed: 'rel_ana_',
    write(task) {
      const t = task.time;
      const props: PropSpec[] = [];
      if (t.interferingFloat !== undefined) props.push({ name: 'InterferingFloat', value: `IFCREAL(${t.interferingFloat})` });
      if (t.isNearCritical !== undefined) props.push({ name: 'IsNearCritical', value: `IFCBOOLEAN(${ifcBool(t.isNearCritical)})` });
      if (t.floatPath !== undefined) props.push({ name: 'FloatPath', value: `IFCINTEGER(${Math.round(t.floatPath)})` });
      return props;
    },
    apply(task, props) {
      for (const { name, value } of props) {
        if (name === 'InterferingFloat' && typeof value === 'number') task.time.interferingFloat = value;
        else if (name === 'IsNearCritical' && typeof value === 'boolean') task.time.isNearCritical = value;
        else if (name === 'FloatPath' && typeof value === 'number') task.time.floatPath = Math.round(value);
      }
    },
  },
  // 9. Z14 (etappe "nul afwijkingen") — werkonderbrekingen (`Task.splitGaps`, Z4 leest dit uit .mpp
  //    sinds de mpp-lezer de timephased-werksegmenten decodeert). Kopieert het ExternalLink/TaskNotes-
  //    patroon: één autoritatief JSON-veld, golden rule (leeg/afwezig ⇒ niets geschreven), corrupte of
  //    verkeerd-gevormde JSON wordt genegeerd i.p.v. de load te breken (conservatief, T5-precedent:
  //    een extern-stijl bestand zonder deze pset-naam raakt `apply` hier sowieso nooit aan).
  {
    name: PSET.Splits, psetSeed: 'pset_splits_', relSeed: 'rel_splits_',
    write(task) {
      const gaps = task.splitGaps;
      if (!gaps || gaps.length === 0) return null;
      return [{ name: 'Splits', value: `IFCTEXT(${ifcStr(JSON.stringify(gaps))})` }];
    },
    apply(task, props) {
      for (const { name, value } of props) {
        if (name !== 'Splits' || typeof value !== 'string' || !value) continue;
        try {
          const parsed: unknown = JSON.parse(value);
          const isValidGap = (g: unknown): g is TaskSplitGap =>
            !!g && typeof g === 'object'
            && typeof (g as TaskSplitGap).afterMinutes === 'number'
            && typeof (g as TaskSplitGap).gapMinutes === 'number';
          if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(isValidGap)) task.splitGaps = parsed;
        } catch { /* corrupte JSON: negeren i.p.v. de load te breken. */ }
      }
    },
  },
  // 10. Z14 — handmatig-gepland-vlag (`Task.manuallyScheduled`, O3-besluit: gewoon taakveld zoals
  //     isHammock, altijd round-trippend). Kopieert het Hammock-stramien (één boolean, golden rule).
  {
    name: PSET.Manual, psetSeed: 'pset_man_', relSeed: 'rel_man_',
    write(task) {
      return task.manuallyScheduled ? [{ name: 'ManuallyScheduled', value: 'IFCBOOLEAN(.T.)' }] : null;
    },
    apply(task, props) {
      for (const { name, value } of props) {
        // Boolean-guard (precedent: `Hard` in PSET.Constraints) — hier is er maar één prop, maar
        // dezelfde vorm aanhouden voorkomt dat een latere uitbreiding met een string-prop de
        // boolean per ongeluk achter een `typeof value !== 'string'`-continue verstopt.
        if (name === 'ManuallyScheduled') { if (value === true) task.manuallyScheduled = true; }
      }
    },
  },
  // 11. Z14 (Z12-herwerk-signaal) — MSP's eigen resume/stop-instanten (`TaskTime.resume`/`stop`).
  //     Losse getypte props, zelfde vorm als `Deadline` in PSET.Constraints (optionele ISO-datum(tijd)
  //     als IFCTEXT — geen aparte dag/uur-typering nodig, de string is al in de juiste vorm).
  {
    name: PSET.Resume, psetSeed: 'pset_resume_', relSeed: 'rel_resume_',
    write(task) {
      const t = task.time;
      const props: PropSpec[] = [];
      if (t.resume) props.push({ name: 'Resume', value: `IFCTEXT(${ifcStr(t.resume)})` });
      if (t.stop) props.push({ name: 'Stop', value: `IFCTEXT(${ifcStr(t.stop)})` });
      return props.length > 0 ? props : null;
    },
    apply(task, props) {
      for (const { name, value } of props) {
        if (name === 'Resume' && typeof value === 'string' && value) task.time.resume = value;
        else if (name === 'Stop' && typeof value === 'string' && value) task.time.stop = value;
      }
    },
  },
  // 12. Z14b — het Z8-venster, ALLEEN `timephasedFinishFloor`/`timephasedStartAnchor` (twee platte
  //     ISO-strings, geen cross-object-verwijzing). AFGELEIDE sturing (eigenaarsprincipe):
  //     `taskDefaults.ts`'s `clearTimephasedWindow` wist ze bij een inhoudelijke bewerking, dus een
  //     bewerkt-en-opnieuw-opgeslagen taak schrijft dan geen (of minder) props hier — dat is het
  //     bedoelde gedrag, niet een gat. `timephasedDurationWalks` NIET hier: dat veld draagt
  //     `resourceCalendarId`, een APP-INTERNE kalender-verwijzing die bij inlezen een NIEUW,
  //     regenererend id krijgt — een generieke `PerTaskPset` heeft geen toegang tot de kalender-
  //     bibliotheek om die verwijzing (via de kalendernaam, de natuurlijke sleutel) te vertalen.
  //     Zie `writeTimephasedDurationWalksMeta`/`extractTimephasedDurationWalksMeta` (eigen, kleine
  //     JSON-pset `OPS_TimephasedDurationWalks`, spiegelt `OPS_Baselines`' taskId-GUID-remap-precedent).
  {
    name: PSET.Window, psetSeed: 'pset_win_', relSeed: 'rel_win_',
    write(task) {
      const props: PropSpec[] = [];
      if (task.timephasedFinishFloor) props.push({ name: 'FinishFloor', value: `IFCTEXT(${ifcStr(task.timephasedFinishFloor)})` });
      if (task.timephasedStartAnchor) props.push({ name: 'StartAnchor', value: `IFCTEXT(${ifcStr(task.timephasedStartAnchor)})` });
      return props.length > 0 ? props : null;
    },
    apply(task, props) {
      for (const { name, value } of props) {
        if (name === 'FinishFloor' && typeof value === 'string' && value) task.timephasedFinishFloor = value;
        else if (name === 'StartAnchor' && typeof value === 'string' && value) task.timephasedStartAnchor = value;
      }
    },
  },
  // 13. Z14b (eigenaarsprincipe 2026-08-18) — de RAUWE, gedecodeerde contourperiodes
  //     (`Task.timephasedContours`). Eén autoritatief JSON-veld, ExternalLink/TaskNotes/Splits-
  //     patroon — NOOIT gewist door een edit (dat is precies waarom dit een APART pset is van
  //     `Window` hierboven, dat wél kan leeglopen).
  {
    name: PSET.Contours, psetSeed: 'pset_contours_', relSeed: 'rel_contours_',
    write(task) {
      const contours = task.timephasedContours;
      if (!contours || contours.length === 0) return null;
      return [{ name: 'Contours', value: `IFCTEXT(${ifcStr(JSON.stringify(contours))})` }];
    },
    apply(task, props) {
      const isValidPeriod = (p: unknown): p is TimephasedContourPeriod =>
        !!p && typeof p === 'object'
        && typeof (p as TimephasedContourPeriod).afterMinutes === 'number'
        && typeof (p as TimephasedContourPeriod).minutes === 'number'
        && typeof (p as TimephasedContourPeriod).workMinutes === 'number'
        && ((p as TimephasedContourPeriod).kind === 'actual' || (p as TimephasedContourPeriod).kind === 'remaining');
      const isValidContour = (c: unknown): c is TaskTimephasedContour =>
        !!c && typeof c === 'object'
        && (typeof (c as TaskTimephasedContour).resourceUid === 'number' || (c as TaskTimephasedContour).resourceUid === null)
        && Array.isArray((c as TaskTimephasedContour).periods)
        && (c as TaskTimephasedContour).periods.every(isValidPeriod);
      for (const { name, value } of props) {
        if (name !== 'Contours' || typeof value !== 'string' || !value) continue;
        try {
          const parsed: unknown = JSON.parse(value);
          if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(isValidContour)) {
            task.timephasedContours = parsed;
          }
        } catch { /* corrupte JSON: negeren i.p.v. de load te breken. */ }
      }
    },
  },
  // 14. Z14b (eigenaarsbesluit 2026-08-18, punt 1) — MSP's Task Type + Effort-Driven-vlag. Losse
  //     getypte props, zelfde vorm als PSET.Manual (boolean-guard vóór de string-guard, precedent:
  //     `Hard` in PSET.Constraints).
  {
    name: PSET.MspTaskType, psetSeed: 'pset_mtt_', relSeed: 'rel_mtt_',
    write(task) {
      const props: PropSpec[] = [];
      if (task.mspTaskType) props.push({ name: 'MspTaskType', value: `IFCLABEL(${ifcStr(task.mspTaskType)})` });
      if (task.effortDriven) props.push({ name: 'EffortDriven', value: 'IFCBOOLEAN(.T.)' });
      return props.length > 0 ? props : null;
    },
    apply(task, props) {
      const valid: readonly MspTaskType[] = ['FIXED_UNITS', 'FIXED_DURATION', 'FIXED_WORK'];
      for (const { name, value } of props) {
        if (name === 'EffortDriven') { if (value === true) task.effortDriven = true; continue; }
        if (name === 'MspTaskType' && typeof value === 'string' && (valid as readonly string[]).includes(value)) {
          task.mspTaskType = value as MspTaskType;
        }
      }
    },
  },
];

/** Naam → descriptor, voor de reader-dispatch in `extractStructure`. */
export const PER_TASK_PSET_BY_NAME: Map<string, PerTaskPset> =
  new Map(PER_TASK_PSETS.map(d => [d.name, d]));

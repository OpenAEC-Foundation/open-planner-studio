import { Task } from '@/types/task';
import { Sequence } from '@/types/sequence';
import { Resource } from '@/types/resource';
import { ResourceAssignment } from '@/types/resource';
import { Project, SchedulingOptions } from '@/types/project';
import { holidayEndDate, WorkCalendar } from '@/types/calendar';
import { ActivityCodeType, CustomFieldDef, CustomFieldType, CustomFieldValue } from '@/types/structure';
import { Baseline } from '@/types/baseline';
import {
  effectiveCalendarByTask, minutesToClock, minutesToIsoDuration, taskDurationUnitForIo, taskMinutesForWrite,
} from '@/services/subdayIo';
import { effectiveWorkTimeBands } from '@/utils/effectiveWorkTime';
import type { ImportResult } from '@/services/importTypes';
import {
  IFC_TIME_ANCHOR, FIELD_MEASURE, RESOURCE_TYPE_TO_IFC,
} from './ifcConstants';
import { PSET, PER_TASK_PSETS, ifcStr } from './ifcPsets';
import { projectFileBase } from '@/utils/documents';
import {
  IFC_TASK_SLOTS, IFC_TASKTIME_SLOTS, type TaskTimeWriteCtx, type TaskWriteCtx,
} from './ifcTaskSlots';

/** Generate a 22-character IFC GlobalId (simplified). Geëxporteerd zodat de reader (fase 2.6,
 *  `extractBaselines`) baseline-taskId's — die als interne id in de OPS_Baselines-JSON staan —
 *  deterministisch kan terugmappen op de her-gegenereerde taak-id's via de IFCTASK-GlobalId. */
export function ifcGuid(seed: string): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  let result = '';
  for (let i = 0; i < 22; i++) {
    const idx = Math.abs((hash * (i + 1) * 31 + i * 17) % chars.length);
    result += chars[idx];
    hash = ((hash << 3) ^ (hash >> 2) + i) | 0;
  }
  return result;
}

// ifcStr/ifcBool zijn verhuisd naar ./ifcPsets (gedeeld met de per-taak-pset-registry) en worden
// bovenaan geïmporteerd — één bron, geen duplicaat dat kan divergeren.

function ifcDateTime(iso: string): string {
  if (!iso) return '$';
  // Ensure format: 'YYYY-MM-DDT07:00:00' (anker gedeeld met de reader via IFC_TIME_ANCHOR).
  if (iso.length === 10) return `'${iso}T${IFC_TIME_ANCHOR}'`;
  return `'${iso}'`;
}

/** Fase 2.8b (§7.1) — datetime van een UUR-taak: de echte tijd-van-de-dag blijft behouden (geen
 *  synthetisch `T07`-anker). De store bewaart uur-instants als `YYYY-MM-DDTHH:mm` (16 tekens,
 *  `formatInstant`); vul aan tot seconden voor een spec-conforme IfcDateTime. Een (onverwacht)
 *  date-only bij een uur-taak = middernacht. */
function ifcDateTimeHour(iso: string): string {
  if (!iso) return '$';
  if (iso.length === 10) return `'${iso}T00:00:00'`;
  if (iso.length === 16) return `'${iso}:00'`; // YYYY-MM-DDTHH:mm → +seconden
  return `'${iso}'`;
}

function ifcDuration(days: number): string {
  return `'P0Y0M${days}D'`;
}

/** Fase 2.8b (§7.1) — duur van een UUR-taak in minuten als ISO-8601-duur met tijdcomponent
 *  (`PT{h}H{m}M0S`); minuut-precies en byte-stabiel terug te lezen (`isoDurationToMinutes`). */
function ifcDurationHour(minutes: number): string {
  return `'${minutesToIsoDuration(minutes)}'`;
}

interface WriteContext {
  lines: string[];
  nextId: number;
  idMap: Map<string, number>; // our ID -> STEP #id
  /** seed → daadwerkelijk uitgegeven GlobalId (bevinding B8). */
  guids: Map<string, string>;
  /** Alle uitgegeven GlobalIds, om botsingen te detecteren (bevinding B8). */
  usedGuids: Set<string>;
}

/**
 * Geef het GlobalId uit voor `seed` — en garandeer dat het uniek is binnen dit bestand.
 *
 * Bevinding B8: `ifcGuid` is een 32-bits hash, geen UUID en geen conforme IFC-GUID. Over 20.000
 * realistische id's zijn geen botsingen gemeten, maar 32 bits plus een niet-uniforme mixer maakt
 * een verjaardagsbotsing bij tienduizenden id's niet uit te sluiten — en er was geen detectie.
 * Een botsing gaf stille kruisbesmetting van baselines of toewijzingen.
 *
 * Dit is de enige plek die GlobalIds uitgeeft. Botst een hash met een eerder uitgegeven GlobalId,
 * dan wordt er deterministisch doorgezocht met een gesuffixte seed. Zonder botsing is de uitkomst
 * BYTE-IDENTIEK aan `guidOf(ctx, seed)` — bestaande bestanden veranderen dus niet.
 *
 * LET OP de volgorde waarin B8 is aangepakt: de ontkoppeling (de writer schrijft expliciet weg
 * wélk GlobalId hij per taak gebruikte, zie `writeBaselineMeta`) moest EERST. Een botsingscheck
 * zónder die ontkoppeling zou de baseline-remap breken, want de reader herberekende de hash zelf
 * en zou een gesuffixt GlobalId nooit terugvinden.
 */
function guidOf(ctx: WriteContext, seed: string): string {
  const cached = ctx.guids.get(seed);
  if (cached !== undefined) return cached;
  let guid = ifcGuid(seed);
  for (let n = 1; ctx.usedGuids.has(guid); n++) guid = ifcGuid(`${seed}#dup${n}`);
  ctx.guids.set(seed, guid);
  ctx.usedGuids.add(guid);
  return guid;
}

function ref(ctx: WriteContext, key: string): string {
  return `#${ctx.idMap.get(key) || 0}`;
}

function addLine(ctx: WriteContext, key: string, line: string): number {
  const id = ctx.nextId++;
  ctx.idMap.set(key, id);
  // STEP vereist dat elke entity met ';' eindigt — anders parst de reader (ifcReader regex `\)\s*;`) niets.
  ctx.lines.push(`#${id}=${line};`);
  return id;
}

/**
 * Invoer voor `writeIFC` (audit P2, fixt bug B4). Voorheen had `writeIFC` 11 positionele params;
 * callsites die de laatste enkele weglieten (IFCPanel) schreven daardoor stil ONVOLLEDIGE IFC.
 * Eén input-object dwingt volledigheid af via de compiler. Hergebruikt `ImportResult`: de writer
 * heeft exact dezelfde payload nodig als wat de readers teruggeven ⇒ symmetrische round-trip,
 * geen dubbele typedefinitie. De kernvelden zijn verplicht; de optionele vullen we hier met de
 * bestaande defaults (`[]` / `null`).
 */
export type WriteIFCInput = ImportResult;

export function writeIFC(input: WriteIFCInput): string {
  const {
    project, calendar, tasks, sequences, resources, assignments,
    activityCodeTypes = [],
    customFieldDefs = [],
    resourceCalendars = [],
    baselines = [],
    activeBaselineId = null,
    libraryPool = undefined,
  } = input;
  const ctx: WriteContext = { lines: [], nextId: 1, idMap: new Map(), guids: new Map(), usedGuids: new Set() };
  const now = new Date().toISOString().split('.')[0];

  // Header. Naam/auteur/bedrijf MOETEN door `ifcStr` (bevinding K2): ze werden rauw
  // geïnterpoleerd, en dan levert een gewone apostrof al syntactisch ongeldig STEP op
  // (`FILE_NAME('O'Hara Tower.ifc',…)`) terwijl `DATA;`/`ENDSEC;` in de projectnaam die tokens vóór
  // de echte sectiegrens zet ⇒ nul entiteiten, alles weg. Onze eigen reader raakte de header nooit
  // aan, dus dit viel nooit op — een bestand met `Van 't Hof BV` erin hoeft Synchro of BlenderBIM
  // niet te accepteren. Let op de VORM: `ifcStr(x + '.ifc')`, NIET `'${ifcStr(x)}.ifc'` — die
  // laatste zet quotes om de al-gequote waarde heen (`''O''Hara'.ifc'`) en is erger dan het
  // origineel. `ifcStr` geeft `$` bij een lege string; alle drie de waarden hier zijn nooit leeg
  // (`.ifc`-suffix resp. een niet-lege terugval), dus de header houdt altijd echte stringliterals.
  //
  // Quoten alléén is niet genoeg: een REGELEINDE in de projectnaam (haalbaar via een geïmporteerd
  // IFC-bestand en via de MCP-tool `update_project`) belandde rauw in de stringliteral. Dat is
  // ongeldig STEP — een stringliteral loopt per ISO 10303-21 niet over regels heen — en het zet
  // bovendien de tekst ná dat regeleinde aan het begin van een regel, waar een `DATA;` de
  // sectiegrens van elke regel-verankerde lezer verzet. Vandaar `headerText`: regeleindes en
  // andere controltekens worden één spatie. Dit raakt UITSLUITEND de drie headervelden; taaknamen
  // en omschrijvingen in de datasectie gaan ongemoeid door `ifcStr` (daar is de scan quote-bewust
  // en zijn regeleindes onschadelijk).
  // Stuurtekens zijn hier het DOEL van de regex: dit is de header-sanitizer uit K2, die ze
  // onschadelijk maakt vóór ze de STEP-header in gaan.
  // eslint-disable-next-line no-control-regex
  const headerText = (s: string) => s.replace(/[\u0000-\u001F\u007F]+/g, ' ');
  // FILE_NAME[1] is per ISO 10303-21 de BESTANDSNAAM van het uitwisselingsbestand, niet de
  // projectnaam. Een naamloos project leverde daar letterlijk `'.ifc'` op — geen bestandsnaam, en
  // voor een lezer betekenisloos. Vandaar dezelfde neutrale, taalonafhankelijke basis die de
  // opslaan-dialoog voorstelt (`projectFileBase` -> `project.ifc`), zodat header en voorgestelde
  // bestandsnaam dezelfde waarde dragen. De ECHTE projectnaam blijft `IFCPROJECT.Name = $` — dat is
  // de plek waar "geen naam" hoort te staan, en die raken we niet aan.
  const headerFileName = projectFileBase(headerText(project.name)) + '.ifc';
  const header = [
    'ISO-10303-21;',
    'HEADER;',
    "FILE_DESCRIPTION(('ViewDefinition [SchedulingView]'),'2;1');",
    `FILE_NAME(${ifcStr(headerFileName)},${ifcStr(now)},(${ifcStr(headerText(project.author || 'Open Planner Studio'))}),(${ifcStr(headerText(project.company || 'OpenAEC Foundation'))}),'Open Planner Studio 0.1','Open Planner Studio','');`,
    "FILE_SCHEMA(('IFC4X3'));",
    'ENDSEC;',
    'DATA;',
    '',
  ].join('\n');

  // Owner history
  const personId = addLine(ctx, '_person', `IFCPERSON($,${ifcStr(project.author)},$,$,$,$,$,$)`);
  const orgId = addLine(ctx, '_org', `IFCORGANIZATION($,${ifcStr(project.company)},$,$,$)`);
  const personOrgId = addLine(ctx, '_personorg', `IFCPERSONANDORGANIZATION(#${personId},#${orgId},$)`);
  const appOrgId = addLine(ctx, '_apporg', `IFCORGANIZATION($,'OpenAEC Foundation',$,$,$)`);
  const appId = addLine(ctx, '_app', `IFCAPPLICATION(#${appOrgId},'0.1','Open Planner Studio','OPS')`);
  const ownerHistId = addLine(ctx, '_owner', `IFCOWNERHISTORY(#${personOrgId},#${appId},$,.NOCHANGE.,$,$,$,${Math.floor(Date.now() / 1000)})`);

  // Units
  const mId = addLine(ctx, '_m', `IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)`);
  const sId = addLine(ctx, '_s', `IFCSIUNIT(*,.TIMEUNIT.,$,.SECOND.)`);
  const unitAssId = addLine(ctx, '_units', `IFCUNITASSIGNMENT((#${mId},#${sId}))`);

  // Context
  const ptId = addLine(ctx, '_pt', `IFCCARTESIANPOINT((0.,0.,0.))`);
  const axId = addLine(ctx, '_ax', `IFCAXIS2PLACEMENT3D(#${ptId},$,$)`);
  const ctxId = addLine(ctx, '_ctx', `IFCGEOMETRICREPRESENTATIONCONTEXT($,'Plan',3,1.0E-05,#${axId},$)`);

  // Project. Description (arg 3) draagt project.description (fase 3, H2) — de reader leest 'm terug
  // uit de IFCWORKPLAN.Description-slot, met terugval op deze.
  addLine(ctx, '_project', `IFCPROJECT(${ifcStr(guidOf(ctx, project.id))},#${ownerHistId},${ifcStr(project.name)},${ifcStr(project.description)},$,$,$,(#${ctxId}),#${unitAssId})`);

  // Calendar (projectkalender — altijd de EERSTE IFCWORKCALENDAR in het bestand; vaste conventie
  // die de reader aanhoudt om 'm van de bibliotheek-kalenders hieronder te onderscheiden, §8.2).
  const effCalByTask = effectiveCalendarByTask(tasks, calendar, resourceCalendars);
  const hourTaskCalendarIds = new Set(tasks.flatMap((task) => {
    const calendarId = taskDurationUnitForIo(task) === 'hours' ? effCalByTask.get(task.id)?.id : undefined;
    return calendarId ? [calendarId] : [];
  }));
  const { calStepId: projectCalStepId, workingExceptionStepIds: projectWorkingExceptionStepIds }
    = writeCalendar(ctx, calendar, ownerHistId, '_calendar', hourTaskCalendarIds.has(calendar.id));
  writeCalendarGenerationMeta(ctx, projectCalStepId, calendar, ownerHistId, projectWorkingExceptionStepIds);

  // Work plan & schedule
  const startDates = tasks.map(t => t.time.scheduleStart).filter(Boolean).sort();
  const endDates = tasks.map(t => t.time.scheduleFinish).filter(Boolean).sort();
  const planStart = startDates[0] || project.startDate;
  const planEnd = endDates[endDates.length - 1] || project.endDate;

  const workPlanId = addLine(ctx, '_workplan',
    `IFCWORKPLAN(${ifcStr(guidOf(ctx, project.id + '_wp'))},#${ownerHistId},${ifcStr(project.name)},${ifcStr(project.description)},$,$,${ifcDateTime(now)},$,$,$,$,$,${ifcDateTime(planStart)},${ifcDateTime(planEnd)},.PLANNED.)`);

  const workSchedId = addLine(ctx, '_worksched',
    `IFCWORKSCHEDULE(${ifcStr(guidOf(ctx, project.id + '_ws'))},#${ownerHistId},${ifcStr('Construction schedule v1.0')},$,$,$,${ifcDateTime(now)},$,$,$,$,$,${ifcDateTime(planStart)},${ifcDateTime(planEnd)},.PLANNED.)`);

  // Baselines (fase 2.6, §8.3) — per baseline één `.BASELINE.`-IfcWorkSchedule-header (Name +
  // CreationDate, ZONDER taak-duplicatie: de datums leven verliesloos in het OPS_Baselines-JSON
  // hieronder). Puur een interop-signaal "deze baselines bestaan" voor externe IFC-tools.
  // Golden rule: geen baselines ⇒ geen extra IfcWorkSchedule (de lus doet niets).
  const baselineSchedRefs: string[] = [];
  for (const b of baselines) {
    const bId = addLine(ctx, `_baseline_ws_${b.id}`,
      `IFCWORKSCHEDULE(${ifcStr(guidOf(ctx, 'baseline_ws_' + b.id))},#${ownerHistId},${ifcStr(b.name)},$,$,$,${ifcDateTime(b.createdAt)},$,$,$,$,$,$,${ifcDateTime(b.projectEnd)},.BASELINE.)`);
    baselineSchedRefs.push(`#${bId}`);
  }

  const schedRefs = [`#${workSchedId}`, ...baselineSchedRefs].join(',');
  addLine(ctx, '_agg_plan_sched',
    `IFCRELAGGREGATES(${ifcStr(guidOf(ctx, 'agg_ps'))},#${ownerHistId},$,$,#${workPlanId},(${schedRefs}))`);

  // Tasks. Fase 2.8b (§7.1): per taak de effectieve kalender bepaalt uur- vs dag-modus
  // (uur ⇒ echte tijden + minuut-duren; dag ⇒ byte-identiek `T07:00:00` + `P0Y0M{days}D`).
  for (const task of tasks) {
    const effCal = effCalByTask.get(task.id);
    writeTask(ctx, task, ownerHistId, project.statusDate, taskDurationUnitForIo(task) === 'hours', effCal?.hoursPerDay ?? calendar.hoursPerDay);
  }

  // WBS nesting
  writeWBSNesting(ctx, tasks, ownerHistId);

  // Root tasks -> schedule nesting
  const rootTasks = tasks.filter(t => !t.parentId);
  if (rootTasks.length > 0) {
    const rootRefs = rootTasks.map(t => ref(ctx, `task_${t.id}`)).join(',');
    addLine(ctx, '_nest_sched',
      `IFCRELNESTS(${ifcStr(guidOf(ctx, 'nest_root'))},#${ownerHistId},'WBS Hoofd',$,#${workSchedId},(${rootRefs}))`);
  }

  // Sequences
  for (const seq of sequences) {
    writeSequence(ctx, seq, ownerHistId);
  }

  // Resources
  for (const res of resources) {
    writeResource(ctx, res, ownerHistId);
  }
  writeResourceMeta(ctx, resources, ownerHistId);
  writeCrewNesting(ctx, resources, ownerHistId);
  // Kalender-bibliotheek (fase 2.8a, §8.2): de projectkalender-entry (id === project.calendarId)
  // is hierboven al als eerste IFCWORKCALENDAR geschreven — uitsluiten voorkomt een duplicaat nu
  // `resourceCalendars` de VOLLEDIGE bibliotheek is (incl. de §4.3-gemigreerde projectentry).
  writeCalendarLibrary(
    ctx, resources, tasks,
    resourceCalendars.filter(c => c.id !== project.calendarId),
    ownerHistId,
    hourTaskCalendarIds,
  );

  // Resource assignments
  writeAssignments(ctx, assignments, ownerHistId);
  writeAssignmentMeta(ctx, tasks, assignments, ownerHistId);
  // Z14 (etappe "nul afwijkingen") — timephased-venster (`workWindowStart`/`Finish`, Z0-veld) als
  // eigen OPS_Timephased-JSON-pset, NAAST (niet in) het OPS_Assignments-pipe-formaat hierboven.
  writeTimephasedMeta(ctx, tasks, assignments, ownerHistId);
  // Z14b (Z8-nataak) — LAAG-4-kalenderwandelingen, eigen pset (kalendernaam-vertaling, zie de
  // functie se eigen moduleheader voor waarom dit niet via PER_TASK_PSETS kan).
  writeTimephasedDurationWalksMeta(ctx, tasks, ownerHistId);

  // Tasks -> WorkSchedule control
  if (tasks.length > 0) {
    const allTaskRefs = tasks.map(t => ref(ctx, `task_${t.id}`)).join(',');
    addLine(ctx, '_ctrl',
      `IFCRELASSIGNSTOCONTROL(${ifcStr(guidOf(ctx, 'ctrl'))},#${ownerHistId},$,$,(${allTaskRefs}),$,#${workSchedId})`);
  }

  // Structuurdefinities (activity codes / custom fields) + waarden per taak + projectsettings
  writeStructure(ctx, project, tasks, activityCodeTypes, customFieldDefs, ownerHistId);
  // Bedrijfsbibliotheek-pool (spec B1, §4): alleen een pool-BESTAND draagt dit; anders undefined ⇒ niets.
  writeLibraryPool(ctx, ownerHistId, libraryPool);

  // De per-taak-psets (Constraints/ExternalLink/Hammock/Milestone/Leveling/TaskNotes/
  // TaskAppearance) via de gedeelde registry (ifcPsets.PER_TASK_PSETS). De volgorde in de
  // registry spiegelt de vroegere aanroepvolgorde ⇒ byte-identieke STEP-uitvoer. Reader-kant zit in
  // dezelfde descriptors (apply), gedispatcht in extractStructure. OPS_Analysis wordt bewust NIET
  // meer geschreven (afgeleide runCPM-uitvoer) — zie WRITTEN_PER_TASK_PSETS hieronder.
  emitPerTaskPsets(ctx, tasks, ownerHistId);
  // Baselines (fase 2.6): OPS_Baselines-pset (JSON autoritair) op de IfcWorkSchedule
  writeBaselineMeta(ctx, workSchedId, baselines, activeBaselineId, ownerHistId);
  // Scheduling-options (fase 2.9, §3.4/§6): OPS_SchedulingOptions-pset (JSON autoritair) op de IfcWorkSchedule
  writeSchedulingOptionsMeta(ctx, workSchedId, project.schedulingOptions, ownerHistId);

  // Footer
  const footer = '\nENDSEC;\nEND-ISO-10303-21;\n';

  return header + ctx.lines.join('\n') + footer;
}

// FIELD_MEASURE (IfcSimplePropertyTemplate.PrimaryMeasureType per custom-field-type) is verhuisd
// naar ./ifcConstants zodat de reader er de inverse uit afleidt (geen stille divergentie).

function ifcTypedValue(type: CustomFieldType, value: CustomFieldValue): string {
  switch (type) {
    case 'text': return `IFCTEXT(${ifcStr(String(value))})`;
    case 'number': return `IFCREAL(${Number(value)})`;
    case 'integer': return `IFCINTEGER(${Math.round(Number(value))})`;
    case 'cost': return `IFCMONETARYMEASURE(${Number(value)})`;
    case 'date': return `IFCDATE(${ifcStr(String(value))})`;
    case 'boolean': return `IFCBOOLEAN(${value ? '.T.' : '.F.'})`;
    default: {
      // Exhaustiviteitscheck: een nieuw CustomFieldType zonder eigen case geeft hier een
      // COMPILE-fout (het valt dan niet meer onder `never`). Zo kan de writer nooit stil een
      // veld overslaan — geen gedragswijziging voor de bestaande waardetypen (die keren hierboven).
      const _exhaustive: never = type;
      throw new Error(`Onbekend custom-field-type: ${String(_exhaustive)}`);
    }
  }
}

/**
 * Fase 2.2 — structuur naar IFC 4.3 (zie ontwerpdoc §2):
 *  - definities als IFCPROPERTYSETTEMPLATE + IFCSIMPLEPROPERTYTEMPLATE (P_SINGLEVALUE voor
 *    custom fields met PrimaryMeasureType; P_ENUMERATEDVALUE + IFCPROPERTYENUMERATION voor
 *    activity-code-types), gedeclareerd aan het project via IFCRELDECLARES — leesbaar voor
 *    conformante IFC-tools;
 *  - daarnaast één OPS_StructureMeta-pset met de volledige definitie-JSON (autoritair voor
 *    onze eigen reader: behoudt ids/kleuren/omschrijvingen verliesloos);
 *  - waarden per taak als eigen psets OPS_CustomFields (IFCPROPERTYSINGLEVALUE, getypeerd)
 *    en OPS_ActivityCodes (IFCPROPERTYENUMERATEDVALUE), via IFCRELDEFINESBYPROPERTIES;
 *  - OPS_ProjectSettings-pset op het project (wbsAutoNumber).
 * Identiteit in de psets is de NAAM (type-/veldnaam); de reader mapt namen terug naar ids
 * via de meta-JSON (of mint verse ids bij bestanden van derden).
 */
function writeStructure(
  ctx: WriteContext,
  project: Project,
  tasks: Task[],
  activityCodeTypes: ActivityCodeType[],
  customFieldDefs: CustomFieldDef[],
  ownerHistId: number,
): void {
  const projRef = ref(ctx, '_project');
  const relDefines = (key: string, objRef: string, setId: number) =>
    addLine(ctx, key,
      `IFCRELDEFINESBYPROPERTIES(${ifcStr(guidOf(ctx, key))},#${ownerHistId},$,$,(${objRef}),#${setId})`);

  // Projectsettings — wbsAutoNumber (fase 2.2) + statusDate/progressMode (fase 2.6, §8.2).
  // Golden rule: elk veld alleen wanneer gezet; geen enkel veld ⇒ geen OPS_ProjectSettings-pset.
  const projSettingProps: number[] = [];
  if (project.wbsAutoNumber !== undefined) {
    projSettingProps.push(addLine(ctx, '_ps_wbsauto',
      `IFCPROPERTYSINGLEVALUE('wbsAutoNumber',$,IFCBOOLEAN(${project.wbsAutoNumber ? '.T.' : '.F.'}),$)`));
  }
  if (project.defaultTaskDurationUnit) {
    projSettingProps.push(addLine(ctx, '_ps_defaultdurationunit',
      `IFCPROPERTYSINGLEVALUE('DefaultTaskDurationUnit',$,IFCLABEL(${ifcStr(project.defaultTaskDurationUnit)}),$)`));
  }
  if (project.statusDate) {
    projSettingProps.push(addLine(ctx, '_ps_statusdate',
      `IFCPROPERTYSINGLEVALUE('StatusDate',$,IFCDATE(${ifcStr(project.statusDate)}),$)`));
  }
  // ProgressMode alleen als afwijkend van de default RETAINED_LOGIC (golden rule §8.2).
  if (project.progressMode && project.progressMode !== 'RETAINED_LOGIC') {
    projSettingProps.push(addLine(ctx, '_ps_progressmode',
      `IFCPROPERTYSINGLEVALUE('ProgressMode',$,IFCLABEL(${ifcStr(project.progressMode)}),$)`));
  }
  // CreatedAt/ModifiedAt (fase 3, H2): project-tijdstempels als verbatim ISO-instant. Bewust in het
  // OPS_ProjectSettings-pset i.p.v. de native IFCOWNERHISTORY-slots (IfcTimeStamp): (1) elk bestaand
  // bestand draagt in OwnerHistory al een schrijf-tijdstempel, dus dat slot teruglezen zou createdAt
  // van álle oude bestanden stilletjes wijzigen (breekt "identiek laden"); (2) IfcTimeStamp is
  // gehele-seconden en zou de millisecondeprecisie van de ISO-string afkappen; (3) createdAt/
  // modifiedAt zijn project-metadata en horen bij de andere project-settings. Golden rule: alleen
  // wanneer gezet — een leeg veld schrijft niets (oude bestanden byte-identiek).
  // ProjectStartDate/ProjectEndDate — de CONTRACTUELE projectdatums. Bewust hier en niet in de
  // IFCWORKPLAN.StartTime/FinishTime-slots: die dragen de AFGELEIDE plan-omvang (min/max van de
  // taak-span), wat semantisch juist is en door andere IFC-tools zo gelezen wordt. Vóór dit pset
  // was dat ene slot de enige opslag voor beide betekenissen, waardoor opslaan+herladen een
  // ingevulde contractuele einddatum verving door de afgeleide planningsdatum.
  //
  // AFWIJKING van de golden rule hierboven ("alleen schrijven wat gezet is"): deze twee worden
  // ALTIJD geschreven, ook leeg. Een leeg veld weglaten zou de lezer terug laten vallen op het
  // WORKPLAN-slot, en dan vult de afgeleide datum alsnog een bewust léég gelaten einddatum —
  // dezelfde bug, alleen verplaatst naar het lege geval. Codering: waarde gezet ⇒ IFCDATE(...),
  // leeg ⇒ NominalValue `$` ("aanwezig, maar geen waarde"). Zo kan de lezer "veld aanwezig maar
  // leeg" onderscheiden van "veld afwezig" (= bestand van vóór deze versie of van een ander tool,
  // dat terugvalt op het WORKPLAN-slot en zich dus exact gedraagt als voorheen).
  const contractDateProp = (key: string, name: string, value: string): number =>
    addLine(ctx, key,
      `IFCPROPERTYSINGLEVALUE(${ifcStr(name)},$,${value ? `IFCDATE(${ifcStr(value)})` : '$'},$)`);
  projSettingProps.push(contractDateProp('_ps_projstart', 'ProjectStartDate', project.startDate));
  projSettingProps.push(contractDateProp('_ps_projend', 'ProjectEndDate', project.endDate));

  if (project.createdAt) {
    projSettingProps.push(addLine(ctx, '_ps_createdat',
      `IFCPROPERTYSINGLEVALUE('CreatedAt',$,IFCTEXT(${ifcStr(project.createdAt)}),$)`));
  }
  if (project.modifiedAt) {
    projSettingProps.push(addLine(ctx, '_ps_modifiedat',
      `IFCPROPERTYSINGLEVALUE('ModifiedAt',$,IFCTEXT(${ifcStr(project.modifiedAt)}),$)`));
  }
  // Projectbinding aan een bedrijfsbibliotheek (spec B1, §6). Golden rule: alleen wanneer gebonden.
  if (project.companyId) {
    projSettingProps.push(addLine(ctx, '_ps_companyid',
      `IFCPROPERTYSINGLEVALUE('CompanyId',$,IFCTEXT(${ifcStr(project.companyId)}),$)`));
  }
  if (project.companyName) {
    projSettingProps.push(addLine(ctx, '_ps_companyname',
      `IFCPROPERTYSINGLEVALUE('CompanyName',$,IFCTEXT(${ifcStr(project.companyName)}),$)`));
  }
  if (projSettingProps.length > 0) {
    const setId = addLine(ctx, '_pset_projset',
      `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'pset_projset'))},#${ownerHistId},${ifcStr(PSET.ProjectSettings)},$,(${projSettingProps.map(i => `#${i}`).join(',')}))`);
    relDefines('_rel_projset', projRef, setId);
  }

  if (activityCodeTypes.length === 0 && customFieldDefs.length === 0) return;

  // Autoritaire meta-JSON (verliesloos: ids, kleuren, omschrijvingen).
  const metaJson = JSON.stringify({ activityCodeTypes, customFieldDefs });
  const metaPropId = addLine(ctx, '_ps_structmeta',
    `IFCPROPERTYSINGLEVALUE('structure',$,IFCTEXT(${ifcStr(metaJson)}),$)`);
  const metaSetId = addLine(ctx, '_pset_structmeta',
    `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'pset_structmeta'))},#${ownerHistId},${ifcStr(PSET.StructureMeta)},$,(#${metaPropId}))`);
  relDefines('_rel_structmeta', projRef, metaSetId);

  // Conformante templates + declaratie aan het project.
  const templateIds: number[] = [];
  if (customFieldDefs.length > 0) {
    const fieldTmplRefs = customFieldDefs.map(def => {
      const id = addLine(ctx, `_cft_${def.id}`,
        `IFCSIMPLEPROPERTYTEMPLATE(${ifcStr(guidOf(ctx, 'cft_' + def.id))},#${ownerHistId},${ifcStr(def.name)},$,.P_SINGLEVALUE.,${ifcStr(FIELD_MEASURE[def.type])},$,$,$,$,$,$)`);
      return `#${id}`;
    });
    templateIds.push(addLine(ctx, '_psett_fields',
      `IFCPROPERTYSETTEMPLATE(${ifcStr(guidOf(ctx, 'psett_fields'))},#${ownerHistId},${ifcStr(PSET.CustomFields)},$,.PSET_OCCURRENCEDRIVEN.,'IfcTask',(${fieldTmplRefs.join(',')}))`));
  }
  if (activityCodeTypes.length > 0) {
    const codeTmplRefs = activityCodeTypes.map(t => {
      const labels = t.values.map(v => `IFCLABEL(${ifcStr(v.code)})`).join(',');
      const enumId = addLine(ctx, `_acte_${t.id}`,
        `IFCPROPERTYENUMERATION(${ifcStr(t.name)},(${labels}),$)`);
      const id = addLine(ctx, `_actt_${t.id}`,
        `IFCSIMPLEPROPERTYTEMPLATE(${ifcStr(guidOf(ctx, 'actt_' + t.id))},#${ownerHistId},${ifcStr(t.name)},$,.P_ENUMERATEDVALUE.,$,$,#${enumId},$,$,$,$)`);
      return `#${id}`;
    });
    templateIds.push(addLine(ctx, '_psett_codes',
      `IFCPROPERTYSETTEMPLATE(${ifcStr(guidOf(ctx, 'psett_codes'))},#${ownerHistId},${ifcStr(PSET.ActivityCodes)},$,.PSET_OCCURRENCEDRIVEN.,'IfcTask',(${codeTmplRefs.join(',')}))`));
  }
  if (templateIds.length > 0) {
    addLine(ctx, '_decl_templates',
      `IFCRELDECLARES(${ifcStr(guidOf(ctx, 'decl_templates'))},#${ownerHistId},$,$,${projRef},(${templateIds.map(i => `#${i}`).join(',')}))`);
  }

  // Waarden per taak.
  const typeById = new Map(activityCodeTypes.map(t => [t.id, t]));
  const defById = new Map(customFieldDefs.map(d => [d.id, d]));
  for (const task of tasks) {
    const fieldEntries = Object.entries(task.customFields ?? {}).filter(([defId]) => defById.has(defId));
    if (fieldEntries.length > 0) {
      const propRefs = fieldEntries.map(([defId, value]) => {
        const def = defById.get(defId)!;
        const id = addLine(ctx, `_cfv_${task.id}_${defId}`,
          `IFCPROPERTYSINGLEVALUE(${ifcStr(def.name)},$,${ifcTypedValue(def.type, value)},$)`);
        return `#${id}`;
      });
      const setId = addLine(ctx, `_pset_cf_${task.id}`,
        `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'pset_cf_' + task.id))},#${ownerHistId},${ifcStr(PSET.CustomFields)},$,(${propRefs.join(',')}))`);
      relDefines(`_rel_cf_${task.id}`, ref(ctx, `task_${task.id}`), setId);
    }

    const codeEntries = Object.entries(task.activityCodes ?? {}).filter(([typeId, valueId]) => {
      const t = typeById.get(typeId);
      return !!t && t.values.some(v => v.id === valueId);
    });
    if (codeEntries.length > 0) {
      const propRefs = codeEntries.map(([typeId, valueId]) => {
        const t = typeById.get(typeId)!;
        const v = t.values.find(x => x.id === valueId)!;
        const id = addLine(ctx, `_acv_${task.id}_${typeId}`,
          `IFCPROPERTYENUMERATEDVALUE(${ifcStr(t.name)},$,(IFCLABEL(${ifcStr(v.code)})),$)`);
        return `#${id}`;
      });
      const setId = addLine(ctx, `_pset_ac_${task.id}`,
        `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'pset_ac_' + task.id))},#${ownerHistId},${ifcStr(PSET.ActivityCodes)},$,(${propRefs.join(',')}))`);
      relDefines(`_rel_ac_${task.id}`, ref(ctx, `task_${task.id}`), setId);
    }
  }
}

/**
 * Spec B1, §4 — de VOLLEDIGE pool als één autoritatief JSON-blob in het `OPS_Library`-pset op het
 * IfcProject (patroon `OPS_StructureMeta`: één IFCTEXT-property, verliesloos, incl. ids en versie).
 * Alleen een pool-BESTAND draagt dit; een gewoon projectbestand roept dit met `undefined` aan ⇒
 * niets geschreven (golden rule, byte-identiek). De IFCWORKCALENDAR/resource-entiteiten in het
 * bestand blijven voor derden leesbaar, maar deze JSON is voor ONZE reader de bron van waarheid.
 */
function writeLibraryPool(
  ctx: WriteContext,
  ownerHistId: number,
  pool: import('@/types/library').CompanyPool | undefined,
): void {
  if (!pool) return;
  const projRef = ref(ctx, '_project');
  const json = JSON.stringify(pool);
  const propId = addLine(ctx, '_ps_library',
    `IFCPROPERTYSINGLEVALUE('pool',$,IFCTEXT(${ifcStr(json)}),$)`);
  const setId = addLine(ctx, '_pset_library',
    `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'pset_library'))},#${ownerHistId},${ifcStr(PSET.Library)},$,(#${propId}))`);
  addLine(ctx, '_rel_library',
    `IFCRELDEFINESBYPROPERTIES(${ifcStr(guidOf(ctx, 'rel_library'))},#${ownerHistId},$,$,(${projRef}),#${setId})`);
}

/**
 * `OPS_Analysis` (interferingFloat / isNearCritical / floatPath) wordt BEWUST NIET MEER GESCHREVEN.
 * Die drie velden zijn pure uitvoer van `runCPM` (scheduleAnalysis) — geen gebruikersinvoer — en
 * werden bit-exact gereproduceerd door elk laadpad (alle laadpaden gaan via `applyLoadedProject`
 * met `recompute: true` ⇒ `runCPM()`; recovery-herstel rekent zelf door). Ze kostten ~157 kB over
 * de publieke voorbeeldset en ~21% van elke auto-save-schrijfactie (elke 800 ms per document).
 * De LEESkant blijft intact: bestaande bestanden mét `OPS_Analysis` laden gewoon (de descriptor
 * staat nog in `PER_TASK_PSET_BY_NAME`, waar ifcReader op dispatcht) — `runCPM` overschrijft de
 * gelezen waarden daarna toch.
 */
const WRITTEN_PER_TASK_PSETS = PER_TASK_PSETS.filter(d => d.name !== PSET.Analysis);

/**
 * Fase 3 (P11) — schrijf de per-taak-psets via de gedeelde registry (ifcPsets.PER_TASK_PSETS),
 * minus de afgeleide `OPS_Analysis` (zie hierboven).
 * Elk descriptor levert de property-lijst (`write`); een lege/`null`-lijst = golden rule ⇒ niets
 * geschreven (bit-gelijk met bestaande bestanden). De buitenlus over de registry-VOLGORDE en de
 * binnenlus over `tasks` reproduceren exact de vroegere aanroepvolgorde van writeConstraints/
 * writeExternalLinks/writeHammockMeta/writeMilestoneMeta/writeLevelingMeta/writeTaskNotes/
 * writeTaskAppearance ⇒ byte-identieke STEP-uitvoer. De read-kant leeft in
 * dezelfde descriptors (`apply`), gedispatcht in ifcReader.extractStructure.
 */
function emitPerTaskPsets(ctx: WriteContext, tasks: Task[], ownerHistId: number): void {
  for (const desc of WRITTEN_PER_TASK_PSETS) {
    for (const task of tasks) {
      const specs = desc.write(task);
      if (!specs || specs.length === 0) continue;
      const propRefs = specs.map((s, i) =>
        `#${addLine(ctx, `_prop_${desc.name}_${task.id}_${i}`,
          `IFCPROPERTYSINGLEVALUE(${ifcStr(s.name)},$,${s.value},$)`)}`);
      const setId = addLine(ctx, `_pset_${desc.name}_${task.id}`,
        `IFCPROPERTYSET(${ifcStr(guidOf(ctx, desc.psetSeed + task.id))},#${ownerHistId},${ifcStr(desc.name)},$,(${propRefs.join(',')}))`);
      addLine(ctx, `_rel_${desc.name}_${task.id}`,
        `IFCRELDEFINESBYPROPERTIES(${ifcStr(guidOf(ctx, desc.relSeed + task.id))},#${ownerHistId},$,$,(${ref(ctx, `task_${task.id}`)}),#${setId})`);
    }
  }
}

/**
 * Fase 2.6 — baselines als `OPS_Baselines`-pset op de `IfcWorkSchedule` (§8.3, spiegel van het
 * `OPS_StructureMeta`-dubbelspoor + `writeLevelingMeta`-patroon). Eén `IFCPROPERTYSINGLEVALUE`
 * met de volledige `JSON.stringify(baselines)` (autoritair en verliesloos — dit is de bron die
 * de reader gebruikt) + een `ActiveBaselineId`-property. Golden rule: geen baselines ⇒ geen pset.
 * De per-baseline `.BASELINE.`-IfcWorkSchedule-headers (interop-signaal) staan al bij het
 * werkplan/-schema hierboven; deze pset draagt de datums.
 */
function writeBaselineMeta(
  ctx: WriteContext,
  workSchedId: number,
  baselines: Baseline[],
  activeBaselineId: string | null,
  ownerHistId: number,
): void {
  if (baselines.length === 0) return;
  const json = JSON.stringify(baselines);
  const props: number[] = [];
  props.push(addLine(ctx, '_ps_baselines_json',
    `IFCPROPERTYSINGLEVALUE('Baselines',$,IFCTEXT(${ifcStr(json)}),$)`));
  // Bevinding B8, stap 1 — DE ONTKOPPELING, en die moet vóór de botsingscheck komen.
  //
  // De baseline-JSON draagt INTERNE taak-id's. De reader mapte die terug door zelf `ifcGuid(taskId)`
  // te herberekenen en dat te vergelijken met de GlobalId's in het bestand. Daarmee was de kwaliteit
  // van de hash semantisch dragend: een botsing gaf stille kruisbesmetting tussen baselines, en een
  // gesuffixt GlobalId (wat `guidOf` bij een botsing uitgeeft) zou de reader nooit terugvinden.
  //
  // We schrijven daarom expliciet wég welk GlobalId deze writer per baseline-taak gebruikte. De
  // reader leest die map en herberekent niets meer; de hash is dan alleen nog een naamgenerator.
  // Alleen de taak-id's die in baselines voorkomen — de map blijft zo klein en de golden rule
  // ("alleen schrijven wat nodig is") overeind.
  const baselineTaskGuids: Record<string, string> = {};
  for (const b of baselines) {
    for (const bt of b.tasks ?? []) {
      if (bt.taskId) baselineTaskGuids[bt.taskId] = guidOf(ctx, bt.taskId);
    }
  }
  if (Object.keys(baselineTaskGuids).length > 0) {
    props.push(addLine(ctx, '_ps_baselines_guids',
      `IFCPROPERTYSINGLEVALUE('TaskGuids',$,IFCTEXT(${ifcStr(JSON.stringify(baselineTaskGuids))}),$)`));
  }
  if (activeBaselineId) {
    props.push(addLine(ctx, '_ps_baselines_active',
      `IFCPROPERTYSINGLEVALUE('ActiveBaselineId',$,IFCTEXT(${ifcStr(activeBaselineId)}),$)`));
  }
  const setId = addLine(ctx, '_pset_baselines',
    `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'pset_baselines'))},#${ownerHistId},${ifcStr(PSET.Baselines)},$,(${props.map(i => `#${i}`).join(',')}))`);
  addLine(ctx, '_rel_baselines',
    `IFCRELDEFINESBYPROPERTIES(${ifcStr(guidOf(ctx, 'rel_baselines'))},#${ownerHistId},$,$,(#${workSchedId}),#${setId})`);
}

/**
 * Fase 2.9 (§3.4/§6) — het volledige `schedulingOptions`-blok als één `OPS_SchedulingOptions`-pset
 * op de `IfcWorkSchedule` (exact het OPS_Baselines-patroon: één autoritatief JSON-veld ⇒ verliesloze
 * round-trip van álle sub-opties, ook wat P6/MSPDI niet native kunnen). Golden rule: afwezig of leeg
 * blok ⇒ geen pset (bit-gelijk met bestaande bestanden).
 */
function writeSchedulingOptionsMeta(
  ctx: WriteContext,
  workSchedId: number,
  options: SchedulingOptions | undefined,
  ownerHistId: number,
): void {
  if (!options || Object.keys(options).length === 0) return;
  const json = JSON.stringify(options);
  const propId = addLine(ctx, '_ps_schedopts',
    `IFCPROPERTYSINGLEVALUE('SchedulingOptions',$,IFCTEXT(${ifcStr(json)}),$)`);
  const setId = addLine(ctx, '_pset_schedopts',
    `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'pset_schedopts'))},#${ownerHistId},${ifcStr(PSET.SchedulingOptions)},$,(#${propId}))`);
  addLine(ctx, '_rel_schedopts',
    `IFCRELDEFINESBYPROPERTIES(${ifcStr(guidOf(ctx, 'rel_schedopts'))},#${ownerHistId},$,$,(#${workSchedId}),#${setId})`);
}

/** Fase 2.8b (§7.1) — `IfcWorkCalendar.PredefinedType` uit `calendar.shift`. CONVENTIE: buildingSMART
 *  definieert de dag/avond/nacht-semantiek van `.FIRSTSHIFT./.SECONDSHIFT./.THIRDSHIFT.` NIET
 *  (Rapport B §4.5, UNVERIFIED) — OPS gebruikt ze als ploeg-classificatie. Afwezig/FIRST ⇒
 *  `.FIRSTSHIFT.` (byte-identiek met bestaande bestanden). */
function shiftToPredefinedType(shift: WorkCalendar['shift']): string {
  switch (shift) {
    case 'SECOND': return '.SECONDSHIFT.';
    case 'THIRD': return '.THIRDSHIFT.';
    case 'USERDEFINED': return '.USERDEFINED.';
    default: return '.FIRSTSHIFT.';
  }
}

/** Terugkeerwaarde van `writeCalendar` (fase 3.8, T5-herziening): naast het STEP-id van de
 *  `IFCWORKCALENDAR` zelf ook de STEP-ids van de werkende-uitzondering-`IFCWORKTIME`'s, zodat
 *  `writeCalendarGenerationMeta` die als OPS-discriminator kan wegschrijven (zie aldaar). */
interface WriteCalendarResult {
  calStepId: number;
  workingExceptionStepIds: number[];
}

function writeCalendar(
  ctx: WriteContext,
  cal: WorkCalendar,
  ownerHistId: number,
  key: string = '_calendar',
  includeEffectiveScalarBands = false,
): WriteCalendarResult {
  // Work time recurrence (weekdays)
  const dayNums = cal.workDays.join(',');
  let timePeriodRefs: string;
  const workTime = cal.workTime ?? (includeEffectiveScalarBands ? effectiveWorkTimeBands(cal) : undefined);
  if (workTime) {
    // Fase 2.8b (§7.1): UUR-kalender ⇒ `TimePeriods` als LIJST van per-dag-banden
    // (`IfcRecurrencePattern.TimePeriods` is native een lijst). Eén band ⇒ ongewijzigde output
    // (byte-identiek). IFC's enkele recurrence draagt één set periodes voor alle DayComponent-dagen;
    // we schrijven de banden van de eerste werkdag (uniform-over-de-week-conventie, §3.2). Een
    // wrap-band (`end > 1440`) emitteert het eind als tijd-van-de-dag (`end % 1440`), waaruit de
    // reader de wrap herkent (`end ≤ start`).
    const firstDay = cal.workDays[0] as 1 | 2 | 3 | 4 | 5 | 6 | 7 | undefined;
    const bands = (firstDay && workTime.byWeekday[firstDay]) || [];
    const ids = bands.map((b) =>
      addLine(ctx, '_timeperiod', `IFCTIMEPERIOD('${minutesToClock(b.start)}','${minutesToClock(b.end)}')`),
    );
    timePeriodRefs = ids.map((i) => `#${i}`).join(',');
  } else {
    const startTime = `${String(cal.workStartHour).padStart(2, '0')}:00:00`;
    const endTime = `${String(cal.workEndHour).padStart(2, '0')}:00:00`;
    const timePeriodId = addLine(ctx, '_timeperiod', `IFCTIMEPERIOD('${startTime}','${endTime}')`);
    timePeriodRefs = `#${timePeriodId}`;
  }
  const recurrenceId = addLine(ctx, '_recurrence', `IFCRECURRENCEPATTERN(.WEEKLY.,$,(${dayNums}),$,$,$,$,(${timePeriodRefs}))`);
  // Engelstalig label (#39): dit belandt in ELK opgeslagen IFC-bestand, ook bij een gebruiker die
  // de app in het Duits of Japans draait — en IFC is een Engelstalige standaard, dus een Nederlands
  // label is hier vreemde eend. Veilig te wijzigen: de lezer gebruikt van dit "hoofd"-IFCWORKTIME
  // alleen args[3] (de RecurrencePattern-ref), nooit de naam. Let op het verschil met de
  // FEESTDAG-IFCWORKTIME's in ExceptionTimes: dáár leest de lezer args[0] wél, als feestdagnaam —
  // die komen uit `cal.holidays` en staan hier los van.
  const workTimeId = addLine(ctx, '_worktime', `IFCWORKTIME('Standard work week',.PREDICTED.,$,#${recurrenceId},$,$)`);

  // Holidays as exception times
  const holidayRefs: string[] = [];
  for (const holiday of cal.holidays) {
    const hId = addLine(ctx, `_holiday_${holiday.name}`,
      `IFCWORKTIME(${ifcStr(holiday.name)},.PREDICTED.,$,$,'${holiday.startDate}','${holidayEndDate(holiday)}')`);
    holidayRefs.push(`#${hId}`);
  }

  // Werkende uitzonderingen als exception times (fase 3.8, T5 — HERZIEN 2026-08-15 na
  // spec-reviewbevinding: zie het plandocument §T5). Zelfde `ExceptionTimes`-lijst als de
  // feestdagen hierboven; de banden blijven als datadrager in een RecurrencePattern staan
  // (`TimePeriods`, args[7]; DayComponent, args[2], blijft `$` — een enkele datumrange heeft geen
  // weekdag-patroon nodig). MAAR de RecurrencePattern-ref is GEEN discriminator meer: IFC 4.3
  // reserveert die niet voor werkende uitzonderingen, en een spec-conforme externe tool kan een
  // RECURRENTE FEESTDAG ("elke 25 december") met exact zo'n gevulde ref schrijven. Het echte
  // onderscheid is de OPS-pset-markering hieronder (`writeCalendarGenerationMeta`,
  // `WorkingExceptionIds`) — de STEP-ids van deze IFCWORKTIME's worden daar expliciet
  // weggeschreven, en de reader behandelt alléén een gemarkeerd id als werkende uitzondering
  // (conservatief: ongemarkeerd + gevulde ref ⇒ nog steeds feestdag, het pre-T5-gedrag voor
  // externe bestanden). Golden rule: `cal.workingExceptions` afwezig/leeg ⇒ deze lus doet niets,
  // dus bestaande kalenders zonder werkende uitzonderingen blijven byte-identiek (geen nieuwe
  // entiteiten, geen gewijzigde ExceptionTimes, geen nieuwe pset-property).
  const workingExceptionRefs: string[] = [];
  const workingExceptionStepIds: number[] = [];
  for (const exc of cal.workingExceptions ?? []) {
    const bandIds = (exc.bands ?? []).map((b) =>
      addLine(ctx, '_excband', `IFCTIMEPERIOD('${minutesToClock(b.start)}','${minutesToClock(b.end)}')`));
    const bandRefs = bandIds.length > 0 ? `(${bandIds.map((i) => `#${i}`).join(',')})` : '$';
    const excRecId = addLine(ctx, '_excrecurrence', `IFCRECURRENCEPATTERN(.DAILY.,$,$,$,$,$,$,${bandRefs})`);
    const wId = addLine(ctx, `_workexc_${exc.name}`,
      `IFCWORKTIME(${ifcStr(exc.name)},.PREDICTED.,$,#${excRecId},'${exc.startDate}','${exc.endDate}')`);
    workingExceptionRefs.push(`#${wId}`);
    workingExceptionStepIds.push(wId);
  }

  const allExceptionRefs = [...holidayRefs, ...workingExceptionRefs];
  const exceptStr = allExceptionRefs.length > 0 ? `(${allExceptionRefs.join(',')})` : '$';
  // ObjectType (arg 4): alleen een label bij USERDEFINED-ploeg; anders `$` (byte-identiek).
  const objectType = cal.shift === 'USERDEFINED' ? ifcStr('USERDEFINED') : '$';
  const calStepId = addLine(ctx, key,
    `IFCWORKCALENDAR(${ifcStr(guidOf(ctx, cal.id))},#${ownerHistId},${ifcStr(cal.name)},${ifcStr(cal.description)},${objectType},(#${workTimeId}),${exceptStr},${shiftToPredefinedType(cal.shift)})`);
  return { calStepId, workingExceptionStepIds };
}

/**
 * Fase 2.8a (§8.2) — regelset-herkomst van een gegenereerde kalender (`calendar.generation`) als
 * `OPS_Calendar`-pset op de bijbehorende `IFCWORKCALENDAR` (patroon `OPS_ProjectSettings`/
 * `OPS_StructureMeta`: `IFCPROPERTYSINGLEVALUE`s + `IFCRELDEFINESBYPROPERTIES`). Golden rule:
 * alleen geschreven wanneer `generation` bestaat — een letterlijke/legacy kalender (geen
 * `generation`) schrijft niets extra, dus bestaande bestanden blijven byte-identiek.
 *
 * Bugfix B2 (gebruikstest 2026-08): `HoursPerDay` idem golden-rule, alleen voor DAG-kalenders
 * (`!cal.workTime` — uur-kalenders leiden hun `hoursPerDay` al correct af uit de banden, zie
 * `deriveHoursPerDay`/`promoteHourCalendar` in `subdayIo.ts`, en die weg mag dit niet breken) en
 * alleen wanneer de expliciete waarde AFWIJKT van wat de reader anders zou afleiden
 * (`workEndHour − workStartHour`). Zonder die afwijking blijft de output ongewijzigd (byte-
 * identiek); mét afwijking (bv. de standaard "Bouwkalender NL" 07-16 met een impliciet lunchuur,
 * hoursPerDay 8 ≠ 16−7=9) overleeft de expliciete waarde nu de round-trip i.p.v. stilzwijgend te
 * worden overschreven door de afgeleide span.
 *
 * T5-HERZIENING (2026-08-15, spec-reviewbevinding): `workingExceptionStepIds` — de STEP-ids van de
 * werkende-uitzondering-`IFCWORKTIME`'s uit `writeCalendar` — worden hier als `WorkingExceptionIds`
 * (JSON-array van STEP-id-strings) in HETZELFDE `OPS_Calendar`-pset weggeschreven. Dit IS de
 * discriminator die de reader gebruikt om een werkende uitzondering van een (evt. recurrente)
 * feestdag te onderscheiden — niet de aanwezigheid van een RecurrencePattern-ref, want die is geen
 * IFC-gereserveerd signaal (zie `writeCalendar`). Golden rule: geen werkende uitzonderingen ⇒ geen
 * property, dus deze tak alleen actief bij `workingExceptionStepIds.length > 0` — een kalender
 * mét generation/libraryOrigin/hoursPerDayOverride maar ZONDER werkende uitzonderingen schrijft
 * exact dezelfde pset-inhoud als vóór deze herziening.
 */
function writeCalendarGenerationMeta(
  ctx: WriteContext,
  calStepId: number,
  cal: WorkCalendar,
  ownerHistId: number,
  workingExceptionStepIds: number[],
): void {
  const gen = cal.generation;
  const derivedHoursPerDay = cal.workEndHour - cal.workStartHour;
  const needsHoursPerDayOverride = !cal.workTime && cal.hoursPerDay !== derivedHoursPerDay;
  const hasWorkingExceptions = workingExceptionStepIds.length > 0;
  if (!gen && !cal.libraryOrigin && !needsHoursPerDayOverride && !hasWorkingExceptions) return;
  const props: number[] = [];
  if (gen) {
    props.push(addLine(ctx, `_opscal_ruleset_${cal.id}`,
      `IFCPROPERTYSINGLEVALUE('RuleSetId',$,IFCLABEL(${ifcStr(gen.ruleSetId)}),$)`));
    if (gen.region) {
      props.push(addLine(ctx, `_opscal_region_${cal.id}`,
        `IFCPROPERTYSINGLEVALUE('Region',$,IFCLABEL(${ifcStr(gen.region)}),$)`));
    }
    if (gen.breakChoice) {
      props.push(addLine(ctx, `_opscal_break_${cal.id}`,
        `IFCPROPERTYSINGLEVALUE('BreakChoice',$,IFCLABEL(${ifcStr(gen.breakChoice)}),$)`));
    }
    props.push(addLine(ctx, `_opscal_from_${cal.id}`,
      `IFCPROPERTYSINGLEVALUE('GeneratedFromYear',$,IFCINTEGER(${gen.generatedFromYear}),$)`));
    props.push(addLine(ctx, `_opscal_to_${cal.id}`,
      `IFCPROPERTYSINGLEVALUE('GeneratedToYear',$,IFCINTEGER(${gen.generatedToYear}),$)`));
  }
  if (cal.libraryOrigin) {
    props.push(addLine(ctx, `_opscal_lo_${cal.id}`,
      `IFCPROPERTYSINGLEVALUE('LibraryOrigin',$,IFCTEXT(${ifcStr(JSON.stringify(cal.libraryOrigin))}),$)`));
  }
  if (needsHoursPerDayOverride) {
    props.push(addLine(ctx, `_opscal_hpd_${cal.id}`,
      `IFCPROPERTYSINGLEVALUE('HoursPerDay',$,IFCREAL(${cal.hoursPerDay}),$)`));
  }
  if (hasWorkingExceptions) {
    const idJson = JSON.stringify(workingExceptionStepIds.map(String));
    props.push(addLine(ctx, `_opscal_wexc_${cal.id}`,
      `IFCPROPERTYSINGLEVALUE('WorkingExceptionIds',$,IFCTEXT(${ifcStr(idJson)}),$)`));
  }
  const setId = addLine(ctx, `_pset_opscal_${cal.id}`,
    `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'pset_opscal_' + cal.id))},#${ownerHistId},${ifcStr(PSET.Calendar)},$,(${props.map(i => `#${i}`).join(',')}))`);
  addLine(ctx, `_rel_opscal_${cal.id}`,
    `IFCRELDEFINESBYPROPERTIES(${ifcStr(guidOf(ctx, 'rel_opscal_' + cal.id))},#${ownerHistId},$,$,(#${calStepId}),#${setId})`);
}

/**
 * Fase 2.8a (§8.2) — kalender-bibliotheek (generalisatie van de oude "resource-kalenders"-route,
 * fase 2.5, §7.5): elke bibliotheek-entry (de projectkalender-entry is al als eerste
 * IFCWORKCALENDAR geschreven door de aanroeper en zit hier dus NIET meer in) krijgt een eigen
 * IFCWORKCALENDAR (dezelfde `writeCalendar`, parametrische key) + eventuele
 * `OPS_Calendar`-generatiemeta + IFCRELASSIGNSTOCONTROL-relaties naar wie ernaar verwijst: één
 * naar de resources (`resource.calendarId === cal.id`, bestaand) en apart één naar de taken
 * (`task.calendarId === cal.id`, nieuw, §8.2) — twee losse rel-entiteiten omdat de reader
 * taken/resources via `taskStepIdMap`/`resourceStepIdMap` uit elkaar houdt. Golden rule: een
 * kalender zonder gebruikers schrijft alleen de IFCWORKCALENDAR zelf, geen rel; taken zonder
 * eigen kalender krijgen nooit een rel.
 */
function writeCalendarLibrary(
  ctx: WriteContext,
  resources: Resource[],
  tasks: Task[],
  calendars: WorkCalendar[],
  ownerHistId: number,
  hourTaskCalendarIds: Set<string>,
): void {
  for (const cal of calendars) {
    const { calStepId, workingExceptionStepIds } = writeCalendar(
      ctx, cal, ownerHistId, `calendar_${cal.id}`, hourTaskCalendarIds.has(cal.id),
    );
    writeCalendarGenerationMeta(ctx, calStepId, cal, ownerHistId, workingExceptionStepIds);

    const resRefs = resources
      .filter(r => r.calendarId === cal.id)
      .map(r => ref(ctx, `res_${r.id}`))
      .filter(r => r !== '#0');
    if (resRefs.length > 0) {
      addLine(ctx, `resctrl_${cal.id}`,
        `IFCRELASSIGNSTOCONTROL(${ifcStr(guidOf(ctx, 'resctrl_' + cal.id))},#${ownerHistId},$,$,(${resRefs.join(',')}),$,#${calStepId})`);
    }

    const taskRefs = tasks
      .filter(t => t.calendarId === cal.id)
      .map(t => ref(ctx, `task_${t.id}`))
      .filter(r => r !== '#0');
    if (taskRefs.length > 0) {
      addLine(ctx, `taskctrl_${cal.id}`,
        `IFCRELASSIGNSTOCONTROL(${ifcStr(guidOf(ctx, 'taskctrl_' + cal.id))},#${ownerHistId},$,$,(${taskRefs.join(',')}),$,#${calStepId})`);
    }
  }
}

function writeTask(
  ctx: WriteContext, task: Task, ownerHistId: number, statusDate: string | undefined,
  isHour: boolean, effHoursPerDay: number,
): void {
  const t = task.time;
  // Fase 2.8b (§7.1): in UUR-modus dragen de datetimes de echte tijd-van-de-dag en is de duur
  // minuut-precies (`durationMinutes`, bron van waarheid; anders afgeleid uit de dag-duur). In
  // DAG-modus valt alles terug op het bestaande `T07:00:00`/`P0Y0M{days}D`-pad ⇒ byte-identiek.
  const dt = isHour ? ifcDateTimeHour : ifcDateTime;
  // De ISO-vorm bewaart de TAAK-eenheid: P…D = werkdagen, PT…H…M = werkuren. De kalender bepaalt
  // alleen de datetime-precisie en plaatsing; een uurkalender maakt van een dagtaak geen urentaak.
  const schedDurArg = taskDurationUnitForIo(task) === 'hours'
    ? ifcDurationHour(taskMinutesForWrite(task, effHoursPerDay))
    : ifcDuration(t.scheduleDuration);
  // Voortgang (fase 2.6, §8.1) — spec-conforme IfcTaskTime-slots (0-based arg-index in de lijst
  // hieronder): 14 StatusTime, 15 ActualDuration, 16 ActualStart, 17 ActualFinish, 18 RemainingTime,
  // 19 Completion. Golden rule: een taak zonder actuals houdt 14-18 op `$` ⇒ byte-identieke
  // round-trip van bestaande bestanden. StatusTime = de projectbrede statusdatum (peildatum),
  // alleen op taken die daadwerkelijk actuals dragen.
  const hasActuals = !!(t.actualStart || t.actualFinish);
  const statusTimeArg = hasActuals && statusDate ? dt(statusDate) : '$';
  const actualDurationArg = t.actualDuration != null ? ifcDuration(t.actualDuration) : '$';
  const actualStartArg = t.actualStart ? dt(t.actualStart) : '$';
  const actualFinishArg = t.actualFinish ? dt(t.actualFinish) : '$';
  // RemainingTime: uur-modus schrijft de resterende MINUTEN (`remainingMinutes`, §5.3); anders de
  // dag-duur `remainingTime` (byte-identiek).
  const remainingArg = isHour && t.remainingMinutes != null
    ? ifcDurationHour(t.remainingMinutes)
    : t.remainingTime != null ? ifcDuration(t.remainingTime) : '$';

  // IFCTASKTIME + IFCTASK worden via de gedeelde slot-registry (./ifcTaskSlots) geëmitteerd: de writer
  // ITEREERT de geordende descriptor-lijst en `.join(',')`t de per-slot geformatteerde waarden ⇒
  // byte-identiek aan de vroegere template-literals (zelfde volgorde, zelfde `$`-conventies). De
  // reader (parseTaskTime/applyHourModeIFC/extractTasks) leest via dezelfde lijst-indices, zodat
  // writer-positie en reader-index niet meer kunnen divergeren (bevinding A2). `dt`/`ifcDuration`/
  // `guidArg` worden meegegeven omdat ze in ifcWriter wonen (injectie vermijdt een import-cyclus).
  const ttCtx: TaskTimeWriteCtx = {
    task, dt, ifcDuration, schedDurArg, statusTimeArg,
    actualDurationArg, actualStartArg, actualFinishArg, remainingArg,
  };
  const taskTimeId = addLine(ctx, `tasktime_${task.id}`,
    `IFCTASKTIME(${IFC_TASKTIME_SLOTS.map(s => s.write(ttCtx)).join(',')})`);

  const taskCtx: TaskWriteCtx = {
    task, ownerHistId, guidArg: ifcStr(guidOf(ctx, task.id)), taskTimeId,
  };
  addLine(ctx, `task_${task.id}`,
    `IFCTASK(${IFC_TASK_SLOTS.map(s => s.write(taskCtx)).join(',')})`);
}

function writeWBSNesting(ctx: WriteContext, tasks: Task[], ownerHistId: number): void {
  for (const task of tasks) {
    if (task.childIds.length === 0) continue;
    const childRefs = task.childIds
      .map(cid => ref(ctx, `task_${cid}`))
      .filter(r => r !== '#0')
      .join(',');
    if (childRefs) {
      addLine(ctx, `nest_${task.id}`,
        `IFCRELNESTS(${ifcStr(guidOf(ctx, 'nest_' + task.id))},#${ownerHistId},${ifcStr('WBS ' + task.name)},$,${ref(ctx, `task_${task.id}`)},( ${childRefs}))`);
    }
  }
}

// IfcLagTime.LagValue is een IfcTimeOrRatioSelect: een getypte IFCDURATION voor vaste lag of
// IFCRATIOMEASURE voor procent-lag (IFC 4.3 zelf: ratio 0.5 = "start wanneer de voorganger 50%
// gereed is"). Een lead (negatieve lag) krijgt het ISO-8601-voorloopteken ('-P2D') — dat is de
// standaardnotatie; niet elke externe tool leest het teken, maar onze round-trip behoudt het.
function ifcLagValue(seq: Sequence): string {
  if (typeof seq.lagPercent === 'number' && Number.isFinite(seq.lagPercent)) {
    return `IFCRATIOMEASURE(${seq.lagPercent / 100})`;
  }
  // Fase 2.8b (§7.1): uur-lag (`lagMinutes`, bron van waarheid) als minuut-precieze IFCDURATION met
  // tijdcomponent; de reader herkent de `T`-component en zet `lagMinutes` terug.
  if (typeof seq.lagMinutes === 'number' && Number.isFinite(seq.lagMinutes)) {
    return `IFCDURATION('${minutesToIsoDuration(seq.lagMinutes)}')`;
  }
  const d = Number.isFinite(seq.lagDays) ? seq.lagDays : 0;
  return d < 0 ? `IFCDURATION('-P${-d}D')` : `IFCDURATION('P${d}D')`;
}

function writeSequence(ctx: WriteContext, seq: Sequence, ownerHistId: number): void {
  let lagRef = '$';
  const hasPercent = typeof seq.lagPercent === 'number' && Number.isFinite(seq.lagPercent);
  const hasMinutes = typeof seq.lagMinutes === 'number' && Number.isFinite(seq.lagMinutes) && seq.lagMinutes !== 0;
  if (seq.lagDays !== 0 || hasPercent || hasMinutes) {
    // Conform IFC 4.3: IFCLAGTIME(Name, DataOrigin, UserDefinedDataOrigin, LagValue, DurationType)
    // — LagValue als getypte select in arg 4, DurationType (.WORKTIME./.ELAPSEDTIME.) in arg 5.
    // (Oudere app-versies hadden die twee omgewisseld; de reader kent beide lay-outs.)
    const durationType = seq.lagUnit === 'ELAPSEDTIME' ? 'ELAPSEDTIME' : 'WORKTIME';
    const lagId = addLine(ctx, `lag_${seq.id}`,
      `IFCLAGTIME('Lag',.PREDICTED.,$,${ifcLagValue(seq)},.${durationType}.)`);
    lagRef = `#${lagId}`;
  }

  addLine(ctx, `seq_${seq.id}`,
    `IFCRELSEQUENCE(${ifcStr(guidOf(ctx, seq.id))},#${ownerHistId},$,$,${ref(ctx, `task_${seq.predecessorId}`)},${ref(ctx, `task_${seq.successorId}`)},${lagRef},.${seq.type}.,$)`);
}

function writeResource(ctx: WriteContext, res: Resource, ownerHistId: number): void {
  // Entiteitnaam uit de gedeelde RESOURCE_TYPE_TO_IFC-map (reader leidt de inverse eruit af).
  // Fallback op MATERIAL is byte-identiek aan de vroegere switch-`default`.
  const entityName = RESOURCE_TYPE_TO_IFC[res.type] ?? 'IFCCONSTRUCTIONMATERIALRESOURCE';
  const entity = `${entityName}(${ifcStr(guidOf(ctx, res.id))},#${ownerHistId},${ifcStr(res.name)},${ifcStr(res.description)},$,$,$,$,.USERDEFINED.)`;
  addLine(ctx, `res_${res.id}`, entity);
}

/**
 * Fase 2.5 — `OPS_Resource`-pset (§7.2): capaciteit/tarief/eenheid/tijd-gefaseerde-capaciteit
 * + de `ParentGuid`-vangnetproperty (§7.3) voor ploeg-lidmaatschap. Exact het
 * OPS_Constraints/OPS_Milestone-patroon: alleen schrijven wanneer minstens één veld van de
 * default afwijkt (golden rule §7.7).
 */
function writeResourceMeta(ctx: WriteContext, resources: Resource[], ownerHistId: number): void {
  for (const res of resources) {
    const props: string[] = [];
    if (res.maxUnits !== 1) {
      const id = addLine(ctx, `_resmu_${res.id}`,
        `IFCPROPERTYSINGLEVALUE('MaxUnits',$,IFCREAL(${res.maxUnits}),$)`);
      props.push(`#${id}`);
    }
    if (res.costPerHour !== undefined) {
      const id = addLine(ctx, `_resch_${res.id}`,
        `IFCPROPERTYSINGLEVALUE('CostPerHour',$,IFCMONETARYMEASURE(${res.costPerHour}),$)`);
      props.push(`#${id}`);
    }
    if (res.unitOfMeasure) {
      const id = addLine(ctx, `_resuom_${res.id}`,
        `IFCPROPERTYSINGLEVALUE('UnitOfMeasure',$,IFCLABEL(${ifcStr(res.unitOfMeasure)}),$)`);
      props.push(`#${id}`);
    }
    if (res.color) {
      // #21: weergavekleur (hex) voor de resource-kleurmodi in de rapportexport. Presentatie, geen
      // planningsdata — reist mee in het project-IFC zodat de export op elke machine gelijk kleurt.
      const id = addLine(ctx, `_rescol_${res.id}`,
        `IFCPROPERTYSINGLEVALUE('Color',$,IFCTEXT(${ifcStr(res.color)}),$)`);
      props.push(`#${id}`);
    }
    if (res.availabilitySteps && res.availabilitySteps.length > 0) {
      // Compacte encoding "from:maxUnits;from:maxUnits", chronologisch (B8).
      const encoded = [...res.availabilitySteps]
        .sort((a, b) => a.from.localeCompare(b.from))
        .map(s => `${s.from}:${s.maxUnits}`)
        .join(';');
      const id = addLine(ctx, `_resas_${res.id}`,
        `IFCPROPERTYSINGLEVALUE('AvailabilitySteps',$,IFCTEXT(${ifcStr(encoded)}),$)`);
      props.push(`#${id}`);
    }
    if (res.parentId) {
      // Vangnet naast IFCRELNESTS (writeCrewNesting): de eigen reader hoeft nooit
      // afhankelijk te zijn van relatie-richting-interpretatie door andere IFC-tools.
      const id = addLine(ctx, `_respg_${res.id}`,
        `IFCPROPERTYSINGLEVALUE('ParentGuid',$,IFCTEXT(${ifcStr(guidOf(ctx, res.parentId))}),$)`);
      props.push(`#${id}`);
    }
    if (res.libraryOrigin) {
      const id = addLine(ctx, `_reslo_${res.id}`,
        `IFCPROPERTYSINGLEVALUE('LibraryOrigin',$,IFCTEXT(${ifcStr(JSON.stringify(res.libraryOrigin))}),$)`);
      props.push(`#${id}`);
    }
    if (props.length === 0) continue;
    const setId = addLine(ctx, `_pset_res_${res.id}`,
      `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'pset_res_' + res.id))},#${ownerHistId},${ifcStr(PSET.Resource)},$,(${props.join(',')}))`);
    addLine(ctx, `_rel_res_${res.id}`,
      `IFCRELDEFINESBYPROPERTIES(${ifcStr(guidOf(ctx, 'rel_res_' + res.id))},#${ownerHistId},$,$,(${ref(ctx, `res_${res.id}`)}),#${setId})`);
  }
}

/**
 * Fase 2.5 — ploeg-hiërarchie (§7.3, B8): `IFCRELNESTS` (niet `IFCRELAGGREGATES`), consistent
 * met hoe OPS al WBS-taakhiërarchie modelleert (`writeWBSNesting`) — RelatingObject = de
 * CREW-resource, RelatedObjects = de leden. Alleen geschreven wanneer de ploeg leden heeft.
 */
function writeCrewNesting(ctx: WriteContext, resources: Resource[], ownerHistId: number): void {
  const crews = resources.filter(r => r.type === 'CREW');
  for (const crew of crews) {
    const memberRefs = resources
      .filter(r => r.parentId === crew.id)
      .map(r => ref(ctx, `res_${r.id}`))
      .filter(r => r !== '#0');
    if (memberRefs.length === 0) continue;
    addLine(ctx, `nest_res_${crew.id}`,
      `IFCRELNESTS(${ifcStr(guidOf(ctx, 'nest_res_' + crew.id))},#${ownerHistId},${ifcStr('Ploeg ' + crew.name)},$,${ref(ctx, `res_${crew.id}`)},(${memberRefs.join(',')}))`);
  }
}

function writeAssignments(ctx: WriteContext, assignments: ResourceAssignment[], ownerHistId: number): void {
  // Group assignments by task
  const byTask = new Map<string, string[]>();
  for (const a of assignments) {
    const resRef = ref(ctx, `res_${a.resourceId}`);
    if (resRef === '#0') continue;
    if (!byTask.has(a.taskId)) byTask.set(a.taskId, []);
    byTask.get(a.taskId)!.push(resRef);
  }

  for (const [taskId, resRefs] of byTask) {
    const taskRef = ref(ctx, `task_${taskId}`);
    if (taskRef === '#0') continue;
    addLine(ctx, `assign_${taskId}`,
      `IFCRELASSIGNSTOPROCESS(${ifcStr(guidOf(ctx, 'assign_' + taskId))},#${ownerHistId},$,$,(${resRefs.join(',')}),$,${taskRef},$)`);
  }
}

/**
 * Fase 2.5 — `OPS_Assignments`-pset op de `IFCTASK` (§7.4, B8): `IFCRELASSIGNSTOPROCESS` kan
 * geen eigen pset dragen (het is een `IfcRelationship`, geen `IfcObjectDefinition` —
 * `IfcRelDefinesByProperties.RelatedObjects` accepteert dat type niet). Per-assignment
 * `unitsPerDay`+`curve` gaat daarom in een pset op de taak zelf: één
 * `IFCPROPERTYSINGLEVALUE` per assignment, waarde = `"unitsPerDay|curve"`.
 *
 * Property-naam = `"<resource-GUID>#<volgnummer>"` (M3-fix): de kale resource-GUID als
 * propertynaam corrumpeerde meerdere assignments van DEZELFDE resource op één taak (bv.
 * R×1(UNIFORM) + R×0.5(BELL)) — de reader dedupte op propertynaam → last-wins. Het
 * `#<volgnummer>`-achtervoegsel (0-based positie binnen de assignmentlijst van de taak) maakt
 * elke property uniek. `guidOf(ctx, ...)` produceert nooit een `#`, dus het scheidingsteken is
 * eenduidig. De reader leest ZOWEL dit nieuwe formaat (`GUID#N`) als het oude kale-GUID-formaat
 * (legacy bestanden, §7.4). Alleen geschreven wanneer de taak minstens één assignment heeft
 * (golden rule §7.7).
 */
function writeAssignmentMeta(
  ctx: WriteContext,
  tasks: Task[],
  assignments: ResourceAssignment[],
  ownerHistId: number,
): void {
  const byTask = new Map<string, ResourceAssignment[]>();
  for (const a of assignments) {
    if (!byTask.has(a.taskId)) byTask.set(a.taskId, []);
    byTask.get(a.taskId)!.push(a);
  }
  for (const task of tasks) {
    // Zelfde defensie als writeAssignments hierboven: een toewijzing waarvan de resource niet
    // (meer) bestaat — bv. een vergiftigd pre-fix document met resourceId null — wordt
    // overgeslagen i.p.v. dat guidOf op een null-seed crasht en daarmee élke save/auto-save
    // permanent blokkeert. Voor gezonde documenten filtert dit niets en blijft de uitvoer
    // byte-identiek.
    const list = byTask.get(task.id)?.filter(a => ref(ctx, `res_${a.resourceId}`) !== '#0');
    if (!list || list.length === 0) continue;
    const props = list.map((a, index) => {
      const resGuid = guidOf(ctx, a.resourceId); // zelfde GUID als writeResource gebruikte
      const propName = `${resGuid}#${index}`; // uniek per assignment (M3)
      const val = `${a.unitsPerDay}|${a.curve ?? 'UNIFORM'}`;
      const propId = addLine(ctx, `_asgn_${task.id}_${a.id}`,
        `IFCPROPERTYSINGLEVALUE(${ifcStr(propName)},$,IFCTEXT(${ifcStr(val)}),$)`);
      return `#${propId}`;
    });
    const setId = addLine(ctx, `_pset_asgn_${task.id}`,
      `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'pset_asgn_' + task.id))},#${ownerHistId},${ifcStr(PSET.Assignments)},$,(${props.join(',')}))`);
    addLine(ctx, `_rel_asgn_${task.id}`,
      `IFCRELDEFINESBYPROPERTIES(${ifcStr(guidOf(ctx, 'rel_asgn_' + task.id))},#${ownerHistId},$,$,(${ref(ctx, `task_${task.id}`)}),#${setId})`);
  }
}

/**
 * Z14 (etappe "nul afwijkingen") — `OPS_Timephased`-pset op de `IFCTASK`: het timephased-venster
 * (`ResourceAssignment.workWindowStart`/`workWindowFinish`, Z0-veld, MS Project "contouring")
 * van elke toewijzing van deze taak, als één autoritatief JSON-blob (`writeBaselineMeta`-vorm) —
 * NIET het `OPS_Assignments`-pipe-formaat hierboven uitbreiden (dat zou de legacy-parse-symmetrie
 * van dat formaat breken). Property-sleutel = EXACT dezelfde `"<resource-GUID>#<volgnummer>"` als
 * `writeAssignmentMeta` gebruikt (zelfde `byTask`-groepering, zelfde resource-bestaans-filter, dus
 * zelfde volgnummer) — dat is hoe de reader een venster weer aan de juiste toewijzing koppelt zonder
 * het pipe-formaat zelf aan te raken. Golden rule: geen enkele toewijzing van de taak draagt een
 * venster ⇒ geen pset (byte-identiek).
 */
function writeTimephasedMeta(
  ctx: WriteContext,
  tasks: Task[],
  assignments: ResourceAssignment[],
  ownerHistId: number,
): void {
  const byTask = new Map<string, ResourceAssignment[]>();
  for (const a of assignments) {
    if (!byTask.has(a.taskId)) byTask.set(a.taskId, []);
    byTask.get(a.taskId)!.push(a);
  }
  for (const task of tasks) {
    // Zelfde defensie/filter als writeAssignmentMeta hierboven — bepaalt hetzelfde `#index`.
    const list = byTask.get(task.id)?.filter(a => ref(ctx, `res_${a.resourceId}`) !== '#0');
    if (!list || list.length === 0) continue;
    const windows: Record<string, { workWindowStart?: string; workWindowFinish?: string }> = {};
    list.forEach((a, index) => {
      if (a.workWindowStart === undefined && a.workWindowFinish === undefined) return;
      const resGuid = guidOf(ctx, a.resourceId);
      const propName = `${resGuid}#${index}`;
      windows[propName] = {
        ...(a.workWindowStart !== undefined ? { workWindowStart: a.workWindowStart } : {}),
        ...(a.workWindowFinish !== undefined ? { workWindowFinish: a.workWindowFinish } : {}),
      };
    });
    if (Object.keys(windows).length === 0) continue;
    const propId = addLine(ctx, `_ps_tp_${task.id}`,
      `IFCPROPERTYSINGLEVALUE('Windows',$,IFCTEXT(${ifcStr(JSON.stringify(windows))}),$)`);
    const setId = addLine(ctx, `_pset_tp_${task.id}`,
      `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'pset_tp_' + task.id))},#${ownerHistId},${ifcStr(PSET.Timephased)},$,(#${propId}))`);
    addLine(ctx, `_rel_tp_${task.id}`,
      `IFCRELDEFINESBYPROPERTIES(${ifcStr(guidOf(ctx, 'rel_tp_' + task.id))},#${ownerHistId},$,$,(${ref(ctx, `task_${task.id}`)}),#${setId})`);
  }
}

/**
 * Z14b (eigenaarsbesluit 2026-08-18, Z8-nataak) — `Task.timephasedDurationWalks` (LAAG 4) als
 * eigen `OPS_TimephasedDurationWalks`-JSON-pset. NIET via `ifcPsets.PER_TASK_PSETS` (zie de
 * `PSET.DurationWalks`-toelichting daar): `resourceCalendarId` is een app-interne
 * kalenderverwijzing die bij inlezen een NIEUW, regenererend id krijgt.
 *
 * F1-FIXRONDE (spec-review op 526af9f9): de EERSTE versie vertaalde naar de kalenderNAAM — de
 * reviewer bewees empirisch dat dat stille datacorruptie geeft zodra twee kalenders dezelfde naam
 * dragen (de app dwingt naam-uniciteit nergens af). Fix: `resourceCalendarGuid` — dezelfde
 * `guidOf(ctx, cal.id)` die de kalender se eigen `IFCWORKCALENDAR.GlobalId` bepaalt (per-constructie
 * uniek, `guidOf`'s eigen botsingsdetectie garandeert dat). Omdat `guidOf` per `ctx` gememoïseerd is
 * en élke kalender (project + bibliotheek) al vóór deze aanroep geschreven is (zie de aanroepvolgorde
 * in `writeIFC`), levert een hernieuwde `guidOf`-aanroep hier BYTE-IDENTIEK dezelfde GUID als de
 * bijbehorende `IFCWORKCALENDAR`-entiteit — spiegelt zo `writeBaselineMeta`'s taskId-GUID-remap-
 * precedent exact, nu voor kalenders. Golden rule: geen taak met `timephasedDurationWalks` ⇒ geen pset.
 *
 * Z19 (residu-iteratie "nul afwijkingen") — `workMinutes` (apportionering bij >1 toewijzing, zie
 * `Task.timephasedDurationWalks`'s eigen docstring) is een kalenderONAFHANKELIJK getal, geen
 * verwijzing — conditioneel meegeschreven (spiegelt `mppReader.ts`'s eigen conditionele spread)
 * zodat een PRECIES-1-toewijzing-walk (geen `workMinutes`) byte-identiek blijft.
 */
function writeTimephasedDurationWalksMeta(
  ctx: WriteContext,
  tasks: Task[],
  ownerHistId: number,
): void {
  for (const task of tasks) {
    const walks = task.timephasedDurationWalks;
    if (!walks || walks.length === 0) continue;
    const json = walks.map(w => ({
      anchor: w.anchor,
      resourceCalendarGuid: guidOf(ctx, w.resourceCalendarId),
      ...(w.workMinutes !== undefined ? { workMinutes: w.workMinutes } : {}),
    }));
    const propId = addLine(ctx, `_ps_tpdw_${task.id}`,
      `IFCPROPERTYSINGLEVALUE('DurationWalks',$,IFCTEXT(${ifcStr(JSON.stringify(json))}),$)`);
    const setId = addLine(ctx, `_pset_tpdw_${task.id}`,
      `IFCPROPERTYSET(${ifcStr(guidOf(ctx, 'pset_tpdw_' + task.id))},#${ownerHistId},${ifcStr(PSET.DurationWalks)},$,(#${propId}))`);
    addLine(ctx, `_rel_tpdw_${task.id}`,
      `IFCRELDEFINESBYPROPERTIES(${ifcStr(guidOf(ctx, 'rel_tpdw_' + task.id))},#${ownerHistId},$,$,(${ref(ctx, `task_${task.id}`)}),#${setId})`);
  }
}

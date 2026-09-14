import type { Task } from '@/types/task';
import type { Resource, ResourceAssignment, ResourceCurve, ResourceType } from '@/types/resource';
import { encodeBandKey, encodeGroupedTaskRowKey, NONE_RAWKEY, type ViewRow } from '@/engine/view/visibleRows';
import { matchContoursToAssignments } from '@/engine/contour/contourEngine';
import { dayOf, taskFinish, taskStart } from './reportCommon';
import type { ResolvedPeriod } from './reportingPeriod';

/**
 * Resourcediagram (issue #113, gfayat): "wie doet wat, en wanneer" als GRAFISCH rapport — de
 * Gantt-afdruk met per resource een band en daaronder de bladtaken die aan die resource hangen, op
 * volgorde van start. De melder wilde dit als eigen rapporttype in plaats van "groepeer het scherm
 * op resource en zet Volg weergave aan": dat zijn meerdere handelingen die bovendien de
 * schermweergave zelf verbouwen, terwijl je alleen een afdruk wilt.
 *
 * WAAROM een eigen rijenbouwer en niet `computeViewRows` met een resourcegroepering: de
 * schermgroepering bandt op resourceNAAM (`filterEval.resourceNames`), en dit rapport heet
 * letterlijk "een blad per persoon" — twee medewerkers die allebei "Jan" heten zouden dan één vel
 * krijgen, met hun gedeelde taak twee keer onder dezelfde band (hyperkritische review op #132,
 * bevinding 1). Hier bandt alles op resource-IDENTITEIT: de naam is alleen het label, gelijknamige
 * resources — gelijk volgens dezelfde collator als de sortering, dus ook `Jan`/`jan`/` Jan ` —
 * krijgen een volgnummer (`Jan #1`, `jan #2`), en een naamloze resource een surrogaat (`#3`, zijn
 * positie in de projectlijst) in plaats van stil in de "(geen)"-band te verdwijnen (bevinding 4).
 * De `ViewRow`-sleutels zijn daardoor per definitie uniek. De bandvolgorde volgt de meegegeven
 * `locale` (de app-taal) en nooit de OS-taal van de afdrukker: een uitgedeeld vel moet op elke
 * machine dezelfde bladnummering krijgen.
 *
 * Wat WEL gelijk is aan het scherm: alleen bladtaken (de store weigert een toewijzing op een
 * verzameltaak; een importeur kan er wel een aanleveren en die wordt hier niet getoond — de gids
 * zegt dat), een taak met n resources staat onder n banden, hammocks en mijlpalen tellen mee (ze
 * worden getekend).
 * Relaties horen hier niet: een taak kan onder meerdere banden staan, dus een pijl heeft geen
 * eenduidig anker en zou op een blad per persoon de bladrand af lopen — het paneel zet `showDeps`
 * voor dit type uit (bevinding 2).
 *
 * Optioneel in TWEE LAGEN (manuvarkey op #113, punt 2): eerst een band per resourceTYPE (mensen
 * eerst — arbeid, ploeg, onderaannemer — dan materieel, dan materiaal; een vaste volgorde, niet
 * de vertaalde labelvolgorde, zodat een uitgedeeld vel in elke taal dezelfde blokvolgorde heeft),
 * daarbinnen de resourcebanden zoals hierboven, en de taken op diepte 2. De "(geen)"-band blijft
 * op diepte 0 als laatste: taken zonder resource hebben geen type.
 *
 * Optioneel binnen een TIJDVENSTER (punt 3): met `window` (de opgeloste rapportageperiode, issue
 * #120) doen alleen bladtaken mee die het venster raken — start ≤ tot én einde ≥ van, op dagniveau,
 * dezelfde overlapregel als de tabelrapporten; een taak zonder datums valt erbuiten. Alle
 * tellingen volgen die gefilterde set; `counts.outsidePeriod` telt wat er is weggelaten, zodat de
 * UI een lege uitkomst kan verklaren. De render krijgt hetzelfde venster als `timeWindow`.
 *
 * Per taakrij onder een resourceband levert `assignmentByRowKey` de TOEWIJZING van die band op
 * die taak (punt 1): eenheden per dag en de verdeelcurve — de rij is een taak, maar wat de lezer
 * wil weten is "hoe zwaar staat déze resource erop". De curveTOESTAND is exact de weergaveregel
 * van het eigenschappenpaneel (`TaskAssignmentsSection`), zodat rapport en paneel nooit twee
 * antwoorden geven: een aan de toewijzing gekoppelde CONTOUR op de taak ⇒ `'contoured'`, anders
 * `curveValues` zonder OPS-vorm (`curve` afwezig) ⇒ `'imported'`, anders `curve` (afwezig =
 * UNIFORM). Let op: dat is een WEERGAVEregel, niet de verdeelregel van `ResourceLoad.ts`'s
 * `assignmentDayUnits` — die verdeelt met `curveValues` zodra die er zijn, óók naast een `curve`
 * (het gewone P6-pad: naamterugval + exacte waarden), en negeert een contour zonder periodes. Het
 * rapport toont dus wat het paneel toont ("Vooraan belast"), terwijl het histogram P6's exacte
 * waarden gebruikt; een echt gedeelde toestandshelper is een vervolgstap (review ronde 2). Een
 * P6-/MSP-import met een curve zonder OPS-vorm heet hier in elk geval nooit "Uniform"
 * (ronde 1, bevinding 1). Twee records van dezelfde resource op één
 * taak (één rij) worden opgeteld; de curve is alleen bekend als alle records dezelfde hebben
 * (anders `null`, de render toont een streepje). De "(geen)"-band heeft geen toewijzing en dus
 * geen entry. De render tekent dit als twee tabelkolommen (`PrintOptions.assignmentColumns`).
 *
 * Invoer is structureel een `ReportContext`-subset, zoals de rest van `src/engine/reports/`. Puur:
 * geen React-/store-imports, headless getest in `tests/planning/check-reports.ts`.
 */
export interface ResourceGanttInput {
  tasks: readonly Task[];
  resources: readonly Resource[];
  assignments: readonly ResourceAssignment[];
}

export interface ResourceGanttRowsOptions {
  /** De taken zonder resource als laatste band meenemen. */
  includeUnassigned: boolean;
  /** Label van die band — `t('task:structure.none')`, dezelfde sleutel als de schermgroepering. */
  noneLabel: string;
  /** BCP-47-taal voor de bandvolgorde en de gelijknaamdetectie (de app-taal, `i18n.language`). */
  locale: string;
  /** Twee lagen: een band per resourcetype, daarbinnen per resource (default uit). */
  groupByType?: boolean;
  /** Labels per resourcetype — `t('common:resource.type.<lower>')`; een ontbrekend label valt
   *  terug op de enum-naam. Alleen gelezen bij `groupByType`. */
  typeLabels?: Partial<Record<ResourceType, string>>;
  /** Tijdvenster (opgeloste rapportageperiode, ISO-dagen inclusief). Afwezig = hele project. */
  window?: ResolvedPeriod;
}

export interface ResourceGanttRowsResult {
  /** De rijen voor `PrintOptions.rows`: bandrij per resource, taakrijen eronder (diepte 1). */
  rows: ViewRow[];
  /** Per taakrij-sleutel (`rowKey`) onder een resourceband: de toewijzing van die band op die taak. */
  assignmentByRowKey: Map<string, RowAssignment>;
  counts: {
    /** Resources (op identiteit) met minstens één bladtaak. */
    resources: number;
    /** Toewijzingsrecords die een band opleveren — dezelfde telling als het tabelrapport
     *  Resourcetoewijzingen (twee records van één resource op één taak tellen twee, tekenen één rij). */
    assignments: number;
    /** Bladtaken zonder resource — ook geteld wanneer ze niet in de rijen staan. Telt, anders dan
     *  het tabelrapport Resourcetoewijzingen, óók mijlpalen en hammocks: dit rapport tekent ze. */
    unassignedTasks: number;
    /** Bladtaken die door het tijdvenster zijn weggelaten (0 zonder venster). */
    outsidePeriod: number;
    /** Bladtaken ín het venster (zonder venster: alle bladtaken) — ook als er geen toewijzing op zit. */
    inPeriod: number;
  };
}

/** De curvetoestand van een toewijzing: contour op de taak, geïmporteerde exacte curve, of de OPS-vorm. */
export type RowCurve = ResourceCurve | 'contoured' | 'imported';

/** De toewijzing achter één taakrij van een resourceband (zie de moduledoc). */
export interface RowAssignment {
  /** Som van `unitsPerDay` over de records van deze resource op deze taak. */
  unitsPerDay: number;
  /** De curvetoestand als alle records dezelfde hebben (`curve` afwezig = UNIFORM), anders null. */
  curve: RowCurve | null;
}

/** Bandsleutel van de "(geen)"-band — dezelfde codering als de schermgroepering. */
const NONE_BAND_KEY = encodeBandKey([NONE_RAWKEY]);

/**
 * Bandvolgorde van de typen bij `groupByType`: wie het werk doet eerst, dan waarmee, dan waarvan.
 * Bewust vast en niet op vertaald label gesorteerd — zie de moduledoc. Een type dat hier zou
 * ontbreken (kan niet met het huidige enum) komt achteraan.
 */
export const RESOURCE_TYPE_BAND_ORDER: readonly ResourceType[] = ['LABOR', 'CREW', 'SUBCONTRACTOR', 'EQUIPMENT', 'MATERIAL'];

/** Ruwe bandsleutel van een typeband — met prefix, zodat hij nooit botst met een resource-id. */
function typeRawKey(type: ResourceType): string {
  return `type:${type}`;
}

/** Op start (`taskStart`, dezelfde definitie als de tabelrapporten), lege datums achteraan,
 *  gelijke starts in invoervolgorde (stabiel). */
function sortByStart(tasks: Task[]): Task[] {
  return tasks
    .map((task, index) => ({ task, index, start: taskStart(task) }))
    .sort((a, b) => {
      if (a.start === b.start) return a.index - b.index;
      if (a.start === '') return 1;
      if (b.start === '') return -1;
      return a.start < b.start ? -1 : 1;
    })
    .map(entry => entry.task);
}

/** Eén collator voor sortering én gelijknaamdetectie: cijferbewust, hoofdletter- en accentongevoelig. */
function bandCollator(locale: string): Intl.Collator {
  return new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
}

/**
 * Bandlabels per resource-id. Basis = getrimde naam, of het surrogaat `#<positie>` bij een lege
 * naam. Alle basislabels die volgens de collator gelijk zijn (dus ook `Jan`/`jan`/` Jan `, en een
 * surrogaat `#2` naast een resource die letterlijk "#2" heet) krijgen `#n` in projectvolgorde —
 * dezelfde gelijkheidsregel als de sortering, anders zouden ongenummerde "unieke" namen tussen de
 * genummerde in sorteren.
 */
export function resourceBandLabels(resources: readonly Resource[], locale: string): Map<string, string> {
  const collator = bandCollator(locale);
  const bases = resources.map((r, i) => r.name.trim() || `#${i + 1}`);
  // Groepen van collator-gelijke basislabels; n is klein (resources per project), dus lineair zoeken.
  const groups: { base: string; members: number[] }[] = [];
  bases.forEach((base, i) => {
    const group = groups.find(g => collator.compare(g.base, base) === 0);
    if (group) group.members.push(i);
    else groups.push({ base, members: [i] });
  });
  const labels = new Map<string, string>();
  for (const group of groups) {
    group.members.forEach((i, n) => {
      labels.set(resources[i].id, group.members.length > 1 ? `${bases[i]} #${n + 1}` : bases[i]);
    });
  }
  return labels;
}

export function computeResourceGanttRows(
  ctx: ResourceGanttInput,
  opts: ResourceGanttRowsOptions,
): ResourceGanttRowsResult {
  const allLeaves = ctx.tasks.filter(t => t.childIds.length === 0);
  const inWindow = (t: Task): boolean => {
    if (!opts.window) return true;
    const s = dayOf(taskStart(t));
    const f = dayOf(taskFinish(t));
    return s !== '' && f !== '' && s <= opts.window.to && f >= opts.window.from;
  };
  const leaves = allLeaves.filter(inWindow);
  const leafById = new Map(leaves.map(t => [t.id, t]));
  const resourceIds = new Set(ctx.resources.map(r => r.id));

  // Bladtaken per resource-id. Twee toewijzingen van dezelfde resource op één taak zijn één rij;
  // een toewijzing aan een onbekende resource telt niet (zelfde regel als `resourceNames` op het
  // scherm: die taak is dan "zonder resource").
  const tasksByResource = new Map<string, Map<string, Task>>();
  // Per resource-id × taak-id de opgetelde eenheden en de verzameling curvetoestanden (punt 1).
  const loadByResourceTask = new Map<string, { unitsPerDay: number; curves: Set<RowCurve> }>();
  const assignedTaskIds = new Set<string>();
  // Contourkoppeling op de VOLLEDIGE recordlijst per taak — ook records naar een onbekende
  // resource (die filtert de rij-opbouw hieronder pas weg) — precies zoals `ResourceLoad.ts`'s
  // `contourLookup` en het eigenschappenpaneel de lijst aanbieden; anders kan de legacy-terugval
  // in `matchContoursToAssignments` (`assignments.length === 1`) hier anders uitvallen dan daar
  // (review ronde 2, bevinding 3).
  const recordsByTask = new Map<string, ResourceAssignment[]>();
  for (const a of ctx.assignments) {
    if (!leafById.has(a.taskId)) continue;
    const list = recordsByTask.get(a.taskId) ?? [];
    list.push(a);
    recordsByTask.set(a.taskId, list);
  }
  const contouredIds = new Set<string>();
  for (const [taskId, list] of recordsByTask) {
    const task = leafById.get(taskId)!;
    if (task.timephasedContours && task.timephasedContours.length > 0) {
      for (const id of matchContoursToAssignments(task.timephasedContours, list).keys()) contouredIds.add(id);
    }
  }
  const curveOf = (a: ResourceAssignment): RowCurve =>
    contouredIds.has(a.id) ? 'contoured' : (!a.curve && a.curveValues ? 'imported' : (a.curve ?? 'UNIFORM'));
  let assignments = 0;
  for (const a of ctx.assignments) {
    const task = leafById.get(a.taskId);
    if (!task || !resourceIds.has(a.resourceId)) continue;
    assignments++;
    let bucket = tasksByResource.get(a.resourceId);
    if (!bucket) { bucket = new Map(); tasksByResource.set(a.resourceId, bucket); }
    bucket.set(task.id, task);
    assignedTaskIds.add(task.id);
    const loadKey = `${a.resourceId}\u0000${task.id}`;
    const load = loadByResourceTask.get(loadKey) ?? { unitsPerDay: 0, curves: new Set<RowCurve>() };
    load.unitsPerDay += a.unitsPerDay;
    load.curves.add(curveOf(a));
    loadByResourceTask.set(loadKey, load);
  }

  const labels = resourceBandLabels(ctx.resources, opts.locale);
  const collator = bandCollator(opts.locale);
  // Bandvolgorde: op label via de collator van de app-taal; gelijk ⇒ projectvolgorde.
  const bands = ctx.resources
    .map((r, index) => ({ id: r.id, index, label: labels.get(r.id) ?? r.id, tasks: tasksByResource.get(r.id) }))
    .filter((b): b is typeof b & { tasks: Map<string, Task> } => b.tasks !== undefined)
    .sort((a, b) => collator.compare(a.label, b.label) || a.index - b.index);

  const rows: ViewRow[] = [];
  const assignmentByRowKey = new Map<string, RowAssignment>();
  // Eén resourceband met zijn taakrijen, onder een optioneel typepad (diepte +1).
  const pushBand = (band: (typeof bands)[number], path: string[]) => {
    const groupPath = [...path, band.id];
    const key = encodeBandKey(groupPath);
    rows.push({
      kind: 'group', rowKey: key, key, label: band.label, count: band.tasks.size,
      depth: path.length, levelIndex: path.length, collapsed: false,
    });
    for (const task of sortByStart([...band.tasks.values()])) {
      const rowKey = encodeGroupedTaskRowKey(groupPath, task.id);
      rows.push({ kind: 'task', rowKey, task, depth: path.length + 1, dimmed: false });
      const load = loadByResourceTask.get(`${band.id}\u0000${task.id}`);
      if (load) {
        assignmentByRowKey.set(rowKey, {
          unitsPerDay: load.unitsPerDay,
          curve: load.curves.size === 1 ? [...load.curves][0] : null,
        });
      }
    }
  };
  if (opts.groupByType) {
    const typeOf = new Map(ctx.resources.map(r => [r.id, r.type]));
    const rank = (type: ResourceType) => {
      const i = RESOURCE_TYPE_BAND_ORDER.indexOf(type);
      return i < 0 ? RESOURCE_TYPE_BAND_ORDER.length : i;
    };
    // Typen in de vaste volgorde; binnen een type blijft de collator-volgorde van `bands`.
    const types = [...new Set(bands.map(b => typeOf.get(b.id) as ResourceType))].sort((a, b) => rank(a) - rank(b));
    for (const type of types) {
      const members = bands.filter(b => typeOf.get(b.id) === type);
      const raw = typeRawKey(type);
      const key = encodeBandKey([raw]);
      rows.push({
        kind: 'group', rowKey: key, key, label: opts.typeLabels?.[type] ?? type,
        count: members.reduce((n, b) => n + b.tasks.size, 0), depth: 0, levelIndex: 0, collapsed: false,
      });
      for (const band of members) pushBand(band, [raw]);
    }
  } else {
    for (const band of bands) pushBand(band, []);
  }

  const unassigned = sortByStart(leaves.filter(t => !assignedTaskIds.has(t.id)));
  if (opts.includeUnassigned && unassigned.length > 0) {
    rows.push({
      kind: 'group', rowKey: NONE_BAND_KEY, key: NONE_BAND_KEY, label: opts.noneLabel,
      count: unassigned.length, depth: 0, levelIndex: 0, collapsed: false,
    });
    for (const task of unassigned) {
      rows.push({ kind: 'task', rowKey: encodeGroupedTaskRowKey([NONE_RAWKEY], task.id), task, depth: 1, dimmed: false });
    }
  }

  return {
    rows,
    assignmentByRowKey,
    counts: {
      resources: bands.length, assignments, unassignedTasks: unassigned.length,
      outsidePeriod: allLeaves.length - leaves.length, inPeriod: leaves.length,
    },
  };
}

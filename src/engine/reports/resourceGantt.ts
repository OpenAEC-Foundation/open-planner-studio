import type { Task } from '@/types/task';
import type { Resource, ResourceAssignment, ResourceType } from '@/types/resource';
import { encodeBandKey, encodeGroupedTaskRowKey, NONE_RAWKEY, type ViewRow } from '@/engine/view/visibleRows';
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
  };
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
  const assignedTaskIds = new Set<string>();
  let assignments = 0;
  for (const a of ctx.assignments) {
    const task = leafById.get(a.taskId);
    if (!task || !resourceIds.has(a.resourceId)) continue;
    assignments++;
    let bucket = tasksByResource.get(a.resourceId);
    if (!bucket) { bucket = new Map(); tasksByResource.set(a.resourceId, bucket); }
    bucket.set(task.id, task);
    assignedTaskIds.add(task.id);
  }

  const labels = resourceBandLabels(ctx.resources, opts.locale);
  const collator = bandCollator(opts.locale);
  // Bandvolgorde: op label via de collator van de app-taal; gelijk ⇒ projectvolgorde.
  const bands = ctx.resources
    .map((r, index) => ({ id: r.id, index, label: labels.get(r.id) ?? r.id, tasks: tasksByResource.get(r.id) }))
    .filter((b): b is typeof b & { tasks: Map<string, Task> } => b.tasks !== undefined)
    .sort((a, b) => collator.compare(a.label, b.label) || a.index - b.index);

  const rows: ViewRow[] = [];
  // Eén resourceband met zijn taakrijen, onder een optioneel typepad (diepte +1).
  const pushBand = (band: (typeof bands)[number], path: string[]) => {
    const groupPath = [...path, band.id];
    const key = encodeBandKey(groupPath);
    rows.push({
      kind: 'group', rowKey: key, key, label: band.label, count: band.tasks.size,
      depth: path.length, levelIndex: path.length, collapsed: false,
    });
    for (const task of sortByStart([...band.tasks.values()])) {
      rows.push({ kind: 'task', rowKey: encodeGroupedTaskRowKey(groupPath, task.id), task, depth: path.length + 1, dimmed: false });
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
    counts: { resources: bands.length, assignments, unassignedTasks: unassigned.length, outsidePeriod: allLeaves.length - leaves.length },
  };
}

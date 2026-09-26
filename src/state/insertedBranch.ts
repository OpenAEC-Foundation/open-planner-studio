// De gedeelde staart van "een tak invoegen": plakken (`selectionSlice.pasteTasks`) en een
// WBS-sjabloon invoegen (`taskSlice.insertWbsTemplate`). Beide maken eerst hun eigen taken aan met
// verse ids en eindigen daarna identiek: interne relaties opnieuw aanleggen, WBS-codes toekennen en
// melden hoeveel relaties er niet door de relatieregels kwamen. Plakken ruimt daarnaast
// projectgebonden verwijzingen op die in het doeldocument niet bestaan (`normalizeInsertedBranch`);
// een sjabloon draagt zulke verwijzingen niet.
//
// Werkt op Immer-drafts (binnen de producer van de aanroeper, na diens `beginUndoable`); de melding
// hoort BUITEN de producer (`notify` doet zelf een `set()`).
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { ActivityCodeType, CustomFieldDef } from '@/types/structure';
import type { NotifyInput } from './slices/types';
import { relationVerdict } from './relationRules';
import { generateId } from '@/utils/id';
import { applyWbsNumbering, deriveWbsCodes } from '@/utils/wbs';

/**
 * Legt `relations` opnieuw aan tussen de nieuwe ids uit `idMap` (bron-id → nieuw id). Een spread
 * houdt de optionele lag-velden (lagUnit/lagPercent/…) vast.
 *
 * `relationVerdict` is de bron van de regel, niet alleen de reguliere add-route (`addSequence`): een
 * gekopieerde tak of een sjabloon (app-data uit `localStorage`) kan een relatie dragen die nooit via
 * die route is aangemaakt (bv. een IFC-import schrijft rechtstreeks naar `s.sequences`). De lookup
 * wijst naar `s.tasks` MÉT de zojuist ingevoegde taken, dus de toets ziet de boom zoals hij na het
 * invoegen is — inclusief een voorouderconflict door de invoegplek zelf. De duplicaatcheck loopt
 * tegen `s.sequences` zoals die tot nu toe is opgebouwd, net als `addSequence` per aanroep doet.
 *
 * @returns het aantal overgeslagen relaties.
 */
export function insertRemappedRelations(
  s: { tasks: Task[]; sequences: Sequence[] },
  relations: readonly Omit<Sequence, 'id'>[],
  idMap: ReadonlyMap<string, string>,
): number {
  let skipped = 0;
  const lookup = (tid: string) => s.tasks.find(t => t.id === tid);
  for (const relation of relations) {
    const candidate = {
      ...relation,
      predecessorId: idMap.get(relation.predecessorId)!,
      successorId: idMap.get(relation.successorId)!,
    };
    if (!relationVerdict(lookup, s.sequences, candidate).ok) { skipped++; continue; }
    s.sequences.push({ ...candidate, id: generateId('seq') });
  }
  return skipped;
}

/** Wat `normalizeInsertedBranch` van het DOELdocument moet kennen (subset van AppState). */
interface InsertTargetDefinitions {
  tasks: Task[];
  calendar: { id: string };
  calendars: readonly { id: string }[];
  customTaskTypes: readonly { id: string }[];
  activityCodeTypes: readonly ActivityCodeType[];
  customFieldDefs: readonly CustomFieldDef[];
}

/**
 * Maakt op zojuist ingevoegde taken de projectgebonden verwijzingen LEEG die in dit document niet
 * bestaan: taakkalender, eigen taaktype, activiteitscodes (type én waarde) en eigen velden. Het
 * klembord is bewust app-globaal, dus een tak uit document A kan hier id's meebrengen die alleen
 * in A bestaan. Zo'n wees rekende stil op de projectkalender, toonde een leeg kalenderveld en werd
 * door het raster voortaan geweigerd (`calendarNotFound`); codes en velden vielen bij opslaan stil
 * weg (de IFC-writer filtert op bestaande definities). Zelfde lijn als `pasteTasks` die toewijzingen
 * aan onbekende resources al overslaat. De definities zelf meekopiëren doet dit bewust NIET.
 *
 * Bestaanscheck kalender = dezelfde als raster en MCP: bibliotheek óf de projectkalender-cache.
 * Een taak met een gewist eigen taaktype houdt `taskType: 'USERDEFINED'` (generiek "Overig").
 *
 * @returns het aantal leeggemaakte verwijzingen (voor één melding na de producer).
 */
export function normalizeInsertedBranch(s: InsertTargetDefinitions, ids: Iterable<string>): number {
  const calendarIds = new Set([s.calendar.id, ...s.calendars.map(calendar => calendar.id)]);
  const taskTypeIds = new Set(s.customTaskTypes.map(type => type.id));
  const codeTypes = new Map(s.activityCodeTypes.map(type => [type.id, type] as const));
  const fieldIds = new Set(s.customFieldDefs.map(def => def.id));
  let cleared = 0;
  for (const id of ids) {
    const task = s.tasks.find(t => t.id === id);
    if (!task) continue;
    if (task.calendarId !== undefined && !calendarIds.has(task.calendarId)) {
      delete task.calendarId;
      cleared++;
    }
    if (task.customTaskTypeId !== undefined && !taskTypeIds.has(task.customTaskTypeId)) {
      delete task.customTaskTypeId;
      cleared++;
    }
    if (task.activityCodes) {
      const kept = Object.entries(task.activityCodes).filter(([typeId, valueId]) =>
        codeTypes.get(typeId)?.values.some(value => value.id === valueId) === true);
      const dropped = Object.keys(task.activityCodes).length - kept.length;
      if (dropped > 0) {
        cleared += dropped;
        if (kept.length > 0) task.activityCodes = Object.fromEntries(kept);
        else delete task.activityCodes;
      }
    }
    if (task.customFields) {
      const kept = Object.entries(task.customFields).filter(([defId]) => fieldIds.has(defId));
      const dropped = Object.keys(task.customFields).length - kept.length;
      if (dropped > 0) {
        cleared += dropped;
        if (kept.length > 0) task.customFields = Object.fromEntries(kept);
        else delete task.customFields;
      }
    }
  }
  return cleared;
}

/** De melding na plakken als er verwijzingen zijn leeggemaakt (zie `normalizeInsertedBranch`). */
export function notifyReferencesCleared(notify: (n: NotifyInput) => void, count: number): void {
  if (count <= 0) return;
  notify({
    severity: 'info',
    messageKey: 'notifications.referencesClearedOnPaste',
    params: { count },
    dedupeKey: 'references-cleared-on-paste',
  });
}

/**
 * WBS-codes voor zojuist ingevoegde taken: bij auto-nummering de hele boom, anders alleen de
 * ingevoegde ids een afgeleide code — anders dupliceren ze de code van hun bron letterlijk of
 * blijven ze leeg (lege codes breken de CSV/MSP-export en -herimport, die op dotted codes koppelen).
 */
export function assignInsertedWbsCodes(
  s: { tasks: Task[]; project: { wbsAutoNumber?: boolean } },
  ids: Iterable<string>,
): void {
  if (s.project.wbsAutoNumber) {
    applyWbsNumbering(s.tasks);
    return;
  }
  const codes = deriveWbsCodes(s.tasks);
  for (const id of ids) {
    const task = s.tasks.find(t => t.id === id);
    const code = codes.get(id);
    if (task && code !== undefined) task.wbsCode = code;
  }
}

/** De melding na het invoegen als er relaties zijn overgeslagen; `dedupeKey` per invoegroute. */
export function notifyRelationsSkipped(
  notify: (n: NotifyInput) => void,
  count: number,
  dedupeKey: string,
): void {
  if (count <= 0) return;
  notify({
    severity: 'info',
    messageKey: 'notifications.relationsSkippedOnInsert',
    params: { count },
    dedupeKey,
  });
}

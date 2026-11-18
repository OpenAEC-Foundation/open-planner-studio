// Botsingsregels voor eigen taaktypen (id + naam) — puur, zonder opslag.
//
// Een eigen taaktype is uniek op id én op naam, waarbij namen gelijk heten als ze alleen in
// hoofdletters verschillen (`sensitivity: 'accent'`). Die opzoeking stond drie keer uitgeschreven,
// elk met een eigen uitgang: de store-actie `ensureProjectTaskType` doet stil niets, de MCP-draft
// `ensureCustomTaskType` gooit, en de MCP-veldlaag (`taskFields.ts`) geeft een weigerreden. Wat een
// botsing betekent blijft daarom bij de aanroeper; deze module levert alleen de twee botsers.
import type { CustomTaskType } from '@/types/taskType';

/** Zijn twee taaktypenamen gelijk (hoofdletterongevoelig, accentgevoelig)? */
export function sameTaskTypeName(a: string, b: string): boolean {
  return a.localeCompare(b, undefined, { sensitivity: 'accent' }) === 0;
}

/** De bestaande typen waarmee `candidate` (al getrimd) kan botsen: het type met hetzelfde id, en een
 *  type met een ánder id maar dezelfde naam. */
export function customTaskTypeClashes(
  types: readonly CustomTaskType[],
  candidate: CustomTaskType,
): { sameId?: CustomTaskType; sameNameOtherId?: CustomTaskType } {
  return {
    sameId: types.find(type => type.id === candidate.id),
    sameNameOtherId: types.find(type => type.id !== candidate.id && sameTaskTypeName(type.name, candidate.name)),
  };
}

/** De definities die met het document in het IFC-bestand gaan: alleen die een taak gebruikt, in de
 *  volgorde van de catalogus. Eén selectie voor de IFC-schrijver (`writeTaskTypeMeta`) en voor de
 *  vergelijking "is de op te slaan inhoud nog dezelfde" (`sameIFCSource`); een ongebruikte definitie
 *  verandert dus nooit wat er bewaard wordt (#804 keuze 7, fixronde 1 van #1007). */
export function savedCustomTaskTypes(
  tasks: readonly { customTaskTypeId?: string }[],
  types: readonly CustomTaskType[],
): CustomTaskType[] {
  const used = new Set(tasks.map(task => task.customTaskTypeId).filter((id): id is string => !!id));
  return types.filter(type => used.has(type.id));
}

/** Gebruikt minstens één taak dit eigen taaktype? Alleen zo'n definitie gaat mee in het IFC-bestand en in
 *  het crashherstel (`writeTaskTypeMeta` in `ifcWriter.ts` schrijft alleen gebruikte definities), dus alleen
 *  dan heeft een hernoeming van de projectkopie blijvend effect (#804 keuze 7). */
export function customTaskTypeInUse(tasks: readonly { customTaskTypeId?: string }[], id: string): boolean {
  return tasks.some(task => task.customTaskTypeId === id);
}

/** De typelijst met `id` hernoemd naar `name` (al getrimd), of `null` als dat niet kan of niets
 *  verandert: het type ontbreekt, een ánder type heet al zo, of de naam is gelijk. */
export function renamedCustomTaskTypes(
  types: readonly CustomTaskType[],
  id: string,
  name: string,
): CustomTaskType[] | null {
  const { sameId, sameNameOtherId } = customTaskTypeClashes(types, { id, name });
  if (!sameId || sameNameOtherId || sameId.name === name) return null;
  return types.map(type => type.id === id ? { ...type, name } : type);
}

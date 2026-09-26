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

// contourEdit.ts — het bewerkmodel van de contour-engine (etappe "contour-UI", 2026-09; het
// vervolg dat docs/TODO.md §"Contour-engine" als "Contour bewerken in de UI" openliet).
//
// WAT DIT IS. De pure vertaling tussen wat de gebruiker in het dialoogvenster ziet — een rij per
// WERKdag van de taak met werkminuten per dag — en wat de engine opslaat: `TimephasedContourPeriod`s
// op de cumulatieve taak-as (`contourEngine.ts`, "DE AS"). De heenweg is `contourDaySlots`
// (periodes → dagslots, per `kind` apart, zodat verricht werk apart en alleen-lezen getoond kan
// worden); de terugweg is `workDaySlotsToPeriods` (dagslots → periodes, met de pauzedagen van
// `splitGaps` weer op de as teruggezet zodat slot i aan beide kanten dezelfde dag blijft betekenen
// als in `periodsToWorkDaySlots`/`enumerateTaskWorkDays`). `buildEditedContourPeriods` combineert
// beide tot het profiel dat de store opslaat: de actual-periodes ONGEWIJZIGD (verricht werk is
// geen bewerkbare planning), de remaining-periodes opnieuw opgebouwd uit de bewerkte dagwaarden.
//
// WAT DIT NIET IS. Geen datumlogica: een dag op 0 uur zetten maakt GEEN onderbreking (`splitGaps`)
// en verschuift geen taakdatum — de contour verdeelt uren binnen de duur die de planner al had, de
// CPM-datums blijven bij laag 3/4 en `splitGaps` (harde ontwerpvoorwaarde, zie `contourEngine.ts`).
// Wie een onderbreking wil, bewerkt de taak, niet de contour. Een 0-dag reist wél mee naar buiten:
// de MSPDI-schrijver schrijft 'm als dag zonder werk, en MS Project (en onze eigen MSPDI-lezer,
// `splitGapsFromContours`) lezen een dag waarop GEEN ENKELE toewijzing werkt als split — dat is
// MS Project se eigen semantiek, en gedocumenteerd in de gids.
//
// Pure module: geen store, geen kalender-engine (de aanroeper levert `mpd` en de gaten), geen I/O.
import type { TaskSplitGap, TimephasedContourPeriod } from '@/types/task';
import { splitDayPattern } from '@/engine/scheduler/splitWalk';
import {
  CONTOUR_SHAPE_VALUES, periodsFromSlotWork, periodsToWorkDaySlots, slotWeightsFromValues,
  type ContourShape,
} from './contourEngine';

/** Werkminuten per werkdagslot, per soort: `actual` = verricht werk (alleen-lezen in de UI),
 *  `remaining` = gepland/resterend werk (bewerkbaar). Beide arrays zijn even lang
 *  (`max(minSlots, langste van de twee)`) en index-uitgelijnd op `enumerateTaskWorkDays`. */
export interface ContourDaySlots {
  actual: number[];
  remaining: number[];
}

/**
 * Contourprofiel → werkminuten per WERKdag, per soort. Dezelfde uitlijning als de lastlezers
 * (`periodsToWorkDaySlots`: pauzedagen uit `gaps` eruit, werk in een gat-slot doorgeschoven).
 */
export function contourDaySlots(
  periods: readonly TimephasedContourPeriod[],
  gaps: readonly TaskSplitGap[] | undefined,
  slotMinutes: number,
  minSlots = 0,
): ContourDaySlots {
  const actual = periodsToWorkDaySlots(periods.filter((p) => p.kind === 'actual'), gaps, slotMinutes, 0);
  const remaining = periodsToWorkDaySlots(periods.filter((p) => p.kind !== 'actual'), gaps, slotMinutes, 0);
  const n = Math.max(actual.length, remaining.length, Math.max(0, Math.ceil(minSlots)));
  while (actual.length < n) actual.push(0);
  while (remaining.length < n) remaining.push(0);
  return { actual, remaining };
}

/**
 * Werkminuten per WERKdag → periodes op de taak-as, één periode per werkdagslot (ook 0-werk-slots,
 * zodat de asspanne van het profiel de bewerkte dagen blijft dekken). De pauzedagen van `gaps`
 * worden volgens hetzelfde blokpatroon als `enumerateTaskWorkDays` (`splitDayPattern` over het
 * aantal WERKdagen) op de as teruggezet: die slots krijgen géén periode, precies zoals een
 * geïmporteerd profiel een gat als "verstreken as zonder werk" draagt. Inverse van
 * `contourDaySlots(...).remaining` voor elk profiel dat per hele dag is opgebouwd. Geen `gaps` ⇒
 * identiek aan `periodsFromSlotWork`.
 */
export function workDaySlotsToPeriods(
  slotWork: readonly number[],
  gaps: readonly TaskSplitGap[] | undefined,
  slotMinutes: number,
  kind: 'actual' | 'remaining' = 'remaining',
): TimephasedContourPeriod[] {
  const mpd = Math.max(1, slotMinutes);
  if (!gaps || gaps.length === 0) return periodsFromSlotWork(slotWork, mpd, kind);
  const blocks = splitDayPattern([...gaps], mpd, slotWork.length);
  const out: TimephasedContourPeriod[] = [];
  let axisSlot = 0;
  let pos = 0;
  for (const b of blocks) {
    for (let i = 0; i < b.work && pos < slotWork.length; i++, pos++, axisSlot++) {
      out.push({ afterMinutes: axisSlot * mpd, minutes: mpd, workMinutes: Math.max(0, slotWork[pos]), kind });
    }
    axisSlot += b.gap;
  }
  // Restant voorbij het laatste blok (meer werkdagen dan het patroon dekt) — gewoon aanhangen.
  for (; pos < slotWork.length; pos++, axisSlot++) {
    out.push({ afterMinutes: axisSlot * mpd, minutes: mpd, workMinutes: Math.max(0, slotWork[pos]), kind });
  }
  return out;
}

/**
 * Het profiel dat de store opslaat ná een bewerking: de bestaande actual-periodes ongewijzigd
 * (verricht werk is een feit, geen planning — dezelfde regel als `rescaleContourForDuration`),
 * plus de remaining-periodes opnieuw opgebouwd uit de bewerkte werkminuten per werkdag.
 * Niet-eindige of negatieve invoer wordt als 0 behandeld (de UI valideert vóór het toepassen;
 * dit is de tweede grendel).
 */
export function buildEditedContourPeriods(
  existing: readonly TimephasedContourPeriod[] | undefined,
  remainingSlotWork: readonly number[],
  gaps: readonly TaskSplitGap[] | undefined,
  slotMinutes: number,
): TimephasedContourPeriod[] {
  const actual = (existing ?? []).filter((p) => p.kind === 'actual');
  const cleaned = remainingSlotWork.map((w) => (Number.isFinite(w) && w > 0 ? w : 0));
  return [...actual, ...workDaySlotsToPeriods(cleaned, gaps, slotMinutes, 'remaining')];
}

/**
 * Een standaardvorm als DATA over `slotCount` werkdagen: de 21-punts tabel van `shape`
 * (`CONTOUR_SHAPE_VALUES`) verdeelt `totalWorkMinutes` over de slots, zonder de hele-eenheden-
 * afronding van de formule (`distributeUnits`) — de gebruiker kiest hier bewust een verdeling als
 * vertrekpunt en past 'm daarna per dag aan. Som van de uitkomst = `totalWorkMinutes` (op
 * drijvendekomma-residu na, dat `slotWeightsFromValues` al op het laatste slot corrigeert).
 */
export function shapeSlotWork(shape: ContourShape, totalWorkMinutes: number, slotCount: number): number[] {
  const n = Math.max(0, Math.floor(slotCount));
  if (n === 0) return [];
  const total = Number.isFinite(totalWorkMinutes) && totalWorkMinutes > 0 ? totalWorkMinutes : 0;
  return slotWeightsFromValues(CONTOUR_SHAPE_VALUES[shape], n).map((w) => w * total);
}

/** Alle vormen die het dialoogvenster als vertrekpunt aanbiedt — de OPS-curves plus de twee
 *  MSPDI-/P6-vormen zonder OPS-`ResourceCurve`-lid (DOUBLE_PEAK, TURTLE), in MSPDI-codevolgorde. */
export const EDITABLE_CONTOUR_SHAPES: readonly ContourShape[] = [
  'FLAT', 'BACK_LOADED', 'FRONT_LOADED', 'DOUBLE_PEAK', 'EARLY_PEAK', 'LATE_PEAK', 'BELL', 'TURTLE',
];

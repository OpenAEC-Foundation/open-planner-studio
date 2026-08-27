// Z15 (etappe "nul afwijkingen") — gedeelde afleiding van de ABSOLUTE segmentgrenzen van een
// gesplitste taak (`Task.splitGaps`, Z4), gebruikt door zowel de Gantt-canvas (`GanttRenderer`,
// `drawTaskBar`) als de print-/PDF-teken laag (`printPreview.ts`, via de `Draw2D`-abstractie —
// bedient zowel de rasterpreview als de vector-PDF). Eén bron voor de kalenderwandeling houdt
// beide tekenpaden gegarandeerd in sync (zelfde precedent als `timeAxis.dateToX`, hierboven
// aangehaald: GanttRenderer/HistogramRenderer deelden vroeger een VERBATIM gekopieerde functie).
//
// O5 (orkestratorbesluit 2026-08-17, plan-§10): een ECHTE split (`Task.splitGaps`, uit een
// .mpp-import afgeleid) tekent ALTIJD gesplitst — een werkonderbreking is DATA, geen
// weergavevoorkeur. `barSplitMode`/`shouldSplit` (GanttRenderer) blijven daarom UITSLUITEND de
// kalender-necking sturen (de calendar-only "toon werkblokken"-weergave); een taak met
// `splitGaps` bereikt die tak nooit. Deze module weet niets van `barSplitMode` — dat blijft aan
// de aanroeper.

import type { TaskSplitGap } from '@/types/task';
import type { CalendarEngine } from '@/engine/scheduler/CalendarEngine';

export interface SplitSegmentBounds {
  start: Date;
  end: Date;
}

/**
 * Segmentgrenzen (Date-paren) voor een taak met `Task.splitGaps`, gewandeld vanaf `taskStart` met
 * de bestaande `CalendarEngine`-primitieven — GEEN eigen kalenderlogica hier (plan-§8-checklist).
 * `TaskSplitGap.afterMinutes`/`gapMinutes` zijn beide WERKMINUTEN vanaf de taakstart (`task.ts`'s
 * docblok, bevestigd tegen `mpp14splittask.mpp` — zie `mppTimephased.ts`'s moduleheader:
 * `addWorkMinutes(start, duur + Σgapminuten)` reproduceert MSP's eigen FINISH byte-exact). Deze
 * functie wandelt CUMULATIEF (niet losse `addWorkMinutes(start, afterMinutes)`-aanroepen per gat):
 * `addWorkMinutes` is optelbaar — twee opeenvolgende wandelingen van a en b werkminuten landen op
 * hetzelfde punt als één wandeling van a+b minuten — dus blijft dit consistent met die
 * enkele-aanroep-formule.
 *
 * DAG- VS UUR-MODUS (verplicht uit te leggen, plan-Z15). `afterMinutes`/`gapMinutes` zijn ALTIJD
 * werkminuten, ongeacht de kalendermodus van de taak (ze komen uit de .mpp-timephased-decoder, die
 * geen dag/uur-onderscheid kent, zie `mppTimephased.ts`). In UUR-modus (`hourMode=true`) wandelt
 * deze functie daarom met `CalendarEngine.addWorkMinutes` (minuutprecisie — dezelfde primitief als
 * Z4's eigen meetreferentie gebruikt om de MSP-finish te reproduceren). In DAG-modus bestaat die
 * precisie NIET: `addWorkMinutes` leunt op `calendar.workTime!.byWeekday` en GOOIT op een
 * dag-kalender (`workTime` is daar `undefined` — zie `CalendarEngine.bandsStartingOn`, dat de
 * non-null-assertion onvoorwaardelijk doet). Dag-taken tekenen sowieso nooit binnen-de-dag (de
 * dag-tak van `barGeometry`/printPreview's balklus rondt altijd op hele dagen af), dus deze functie
 * rondt in dag-modus elke minutenwaarde af op hele werkdagen (`Math.round(minuten /
 * (hoursPerDay*60))`) en wandelt met `addWorkingDaysSigned` — de bestaande "zuivere offset"-
 * primitief (begindag telt NIET als "dag 1", i.t.t. `addWorkDays`/`addWorkDaysChecked`) die
 * `Z6`/`levelingDelay` in `CPMSolver.forwardPass` voor precies dit doel al gebruikt. Een gat
 * kleiner dan een halve werkdag rondt af naar 0 werkdagen en levert dus geen zichtbaar segment op
 * in dag-modus — een gedocumenteerde precisiegrens (de bar-x-as heeft daar geen sub-dag-resolutie
 * om zo'n gat sowieso te tonen), geen bug. De spiegelkant geldt óók: een gat van een halve werkdag
 * of net erboven rondt OP naar één hele werkdag en tekent dus breder dan het werkelijke gat —
 * dezelfde half-rondt-van-nul-af-conventie als `CPMSolver.resolveEffectiveLagDays` voor lags in
 * dag-modus.
 *
 * ELKE grens (behalve de allereerste `taskStart` en de allerlaatste `taskEnd`) is EXCLUSIEF: het
 * startpunt van het volgende segment — net als de bestaande uur-modus-necking
 * (`CalendarEngine.workIntervalsBetween`) al doet. De aanroeper zet deze grenzen daarom recht-toe-
 * recht-aan om naar schermcoördinaten (`dateToX(...)`, zonder extra "+zoom voor de inclusieve
 * laatste dag"-correctie) — behalve voor de allereerste/-laatste grens, waar de aanroeper de AL
 * BEKENDE `x1`/`x2` van de volle-extent-balkgeometrie hergebruikt (die dragen die correctie al).
 *
 * `gaps.length === 0` ⇒ één segment `[taskStart, taskEnd]` (geen split) — de aanroeper hoeft deze
 * functie dus niet zelf te guarden op een lege/afwezige `splitGaps`-array.
 */
export function computeSplitSegments(
  gaps: TaskSplitGap[] | undefined,
  taskStart: Date,
  taskEnd: Date,
  hourMode: boolean,
  eng: CalendarEngine,
): SplitSegmentBounds[] {
  if (!gaps || gaps.length === 0) return [{ start: taskStart, end: taskEnd }];
  const sorted = [...gaps].sort((a, b) => a.afterMinutes - b.afterMinutes);
  const minutesPerDay = Math.max(1, eng.hoursPerDay * 60);

  const walk = (from: Date, minutes: number): Date => {
    if (minutes <= 0) return from;
    if (hourMode) return eng.addWorkMinutes(from, minutes);
    const days = Math.round(minutes / minutesPerDay);
    return days > 0 ? eng.addWorkingDaysSigned(from, days) : from;
  };

  const segments: SplitSegmentBounds[] = [];
  let cursor = taskStart;
  let prevAfter = 0;
  for (const gap of sorted) {
    const gapStart = walk(cursor, gap.afterMinutes - prevAfter);
    segments.push({ start: cursor, end: gapStart });
    cursor = walk(gapStart, gap.gapMinutes);
    prevAfter = gap.afterMinutes;
  }
  segments.push({ start: cursor, end: taskEnd });
  return segments;
}

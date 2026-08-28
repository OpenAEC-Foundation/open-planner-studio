// splitWalk.ts — B1c-W0: de ENE bron voor "welke dagen werkt een gesplitste taak".
//
// De as-semantiek (H1): `TaskSplitGap.afterMinutes` ligt op MSP's cumulatieve elapsedWork-as — de
// as loopt CUMULATIEF door de tijdgefaseerde periodes en telt daarbij ELK gat zelf ook mee in hoe
// ver de as voor het VOLGENDE gat al is opgeschoven (`task.ts`'s `TaskSplitGap`-docblok,
// `duration.ts`'s `splitTotalSpanMinutes`-moduleheader). De aspositie ná gat n is dus
// `afterMinutes + gapMinutes`, niet `afterMinutes` — wie bij het volgende gat `prevAxis =
// gap.afterMinutes` bijhoudt (de pre-H1-lezing) telt het vorige gat DUBBEL: het segment vóór gat
// n+1 wordt dan berekend als `(n+1).afterMinutes − n.afterMinutes`, wat het net gepasseerde gat
// zelf nog een keer als "werk" meetelt. Reproductiegeval (zie `check-split-walk.ts`): een taak van
// 06-01 met twee gaten van 1 werkdag na resp. dag 1 en aspositie 1440 (=480 werk + 480 gat + 480
// werk) gaf pre-H1 de segmenten [06-01..06-02], [06-03..06-05], [06-08..06-05] — het derde segment
// loopt zelfs TERUG in de tijd. Correct is 06-01 / 06-03 / 06-05.
//
// DAG- VS UUR-MODUS. `afterMinutes`/`gapMinutes` zijn ALTIJD werkminuten, ongeacht de
// kalendermodus van de taak (ze komen uit de .mpp-timephased-decoder, die geen dag/uur-onderscheid
// kent — zie `mppTimephased.ts`). In UUR-modus (`hourMode=true`) wandelt `computeSplitSegments`
// daarom met `CalendarEngine.addWorkMinutes` (minuutprecisie). In DAG-modus bestaat die precisie
// niet: `addWorkMinutes` leunt op `calendar.workTime!.byWeekday` en GOOIT op een dag-kalender
// (`workTime` is daar `undefined`). Dag-taken tekenen sowieso nooit binnen-de-dag, dus deze module
// rondt in dag-modus elke minutenwaarde af op hele werkdagen (`Math.round(minuten /
// (hoursPerDay*60))`) en wandelt met `addWorkingDaysSigned` — de bestaande "zuivere offset"-
// primitief (begindag telt NIET als "dag 1"). Een gat kleiner dan een halve werkdag rondt af naar
// 0 werkdagen en levert dus geen zichtbaar/telbaar segment op in dag-modus — een gedocumenteerde
// precisiegrens, geen bug. De spiegelkant geldt ook: een gat van een halve werkdag of net erboven
// rondt OP naar één hele werkdag.
//
// EXCLUSIEVE GRENZEN. In `computeSplitSegments` is elke grens (behalve de allereerste `taskStart`
// en de allerlaatste `taskEnd`) EXCLUSIEF: het startpunt van het volgende segment — net als de
// bestaande uur-modus-necking (`CalendarEngine.workIntervalsBetween`) al doet.
//
// DEFENSIEF (guard-lat bewust GELIJK aan `splitTotalSpanMinutes` in `duration.ts` — zelfde
// dreigingsmodel: `splitGaps` is afgeleide data die via MCP of een handgemaakte IFC/JSON-import
// kan binnenkomen, dus niet blind vertrouwd). Beide wandelfuncties hieronder spiegelen die guards
// letterlijk: een gat met een niet-eindige `afterMinutes`/`gapMinutes` of `gapMinutes <= 0` wordt
// overgeslagen, en de aspositie wordt geklemd (`gapStartAxis = Math.max(afterMinutes, axisPos)`)
// zodat een wanordelijk/overlappend gat de as nooit terug de tijd in laat lopen — een gat dat
// daarna nog steeds ontaardt (`gapEndAxis <= gapStartAxis`) draagt niets bij en wordt ook
// overgeslagen. Dit voorkomt tegelijk dat een NaN uit een niet-finite gat doorsijpelt naar
// `Math.round`/`Math.max` verderop (die geven dan stil `NaN` terug in plaats van een fout).
//
// OVERLAPPENDE GATEN VALLEN SAMEN TOT ÉÉN WERKONDERBREKING. Doordat `gapStartAxis` op `axisPos`
// geklemd wordt, kan een tweede gat dat (deels) binnen het vorige valt op de as `workBefore === 0`
// opleveren (geen zuiver werksegment ertussen). `computeSplitSegments` slaat het pushen van een
// nieuw (dan NUL-BREED) segment in dat geval over — behalve voor het állereerste gat, dat altijd
// zijn (mogelijk nul-brede) openingssegment krijgt, zodat `segments[0].start === taskStart` blijft
// gelden — en verlengt in plaats daarvan gewoon het lopende gat. `splitDayPattern` spiegelt dat:
// een blok met `work === 0` wordt niet als apart blok gepusht maar bij het gat van het vorige blok
// opgeteld, zodat het aantal blokken overeenkomt met het aantal zichtbare werkonderbrekingen. Dit
// verandert `enumerateTaskWorkDays`s uitkomst NIET (nul-werk-blokken verbruikten toch al geen
// dagen) — het is puur zodat de blokstructuur zelf klopt voor toekomstige lezers ervan.
//
// GEEN GRENS VOORBIJ HET TAAKEINDE. `computeSplitSegments` klemt elke gewandelde grens op
// `taskEnd`: een gat (of som van gaten) dat door corrupte data verder reikt dan de taak duurt mag
// nooit een segmentgrens ná `taskEnd` opleveren, en al helemaal niet een segment dat achterstevoren
// loopt (`end < start`) doordat de wandeling het taakeinde voorbij zou schieten. Een taak waarvan
// `taskEnd <= taskStart` is (eveneens corrupte/hostiele input) levert daarom ook meteen kortsluiting
// op: één segment `[taskStart, taskEnd]`, zonder de gaten-as ook maar aan te raken.
//
// Consumenten: `splitBarGeometry` (renderer/print), `ResourceLoad` (histogram/bezetting),
// `ResourceLeveler` (boekhouding). Eén wandeling, drie lezers — dat is het hele punt van deze
// module: vóór B1c-W0 kopieerde elke consument zijn eigen (pre-H1) as-wandeling, en die liepen
// stilzwijgend uit elkaar.
import type { TaskSplitGap } from '@/types/task';
import type { CalendarEngine } from './CalendarEngine';
import { parseDate, formatDate, addCalendarDays } from '@/utils/dateUtils';

export interface SplitSegmentBounds {
  start: Date;
  end: Date;
}

/**
 * Segmentgrenzen (Date-paren) voor een taak met `Task.splitGaps`, gewandeld vanaf `taskStart` met
 * de bestaande `CalendarEngine`-primitieven — zie de moduleuitleg hierboven voor de H1-as-
 * semantiek, de dag/uur-modus-keuze, de overlap-samenvoeging en de taakeinde-klem. `gaps.length
 * === 0` (of `undefined`) ⇒ één segment `[taskStart, taskEnd]` (geen split) — de aanroeper hoeft
 * dus niet zelf te guarden op een lege/afwezige `splitGaps`-array. `gaps` hoeft niet vooraf
 * gesorteerd te zijn (defensief gesorteerd op `afterMinutes`, zelfde conventie als
 * `splitTotalSpanMinutes`). `taskEnd <= taskStart` (corrupte input) kortsluit meteen naar één
 * segment, zonder de gaten-as aan te raken.
 */
export function computeSplitSegments(
  gaps: TaskSplitGap[] | undefined,
  taskStart: Date,
  taskEnd: Date,
  hourMode: boolean,
  eng: CalendarEngine,
): SplitSegmentBounds[] {
  if (!gaps || gaps.length === 0) return [{ start: taskStart, end: taskEnd }];
  if (taskEnd.getTime() <= taskStart.getTime()) return [{ start: taskStart, end: taskEnd }];
  const sorted = [...gaps].sort((a, b) => a.afterMinutes - b.afterMinutes);
  const minutesPerDay = Math.max(1, eng.hoursPerDay * 60);
  const endMs = taskEnd.getTime();

  // Klemt elke gewandelde grens op `taskEnd` — zie "GEEN GRENS VOORBIJ HET TAAKEINDE" hierboven:
  // corrupte/hostiele `gaps` (bv. een `afterMinutes` ver voorbij de taakspanne) mogen nooit een
  // segmentgrens ná het taakeinde opleveren, en al helemaal geen achterstevoren lopend segment.
  const walk = (from: Date, minutes: number): Date => {
    if (minutes <= 0) return from;
    const to = hourMode
      ? eng.addWorkMinutes(from, minutes)
      : (() => {
          const days = Math.round(minutes / minutesPerDay);
          return days > 0 ? eng.addWorkingDaysSigned(from, days) : from;
        })();
    return to.getTime() > endMs ? taskEnd : to;
  };

  const segments: SplitSegmentBounds[] = [];
  let cursor = taskStart;
  let axisPos = 0;
  for (const gap of sorted) {
    // Defensief, spiegelt `splitTotalSpanMinutes` (duration.ts) — zie de moduleuitleg hierboven.
    if (!Number.isFinite(gap.afterMinutes) || !Number.isFinite(gap.gapMinutes) || gap.gapMinutes <= 0) continue;
    const gapStartAxis = Math.max(gap.afterMinutes, axisPos);
    const gapEndAxis = gap.afterMinutes + gap.gapMinutes;
    if (gapEndAxis <= gapStartAxis) continue; // volledig al ingehaald/ontaard — geen segmentgrens
    const workBefore = gapStartAxis - axisPos;
    if (workBefore > 0 || segments.length === 0) {
      const gapStart = walk(cursor, workBefore);
      segments.push({ start: cursor, end: gapStart });
      cursor = gapStart;
    }
    // `workBefore === 0` mét al een segment op de lijst ⇒ dit gat sluit naadloos op het vorige aan
    // (overlap of aaneensluitend op de as) — geen extra nul-breed segment, het gat wordt verlengd.
    cursor = walk(cursor, gapEndAxis - gapStartAxis); // alleen het niet al ingehaalde deel
    axisPos = gapEndAxis; // H1: het gat telt zichzelf mee op de as
  }
  segments.push({ start: cursor, end: taskEnd });
  return segments;
}

/**
 * Dag-granulaire werk/gat-blokken voor een DAG-modus-taak van `durationDays` werkdagen — de
 * dag-tegenhanger van `computeSplitSegments`, uitgedrukt in aantallen dagen in plaats van
 * absolute datums (zodat `enumerateTaskWorkDays` hieronder er kalenderneutraal overheen kan
 * lopen). Zelfde H1-as-wandeling en afronding-op-hele-werkdagen als `computeSplitSegments`s
 * dag-tak, inclusief dezelfde overlap-samenvoeging: een blok waarvan `work` op 0 uitkomt (omdat
 * het volgende gat al (deels) binnen het vorige valt — de klem op `axisPos` maakt het mogelijk,
 * niet omdat een écht gat te klein is om als hele werkdag te ronden) wordt niet als apart blok
 * gepusht maar telt op bij het `gap` van het vorige blok — behalve voor het allereerste blok, dat
 * altijd gepusht wordt (zelfde "eerste segment altijd erbij"-uitzondering als
 * `computeSplitSegments`). Dit verandert `enumerateTaskWorkDays`s uitkomst niet (een nul-werk-blok
 * verbruikte toch al geen dagen); het houdt alleen de blokstructuur zelf kloppend voor toekomstige
 * lezers ervan. `durationDays <= 0` ⇒ één leeg blok; geen `gaps` ⇒ één blok van de volle duur.
 *
 * INVARIANT VOOR LEZERS: het SLOTBLOK (altijd het restant `durationDays - used`) wordt, anders dan
 * de tussenliggende blokken, onvoorwaardelijk gepusht — ook als dat `work: 0` oplevert (de laatste
 * gaten consumeren dan exact tot het taakeinde). Een lezer die op "geen enkel blok heeft
 * `work === 0`" leunt, moet dus zowel het eerste als het laatste blok als uitzondering behandelen;
 * elk blok DAARTUSSEN heeft altijd `work > 0`.
 */
export function splitDayPattern(
  gaps: TaskSplitGap[] | undefined,
  minutesPerDay: number,
  durationDays: number,
): Array<{ work: number; gap: number }> {
  if (durationDays <= 0) return [{ work: 0, gap: 0 }];
  if (!gaps || gaps.length === 0) return [{ work: durationDays, gap: 0 }];
  const sorted = [...gaps].sort((a, b) => a.afterMinutes - b.afterMinutes);
  const mpd = Math.max(1, minutesPerDay);
  const blocks: Array<{ work: number; gap: number }> = [];
  let axisPos = 0;
  let used = 0;
  for (const g of sorted) {
    // Defensief, spiegelt `splitTotalSpanMinutes` (duration.ts) — zie de moduleuitleg hierboven.
    // Zonder deze guard sijpelt een niet-finite gat door naar `Math.round`/`Math.max` verderop
    // (die geven dan stil `NaN` terug in plaats van het gat simpelweg te negeren).
    if (!Number.isFinite(g.afterMinutes) || !Number.isFinite(g.gapMinutes) || g.gapMinutes <= 0) continue;
    const gapStartAxis = Math.max(g.afterMinutes, axisPos);
    const gapEndAxis = g.afterMinutes + g.gapMinutes;
    if (gapEndAxis <= gapStartAxis) continue; // volledig al ingehaald/ontaard — geen blok
    const work = Math.min(Math.max(0, Math.round((gapStartAxis - axisPos) / mpd)), durationDays - used);
    const gap = Math.max(0, Math.round((gapEndAxis - gapStartAxis) / mpd));
    if (work > 0 || blocks.length === 0) {
      blocks.push({ work, gap });
    } else {
      // Sluit naadloos op het vorige blok aan (overlap op de as) — geen apart nul-werk-blok, het
      // gat van het vorige blok wordt verlengd.
      blocks[blocks.length - 1].gap += gap;
    }
    used += work;
    axisPos = gapEndAxis; // H1: het gat telt zichzelf mee op de as
  }
  blocks.push({ work: Math.max(0, durationDays - used), gap: 0 });
  return blocks;
}

/**
 * De ISO-datums van elke werkdag die een gesplitste (of ongesplitste) DAG-modus-taak daadwerkelijk
 * werkt, gegeven de start en de duur in werkdagen — de gedeelde bron voor lastlezers
 * (`ResourceLoad`/`ResourceLeveler`) die willen weten OP WELKE dagen een taak boekt, zonder zelf
 * een kalenderwandeling te herschrijven. Loopt `splitDayPattern`s werk/gat-blokken af en
 * verbruikt daarbij telkens het eerstvolgende aantal werkdagen (via `CalendarEngine.isWorkDay`,
 * niet-werkdagen worden overgeslagen zonder een blok te verbruiken) — gat-blokken tellen mee voor
 * het overslaan van dagen maar leveren geen ISO-datum op.
 */
export function enumerateTaskWorkDays(
  gaps: TaskSplitGap[] | undefined,
  engine: CalendarEngine,
  startIso: string,
  durationDays: number,
): string[] {
  const blocks = splitDayPattern(gaps, engine.hoursPerDay * 60, durationDays);
  const isos: string[] = [];
  let current = parseDate(startIso);
  let guard = 0;
  const MAX_DAYS = 200_000; // zelfde veiligheidsgrens als CalendarEngine/enumerateWorkDays
  const consumeWorkDays = (n: number, collect: boolean) => {
    let taken = 0;
    while (taken < n && guard++ < MAX_DAYS) {
      if (engine.isWorkDay(current)) {
        if (collect) isos.push(formatDate(current));
        taken++;
      }
      current = addCalendarDays(current, 1);
    }
  };
  for (const b of blocks) {
    consumeWorkDays(b.work, true);
    consumeWorkDays(b.gap, false);
  }
  return isos;
}

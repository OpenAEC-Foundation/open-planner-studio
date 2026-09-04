// Scherm ↔ print: dezelfde vragen, hetzelfde antwoord (K-item 39).
//
// AANLEIDING. `printPreview.ts` bouwt zijn eigen tijdlijn-kopstrook en zijn eigen rasterachtergrond.
// Dat mág — de afdruk is een andere, simpelere weergave dan het scherm — maar het betekent wel dat
// drie vragen op twee plekken beantwoord worden. En ze waren uit elkaar gelopen:
//
//   1. WEEKNUMMER. Het scherm gebruikt `getWeekNumberFor(d, weekStartDay)`; de afdruk gebruikte
//      `getWeekNumber(d)`, dus altijd ISO/maandag. `ui.weekStartDay` is een gewone instelling in
//      het instellingenpaneel, dus wie "week begint op zondag" koos kreeg twee antwoorden voor
//      hetzelfde project.
//   2. WEEKGRENS. Het weeklabel én de zwaardere verticale rasterlijn stonden hard op maandag
//      (`dow === 1`), terwijl het scherm `dayOfWeek === (weekStartDay === 'sunday' ? 7 : 1)` doet.
//   3. NIET-WERKDAGEN. De afdruk arceerde `dow === 6 || dow === 7`. Het scherm doet dat sinds B2
//      via `CalendarEngine.isWorkDay` — met een expliciet commentaar erbij dat er géén hardcoded
//      za/zo meer staat. Een project met zaterdag als werkdag (in de bouw eerder regel dan
//      uitzondering) kreeg op papier dus andere vrije dagen dan op het scherm.
//
// WAT DEZE BATTERIJ WEL EN NIET DOET. Hij toetst de gedeelde BESLISSINGEN, niet de tekening: het
// print-pad rendert naar een `Draw2D` en dat is hier niet zinvol na te bootsen. Voor de eerste twee
// punten kan dat gedragsmatig (de functies zijn puur); voor het derde is er naast de gedeelde
// functie een bron-assert, want "gebruikt de afdruk de kalender?" is geen uitkomst die je uit een
// getal afleest.
//
// Draait via run.sh. Exit 0 = alles groen.
import './domStub';
import { getWeekNumberFor, parseDate, isoDayOfWeek } from '@/utils/dateUtils';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import type { WorkCalendar } from '@/types/calendar';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};

// ── 1. De weekdefinitie verschilt écht per instelling ───────────────────────
// Zonder dit is de rest zinloos: als maandag en zondag toch hetzelfde opleveren, bewaakt de fix
// niets. 2026-01-01 is een donderdag — de jaarwisseling is precies waar ISO en de Amerikaanse
// telling uiteenlopen.
{
  const verschillen = ['2026-01-01', '2026-01-04', '2026-01-05', '2026-06-15', '2026-12-31']
    .map((iso) => {
      const d = parseDate(iso);
      return { iso, ma: getWeekNumberFor(d, 'monday'), zo: getWeekNumberFor(d, 'sunday') };
    });
  const anders = verschillen.filter((v) => v.ma !== v.zo);
  eq(`1 maandag en zondag geven echt andere weeknummers (${JSON.stringify(verschillen)})`,
    anders.length > 0, true);
  // En de zondag-variant verspringt op zondag, niet op maandag.
  eq('1a zondag 2026-01-04 begint een nieuwe week',
    getWeekNumberFor(parseDate('2026-01-04'), 'sunday') > getWeekNumberFor(parseDate('2026-01-03'), 'sunday'), true);
  eq('1b en maandag 2026-01-05 niet',
    getWeekNumberFor(parseDate('2026-01-05'), 'sunday'), getWeekNumberFor(parseDate('2026-01-04'), 'sunday'));
}

// ── 2. De weekgrens-dag volgt de instelling ─────────────────────────────────
// Dit is exact de uitdrukking die zowel `GanttRenderer` als (sinds dit item) `printPreview` gebruikt.
{
  const grensDag = (wsd: 'monday' | 'sunday') => (wsd === 'sunday' ? 7 : 1);
  eq('2 maandag ⇒ ISO-dag 1', grensDag('monday'), 1);
  eq('2a zondag ⇒ ISO-dag 7', grensDag('sunday'), 7);
}

// ── 3. Een afwijkende werkweek geeft andere vrije dagen ─────────────────────
// De kern van punt 3: met een kalender waarin zaterdag werkdag is, moet "vrij" iets anders zijn dan
// za+zo. Zonder deze check zou een terugval naar hardcoded za/zo op een ma–vr-project onzichtbaar
// blijven — en precies daarom faalt zo'n regressie normaal gesproken pas bij een echte gebruiker.
{
  const zesdaags: WorkCalendar = {
    id: 'c1', name: 'Zesdaagse bouwweek', description: '',
    workDays: [1, 2, 3, 4, 5, 6], workStartHour: 7, workEndHour: 16, hoursPerDay: 8,
    holidays: [{ name: 'Feestdag', startDate: '2026-06-03', endDate: '2026-06-03' }],
  };
  const engine = new CalendarEngine(zesdaags);
  // 2026-06-06 is een zaterdag, 2026-06-07 een zondag.
  eq('3 zaterdag is werkdag in deze kalender', engine.isWorkDay(parseDate('2026-06-06')), true);
  eq('3a zondag niet', engine.isWorkDay(parseDate('2026-06-07')), false);
  eq('3b de feestdag ook niet', engine.isWorkDay(parseDate('2026-06-03')), false);

  // De oude hardcoded regel, letterlijk zoals hij in printPreview stond (`isoDayOfWeek`: 6=za, 7=zo).
  // Op zaterdag zegt hij "vrij" en de kalender "werkdag" — dat is de afwijking die op papier stond.
  const oudVrij = (iso: string) => { const dow = isoDayOfWeek(parseDate(iso)); return dow === 6 || dow === 7; };
  const kalenderVrij = (iso: string) => !engine.isWorkDay(parseDate(iso));
  eq('3c op zaterdag zijn de oude regel en de kalender het oneens',
    oudVrij('2026-06-06') !== kalenderVrij('2026-06-06'), true);
  eq('3d op zondag zijn ze het eens', oudVrij('2026-06-07'), kalenderVrij('2026-06-07'));
  // De feestdag mist de oude regel volledig — die viel op een woensdag.
  eq('3e de oude regel ziet de feestdag niet', oudVrij('2026-06-03'), false);
  eq('3f de kalender wel', kalenderVrij('2026-06-03'), true);

  // Een gewone ma–vr-kalender moet ONgewijzigd blijven — anders is dit geen fix maar een nieuwe bug.
  const vijfdaags: WorkCalendar = { ...zesdaags, id: 'c2', workDays: [1, 2, 3, 4, 5], holidays: [] };
  const e5 = new CalendarEngine(vijfdaags);
  for (const [iso, verwacht] of [
    ['2026-06-01', true], ['2026-06-02', true], ['2026-06-03', true], ['2026-06-04', true],
    ['2026-06-05', true], ['2026-06-06', false], ['2026-06-07', false],
  ] as [string, boolean][]) {
    eq(`3g ma–vr blijft identiek voor ${iso}`, e5.isWorkDay(parseDate(iso)), verwacht);
  }
}

// ── 4. Bron-assert: de afdruk beslist niet meer zelf ────────────────────────
{
  const { readFileSync, existsSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { join, dirname } = await import('node:path');
  let root = dirname(fileURLToPath(import.meta.url));
  while (!existsSync(join(root, 'package.json')) && dirname(root) !== root) root = dirname(root);

  const strip = (src: string): string => {
    let out = ''; let mode: 'code' | 'line' | 'block' | '"' | "'" | '`' = 'code';
    for (let i = 0; i < src.length; i++) {
      const c = src[i], n = src[i + 1];
      if (mode === 'code') {
        if (c === '/' && n === '/') { mode = 'line'; i++; continue; }
        if (c === '/' && n === '*') { mode = 'block'; i++; continue; }
        if (c === '"' || c === "'" || c === '`') mode = c;
        out += c;
      } else if (mode === 'line') { if (c === '\n') { mode = 'code'; out += c; } }
      else if (mode === 'block') { if (c === '*' && n === '/') { mode = 'code'; i++; } }
      else { if (c === '\\') { out += c + (n ?? ''); i++; continue; } if (c === mode) mode = 'code'; out += c; }
    }
    return out;
  };

  const printPath = join(root, 'src/services/print/printPreview.ts');
  const panelPath = join(root, 'src/components/panels/ReportPanel.tsx');
  checks++;
  if (!existsSync(printPath) || !existsSync(panelPath)) {
    diffs.push('4 bron-assert overgeslagen: bestanden niet gevonden vanaf de bundelplek');
  } else {
    const print = strip(readFileSync(printPath, 'utf8'));
    const panel = strip(readFileSync(panelPath, 'utf8'));

    eq('4a de stripper haalt commentaar weg', print.includes('K-item 39'), false);
    eq('4b de stripper laat code staan', print.includes('drawTimelineHeader'), true);

    // (1) weeknummer via de gedeelde functie, niet meer de ISO-only variant.
    eq('5 de afdruk gebruikt getWeekNumberFor', /getWeekNumberFor\(date, wsd\)/.test(print), true);
    eq('5a en niet meer de ISO-only getWeekNumber', /\bgetWeekNumber\(/.test(print), false);

    // (2) weeklabel én rasterlijn op de INGESTELDE dag.
    eq('6 het weeklabel staat op de ingestelde dag', /dow === weekStartDow/.test(print), true);
    eq('6a de zwaardere rasterlijn ook',
      /: dow === \(weekStartDay === 'sunday' \? 7 : 1\)/.test(print), true);
    eq('6b geen harde maandag-grens meer', /dow === 1 \? 0\.8/.test(print), false);

    // (3) arcering via de kalender, niet via za/zo. Sinds de merge met de T13-lijn heet de motor
    // `calEngine` en dekt de arcering óók workingExceptions (isWorkDay > isHoliday > weekend) —
    // het pin-punt blijft hetzelfde: de kalender beslist, geen dag-van-de-week-rekenwerk.
    eq('7 de arcering vraagt het de kalender', /calEngine\.isWorkDay\(date\)/.test(print), true);
    eq('7a geen hardcoded za/zo meer', /dow === 6 \|\| dow === 7/.test(print), false);

    // En het paneel geeft de instelling ook echt door — zonder dat is alles hierboven dode code.
    eq('8 het rapportpaneel leest ui.weekStartDay', /s\.ui\.weekStartDay/.test(panel), true);
    eq('8a en zet hem in de printopties', /\bweekStartDay,/.test(panel), true);

    // De werkdagen-as hoort sinds issue #21 bij de rapportopties zelf. De schermvoorkeur mag
    // hier dus niet als impliciete bron binnensluipen.
    eq('8b het rapport leest niet ui.compressNonWorkdays', /s\.ui\.compressNonWorkdays/.test(panel), false);
    eq('8c het rapport heeft een eigen werkdagen-state',
      /useState\(DEFAULT_REPORT_SETTINGS\.compressNonWorkdays\)/.test(panel), true);
    eq('8d alleen die rapport-state gaat naar de printopties',
      /compressNonWorkdays: reportCompressNonWorkdays/.test(panel), true);
  }
}

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK: scherm↔print-pariteit — ${checks} checks groen`);
} else {
  console.log(`XX scherm↔print-pariteit — ${diffs.length} van ${checks} checks rood:`);
  for (const d of diffs) console.log(`   XX ${d}`);
  process.exit(1);
}

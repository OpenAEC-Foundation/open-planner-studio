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

{
  const verschillen = ['2026-01-01', '2026-01-04', '2026-01-05', '2026-06-15', '2026-12-31']
    .map((iso) => {
      const d = parseDate(iso);
      return { iso, ma: getWeekNumberFor(d, 'monday'), zo: getWeekNumberFor(d, 'sunday') };
    });
  const anders = verschillen.filter((v) => v.ma !== v.zo);
  eq(`1 maandag en zondag geven echt andere weeknummers (${JSON.stringify(verschillen)})`,
    anders.length > 0, true);
  eq('1a zondag 2026-01-04 begint een nieuwe week',
    getWeekNumberFor(parseDate('2026-01-04'), 'sunday') > getWeekNumberFor(parseDate('2026-01-03'), 'sunday'), true);
  eq('1b en maandag 2026-01-05 niet',
    getWeekNumberFor(parseDate('2026-01-05'), 'sunday'), getWeekNumberFor(parseDate('2026-01-04'), 'sunday'));
}

{
  const grensDag = (wsd: 'monday' | 'sunday') => (wsd === 'sunday' ? 7 : 1);
  eq('2 maandag ⇒ ISO-dag 1', grensDag('monday'), 1);
  eq('2a zondag ⇒ ISO-dag 7', grensDag('sunday'), 7);
}

{
  const zesdaags: WorkCalendar = {
    id: 'c1', name: 'Zesdaagse bouwweek', description: '',
    workDays: [1, 2, 3, 4, 5, 6], workStartHour: 7, workEndHour: 16, hoursPerDay: 8,
    holidays: [{ name: 'Feestdag', startDate: '2026-06-03', endDate: '2026-06-03' }],
  };
  const engine = new CalendarEngine(zesdaags);
  eq('3 zaterdag is werkdag in deze kalender', engine.isWorkDay(parseDate('2026-06-06')), true);
  eq('3a zondag niet', engine.isWorkDay(parseDate('2026-06-07')), false);
  eq('3b de feestdag ook niet', engine.isWorkDay(parseDate('2026-06-03')), false);

  const oudVrij = (iso: string) => { const dow = isoDayOfWeek(parseDate(iso)); return dow === 6 || dow === 7; };
  const kalenderVrij = (iso: string) => !engine.isWorkDay(parseDate(iso));
  eq('3c op zaterdag zijn de oude regel en de kalender het oneens',
    oudVrij('2026-06-06') !== kalenderVrij('2026-06-06'), true);
  eq('3d op zondag zijn ze het eens', oudVrij('2026-06-07'), kalenderVrij('2026-06-07'));
  eq('3e de oude regel ziet de feestdag niet', oudVrij('2026-06-03'), false);
  eq('3f de kalender wel', kalenderVrij('2026-06-03'), true);

  const vijfdaags: WorkCalendar = { ...zesdaags, id: 'c2', workDays: [1, 2, 3, 4, 5], holidays: [] };
  const e5 = new CalendarEngine(vijfdaags);
  for (const [iso, verwacht] of [
    ['2026-06-01', true], ['2026-06-02', true], ['2026-06-03', true], ['2026-06-04', true],
    ['2026-06-05', true], ['2026-06-06', false], ['2026-06-07', false],
  ] as [string, boolean][]) {
    eq(`3g ma–vr blijft identiek voor ${iso}`, e5.isWorkDay(parseDate(iso)), verwacht);
  }
}

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
  const panelPath = join(root, 'src/components/panels/reportStudio/useStudioPrintOptions.ts');
  checks++;
  if (!existsSync(printPath) || !existsSync(panelPath)) {
    diffs.push('4 bron-assert overgeslagen: bestanden niet gevonden vanaf de bundelplek');
  } else {
    const print = strip(readFileSync(printPath, 'utf8'));
    const panel = strip(readFileSync(panelPath, 'utf8'));

    eq('4a de stripper haalt commentaar weg', print.includes('K-item 39'), false);
    eq('4b de stripper laat code staan', print.includes('drawTimelineHeader'), true);

    eq('5 de afdruk gebruikt getWeekNumberFor', /getWeekNumberFor\(date, wsd\)/.test(print), true);
    eq('5a en niet meer de ISO-only getWeekNumber', /\bgetWeekNumber\(/.test(print), false);

    eq('6 het weeklabel staat op de ingestelde dag', /dow === weekStartDow/.test(print), true);
    eq('6a de zwaardere rasterlijn ook',
      /: dow === \(weekStartDay === 'sunday' \? 7 : 1\)/.test(print), true);
    eq('6b geen harde maandag-grens meer', /dow === 1 \? 0\.8/.test(print), false);

    eq('7 de arcering vraagt het de kalender', /calEngine\.isWorkDay\(date\)/.test(print), true);
    eq('7a geen hardcoded za/zo meer', /dow === 6 \|\| dow === 7/.test(print), false);

    eq('8 het Rapport-tabblad leest ui.weekStartDay', /s\.ui\.weekStartDay/.test(panel), true);
    eq('8a en zet hem in de printopties', /\bweekStartDay,/.test(panel), true);

    eq('8b het rapport leest niet ui.compressNonWorkdays', /s\.ui\.compressNonWorkdays/.test(panel), false);
    eq('8c alleen de rapportinstelling gaat naar de printopties',
      /compressNonWorkdays: settings\.compressNonWorkdays/.test(panel), true);
  }
}

if (diffs.length === 0) {
  console.log(`OK: scherm↔print-pariteit — ${checks} checks groen`);
} else {
  console.log(`XX scherm↔print-pariteit — ${diffs.length} van ${checks} checks rood:`);
  for (const d of diffs) console.log(`   XX ${d}`);
  process.exit(1);
}

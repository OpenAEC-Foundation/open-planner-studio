// XML-adapter-getrouwheid (import/export-audit 2026-09, bevindingen 3, 4, 7 en 8). Elk blok draait de
// ECHTE writers/readers (en waar het om planning gaat ook `solveProject`) en bewaakt één route waar
// een eigen export of een MS Project-/P6-bestand vóór de fix stil anders terugkwam dan hij erin ging:
//
//  3. XML-formaatherkenning — `parseOpenedFile` koos de XML-lezer op de vrije tekst
//     (`content.includes('Primavera')`): een MS Project-XML met "Primavera" in een project- of
//     taaknaam ging naar de P6-lezer en opende als leeg project "P6 Import". Nu beslist het
//     root-element/de namespace (`detectXmlFlavor`, gedeeld met de MCP-import).
//  4. Uur-lag in MSPDI — de writer schreef een elapsed-uur-lag ("+3eu") als LinkLag 0 (de elapsed-dag-
//     tak kwam vóór `lagMinutes`); de lezer rondde LagFormat 4/6 (elapsed minuten/uren) af op hele
//     dagen. Werktijd-uur-lags en dag-lags blijven exact zoals ze waren.
//  7. Soort mijlpaal in MSPDI — de writer schreef alleen `<Milestone>`, de lezer reconstrueerde de
//     soort alleen in uurmodus: een eindmijlpaal kwam in dagmodus als "automatisch" terug en schoof
//     een werkdag op. Nu draagt een OPS-ExtendedAttribute (`OPS_MilestoneKind`) START/FINISH/AUTO;
//     een bestand zonder die OPS-definitie (MS Project zelf) wordt gelezen zoals voorheen.
//  8. P6-datumprecisie — de P6-lezer koppelde de tijd-van-de-dag aan de duureenheid: een dagtaak op
//     een urenkalender verloor de tijd van al haar datums (ook actuals). Nu volgt de precisie de
//     kalender, zoals mspdiReader en de IFC-lezer al deden.
//  Knownbug176: een ongeldige projectstart met XML-metatekens blijft tekst bij MSPDI-export;
//     geldige datumopmaak en de bestaande leesregels (prefix/ontbrekend anker) blijven behouden.
//  Knownbug185: dezelfde XML-integriteit voor projecteinde/statusdatum en de overige MSPDI-datums.
//
// Draait via run.sh. Exit 0 = alles groen.
import { writeMSPDI } from '@/services/msproject/mspdiWriter';
import { readMSPDI } from '@/services/msproject/mspdiReader';
import { writeP6XML } from '@/services/p6/p6xmlWriter';
import { readP6XML } from '@/services/p6/p6xmlReader';
import { detectXmlFlavor, parseOpenedFile } from '@/services/formatRegistry';
import { solveProject } from '@/engine/scheduler/solveProject';
import { effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import type { Task, MilestoneKind } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar, WorkTimeBands } from '@/types/calendar';
import type { Project } from '@/types/project';
import type { Baseline } from '@/types/baseline';
import { activeImportResult, type ImportResult } from '@/services/importTypes';
import { installDOMParser } from './xmldom-shim';

installDOMParser();
// De writers waarschuwen via console.warn over bewuste verliezen (P6 kent geen elapsed-lag e.d.);
// die ruis hoort niet in de testuitvoer.
console.warn = () => {};

let checks = 0;
let fails = 0;
function assert(cond: boolean, msg: string): void {
  checks++;
  if (!cond) { fails++; console.log(`XX ${msg}`); }
}
function eq(name: string, got: unknown, want: unknown): void {
  assert(JSON.stringify(got) === JSON.stringify(want), `${name}: kreeg ${JSON.stringify(got)} ≠ verwacht ${JSON.stringify(want)}`);
}

// ── Fixtures ────────────────────────────────────────────────────────────────────────────────
const weekBands = (list: [number, number][]): WorkTimeBands['byWeekday'] => {
  const bw = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] } as WorkTimeBands['byWeekday'];
  for (let d = 1; d <= 5; d++) bw[d as 1] = list.map(([s, e]) => ({ start: s, end: e }));
  return bw;
};
/** Urenkalender (ma-vr 08-16) — uurmodus. */
const H8 = (): WorkCalendar => ({
  id: 'cal-h8', name: 'H8', description: 'ma-vr 08-16', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [], workTime: { byWeekday: weekBands([[480, 960]]) },
});
/** Dagkalender (geen `workTime`) — dagmodus. */
const DAY = (): WorkCalendar => ({
  id: 'cal-day', name: 'Standaard', description: 'ma-vr', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
});
const proj = (name: string, calendarId: string, startDate: string): Project => ({
  id: 'p', name, description: '', startDate, endDate: '', calendarId,
  createdAt: `${startDate}T00:00`, modifiedAt: `${startDate}T00:00`, author: 'T', company: 'C',
});
const mkDay = (id: string, name: string, wbs: string, start: string, finish: string, days: number, extra: Partial<Task> = {}): Task => ({
  id, name, description: '', wbsCode: wbs, taskType: 'CONSTRUCTION', status: 'NOT_STARTED', isMilestone: days === 0,
  priority: 500, parentId: null, childIds: [],
  time: {
    durationType: 'WORKTIME', durationUnit: 'days', scheduleDuration: days,
    scheduleStart: start, scheduleFinish: finish, earlyStart: start, earlyFinish: finish,
    lateStart: start, lateFinish: finish, freeFloat: 0, totalFloat: 0, isCritical: false, completion: 0,
  },
  resourceIds: [],
  ...extra,
});
const mkHour = (id: string, name: string, wbs: string, start: string, finish: string, minutes: number, extra: Partial<Task> = {}): Task => ({
  id, name, description: '', wbsCode: wbs, taskType: 'CONSTRUCTION', status: 'NOT_STARTED', isMilestone: minutes === 0,
  priority: 500, parentId: null, childIds: [],
  time: {
    durationType: 'WORKTIME', durationUnit: 'hours', scheduleDuration: minutes / 480, durationMinutes: minutes,
    scheduleStart: start, scheduleFinish: finish, earlyStart: start, earlyFinish: finish,
    lateStart: start, lateFinish: finish, freeFloat: 0, totalFloat: 0, isCritical: false, completion: 0,
  },
  resourceIds: [],
  ...extra,
});
const seq = (id: string, pred: string, succ: string, lag: Partial<Sequence> = {}): Sequence => ({
  id, predecessorId: pred, successorId: succ, type: 'FINISH_START', lagDays: 0, ...lag,
});
const byName = (r: { tasks: Task[] }, name: string): Task | undefined => r.tasks.find(t => t.name === name);
const lagInto = (r: { tasks: Task[]; sequences: Sequence[] }, succName: string): Sequence | undefined => {
  const succ = byName(r, succName);
  return r.sequences.find(s => s.successorId === succ?.id);
};
const lagFields = (s: Sequence | undefined) => s && ({
  lagDays: s.lagDays, lagMinutes: s.lagMinutes, lagUnit: s.lagUnit, lagPercent: s.lagPercent,
});
/** Plan een ingelezen (of eigen) project door met de echte solver-keten; muteert `tasks`. Bewust
 *  zonder projectprofiel (OPS-standaardconventies) voor zowel origineel als rondreis: de check vergelijkt
 *  de adapter-uitvoer, niet het rekenprofiel dat het bestand voorstelt. */
function solve(r: { tasks: Task[]; sequences: Sequence[]; calendar: WorkCalendar; resourceCalendars?: WorkCalendar[] }): void {
  const res = solveProject({ tasks: r.tasks, sequences: r.sequences, calendar: r.calendar, calendars: r.resourceCalendars ?? [],
    schedulingOptions: effectiveSchedulingOptions({}) });
  assert(!res.error, `solveProject gaf een fout: ${res.error ?? ''}`);
}

async function main(): Promise<void> {
  // ════ Knownbug176. Projectstart blijft XML-tekst, ook na een vergevende import ═══════════════
  {
    const cal = DAY();
    const project = proj('Projectstart', cal.id, '2026-07-06');
    const tasks = [mkDay('anker', 'Ankertaak', '1', '2026-07-07', '2026-07-08', 2)];
    // Letterlijke verwachtingen: de DOM-shim controleert geen XML-welgevormdheid. Alleen heropenen
    // zou een kale '&' of een als element geïnterpreteerde '<…>' dus niet betrouwbaar afvangen.
    const cases = [
      ['dag', '2026-07-06', '2026-07-06T08:00:00', '2026-07-06'],
      ['minuten', '2026-07-06T09:30', '2026-07-06T09:30:00', '2026-07-06'],
      ['seconden', '2026-07-06T09:30:45', '2026-07-06T09:30:45', '2026-07-06'],
      ['tijdzone', '2026-07-06T09:30:45+02:00', '2026-07-06T09:30:45+02:00', '2026-07-06'],
      ['ongeldige maand', '2026-13-06', '2026-13-06T08:00:00', '2026-13-06'],
      ['ongeldige tekst', 'onleesbaar', 'onleesbaarT08:00:00', 'onleesbaar'],
      ['korte tekst', 'NA', 'NA', 'NA'],
      ['leeg', '', '', '2026-07-07'],
      ['XML-metatekens', `<&>"'abcde`, '&lt;&amp;&gt;&quot;&apos;abcdeT08:00:00', `<&>"'abcde`],
      ['letterlijke entiteit', '&lt;abcde?', '&amp;lt;abcde?T08:00:00', '&lt;abcde?'],
      ['CDATA-einde', 'ab]]>cdefg', 'ab]]&gt;cdefgT08:00:00', 'ab]]>cdefg'],
      ['XML in minutenlengte', 'onleesbaar<&>abc', 'onleesbaar&lt;&amp;&gt;abc:00', 'onleesbaar'],
      ['XML-elementen', '</StartDate><Injected/>', '&lt;/StartDate&gt;&lt;Injected/&gt;', '</StartDat'],
    ] as const;
    for (const [label, startDate, xmlText, importedStart] of cases) {
      // Alleen de start vervangen: aanmaakdatum en taakdatums blijven geldige fixturedata.
      const xml = writeMSPDI({ ...project, startDate }, cal, tasks, [], [], []);
      eq(`176/${label}: letterlijke XML-inhoud`, xml.match(/<StartDate>([\s\S]*?)<\/StartDate>/)?.[1], xmlText);
      const back = readMSPDI(xml);
      eq(`176/${label}: heropenen volgt bestaande projectstartregel`, back.project.startDate, importedStart);
      eq(`176/${label}: taak blijft heropenbaar`, back.tasks.map(t => [t.name, t.time.scheduleStart, t.time.scheduleFinish]),
        [['Ankertaak', '2026-07-07', '2026-07-08']]);
    }

    // De oorspronkelijke route: geldige XML draagt ongeldige datumtekst. De reader bewaart de
    // eerste tien tekens; export mag die niet als XML-syntaxis terugschrijven of normaliseren.
    const imported = readMSPDI(`<Project xmlns="http://schemas.microsoft.com/project">
      <Name>Doorvoer</Name><StartDate>&lt;&amp;&gt;&quot;&apos;abcde-ongeldig</StartDate>
      <Tasks><Task><UID>1</UID><ID>1</ID><Name>Ankertaak</Name><OutlineLevel>1</OutlineLevel>
        <Start>2026-07-07T08:00:00</Start><Finish>2026-07-08T08:00:00</Finish><Duration>PT16H0M0S</Duration>
      </Task></Tasks></Project>`);
    eq('176/doorvoer: reader bewaart ongeldige prefix', imported.project.startDate, `<&>"'abcde`);
    const xml = writeMSPDI(imported.project, imported.calendar, imported.tasks, imported.sequences,
      imported.resources, imported.assignments, imported.resourceCalendars);
    eq('176/doorvoer: export bewaart prefix als XML-tekst', xml.match(/<StartDate>([\s\S]*?)<\/StartDate>/)?.[1],
      '&lt;&amp;&gt;&quot;&apos;abcdeT08:00:00');
    const reopened = readMSPDI(xml);
    eq('176/doorvoer: projectstart blijft gelijk na heropenen', reopened.project.startDate, imported.project.startDate);
    eq('176/doorvoer: taak blijft behouden', reopened.tasks.map(t => t.name), ['Ankertaak']);
  }

  // ════ Knownbug185. Projecteinde/statusdatum en overige datums blijven XML-tekst ══════════════
  {
    const cal = DAY();
    const project = proj('Projectdatums', cal.id, '2026-07-06');
    const tasks = [mkDay('anker', 'Ankertaak', '1', '2026-07-07', '2026-07-08', 2)];
    // De letterlijke uitvoer is de XML-oracle: de DOM-shim valideert geen welgevormdheid.
    // Einddatum leest alleen de prefix; statusdatum bewaart een echte tijd, behalve het dag-anker.
    const cases = [
      ['dag', '2026-07-06', '2026-07-06T08:00:00', '2026-07-06', '2026-07-06'],
      ['minuten', '2026-07-06T09:30', '2026-07-06T09:30:00', '2026-07-06', '2026-07-06T09:30'],
      ['seconden', '2026-07-06T09:30:45', '2026-07-06T09:30:45', '2026-07-06', '2026-07-06T09:30'],
      ['tijdzone', '2026-07-06T09:30:45+02:00', '2026-07-06T09:30:45+02:00', '2026-07-06', '2026-07-06T09:30'],
      ['dag-anker', '2026-07-06T08:00', '2026-07-06T08:00:00', '2026-07-06', '2026-07-06'],
      ['leeg', '', undefined, '', undefined],
      ['ongeldige maand', '2026-13-06', '2026-13-06T08:00:00', '2026-13-06', '2026-13-06'],
      ['ongeldige tekst', 'onleesbaar', 'onleesbaarT08:00:00', 'onleesbaar', 'onleesbaar'],
      ['korte tekst', 'NA', 'NA', 'NA', 'NA'],
      ['XML-metatekens', `<&>"'abcde`, '&lt;&amp;&gt;&quot;&apos;abcdeT08:00:00', `<&>"'abcde`, `<&>"'abcde`],
      ['letterlijke entiteit', '&lt;abcde?', '&amp;lt;abcde?T08:00:00', '&lt;abcde?', '&lt;abcde?'],
      ['letterlijke tekenverwijzing', '&#65;abcde', '&amp;#65;abcdeT08:00:00', '&#65;abcde', '&#65;abcde'],
      ['CDATA-einde', 'ab]]>cdefg', 'ab]]&gt;cdefgT08:00:00', 'ab]]>cdefg', 'ab]]>cdefg'],
      ['XML in minutenlengte', 'onleesbaar<&>abc', 'onleesbaar&lt;&amp;&gt;abc:00', 'onleesbaar', 'onleesbaar'],
      ['XML na tijd', '2026-07-06T09:30<&>', '2026-07-06T09:30&lt;&amp;&gt;', '2026-07-06', '2026-07-06'],
      ['einddatum-elementinvoeging', '</FinishDate><Injected/>', '&lt;/FinishDate&gt;&lt;Injected/&gt;', '</FinishDa', '</FinishDa'],
      ['statusdatum-elementinvoeging', '</StatusDate><Injected/>', '&lt;/StatusDate&gt;&lt;Injected/&gt;', '</StatusDa', '</StatusDa'],
    ] as const;
    for (const [field, tag] of [['endDate', 'FinishDate'], ['statusDate', 'StatusDate']] as const) {
      for (const [label, value, xmlText, importedEnd, importedStatus] of cases) {
        const xml = writeMSPDI({ ...project, [field]: value }, cal, tasks, [], [], []);
        eq(`185/${field}/${label}: letterlijke XML-inhoud`, xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))?.[1], xmlText);
        assert(!xml.includes('<Injected/>'), `185/${field}/${label}: geen ingevoegd element`);
        const back = readMSPDI(xml);
        eq(`185/${field}/${label}: bestaande leesregel`, back.project[field], field === 'endDate' ? importedEnd : importedStatus);
        eq(`185/${field}/${label}: taak blijft heropenbaar`, back.tasks.map(t => [t.name, t.time.scheduleStart, t.time.scheduleFinish]),
          [['Ankertaak', '2026-07-07', '2026-07-08']]);
      }
    }
    const withoutStatus = writeMSPDI(project, cal, tasks, [], [], []);
    assert(!withoutStatus.includes('<StatusDate>'), '185/ontbrekend: geen StatusDate-element');
    eq('185/ontbrekend: statusdatum blijft afwezig na heropenen', readMSPDI(withoutStatus).project.statusDate, undefined);

    // Geldige XML met ongeldige datumtekst uit een ander programma: de bestaande prefix blijft
    // door import → export → heropenen behouden, ook als de tekst zelf een entiteit bevat.
    for (const [label, sourceText, prefix, xmlText] of [
      ['metatekens', '&lt;&amp;&gt;&quot;&apos;abcde-ongeldig', `<&>"'abcde`, '&lt;&amp;&gt;&quot;&apos;abcdeT08:00:00'],
      ['letterlijke entiteit', '&amp;lt;abcde?-ongeldig', '&lt;abcde?', '&amp;lt;abcde?T08:00:00'],
    ] as const) {
      const imported = readMSPDI(`<Project xmlns="http://schemas.microsoft.com/project">
        <Name>Doorvoer</Name><StartDate>2026-07-06T08:00:00</StartDate>
        <FinishDate>${sourceText}</FinishDate><StatusDate>${sourceText}</StatusDate>
        <Tasks><Task><UID>1</UID><ID>1</ID><Name>Ankertaak</Name><OutlineLevel>1</OutlineLevel>
          <Start>2026-07-07T08:00:00</Start><Finish>2026-07-08T08:00:00</Finish><Duration>PT16H0M0S</Duration>
        </Task></Tasks></Project>`);
      eq(`185/doorvoer/${label}: reader bewaart beide prefixes`, [imported.project.endDate, imported.project.statusDate], [prefix, prefix]);
      const xml = writeMSPDI(imported.project, imported.calendar, imported.tasks, imported.sequences,
        imported.resources, imported.assignments, imported.resourceCalendars);
      eq(`185/doorvoer/${label}: letterlijke einddatum`, xml.match(/<FinishDate>([\s\S]*?)<\/FinishDate>/)?.[1], xmlText);
      eq(`185/doorvoer/${label}: letterlijke statusdatum`, xml.match(/<StatusDate>([\s\S]*?)<\/StatusDate>/)?.[1], xmlText);
      const reopened = activeImportResult(await parseOpenedFile({ name: 'projectdatums.xml', text: xml }));
      eq(`185/doorvoer/${label}: beide datums blijven behouden na heropenen`, [reopened.project.endDate, reopened.project.statusDate], [prefix, prefix]);
      eq(`185/doorvoer/${label}: taak blijft behouden`, reopened.tasks.map(t => t.name), ['Ankertaak']);
    }
  }

  // Dezelfde schrijfgrens geldt voor aanmaakdatum, kalenderuitzonderingen, taakdatums en baseline.
  // Onleesbare taak-/kalenderdatums hebben andere importregels: hier telt hun letterlijke XML-uitvoer.
  {
    const text = `<&>"'abcde`;
    const xmlText = '&lt;&amp;&gt;&quot;&apos;abcdeT08:00:00';
    const cal = DAY();
    cal.holidays = [{ name: 'Vrij', startDate: text, endDate: text }];
    cal.workingExceptions = [{ name: 'Werk', startDate: text, endDate: text }];
    const task = mkDay('datums', 'Datums', '1', text, text, 1, { constraint: { type: 'SNET', date: text }, deadline: text });
    task.time.actualStart = text;
    task.time.actualFinish = text;
    task.time.completion = 1;
    const baseline: Baseline = {
      id: 'b', name: 'Peildatum', createdAt: '2026-07-06T08:00', projectEnd: text, projectDuration: 1,
      tasks: [{ taskId: task.id, start: text, finish: text, duration: 1, isMilestone: false }],
    };
    const xml = writeMSPDI({ ...proj('Datums', cal.id, '2026-07-06'), createdAt: text }, cal, [task], [], [], [], [], [baseline], baseline.id);
    eq('185/overige: aanmaakdatum als XML-tekst', xml.match(/<CreationDate>([\s\S]*?)<\/CreationDate>/)?.[1], xmlText);
    for (const tag of ['FromDate', 'ToDate']) {
      eq(`185/overige: beide kalenderuitzonderingen/${tag}`, [...xml.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g'))].map(m => m[1]), [xmlText, xmlText]);
    }
    for (const tag of ['Start', 'Finish']) {
      eq(`185/overige: taak en baseline/${tag}`, [...xml.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g'))].map(m => m[1]), [xmlText, xmlText]);
    }
    for (const tag of ['ActualStart', 'ActualFinish', 'ConstraintDate', 'Deadline']) {
      eq(`185/overige: taak/${tag}`, xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))?.[1], xmlText);
    }
  }

  // ════ 3. XML-formaatherkenning op root-element/namespace, niet op vrije tekst ══════════════════
  {
    const cal = DAY();
    const tasks = [
      mkDay('x1', 'Fundering', '1', '2027-03-01', '2027-03-05', 5),
      mkDay('x2', 'Planning overzetten naar Primavera', '2', '2027-03-08', '2027-03-12', 5),
    ];
    const mspdi = writeMSPDI(proj('Residencial Primavera', cal.id, '2027-03-01'), cal, tasks, [seq('xs', 'x1', 'x2')], [], []);
    const back = activeImportResult(await parseOpenedFile({ name: 'export.xml', text: mspdi }));
    eq('#3 MSPDI met "Primavera" in project- en taaknaam: alle taken terug', back.tasks.map(t => t.name), ['Fundering', 'Planning overzetten naar Primavera']);
    eq('#3 MSPDI met "Primavera": projectnaam blijft (geen "P6 Import")', back.project.name, 'Residencial Primavera');
    eq('#3 MSPDI met "Primavera": relatie blijft', back.sequences.length, 1);

    // Contrast: een echte P6-export (root APIBusinessObjects) gaat nog steeds naar de P6-lezer.
    const p6 = writeP6XML(proj('Kantoor', cal.id, '2027-03-01'), cal, tasks, [seq('xs', 'x1', 'x2')], [], []);
    const p6Back = activeImportResult(await parseOpenedFile({ name: 'export.xml', text: p6 }));
    eq('#3 P6-export blijft P6: alle taken terug', p6Back.tasks.filter(t => t.childIds.length === 0).map(t => t.name).sort(), ['Fundering', 'Planning overzetten naar Primavera']);
    eq('#3 P6-export blijft P6: projectnaam', p6Back.project.name, 'Kantoor');

    // Proloog vóór het root-element (BOM, commentaar) mag de herkenning niet breken.
    const withProlog = '\uFEFF' + mspdi.replace('<Project ', '<!-- geëxporteerd <Project> APIBusinessObjects Primavera -->\n<Project ');
    const prologBack = activeImportResult(await parseOpenedFile({ name: 'export.xml', text: withProlog }));
    eq('#3 MSPDI met BOM + commentaar vóór de root: alle taken terug', prologBack.tasks.length, 2);

    // Een onbekend XML-document met "Primavera" in de vrije tekst is géén P6: fout i.p.v. stil een
    // leeg project.
    let threw = false;
    try { await parseOpenedFile({ name: 'lijst.xml', text: '<?xml version="1.0"?><Lijst><Naam>Primavera</Naam></Lijst>' }); }
    catch { threw = true; }
    assert(threw, '#3 onbekende XML-root met "Primavera" in de tekst: gooit (geen leeg P6-project)');

    // De gedeelde beslissing zelf (ook gebruikt door het MCP-label `formatOf`).
    eq('#3 detect: eigen MSPDI-export', detectXmlFlavor(mspdi), 'mspdi');
    eq('#3 detect: eigen P6-export', detectXmlFlavor(p6), 'p6');
    eq('#3 detect: MSPDI met BOM + commentaar', detectXmlFlavor(withProlog), 'mspdi');
    eq('#3 detect: Project zonder namespace blijft MSPDI (compat)', detectXmlFlavor('<?xml version="1.0"?>\n<Project><Name>Primavera</Name></Project>'), 'mspdi');
    eq('#3 detect: MSPDI met prefix + DOCTYPE', detectXmlFlavor('<!DOCTYPE p [<!ENTITY x "y">]><msp:Project xmlns:msp="http://schemas.microsoft.com/project"/>'), 'mspdi');
    eq('#3 detect: P6 met oudere namespace-versie', detectXmlFlavor('<APIBusinessObjects xmlns="http://xmlns.oracle.com/Primavera/P6/V8.3/API/BusinessObjects"></APIBusinessObjects>'), 'p6');
    eq('#3 detect: Project in een vreemde namespace is geen MSPDI', detectXmlFlavor('<Project xmlns="urn:iets-anders"><Name>x</Name></Project>'), null);
    eq('#3 detect: onbekende root', detectXmlFlavor('<Lijst><Project/><APIBusinessObjects/></Lijst>'), null);
    eq('#3 detect: geen XML', detectXmlFlavor('Naam;Duur\nPrimavera;5'), null);
  }

  // ════ 4. Uur-lag in MSPDI (writer + lezer) ═══════════════════════════════════════════════════
  {
    const cal = H8();
    const tasks = [
      mkHour('h-a', 'A', '1', '2026-07-06T08:00', '2026-07-06T12:00', 240),
      mkHour('h-b', 'B', '2', '2026-07-06T15:00', '2026-07-06T16:00', 60),
      mkHour('h-c', 'C', '3', '2026-07-07T10:00', '2026-07-07T11:00', 60),
      mkHour('h-d', 'D', '4', '2026-07-09T11:00', '2026-07-09T12:00', 60),
      mkHour('h-e', 'E', '5', '2026-07-13T12:00', '2026-07-13T13:00', 60),
    ];
    const sequences = [
      seq('s-eu', 'h-a', 'h-b', { lagMinutes: 180, lagUnit: 'ELAPSEDTIME' }), // "+3eu"
      seq('s-u', 'h-b', 'h-c', { lagMinutes: 120 }),                            // "+2u"
      seq('s-ed', 'h-c', 'h-d', { lagDays: 2, lagUnit: 'ELAPSEDTIME' }),         // "+2ed"
      seq('s-d', 'h-d', 'h-e', { lagDays: 2 }),                                  // "+2d"
    ];
    const p = proj('Uurlag', cal.id, '2026-07-06');
    const xml = writeMSPDI(p, cal, tasks, sequences, [], []);
    const linkOf = (uid: number): string => {
      const block = xml.split('<Task>').find(b => b.includes(`<UID>${uid}</UID>`)) ?? '';
      const m = block.match(/<LinkLag>(-?\d+)<\/LinkLag>\s*<LagFormat>(\d+)<\/LagFormat>/);
      return m ? `${m[1]}/${m[2]}` : '(geen link)';
    };
    eq('#4 writer "+3eu": LinkLag 1800 (tienden van minuten) met LagFormat 6 (elapsed uren)', linkOf(2), '1800/6');
    eq('#4 writer "+2u" ongewijzigd: LinkLag 1200, LagFormat 7', linkOf(3), '1200/7');
    eq('#4 writer "+2ed" ongewijzigd: LinkLag 28800, LagFormat 8', linkOf(4), '28800/8');
    eq('#4 writer "+2d" ongewijzigd: LinkLag 9600, LagFormat 7', linkOf(5), '9600/7');

    const back = readMSPDI(xml);
    eq('#4 round-trip "+3eu"', lagFields(lagInto(back, 'B')), { lagDays: 0, lagMinutes: 180, lagUnit: 'ELAPSEDTIME' });
    eq('#4 round-trip "+2u" ongewijzigd', lagFields(lagInto(back, 'C')), { lagDays: 0, lagMinutes: 120 });
    eq('#4 round-trip "+2ed" als exacte kalenderminuten (T15)', lagFields(lagInto(back, 'D')), { lagDays: 0, lagMinutes: 2880, lagUnit: 'ELAPSEDTIME' });
    eq('#4 round-trip "+2d" ongewijzigd (uur-opvolger ⇒ werkminuten)', lagFields(lagInto(back, 'E')), { lagDays: 0, lagMinutes: 960 });

    // Planning: B start 3 klokuren na het einde van A (12:00 → 15:00), vóór én na de rondreis.
    const orig = { tasks: structuredClone(tasks), sequences, calendar: cal };
    solve(orig);
    solve(back);
    eq('#4 planning: B.earlyStart vóór de rondreis', byName(orig, 'B')?.time.earlyStart, '2026-07-06T15:00');
    eq('#4 planning: B.earlyStart na MSPDI-rondreis gelijk', byName(back, 'B')?.time.earlyStart, byName(orig, 'B')?.time.earlyStart);
    for (const n of ['C', 'D', 'E']) {
      eq(`#4 planning: ${n}.earlyStart na MSPDI-rondreis gelijk`, byName(back, n)?.time.earlyStart, byName(orig, n)?.time.earlyStart);
    }
  }

  // MS Project-bestanden met een elapsed-uur- of -minuut-lag (LagFormat 6 = "ehr", 4 = "emin"):
  // minuut-exact, óók in een dagproject (daar rondt de CPM de lag zelf op hele dagen af, dus de
  // dagplanning is identiek aan de oude afronding in de lezer).
  {
    const asForeignLag = (xml: string, linkLag: number, lagFormat: number): string =>
      xml.replace(/<LinkLag>1200<\/LinkLag>(\s*)<LagFormat>7<\/LagFormat>/, `<LinkLag>${linkLag}</LinkLag>$1<LagFormat>${lagFormat}</LagFormat>`);
    const hcal = H8();
    const hTasks = [
      mkHour('f-a', 'A', '1', '2026-07-06T08:00', '2026-07-06T10:00', 120),
      mkHour('f-b', 'B', '2', '2026-07-06T10:00', '2026-07-06T11:00', 60),
    ];
    const hXml = writeMSPDI(proj('Uur', hcal.id, '2026-07-06'), hcal, hTasks, [seq('f-s', 'f-a', 'f-b', { lagMinutes: 120 })], [], []);
    assert(asForeignLag(hXml, 1, 1) !== hXml, 'setup: uur-fixture bevat de te vervangen link');
    const h12 = readMSPDI(asForeignLag(hXml, 7200, 6));
    eq('#4 lezer uurproject "12 ehr" (LagFormat 6)', lagFields(lagInto(h12, 'B')), { lagDays: 0, lagMinutes: 720, lagUnit: 'ELAPSEDTIME' });
    const h90 = readMSPDI(asForeignLag(hXml, 900, 4));
    eq('#4 lezer uurproject "90 emin" (LagFormat 4)', lagFields(lagInto(h90, 'B')), { lagDays: 0, lagMinutes: 90, lagUnit: 'ELAPSEDTIME' });
    solve(h12);
    eq('#4 planning uurproject "12 ehr": B start 12 klokuren na A (10:00 → 22:00 → volgende werkdag 08:00)',
      byName(h12, 'B')?.time.earlyStart, '2026-07-07T08:00');

    const dcal = DAY();
    const dTasks = [
      mkDay('g-a', 'A', '1', '2026-07-06', '2026-07-07', 2),
      mkDay('g-b', 'B', '2', '2026-07-08', '2026-07-09', 2),
    ];
    const dXml = writeMSPDI(proj('Dag', dcal.id, '2026-07-06'), dcal, dTasks, [seq('g-s', 'g-a', 'g-b', { lagMinutes: 120 })], [], []);
    assert(asForeignLag(dXml, 1, 1) !== dXml, 'setup: dag-fixture bevat de te vervangen link');
    const d12 = readMSPDI(asForeignLag(dXml, 7200, 6));
    eq('#4 lezer dagproject "12 ehr" (LagFormat 6)', lagFields(lagInto(d12, 'B')), { lagDays: 0, lagMinutes: 720, lagUnit: 'ELAPSEDTIME' });
    // §3.3/I11: de vroegere afronding van 12 klokuren naar een hele dag verdwijnt.
    const oldStyle = { tasks: structuredClone(dTasks), sequences: [seq('g-s', 'g-a', 'g-b', { lagDays: 1, lagUnit: 'ELAPSEDTIME' })], calendar: dcal };
    solve(oldStyle);
    eq('#4 oude hele-dag-afronding blijft een dag later', byName(oldStyle, 'B')?.time.earlyStart, '2026-07-09T08:00');
    solve(d12);
    eq('#4 §3.3/I11: 12 ehr blijft exact, ook bij een dagenmaat-voorganger', byName(d12, 'B')?.time.earlyStart, '2026-07-08T08:00');
    const d8 = readMSPDI(asForeignLag(dXml, 4800, 6));
    eq('#4 lezer dagproject "8 ehr" (LagFormat 6)', lagFields(lagInto(d8, 'B')), { lagDays: 0, lagMinutes: 480, lagUnit: 'ELAPSEDTIME' });
  }

  // ════ 7. Soort mijlpaal via MSPDI (OPS → MSPDI → OPS) ═════════════════════════════════════════
  {
    const cal = DAY();
    const kinds: (MilestoneKind | undefined)[] = ['FINISH', 'START', undefined];
    for (const kind of kinds) {
      const label = kind ?? 'AUTO';
      const tasks = [
        mkDay('m-a', 'Ruwbouw', '1', '2027-07-05', '2027-07-09', 5),
        mkDay('m-m', 'Hoogste punt', '2', '2027-07-09', '2027-07-09', 0, kind ? { milestoneKind: kind } : {}),
        mkDay('m-b', 'Afbouw', '3', '2027-07-12', '2027-07-16', 5),
      ];
      const sequences = [seq('m-s1', 'm-a', 'm-m'), seq('m-s2', 'm-m', 'm-b')];
      const orig = { tasks: structuredClone(tasks), sequences, calendar: cal };
      solve(orig);
      const back = readMSPDI(writeMSPDI(proj('Mijlpaal', cal.id, '2027-07-05'), cal, orig.tasks, sequences, [], []));
      eq(`#7 dagmodus ${label}: soort mijlpaal na MSPDI-rondreis`, byName(back, 'Hoogste punt')?.milestoneKind, kind);
      solve(back);
      for (const n of ['Hoogste punt', 'Afbouw']) {
        const o = byName(orig, n)?.time;
        const b = byName(back, n)?.time;
        eq(`#7 dagmodus ${label}: ${n} ES/EF na MSPDI-rondreis gelijk`, [b?.earlyStart, b?.earlyFinish], [o?.earlyStart, o?.earlyFinish]);
      }
    }
    // Het concrete gebruikersgeval uit de audit: de eindmijlpaal blijft vrijdag, niet maandag.
    {
      const tasks = [
        mkDay('m-a', 'Ruwbouw', '1', '2027-07-05', '2027-07-09', 5),
        mkDay('m-m', 'Hoogste punt', '2', '2027-07-09', '2027-07-09', 0, { milestoneKind: 'FINISH' }),
        mkDay('m-b', 'Afbouw', '3', '2027-07-12', '2027-07-16', 5),
      ];
      const sequences = [seq('m-s1', 'm-a', 'm-m'), seq('m-s2', 'm-m', 'm-b')];
      const back = readMSPDI(writeMSPDI(proj('Mijlpaal', cal.id, '2027-07-05'), cal, tasks, sequences, [], []));
      solve(back);
      eq('#7 eindmijlpaal "Hoogste punt" na MSPDI-rondreis op vrijdag 2027-07-09', byName(back, 'Hoogste punt')?.time.earlyStart, '2027-07-09T16:00'); // D7/N1: het echte eindmoment.
    }

    // Uurmodus: een AUTOMATISCHE mijlpaal op een bandgrens (16:00) blijft automatisch — zonder de
    // OPS-marker leidt de lezer er een FINISH uit af (MS Project-semantiek, klopt voor MSP-bestanden).
    {
      const hcal = H8();
      const tasks = [
        mkHour('u-a', 'Stort', '1', '2026-07-06T08:00', '2026-07-06T16:00', 480),
        mkHour('u-m', 'Gestort', '2', '2026-07-06T16:00', '2026-07-06T16:00', 0),
        mkHour('u-s', 'Start', '3', '2026-07-07T08:00', '2026-07-07T08:00', 0, { milestoneKind: 'START' }),
      ];
      const xml = writeMSPDI(proj('Uur', hcal.id, '2026-07-06'), hcal, tasks, [seq('u-s1', 'u-a', 'u-m')], [], []);
      const back = readMSPDI(xml);
      eq('#7 uurmodus AUTO op bandgrens blijft AUTO', byName(back, 'Gestort')?.milestoneKind, undefined);
      eq('#7 uurmodus START blijft START', byName(back, 'Start')?.milestoneKind, 'START');
      // Bestand zonder OPS-definitie (zoals MS Project het zelf opslaat): lezen exact als voorheen.
      const foreign = readMSPDI(xml.replace(/\s*<ExtendedAttributes>[\s\S]*?<\/ExtendedAttributes>/, ''));
      eq('#7 MSP-bestand zonder OPS-definitie: uurmodus leidt FINISH af uit 16:00 (ongewijzigd)', byName(foreign, 'Gestort')?.milestoneKind, 'FINISH');
      eq('#7 MSP-bestand zonder OPS-definitie: uurmodus leidt START af uit 08:00 (ongewijzigd)', byName(foreign, 'Start')?.milestoneKind, 'START');
      // Dagmodus zonder OPS-definitie: nog steeds geen afleiding (ongewijzigd).
      const dcal = DAY();
      const dayXml = writeMSPDI(proj('Dag', dcal.id, '2027-07-05'), dcal,
        [mkDay('m-m', 'Hoogste punt', '1', '2027-07-09', '2027-07-09', 0, { milestoneKind: 'FINISH' })], [], [], []);
      const dayForeign = readMSPDI(dayXml.replace(/\s*<ExtendedAttributes>[\s\S]*?<\/ExtendedAttributes>/, ''));
      eq('#7 MSP-bestand zonder OPS-definitie: dagmodus zonder soort (ongewijzigd)', byName(dayForeign, 'Hoogste punt')?.milestoneKind, undefined);
    }
  }

  // ════ 8. P6: datumprecisie volgt de kalender, niet de duureenheid ═════════════════════════════
  {
    const cal = H8();
    const dayOnHours = mkDay('p-day', 'Wapening', '1', '2026-07-06T08:00', '2026-07-07T16:00', 2, {
      status: 'COMPLETED',
      time: {
        durationType: 'WORKTIME', durationUnit: 'days', scheduleDuration: 2,
        scheduleStart: '2026-07-06T08:00', scheduleFinish: '2026-07-07T16:00',
        earlyStart: '2026-07-06T08:00', earlyFinish: '2026-07-07T16:00',
        lateStart: '2026-07-06T08:00', lateFinish: '2026-07-07T16:00',
        freeFloat: 0, totalFloat: 0, isCritical: false, completion: 1,
        actualStart: '2026-07-06T08:00', actualFinish: '2026-07-07T16:00',
      },
    });
    const hourTask = mkHour('p-hour', 'Storten', '2', '2026-07-08T08:00', '2026-07-08T12:00', 240);
    const p = proj('Showcase', cal.id, '2026-07-06');
    const dates = (r: ImportResult | undefined, name: string) => {
      const t = r && byName(r, name)?.time;
      return t && { unit: t.durationUnit, dur: t.scheduleDuration, S: t.scheduleStart, F: t.scheduleFinish, AS: t.actualStart, AF: t.actualFinish };
    };
    const want = { unit: 'days', dur: 2, S: '2026-07-06T08:00', F: '2026-07-07T16:00', AS: '2026-07-06T08:00', AF: '2026-07-07T16:00' };
    const p6Back = readP6XML(writeP6XML(p, cal, [dayOnHours, hourTask], [seq('p-s', 'p-day', 'p-hour')], [], []));
    const mspBack = readMSPDI(writeMSPDI(p, cal, [dayOnHours, hourTask], [seq('p-s', 'p-day', 'p-hour')], [], []));
    eq('#8 P6: dagtaak op urenkalender houdt eenheid én tijden (ook actuals)', dates(p6Back, 'Wapening'), want);
    eq('#8 MSPDI (referentie): dagtaak op urenkalender houdt eenheid én tijden', dates(mspBack, 'Wapening'), want);
    eq('#8 P6: urentaak ongewijzigd', dates(p6Back, 'Storten'),
      { unit: 'hours', dur: 0.5, S: '2026-07-08T08:00', F: '2026-07-08T12:00', AS: undefined, AF: undefined });
  }

  // ════ Bijvangst: OPS_TaskDurationUnit op het echte Text30-veld ══════════════════════════════
  // Het transportveld heette "Text30" maar schreef FieldID 188743760 = 0x0B400000 + 80 = Flag9
  // (MPXJ `MPPTaskField`: FIELD_ARRAY[80] = FLAG9, [336] = TEXT30 ⇒ 188744016). Nieuw schrijven ⇒
  // Text30; lezen accepteert óók het oude ID, zodat eerdere OPS-exports hun eenheid houden.
  {
    const cal = H8();
    const daySeed = mkHour('du-d', 'Twee werkdagen', '1', '2026-07-06T08:00', '2026-07-07T16:00', 960);
    const dayOnBands: Task = { ...daySeed, time: { ...daySeed.time, durationUnit: 'days', scheduleDuration: 2, durationMinutes: undefined } };
    const hourTask = mkHour('du-h', 'Metselen', '2', '2026-07-08T08:00', '2026-07-08T12:00', 240);
    const xml = writeMSPDI(proj('Eenheid', cal.id, '2026-07-06'), cal, [dayOnBands, hourTask], [], [], []);
    const defIds = [...xml.matchAll(/<ExtendedAttribute>\s*<FieldID>(\d+)<\/FieldID>\s*<FieldName>OPS_TaskDurationUnit<\/FieldName>/g)].map(m => m[1]);
    eq('duureenheid-veld: definitie op Text30 (188744016)', defIds, ['188744016']);
    assert(!xml.includes('188743760'), 'duureenheid-veld: het Flag9-ID 188743760 wordt niet meer geschreven');
    const allDefIds = [...xml.matchAll(/<ExtendedAttribute>\s*<FieldID>(\d+)<\/FieldID>\s*<FieldName>/g)].map(m => m[1]);
    eq('duureenheid-veld: geen botsing met OPS_MilestoneKind (Text29) — unieke definitie-IDs', new Set(allDefIds).size, allDefIds.length);
    const unitOf = (r: ImportResult, n: string) => { const t = byName(r, n)?.time; return t && [t.durationUnit, t.scheduleDuration, t.durationMinutes]; };
    const back = readMSPDI(xml);
    eq('duureenheid-veld: round-trip dagtaak op urenkalender', unitOf(back, 'Twee werkdagen'), ['days', 2, undefined]);
    eq('duureenheid-veld: round-trip urentaak', unitOf(back, 'Metselen'), ['hours', 0.5, 240]);
    // Een eerdere OPS-export (definitie én taakwaarden op het oude ID).
    const legacy = xml.split('188744016').join('188743760');
    assert(legacy !== xml && !legacy.includes('188744016'), 'setup: oud bestand draagt alleen het oude ID');
    const legacyBack = readMSPDI(legacy);
    eq('duureenheid-veld: oud OPS-bestand (188743760) houdt dagtaak', unitOf(legacyBack, 'Twee werkdagen'), ['days', 2, undefined]);
    eq('duureenheid-veld: oud OPS-bestand (188743760) houdt urentaak', unitOf(legacyBack, 'Metselen'), ['hours', 0.5, 240]);
    // Bestand zonder OPS-definitie (MS Project zelf): kalenderregel, ongewijzigd.
    for (const [label, src] of [['nieuw', xml], ['oud', legacy]] as const) {
      const foreign = readMSPDI(src.replace(/\s*<ExtendedAttributes>[\s\S]*?<\/ExtendedAttributes>/, ''));
      eq(`duureenheid-veld: zonder OPS-definitie (${label} ID) volgt de uurkalender`, unitOf(foreign, 'Twee werkdagen'), ['hours', 2, 960]);
    }
  }

  if (fails === 0) {
    console.log(`OK  xml-adapter-fidelity: alle checks groen (${checks})`);
    process.exit(0);
  } else {
    console.log(`XX  xml-adapter-fidelity: ${fails}/${checks} checks GEFAALD`);
    process.exit(1);
  }
}

main().catch((e: unknown) => {
  console.log(`XX  xml-adapter-fidelity: onverwachte fout: ${e instanceof Error ? e.stack : String(e)}`);
  process.exit(1);
});

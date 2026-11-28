import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join as joinPath, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server.browser';
import {
  DMY_ORDER,
  DateTextInput,
  computeSeg,
  dateCommitValue,
  isoToSegments,
  nextSegmentState,
  resolveDateCommit,
  splitDateValue,
  type DateCommitMode,
  type SegState,
} from '@/components/common/DateTextInput';

let failures = 0;
function check(name: string, cond: boolean): void {
  if (!cond) {
    failures++;
    console.log(`   XX ${name}`);
  } else {
    console.log(`   OK ${name}`);
  }
}
const eq = (name: string, actual: unknown, expected: unknown) =>
  check(`${name} (kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)})`,
    JSON.stringify(actual) === JSON.stringify(expected));

const EMPTY: SegState = { day: '', month: '', year: '' };

function typeAndFinish(raw: string, mode: DateCommitMode, start = '') {
  let seg: SegState = { ...EMPTY };
  let i = 0;
  let value = start;
  const commits: string[] = [];
  const write = (iso: string) => { if (iso !== value) { value = iso; commits.push(iso); } };

  for (const ch of raw) {
    if (ch === '-' || ch === '/' || ch === '.') {
      if (seg[DMY_ORDER[i].kind] !== '' && i < DMY_ORDER.length - 1) i++;
      continue;
    }
    const next = nextSegmentState(seg, DMY_ORDER, i, seg[DMY_ORDER[i].kind] + ch);
    seg = next.seg;
    const res = resolveDateCommit('typing', mode, seg);
    if (res.kind === 'write') write(res.iso);
    if (next.advanceTo !== null) i = next.advanceTo;
  }

  const fin = resolveDateCommit('finish', mode, seg);
  if (fin.kind === 'write') write(fin.iso);
  return { commits, value, finish: fin.kind };
}

console.log('── DateTextInput: commitmodus ──');

const live = typeAndFinish('01062030', 'live');
eq('a live-modus: één ingetypte datum = drie commits (het oude gedrag)',
  live.commits, ['2020-06-01', '0203-06-01', '2030-06-01']);

const blur = typeAndFinish('01062030', 'blur');
eq('a blur-modus: één ingetypte datum = precies ÉÉN commit', blur.commits, ['2030-06-01']);
eq('a blur-modus: die ene commit is de bedoelde datum', blur.value, '2030-06-01');

eq('b blur: leeggemaakt veld commit "geen datum"',
  typeAndFinish('', 'blur', '2030-06-01').commits, ['']);
eq('b blur: incomplete invoer commit niets en valt stil terug',
  typeAndFinish('0106', 'blur', '2030-06-01').commits, []);
eq('b blur: incomplete invoer meldt "revert"',
  typeAndFinish('0106', 'blur', '2030-06-01').finish, 'revert');
eq('b blur: compleet-maar-onbestaande datum commit niets (31-02)',
  typeAndFinish('31022026', 'blur').commits, []);
eq('b blur: compleet-maar-onbestaande datum meldt "error"',
  typeAndFinish('31022026', 'blur').finish, 'error');
eq('b live: een onbestaande datum committeert ook live nooit',
  typeAndFinish('31022026', 'live').commits, []);

eq('c blur: "6-7-26" (1-cijferige dag/maand, 2-cijferig jaar) commit één keer als 2026-07-06',
  typeAndFinish('6-7-26', 'blur').commits, ['2026-07-06']);
eq('c blur: ongewijzigde datum opnieuw intypen commit niet opnieuw',
  typeAndFinish('01062030', 'blur', '2030-06-01').commits, []);

eq('d typing+blur schrijft nooit', resolveDateCommit('typing', 'blur', { day: '01', month: '06', year: '2030' }).kind, 'idle');
eq('d typing+live schrijft een geldige datum', resolveDateCommit('typing', 'live', { day: '01', month: '06', year: '2030' }), { kind: 'write', iso: '2030-06-01' });
eq('d finish op leeg = "geen datum"', resolveDateCommit('finish', 'blur', EMPTY), { kind: 'write', iso: '' });
eq('d computeSeg herkent onbestaande datums', computeSeg({ day: '31', month: '02', year: '2026' }).status, 'invalid');
eq('d nextSegmentState springt door bij een vol segment',
  nextSegmentState(EMPTY, DMY_ORDER, 0, '01').advanceTo, 1);
eq('d nextSegmentState springt niet door vanaf het laatste segment',
  nextSegmentState({ day: '01', month: '06', year: '' }, DMY_ORDER, 2, '2030').advanceTo, null);
eq('d nextSegmentState sanitiseert niet-cijfers en kapt af op de segmentlengte',
  nextSegmentState(EMPTY, DMY_ORDER, 0, 'a1b2c3').seg.day, '12');

{
  const kandidaten = [
    fileURLToPath(new URL('../../src/', import.meta.url).href),
    resolvePath(process.cwd(), 'src'),
  ];
  const srcRoot = kandidaten.find(p => existsSync(p)) ?? null;
  check(`e de broncontrole vindt src/ (geprobeerd: ${kandidaten.join(', ')})`, srcRoot !== null);

  if (srcRoot) {
    const bestanden: string[] = [];
    const loop = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = joinPath(dir, entry.name);
        if (entry.isDirectory()) loop(full);
        else if (/\.tsx?$/.test(entry.name)) bestanden.push(full);
      }
    };
    loop(srcRoot);
    check('e de broncontrole leest een plausibel aantal bronbestanden', bestanden.length > 100);

    const component = readFileSync(joinPath(srcRoot, 'components', 'common', 'DateTextInput.tsx'), 'utf8');
    check("e de default-commitmodus van DateTextInput is 'blur'", /commitMode = 'blur'/.test(component));

    const liveToegestaan = [
      joinPath(srcRoot, 'components', 'settings', 'ProjectInfoPanelContent.tsx'),
      joinPath(srcRoot, 'components', 'dialogs', 'ActualStartDialog.tsx'),
      joinPath(srcRoot, 'components', 'dialogs', 'MoveProjectDialog.tsx'),
    ];
    const liveGebruikers = bestanden.filter(f =>
      f !== joinPath(srcRoot, 'components', 'common', 'DateTextInput.tsx')
      && /commitMode\s*=\s*\{?\s*['"]live['"]/.test(readFileSync(f, 'utf8')));
    eq('e alleen puur-lokale draftvelden committeren live (de rest schrijft naar de store en zou '
      + 'drie undo-stappen per ingetypte datum pushen)',
      liveGebruikers.map(f => f.slice(srcRoot.length)).sort(),
      liveToegestaan.map(f => f.slice(srcRoot.length)).sort());
  }
}

{
  const kandidaten = [
    fileURLToPath(new URL('../../src/', import.meta.url).href),
    resolvePath(process.cwd(), 'src'),
  ];
  const srcRoot = kandidaten.find(p => existsSync(p)) ?? null;
  if (srcRoot) {
    const component = readFileSync(joinPath(srcRoot, 'components', 'common', 'DateTextInput.tsx'), 'utf8');
    check('f groepsblur committeert niet bij focuswissel BINNEN de groep (of naar het kalenderpaneel)',
      /const next = e\.relatedTarget as Node \| null;\s*if \(e\.currentTarget\.contains\(next\) \|\| pickerPanelRef\.current\?\.contains\(next\)\) return;/
        .test(component));
    check('f groepsblur rondt wél af als de focus de groep verlaat',
      /handleGroupBlur[\s\S]{0,600}?finish\(seg\)/.test(component));
    check('f Enter rondt het veld af via finish()',
      /e\.key === 'Enter'[\s\S]{0,300}?finish\(seg\)/.test(component));
    check('f Enter blokkeert de dialoog alleen bij ongeldige/incomplete invoer',
      /if \(blocked\) \{ e\.preventDefault\(\); e\.stopPropagation\(\); \}/.test(component));
    check('f Enter eet de toets NIET op enkel omdat er zojuist gecommit is',
      !/blocked \|\| pending/.test(component) && !/pending: /.test(component));

    const dialogKeys = readFileSync(joinPath(srcRoot, 'hooks', 'useDialogKeys.ts'), 'utf8');
    check('f useDialogKeys leest onConfirm/onCancel via een latest-callback-ref',
      /confirmRef\.current = onConfirm/.test(dialogKeys)
      && /cancelRef\.current = onCancel/.test(dialogKeys)
      && /const onConfirm = confirmRef\.current/.test(dialogKeys));
    check('f de keydown-listener van useDialogKeys voert niet opnieuw op per callback-identiteit',
      /document\.addEventListener\('keydown', onKey\);[\s\S]{0,160}?\}, \[\]\);/.test(dialogKeys));
    check('f Escape herstelt de laatst gecommitte waarde',
      /e\.key === 'Escape'[\s\S]{0,400}?setSeg\(restored\)/.test(component));
  }
}

{
  const DT = '2027-05-13T07:00';
  const finishCommit = (seg: SegState, value: string, required = false): string | null | 'revert' | 'error' => {
    const res = resolveDateCommit('finish', 'blur', seg, required);
    if (res.kind === 'write') return dateCommitValue(res.iso, value);
    return res.kind === 'revert' || res.kind === 'error' ? res.kind : null;
  };
  eq('g splitDateValue scheidt datum en tijd', splitDateValue(DT), { date: '2027-05-13', time: 'T07:00' });
  eq('g splitDateValue op een kale datum', splitDateValue('2027-05-13'), { date: '2027-05-13', time: '' });
  eq('g splitDateValue op leeg/onleesbaar', [splitDateValue(''), splitDateValue('gisteren')],
    [{ date: '', time: '' }, { date: '', time: '' }]);
  eq('g isoToSegments toont het datumdeel van een datum-met-tijd', isoToSegments(DT),
    { day: '13', month: '05', year: '2027' });
  eq('g onaangeroerd verlaten van een datum-met-tijd commit NIETS',
    finishCommit(isoToSegments(DT), DT), null);
  eq('g een andere datum typen zet het oorspronkelijke tijddeel terug',
    finishCommit({ day: '17', month: '05', year: '2027' }, DT), '2027-05-17T07:00');
  eq('g seconden in het tijddeel reizen ongewijzigd mee',
    finishCommit({ day: '17', month: '05', year: '2027' }, '2027-05-13T07:30:00'), '2027-05-17T07:30:00');
  eq('g een kale datum blijft een kale datum',
    finishCommit({ day: '17', month: '05', year: '2027' }, '2027-05-13'), '2027-05-17');
  eq('g bewust leegmaken (niet verplicht) commit "geen datum"', finishCommit(EMPTY, DT), '');
  eq('g een onaangeroerd leeg veld commit nooit ""', finishCommit(EMPTY, ''), null);
  eq('g een onleesbare waarde onaangeroerd verlaten commit nooit ""', finishCommit(EMPTY, 'gisteren'), null);

  const markup = renderToStaticMarkup(createElement(DateTextInput, { value: DT, onCommit: () => {} }));
  const shown = [...markup.matchAll(/<input[^>]*\svalue="([^"]*)"/g)].map(m => m[1]);
  eq('g de gerenderde component toont 13-05-2027 voor een datum-met-tijd', shown, ['13', '05', '2027']);
}

{
  eq('h required: leeg afronden valt terug i.p.v. "" te schrijven',
    resolveDateCommit('finish', 'blur', EMPTY, true), { kind: 'revert' });
  eq('h required: live-modus schrijft tijdens typen ook geen ""',
    resolveDateCommit('typing', 'live', EMPTY, true), { kind: 'idle' });
  eq('h required: een geldige datum gaat gewoon door',
    resolveDateCommit('finish', 'blur', { day: '01', month: '06', year: '2030' }, true), { kind: 'write', iso: '2030-06-01' });
  eq('h niet-required: leeg afronden blijft "geen datum"',
    resolveDateCommit('finish', 'blur', EMPTY), { kind: 'write', iso: '' });
  const kandidaten = [
    fileURLToPath(new URL('../../src/', import.meta.url).href),
    resolvePath(process.cwd(), 'src'),
  ];
  const srcRoot = kandidaten.find(p => existsSync(p)) ?? null;
  if (srcRoot) {
    const lees = (...deel: string[]) => readFileSync(joinPath(srcRoot, ...deel), 'utf8');
    const telRequired = (bron: string) => (bron.match(/<(?:DateTextInput|TaskDateTimeInput)[^>]*?\srequired[\s/>]/g) ?? []).length;
    eq('h het datum-met-tijdveld geeft required door aan het datumveld',
      /<DateTextInput[^>]*?\srequired=\{required\}/.test(lees('components', 'common', 'TaskDateTimeInput.tsx')) ? 1 : 0, 1);
    eq('h paneel-Start is verplicht', telRequired(lees('components', 'task-sections', 'TaskTimeFields.tsx')), 1);
    eq('h Startdatum in Taak bewerken is verplicht', telRequired(lees('components', 'dialogs', 'TaskDialog.tsx')), 1);
    eq('h beide beperkingsdatums zijn verplicht', telRequired(lees('components', 'task-sections', 'TaskConstraintFields.tsx')), 2);
  }
}

if (failures > 0) {
  console.error(`\nTOTAAL: ${failures} afwijking(en)`);
  process.exit(1);
} else {
  console.log('\nTOTAAL: alles groen');
  process.exit(0);
}

/**
 * Commitgedrag van het gedeelde datumveld (`DateTextInput`) — pure functies, dus headless.
 *
 * Achtergrond: het veld is gesegmenteerd (dd | mm | jjjj) en `parseFlexibleDate` accepteert een jaar
 * al bij 2 cijfers. Committeerde het veld LIVE per toetsaanslag, dan leverde het intypen van
 * "01062030" drie geldige commits op (2020-06-01 → 0203-06-01 → 2030-06-01) — en dus drie
 * undo-stappen met onzin-tussenwaarden bij elke store-schrijvende aanroeper (deadline, constraint,
 * werkelijke datums, aangepaste velden). Sinds de `commitMode`-prop is `'blur'` de standaard: één
 * ingetypte datum = één commit bij het afronden.
 *
 * De test speelt de toetsaanslagen na met exact de reducers die de component zelf gebruikt
 * (`nextSegmentState` + `resolveDateCommit`), zodat hij niet naast de component kan gaan lopen.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join as joinPath, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DMY_ORDER,
  computeSeg,
  nextSegmentState,
  resolveDateCommit,
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

/**
 * Speelt `raw` toetsaanslag voor toetsaanslag in de segmenten (inclusief het doorspringen naar het
 * volgende segment) en rondt daarna af zoals blur/Enter dat doen. Retourneert alles wat het veld
 * naar buiten zou hebben geschreven, plus de eindtoestand.
 */
function typeAndFinish(raw: string, mode: DateCommitMode, start = '') {
  let seg: SegState = { ...EMPTY };
  let i = 0;
  let value = start;
  const commits: string[] = [];
  const write = (iso: string) => { if (iso !== value) { value = iso; commits.push(iso); } };

  for (const ch of raw) {
    if (ch === '-' || ch === '/' || ch === '.') {
      // Separatortoets: springt door naar het volgende segment (zie `handleKeyDown`), verandert de
      // waarde niet — zo kan de test ook "6-7-26" naspelen zonder de DOM.
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

// ── (a) de bug uit docs/TODO.md ────────────────────────────────────────────────────────────────
const live = typeAndFinish('01062030', 'live');
eq('a live-modus: één ingetypte datum = drie commits (het oude gedrag)',
  live.commits, ['2020-06-01', '0203-06-01', '2030-06-01']);

const blur = typeAndFinish('01062030', 'blur');
eq('a blur-modus: één ingetypte datum = precies ÉÉN commit', blur.commits, ['2030-06-01']);
eq('a blur-modus: die ene commit is de bedoelde datum', blur.value, '2030-06-01');

// ── (b) afronden per toestand ─────────────────────────────────────────────────────────────────
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

// ── (c) 2-cijferig jaar en normalisatie blijven werken ────────────────────────────────────────
eq('c blur: "6-7-26" (1-cijferige dag/maand, 2-cijferig jaar) commit één keer als 2026-07-06',
  typeAndFinish('6-7-26', 'blur').commits, ['2026-07-06']);
eq('c blur: ongewijzigde datum opnieuw intypen commit niet opnieuw',
  typeAndFinish('01062030', 'blur', '2030-06-01').commits, []);

// ── (d) de pure bouwstenen zelf ───────────────────────────────────────────────────────────────
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

// ── (e) broncontrole: wie mag er live committen? ──────────────────────────────────────────────
// De hele fix hangt aan de DEFAULT. Zet iemand `commitMode="live"` op een plek die naar de store
// schrijft, dan zijn de drie undo-stappen per ingetypte datum meteen terug — zonder dat een pure
// test dat merkt. Deze controle pint daarom vast: de default is 'blur', en alleen bestanden met
// puur lokale draftstate mogen expliciet live committen.
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

    // Puur lokale draftstate (projectwizard) — geen store-schrijver, mét live afgeleide feedback.
    const liveToegestaan = [joinPath(srcRoot, 'components', 'settings', 'ProjectInfoPanelContent.tsx')];
    // Bewust ruim: vangt zowel `commitMode="live"` als `commitMode={'live'}`/`{"live"}`.
    const liveGebruikers = bestanden.filter(f =>
      f !== joinPath(srcRoot, 'components', 'common', 'DateTextInput.tsx')
      && /commitMode\s*=\s*\{?\s*['"]live['"]/.test(readFileSync(f, 'utf8')));
    eq('e alleen puur-lokale draftvelden committeren live (de rest schrijft naar de store en zou '
      + 'drie undo-stappen per ingetypte datum pushen)',
      liveGebruikers.map(f => f.slice(srcRoot.length)).sort(),
      liveToegestaan.map(f => f.slice(srcRoot.length)).sort());
  }
}

// ── (f) broncontrole: de afrondsemantiek van het echte veld ───────────────────────────────────
// De pure kern hierboven kent geen DOM. Deze drie eigenschappen leven in de React-laag en zijn
// precies de dingen die stilletjes sneuvelen bij een refactor, dus pinnen we ze aan de bron vast.
{
  const kandidaten = [
    fileURLToPath(new URL('../../src/', import.meta.url).href),
    resolvePath(process.cwd(), 'src'),
  ];
  const srcRoot = kandidaten.find(p => existsSync(p)) ?? null;
  if (srcRoot) {
    const component = readFileSync(joinPath(srcRoot, 'components', 'common', 'DateTextInput.tsx'), 'utf8');
    // Blur van segment → segment binnen dezelfde groep mag NIET committen; alleen het verlaten van de
    // héle groep rondt af. Zonder deze guard commit elke Tab tussen dd|mm|jjjj een halve datum.
    check('f groepsblur committeert niet bij focuswissel BINNEN de groep',
      /contains\(e\.relatedTarget[^)]*\)\)\s*return;/.test(component));
    check('f groepsblur rondt wél af als de focus de groep verlaat',
      /handleGroupBlur[\s\S]{0,600}?finish\(seg\)/.test(component));
    // Enter rondt eerst het veld af (commit) en laat de dialoog-Enter pas door als er niets meer
    // openstaat — anders bevestigt de dialoog in dezelfde event-tick met zijn oude draft.
    check('f Enter rondt het veld af via finish()',
      /e\.key === 'Enter'[\s\S]{0,300}?finish\(seg\)/.test(component));
    check('f Enter blokkeert de dialoog zolang er iets openstaat (blocked || pending)',
      /blocked \|\| pending/.test(component));
    // Escape herstelt de laatst gecommitte waarde; zonder bewerking loopt hij door naar de dialoog.
    check('f Escape herstelt de laatst gecommitte waarde',
      /e\.key === 'Escape'[\s\S]{0,400}?setSeg\(restored\)/.test(component));
  }
}

if (failures > 0) {
  console.error(`\nTOTAAL: ${failures} afwijking(en)`);
  process.exitCode = 1;
} else {
  console.log('\nTOTAAL: alles groen');
}

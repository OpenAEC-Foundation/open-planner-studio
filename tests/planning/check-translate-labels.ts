/**
 * Vertaalstraat — labelpoort (scripts/translate/ui.ts `buildLabelIndex`/`labelsFor`, gates.ts).
 *
 * Aanleiding: `common:notifications.schedulingProfileApplied` noemt het pad "Bestand → Projectinfo →
 * Rekenprofiel en reken-opties"; in uk/sr/bg/nb stond een verkorte of verbogen titel, en
 * check-conventions-registry eist `applied.includes(title)`. Bewaakt: welke teksten als label tellen
 * (hoofdletter, ≥ 2 woorden of ≥ 10 tekens, geen invulplekken/$t, geen veelvoorkomend los woord), dat
 * alleen het langste label telt, niet aan het begin van een zin, niet de eenheid zelf; dat de doeltekst
 * alleen telt als hij vertaald is; en dat de poort hard is met doeltekst en een waarschuwing zonder.
 */
import { hashUnit } from '../../scripts/translate/common';
import { checkUi } from '../../scripts/translate/gates';
import { buildLabelIndex, buildUiPackages, labelsFor, LABEL_COMMON_WORD_MAX, type NsInput, type UiPackage } from '../../scripts/translate/ui';
import type { JsonObject } from '../../scripts/i18n-tools';

let checks = 0;
const diffs: string[] = [];
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};
const ok = (label: string, cond: boolean) => { checks++; if (!cond) diffs.push(label); };

const nlCommon: JsonObject = {
  title: 'Rekenprofiel en reken-opties',
  profile: 'Rekenprofiel',
  applied: 'Dit project rekent als {{profile}}. Aanpassen via Bestand → Projectinfo → Rekenprofiel en reken-opties.',
  restore: 'Herstellen',
  restoreFailed: 'Herstellen mislukt. Probeer opnieuw.',
  phrase: 'groter dan',
  phraseUse: 'De waarde is groter dan nul.',
  withVar: 'Taak {{name}}',
  n_one: '{{count}} taak in Rekenprofiel en reken-opties', n_other: '{{count}} taken in Rekenprofiel en reken-opties',
};
const nlMenu: JsonObject = { projectInfo: 'Projectinfo', file: 'Bestand' };
const uk: Record<string, JsonObject> = {
  common: { title: 'Профіль обчислень і параметри', profile: 'Профіль обчислень', restore: 'Відновити', applied: 'x' },
  menu: { projectInfo: 'Відомості про проєкт', file: 'Файл' },
};
const inputs = (target: Record<string, JsonObject>): NsInput[] => [
  { ns: 'common', nl: nlCommon, en: nlCommon, target: target.common ?? {} },
  { ns: 'menu', nl: nlMenu, en: nlMenu, target: target.menu ?? {} },
];
const hashes = (ns: JsonObject, keys: string[]) => Object.fromEntries(keys.map(k => [k, hashUnit(ns[k] as string)]));
const sources = { common: hashes(nlCommon, ['title', 'profile', 'restore']), menu: hashes(nlMenu, ['projectInfo', 'file']) };

// ── 1. Index ─────────────────────────────────────────────────────────────────────────────────
{
  const idx = buildLabelIndex(inputs(uk), 'uk', sources);
  const texts = idx.map(l => l.nl);
  ok('titel is label', texts.includes('Rekenprofiel en reken-opties'));
  ok('één woord van ≥ 10 tekens is label', texts.includes('Projectinfo') && texts.includes('Rekenprofiel'));
  ok('kort los woord ("Bestand") is geen label', !texts.includes('Bestand'));
  ok('kleine letter ("groter dan") is geen label', !texts.includes('groter dan'));
  ok('invulplek is geen label', !texts.some(t => t.includes('{{')));
  eq('doeltekst en sleutel', idx.find(l => l.nl === 'Projectinfo')?.targets, ['Відомості про проєкт']);
  eq('sleutel als ns:pad', idx.find(l => l.nl === 'Projectinfo')?.keys, ['menu:projectInfo']);
  const fresh = buildLabelIndex(inputs(uk), 'uk', {});
  eq('nieuwe taal zonder hash: Engelse vulling telt niet als doeltekst', fresh.find(l => l.nl === 'Projectinfo')?.targets, []);
  const many: JsonObject = { w: 'Instellingen' };
  for (let i = 0; i <= LABEL_COMMON_WORD_MAX; i++) many[`s${i}`] = `Open de instellingen ${i}.`;
  ok('veelvoorkomend los woord is geen label', !buildLabelIndex([{ ns: 'common', nl: many, en: many, target: {} }], 'uk', {}).some(l => l.nl === 'Instellingen'));
}

// ── 2. labelsFor ─────────────────────────────────────────────────────────────────────────────
{
  const idx = buildLabelIndex(inputs(uk), 'uk', sources);
  eq('pad: langste label wint, Projectinfo apart', labelsFor('applied', 'common', nlCommon.applied as string, idx).map(l => l.nl).sort(),
    ['Projectinfo', 'Rekenprofiel en reken-opties']);
  eq('label aan het begin van een zin telt niet', labelsFor('restoreFailed', 'common', nlCommon.restoreFailed as string, idx), []);
  eq('de eenheid zelf telt niet', labelsFor('title', 'common', nlCommon.title as string, idx), []);
  eq('meervoudsfamilie', labelsFor('n', 'common', { one: nlCommon.n_one as string, other: nlCommon.n_other as string }, idx).map(l => l.nl),
    ['Rekenprofiel en reken-opties']);
  eq('hoofdlettergevoelig', labelsFor('x', 'common', 'Zie het rekenprofiel en reken-opties.', idx), []);
}

// ── 3. Pakket en poort ───────────────────────────────────────────────────────────────────────
{
  const packs = buildUiPackages({ lang: 'uk', inputs: inputs(uk), mode: 'all', sources, concepts: [] });
  const item = packs[0].items.find(i => i.key === 'applied')!;
  eq('item draagt labels met doeltekst', item.labels?.find(l => l.nl === 'Rekenprofiel en reken-opties'),
    { nl: 'Rekenprofiel en reken-opties', keys: ['common:title'], targets: ['Профіль обчислень і параметри'] });
  ok('item zonder label heeft geen veld', packs[0].items.find(i => i.key === 'restore')!.labels === undefined);
  const pkg: UiPackage = { ...packs[0], items: [item] };
  const good = 'Цей проєкт обчислюється як {{profile}}. Змінити: Файл → Відомості про проєкт → Профіль обчислень і параметри.';
  eq('goede vertaling groen', checkUi(pkg, { applied: good }).errors, []);
  const bad = good.replace('Профіль обчислень і параметри', 'Профіль обчислень і параметри обчислень').replace('Відомості про проєкт', 'Відомості проєкту');
  const errs = checkUi(pkg, { applied: bad.replace('і параметри обчислень', 'і параметрів') }).errors;
  eq('verbogen titel en ander pad rood', errs.length, 2);
  ok('melding noemt label en doeltekst', errs.some(e => e.includes('label "Rekenprofiel en reken-opties" (common:title) moet letterlijk "Профіль обчислень і параметри"')));
  const none = buildUiPackages({ lang: 'uk', inputs: inputs({ common: {}, menu: {} }), mode: 'all', sources: {}, concepts: [] });
  const p2: UiPackage = { ...none[0], items: none[0].items.filter(i => i.key === 'applied') };
  const r = checkUi(p2, { applied: 'Цей проєкт обчислюється як {{profile}}.' });
  ok('label nog onvertaald: geen fout', r.errors.length === 0);
  ok('label nog onvertaald: waarschuwing', r.warnings.some(w => w.includes('label "Projectinfo"') && w.includes('nog geen vaste vertaling')));
  const fam = packs[0].items.find(i => i.key === 'n')!;
  const famPkg: UiPackage = { ...packs[0], lang: 'uk', items: [fam], plural: { one: [1], few: [2], many: [5], other: [1.5] } };
  const famErr = checkUi(famPkg, { n: {
    one: '{{count}} завдання в Профіль обчислень і параметри', few: '{{count}} завдання в Профіль обчислень і параметри',
    many: '{{count}} завдань у профілі', other: '{{count}} завдання в Профіль обчислень і параметри',
  } }).errors;
  eq('meervoud: per vorm, alleen many rood', famErr.map(e => e.split(':')[0]), ['n.many']);
}

// ── 4. Doeltekst met een avoid-variant telt niet (anders botst de labelpoort met --avoid) ────
{
  const concepts = [{ id: 'critical-path', kind: 'term' as const, nl: 'kritiek pad', en: ['critical path'], definition: 'd' }];
  const tb = { _style: { address: 'formal' as const }, 'critical-path': { term: 'kritični put', forms: ['kritični put'], avoid: ['ključni put'], source: 's', status: 'arbitrated' as const } };
  const nl: JsonObject = { btn: 'Kritiek pad', hint: 'Buiten Kritiek pad markeert een rand het pad.' };
  const hr: JsonObject = { btn: 'Ključni put', hint: 'Izvan opcije Ključni put, obrub označava put.' };
  const src = { common: { btn: hashUnit('Kritiek pad'), hint: hashUnit(nl.hint as string) } };
  const packs = buildUiPackages({ lang: 'hr', inputs: [{ ns: 'common', nl, en: nl, target: hr }], mode: 'all', sources: src, concepts, termbase: tb, avoid: false });
  eq('label met avoid-variant: geen doeltekst', packs[0].items.find(i => i.key === 'hint')?.labels?.[0].targets, []);
  const r = checkUi(packs[0], { btn: 'Kritični put', hint: 'Izvan opcije Kritični put, obrub označava put.' });
  eq('termfix van label en tekst samen: groen', r.errors, []);
}

if (diffs.length === 0) {
  console.log(`OK  translate-labels: alle checks groen (${checks})`);
  process.exit(0);
}
console.log(`XX  translate-labels: ${diffs.length} afwijking(en) van ${checks}`);
for (const d of diffs) console.log(`   - ${d}`);
process.exit(1);

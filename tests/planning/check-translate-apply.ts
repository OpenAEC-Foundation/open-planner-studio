import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyUiBatch } from '../../scripts/translate/apply';
import { hashUnit, hasUiBaseline, unitMap } from '../../scripts/translate/common';
import {
  buildUiPackages, orderSources, selectUnits, setSourceHash, uiReleaseGaps, uiStatus, updateSourceHashForAdd,
  type UiPackage, type UiSources,
} from '../../scripts/translate/ui';
import { checkPackage } from '../../scripts/translate/gates';
import { LOCALES, serialize, type JsonObject } from '../../scripts/i18n-tools';

let checks = 0;
const diffs: string[] = [];
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};
const ok = (label: string, cond: boolean) => { checks++; if (!cond) diffs.push(label); };

const nl: JsonObject = {
  a: 'Eerste',
  grp: { x: 'Iks', n_one: '{{count}} taak', n_other: '{{count}} taken' },
  z: 'Laatste',
};
const en: JsonObject = {
  a: 'First',
  grp: { x: 'Ex', n_one: '{{count}} task', n_other: '{{count}} tasks' },
  z: 'Last',
};

{
  const packs = buildUiPackages({ lang: 'cs', inputs: [{ ns: 'common', nl, en, target: {} }], mode: 'missing', sources: {}, concepts: [], size: 2 });
  eq('2 pakketten van ≤ 2 items', packs.map(p => p.items.map(i => i.key)), [['a', 'grp.x'], ['grp.n', 'z']]);
  const outs: Record<string, unknown> = {
    'ui-common-01': { a: 'První', 'grp.x': 'Iks-cs' },
    'ui-common-02': { 'grp.n': { one: '{{count}} úkol', few: '{{count}} úkoly', many: '{{count}} úkolu', other: '{{count}} úkolů' }, z: 'Poslední' },
  };
  const batch = [...packs].reverse().map(pkg => ({ pkg, out: outs[pkg.id] }));
  const sources: UiSources = {};
  const res = applyUiBatch(batch, () => ({}), { common: nl }, sources, 'cs');
  eq('beide pakketten groen toegepast', [...res.applied].sort(), ['ui-common-01', 'ui-common-02']);
  const cs = res.targets.get('common')!;
  eq('volgorde van nl, familie in CLDR-volgorde', serialize(cs), serialize({
    a: 'První',
    grp: { x: 'Iks-cs', n_one: '{{count}} úkol', n_few: '{{count}} úkoly', n_many: '{{count}} úkolu', n_other: '{{count}} úkolů' },
    z: 'Poslední',
  }));
  eq('hash per sleutel; familie = één hash', orderSources(sources, { common: nl }).common, {
    a: hashUnit('Eerste'), 'grp.x': hashUnit('Iks'),
    'grp.n': hashUnit({ one: '{{count}} taak', other: '{{count}} taken' }), z: hashUnit('Laatste'),
  });
  eq('na apply: niets meer ontbreekt', selectUnits({ ns: 'common', nl, en, target: cs }, 'cs', 'missing', sources), []);
  eq('status na apply: alles actueel', uiStatus('cs', [{ ns: 'common', nl, en, target: cs }], sources),
    [{ ns: 'common', total: 4, missing: 0, stale: 0, current: 4, unhashed: 0 }]);
  ok('hashes in nl-volgorde', Object.keys(orderSources(sources, { common: nl }).common).join() === 'a,grp.x,grp.n,z');
}

{
  const existing: JsonObject = { a: 'Erste', grp: { x: 'X-de', n_one: '{{count}} Aufgabe', n_other: '{{count}} Aufgaben' }, z: 'Letzte', extra: 'bleibt' };
  const sources: UiSources = { common: { a: hashUnit('Oud'), z: hashUnit('Laatste') } };
  const green: UiPackage = {
    kind: 'ui', lang: 'de', namespace: 'common', id: 'ui-common-01', mode: 'stale', terms: [], tokens: [], keep: [],
    items: [{ key: 'a', nl: 'Eerste', en: 'First', previous: 'Erste' }],
  };
  const red: UiPackage = { ...green, id: 'ui-common-02', items: [{ key: 'z', nl: 'Laatste {{n}}', en: 'Last {{n}}' }] };
  const res = applyUiBatch([{ pkg: green, out: { a: 'Erstes' } }, { pkg: red, out: { z: 'Letzte' } }], () => structuredClone(existing), { common: nl }, sources, 'de');
  eq('alleen het groene pakket', res.applied, ['ui-common-01']);
  eq('rood pakket gemeld met zijn foutregel', res.red.map(r => [r.id, r.lines[0]]), [['ui-common-02', 'XX z: invulplekken (geen) ≠ nl {{n}}']]);
  const de = res.targets.get('common')!;
  eq('gewijzigd: alleen a', de.a, 'Erstes');
  eq('niet in een pakket: onaangeroerd', [de.z, (de.grp as JsonObject).x, de.extra], ['Letzte', 'X-de', 'bleibt']);
  eq('onbekende sleutel blijft achteraan', Object.keys(de), ['a', 'grp', 'z', 'extra']);
  eq('hash van a bijgewerkt, van z niet', [sources.common.a, sources.common.z], [hashUnit('Eerste'), hashUnit('Laatste')]);
  eq('niets toegepast → geen doelobject', applyUiBatch([{ pkg: red, out: {} }], () => ({}), { common: nl }, {}, 'de').targets.size, 0);

  const forged: UiPackage = { ...green, id: 'ui-common-03', items: [{ key: 'z', nl: 'Laatste', en: 'Last' }, { key: 'weg', nl: 'Weg', en: 'Gone' }] };
  const edited: UiPackage = { ...green, id: 'ui-common-04', items: [{ key: 'a', nl: 'Eerste (oud)', en: 'First' }] };
  const otherLang: UiPackage = { ...green, id: 'ui-common-05', lang: 'fr' };
  const guard = applyUiBatch([
    { pkg: forged, out: { z: 'KAPUTT', weg: 'Weg' } },
    { pkg: edited, out: { a: 'Erstes' } },
    { pkg: otherLang, out: { a: 'Premier' } },
  ], () => structuredClone(existing), { common: nl }, {}, 'de');
  eq('bewerkt pakket, verdwenen sleutel en andere taal: alle drie rood', [guard.applied, guard.red.map(r => r.id)],
    [[], ['ui-common-03', 'ui-common-04', 'ui-common-05']]);
  eq('rood met reden', guard.red.map(r => r.lines[0]), [
    'XX weg: staat niet (meer) in nl',
    'XX a: nl-tekst in het pakket ≠ huidige nl (veranderd na prepare, of pakket bewerkt); opnieuw prepare',
    'XX pakket is voor taal fr, niet de',
  ]);
}

{
  const ar: JsonObject = { a: 'الأول', grp: { x: 'س', n_one: 'مهمة', n_other: '{{count}} مهمة' } };
  const seeded: UiSources = { common: { a: hashUnit('Eerste'), 'grp.x': hashUnit('Iks') } };
  const st = uiStatus('ar', [{ ns: 'common', nl, en, target: ar }], seeded)[0];
  eq('status: halve familie + ontbrekend = 2 ontbreekt', [st.missing, st.stale, st.current], [2, 0, 2]);
  const changed = { ...nl, a: 'Eerste (nieuw)' };
  const st2 = uiStatus('ar', [{ ns: 'common', nl: changed, en, target: ar }], seeded)[0];
  eq('status: gewijzigde nl = verouderd', [st2.missing, st2.stale, st2.current], [2, 1, 1]);
  const st3 = uiStatus('ar', [{ ns: 'common', nl, en, target: ar }], {})[0];
  eq('status: vertaald zonder hash telt als actueel, apart genoemd', [st3.current, st3.unhashed], [2, 2]);
  eq('--stale pakt ook vertaald-zonder-hash op, met de oude tekst',
    selectUnits({ ns: 'common', nl, en, target: ar }, 'ar', 'stale', { common: { a: seeded.common.a } })
      .map(s => [s.unit.key, s.previous]), [['grp.x', 'س']]);
  const gaps = uiReleaseGaps('ar', [{ ns: 'common', nl: changed, en, target: ar }], { common: { a: seeded.common.a } });
  eq('releasepoort: ontbreekt, verouderd en zonder hash, elk met plek', gaps.map(g => `${g.where} ${g.state}`).sort(),
    ['common:a stale', 'common:grp.n missing', 'common:grp.x unhashed', 'common:z missing'].sort());
  eq('releasepoort: alles actueel = geen gaten', uiReleaseGaps('ar', [{ ns: 'common', nl: { a: nl.a }, en, target: ar }], seeded), []);
}

{
  const s: UiSources = { task: { b: 'oud' } };
  setSourceHash(s, 'task', 'cols.total', 'Totaal');
  setSourceHash(s, 'menu', 'n', { other: '{{count}} x', one: 'één x' });
  eq('hash per namespace + sleutel', [s.task['cols.total'], s.task.b, s.menu.n], [hashUnit('Totaal'), 'oud', hashUnit({ one: 'één x', other: '{{count}} x' })]);
}

{
  ok('ru heeft sinds PR #316 een basislijn', hasUiBaseline('ru') && hasUiBaseline('sv') && !hasUiBaseline('be'));
  const ruFill: JsonObject = { a: 'First', grp: { x: 'X', n_one: '{{count}} task', n_few: '{{count}} tasks', n_many: '{{count}} tasks', n_other: '{{count}} tasks' }, z: 'Last' };
  const inputs = [{ ns: 'common', nl, en, target: ruFill }];
  eq('nieuwe taal, vulling zonder hash: --missing pakt alles op',
    selectUnits(inputs[0], 'be', 'missing', {}).map(s => s.unit.key), ['a', 'grp.x', 'grp.n', 'z']);
  const st = uiStatus('be', inputs, {})[0];
  eq('nieuwe taal, vulling zonder hash: status = alles ontbreekt', [st.missing, st.current, st.unhashed], [4, 0, 0]);
  const half: UiSources = { common: { a: hashUnit('Eerste') } };
  eq('nieuwe taal: alleen sleutels met hash gelden als vertaald',
    selectUnits(inputs[0], 'be', 'missing', half).map(s => s.unit.key), ['grp.x', 'grp.n', 'z']);
  const de: JsonObject = { a: 'Erste', grp: { x: 'X', n_one: '{{count}} Aufgabe', n_other: '{{count}} Aufgaben' }, z: 'Letzte' };
  eq('bestaande taal zonder hash: --missing laat vertaalde tekst staan',
    selectUnits({ ns: 'common', nl, en, target: de }, 'de', 'missing', {}).map(s => s.unit.key), []);

  const deSrc: UiSources = {};
  eq('i18n:add, bestaande taal: hash gezet', [updateSourceHashForAdd(deSrc, 'de', 'common', 'a', 'Eerste'), deSrc.common?.a], [true, hashUnit('Eerste')]);
  const ruSrc: UiSources = { common: { a: hashUnit('Eerste'), z: 'x' } };
  eq('i18n:add, nieuwe taal: hash weg', [updateSourceHashForAdd(ruSrc, 'be', 'common', 'a', 'Eerste (nieuw)'), Object.keys(ruSrc.common)], [true, ['z']]);
  const none: UiSources = {};
  eq('i18n:add, nieuwe taal zonder bronbestand: niets te schrijven', [updateSourceHashForAdd(none, 'be', 'common', 'a', 'Eerste'), none], [false, {}]);
}

{
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const work = mkdtempSync(join(tmpdir(), 'ops-translate-fixed-text-'));
  const key = 'ribbon.calendarDialog.hoursValue';
  const fullKey = `menu:${key}`;
  const locFile = (lang: string) => join(work, 'src/i18n/locales', lang, 'menu.json');
  const srcFile = (lang: string) => join(work, 'i18n/ui-sources', `${lang}.json`);
  const readObj = (file: string) => JSON.parse(readFileSync(file, 'utf8')) as JsonObject;
  const writeJson = (file: string, value: unknown) => {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(value));
  };
  const menu = (hours: string) => ({ ribbon: { calendarDialog: { hoursValue: hours } }, otherHours: '{{hours}} س' });
  const cli = join(work, 'translate.mjs');
  const run = (file: string, args: string[]) => {
    const r = spawnSync(process.execPath, [file, ...args], { cwd: work, encoding: 'utf8', timeout: 30000 });
    return { status: r.status, output: `${r.stdout}${r.stderr}${r.error ?? ''}` };
  };
  const expectExit = (label: string, r: ReturnType<typeof run>, status: number) =>
    eq(`${label} (${r.output})`, r.status, status);
  try {
    const bundle = spawnSync(join(root, 'node_modules/.bin/esbuild'), [join(root, 'scripts/translate/cli.ts'),
      '--bundle', '--platform=node', '--format=esm', '--target=node22', '--log-level=error', `--outfile=${cli}`],
    { cwd: root, encoding: 'utf8', timeout: 30000 });
    eq(`172 CLI bundelt (${bundle.stderr})`, bundle.status, 0);
    symlinkSync(join(root, 'scripts'), join(work, 'scripts'), 'dir');
    symlinkSync(join(root, 'node_modules'), join(work, 'node_modules'), 'dir');
    mkdirSync(join(work, 'public/docs'), { recursive: true });
    writeJson(join(work, 'i18n/termbase/concepts.json'), [{
      id: 'fixture-term', kind: 'term', nl: 'fixtureterm', en: ['fixture term'], definition: 'Term voor de CLI-fixture.',
    }]);
    for (const lang of LOCALES.filter(lang => lang !== 'nl' && lang !== 'en')) {
      writeJson(join(work, 'i18n/termbase', `${lang}.json`), {
        _style: { address: 'informal' },
        'fixture-term': { term: 'Fixtureterm', forms: ['Fixtureterm'], source: 'model', status: 'arbitrated' },
      });
    }
    writeJson(join(work, 'keys.json'), [fullKey, 'menu:otherHours']);
    for (const [lang, want] of [['nl', '{{hours}}u'], ['en', '{{hours}}h'], ['ar', '{{hours}}h'], ['fa', '{{hours}}h']]) {
      const actual = unitMap(readObj(join(root, 'src/i18n/locales', lang, 'menu.json'))).get(key)!.text;
      eq(`172 echte bron/doel ${lang}`, actual, want);
      writeJson(locFile(lang), menu(want));
      if (lang !== 'nl') writeJson(srcFile(lang), { menu: { [key]: hashUnit('{{hours}}u'), otherHours: hashUnit('{{hours}} س') } });
    }
    for (const lang of LOCALES.filter(lang => !['nl', 'en', 'ar', 'fa'].includes(lang))) {
      const actual = unitMap(readObj(join(root, 'src/i18n/locales', lang, 'menu.json'))).get(key)!.text;
      if (typeof actual !== 'string') throw new Error(`172 ${lang}: uurtekst moet één tekstwaarde zijn`);
      writeJson(locFile(lang), menu(actual));
      writeJson(srcFile(lang), { menu: { [key]: hashUnit('{{hours}}u'), otherHours: hashUnit('{{hours}} س') } });
    }
    const realNl = readObj(join(root, 'src/i18n/locales/nl/menu.json'));
    const realEn = readObj(join(root, 'src/i18n/locales/en/menu.json'));
    for (const lang of readdirSync(join(root, 'src/i18n/locales'))) {
      const realTarget = readObj(join(root, 'src/i18n/locales', lang, 'menu.json'));
      const [p] = buildUiPackages({ lang, inputs: [{ ns: 'menu', nl: realNl, en: realEn, target: realTarget }],
        mode: 'all', sources: {}, concepts: [], keys: new Map([['menu', new Set([key])]]) });
      const value = unitMap(realTarget).get(key)?.text;
      eq(`172 goedgekeurde bestaande tekst ${lang}`, checkPackage(p, { [key]: value }).errors, []);
    }
    expectExit('172 releasepoort aanvankelijk groen', run(cli, ['status', '--strict']), 0);
    for (const lang of ['ar', 'fa']) {
      expectExit(`172 ${lang} prepare --keys`, run(cli, ['prepare', 'ui', lang, '--keys', 'keys.json']), 0);
      const pkgFile = join(work, 'build/translate', lang, 'ui-menu-01.json');
      const outFile = pkgFile.replace('.json', '.out.json');
      const pack = readObj(pkgFile) as unknown as UiPackage;
      eq(`172 ${lang} prepare draagt vaste tekst en echte nl/en`,
        pack.items.map(i => [i.key, i.nl, i.en, i.fixedText]),
        [[key, '{{hours}}u', '{{hours}}h', '{{hours}}h'], ['otherHours', '{{hours}} س', '{{hours}} س', undefined]]);
      const check = join(work, 'build/translate/check.mjs');
      const beforeLocale = readFileSync(locFile(lang), 'utf8');
      const beforeHash = readFileSync(srcFile(lang), 'utf8');
      for (const wrong of ['{{hours}}س', '{{hours}} h', '{{uren}}h']) {
        writeJson(outFile, { [key]: wrong, otherHours: '{{hours}} س' });
        const checked = run(check, [pkgFile]);
        expectExit(`172 ${lang} check weigert ${wrong}`, checked, 1);
        ok(`172 ${lang} check meldt sleutel en contract`, checked.output.includes(fullKey) && checked.output.includes('"{{hours}}h"'));
        expectExit(`172 ${lang} apply weigert ${wrong}`, run(cli, ['apply', 'ui', lang]), 1);
        eq(`172 ${lang} rode uitvoer verandert locale/hash niet`,
          [readFileSync(locFile(lang), 'utf8'), readFileSync(srcFile(lang), 'utf8')], [beforeLocale, beforeHash]);
        writeJson(locFile(lang), menu(wrong));
        const strict = run(cli, ['status', '--strict']);
        expectExit(`172 ${lang} release weigert ${wrong} met actuele hash`, strict, 1);
        ok(`172 ${lang} release noemt vaste tekst en sleutel`, strict.output.includes(fullKey) && strict.output.includes('vaste tekst wijkt af'));
        writeFileSync(locFile(lang), beforeLocale);
      }
      writeJson(outFile, { [key]: '{{hours}}h', otherHours: '{{hours}} س' });
      expectExit(`172 ${lang} check groen`, run(check, [pkgFile]), 0);
      expectExit(`172 ${lang} apply groen`, run(cli, ['apply', 'ui', lang]), 0);
      eq(`172 ${lang} apply bewaart vaste tekst en vrije andere eenheid`, readObj(locFile(lang)), menu('{{hours}}h'));
      eq(`172 ${lang} apply bewaart bron-hash`, (readObj(srcFile(lang)).menu as JsonObject)[key], hashUnit('{{hours}}u'));
      expectExit(`172 ${lang} release na apply groen`, run(cli, ['status', '--strict']), 0);
      const findings = join(work, 'findings.json');
      writeJson(findings, [{ key: fullKey, fix: '{{hours}}س' }]);
      const beforeFinding = readFileSync(locFile(lang), 'utf8');
      expectExit(`172 ${lang} apply-findings weigert andere letter`, run(cli, ['apply-findings', lang, findings]), 1);
      eq(`172 ${lang} geweigerde finding verandert niets`, readFileSync(locFile(lang), 'utf8'), beforeFinding);
      writeJson(findings, [{ key: fullKey, fix: '{{hours}}h' }, { key: 'menu:otherHours', fix: '{{hours}} ث' }]);
      expectExit(`172 ${lang} apply-findings behoudt vaste tekst en laat andere sleutel vrij`,
        run(cli, ['apply-findings', lang, findings]), 0);
      eq(`172 ${lang} alleen ongerelateerde eenheid gewijzigd`,
        readObj(locFile(lang)), { ...menu('{{hours}}h'), otherHours: '{{hours}} ث' });
      expectExit(`172 ${lang} release na findings groen`, run(cli, ['status', '--strict']), 0);
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (diffs.length === 0) {
  console.log(`OK  translate-apply: alle checks groen (${checks})`);
  process.exit(0);
}
console.log(`XX  translate-apply: ${diffs.length} afwijking(en) van ${checks}`);
for (const d of diffs) console.log(`   - ${d}`);
process.exit(1);

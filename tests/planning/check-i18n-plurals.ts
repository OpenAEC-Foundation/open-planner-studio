/**
 * i18n-pluralisatie-contract — bewaakt de telsleutels van "Project verplaatsen…".
 *
 * AANLEIDING. De waarschuwingsregels toonden bij één item meervoud ("1 deadlines", "1 taken hebben
 * een harde Mandatory-pin"). Opgelost met i18next-pluralisatie (`_one`/`_other`/…), maar dat brengt
 * een valkuil mee die deze batterij afdekt:
 *
 *   Ontbreekt één plural-categorie in een taal, dan valt i18next NIET terug op de `_other` van
 *   diezelfde taal — hij loopt door naar `fallbackLng` en zet er ENGELSE tekst neer.
 *
 * Empirisch vastgesteld: met een Poolse bundel zonder `_few` levert `t(key, {count: 2})` de Engelse
 * string op. Poolse `few` geldt al bij 2, dus dat is geen theoretisch randgeval maar iets wat een
 * gebruiker met twee items direct ziet. Daarom eist deze check per taal EXACT de categorieën die
 * `Intl.PluralRules` voor die taal opgeeft — niet minder (Engelse lek) en niet meer (dode sleutel
 * die de suggestie wekt dat er iets vertaald is).
 *
 * De detailregel ("Meeverschoven — …") is bewust NIET gepluraliseerd: die propte vijf tellingen in
 * één zin, wat met één sleutel niet correct te krijgen is. Hij is omgebouwd naar "label: aantal",
 * waarin het label niet met het getal congrueert. Deze check bewaakt alleen dat die labels bestaan.
 */
import i18next from 'i18next';

import ar from '@/i18n/locales/ar/common.json';
import de from '@/i18n/locales/de/common.json';
import en from '@/i18n/locales/en/common.json';
import es from '@/i18n/locales/es/common.json';
import fa from '@/i18n/locales/fa/common.json';
import fr from '@/i18n/locales/fr/common.json';
import it from '@/i18n/locales/it/common.json';
import ja from '@/i18n/locales/ja/common.json';
import ko from '@/i18n/locales/ko/common.json';
import nl from '@/i18n/locales/nl/common.json';
import pl from '@/i18n/locales/pl/common.json';
import pt from '@/i18n/locales/pt/common.json';
import tr from '@/i18n/locales/tr/common.json';
import zh from '@/i18n/locales/zh/common.json';
import ru_ from '@/i18n/locales/ru/common.json';
import uk_ from '@/i18n/locales/uk/common.json';
import cs_ from '@/i18n/locales/cs/common.json';
import sk_ from '@/i18n/locales/sk/common.json';
import sr_ from '@/i18n/locales/sr/common.json';
import hr_ from '@/i18n/locales/hr/common.json';
import bg_ from '@/i18n/locales/bg/common.json';
import hu_ from '@/i18n/locales/hu/common.json';
import ro_ from '@/i18n/locales/ro/common.json';
import sv_ from '@/i18n/locales/sv/common.json';
import nb_ from '@/i18n/locales/nb/common.json';
import da_ from '@/i18n/locales/da/common.json';
import fi_ from '@/i18n/locales/fi/common.json';

const LOCALES: Record<string, Record<string, unknown>> = {
  nl, en, fr, de, es, zh, it, pt, pl, tr, ar, ja, ko, fa,
  ru: ru_, uk: uk_, cs: cs_, sk: sk_, sr: sr_, hr: hr_, bg: bg_,
  hu: hu_, ro: ro_, sv: sv_, nb: nb_, da: da_, fi: fi_,
};

/** Sleutels die met een `count` worden aangeroepen en dus per taal alle categorieën nodig hebben. */
const PLURAL_KEYS = [
  'affectedTasks', 'warnActuals', 'warnHardPins', 'warnExternal', 'warnCustomDateFields',
] as const;

/** Sleutels van de "label: aantal"-detailregel — geen pluralisatie, wel verplicht aanwezig. */
const LABEL_KEYS = [
  'affectedDetail', 'detailConstraints', 'detailDeadlines',
  'detailActuals', 'detailExternal', 'detailSteps',
  // De kalender-ingreep heeft drie varianten: einde én duur verschoven (durationChanged), alleen
  // het einde (endShiftedOnly) of alleen de duur (durationOnly). Eén tekst die altijd beide noemt
  // levert in de laatste twee gevallen een lege mededeling op ("van 177 naar 177 werkdagen").
  'durationChanged', 'endShiftedOnly', 'durationOnly',
] as const;

/** Tellingen waarmee elke taal wordt afgevuurd; dekt one/two/few/many/other in ar en pl. */
const PROBE_COUNTS = [0, 1, 2, 3, 5, 11, 21, 100];

const diffs: string[] = [];
let checks = 0;
// Besluit B5 (2026-10-10): een andere taal dan nl/en mag een sleutel of een hele familie nog missen (de app
// valt terug op en, de vertaalstraat vult hem vóór een release). Wat er wél staat, moet kloppen; een
// halve familie blijft fout.
const optional = (loc: string) => loc !== 'nl' && loc !== 'en';
const familyAbsent = (mp: Record<string, string>, key: string) =>
  !Object.keys(mp).some(k => k === key || k.startsWith(`${key}_`));

const fail = (msg: string) => diffs.push(msg);
const moveProjectOf = (loc: string) =>
  (LOCALES[loc].moveProject ?? {}) as Record<string, string>;

// ── 1. Structuur: exact de categorieën die de taal volgens CLDR kent ──────────
for (const loc of Object.keys(LOCALES)) {
  const mp = moveProjectOf(loc);
  // Expliciet Set<string>: `pluralCategories` is `LDMLPluralRule[]`, maar we vergelijken hem met
  // vrije sleutel-achtervoegsels uit de vertaalbestanden (gewone strings).
  const expected = new Set<string>(new Intl.PluralRules(loc).resolvedOptions().pluralCategories);

  for (const key of PLURAL_KEYS) {
    checks++;
    if (optional(loc) && familyAbsent(mp, key)) continue;
    const found = new Set(
      Object.keys(mp)
        .filter(k => k === key || k.startsWith(`${key}_`))
        .map(k => (k === key ? '<zonder achtervoegsel>' : k.slice(key.length + 1))),
    );
    const missing = [...expected].filter(c => !found.has(c));
    const extra = [...found].filter(c => !expected.has(c));
    if (missing.length || extra.length) {
      const parts: string[] = [];
      if (missing.length) parts.push(`ontbreekt: ${missing.join(',')}`);
      if (extra.length) parts.push(`overbodig: ${extra.join(',')}`);
      fail(`${loc}/${key}: ${parts.join(' · ')} (verwacht precies ${[...expected].sort().join(',')})`);
    }

    // Elke vorm moet het getal ook echt tonen.
    for (const cat of expected) {
      const v = mp[`${key}_${cat}`];
      if (typeof v === 'string' && !v.includes('{{count}}')) {
        fail(`${loc}/${key}_${cat}: mist {{count}} — "${v}"`);
      }
    }
  }

  for (const key of LABEL_KEYS) {
    checks++;
    const v = mp[key];
    if (v === undefined && optional(loc)) continue;
    if (typeof v !== 'string' || v.trim() === '') fail(`${loc}/${key}: ontbreekt of leeg`);
  }

  // De detailregel wordt met {{items}} gevoed; de oude vijf-tellingen-vorm mag niet terugkomen.
  checks++;
  const detail = mp.affectedDetail;
  if (typeof detail === 'string' && !detail.includes('{{items}}')) {
    fail(`${loc}/affectedDetail: mist {{items}} — "${detail}"`);
  }
}

// ── 2. Sleutelpariteit: elke taal dezelfde niet-getelde sleutels als het Nederlands ──
const baseKeys = (loc: string) =>
  new Set(Object.keys(moveProjectOf(loc)).filter(
    k => !PLURAL_KEYS.some(p => k === p || k.startsWith(`${p}_`)),
  ));
const nlBase = baseKeys('nl');
for (const loc of Object.keys(LOCALES)) {
  if (loc === 'nl' || optional(loc)) continue; // B5: alleen en moet compleet zijn
  checks++;
  const mine = baseKeys(loc);
  const missing = [...nlBase].filter(k => !mine.has(k));
  if (missing.length) fail(`${loc}: mist moveProject-sleutels t.o.v. nl: ${missing.join(', ')}`);
}

// ── 3. Runtime: los i18next per taal, ZONDER terugval — een gat komt dan als sleutel terug ──
// fallbackLng:false is hier het hele punt. Met terugval zou een ontbrekende categorie stilletjes
// Engels opleveren en zou deze check niets bewijzen.
for (const loc of Object.keys(LOCALES)) {
  const inst = i18next.createInstance();
  await inst.init({
    lng: loc,
    fallbackLng: false,
    resources: { [loc]: { common: LOCALES[loc] } },
    ns: ['common'],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
  });

  for (const key of PLURAL_KEYS) {
    if (optional(loc) && familyAbsent(moveProjectOf(loc), key)) continue;
    for (const n of PROBE_COUNTS) {
      checks++;
      const path = `moveProject.${key}`;
      const out = inst.t(path, { count: n });
      if (out === path || out === '') {
        const cat = new Intl.PluralRules(loc).select(n);
        fail(`${loc}/${key}: count=${n} (categorie "${cat}") lost niet op — zou in de app Engels tonen`);
      } else if (!out.includes(String(n))) {
        fail(`${loc}/${key}: count=${n} rendert zonder het getal — "${out}"`);
      }
    }
  }

  for (const key of LABEL_KEYS) {
    if (optional(loc) && moveProjectOf(loc)[key] === undefined) continue;
    checks++;
    const path = `moveProject.${key}`;
    const out = inst.t(path, { items: 'x: 1' });
    if (out === path || out === '') fail(`${loc}/${key}: lost niet op`);
  }
}

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  i18n-plurals: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  i18n-plurals: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}

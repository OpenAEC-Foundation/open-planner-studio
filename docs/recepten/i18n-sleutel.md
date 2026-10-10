# Een nieuwe vertaalsleutel toevoegen

28 locales (`nl, en, fr, de, es, zh, it, pt, pl, tr, ar, ja, ko, fa, ru, uk, cs, sk, sr, hr, bg, hu, ro, sv, nb, da, fi, lo`), elk met vier namespaces
(`common`, `task`, `report`, `menu`) — zie *i18n* in `.claude/rules/i18n.md`. Nederlands is de **brontaal**: nieuwe
sleutels worden eerst in `src/i18n/locales/nl/<namespace>.json` geschreven, alle andere talen volgen
daaruit. Alleen Engels wordt eager mee-gebundeld (`config.ts`); de rest laadt lazy via `loadLocale()`.

**De werkwijze in het kort (besluit B5, eigenaar, 2026-10-10):**

1. **Een PR vraagt alleen `nl` + `en`.** De andere talen mogen ontbreken; de app toont daar het Engels.
2. **De vertaalstraat vult de rest** (`npm run translate`, ontwerp
   `docs/superpowers/specs/2026-10-09-vertaalstraat-design.md`): `prepare ui <taal> --missing` en `--stale`.
3. **Een release eist alles.** `npm run verify:translations` faalt bij elke ontbrekende, verouderde of
   nog niet door de straat gehaalde vertaling. Die poort zit in `release.yml` en in de release-skill,
   bewust niet in `npm run verify` (anders wordt elke PR rood).

**Dit is een toelichting, geen vervanging.** `npm run verify:i18n` (`scripts/i18n-diff.mjs`) is de
poort; loopt dit document ooit achter, dan heeft die het gelijk.

---

## De stappen

1. **Kies de namespace.** `common` voor generieke UI-tekst, `task` voor taakspecifieke labels,
   `report` voor rapport-/exportcontext, `menu` voor ribbon-/backstage-/menutekst. De vier bestanden
   staan naast elkaar per taal: `src/i18n/locales/<taal>/{common,task,report,menu}.json`.
2. **Schrijf de vertalingen in één JSON-bestand**: `nl` en `en` zijn verplicht. Een andere taal mag je
   erbij zetten als je hem zeker weet; anders laat je hem weg en vult de straat hem:
   ```json
   { "nl": "Onderbreking opheffen", "en": "Remove break" }
   ```
   Telt de tekst iets (`t(key, { count })`), schrijf dan per locale de meervoudsvormen van díé taal
   (zie *De valkuil* hieronder):
   ```json
   { "nl": { "one": "{{count}} taak", "other": "{{count}} taken" },
     "en": { "one": "{{count}} task", "other": "{{count}} tasks" } }
   ```
3. **Zet hem erin met één commando:**
   ```bash
   npm run i18n:add -- common:pad.naar.sleutel vertalingen.json              # nieuw, achteraan
   npm run i18n:add -- common:pad.naar.sleutel vertalingen.json --after broer # nieuw, na een broer
   npm run i18n:add -- common:pad.naar.sleutel vertalingen.json --update     # bestaande wijzigen
   ```
   Het script schrijft niets en noemt de fout als `nl` of `en` ontbreekt, een opgegeven taal niet
   precies haar CLDR-meervoudscategorieën heeft, of de `{{invulplekken}}` afwijken van `nl`. Een
   meervoudsvorm vergelijkt met de nl-vorm voor dezelfde getallen (`one` met nl `one`, de rest met nl
   `other`), en mag `{{count}}` in woorden uitschrijven, zoals het Arabische "مهمة واحدة". De sleutel
   komt in elke locale op dezelfde plek, want alle bestanden volgen de volgorde van `nl`.

   Voor elke taal die je niet opgeeft, schrijft het script niets en haalt het de bron-hash van die
   sleutel weg uit `i18n/ui-sources/<taal>.json`. Bij `--update` blijft de oude vertaling dan staan tot
   de straat hem vervangt; `translate prepare ui <taal> --stale` pakt hem op, met de oude tekst erbij.
   Verandert de sleutel van soort (tekst ↔ meervoudsfamilie), dan haalt het script de oude tekst weg.
4. **Roep hem aan met `t('namespace:pad.naar.sleutel')`** — nooit hardgecodeerde zichtbare tekst.
5. **Draai `npm run verify:i18n`.** Zie hieronder wat hij precies controleert. Een regel als
   `.. sv: 1 sleutel(s) ontbreken (common 1)` is een rapport, geen fout.

## Vóór een release: de straat en de releasepoort

```bash
npm run translate -- status                  # per taal: ontbreekt / verouderd / actueel (zonder hash)
npm run translate -- prepare ui <taal> --missing   # en daarna --stale; stations en apply ui: zie de release-skill
npm run translate -- prepare ui <taal> --avoid     # na een termwissel: teksten met de oude term (avoid in de termbase)
npm run translate -- apply-findings <taal> f.json  # nagelezen verbeteringen [{ "key": "ns:pad", "fix": … }] direct toepassen
npm run verify:translations; echo "exit=$?"  # releasepoort: exit 0 = elke taal compleet en actueel
```

`verify:translations` (`translate status --strict`) telt per taal drie soorten gaten: **ontbreekt** (geen of
een halve vertaling; in een nieuwe taal ook tekst zonder hash, want dat is Engelse vulling), **verouderd**
(de nl-tekst veranderde na de vertaling) en **zonder hash** (vertaald, maar niet door de straat bijgehouden,
bv. na een `i18n:add` die deze taal niet schreef). De release-skill beschrijft de hele ronde.

Met de hand bewerken mag nog steeds (het blijft gewone JSON); draai daarna `npm run i18n:fmt`, anders
faalt `verify:i18n` op de opmaak.

## De vaste opmaak (`npm run i18n:fmt`)

Alle 108 locale-bestanden hebben één opmaak: één sleutel per regel (JSON, twee spaties), in precies de
volgorde van `nl`; een meervoudsfamilie staat op de plek van haar `nl`-familie met de categorieën van
de eigen taal in CLDR-volgorde (`zero`, `one`, `two`, `few`, `many`, `other`). Daardoor valt een
mergeconflict op één regel in plaats van op een blok (vroeger stonden in zes talen 70 kolomnamen op één
regel van ~2.600 tekens), en staat een nieuwe sleutel in elke taal op dezelfde plek. `npm run i18n:fmt`
zet alles recht; `verify:i18n` draait dezelfde opmaak als controle (`--check`). Opmaken verandert nooit
de inhoud — `tests/planning/check-i18n-tools.ts` bewijst dat op alle echte bestanden.

## Mergen (`npm run i18n:resolve`)

Draai na elke `git merge` waarbij aan beide kanten locale-bestanden veranderden `npm run i18n:resolve`,
óók als git daar geen conflict meldde. Het script voegt alle 108 bestanden per sleutel samen uit de drie
versies die git kent (merge-base, jouw kant, de andere kant), zet ze in de vaste opmaak en doet
`git add`. Wat maar één kant toevoegde, wijzigde of verwijderde, gaat mee.

Waarom niet op git vertrouwen: git vergelijkt regels. Verwijdert jouw branch een sleutel die de andere
kant alleen verplaatste (zoals bij de eenmalige herschikking), dan voegt git "zonder conflict" samen en
staat de sleutel er stil weer. `tests/planning/check-i18n-resolve.ts` bootst dat na met echte git.

- **Merge loopt nog** (git meldde conflicten): `npm run i18n:resolve` en daarna `git commit`.
- **Git maakte de merge-commit al**: hetzelfde commando controleert die commit. Klopt hij, dan wijzigt
  het niets; anders staat de correctie klaar voor `git commit --amend --no-edit`.
- **Echte botsing** (dezelfde sleutel aan beide kanten anders gewijzigd): exit 1. Het script noemt
  per sleutel beide waarden en laat dat bestand open (voorlopig jouw waarde, niet ge-`git add`). Kies
  de juiste waarde, doe `git add` en draai `npm run verify:i18n`.
- **`package.json` in conflict**: los dat eerst op. Zolang daar conflictmarkeringen in staan, start
  geen enkel npm-script.

## Wat `verify:i18n` (`scripts/i18n-diff.mjs`) doet

Voor elke niet-`nl`-locale en elk namespace-bestand: verzamel alle sleutelpaden in `nl`, reken ze om
naar de paden die DIE locale zou moeten hebben, en meld wat ontbreekt. Twee dingen maken dit meer dan
een letterlijke sleutelvergelijking:

- **Geen letterlijke kopie-eis.** `expectedPathsFor()` herschrijft elk meervoudspad (`..._one`,
  `..._other`, …) naar de categorieën die de DOELTAAL volgens CLDR kent — niet die van `nl`.
- **CLDR bepaalt de categorieën, niet `nl`.** `categoriesFor(locale)` vraagt
  `new Intl.PluralRules(locale).resolvedOptions().pluralCategories` op. Voorbeeld: `nl`/`en` kennen
  `one`+`other`; `zh`/`ja`/`ko` kennen alléén `other` (een `..._one`-sleutel zou daar dus ten
  onrechte als "ontbrekend" gelden zonder deze correctie); `pl` kent `one`/`few`/`many`/`other`;
  `es`/`fr`/`it`/`pt` kennen `one`/`many`/`other`. Voor dit project geldt: `_many` bij die laatste
  vier locales is in de praktijk gelijk aan `_other`, omdat `{{count}}` altijd als cijfers wordt
  weergegeven (nooit compact als "1M") — `_many` slaat dus alleen aan bij exacte veelvouden van
  een miljoen.
- **Poort voor `en` en halve families, rapport voor de rest (B5).** Zonder `--json` eindigt het script
  op exit 1 als `en` een sleutel of vorm mist (en is de terugvaltaal), of als een taal een **halve**
  meervoudsfamilie heeft (een deel van haar CLDR-categorieën: i18next valt dan voor sommige getallen
  terug op Engels, midden in een vertaalde zin). Ontbreekt een sleutel of hele familie in een andere
  taal, dan meldt het één regel per taal met aantallen en eindigt het op exit 0; `--verbose` noemt de
  sleutels. `--json` blijft rapportagemodus (exit 0) met `errors` en `absent` apart.

## Een samengestelde sleutel: geen `as`

De typecheck controleert elke sleutel die je aan `t(...)` geeft tegen de nl-bronbestanden
(`src/i18n/types.d.ts`), ook een samengestelde zoals ``t(`taskType.${type}`)``, zolang het variabele
deel een vaste set waarden heeft (een union-type). Een cast als ``t(`…${x}` as 'a.b')`` of
`t(tabel[k] as 'a.b')` zet die controle uit: een ontbrekende vertaling valt dan pas op als de gebruiker
Engels of de kale sleutel ziet. `verify:i18n` weigert zo'n cast daarom (`scripts/verify-i18n-keys.mjs`;
`as const` mag wel).

Geef in plaats daarvan de bron het sleuteltype:

- een tabel: `const LABEL = { … } as const satisfies Record<Soort, ParseKeys<'common'>>;`
- een veld in een type: `titleKey: ParseKeys<'common'>` (sleutels uit meer namespaces:
  `ParseKeys<['common', 'menu']>`, met `useTranslation(['common', 'menu'])` bij de aanroep).

`ParseKeys` komt uit `i18next` (`import type { ParseKeys } from 'i18next'`).

## De valkuil: een kale `t(key, { count })` wordt niet automatisch een pluralfamilie

`i18n-diff.mjs` leidt zijn "moet-hebben"-verzameling af uit sleutels die in `nl` AL de
`_one`/`_other`/…-suffix dragen (`PLURAL_SUFFIX`-regex). Roep je in de code `t('foo.bar', { count })`
aan zonder dat `foo.bar` in `nl` al als familie (`foo.bar_one`/`foo.bar_other`) bestaat, dan ziet
`i18n-diff.mjs` gewoon één kale sleutel `foo.bar` — geen pluralfamilie, dus geen CLDR-categorieën
worden geëist, en i18next interpoleert `{{count}}` in exact dezelfde string voor 1 en voor 100. De
algemene poort merkt dit dus NIET automatisch op; hij bewaakt alleen dat een reeds als familie
vastgelegde sleutel de juiste categorieën heeft per locale, niet dat elk `{ count }`-gebruik een
familie *moet* zijn.

Waar dat wél expliciet bewaakt wordt, is domeinspecifiek: `tests/planning/check-task-grid-i18n.ts`
inventariseert de ECHTE `count`-aanroepen in de taakgrid-registerlabels
(`/labelForText\?\.\(\s*'([^']+)'\s*,\s*\{\s*count\s*:/`-scan) en eist daar per locale exact de
`Intl.PluralRules`-categorieën. Voeg je een nieuwe `count`-aanroep toe buiten dat ene register, dan
moet je zelf een vergelijkbare domeincheck schrijven of hem handmatig als familie opzetten — er is
geen generieke poort die elke `t(key, { count })`-aanroep in de hele codebase vindt.

## Waar het echt staat

| onderwerp | bestand |
|---|---|
| brontaal-sleutels (vier namespaces) | `src/i18n/locales/nl/{common,task,report,menu}.json` |
| overige 13 locales, zelfde structuur | `src/i18n/locales/<taal>/{common,task,report,menu}.json` |
| i18next-init, eager (en) vs. lazy (overige) | `src/i18n/config.ts` |
| lazy-loader per taal | `src/i18n/` (`loadLocale()`) |
| de poort: CLDR-pluralcategorieën per locale | `scripts/i18n-diff.mjs` (`npm run verify:i18n`) |
| toevoegen/wijzigen (nl + en verplicht, rest optioneel), vaste opmaak | `scripts/i18n-add.ts` (`npm run i18n:add`), `scripts/i18n-fmt.ts` (`npm run i18n:fmt`), kern `scripts/i18n-tools.ts` |
| test van die kern (inhoud blijft gelijk op alle echte bestanden) | `tests/planning/check-i18n-tools.ts` |
| locale-bestanden per sleutel samenvoegen na `git merge` | `scripts/i18n-resolve.ts` (`npm run i18n:resolve`), end-to-end getest in `tests/planning/check-i18n-resolve.ts` |
| domeincheck: taakgrid-registerlabels + echte `count`-aanroepen | `tests/planning/check-task-grid-i18n.ts` |
| releasepoort: elke taal compleet en actueel | `scripts/translate/cli.ts` (`status --strict`, `npm run verify:translations`), kern `uiReleaseGaps` in `scripts/translate/ui.ts` |
| RTL-locales (`ar`, `fa`) | `RTL_LOCALES` in `src/i18n/config.ts` |

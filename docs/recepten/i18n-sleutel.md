# Een nieuwe vertaalsleutel toevoegen

Veertien locales (`nl, en, fr, de, es, zh, it, pt, pl, tr, ar, ja, ko, fa`), elk met vier namespaces
(`common`, `task`, `report`, `menu`) — zie *i18n* in `CLAUDE.md`. Nederlands is de **brontaal**: nieuwe
sleutels worden eerst in `src/i18n/locales/nl/<namespace>.json` geschreven, alle andere talen volgen
daaruit. Alleen Engels wordt eager mee-gebundeld (`config.ts`); de rest laadt lazy via `loadLocale()`.

**Dit is een toelichting, geen vervanging.** `npm run verify:i18n` (`scripts/i18n-diff.mjs`) is de
poort; loopt dit document ooit achter, dan heeft die het gelijk.

---

## De stappen

1. **Kies de namespace.** `common` voor generieke UI-tekst, `task` voor taakspecifieke labels,
   `report` voor rapport-/exportcontext, `menu` voor ribbon-/backstage-/menutekst. De vier bestanden
   staan naast elkaar per taal: `src/i18n/locales/<taal>/{common,task,report,menu}.json`.
2. **Schrijf de vertalingen in één JSON-bestand**, per locale één tekst — alle 14, want elke nieuwe
   tekst gaat meteen in alle talen (besluit werkwijze 2026-09):
   ```json
   { "nl": "Onderbreking opheffen", "en": "Remove break", "fr": "…", "de": "…", … }
   ```
   Telt de tekst iets (`t(key, { count })`), schrijf dan per locale de meervoudsvormen van díé taal
   (zie *De valkuil* hieronder):
   ```json
   { "nl": { "one": "{{count}} taak", "other": "{{count}} taken" },
     "pl": { "one": "…", "few": "…", "many": "…", "other": "…" }, "zh": { "other": "…" }, … }
   ```
3. **Zet hem in alle 14 locales met één commando:**
   ```bash
   npm run i18n:add -- common:pad.naar.sleutel vertalingen.json              # nieuw, achteraan
   npm run i18n:add -- common:pad.naar.sleutel vertalingen.json --after broer # nieuw, na een broer
   npm run i18n:add -- common:pad.naar.sleutel vertalingen.json --update     # bestaande wijzigen
   ```
   Het script schrijft niets en noemt de fout als een locale ontbreekt, een taal niet precies haar
   CLDR-meervoudscategorieën heeft, of de `{{invulplekken}}` afwijken van `nl` (een meervoudsvorm mag
   `{{count}}` in woorden uitschrijven, zoals het Arabische "مهمة واحدة"). De sleutel komt in elke
   locale op dezelfde plek, want alle bestanden volgen de volgorde van `nl`.
4. **Roep hem aan met `t('namespace:pad.naar.sleutel')`** — nooit hardgecodeerde zichtbare tekst.
5. **Draai `npm run verify:i18n`.** Zie hieronder wat hij precies controleert.

Met de hand bewerken mag nog steeds (het blijft gewone JSON); draai daarna `npm run i18n:fmt`, anders
faalt `verify:i18n` op de opmaak.

## De vaste opmaak (`npm run i18n:fmt`)

Alle 56 locale-bestanden hebben één opmaak: één sleutel per regel (JSON, twee spaties), in precies de
volgorde van `nl`; een meervoudsfamilie staat op de plek van haar `nl`-familie met de categorieën van
de eigen taal in CLDR-volgorde (`zero`, `one`, `two`, `few`, `many`, `other`). Daardoor valt een
mergeconflict op één regel in plaats van op een blok (vroeger stonden in zes talen 70 kolomnamen op één
regel van ~2.600 tekens), en staat een nieuwe sleutel in elke taal op dezelfde plek. `npm run i18n:fmt`
zet alles recht; `verify:i18n` draait dezelfde opmaak als controle (`--check`). Opmaken verandert nooit
de inhoud — `tests/planning/check-i18n-tools.ts` bewijst dat op alle echte bestanden.

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
- **Poort, geen rapportage — met een uitzondering.** Zonder `--json` eindigt het script op exit 1
  zodra er ergens een sleutel ontbreekt (`npm run verify:i18n`, onderdeel van `npm run verify`).
  `--json` blijft rapportagemodus (exit 0) voor doorsluizen naar tooling.

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
| toevoegen/wijzigen in alle 14 locales, vaste opmaak | `scripts/i18n-add.ts` (`npm run i18n:add`), `scripts/i18n-fmt.ts` (`npm run i18n:fmt`), kern `scripts/i18n-tools.ts` |
| test van die kern (inhoud blijft gelijk op alle echte bestanden) | `tests/planning/check-i18n-tools.ts` |
| domeincheck: taakgrid-registerlabels + echte `count`-aanroepen | `tests/planning/check-task-grid-i18n.ts` |
| RTL-locales (`ar`, `fa`) | `RTL_LOCALES` in `src/i18n/config.ts` |

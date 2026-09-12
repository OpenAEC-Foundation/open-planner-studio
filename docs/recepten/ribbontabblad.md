# Een nieuw ribbontabblad toevoegen

De shell is een Office-stijl ribbon (`src/components/layout/Ribbon`) met een declaratieve
tab→groepen-configuratie; zie *Ribbon-driven UI* in `CLAUDE.md`. Een tabblad toevoegen raakt vijf
plekken; ÉÉN daarvan geeft een compileerfout als je hem vergeet (de rest niet).

**Dit is een toelichting, geen vervanging.** Waar de compiler en `npm run verify:docs` je
tegenhouden staat erbij; loopt dit document ooit achter, dan heeft de code gelijk.

---

## De vijf plekken

| plek | bestand | wat er misgaat als je hem vergeet |
|---|---|---|
| 1. de union zelf | `src/state/slices/types.ts` (`RibbonTab`) | de rest kan niet eens beginnen — elke andere plek verwijst naar deze union |
| 2. de tab-inhoud | `src/components/layout/Ribbon/ribbonConfig.tsx` (`RIBBON_TABS`) | **compileerfout.** `RIBBON_TABS` is getypeerd als `Record<Exclude<RibbonTab, 'file'>, RibbonTabConfig>` — een nieuw union-lid zonder bijbehorende entry laat de object-literal niet compileren |
| 3. de tab-knop + label | `src/components/layout/Ribbon/Ribbon.tsx` (`tabs`-array + de `tMenu(...)`-lookup) | de tab bestaat, heeft inhoud, maar er verschijnt geen knop om hem te openen |
| 4. de vertaling | `src/i18n/locales/*/menu.json` (`ribbon.<tab>`) | de tab-knop toont de kale i18next-sleutel of valt terug op Engels |
| 5. de documentatie-bewering | `CLAUDE.md` (Tabbladen-opsomming) | `npm run verify:docs` (Poort 7a) faalt |

## De stappen

1. **Voeg het lid toe aan de `RibbonTab`-union** in `src/state/slices/types.ts`:
   ```ts
   export type RibbonTab = 'file' | 'start' | 'planning' | 'resources' | 'beeld' | 'instellingen'
     | 'table' | 'ifc' | 'report' | 'ai' | 'mijnTab';
   ```
2. **Bouw de tab-inhoud** in `ribbonConfig.tsx`: een `RibbonTabConfig` (= `RibbonGroupSpec[]`) — elke
   groep heeft een `id`, een `labelKey` (`'ns:pad'`-vorm, zie stap 4) en `items`
   (`kind: 'button' | 'small' | 'stack' | 'component'`). Voeg de constante toe aan `RIBBON_TABS`:
   ```ts
   export const RIBBON_TABS: Record<Exclude<RibbonTab, 'file'>, RibbonTabConfig> = {
     ...
     mijnTab: mijnTabConfig,
   };
   ```
   Dit is de enige stap die de compiler zelf afdwingt: vergeet je de entry, dan compileert
   `ribbonConfig.tsx` niet. `RibbonTabContent.tsx` rendert vervolgens elke tab generiek uit deze
   config — daar hoeft niets bij, tenzij je een geheel nieuw `kind` introduceert.
3. **Voeg de knop toe** in `Ribbon.tsx`: het nieuwe lid moet in de `tabs`-array staan (rond regel 245)
   om als knop te verschijnen, in de gewenste volgorde. Is de tab altijd zichtbaar, dan is een kale
   toevoeging genoeg; is hij **conditioneel** (zoals `ai`, alleen bij `ui.aiMode`), volg dat patroon:
   ```ts
   const tabs: RibbonTab[] = [
     'start', 'planning', 'resources', 'beeld', 'instellingen', 'table', 'ifc', 'report',
     ...(aiMode ? (['ai'] as RibbonTab[]) : []),
   ];
   ```
   De labeltekst komt uit `tMenu(\`ribbon.${tab}\`)`, met twee bestaande naam-uitzonderingen
   (`beeld`→`view`, `instellingen`→`settings`) omdat die twee union-namen niet de gewenste
   Engelstalige sleutelnaam zijn. Wijkt jouw tab-identifier ook af van de gewenste sleutelnaam, voeg
   dan een derde `? :`-tak toe aan diezelfde regel.
4. **Voeg de vertaalsleutel toe**: `ribbon.<tab>` (of de naam die je in stap 3 koos) in de `ribbon`-
   sectie van `menu.json`, in **alle 14 locales** — zie `docs/recepten/i18n-sleutel.md` voor hoe
   `verify:i18n` dat afdwingt (elke locale moet de sleutel hebben, niet alleen nl+en).
5. **Werk `CLAUDE.md` bij**: de Ribbon-alinea somt `RibbonTab` op als backtick-identifiers
   (`` `file` ``, `` `start` ``, …). Poort 7a in `scripts/verify-docs.ts` leest de `RibbonTab`-union
   rechtstreeks uit `slices/types.ts` en eist dat elk lid als `` `lid` `` in `CLAUDE.md` voorkomt —
   dit is dus geen keuze maar een harde CI-poort.
6. **Bouw de tab-inhoud vanuit bestaande primitieven** (`RibbonButton`, `RibbonGroup`,
   `RibbonButtonStack`, of `kind: 'component'` voor een eigen React-component met state) —
   `ribbonPrimitives.tsx` en de bestaande tabs in `ribbonConfig.tsx` zijn het beste voorbeeldmateriaal.

## Wat níét mechanisch bewaakt wordt

- Dat de tab-knop ook echt in de `tabs`-array van `Ribbon.tsx` staat (stap 3). Een tab die wél in
  `RIBBON_TABS` zit maar niet in die array, compileert prima en is voor de gebruiker gewoon
  onbereikbaar — geen test of poort merkt dit op.
- Dat de vertaalsleutel in `menu.json` staat vóórdat je 'm gebruikt: een ontbrekende sleutel toont
  gewoon de kale sleutelnaam of het Engelse fallback, geen compileerfout, geen rode poort (behalve
  `verify:i18n`, en alleen als de sleutel al in `nl` bestaat maar in een andere locale ontbreekt).

## Waar het echt staat

| onderwerp | bestand |
|---|---|
| `RibbonTab`-union | `src/state/slices/types.ts` |
| tab-configuratie (`RIBBON_TABS`, per-tab groepen) | `src/components/layout/Ribbon/ribbonConfig.tsx` |
| generieke renderer per tab | `src/components/layout/Ribbon/RibbonTabContent.tsx` |
| tab-knoppen, volgorde, labellookup, conditionele tabs | `src/components/layout/Ribbon/Ribbon.tsx` |
| knop-/groep-primitieven | `src/components/layout/Ribbon/ribbonPrimitives.tsx` |
| vertaalsleutels (`ribbon.<tab>`) | `src/i18n/locales/<taal>/menu.json` |
| de CLAUDE.md-poort | `scripts/verify-docs.ts` (Poort 7a) |

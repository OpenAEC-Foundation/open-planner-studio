# Een nieuwe instelling toevoegen

Instellingen persisteren via `localStorage` (`ops-`-prefix), niet via `@tauri-apps/plugin-store` —
die dependency staat wel in `package.json` maar wordt hier niet gebruikt (zie *Settings persistence*
in `CLAUDE.md`). De **load**-kant loopt declaratief via één register; de **save**-kant blijft losse
functies. Dat is bewust asymmetrisch: laden gebeurt voor een kleine dertig instellingen tegelijk bij
het opstarten (vandaar één descriptor-lijst), opslaan gebeurt per instelling op het moment dat de
gebruiker hem wijzigt (vandaar een losse `saveX`-functie per instelling, aangeroepen vanuit de UI die
'm toont).

**Dit is een toelichting, geen vervanging.** Waar de compiler en de tests je tegenhouden staat
telkens erbij; loopt dit document ooit achter, dan heeft de code gelijk.

---

## De stappen

1. **Kies een `UIState`-veld** in `src/state/slices/types.ts` (of hergebruik een bestaand veld als je
   alleen persistentie toevoegt aan iets dat al in de store zit).
2. **Voeg één descriptor toe** aan `SETTINGS` in `src/utils/settingsRegistry.ts`:
   ```ts
   setting({ key: 'mijnInstelling', field: 'mijnInstelling', parse: parseBoolean }),
   ```
   `key` wordt de localStorage-sleutel ná het `ops-`-prefix (die het `settingsStore`-`getSetting`
   zelf toevoegt); `field` is het `UIState`-veld; `parse` is een validator die `undefined` teruggeeft
   bij een ongeldige/afwezige waarde — dan blijft de store-default staan, nooit een stille reset naar
   een verkeerde waarde. Herbruikbare validators staan bovenin hetzelfde bestand: `parseBoolean`,
   `parseEnum(allowed)`, `parseClampedInt(min, max)`, `parseNumberChoice(allowed)`, en het
   `ModifierMap`-specifieke `parseModifierMap`.
3. **Schrijf een `saveX`-wrapper** in `src/utils/settingsStore.ts` als er nog geen bestaat — een
   dunne functie die `setSetting(key, value)` aanroept. Bestaat de sleutel al (je hergebruikt een
   bestaand veld), dan is deze stap overbodig.
4. **Zet de UI op alle drie de plekken.** Elke instelling die een gebruiker moet kunnen wijzigen,
   hoort op **alle drie** te verschijnen — niet als drie losse implementaties, maar als drie
   aanroeppunten van hetzelfde gedeelde component `src/components/settings/SettingsPanelContent.tsx`:

   | plek | hoe hij daar komt |
   |---|---|
   | tandwiel-popup (⚙) in de titelbalk | `TitleBar.tsx` zet `ui.showSettingsDialog: true`, wat `SettingsDialog.tsx` toont, die `<SettingsPanelContent />` rendert |
   | Instellingen-ribbontab | de knop "projectSettings" in `instellingenTab` (`ribbonConfig.tsx`) zet dezelfde `ui.showSettingsDialog: true` |
   | Backstage → Instellingen | `Backstage.tsx` rendert `<SettingsPanelContent />` rechtstreeks, zonder dialoog |

   Voeg je UI-element dus toe binnen `SettingsPanelContent.tsx` zelf — dat verschijnt daarmee
   automatisch op alle drie de plekken. Een los stuk UI ergens anders bouwen breekt deze conventie
   stilzwijgend.
5. **Roep `t(...)` aan voor elk zichtbaar label** (zie *i18n* in `CLAUDE.md` en
   `docs/recepten/i18n-sleutel.md`) — nooit hardgecodeerde tekst in het instellingenpaneel.

## De drie bewuste afwijkers

Niet elke instelling past in het 1-op-1-patroon van `SETTINGS`. Drie bestaande afwijkers staan
expliciet (met motivatie ter plekke, genummerd "Afwijker 1/2/3") in `loadAllSettings()` in
`settingsRegistry.ts`, niet in de lijst zelf:

- **Afwijker 1 — thema** — `initTheme()` migreert legacy-thema's (7 → 3), persisteert die conversie
  terug, en levert ALTIJD een waarde (nooit "afwezig"). Dat past niet in het "ongeldig/afwezig ⇒ veld
  weglaten"-contract van een gewone descriptor.
- **Afwijker 2 — bouwmodus** — `loadConstructionMode()` is bewust SYNCHROON (geen `Promise`), omdat
  de kalenderfabriek de vlag direct moet kunnen uitlezen bij het opstarten, vóór er tijd is voor een
  async round-trip.
- **Afwijker 3 — balkkleurkeuze** (`barColorSelection`) — één objectkeuze met een migratie uit twee
  oude instellingen. Past niet in het 1-op-1-register: de loader leest de canonieke sleutel en pas bij
  ontbreken van die sleutel de twee oude bronnen.

Een aparte categorie hoort helemaal NIET in `SETTINGS` of `loadAllSettings()`: sleutels die **lazy**
laden buiten de opstart-hydratatie — layouts, `workTimePresets`, `welcomeSeen`, `locale`. Die voeden
geen enkel opstart-`setUI`-patch en worden pas gelezen op het moment dat de betrokken UI ze nodig
heeft.

## Wat níét mechanisch bewaakt wordt

Er is — anders dan bij IFC-round-trip of de MCP-toolregistry — **geen compile- of testpoort** die
afdwingt dat een nieuwe `UIState`-veld ook een `SETTINGS`-descriptor krijgt, of dat een descriptor ook
daadwerkelijk op de drie UI-plekken verschijnt. Concreet onbewaakt:

- Een `UIState`-veld zonder descriptor compileert prima; hij persisteert dan gewoon niet (reset elke
  sessie naar zijn store-default). Niets waarschuwt hierover.
- Een descriptor zonder UI in `SettingsPanelContent` compileert en laadt prima; de instelling is dan
  alleen via de devtools/store te zetten, nooit door een gebruiker.
- De `key`/`field`-koppeling wordt niet tegen dubbel gebruik gecontroleerd — twee descriptors met
  hetzelfde `field` overschrijven elkaars gelezen waarde in stilte (de lus schrijft `patch[d.field]`,
  dus de botsing zit op `field`, niet op `key`; laatste wint in de `for`-lus).

Dit is dus mensenwerk: controleer bij een review of de descriptor, de `saveX`-aanroep vanuit de UI, en
de zichtbare UI in `SettingsPanelContent` alle drie aanwezig zijn.

## Waar het echt staat

| onderwerp | bestand |
|---|---|
| descriptor-register + `loadAllSettings()` + de drie afwijkers | `src/utils/settingsRegistry.ts` |
| `saveX`-functies, localStorage-sleutels, klem-constanten | `src/utils/settingsStore.ts` |
| gedeelde UI (alle drie de plekken) | `src/components/settings/SettingsPanelContent.tsx` |
| tandwiel-popup | `src/components/layout/TitleBar/TitleBar.tsx` |
| Instellingen-ribbontab | `src/components/layout/Ribbon/ribbonConfig.tsx` (`instellingenTab`) |
| Backstage → Instellingen | `src/components/backstage/Backstage.tsx` |
| `UIState`-typedefinitie | `src/state/slices/types.ts` |

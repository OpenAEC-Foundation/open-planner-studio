# Plan: UI-vertalingen elke nacht, alleen voor werk dat af is

Besluit Ethan, 2026-11-16 (vault: *vertalingen elke nacht*). Voorstel met vier Sol-rondes: vault-bijlage
*voorstel vertalingen elke nacht*. Dit plan maakt het voorstel concreet op de code en voegt de grens van
Ethan toe: "doe het wel alleen voor werk wat af is, we hebben er niet veel aan als teksten nog niet
definitief zijn". De geplande taak zelf maakt wrakko na de merge; deze PR levert code, opdrachten en de
letterlijke taaktekst.

## 1. Wanneer is een tekst "af"?

De nacht vertaalt een UI-eenheid (sleutel, of een meervoudsfamilie als één eenheid) alleen als alle
drie de voorwaarden gelden. De rest blijft voor de release, die zoals nu alles vertaalt
(`verify:translations` eist elke sleutel).

1. **Open in die taal**: hij valt in de gewone selectie `--missing` of `--stale` (inclusief "zonder
   hash"), precies zoals nu (`selectUnits`, `scripts/translate/ui.ts:92`).
2. **Rustig op main**: de nl-tekst is minstens 48 uur ongewijzigd op `origin/main`.
3. **Niet van een flag**: de sleutel hoort niet bij een functie achter een feature flag (of in
   Experimenteel).

### 1a. Rustig op main: 48 uur ongewijzigd

Mechaniek, op de commit waar de nacht `prepare` draait:

- `T = nu − 48 uur`. Basis = `git rev-list -1 --first-parent --before=T origin/main`.
- Momentopnames: de basis plus elke first-parent-commit van `origin/main` na `T` die
  `src/i18n/locales/nl/` raakt (`git log --first-parent --since=T -- src/i18n/locales/nl`). Per
  momentopname lees je de vier nl-bestanden met `git show <sha>:<pad>`.
- Een eenheid is rustig als ze in de basis bestaat en haar `hashUnit` (`scripts/translate/common.ts`)
  in elke momentopname gelijk is aan de huidige. Een nieuwe sleutel binnen 48 uur, een gewijzigde, of
  een die heen en terug veranderde, valt dus af.
- Alleen nl telt: de bron-hash in `i18n/ui-sources/` en de `stale`-toets gebruiken ook alleen nl.
  Een wijziging alleen in `en` maakt geen vertaling verouderd.
- De tijd is de committijd van de merge op main (first-parent). Wat er binnen een PR veranderde,
  telt niet: pas de merge maakt een tekst "af".

Waarom 48 uur, gemeten op main (laatste 120 dagen, 226 first-parent-commits die nl raakten,
2.735 keer dat een nl-eenheid ontstond of veranderde; script in de PR-beschrijving):

| opnieuw veranderd binnen | aantal | deel |
|---|---|---|
| 1 dag | 18 | 0,7 % |
| 2 dagen | 22 | 0,8 % |
| 7 dagen | 35 | 1,3 % |
| 14 dagen | 58 | 2,1 % |

Na de merge verandert een tekst zelden nog. Twee dagen vangen het grootste deel van de snelle
nacorrecties (22 van de 35 binnen een week). Een week wachten heeft geen zin: de release van
maandag vertaalt dan alles al eerder, en de nacht doet niets meer. Met 48 uur gaat werk dat dinsdag
tot en met donderdag 01:00 op main komt nog vóór maandag de nacht door; werk van later gaat naar de
release.

### 1b. Hoort de sleutel bij een flag of bij Experimenteel?

**Statisch herkennen kan niet betrouwbaar.** Voorbeelden uit de huidige code:

- De flag `ifcForeignContent` (`src/utils/featureFlags.ts:22-27`) zet een gedrag aan in de store en
  de diensten, niet in een component met eigen teksten. De meldingen staan in
  `src/state/ifcForeignGuard.ts:89` en `:110` als `messageKey`, verspreid over
  `common:notifications.*` (`src/i18n/locales/nl/common.json:78-85`, `:355-367`),
  `common:ifcExportWithoutModel.*` (`:1967-1970`), `common:ifcMissingSourceSaveAs.body` (`:1956`)
  en `menu:projectInfo.ifcSchema.foreignLocked` (`menu.json:288`). Geen gedeeld voorvoegsel.
- 184 `t(...)`-aanroepen bouwen de sleutel met een template (bijv. `t(\`constraintType.${ct}\`)`,
  `src/components/task-sections/TaskConstraintFields.tsx:59`) en 33 geven een variabele door.
  Welke sleutel achter welke flag zit, volgt dan niet uit de code.
- Een bestand dat `isFeatureEnabled` leest, kan ook teksten tonen die altijd zichtbaar zijn.

**Daarom: de flag meldt zijn teksten zelf aan.** `FeatureFlag` krijgt een verplicht veld
`texts: readonly string[]` met `ns:pad` of een voorvoegsel `ns:pad.*`. `nameKey` en
`descriptionKey` tellen automatisch mee. Voorbeeld voor `ifcForeignContent`:
`common:notifications.ifcForeign*`-sleutels één voor één, `common:ifcExportWithoutModel.*`,
`common:ifcMissingSourceSaveAs.*`, `menu:projectInfo.ifcSchema.foreignLocked`, plus de overige #804-sleutels
die de bouw uit de #804-PR's haalt (git log van nl op commits met `#804`; zie stap 2).

Controles op die lijst (in de test, op de echte `FEATURE_FLAGS`):
- elk item wijst naar minstens één bestaande nl-eenheid (een verouderde lijst valt op);
- een flag zonder `texts` mag niet, ook geen lege lijst zonder reden (`texts: []` alleen met een
  opmerking dat de flag geen eigen tekst heeft).

**Wat niet betrouwbaar te herkennen is, eerlijk:**
- **Volledigheid van `texts`.** Vergeet een ontwikkelaar een sleutel, dan vertaalt de nacht hem.
  Schade: één vertaling van een tekst die gebruikers niet zien (de flag staat uit) en die bij een
  latere wijziging opnieuw wordt vertaald. Geen verkeerde tekst voor planners. AGENTS.md krijgt de
  regel erbij (Conventions → Feature flags).
- **Teksten die na meer dan 48 uur nog veranderen** (13 van de 35 binnen een week, gemeten). Die worden
  verouderd en de nacht of de release vertaalt ze opnieuw. Kosten, geen fout voor de gebruiker.
- **Experimenteel buiten de flags.** Het verborgen blok Experimenteel toont precies `FEATURE_FLAGS`
  (`src/components/settings/SettingsPanelContent.tsx:88`, `:582-606`), dus dat is gedekt. Daarnaast
  hebben de exportformaten P6 XML en XER een zichtbaar label "Experimenteel"
  (`src/services/formatRegistry.ts:368-369`, `menu:export.experimentalBadge`). Die staan niet achter
  een flag en planners zien ze. **Voorstel: de nacht vertaalt ze wel**, want ze zijn zichtbaar en hun
  teksten veranderen niet vaker dan andere. Dit is een productkeuze: ik leg hem voor aan wrakko.
- De kop van het blok zelf (`common:settings.experimentalSection`, `…Empty`, `…Hide`) is vaste UI en
  gaat wel mee.

## 2. Wat er in de code verandert

1. **`scripts/translate/settled.ts`** (nieuw, puur): `settledUnits({ current, snapshots, flagTexts })`
   → per namespace de rustige eenheid-sleutels, plus `flagKeys(flags, nlByNs)` die de `texts`
   (met `*`) tegen nl oplost en fouten geeft voor een item zonder treffer.
2. **CLI** (`scripts/translate/cli.ts`):
   - `translate settled [--min-age-hours 48] [--ref origin/main] --out <bestand>`: doet de git-I/O
     van §1a, leest `FEATURE_FLAGS`, schrijft een JSON-lijst `["ns:pad", …]` (zelfde vorm als
     `--keys`) en meldt per reden hoeveel eenheden afvielen (nieuw/gewijzigd, flag).
   - `prepare ui <taal> --open --only <bestand>`: nieuwe selectie `open` = `missing` ∪ `stale`
     (`selectUnits`), beperkt tot de lijst. Ontbrekende items krijgen geen `previous`, verouderde wel,
     precies zoals in de twee aparte rondes nu. Eén ronde is nodig omdat `prepare` alle open
     `ui-*`-pakketten van een taal archiveert (`archive(dir, 'ui-')`, `scripts/translate/cli.ts`), en
     een tweede ronde na `apply` de nacht dubbel aan een verschuivende main zou blootstellen. De
     pakketwaarde `mode` leest geen enkele poort (alleen `selectUnits` en het CLI-label), dus een
     gemengd pakket verandert niets aan check of apply. `--only` mag ook met `--missing` en `--stale`.
   - `packages ui <talen> --bundle <maxTekens>`: per taal de open pakketten in bundels tot het
     maximum (standaard 60.000 tekens pakkettekst), als `[[taal, [id, …]], …]`. Zonder `--bundle`
     blijft de uitvoer zoals nu.
   - `translate night-paths`: leest `git diff --name-only <basis>...HEAD` en faalt als er iets anders
     verandert dan `src/i18n/locales/<taal>/*.json` en `i18n/ui-sources/<taal>.json` voor de 26
     vertaaltalen (geen `nl`, geen `en`).
3. **`src/utils/featureFlags.ts`**: veld `texts` op `FeatureFlag`, ingevuld voor beide flags.
4. **Opdrachten** (`scripts/translate/prompts/`):
   - `ui.md`: van "ONE package" naar "the packages in `{{PACKAGES}}`" (één of meer, zelfde taal). Per
     pakket eigen uitvoer `<pakket>.out.json` naast het pakket, eigen check, maximaal drie runs per
     pakket. Lezen alleen de genoemde pakketten. Eindregel per pakket `GROEN`/`ROOD`. Met één pakket
     werkt hij zoals nu, dus `stations.js` en de release blijven ongewijzigd werken.
   - `ui-review.md`: "one or two" wordt "the listed packages"; het reviewbestand heeft al een veld
     `package`.
   - `ui-fix.md`: zelfde lijstvorm; herstelt alleen de pakketten met bevindingen.
   - `ui-termfix.md` blijft één pakket (alleen de release gebruikt `--avoid`).
5. **Skill `nachtvertalingen`** (nieuw, `.claude/skills/nachtvertalingen/`): `SKILL.md` met de stappen
   van §3 en `scheduled-job.md` met host, schema en letterlijke taaktekst (zoals de release). De
   stations volgen `update-ui-lang/t3-stations.md`, dat een bundelvariant krijgt: één vertaal-, één
   naleesdelegatie per bundel, herstel alleen voor de pakketten met bevindingen.
6. **Besluit 9**: `release/referentie.md` krijgt een kopje voor de nachttaak met dezelfde lichte
   vertaalscripts plus `translate settled` en `translate night-paths`, in de eigen nachtworktree.
   AGENTS.md (alinea over de releasejob) noemt de nachttaak ernaast.
7. **Release**: `release/SKILL.md` stap vertalen: wacht eerst tot de nacht van maandag klaar is (§3,
   markering) en vertaal dan wat er nog ligt, zoals nu.
8. **AGENTS.md** Conventions → Feature flags: "list the flag's own UI texts in `texts`".
9. **Tests** (`tests/planning/check-translate-settled.ts`, plus `expected-checks.txt`):
   - nieuwe sleutel binnen 48 uur valt af; precies op de grens; gewijzigd en terug valt af;
     meervoudsfamilie waarvan één vorm veranderde valt af; alleen `en` gewijzigd blijft rustig;
   - flag-items: exacte sleutel, `*`-voorvoegsel, `nameKey`/`descriptionKey`, item zonder treffer is
     een fout; de echte `FEATURE_FLAGS` lossen allemaal op;
   - `--open` = ontbrekend ∪ verouderd met `previous` alleen bij verouderd; `--only` snijdt elke selectie;
   - bundelen respecteert het maximum en splitst nooit een pakket;
   - `night-paths` weigert `nl`, `en`, code en andere paden;
   - mutatiebewijs: drie mutaties in `settled.ts` (48 uur-grens, momentopnames tussendoor overslaan,
     flag-uitsluiting weglaten) maken de check rood; uitgevoerd met een kopie in `/tmp`, uitkomst in
     de PR.

## 3. De nachttaak

- **Wanneer**: maandag tot en met zaterdag 01:00, Europe/Amsterdam (`weekdays [1..6]`). Er is geen
  "sinds gisteren": elke nacht vertaalt alles wat open én af is. Zo neemt maandag het weekend vanzelf
  mee, en haalt een mislukte nacht zichzelf in.
- **Uitvoerder en host**: zoals de releasejob (aia09-mp50, T3, keuze model door wrakko). Haiku 5.5 voor
  de stations, hoogstens twee tegelijk bij drukte.
- **Markering**: bij de start schrijft de taak `~/.local/state/ops-nachtvertalingen/actief` met
  starttijd; aan het eind weg. Bestaat hij al en is hij jonger dan 24 uur: deze nacht slaat over.
  Ouder: melding aan wrakko, en doorgaan.

Stappen:

1. **Werkplek.** `git fetch origin`; nieuwe worktree, losgekoppeld, op `origin/main`
   (`git worktree add --detach <pad> origin/main`). Nooit een vorige nachtbranch hervatten.
   Eenmaal `npm ci` (besluit 9). Noteer `BASE=$(git rev-parse HEAD)`.
2. **Wat is af.** `npm run translate -- settled --out build/translate/settled.json`.
3. **Wat staat open.** `npm run translate -- status`; talen met ontbrekend en met verouderd/zonder hash.
4. **Pakketten.** Per taal met iets open: `prepare ui <taal> --open --only build/translate/settled.json`.
   Leeg in alle talen: klaar zonder PR (rapport "niets af en open").
5. **Stations.** `packages ui <talen> --bundle 60000` → per bundel vertalen, nalezen, zo nodig
   herstellen (t3-stations, bundelvariant). Een naleesrun telt pas als de taak het reviewbestand zelf
   las en het een geldige JSON-lijst is. Alle gevolgde bestanden, pakketten, zegel en checker blijven
   ongewijzigd (`git status --short` en de zegel voor en na); een run die daarbuiten schrijft telt niet
   en draait opnieuw. `OPEN_STATIONS` moet 0 zijn vóór de volgende stap.
6. **Verse main.** `git fetch origin`. Is `package-lock.json` veranderd tussen `BASE` en de nieuwe
   `origin/main`: deze nacht vervalt (geen tweede `npm ci`). Anders
   `git switch -c vertalingen/JJJJ-MM-DD origin/main` (de werkboom is schoon; `build/` is gitignored
   en blijft staan).
7. **Toepassen.** Per taal `apply ui <taal>`. Een pakket met een intussen veranderde nl-tekst wordt
   rood en gaat niet mee (`packageMismatch`, `scripts/translate/apply.ts:56`).
8. **Rood na apply** (vertaalfout of niet meer passend): blijft liggen voor de volgende nacht of de
   release; geen tweede ronde in dezelfde nacht. Staat in de PR-tekst.
9. **Poorten.** `npm run verify:i18n` (exit 0), `npm run translate -- night-paths`, `git status -sb`.
   Commit alleen `src/i18n/locales` en `i18n/ui-sources` met noreply-adres. Push
   `vertalingen/JJJJ-MM-DD`, PR "UI-vertalingen JJJJ-MM-DD" (niet draft) met per taal de aantallen,
   rode/open pakketten en de uitgesloten aantallen (flag, te nieuw).
10. **Merge.** Wacht in de voorgrond op CI van de PR-head. Groen: `git fetch origin`; is
    `origin/main` nog gelijk aan de basis van de branch, dan
    `gh pr merge <nr> --merge --admin --match-head-commit <head-sha>`. Is main verder: PR dicht met
    een korte reden, de poging vervalt. Rood: geen herstel, PR dicht, melding in het rapport.
11. **Eind.** Markering weg, worktree weg (`git worktree remove`). Twee vervallen of mislukte nachten op
    rij: melding aan wrakko.

`--match-head-commit` beschermt alleen de head van de PR; de vergelijking met `origin/main` in stap 10
dekt dat main niet verder is. Het gat van seconden daartussen blijft, zoals het voorstel zegt: een
tekst die daar verandert, staat daarna als verouderd en de volgende nacht of de release vertaalt hem.

## 4. Wat er aan de vertaalopdracht verandert

Nu: één delegatie per pakket per station; op 16 november 130 pakketten, dus 130 vertaal- en 130
naleesruns. Straks in de nacht: per taal één ronde (ontbrekend en verouderd samen) en meestal één bundel (meestal) met al zijn pakketten,
dus per taal één vertaal- en één naleesrun, plus herstel. De pakketten zelf (namespace, 150 items,
24.000 tekens) en de check per pakket blijven gelijk, zodat `apply` en de rode-pakketroute niet
veranderen. Een bundel heeft een grens van 60.000 tekens pakkettekst; daarboven twee bundels.
De release mag de bundels ook gebruiken, maar dat verandert deze PR niet in zijn stappen (de release
houdt zijn eigen keuze; de opdrachten werken met één pakket zoals nu).

## 5. Wat niet in deze PR zit

- De geplande taak zelf (wrakko, na de merge).
- Een andere grens dan 48 uur of een andere keuze over P6/XER: na de eerste weken meten.
- Docs-vertalingen: blijven op verzoek (`update-docs-lang`).

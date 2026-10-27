# F1b: herstel na reviewronde 1

Gecontroleerde beginstand: `a9cab7a66203bdaba52d67b460b086767d3160d0`, op
`claude/uren-f1b-urenfouten`. Daarna is `origin/claude/uren-integratie` zonder conflicten
gemerged, met mergecommit `e1759a076`. Geen rebase of force-push. De bestaande
`node_modules` is behouden; `i18n:resolve` vond geen resterend verschil per sleutel.
De code en regressies staan in commit `e3d84be06d8fd6152160fe494d79bc365faf5945`.
De gerichte checks hieronder draaiden met Node 22.23.4 en npm 10.9.9.

## De vier oorzaken en correcties

1. Het einde bij 100% werd eerst als een datum zonder tijd afgeleid. De volgordecorrectie
   schoof een vastgelegde start om 10:00 daardoor terug naar middernacht. In
   `taskMutationRules.ts` krijgt het afgeleide einde nu D6 vóór die vergelijking. Ook de
   afleiding van een ontbrekende start vergelijkt de geldige momenten. Een aanwezige
   werkelijke start blijft staan; de algemene normalisatie achteraf is verwijderd.
   Paneel, dialoog met Opslaan, raster, plakken, voortgangsimport en MCP bewaren nu
   `2026-06-03T10:00` en leiden `2026-06-03T16:00` af.

2. De twee FS-takken in `relationMath.ts` rondden ieder niet-werkend moment achteruit af.
   Terugzetten mag nu alleen op een reeds geldig eindmoment of op dezelfde blokgrens:
   het vorige blokeinde moet precies naar het afgeleide blokbegin terugleiden en de
   lagkalender mag daartussen geen werktijd hebben. Onder OPS, P6 en MS Project geldt:
   A eindigt maandag 6 juli 16:00; FS +2 uur kalendertijd landt dinsdag 08:00 met
   speling 0 voor A. FS +8 uur werktijd blijft dinsdag 16:00 en FS +3 dagen
   kalendertijd blijft donderdag 16:00. Een negatieve werktijdlag naar een afwijkende
   opvolgerkalender met vrije dinsdag wordt niet meer naar maandag 17:00 teruggetrokken.

3. De statuskolom sloeg de afzonderlijk toegevoegde normalisatie over. Het raster handelt
   status, percentage, werkelijke duur en restduur nu af bij hetzelfde bestaande
   invariantpunt. De herhaalde normalisatie per tak is verwijderd. Invoer, plakken van
   één cel en plakken samen met een naam leveren dezelfde actuals op.

4. Normalisatie kende de mijlpaalsoort, maar de validatie van `actualStart` koos steeds
   de startkant. Eén functie, `actualDateSide`, bepaalt nu de kant voor zowel
   normalisatie als validatie in paneel, dialoog, raster en MCP. Op een nulduur-FINISH-
   mijlpaal worden beide actuals van woensdag bij 22:00–06:00 donderdag 06:00, en bij
   00:00–24:00 donderdag 00:00. MCP en plakken van beide velden accepteren die feiten.
   Ook de paneelroute, de dialoog met Opslaan en de losse dialoogfuncties zijn getoetst.

## Nulmeting en mutatiebewijs

Dezelfde nieuwe `check-hours-f1-review.ts` is op een tijdelijke, losgekoppelde checkout
van exact `a9cab7a66` uitgevoerd: **120 controles, 37 fouten, exit 1**. Na de correcties:
**120 controles, 0 fouten, exit 0**. De startpunten zijn de tegenproeven uit
`/tmp/review563-r1/contraproeven.log`; de verwachtingen zijn uit de beschreven werkblokken
afgeleid. Geen bestaande caseverwachting is voor deze fixronde veranderd.

Elke mutatie kopieerde eerst het correcte bronbestand naar `/tmp/fix563-r1`, maakte daar
een versie met de oude regel, kopieerde die naar het bronbestand en draaide uitsluitend
`bash tests/planning/run.sh check-hours-f1-review.ts`. Daarna is het correcte bestand met
`cp` teruggezet en byte voor byte met de kopie vergeleken. Geen stash, reset of checkout
gebruikt voor herstel. De volledige uitkomsten en hashes staan in
[review-ronde-1-mutaties.json](review-ronde-1-mutaties.json).

| Teruggezette regel | Exit | Rode controles |
| --- | --- | --- |
| Afgeleid einde vóór D6 | 1 | 24 |
| Onvoorwaardelijke FS-snap, kalendertijd | 1 | 6 |
| Onvoorwaardelijke FS-snap, werktijd | 1 | 3 |
| Status slaat D6 over, enkele cel | 1 | 2 |
| Status slaat D6 over, meerdere cellen | 1 | 1 |
| MCP valideert actualStart aan de startkant | 1 | 4 |
| Raster/plakken valideert actualStart aan de startkant | 1 | 4 |
| Paneel/dialoogplan valideert actualStart aan de startkant | 1 | 4 |
| Losse dialoogvelden valideren actualStart aan de startkant | 1 | 8 |

Na alle negen herstellingen slaagt dezelfde batterij weer met exit 0.

## Gerichte controles

Alle onderstaande controles hebben exit 0:

- `npm run typecheck` en `npm run lint`.
- De acht casebatterijen `hours`, `hours-blokgrenzen`, `hours-relations`,
  `msp-pariteit`, `progress`, `lag-advanced`, `milestone-kinds` en `milestones`.
- `check-hours-f1-review.ts`, `check-hours-f1-status.ts`, `check-auto-actual-start.ts`,
  `check-progress-entry.ts`, `check-task-dialog-save.ts` en `check-task-slice.ts`.
- `check-task-grid-editors.ts`, `check-task-cell-editor.ts`,
  `check-statusdatum-tijd.ts` en `check-statusdatum-lijn.ts`.
- Alle vier bestaande `check-progress-import*`-batterijen: de hoofdcheck, CSV, XLSX en ronde.
- `check-recovery-integrity.ts`, `check-recovery-content.ts`, `check-summary-actuals.ts`,
  `check-remaining-duration.ts` en `check-import-progress-default.ts`.
- `task-dialog-save.spec.ts`: 3/3, 33,9 s. De bestaande route is uitgebreid met echte
  schuifbediening in paneel en dialoog, gevolgd door Opslaan. Beide taken bewaren de
  start om 10:00 en krijgen einde 16:00. De afbeelding in `qa/uren-f1b-status.png` is
  bekeken; de exacte tijden zijn via de opgeslagen taakstate gecontroleerd.
- `progress-entry.spec.ts`: 6/6, 41,3 s, inclusief startvraag, annuleren, bevestigen en undo.

Een aanvankelijke extra aanroep gebruikte de niet-bestaande naam
`check-task-grid-edit-plan.ts` en gaf exit 1 wegens een onbekend argument. De bestaande
rasterbatterijen hierboven zijn daarna uitgevoerd en slagen. De eerste nieuwe kalenderprobe
had een onjuist gevormde feestdag; die is vóór de vastgelegde nulmeting gecorrigeerd naar
een `Holiday` met begin- en einddatum. De profielprobes gebruiken expliciet `baseId`.

De herstelverwachting 07:00/16:30 is niet gewijzigd, ook niet door F1b op `a9cab7a66`.
De kalender en vergelijkingen in `check-recovery-content.ts` zijn inhoudelijk gelijk aan
`12abaabf2`; alleen de integratiemerge verwijderde de vervallen UI-vlag. De herstelcheck
slaagt met 57/57 controles. De expliciete assertie `completion === 1` in
`check-auto-actual-start.ts` is teruggezet.

## Open na F1

- `mk-05a` M2 blijft open; de bredere startmijlpaalcorrectie is in deze ronde niet uitgevoerd.
- Knownbug 146 blijft een conventievraag.
- De al vermelde punten 155/204, 187/205 en 206/207 blijven buiten deze fixronde.

De volledige planningssuite, tijdzone-matrix, volledige `npm run verify`, nieuwe
profielmetingen met corpora en een Tauri-build zijn in deze ronde niet lokaal uitgevoerd.
CI wordt door de orkestrator bewaakt; deze uitvoerder wacht daar niet op.

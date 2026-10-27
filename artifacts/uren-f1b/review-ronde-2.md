# F1b: herstel na reviewronde 2

Begincommit gecontroleerd: `07030f40517f01c081619141252663b3326c1895`, op
`claude/uren-f1b-urenfouten`, met een schone werkboom. De integratiebranch is niet opnieuw
gemerged. De bestaande `node_modules` is behouden. Node 22.23.4 en npm 10.9.9 zijn gemeten;
de gerichte controles draaiden achtereenvolgens. De productcorrecties staan in
`08057ddc7234cd724d0492cdb53505791181007d`, tussentijds fast-forward gepusht.

## Oorzaken en correcties

1. **Vastgelegde start na het afgeleide einde.** De gedeelde volgordecorrectie schoof bij
   iedere aanwezige statusdatum de start terug, zonder onderscheid tussen een ingevoerd
   feit en een ontbrekende start. `actualDatesOrder.ts:20` mag dat nu alleen als
   `startWasDerived` waar is. `taskMutationRules.ts:165`, `importNormalize.ts:88` en
   `xerReader.ts:980` bepalen dat vóór ze een ontbrekende start invullen. Bij een aanwezige
   start schuift uitsluitend het afgeleide einde mee.

   D1 en D6 bepalen de omzetting van datums zonder tijd, maar beslissen het geval van een
   vastgelegde start om 18:00 na het blokeinde niet. Daarom is de expliciet opgegeven regel
   toegepast: **het afgeleide einde valt nooit vóór een vastgelegde start en wordt zo nodig
   gelijk aan die start**, zonder weigering of foutmelding. De uitkomst is dan start =
   einde = 18:00, voltooid. Een ontbrekende, automatisch afgeleide start kan nog steeds
   terug naar het einde; de bestaande 135 auto-startcontroles blijven groen.

   Alle zeven routes zijn getoetst: paneel, dialoog → Opslaan, rasterpercentage,
   statuskolom, plakken, voortgangsimport en MCP. Per route: woensdag 18:00, zaterdag
   18:00, en woensdag 18:00 met een eigen taakkalender 09:00–17:00 naast de
   projectkalender 08:00–16:00. De eerdere 10:00 → 16:00-gevallen blijven groen. Een
   aanvullende lezercontrole bewaakt het verschil tussen een aanwezige en ontbrekende start.

2. **Kalendertijdlag precies op een blokbegin.** In de ELAPSEDTIME-arm werd een blokbegin
   als gelijkwaardig aan het vorige blokeinde beschouwd als er nul werkminuten tussen
   lagen. Voor de klok telt de nacht wel mee. `relationMath.ts:695` bewaart nu alleen een
   al geldig eindmoment en trekt een latere kloktijdgrens niet terug. De WORKTIME-arm is
   ongewijzigd.

   Onder OPS, P6 en MSP: A eindigt maandag 6 juli 16:00; FS +16 uur kalendertijd geeft
   de FINISH-mijlpaal dinsdag 08:00 en A krijgt speling 0. Ook +2 uur → dinsdag 08:00,
   +24 uur → dinsdag 16:00 en +72 uur → donderdag 16:00 zijn groen, telkens met speling
   0. De nul-laggevallen, +8 uur werktijd en de negatieve werktijdlag met afwijkende
   opvolgerkalender blijven groen. De bestaande N1- en blokgrensverwachtingen zijn niet veranderd.

3. **DCMA en de kant van een mijlpaal.** `dcmaAssessment.ts:385` gebruikte voor de
   werkelijke start altijd de startkant. Beide actuals gebruiken nu `actualDateSide`.
   De bestaande vijf invoerroutes krijgen elk een gerichte rapportassertie voor zowel
   22:00–06:00 als 00:00–24:00: geen onterechte `actualStartAfterStatusDate`.

## Bewijs op de begincommit en met mutaties

De uitgebreide `check-hours-f1-review.ts` is eerst uitgevoerd met de productcode van exact
`07030f405`: **316 controles, 59 fouten, exit 1**. Daarna: **316 controles, 0 fouten,
exit 0**. De bestaande 120 controles zijn uitgebreid; geen caseverwachtingen zijn aangepast.

| Tijdelijk teruggezette fout | Rode controles | Exit mutatie | Exit na cp-herstel |
| --- | --- | --- | --- |
| Bij iedere statusdatum de start terugzetten | 43 | 1 | 0 |
| De werkminutenequivalentie in de kalendertijdarm terugzetten | 6 | 1 | 0 |

Per mutatie is het goede bronbestand eerst naar `/tmp/uren-f1b-r2/` gekopieerd, de regel
gewijzigd en uitsluitend de reviewbatterij gedraaid. Daarna is de goede kopie met `cp`
teruggezet en dezelfde batterij opnieuw gedraaid. `cmp` en SHA-256 bevestigen het herstel.
[De afzonderlijke foutregels, exitcodes en bronhashes staan in het mutatiebewijs](review-ronde-2-mutaties.json).
Er is geen stash, reset of checkout voor herstel gebruikt.

## Stond punt 1 al op de basis?

**Ja, op de oorspronkelijke F1b-integratiebasis `12abaabf2`.** Een aparte tijdelijke
bronkopie via `git archive` draaide een gerichte controle met dezelfde 08:00–16:00-kalender,
statusdatum 3 juni en de echte paneelsetters. De startsetter accepteerde 18:00; daarna
overschreef 100% de start met `2026-06-03` zonder tijd. De controle die behoud verlangt
heeft exit 1. Dit is dus geen nieuw verlies van een start dat door deze F1b-PR is ingevoerd.
De ruwe voor- en nawaarden staan eveneens in het mutatiebewijs.

## Definitieve gerichte controles

Alle onderstaande controles hebben exit 0:

- Acht casebatterijen, samen 279/279: `hours` (31), `hours-blokgrenzen` (48),
  `hours-relations` (36), `msp-pariteit` (65), `progress` (33), `lag-advanced` (23),
  `milestone-kinds` (26) en `milestones` (17).
- `check-hours-f1-review.ts`: 316/316; `check-hours-f1-status.ts`: 114/114;
  `check-auto-actual-start.ts`: 135/135.
- `check-statusdatum-lijn.ts`, `check-statusdatum-tijd.ts` (34), `check-progress-entry.ts`
  (78), `check-task-dialog-save.ts` (30) en `check-task-slice.ts` (56).
- Alle vier `check-progress-import*.ts`-batterijen: 97, 43, 129 en 80 controles.
- `check-import-progress-default.ts` (49), `check-xer-progress.ts` (12),
  `check-xer-status-afleiden.ts` (34) en `check-dcma.ts` (41).
- `npm run typecheck`, ook opnieuw na de laatste browseraanpassing; `npm run lint`.
- `node scripts/run-browser-tests.mjs tests/browser/progress-entry.spec.ts`:
  6/6, 43,6 s.
- `node scripts/run-browser-tests.mjs tests/browser/task-dialog-save.spec.ts`:
  3/3, 36,7 s. De bestaande route bevat zowel 10:00 als 18:00, paneel en dialoog met
  Opslaan, en behoud na herberekenen.

De browserpoort was 3123. De serverwerkmap is via het luisterende proces gecontroleerd:
`/home/aia09/projects/open-planner-studio/.claude/worktrees/uren-f1b`.
De geserveerde `actualDatesOrder.ts` gaf HTTP 200 en bevatte de nieuwe `startWasDerived`-voorwaarde.
[Het nagekeken schermbewijs na de 18:00-route](review-ronde-2.png) toont 100% en nul
restduur. De exacte tijden zijn met de storeasserties gecontroleerd; de zichtbare datumvelden
in deze schermstand tonen alleen de datum.

De browseruitbreiding had aanvankelijk twee rode uitvoeringen (beide 2/3 geslaagd).
De eerste klikte na de fixturewissel op verouderde balkcoördinaten; de tweede gebruikte
een rasterdubbelklik die de celbewerker opent. De uitbreiding selecteert nu de vaste
rasterrij en opent de dialoog via het bestaande contextmenu Bewerken. De geteste
handelingen blijven echte klikken en toetsen; de brug zet alleen fixtures en leest staat.
Dit vroeg geen verdere productwijziging en er is geen nieuwe knownbug genummerd.

De volledige planningssuite, de tijdzone-matrix, `npm run verify`, corpus-/profielmetingen,
de overige browserspecs en een Tauri-build zijn in deze ronde niet uitgevoerd. De volledige
poort blijft bij PR-CI; er is geen CI-bewaking gestart. De conceptstatus en basisbranch
blijven behouden. Bestanden van F3a en F3b zijn niet aangeraakt. De eerder vastgelegde open
F1-vervolgpunten blijven buiten deze ronde; er zijn geen nieuwe productbijvondsten vastgesteld.

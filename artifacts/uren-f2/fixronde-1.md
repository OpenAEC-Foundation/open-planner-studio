# F2 — fixronde 1, motor, 23 oktober 2026

De drie blokkerende bevindingen uit reviewronde 1A zijn hersteld. Het gemelde nachtpad
wordt door dezelfde eindwerkdagcorrectie vanzelf geldig. De afzonderlijke regressies en
de oorspronkelijke reviewerprobe geven na herstel exit 0. De volledige CI is niet als
groen vastgesteld; de orkestrator bewaakt die. Deze notitie is opgesteld door een AI-assistent.

## Begintoestand en afbakening

De werkplek is `/home/aia09/projects/open-planner-studio/.claude/worktrees/uren-f2`,
branch `claude/uren-f2-kern`. Stap 0 gaf precies
`b177689407608a59368d53a4db76ae93198a7204` en een schone werkboom.
De integratiebasis `be58ba356` is niet opnieuw gemerged. De bestaande map
`node_modules` is behouden. Alle Node-controles gebruiken de gemeten versie
22.23.4; de expliciet gevraagde lokale runs volgen de opdracht en apparaatafspraken.
De oudere algemene serverbeperking in het lokale `AGENTS.md` is daarmee voor deze
opdracht uitdrukkelijk overschreven. De zware runs liepen na elkaar in de voorgrond.

De vier F1-regels in het voltooidvenster zijn letterlijk en precies eenmaal behouden;
dat is afzonderlijk tegen de beginstand gecontroleerd. Laden, migratie, B5, IFC en de
rekenroutes zijn niet inhoudelijk gewijzigd. In `recordedDates.ts` is uitsluitend het
ongebruikte fabriekargument verwijderd. Er zijn geen F3-lopers ingevoerd.

## Oorzaken en herstel

1. **Losse START-mijlpaal (B6).** De vroege pass zet de losse mijlpaal in OPS terecht
   op 16:00. De late pass paste de startachtige uitzondering ook op die losse mijlpaal
   toe en trok haar naar 07:00. De uitzondering in `CPMSolver.ts:3633` geldt nu alleen
   voor een START in een keten, of wanneer het profiel B6 uitschakelt. De losse OPS-mijlpaal
   heeft vier gelijke momenten op ma 1 juni 16:00, totale en vrije speling 0.
   P6/MSP blijven op 07:00; de START in een keten blijft startachtig.
2. **Korte werkende uitzondering.** `subDuration` (`CPMSolver.ts:1307`) kopieerde zes klokuren vanaf het
   oorspronkelijke blokbegin naar de doelwerkdag. Daardoor ontstond dinsdag 13:00–11:00.
   De positie wordt nu via bestaande kalenderfuncties in werkminuten overgebracht
   (`CPMSolver.ts:1315`).
   De volgende blokstart vangt een pauzegrens op; past de positie niet in een uitvoerbaar
   venster op de doelwerkdag, dan wordt het eerste blokbegin gekozen. De korte dinsdag
   geeft 07:00–11:00. Een tweede geval met verschoven pauze geeft 16:00–17:00; een
   gewone dag houdt 13:00 als start. Een echte nieuwe voorwaartse berekening vanaf
   iedere gevonden late start reproduceert het bijbehorende late venster.
3. **24-uurskalender.** `subDuration`, `startFromFinish` en `projectDurationOf` gebruikten
   de klokdatum van een eindmoment. De correcties staan in `CPMSolver.ts:1307`/`:1479`
   en `projectDuration.ts:25`. Zij gebruiken nu dezelfde eindzijdige werkdagbepaling
   als de bestaande dagregels. `workdayDateOfInstant` deelt de oorspronkelijke
   implementatie van `workdayOfInstant` (`workdayRules.ts:135`), zonder omzetting van Date naar tekst en terug.
   Eén dag vanaf ma 00:00 eindigt di 00:00, duurt één projectdag en houdt LS ma 00:00;
   twee dagen eindigen wo 00:00, duren twee projectdagen en houden dezelfde LS.
   Dit is getoetst op zowel scalaire als expliciete 24-uurskalenders en met een MFO-eindpin.
4. **Nachtpad.** Dezelfde eindwerkdagbepaling herstelt ook het gemelde nachtvenster:
   ma 22:00–di 06:00 heeft exact datzelfde late venster en speling 0. In de FS+1-keten
   loopt B wo 22:00–do 06:00, eveneens met gelijke vroege en late momenten en speling 0.
   Er is geen afzonderlijke nachtoplossing toegevoegd. **241 is niet aangemaakt**;
   `knownbugs.md` is ongewijzigd.
5. **Opruimen.** `engineForTaskCalendar` heeft geen `task`-parameter of `void task` meer.
   (`CPMSolver.ts:221`). De vier productieaanroepen en drie testaanroepen zijn aangepast, evenals het
   gelijksoortige ongebruikte argument van de interne `engineForCal`-wrapper.

De regressies staan in `tests/planning/check-hours-f2-review.ts` en draaien vanzelf
mee met de bestaande volledige testinventaris. `run.sh` is niet gewijzigd.

## Gewijzigde verwachting

**B3 — herstelde inclusieve projecttelling**, `cases-hours-relations.json`,
`rr-ss-pred-finishms`: projectduur **1 → 2**. De eerste mijlpaal staat di 7 juli 16:00,
de laatste taak eindigt wo 8 juli 12:00. De oude telling gebruikte het verschil in
kloktijd en liet daardoor een werkdag wegvallen. De gedeelde telling gebruikt nu de
werkdagdatums aan beide kanten: dinsdag en woensdag tellen inclusief mee. Alle
ES/EF/LS/LF-momenten, spelingen, kritieke taken en het projecteinde in deze casus
zijn exact behouden. Er is geen vrijstelling of vergelijking versoepeld.

**B3 — dezelfde losse START-grens als punt 1**, tutorialstand `na-tut-1`, `msStart`:
speling **4 → 5**, zowel in `check-tutorial-project.ts:158` als in
`fixtures/minute-model-tutorial-f3.json:7`. De aanvullende tutorialrun vond precies
deze twee fouten (exit 1). De mijlpaal heeft geen relaties en blijft op ma 7 juni
16:00 staan; haar late moment wordt dezelfde eindgrens van de laatste parallelle
werkdag. De startachtige dagbegingrens liet vóór herstel één dag speling wegvallen.
Dit is een correctie van B6 in de referentie, geen wijziging van een B2-doel voor
dagdelen. De 2.423 controles blijven behouden, inclusief het afzonderlijke B2-doel
van **+1 werkdag** bij de eindafwijking van tutorial 6.

Dit zijn de drie gewijzigde bestaande verwachtingsvelden: één projectduur en
hetzelfde tutorialspelingsgetal op twee plaatsen. Er zijn geen nieuwe B1-correcties
of B2-tussenstanden. Het F0-vangnet, de redencodes, de voorbeeldensnapshot en alle
B2-einddoelen blijven ongewijzigd.

## Tegenproef met kopieën

De drie betrokken motorbestanden zijn eerst naar `/tmp/uren-f2-fix1/` gekopieerd.
Daarna zijn uitsluitend `CPMSolver.ts`, `projectDuration.ts` en `workdayRules.ts`
tijdelijk met de gekopieerde bestanden van `b17768940` vervangen. Na de rode proef
zijn ze met `cp` hersteld; `cmp` bevestigt dat alle drie exact de goede inhoud terughebben.
Er is geen stash of destructief Git-herstel gebruikt.

- Nieuwe regressiebatterij met de oude motor: **19/43**, exit **1**.
- Ongewijzigde reviewerprobe `/tmp/review559-r1a/regressies.ts` met de oude motor:
  **7 geschonden voorwaarden**, exit **1**.
- Na herstel: regressiebatterij **43/43** en gezamenlijke F1-controles, exit **0**.
- Dezelfde reviewerprobe na herstel: **0 geschonden voorwaarden**, exit **0**.

De eerdere eerste typecheck vond twee typefouten in de nieuwe testopzet: een
onvolledig profielobject en een te ruim getypeerde tabel met weekdagen. De test
gebruikt nu `builtInProfile` en alle zeven expliciete weekdagen. Dit wijzigde geen
productiegedrag of verwachting. De uiteindelijke typecheck staat hieronder.

## Gerichte verificatie

| Controle | Gezien resultaat | Exitcode |
|---|---|---|
| F2-reviewregressies | 43/43 | 0 |
| Oorspronkelijke reviewerprobe | 0 geschonden voorwaarden | 0 |
| F1-review | 439/439 | 0 |
| Auto-start | 135/135 | 0 |
| F1-status | 114/114 | 0 |
| DCMA | 41/41 | 0 |
| Conventies | 381/381 | 0 |
| Gewone casusbatterijen | 608/608, inclusief acht F1-batterijen 279/279 | 0 |
| F0 run 1 | 422 dagcases: 421 gelijk, één bewust rood B7-doel | 0 |
| F0 run 2 | 422 dagcases: 415 gelijk, vier rood, één bewust gelijk, één bewust rood, één niet omzetbaar; ongewijzigde inventaris | 0 |
| Minutenmodel | 137/137 | 0 |
| Grenzen | 17/17 | 0 |
| B5-overgang | 87/87 | 0 |
| IFC-minutenmodel | 52/52 | 0 |
| Rekenroutes | 34 aanroepen, nul afwijkingen | 0 |
| Voorbeeldensnapshot | 6.090/6.090, 24 voorbeelden; zeven exacte F3-doelen | 0 |
| IFC-ariteit | 50/50 | 0 |
| Oude dagtelling baseline | 21/21 | 0 |
| Projectstartanker | 50/50 | 0 |
| Datum/tijdsubstraat | 68/68 | 0 |
| Tutorialproject | 2.423/2.423, inclusief het B2-doel +1 werkdag | 0 |
| Resourcevoorbeelden | 56/56 | 0 |
| Typecheck, uiteindelijke run | app en scripts/tests | 0 |
| Lint | geen fouten | 0 |
| `verify:examples` | 3 showcases, 20 basisvoorbeelden en 1 extern bronbestand | 0 |
| `verify:conventions` | 115 motorbestanden, 28 conventies, 11 projectopties | 0 |
| `verify:cycles` | 823 modules, geen cyclus | 0 |
| `verify:docs` | 79 artikelen in nl/en | 0 |
| Corpusloze profielvangrail | cel-baseline en X12-eindvangrail | 0 |
| Gezamenlijke profielmeting | P6-regel A behouden; bestaande rode nuldoelen en MSP-afwijkingen, hieronder uitgewerkt | 1 |

De gewone casusruns geven expliciet de 24 `cases-*.json`-bestanden mee, met uitzondering
van de aparte P6-meetlatdata. De acht F1-batterijen zijn onderdeel van deze 608 gevallen:
hours 31, hours-blokgrenzen 48, hours-relations 36, msp-pariteit 65, progress 33,
lag-advanced 23, milestone-kinds 26 en milestones 17, samen 279.

De corpusloze profielvangrail heeft exit 0. De gezamenlijke profielmeting met corpus
heeft **exit 1**, precies wegens de bestaande nuldoelen en MSP-afwijkingen:

- P6: **nieuw 0, verslechterd 0, groter 0**, ook de andere celdelta's 0; 221 bestaande
  inexacte cellen en 76 zesassige nuldoelafwijkingen. Regel A is behouden.
- MSP: 661 bestanden, 2.196 controles, dezelfde drie afwijkingsregels voor
  `timephased-cost-rollup.mpp`: `finishExact` 9 → 6, `finishDiff` 0 → 3 en het bestand
  in de globale verzameling afwijkende bestanden. De meetlat is niet aangepast.

Een extra tegenproef met dezelfde drie motorbestanden op `b17768940` geeft eveneens
exit 1. Beide profielregels en de drie afzonderlijke MSP-afwijkingsregels zijn exact
gelijk aan de herstelde motor. Na terugkopiëren zijn de bronnen met de motorcommit
vergeleken: geen inhoudsverschil.

De volledige profielmeting wordt dus niet als groen gerapporteerd. Alle meetlatbestanden
zijn ongewijzigd. De P6-doorgerekend-sidecarcontrole heeft exit 0.

## Prestatie op 6.978 taken

`check-minute-model-scale.ts` heeft steeds exit 0. De eerste run met de herstelde
motor gaf een mediaan van **939,7 ms** (vijf berekeningen). Omdat er andere agents
op de machine draaien en de review circa 770 ms meldde, is de beginmotor op dezelfde
machine opnieuw gemeten: **1.103,5 ms** mediaan. Direct na herstel gaf de nieuwe
motor **779,4 ms** mediaan (1.016,3; 864,1; 779,4; 711,4; 709,5 ms). Er is in deze
steekproef geen vertraging zichtbaar. Dit is geen geïsoleerde benchmarkmachine;
de drie metingen worden daarom alle drie vermeld. De leesstap bedroeg respectievelijk
10.329,7; 8.389,6 en 8.214,1 ms.

## Opdrachten, logs en overdracht

Alle volledige logs, exitcodes en de scripts `gerichte-controles.sh` en
`mutatiebewijs.sh` en `vergelijk-basis.sh` staan onder `/tmp/uren-f2-fix1/`. De profieldeellogs staan in
`/tmp/ops-measure-profiles-3HZjuW/`. Reproductie gebruikt:

```bash
export PATH="$HOME/.local/bin:$PATH"
export PATH="$HOME/.local/share/fnm/node-versions/v22.23.4/installation/bin:$PATH"
bash tests/planning/run.sh check-hours-f2-review.ts
node scripts/run-ts.mjs /tmp/review559-r1a/regressies.ts
bash /tmp/uren-f2-fix1/gerichte-controles.sh
```

Het gezamenlijke script bewaart iedere echte exitcode; de eerste uitvoering eindigde
met exit 1 wegens de twee inmiddels herstelde typefouten en de bestaande rode
profielmeting. De afzonderlijke uiteindelijke exitcodes zijn leidend.

Niet uitgevoerd: volledige planningssuite, tijdzone-matrix, volledige `npm run verify`,
volledige browser-/bibliotheek-/MCP-/dev-serversuites, nieuw browser- of schermbewijs,
een nieuwe oude-lezer-rondreis of productie-/Tauri-builds. Het bestaande tutorial-B2-doel
van +1 werkdag en de zeven F3-voorbeelddoelen zijn opnieuw getoetst. Alleen de hierboven
benoemde B3-speling van de losse START is in de tutorialreferentie gecorrigeerd.
Er zijn geen andere bijvondsten vastgesteld.

De motorfix is normaal gecommit en gepusht als
`29a2f6cacbebf0df2e00e2ec2884f0a4d1bb1071` (*Herstel late werkdaggrenzen en
projecttelling in F2*). De twee B3-tutorialpins en deze bewijsnotitie volgen in een eigen commit; de uiteindelijke
head staat in de PR-tekst en de overdracht.

PR #559 blijft concept tegen `claude/uren-integratie`. Er is geen CI-bewaking gestart.
De orkestrator krijgt de head-SHA en bewaakt de volledige CI en reviewdeel B.

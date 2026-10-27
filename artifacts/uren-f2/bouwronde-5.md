# F2 — bouwronde 5, 23 oktober 2026

De integratiebranch met de F1-eindversie is normaal gemerged in `claude/uren-f2-kern`.
De gevraagde gerichte controles slagen. De volledige CI is hiermee niet afgetekend;
de orkestrator bewaakt de CI na de laatste push. Deze notitie is opgesteld door een AI-assistent.

## Beginstand en samenvoeging

Werkplek: `/home/aia09/projects/open-planner-studio/.claude/worktrees/uren-f2`.
Stap 0 gaf `cc1889437b44b439e3996bff741d82cec9475c17`, de juiste branch en een schone werkboom.
De bestaande map `node_modules` is behouden. `git fetch origin` gaf integratiehead
`be58ba356c5f193a8003dbb5755dd4d290f380d3`. Die is met
`git merge --no-ff --no-commit origin/claude/uren-integratie` samengevoegd.
Mergecommit: `5f96bfb9a`. Er is niet gerebased en niet geforceerd gepusht.

Er was precies één tekstconflict: `src/engine/scheduler/CPMSolver.ts:2343`, in het
gewone voltooidvenster bij de actual-pin. De F2-keuze om kalendertijd en voltooide
nulduurmijlpalen letterlijk te bewaren blijft staan op regel 2338/2346. Direct daarna
staan de vier F1-regels **letterlijk en eenmaal**, op regel 2347–2350:

```ts
          // Behoud de expliciete eindtijd bij een snap binnen dezelfde dag; weekend en bouwvak
          // houden hun bestaande terugwaartse grens. Relatieconventies volgen pas na dit venster.
          if (progressCal.isHourMode && t.actualFinish.includes('T')
            && utcDayStart(ef).getTime() === utcDayStart(actualFinish).getTime()) ef = actualFinish;
```

Geen variabele of functie uit deze invoeging is hernoemd. De F2-gelijkstelling van de
nulduurmijlpaal volgt erna op regel 2351. De bestaande inversiecorrectie en de F1-grens
voor snaps over weekend/bouwvak blijven behouden. De 439 reviewcontroles bewaken ook
het 18:00–18:00-geval en C1/C5.

`progressEntry.ts`, `taskEditPlan.ts`, `mcpValidation.ts`, `actualDatesOrder.ts`, de
F1-reviewcheck en alle bestanden onder `artifacts/uren-f1b/` zijn gelijk aan de
integratieversie. De F1-correcties in `importNormalize.ts` en `xerReader.ts` zijn
meegekomen. De FS-kalendertijdtak gebruikt `predResult.ef` en de exacte kloktijdgrens
(`relationMath.ts:690`/`:698`). DCMA gebruikt `actualDateSide` voor beide actuals
(`dcmaAssessment.ts:388`). De F1-regel die een vastgelegde start bewaart en alleen het
afgeleide einde laat opschuiven, is behouden.

De twee bestaande F2-aansluitingen blijven nodig:

- `taskMutationRules.ts:38`: algemene normalisatie vóór validatie en vergelijking,
  ook vóór de statusdag en op scalaire kalenders. De statusklem van F1 blijft behouden.
  Met alleen de F1-versie van dit bestand geeft de gecorrigeerde auto-startcheck
  twaalf afwijkingen, exit 1. Na herstel met `cp`: 135/135, exit 0.
- `dcmaAssessment.ts:196`/`:205`: de kandidaat voor het kritiek-padexperiment kiezen
  in de berekening zonder harde eindpin. Met alleen de F1-versie faalt s3:
  `verwacht ["pass","P",100], kreeg ["na",null,null]`, exit 1. Na herstel met `cp`:
  41/41, exit 0. De F1-wijziging voor `actualDateSide` staat in beide versies.

Voor elke tegenproef is het goede bestand eerst naar `/tmp` gekopieerd, daarna
uitsluitend dat bestand tijdelijk vervangen, en vervolgens met `cp` hersteld en met
`cmp` gecontroleerd. De laatste gezamenlijke F1-run op de herstelde bron heeft exit 0.

## Rood, indeling en afhandeling

**B1 — twaalf bestaande onjuiste auto-startverwachtingen.** De eerste F1-run gaf
439/439 reviewcontroles, maar auto-start had 12/135 afwijkingen. Bij een geplande start
ná het afgeleide einde verwachtte de test een start om 07:00 en een einde om 16:00;
de echte gedeelde helper klemt de automatisch afgeleide start op het genormaliseerde
eindmoment: 16:00–16:00. Dat volgt het F1-contract start = einde, D2/D6 en daarna N0
(een moment blijft een moment). Dezelfde twaalf fouten zijn ook gemeten met de drie
gewijzigde voortgangsbestanden terug op `cc1889437`; ze zijn niet door deze merge ontstaan.

`check-auto-actual-start.ts:71` bewaakt nu het precieze geklemde paar. Het afzonderlijke
geval waarin de geplande start al vóór het einde ligt, blijft expliciet 07:00–16:00
verwachten (`:279`). De 135 controles blijven aanwezig; er is geen vergelijking
verwijderd of minder precies gemaakt. Geen productiecode gewijzigd voor deze correctie.
De uiteindelijke auto-startcheck is 135/135, exit 0. Er zijn geen nieuwe B2-tussenstanden
of B3-productfouten in deze ronde vastgesteld. Het bestaande F3-einddoelregister uit
bouwronde 4 en het F0-vangnet zijn niet veranderd.

**Bestaand hulpmiddelprobleem, knownbug 238.** `npm run i18n:resolve` geeft exit 1
omdat er twee merge-bases zijn: `51b1728c0` en `07030f405`. Een afzonderlijke controle
met de echte `mergeLocale`-functie geeft vanaf beide bases dezelfde **148.192
sleutelwaarden in 139 bestanden**, nul sleutelconflicten en inhoudelijk exact de werkmap
(exit 0). Locale- en bronhashbestanden zijn niet gewijzigd. `verify:i18n` geeft exit 0.
Dit is geen nieuwe rekenafwijking binnen B1/B2/B3; de scriptbeperking is als gevraagd
vastgelegd bij 238, met behoud van de aangeleverde zekerheid S en de oudere ronde-2-meting.

## Gerichte controles

Alle controles zijn na elkaar uitgevoerd met gemeten Node **22.23.4**, npm **10.9.9**.
Het in de opdracht gevraagde `$HOME/.local/bin` staat in PATH; het gevonden Node-22-pad
staat ervoor. De expliciete opdracht en apparaatafspraken zijn gevolgd voor deze lokale
runs, ondanks de oudere algemene serverbeperking in het lokale `AGENTS.md`.
De zware runs liepen in de voorgrond; exitcodes zijn afzonderlijk vastgelegd.

| Controle | Gezien resultaat | Exitcode |
|---|---|---|
| F1-review `check-hours-f1-review.ts` | 439/439 | 0 |
| Auto-start `check-auto-actual-start.ts` | 135/135 | 0 |
| F1-status `check-hours-f1-status.ts` | 114/114 | 0 |
| DCMA `check-dcma.ts` | 41/41 | 0 |
| Conventies `check-conventions-p6-flags.ts` | 381/381; inclusief de twee bestaande F2/B6-controles bovenop 379 | 0 |
| Acht F1-casebatterijen | 279/279: hours 31, hours-blokgrenzen 48, hours-relations 36, msp-pariteit 65, progress 33, lag-advanced 23, milestone-kinds 26, milestones 17 | 0 |
| Gewone 24 casusbatterijen | 608/608 | 0 |
| F0 run 1, alle 24 casusbestanden | 422 dagcases: 421 gelijk, één bewust rood B7-doel, nul ongecodeerd rood | 0 |
| F0 run 2, alle 24 casusbestanden | 422 dagcases: 415 gelijk, vier rood, één bewust gelijk, één bewust rood, één niet omzetbaar; ongewijzigde inventaris | 0 |
| `check-minute-model.ts` | 137/137 | 0 |
| `check-minute-model-boundaries.ts` | 17/17 | 0 |
| B5 `check-minute-model-transition.ts` | 87/87 | 0 |
| IFC `check-minute-model-ifc.ts` | 52/52 | 0 |
| `check-minute-model-routes.ts` | 34 rekenaanroepen, nul afwijkingen | 0 |
| Voorbeeldensnapshot `check-minute-model-examples.ts` | 6.090/6.090, 24 voorbeelden; zeven exacte F3-doelen aanvullend getoetst | 0 |
| `check-ifc-legacy-arity.ts` | 50/50 | 0 |
| Oude IFC-lezer `check-minute-model-compat.ts` | 21.613/21.613, 27 bestanden, nul afwijkingen | 0 |
| `npm run typecheck` | App plus scripts/tests | 0 |
| `npm run lint` | Geen fouten | 0 |
| `npm run verify:examples` | Drie showcases, twintig basisvoorbeelden en één extern bronbestand | 0 |
| `npm run verify:conventions` | 115 motorbestanden, 28 conventies en 11 projectopties | 0 |
| `npm run verify:cycles` | 823 modules, geen cyclus | 0 |
| `npm run verify:i18n` | Sleutels, CLDR en vaste opmaak; ontbrekende vertalingen zijn het bestaande rapport | 0 |
| `npm run verify:docs` | 79 artikelen in nl/en; overige talen als rapport | 0 |
| Locale-samenvoeging vanaf beide bases | 148.192 sleutelwaarden in 139 bestanden; gelijk aan werkmap | 0 |
| `npm run i18n:resolve` | Bekende beperking bij twee merge-bases, hierboven afgehandeld | 1 |

De losse checks zijn via `bash tests/planning/run.sh <check-naam.ts> ...` gedraaid.
De casusruns geven alleen de 24 expliciete `cases-*.json`-bestanden mee; de volledige
planningssuite en de tijdzone-matrix zijn daardoor niet gestart. F0 gebruikt exact
diezelfde bestanden met `OPS_MINUTE_MODEL_RUN=1` respectievelijk `2`.

De oude lezer is in deze ronde opnieuw gebundeld uit `git archive v2026.9.0 src`
(tagcommit `2bb279d18d4f98c6298ba769603d79d5a0351435`), in een afzonderlijke tijdelijke map.
De drie nieuwe IFC-fixtures W0/W1/W2 komen uit de huidige IFC-check; geen oude fixture
is als huidige uitvoer hergebruikt. De snapshot en F0-redencodes zijn niet ververst.

Logs, exitcodes, reproduceerbare opdrachten en de twee tijdelijke tegenproeven staan
onder `/tmp/uren-f2-ronde5/`. Hoofdlogs: `f1.log` (eerste rode verwachting),
`auto-start-voor-merge.log`, `f1-hersteld.log` (laatste groene gezamenlijke F1-run),
`casussen.log`, `run1.log`, `run2.log`, `f2-kern.log`, `oude-lezer.log`,
`locales-bases.log` en de naar het npm-commando genoemde logs. De mislukte tussenrun
`f1-definitief.log` had nog één onjuiste verwachting voor het niet-geklemd geval;
die is expliciet op 07:00–16:00 gehouden en door de laatste groene run vervangen.

## Knownbugs en overdracht

Onderaan de afgesproken secties toegevoegd:

- Rekenen en planning: **230, 231, 232** (F1-vervolgpunten).
- Bibliotheek, bezetting, extensies, AI: **233, 234, 235** (F3b-vervolgpunten).
- Tests: **236, 237, 238** (F3b-tests en de locale-resolver).
- Teksten en helpteksten: **240** (oude tutorial- en gidsgetallen, bijvondst uit ronde 4).

De aangeleverde zekerheid B/S is behouden. Er zijn geen dubbele nummers; **239 en 241
zijn niet gebruikt**. `verify:docs` controleert `knownbugs.md` niet; de nummering en
sectieplaatsing zijn afzonderlijk gecontroleerd. `verify:docs` en `typecheck` zijn
wel allebei na de wijziging van `knownbugs.md` uitgevoerd, beide exit 0.

PR #559 blijft concept tegen `claude/uren-integratie`. De PR-tekst vermeldt de
nieuwe integratiebasis, deze bewijsnotitie, knownbugs 230–238 en 240 en het ongewijzigde
F3-overdrachtsregister. De uiteindelijke head en de eenmalige GitHub-beoordeling van
`mergeable` worden bij de overdracht gemeld. Er is geen PR of release gemerged,
geen tag gemaakt en niets gepubliceerd.

Niet uitgevoerd in deze ronde: volledige planningssuite, tijdzone-matrix, volledige
`npm run verify`, volledige bibliotheek-/MCP-/dev-server-/browsersuites, gerichte
browsertests of nieuw visueel schermbewijs, afzonderlijke tutorial-/resourcebatterijen,
corpus-/profielmetingen, prestatiemetingen, app-/Tauri-builds. Eerdere browser- en
profieluitslagen uit ronde 4 zijn niet als nieuw bewijs voor deze head aangemerkt.

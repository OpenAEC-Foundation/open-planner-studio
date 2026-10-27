# F2 — bouwronde 2, 23 oktober 2026

F2 is nog niet klaar voor review. De drie open run-1-cases zonder redencode zijn afgehandeld. B7 houdt één rood doel; twee gemengde cases en 378 voorbeeldwaarden blijven open. Verwachtingen en vangrails zijn niet stil afgezwakt.

Werkplek: `/home/aia09/projects/open-planner-studio/.claude/worktrees/uren-f2`, branch `claude/uren-f2-kern`, concept-PR #559 tegen `claude/uren-integratie`. Uitgevoerd met gpt-6.1-sol, reasoning xhigh; geen verder gedelegeerd werk. Deze notitie is opgesteld door een AI-assistent.

## Stap 0, letterlijk

`git fetch origin` gaf geen uitvoer. Daarna `git status -sb` en `git log --oneline -5`:

```text
## claude/uren-f2-kern...origin/claude/uren-f2-kern
4279f63d0 Normaliseer externe ankers en bewaak samengestelde omzettingen
c6310b941 Bewaak omzettingsroutes, IFC-compatibiliteit en regressies
448905d0c Merge F1-urenfouten in de F2-kern
d3e7c885f Sluit werkblokken, laadnormalisatie en de omzettingsroutes aan
bc61c990a Herstel de resterende urenfouten en de statusregel in F1b
```

De werkmap was schoon; HEAD was de gevraagde commit. De opgegeven instructies en domeinregels zijn opnieuw gelezen. De gerichte lokale controles zijn uitgevoerd op basis van de expliciete toestemming in deze opdracht. Node 22.23.4 is gemeten en gebruikt; `$HOME/.local/bin/node` wees naar Node 24 en is voor de controles voorafgegaan door het gevonden Node-22-pad. Zware controles liepen na elkaar, in de voorgrond, met logbestanden onder `/tmp/uren-f2-ronde2/` en vastgelegde exitcodes.

## Merges

- `710944179`: integratie `e229ee16a` (F5a-1). Geen conflicten. Adaptercontrole 48/48, exit 0.
- `d6f23bdb0`: F1 `a9cab7a66`. De groene vermelding in dat mergebericht was onjuist: de eerste controle had exit 1 op oude datumverwachtingen. `364104ef3` corrigeert dit expliciet en repareert de aanvullende rasterfout.
- `fb1964a79`: nieuwste F1-fixronde `07030f405`, inclusief integratie `f044aff35` en daarmee de gemergede F4a-stand. Geen tekstconflicten. Eigen wijzigingen aan UI, hooks, `enableHourPlanning` of vertalingen zijn niet toegevoegd.
- Bij de laatste merge stopt `i18n:resolve` met exit 1: twee merge-bases. Beide bases geven voor alle 127.519 sleutels in de 83 gewijzigde locale-/bronhashbestanden dezelfde samenvoeging; het Git-resultaat wijkt nergens af. `verify:i18n` eindigt met exit 0. Er is niets handmatig aan vertaalinhoud veranderd.

## Stand per onderdeel

| Onderdeel | Stand en bewijs |
|---|---|
| Werkblokken, T1, laadgrens, D1–D7, vastlegging, baseline-einde | Aangesloten; gerichte normalisatie-, IFC- en grenscontroles groen. |
| Normalisatie na invoer (T17) | Aanvullend hersteld: één gewone rastercel en plakken normaliseren nu alle geschreven taken, niet alleen een transactie met meerdere relatiewijzigingen. Oudere feiten volgen D1/D2/D4. |
| B5, twee snapshots, vlag en rekenroutes | 87/87 overgangscontroles, 34 rekenaanroepen bewaakt; echte hooks en bezettingsoverzicht gecontroleerd in Chromium. |
| B6, ontbrekende profielwaarden, T11 | Gerichte controles groen; losse mijlpalen behouden de voorgeschreven eindkant. |
| `TimeModel`, `LiteralTimes`, `AtDayEnd`, T17 | IFC 52/52; v2026.9.0 leest 27 nieuw geschreven bestanden op 21.772 vergelijkingen gelijk. |
| Dagtaak op urenpad in hele dagen | Run 1 heeft geen ongecodeerde rode cases meer. De grens midden op de dag blijft open; geen F3-loper ingebouwd. |
| B7 en I11 | Percentage en minutenlag exact; B7-start goed, doel voor het opvolgereinde nog rood. |
| T16 en SF | `mk-14` hersteld; twee kalendertijdcases verantwoord met `KALENDERTIJD-EINDE`. |

## Open run-1-cases en de bronnen

Bron is [de spec](../../docs/superpowers/specs/2026-10-20-alleen-uren-design.md).

- `mk-14`: de FINISH-mijlpaal had na D7 een tijdstip 16:00. De projectvloer behandelde dat opnieuw als een volgende werkdag. De vloer leest nu de startkant D1; SF bindt aan het werkelijke startmoment van de voorganger (T8, §4.5), zonder een extra daggrens. Gerichte grensproef en case groen.
- `prog-T9-elapsed-restwerk-24-7`: de statusdag wordt met D5 als werkbegin gelezen. Het exacte kalendertijdeinde ligt op 07:00. Code `KALENDERTIJD-EINDE`; bron §4.2 D3/D5, T16 en §6.1: “en elke case die F0 daarnaast vindt”. De gewone verwachting is behouden; het minutendoel is exact vastgelegd.
- `msp-51-z6-invariant-elapsed-opvolger-hele-dagen-delay`: dezelfde D1/D5-normalisatie in combinatie met het exclusieve kalendertijdeinde. Code `KALENDERTIJD-EINDE`, dezelfde bron. De vervallen rode pin is uit beide runs verwijderd nadat de werkelijke run gelijk was.
- `lagadv-pct-fs50-odd-roundup`: bestaande code `PCT-LAG-EXACT`, bron B7 en §6.1. De lag blijft exact; het ongewijzigde F0-doel voor het einde wordt nog niet gehaald. Geen nieuwe vrijstelling.

§7.2 F2 zegt letterlijk: “elke dagtaak loopt als urenpad-dagtaak, in hele dagen. De conventie dagenmaat bestaat dan nog niet”. §3.14 heet “De dagenmaat als conventie (F3)” en schrijft voor: “binnen een dag telt het deel van de werktijd van die dag. Achteruit telt op dezelfde manier terug.” T23 hoort bij die F3-lopers. T12 bepaalt ontbrekende conventiewaarden, niet de duur vanaf een moment midden op de dag. B7 legt de exacte lag en de start van B vast, maar noemt daar geen einde van B.

**Open vraag, letterlijk:** Moet de hele dagtaak in `lagadv-pct-fs50-odd-roundup`, die woensdag 11:00 begint, in F2 woensdag 16:00 eindigen (§7.2, huidig urenpad in hele dagen), of donderdag 11:00 (F0-doel bij B7 en de lopers van §3.14/T23, die bij F3 staan)?

## Indeling van de 11 gemengde afwijkingen

| Groep | Aantal cases | Voorbeeld, oorzaak en afhandeling |
|---|---:|---|
| Late START-mijlpaal op echte urenkalender | 2 | `rr-ss-succ-startms`: 12:00 werd ten onrechte 08:00. De daggrens geldt uitsluitend voor afgeleide scalaire kalenders; bestaande uurmomenten blijven exact. Motor gerepareerd. Ook `rr-fs-pred-startms-lead` groen. |
| Eindtijd dagvoorganger (D2) | 1 | `elapsed-day-to-hour`: D eindigt dinsdag 16:00; +24 klokuren is woensdag 16:00, H begint donderdag 08:00. Verwachting per case bijgewerkt op §4.2 D2. |
| Losse FINISH-mijlpaal (B6/D7) | 2 | `rr-sf-pred-finishms` en `rr-ss-pred-finishms`: 16:00 in plaats van 08:00, nul speling en bijbehorende kritieke set. Verwachtingen per case bijgewerkt op §3.14 B6 en §4.2 D7. |
| Echte momenten en speling tussen kalenders | 4 | `rr-fs-crossmode-daypred-hourms`: 07:00 versus 08:00 geeft 1/8 d speling. Met twee dagen lag blijft dat 1/8 d. De eindmijlpaal deelt D2 16:00. Het parallelle pad geeft H LS woensdag 12:00, LF 16:00 en 2,5 d speling; M 2,625 d. Verwachtingen afzonderlijk bijgewerkt op §4.2 en §7.2; Nederlandse bronnotities staan in de cases en in commit `ac8e2b243`. |
| Hele dag vanaf een tijdstip, en terugrekening | 2 | `s7a-day-to-hour`: D LS dinsdag 07:00/LF woensdag 08:00 in plaats van maandag/dinsdag. `s7b-hour-to-day`: D maandag 13:00–16:00 in plaats van dinsdag; de voorganger krijgt een late grens op vrijdag en −0,5 d speling. Rood behouden, geen redencode: de spec staat geen vrijstelling “later F3” toe voor een fout. |

Geen afronding van procentlag teruggezet; geen nieuwe redencode verzonnen om deze twee cases groen te krijgen.

## Indeling van de 413 voorbeeldwaarden

Een waarde kan ook een samenvatting boven de veroorzakende taak zijn. De indeling is vastgesteld met gerichte taak-/relatieproeven en een tijdelijke tegenproef met de oude percentageafronding; productiecode is steeds met `cp` uit `/tmp` hersteld.

| Groep | Waarden | Voorbeeld en afhandeling |
|---|---:|---|
| Late grens van ongetypeerde mijlpaal na FS/SS | 25 | `06-parkeergarage-utrecht / 2.2 Struts, level 1`: late kant een werkdag te ver, plus opvolgers. De startkant wordt gebruikt na FS/SS, niet voor losse B6-mijlpalen of FF/SF. Motor gerepareerd. |
| Voltooide mijlpalen en samenvattingen | 5 | `showcase-appartementencomplex / 2.8 Site ready for construction`: vrijdag 16:00 werd maandag 07:00. Feitelijke nulduur en kalendertijd blijven op hun genormaliseerde moment. Motor gerepareerd. |
| Dagspeling met verschillende kloktijden | 4 | `05-brugvervanging-n279 / 2.6 Remove rubble.tf`: 101 in plaats van 102. Voor de F2-dagtaak wordt dagspeling onafhankelijk van de kloktijd geteld. Motor gerepareerd; minutenspeling hoort bij F3. |
| SF op werkelijk startmoment | 1 | `showcase-appartementencomplex / 8.14 Break up temporary site road.es`: 21 → 20 maart 2028. Alleen deze waarde via de snapshot-bijwerkroute overgenomen, bron `CONV-SF`, T8/§4.5. |
| Exacte procentlag, doorwerking en terugrekening | 378 | `05-brugvervanging-n279 / 3.1`: SS 40% van 8 d = 3,2 d geeft 17 maart 08:36; de terugrekening naar 07:00 veroorzaakt onder meer −1 d speling bij `1.1 Implement traffic management`. De tijdelijke oude afronding laat uitsluitend de ene SF-waarde over. De groep is causaal geïsoleerd, maar het gewenste opvolgereinde en de terugrekening zijn nog niet per groep verantwoord. Snapshot niet ververst; deze 378 waarden blijven rood. |

`npm run gen:examples` is niet gedraaid: de bronvoorbeelden zijn niet gewijzigd en de onbesliste waarden mogen niet in bulk worden vastgezet.

## Rode CI-punten uit bouwronde 1

- Showcase met meerdere kritieke paden: echte F2-fout. Een voltooide gemeenschappelijke voorganger maakte de volledige tak niet-kritiek. De classificatie van aanvullende paden gebruikt nu alleen de actuele taken, met dezelfde statusdatum-/voltooiingsregel als de rest van de analyse. De eis `criticalPaths.length > 1` is behouden; `verify:examples` exit 0.
- Bibliotheekbezetting: verwachting van het documenttype was verouderd. De betreffende herstelproeven controleren nu expliciet moderne `MINUTES-1`-documenten; een oude open omzetting blijft volgens B5 slapen. De echte achtergrondhook is daarnaast met zo'n oude en een moderne slaper gecontroleerd. Bibliotheekcontrole 134/134, exit 0.
- Beide API-smokes: het berekende projecteinde is volgens D2 een moment, `2028-01-12T16:00`. De verwachting is aangepast; de API-uitvoer is niet afgeknipt. Kern/store-pariteit is gericht gemeten (260/260). De beide API-smokes zelf worden door CI beoordeeld; geen lokale smoke-uitslag geclaimd.

## B5-regressies 1–11 (§5.2)

De Chromiumproef gebruikt de echte hooks `useAutoCalcCPM` en `useExitRecordedDates`. Invoer verloopt via bestandskiezer, toetsen, tabelcel, ribbon en documenttab; de ontwikkelbrug zet alleen fixtures en leest staat. Handmatige browsercontrole is aangevuld met de gerichte proef in `tests/browser/recorded-dates.spec.ts`.

| Geval | Aftekening |
|---|---|
| 1 | Eigen oud IFC via bestandskiezer: B 16–20 → 9–13 maart, melding 1 taak/5 werkdagen, één event. Ctrl+Z geeft geladen modus terug, niet het vorige document; Ctrl+Y herhaalt. Storecontrole plus echte browserhandeling. |
| 2 | Automatisch berekenen aan; Ctrl+Z en 300 ms wachten houden oude datums. Naamcel via klik/F2/Enter houdt de modus. F5 rekent. Verwijderen via de ribbon en één Ctrl+Z zijn handmatig met echte invoer gecontroleerd. |
| 3 | Oud bestand zonder verschuiving: schoon, nul events, nul meldingen. Overgangscontrole. |
| 4 | Opgeslagen modus en bronvastlegging genormaliseerd; geen overgang bij expliciet in de modus opgeslagen bestand. `check-recorded-dates.ts` en de IFC-controles. |
| 5 | Echt bezettingsoverzicht: oude slaper blijft bytegelijk, verouderd, vlag aan, nul events. Moderne slaper wordt door dezelfde hook wel doorgerekend. Activeren oud: één event; Ctrl+Z en 300 ms: oude datums, modus/vlag aan, niet verouderd. Chromiumproef. |
| 6 | Bewerken vóór Bereken: twee events; eerste undo houdt de bewerking in de modus, tweede zet de bewerking terug. Overgangscontrole. |
| 7 | Echte MCP-transactie en bibliotheekverdeling op actief/slapend document: vlag uit, melding en eigen samengestelde undo. `undoDistribution` zet vertraging en verschuiving samen terug. Overgangscontrole. |
| 8 | Save na undo heeft geen `TimeModel` en geen `SourceFormat`; heropenen voert de overgang opnieuw uit. Overgangs-/IFC-controle. |
| 9 | Modern bestand met datum zonder tijd normaliseert zonder overgangsmelding. Overgangscontrole. |
| 10 | Echte `planner_update_tasks` met alleen naam en echte batch met leesstap behouden modus en datums; duur verlaat de modus. Overgangscontrole. |
| 11 | Echte tool en batch met werkregel/leesstap: hetzelfde restwerk en dezelfde contour als `setTaskWorkRule`; undo herstelt taak en inzet. Duur+werkregel en ruwe contour+werkregel verlaten de modus. 11c blijft F3: de spec noemt het letterlijk “regressie voor F3”; geen vrijstelling van een F2-fout. |

## Controles en exitcodes

Alle onderstaande getallen zijn daadwerkelijk gezien; de beginstand is waar aangegeven het overgedragen rapport, anders de eigen nulmeting. De volledige suites en `npm run verify` zijn niet lokaal gedraaid.

| Toets | Voor | Na |
|---|---|---|
| Run 1, 24 batterijen / 422 dagcases | 404 gelijk, 14 bewust, 3 rood, 1 bewust rood; exit 1 (overgedragen) | 405 gelijk, 16 bewust, 0 ongecodeerd rood, 1 bewust rood (B7); exit 1 |
| Run 2, dezelfde 422 | Rode gevallen gepind door F0 | 400 gelijk, 16 bewust, 4 rood, 1 bewust rood, 1 niet omzetbaar; exit 0 van het F0-vangnet, terwijl deze doelen inhoudelijk rood blijven. Pinwijziging uitsluitend bewezen groen geworden msp-51. |
| Gemengde batterijen | 56/67, exit 1 | 65/67, exit 1 |
| Voorbeeldensnapshot | 413 waarden, exit 1 | 378 waarden, exit 1; alleen 1 SF-waarde bewust ververst |
| Showcasecontrole | meerdere-kritieke-paden-eis rood | `verify:examples` exit 0 |
| Bezetting | herstelfixtures rood | 134/134, exit 0 |
| Minutenovergang | 77/77 uit ronde 1 | 87/87, exit 0 |
| IFC / oude lezer | 52/52 / oude lezer exit 0 | 52/52; 21.772/21.772 op 27 bestanden, exit 0 |
| Overige gerichte contracten | — | Grenzen 11/11; 34 rekenaanroepen; samenvatting 10/10; kern 260/260; adapters 48/48; raster 178/178; vastlegging 377/377 en bibliotheek 26/26; exit 0 |
| Laatste F1-aansluiting | — | Review 120/120; status 114/114; automatische feiten 135/135; exit 0 |
| Statische controles | — | Typecheck, lint, `verify:conventions`, `verify:cycles` en `verify:i18n`: exit 0. 28 conventies/11 opties; 822 modules zonder cyclus. |
| Chromium met echte hooks en bezetting | nog niet afgetekend | 1 gerichte proef, 17,5 s, exit 0 na de laatste F1/F4a-merge. |

Run 2 blijft inhoudelijk open op `lagadv-ff-lead-ed`, `mk-05a`, `mk-14`, `msp-56-z9a-manual-anchor-raw-no-snap`, het gecodeerde doel van `msp-20-t8-review-elapsed-keten` en de niet omzetbare `durmin-on-daycal-withdm`. §6.1: “Run 2 vanaf F3 met alleen de conventie dagenmaat uit”. Geen aanvullende redencodes of gewijzigde gewone verwachtingen.

## Profiel- en prestatiemeting

`measure:profiles` is met het corpus gedraaid: exit 1. P6 houdt regel A: nieuw 0, verslechterd 0, groter 0; ook verbeterd/kleiner 0. De bestaande 221 inexacte cellen blijven 76 op zes assen en 145 drivingPath. 42 taken in 3 projecten uitgesloten, geen nieuwe uitsluiting. MS Project houdt dezelfde drie reeds gemelde afwijkingen op `timephased-cost-rollup.mpp` (knownbug 187): `finishExact` 9→6, `finishDiff` 0→3 en de globale verzamelingpin. 661 bestanden, 2.196 controles; corpusloze vangrail exit 0. Geen nieuwe profielverslechtering door deze ronde aangetoond.

`rehab-2.xer`, 6.978 taken: lezen 8.584,9 ms; vijf solves 1.033,3 / 938,6 / 766,5 / 787,6 / 737,9 ms, mediaan 787,6 ms, exit 0. Dit is één meting op de gedeelde machine; geen geïsoleerde snelheidsclaim tegenover de vorige ronde.

## Mutatiebewijs

Acht nieuwe fixes afzonderlijk gemuteerd; steeds kopie in `/tmp`, één mutatie, gerichte proef, herstel met `cp`. Alle acht mutaties geven exit 1; de oorspronkelijke code geeft exit 0 op de bijbehorende gerichte proef:

1. Projectvloer opnieuw op de eindkant van een mijlpaal laten landen.
2. SF voor een dagopvolger weer door de volgende-daggrens sturen.
3. Een late expliciete uurmijlpaal weer op dagbegin knippen.
4. Voltooide nulduur-/kalendertijdfeiten weer door een kalender-snap sturen.
5. Dagspeling weer afhankelijk maken van de kloktijd.
6. De late ongetypeerde mijlpaal na FS/SS weer op dag-einde plaatsen.
7. Kritieke takken weer afwijzen op hun voltooide voorganger: 10/11, exit 1; hersteld 11/11.
8. Normalisatie van gewone rastercellen overslaan: 79/81, exit 1; hersteld 81/81, later uitgebreid tot 87/87.

Logs: `mutations-final.log`, `mutatie-kritieke-paden-final.log`, `mutatie-raster-normalisatie.log`. De oude mislukte proefopzetten zijn niet gebruikt als positief mutatiebewijs.

## VERVOLG en bijvondsten

1. Beantwoord de letterlijke B7-vraag hierboven; leg daarmee het F2-opvolgereinde en de terugrekening vast voordat de 378 procentlagwaarden worden ververst.
2. Werk `s7a-day-to-hour` en `s7b-hour-to-day` af op dat contract; negatieve speling is niet stil als bedoelde wijziging vastgezet.
3. Meet de volledige run-2-doelen in F3; de bestaande rode F0-pins blijven zichtbaar.
4. Beoordeel CI op de laatste commit, inclusief beide API-smokes en de volledige suites.
5. De bestaande MSP-meting (knownbug 187) blijft apart vervolgwerk.

Bijvondsten: `i18n:resolve` ondersteunt de hier ontstane twee merge-bases niet; de controle is hierboven verantwoord. Geen nieuwe eigen regels in `knownbugs.md`. De onjuiste groene vermelding bij `d6f23bdb0` is gecorrigeerd in `364104ef3` en deze notitie. Er is niet naar main/integratie gepusht, geen PR gemerged en geen release/tag/publicatie gemaakt.

## Commits van deze ronde

`710944179`, `b36c37770`, `13ca41746`, `ac8e2b243`, `d6f23bdb0`, `364104ef3`, `e07d94f95`, `fb1964a79`, plus de bewijsnotitie zelf. Alle commits zijn normaal gepusht; de gevraagde co-auteurregel is toegevoegd. De feitelijke uitvoerder was gpt-6.1-sol met reasoning xhigh.

# F1b: meting en bewijs

Basis: 12abaabf2, branch claude/uren-f1b-urenfouten. Node 22.23.4.
Dit werk bouwt voort op PR #402. F1 blijft deels open; onderaan staan de concrete restpunten.

De uitvoer van stap 0:

```text
## claude/uren-f1b-urenfouten...origin/claude/uren-integratie
12abaabf2 Merge main in uren-integratie en werk de stand van PR #402 bij
61ef06ad8 Merge pull request #550 from OpenAEC-Foundation/fix/preserve-unreadable-recovery
5aab3075a Merge pull request #548 from OpenAEC-Foundation/claude/readme-overhaul-2
```

De JSON-batterijen tellen 590 → 608 cases. Daarvan zijn 422 dagcases en nu 186 urencases:
de oorspronkelijke 138, de 30 uit #402 en 18 nieuwe. De oorspronkelijke verwachtingen zijn
behouden, behalve de bewust omgedraaide foutpin msp-28. De nieuwe statusbatterij bevat 114
controles. Er zijn ook drie nieuwe gevallen door de echte MCP-dispatcher.

## Opgeloste punten

- Groep 1, N1 bij eindmijlpalen: A klaar maandag 16:00, FS +8 uur naar een eindmijlpaal gaf
  woensdag 08:00 en geeft dinsdag 16:00. Een mijlpaal zonder soort na FF blijft op de finish.
  Cases f1-n1-eindmijlpaal-ff, f1-n1-eindmijlpaal-fs-lag, f1-n1-eindmijlpaal-fs-elapsed en
  f1-n1-mijlpaal-eindbeperking bewaken dit, naast de zeven oorspronkelijke gevallen uit §10.3.
  Mutaties n1-ff-zonder-soort, n1-fs-werklag, n1-fs-kalenderlag, n1-mijlpaal-hersnap en
  n1-eindbeperking-wortel worden elk rood op hun eigen grens.

- Groep 4 en 148: de deadlinefunctie van #402 was ook in opgeslagen datums al aangesloten.
  Een vastgelegd einde op woensdag 16:00 bij deadline woensdag is gehaald; donderdag is gemist.
  check-hours-f1-status.ts bewaakt beide. Mutatie 148-deadline-vastlegging maakt precies de
  eerste verwachting rood. Geen nieuwe deadlinefunctie gebouwd.

- Groep 5 en 145: P 1 d → A 1 d, SNLT/MSO dinsdag 08:00 gaf A een late start maandag 08:00
  en speling −1. Nu dinsdag 08:00 en speling 0, zonder valse schending.
  Cases f1-145-snlt en f1-145-mso; mutaties 145-late-start en 145-n3-vergelijking.
  De bestaande controles voor kalendertijd en mijlpalen buiten werktijd blijven gelden.

- Groep 7, N2: een vertraging die dinsdag 16:00 oplevert, geeft een afgeleide start woensdag
  08:00. Dit geldt ook wanneer dagen- en minutenwaarde samen bestaan. Case f1-n2-dagen-en-minuten
  en de bestaande bg140-cases; mutaties n2-dagen-en-minuten en n2-vertraging-140.
  De minutenmodelmeting telde een kalendertijdvertraging onterecht met 8 uur per dag.
  Ze telt nu 24 uur. Alleen die omzetting terugzetten maakt msp-50 opnieuw rood.
  msp-54 haalt nu ook run 2; msp-51 blijft afwijken door het afzonderlijke FS-punt 155.

- Groep 9 en D6: status woensdag zonder tijd plus werkelijk einde woensdag wordt woensdag
  16:00; met status woensdag 12:00 wordt dezelfde datumloze invoer 12:00; een letterlijk einde
  14:00 wordt geweigerd. De 114 controles toetsen dialoogopslag, paneel, raster, plakken, MCP,
  nachtdiensten, kalendertijd, afgeleide voltooiing en weigeringen zonder gedeeltelijke mutatie.
  Oudere werkelijke datums behouden hun datumvorm; algemene normalisatie hoort bij F2.
  De afzonderlijke scope-mutatie maakt alleen de oudere/zonder-statusgevallen en de
  bestaande herstelverwachting rood. Mutaties D6-normalisatie en status-werkdag maken de bijbehorende verwachtingen rood.
  De gecombineerde MCP-invoer toetst het opgegeven einde ook als completion <100 het daarna
  wist; de afzonderlijke guardmutatie maakt alleen dat geval rood.

- Groep 10, N1 bij externe opvolger: de bestaande #402-fix is ongewijzigd.
  De bg141-cases zijn groen; mutatie n1-externe-opvolger-141 maakt ze rood.
  Een extern startanker woensdag 08:00 begrenst de late finish op dinsdag 16:00.

- Groep 11: msp-57 blijft groen. Handmatig ingevoerde momenten zijn niet algemeen gesnapt.
  De vijf z13-cases behouden hun rauwe ankers; de oorspronkelijke urencases blijven behouden.

- Groep 12, dagenmaat: FF, zachte/harde eindgrenzen, externe FF, splits en hangmatten behouden
  de juiste einddag. Een externe FF-eis woensdag 16:00 op een taak van 2 d geeft dinsdag 08:00
  tot woensdag 16:00. FNET woensdag 16:00 blijft op die eindgrens, en een harde MFO zonder tijd
  op een urentaak krijgt woensdag 16:00. Cases f1-n1-externe-ff, f1-n1-ff-met-split,
  f1-n1-ff-kalendertijdlag, f1-n1-dagtaak-fnet, f1-n1-harde-mfo-dagenmaat,
  f1-147-harde-mfo-uren en f1-n1-hangmat; daarnaast de bg142-cases.
  De gelijknamige mutaties, n1-zachte-eindgrens en beide harde-MFO-mutaties worden rood.

- msp-27/msp-28: SS +0 naar kalendertijd bewaart zaterdag 09:00; het vroegere maandag
  08:00 verdwijnt. De foutpin msp-28 is bewust omgedraaid.
  Mutatie ss-nul-kalendertijd maakt alleen msp-28 in de gewone batterij rood.

- 147: FNET/FNLT/MFO zonder tijd lezen het einde van het laatste werkblok.
  Dinsdag zonder tijd gaf een grens op middernacht en daardoor een einde maandag;
  nu dinsdag 16:00. Cases f1-147-fnet, f1-147-fnlt, f1-147-mfo en f1-147-harde-mfo-uren.
  Mutatie 147-eindbeperking maakt deze gevallen rood.

Alle 26 mutatieproeven hebben exit 1. Voor elke proef is één bronbestand naar /tmp gekopieerd,
één regel of afgebakend deel gemuteerd, de toets gedraaid en het bestand met cp teruggezet.
Na herstel is de gerichte toets groen (exit 0). De verwachte momenten volgen uit de
werkblokken, niet uit een teruggeschreven solveruitkomst. [De falende gevallen per mutatie](mutatiebewijs.json)
zijn vastgelegd; lange assertiewaarden zijn daarin verkort.

## Minutenmodel

De gecommitteerde lijst op de basis was 57/30 en liep al achter na #402.
De echte nulmeting gaf M1 34 en M2 21 afwijkende gevallen; F1b geeft M1 12 en M2 11.
Alleen verdwenen gevallen zijn uit de lijsten verwijderd; geen nieuwe afwijking is toegestaan.
De ontbrekende lege sleutel hours-blokgrenzen staat nu in beide runs.
De statusdatum blijft zoals ingevoerd; de solver leest een datum zonder tijd zelf startachtig.

## Wat open blijft

146 blijft staan. Een algemene correctie van de late FF-grens voor urentaken is volgens de
spec een conventievraag. mk-05a is in M1 opgelost; de bredere fix voor M2 schendt drie
bestaande C7-verwachtingen. De fix blijft daarom volgens N1 bij dagenmaat. Geen conventie of
orakel is hiervoor gewijzigd.

msp-51 blijft in beide runs afwijken door knownbug 155. Andere bestaande restgevallen staan
in de lijsten, waaronder 153/154, de losse mijlpalen, SF en procentlag. Groep 2, 3, 8 en het
kalendertijd-einde T16 zijn bewust niet omgezet.

Nieuwe nevenbevinding 204: een urentaak na een FF-kalendertijdlead kan vóór de finish-eis
eindigen; in lagadv-ff-lead-ed blijft M2 rood op B. De werkdagenlag van C is hersteld.
Nieuwe nevenbevinding 205: de expectedFinishDates-pin van de SCHEDOPTIONS-corpuscheck is ook
op de schone basis rood. Bestaande MPP-afwijkingen blijven knownbug 187.

Nieuwe nevenbevinding 206: de vaste plakprestatiepoort (3000 ms) faalt ook op de schone
basis: mediaan 3942,1 ms; F1b gericht 4388,7 ms. Beide exit 1. Dit bewijst een bestaande
overschrijding op de server, geen oorzaak of nauwkeurig regressieverschil. In een eerdere
volledige run haalt dezelfde onveranderde poort 2804,2 ms (groen). De grens is
niet aangepast en OPS_RELAX_PERF is niet gebruikt.

Nieuwe nevenbevinding 207: de bulkpoort meet in de volledige run 17.188 ms bij een vaste grens
van 15.000 ms. De afzonderlijke controle is 23/23 groen op zowel de schone basis (6402 ms) als
dezelfde F1b-bron (5793 ms), beide exit 0. Een eerdere volledige run haalde 13.126 ms. Geen
bronwijziging tussen de mislukte en geslaagde meting en geen verruimde grens.

## Controle-uitkomsten

Node 22.23.4, npm 10.9.9. De controles draaiden vanuit de eigen F1b-worktree. De volledige
corpusloze run is apart van de echte corpusmetingen uitgevoerd; de optionele corpusvariabelen
zijn voor die run uit de omgeving gehaald. De vaste poorten bleven aan, zonder OPS_RELAX_PERF.

| Controle | Exit | Uitkomst |
| --- | --- | --- |
| npm ci | 0 | Nieuwe installatie; geen bestaande map of link vervangen. |
| npm run typecheck | 0 | Broncode én scripts/tests. |
| npm run lint | 0 | Geen lintfouten. |
| npm run verify:conventions | 0 | Geen bronformaatkeuze of ongeregistreerde optie in de engine. |
| npm run verify:cycles | 0 | Geen importcyclus. |
| Gerichte uren-, MSP-, z13- en P6-vlagbatterijen | 0 | Alle gewone caseverwachtingen behouden behalve msp-28. |
| Status, herstel en afgeleide werkelijke start | 0 | 114 controles, bestaande hersteltest 57/57 en auto-actual-start 134/134. |
| Drie MCP-batterijen | 0 | cases-progress-entry-ai, cases-auto-actual-start, cases-statusdatum. |
| 26 afzonderlijke mutaties | telkens 1 | Per fix de eigen verwachtingen rood; bronbestand met cp hersteld. |
| Herstelde gerichte toets | 0 | Onder meer blokgrenzen en de statusbatterij weer groen. |
| Gerichte bulkpoort, schone basis / F1b | 0 / 0 | 6402 / 5793 ms, 23/23 controles. |
| Gerichte plakpoort, schone basis / F1b | 1 / 1 | 3942,1 / 4388,7 ms bij 3000 ms; eerdere volledige run 2804,2 ms. |
| SCHEDOPTIONS met echt corpus, schone basis | 1 | Dezelfde expectedFinishDates-pin als F1b; bekendgemaakt als 205. |
| MPP-fidelity met echt corpus, schone basis | 1 | Dezelfde drie afwijkende eindcellen als F1b, bestaand punt 187. |
| npm run measure:profiles, echte corpora | 1 | P6-celpoort gehouden; bestaand nuldoel en MPP-pin rood, zie hieronder. |

Het P6-corpus was aanwezig (93 XER-bestanden); geen corpusloze vervanging voor de profielmeting.
De sidecarcontrole heeft exit 0. P6 heeft 0 nieuwe, verslechterde of groter geworden afwijkingen:
regel A is gehouden op de 221 gepinde inexacte cellen. De ruwe P6-check heeft exit 1 door het
bestaande nuldoel van 76 cellen; de meetlaag noemt dit NULDOEL, niet een nieuwe celregressie.
MS Project scant 661 bestanden en heeft exit 1 door de bestaande drie eindcellen in het publieke
mpxj/junit/data/timephased-cost-rollup.mpp. Dat is op de schone basis herhaald. Vangrails: exit 0.
De gecombineerde meetopdracht is daarom rood en wordt hier niet als geslaagd gepresenteerd.

Verkennende rode runs zijn geen geslaagde poort: de eerste TDD-toetsen hadden exit 1, een
nieuwe test met een ongetypeerd kolom-id gaf eerst typecheck-exit 2 en is gecorrigeerd. Twee
verkennende volledige runs zijn gestopt (143) wegens geheugenbelasting van de corpusmatrix
respectievelijk een inmiddels herstelde verwachting. Een eerdere volledige corpusloze run had
nog een oude D6-verwachting en een rode plakmeting. De herstelverwachting is juist teruggezet
naar de basis toen de normalisatie tot de statuswerkdag is beperkt. Een browserherhaling
overschreed de totale testtijd van 30 s bij de bestaande schuifbediening, vóór de nieuwe
statusinvoer; de vastgelegde pagina toonde de dialoog al gesloten. De grenzen zijn niet verhoogd.

De laatste browserherhaling draait apart van de zware controles en slaagt: 3 tests, 40,7 s,
exit 0. De echte datumvelden in de dialoog blijven daarmee gedekt na de beperking tot de
statuswerkdag. [Schermafbeelding van de statusinvoer](statusregel.png).

De laatste volledige corpusloze planningssuite heeft exit 0: 608/608 JSON-cases, alle
426 check-batterijen en alle vijf tijdzones. De matrix herdraait 406 gebouwde bundels per
zone, met OPS_TZ_JOBS=3. De plakpoort meet 2083,6 ms bij 3000 ms; de bulkpoort meet 8833 ms
bij 15.000 ms, 23/23 controles. Beide vaste poorten zijn actief. De eerdere volledige run
had alleen de rode bulkmeting (exit 1); alle vijf tijdzones daarvan waren ook groen.

```text
TZ UTC: groen
TZ America/New_York: groen
TZ Pacific/Midway: groen
TZ Pacific/Auckland: groen
TZ Atlantic/Azores: groen
EINDOORDEEL planningssuite: GROEN (exit 0)
EXIT:0
```

Opdracht van de laatste volledige run (Node 22.23.4, F1b-worktree):

```bash
env -u OPS_XER_CORPUS -u OPS_P6_COMPARISON -u OPS_MPP_CORPUS \
  -u OPS_MPP_CRAWL -u OPS_MPP_CRAWL_SMOKE OPS_TZ_JOBS=3 \
  bash tests/planning/run.sh > /tmp/uren-f1b-planning-alleen.log 2>&1
```

De echte corpora zijn afzonderlijk gemeten, zoals hierboven vermeld; de corpusafwijkingen
187/205 zijn niet uitgeschakeld of met nieuwe pins afgedekt. Nummers van nieuwe knownbugs
zijn vlak vóór de laatste commit opnieuw gecontroleerd tegen origin/main en
origin/claude/uren-integratie: beide maximaal 203.

## VERVOLG

- 146 en de M2-kant van mk-05a uitwerken binnen de conventies en de ongewijzigde C7-poort.
- 155/msp-51 en 204 apart onderzoeken; de veilige F1-grenzen hier niet verbreden.
- De oorzaken van corpusafwijkingen 187/205 en de wisselende tijdmetingen 206/207 onderzoeken.
- Groep 2, 3, 8, T16 en de algemene normalisatie in de volgende fasen uitvoeren.
- De orkestrator beoordeelt de concept-PR en bewaakt CI; hier is geen PR-bewaking gestart.

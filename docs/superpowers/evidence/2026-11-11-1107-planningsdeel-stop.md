# 1107: de naad op het planningsdeel, gestopt op een nieuwe weigering

**BEVESTIGD: een merge die eerst schreef, weigert nu doordat heropenen de planning verandert.** Daarom volgens de
opdracht gestopt en gepusht. Geen reparatie van die afwijking gedaan. Dit is een wijziging door de bestaande
herberekening na een duurwijziging zonder F5; geen aangetoond verlies van het gebouwmodel of vreemde bronvelden.

## Geval en bewijs

Bestand: `tests/fixtures/ifc-foreign/eigen-plus-model.ifc`.
Bewerking: de bestaande `ordinaryEdits`-bewerking `duur`, `task-mvp6eel7qyht28 een dag langer`.
De begintelling op main liet deze merge schrijven. Nu weigert hij met `merge-needs-phase2`, geval `planning-na-openen`.
Eerste verschil: taak `task-mvp6eel2x2ge26`, veld `time.lateStart`, `2027-05-12T07:00` → `2027-05-11T07:00`.

Met alleen de nieuwe vergelijkingsweigering uit schrijft de merge 38275 bytes. Volledig heropenen via `openForeign`
geeft exact dezelfde canon als de naad, maar een andere canon dan de ingevoerde planning. Er verschillen twaalf
tijdvelden op drie taken (late datums, earlyFinish en spelingen). Alle velden en waarden staan in
[duur-bewijs.log](1107-heropenkosten/duur-bewijs.log); de uitvoerbare bewijsbron staat ernaast in
[duur-bewijs.ts](1107-heropenkosten/duur-bewijs.ts). Het bewijs gebruikt de echte bron, de bestaande bewerking en de echte
store; er is geen afwijkende callback in die bewijsrun. `sourceFormProblems` en alle eerdere controles blijven actief.

## Eerste implementatie en grenzen

Signatuur: `writeIfcMerge(input, source, openPlanning: (read: ImportResult) => Promise<WriteIFCInput>)`.
`readPlanning` levert de lezing van de eigen uitvoer, met TimeModel, herkomst en opgeslagen datums. De callback van de
tests doet `openAsDocument` in een verse store met de flag aan en geeft `buildWriteIFCInput` terug. Er is geen pad of
bestandskop nodig voor die open-stappen. De open-route van de app zelf is ongewijzigd.
De nieuwe toets scant geen model en maakt geen buffer van de volledige uitvoer.

De bestaande writer-canon is naar `src/services/ifc/foreign/planningCanon.ts` verplaatst: schrijven van de planning zonder
vreemd deel; baselineregels zonder bestaande taak zonder taak-id; bestandskop en owner-historyklok tellen niet mee.
Tests en merge gebruiken deze ene maat. De bestaande `sourceFormProblems` blijft volledig staan; er is geen bewezen
overlap verwijderd. De melding benoemt een domeinpad en taak-id.

Productie meet de gelijkheid van de twee leeswegen niet opnieuw. De beoogde rechtvaardiging is: de niet-eigen stukken
worden apart byte-gelijk bewaakt, en de merge leest de planning met dezelfde lezer als de app. Trias eist daarnaast
bewijs van gelijkheid voor elke geslaagde merge in de telling, de tien oude eigen bestanden en een groot model.
**Dat volledige bewijs is nog niet geleverd; de implementatie is dus niet af en de aanvaardbaarheid is nog niet
vastgesteld.** De telling is al voorzien van de vergelijking, maar is nog niet gedraaid. De proef zonder bewerking en
het hierboven beschreven duurgeval bevestigen de gelijkheid alleen voor die gevallen.

## Mutaties

De kleine check `check-ifc-foreign-herleestoets.ts` is groen (exit 0). Hij toetst de ontbrekende callback, gelijkheid van
naad en bytes-route bij de ongewijzigde bron, en een bewust afwijkende callback die de taaknaam verandert (synthetische
proef buiten de bronvormtoets); hij meldt de echte duurweigering.

- Nieuwe vergelijking tijdelijk uit: de check is rood, exit 1, `Missing expected rejection`.
  [mutatie-toets-uit.log](1107-heropenkosten/mutatie-toets-uit.log).
- Ontbrekende-callbackweigering tijdelijk uit: rood, exit 1, `TypeError: openPlanning is not a function` in plaats van de
  vereiste getypeerde fout. [mutatie-verplicht-uit.log](1107-heropenkosten/mutatie-verplicht-uit.log).
- De aparte bewijsrun met vergelijking uit is groen, exit 0: bytes worden geschreven en volledig heropenen bevestigt de
  afwijking. Het groene oordeel betekent hier dat het bewijs van de afwijking slaagt.
- Bron vooraf gekopieerd buiten de worktree, beide mutaties met `cp` teruggezet, `cmp` exit 0 en gelijke SHA-256:
  `d82fed6367fe143fccde8e45df302d8f199a26f52afabf85145bb1485cc74679`.
  [herstel.log](1107-heropenkosten/herstel.log).

## Nog niet gedaan door de stop

Begintelling: 3263 bewerkingen, 2562 geschreven, 701 geweigerd, 0 anders; zie het eerdere kostenbewijs.
Geen eindtelling; het aantal overige nieuwe weigeringen is onbekend. Ook nog niet gedaan: gelijkheid over de tien oude
eigen bestanden, het model van minstens 10 MiB met een bewerking, de mutatie van de twee leeswegen, de herhaalde
kostenmeting op 5 en 10 MiB en de overige functionele regressiechecks. De bestaande meetscripts moeten ook nog de nieuwe
callback krijgen. De eerdere volledige heropening kostte 441/621 ms en gaf circa 11 s extra bij 300 MiB. Geen nieuwe
kostencijfers claimen. Geen volledige suite, productiebuild, browser, Tauri of 300 MB-run.

Advies: laat Trias eerst de betekenis van de eis "wat de planner zag" voor een gewijzigde maar nog niet doorgerekende
planning beoordelen. De eerdere tests vergeleken na normalisatie via `shownAfterOpen`; de nieuwe eis vergelijkt met de
werkelijk ingevoerde planning. Deze PR repareert dat verschil niet en maakt de vergelijking niet ruimer.

## Statische controles op de huidige code

`npm run typecheck`, `npm run lint`, `npm run verify:store-boundaries`, `npm run verify:cycles` en
`npm run verify:docs` zijn elk onder het gedeelde rekenslot geslaagd met exit 0. De kleine naadproef vóór de mutaties
staat in [naad-groen.log](1107-heropenkosten/naad-groen.log). `git diff --check` is schoon.

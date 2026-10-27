# F1b: herstel na reviewronde 3

De werkboom stond schoon op de voorgeschreven begincommit
`1d3d1f7b1db57775def5da746a8e2caf77a82cbd`, branch `claude/uren-f1b-urenfouten`.
De integratiebasis is niet opnieuw gemerged. De bestaande `node_modules` is behouden.
Node 22.23.4 en npm 10.9.9 zijn gemeten vóór de gerichte controles; de runs draaiden
achtereenvolgens. De codecorrectie staat in `75593922becfad311c586f39a760f2b9684d2b12`.

**Oorzaak en correctie.** De invoerroute `enterTaskProgress` accepteert woensdag 3 juni
18:00 als werkelijke start en daarna 100%. Beide actuals blijven terecht 18:00, duur
480 minuten en restduur 0. De voltooidtak van de solver snapt het berekende einde echter
naar 16:00. De FS-kalendertijdarm telde zijn 16 uur vanaf dat berekende einde en liet de
opvolger donderdag 08:00 beginnen; de werkelijke ondergrens is donderdag 10:00.

`relationMath.ts:688` gebruikt daarom in uitsluitend de FS/ELAPSEDTIME-arm het vastgelegde
`actualFinish` wanneer de voorganger voltooid is, de voorgangerkalender in uurmodus staat
en dat eindveld een expliciet tijdstip bevat. De bestaande lagoptelling en
opvolgerkalender bepalen daarna de start. De WORKTIME-arm is niet gewijzigd.

Een eerste poging in de voltooidtak van `CPMSolver.ts` veranderde vier bestaande
minutenmodelgevallen (run 1, exit 1). Die poging is met `cp` volledig teruggezet.
De definitieve correctie staat in de relatieberekening; beide minutenmodelruns hebben
daarmee exit 0 en hun bestaande vangnet is ongewijzigd.

**Overdracht aan F2: gewijzigde regels in `CPMSolver.ts`: geen.** Het hele bestand is
bytegelijk aan de begincommit, gecontroleerd met `cmp`, Git en SHA-256:
`6df87a61e96969e197ce43fae281984db61ec11d612340dadc9f83936f47c35e`.

**Regressie en mutatiebewijs.** De bestaande reviewbatterij is uitgebreid van 316 naar
352 controles. De zes nieuwe gevallen doorlopen de echte store-invoerroute: werkelijke
start woensdag 18:00, daarna 100%, gevolgd door FS +16 uur kalendertijd of FS +8 uur
werktijd, elk onder OPS, P6 en MSP. De controle bewaakt ook acceptatie, behoud van beide
actuals, voltooiing, de oorspronkelijke duur en nul restduur.

De goede `relationMath.ts` is met `cp` bewaard, de beginbron is met `cp` teruggezet en de
volledige `src`-diff tegenover de begincommit was toen leeg. De nieuwe batterij gaf
352 controles, precies drie fouten en exit 1: onder elk profiel donderdag 08:00 in plaats
van 10:00. De werktijdvariant slaagde ook met de oude bron. Na herstel met `cp` en controle
met `cmp`: 352 controles, nul fouten en exit 0. De oorspronkelijke reviewerprobe is
ongewijzigd opnieuw gebundeld en uitgevoerd: drie schendingen op de beginbron, nul na de
fix; exit 1 respectievelijk 0. Bronhashes en afzonderlijke uitkomsten staan in
[het bewijsbestand](review-ronde-3-bewijs.json).

**Definitieve uitkomsten, alle exit 0:**

- Reviewbatterij: 352/352.
- Acht casebatterijen: 279/279 — hours 31, hours-blokgrenzen 48, hours-relations 36,
  msp-pariteit 65, progress 33, lag-advanced 23, milestone-kinds 26 en milestones 17.
- Auto-start 135/135, F1-status 114/114 en DCMA 41/41.
- Beide minutenmodelruns, elk over alle 24 casebestanden van het CPM-schema. De bestaande
  afwijkingen komen exact overeen met `minute-model-runs.json`; dit is geen bewering
  dat elk minutenmodelgeval al gelijk is.
- `npm run typecheck`, `npm run lint` en de reviewerprobe `completed-clocklag.ts`.

FS +16 uur kalendertijd begint onder alle drie profielen donderdag 4 juni 10:00.
FS +8 uur werktijd blijft vrijdag 5 juni 08:00: de lag bereikt donderdag het blokeinde;
de gewone opvolger begint vervolgens op het volgende werkblok.

Niet uitgevoerd: de volledige planningssuite, tijdzone-matrix, `npm run verify`,
corpus-/profielmetingen, browsertests, Tauri-build, de aparte 42/288/192-reviewprobes en
de afzonderlijke IFC-, MSPDI- en P6-XML-round-tripprobes van de voltooide 18:00-taak.
Er is geen CI-eindoordeel vastgesteld en geen CI-bewaking gestart.

**Open na F1.** Het gemelde vervolg uit reviewronde 3 blijft buiten deze correctie:
werkelijke start woensdag 18:00, duur 8 uur en 50% geeft een getoond einde woensdag
12:00 onder OPS en P6. Volgens de review bestond dit al op `12abaabf2`; het is in deze
ronde niet opnieuw onderzocht of aangepast. Het staat ook onder “Open na F1” in de PR.
Geen nieuwe productbijvondsten en geen nieuwe knownbugs-nummers. Bestanden van F3a en
F3b zijn niet gewijzigd.

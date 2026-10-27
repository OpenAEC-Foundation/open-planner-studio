# F1b: herstel na reviewronde 4

De werkboom stond schoon op de voorgeschreven begincommit
`86bdc53c290d0f5b8e1d281e5564bbbe24bce1dd`, branch `claude/uren-f1b-urenfouten`.
De integratiebasis is niet opnieuw gemerged. De bestaande `node_modules` is behouden.
Node 22.23.4 en npm 10.9.9 zijn vóór de gerichte controles gemeten. De zware runs
draaiden achtereenvolgens. Code en regressies staan in
`3315b1b14b4d5653b2ddcda3555fced4989f9ea1`.

De afzonderlijke uitkomsten, exitcodes, bronhashes en letterlijke mutatiefouten staan in
[het bewijsbestand](review-ronde-4-bewijs.json).

**Oorzaak en correctie.** De FS/ELAPSEDTIME-arm koos het werkelijke einde opnieuw,
nadat de solver het relatievenster al had bepaald. Daarmee werden het C5-statusdatumpunt
en de C1-begrenzing omzeild. `relationMath.ts:687` telt weer vanaf `predResult.ef`;
de twee daardoor ongebruikte imports zijn teruggedraaid.

De correctie staat nu bij de gewone actual-pin in `CPMSolver.ts:2353`. Een expliciet
werkelijk einde blijft behouden wanneer de terugwaartse snap op dezelfde kalenderdag
blijft. Een snap over een daggrens houdt het bestaande gedrag voor weekend en bouwvak.
Bij het voltooide 18:00–18:00-geval houdt de bestaande inversiecorrectie vervolgens ook
de start op 18:00. Daarvoor is geen aparte startwijziging nodig. De bestaande C1- en
C5-conventies bepalen daarna gewoon het relatievenster.

**Letterlijke overdracht aan F2.** In `CPMSolver.ts` is uitsluitend één invoeging gedaan
tussen de oude regels 2352 en 2353. Voor elk van de vier nieuwe regels is de oude tekst
afwezig: er is geen bestaande regel vervangen, verwijderd, hernoemd of verplaatst.
De nieuwe regelnummers en tekst zijn:

```text
2353:           // Behoud de expliciete eindtijd bij een snap binnen dezelfde dag; weekend en bouwvak
2354:           // houden hun bestaande terugwaartse grens. Relatieconventies volgen pas na dit venster.
2355:           if (progressCal.isHourMode && t.actualFinish.includes('T')
2356:             && utcDayStart(ef).getTime() === utcDayStart(actualFinish).getTime()) ef = actualFinish;
```

**Regressies en mutatiebewijs.** De bestaande reviewbatterij bevat nu 439 controles:
352 bestaande plus 87 nieuwe. Op de productbron van exact `86bdc53c2` geeft zij 21 fouten,
exit 1, waaronder beide P6/C5-gevallen en C1. Beide goede productbestanden zijn met `cp`
bewaard; de beginbestanden zijn met `cp` teruggezet. De volledige `src`-diff tegenover
de begincommit was toen leeg. Na herstel van beide bestanden met `cp` en vergelijking
met `cmp`: 439/439, exit 0.

- Standaard P6-profiel, XER met `CP_Phys`, werkelijk einde 6 januari 17:00 en statusdatum
  14 januari: de gewone lagparser en `updateSequence` geven met FS +16eu een opvolgerstart
  op 14 januari 16:00; met +18eu op 15 januari 08:00. Dat zijn de uitkomsten van ronde 3.
- C1 expliciet aan, FS +0 kalendertijd: opvolgerstart 14 januari 08:00.
- De ongewijzigde oorspronkelijke reviewerprobe is opnieuw gebundeld en geeft onder
  OPS, P6 en MSP donderdag 4 juni 10:00, nul schendingen, exit 0.
- SS, FF en SF +18 uur kalendertijd vanaf woensdag 18:00 geven onder alle drie profielen
  donderdag 12:00: start bij SS, einde bij FF/SF. De actuals en beide kanten van het gewone
  voltooidvenster blijven 18:00.
- De vier gevallen die bij onvoorwaardelijk behoud afweken, blijven groen: einde in de
  bouwvak, volledig venster in de bouwvak, weekendvenster en voltooide mijlpaal met duur.
  Zij hebben daarnaast expliciete tijdvarianten in de reviewbatterij.

**Definitieve gerichte controles, alle exit 0:**

- Reviewbatterij 439/439.
- Acht casebatterijen 279/279: hours 31, hours-blokgrenzen 48, hours-relations 36,
  msp-pariteit 65, progress 33, lag-advanced 23, milestone-kinds 26 en milestones 17.
- Auto-start 135/135, status 114/114, DCMA 41/41 en conventies 379/379.
- Beide minutenmodelruns over alle 24 CPM-casebestanden, met ongewijzigd vangnet en
  ongewijzigde caseverwachtingen. De bekende afwijkingen blijven zichtbaar; er zijn geen
  nieuwe afwijkingen. Dit bewijst geen algemene gelijkheid van alle minutenmodelgevallen.
- `npm run typecheck`, `npm run lint` en de oorspronkelijke 18:00-reviewerprobe.

Niet uitgevoerd: de volledige planningssuite, tijdzone-matrix, `npm run verify`,
corpus-/profielmetingen, browsertests, visueel schermbewijs, Tauri-build, afzonderlijke
IFC-/MSPDI-/P6-XML-round-tripprobes, de afzonderlijke 32 conventievarianten en de
42/288/192-reviewprobes. Er is geen CI-eindoordeel vastgesteld en geen CI-bewaking gestart.

**Open na F1.** Het 50%-geval blijft open: werkelijke start woensdag 18:00, getoond einde
woensdag 12:00. Dit is in deze ronde niet opnieuw onderzocht of gewijzigd. De voltooide
18:00-gevallen met SS/FF/SF zijn wel hersteld. Geen nieuwe productbijvondsten en geen
nieuwe knownbugs-nummers. De bestanden van F3a en F3b zijn niet gewijzigd.

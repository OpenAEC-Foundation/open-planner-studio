# MPP lezen: de hiërarchie uit het outline-level en een gegenereerde WBS-code

`readTasks` sorteert de taken op hun `ID` en bouwt de boom met `assignHierarchyAndWbs`: een stapel op het
outline-level, waarbij een taak het kind wordt van de laatste taak met een lager niveau. Het veld met de ouder
(`PARENT_TASK_UNIQUE_ID`) leest de lezer niet. Reden, volgens het weggehaalde commentaar: MPXJ
`ProjectFile.updateStructure()` bouwt de boom op dezelfde manier, de volgorde op `ID` is die van de XML-export van
MS Project, en in het corpus kwam het ouderveld overal overeen met de stapel.

## Gevolgen

- MPP slaat een automatische WBS-code niet op; volgens het weggehaalde commentaar is het var-data-veld daarvoor in
  het corpus altijd leeg. `assignHierarchyAndWbs` genereert daarom een outlinenummering ("1", "1.1", "1.2.1"). Een
  niet-lege, door de gebruiker ingevoerde WBS-tekst wint voor die taak, maar de nummering van haar kinderen bouwt
  verder op de gegenereerde code van de ouder.
- Het ruwe outline-level is een SHORT (0 tot en met 65535) en stuurt de diepte van de stapel en de lengte van de
  WBS-code (één segment per niveau). `clampOutlineLevel` klemt het op 1 tot en met `MAX_OUTLINE_LEVEL` (256); een
  ontbrekend veld is niveau 1. Zonder klem gaf een gemaakt bestand met steeds oplopende niveaus kwadratisch veel
  WBS-tekst (volgens het weggehaalde commentaar ongeveer 461 MB piekgeheugen bij 20.000 niveaus). Een taak dieper dan
  de grens wordt een broer op niveau 256. `check-mpp-import.ts` (C1) toetst de grenzen van de klem en 20.000 taken
  die cyclisch tot voorbij de grens lopen: binnen de tijdslimiet en met hoogstens 256 segmenten per code.
- Een record dat te kort is voor `ID` krijgt het unique-id als `ID`.

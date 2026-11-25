# Uitgeschreven samenvattingsrelaties: synthetische ids en terugvouwen

Een relatie die `expandSummaryRelations` uitschrijft (ADR 0450), krijgt het id `${seq.id}::exp-<n>`, met n een
teller per oorspronkelijke relatie die over al haar paren doorloopt. Een echt relatie-id kan toevallig al zo eindigen,
en twee relaties met hetzelfde id zouden samenvallen in elke boekhouding op id, in de solver en daarna. Daarom begint
`usedIds` met alle oorspronkelijke ids, ook van relaties die verderop in de lijst staan, en telt n door tot een vrij
id; de eerste botsing in een aanroep geeft één `console.warn`. De solver weet niets van de uitklapping, dus zijn
velden op relatie-id dragen synthetische ids die de afnemers niet kennen: die lezen de relaties uit de store.
`solveProject` vouwt ze daarom met `foldSyntheticSequenceIds` terug op het oorspronkelijke id, op het resultaat zelf.
Een oorspronkelijke relatie is drijvend (`drivingSequenceIds`) als minstens één van haar bladrelaties dat is. Haar
vrije speling (`sequenceFreeFloat`) is het minimum over haar bladrelaties. `truncatedLeadSequenceIds`,
`outOfSequenceSequenceIds` en, als het er is, `droppedSequenceIds` worden verzamelingen van oorspronkelijke ids, geen
optelling: anders telt een kruisproduct van vijf paren in de statusbalk als vijf.

## Gevolgen

- `originalSequenceId` haalt alleen een achtervoegsel `::exp-` met cijfers aan het eind van het id weg; zonder dat
  achtervoegsel geeft het het id ongewijzigd terug, dus terugvouwen is idempotent. Een echt id met zo'n achtervoegsel
  vouwt ook terug (knownbug 2488). De rapporten die zelf met uitgeschreven relaties rekenen, vouwen met dezelfde
  functie terug (`scheduleHealth.ts`, `dcmaAssessment.ts`).
- Andere velden van `CPMResult` vouwt de functie niet terug. `boundarySequenceId` in `plannedFloorTraceByTaskId` kan
  een synthetisch id dragen; dat spoor leest alleen het testhulpmiddel `xerTaskReplayProduct.ts`.
- Alleen `solveProject` vouwt terug. `previewMoveProject` (`projectSlice.ts`), `progressPlannedDates.ts` en de
  benchmark (`runner.ts`) bouwen zelf een `CPMSolver` op uitgeschreven relaties en roepen `foldSyntheticSequenceIds`
  niet aan.
- Volgens het weggehaalde commentaar waren in het corpusbestand `870d339f60603f71` (niet in de repo) 114 van de 167
  drijvende relaties synthetisch; zonder terugvouwen vielen die uit elke weergave.
- `check-summary-relation-expansion.ts` toetst het voorvoegsel van de ids en het behoud van type en lag, de botsing
  (een echt id gelijk aan het eerste synthetische: geen dubbele ids, de echte relatie houdt haar id, de twee
  bladrelaties krijgen `::exp-1` en `::exp-2`), en per veld het terugvouwen, ook twee keer achter elkaar.

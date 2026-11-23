# De IFC-writer geeft elk GlobalId één keer uit, en bewaarde GlobalIds gaan voor

Waar een GlobalId vandaan komt (bewaard uit het ingelezen bestand, anders `ifcGuid128` van een seed met de soort als
voorvoegsel, met het project-id als zout voor hulpentiteiten en de projectkalender) staat onder *GlobalIds* in
`.claude/rules/tauri-ifc.md`. Hier staat wat de writer doet als twee objecten op hetzelfde GlobalId uitkomen. Een
hash kan botsen, en een bewaard GlobalId uit een ander programma kan toevallig gelijk zijn aan de hash van een nieuw
object. Twee entiteiten met hetzelfde GlobalId in één bestand breken elke lezer die op GlobalId koppelt, ook de
onze. Daarom geeft `issueGuid` in `ifcWriter.ts` alle GlobalIds van één schrijfronde uit en houdt het ze uniek.

## Gevolgen

- Per sleutel één GlobalId: een tweede vraag met dezelfde sleutel krijgt hetzelfde antwoord uit de cache van die
  schrijfronde.
- Eerst het bewaarde GlobalId (`preservedGuids`, uit `ImportResult.ifcGlobalIds`), zolang het in deze ronde nog niet
  is uitgegeven. Anders `ifcGuid128(seed)`. Is dat al uitgegeven of gereserveerd, dan probeert de writer
  `ifcGuid128(seed + '#dup1')`, `#dup2` enzovoort, tot er een vrij is. Dat blijft deterministisch.
- Gereserveerd zijn alle bewaarde GlobalIds (`reservedGuids`), ook als hun eigenaar pas later in het bestand aan de
  beurt is. Een nieuw object krijgt dus nooit het GlobalId van een bestaand object.
- Een GlobalId met `#dup` is alleen terug te vinden omdat de writer zelf opschrijft welk GlobalId hij gebruikte waar
  JSON naar een object verwijst: `TaskGuids` bij de baselines en `resourceCalendarGuid` bij de kalenderwandelingen.
  De lezer rekent het niet na (ADR 0046).
- `ifcGuid`, de oude 32-bits afleiding, gebruikt de writer niet meer. Hij blijft geëxporteerd omdat de lezer hem
  herberekent voor bestanden van vóór audit 2026-09-26.
- De soorten `wp` en `ws` zijn het werkplan en het werkschema (niet de baselinekoppen) van het project, met het
  project-id als sleutel. Het werkschema is het object waar 4D-koppelingen in andere pakketten aan hangen, dus het
  houdt zijn GlobalId bij elk opslaan.
- Toets: `check-ifc-globalid.ts`.

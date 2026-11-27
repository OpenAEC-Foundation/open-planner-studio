# Relaties toevoegen en verwijderen via MCP: fouten per item, en wat de hele aanroep laat falen

`planner_add_dependencies` beoordeelt elk item apart (`classifyDeps`) en weigert een fout item zacht, zodat de
geldige relaties in dezelfde aanroep blijven. `classifyDeps` weigert per item, in deze volgorde: een onbekend type
(`normalizeSeqType`), een lag die `parseLag` niet leest, een onbekende voorganger of opvolger, een relatie van een
taak naar zichzelf, een relatie met een eigen voorouder en een dubbele relatie. Een sleutel in een item die de tool
niet kent, toetst ze niet: die wordt genegeerd (knownbug 2533).

De hele aanroep faalt, ook voor de geldige items, bij een kring en bij elke fout van de transactie. De kring toetst
`addDependenciesCore` over de bestaande relaties en alle kandidaten samen (`validate.noCycle`), en dan is de fout
`CYCLE`. Toetsen: `cases-mutate-tasks.ts`, "add_dependencies: kring …" en "… kring via TWEE nieuwe relaties in één
call …", en `cases-summary-cycle.ts`, "add_dependencies: kring via een fase …". De kringtoets staat in de kern en niet
in het snelpad (ADR 0490). Een fout van de transactie zelf, zoals een eindberekening met een fout door een taak met
een onleesbare start, draait de relaties ook terug (ADR 0240).

## Gevolgen

- Een relatie van een taak naar zichzelf is een zachte weigering per item (`selfRelationReason`), zoals bij
  `planner_update_dependencies`. Ze komt zo niet bij de kandidaten van de kringtoets. Toets: `cases-mutate-tasks.ts`,
  "add_dependencies: zelfrelatie …" (de rest van de aanroep gaat door).
- Een verzameltaak mag een eindpunt zijn: de berekening past de relatie toe op haar bladtaken
  (`expandSummaryRelations`). Alleen een relatie tussen een taak en een eigen voorouder wordt geweigerd
  (`isAncestorRelation`, `ANCESTOR_RELATION_REJECTION`); de beschrijving van de tool zegt beide.
- Een dubbele relatie is een zachte weigering, tegen de bestaande relaties en tegen de eerdere items in dezelfde
  aanroep, op `relationKey` met het genormaliseerde type. Toetsen: `cases-mutate-tasks.ts`, "add_dependencies:
  duplicaat in dezelfde call …", en `cases-stille-noops-taken.ts`, "H1: dedup werkt over de NOTATIEGRENS heen …".
- De lag gaat eerst door `parseLag`: een lag die het niet kan lezen, weigert het per item in plaats van haar als 0 te
  nemen; een weggelaten lag is 0 (toetsen: `cases-stille-noops-taken.ts`, de gevallen K4). Op een nieuwe relatie zet
  `addDependenciesCore` uit `lagPatchOf` altijd `lagDays`, en `lagPercent` alleen bij een procentlag.
- `classifyDeps` weigert dezelfde vier gevallen als `relationVerdict`, de toets in `draft.addSequence` (een
  zelfrelatie, een onbekende taak, een eigen voorouder, een dubbele relatie). Geeft `draft.addSequence` toch `null`,
  dan wordt dat item zacht geweigerd met een reden die beide mogelijkheden noemt (dubbel, of een eindpunt zonder
  effect) en niet zegt dat de relatie al bestond.
- `planner_remove_dependencies` neemt de id's van relaties zoals de leestools ze geven (ADR 0400). Er is geen
  draftmethode voor: `removeDependenciesCore` haalt ze binnen de transactie weg met `store.setState` en
  `markDocumentEdited`; de transactie maakt de undo-stap en rekent door (ADR 0240). Een onbekend id is een zachte
  weigering.

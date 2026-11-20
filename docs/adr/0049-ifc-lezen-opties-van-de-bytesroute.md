# De bytes-route stuurt de IFC-lezer met vier opties; zonder die opties leest hij als vóór #804

Met de flag `ifcForeignContent` leest elke IFC-openroute bytes via `foreign/ifcBytesRoute.ts`: de scanner deelt het
bestand in en kiest de planning (`selectPlanning`). De lezer mag daarna niet zelf iets anders als planning zien dan
die indeling, anders lopen indeling en lezer uiteen. De route geeft daarom haar keuzes mee als leesopties in
`IfcReadOptions`, in plaats van dat de lezer ze opnieuw afleidt. Zonder deze opties (de flag uit, of een andere
aanroeper) leest `readIFC` precies zoals vóór #804. Ontwerp: `docs/superpowers/specs/2026-11-07-gebouwmodel-behouden-ifc-ifcx-design.md`
§4.2 tot en met §4.4 en §4.9.

## Gevolgen

- `literalStepIds`: de codering per entiteit. De lezer decodeert de STEP-strings van elke entiteit die hier niet in
  staat; de keuze voor het hele bestand (eigen versie `'0.1'` letterlijk, de rest gecodeerd) vervalt dan.
- `planningTaskStepIds`: de taken van `selectPlanning` als STEP-ids. De lezer leest precies die taken, in plaats van
  zelf de bomen onder een baselineschema uit te sluiten (ADR 0044). Met deze optie kiest de lezer ook de eigen
  owner history voor auteur en bedrijf (zie *Auteur en bedrijf* in `.claude/rules/tauri-ifc.md`).
- `stepIdsOut`: de lezer vult de kaart domein-id naar STEP-id, met dezelfde sleutels als `ifcGlobalIds`
  (`ifcObjectSeed`: `task`, `res`, `seq`, `cal`, `proj`, `wp`, `ws`; de projectkalender als `cal:cal-default`) en
  dezelfde keuzes: het eerste project, het eerste werkplan, het eerste werkschema dat geen baseline is. Ook objecten
  zonder GlobalId staan erin.
- `projectDataInSettings`: het `IfcProject` is niet het project van de planning (het hoort bij het model). Naam en
  omschrijving in `OPS_ProjectSettings` winnen dan van het `IfcProject`, ook leeg (NominalValue `$`); zonder de
  property blijft wat het `IfcProject` gaf. Auteur en bedrijf leest de bytes-route altijd uit die pset als ze er
  staan; deze optie houdt die lezing ook zonder planningsselectie.
- `projectTimestampFallback` (alleen interne merge-herlezingen) staat bij *Vergelijkingsklok* in
  `.claude/rules/tauri-ifc.md`.
- Toetsen: `check-ifc-foreign-open.ts`, `check-ifc-lexical-boundaries.ts`, `check-ifc-foreign-preserve.ts`.

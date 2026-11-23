# De IFC-writer beschermt de kop en schrijft verplichte tekst als lege string

Projectnaam, auteur en bedrijf komen van de gebruiker, uit een geïmporteerd bestand of uit de MCP-tool die het
project bijwerkt. In de kop (`FILE_NAME`) maakte een rauwe apostrof het bestand syntactisch ongeldig
(`FILE_NAME('O'Hara Tower.ifc',…)`), en een `DATA;` of `ENDSEC;` in de naam verzette de sectiegrens, zodat een
lezer nul entiteiten vond. Daarom gaan de drie waarden door `ifcStr`, en eerst door een kleine opschoning: elk
regeleinde en ander stuurteken (U+0000 tot U+001F en U+007F) wordt één spatie. Een regeleinde is in een STEP-string
ongeldig en zet de tekst erna aan het begin van een regel, waar een regel-verankerde lezer een `DATA;` als sectiegrens
leest. De opschoning geldt alleen voor die drie kopvelden. In de datasectie is de eigen scan quote-bewust (ADR 0041)
en blijft de tekst zoals de gebruiker hem schreef. De oude kop van vóór deze bescherming herkent de lezer apart
(*Oude eigen FILE_NAME-kop* in `docs/ifc-round-trip.md`).

## Gevolgen

- De vorm is `ifcStr(naam + '.ifc')`, niet `'${ifcStr(naam)}.ifc'`: die tweede zet aanhalingstekens om een waarde
  die al aanhalingstekens heeft.
- `FILE_NAME[1]` is volgens ISO 10303-21 de naam van het uitwisselingsbestand, niet de projectnaam. De writer neemt
  daarvoor `projectFileBase` van de opgeschoonde naam plus `.ifc`, dezelfde basis die de opslaandialoog voorstelt.
  Een naamloos project geeft zo `project.ifc` en geen kale `.ifc`.
- Zonder auteur of bedrijf staan in de kop `Open Planner Studio` en `OpenAEC Foundation`. Geen van de drie kopvelden
  is daardoor leeg, dus `ifcStr` geeft daar geen `$`.
- Een attribuut dat het schema verplicht stelt (niet OPTIONAL, of een WHERE-regel eist `EXISTS`), schrijft leeg als
  `''` en niet als `$` (`ifcRequiredStr`). Dat geldt voor de naam van `IfcPerson` en `IfcOrganization` in de owner
  history, `IfcProject.Name` (WHERE-regel `HasName`), de waarde in `IFCTEXT` bij een tekstveld (een getypte waarde
  draagt altijd een waarde), de naam van een eigen-veldwaarde en een activiteitcode, en de labels van een
  codetype. De lezer leest `''` en `$` als dezelfde lege tekst.
- Een naamloos project houdt in `IfcProject.Name` de lege string: daar hoort "geen naam", niet een verzonnen naam.
- Toets: `check-step-strings.ts` (apostrof, `DATA;` en `ENDSEC;` en een regeleinde in de kopvelden).

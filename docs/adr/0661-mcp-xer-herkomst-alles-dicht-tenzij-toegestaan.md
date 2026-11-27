# planner_inspect_xer_provenance: alles dicht tenzij toegestaan

`planner_inspect_xer_provenance` (`src/services/mcp/tools/xerProvenanceTools.ts`) toont gegevens uit het bewaarde
XER-bronarchief, waarin vrije tekst en persoonsgegevens uit een ander programma staan. Elke waarde die een sectie
teruggeeft, gaat door één poort, `sanitizeProvenanceValue`, die met een lijst van toegestane sleutels werkt
(`SAFE_LABEL_KEYS`) en niet met een lijst van verboden sleutels. Een vergeten sleutel in een verbodslijst lekt
(`text`, `memo`, `remark`, een geneste notitie, een sleutel die er later bij komt); een vergeten sleutel in de
toegestane lijst verbergt alleen. Zonder `includeRawRows` is een tekst onder een andere sleutel helemaal onzichtbaar,
ook in `summary`. Resourcenamen staan daarnaast achter `includeResourceNames` (eigenaarsbesluit, regel `xer`).

## Gevolgen

- Een bronrij wordt op haar vorm herkend (`isRawSourceRowLike`: een numerieke `line` en `cells` met alleen strings),
  niet op een vast aantal sleutels. Een eis van precies twee sleutels zou een rij met een extra veld, zoals `table`,
  als gewoon object doorlaten en elke cel als label tonen.
- Kolomnamen uit de `%F`-kop van het bestand worden afgekapt en tellen mee in de responsgrens, net als celwaarden
  (`projectSourceRow`, ook sleutels in `sanitizeProvenanceValue`): ze komen uit het bestand en kunnen dus ook groot
  zijn. Een afgekapte naam die met een andere samenvalt, krijgt een volgnummer (`uniqueTruncatedKey`).
- De grens meet echte UTF-8-bytes (`TextEncoder` in `finalizeBounded`), niet `String.length`, en de poort telt al
  tijdens het projecteren mee (`createByteBudget`), zodat één rij met duizenden cellen geen grote tussentekst opbouwt.
  Een pagina wordt eerst uitgesneden en dan pas gesaneerd (`paginateRaw`), zodat het werk met `limit` meegroeit en
  niet met de collectie.
- `rawSource` valt buiten die responsgrens en is per chunk begrensd; de toolbeschrijving noemt die uitzondering.

# Zoeken op de basis van de Immer-producer

Binnen een producer maakt de eerste lees-toegang tot een element van een draftlijst een Immer-proxy, die bij het afronden
weer doorlopen wordt. Een `findIndex` of `filter` over `s.tasks` of `s.assignments` kost zo per bewerking een proxy per
taak of toewijzing, en in een bulkbewerking selectie maal taken. Daarom zoeken `taskIndexById` en
`taskAssignmentDrafts` (`src/state/immerDraft.ts`) op de basis van de producer (`original`) en pakken ze alleen de
gevonden plekken uit de draft; klopt die plek niet meer, dan valt de functie terug op de gewone zoektocht op de draft.

## Gevolgen

- `taskAssignmentDrafts` is alleen exact zolang de producer `s.assignments` niet herschikte, aanvulde of inkortte;
  roep hem aan vóór zulke mutaties.

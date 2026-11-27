# Voortgang: statusdatum op vandaag en de restduur uit het bestand

Voortgang invullen via de UI zonder statusdatum zet de statusdatum op vandaag (`planProgressEntry` in
`src/engine/progressEntry.ts`, ADR 0154). Volgens het weggehaalde commentaar rekent de solver zonder statusdatum een
lopende taak vooruit met haar restduur maar achteruit met de volle duur, zodat haar speling te klein kan uitvallen.

## Gevolgen

- Lezers die `applyRemainingDuration` met `keepRecordedRest` aanroepen (via `src/services/importNormalize.ts`),
  houden de restduur die het bestand van een lopende taak vastlegt en leiden haar niet af uit het percentage; de
  XER-lezer leidt haar bij `CP_Drtn` wel af. Uit
  het weggehaalde commentaar, niet nagegaan: het percentage is in de bron vaak afgerond (MS Project 33 % bij 4 van
  6 d) of staat los van de rest (P6 fysiek %), dus een afleiding zou de rest verzetten. Een voltooide taak krijgt
  rest 0, en een bewerking in de app leidt de rest wel af.

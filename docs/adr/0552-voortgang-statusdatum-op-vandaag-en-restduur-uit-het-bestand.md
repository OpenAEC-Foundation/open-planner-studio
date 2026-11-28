# Voortgang: statusdatum op vandaag en de restduur uit het bestand

Voortgang invullen via de UI zonder statusdatum zet de statusdatum op vandaag (`planProgressEntry` in
`src/engine/progressEntry.ts`, ADR 0154). Zonder statusdatum rekent de solver een lopende taak vooruit met haar
restduur maar achteruit met de volle duur, zodat haar speling te klein kan uitvallen: in het project van
`check-progress-entry.ts` krijgt taak B op 50 % zonder statusdatum een speling van -1,5 dag en met de statusdatum op
vandaag 0.

## Gevolgen

- Lezers die `applyRemainingDuration` met `keepRecordedRest` aanroepen (via `src/services/importNormalize.ts`),
  houden de restduur die het bestand van een lopende taak vastlegt en leiden haar niet af uit het percentage; de
  XER-lezer leidt haar bij `CP_Drtn` wel af. Het
  percentage is in de bron vaak afgerond (MS Project schrijft `PercentComplete` als heel getal, dat `mspdiReader.ts`
  met `getElementInt` leest: 33 % bij 4 van 6 d) of staat los van de rest (P6 fysiek %, de eigen kolom
  `phys_complete_pct` in `xerReader.ts`), dus een afleiding zou de rest verzetten. Een voltooide taak krijgt
  rest 0, en een bewerking in de app leidt de rest wel af.

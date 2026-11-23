# Herstel op de desktop: opruimen binnen de eigen boekhouding

Op de desktop staan alle herstelbestanden in één appDataDir. Elke start en elke instantie van dezelfde build gebruikt
daar dezelfde naambasis, en de basis `recovery` van de productiebuild is een voorvoegsel van de basis van elke
dev-worktree (bevinding K5 in `docs/onderhoudbaarheid/README.md`). Vegen op voorvoegsel wiste daardoor bij twee vensters
elke ronde de snapshots van het andere venster, en vanuit de productiebuild de snapshots van elke dev-worktree. Een
auto-saveronde ruimt daarom op exacte naam op, en alleen wat in de eigen boekhouding staat. Welke namen dat zijn,
bepaalt `planRecoveryCleanup` met de naamherkenning van `recoveryNames` in `recoveryPaths.ts`
(`check-recovery-isolation.ts`, delen 1 tot en met 4, 6 en 9).

De regels van een manifest met een andere `ownerId` (`foreign` in `manifestOwnership`) zijn geen opruimkandidaat en gaan
mee in het nieuwe manifest (`carryOver`), omdat `loadTauri` bij een geldig manifest met regels alleen die regels
aanbiedt (ADR 0192). `instanceId` is per proces nieuw, dus ook het manifest van een vorige start heeft een andere
eigenaar. Het nieuwe manifest krijgt de eigen `ownerId`. Daarom onthoudt `saveTauri` de meegedragen snapshots in
`adoptedIfc`: anders zijn het in de volgende ronde regels van een eigen manifest en dus opruimkandidaat.
`heartbeatAt` wordt geschreven, maar beslist niet over wissen: een verse heartbeat is niet te onderscheiden tussen een
tweede venster dat nu draait en een proces dat net crashte, precies het geval waarvoor herstel bestaat. Elke drempel
kiest dus tussen het wissen van de bestanden van een levend venster en die van een crashslachtoffer. K5 stelde een
heartbeat voor; die is daarom niet als wisregel gebruikt.

## Gevolgen

- Een manifest zonder `ownerId` (`legacy`, een v1-manifest) valt onder de eigen opruiming. Het komt van een build zonder
  eigenaarschap, dus van een vorige start en niet van een gelijktijdige instantie; zonder die regel ruimde de eerste
  start na een update nooit meer op (`check-recovery-isolation.ts`, 4k en 4l). Om zo'n set uit te stellen, neemt
  `holdTauri` de regels eerst over in `adoptedIfc`; zonder dat vasthouden ruimde de eerste ronde ze op
  (`check-recovery-web-hold.ts`, het desktopdeel, geval 1).
- Een overgenomen snapshot (`adoptedIfc`) ruimt `planRecoveryCleanup` niet op, tenzij `saveTauri` hem als vervangen
  meegeeft (`replaced`): hij is aantoonbaar hersteld (`restoredIfc`, gezet door `holdTauri` voor de ids die
  `holdRecoveryForLater` meekrijgt) en zijn document krijgt in deze ronde een andere snapshotnaam. Een toevallig gelijk
  document-id van een vreemde of uitgestelde snapshot geeft dat recht niet. Wanneer die bescherming vervalt, staat in
  ADR 0191. Of een overgenomen regel mee gaat, hangt af van de mapscan (4i, 4i2 en 4j; een mislukte scan: knownbug 1994).
- Heeft een meegedragen regel hetzelfde document-id als een eigen document, dan laat `saveTauri` de meegedragen regel
  weg: twee regels met hetzelfde id zouden één document twee keer herstellen.
- Een halffabricaat (`.tmp`) wijst `planRecoveryCleanup` op exacte naam aan en niet met een sweep, omdat een andere
  instantie er op hetzelfde moment een kan schrijven (6a).

Drie routes ruimen op, elk met een eigen reden:

- Een auto-saveronde (`planRecoveryCleanup`): alleen de eigen boekhouding, zoals hierboven.
- Verwerpen en een herstel waarin alles is meegenomen (`planRecoveryClear` via `clearTauri`; 7a tot en met 7g, 9n en
  9o): breder dan de ronde en los van de eigenaar. Een stabiele snapshot die blijft staan, kan bij een latere terugval
  van `loadTauri` op de mapscan (ADR 0192) opnieuw als herstelkandidaat verschijnen, ook als het manifest haar niet
  noemde. Welke bestanden weggaan, bepaalt `planRecoveryClear`; dat kunnen ook bestanden zijn die de planner niet
  aangeboden kreeg.
- De schone afsluiting (`planRecoveryExitClear` via `clearOwnTauri`; 8a tot en met 8f, 9p en 9q): `planRecoveryExitClear`
  ruimt snapshotnamen uit `ownWritten` op en beschermt namen in `adoptedIfc`. Wat er bij een mislukte
  mapscan met het manifest gebeurt, staat in knownbug 1994. Bij afsluiten kunnen er uitgestelde of nog niet aangeboden
  snapshots staan, en daarover koos de planner niet.

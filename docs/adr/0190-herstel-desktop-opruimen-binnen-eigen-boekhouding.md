# Herstel op de desktop: opruimen binnen de eigen boekhouding

Op de desktop staan alle herstelbestanden in één appDataDir. Elke start en elke instantie van dezelfde build gebruikt
daar dezelfde naambasis, en de basis `recovery` van de productiebuild is een voorvoegsel van de basis van elke
dev-worktree (bevinding K5 in `docs/onderhoudbaarheid/README.md`). Vegen op voorvoegsel wiste daardoor bij twee vensters
elke ronde de snapshots van het andere venster, en vanuit de productiebuild de snapshots van elke dev-worktree. Een
auto-saveronde ruimt daarom alleen op wat in de eigen boekhouding staat, op exacte naam: `planRecoveryCleanup` neemt
als kandidaat de regels van het vorige manifest als dat van deze instantie is of geen `ownerId` heeft, plus wat deze
instantie zelf schreef (`ownWritten`), en raakt alleen namen met de naamvorm van de eigen basis aan
(`snapshotDocId`). Toets: `check-recovery-isolation.ts`, delen 1 tot en met 4.

De regels van een manifest met een andere `ownerId` (`foreign` in `manifestOwnership`) zijn geen kandidaat. Ze gaan mee in
het nieuwe manifest (`carryOver`) en worden als overgenomen onthouden (`adoptedIfc`), zodat ze bij de volgende start
nog als herstelkandidaat verschijnen. `instanceId` is per proces nieuw, dus ook het manifest van een vorige start valt
hieronder. `heartbeatAt` wordt geschreven, maar beslist niet over wissen: een verse heartbeat is niet te onderscheiden
tussen een tweede venster dat nu draait en een proces dat net crashte, precies het geval waarvoor herstel bestaat. Elke
drempel kiest dus tussen het wissen van de bestanden van een levend venster en die van een crashslachtoffer. K5 stelde
een heartbeat voor; die is daarom niet als wisregel gebruikt.

## Gevolgen

- Een manifest zonder `ownerId` (`legacy`, een v1-manifest) valt onder de eigen opruiming. Het komt van een build zonder
  eigenaarschap, dus van een vorige start en niet van een gelijktijdige instantie; zonder die regel ruimde de eerste
  start na een update nooit meer op (`check-recovery-isolation.ts`, 4k en 4l). Wordt zo'n set uitgesteld, dan neemt
  `holdTauri` de regels eerst over in `adoptedIfc`; anders verdwijnen ze na één ronde (`check-recovery-web-hold.ts`,
  het desktopdeel).
- Een overgenomen regel gaat mee zolang zijn snapshot in de mapscan staat (4i, 4i2 en 4j). In `planRecoveryCleanup` mag een
  overgenomen snapshot alleen weg als hij aantoonbaar hersteld is (`restoredIfc`, gezet door `holdTauri` voor de ids die
  `holdRecoveryForLater` meekrijgt) en zijn document in deze ronde een andere snapshotnaam krijgt (`replaced` in
  `saveTauri`). Een toevallig gelijk document-id van een vreemde of uitgestelde snapshot geeft dat recht niet. Wanneer
  de bescherming vervalt, staat in ADR 0191.
- Heeft een meegedragen regel hetzelfde document-id als een eigen document, dan laat `saveTauri` de meegedragen regel
  weg: twee regels met hetzelfde id zouden één document twee keer herstellen.
- Een halffabricaat (`.tmp`) gaat alleen weg op de exacte naam van een snapshot of blob in het nieuwe eigen manifest, van
  een opgeruimde kandidaat of van het manifest zelf, zodat een halffabricaat van een andere instantie blijft staan
  (`check-recovery-isolation.ts`, 6a).
- Archiefblobs volgen dezelfde boekhouding (`archiveRemovals`); een blob blijft zolang het nieuwe manifest, met de
  meegedragen regels, hem noemt (9i tot en met 9m).
- `planRecoveryClear`, voor Verwerpen en voor een herstel waarin alles is meegenomen, wist breder: elk bestand met de
  naamvorm van de eigen basis, ongeacht de eigenaar, plus elke snapshot en blob die het manifest noemt, ook als de
  mapscan leeg bleef. De planner
  koos net over precies die set, en een stabiele snapshot die blijft staan, kan via de terugval van `loadTauri` (ADR
  0192) bij een volgende start weer verschijnen (7a tot en met 7g, 9n en 9o).
- `planRecoveryExitClear`, voor de schone afsluiting (`clearOwnRecovery`), haalt alleen weg wat deze instantie schreef,
  nooit een overgenomen regel. Een eigen manifest wordt herschreven met de overgenomen regels die nog op schijf staan,
  of verwijderd als er geen overblijft; een manifest van een ander blijft staan. Reden: bij afsluiten kunnen er
  uitgestelde of nog niet aangeboden snapshots staan, en `planRecoveryClear` zou die ook wissen (8a tot en met 8f, 9p en
  9q).
- Een mislukte mapscan geeft een lege lijst (`listAppDataTauri`); wat dat met meegedragen regels doet, staat in knownbug
  1994.

# De rastertransactie: voorbereiden op een kopie, één keer vastleggen

Een bewerking in het taakraster (één cel, een geplakt blok, een invulreeks, een toewijzing, een relatie) komt in het
project via `runGridMutation` in `src/state/gridTransaction.ts`. We kozen voor twee fasen. `prepareGridMutation`
rekent de hele uitkomst uit op een Immer-kopie van de state (`produce` in `prepareGridWrites`), inclusief de
weergaverijen en de resourcebelasting, zonder de store te raken. `commitPreparedAgainstStore` legt die uitkomst daarna
vast in één storeproducer, met één geschiedenisstap (`recordDocumentDataHistoryDelta`). Geeft een write in de
transactie een fout, dan geeft het voorbereiden de verzamelde fouten terug en schrijft de transactie niets: een
geplakt blok is één bewerking en één undo-stap, en een half toegepast blok is lastiger te herstellen dan een
weigering. Een alleen-lezen cel die een plakactie overslaat, is geen fout (ADR 0443); welke botsing wel een fout is,
staat in ADR 0442.

## Gevolgen

- Is de momentopname na het voorbereiden gelijk aan die ervoor (`snapshotsEqual`), dan voert het vastleggen geen
  producer uit en maakt het geen geschiedenisstap; de meldingen van de transactie komen wel.
- Het vastleggen kijkt vóór de producer en nog eens erin of het actieve document hetzelfde is als bij het voorbereiden
  (`documentChanged`, en `commitFailed` als het in de producer misgaat). De producer is synchroon; meldingen komen
  erna, want `notify` doet zelf een `set()`. `check-grid-transaction.ts` (blok *Bronstructuur*) leest de brontekst en
  eist dat het voorbereiden geen `useAppStore`, `.setState(`, `.notify(`, `runCPM(` of `withTransaction` bevat, dat
  het vastleggen geen `async`, `await` of `Promise` bevat, precies één `set(` heeft en `activeDocumentId` vóór de
  producer toetst.
- De geëxporteerde naad `commitPreparedGridMutation` legt een voorbereiding vast die een aanroeper eerder met
  `prepareGridMutation` maakte; daartussen kan de store veranderen. Die naad vergelijkt daarom de momentopname van de
  store met die van het voorbereiden (`requireFreshBefore`, fout `stateChanged`). `runGridMutation` doet beide stappen
  synchroon achter elkaar en slaat die vergelijking over.
- `recordHistory: false` schrijft geen eigen geschiedenisstap: een omringende `withTransaction` neemt de bewerking op
  in zijn stap. De enige aanroeper is de spookregel van `FullTaskGrid`, die in één `withTransaction` ('Taak
  toevoegen') een taak aanmaakt en haar eerste waarde schrijft.
- `bindDefaultGridTransactionStore` bindt alleen de twee geëxporteerde wrappers (`runGridMutation`,
  `commitPreparedGridMutation`) aan de store. De slice (`createGridTransactionSlice`) gebruikt de `get` en `set` van
  zijn eigen context, zodat elke context uit `createAppStoreContext` tegen zichzelf werkt.
- Raakt de bewerking de belasting niet, dan hergebruikt het voorbereiden het vorige belastingresultaat
  (`resourceLoadInputsUnchanged` in `resourceLoadReuse.ts`); zonder vorig resultaat rekent het. Toets:
  `check-grid-resource-load-reuse.ts`.
- De indexen per transactie (taak per id, taakpositie per id, toewijzingen per taak, posities per taak in
  `orderWritesForDependentTransitions`) staan er om de rekentijd van een grote plakactie.
  `check-task-grid-paste-performance.ts` meet de mediaan van een plakactie van 2.000 taken bij 27 kolommen tegen een
  budget.

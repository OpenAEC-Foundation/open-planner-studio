# Alleen-lezen cellen in de rastertransactie

Een geplakt blok uit een spreadsheet of een volledige taakrij strijkt vaak over cellen die niet schrijfbaar zijn:
berekende kolommen, of cellen die op deze taak dicht staan (een WBS-code bij automatische nummering, de duur van een
mijlpaal). We kozen ervoor dat alleen een echte plakactie zulke cellen overslaat en de rest schrijft. Een losse
celbewerking en wissen met Delete of Backspace houden de harde weigering. Het raster zet het overslaan aan met
`planTaskGridPaste(…, { skipReadOnlyCells: true })` bij Ctrl+V in `FullTaskGrid`; dat zet `allowSkippingReadOnlyCells`
op de `PasteIntent`. `planTaskGridClear` geeft die optie niet mee. Of een cel schrijfbaar is, beoordeelt de transactie
op de eindtoestand van de taak, met de andere writes van dezelfde taak erbij (`applyCellEdits` in
`src/state/gridTransaction.ts`).

## Gevolgen

- Een kolom met `readOnly: true` (alleen kolommen uit `readonlyColumn`) heeft geen `parse`; `planTaskGridPaste` slaat
  haar al over en telt haar (`skippedReadOnlyCount`, `skippedReadOnlyTaskIds` op de `PasteIntent`). `applyCellEdits`
  heeft dezelfde tak als achtervang voor een andere aanroeper.
- Een cel met een `readOnly`-functie mag geschreven worden als ze in de beginstand schrijfbaar is, of als de andere
  writes van dezelfde taak haar schrijfbaar maken. De eigen write telt niet mee. Reden: anders zou een cel zichzelf
  kunnen openzetten, zoals de compacte notitiecel die door haar eigen write eerst de meerdere notities zou
  overschrijven.
- De transactie beoordeelt zo'n cel tegen de stand na elk begin van de reeks controllerwrites van die taak, in de
  volgorde van ADR 0442. Controllers zijn de vier kolommen in `CONTROLLER_COLUMN_IDS` (`task.isMilestone`,
  `task.isHammock`, `task.constraint.type`, `task.constraint2.type`); de projectie neemt alleen die vier mee en geen
  tussenliggende writes. De lijst wordt met de hand bijgehouden, want `readOnly` is een functie en geen lijst met
  afhankelijkheden. `check-grid-transaction.ts` (blok *Aanbeveling 4*) toetst dat de lijst in de brontekst precies
  deze vier bevat, welke kolommen in de registry een `readOnly`-functie, `parse` en `planWrite` hebben (buiten
  `assignment.*`), dat `task.childIds` en `task.manuallyScheduled` geen `parse` hebben, en dat `assignment.resources`,
  `assignment.unitsPerDay` en `assignment.curve` een `assignment-set` opleveren. Een nieuwe conditioneel schrijfbare
  kolom maakt die toets rood.
- Een `readOnly` die een ander veld leest dat in dezelfde plakactie verandert, ziet die wijziging dus niet.
  `task.time.start` is alleen-lezen zolang de taak een werkelijke start heeft (`startIsActual`), en `task.time.finish`
  bij een werkelijk einde (`finishIsActual`). Wist een plakactie de werkelijke start en zet ze een nieuwe *Start*, dan
  wordt de werkelijke start gewist en *Start* overgeslagen, met de melding hieronder.
- Een cel die zelf een controller is en een `readOnly`-functie heeft (nu alleen `task.isHammock`), toetst de
  transactie tegen elk begin van de reeks van alle andere writes van die taak.
- Met overslaan aan herhaalt de transactie de beoordeling tot er geen nieuwe overgeslagen cel bijkomt; elke ronde
  bouwt de controllerstanden opnieuw uit de writes die nog niet zijn overgeslagen. Zo telt een overgeslagen controller
  niet meer mee voor een andere cel. Voorbeeld uit `check-grid-transaction.ts` (blok *Napunt 2*): een
  samenvattingstaak met hangmat aan, geplakt met hangmat uit en duur 5 d. Beide cellen blijven ongewijzigd, met één
  melding met aantal 2. Zonder overslaan weigert de eerste cel die niet schrijfbaar is, met de code van
  `readOnlyValidationCode`.
- Na het vastleggen meldt de transactie het aantal overgeslagen cellen (die van het klembord plus die van de
  transactie), ook als er per saldo niets veranderde, anders lijkt de plakactie niets te doen. Alleen cellen die de
  transactie als alleen-lezen overslaat, tellen mee; een write die om een andere reden niets schrijft, geeft deze
  melding niet. Zo valt een waarde in *Resterend werk* op een taak in kalendertijd weg zonder fout en zonder melding
  (ADR 0445, knownbug 2485). Het is een weigering (`refusalNotice`, `notifications.pasteSkippedReadOnly`), ook als de
  rest wel geschreven is. De detailregels (`refusedNamesLine`) noemen apart de taken waarin niets geschreven is en de
  taken waarin een andere cel, een toewijzing of een relatie wel geschreven is. De melding heeft geen
  samenvouwsleutel: het aantal staat in de tekst, en twee plakacties zijn twee meldingen.
- De projectie van de taakkaart voor deze beoordeling maakt `applyCellEdits` één keer per taak en werkt daarna alleen
  het item van die taak bij; dat hoort bij de rekentijd uit ADR 0440.

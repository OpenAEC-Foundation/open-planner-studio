# Een document sluiten: wachten, invoer afronden en dan pas schoon toetsen

`closeDocument` zelf wacht niet op een lopende opslag. De routes van de planner gaan via `requestCloseDocument` (het
kruisje van een tabblad) of `closeDocumentAfterSaves` (de keuzes van de sluitvraag), die eerst op de schrijfrij wachten
(`AGENTS.md`, *Closing waits for saves*; #804 stap 3, besluit eigenaar 17 november 2026: wachten, dan sluiten).
`closeDocumentAfterSaves` beslist zelf niets over schoon of gewijzigd: dat doet `closeDocument` in één beurt, na het
wachten. `requestCloseDocument` neemt wel zelf de eerste beslissing, of de sluitvraag nodig is (hieronder).

## Gevolgen

- De volgorde in `closeDocument` staat op die ene plek: eerst open veldinvoer afronden, dan nagaan of het document nog
  bestaat, dan met `onlyIfClean` (*Opslaan* in de sluitvraag, fixronde 1 en 2 van #1008) of het schoon is, en dan pas
  verwijderen. De toets op schoon komt na het afronden (fixronde 2 van #1008): invoer die tijdens de opslag getypt werd,
  maakt het document bij het afronden gewijzigd, en dan blijft het open en geeft `closeDocument` `false`. Hoe die toets de
  vlag leest, staat in knownbug 1847.
- Het laatste document sluiten zet één vers, leeg document met een nieuw id neer (regel `state`). Een slapend document
  gaat alleen uit het register. Het actieve document wisselt eerst naar de buur: het volgende in de lijst, anders het
  vorige. In alle drie de takken verdwijnt de sessiegeschiedenis van het gesloten document
  (`removeSessionHistoryForDocumentFromState`).
- `waitForSavesBeforeClose` geeft `null` als `whenProjectFileWritesIdle` geen lopende of wachtende opslag ziet; dan wacht
  en toont hij niets. Anders geeft hij een belofte die klaar is als de rij leeg is, en staat `ui.savingBeforeClose`
  ("Wordt nog opgeslagen…") aan zolang minstens één aanroeper wacht (`saveWaitWithNotice`, een teller per storecontext).
  Na het wachten kan een nieuwe opslag begonnen zijn: `requestCloseDocument` roept zichzelf daarom opnieuw aan, en
  `closeDocumentAfterSaves` wacht in een lus tot de functie `null` geeft en roept dan in dezelfde beurt `closeDocument`
  aan.
- `requestCloseDocument` rondt zonder lopende opslag de invoer af en zet bij een gewijzigd document de sluitvraag
  (`ui.pendingCloseDocId`); anders sluit hij meteen.

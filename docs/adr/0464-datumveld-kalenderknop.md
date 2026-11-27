# De kalender in het datumveld

Het datumveld (`DateTextInput`, ADR 0460) heeft een eigen kalender (#904): de knop aan het eind van het veld, of
Alt+Pijl-omlaag in een vakje, opent `DatePickerPanel` (`src/components/common/DatePicker.tsx`). De knop zit niet in
de tabvolgorde (`tabIndex={-1}`), zodat Tab zoals bij elk ander veld in één stap naar het volgende veld gaat. Een
gekozen dag is, net als een geplakte volledige datum, één bewuste handeling: `pickDate` legt hem meteen vast, ook bij
`commitMode` `'blur'` (ADR 0461), en zet de focus terug in het veld. De gids `howto-datum-invoeren` beschrijft dat
voor de planner.

## Gevolgen

- Het paneel opent op de getypte datum als die al bestaat, anders op het datumdeel van `value` (`pickerValue`); bij
  een lege waarde kiest `DatePickerPanel` vandaag.
- `focusField` zet de focus terug op het vakje dat laatst actief was, vóórdat het paneel sluit. Zo valt de focus niet
  op `body`, want dan zou het veld als verlaten gelden en afronden.
- Escape in het paneel sluit zonder keuze en zet de focus terug (`onClose(true)`). Een klik ernaast sluit zonder de
  focus terug te zetten (`onClose(false)`); verlaat de focus daardoor de groep, dan rondt het veld af zoals bij elke
  andere blur (ADR 0463).
- Een muisklik op de knop verplaatst de focus niet: de mousedown op de groep doet voor de knop `preventDefault`.
- Het eerste blok van `tests/browser/date-picker.spec.ts` bewaakt de tabindex van de knop, een keuze als één
  undo-stap met de focus terug in het veld, Alt+Pijl-omlaag, Escape met de focus terug, openen op een getypte datum
  die nog niet is vastgelegd, en de klik ernaast die het veld afrondt.

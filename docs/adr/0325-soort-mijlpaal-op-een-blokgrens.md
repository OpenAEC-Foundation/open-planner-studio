# De soort mijlpaal op een blokgrens van een uurkalender

Een mijlpaal van MS Project staat op een kloktijd, bijvoorbeeld `…T17:00`, maar MSPDI en `.mpp` zeggen niet of het een
start- of eindmijlpaal is. De solver leest dat uit `milestoneKind` (`relationBoundaryFlags` in `relationMath.ts`:
`succIsFinishMs`, `predEndsBeginOfDay`). `milestoneKindAt` in `src/services/subdayIo.ts` leidt de soort af uit de
plek van het anker op een blokgrens, één keer voor `readMSPDI` en `readTasks` van de `.mpp`-lezer, zodat die twee niet
uit elkaar lopen; wanneer ze hem aanroepen, staat in ADR 0256 en 0286. Volgens het weggehaalde commentaar is het doel
dat de solver de klokstand van MS Project houdt in plaats van naar het eerstvolgende werkmoment (08:00 de dag erna)
te gaan; dat is in de solver niet nagegaan.

## Gevolgen

- Zonder `workTime` geeft hij niets. De weekdag komt uit `isoDayOfWeek` en de minuut van de dag uit de UTC-uren en
  -minuten van het anker, omdat de motor in UTC-momenten rekent; seconden tellen niet mee.
- Volgorde: een blok van die weekdag dat op die minuut begint, geeft `START`; anders een blok van die weekdag dat daar
  eindigt `FINISH`; anders een blok van de weekdag ervoor met een einde van 1440 of meer, waarvan het einde min 1440
  die minuut is, `FINISH`; anders niets. Twee blokken die op elkaar aansluiten, geven dus `START`; volgens het weggehaalde
  commentaar maakt dat voor de datum niets uit, omdat het gat tussen die blokken nul is (niet nagegaan).
- Een blok over middernacht staat bij de weekdag waarop het begint (`WorkTimeBands` in `src/types/calendar.ts`), dus
  zijn einde valt op de dag erna. De grens is 1440 of meer en niet meer dan 1440, omdat een blok dat precies om
  middernacht eindigt (20:00 tot 24:00) een gewone vorm is: `canonicalizeBands` ziet het niet als afwijking (ADR
  0320), en het anker 00:00 de dag erna moet `FINISH` geven.
- Hij kijkt alleen naar de blokken per weekdag van de kalender, niet naar feestdagen en werkende uitzonderingen
  (knownbug 2324).

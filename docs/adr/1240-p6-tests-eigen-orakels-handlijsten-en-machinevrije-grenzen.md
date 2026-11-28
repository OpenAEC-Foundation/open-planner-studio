# P6-tests: eigen orakels, lijsten met de hand en grenzen die niet van de machine afhangen

De tests van de P6-adapters meten de lezer tegen de bron en tegen P6's eigen opgeslagen uitvoer. Een meetlat die code
met de lezer deelt, maakt dezelfde fout als de lezer en ziet haar dan niet; het XER-plan
(`docs/superpowers/plans/2026-08-20-plan-xer-p6-lezer.md`, §3) noemt gedeelde veldkaarten daarom common-mode. De
orakels in `tests/planning/` delen dus bewust geen code met `src/services/xer/`, en verwachte lijsten staan er met de
hand in, ook waar dat dubbel lijkt. Maak ze niet korter door ze uit de productiecode of het conventieregister af te
leiden.

## Gevolgen

- `xerGroundTruth.ts` en `check-xer-progress-corpus.ts` importeren niets uit `src/services/xer/`; ze lezen de
  %T/%F/%R-regels zelf. `check-xer-resource-corpus.ts` (`scan`) en `check-xer-metadata-corpus.ts` (`countRaw`) tellen
  de ruwe rijen met een eigen teller en leggen pas daarna de productielezer ernaast.
- `xerScheduleOptionsGroundTruth.ts` leidt de verwachte rekenopties af uit de ruwe rijen: PROJECT en SCHEDOPTIONS,
  voor de projecteinddatum ook TASK, en voor nivelleren RSRCLEVELLIST, RSRC en RSRCRATE. De verwachte conventieset is
  een vaste lijst met de hand. Hij importeert alleen typen, niet `xerScheduleOptions.ts` of het register, zodat een
  wijziging daarin de verwachting niet meeschuift.
- `check-xer-field-whitelist.ts` noemt de zes kolommen van bak 4 nog een keer letterlijk naast
  `XER_TASK_RECORDED_OUTPUT`. Zo ligt de identiteit van alle zes namen vast, los van de constante die ook de
  isolatiescan en `check-leveling-input.ts` lezen.
- `check-xer-recorded-times.ts` 9 en 10 toetsen op de eigen fixture dat geen bak-4-waarde in `Task.time` komt;
  dezelfde fixture dekt de afronding, de eigen taakkalender en ontbrekende datumparen. De X12-proef
  (`check-xer-product-fidelity-x12.ts`) toetst daarnaast met gemuteerde bronuitvoer dat de solve niet verschuift en
  `recordedTimes` wel. Beide blijven: de korte check houdt het lek zichtbaar naast de cases van de lezer, de X12-proef
  bewaakt het hele contract.
- `check-xer-archive-scale.ts` meet tijd en piek-RSS, maar keurt er niet op. De poort is het aantal IFC-tekens per
  bronbyte (`MAX_IFC_CHARS_PER_SOURCE_BYTE`, 1,6), dat niet van de machine afhangt. De grens ligt onder 2, zodat een
  tweede kopie of een dubbele codering van het archief rood wordt. Dezelfde regel voor de herstelketen staat in
  `docs/xer-recovery-guardrails.md`.
- `check-conventions-boundary.ts` draait `verifyConventions` in het eigen proces, via een import op een berekend pad.
  Een letterlijk pad zou esbuild de poort in de testbundel laten trekken, en dan wijst haar `import.meta.url` niet meer
  naar `scripts/`; daarop valt de poort terug om het register te vinden (`keyRoot` in `scripts/verify-conventions.mjs`).
  Twee proeven draaien de poort wel als eigen CLI-proces.

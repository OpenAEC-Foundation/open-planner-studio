# MPP lezen: eenheden en afronding van tijdgefaseerd werk volgen MPXJ per formaat

De decoders in `mppTimephased.ts` rekenen de ruwe velden (indeling in ADR 0410) om naar minuten en volgen daarbij per
formaat letterlijk de stappen die het weggehaalde commentaar aan MPXJ toeschrijft (`getCompleteWork` en
`getPlannedWork` in `TimephasedDataFactory.java`), ook waar die twee van elkaar verschillen. De gatdetectie van de
splits (ADR 0414) vergelijkt het werk van een periode exact met 0, dus een kleine afwijking in de afronding kan van
een gat een werkperiode maken of omgekeerd. Een eigen, voor beide formaten gelijke afronding zou daar van MPXJ afwijken.

## Gevolgen

- Werk: het cumulatieve werk staat in duizendsten van een minuut. Het werk van een periode is het verschil met het
  vorige record, gedeeld door 1000.
- Verstreken tijd: de cumulatieve INT staat in tachtigsten van een minuut; gedeeld door 80 geeft dat werkminuten.
- Formaat A (`decodeRegularTimephasedWork`): het ruwe cumulatieve werk gaat eerst door `Math.trunc` (MPXJ: een
  `(long)`-cast) en pas daarna wordt het verschil genomen; dat verschil gedeeld door 1000 wordt afgerond op een seconde
  (`roundMinutesToSeconds`, op 1/60 minuut, naar MPXJ `roundMinutesToSeconds`). Zonder die stappen mist de exacte
  vergelijking met 0 een gat met een residu als 1e-13. `check-mpp-import.ts` (`[Z3 F3b]`) toetst de afkapping en de
  afronding elk met een eigen blok: een geval waarin alleen afkappen vóór het verschil 1/60 geeft, een residu van
  0,004 minuut dat 0 moet worden, en een verschil van 480,03 minuut met de verwachte afgeronde waarde.
- Formaat A, plafond: vóór de lus leest de decoder één keer de INT op absolute offset 24 (MPXJ
  `getInt(regularData, 24)`, binnen het totaalrecord). Is de ruwe verstreken waarde van een record, nog niet gedeeld
  door 80, kleiner dan 0 of groter dan dat plafond, dan telt ze als 0. `[Z3 F3a]` toetst dat een record met een
  verstreken waarde boven het plafond geen periode geeft.
- Formaat B (`decodePlannedRegularTimephasedWork`, N vanaf 1): geen afkapping, geen afronding en geen plafond. Volgens
  het weggehaalde commentaar mist `getPlannedWork` de afkapping en poort de decoder dat letterlijk. Het restwerk houdt
  dus het ruwe verschil, en de gatdetectie ziet daar alleen een gat als het cumulatieve werk exact gelijk blijft.
- Formaat B met N 0: het totale werk van de toewijzing is de DOUBLE op byte 16 gedeeld door 1000, zonder afkapping of
  afronding. Is dat 0, dan levert de decoder niets (MPXJ: "If the total work for the block is zero it's not valid").
  Hoe die ene periode op de as komt, staat in ADR 0413.
- Irregulier (`decodeIrregularTimephasedWork`): het werk is de duur tussen de twee tijdstempels in minuten (ADR 0413).

# MPP lezen: eenheden en afronding van tijdgefaseerd werk volgen MPXJ per formaat

De decoders in `mppTimephased.ts` rekenen de ruwe velden (indeling in ADR 0410) om naar minuten en volgen daarbij per
formaat letterlijk de stappen die het weggehaalde commentaar aan MPXJ toeschrijft (`getCompleteWork` en
`getPlannedWork` in `TimephasedDataFactory.java`), ook waar die twee van elkaar verschillen. De gatdetectie van de
splits (ADR 0414) vergelijkt het werk van een periode exact met 0, dus een kleine afwijking in de afronding kan van
een gat een werkperiode maken of omgekeerd. Een eigen, voor beide formaten gelijke afronding zou daar van MPXJ afwijken.

## Gevolgen

- Eenheden: het cumulatieve werk (een DOUBLE) staat in duizendsten van een minuut, de cumulatief verstreken tijd (een
  INT van 32 bits met teken) in tachtigsten van een minuut; gedeeld door 80 geeft dat werkminuten. Indeling en
  breedte in ADR 0410.
- Bij formaat A en B begint de vorige waarde van het werk en van de verstreken tijd op 0, niet op het totaalrecord of
  het samenvattingsblok: de eerste periode loopt van werkminuut 0 tot haar eigen cumulatieve waarde. Na elk record
  worden de vorige waarden die van dat record, ook als het geen periode gaf (ADR 0412): bij formaat A het afgekapte
  ruwe werk en de verstreken tijd na het plafond, bij formaat B het werk en de verstreken tijd na het delen.
- Formaat A (`decodeRegularTimephasedWork`), werk, in deze volgorde: de ruwe DOUBLE van elk record gaat door
  `Math.trunc` (MPXJ: een `(long)`-cast), dan wordt de afgekapte vorige ruwe waarde ervan afgetrokken, dan wordt het
  verschil gedeeld door 1000, en dat wordt afgerond op de dichtstbijzijnde seconde (`roundMinutesToSeconds`,
  `Math.round(minuten × 60) / 60`, naar MPXJ `roundMinutesToSeconds`). Zonder die stappen mist de exacte vergelijking
  met 0 een gat met een residu als 1e-13. `check-mpp-import.ts` (`[Z3 F3b]`) toetst de afkapping en de afronding elk
  met een eigen blok: ruwe waarden 0,99 en 9,32 waar alleen afkappen vóór het verschil 1/60 geeft, ruwe waarden 8000
  en 8004 waar de afronding 0 moet geven, en een verschil van 480030 met de verwachte afgeronde waarde.
- Formaat A, plafond: vóór de lus leest de decoder één keer de INT van 32 bits met teken op absolute byte 24
  (relatieve byte 8 van het totaalrecord; MPXJ `getInt(regularData, 24)`). Per record wordt de ruwe verstreken INT
  op relatieve byte 16, nog niet gedeeld door 80, met dat plafond vergeleken: kleiner dan 0 of groter dan het
  plafond telt als 0, anders wordt hij gedeeld door 80. `[Z3 F3a]` toetst dat een record met een ruwe verstreken
  waarde boven het plafond geen periode geeft.
- Formaat B (`decodePlannedRegularTimephasedWork`, N vanaf 1), werk, in deze volgorde: de DOUBLE van elk blok wordt
  eerst gedeeld door 1000, dan wordt de vorige omgerekende waarde ervan afgetrokken. Geen afkapping en geen
  afronding; volgens het weggehaalde commentaar mist `getPlannedWork` de afkapping en poort de decoder dat
  letterlijk. De gatdetectie (ADR 0414) vergelijkt dus het verschil van de twee omgerekende waarden met 0: twee ruwe
  waarden die na het delen door 1000 hetzelfde getal geven, zoals 1000.0000000000001 en 1000.0000000000002, geven
  werk 0 en dus een gat, ook al verschillen ze ruw.
- Formaat B, verstreken tijd: de INT op relatieve byte 24 wordt zonder plafond en zonder toets op het teken gedeeld
  door 80. Een waarde die lager is dan de vorige, geeft een negatieve lengte en dus geen periode (ADR 0412).
- Formaat B met N 0: het totale werk van de toewijzing is de DOUBLE op byte 16 gedeeld door 1000, zonder afkapping of
  afronding. Is dat exact 0, dan levert de decoder niets (MPXJ: "If the total work for the block is zero it's not
  valid"). Hoe die ene periode op de as komt, staat in ADR 0413.
- Irregulier (`decodeIrregularTimephasedWork`): het werk is het verschil van de twee tijdstempels in milliseconden
  gedeeld door 60.000, dus in minuten (ADR 0413).

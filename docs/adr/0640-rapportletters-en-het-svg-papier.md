# Rapportletters en het SVG-papier: eigen familienamen, een eigen lettertypelezer en afknippen op het venster

Voor de meegeleverde rapportletters meet en tekent het papier op het Rapport-tabblad op dezelfde letterbytes als de
vector-PDF (regel `reports`). Elke meegeleverde rapportletter staat daarom in de browser onder een eigen
`@font-face`-familie (`InterPDF`, `OpsReportLiberationSans`, `OpsReportCarlito`, `OpsReportArabic`; `REPORT_FONTS` in
`reportFont.ts`), niet onder haar echte naam. Een geïnstalleerde systeemletter met dezelfde naam, zoals "Liberation
Sans", mag nooit de plaats van de meegeleverde bytes innemen: de PDF bedt die bytes in, en de meting moet daarop
kloppen.

## Gevolgen

- De id van een letter in `REPORT_FONT_IDS` is opgeslagen in `ops-reportSettings`, en een onbekende id valt terug op
  `inter`. Een id hernoemen laat bestaande gebruikers hun keuze kwijtraken.
- Het eigen lettertype houdt bij elke nieuwe versie dezelfde familie (`OpsReportCustom`), zodat de fontstack
  (`reportFontStack('custom')`) vast blijft; de versie zit in `reportFontKey`.
- `customReportFont.ts` leest lettertypebestanden zelf, niet met fontkit. Fontkit wil het hele bestand, en voor de
  lijst van de computer zijn alleen de kop, de `name`-tabel en `OS/2` nodig: een paar kilobyte per bestand, tegen
  tot 20 MB voor een CJK-letter. De desktop leest de lettertypemappen daarom in stukken (`ByteReader`).
- `clipOpToWindow` (`svgDraw2d.ts`) knipt rechthoeken en rechte lijnen af op het venster van een blad, hoewel de
  geneste `<svg>` ze al afknipt. Chromium rastert elk element over zijn hele omhullende, en een rasterlijn of
  weekendband loopt over de hele hoogte van het rapport (bij 5000 taken 100.000+ px); één schermtegel kostte zo tot
  0,6 s (een trace in `docs/superpowers/specs/2026-11-07-rapport-tabblad-bevindingen.md`, "Oorzaak van de
  uitschieters"). Alleen wat binnen het venster pixel voor pixel gelijk blijft, wordt afgeknipt:
  geen boog, geen gesloten of gevuld pad, geen gestreepte rand, en een gestreepte lijn begint op een hele periode van
  haar oude begin.
- De letterklasse van een tekst is een hash van de CSS-letter zelf (`reportFontClass`), zodat één gedeelde stijlregel
  per letter alle bladen opmaakt (`paperFontRules.ts`). Elke nieuwe `<style>` laat de browser het hele document opnieuw
  opmaken; een `<style>` per blad was dus trager (zelfde document, "Wat er veranderde").
- Op een blad in een rechts-naar-linkstaal wisselt de serialisatie `text-anchor` `start` en `end` om
  (`svgDraw2d.ts`). Canvas en PDF houden `textAlign` links en rechts absoluut, maar in SVG hangt `text-anchor` aan de
  schrijfrichting; zonder de wissel zou rechts uitgelijnde tekst op het papier aan de andere kant staan dan in de PDF.

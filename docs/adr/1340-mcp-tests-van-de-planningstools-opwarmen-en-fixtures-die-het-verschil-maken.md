# MCP-tests van de planningstools: opwarmen en fixtures die het verschil maken

Veel bestanden in `tests/mcp/` beginnen met `addTask({ name: 'warmup' })` gevolgd door `undo()`. Dat lijkt een
regel zonder effect, maar een verse store heeft `calendars: []`, en het herstel van een snapshot (`snapshot.ts`, via
`syncProjectCalendar`) en `hydratePayload` zetten de projectkalender dan als nieuwe entry in de bibliotheek
(`promoteProjectCalendarToLibrary`). Zonder die opwarmstap verschijnt die eenmalige toevoeging bij de eerste rollback
of undo van een case als verschil in de store, en worden toetsen op een byte-identieke rollback of op de undo-stapel
rood om een reden die niets met de tool te maken heeft. De opwarmstap blijft dus staan.

## Gevolgen

- `cases-histogram.ts`, eis 6 (kalendertijdtaak), geeft `computeHistogramReport` een `to` ruim voorbij `earlyFinish`
  mee. Zonder `to` klemt `histogramWindows` het venster op de vroegste start en het laatste vroege einde van de taken,
  zodat belasting voorbij `earlyFinish` geen bucket heeft en de toets altijd groen zou zijn.
- `cases-resource-crud.ts` toetst de IFC-rondgang van een resource met een eigen bibliotheekkalender, niet met de
  projectkalender: alleen dan blijkt dat `calendarId` meegaat en niet terugvalt op de standaard.
- De fixtures in `cases-xer-provenance.ts` liggen bewust boven de grenzen van `xerProvenanceTools.ts`: `LONG_CELL`
  is langer dan `RAW_CELL_MAX_CHARS` (2000), zodat het afkappen per cel echt gebeurt, en `PROJ-CJK` blijft in
  UTF-16-eenheden onder `MAX_SECTION_RESPONSE_BYTES` maar gaat er in UTF-8-bytes (`TextEncoder`) ruim boven. De
  notities volgen de echte vorm van `Task['notes']` (een lijst objecten met `text`), niet een tekst, zodat een filter
  dat alleen naar de buitenste sleutel kijkt de toets niet haalt. Een kleinere fixture houdt de toetsen groen en laat
  ze niets meer bewijzen.
- `cases-progress-entry-ai.ts` pint via MCP dat een mijlpaal die met alleen een datum wordt afgemeld de kloktijd uit
  de planning houdt (`plannedMilestoneActual`, `milestoneMomentOn`): een losse mijlpaal zonder soort op 16:00 blijft
  16:00. Besluit van de eigenaar van 29 oktober 2026, omdat de mijlpaal anders bij afmelden naar het begin van de
  werkdag sprong.

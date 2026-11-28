# XER-kalenders: de basiskalender niet toepassen en het weekendherstel per record

`readXerCalendars` (`xerCalendarData.ts`) leest `base_clndr_id` en koppelt de basiskalender (`baseCalendarId`, met
`linkBaseCalendar` als niet-opsombare eigenschap `baseCalendar`, zodat overdracht en opslag alleen het id dragen),
maar past haar niet toe: een afgeleide kalender rekent alleen met haar eigen `clndr_data`. De reden: P6 schrijft de
geërfde werkweek en uitzonderingen al in de `clndr_data` van de afgeleide kalender, en een scan over 93 XER-bestanden
(8 met `base_clndr_id`, 157 afgeleide kalenders) vond geen geërfde dag die daar ontbrak (commit "docs(xer):
basiskalender bewust niet toegepast in de kalenderdecoder", uit de review van PR #109). Toepassen bouwen we pas als een bestand opduikt waarin de afgeleide kalender iets mist.

## Gevolgen

- **Weekendherstel.** In `rehab-2.xer` staan de dagen van een meerdaags vrij blok op maandag tot en met vrijdag
  geklemd: een zaterdag als de vrijdag ervoor, een zondag als de maandag erna, zodat het weekend in het blok
  werkdag zou worden. De decoder maakt zo'n zaterdag of zondag weer vrij en meldt dat met de herstelcode
  `WEEKEND_CLAMP_RECONSTRUCTED`. De meting in dat bestand staat in `docs/superpowers/plans/2026-08-20-plan-xer-p6-lezer.md`
  (etappe 7b, "n=1-basis"). De regel komt uit één bestand van 93, en MPXJ leest de uitzonderingen letterlijk
  (`TableContextReader.processCalendarExceptions`, zelfde plan, "n=1-basis"). Daarom beslist het bewijs op het record zelf, nooit de kalender als
  geheel: één toevallig dubbel record mag geen verre weekenddag vrij maken. `hasWeekendClampEvidence` eist een meerdaags blok en een vervolg van het blok aan de kant van
  het weekend af, plus de sprong over het weekend of een direct aangrenzend duplicaat; `weekendClampTarget` eist een
  zaterdag of zondag die op die kalender werkt en zelf geen uitzondering heeft. Een los dubbel record zonder blok
  verandert niets (`check-xer-calendar-data.ts` sectie 22). De poort filtert op bewijskracht en sluit niet elk geval
  uit (knownbug 2630); verruim haar niet zonder een tweede bestand dat de regel bevestigt.
- Redundante vrije records (een vrije uitzondering op een dag zonder werktijd, of een direct aangrenzende herhaling)
  bewaart de decoder alleen als diagnose in `p6NonWorkPenaltyDates`; een werkende uitzondering of een herstelde
  weekenddag haalt de datum eruit, zodat dezelfde vrije dag niet twee keer telt.
- De uren per dag zonder bronveld rekent `readXerCalendars` eerst in minuten per werkdag en deelt pas daarna door 60:
  zes dagen van 7,6 uur gaven in uren 7,6000000000000005, en dat telde als afwijking van de werkblokken.
- `decodeXerNoteText` (DEL-DEL wordt een regeleinde) draait alleen op de notitievelden in `P6_NOTE_FIELDS`
  (`xerTables.ts`), zodat die omzetting de structuurtekst van `clndr_data` niet raakt.

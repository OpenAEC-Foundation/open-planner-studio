# Een plafond op het aantal uitgeschreven samenvattingsrelaties

Een relatie tussen twee samenvattingen met N en M bladen geeft N×M bladrelaties (ADR 0450); twee samenvattingen van
elk 500 bladen geven er al 250.000. `MAX_EXPANDED_RELATIONS` (50.000) begrenst daarom het totaal dat
`expandSummaryRelations` in één aanroep over alle relaties samen uitschrijft, zodat de solver niet vastloopt of
zonder geheugen raakt, zoals de grenzen `MAX_SCAN` en `MAX_DAYS` in `CalendarEngine` een kalenderzoektocht begrenzen.
Past een relatie niet meer in wat er over is, ook niet na de snoei (ADR 0453), dan valt ze in haar geheel weg, nooit
een deel van haar bladrelaties: een deel zou een andere logica geven dan de relatie. Daarna valt elke volgende
relatie die uitgeschreven moet worden ook weg, ook een kleinere die nog zou passen. Zo slaagt een latere relatie niet
soms wel en soms niet afhankelijk van de volgorde. Welke relatie als eerste over het plafond gaat, hangt wel van de
volgorde af (knownbug 2487).

## Gevolgen

- Een relatie tussen twee bladtaken en een relatie met een onbekend taak-id tellen niet mee en gaan ook na het
  plafond door: hun aantal groeit hoogstens lineair. Een tak zonder bladen en een gedeelde bladtaak (ADR 0451) vallen
  weg zonder het plafond te raken.
- Bij de relatie die het plafond overschrijdt, schrijft de functie één `console.warn` met haar id en de omvang van
  haar kruisproduct; de volgende weggelaten relaties staan alleen in `droppedSequenceIds`. De waarschuwing noemt de
  waarde van `MAX_EXPANDED_RELATIONS`, ook als de aanroeper een lager plafond meegaf.
- De derde parameter `maxExpanded` is er voor de toetsen: `check-summary-relation-prune.ts` geeft een plafond net
  onder het kruisproduct mee om de snoei af te dwingen. Geen aanroeper in `src/` geeft hem mee.
- `check-summary-relation-expansion.ts` toetst een relatie van 300×300 bladen: ze valt in haar geheel weg, binnen
  een tijdgrens, en een kleinere relatie die vóór haar in de lijst staat, wordt volledig uitgeschreven.

# MPP lezen: kalenders zijn letterlijke bestandsdata

`readCalendars` (`mppCalendars.ts`) bouwt elke kalender uit de kalendersectie op `createDefaultCalendar()`, maar neemt daarvan niets over
wat het bestand niet zegt. `holidays` begint altijd leeg, ook voor een kalender zonder uitzonderingen, en
`description` is leeg, omdat een `.mpp` geen omschrijving per kalender kent en de standaardtekst dan onwaar zou zijn.
Dat wijkt bewust af van de MSPDI-lezer, die een kale `<Calendar>` de NL-feestdagen laat houden (ADR 0254): een
kalender uit de kalendersectie is nooit een stille standaard (alleen zonder leesbare kalendersectie komt de standaardkalender terug). Een kalender zonder naam heet `Kalender <uid>`, uniek per
kalender, waar de MSPDI-lezer terugvalt op één vaste naam.

## Gevolgen

- Een basiskalender zonder eigen kalenderdata neemt de projectbrede `DEFAULT_CALENDAR_HOURS` uit de Props voor zowel
  zijn week als zijn uitzonderingen; een afgeleide kalender zonder eigen data neemt die van zijn basis.
- De koppeling van resource aan kalender is asymmetrisch: een basiskalender koppelt alleen een resource-id groter dan
  0 die nog geen kalender heeft, een afgeleide kalender koppelt altijd, ook resource-id 0 (de plaatshouder van ADR
  0742). Zo doet MPXJ het ook (`AbstractCalendarFactory`): een koppeling op een basiskalender komt in echte bestanden
  voor, maar een afgeleide kalender gaat voor. `check-mpp-calendars.ts` toetst de basiskant met -1.
- De duur van een werktijdperiode in het dagblok en in het uitzonderingsblok wordt als 16 bits gelezen, hoewel de
  plaatsen 4 bytes uit elkaar liggen.
- `MAX_CALENDARS` begrenst het aantal kalenders per bestand, naast de grenzen per kalender van ADR 0293.
- `nameOf` onthoudt de naam per unique-id, ook als die ontbreekt, omdat veel kalenders naar dezelfde grote naamtekst
  kunnen wijzen (zie `getUnicodeString` in ADR 0740).
- `ownHolidayCountByUniqueId` telt bij een afgeleide kalender alleen de eigen vrije uitzonderingsreeksen, op een eigen budget
  (`newHolidayBudget`), zodat de telling het gedeelde budget van ADR 0293 niet verbruikt.

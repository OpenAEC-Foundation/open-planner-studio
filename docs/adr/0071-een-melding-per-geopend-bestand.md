# Eén melding per geopend bestand

Eén XER kan twaalf documenten openen, maar het blijft één bestandsactie van de planner. `applyOpenedImport` bouwt
daarom pas na de lus over alle documenten één openingsmelding voor het hele bestand, en de laadstap per document
(`applyLoadedProject`) meldt alleen wat bij dat document hoort. De melding wordt in lagen opgebouwd: de verslagmelding
van het formaat (`xerImportNotice`, anders `p6xmlImportNotice`, anders `msProjectImportNotice`), de
rekenprofielmelding, de regel over de datums zoals opgeslagen, de melding over een onbruikbaar XER-bronarchief als
buitenste laag, en tot slot `withOpenNoticeSticky`. Zo verdringt geen laag een andere: een nieuwe regel komt als
detailregel onder een bestaande melding en wordt alleen zelf een melding als er nog geen is.

## Gevolgen

- Alleen een verse import geeft een verslag. Een heropend eigen IFC met een XER-bronarchief draagt ook XER-gegevens,
  maar is het eigen projectbestand; de modus *Datums zoals opgeslagen* meldt zich daar via de strook.
- De regel over de datums zoals opgeslagen telt het aantal taken dat de opgeslagen datums toont
  (`recordedDates.total`), opgeteld over de geopende documenten, niet het aantal dat bij herberekenen zou verschuiven;
  dat noemt de strook. Draagt de melding al een eigen datumregel (de XER-regel), dan komt er geen tweede.
- Het XER-verslag neemt de bestandsbrede diagnostiek één keer uit het bronarchief, met de diagnostiek van een los
  resultaat als terugval. De regel over de tekencodering staat er alleen bij iets anders dan UTF-8 zonder BOM, en zegt
  niet dat er rijen zijn overgeslagen. De regel over niet-ondersteunde semantiek telt alleen de P6-rekenopties die naar
  een veilige standaard terugvielen, geen problemen in de resource- of metadatacatalogus. Activiteiten zonder geplande
  start die het projectanker kregen, staan erin omdat dat een keuze van de lezer is en geen feit uit het bestand.
- Een P6 XML-bestand met één project en niets bijzonders geeft geen verslag. Het verslag hergebruikt de formaatneutrale
  telregels van XER.
- Werkregels die door de bestandsdata zichtbaar worden terwijl de instelling uit staat, komen als detailregel met een
  eigen gidslink in dezelfde melding (`TASK_TYPES_DETAIL_LINE`), en alleen als eigen melding als er geen
  openingsmelding is. Een regel die de lezer alleen uit een importveld afleidde, ontsluit stil.
- Relaties die de solver niet kan meerekenen (een taak gekoppeld aan haar eigen samenvatting, een lege tak, de grens op
  het aantal uitgevouwen relaties) blijven in het document: eruit filteren zou bij openen en opslaan logica uit het
  bronbestand vernietigen. Ze komen wel één keer in een blijvende melding. Een relatie met een verzameltaak als
  eindpunt telt niet, die rekent gewoon mee. De telling komt rechtstreeks uit `expandSummaryRelations` op de gelezen
  taken, zodat ze niet afhangt van het moment waarop `cpmResult` is bijgewerkt.
- De melding over onderbroken of genivelleerde taken in een `.mpp` is informatief: de solver rekent die taken zoals MS
  Project, dus de melding zegt niet dat de datums onbetrouwbaar zijn.

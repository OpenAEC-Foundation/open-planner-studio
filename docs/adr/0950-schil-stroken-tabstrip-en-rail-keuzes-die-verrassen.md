# Schil: stroken, tabstrip en rail, keuzes die verrassen

In de gewone schil hebben de stroken onder het lint voor een modus (relatiemodus, splits-modus, datums zoals opgeslagen) geen kruisje
en geen timer: een modus verandert wat slepen of rekenen doet, dus de strook verdwijnt alleen als de modus uit gaat
(`DependencyModeNotice`, `SplitModeNotice`, `RecordedDatesNotice`; `NoticeStrip` zonder `onDismiss`). Bij de
splits-modus is de strook de volledige uitleg van het gebaar. Een weigering (`StructureLockedNotice`) is rood en heeft
geen timer, omdat een weigering die vanzelf weggaat te missen is.

## Gevolgen

- `StructureLockedNotice` verbergt zich bij een documentwissel: *Wissen* ruimt filter, groepering en sortering op,
  en die staan niet in de undo-stack, dus boven een ander document zou de knop iets onherstelbaars doen. De volgorde
  van de effecten is bewust: het verbergen bij een wissel staat vóór het teller-effect, zodat het bij mount een net
  getoonde strook niet wegdrukt; het effect op `clearedAt === seq` staat erna, zodat een poging die ná `clearRefusals`
  kwam blijft staan, ook als React beide wijzigingen in één commit verwerkt.
- De pijlknoppen van de documenttabs (`DocumentTabBar`) hebben `tabIndex={-1}`: het WAI-ARIA-tabspatroon geeft de
  tablist één tabstop, en de pijltoetsen, Home en End schuiven het actieve tabblad al in beeld. Ze houden een naam
  en tooltip voor muis, touch en spraakbediening.
- De sluitknop van een documenttab is een zuster van het element met `role="tab"`, geen kind
  (`DocumentTabControl`): zijn naam mag de toegankelijke tabnaam niet vervuilen.
- Of de tabs pijlen nodig hebben, meet `measureOverflow` (`DocumentTabBar`) tegen de breedte zónder pijlen, en de pijlen
  verdwijnen pas bij een marge vrije ruimte (`documentTabNeedsArrows` in `documentTabScroll.ts`); anders kan het verschijnen van de pijlen de uitkomst omkeren
  en flikkeren ze aan en uit.
- Het doel van een lopende vloeiende pijlklik vervalt ook na `PENDING_SCROLL_MS` (`DocumentTabBar`), omdat WebKit het
  `scrollend`-event niet kent (uit het weggehaalde commentaar, niet nagegaan).
- De statusbalk vouwt bij een andere breedte, tekstgrootte of letter opnieuw in dezelfde frame (`flushSync` in
  `useStatusFold.ts`): anders staat er één frame overloop in beeld.
- In de rechterrail (`RailPanel` in `RightRail.tsx`) staat het paneel met vaste hoogte op `flex: 0 1 auto` en hebben
  beide takken een `minHeight` van één kopbalk; de stapel krijgt met de waarschuwingssectie eronder een `minHeight`
  van één kopbalk per paneel. Zonder die klemmen knijpt een lage rail een paneel tot 0 px zonder dat iets dat
  aangeeft. De buitenste kaart van de rail is niet `overflow-hidden`, zodat de helft van de breedtegreep die boven de
  Gantt hangt zichtbaar blijft.
- `FileDropOverlay` staat in `App.tsx` buiten de `inert`-blokken en ook in de presentatiemodus: een inert element
  krijgt geen sleep-events, en zonder de luisteraars opent de browser een gesleept bestand zelf en verlaat hij de app.

# Filters

Het venster **Filteren** bepaalt welke taken zichtbaar zijn — in de Gantt én in het Tabel-tabblad. Een filter bestaat uit regels (veld + operator + waarde), eventueel gebundeld in groepen.

## Openen

**Beeld** → lintgroep **Weergave** → **Filteren…**. De knop licht op zolang er een filter actief is. **Esc**, het kruisje of een klik buiten het venster sluit zonder toe te passen.

## Groepen: alles of iets

Bovenaan elke groep kies je hoe de regels eronder samenwerken:

- **Alles hieronder (AND)** — een taak moet aan álle regels voldoen.
- **Iets hieronder (OR)** — voldoen aan één regel is genoeg.

**+ regel** voegt een regel toe; **+ groep** (alleen op het hoogste niveau) voegt een geneste groep toe, zodat je AND en OR kunt combineren — bijvoorbeeld "Kritiek is ja ÉN (Type is Bouw ÓF Type is Installatie)". Zonder regels toont het venster: "Nog geen regels — dit filter toont alles."

## Een regel: veld, operator, waarde

- **Veld** — alle taakvelden: WBS, Taaknaam, Duur, Start, Einde, Type, Kritiek, Totale speling, Voortgang, Mijlpaal, Vrije speling, Interfererende speling, Bijna kritiek, Speling-pad en Resources, plus de activity codes en eigen velden van het project.
- **Operator** — past zich aan het veldtype aan:
  - tekst: **is gelijk aan**, **is ongelijk aan**, **bevat**, **begint met**, **is leeg**;
  - getal en datum: daarnaast **kleiner dan**, **kleiner of gelijk aan**, **groter dan**, **groter of gelijk aan** en **tussen** (met **Van**/**Tot**);
  - ja/nee-velden (zoals Kritiek en Mijlpaal): keuze uit **Ja**/**Nee**;
  - keuzevelden (zoals Type of een activity code): **is een van**, met aanvinkbare waarden.
- **Waarde** — het invoervak volgt het veldtype (tekstvak, getal, datum of keuzelijst); bij **is leeg** is er geen waarde-invoer.

De prullenbak achter een regel verwijdert die regel; het kruisje rechtsboven in een geneste groep verwijdert de hele groep.

## Toepassen, annuleren en wissen

- **Toepassen** activeert het filter en sluit het venster. Een filter zonder regels geldt als "geen filter".
- **Annuleren** sluit zonder de wijzigingen door te voeren.
- **Wissen** zet het actieve filter direct uit en leegt de editor.

Een actief filter maakt deel uit van een opgeslagen layout — zie [Layouts opslaan/laden](docs://ref-layouts).

## Verder lezen

- [Kolommen kiezen](docs://ref-kolommen) — welke kolommen de tabel toont.

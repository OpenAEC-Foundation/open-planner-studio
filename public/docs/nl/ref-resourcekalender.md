# Resourcekalender

Het venster **Resourcekalender** bewerkt de eigen kalender van één resource — bijvoorbeeld een ploeg die vier dagen per week werkt. Het formulier is identiek aan dat van de [kalenderdialoog](docs://ref-kalenderdialoog); dit artikel beschrijft alleen de verschillen.

## Openen

- Open het resourcepaneel: **Resources** → lintgroep **Beheer** → **Resources** (volledig paneel) of **Resourcedock** (gedockt naast de Gantt).
- Kies in de kolom **Kalender** van een resource een kalender en klik op het potlood-icoon (**Bewerken…**) ernaast om die te bewerken; kies een nieuwe kalender aan te maken via dezelfde dropdown.

## Verschillen met de kalenderdialoog

- **Eén kalender per keer** — geen bibliotheek-lijst links, geen projectdefault-ster; alleen het formulier.
- **Toepassen** slaat de kalender op; **Annuleren**, **Esc**, het kruisje of een klik buiten het venster verwerpt de wijzigingen. Een nieuwe kalender via **+ Resourcekalender** in de dropdown bestaat pas na **Toepassen** en wordt dan meteen aan de resource gekoppeld (samen één stap voor Ongedaan maken); na **Annuleren** blijft er niets achter. Hij begint met dezelfde standaard als **+** in de kalenderdialoog.
- **Geen automatische herberekening** — **Toepassen** herberekent de planning niet. In zijn rol als resourcekalender verandert een kalender de CPM-datums niet; hij telt mee in de belasting (histogram) en de nivellering, die je zelf opnieuw uitvoert met F5 respectievelijk **Nivelleren…**. De dropdown biedt wel alle kalenders van het project aan: bewerk je hier een kalender die ook de projectkalender of een taakkalender is, dan verandert de planning wél. Ze wordt dan als verouderd gemarkeerd en F5 rekent haar opnieuw door.

## Velden

Zie de [kalenderdialoog](docs://ref-kalenderdialoog) voor de volledige veldbeschrijving: **Naam**, **Werkdagen** (met de presets Ma–vr en Continu (24/7)), **Begin** / **Einde** in 24-uurs HH:MM, niet-bewerkbare **Netto-uren per dag**, **Pauze begint** / **Pauzeduur**, de sectie **Werktijden** (met Urenplanning aan), **Feestdagen genereren…** en de lijst **Feestdagen**.

## Verder lezen

- [Kalenders & uren-planning](docs://gids-kalenders-uren) — wanneer een resourcekalender de juiste keuze is.
- [Resources, histogram & nivellering](docs://gids-resources-histogram) — hoe de kalender doorwerkt in belasting en nivellering.

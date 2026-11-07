# Openen en opslaan via de site

Doel: een planning openen en opslaan op de site waarin je de planner gebruikt, in plaats van op je eigen pc.

## Wanneer je dit nodig hebt

Je gebruikt de planner binnen de OpenAEC-omgeving op een site waar je al bent ingelogd. De planningen staan dan op die site, met hun versies. In de desktop-app en op de gewone website zie je dit niet; daar werken openen en opslaan zoals in [Een bestand openen en opslaan](docs://howto-bestand-openen-en-opslaan).

## Stappen

1. Kies *Start › Bestand › Openen* (Ctrl+O). Het venster *Openen van de site* toont de planningen op de site.
2. Klik op een planning. De nieuwste versie opent, en de planning staat daarna bij de recente bestanden met het label *Op de site*.
3. Werk aan de planning en druk op Ctrl+S. De app slaat een nieuwe versie op de site op, zonder venster.
4. Een nieuw project sla je op met Ctrl+S of *Opslaan als*. Het venster *Opslaan op de site* vraagt een naam. Klik op *Op de site opslaan*. Vanaf dan slaat Ctrl+S daar een nieuwe versie op.
5. Wil je een bestand van je eigen pc gebruiken, klik dan op *Van deze pc…* in het venster om te openen, of op *Op deze pc…* in het venster om op te slaan.

## Valkuilen en wat de app dan doet

**Een oudere versie opent als kopie.** Klik bij een planning op *Versies tonen* en dan bij een oudere versie op *Openen als kopie*. Die kopie heeft geen plek op de site. Opslaan maakt dus een nieuw bestand, en de nieuwste versie blijft zoals hij was.

**Iemand anders sloeg intussen op.** Dan slaat de app niet op en meldt ze: *Niet opgeslagen: '…' is op de site intussen door iemand anders gewijzigd.* Je wijzigingen staan nog in de app. Kies *Opslaan als* om ze als nieuw bestand te bewaren.

In de OpenAEC SuperCloud gaat dit anders: daar zet de site je werk in een kopie naast het bestand. De app meldt de naam van die kopie. Vanaf dan slaat Ctrl+S op in die kopie. Het bestand van je collega blijft zoals het was.

**Het bestand is alleen-lezen.** Soms mag je een bestand op de site niet wijzigen, bijvoorbeeld omdat iemand anders het bewerkt. De app opent het dan toch en meldt dat het alleen-lezen is. Je kunt het bekijken en bewerken. Opslaan maakt een nieuw bestand: de app vraagt eerst een naam.

**De site is niet bereikbaar.** Dan verschijnt *Opslaan mislukt* met de reden van de site erbij. Je wijzigingen blijven in de app staan en crashherstel bewaart ze ook.

**Een bestand uit Recent staat niet meer op de site.** Dan meldt de app *'…' staat niet meer op de site* en haalt ze het uit de recente bestanden. Bij een andere fout blijft het bestand in de lijst staan.

**Exporteren gaat altijd naar je eigen pc.** Een export (CSV, Excel, MS Project, P6, PDF) komt als download of via de bestandskiezer, niet op de site.

## Zie ook

- [Een bestand openen en opslaan](docs://howto-bestand-openen-en-opslaan): openen en opslaan op je eigen pc.
- [Automatisch opslaan aanzetten](docs://howto-automatisch-opslaan): staat uit voor een planning op de site; daar maakt elke opslag een nieuwe versie.
- [Herstellen na een crash](docs://howto-herstellen-na-een-crash): na herstel slaat Ctrl+S weer op dezelfde plek op de site op.

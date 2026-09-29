# Extensiepermissies

Elke permissie die een extensie in haar manifest kan opgeven: wat ze toestaat, wat er gebeurt als ze ontbreekt en wat je ervan ziet als je een extensie installeert. Hoe je extensies beheert en installeert, staat in [Een extensie installeren en beheren](docs://howto-extensie-installeren).

## Wat een permissie wel en niet is

Een permissie is een **opgave van de maker**: welke onderdelen van de app-interface de extensie wil gebruiken. Ze is geen afscherming. De code van een extensie draait in dezelfde omgeving als de app zelf en kan daardoor meer dan haar permissies zeggen: er is geen sandbox. De app zegt dat ook in het installatievenster. Installeer daarom alleen extensies van makers die je vertrouwt.

De app behandelt een permissie op drie manieren, en dat verschil is belangrijk:

**Hard afgedwongen.** Ontbreekt de permissie, dan geeft de bijbehorende methode een fout (bijvoorbeeld *Extensie "…" mist permissie: ribbon*) voordat er iets gebeurt.

**Waarschuwing.** Ontbreekt de permissie, dan werkt de methode nog wel, maar schrijft de app een waarschuwing in het log. In een toekomstige versie wordt het een weigering.

**Alleen informatief.** De permissie heeft geen bijbehorend stuk van de interface. De app toont haar bij de installatie en doet er verder niets mee.

Wat geen permissie nodig heeft, is de basis van de extensie-interface: het project, de kalender, de taken, de relaties, de resources en de toewijzingen lezen; taken en relaties toevoegen en taken aanpassen; een project laden, herberekenen en meerdere wijzigingen bundelen; eigen instellingen bewaren, eigen meegeleverde bestanden lezen en een melding tonen.

**Het manifest.** De permissies staan in het manifest als lijst. Een extensie die je nu installeert, met een permissie die deze app-versie niet kent, wordt geweigerd. Bij een al opgeslagen oudere extensie laat de app onbekende permissies vallen en meldt dat in het log.

## Hoe de app erom vraagt

Bij het installeren, uit de catalogus (*Bestand › Extensies › Bladeren › Installeren*) of vanuit een bestand (*ZIP* of *JS*), toont de app het venster *Extensie installeren?*. De vraag komt één keer, bij het installeren: niet bij elke keer dat je de extensie aanzet.

Het venster toont de naam, versie, beschrijving, auteur en, als die er is, de repository. Onder *Herkomst* staat waar de extensie vandaan komt (*Uit de online extensiecatalogus*, *Uit een ZIP-bestand op deze computer* of *Uit een JavaScript-bestand op deze computer*) en of de download is geverifieerd: met de checksum uit de catalogus, niet geverifieerd omdat de catalogus er geen geeft, of een bestand dat je zelf koos. Onder *Waar je ja tegen zegt* staat dat een extensie programmacode is die met dezelfde rechten draait als de app, en wat dat concreet betekent: in de desktopapp onder meer bestanden lezen en schrijven in je hele gebruikersmap, plus toegang tot je projecten, instellingen en klembord; in de browser toegang tot je opgeslagen projecten en instellingen, tot de bestanden waarvoor je toegang gaf en tot het netwerk.

Onder *Wat deze extensie zegt te gebruiken* staan de permissies uit het manifest, als korte labels met de naam zoals hieronder. Daarbij staat: *Dit is de opgave van de maker, geen beperking — de code kan hoe dan ook meer.* Heeft de extensie geen permissies, dan staat er *Niets opgegeven.* Voor twee permissies staat er een uitleg bij: *importSource* en *help*. De andere zes krijgen alleen hun label.

Met *Installeren* ga je akkoord. *Niet installeren*, Esc en klikken naast het venster weigeren de installatie.

## De permissies

**ribbon** — een knop in het lint plaatsen. Effect: de extensie mag een knop toevoegen aan een groep op een tabblad van het lint. Een extensie zonder deze permissie krijgt een fout als ze het probeert. De knoppen staan achteraan het gekozen tabblad, onder een groepslabel van de extensie, en verdwijnen als je de extensie uitzet of verwijdert. Standaard: niet toegekend; alleen wat in het manifest staat. Afdwinging: hard. Waar: op het tabblad dat de extensie koos.

**events** — de gebeurtenissen van de app volgen en zelf gebeurtenissen uitsturen. Effect: de extensie mag zich aanmelden voor en afmelden van gebeurtenissen en zelf gebeurtenissen uitsturen. De app zelf stuurt er drie: een project is geladen (na importeren, openen of laden door een extensie), een leeg project is aangemaakt en de planning is (opnieuw) berekend. Standaard: niet toegekend; alleen wat in het manifest staat. Afdwinging: hard. Waar: nergens; de extensie reageert op de gebeurtenis.

**backstage** — een importformaat aanbieden. Effect: de extensie mag een importer registreren; die verschijnt in *Bestand › Importeren*, waar je een formaat klikt en een bestand kiest. De ingebouwde formaten staan los hiervan (zie [Import- en exportformaten](docs://ref-import-exportformaten)). Standaard: niet toegekend; alleen wat in het manifest staat. Afdwinging: waarschuwing. Ontbreekt de permissie, dan werkt het registreren nog, met een waarschuwing in het log. Dat is een overgangsregime, omdat bestaande extensies de permissie niet altijd opgeven. Waar: *Bestand › Importeren*.

**pdf-fonts** — een lettertype leveren voor de PDF-export. Effect: de extensie mag een lettertypeleverancier registreren. De PDF-export gebruikt die voor tekens die de ingebouwde lettertypes niet dekken, zoals Chinese, Japanse en Koreaanse tekens. Standaard: niet toegekend; alleen wat in het manifest staat. Afdwinging: hard. Waar: in de PDF van een rapport; in het installatievenster staat alleen het label.

**importSource** — de oorspronkelijke bytes van een geïmporteerd bestand lezen. Effect: de extensie mag de volledige inhoud van het bronbestand opvragen van een geïmporteerd project (nu: een Primavera-bestand), ook de velden die de app bewust niet in je project overneemt, zoals audit- en herkomstvelden, kosten, review- en locatievelden. Dat is veel breder dan de rest van de interface en daarom een aparte permissie. Zonder de permissie leest de app geen byte van het bronbestand uit: elke methode geeft dan een fout, voordat er iets wordt opgehaald. Standaard: niet toegekend; alleen wat in het manifest staat. Afdwinging: hard, standaard geweigerd. Waar: in het installatievenster staat er een uitleg bij: *importSource — de volledige oorspronkelijke bronbytes van elk geïmporteerd bestand (bijvoorbeeld een rauw Primavera-bestand), ook velden die niet in het project terechtkomen.*

**help** — Help-artikelen en begeleiding toevoegen. Effect: de extensie mag Help-artikelen (tutorials) registreren en weer intrekken, een meegeleverd `.ifc`-bestand als nieuw document openen en een begeleiding starten en stoppen die onderdelen van de app aanwijst. Een meegeleverd project overschrijft nooit het document waar je in werkt: het opent als nieuw document, of neemt alleen een leeg, ongewijzigd tabblad over. Sinds contractversie 1.4.0. Standaard: niet toegekend; alleen wat in het manifest staat. Afdwinging: hard. Waar: in het venster *Help* (de artikelen), als nieuw tabblad (het project) en als een begeleiding die knoppen aanwijst. In het installatievenster staat er een uitleg bij: *help — mag Help-artikelen toevoegen, meegeleverde projecten als nieuw document openen en een begeleiding tonen die onderdelen van de app aanwijst.*

**filesystem** — de extensie zegt bestanden te gebruiken. Effect: geen; er is geen stuk interface aan gekoppeld, en de app kan het niet afdwingen. Standaard: niet toegekend; alleen wat in het manifest staat. Afdwinging: alleen informatief. Waar: als label in het installatievenster.

**network** — de extensie zegt het netwerk te gebruiken. Effect: geen; zoals *filesystem*. Standaard: niet toegekend; alleen wat in het manifest staat. Afdwinging: alleen informatief. Waar: als label in het installatievenster.

## Zie ook

- [Import- en exportformaten](docs://ref-import-exportformaten): de formaten die de app zelf kent, naast wat extensies onder *Bestand › Importeren* toevoegen.

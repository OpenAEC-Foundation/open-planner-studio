# Een extensie installeren en beheren

Doel: een extensie installeren, de toestemmingsvraag lezen, en de extensie later uitschakelen of verwijderen.

## Wanneer je dit nodig hebt

Een extensie voegt iets toe aan de app zonder dat je op een nieuwe versie hoeft te wachten. Een extensie kan bijvoorbeeld een importformaat toevoegen dat verschijnt in *Bestand › Importeren*, een knop in het lint zetten of een lettertype leveren voor de pdf-export. De officiële catalogus deelt ze in categorieën in: *Import/Export*, *Planning*, *Reporting*, *Utility*, *Fonts* en *Other*.

Denk goed na voordat je er een installeert. Een extensie is programmacode die draait met dezelfde rechten als de app zelf, en de app kan dat niet inperken. Daarom vraagt de app bij elke installatie om toestemming. Wat je in die vraag ziet, lees je hieronder.

## Stappen

### Een extensie uit de catalogus installeren

1. Kies *Bestand › Extensies*.
2. Kies het tabblad *Bladeren*. De app haalt de catalogus op terwijl er *Catalogus laden...* staat. Wat er in de catalogus staat, bepaalt de OpenAEC Foundation die hem beheert, en dat kan veranderen.
3. Zoek een extensie met het veld *Zoek extensies...*. Dat zoekt in naam, omschrijving, auteur en labels.
4. Elke kaart toont naam, versie, categorie, omschrijving en auteur. Klik op *Installeren*.
5. Het venster *Extensie installeren?* opent. Lees het, zie de volgende stap.
6. Klik op *Installeren* om door te gaan. Met *Niet installeren* gebeurt er niets. Esc of klikken naast het venster telt ook als weigeren, en de app toont dan geen foutmelding.

Na de installatie is de extensie meteen ingeschakeld. Op de kaart in *Bladeren* staat nu *Geïnstalleerd*. Wat de extensie toevoegt, zie je in de app zelf: een nieuwe knop in het lint, of een importformaat in *Bestand › Importeren*. Sommige extensies tonen ook een melding. Die herken je aan het voorvoegsel *Extensie* met de naam van de extensie.

### Een extensie uit een bestand installeren

Heb je een extensie als bestand gekregen, dan installeer je die zo.

1. Kies *Bestand › Extensies*.
2. Klik rechtsboven op *ZIP* voor een ZIP-bestand, of op *JS* voor een los JavaScript-bestand.
3. Kies het bestand. Het venster *Extensie installeren?* opent, zoals hierboven.

Een ZIP-bestand moet een `manifest.json` en het hoofdbestand van de extensie bevatten. Installeer je een extensie die al geïnstalleerd is, dan vervangt de nieuwe versie de oude. Kan de app het bestand niet installeren, bijvoorbeeld omdat een ZIP-bestand beschadigd is, dan gebeurt er niets: de app toont bij ZIP en JS geen foutmelding en de extensie komt niet in de lijst. De reden staat wel in de debug-terminal. Zet die aan met *Instellingen › Project › Instellingen*, tabblad *Geavanceerd*, *Debug-terminal inschakelen*, en open hem met de knop *Debug-terminal tonen* in de statusbalk. Daar staat dan bijvoorbeeld *[Extensies] ZIP-installatie mislukt: Error: Geen manifest.json gevonden in ZIP*.

### De toestemmingsvraag lezen

De vraag laat zien wat je nodig hebt om te beslissen.

- *Auteur* en *Repository* zeggen wie de extensie maakte en waar de broncode staat.
- *Herkomst* zegt waar het bestand vandaan komt: *Uit de online extensiecatalogus*, *Uit een ZIP-bestand op deze computer* of *Uit een JavaScript-bestand op deze computer*. Daaronder staat of het bestand gecontroleerd is. Bij de catalogus staat er *Download geverifieerd met de checksum uit de catalogus.* Heeft de catalogus geen checksum, dan staat er in het rood *De catalogus geeft geen checksum — deze download is niet geverifieerd.* Bij een bestand van jezelf staat er *Je koos dit bestand zelf; er is geen externe bron om tegen te verifiëren.*
- *Waar je ja tegen zegt* zegt: *Een extensie is programmacode die draait met dezelfde rechten als Open Planner Studio zelf. Er is geen afscherming die dat inperkt. Installeer alleen extensies waarvan je de maker vertrouwt.* Daaronder staat wat dat op jouw platform betekent. In de desktop-app staat *In de desktop-app betekent dat onder meer: bestanden lezen en schrijven in je hele gebruikersmap, plus toegang tot je projecten, instellingen en klembord.* In de browser staat *In de browser betekent dat: toegang tot je opgeslagen projecten en instellingen, tot de bestanden waarvoor je toegang gaf, en tot het netwerk.*
- *Wat deze extensie zegt te gebruiken* toont de toestemmingen die de maker opgaf, als kleine labels. Dat is een opgave van de maker en geen beperking: *Dit is de opgave van de maker, geen beperking — de code kan hoe dan ook meer.* Staat er geen label, dan staat er *Niets opgegeven.* Dat betekent niet dat de extensie niets kan: ook zonder labels kan een extensie de gegevens van je planning lezen en wijzigen en meldingen tonen.

De labels betekenen dit:

- *ribbon*: de extensie zet knoppen in het lint.
- *events*: de extensie luistert mee met gebeurtenissen in de app.
- *backstage*: de extensie voegt importformaten toe aan *Bestand › Importeren*.
- *pdf-fonts*: de extensie levert een lettertype voor de pdf-export.
- *importSource*: de extensie mag de volledige oorspronkelijke bytes lezen van elk bestand dat je importeert, bijvoorbeeld een ruw Primavera-bestand, ook velden die niet in je project terechtkomen. Het venster legt dit zelf ook uit.
- *help*: de extensie mag Help-artikelen toevoegen, meegeleverde projecten als nieuw document openen en een begeleiding tonen die onderdelen van de app aanwijst. Het venster legt dit zelf ook uit.
- *filesystem* en *network*: dit zijn alleen aanduidingen van wat de maker van plan is. De app heeft er geen functie voor.

### Een extensie uitschakelen, weer inschakelen of verwijderen

1. Kies *Bestand › Extensies* en het tabblad *Geïnstalleerd*. Elke extensie heeft een kaart met naam, versie, categorie, omschrijving en auteur.
2. Met de schakelaar op de kaart schakel je de extensie uit (*Uitschakelen*) of weer in (*Inschakelen*). Uitgeschakeld verdwijnen de knoppen en importformaten die de extensie toevoegde, maar de extensie blijft geïnstalleerd. Ze blijft ook uit na een herstart van de app. Een ingeschakelde extensie start bij het opstarten van de app vanzelf.
3. Klik op *Verwijderen*. De knop verandert in *Bevestig*, met de uitleg *Klik nogmaals om definitief te verwijderen*. Klik nog een keer om de extensie te verwijderen. De app ruimt ook de instellingen op die de extensie bewaarde.

## Valkuilen en wat de app dan doet

**De catalogus laadt niet.** Er staat *Catalogus kon niet geladen worden:* met de technische reden erachter, en de knop *Opnieuw proberen*. Dat kan komen doordat je geen internetverbinding hebt.

**Er staat *Installatie mislukt.* onder een kaart in de catalogus.** De download of de installatie is mislukt, bijvoorbeeld omdat de checksum niet klopte. Er is dan niets geïnstalleerd. Dat is iets anders dan de vraag weigeren: dan staat er geen foutmelding.

**Er staat *Overgeslagen catalogusitems: 1* boven de lijst.** De catalogus bevatte een item dat de app niet kan gebruiken. De andere extensies kun je gewoon installeren.

**Een extensie start niet.** De kaart toont dan een foutmelding, bijvoorbeeld dat de extensie een nieuwere versie van Open Planner Studio nodig heeft, met je huidige versie erbij, of de fout die de extensie zelf gaf. De extensie is dan niet actief. Werk de app bij, of verwijder de extensie.

**Een kaart met *Quarantaine*.** De app kon de opgeslagen extensie niet gebruiken. Onder de naam staat *Reden:* met de oorzaak. Met *Uit opslag verwijderen* ruim je hem op.

**Een extensie hoort niet bij een project.** Extensies staan in de app: in de desktop-app op deze computer, in de browser in de opslag van die browser. Ze gelden voor al je projecten en zijn geen onderdeel van je projectbestand. Wis je in de browser de sitegegevens, dan zijn de extensies weg.

## Zie ook

- [De app bijwerken](docs://howto-app-bijwerken): een extensie kan een nieuwere versie van de app vragen.
- [Extensiepermissies](docs://ref-extensiepermissies): wat elke permissie in de installatievraag betekent.

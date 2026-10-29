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

**Tutorials.** De tutorials zijn een extensie. Zie je in *Help* onder *Tutorials* de knop *Tutorials installeren*, dan opent die *Bestand › Extensies* op *Bladeren*. Ook de vraag na de eerste rondleiding installeert deze extensie. Beide routes tonen dezelfde toestemmingsvraag; je kunt hem weigeren.

### Een extensie uit een bestand installeren

Heb je een extensie als bestand gekregen, dan installeer je die zo.

1. Kies *Bestand › Extensies*.
2. Klik rechtsboven op *ZIP* voor een ZIP-bestand, of op *JS* voor een los JavaScript-bestand.
3. Kies het bestand. Het venster *Extensie installeren?* opent, zoals hierboven.

Een ZIP-bestand moet een `manifest.json` en het hoofdbestand van de extensie bevatten. Installeer je een extensie die al geïnstalleerd is, dan vervangt de nieuwe versie de oude.

Kan de app het ZIP- of JS-bestand niet installeren, bijvoorbeeld omdat een ZIP-bestand beschadigd is, dan toont de app de foutmelding *De extensie kon niet worden geïnstalleerd. Controleer het bestand en probeer opnieuw.* Annuleer je de bestandskeuze of weiger je de toestemmingsvraag, dan verschijnt er geen foutmelding.

Aanvullende technische details staan in de debug-terminal. Zet die aan met *Instellingen › Project › App-instellingen*, tabblad *Geavanceerd*, *Debug-terminal inschakelen*, en open hem met de knop *Debug-terminal tonen* in de statusbalk. Daar staat dan bijvoorbeeld *[Extensies] ZIP-installatie mislukt: Error: Geen manifest.json gevonden in ZIP*.

### De toestemmingsvraag lezen

De vraag laat zien wat je nodig hebt om te beslissen.

- *Auteur* en *Repository* zeggen wie de extensie maakte en waar de broncode staat.
- *Herkomst* zegt waar het bestand vandaan komt en of het gecontroleerd is. Staat er in het rood dat de download niet is geverifieerd, installeer dan alleen als je de bron kent.
- *Waar je ja tegen zegt* herhaalt dat een extensie programmacode is die met dezelfde rechten draait als de app zelf, en wat dat op jouw platform betekent. Installeer alleen extensies waarvan je de maker vertrouwt.
- *Wat deze extensie zegt te gebruiken* toont de permissies die de maker opgaf, als kleine labels. Dat is een opgave en geen beperking. Staat er *Niets opgegeven.*, dan kan de extensie nog steeds de gegevens van je planning lezen en wijzigen.

Wat elk label betekent en de letterlijke teksten van het venster staan in [Extensiepermissies](docs://ref-extensiepermissies).

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

**Zelf een extensie schrijven.** De handleiding voor extensie-auteurs (manifest, API, permissies) staat in de repository `OpenAEC-Foundation/open-planner-studio` op GitHub, in het bestand `docs/extensions.md`.

**Een extensie hoort niet bij een project.** Extensies staan in de app: in de desktop-app op deze computer, in de browser in de opslag van die browser. Ze gelden voor al je projecten en zijn geen onderdeel van je projectbestand. Wis je in de browser de sitegegevens, dan zijn de extensies weg.

## Zie ook

- [De app bijwerken](docs://howto-app-bijwerken): een extensie kan een nieuwere versie van de app vragen.
- [Extensiepermissies](docs://ref-extensiepermissies): wat elke permissie in de installatievraag betekent.

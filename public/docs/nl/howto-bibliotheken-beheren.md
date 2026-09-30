# Resourcebibliotheken beheren en delen

Doel: resourcebibliotheken aanmaken en verwijderen, kalenders erin zetten, en een bibliotheek exporteren of importeren, als back-up of om hem op een andere computer te gebruiken.

## Wanneer je dit nodig hebt

De bibliotheek staat niet in je projectbestanden maar in de app: in de desktop-app in een bestand op deze computer, in de browser in de opslag van die browser. Hij wordt niet gesynchroniseerd. Wis je in de browser de sitegegevens, dan is de bibliotheek weg; exporteer hem dus als back-up. Wil een collega met dezelfde ploegen en tarieven werken, dan lever je de bibliotheek ook als bestand over. Heeft je organisatie meerdere werkmaatschappijen met eigen ploegen, dan maak je per werkmaatschappij een eigen bibliotheek. Bij een nieuw project kies je welke bibliotheek het gebruikt.

Wat een bibliotheek is, lees je in [De resourcebibliotheek](docs://uitleg-resourcebibliotheek). De resources zelf bewerk je niet hier, maar in het resourcepaneel, zie [De resourcebibliotheek gebruiken](docs://howto-resourcebibliotheek-gebruiken).

## Stappen

### Het beheerscherm openen

Kies *Bestand › Bibliotheek*. Links staat de lijst *Resourcebibliotheken*. Rechts staan de gegevens van de bibliotheek die je aanklikt: naam, de knoppen, en de lijst *Kalenders*. Bovenaan staat dat je resources beheert in het tabblad *Resources*.

### Een bibliotheek aanmaken, hernoemen en als standaard kiezen

1. Klik boven de lijst op het plusje (*Resourcebibliotheek toevoegen*). Er komt een bibliotheek *Nieuwe resourcebibliotheek* bij, en die staat meteen geselecteerd.
2. Typ de nieuwe naam in het naamveld bovenaan het rechterdeel en druk op Enter, of klik buiten het veld. Een lege naam neemt de app niet over.
3. Klik op *Als standaard* om deze bibliotheek voortaan voor te selecteren bij nieuwe projecten. De standaardbibliotheek heeft een ster in de lijst.

### Een kalender in de bibliotheek zetten

1. Klik bij *Kalenders* op *Uit project*. Er opent een lijst met de kalenders van je actieve project.
2. Klik op het pijltje achter de kalender die je wilt overnemen. Boven de lijst staat *Toegevoegd.* Een kalender die al aan deze bibliotheek gekoppeld is, heeft achter zijn naam *al gekoppeld* staan.
3. De kalender staat nu in de lijst *Kalenders* van de bibliotheek. Met het potlood (*Bewerken*) wijzig je de naam en bewaar je met het vinkje. De prullenbak verwijdert de kalender meteen, zonder om bevestiging te vragen. De kopieën in projecten blijven staan.

Achter *Kalenders* staat een versienummer, bijvoorbeeld *v2*. Dat loopt op bij elke wijziging aan de bibliotheek. Een bibliotheekkalender reist mee naar een project als je een resource toewijst die eraan hangt. Je hangt hem aan een resource in *Resources*, weergave *Bibliotheek*, in de kolom *Kalender*.

### Een bibliotheek exporteren

1. Kies de bibliotheek in de lijst.
2. Klik op *Exporteren*.
3. In de desktop-app en in Chrome en Edge kies je waar het bestand komt. In andere browsers komt het direct in je downloadmap en meldt de app dat. Het bestand heet `bibliotheek-` gevolgd door de naam van de bibliotheek, met de extensie `.ifc`.

Onder de knoppen staat *Exporteren is tevens je back-up: bewaar het bestand op een veilige plek.*

### Een bibliotheek importeren

1. Klik op *Importeren*. Het venster *Bibliotheek importeren* opent voor de bibliotheek die je in de lijst had geselecteerd.
2. Klik op *Bestand kiezen…* en kies het `.ifc`-bestand van een export. Bevat het bestand geen bibliotheek, dan staat er *Dit IFC-bestand bevat geen resourcebibliotheek.*
3. De app toont wat erin zit, bijvoorbeeld *2 kalenders, 5 resources (versie 3).*
4. Kies wat je ermee wilt, zie hieronder.
5. Klik op *Toevoegen* of *Vervangen*, of op *Annuleren* om te stoppen.

Je hebt twee keuzes:

- *Toevoegen als nieuwe resourcebibliotheek*: het bestand wordt een aparte bibliotheek naast je bestaande. Eronder staat onder welke naam, bijvoorbeeld *Wordt toegevoegd als “Mijn resourcebibliotheek (2)”.* Er gaat niets verloren en je actieve project blijft aan zijn eigen bibliotheek gekoppeld.
- *Een bestaande resourcebibliotheek vervangen*: de hele inhoud van de gekozen bibliotheek wordt vervangen door die uit het bestand. Dat staat er ook: *Importeren vervangt de HELE pool van de gekozen resourcebibliotheek.* Heb je twee of meer bibliotheken, dan kies je bij *Importeren in resourcebibliotheek* welke. Is jouw bibliotheek nieuwer dan het bestand, dan waarschuwt de app: *Jouw lokale bibliotheek is nieuwer — importeren kan wijzigingen van jou overschrijven.*

De app stelt zelf een keuze voor. Bij een bestand dat de standaardbibliotheek bevatte, staat *Toevoegen als nieuwe resourcebibliotheek* voorgeselecteerd. Bestaat de bibliotheek uit het bestand al bij jou en is het niet de standaardbibliotheek, dan staat *Een bestaande resourcebibliotheek vervangen* voorgeselecteerd, met precies die bibliotheek gekozen. Twijfel je, kies dan toevoegen: dat overschrijft niets.

### Een bibliotheek verwijderen

1. Kies de bibliotheek in de lijst en klik op *Resourcebibliotheek verwijderen*. De knop is grijs bij de laatste bibliotheek, want er blijft er altijd één bestaan.
2. Bevestig met *Verwijderen*. De vraag is *Deze resourcebibliotheek verwijderen?* Zijn er geopende projecten aan gekoppeld, dan staat er *Deze resourcebibliotheek is aan 1 geopend project gekoppeld. Verwijderen ontkoppelt dat project. Doorgaan?* Bij meer projecten staat er hetzelfde met het aantal, bijvoorbeeld *aan 2 geopende projecten*.

De bibliotheek is dan weg met alle resources en kalenders erin. De geopende projecten die eraan hingen, zijn ontkoppeld: hun resources blijven staan als gewone projectresources. Exporteer eerst als je de inhoud wilt bewaren.

### Een project samen met zijn bibliotheek doorgeven

Een projectbestand bevat zijn eigen kopieën van de resources. Wil je ook de hele bibliotheek meegeven, dan doe je het volgende. De export zelf staat ook beschreven in [Exporteren](docs://howto-exporteren).

1. Open een project dat aan een bibliotheek gekoppeld is en kies *Bestand › Exporteren*.
2. Zet het vinkje *Bibliotheekbestand ernaast opslaan* aan. Dat vinkje staat er alleen bij een gekoppeld project.
3. Kies de kaart *IFC 4x3* en bewaar het bestand. De app vraagt daarna ook om een tweede bestand. Dat heet zoals het project met `-bibliotheek` erachter, en bevat de bibliotheek.

Het vinkje werkt alleen voor de IFC-export, niet voor de andere exportformaten. Je collega importeert het tweede bestand zoals hierboven.

## Valkuilen en wat de app dan doet

**Twee planners, twee bibliotheken.** De app synchroniseert bibliotheken niet tussen computers. In het importvenster staat daar altijd een waarschuwing over: *Let op: bibliotheken worden niet gesynchroniseerd tussen machines. Werken twee planners met dezelfde resourcebibliotheek, dan kunnen de bibliotheken uiteenlopen. Deelt jullie organisatie ploegen over werkmaatschappijen heen, kies dan bewust één gezamenlijke pool.*

**Vervangen overschrijft alles.** Alles wat je in de gekozen bibliotheek had, is weg, en een bibliotheekwijziging valt buiten *Ongedaan*. Exporteer eerst als je twijfelt.

**Een kalender uit de lijst verwijderen gebeurt direct.** De app vraagt niet om bevestiging, terwijl een resource verwijderen dat wel doet. Dat lijkt een tekortkoming. Bibliotheekwijzigingen vallen buiten *Ongedaan*.

## Zie ook

- [De resourcebibliotheek](docs://uitleg-resourcebibliotheek): hoe bibliotheek en project zich tot elkaar verhouden.
- [De resourcebibliotheek gebruiken](docs://howto-resourcebibliotheek-gebruiken): resources koppelen, toewijzen en afwijkingen oplossen.
- [Exporteren](docs://howto-exporteren): de exportformaten, ook IFC met bibliotheekbestand.

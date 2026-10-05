# Tabelkolommen aanpassen

Doel: kiezen welke kolommen je in de taaktabel ziet, in welke volgorde en hoe breed.

## Wanneer je dit nodig hebt

In het overleg wil je bij elke taak de deadline en de totale speling zien. De uitvoerder wil naast de naam alleen de start en het einde. Of een kolom is zo smal dat de kop is afgekapt. De takentabel bestaat uit kolommen die je zelf kiest: er zijn er tientallen, van *Taaknaam* en *Duur* tot *Deadline*, *Vrije speling* en *Toegewezen resources*.

Er zijn twee taaktabellen, elk met eigen kolommen:

- De **taaktabel naast de Gantt** staat links van de tijdlijn op onder meer de tabbladen *Start*, *Planning* en *Beeld*. Standaard heeft hij *WBS*, *Taaknaam* en *Duur*, zodat er ruimte blijft voor de tijdlijn.
- De **tabel op het tabblad Tabel** heeft de hele werkruimte. Standaard staan hier *WBS*, *Taaknaam*, *Duur*, *Start*, *Einde*, *Taaktype*, *Kritiek*, *Totale speling* en *Voortgang*, plus een kolom per activiteitscode en eigen veld van het project.

Een wijziging aan de ene tabel verandert de andere niet.

## Stappen

### Een kolom toevoegen

1. Klik op het plusje (**+**) rechts in de kop van de tabel. Op het tabblad *Tabel* kan het ook met *Tabel › Kolommen › Kolommen…*. Het venster *Kolom kiezen* opent.
2. Zoek de kolom. Bovenaan staat, als je al eerder kolommen hebt gekozen, *Laatst gebruikt*. Typ bij *Zoeken* een stuk van de naam, bijvoorbeeld *dead* voor *Deadline*, of open een categorie: *Taak*, *Planning*, *Beperkingen*, *Relaties*, *Resources*, *Voortgang*, *Berekend*, *Baseline*, *Aangepast* of *Technisch*.
3. Klik op de kolom. Hij komt achteraan in de tabel en het venster sluit.

Een kolom die al in de tabel staat, is grijs en niet te kiezen.

### Een kolom weghalen

Klik op het min-teken in de kop van de kolom (*Verwijderen: Deadline*). Of klik met de rechtermuisknop op de kop en kies *Verwijderen: Deadline*. Met Ctrl+Z haal je de kolom terug, of je kiest hem weer via het plusje.

### De breedte aanpassen

Sleep de rand rechts van de kolomkop naar links of rechts. Dubbelklik op die rand, of kies *Automatisch passend maken* in het menu van de kop (rechtermuisknop), om de kolom zo breed te maken dat de inhoud past, tot maximaal 480 pixels. Heeft de rand de focus, dan verbreden of versmallen de pijltoetsen hem stapje voor stapje.

### Kolommen vastzetten

Klik met de rechtermuisknop op de kop en kies *Vastzetten*. Vastgezette kolommen springen naar voren en blijven links staan als je horizontaal scrolt. Dat werkt zolang ze samen niet breder zijn dan het venster. *Losmaken* zet ze weer gewoon in de rij.

### De volgorde veranderen

Sleep een kolomkop naar een andere plek. Een vastgezette kolom verplaats je binnen de vastgezette kolommen, een gewone kolom tussen de gewone kolommen.

### Terug naar de standaard

Open het venster *Kolom kiezen* en klik onderaan op *Herstel standaard*. De knop is grijs als de kolommen al de standaard zijn. Bij de tabel op het tabblad *Tabel* komt er ook een kolom bij voor elke activiteitscode en elk eigen veld van het project, ook als je die eerder had weggehaald. Die kolommen horen bij het project waar de code of het veld in staat. Over die codes en velden lees je in [Codes en eigen velden](docs://howto-codes-en-velden).

## Valkuilen en wat de app dan doet

**De kop is afgekapt.** Een smalle kolom kapt zijn naam af, bijvoorbeeld *Totale speling* tot *Tot…*. Dubbelklik op de rand van de kop om de kolom passend te maken.

**Je past de verkeerde tabel aan.** De kolommen van de taaktabel naast de Gantt en die van het tabblad *Tabel* zijn los van elkaar. Zit je op *Beeld* of *Start*, dan pas je de tabel naast de Gantt aan. Het plusje op het tabblad *Tabel* past de grote tabel aan.

**Een layout zet kolommen terug.** Heeft een layout het onderdeel *Kolommen* aangevinkt, dan zet een klik op de layoutknop de kolommen van de taaktabel naast de Gantt terug naar de opgeslagen stand. De tabel op het tabblad *Tabel* blijft ongemoeid. Zie [Een layout maken en gebruiken](docs://howto-layouts-gebruiken).

**Kolommen staan op je apparaat, niet in het project.** De app bewaart je kolomkeuze voor al je projecten op dit apparaat en slaat hem niet in het projectbestand op. Het project wordt er ook niet door "gewijzigd". Wel kun je elke kolomwijziging terugdraaien met *Ongedaan* (Ctrl+Z); de stappen heten bijvoorbeeld *Kolom Deadline toevoegen* en *Breedte van kolom Taaknaam wijzigen*.

## Zie ook

- [Een layout maken en gebruiken](docs://howto-layouts-gebruiken): kolommen samen met een filter of sortering op een knop zetten.
- [Codes en eigen velden](docs://howto-codes-en-velden): eigen kolommen aanmaken die je hier kunt kiezen.
- [Tabelkolommen](docs://ref-tabelkolommen): alle kolommen en wat ze tonen.

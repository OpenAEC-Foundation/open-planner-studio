# Tiedoston avaaminen ja tallentaminen

Tavoite: avata projekti tiedostosta ja säilyttää muutokset.

## Milloin tätä tarvitaan

Päivä alkaa eilisen projektin avaamisella, tiedosto saadaan kollegalta tai toisesta paketista, tai ennen suurta muutosta halutaan tallentaa väliaikainen tila. Mitä sovellus tallentaa tiedostoon ja miksi vain IFC säilyttää koko projektin, selitetään kohdassa [Tiedostot ja muodot](docs://uitleg-bestanden).

## Vaiheet

### Tiedoston avaaminen

1. Valitse *Aloitus › Tiedosto › Avaa*, tai *Tiedosto › Avaa*, tai paina Ctrl+O (⌘+O Macilla). Ryhmä *Tiedosto* on myös välilehdellä *Taulukko*.
2. Valitse tiedosto. Kerrallaan avataan yksi tiedosto. Työpöytäsovelluksessa ja selaimissa, joilla on pääsy tiedostoihin, kuten Chromessa ja Edgessä, ikkunassa näytetään luettelo tiedostotyypeistä: *Kaikki tuetut*, *IFC-tiedostot*, *CSV-tiedostot*, *XML-tiedostot*, *MS Project -tiedostot* ja *Primavera XER -tiedostot*.
3. Projekti avautuu uuteen välilehteen. Jos nykyinen välilehti oli vielä tyhjä eikä sitä ollut muutettu, projekti avautuu siihen.
4. Jos tiedosto ei ollut IFC, avautuu ikkuna, jossa on lyhyt selitys tästä muodosta. Vihreä ruutu kertoo, mitä sovellus otti mukaan. Keltainen ruutu kertoo, mitä ei sisällytetty tai vain osittain. Sininen ruutu kertoo, miten tallennus ja takaisinkirjoitus toimivat. *Lue lisää* avaa tämän muodon oppaan. Sulje ikkuna napsauttamalla *Selvä*. Jos tämän muodon selitystä ei enää halua nähdä, valitse ensin *Älä näytä uudelleen kohteelle …*. Tämän voi ottaa takaisin käyttöön kohdassa [Sovelluksen asetukset](docs://ref-instellingen), välilehdellä *Lisäasetukset*.

IFC-tiedosto antaa nimensä välilehdelle. Muusta muodosta avatun projektin välilehti saa projektin nimen.

Sovellus avaa tiedostot `.ifc`, `.csv`, `.xml` (MS Project XML tai Primavera P6 XML), `.mpp` ja `.xer`. Näistä kahdelle jälkimmäiselle on omat vaiheet kohdissa [MS Project -tiedoston (.mpp) avaaminen](docs://howto-mpp-openen) ja [Primavera P6 -tiedoston (.xer) avaaminen](docs://howto-xer-openen).

### Viimeisimmän projektin avaaminen

Valitse *Aloitus › Tiedosto › Viimeisimmät* ja napsauta luettelossa olevaa tiedostoa, tai valitse *Tiedosto › Viimeisimmät*. Luettelossa on viimeiset kymmenen tiedostoa, jotka on avattu, tallennettu tai viety. Myös tässä, kun tiedosto ei ole IFC, näkyy muodon selitys. Työpöytäsovellus näyttää kunkin tiedoston polun, selain vain nimen.

Jos sovellus ei enää pysty lukemaan luettelon tiedostoa, esimerkiksi koska se on siirretty, tiedosto poistuu luettelosta ilman ilmoitusta. Selaimissa ilman tiedostojen käyttöoikeutta, kuten Firefoxissa, luettelo *Viimeisimmät* pysyy tyhjänä.

### Esimerkin avaaminen

Valitse *Tiedosto › Esimerkit* ja napsauta esimerkkiprojektia. Esimerkki avautuu välilehdelle ilman tiedostoa. Siksi *Tallenna* kysyy, mihin projekti tallennetaan.

### Tallentaminen

Valitse *Aloitus › Tiedosto › Tallenna* tai *Tiedosto › Tallenna*, tai paina Ctrl+S. Mitä tapahtuu, riippuu projektista:

1. Jos projektilla on jo tiedosto, koska avasit IFC-tiedoston tai tallensit sen aiemmin, sovellus kirjoittaa siihen tiedostoon. Ikkuna ei avaudu, paitsi ensimmäisellä tallennuksella tiedostoon, jonka IFC-skeema on muu kuin IFC 4.3 ADD2. Silloin sovellus kysyy ensin *Missä IFC-skeemassa tallennetaan?* Katso [IFC-skeeman valitseminen](docs://howto-ifc-schema-kiezen).
2. Jos projektilla ei ole vielä tiedostoa, sovellus kysyy, mihin se tallennetaan. Se ehdottaa projektin nimeä tiedostopäätteellä `.ifc`. Sen jälkeen tämä tiedosto on projektin tiedosto.
3. Jos selain tallentaa vain latauksena (kuten Firefox), tiedosto tulee latauskansioon, ja jokainen tallennus luo uuden latauksen. Istunnon ensimmäisellä kerralla näkyy ilmoitus *Tallennettu latauksena: 'name.ifc' on latauskansiossa. Tämä selain ei anna sovelluksen kirjoittaa omaan paikkaansa, joten jokainen tallennus luo uuden latauksen. Chromessa, Edgessä tai työpöytäsovelluksessa Tallenna päivittää vain samaa tiedostoa.*
4. Jos selain ei voi kirjoittaa takaisin projektin tiedostoon, sovellus kysyy joka tallennuksella uudelleen, minne tiedosto laitetaan. Se näyttää toiminnolta *Tallenna nimellä*, mutta se on selaimen rajoitus. Istunnon ensimmäisellä kerralla ilmoitus *Tämä selain ei anna sovelluksen kirjoittaa takaisin tiedostoon 'name.ifc'.* selittää asian, ja siinä on linkki kohtaan [Tiedostot](docs://uitleg-bestanden).

Tallentamisen jälkeen merkki *Tallentamaton* häviää: välilehden piste, projektin nimen edessä oleva tähti ylhäällä ja teksti *Tallentamaton* tilarivillä oikeassa alakulmassa.

### Tallentaminen toisella nimellä

Valitse *Aloitus › Tiedosto › Tallenna nimellä* tai *Tiedosto › Tallenna nimellä*, tai paina Ctrl+Shift+S. Valitse nimi ja paikka (Firefoxissa sovellus lataa uuden tiedoston). Sen jälkeen projekti toimii tämän uuden tiedoston kanssa: seuraava *Tallenna* kirjoittaa siihen. Vanha tiedosto säilyy samassa tilassa kuin viimeksi tallennettaessa.

### Projektin sulkeminen

Napsauta välilehden ristiä tai valitse *Tiedosto › Sulje projekti*. Jos projektissa on muutoksia, joita ei ole tallennettu, sovellus kysyy: *Tallentamattomia muutoksia: 'name' sisältää muutoksia, joita ei ole vielä tallennettu.* Vaihtoehdot ovat *Peruuta* (projekti jää auki), *Älä tallenna* (projekti suljetaan ja muutokset katoavat) tai *Tallenna* (tallennetaan ensin, sitten suljetaan). Jos koko sovellus suljetaan työpöytäsovelluksessa (sulkupainikkeella, Alt+F4:llä tai käyttöjärjestelmän valikosta), sovellus kysyy tämän jokaisesta projektista, jossa on muutoksia. *Peruuta* tai epäonnistunut tallennus pysäyttää sulkemisen. Normaalin sulkemisen jälkeen sovellus poistaa tämän istunnon palautuskopiot, joten palautusikkuna näkyy vain todellisen kaatumisen jälkeen. Jos projektissa on muutoksia ja selaimen välilehti tai ikkuna suljetaan, selain pyytää vahvistusta.

## Sudenkuopat ja mitä sovellus silloin tekee

**Avattu IFC-tiedosto on heti projektin tiedosto.** *Tallenna* ylikirjoittaa tämän tiedoston, vaikka se olisi tullut toisesta ohjelmasta. Jos alkuperäinen halutaan säilyttää, valitse ensin *Tallenna nimellä*.

**Muita muotoja ei ylikirjoiteta koskaan.** Tiedostolla `.csv`, `.xml`, `.mpp` tai `.xer` ei ole avaamisen jälkeen tiedostoa. *Tallenna* kirjoittaa uuden IFC-tiedoston ja jättää alkuperäisen ennalleen.

**Firefoxissa jokainen tallennus luo uuden tiedoston.** Sovellus ei voi kirjoittaa avattuun tiedostoon siellä. Se lataa uuden tiedoston joka kerta, ja tiedoston nimenä on projektin nimi, ei avatun tiedoston nimi.

**Chrome ja Edge kysyvät lupaa.** Kun avattua tiedostoa tallennetaan ensimmäisen kerran painamalla *Tallenna*, selain kysyy, saako sovellus kirjoittaa siihen. Jos lupa evätään, sovellus avaa ikkunan, jossa valitaan uusi tiedosto. Chromessa ja Edgessä sama ikkuna avautuu myös, jos tiedoston päivittäminen epäonnistuu, esimerkiksi koska tiedosto on kadonnut tai lukittu.

**Viesti päällekkäisistä tunnuksista tai riippuvuuksista, joita ei oteta huomioon.** Avaamisen jälkeen viesti voi jäädä näkyviin. Jos siinä lukee *Tässä tiedostossa on objekteja, joilla on sama tunnus*, jokainen päällekkäinen objekti sai oman tunnuksensa, ja viittaukset osoittavat ensimmäiseen esiintymään. Tarkista silloin riippuvuudet ja resurssikohdistukset. Jos siinä lukee *riippuvuuksia ei voitu sisällyttää laskentaan*, riippuvuus oli yhteenvetotehtävässä eikä sillä ole vaikutusta, esimerkiksi kun tehtävä on linkitty omaan yhteenvetotehtäväänsä. Tiedosto itse pysyy muuttumattomana. Katso [Riippuvuudet](docs://uitleg-relaties), mitä riippuvuus yhteenvetotehtävässä tekee.

**Tallentaminen voi epäonnistua.** Jos tallennus itsessään antaa virheen, sovellus näyttää ilmoituksen *Tallennus epäonnistui* ja syyn. Projekti pysyy auki, ja sen merkkinä on edelleen *Tallentamaton*.

## Katso myös

- [Tiedostot ja muodot](docs://uitleg-bestanden): mitä IFC-tiedostossa on ja miten sovellus käsittelee muotoja.
- [Automaattisen tallennuksen käyttöönotto](docs://howto-automatisch-opslaan): antaa sovelluksen päivittää tiedoston itse.
- [IFC-skeeman valitseminen](docs://howto-ifc-schema-kiezen): mitä kysymys *Missä IFC-skeemassa tallennetaan?* tarkoittaa.
- [Vieminen](docs://howto-exporteren): kopion tekeminen toisessa muodossa.
- [Palauttaminen kaatumisen jälkeen](docs://howto-herstellen-na-een-crash): mitä tehdään, jos sovellus ei sulkeutunut puhtaasti.
- [Tuonti- ja vientimuodot](docs://ref-import-exportformaten): muodoittain, mitä siirtyy mukana ja mitä ei.

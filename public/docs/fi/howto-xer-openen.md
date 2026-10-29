# Primavera P6 -tiedoston (.xer) avaaminen

Tavoite: avata Primavera P6:n aikataulu suoraan sovelluksessa. Sitä ei tarvitse ensin viedä XML-muotoon.

## Milloin tätä tarvitaan

Asiakas tai pääurakoitsija työskentelee Primaverassa ja toimittaa aikataulunsa `.xer`-tiedostona. Aikataulu halutaan tarkastella, laskea tai täydentää. Sovellus lukee vain `.xer`-tiedostoja. Se ei kirjoita `.xer`-tiedostoa eikä muuta tiedostoa koskaan. Tiedostosta sovellus ottaa WBS-rakenteen sekä tehtävät ja niiden kesto, päivämäärät, rajoitteet ja edistyminen. Lisäksi se ottaa riippuvuudet ja viiveet, kalenterit sekä resurssit ja niiden resurssikohdistukset. Se ottaa myös tehtäväkoodit, mukautetut kentät (UDF), muistiinpanot ja P6:n aikataulutusasetukset. Tehtävä, jonka tyyppi on *Level of Effort*, on riippumatto.

## Vaiheet

1. Valitse *Aloitus › Tiedosto › Avaa* tai paina Ctrl+O. Valitse `.xer`-tiedosto.
2. Sovellus avaa yhden välilehden jokaiselle projektille, jossa on tehtäviä. Projekti, jossa on eniten tehtäviä, on aktiivinen välilehti. Välilehden nimi on *Projektin nimi (Projektitunnus)*, jos P6-projektitunnus eroaa nimestä. *Projektin asetukset* näyttää vain nimen. Jos projektin nimeä muutetaan, projektitunnus jää nimen perään. Sen jälkeen ikkuna selittää lyhyesti, mitä sovellus otti tiedostosta ja miten tallentaminen toimii. Katso [Tiedoston avaaminen ja tallentaminen](docs://howto-bestand-openen-en-opslaan).
3. Lue viesti alareunassa. Kolmen projektin tiedostossa viesti voi näyttää tältä: *XER-tiedosto avattu: 3 projektiasiakirjaa.* Sen alla on rivejä, jotka selittävät, mitä sovellus teki. Katso alla oleva otsikko.
4. Tarkista, onko valintanauhan alla viestipalkki: *Aikataulu näytetään sellaisena kuin Primavera sen tallensi. Kun lasketaan uudelleen, 1 tehtävä siirtyisi.* Primavera tallentaa tiedostoon omat lasketut päivämääränsä. Jos sovelluksen laskenta poikkeaa niistä, sovellus näyttää Primaveran päivämäärät niin kauan kuin mitään ei muuteta. Tehtävä, joka on alkanut tai valmistunut, on aina todellisen päivämäärän mukainen, kuten Primaverassa. Mitä tämä tarkoittaa ja miten sovelluksen oma laskenta otetaan käyttöön, kerrotaan kohdassa [Päivämäärät sellaisina kuin ne tallennettiin](docs://uitleg-datums-zoals-opgeslagen). Viesti *Tämä tiedosto sisältää tuntisuunnittelua.* voi myös näkyä. Silloin näkyy painike *Ota tuntisuunnittelu käyttöön*. Katso [Tuntisuunnittelun käyttöönotto](docs://howto-urenplanning-aanzetten).
5. Tallenna projekti painamalla Ctrl+S. Koska `.xer`-tiedostoa ei koskaan korvata, sovellus kysyy, mihin uusi IFC-tiedosto tallennetaan. Se ehdottaa tiedostonimeksi *Projektin nimi (Projektitunnus)*.

### Viestin alla olevat rivit

Viestin ensimmäinen rivi kertoo avattujen välilehtien määrän. Sen alla ovat vain ne rivit, jotka koskevat tiedostoa. Näihin kannattaa kiinnittää huomiota:

- *Tämä projekti lasketaan tavalla Primavera P6. Muuta sitä kohdassa Tiedosto → Projektitiedot → Laskentaprofiili ja laskentavaihtoehdot.* Sovellus laskee tämän projektin Primaveran laskentasäännöillä. Painikkeella *Avaa laskentaprofiili* siirrytään asetukseen.
- *1 projekti perustasosta jätettiin pois.* ja *1 perustaso luotiin.* Jos P6:ssa projekti määrittää toisen projektin perustasokseen, tätä toista projektia ei avata omana välilehtenään. Siitä tulee sen projektin aktiivinen perustaso, joka viittaa siihen.
- *Perustasolle käytettiin suojaavaa varavaihtoehtoa.* Jos perustasojen määrittäminen estäisi kaikkien projektien avautumisen, jos projekti viittaa itseensä tai jos projektit viittaavat toisiinsa silmukassa, sovellus avaa yksinkertaisesti kaikki projektit eikä luo perustasoja.
- *1 ulkoinen riippuvuus säilytettiin.* Tämä on riippuvuus kahden projektin välillä. Sovellus säilyttää sen lähdetietona, mutta ei muunna sitä aikataulun riippuvuudeksi.
- *12 tehtävää näyttää päivämäärät sellaisina kuin Primavera ne tallensi (ei laskettuina uudelleen).* Tämä on niiden tehtävien määrä, joille näkymä *Päivämäärät sellaisina kuin ne tallennettiin* näyttää Primaveran päivämäärät: kaikki tehtävät, joille tiedosto tallensi päivämäärät, ei vain ne, jotka poikkeavat.

Muut rivit ovat diagnostiikkaa itse lukemisesta. Niihin ei tarvitse reagoida:

- löydettyjen projektien määrä;
- ohitettu tyhjä projekti;
- ohitettu perustasoviite, jonka kohde puuttuu;
- tekstin merkistö, joka ei ole tavallinen UTF-8 (ilmoitus nimeää merkistön: arabian-, kyrillisen tai kreikankielisen tekstin kohdalla sovellus valitsee vastaavan Windows-koodisivun, muuten Windows-1252);
- tehtävät ilman suunniteltua aloitusta (ne alkavat tiedostossa olevasta raportointipäivästä tai projektin aloituspäivästä);
- laskurit löydöksille taulujen, kalenterien ja lukujen osalta, tuntemattomille kenttäarvoille ja P6:n aikataulutusasetuksille, jotka sovellus korvasi turvallisella valinnalla.

*Lue lisää* avaa ohjeen Primavera-tiedostojen avaamisesta.

## Sudenkuopat ja mitä sovellus silloin tekee

**Kaikkea ei muunneta välilehdeksi tai riippuvuudeksi.** Projekti ilman tehtäviä ei avaudu. Perustasoprojekti ei avaudu omana välilehtenään, eikä riippuvuus kahden projektin välillä muutu aikataulun riippuvuudeksi. Sovellus kertoo tästä viestin alla olevilla riveillä.

**Jokainen välilehti on oma projektinsa.** Kun yksi välilehti tallennetaan, IFC-tiedosto säilyttää mukanaan koko `.xer`-tiedoston. Kun IFC-tiedosto avataan myöhemmin, sovellus tuntee yhä Primaveran päivämäärät. Jos tuo lähdearkisto on vioittunut tai toinen IFC-ohjelma kirjoitti tiedoston uudelleen, sovellus näyttää viestin: *XER-lähdearkisto tässä tiedostossa on käyttökelvoton ja jätettiin pois; projekti itsessään avattiin kokonaan.* Aikataulu, laskentaprofiili ja kaikki projektitiedot ovat täydellisiä. Puuttuu vain se, mitä Primavera tallensi päivämääriksi, sekä lähteen alkuperätiedot tekoälylle ja laajennuksille. Arkisto saadaan takaisin avaamalla `.xer`-tiedosto uudelleen.

**IFC-tiedosto kasvaa.** Koska IFC-tiedosto sisältää koko `.xer`-tiedoston, se on suurempi kuin IFC-tiedosto ilman arkistoa. Suuren `.xer`-tiedoston kohdalla tämä näkyy tiedoston koossa ja tallentamisen kestossa. Jos `.xer`-tiedosto avaa useita projekteja, jokainen tallennettu välilehti sisältää koko `.xer`-tiedoston, ei vain omaa projektiaan.

**Vienti muotoon CSV, MS Project XML tai P6 XML menettää tietoja.** Sovellus varoittaa: *Vienti muotoon CSV menettää XER-lähdetiedot.* IFC ei menetä mitään.

**Vapaa lauantai tai sunnuntai, jota tiedostossa ei ole.** Sovellus voi merkitä tällaisen viikonlopun päivän itse vapaaksi. Päivä saa silloin kalenterissa nimen *Kalenteripoikkeus (viikonlopun rekonstruktio)*. Säännöt ovat kohdassa [Tuonti- ja vientimuodot](docs://ref-import-exportformaten).

**Pelivara projektin päättymispäivään asti ilman loppupäivää.** Jos tiedostossa ei ole loppupäivää, sovellus kytkee pois vaihtoehdon *Pelivara lasketaan projektin päättymispäivään asti*. Tämä näkyy rivillä *N P6-aikataulutusasetusta käytti turvallista varavaihtoehtoa.* Lisätietoja on kohdassa [Tuonti- ja vientimuodot](docs://ref-import-exportformaten).

**Valmiit tehtävät raportointipäivällä.** Valmiit tehtävät voivat näkyä kapeana palkkina raportointipäivällä näkymässä *Päivämäärät sellaisina kuin ne tallennettiin*. Vika ei ole tiedostossa. Selitys ja siihen liittyvä laskentasääntö ovat kohdassa [Tuonti- ja vientimuodot](docs://ref-import-exportformaten).

**Luvut, joissa desimaalierottimena on pilkku.** Jos sovellus ei voi tunnistaa desimaalierotinta varmasti, se ei avaa tiedostoa. Näin aikataulu, jossa luvut on luettu väärin, ei avaudu koskaan. Uusi vienti kannattaa pyytää lähettäjältä.

**Tiedosto, jota sovellus ei voi lukea.** Näkyviin tulee virheviesti ja sen syy. Muutama esimerkki:

- *Tämä ei ole kelvollinen tai tuettu XER-tiedosto.*
- *XER-taulusta puuttuu pakollisia sarakkeita.*
- *P6-projekti tässä XER-tiedostossa ei sisällä tehtäviä.*
- *XER-tiedoston desimaalimerkintää ei voida tunnistaa varmasti.*

Silloin mitään ei avaudu. Tiedosto kannattaa tarkistaa P6:ssa, tai uusi vienti kannattaa pyytää lähettäjältä.

## Katso myös

- [Tiedostot ja muodot](docs://uitleg-bestanden): miksi `.xer`-tiedostoa vain luetaan ja mitä vienti menettää.
- [Päivämäärät sellaisina kuin ne tallennettiin](docs://uitleg-datums-zoals-opgeslagen): näkymä Primaveran omille päivämäärille.
- [MS Project -tiedoston (.mpp) avaaminen](docs://howto-mpp-openen): sama asia MS Projectille.
- [Tuntisuunnittelun käyttöönotto](docs://howto-urenplanning-aanzetten): jos tiedostossa on tietoja tunteina.
- [Tuonti- ja vientimuodot](docs://ref-import-exportformaten): per muoto, mitä siirtyy mukana ja mitä ei.
- [Laskentaprofiilit ja laskentasäännöt](docs://uitleg-rekenprofielen): miksi P6-tiedosto avautuu sen oman laskentaprofiilin mukaan.

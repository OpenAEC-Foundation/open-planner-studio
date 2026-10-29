# Edistymistavan valinta

Tavoite: päätetään, miten sovellus suunnittelee sellaisen tehtävän jäljellä olevan työn, joka on jo alkanut, vaikka sen edeltäjä on vielä käynnissä: riippuvuuden mukaan (Retained Logic) vai sen mukaan, mitä todella tapahtuu (Progress Override).

## Milloin tätä tarvitaan

Työmaalla edetään usein logiikan edelle. Maalari aloittaa jo huoneissa, jotka on rapattu, vaikka rappaaja on vielä muualla. Aikataulussa tämä on esimerkiksi lopusta alkuun -riippuvuus, jonka seuraaja alkaa ennen edeltäjän loppua. Sovellus kutsuu tällaista tilannetta **järjestyksestä poikkeavaksi**. Jos tilarivillä näkyy *Järjestyksestä poikkeavat riippuvuudet: N*, kyseessä on tällainen tapaus. Edistymistapa päättää silloin, miten sovellus suunnittelee seuraajan jäljellä olevan työn. Kaksi edistymistapaa ja niiden toiminta esimerkin avulla on kohdassa [Edistyminen, raportointipäivä ja perustaso](docs://uitleg-voortgang).

## Vaiheet

1. Kirjaa edistyminen ja aseta raportointipäivä, kuten kohdassa [Edistymisen päivittäminen](docs://howto-voortgang-bijwerken) kuvataan.
2. Siirry kohtaan *Aikataulu › Perustasot ja edistyminen › Edistymistapa* ja avaa luettelo.
3. Valitse *Retained Logic* tai *Progress Override*.
4. Paina **Laske** (F5), esimerkiksi kohdasta *Aikataulu › Aikataulu › Laske*. Valinta tekee aikataulusta vanhentuneen: tilarivillä näkyy *Vanhentunut — laske uudelleen (F5)*. Jos *Laske automaattisesti* on päällä, sovellus tekee tämän itse.

Miten valitaan?

- **Retained Logic** on oletus. Riippuvuus pysyy voimassa: seuraajan jäljellä oleva työ alkaa vasta, kun edeltäjä on päättynyt. Valitse tämä, jos järjestys on todella kiinteä tai jos halutaan suunnitella varovasti.
- **Progress Override** antaa todellisuuden voittaa. Seuraajan jäljellä oleva työ alkaa raportointipäivänä, odottamatta edeltäjää. Valitse tämä, jos seuraaja todella jatkaa työskentelyä ja loppupäivän ei pitäisi riippua edeltäjästä, joka on vielä käynnissä.

## Tuloksen tarkistaminen

- Napsauta tilarivin viestiä *Järjestyksestä poikkeavat riippuvuudet: N*. *Varoitukset* -paneeli avautuu, ja sen voi avata myös kohdasta *Aikataulu › Aikataulu › Varoitukset*. Jokainen riippuvuus on siinä tekstillä *Järjestyksestä poikkeava edistyminen: seuraajan edistyminen on ristiriidassa riippuvuuden kanssa*, esimerkiksi *4.2 Plastering → 4.5 Painting (FS)*.
- Katso seuraajan palkkia. Retained Logic -tilassa palkki jatkuu edeltäjän loppupäivän jälkeen. Progress Override -tilassa se päättyy aikaisemmin. Selityksen esimerkissä tämä on tiistai 27. heinäkuuta, verrattuna torstaihin 22. heinäkuuta.

## Sudenkuopat ja mitä sovellus tekee

**Ei eroa.** Tila vaikuttaa vain tehtäviin, jotka ovat jo alkaneet, kun niiden edeltäjä ei ole vielä päättynyt. Ilman tällaista tehtävää mikään ei muutu.

**Viesti jää.** Progress Override ei ratkaise järjestyksestä poikkeavan edistymisen viestiä. Tila päättää, miten sovellus laskee; ristiriita riippuvuuden ja edistymisen välillä jää. Jos riippuvuus ei ole enää kohdallaan, muutetaan se ([Riippuvuuksien lisääminen](docs://howto-relaties-leggen)).

**Se kuuluu projektiin.** Valinta tallennetaan projektitiedostoon, koskee koko projektia ja sen voi kumota näppäinyhdistelmällä Ctrl+Z. Uusi projekti on tilassa Retained Logic.

**P6-tiedosto.** Kun avataan Primavera P6 -tiedosto (.xer), sovellus ottaa tilan tiedostosta. Retained Logic ja Progress Override -tilojen lisäksi P6:ssa on myös Actual Dates. Sovellus ei tunne tätä kolmatta tilaa; tällainen tiedosto lasketaan Retained Logic -tilana. Tuontiviesti kirjaa sen tekstillä *1 P6-aikataulutusasetus käytti turvallista varavaihtoehtoa.*

**Laskentaprofiili.** Primavera P6 -profiilissa Progress Override toimii myös takaperoin: edeltäjän myöhäisissä päivämäärissä ja vapaassa pelivarassa (laskentasääntö *Progress Override ohittaa aloitetun seuraajan myös takaperoin*). Open Planner Studio- ja Microsoft Project -profiileissa näin ei ole. Laskentasäännöt löytyvät kohdasta *Asetukset › Projekti › Projektin asetukset*, osiosta *Laskentaprofiili ja laskentavaihtoehdot*. Selityksen esimerkissä tätä takaperoista vaikutusta ei voi nähdä.

## Katso myös

- [Edistyminen, raportointipäivä ja perustaso](docs://uitleg-voortgang): ero kahden tilan välillä, lukuineen.
- [Edistymisen päivittäminen](docs://howto-voortgang-bijwerken): edistymisen syöttäminen, jota edistymistapa käyttää.
- [Riippuvuuksien lisääminen](docs://howto-relaties-leggen): riippuvuuden muuttaminen, kun se ei ole enää kohdallaan.

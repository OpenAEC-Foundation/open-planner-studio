# Perustason tallentaminen ja hallinta

Tavoite: tallenna aikataulu sopimuksena (perustasona), jotta näet myöhemmin, kuinka paljon toteutus poikkeaa siitä. Voit myös säilyttää, nimetä uudelleen, valita ja poistaa useita perustasoja.

## Milloin tarvitset tätä

Perustaso tallennetaan, kun aikataulu on hyväksytty ja työ ei ole vielä alkanut. Jos aikataulua muutetaan myöhemmin virallisesti, esimerkiksi muutostyön jälkeen, tallennetaan toinen perustaso ja ensimmäinen säilytetään. Näin toteutusta verrataan sekä ensimmäiseen sopimukseen että tarkistettuun sopimukseen. Siitä, mitä perustaso tarkalleen tallentaa ja miten sovellus laskee eron, kerrotaan kohdassa [Edistyminen, raportointipäivä ja perustaso](docs://uitleg-voortgang).

## Vaiheet

### Perustason tallentaminen

1. Paina **Laske** (F5), esimerkiksi kohdasta *Aikataulu › Aikataulu › Laske*. Perustaso tallentaa päivämäärät, jotka lasketaan juuri silloin.
2. Valitse *Aikataulu › Perustasot ja edistyminen › Hallitse perustason suunnitelmia…*. *Perustasot*-ikkuna avautuu.
3. Kohdassa *Tallenna uusi perustaso* on ehdotettu nimi, esimerkiksi *Perustaso 1 — (tämän päivän päivämäärä)*. Kirjoita oma nimi, jonka voi tunnistaa myöhemmin, esimerkiksi *Perustaso*.
4. Valitse *Tallenna*. Perustaso on nyt listassa ja on heti aktiivinen perustaso.
5. Valitse *Sulje*.

Jokaisen Gantt-kaavion tehtäväpalkin alle tulee ohut palkki perustason päivämäärillä. Välitavoite saa pienen timantin. Peittokuvan voi kytkeä päälle tai pois kohdasta *Näkymä › Perustasot ja edistyminen › Perustason peittokuva*.

### Aktiivisen perustason valitseminen

Avaa *Hallitse perustason suunnitelmia…* ja valitse *Aktiivinen*-sarakkeesta perustaso, johon halutaan verrata. Niin kauan kuin perustasoja on, tasan yksi niistä on aktiivinen. Gantt-peittokuva, raporttityyppi *Ero* ja *Edistymisraportti* käyttävät sitä.

### Perustason nimeäminen uudelleen

Muuta nimi luettelossa. Muutos on heti voimassa. Painiketta *Tallenna* ei tarvitse valita.

### Perustason poistaminen

Valitse luettelossa perustason vieressä oleva pieni roskakori. Jos poistetaan aktiivinen perustaso, sovellus kysyy *Poistetaanko aktiivinen perustaso?*. Sen jälkeen aktiiviseksi tulee uusin jäljellä oleva perustaso. Jos muita perustasoja ei ole, aktiivista perustasoa ei ole enää ja peittokuva katoaa. Palauta poistettu perustaso painamalla Ctrl+Z. Sulje ikkuna ensin: Ctrl+Z ei toimi ikkunan sisällä.

### Erot tehtävätaulukossa

Jokaisella perustasolla on kuusi saraketta tehtävätaulukossa. Valitse tehtävätaulukon otsikon oikealla puolella oleva **+** (*Lisää sarake*) ja avaa luokka *Perustason suunnitelma*. Jokaiselle perustasolle tulevat sarakkeet *Suunniteltu alku*, *Suunniteltu loppu*, *Kesto*, *Alkamispäivän ero*, *Valmistumispäivän ero* ja *Keston ero*. Perustason nimi on sarakkeiden edessä, esimerkiksi *Perustaso — Valmistumispäivän ero*. Erot ilmoitetaan työpäivinä. Plusmerkki tarkoittaa myöhemmin, miinusmerkki aikaisemmin. Tehtävä, joka ei kuulu perustasoon, näyttää näissä sarakkeissa viivan (—).

## Ongelmat ja mitä sovellus tekee

**Vanhentunut aikataulu.** Jos aikataulu on vanhentunut, ikkunassa lukee *Aikataulu on vanhentunut — laske uudelleen ensin (F5)*. Tämä on varoitus, ja tallentaminen on silti mahdollista. Silloin tallennetaan kuitenkin vanhat päivämäärät. Sulje ikkuna, paina **Laske** ja tallenna vasta sitten.

**Perustaso, jossa on edistymistä.** Jos perustaso tallennetaan edistymisen kirjaamisen jälkeen, se tallentaa tilan todellisine päivämäärineen. Ero on silloin nolla, eikä se kerro toteutuksesta enää mitään. Tallenna perustaso ennen kuin työ alkaa.

**Perustasoa ei voi päivittää.** Jos sopimusta halutaan tarkistaa, tallenna uusi perustaso. Poista vanha perustaso tarvittaessa.

**Varoitusmerkki ⚠ kohdassa *Kesto* tai *Keston ero*.** Tehtävälle, jonka kesto on tunteina, päivä on sen kalenterin työaika. Jos kalenterissa on oma tuntimäärä päivässä (esimerkiksi 8, lohkoissa 10 tuntia, Primavera P6:sta), laski vanhempi sovellusversio päivät toisin. Perustaso, joka on tallennettu vanhalla versiolla, säilyttää vanhan luvun: 1870 tunnin tehtävä on perustasossa 233,75 päivää, mutta nyt 187 päivää. Sovellus ei muunna tällaista perustasoa. Tämän perustason sarakkeet *Kesto* ja *Keston ero* näyttävät silloin ⚠-merkin. Vie osoitin merkin päälle, niin selitys näkyy. Perustason päivämäärät ovat oikein. Tallenna uusi perustaso ja poista tarvittaessa vanha.

**Vain tehtävät ilman alitehtäviä.** Vaihe ei kuulu perustasoon: sillä ei ole perustason palkkia eikä eroa. Vaihe määräytyy sen alla olevien tehtävien mukaan.

**Uudet ja poistetut tehtävät.** Tehtävällä, joka lisätään tallentamisen jälkeen, ei ole perustason palkkia. Eroraportissa se näkyy merkintänä *Uusi*. Poistettu tehtävä näkyy merkintänä *Poistunut*.

**Siirrä projekti.** Kun perustasoja on, *Siirrä projekti…* -ikkunassa näkyy valintaruutu *Siirrä myös perustasot*. Oletuksena se on pois päältä: perustasot pysyvät paikallaan, joten siirrosta syntyy ero. Katso [Projektin siirtäminen](docs://howto-project-verplaatsen).

**Tallentuu projektitiedostoon.** Perustasot ja valinta aktiivisesta perustasosta tallennetaan projektin mukana. Ne tulevat takaisin, kun tiedosto avataan.

## Katso myös

- [Edistyminen, raportointipäivä ja perustaso](docs://uitleg-voortgang): mitä perustaso tallentaa ja miten ero lasketaan.
- [Projektin siirtäminen](docs://howto-project-verplaatsen): valintaruutu *Siirrä myös perustasot*.
- [Edistymisen päivittäminen](docs://howto-voortgang-bijwerken): todellisen tilan kirjaaminen, johon perustasoa verrataan.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): yksi perustaso (*Baseline at start*) ennen alkua, edistymistiedot ja raportointipäivä 20. toukokuuta 2027.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): kaksi perustasoa, *Contract* ja *Re-baseline (variation order)*, edistymistiedot ja raportointipäivä 5. heinäkuuta 2027.

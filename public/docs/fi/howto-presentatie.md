# Esittäminen suurella näytöllä

Tavoite: näytä Gantt-kaavio koko näytössä ilman valintanauhaa ja paneeleja, esimerkiksi projektorilla tai televisiossa työmaapalaverissa.

## Milloin tätä tarvitset

Kymmenen ihmistä katsoo yhtä näyttöä työmaakopissa. Valintanauha, tilarivi ja ominaisuuspaneeli vievät silloin tilaa, jota aikataulu tarvitsee. Ne myös häiritsevät. Sovellus näyttää **esitystilassa** vain tehtävätaulukon ja Gantt-kaavion koko näytössä.

## Vaiheet

### Näkymän valmistelu

Esitystilassa valintanauha ei ole näkyvissä. Valmistele siksi etukäteen näkymä, joka halutaan näyttää.

1. Paina **Laske** (F5), jotta näytetyt päivämäärät ovat oikein.
2. Valitse näkymä, joka halutaan näyttää, esimerkiksi asettelu, joka näyttää vain kriittiset tehtävät (katso [Asettelun luominen ja käyttö](docs://howto-layouts-gebruiken)).
3. Valitse aikaskaala ja zoomaustaso, joilla tehtävien nimet ovat luettavissa etäältä. Tiivistä tai laajenna vaiheet painikkeilla *Tiivistä* ja *Laajenna* ryhmässä *Jäsennys* välilehdellä *Näkymä*.
4. Jos niitä halutaan käyttää, ota käyttöön *Jaettu näkymä* ja *Pienoiskartta* (katso [Jaetun näkymän ja pienoiskartan käyttö](docs://howto-split-view-en-mini-map)).

### Esityksen käynnistäminen

Valitse *Näkymä › Esitys › Esitys*. Työpöytäsovelluksessa esityksen voi käynnistää myös F11-näppäimellä. Selaimessa F11 kuuluu selaimelle itselleen: se asettaa selainikkunan koko näytön tilaan, ja sovellus pysyy ennallaan. Valintanauha, välilehdet, tilarivi ja oikeanpuoleinen paneeli katoavat. Näkyviin tulevat tehtävätaulukko ja Gantt-kaavio. Jos histogrammi ja pienoiskartta on otettu käyttöön, ne tulevat myös näkyviin. Muutaman sekunnin ajan alareunassa näkyy teksti *Paina Esc tai F11 poistuaksesi koko näytön tilasta.*

Työpöytäsovelluksessa esityksen voi käynnistää millä tahansa välilehdeltä F11-näppäimellä, myös välilehdeltä *Taulukko* tai *Raportti*. Selaimessa esityksen voi käynnistää vain valinnalla *Näkymä › Esitys › Esitys*. Näkyvissä on aina avoimen projektin Gantt-kaavio. Kun esitys lopetetaan, palataan välilehdelle, josta aloitettiin. Selaimessa tämä on siis välilehti *Näkymä*.

### Esityksen lopettaminen

Paina Esc tai F11. Valintanauha ja paneelit palaavat välilehdelle, josta aloitettiin.

## Sudenkuopat ja mitä sovellus tekee

**Esitystilassa voi edelleen muokata.** Napsautus, vetäminen, solujen muokkaus ja Delete toimivat edelleen. Jos palkki vedetään vahingossa, se siirtyy ja aikataulu ei ole enää ajan tasalla. Vahingossa poistettu tehtävä palautetaan näppäinyhdistelmällä Ctrl+Z, myös esitystilassa. Napsauta siksi varovasti, kun ryhmän kanssa työskennellään.

**Ilmoitukset näkyvät edelleen.** Sovelluksen viesti, esimerkiksi tallennusvirhe, näkyy myös esitystilassa. Muuten valintanauhaa ja tilariviä ei ole näkyvissä, joten viesti on ainoa merkki siitä, että jokin on vialla.

**Valmistele jaettu näkymä, pienoiskartta ja asettelut etukäteen.** Niihin tarvitaan valintanauha, ja se on tässä tilassa piilossa. Zoomaus toimii hiiren rullalla tai näppäimillä Ctrl+= ja Ctrl+-. Myös + ja - toimivat, mutta vain, kun kohdistus on Gantt-kaaviossa. Kun esitys on käynnistetty, kohdistus on usein tehtävätaulukossa. Napsauta siksi ensin Gantt-kaaviota.

**Koko näyttötila ei toimi.** Sovellus piilottaa valintanauhan ja pyytää lisäksi todella koko näytön tilaa. Jos selain tai ikkuna ei hyväksy sitä, vain valintanauha ja paneelit katoavat. Esitystila toimii silti. Jos koko näytön tilasta poistutaan muuten kuin Esc- tai F11-näppäimellä, esimerkiksi käyttöjärjestelmän näppäimellä, myös esitystila päättyy.

**Esitystilaa ei muisteta.** Kun sovellus suljetaan ja avataan uudelleen, esitystila on pois päältä.

## Katso myös

- [Jaetun näkymän ja pienoiskartan käyttö](docs://howto-split-view-en-mini-map): kaksi aikaikkunaa tai yleiskuvapalkki esityksen aikana.
- [Asettelun luominen ja käyttö](docs://howto-layouts-gebruiken): haluamasi näkymän asettaminen yhdellä napsautuksella.
- [Pikanäppäimet](docs://ref-sneltoetsen): F11 ja muut näppäimet.

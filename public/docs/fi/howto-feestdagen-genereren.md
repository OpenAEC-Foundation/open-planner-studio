# Vapaapäivien ja rakennusalan kesälomän luominen

Tavoite: maan vapaapäivät, ja tarvittaessa rakennusalan kesäloma, täytetään kalenteriin. Tarvittaessa lisätään myös oma vapaapäivä tai vapaajakso.

## Milloin tarvitset tätä

Ilman vapaapäiviä sovellus suunnittelee työt yksinkertaisesti joulupäiville tai kuningaspäivälle. Uudessa projektissa on jo Hollannin vapaapäivät, kunhan *Rakennustila* on käytössä. Vapaapäivät luodaan uudelleen, jos tarvitaan toinen maa tai alue, jos rakennusalan kesäloma halutaan mukaan tai jos projekti ulottuu vuosille, joille vapaapäiviä ei ole luotu. Vuosilla on merkitystä: sovellukselle päivä niiden ulkopuolella on vain työpäivä. Ohjeesta [Kalenterit ja työpäivät](docs://uitleg-kalenders) käy ilmi, miten sovellus ottaa vapaapäivän huomioon työpäivien laskennassa.

**Rakennusalan kesäloma** (*bouwvak*) on Hollannin rakennusalan yhteinen vapaajakso, kolme viikkoa kesällä. Sovelluksessa se on oletuksena pois päältä.

## Vaiheet

### Vapaapäivien luominen

1. Valitse *Aikataulu › Kalenteri › Kalenteri* ja valitse vasemmalta kalenteri, johon vapaapäivät pitää lisätä.
2. Napsauta *Luo vapaapäivät…*. Painikkeen alle avautuu valintojen ruutu.
3. Valitse *Maa*: Alankomaat, Saksa, Belgia, Ranska, Iso-Britannia, Itävalta, Sveitsi tai *Ei vapaapäiviä*. Joissakin maissa näkyy lisäksi luettelo *Alue*, esimerkiksi Saksan osavaltio. *Valtakunnallinen* jättää vain ne vapaapäivät, jotka pätevät kaikkialla.
4. Alankomaiden kohdalla valitse *Rakennusalan kesäloma*: *Ei mitään* (oletus), *Pohjoinen*, *Keski* tai *Eteläinen*. Rakennusalan kesäloma näkyy luettelossa yhtenä aikajaksona, esimerkiksi *Bouwvak (Noord)*, kolme viikkoa maanantaista perjantaihin. Tämä valinta näkyy vain, jos *Rakennustila* on käytössä.
5. Valintojen alla on yhteenveto, esimerkiksi *21 vapaapäivä(ä), 2026–2028*. Napsauta sitä, niin päivämäärät näkyvät.
6. Napsauta *Luo*. Luettelo *Vapaapäivät* on nyt täytetty.
7. Napsauta *Käytä*. Aikataulu lasketaan uudelleen heti.

Alankomaiden kohdalla sovellus lisää luetteloon joka vuosi nämä: Nieuwjaar (uudenvuodenpäivä), Goede Vrijdag (pitkäperjantai), Pasen (pääsiäinen, kaksi päivää), Koningsdag (kuningaspäivä), Hemelvaart (helatorstai), Pinksteren (helluntai, kaksi päivää) ja Kerst (joulu, 25. ja 26. joulukuuta). Jos kuningaspäivä on sunnuntaina, se on 26. huhtikuuta. Bevrijdingsdag (vapautuspäivä) on luettelossa vain lustrumvuosina, esimerkiksi 2025 ja 2030.

Projektin vuodet seuraavat projektin aikaväliä: vuodesta ennen alkamispäivää vuoteen lopetuspäivän jälkeen. Jos projektilla ei ole loppupäivää, vuosia on enintään kolme alkamisvuoden jälkeen. Alkupäivää ja loppupäivää muutetaan kohdassa *Asetukset › Projekti › Projektin asetukset*.

### Uudelleen luominen, kun projektin aikaväli muuttuu

Jos projekti siirtyy tai saa myöhemmän loppupäivän, vapaapäivät eivät enää kata uusia vuosia. Sovellus kertoo sen *Kalenterit*-ikkunassa, esimerkiksi: *Vapaapäivät kattavat 2025–2028. Luodaanko uudelleen vuoteen 2030 saakka?* Napsauta sitten *Luo uudelleen*. Sovellus käyttää projektin vuosille samoja valintoja kuin viimeksi (maa, alue, rakennusalan kesäloma). Napsauta sitten *Käytä*. Tämä viesti näkyy vain kalenterille, jonka vapaapäivät on luotu aiemmin.

### Oman vapaapäivän tai vapaajakson lisääminen

1. *Kalenterit*-ikkunassa napsauta *Lisää vapaapäivä*. Luettelon alareunaan tulee uusi rivi, jonka *Alkaen*-kohdassa on tämän päivän päivämäärä.
2. Täytä *Kuvaus*, esimerkiksi *Yrityksen virkistyspäivä*.
3. Muuta päivämäärää kohdassa *Alkaen*. Jätä *Asti* tyhjäksi, jos kyseessä on yksi päivä. Jos kyseessä on aikajakso, täytä *Asti* aikajakson viimeisellä vapaapäivällä, esimerkiksi talvivapaata varten.
4. Napsauta *Käytä*.

Rivin takana olevalla roskakorikuvakkeella poistetaan vapaapäivä.

### Kaikkien vapaapäivien poistaminen

Valitse kohdasta *Maa* vaihtoehto *Ei vapaapäiviä* ja napsauta *Luo*. Luettelo on sen jälkeen tyhjä.

## Sudenkuopat ja mitä sovellus silloin tekee

**Luominen korvaa koko luettelon.** Myös itse lisätyt päivät poistuvat. Ne lisätään sen jälkeen uudelleen.

**Goede Vrijdag on mukana.** Jos yrityksessä tehdään töitä pitkäperjantaina tai lustrumvuoden vapautuspäivänä, rivi poistetaan roskakorilla.

**Rakennusalan kesälomän päivämäärät ovat suosituspäiviä.** Sovellus tuntee päivämäärät vuosilta 2025 vuoteen 2028 asti. Muille vuosille se tekee karkean arvion. Kun rakennusalan kesäloma on valittu, sovellus näyttää siksi tekstin *Suosituspäivät — tarkista Bouwend Nederlandilta*. Jaksoa muutetaan tarvittaessa luettelossa.

**Virheellinen rivi.** Rivi, jossa *Alkaen*-päivä ei ole kelvollinen, jossa *Asti* on ennen *Alkaen*-päivää tai jonka päivämäärää ei voi lukea, saa punaisen viestin, esimerkiksi *Loppupäivä on ennen alkamispäivää*. *Käytä* on pois käytöstä, kunnes virhe on korjattu.

**Uuden projektin kohdalla.** Ikkunassa *Uusi projekti* on samat valinnat kohdassa *Vapaapäiväluettelo*. Valinnalla *Mukautettu…* aloitetaan ilman vapaapäiviä. Luomisen jälkeen avautuu *Kalenterit*-ikkuna, jotta vapaapäivät voidaan täyttää itse.

## Katso myös

- [Kalenterit ja työpäivät](docs://uitleg-kalenders): miten sovellus ottaa vapaapäivät ja rakennusalan kesälomän huomioon työpäivien laskennassa.
- [Kalenterin luominen ja määrittäminen](docs://howto-kalender-maken-en-toewijzen): oman kalenterin luominen, johon vapaapäivät lisätään.
- [Kalenteri-ikkunat](docs://ref-kalenders): kaikki kalenteri-ikkunien kentät.
- [Uusi projekti ja Projektin asetukset](docs://ref-projectinfo): uuden projektin vapaapäiväluettelo.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): vapaapäivien lisäksi projektikalenterissa on vapaajakso *Frost delay, foundations*.

# Koodit ja mukautetut kentät

Tavoite: liitä tehtäviin omat luokitukset (tehtäväkoodit, esimerkiksi *Sijainti*) ja omat kentät (esimerkiksi *Urakoitsija*).

## Milloin tätä tarvitaan

Tehtävän kiinteiden tietojen (nimi, kesto, riippuvuudet …) lisäksi tehtävään voidaan lisätä omia tietoja. Jos tehtäviä halutaan luokitella pohjoissiiven ja eteläsiiven tai alan mukaan, tai seurata, mikä urakoitsija tehtävän tekee, tiedot kirjataan itse. Tähän on kaksi tapaa, ja ero on tärkeä.

**Tehtäväkoodi** on luokitus, jolla on kiinteä valintaluettelo. **Koodityyppi** (esimerkiksi *Sijainti*) luodaan, ja sille annetaan **arvot** (*N* tarkoittaa pohjoissiipeä, *Z* eteläsiipeä). Tehtävälle annetaan enintään yksi arvo koodityyppiä kohti.

**Mukautettu kenttä** (ikkunan kohdassa *Mukautetut kentät*) on vapaa syötekenttä, jolla on tyyppi: *Teksti*, *Luku*, *Kokonaisluku*, *Kustannus*, *Päivämäärä* tai *Kyllä/ei*. Kentässä voi olla eri arvo jokaisella tehtävällä.

## Vaiheet

### Koodien ja kenttien määrittäminen

1. Valitse *Aikataulu › Rakenne › Koodit ja kentät*.
2. **Koodityypin luominen.** Kirjoita kohtaan *Uusi koodityyppi (esim. Sijainti)* nimi ja paina Enter tai valitse *Lisää koodityyppi*.
3. **Arvojen lisääminen.** Valitse koodityypin alta *Lisää arvo*. Sovellus lisää siihen väliaikaisen koodin, esimerkiksi *V1*. Muuta se kentässä *Koodi* lyhyeksi, sellaisena kuin se kirjoitetaan: *N*. Täytä tarvittaessa kenttä *Kuvaus* (*Pohjoissiipi*) ja valitse *Väri*. Muutos tallentuu heti, kun kentästä poistutaan tai painetaan Enter.
4. **Mukautetun kentän luominen.** Kirjoita kohtaan *Uusi kenttä (esim. Urakoitsija)* nimi, valitse tyyppi ja valitse *Lisää kenttä* (tai paina Enter).

Ikkunassa ei ole OK-painiketta: jokainen muutos tallentuu heti. Kentän tyyppiä ei voi myöhemmin muuttaa, vain nimeä. Jos tarvitaan toinen tyyppi, luodaan uusi kenttä.

### Koodin tai kentän täyttäminen tehtävälle

Paikkoja on kaksi.

- **Paneelissa *Ominaisuudet*** (tai ikkunassa, joka avataan F2:lla). Alareunassa on lohko *Koodit ja kentät*: valintaluettelo kutakin koodityyppiä varten ja syötekenttä kutakin kenttää varten. Lohko näkyy vasta, kun koodityyppi tai kenttä on olemassa.
- **Sarakkeena tehtävätaulukossa.** Valitse taulukon otsikon oikealta puolelta **+** (*Lisää sarake*) ja valitse kohdasta *Mukautettu* koodityyppi tai kenttä. Koodityypin solussa kirjoitetaan koodi, esimerkiksi `N`, tai valitaan luettelosta. Koodi, jota ei ole olemassa, antaa ilmoituksen *Valitse arvo tästä tehtäväkoodista.*

### Koodien ja kenttien käyttö

Koodityyppiä tai mukautettua kenttää voi käyttää suodattamiseen, ryhmittelyyn ja lajitteluun. Asetus tehdään asettelulla: *Näkymä › Asettelu › Uusi asettelu*. Ikkunassa valitaan osat, jotka halutaan tallentaa. Valinnalla *Tallenna* saadaan painike kohtaan *Näkymä › Asettelu*, jota voi valita myöhemmin uudelleen. Valinnalla *Käytä tallentamatta* asettelu otetaan käyttöön vain nyt. Ryhmiteltäessä tehtävät ilman arvoa menevät kohtaan *(ei mitään)*.

Palkkien väriä varten valitse *Näkymä › Perustasot ja edistyminen › Palkkien värit*, sitten *Luokittain* ja koodityyppi. Silloin jokainen palkki saa sen arvon värin, joka on valittu kentässä *Väri*.

## Sudenkuopat ja sovelluksen toiminta

**Poistaminen poistaa arvot tehtäviltä.** Jos koodityyppi, arvo tai kenttä poistetaan roskakorin painikkeella, sovellus ei pyydä vahvistusta. Kaikilta tehtäviltä katoavat niiden arvot sen mukana. Ryhmittely tai lajittelu, joka perustui kyseiseen koodityyppiin tai kenttään, raukeaa myös. *Kumoa* (Ctrl+Z, sulje ensin ikkuna) palauttaa koodityypin, arvon tai kentän ja täytetyt arvot, mutta ei ryhmittelyä eikä lajittelua: ne asetetaan uudelleen.

**Kaksi arvoa samalla koodilla.** *Lisää arvo* jatkaa numerointia olemassa olevien arvojen määrästä. Jos yksi arvo poistetaan ja toinen lisätään, sama koodi voi siis esiintyä kahdesti. Jos tämä koodi kirjoitetaan sarakesolussa, sovellus hylkää sen ja ilmoittaa: *Tämä tehtäväkoodin arvo esiintyy useammin kuin kerran. Valitse se listasta.* Anna jokaiselle arvolle oma koodi.

**Mallit eivät ota koodeja ja kenttiä mukaan.** Katso [WBS-mallien tallentaminen ja lisääminen](docs://howto-wbs-sjablonen). Jos tehtäviä liitetään toiseen asiakirjaan, sovellus tyhjentää koodit ja kentät, joita siellä ei ole, ja ilmoittaa siitä.

**Päivämääräkenttä ei siirry mukana.** Kun koko projekti siirretään, täytetyt mukautetut kentät tyyppiä *Päivämäärä* pysyvät omassa päivämäärässään. Sovellus varoittaa tästä esikatselussa.

## Katso myös

- [Rakenteen muokkaaminen](docs://howto-structuur-aanpassen): WBS-puu, toinen tapa järjestää tehtävät.
- [Projektin siirtäminen](docs://howto-project-verplaatsen): mitä päivämäärille tapahtuu, kun projekti siirretään.
- [Asettelun luominen ja käyttö](docs://howto-layouts-gebruiken): ryhmittely ja suodatus koodin tai mukautetun kentän mukaan.
- [Taulukon sarakkeiden muokkaaminen](docs://howto-tabelkolommen-aanpassen): koodin tai mukautetun kentän näyttäminen sarakkeena.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): tehtäväkoodit *House* ja *Discipline*, mukautettu kenttä *Cost estimate* ja muistiinpanot (avoimet ja valmiit).

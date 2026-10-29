# Edistymisen tuominen taulukosta

Tavoite: siirtää työmaan henkilöstön taulukkoon täyttämä edistyminen aikatauluun kerralla. Tehtäviä ei tarvitse napsauttaa yksitellen.

## Milloin tätä tarvitaan

Aliurakoitsija tai työmaan vastaava ei käytä sovellusta. Hän kertoo edistymisensä kuitenkin joka viikko: kuinka monta prosenttia työstä on tehty, milloin työ alkoi ja milloin se valmistui. Taulukko, jossa ovat tehtävät, lähetetään hänelle. Hän täyttää kolme saraketta ja palauttaa taulukon. Sovellus lukee siitä jokaiselta tehtävältä vain kolme arvoa: valmiusasteen, toteutuneen alkamispäivän ja toteutuneen valmistumispäivän. Muu aikataulu jää ennalleen. Sovelluksen toiminta edistymisen kanssa on selitetty kohdassa [Edistyminen, raportointipäivä ja perustaso](docs://uitleg-voortgang).

## Vaiheet

### 1. Aseta raportointipäivä ja laske

Aseta raportointipäivä, kuten kohdassa [Edistymisen päivittäminen](docs://howto-voortgang-bijwerken) kuvataan. Työmaan vastaava täyttää todellisia päivämääriä tähän päivään asti mukaan lukien. Jos aikataulu ei ole ajan tasalla, se lasketaan uudelleen ennen taulukon tekemistä.

### 2. Tee taulukko

Valitse *Aikataulu › Edistyminen › Vie edistymisen taulukko*. Sama painike on välilehdillä *Taulukko* ja *Raportti*. Sovellus tekee Excel-tiedoston ja ehdottaa nimeksi *(projektin nimi)-voortgang.xlsx*. Selaimessa tiedosto tallentuu latauskansioon. Halutaanko CSV-tiedosto? Valitse *Tiedosto › Vie › Edistymistaulukko (CSV)*. Excel-taulukko on siellä myös nimellä *Edistymistaulukko (Excel)*.

Taulukossa on kahdeksan saraketta. Sarakkeiden nimet pysyvät englanniksi, ja niiden perässä on lyhyt ohje sovelluksen kielellä:

- `OPS Task ID`, `WBS` ja `Name` ovat vain tehtävän tunnistamista varten. Niitä ei muokata.
- `Start` ja `Finish` ovat suunniteltuja alku- ja loppupäiviä, tiedoksi. Sovellus ei koskaan kirjoita niitä takaisin.
- `Completion (%)`, `Actual Start` ja `Actual Finish` ovat ne kentät, jotka täytetään.

Excel-taulukko on suojattu ilman salasanaa. Vain kolme täytettävää saraketta voi muokata. Excel tarkistaa, että prosenttiluku on 0–100 ja että todellinen päivämäärä on päivämäärä. Vaihe (yhteenvetotehtävä) on merkitty harmaalla, ja siinä lukee *— yhteenvetotehtävä: ei täytetä*.

### 3. Taulukon täyttäminen

Työmaan vastaava täyttää jokaiselle tehtävälle:

- `Completion (%)`: 0–100, molemmat rajat mukaan lukien. Sovellus lukee myös desimaaliluvut, joissa on pilkku tai piste (esimerkiksi 33,3 tai 33.3). CSV-tiedoston ohjeessa pyydetään silti kokonaisia lukuja. Taulukkolaskenta, jonka alueasetus on toinen, voi lukea arvon 8,38 muodossa 838.
- `Actual Start` ja `Actual Finish`: Excelissä päivämääränä omien alueasetusten mukaan. CSV-tiedostossa muodossa dd-mm-yyyy tai muodossa yyyy-mm-dd.

Tyhjäksi jäävä kenttä ei muuta mitään. Tyhjä solu ei siis myöskään poista olemassa olevaa edistymistä. Sen voi tehdä vain sovelluksessa. Tehtävää, jota ei ole aloitettu, jätetään kokonaan tyhjäksi.

### 4. Taulukon tuominen sovellukseen

1. Valitse *Aikataulu › Edistyminen › Tuo edistyminen taulukosta* (myös välilehdillä *Taulukko* ja *Raportti*) tai *Tiedosto › Tuo › Tuo edistyminen taulukosta*. Avautuu *Tuo edistyminen taulukosta* -ikkuna.
2. Napsauta *Valitse tiedosto…* ja valitse täytetty `.xlsx`- tai `.csv`-tiedosto.
3. Jos päivämäärät CSV-tiedostossa ovat epäselviä, sovellus kysyy *Päivä vai kuukausi ensin?* ja näyttää tiedoston päivämäärän kahtena tulkintana. Napsauta se päivämäärä, joka pitää paikkansa.
4. Esikatselu näkyy nyt. Ylhäällä on neljä laskuria: *Käytetty*, *Ennallaan*, *Odottaa linkitystä* ja *Hylätty*. Alempana näkyy kunkin tehtävän kohdalla, mitä muuttuu, esimerkiksi *Valmiusaste: 0% → 100%*.
5. Tarkista esikatselu ja napsauta *Käytä*. Ikkunassa näkyy *Tulos*, jossa ovat laskurit sekä hylätyt rivit ja niiden syy. Lopeta valitsemalla *Sulje*.

Esikatselua ei voi ohittaa. Painike *Käytä* on pois käytöstä niin kauan kuin mitään ei ole käytettävissä.

### 5. Laske aikataulu uudelleen

Taulukon lukeminen ei laske uudelleen itsestään. Paina **Laske** (F5), esimerkiksi kohdasta *Aikataulu › Aikataulu › Laske*, ellei *Laske automaattisesti* ole päällä.

## Rivit, jotka eivät sovi suoraan

Jokainen rivi linkitään tehtävään. Ensin käytetään saraketta `OPS Task ID`, muuten WBS-numeroa.

**Linkitys on epävarma.** Jos sovellus löysi tehtävän vain WBS-numeron perusteella, rivi on kohdassa *Linkitys on epävarma*, ja siinä ovat *Vahvista* ja *Muuta*. Rivi käytetään myös, jos mitään ei tehdä. Tarkista siksi, että tehtävä on oikea. *Vahvista* poistaa rivin tästä luettelosta. Se ei muuta, mitä käytetään. *Muuta* antaa valita toisen tehtävän. Painikkeella *Poista linkitys* poistetaan linkki, jonka itse loit. Huomaa: toisen projektin taulukko, jossa on samat WBS-numerot, linkitetään silti kohdassa *Linkitys on epävarma*, ja se käytetään, kun napsautetaan *Käytä*.

**Odottaa linkitystä.** Jos sovellus ei löytänyt tehtävää tai löysi useita samalla WBS-numerolla, rivi on kohdassa *Odottaa linkitystä*. Kohdassa *Valitse tehtävä…* valitse oikea tehtävä. Hakuun voi antaa WBS-numeron tai nimen. Jos riviä ei linkitä, se hylätään.

## Sudenkuopat ja mitä sovellus tekee

Rivi, joka ei sovi, hylätään ja syy kerrotaan. Muun taulukon käsittely jatkuu silti. Nämä ovat tärkeimmät viestit:

- *Todellinen päivämäärä on raportointipäivän jälkeen.* Aseta raportointipäivä myöhemmäksi tai korjaa taulukko.
- *Tehtävän aikataulun mukaan se alkaa vasta raportointipäivän jälkeen: täytä taulukkoon ensin sen toteutunut alkamispäivä.* Sovellus ei keksi alkamispäivää. Anna se taulukossa.
- *Prosenttiluku on alueen 0–100 ulkopuolella. Tarkista desimaalierotin: 8,38 voi olla eri kieliasetuksilla olevassa taulukkolaskennassa luettu lukuna 838.*
- *Yhteenvetotehtäviin ei voi tuoda edistymistä taulukosta.* Vaiheen edistyminen seuraa sen alla olevia tehtäviä.
- *Toteutunut valmistumispäivä on ennen toteutunutta alkamispäivää.*
- *Päivämäärää ei voi lukea.* ja *Prosenttilukua ei voi lukea.*
- *Annetut arvot ovat ristiriidassa keskenään.* Esimerkiksi toteutunut valmistumispäivä, mutta valmiusaste alle 100.
- *Tälle rivillä ei löytynyt tehtävää.* Taulukossa mainitaan tehtävän tunnus ja WBS-numero, joita ei ole tässä projektissa.
- *Tämä WBS-koodi esiintyy useassa tehtävässä – linkitä rivi käsin.*
- *Toinen rivi on jo varannut tämän tehtävän.* Kaksi riviä viittaa samaan tehtävään.
- *Sovellus hylkäsi tämän arvon.* Aikataulutus itse hylkäsi arvon, ilman omaa viestiä.

Jos koko tiedosto hylätään, ikkunassa näkyy yksi näistä viesteistä: *Tiedostossa ei ole saraketta ”OPS Task ID” tai ”WBS”, joiden avulla rivejä linkitään tehtäviin.*, *Tiedostossa ei ole yhtään sarakkeista Valmiusaste, Toteutunut alkamispäivä tai Toteutunut valmistumispäivä.*, *Tämä tiedosto on liian suuri luettavaksi edistymistaulukkona.* (yli 16 MB), *Tiedostossa on liian monta riviä, jotta sen voi lukea edistymistaulukkona.* (yli 50 000 riviä), *Tiedosto on suojattu salasanalla, eikä sitä voi lukea.* tai *Tätä tiedostoa ei voitu lukea edistymistaulukkona.*

**Ei raportointipäivää.** Jos raportointipäivää ei ole vielä asetettu ja tuonti käyttää edistymistä, sovellus asettaa sen tähän päivään ja kertoo siitä. Aseta se siis ensin itse.

**Kaikki kerralla takaisin.** Koko taulukko on yksi vaihe, jonka voi perua näppäinyhdistelmällä Ctrl+Z.

**Vain täytetyt tiedot.** Rivi, jossa ei ole eroa aikatauluun, lasketaan kohtaan *Ennallaan*. Tehtävä, jolla ei ole riviä taulukossa, pysyy ennallaan.

## Katso myös

- [Edistyminen, raportointipäivä ja perustaso](docs://uitleg-voortgang): mitä sovellus laskee todellisia päivämääriä ja prosenttilukuja käyttäen.
- [Edistymisen päivittäminen](docs://howto-voortgang-bijwerken): edistymisen syöttäminen suoraan sovellukseen.

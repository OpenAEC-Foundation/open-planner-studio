# WBS-mallien tallentaminen ja lisääminen

Tavoite: tallentaa vaihe alitehtävineen ja niiden riippuvuuksineen malliksi, ja lisätä se myöhemmin samaan tai toiseen projektiin.

## Milloin tätä tarvitaan

Samanlaista työtä suunnitellaan usein. Jokaisen talon perustukseen kuuluvat maanrakennus, raudoitus, valu ja jälkihoito. Sen sijaan, että nämä tehtävät luodaan yhä uudelleen ja linkitetään toisiinsa, vaihe tallennetaan kerran **malliksi**. Malli on WBS:n haara: yksi tehtävä ja kaikki sen alla olevat tehtävät.

## Vaiheet

### Haaran tallentaminen mallipohjana

1. Rakenna haara siinä muodossa, jossa sitä halutaan käyttää uudelleen: yhteenvetotehtävä, sen alitehtävät ja niiden väliset riippuvuudet.
2. Napsauta yhteenvetotehtävää hiiren kakkospainikkeella ja valitse *Tallenna haara mallipohjana*. Tämä valikon kohta näkyy vain tehtävissä, joilla on alitehtäviä.

Sovellus näyttää *Haara tallennettiin mallina 'Foundation'*. Sovellus ei kysy nimeä. Malli saa nimen haaran ylimmän tehtävän mukaan.

### Mallin lisääminen

1. Valitse tehtävä, jonka alle malli tulee, tai jätä valinta tyhjäksi.
2. Valitse *Aikataulu › Rakenne › Mallit*. Luettelossa näkyy kunkin mallin nimi ja esimerkiksi *4 tehtävää, 2 riippuvuutta*.
3. Napsauta mallia.

Jos tehtävä on valittuna, malli lisätään sen viimeiseksi alitehtäväksi. Tästä tehtävästä tulee sen seurauksena yhteenvetotehtävä. Jos useita tehtäviä on valittuna, ratkaiseva on tehtävä, jonka napsautettiin ensin. Jos mitään ei ole valittuna, haara lisätään luettelon loppuun, ylimmälle tasolle. Lisätty haara on lisäämisen jälkeen valittuna.

Kaikki lisätyt tehtävät ovat projektin aloituspäivänä, ja aikataulu ei ole enää ajan tasalla. Paina **Laske** (F5), esimerkiksi kohdasta *Aloitus › Aikataulu › Laske*, niin päivämäärät seuraavat riippuvuuksista. *Kumoa* peruu lisäyksen yhdellä askeleella. Mallin tallentaminen tai poistaminen ei kuulu tähän.

### Mallin poistaminen

Avaa *Aikataulu › Rakenne › Mallit* ja napsauta mallin oikealla puolella olevaa pientä roskakorikuvaketta (*Poista malli*). Sovellus ei pyydä vahvistusta.

### Mallin sisältö

Malli säilyttää jokaisesta tehtävästä nimen, kuvauksen, työlajin, tiedon siitä, onko kyseessä välitavoite, ja keston päivinä. Riippuvuuksista malli säilyttää ne, jotka kulkevat haaran kahden tehtävän välillä, sekä niiden tyypin ja viiveen. Viive tunteina (`4h`) ei säily, ja siitä tulee 0. Viive työpäivinä, kalenteripäivinä tai prosentteina säilyy.

Kaikki muu jää mallin ulkopuolelle: päivämäärät, edistyminen ja todelliset päivämäärät, resurssikohdistukset, koodit ja mukautetut kentät (katso [Koodit ja mukautetut kentät](docs://howto-codes-en-velden)), kalenteri, rajoitteet ja tavoitepäivät, prioriteetti, mukautettu työlaji, välitavoitteen laji ja valintaruutu *Pakollinen (sopimuksellinen)*, sekä riippuvuudet haaran ulkopuolisiin tehtäviin. Lisäämisen jälkeen nämä tiedot on täytettävä uudelleen. Resurssikohdistukset, koodit, kalenteri ja rajoitteet ovat tyhjiä, ja kaikki tehtävät alkavat projektin aloituspäivänä.

Tehtävä, joka oli tuntiperusteinen, tulee takaisin päivätehtävänä, ja sen kesto muunnetaan murto-osaksi työpäivää. Tehtävä, jonka kesto on 5 tuntia ja työpäivä 8 tuntia, muuttuu 0,625 päiväksi.

## Valkuilut ja mitä sovellus tekee

**Mallit eivät kuulu projektiin.** Sovellus säilyttää ne tämän laitteen sovellustallennuksessa, ei projektitiedostossa. Kollega, joka avaa tiedoston, ei näe malleja. Selainversiossa malli kuuluu siihen selaimeen. Jos mallit ovat tärkeitä, niitä kannattaa säilyttää myös muualla: ne kannattaa lisätä projektiin, joka tallennetaan tiedostona.

**Sama nimi voi esiintyä useammin kuin kerran.** Jos haara tallennetaan kahdesti, luettelossa on kaksi mallia samalla nimellä. Sovellus ei korvaa mitään.

**Ylimmän tehtävän kestoa ei lasketa mukaan.** Yhteenvetotehtävä saa kestonsa alitehtävistään heti, kun komento Laske suoritetaan.

**Kohdetehtävä, jolla on resurssikohdistuksia.** Jos valitaan tehtävä, jolla on resurssikohdistuksia mutta ei vielä alitehtäviä, ja lisätään sen alle malli, sovellus kieltäytyy. Tehtävästä tulisi yhteenvetotehtävä, eikä yhteenvetotehtävä voi kantaa resurssikohdistuksia. Mallin ylimmällä tehtävällä on jo alitehtäviä, joten resurssikohdistuksille ei ole paikkaa. Sovellus kertoo tästä eikä muuta mitään. Valitse silloin toinen tehtävä tai jätä valinta tyhjäksi. Välitavoite, johon malli lisätään, menettää välitavoitemerkintänsä, ja sovellus ilmoittaa siitä.

**Virheellinen riippuvuus mallissa.** Jos mallin riippuvuus ei ole sallittu, esimerkiksi tehtävä omaan vaiheeseensa, tai se on jo olemassa, sovellus ohittaa sen. Sovellus kertoo, montako riippuvuutta ohitettiin.

## Katso myös

- [Rakenteen muokkaaminen](docs://howto-structuur-aanpassen): lisätyn haaran siirtäminen tai sisentäminen.
- [Riippuvuuksien lisääminen](docs://howto-relaties-leggen): riippuvuudet luodaan haaran sisällä itse ennen tallentamista.
- [Kriittinen polku ja pelivara](docs://uitleg-kritiek-pad): mitä lisätylle haaralle tapahtuu Laske-komennon jälkeen.

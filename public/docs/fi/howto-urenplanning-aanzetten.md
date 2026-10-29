# Tuntisuunnittelun käyttöönotto

Tavoite: suunnitella tehtäviä tunteina päivinä mitattavien tehtävien rinnalla.

## Milloin tätä tarvitaan

Nosturi vuokrataan tunneittain eikä päivittäin. Kuuden tunnin valu ei mahdu kokonaiseen työpäivään. Yöryhmä työskentelee eri aikaan kuin päiväryhmä. Tällaiseen työhön tarvitaan kesto tunteina sekä alku ja loppu kellonaikana. Tämän voi ottaa käyttöön myös silloin, kun tiedosto avataan ja sovellus näyttää *Tämä tiedosto sisältää tuntisuunnittelua.* Sen, miksi sovellus laskee päivät ja tunnit eri tavalla, voi lukea kohdasta [Päivät ja tunnit](docs://uitleg-dagen-en-uren).

## Vaiheet

### Tuntisuunnittelun ottaminen käyttöön

1. Valitse *Asetukset › Projekti › Sovelluksen asetukset* ja avaa *Aikataulu*-välilehti.
2. Kohdassa *Tuntisuunnittelu* rastita *Ota tuntisuunnittelu käyttöön*. Asetus on heti käytössä. Ilmoituksessa *Tämä tiedosto sisältää tuntisuunnittelua*, painike *Ota tuntisuunnittelu käyttöön* tekee saman.
3. Sen alla on *Salli sekoitettu päivä/tuntisuunnittelu*, oletuksena päällä. Tällä asetuksella voi valita jokaiselle tehtävälle erikseen, lasketaanko se päivinä vai tunteina. Jos asetus kytketään pois, *Kestomitta*-luettelo katoaa. Kestoa voi silloin silti kirjoittaa mitan kanssa, esimerkiksi `12h`.

Tämä muuttaa enemmän kuin tehtävän keston: kohdassa *Näkymä › Aikaskaala* voi valita asteikoksi *Tunti*, *Kalenterit*-ikkunaan tavallinen kalenteri voi saada työaikalohkoja (lohko *Työajat*; kalenterissa, jossa lohkoja on jo, lohko näkyy aina), ja *Luo uusi projekti* -ikkunaan tulee valinnat *Työvuoro* ja *Oletusmitta uusille tehtäville*.

### Tehtävän suunnittelu tunteina

1. Valitse tehtävä ja katso paneelista *Ominaisuudet*, kohdasta *Aika*, kenttää *Kesto*.
2. Kirjoita kesto mitan kanssa ja paina Enter: `12h` (`12u`, hollanninkielinen lyhenne, toimii myös) tarkoittaa kaksitoista tuntia ja `1h 30m` puolitoista tuntia. `1.5h` käy myös. Luku ilman mittaa lasketaan tehtävän nykyisessä mitassa.
3. Jos olemassa oleva tehtävä halutaan muuntaa, valitse kohdasta *Kestomitta* mitta *Tunnit*. Sovellus muuntaa keston heti, esimerkiksi `2` päivästä `16` tuntiin. Jos haluat palata, käytä toimintoa *Kumoa*.
4. Paluu päiviin onnistuu merkinnällä `2d` tai mitalla *Päivät*.
5. Paina **Laske** (F5), esimerkiksi kohdasta *Aloitus › Aikataulu › Laske*. Tehtävällä on nyt alku- ja loppuaika kellonajoin.
6. Jos tunnit halutaan nähdä Gantt-kaaviossa, valitse asteikko *Tunti* luettelosta kohdassa *Näkymä › Aikaskaala*.

### Uudet tehtävät tunteina oletuksena

1. Valitse *Asetukset › Projekti › Projektin asetukset*.
2. Valitse kohdasta *Oletusmitta uusille tehtäville* mitta *Tunnit* ja napsauta *Käytä*.

Uuden tehtävän kestoksi tulee silloin 5 tuntia 5 päivän sijaan. Olemassa olevat tehtävät eivät muutu. Uudessa projektissa sama valinta on *Luo uusi projekti* -ikkunassa. Jos siellä valitaan kohdassa *Työvuoro* vaihtoehto *Päivätyövuoro*, *Tunnit* ei ole käytettävissä. Valitse toinen työvuoro tai aseta oletusmitta vasta projektin luomisen jälkeen kohdassa *Projektin asetukset*.

## Ongelmatilanteet ja mitä sovellus silloin tekee

**Ei kelvollisia työaikoja.** Jos tehtävän kalenterissa ei ole käytettäviä työaikoja, sovellus näyttää *Tällä kalenterilla ei ole kelvollisia työaikoja. Tarkista työpäivät ja työajat*. Laskettaessa voi tulla ilmoitus *Tuntitehtävällä 'name' ei ole kelvollisia työtunteja kalenterissaan*.

**Ei desimaaleja päivillä.** Kesto päivinä on kokonaisluku. `1.5d` antaa ilmoituksen *Syötä kokonaisluku päiviä tai tunteja, esimerkiksi 2d tai 12h*. Jos tarvitaan puolitoista päivää, kesto lasketaan tunteina.

**Muunnos ei voi olla tarkka.** Kaksitoista tuntia ei mahdu kokonaisiin 8 tunnin päiviin. Paneelissa *Ominaisuudet* ja ikkunassa *Muokkaa tehtävää* sovellus näyttää silloin keltaisen lohkon, jossa lukee *12h ei vastaa kokonaisia päiviä tässä kalenterissa. Mittayksikköä ei muutettu*. Sovellus jättää mitan ennalleen. Tehtävätaulukossa on lyhyempi ilmoitus: *Tätä kestoa ei voi muuntaa toiseen yksikköön tarkasti*.

**Kenttä on poissa käytöstä.** Vaiheelle, riippumatolle tai nollakestoiselle välitavoitteelle kesto määräytyy muusta asiasta, eikä sitä voi kirjoittaa.

**Tuntisuunnittelun poistaminen käytöstä.** Tuntitehtävät säilyvät ja niitä lasketaan edelleen. Niiden kestoa ei voi silloin muokata. Kentässä lukee *Ota tuntisuunnittelu käyttöön, jotta tätä tuntitehtävää voi muokata*, ja sen vieressä on painike, jolla tuntisuunnittelu otetaan takaisin käyttöön.

## Katso myös

- [Päivät ja tunnit](docs://uitleg-dagen-en-uren): miten sovellus laskee tunnit, mitä tapahtuu, kun päivät ja tunnit kohtaavat, ja missä se pyöristää.
- [Työaikojen asettaminen](docs://howto-werktijden-instellen): kalenterin ajat viikonpäivittäin.
- [Riippuvuuksien lisääminen](docs://howto-relaties-leggen): viive tunteina kahden tehtävän välillä.
- [Sovelluksen asetukset](docs://ref-instellingen): asetus Ota tuntisuunnittelu käyttöön ja mitä muuta se muuttaa.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): sisältää tuntitehtäviä (rebar fixing and pouring) omalla tuntikalenterillaan, *Hourly calendar, rebar fixing & pouring*.

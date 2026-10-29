# Työaikojen asettaminen

Tavoite: kirjaa viikonpäivittäin, mihin kellonaikoihin kalenteri työskentelee, jotta tunneissa suunnitellut tehtävät kulkevat oikeaan aikaan.

## Milloin tätä tarvitaan

Perjantain iltapäivä on vapaa. Työryhmä työskentelee kello 06:00–22:00 kahdessa työvuorossa. Lisäksi on yöryhmä. Tauko on lyhyempi kuin tunti. Jos suunnitellaan vain päivinä, *Alku (tunti)*, *Loppu (tunti)* ja tauko riittävät ([Kalenterin luominen ja määrittäminen](docs://howto-kalender-maken-en-toewijzen)). Jos tehtäviä suunnitellaan tunneissa, sovellus laskee työminuutit kalenterin **lohkojen** sisällä. Sovelluksessa näitä lohkoja kutsutaan nimellä *bands*. Lohko on yhtenäinen työaika yhtenä viikonpäivänä, ja väli kahden lohkon välillä on tauko. Mitä tämä merkitsee aikataulussa, kerrotaan kohdassa [Päivät ja tunnit](docs://uitleg-dagen-en-uren).

Jos tavalliselle kalenterille halutaan lohkoja, tarvitaan *Ota tuntisuunnittelu käyttöön* ([Tuntisuunnittelun käyttöönotto](docs://howto-urenplanning-aanzetten)). Jos kalenterissa on jo lohkoja, esimerkiksi MS Project -tiedostosta, *Työajat*-osio on aina näkyvissä. Lohkoja muutetaan silloin myös, kun tuntisuunnittelu on pois päältä.

## Vaiheet

### Työvuoroesiasetuksen valitseminen

1. Valitse *Aikataulu › Kalenteri › Kalenteri* ja napsauta vasemmalla olevaa kalenteria.
2. Napsauta *Työajat*-osiossa esiasetusta. Se korvaa kalenterin työpäivät ja työajat.
3. Napsauta *Käytä*.

Jokainen esiasetus tekee seuraavaa:

- *Päivätyövuoro*: maanantaista perjantaihin kello 08:00–16:00 ilman taukoa. Näin kalenteri palautuu tavalliseksi kalenteriksi ilman lohkoja.
- *2 työvuoroa*: maanantaista perjantaihin kello 06:00–14:00 ja 14:00–22:00, yhteensä 16 tuntia.
- *3 työvuoroa*: maanantaista perjantaihin kolme työvuoroa: 06:00–14:00, 14:00–22:00 ja 22:00–06:00 seuraavana päivänä, yhteensä 24 tuntia.
- *Yötyövuoro*: maanantaista perjantaihin kello 22:00–06:00 seuraavana päivänä, 8 tuntia.
- *24/7*: kaikki seitsemän päivää kello 00:00–24:00.

### Työaikojen asettaminen viikonpäivittäin

1. *Työajat*-osiossa napsauta *Aseta viikonpäivittäin…*. Painikkeiden alle ilmestyy rivi jokaiselle viikonpäivälle, ja siinä näkyy kyseisen päivän työaika. Kalenterissa on nyt lohkot viikonpäivittäin. Jos kalenterissa on jo lohkoja, tämä yleiskatsaus on heti auki. Painikkeen nimi on silloin *Piilota työajat*, ja sillä yleiskatsaus suljetaan.
2. Muuta kunkin lohkon alku- ja loppuaika kahdessa aikakentässä. Kirjoita kellonaika ja paina Enter-näppäintä, tai käytä nuolia (15 minuuttia askelta kohden). Kentät noudattavat asetusta *Kellonajan muoto*. *13:00* ja *1:00 PM* toimivat molemmat.
3. Jos halutaan lisätä tauko, napsauta sen päivän kohdalla **+** (*Lisää lohko*) ja muuta lohkojen ajat niin, että niiden väliin jää tauko. Uusi lohko alkaa kello 08:00 ja päättyy kello 16:00.
4. Lohko, joka kulkee keskiyön yli, merkitään valinnalla *seuraava päivä*. Lohko lasketaan sille päivälle, jona se alkaa.
5. Poista lohko napsauttamalla sen takana olevaa roskakoria. Päivä ilman lohkoja näkyy nimellä *Ei-työpäivä*.
6. Maanantaista perjantaihin olevan päivän kohdalla napsauta kopiointimerkkiä (*Kopioi kaikkiin työpäiviin*). Sen päivän lohkot kopioituvat maanantaista perjantaihin.
7. Yläpuolella *Työajat*-osiota on *Vakiotyöpäivä*: sovelluksen lohkoista johtama työaika päivää kohden, jolla sovellus laskee. Luku päivittyy heti, kun lohkoja muutetaan. Jos kalenterissa on oma tuntimäärä päivää kohden (esimerkiksi tiedostosta, joka on tehty ohjelmalla Primavera P6), oma arvo säilytetään ja siirtyy viennin mukana, kunnes esiasetus korvaa sen. Jos oma arvo poikkeaa kohdasta *Vakiotyöpäivä*, luvun alle ilmestyy oranssi ruutu, esimerkiksi: *Tiedoston oma työpäivä on 8 h. Se säilyy viennissä MS Projectiin ja P6:een. Siellä päivä on 8 h, täällä 10 h.* Ruutu katoaa heti, kun lohkot antavat saman päivän summan tai kun esiasetus korvaa oman arvon. Ruutu ei muuta laskentaa. Napsauta *Käytä*.

**Esimerkki: vapaa perjantai-iltapäivä.** Napsauta *Aseta viikonpäivittäin…*. Poista toinen lohko (13:00–16:00) kohdalta *Pe*. Perjantaissa on nyt 5 tuntia, muissa päivissä 8 tuntia. *Vakiotyöpäivä* pysyy 8 tuntina.

### Oman esiasetuksen tallentaminen

1. Napsauta *Tallenna esiasetukseksi…* ja kirjoita nimi kenttään *Oman esiasetuksen nimi*.
2. Napsauta *Tallenna*. Esiasetus on nyt muiden esiasetusten joukossa, ja sitä voi käyttää missä tahansa projektissa. Poista se taas napsauttamalla sen vieressä olevaa ristiä.

Oma esiasetus tallennetaan tälle laitteelle, ei projektitiedostoon.

## Valkuilut ja mitä sovellus silloin tekee

**Esiasetus korvaa kaiken.** Kun esiasetus valitaan, aiemmin asetetut työpäivät ja työajat katoavat. Vapaapäivät jäävät.

**Päiväpainikkeet muuttavat lohkoja.** Jos päivä poistetaan käytöstä kohdassa *Työpäivät*, sen päivän lohkot katoavat. Kun päivä otetaan uudelleen käyttöön, siihen palautuvat lohkot, jotka sillä oli, kun valintaikkuna avattiin (tai viimeisen esiasetuksen jälkeen). Muuten siihen palautuvat ensimmäisen työpäivän lohkot. *Ma–pe* tekee tämän maanantaista perjantaihin ja poistaa lauantain ja sunnuntain lohkot. *Jatkuva (24/7)* korvaa kaikki lohkot: jokaiselle päivälle tulee kello 00:00–24:00.

**Työaikojen muuttaminen, kun tuntisuunnittelu on pois päältä.** Kalenteri, jossa on lohkoja, säilyttää *Työajat*-osion, vaikka tuntisuunnittelu kytketään pois päältä. Lohkoja muutetaan siinä suoraan. Jos *Päivätyövuoro* valitaan, kalenteri muuttuu taas tavalliseksi kalenteriksi kentillä *Alku (tunti)*, *Loppu (tunti)* ja tauko. Lohkojen palauttaminen on silloin mahdollista vain, kun tuntisuunnittelu on päällä.

**Ei kelvollisia työaikoja.** Kalenteri ilman lohkoja tai ilman työpäiviä ei voi ottaa vastaan tehtävää, joka on suunniteltu tunneissa. Sovellus näyttää silloin viestin: *Tällä kalenterilla ei ole kelvollisia työaikoja. Tarkista työpäivät ja työajat.*

## Katso myös

- [Päivät ja tunnit](docs://uitleg-dagen-en-uren): miten sovellus laskee työtunnit ja johtaa vakiotyöpäivän.
- [Tuntisuunnittelun käyttöönotto](docs://howto-urenplanning-aanzetten): tehtävän suunnittelu tunneissa.
- [Kalenterit ja työpäivät](docs://uitleg-kalenders): mikä kalenteri koskee mitäkin tehtävää.
- [Kalenteri-ikkunat](docs://ref-kalenders): kaikki kalenteri-ikkunoiden kentät.

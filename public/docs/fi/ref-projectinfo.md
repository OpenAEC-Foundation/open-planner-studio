# Uusi projekti ja Projektin asetukset

Kentät *Uusi projekti* -ikkunassa ja *Projektin asetukset* -lomakkeessa: mitä kukin kenttä tekee, mikä on oletus ja missä se vaikuttaa. Ne ovat kaksi puolta samasta lomakkeesta. *Uusi projekti* luo uuden projektin, ja siinä on muutama lisäkenttä. *Projektin asetukset* muuttaa avoinna olevaa projektia.

## Avaaminen

**Uusi projekti** — *Tiedosto › Uusi*, Ctrl+N tai plusmerkki asiakirjavälilehtien oikealla puolella (*Aloita projekti*, sitten *Uusi projekti*). Ikkuna avautuu niin, että kohdistin on kentässä *Projektin nimi*.

**Projektin asetukset** — *Asetukset › Projekti › Projektin asetukset* avaa lomakkeen ikkunana, jonka otsikko on *Projektin asetukset*. *Tiedosto › Projektin asetukset* näyttää saman lomakkeen *Tiedosto*-näkymässä. Osio *Laskentaprofiili ja laskentavaihtoehdot* on molemmissa paikoissa alhaalla. Sen sisältö on kohdassa [Laskentavaihtoehdot ja laskentasäännöt](docs://ref-rekenopties-en-conventies).

## Luo, Käytä ja peruuta

**Luo** (*Uusi projekti* -ikkunassa) luo projektin. Jos nykyinen välilehti on tyhjä ja muuttumaton, sovellus käyttää sitä. Muuten projekti avautuu uudelle välilehdelle. **Käytä** (*Projektin asetukset* -ikkunassa) kirjoittaa muutokset projektiin.

- **Vain kohdassa *Käytä*.** Luonnokseen kirjoitetaan. Projekti muuttuu vasta, kun *Käytä* napsautetaan. *Käytä* kirjoittaa vain sen, mitä todella muutettiin, yhdessä vaiheessa *Kumoa*-toiminnossa. Jos *Käytä* napsautetaan ilman muutoksia, ei tapahdu mitään eikä vaihetta lisätä.
- **Peruuta, rasti ja Esc** sulkevat ikkunan tallentamatta mitään. Ikkunan viereen napsauttaminen ei sulje sitä: kirjoitettu jää ennalleen.
- **Enter** tekee saman kuin *Luo* tai *Käytä*, paitsi kentässä *Kuvaus* ja avoimessa pudotusvalikossa.
- **Tiedosto**-näkymässä *Projektin asetukset* näyttää alareunassa *Muutoksia ei ole sovellettu. Säilytä ne napsauttamalla Käytä.* niin kauan kuin luonnos poikkeaa projektista. Jos näkymästä poistutaan, sovellus kysyy, halutaanko käyttää muutokset, hylätä ne vai peruuttaa. Katso [Valintanauha välilehdittäin](docs://ref-lint).
- **Nimetön mukautettu laskentaprofiili** estää *Käytä*- ja *Luo*-painikkeet. Anna sille nimi tai hylkää muutos.

## Kentät molemmissa ikkunassa

**Projektin nimi** — projektin nimi otsikkopalkissa, välilehdellä ja tiedostonimessä, kun tallennat. Oletus: tyhjä. Tyhjä kenttä on sallittu: projektin nimi on silloin *Uusi aikataulu*, harmaalla tekstinä kentässä. Missä: koko näkymässä.

**Kuvaus** — vapaa teksti. Oletus: tyhjä. Vaikutus: tallennetaan projektin mukana, IFC-tiedostoon ja Primavera P6 XML -vientiin. Aikatauluun sillä ei ole vaikutusta.

**Tekijä** — vapaa teksti. Oletus: tyhjä. Vaikutus: tulee IFC-tiedostoon ja näkyy raportin otsikossa rivillä *Tekijä:*. Sitä ei voi muokata raportissa.

**Kirjasto** — mihin kirjastoon projekti on linkitetty. Valinnat: *ei kirjastoa (erillinen projekti)*, omat kirjastosi ja *+ Uusi kirjasto*. Oletus: *Uusi projekti* -ikkunassa oletuskirjasto, *Projektin asetukset* -ikkunassa nykyinen linkki. Vaikutus: katso [Kirjaston käyttäminen](docs://howto-resourcebibliotheek-gebruiken). Kun *+ Uusi kirjasto…* valitaan, nimi kirjoitetaan kenttään alla. Kirjasto luodaan vasta kohdassa *Luo* tai *Käytä*, joten peruuttaminen ei jätä mitään jälkeen. Linkkiä *Projektin asetukset* -ikkunassa muutetaan vain, jos tätä kenttää muutetaan itse.

**Asiakas/organisaatio** — vapaa teksti. Oletus: tyhjä. Vaikutus: tulee IFC-tiedostoon ja näkyy raportin otsikossa rivillä *Yritys:*.

**Aloituspäivä** — projektin alku. Oletus: *Uusi projekti* -ikkunassa tänään. Mitä kenttä tekee, kerrotaan kohdassa *Mitä aloituspäivä tekee*.

**Päättymispäivä** — projektin suunniteltu päättymispäivä. Oletus: tyhjä. Vaikutus: tieto, ei vaatimus. Sovellus ei suunnittele kohti tätä päivää. Päivä näkyy raportin otsikossa ja vienneissä, ja se määrää, mihin vuoteen asti vapaapäivät luodaan. Vain Primavera-tiedostossa, jossa on asetus *Pelivara lasketaan projektin päättymispäivään asti*, pelivaran laskenta ulottuu tähän päivään. Katso [Laskentavaihtoehdot ja laskentasäännöt](docs://ref-rekenopties-en-conventies).

**Oletusmitta uusille tehtäville** — näkyy vain, kun *Ota tuntisuunnittelu käyttöön* on päällä. Valinnat: *Päivät* ja *Tunnit*. Oletus: *Päivät*. Vaikutus ja ehdot: katso [Tuntisuunnittelun ottaminen käyttöön](docs://howto-urenplanning-aanzetten).

**Laskentaprofiili ja laskentavaihtoehdot** — *Projektin asetukset* -ikkunassa koko osio. *Uusi projekti* -ikkunassa vain pudotusvalikko *Laskentaprofiili*, jossa ovat *Primavera P6*, *Microsoft Project* ja *Open Planner Studio*. Oletus: *Open Planner Studio*. Laskentaprofiilin valinta asettaa myös sen oletusvaihtoehdot. Katso [Laskentavaihtoehdot ja laskentasäännöt](docs://ref-rekenopties-en-conventies).

## Vain Projektin asetukset

**IFC-skeema tallennettaessa** — mikä IFC-skeema on tallennetun tiedoston otsikossa. Valinnat: *IFC 4.3 ADD2 (oletus)*, *IFC 4.3* ja *IFC4*. Oletus: *IFC 4.3 ADD2 (oletus)*. Avoimelle IFC-tiedostolle oletus on tiedoston oma skeema. Vaikutus: muuttuu vain tiedoston otsikko, ei sisältö. Valintaa käytetään, kun aikataulu yhdistetään rakennusmalliin samassa skeemassa. Jos avoimella tiedostolla on muu skeema kuin oletus, sovellus kysyy ensimmäisellä tallennuskerralla, säilytetäänkö tämä skeema. Tässä tehty valinta on vastaus siihen. Tämän valinnan muutos ei ole vaihe *Kumoa*-toiminnossa, koska skeema kuuluu tiedostoon. Katso [IFC-skeeman valitseminen](docs://howto-ifc-schema-kiezen).

## Vain Uusi projekti -ikkunassa

**Vaihepohja** — mitkä vaiheet projekti aloittaa. Valinnat: *Tyhjä*, *Asuntorakentaminen* ja *Toimitilarakentaminen / saneeraus*. Oletus: *Tyhjä*. Vaikutus: *Tyhjä* antaa projektin ilman tehtäviä. Kaksi muuta lisäävät valmiiksi kahdeksan vaihetehtävää. Kunkin kesto on 5 projektin oletusmitassa (5 työpäivää, tai 5 tuntia, jos *Tunnit* valitaan kohdassa *Oletusmitta uusille tehtäville*). Niissä ei ole riippuvuuksia. Ne nimetään, siirretään ja pidennetään itse. Asuntorakentamisessa nämä ovat: Bouwplaats & grondwerk, Fundering, Ruwbouw / casco, Dak, Gevel & afbouw, Installaties (W/E), Afwerking and Oplevering. Toimitilarakentamisessa nämä ovat: Sloop & strip-out, Grondwerk & fundering, Hoofddraagconstructie, Gevel & dak, Installaties (W/E), Afbouw, Inregelen & testen and Oplevering. Nimet ovat projektin tietoja ja pysyvät hollanniksi, myös muulla käyttöliittymän kielellä. Jos *Ota rakennustila käyttöön* on pois päältä, on olemassa vain *Tyhjä*. Katso [Sovelluksen asetukset](docs://ref-instellingen).

**Työvuoro** — näkyy vain, kun *Ota tuntisuunnittelu käyttöön* on päällä. Valinnat: *Päivätyövuoro*, *2 työvuoroa*, *3 työvuoroa* ja *24/7*. Oletus: *Päivätyövuoro*. Vaikutus: *Päivätyövuoro* jättää vakiokalenterin ennalleen, eli tavallisen päiväkalenterin maanantaista perjantaihin. Muut kolme lisäävät projektikalenteriin työaikalohkoja, samoin kuin *Kalenterit*-ikkunan samannimiset painikkeet. Mitkä ajat ne ovat, kerrotaan kohdassa [Työaikojen asettaminen](docs://howto-werktijden-instellen). Kun valittuna on *Päivätyövuoro*, kohdassa *Oletusmitta uusille tehtäville* ei voi valita *Tunnit*-vaihtoehtoa, koska päiväkalenterissa ei ole työaikalohkoja.

**Vapaapäiväluettelo** — mitkä vapaapäivät projektin kalenteriin tulevat. Kohdassa *Maa* valitaan *Alankomaat* (oletus), *Saksa*, *Belgia*, *Ranska*, *Iso-Britannia*, *Itävalta*, *Sveitsi*, *Ei vapaapäiviä* tai *Mukautettu…*. Jos maalla on alueita, lisätään pudotusvalikko *Alue*. Alankomaille valitaan lisäksi, jos *Ota rakennustila käyttöön* on päällä, *Rakennusalan kesäloma*: *Ei mitään* (oletus), *Pohjoinen*, *Keski* tai *Eteläinen*. Sen alla on rivi *36 vapaapäivä(ä), 2025–2029*. Sitä napsauttamalla luettelo laajenee. Vuodet alkavat aloitusvuotta edeltävästä vuodesta ja päättyvät päättymisvuotta seuraavaan vuoteen. Jos päättymispäivää ei ole, vuodet ulottuvat kolme vuotta aloitusvuoden jälkeen. *Mukautettu…* antaa kalenterin ilman vapaapäiviä. Heti luomisen jälkeen avautuu *Kalenterit*-ikkuna, jossa ne voidaan täyttää itse. Projektikalenterin nimi on *Bouwkalender NL*, tai *Standaardkalender*, jos *Ota rakennustila käyttöön* on pois päältä. Valinta on silloin myös *Ei vapaapäiviä*. Vapaapäivien luomisen tarkka toiminta on kohdassa [Vapaapäivien ja rakennusalan kesälomän luominen](docs://howto-feestdagen-genereren).

## Mitä aloituspäivä tekee

Aloituspäivä on projektin lähtökohta. Siihen liittyy kolme sääntöä:

- **Uudet tehtävät alkavat aloituspäivänä.** Lisätty tehtävä saa projektin aloituspäivän suunnitelluksi alkupäiväksi.
- **Tehtävä, jolla on edeltäjä, ei ala koskaan ennen aloituspäivää.** Jos edeltäjän loppu on aikaisemmin, tehtävä odottaa aloituspäivään asti. Tehtävä *ilman* edeltäjää säilyttää oman päivänsä, vaikka se olisi ennen aloituspäivää. Tämä tarvitaan, jotta aikataulu näkyy MS Project -ohjelmasta tai Primaverasta samoin kuin lähdeohjelma sen näyttää. Rajoite *Täytyy alkaa (MSO)* tai *Täytyy päättyä (MFO)* rikkoo molemmat säännöt: tällainen tehtävä on omalla päivässään, vaikka se osuisi ennen aloituspäivää.
- **Myöhempi aloituspäivä siirtää vapaita tehtäviä mukanaan.** Jos aloituspäivä asetetaan myöhemmäksi kohdassa *Projektin asetukset* ja *Käytä* napsautetaan, siirtyvät tehtävät uuteen päivään. Ne ovat tehtäviä, joilla ei ole edeltäjää eikä alarajaa asettavaa rajoitetta (*alkaa aikaisintaan*, *täytyy alkaa*, *päättyy aikaisintaan* tai *täytyy päättyä*), ja jotka jäisivät uuden päivän eteen. Siirto tapahtuu samassa vaiheessa *Kumoa*-toiminnossa. Sovellus kertoo, kuinka monta tehtävää siirrettiin. Näin tapahtuu vain, kun aloituspäivää muutetaan itse, ei koskaan tiedostoa avattaessa. Aloituspäivän myöhentäminen ei siirrä muuta aikataulua. Sen tekee *Siirrä projekti*, katso [Projektin siirtäminen](docs://howto-project-verplaatsen).

## Katso myös

- [Laskentavaihtoehdot ja laskentasäännöt](docs://ref-rekenopties-en-conventies): osio *Laskentaprofiili ja laskentavaihtoehdot*.
- [Laskentaprofiilit ja laskentasäännöt](docs://uitleg-rekenprofielen): miksi profiili muuttaa tuloksen.
- [Projektin siirtäminen](docs://howto-project-verplaatsen): koko aikataulu toiseen aloitukseen.
- [Tehtävien ja välitavoitteiden lisääminen](docs://howto-taken-en-mijlpalen-toevoegen): aloittaminen ensimmäisillä tehtävillä.
- [Vapaapäivien ja rakennusalan kesälomän luominen](docs://howto-feestdagen-genereren): vapaapäiväluettelo yksityiskohtaisesti.
- [IFC-skeeman valitseminen](docs://howto-ifc-schema-kiezen): tallentaminen rakennusmallia varten IFC4-muodossa.

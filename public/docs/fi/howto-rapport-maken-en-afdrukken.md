# Raportin tekeminen ja tulostaminen

Tavoite: valitaan aikataulusta raportti, tarkistetaan se esikatselussa ja tallennetaan PDF-muodossa, jotta sen voi jakaa tai tulostaa itse.

## Milloin tätä tarvitaan

Perjantaina on työmaakokous. Asiakas haluaa aikataulun paperilla, työmaapäällikkö haluaa tietää, mikä alkaa lähiviikkoina, ja työnjohtaja haluaa arkin, jossa on vain hänen omat tehtävänsä. Tällaisia yleiskatsauksia tehdään *Raportti*-välilehdellä. Sovellus laskee ne aikataulusta ja näyttää ne ensin esikatselussa. Sen jälkeen ne viedään PDF-tiedostoksi.

Sovellus ei lähetä raporttia itse tulostimelle. Lopputulos on aina PDF. Sen voi tulostaa PDF-lukijalla tai lähettää sähköpostilla.

## Vaiheet

### 1. Avaa Raportti-välilehti

Valitse valintanauhasta *Raportti*, tai paina Ctrl+P. Ctrl+P avaa tämän välilehden. Jos kenttään kirjoitetaan, dialogi on auki tai esitystila on päällä, Ctrl+P ei toimi. Selaimessa avautuu silloin selaimen tulostusikkuna, ja se tulostaa näytön eikä raporttia.

Vasemmalla on *Raportti*-sarake, jossa ovat *Raporttityyppi*-luettelo, yhteenveto ja asetukset. Oikealla on esikatselu.

### 2. Valitse raporttityyppi

*Raporttityyppi*-luettelossa on yksitoista raporttia. Valitse se, joka vastaa kysymykseen.

- *Gantt-tulostus*: aikataulu palkkikaaviona, tavallista jaettavaa aikataulua varten.
- *Resurssikaavio*: samat palkit, mutta jokaiselle resurssille oma kaistansa. Sopii kysymykseen, mitä työryhmä X tekee. Halutessa kullekin työryhmälle oma arkki.
- *Välitavoitteet*: kaikki välitavoitteet päivämäärineen ja tiloineen.
- *Ero*: nykyinen aikataulu aktiivisen perustason rinnalla. Sopii kysymykseen: kuinka paljon ollaan myöhässä?
- *Look-ahead*: se, mikä on käynnissä tai alkaa tulevalla aikajaksolla. Lista viikkokokoukseen.
- *Kriittinen ja lähes kriittinen*: tehtävät, joissa pelivara on nolla tai lähes nolla.
- *Edistymisraportti*: missä hanke on raportointipäivänä, eli päivänä, jolloin edistyminen mitataan.
- *Aikataulun kunto*: tarkistus, jolla etsitään virheitä ja epätavallisia arvoja itse aikataulusta.
- *Resurssikuormitus*: kullekin resurssille viikoittain tai kuukausittain, mitä tarvitaan verrattuna siihen, mitä on käytettävissä.
- *Resurssikohdistukset*: kullekin resurssille ne tehtävät, joihin se on kohdistettu.
- *WBS-yhteenveto*: aikataulu koottuna WBS-tasoittain johdolle.

### 3. Varmista, että aikataulu on ajan tasalla

Sovellus ei laske aikataulua itse. Jos tehtäviä, riippuvuuksia tai kalentereita on muutettu viimeisen laskennan jälkeen, paina **Laske** (F5). Taulukkoraportit varoittavat itse raportin yläosassa: *Aikataulua on muutettu viimeisen laskennan jälkeen — paina Laske (F5) ajantasaisten arvojen saamiseksi.* Tai jos sitä ei ole laskettu koskaan: *Ei vielä laskettu — paina Laske (F5) päivämääriä ja pelivaraa varten.*

*Raportti*-välilehden valintanauhassa ei ole Laske-painiketta, mutta F5 toimii täälläkin hyvin. **Vie PDF** laskee myös ensin itse, jos aikataulu ei ole ajan tasalla, joten PDF ei koskaan jää jälkeen aikataulusta.

### 4. Säädä raporttia

*Asetukset*-osassa ovat Gantt-tulostuksen ja Resurssikaavion valinnat. Look-ahead, Kriittinen ja lähes kriittinen, Edistymisraportti, Aikataulun kunto, Resurssikuormitus, Resurssikohdistukset ja WBS-yhteenveto sisältävät vain asetukset *Paperi:* ja *Suunta:*, sekä *Raporttivalinnat*-osan, jossa ovat kyseisen raportin valinnat. Välitavoitteet ja Ero eivät sisällä omia valintoja. Raportin aikajakso on kuvattu kohdassa [Raportointiaikajakson valitseminen](docs://howto-rapportageperiode-kiezen).

- *Paperi:* ja *Suunta:* määrittävät arkin. Oletuksena on A3 vaakasuunnassa. Se sopii hyvin rakennusaikatauluun, mutta kaikki tulostimet eivät tulosta A3-kokoa. Jos käytössä on A4-tulostin, valitse A4 jo nyt. Sovellus silloin asettelee sivut A4-kokoon, eikä sivuja tarvitse pienentää myöhemmin.
- Resurssikaaviossa valintaruutu *Jokainen resurssi omalle sivulle* antaa kullekin työryhmälle oman arkin.
- *Fonttikoko:* (90%–125%) suurentaa tai pienentää tekstin ja taulukon. Suurempi fontti jättää aikajanalle vähemmän tilaa.
- *Seuraa näkymää (suodatin, ryhmittely, järjestys)* näkyy vain Gantt-tulostuksessa. Oletuksena koko tehtäväpuu menee paperille. Tällä valintaruudulla raportti piirtää täsmälleen ne rivit, jotka näkyvät näytöllä, mukaan lukien supistetut vaiheet, esimerkiksi vain kriittiset tehtävät asettelusta. Miten tällainen näkymä tehdään, on kuvattu kohdassa [Asettelun luominen ja käyttö](docs://howto-layouts-gebruiken).
- *Näytä perustason suunnitelman peitto* näyttää aktiivisen perustason nykyisten palkkien rinnalla. Kohdassa *Tilaviiva:* valitaan joko *Raportointipäivän viiva* tai *Edistymisviiva*.
- *Automaattinen sovitus* on oletuksena päällä: aikajana skaalataan sivun leveyteen, ja sivujen määrä seuraa korkeudesta. Jos se kytketään pois, raportti käyttää kiinteää zoomia ja jakaa aikajanan myös leveyssuunnassa, mikä tuottaa nopeasti monta sivua. Kohdassa *Aikajana jakautuu:* aikajana levitetään automaattisessa sovituksessa 2–8 sivun leveydelle. Tämä sopii pitkälle aikataululle, joka tulostetaan luettavassa koossa.

### 5. Tarkista esikatselu

Gantt-tulostuksessa ja Resurssikaaviossa näet paperin, jossa on sivun otsikko, taulukko, aikajana ja selite. Selaa sivuja. *Esikatselun laatu* määrittää vain, kuinka terävä esikatselu on näytöllä. PDF ei muutu sen myötä. Jos sivujen alla lukee *… ja 1 sivu lisää — vie koko asiakirja* (tai useammilla sivuilla *… ja 2 sivua lisää — vie koko asiakirja*), esikatselussa ei ole vielä kaikkia sivuja valmiina. PDF sisältää ne kaikki.

Muut raportit näytetään näytöllä taulukkona. Se, mitä näet, päätyy myös PDF-tiedostoon.

### 6. Vie PDF-tiedostoksi

Valitse vasemman sarakkeen alareunasta **Vie PDF**. Ehdotettu tiedostonimi koostuu projektin nimestä ja raporttityypistä. Esimerkiksi Gantt-tulostuksessa se on *Extension house-planning.pdf*.

- Työpöytäsovelluksessa ja selaimessa, jossa on tiedostojen tallennusikkuna, valitaan, minne PDF tallennetaan. Jos tallennusikkuna suljetaan tallentamatta, ei tapahdu mitään.
- Selaimessa, jossa tällaista ikkunaa ei ole, selain tallentaa PDF-tiedoston latausten kansioon.

### 7. Tulosta PDF

Avaa PDF PDF-lukijassa ja tulosta se siellä. Jos A3-PDF tulostetaan A4-tulostimella, tulostusikkunan on pienennettävä sivut. Aseta siksi paperikoko ensin, vaiheessa 4.

## Valkuilut ja mitä sovellus tekee

**Tulosta-painike ja Ctrl+P eivät tulosta.** *Tulosta*-painike *Raportti*-ryhmässä on itse Raportti-välilehdellä, eikä se tee mitään muuta. Ctrl+P avaa tämän välilehden. Sovelluksessa ei ole erillistä tulostuskomentoa. Paperille pääsee PDF-tiedoston kautta. Jos Ctrl+P ei toimi (katso vaihe 1), selaimen tulostusikkuna avautuu selaimessa, ja se tulostaa näytön eikä raporttia.

**Yritys: ylikirjoitusta ei säilytetä.** Gantt-tulostuksen *Yritys:*-kentän alkuarvo on projektitiedoissa oleva yritys. Ylikirjoitettua arvoa ei säilytetä. Kenttään *Tekijä:* ei voi kirjoittaa tässä. Molemmat muutetaan kohdasta *Asetukset › Projekti › Projektin asetukset*, kentistä *Tilaaja/organisaatio* ja *Tekijä*, ja vahvistetaan *Käytä*-painikkeella.

**Palkkien värit: koskee myös näyttöä.** Raportin *Palkkien värit:* -valinta on sama kuin Näytä-välilehden *Palkkien värit* -valinta. Jos valinta muutetaan raportissa, myös näytön Gantt muuttuu.

**Ero ilman perustasoa.** Perustaso on tallennettu kopio aikataulusta, johon nykyistä verrataan myöhemmin. Ohje sen tallentamiseen on kohdassa [Perustason tallentaminen ja hallinta](docs://howto-baseline-opslaan-en-beheren). Jos aktiivista perustasoa ei ole, vertailun sijaan näkyy teksti *Ei aktiivista perustasoa — tallenna perustaso tai aseta yksi aktiiviseksi.*

**Tilaviiva ilman raportointipäivää.** Jos *Tilaviiva:* valitaan hankkeella, jolla ei ole raportointipäivää, raportti varoittaa tekstillä *Aseta ensin raportointipäivä* eikä piirrä mitään. Raportointipäivä asetetaan kohdassa *Aikataulu › Perustasot ja edistyminen › Raportointipäivä*.

**Aikataulussa on silmukka.** Jos aikataulussa on silmukka, *Vie PDF* ei luo tiedostoa ja näyttää virheen.

**Paperi koskee tällä hetkellä kaikkia raportteja.** *Paperi:* ja *Suunta:* -valinta on yksi ja yhteinen kaikille raporteille. Välitavoitteet ja Ero eivät sisällä omaa paperivalintaa. Ne käyttävät sitä, mikä on asetettu toisessa raportissa, oletuksena A3 vaakasuunnassa. Valitse siksi paperi ensin raportissa, joka sen tarjoaa, esimerkiksi Gantt-tulostuksessa, ja palaa sitten takaisin.

**Valinnat koskevat kaikkia projekteja.** Paperi, fonttikoko, aikajakso ja muut valinnat muistaa sovellus tällä laitteella kaikille projekteille. Ne eivät kuulu projektitiedostoon.

## Katso myös

- [Raportointiaikajakson valitseminen](docs://howto-rapportageperiode-kiezen): Look-ahead tai edistymisraportti tietyltä aikajaksolta.
- [Asettelun luominen ja käyttö](docs://howto-layouts-gebruiken): suodata tai ryhmittele ensin ja tulosta sitten *Seuraa näkymää* -valinnalla.
- [Perustason tallentaminen ja hallinta](docs://howto-baseline-opslaan-en-beheren): tallennettu kopio, johon Ero vertaa.
- [Ylikuormituksen ratkaiseminen](docs://howto-overbezetting-oplossen): mitä tehdään, kun Resurssikuormitus näyttää ylikuormitettuja viikkoja.
- [Kriittinen polku ja pelivara](docs://uitleg-kritiek-pad): miksi tehtävä on kriittinen tai lähes kriittinen.
- [Raporttityypit](docs://ref-rapporttypes): kaikki raporttityypit ja niiden valinnat.

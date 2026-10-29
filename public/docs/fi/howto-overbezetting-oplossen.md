# Ylikuormituksen ratkaiseminen

Tavoite: selvitetään, minä päivinä resurssilla on liikaa työtä, ja ratkaistaan tilanne, ja ratkaistaan tilanne. Yleensä tehtävät tasataan.

## Milloin tätä tarvitaan

Paperilla aikataulu toimii, mutta muurari työskentelee kahdella seinällä, jotka ovat samoina päivinä. Sovellus kutsuu tätä **ylikuormitukseksi**. Resurssi on ylikuormitettu työpäivänä, jos aikataulu vaatii siltä kyseisenä päivänä enemmän kuin sen kapasiteetti (*Enimmäismäärä*). Resurssi on ylikuormitettu myös, jos se ei kalenterinsa mukaan työskentele kyseisenä päivänä.

Ensin etsitään ylikuormitus. Sitten valitaan ratkaisu. **Tasaaminen** on ratkaisu, jonka sovellus laskee valmiiksi: se siirtää tehtäviä myöhemmäksi, kunnes resurssi pystyy tekemään työn. Miten se lasketaan, kerrotaan kohdassa [Resurssien tasaaminen](docs://uitleg-nivelleren).

## Vaiheet

### 1. Etsi ylikuormitus

1. Katso valintanauhasta *Resurssit › Ylikuormitus*. Siinä lukee *Ei mitään*, tai punaisella näkyy ylikuormitettujen resurssien määrä, esimerkiksi *1 resurssi*. Laskennan jälkeen myös tilarivi näyttää *⚠ Resurssien ylikuormitukset: 1*.
2. Napsauta tätä viestiä tilarivillä. Oikealle aukeaa *Varoitukset*-paneeli. Siinä on rivi jokaiselle resurssille, esimerkiksi *Bricklayer* ja *Ylikuormitus 5 pv (29-06-2027 – 05-07-2027)*.
3. Napsauta tätä riviä. Sovellus kytkee histogrammin päälle, valitsee resurssin ja kaikki tehtävät, joissa resurssi on mukana.
4. Katso histogrammia Gantt-kaavion alapuolella. Punaiset pylväät ovat ylikuormitettuja päiviä. Kun hiiri viedään päivän päälle, nähdään, mitkä tehtävät kuormittavat sitä. Esimerkiksi *2 tehtävää kuormittaa päivänä 2027-06-30*, ja tehtävien nimet näkyvät alla.

Histogrammin voi kytkeä päälle myös valitsemalla *Resurssit › Histogrammi › Histogrammi*. Valitse resurssi vasemmalla olevasta luettelosta, tai siirry resurssien välillä painikkeilla *Palaa* ja *Jatka*. Punainen piste luettelossa tarkoittaa, että resurssi on ylikuormitettu. Rivi *Kaikki resurssit* laskee resurssit yhteen ilman materiaaleja.

Kun tehtävä on valittuna, histogrammi näyttää vain tämän tehtävän kuorman ja vain siinä mukana olevat resurssit. Poista valinta painamalla Esc. Silloin nähdään taas koko projekti.

### 2. Valitse ratkaisu

- **Enemmän kapasiteettia.** Jos toinen Bricklayer todella tulee, aseta *Enimmäismäärä* arvoon 2 (katso [Resurssien hallinta](docs://howto-resources-beheren)). Ylikuormitus poistuu silloin.
- **Vähemmän kuormitusastetta päivässä.** Pienennä arvoa *Kuormitusaste* tai valitse resurssikohdistukselle toinen käyrä (katso [Resurssikohdistus käyrällä](docs://howto-resource-toewijzen)).
- **Aseta tehtävät peräkkäin.** Lisää kahden tehtävän välille riippuvuus. Toinen tehtävä alkaa vasta ensimmäisen tehtävän lopun jälkeen (katso [Riippuvuuksien lisääminen](docs://howto-relaties-leggen)).
- **Tasaaminen.** Sovellus siirtää tehtävän alkamaan myöhemmin.

### 3. Tasaaminen

1. Varmista, että aikataulu on laskettu komennolla **Laske** (F5), esimerkiksi kohdasta *Aloitus › Aikataulu › Laske*.
2. Valitse *Resurssit › Tasaaminen › Tasaa…*. Ikkuna *Tasaa resurssit* aukeaa.
3. Päätä, saako projektin päättymispäivä siirtyä. Jos ruudun *Tasaa vain pelivaran sisällä — projektin päättymispäivä pysyy kiinteänä* valinta jätetään pois, päättymispäivä voi siirtyä. Jos valinta tehdään, sovellus siirtää tehtäviä vain niiden pelivaran sisällä.
4. Kohdassa *Resurssit* on ne resurssit, jotka tasataan. Oletuksena kaikki resurssit on valittu, paitsi materiaalit. Poista valinta resurssilta, jonka haluat jättää ennalleen.
5. Napsauta *Laske*. Laskennan aikana sovellus näyttää *Lasketaan…*, ja sen voi keskeyttää painikkeella *Lopeta*. Aikataulu ei vielä muutu: kyseessä on ehdotus.
6. Lue ehdotus. Yllä on päättymispäivä, esimerkiksi *Projektin päättymispäivä: ennallaan (30-08-2027)* tai *Projektin päättymispäivä: 25-08-2027 → 30-08-2027*. Sen alla on taulukko. Siinä näkyy jokaisen tehtävän *Vanha alku*, *Uusi alku* ja *Siirretyt päivät*, esimerkiksi *Build outer cavity leaf*, 29-06-2027, 06-07-2027 ja *5 pv*.
7. Valitse *Käytä*. Sovellus kirjoittaa siirrot tehtäviin ja laskee aikataulun uudelleen heti. F5-näppäintä ei tarvitse painaa. *Peruuta* sulkee ikkunan ilman muutosta.
8. Tarkista *Resurssit › Ylikuormitus*. Siinä lukee nyt *Ei mitään*.

Jos ikkunan asetusta muutetaan, kun *Laske*-painiketta on jo painettu, ehdotus katoaa. Paina sitten *Laske* uudelleen. Jos aikataulu muuttuu sovelluksen laskiessa, sovellus näyttää viestin *Aikataulua muutettiin laskennan aikana. Paina Laske-painiketta uudelleen*.

### Päättäminen, mikä tehtävä pysyy paikallaan

Sovellus sijoittaa tehtävät yksi kerrallaan. Tehtävät, jotka tulevat ensin, pysyvät paikallaan. Ensin tulevat tehtävät, joilla on korkein prioriteetti. Jos prioriteetti on sama, ensin tulee tehtävä, jolla on vähiten pelivaraa.

Jos halutaan itse päättää, mikä tehtävä pysyy, sille annetaan korkeampi prioriteetti. Napsauta tehtävän palkkia Gantt-kaaviossa hiiren oikealla painikkeella ja valitse *Prioriteetti*, sitten *Matala* (100), *Normaali* (500) tai *Korkea* (900). *Normaali* on oletus. Luvun 0–1000 voi myös kirjoittaa itse sarakkeeseen *Tasaamisprioriteetti*: napsauta tehtävätaulukon otsikon oikealla puolella olevaa **+**-merkkiä (*Lisää sarake*) ja valitse sarake ryhmästä *Aikataulu*. Mitä suurempi luku, sitä todennäköisemmin tehtävä pysyy paikallaan. Sovellus ei hyväksy lukua yli 1000. Tehtävä, jonka prioriteetti on 1000, ei siirry kapasiteetin takia koskaan.

### Kumoaminen ja palauttaminen

- *Kumoa* (Ctrl+Z) kumoaa *Käytä*-toiminnon yhdellä askeleella.
- *Resurssit › Tasaaminen › Poista tasaaminen* poistaa kaikki tasaamiset tehtävistä. Painike on harmaa niin kauan kuin tasaamista ei ole. Ylikuormitus, joka näin palaa, on yksinkertaisesti taas näkyvissä.
- Jos aikataulua on muutettu sen jälkeen, valitse vain uudelleen *Tasaa…*. Sovellus aloittaa silloin alusta. Vanhoja siirtoja ei oteta huomioon.

## Ongelmatilanteet ja mitä sovellus silloin tekee

**Ei vielä laskettu.** Jos aikataulua ei ole laskettu, ikkunassa lukee *Laske aikataulu ensin (F5) ennen tasaamista*. Painike *Laske* ei ole käytettävissä.

**Jäljellä olevat ristiriidat.** Siirtämällä ei voi ratkaista jokaista ylikuormitusta. Tehtävät, jotka jäävät ratkaisematta, luetellaan kohdassa *Jäljellä olevat ristiriidat*. Mukana ovat päivien määrä ja syy:

- *Vapaa kapasiteetti pelivaran sisällä ei riitä tämän ristiriidan ratkaisemiseen.* Tämän näkee, kun tasataan vain pelivaran sisällä: tehtävän pelivarassa ei ole vapaata hetkeä. Poista ruudun valinta, jolloin päättymispäivä voi siirtyä.
- *Resurssi ei työskentele kaikkina päivinä, joita tämä tehtävä tarvitsee. Siirtäminen ei ratkaise tätä*. Resurssilla on oman kalenterinsa mukaan vapaapäiviä tehtävän keskellä. Muuta kalenteria tai tehtävää.
- *Bricklayer vaatii huipussa 2 kuormitusastetta/päivä, kapasiteetti on 1. Tätä ei voi ratkaista siirtämällä*. Käyrän vuoksi tehtävä yksinään vaatii yhtenä päivänä enemmän kuin resurssi pystyy antamaan. Valitse toinen käyrä tai pienennä kuormitusastetta.

**Siinä lukee** *Yhtään tehtävää ei tarvitse siirtää — aikataulu on jo ristiriidaton.* Jos tämä rivi näkyy yhdessä ehdotuksen luettelon *Jäljellä olevat ristiriidat* kanssa, luota luetteloon. Rivi kertoo vain, ettei mitään tarvitse siirtää. Jos rivi näkyy ilman luetteloa, vaikka *Resurssit › Ylikuormitus* näyttää vielä yhden resurssin, niin kaikki ristiriitaiset tehtävät on kiinnitetty prioriteetilla 1000 tai ne ovat jo alkaneet. Ne eivät siirry, eikä ikkuna ilmoita niitä ristiriitana. Tarkista sen vuoksi aina käytön jälkeen *Ylikuormitus*.

**Tehtävät, jotka eivät siirry.** Tehtävä, joka on jo alkanut tai päättynyt, ei siirry koskaan. Sen kuorma otetaan silti huomioon. Välitavoitteet ja vaiheet eivät myöskään siirry.

**Materiaalia ei tasata.** Jos materiaaliresurssi vaatii päivänä enemmän kuin sen *Enimmäismäärä*, se näkyy ylikuormituksena kohdassa *Ylikuormitus*. Se ei ole mukana ikkunassa *Tasaa resurssit*.

**Tasaaminen ei mukaudu.** Viiveet pysyvät niin kuin ne laskettiin. Jos tehtävän kestoa muutetaan myöhemmin, tasattu tehtävä pysyy paikallaan, vaikka paikka ei enää ole tarpeen. Tasaa silloin uudelleen.

**Ylikuormitus kalenterin takia.** Jos resurssi ei kalenterinsa mukaan työskentele päivänä, *Varoitukset*-paneeli kertoo esimerkiksi: *Ylikuormitus 5 pv (29-06-2027 – 05-07-2027), joista 1 pv ei ole työpäiviä kalenterin mukaan*. Jos tehtävä kulkee aina tällaisen päivän yli, mikä on edellä mainittu toinen syy, tasaaminen ei ratkaise sitä.

## Katso myös

- [Resurssien tasaaminen](docs://uitleg-nivelleren): mitä tasaaminen siirtää pelivaran sisällä ja sen ulkopuolella, ja mitä se ei tee.
- [Resurssien hallinta](docs://howto-resources-beheren): resurssin kapasiteetin ja kalenterin muuttaminen.
- [Riippuvuuksien lisääminen](docs://howto-relaties-leggen): tehtävien asettaminen peräkkäin.
- [Ilmoitukset ja varoitukset](docs://ref-meldingen): ylikuormitusvaroitus paneelissa *Varoitukset*.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): rappaajat ovat ylikuormitettuja 5 päivänä. Kun *Tasaa vain pelivaran sisällä — projektin päättymispäivä pysyy kiinteänä* on päällä, projektin loppu pysyy 17. elokuuta 2027 ja yksi ristiriita jää jäljelle. Kun ruutu on pois päältä (oletus), kaikki ratkaistaan ja loppu siirtyy 24. elokuuta 2027.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): torninosturi on ylikuormitettu 65 päivänä ja rappaajat 15 päivänä. Tasaaminen, kun ruutu *Tasaa vain pelivaran sisällä — projektin päättymispäivä pysyy kiinteänä* on pois päältä, siirtää loppua päivästä 9. toukokuuta päivään 12. lokakuuta 2028.

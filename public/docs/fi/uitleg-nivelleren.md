# Resurssien tasaaminen

Yksi rakennusmuurari ja kaksi seinää pitää rakentaa samoina päivinä. Paperilla aikataulu toimii, mutta käytännössä muurari voi olla vain yhdessä paikassa. Tasaaminen ratkaisee tällaiset päällekkäisyydet: sovellus siirtää tehtäviä myöhemmäksi, kunnes resurssi pystyy hoitamaan ne. Tässä artikkelissa kerrotaan tarkasti, mitä tasaaminen siirtää, milloin projektin loppu siirtyy ja mitä se ei ratkaise puolestasi.

## Käsite

Resurssilla on **ylikuormitusta** työpäivänä, jos aikataulu vaatii siltä enemmän kuin se voi antaa. Sen antama määrä on sen kapasiteetti: *Enimmäismäärä* kalenterin työpäivinä. Jos resurssi ei työskentele sinä päivänä kalenterinsa mukaan, sen kapasiteetti on 0.

**Tasaaminen** ratkaisee sen saamalla tehtävät alkamaan myöhemmin. Se ei tee muuta. Se ei lyhennä tehtävää eikä jaa sitä. Se ei muuta kuormitusasteita eikä riippuvuuksia, eikä lisää ylimääräistä resurssia. Jokaiselle tehtävälle sovellus etsii ensimmäisen kohdan, jossa resurssit ovat vapaina, ja siirtää tehtävän sinne.

Ikkunassa *Tasaa resurssit* on kaksi tapaa:

- Oletuksena projektin loppu saa siirtyä mukana. Se on tasaamista siinä merkityksessä, jossa sitä yleensä tarkoitetaan.
- Kun ruutu *Tasaa vain pelivaran sisällä — projektin päättymispäivä pysyy kiinteänä* on valittu, sovellus siirtää tehtäviä vain niiden pelivaran sisällä. Projektin loppu pysyy silloin paikallaan. Jos se ei onnistu, tehtävä jää paikalleen ja sovellus näyttää ristiriidan. Mitä pelivara tarkoittaa, kerrotaan artikkelissa [Kriittinen polku ja pelivara](docs://uitleg-kritiek-pad).

## Miten sovellus laskee

### Kuinka paljon tehtävä vaatii

Jokaiselta työpäivältä sovellus laskee, kuinka monta kuormitusastetta kukin tehtävä vaatii resurssilta. Ne ovat kuormitusasteet käyrän mukaan tai oman tuntien jakautumisen mukaan, täsmälleen samat tunnit päivittäin kuin histogrammi näyttää. Resurssin kapasiteetti on *Enimmäismäärä*, tai sen päivän voimassa olevan, ajan mukaan jaotellun kapasiteettiportaan arvo. Päivä on ylikuormitettu, kun kysyntä on suurempi kuin kapasiteetti.

### Missä järjestyksessä

Sovellus sijoittaa tehtävät yksi kerrallaan tässä järjestyksessä: ensin korkein prioriteetti, sitten tehtävä, jolla on vähiten kokonaispelivaraa, sitten aikaisin alkava tehtävä ja lopuksi tehtävätaulukon järjestys. Tehtävä tulee vuoroon vasta, kun sen edeltäjillä on paikkansa.

Prioriteetti on luku 0 ja 1000 välillä, jonka asetat kullekin tehtävälle. Oletusarvo on 500. Tehtäväpalkin pikavalikossa sen nimi on *Prioriteetti*, ja valinnat ovat *Matala* (100), *Normaali* (500) ja *Korkea* (900). Aiemmin tuleva tehtävä saa paikan, jonka se haluaa. Myöhemmin tulevien tehtävien on sovittauduttava sen ympärille. Näin prioriteetti päättää, mikä tehtävä pysyy paikallaan ja mikä väistyy. Arvo 1000 on erikoinen: tällainen tehtävä ei koskaan siirry kapasiteetin takia. Se on MS Projectin "Do Not Level".

### Mihin tehtävä siirtyy

Jokaiselle tehtävälle sovellus alkaa varhaisimmasta alkamispäivästä, jonka riippuvuudet sallivat. Siinä otetaan huomioon, että edeltäjät on ehkä jo itse siirretty. Jos tehtävä mahtuu sinne, se pysyy. Jos ei mahdu, sovellus kokeilee tehtävän seuraavaa työpäivää, ja niin edelleen. Tehtävä mahtuu, jos jokaisena tehtävän päivänä jokainen resurssi on riittävän vapaa. Jos tehtävällä on useita resursseja, kaikkien on oltava vapaina noina päivinä. Tehtävä siirtyy siis aina myöhemmäksi, ei koskaan aiemmaksi.

Sovellus kirjaa siirron **tasaamisviiveeksi**: määräksi työpäiviä tehtävän kalenterissa, jonka verran tehtävä alkaa riippuvuuksien vaatimaa myöhemmin. Näet sen sarakkeessa *Tasaamisviive*, kohdassa *Lasketut*. Tasaamisviive tallennetaan projektin tiedoston mukana. *Laske* (F5) ottaa sen huomioon lisäodotusaikana ennen alkua. Tehtävät sen jälkeen siirtyvät mukana riippuvuuksien kautta.

### Pelivaran sisällä vai sen ulkopuolella

Ilman *pelivaran sisällä tasaamista* sovellus etsii, kunnes tehtävä mahtuu. Projektin loppu voi silloin siirtyä.

Kun *pelivaran sisällä tasaaminen* on käytössä, tehtävä ei saa alkaa myöhemmin kuin sen myöhäisin alkamispäivä. Myöhäisin alkamispäivä on viimeinen päivä, jona tehtävä voisi alkaa ilman, että projektin loppu siirtyy. Jos tehtävä ei mahdu siihen väliin, se jää varhaisimpaan paikkaansa. Tehtävä näkyy silloin kohdassa *Jäljellä olevat ristiriidat*.

### Mitä sovellus ei siirrä

- Tehtävät, jotka ovat jo alkaneet tai päättyneet. Niiden kuorma lasketaan mukaan, mutta niille ei koskaan tule tasaamisviivettä.
- Tehtävät, joiden prioriteetti on 1000. Ne seuraavat edeltäjiään, mutta eivät siirry kapasiteetin takia.
- Tehtävät ilman resurssikohdistusta valituille resursseille, välitavoitteet ja vaiheet. Ne siirtyvät mukana vain, jos edeltäjä siirtyy.
- Materiaali. Sitä ei tasata koskaan.

### Ehdotus ja käyttöönotto

*Laske* tekee ehdotuksen: tehtävät, jotka siirtyvät, vanhan ja uuden alkamispäivän kanssa sekä projektin loppu ennen ja jälkeen. Aikatauluun ei muutu mitään, ennen kuin *Käytä* valitaan. Sitten sovellus kirjoittaa viiveet tehtäviin ja lasketaan aikataulu heti uudelleen.

## Esimerkki: muurari kahdella seinällä

Esimerkki on opetusohjelmien harjoitusprojekti *House extension*, sellaisena kuin se on juuri ennen tasaamista opetusohjelmassa 5. Opetusohjelmassa 5 tehdään tämä itse ja tarkistetaan luvut. Tässä esimerkissä rappaus on *Kiinteä työmäärä* -tehtävä ja rappaaja työskentelee kuormitusasteella 2, kuten artikkelissa [Tehtävätyypit: kesto, kuormitusaste ja työ](docs://uitleg-werkregels).

Heti ontelolattian jälkeen, joka päättyi maanantaina 28. kesäkuuta, alkavat sisempi kuorimuuri (5 työpäivää) ja ulompi kuorimuuri (6 työpäivää) molemmat tiistaina 29. kesäkuuta. Molemmat ovat rakennusmuurarin vastuulla, kuormitusasteella 1 ja *Enimmäismäärä* 1. Sisemmän kuorimuurin jälkeen tulevat kattoelementit (6 tunnin nosturityö) ja kattotyöt (2 työpäivää). Ikkunakehykset odottavat kattotöitä ja ulompaa kuorimuuria. Luovutus on maanantaina 30. elokuuta.

### Ylikuormitus

Sisempi kuorimuuri kulkee 29. kesäkuuta – 5. heinäkuuta mukaan lukien, ulompi 29. kesäkuuta – 6. heinäkuuta mukaan lukien. Päivinä 29. kesäkuuta – 5. heinäkuuta mukaan lukien, eli 5 työpäivänä, aikataulu vaatii rakennusmuurarilta 2 kuormitusastetta, kun kapasiteetti on 1. Rakennusmuurarilla on noina 5 päivänä ylikuormitusta.

### Järjestys

Molemmilla tehtävillä on prioriteetti 500. Ikkunakehykset toimitetaan vasta 14. heinäkuuta. Opetusohjelmassa 3 asetetaan siihen rajoite *Alkaa aikaisintaan (SNET)*. Sen vuoksi sisemmällä kuorimuurilla on 3 työpäivän pelivara ja ulommalla 5. Sisemmällä on vähiten pelivaraa, joten se tulee ensin. Se pysyy paikallaan 29. kesäkuuta – 5. heinäkuuta mukaan lukien.

### Siirtymä

Ulompi kuorimuuri ei voi alkaa 29. kesäkuuta. Ensimmäinen päivä, jona muurari on taas vapaa, on tiistai 6. heinäkuuta. Se on 5 työpäivää myöhemmin kuin varhaisin alkamispäivä, joten tasaamisviive on 5. Ulompi kuorimuuri kulkee nyt 6. heinäkuuta – 13. heinäkuuta mukaan lukien. Ikkunakehykset alkavat joka tapauksessa vasta 14. heinäkuuta, joten luovutus pysyy maanantaina 30. elokuuta. Ikkunassa lukee *Projektin päättymispäivä: ennallaan (30-08-2027)* ja se näyttää yhden rivin: *Build outer cavity leaf*, vanha alku 29-06-2027, uusi alku 06-07-2027, *5 pv*.

Tämä 5 työpäivän siirtymä on täsmälleen ulomman kuorimuurin pelivara. Siksi *pelivaran sisällä tasaaminen* antaa tässä saman tuloksen. Ulommalla kuorimuurilla ei ole enää pelivaraa, ja se on kriittinen.

### Entä jos ikkunakehykset eivät tule 14. heinäkuuta

Ilman tuota rajoitetta ikkunakehykset voivat alkaa perjantaina 9. heinäkuuta, ja luovutus on keskiviikkona 25. elokuuta. Ulommalla kuorimuurilla on silloin vain 2 työpäivän pelivara.

- Ilman *pelivaran sisällä tasaamista* ulompi kuorimuuri siirtyy silti 5 työpäivää. Nyt ikkunakehykset joutuvat odottamaan: ne alkavat 14. heinäkuuta, 3 työpäivää myöhemmin. Kaikki niiden jälkeen tulevat siirtyvät mukana, ja luovutus siirtyy keskiviikosta 25. elokuuta maanantaihin 30. elokuuta, myös 3 työpäivää myöhemmin.
- Kun *pelivaran sisällä tasaaminen* on käytössä, mitään ei siirry. Ulompi kuorimuuri ei mahdu sen 2 työpäivän pelivaran sisään. Ikkuna näyttää ristiriidan *Build outer cavity leaf*, 5 pv, syynä *Vapaa kapasiteetti pelivaran sisällä ei riitä tämän ristiriidan ratkaisemiseen.*

### Entä jos ulompi kuorimuuri saa prioriteetin

Jos ulommalle kuorimuurille annetaan prioriteetti *Korkea* (900), se tulee ensin. Se pysyy 29. kesäkuuta, ja sisempi kuorimuuri väistyy nyt: se siirtyy 6 työpäivää myöhemmin, 7. heinäkuuta – 13. heinäkuuta mukaan lukien. Sisemmällä kuorimuurilla on vain 3 työpäivän pelivara, joten 6 työpäivän siirtymä on 3 liikaa. Kattoelementit, ikkunakehykset ja kaikki niiden jälkeen tulevat siirtyvät mukana. Luovutus siirtyy maanantaista 30. elokuuta torstaihin 2. syyskuuta. Sama ylikuormitus antaa siis eri projektin päättymispäivän sen mukaan, mikä tehtävä pysyy paikallaan.

### Entä jos toinen muurari tulee mukaan

Jos rakennusmuurarin *Enimmäismäärä* asetetaan arvoon 2, ylikuormitusta ei enää ole. *Laske* näyttää *Yhtään tehtävää ei tarvitse siirtää — aikataulu on jo ristiriidaton.*

## Seuraukset ja väärinkäsitykset

**"Tasaaminen löytää lyhimmän aikataulun."** Ei. Sovellus työskentelee tehtävä kerrallaan kiinteässä järjestyksessä eikä etsi kokonaisuudelle parasta ratkaisua. Katso esimerkki prioriteetilla: toinen prioriteetti antaa projektille toisen päättymispäivän.

**"Tasattu tehtävä on turvallinen."** Tasaaminen käyttää pelivaraa. Siirretyllä tehtävällä on sen jälkeen vähemmän pelivaraa tai ei lainkaan, ja se voi tulla kriittiseksi, kuten yllä oleva ulompi kuorimuuri. Jos se sitten myöhästyy, luovutus siirtyy.

**"Tasaaminen seuraa myöhempiä muutoksiani."** Ei. Tasaamisviive on kiinteä määrä työpäiviä. Jos sisempi kuorimuuri lyhenee tasaamisen jälkeen, ulompi kuorimuuri alkaa silti 5 työpäivää myöhemmin, vaikka sitä ei enää tarvita. Tee tasaaminen sitten uudelleen. Sovellus aloittaa silloin alusta.

**Kaikkea ei voi ratkaista siirtämällä.** Jos resurssi ei tee töitä päivinä, joina tehtävä niitä tarvitsee, tai jos tehtävän käyrä vaatii yhtenä päivänä enemmän kuin resurssi voi antaa, ylikuormitus jää. Sovellus kertoo silloin tehtävän kohdalla, miksi.

**Materiaalia ei tasata.** Jos materiaali vaatii yhtenä päivänä enemmän kuin sen kapasiteetti, sovellus näyttää sen ylikuormituksena, mutta tasaaminen jättää sen ennalleen.

**Lukitut tehtävät.** Jos kaikki ristiriitaiset tehtävät ovat prioriteetilla 1000, ikkunassa lukee *Yhtään tehtävää ei tarvitse siirtää — aikataulu on jo ristiriidaton.*, vaikka ylikuormitus jää. Katso siksi käyttöönoton jälkeen valintanauhasta viesti *Ylikuormitus*.

## Katso myös

- [Ylikuormituksen ratkaiseminen](docs://howto-overbezetting-oplossen): vaiheet ylikuormituksen löytämiseen ja tasaamiseen.
- [Kriittinen polku ja pelivara](docs://uitleg-kritiek-pad): mitä pelivara on ja miksi tehtävä tulee kriittiseksi.
- [Tehtävätyypit: kesto, kuormitusaste ja työ](docs://uitleg-werkregels): miten tehtävän kesto muuttuu kuormitusasteiden mukana.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): kolme tornia, jotka tarvitsevat samat työryhmät ja torninosturin, ja mitä tasaaminen niillä tekee.

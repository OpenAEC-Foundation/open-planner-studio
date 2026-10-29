# Riippuvuudet ja viive

Miksi muuraus alkaa vasta, kun perustus on valmis? Ja miksi kattoasennus myöhästyy viikon, kun kattoelementit toimitetaan myöhässä? Syy on tehtävien välisissä riippuvuuksissa. Tässä artikkelissa kerrotaan, mitkä neljä riippuvuustyyppiä sovellus tuntee, mitä viive ja limitys tekevät, missä kalenterissa viive lasketaan, mitä riippuvuudelle tapahtuu vaiheessa ja miten sovellus päättää, mikä riippuvuus määrää tehtävän alkupäivän.

Säännöt ja esimerkit koskevat uutta projektia, jonka laskentaprofiili on *Open Planner Studio* ja jonka työviikko on maanantaista perjantaihin.

## Käsite

**Riippuvuus** merkitsee, että kaksi tehtävää riippuu toisistaan. Ensimmäinen tehtävä on **edeltäjä**, toinen **seuraaja**. Riippuvuus on alaraja. Seuraaja ei voi alkaa tai päättyä aikaisemmin kuin riippuvuus sallii, mutta se voi alkaa tai päättyä myöhemmin. Jos tehtävällä on useita edeltäjiä, se odottaa myöhäisintä päivää, joka tulee kaikista näistä riippuvuuksista.

Tyyppejä on neljä. Ne eroavat siinä, mikä hetki edeltäjässä (alku tai loppu) on sidottu mihinkin hetkeen seuraajassa:

- **FS (lopusta alkuun).** Seuraaja alkaa vasta, kun edeltäjän loppu on tapahtunut. Kattoelementit asennetaan vasta, kun seinät on nostettu. Tämä on ylivoimaisesti yleisin riippuvuus.
- **SS (alusta alkuun).** Seuraaja alkaa vasta, kun edeltäjä on alkanut. Tehtävät voivat mennä päällekkäin: putkityö voi alkaa, kun muuraus on käynnissä.
- **FF (lopusta loppuun).** Seuraaja päättyy vasta, kun edeltäjä on päättynyt. Saumausta ei voi tehdä ennen kuin muuraus on päättynyt, mutta se voi alkaa aikaisemmin.
- **SF (alusta loppuun).** Seuraaja päättyy vasta, kun edeltäjä on alkanut. Tämä tyyppi on harvinainen. Esimerkki: tilapäinen kuivatus saa loppua vasta, kun perustuksen muuraus on alkanut.

Riippuvuudessa voi olla myös **viive**: odotusaika kahden tehtävän välillä, esimerkiksi betonin kovettuminen. Viive, jonka arvo on negatiivinen, on nimeltään **limitys**. Seuraaja alkaa silloin ennen kuin edeltäjän loppu on tapahtunut, joten tehtävät menevät päällekkäin.

## Miten sovellus laskee

### Neljä tyyppiä

Jokaiselle riippuvuudelle sovellus laskee aikaisimman päivän, jolloin seuraaja voi alkaa. Tehtävän kaikista riippuvuuksista valitaan myöhäisin. Ilman viivettä toimitaan näin:

- FS: seuraaja alkaa ensimmäisenä työpäivänä edeltäjän lopun jälkeen.
- SS: seuraaja alkaa samana päivänä kuin edeltäjä.
- FF: seuraaja päättyy samana päivänä kuin edeltäjä. Alun löytämiseksi sovellus laskee seuraajan kestosta taaksepäin. 3 työpäivän mittainen seuraaja alkaa siis 2 työpäivää ennen edeltäjän loppua.
- SF: seuraaja päättyy sinä päivänä, kun edeltäjä alkaa. Tässäkin sovellus laskee seuraajan kestosta taaksepäin.

Nämä ovat alarajoja. Seuraaja alkaa myöhemmin, jos toinen riippuvuus tai rajoite sitä vaatii. Päivämäärät näkyvät vasta **Laske** (F5) -komennon jälkeen. Niin kauan kuin tilarivillä lukee *Vanhentunut — laske uudelleen (F5)*, palkit kuuluvat edelliseen laskentaan.

### Viive ja limitys

Viive voidaan ilmaista neljällä tavalla:

- Työpäivinä (`3` tai `3d`): sovellus ohittaa vapaapäivät ja viikonloput. Tämä on oletus.
- Kalenteripäivinä (`3ed`, e tarkoittaa *kulunutta* aikaa): jokainen päivä lasketaan, myös lauantai ja sunnuntai. Tätä yksikköä käytetään, kun jokin jatkuu ilman työtä, kuten betonin kovettuminen.
- Prosentteina edeltäjän kestosta (`40%`): sovellus laskee tämän uudelleen jokaisella laskennalla ja pyöristää kokonaisiksi päiviksi (2,5 päivää tulee 3 päiväksi).
- Työtunteina (`4h`): sovellus laskee viiveen viivekalenterissa, oletuksena edeltäjän kalenterissa. Jos edeltäjä on päivätehtävä kalenterissa ilman omia työaikalohkoja, kuten vakiokalenterissa, sovellus muuntaa tunnit kokonaisiksi työpäiviksi. Pyöristys tehdään lähimpään kokonaiseen päivään, ja puolikas päivä pyöristyy ylöspäin. Kun työpäivä on 8 tuntia, `2h` ja `3h` antavat 0 päivää, `4h`–`11h` antavat 1 päivän ja `12h` antaa 2 päivää. Jos kalenterissa on omia työaikalohkoja tai edeltäjä on tuntitehtävä, viive lasketaan tarkasti työtunteina.

Säännön mukaan viive N työpäivää FS-riippuvuudella toimii näin: N työpäivää edeltäjän lopun jälkeen ovat odotusaikaa, ja seuraaja alkaa sitä seuraavana työpäivänä. SS-riippuvuudella viive lisätään edeltäjän alkuun ja FF-riippuvuudella edeltäjän loppuun. Limitys lasketaan taaksepäin. Limitys 1 työpäivä FS-riippuvuudella antaa seuraajan alkaa sinä päivänä, jona edeltäjä päättyy.

Limitys ei voi siirtää tehtävää ennen projektin aloituspäivää. Jos niin kävisi, sovellus pitää seuraajan projektin aloituspäivässä ja ilmoitetaan *Varoitukset*-paneelissa: *Limitys katkaistu projektin aloituspäivän vuoksi — riippuvuutta ei noudateta täysin*.

### Missä kalenterissa viive lasketaan

Jokaisella tehtävällä voi olla oma kalenteri. Kun viive on työpäivinä, on tärkeää, mikä kalenteri laskee työpäivät. Asetus *Viiveen kalenteri* päättää tämän. Neljä vaihtoehtoa on valittavana: *Edeltäjä*, *Seuraaja*, *24 tunnin* ja *Projektikalenteri*. Oletuksena viive lasketaan **edeltäjän** kalenterissa. Asetus löytyy valikosta *Asetukset › Projekti › Projektin asetukset*, osiosta *Laskentaprofiili ja laskentavaihtoehdot*, kohdasta *Tämän projektin laskentavaihtoehdot*. Valinta kuuluu projektitiedostoon ja tulee voimaan vasta, kun napsautetaan *Käytä*. Sen jälkeen aikataulu lasketaan uudelleen.

Viive kalenteripäivinä (`3ed`) lasketaan aina kaikki päivät, riippumatta siitä, mikä *Viiveen kalenteri* on valittu.

### Riippuvuudet yhteenvetotehtävillä

Riippuvuuden voi asettaa vaiheelle (yhteenvetotehtävälle) sen sisällä olevan tehtävän sijasta. Sovellus asettaa riippuvuuden sisäisesti jokaiselle vaiheen tehtävälle:

- Vaihe **edeltäjänä** FS- tai FF-riippuvuudella: seuraaja odottaa, kunnes vaiheen viimeinen tehtävä on päättynyt.
- Vaihe **seuraajana** FS- tai SS-riippuvuudella: jokainen vaiheen tehtävä odottaa edeltäjää, riippumatta muista vaiheen tehtävistä.
- Vaihe **edeltäjänä** SS- tai SF-riippuvuudella: seuraaja odottaa sen vaiheen tehtävän alkua, joka alkaa **viimeisenä**, ei vaiheen alkua itseään. Tämä on varovaisempaa kuin voi odottaa: seuraaja ei koskaan ala liian aikaisin, mutta mahdollisesti myöhemmin kuin on tarkoitus. Jos halutaan, että seuraaja seuraa vaiheen alkua, riippuvuus asetetaan vaiheen ensimmäiselle tehtävälle.
- Vaihe **seuraajana** FF- tai SF-riippuvuudella: jokaisen vaiheen tehtävän on täytettävä loppuvaatimus itse. FF:llä lopun on oltava edeltäjän lopun jälkeen tai samana päivänä, SF:llä lopun on oltava edeltäjän alun jälkeen tai samana päivänä. Tämä pätee, vaikka tehtävä olisi voitu tehdä paljon aikaisemmin. Aseta tällainen riippuvuus mieluummin vaiheen viimeiselle tehtävälle.

Riippuvuus tehtävän ja sen oman vaiheen välillä ei ole sallittu.

### Ohjaavat riippuvuudet

Jos seuraajalla on useita edeltäjiä, yksi riippuvuus määrää yleensä sen alkupäivän. Se on riippuvuus, joka estää seuraajaa alkamasta yhtään päivää aikaisemmin kuin nyt. Tällaista riippuvuutta kutsutaan **ohjaavaksi**. Jos useampi riippuvuus antaa saman päivän, ohjaavia riippuvuuksia on useita. Ohjaava riippuvuus tunnistetaan salamakuvakkeesta sarakkeissa *Edeltäjät* ja *Seuraajat*, *Ohjaava*-sarakkeesta (taulukon otsikon oikealla puolella olevasta **+**-merkistä, kohdassa *Riippuvuudet*) ja vahvemmasta sävystä, kun polkua seurataan. Polun avaaminen on kuvattu kohdassa [Polun jäljittäminen](docs://howto-pad-traceren).

Ohjaava kertoo päivistä, ei kestosta. Lyhyt edeltäjä voi olla ohjaava, esimerkiksi pitkän viiveen takia. Tämä näkyy alla olevassa esimerkissä.

## Esimerkki

Esimerkit käyttävät erillisiä pienprojekteja. Kaikki alkavat maanantaina 7. kesäkuuta 2027, ellei toisin mainita. Termit, kuten kriittinen polku ja pelivara, selitetään kohdassa [Kriittinen polku ja pelivara](docs://uitleg-kritiek-pad). Riippuvuusverkon rakentaminen ja tarkistaminen tehdään opetusohjelmassa 2, "Riippuvuudet ja kriittinen polku".

### Neljä tyyppiä vierekkäin

*Pour foundation* kestää 5 työpäivää: maanantaista 7. kesäkuuta perjantaihin 11. kesäkuuta. *Build walls* (5 työpäivää) seuraa FS-riippuvuudella ja kestää maanantaista 14. kesäkuuta perjantaihin 18. kesäkuuta. Siihen liittyy neljä tehtävää, joiden kesto on 3 työpäivää, kukin eri tyypillä:

- *Place roof elements* (FS) alkaa maanantaina 21. kesäkuuta, muurauksen jälkeisenä ensimmäisenä työpäivänä, ja päättyy keskiviikkona 23. kesäkuuta.
- *Pipework* (SS) alkaa maanantaina 14. kesäkuuta muurauksen kanssa samaan aikaan ja päättyy keskiviikkona 16. kesäkuuta.
- *Pointing* (FF) on tehtävä perjantaina 18. kesäkuuta muurauksen kanssa samaan aikaan. 3 työpäivän kestolla se alkaa keskiviikkona 16. kesäkuuta.
- *Dewatering* (SF) on päätyttävä maanantaina 14. kesäkuuta, sinä päivänä kun muuraus alkaa. Kun lasketaan 3 työpäivää taaksepäin (torstai 10., perjantai 11., maanantai 14. kesäkuuta), saadaan alkupäiväksi torstai 10. kesäkuuta.

Vain *Place roof elements* kuuluu kriittiseen polkuun. Projekti päättyy keskiviikkona 23. kesäkuuta. Tehtävillä *Pipework*, *Pointing* ja *Dewatering* on pelivaraa 5, 3 ja 7 työpäivää, samassa järjestyksessä.

### Viive ja limitys lukuina

*Pour foundation* päättyy perjantaina 18. kesäkuuta. *Build walls* (2 työpäivää) seuraa FS-riippuvuudella. Näin viive vaikuttaa alkupäivään:

- Ilman viivettä muuraus alkaa maanantaina 21. kesäkuuta.
- Viiveellä `3` (kolme työpäivää) maanantai 21., tiistai 22. ja keskiviikko 23. kesäkuuta ovat odotusaikaa. Muuraus alkaa torstaina 24. kesäkuuta.
- Viiveellä `3ed` (kolme kalenteripäivää) lasketaan lauantai, sunnuntai ja maanantai. Muuraus alkaa tiistaina 22. kesäkuuta.
- Viiveellä `-1` (limitys yksi työpäivä) muuraus alkaa perjantaina 18. kesäkuuta, eli päivänä, jona valu päättyy.
- Viiveellä `40%` viive on 40 % 5 työpäivästä, eli 2 työpäivää. Muuraus alkaa keskiviikkona 23. kesäkuuta.
- Viiveellä `50%` viive on 2,5 työpäivää, ja se pyöristyy 3 työpäiväksi. Muuraus alkaa torstaina 24. kesäkuuta.

### Mikä kalenteri laskee viiveen

*Build walls* (4 työpäivää) noudattaa projektikalenteria (maanantaista perjantaihin) ja päättyy torstaina 10. kesäkuuta. *Pointing* (2 työpäivää) seuraa FS-riippuvuudella ja viiveellä `3`. Tehtävä *Pointing* on kalenterissa, jossa lauantaikin ja sunnuntaikin ovat työpäiviä. Silloin alkupäivä riippuu asetuksesta *Viiveen kalenteri*:

- *Edeltäjä* (oletus): viive lasketaan muurauksen kalenterissa. Perjantai 11., maanantai 14. ja tiistai 15. kesäkuuta ovat odotusaikaa. *Pointing* alkaa keskiviikkona 16. kesäkuuta.
- *Seuraaja*: viive lasketaan tehtävän *Pointing* kalenterissa. Perjantai 11., lauantai 12. ja sunnuntai 13. kesäkuuta ovat odotusaikaa. *Pointing* alkaa maanantaina 14. kesäkuuta.
- *24 tunnin*: jokainen kalenteripäivä lasketaan. Myös tässä perjantai, lauantai ja sunnuntai ovat odotusaikaa. *Pointing* alkaa maanantaina 14. kesäkuuta.
- *Projektikalenteri*: viive lasketaan projektikalenterissa, samoin kuin valinnalla *Edeltäjä*. *Pointing* alkaa keskiviikkona 16. kesäkuuta.

### Riippuvuudet vaiheella

*Foundation* on vaihe, jossa on kaksi tehtävää: *Excavate* (2 työpäivää, maanantai 7. ja tiistai 8. kesäkuuta) ja sen jälkeen *Pour* (3 työpäivää, keskiviikosta 9. kesäkuuta perjantaihin 11. kesäkuuta). *Build walls* seuraa vaihetta *Foundation* FS-riippuvuudella ja alkaa maanantaina 14. kesäkuuta. Sovellus saa sen odottamaan tehtävää *Pour*, joka päättyy viimeisenä.

Kun vaihe on seuraaja: *Permit* (3 työpäivää, päättyy keskiviikkona 9. kesäkuuta) liittyy FS-riippuvuudella vaiheeseen *Rakenne*. Vaihe sisältää tehtävät *Build walls* (4 työpäivää) ja sen jälkeen *Lay floor* (2 työpäivää). Jokainen vaiheen tehtävä odottaa tehtävää *Permit*: *Build walls* alkaa torstaina 10. kesäkuuta ja päättyy tiistaina 15. kesäkuuta. *Lay floor* odottaa myös muurausta ja kestää keskiviikosta 16. kesäkuuta torstaihin 17. kesäkuuta.

Vaiheesta SS-riippuvuudella: vaihe *Finishing* sisältää tehtävän *Plastering* (2 työpäivää, 7. ja 8. kesäkuuta), sitten *Painting* (3 työpäivää, 9.–11. kesäkuuta) ja sitten *Snagging* (2 työpäivää, 14. ja 15. kesäkuuta). *Cleaning* seuraa vaihetta SS-riippuvuudella. Alkupäivän voisi odottaa olevan maanantai 7. kesäkuuta, mutta sovellus saa *Cleaning*-tehtävän odottamaan tehtävän *Snagging* alkua, joka alkaa viimeisenä: maanantaina 14. kesäkuuta.

### Mikä on ohjaava

*Pour foundation* (2 työpäivää) kestää maanantaista 7. kesäkuuta tiistaihin 8. kesäkuuta. Sen jälkeen seuraa kaksi haaraa:

- *Build walls* (5 työpäivää): keskiviikosta 9. kesäkuuta tiistaihin 15. kesäkuuta.
- *Order roof elements* (2 työpäivää): keskiviikko 9. ja torstai 10. kesäkuuta.

*Place roof elements* (3 työpäivää) seuraa molempia: FS-riippuvuudella muurauksen jälkeen sekä FS-riippuvuudella ja viiveellä `5` tilauksen jälkeen (toimitusaika). Muurauksen jälkeen asennus voisi alkaa keskiviikkona 16. kesäkuuta. Tilauksen jälkeen perjantai 11., maanantai 14., tiistai 15., keskiviikko 16. ja torstai 17. kesäkuuta ovat odotusaikaa, ja asennus alkaa perjantaina 18. kesäkuuta. Riippuvuus tilauksen kanssa on siis ohjaava riippuvuus, vaikka tilaus on paljon lyhyempi kuin muuraus. Muurauksen pelivara on 2 työpäivää.

## Seuraukset ja väärinkäsitykset

**"Riippuvuus lukitsee tehtävät."** Ei, riippuvuus on alaraja. Seuraaja alkaa aikaisintaan sinä päivänä, jonka riippuvuus antaa, ja myöhemmin, jos toinen riippuvuus tai rajoite sitä vaatii. Rajoitteiden toiminta selitetään kohdassa [Rajoitteet ja tavoitepäivät](docs://uitleg-constraints).

**"SS tarkoittaa, että tehtävät alkavat samaan aikaan."** SS sanoo vain, ettei seuraaja voi alkaa ennen edeltäjää. Jos seuraajalla on toinen edeltäjä, joka päättyy myöhemmin, seuraaja alkaa myöhemmin.

**"FF:llä seuraaja alkaa samana päivänä."** Ei, FF:llä loppupäivät osuvat yhteen. Lyhyt seuraaja alkaa siksi myöhemmin kuin edeltäjä, kuten esimerkin saumaus.

**"Viive päivissä tarkoittaa kalenteripäiviä."** Oletuksena viive lasketaan työpäivinä edeltäjän kalenterissa. Kovettumiseen tai kuivumiseen, jolloin viikonloppukin lasketaan, käytetään kalenteripäiviä (`ed`).

**"Tehtävä ilman riippuvuuksia on ongelmaton."** Tehtävä ilman edeltäjää alkaa suunnitellun alkupäivänsä mukaan, ja tehtävä ilman seuraajaa saa pelivaraa projektin loppuun asti. Jos riippuvuus unohtuu, tehtävällä näyttää siis olevan paljon tilaa. Väärinkäsityksistä kerrotaan lisää kohdassa [Kriittinen polku ja pelivara](docs://uitleg-kritiek-pad).

**"Riippuvuus vaiheella on yksi riippuvuus."** Laskennassa se on yksi riippuvuus vaiheen jokaiselle tehtävälle. Jos tehtäviä siirretään vaiheeseen tai pois siitä, myös niihin sovellettavat riippuvuudet muuttuvat.

## Katso myös

- [Riippuvuuksien lisääminen](docs://howto-relaties-leggen): vaiheet tehtävien linkittämiseen ja viiveen asettamiseen.
- [Kriittinen polku ja pelivara](docs://uitleg-kritiek-pad): mitä sovellus laskee riippuvuuksista ja miksi tehtävä tulee kriittiseksi.
- [Rajoitteet ja tavoitepäivät](docs://uitleg-constraints): päivämääräsopimukset riippuvuuksien rinnalla.
- [Polun jäljittäminen](docs://howto-pad-traceren): ketjun näkyväksi tekeminen ennen tehtävää tai sen jälkeen.
- [Riippumatto-tehtävän luominen](docs://howto-hammock): tehtävä, jonka kesto lasketaan ja joka on kiinnitetty SS- ja FF-tyypin riippuvuuksiin.
- [Ulkoiset riippuvuudet toiseen projektiin](docs://howto-externe-relaties): riippuvuudet tehtävään toisen projektin tiedostossa.

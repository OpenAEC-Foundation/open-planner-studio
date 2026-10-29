# Kalenterit ja työpäivät

Kuinka monta työpäivää tehtävä kestää, ja mikä on tehtävän loppu? Se riippuu kalenterista, jonka mukaan sovellus laskee. Tässä artikkelissa kerrotaan, mikä kalenteri on, miten sovellus laskee työpäivät sen avulla ja mikä kalenteri ratkaisee, kun niitä on useampia. Esimerkki auttaa seuraamaan lukuja.

## Käsite

Aikataulu lasketaan **työpäivinä**, ei kalenteripäivinä. "Viisi päivää muurausta" tarkoittaa viittä päivää, jolloin työtä tehdään. Viikonloppu tai yleinen vapaapäivä ei lasketa mukaan. Siksi tehtävä kestää kalenteripäivinä enemmän kuin viisi päivää.

Mitkä päivät ovat työpäiviä, tallennetaan **kalenteriin**. Kalenteri määrittää kolme asiaa:

- **Työviikko**: viikonpäivät, joina työtä tehdään. Oletuksena se on maanantaista perjantaihin.
- **Työajat**: alku, loppu ja tauko. Ne antavat **vakiotyöpäivän**. Oletuksena työajat ovat 07:00–16:00, tauko yhden tunnin, eli 8 tuntia.
- **Vapaapäivät**: yksittäiset päivät tai kokonaiset jaksot, joina työtä ei tehdä, kuten kuningaspäivä, joulu tai rakennusalan kesäloma.

Projektissa on yksi kirjasto, jossa ovat kalenterit. Yksi niistä on **projektikalenteri**. Se koskee jokaista tehtävää, jolla ei ole omaa kalenteria. Tehtävälle voi antaa toisen kalenterin, esimerkiksi kuuden päivän työviikon aliurakoitsijalle, joka työskentelee myös lauantaisin. Resurssilla voi olla myös oma kalenteri, mutta se toimii eri tavalla (katso alla).

## Miten sovellus laskee

Tämä artikkeli kuvaa tavallisen laskennan: *Open Planner Studio* -laskentaprofiilin, jolla uusi projekti lasketaan.

### Työpäivien laskeminen

Tehtävän ensimmäinen työpäivä on päivä 1. Tehtävä, jonka kesto on 5 päivää, päättyy siis viidennelle työpäivälle. Jos alkupäivä on ei-työpäivä, tehtävä alkaa seuraavana työpäivänä. Vapaapäivä tai rakennusalan kesäloma tehtävän keskellä ei lasketa mukaan. Tehtävä jatkuu sen yli ja kestää kalenterissa pidempään.

Tuntimäärä päivässä ei vaikuta tehtävän päivämääriin, kun kesto on päivinä. Vain työviikko ja vapaapäivät lasketaan. Työajat tulevat mukaan vain tehtävälle, jonka kesto on tunneissa. Siitä kerrotaan kohdassa [Päivät ja tunnit](docs://uitleg-dagen-en-uren).

### Mikä kalenteri ratkaisee

Sovellus valitsee yhden kalenterin tehtävää kohden:

1. Jos tehtävällä on oma kalenteri, sovellus laskee tehtävän kokonaan siinä: kesto, loppu ja pelivara.
2. Jos sillä ei ole omaa kalenteria, projektikalenteri on voimassa. Jos tehtävä osoittaa kalenteriin, jota ei enää ole, käytetään myös projektikalenteria.

Yhteenvetotehtävä (vaihe) ei sisällä omaa työtä, eikä siksi omaa kalenteria. Sen kesto seuraa sen tehtävien päivämääristä. Sovellus laskee sen projektikalenterilla.

**Resurssin** kalenteri ei vaikuta päivämääriin. Kun aikataulu tehdään sovelluksessa itse, kalenteri määrää vain, milloin resurssi on käytettävissä. Se vaikuttaa histogrammiin, ylikuormitukseen ja tasaamiseen.

### Tehtävät eri kalentereilla

Kun kaksi tehtävää, joilla on eri kalenterit, linkitään, pätee seuraava:

- Kun tehtävien välillä on riippuvuus lopusta alkuun, seuraaja alkaa ensimmäisenä työpäivänä edeltäjän lopun jälkeen. Päivät lasketaan **seuraajan** kalenterissa. Jos tehtävä päättyy perjantaina, seuraaja, jolla on kuuden päivän työviikko, alkaa lauantaina.
- **Viive** lasketaan oletuksena **edeltäjän** kalenterissa. Sen voi muuttaa kohdassa *Asetukset › Projekti › Projektin asetukset*, osiossa *Laskentaprofiili ja laskentavaihtoehdot*, kohdassa *Tämän projektin laskentavaihtoehdot*, valinnalla *Viiveen kalenteri*: *Edeltäjä* (oletus), *Seuraaja*, *24 tunnin* tai *Projektikalenteri*.
- **Kokonaispelivara** lasketaan tehtävän oman kalenterin työpäivinä. Tässä profiilissa **vapaa pelivara** lasketaan seuraajan kalenterissa.

Mitä viive tarkalleen on, kerrotaan kohdassa [Riippuvuuden lisääminen](docs://howto-relaties-leggen). Mitä pelivara on, kerrotaan kohdassa [Kriittinen polku ja pelivara](docs://uitleg-kritiek-pad).

### Gantt-kaaviossa

Harmaa tausta Gantt-kaaviossa näyttää aina projektikalenterin ei-työpäivät. Tehtävä, jolla on oma kalenteri, voi siis kulkea harmaan päivän yli, esimerkiksi kuuden päivän tehtävä lauantain yli. Vapaapäivien jakso, joka on vähintään kolme päivää leveä, saa nimensä näkyviin, esimerkiksi *Bouwvak (Noord)*. Näin ei tapahdu, kun *Näytä vain työpäivät* on käytössä. Jos harmaita päiviä ei halua nähdä lainkaan, ota käyttöön *Näytä vain työpäivät* kohdassa *Asetukset › Projekti › Sovelluksen asetukset*, välilehdellä *Ulkonäkö*, otsikossa *Aika-akseli*.

## Esimerkki: rakennuksen aikataulu

Esimerkki käyttää vakiokalenteria *Bouwkalender NL*: maanantaista perjantaihin, Hollannin yleiset vapaapäivät mukaan lukien. Kaikkien tehtävien kesto on kokonainen määrä päiviä. Kalentereista kertovassa opetusohjelmassa (opetusohjelma 3) tehdään sellainen kalenteri itse.

### Viikonloppu, vapaapäivä ja rakennusalan kesäloma

*Brickwork* kestää 5 työpäivää ja alkaa torstaina 13. toukokuuta 2027. Torstai 13. ja perjantai 14. toukokuuta ovat päivät 1 ja 2. Viikonloppu ja helluntaimaanantai 17. toukokuuta eivät lasketa mukaan. Tiistai 18., keskiviikko 19. ja torstai 20. toukokuuta ovat päivät 3, 4 ja 5. Tehtävän loppu on **torstaina 20. toukokuuta**: kahdeksan kalenteripäivää viittä työpäivää varten.

Rakennusalan kesäloma tekee eron suuremmaksi. Esimerkiksi *Bouwvak (Noord)* on 26. heinäkuuta – 13. elokuuta 2027, molemmat päivät mukaan lukien. Sama 5 työpäivän tehtävä alkaa perjantaina 23. heinäkuuta. Perjantai 23. heinäkuuta on päivä 1. Sen jälkeen kalenteri pysähtyy kolmeksi viikoksi. Maanantai 16. elokuuta – torstai 19. elokuuta ovat päivät 2–5. Tehtävän loppu on **torstaina 19. elokuuta**, 28 kalenteripäivää alkamisen jälkeen. Ilman rakennusalan kesälomaa se olisi ollut torstai 29. heinäkuuta.

### Tehtävä lauantaina

Kolme tehtävää seuraa toisiaan. Kaikilla on riippuvuus lopusta alkuun ilman viivettä: *Groundwork* (4 päivää), *Pour foundation* (3 päivää) ja *Brickwork* (5 päivää). Projektin aloituspäivä on maanantaina 24. toukokuuta 2027.

Jos kaikki kolme ovat projektikalenterilla, *Groundwork* kulkee maanantaista 24. toukokuuta torstaihin 27. toukokuuta. *Pour foundation* kulkee perjantaista 28. toukokuuta tiistaihin 1. kesäkuuta (perjantai, maanantai, tiistai). *Brickwork* kulkee keskiviikosta 2. kesäkuuta tiistaihin 8. kesäkuuta. Projektin päättymispäivä on **tiistaina 8. kesäkuuta**.

Jos *Pour foundation* saa kalenterin *Six-day week* (maanantaista lauantaihin), lauantai lasketaan mukaan. Tehtävä kulkee perjantaista 28. toukokuuta **maanantaihin 31. toukokuuta** (perjantai, lauantai, maanantai). *Brickwork* pysyy projektikalenterilla, alkaa tiistaina 1. kesäkuuta ja päättyy **maanantaina 7. kesäkuuta**. Koko projekti on yhden päivän lyhyempi, koska yksi tehtävä työskentelee lauantaina.

### Viive kahdella kalenterilla

*Pour floor* (kuuden päivän työviikko, 4 päivää) alkaa maanantaina 31. toukokuuta ja päättyy torstaina 3. kesäkuuta. *Pointing* (projektikalenteri, 3 päivää) alkaa 2 työpäivän viiveen jälkeen. Ilman viivettä *Pointing* alkaisi perjantaina 4. kesäkuuta.

- Oletuksena viive lasketaan edeltäjän kalenterissa, eli kuuden päivän työviikossa. Perjantaista 4. kesäkuuta lauantai 5. kesäkuuta on ensimmäinen työpäivä ja maanantai 7. kesäkuuta toinen. *Pointing* alkaa **maanantaina 7. kesäkuuta** ja päättyy keskiviikkona 9. kesäkuuta.
- Jos *Viiveen kalenteri* valitaan *Seuraaja*, projektikalenteri lasketaan. Lauantaita ei silloin lasketa: maanantai 7. kesäkuuta on ensimmäinen työpäivä ja tiistai 8. kesäkuuta toinen. *Pointing* alkaa **tiistaina 8. kesäkuuta** ja päättyy torstaina 10. kesäkuuta.

### Pelivara omassa kalenterissa

*Brickwork* (5 päivää, projektikalenteri) ja *Crane hire* (3 päivää, kuuden päivän työviikko) alkavat molemmat maanantaina 24. toukokuuta. Molemmat ovat edeltäjiä tehtävälle *Fit window frames* (2 päivää, projektikalenteri).

*Brickwork* päättyy perjantaina 28. toukokuuta, joten *Fit window frames* alkaa maanantaina 31. toukokuuta. *Crane hire* on päättynyt jo keskiviikkona 26. toukokuuta. *Crane hire* kokonaispelivara lasketaan sen omassa kalenterissa: torstai 27., perjantai 28. ja lauantai 29. toukokuuta, eli **3 työpäivää**. Jos *Crane hire* olisi projektikalenterilla, se olisi 2 työpäivää. Vapaa pelivara on 2 työpäivää (torstai ja perjantai), koska sovellus laskee sen seuraajan kalenterissa.

### Resurssin kalenteri

Toisessa esimerkkiprojektissa resurssilla *Bricklaying crew* on kalenteri *Crew Mon–Thu* (maanantaista torstaihin). Resurssi on määritetty tehtävälle *Brickwork* 1 kuormitusasteella päivässä (5 päivää, projektikalenteri, maanantaista 31. toukokuuta perjantaihin 4. kesäkuuta).

Tehtävän päivämäärät eivät muutu. Perjantai 4. kesäkuuta on histogrammissa punainen. Siinä näkyy viesti *Ei työskentele tänä päivänä kalenterin "Crew Mon–Thu" mukaan*. Valintanauha näyttää yhden resurssin kohdassa *Ylikuormitus*. Tasaaminen ei ratkaise tätä. Siirtäminen ei auta, koska viisi työpäivää peräkkäin sisältää aina perjantain. Ikkunassa *Tasaa resurssit* tehtävä on siksi luettelossa kohdassa *Jäljellä olevat ristiriidat*, syynä *Resurssi ei työskentele kaikkina päivinä, joita tämä tehtävä tarvitsee. Siirtäminen ei ratkaise tätä.*

## Seuraukset ja väärinkäsitykset

**"Resurssin kalenteri siirtää tehtäviäni."** Ei siirrä. Resurssin kalenteri ei muuta yhtäkään päivämäärää. Se tekee vain ylikuormituksen näkyväksi. Jos halutaan, että tehtävä itse kulkee muina päivinä, tehtävälle annetaan oma kalenteri.

**"Jos vaihdan projektikalenterin, kaikki siirtyy."** Vain tehtävät ilman omaa kalenteria siirtyvät mukana. Tehtävä, jolle on itse annettu kalenteri listasta, säilyttää sen, vaikka se olisi sattumalta vanha projektikalenteri. Jos kalenteri poistetaan, tehtävät ja resurssit, jotka sitä käyttivät, palaavat projektikalenteriin.

**"Vapaapäivät ovat mukana, eikö?"** Vapaapäivät ovat olemassa vain niille vuosille, joille ne on luotu. Päivä niiden vuosien ulkopuolella on yksinkertaisesti työpäivä. Kalenterin valintaikkunassa sovellus kertoo tästä viestillä *Vapaapäivät kattavat 2025–2028. Luodaanko uudelleen vuoteen 2030 saakka?*

**"Enemmän tunteja päivässä lyhentää tehtävääni."** Ei päivissä mitattavan tehtävän kohdalla. Se lasketaan kokonaisina työpäivinä, olipa päivässä 6 tai 8 tuntia. Vain tehtävälle, jolla on resursseja ja tehtävätyyppi *Kiinteä työmäärä* tai *Kiinteä yksikkömäärä*, kesto muuttuu tuntien mukana.

**Kalenteria ilman työpäiviä** sovellus ei voi laskea. Laskenta näyttää *Kalenterissa ei ole asetettu työpäiviä*.

## Katso myös

- [Päivät ja tunnit](docs://uitleg-dagen-en-uren): miten sovellus laskee työtunnit ja mitä tapahtuu, kun päivätehtävät ja tuntitehtävät kohtaavat.
- [Kalenterin luominen ja määrittäminen](docs://howto-kalender-maken-en-toewijzen): vaiheet oman kalenterin tekemiseen ja antamiseen tehtäville.
- [Vapaapäivien ja rakennusalan kesäloman luominen](docs://howto-feestdagen-genereren): maan vapaapäivien ja rakennusalan kesäloman täyttäminen.
- [Resurssikalenterin määrittäminen](docs://howto-resourcekalender-instellen): resurssin käytettävyyden tallentaminen.
- [Kalenteri-ikkunat](docs://ref-kalenders): kaikki kalenteri-ikkunien kentät.

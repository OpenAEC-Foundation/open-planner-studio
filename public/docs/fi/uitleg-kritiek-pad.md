# Kriittinen polku ja pelivara

Miksi projektin päättymispäivä on juuri se, mikä se on? Ja mikä tehtävä voi myöhästyä päivän ilman, että luovutus siirtyy? Näiden kysymysten takana on kriittinen polku. Tämä artikkeli selittää tarkasti, mitä sovellus laskee, esimerkin avulla.

## Käsite

Aikataulu on verkko tehtävistä, joita yhdistävät **riippuvuudet**: sopimuksia, kuten ”ikkunakehykset asennetaan vasta, kun katto on suljettu”. Riippuvuudet sitovat tehtävät yhteen. Osa tehtäväketjuista on pidempiä kuin toiset. Pisin ketju määrää, kuinka kauan koko projekti kestää.

Tämä pisin ketju on **kriittinen polku**. Jos yksi sen tehtävistä myöhästyy päivän, luovutus siirtyy päivän. Ketjussa ei ole varaa.

Kriittisen polun ulkopuolisilla tehtävillä on tilaa. Tätä tilaa kutsutaan **pelivaraksi**. Ulkomuurin rakentava muurari voisi aloittaa kaksi päivää myöhemmin, eikä kukaan huomaisi sitä. Nuo kaksi päivää ovat tämän tehtävän pelivaraa.

Kriittinen ei siis kerro, kuinka tärkeä tehtävä on. Se kertoo vain, ettei aikaa ole yli.

Laskentamenetelmä on nimeltään **CPM** (Critical Path Method). Siksi tuloksia sisältävää osiota *Ominaisuudet*-paneelissa kutsutaan nimellä *CPM-tulos*.

## Miten sovellus laskee

Sovellus ei laske aikataulua uudelleen itsestään. Laskenta alkaa komennolla **Laske** (F5), esimerkiksi valikosta *Aloitus › Aikataulu › Laske*. Jos jokin on muuttunut edellisen laskennan jälkeen, tilarivi näyttää *Vanhentunut — laske uudelleen (F5)*. Jos *Laske automaattisesti* on päällä (kohdassa *Asetukset › Projekti › Asetukset*, välilehti *Aikataulu*, otsikko *Laskenta*), sovellus tekee tämän itse.

Laskenta käy verkon läpi kahdesti.

### Eteenpäin-läpikäynti

Sovellus aloittaa projektin aloituspäivästä ja seuraa riippuvuuksia edeltäjästä seuraajaan. Jokaiselle tehtävälle sovellus löytää aikaisimman päivän, jolloin tehtävä voi alkaa. Jos tehtävällä on useita edeltäjiä, se odottaa viimeisen niistä valmistumista. Näin jokaiselle tehtävälle tulee **varhaisin alkamispäivä** ja **varhaisin valmistumispäivä**. Kaikkien tehtävien suurin varhaisin valmistumispäivä on projektin päättymispäivä.

### Taaksepäin-läpikäynti

Sitten sovellus kulkee takaisin, päättymispäivästä alkuun. Nyt sovellus löytää jokaiselle tehtävälle viimeisen päivän, jolloin tehtävä on saatava valmiiksi, ilman että päättymispäivä siirtyy. Jos tehtävällä on useita seuraajia, ratkaisee se, joka on aloitettava ensin. Näin tulee **myöhäisin alkamispäivä** ja **myöhäisin valmistumispäivä**.

### Kokonais- ja vapaa pelivara

Ero tehtävän myöhäisten ja varhaisten päivämäärien välillä on sen **kokonaispelivara**: työpäivien määrä, jonka verran tehtävä voi myöhästyä tai alkaa myöhemmin, ennen kuin projektin päättymispäivä siirtyy. Sovellus laskee tehtävän kalenterin työpäivinä. Viikonloppua tai virallista vapaapäivää ei lasketa.

**Vapaa pelivara** on tiukempi. Se on tehtävän tila ennen kuin jokin sen seuraajista joutuu alkamaan myöhemmin. Tätä tilaa voi käyttää ilman, että mikään muu tehtävä sen huomaa.

Kokonaispelivara voidaan jakaa. Jos kaksi ei-kriittistä tehtävää seuraavat toisiaan, ne jakavat saman marginaalin. Jos ensimmäinen käyttää sen loppuun, toisella ei ole enää mitään jäljellä. Ensimmäisellä on silloin kokonaispelivaraa, mutta ei vapaata pelivaraa. Kokonaispelivaran osaa, joka ei ole vapaa, kutsutaan **häiritseväksi pelivaraksi**: jos sitä käytetään, myös sen jälkeiset tehtävät siirtyvät. Alla oleva esimerkki näyttää tämän luvuin.

### Negatiivinen pelivara

Pelivara voi myös olla negatiivinen. Näin käy, kun tehtävällä on tavoitepäivä tai rajoite, joka asettaa viimeisen päivän, ja tämä päivä on ennen sovelluksen tehtävälle laskemaa päivää. Aikataulun mukaan tehtävä on jo myöhässä, ja tehtävä sekä sitä edeltävä ketju muuttuvat kriittisiksi.

### Milloin tehtävä on kriittinen?

Oletuksena tehtävä on kriittinen, kun sen kokonaispelivara on 0 tai vähemmän. Tätä voi muuttaa kohdassa *Asetukset › Projekti › Projektin asetukset*, osiossa *Laskentaprofiili ja laskentavaihtoehdot*, kohdassa *Tämän projektin laskentavaihtoehdot*. Kun valitaan *Käytä*, sovellus laskee aikataulun heti uudelleen. Vaihtoehdot kuuluvat projektitiedostoon, eivät sovellukseen.

- **Kriittisyyden määritelmä** kohdassa *Kokonaispelivara ≤ kynnysarvo* ja kentässä *Kynnysarvo (työpäivinä)*. Kynnysarvo on oletuksena 0. Puskurin varmistamiseksi aseta arvoksi esimerkiksi 2: jokainen tehtävä, jonka pelivara on 2 työpäivää tai vähemmän, lasketaan kriittiseksi ja muuttuu punaiseksi. Jos valitaan *Pisin polku*, tehtävä on kriittinen, kun se on pisimmällä ketjulla viimeiseen loppuun. Sen pelivaralla ei ole silloin merkitystä.
- **Useita pelivarapolkuja** numeroi ketjut niiden pelivaran mukaan sarakkeessa *Pelivarapolku*. Polku 1 on kriittinen polku. Katso [Laskentavaihtoehdot ja laskentasäännöt](docs://ref-rekenopties-en-conventies).
- **Merkitse lähes kriittiset** omalla *Kynnysarvo*-asetuksellaan, oletuksena 2 työpäivää. Tehtävä, jonka pelivara on yli 0 mutta enintään tämän verran, saa keltaisen palkin. Näin näkee, mitkä tehtävät ovat jäljellä lähes ilman marginaalia, ilman että niitä kutsutaan kriittisiksi.
- **Avoimet tehtävät ovat kriittisiä**: tehtävä, jolla ei ole seuraajaa ja jota ei ole vielä saatu valmiiksi, lasketaan kriittiseksi. Hyödyllinen turvaverkko unohtuneita riippuvuuksia vastaan (katso alla olevat väärinkäsitykset).
- **Pelivaran laskentatapa** määrää, mitataanko kokonaispelivara tehtävän alusta, lopusta vai näistä pienempänä. Uudet projektit ovat asetuksella *Automaattinen (oletus)*. Jos projektissa on Primavera P6 -profiili eikä tämä valinta ole *Loppupelivara*, Projektin asetuksissa näkyy oranssi ruutu, joka kertoo sen. Sen painike asettaa valinnan arvoon *Loppupelivara*. MS Project -ohjelmassa sama painike palauttaa valinnan arvoon *Automaattinen (oletus)*: kun raportointipäivä on asetettu, MS Project laskee näin itse.

### Missä sen näkee

Kriittisillä tehtävillä on punainen palkki Gantt-kaaviossa. Ei-kriittisen palkin takana on vihreä nauha tehtävän myöhäisimpään valmistumispäivään asti: se on pelivara. Nauhan voi kytkeä päälle tai pois valinnalla *Näkymä › Perustasot ja edistyminen › Pelivaranauha*.

Kun tehtävä on valittuna, *Ominaisuudet*-paneeli näyttää kaiken kohdassa *CPM-tulos*: varhaisin ja myöhäisin alkamispäivä sekä varhaisin ja myöhäisin valmistumispäivä, kokonais-, vapaa- ja häiritsevä pelivara sekä se, onko tehtävä kriittisellä polulla. Kaikkien tehtävien pelivara näkyy rinnakkain sarakkeissa kohdassa *Lasketut* (**+** taulukon otsikkorivin oikealla puolella), kuten *Kokonaispelivara*, *Vapaa pelivara*, *Kriittinen* ja *Lähes kriittinen*.

Alareunan tilarivi laskee kriittiset tehtävät, esimerkiksi *Kriittinen polku: 21 tehtävää, 45 työpäivää*.

## Esimerkki: talon lisärakennus

Esimerkki on opetusohjelmien harjoitusprojekti *House extension* siinä vaiheessa, kun kaikki riippuvuudet on asetettu. Opetusohjelmassa 2, ”Riippuvuudet ja kriittinen polku”, rakennetaan tämä itse ja tarkistetaan luvut. Tässä luetaan, miksi luvut ovat sellaisia kuin ovat.

Lisärakennus alkaa maanantaina 7. kesäkuuta 2027. Laskennan jälkeen luovutus on perjantaina 6. elokuuta 2027 ja tilarivi näyttää *Kriittinen polku: 21 tehtävää, 45 työpäivää*. Kaksi tehtävää ei ole kriittisiä: *Build outer cavity leaf* ja *Painting*.

### Kaksi ketjua, jotka kohtaavat

Kantavan lattian (*Lay hollow-core floor*, loppuu maanantaina 28. kesäkuuta) jälkeen työ jakautuu kahteen ketjuun. Molemmat päättyvät kohtaan *Install window frames*:

- Sisäpuoli: *Build inner cavity leaf* (5 työpäivää), sen jälkeen *Place roof elements* (1) ja *Apply roofing* (2). Ikkunakehykset voidaan asentaa vasta, kun katto on suljettu.
- Ulkopuoli: *Build outer cavity leaf* (6 työpäivää). Kehykset ovat julkisivussa, joten sekin on saatava valmiiksi.

**Eteenpäin.** Molemmat muurit voivat alkaa tiistaina 29. kesäkuuta. Sisämuurin loppu on maanantaina 5. heinäkuuta. Kattoelementit asennetaan tiistaina 6. heinäkuuta, ja katon peittäminen seuraa keskiviikkona 7. ja torstaina 8. heinäkuuta. Ulkomuurin loppu on tiistaina 6. heinäkuuta. *Install window frames* odottaa kahdesta ketjusta myöhemmin valmistuvaa, eli kattoa, ja alkaa siksi perjantaina 9. heinäkuuta.

**Taaksepäin.** Kehysten on alettava viimeistään perjantaina 9. heinäkuuta, muuten luovutus siirtyy. Ulkomuurin on siis päätyttävä viimeistään torstaina 8. heinäkuuta. Kuuden työpäivän päässä taaksepäin on myöhäisin alkamispäivä, torstai 1. heinäkuuta.

**Pelivara.** Ulkomuuri voi alkaa aikaisintaan 29. kesäkuuta ja sen on alettava viimeistään 1. heinäkuuta. Niiden välissä on 2 työpäivää: keskiviikko 30. kesäkuuta ja torstai 1. heinäkuuta. Se on sen kokonaispelivara. Paneeli näyttää *Kokonaispelivara: 2 päivää* ja *Kriittinen polku: ei*. Vapaa pelivara on myös 2 päivää, koska sen ainoa seuraaja, *Install window frames*, on kriittisellä polulla.

Sisäketjussa ei ole pelivaraa. Jokainen viivästyspäivä siirtää kehyksiä ja kaikkea niiden jälkeen.

### Painting

*Painting* (3 työpäivää) alkaa rappauksen jälkeen maanantaina 26. heinäkuuta ja loppuu keskiviikkona 28. heinäkuuta. Seuraava tehtävä, *Snagging and cleaning*, odottaa myös laatoitusta. Sen loppu on vasta torstaina 5. elokuuta, koska lattiatasoitteen on ensin kuivuttava viisi työpäivää. Maalausta voi siis jatkaa torstaihin 5. elokuuta asti. Pelivaraa on silloin 6 työpäivää: 29. ja 30. heinäkuuta sekä 2.–5. elokuuta. Tässäkin vapaa pelivara on sama kuin kokonaispelivara, koska seuraaja on kriittinen.

### Kun ulkomuuri myöhästyy

Jos ulkomuuri vie 8 työpäivää 6 sijasta, se päättyy torstaina 8. heinäkuuta: juuri sen myöhäisimpänä valmistumispäivänä. Pelivara on poissa ja tehtävä muuttuu punaiseksi. Molemmat ketjut ovat silloin kriittisiä ja tilarivi laskee 22 kriittistä tehtävää. Luovutus pysyy perjantaina 6. elokuuta.

Jos se vie 9 työpäivää, ulkomuurin loppu on vasta perjantaina 9. heinäkuuta. Kehykset siirtyvät maanantaiksi 12. heinäkuuta ja luovutus maanantaiksi 9. elokuuta: yhden työpäivän myöhemmin. Ulkoketju on nyt kriittinen polku, ja tilarivi näyttää *Kriittinen polku: 19 tehtävää, 46 työpäivää*.

Sisäketjussa on silloin 1 työpäivä kokonaispelivaraa, mutta se päivä on jaettu:

- *Build inner cavity leaf*: kokonaispelivara 1, vapaa pelivara 0, häiritsevä pelivara 1. Jos sisämuuri myöhästyy päivän, kattoelementit siirtyvät sen mukana.
- *Place roof elements*: kokonaispelivara 1, vapaa pelivara 0, häiritsevä pelivara 1.
- *Apply roofing*: kokonaispelivara 1, vapaa pelivara 1. Vain tässä päivän viivästys ei aiheuta haittaa kenellekään.

Kyse on samasta yhdestä päivästä, jonka koko ketju jakaa. Jos sisämuuri käyttää sen, se on poissa kattoelementeiltä ja katon peittämiseltä.

### Lähes kriittinen ja negatiivinen pelivara

Kun *Merkitse lähes kriittiset* on päällä oletuskynnysarvolla 2 työpäivää, ulkomuuri saa keltaisen palkin, koska sen pelivara on täsmälleen 2 päivää. Maalauksen pelivara on 6 päivää, joten sen palkki pysyy sinisenä.

Jos luovutukselle asetetaan tavoitepäivä keskiviikoksi 4. elokuuta, eli kaksi työpäivää ennen lasketun luovutuksen päivää, pelivara muuttuu negatiiviseksi. Kaikkien 21 kriittisen polun tehtävän kokonaispelivara on −2 työpäivää. Ulkomuurilla ei ole pelivaraa jäljellä, ja sekin muuttuu kriittiseksi. Maalauksella on jäljellä 4 työpäivää.

## Seuraukset ja väärinkäsitykset

**”Kriittinen tarkoittaa tärkeää.”** Ei tarkoita. Tarkastus voi olla ratkaisevan tärkeä ja silti sillä on pelivaraa. Toisinpäin yksinkertainen työ voi olla kriittinen: esimerkissä *Snagging and cleaning* on kriittisellä polulla. Kriittisyys koskee vain aikaa: marginaalia ei ole jäljellä.

**”Tällä tehtävällä on pelivaraa, joten se voi odottaa.”** Katso ensin vapaa pelivara. Jos tehtävällä on kokonaispelivaraa mutta ei vapaata pelivaraa, jokainen viivästyspäivä vie marginaalia seuraavilta tehtäviltä. Näin käy sisämuurin kohdalla 9 työpäivän tapauksessa.

**Unohtunut riippuvuus antaa väärää pelivaraa.** Tehtävällä ilman seuraajaa on pelivaraa projektin loppuun asti. Jos esimerkistä puuttuisi riippuvuus ulkomuurista kehyksiin, ulkomuurilla olisi yhtäkkiä 23 työpäivän pelivara luovutukseen 6. elokuuta asti. Paperilla se voisi silloin myöhästyä viikkoja, ilman että kehykset odottavat. Kun *Avoimet tehtävät ovat kriittisiä* on päällä, ulkomuuri muuttuu tässä tapauksessa kriittiseksi ja aukko tulee näkyviin.

**Kriittinen polku ei ole kiinteä.** Jos ei-kriittinen tehtävä myöhästyy enemmän kuin sen pelivara, toinen ketju muuttuu pisimmäksi. Näit tämän edellä 9 työpäivän muurauksen kohdalla. Aikataulu on siksi laskettava uudelleen jokaisen muutoksen jälkeen. Niin kauan kuin tilarivi näyttää *Vanhentunut — laske uudelleen (F5)*, punaiset palkit kuuluvat vielä edelliseen laskentaan.

**Pelivara lasketaan työpäivinä.** Maalauksen 6 työpäivän pelivara kulkee torstaista 29. heinäkuuta torstaihin 5. elokuuta: päivämäärissä kahdeksan päivää, koska viikonloppua ei lasketa. Kalenterissa oleva virallinen vapaapäivä tai rakennusalan kesäloma ei myöskään lasketa.

## Katso myös

- [Riippuvuuksien lisääminen](docs://howto-relaties-leggen): vaiheet tehtävien linkittämiseksi ja viiveen asettamiseksi.
- [Riippuvuudet ja viive](docs://uitleg-relaties): miten riippuvuudet ja viive määräävät varhaiset päivämäärät.
- [Rajoitteet ja tavoitepäivät](docs://uitleg-constraints): miten rajoite tai tavoitepäivä tuottaa negatiivisen pelivaran.
- [Polun jäljittäminen](docs://howto-pad-traceren): tehtävän takana olevan ketjun seuraaminen.
- [Laskentavaihtoehdot ja laskentasäännöt](docs://ref-rekenopties-en-conventies): kriittisyyden määritelmä, lähes kriittinen ja pelivaran laskentatapa, vaihtoehto kerrallaan.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): suuri projekti, jossa on useita pelivarapolkuja, lähes kriittistä työtä (kynnysarvo 3 työpäivää), riippumatto, kova kiinnitys ja ulkoinen riippuvuus.

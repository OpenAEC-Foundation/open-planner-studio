# Päivät ja tunnit

Tehtävä, jonka kesto on 2 päivää, ja tehtävä, jonka kesto on 16 tuntia, näyttävät samalta. Sovellus laskee ne kuitenkin eri tavalla. Miksi päivien ja tuntien välillä voi valita? Ja mitä tapahtuu, kun tuntitehtävä on sidottu päivätehtävään? Tässä artikkelissa kerrotaan, miten sovellus laskee päiviä ja tunteja ja missä se pyöristää. Työesimerkki näyttää luvut.

## Käsite

**Päivätehtävän** kesto on kokonaisina työpäivinä, esimerkiksi `5d`. Se vie kokonaisia työpäiviä. Vakiokalenterissa sillä on alkupäivä ja loppupäivä ilman kellonaikaa.

**Tuntitehtävän** kesto on työtunteina, esimerkiksi `12h` tai `1h 30m`. Sillä on alku ja loppu kellonajalla, esimerkiksi tiistaina klo 11:00.

Mitta kuuluu tehtävälle, ei projektille. Aikataulussa voi yhdistää päivätehtäviä ja tuntitehtäviä. Sitä kutsutaan **sekasuunnitteluksi**.

Käytä tunteja työhön, joka ei mahdu kokonaisiin päiviin. Esimerkiksi nosturi, jonka vuokraat kaksitoista tuntia. Tai kuuden tunnin valu. Tai tehtävä, joka voi alkaa vasta lounaan jälkeen. Muuhun riittävät päivät, ja ne ovat selkeämpiä.

**Tuntisuunnittelu** on oletuksena pois päältä. Kun se on pois päältä, sovellus toimii päivissä. Jos tiedosto sisältää tuntisuunnittelua, esimerkiksi tuntitehtäviä, sovellus näyttää viestin *Tämä tiedosto sisältää tuntisuunnittelua.* Tehtäviä lasketaan silti, mutta niiden kestoa voi muuttaa vasta, kun tuntisuunnittelu on päällä.

## Miten sovellus laskee

### Työajat ja vakiotyöpäivä

Jokaisella kalenterilla on jokaiselle työpäivälle **työajan lohkot** (sovelluksessa *bands*). Vakiokalenterissa on lohkot 07:00–12:00 ja 13:00–16:00. Väli on tauko. Sovellus johtaa lohkot kalenterin kentistä *Alku (tunti)* ja *Loppu (tunti)* sekä tauosta. Mitään ei tarvitse asettaa erikseen. Jos omat lohkot asetetaan viikonpäivittäin, ne ovat ensisijaisia.

**Vakiotyöpäivä** on se työpäivä, jota esiintyy useimmin. Sen pituus on sen lohkojen summa. Se ei ole keskiarvo: jos maanantai on 16 tuntia ja tiistaista perjantaihin 10 tuntia, vakiotyöpäivä on 10 tuntia. Jos työpäivät ovat eri pituisia, sovelletaan yleisintä päivittäistä summaa. Tasatilanteessa sovelletaan suurinta. Kun neljä päivää on 8 tuntia ja perjantai 5 tuntia, vakiotyöpäivä on siis 8 tuntia. Kalenteri, jolla on oma tuntimäärä päivässä (esimerkiksi Primavera P6:sta), lasketaan myös tällä päivittäisellä summalla, ja kalenteri-ikkuna näyttää sen. Sen oma arvo säilytetään vientiä varten. Jos se eroaa, kalenteri-ikkunassa näkyy oranssi palkki kohdan *Vakiotyöpäivä* alapuolella. Tehtävä, jonka kesto on 1870 tuntia lohkoilla, joissa on 10 tuntia, kestää siis 187 päivää, vaikka kalenterin oma arvo olisi 8 tuntia päivässä.

### Tehtävä tunteina

Sovellus laskee työminuutit alusta alkaen lohkojen läpi. Tauot, illat, viikonloput ja vapaapäivät eivät lasketa mukaan. 12 tuntia kestävä tehtävä ei siis mahdu yhteen 8 tunnin työpäivään. Se jatkuu seuraavaan päivään.

### Tehtävä päivinä

Sovellus laskee kokonaisia työpäiviä. Tuntimäärällä päivässä ei ole merkitystä. 5 päivän tehtävä päättyy samana päivänä, olipa kalenterissa 6 tai 8 tuntia päivässä.

### Päivien ja tuntien muuntaminen

Päivä on tehtävän kalenterin vakiotyöpäivä. Sovellus käyttää tätä kolmessa kohdassa:

- Kohtaan *Keston näyttö*. Valikossa *Asetukset › Projekti › Asetukset* valitaan välilehdellä *Ulkonäkö* vaihtoehto *Automaattinen (oma mitta kullekin tehtävälle)*, *Aina päivinä* tai *Aina tunteina*. Tehtävä, jonka kesto on 18 tuntia, näkyy vaihtoehdolla *Aina päivinä* muodossa `2.25d(18h)`: alkuperäinen mitta jää sulkuihin.
- Viive tunteina päivätehtävän jälkeen (katso *Pyöristys*).
- Kun tehtävän mitta vaihdetaan. Sovellus laskee silloin päivät tehtävän alusta, kukin päivä omilla tunneillaan. Se muuntaa keston heti, jos tulos on tarkka. Kaksi päivää muuttuu muotoon `16h`. Kalenterissa, jossa perjantaissa on 5 tuntia, 5 päivää maanantaista muuttuu muotoon `37h`. Kaksitoista tuntia ei muutu kokonaisiksi päiviksi kalenterissa, jossa päivä on 8 tuntia: sovellus jättää silloin mitan ennalleen.

### Päivätehtävät ja tuntitehtävät yhdessä

Alla olevat säännöt koskevat lopusta alkuun -riippuvuutta kalenterilla, jolla ei ole omia työajan lohkoja, kuten vakiokalenterilla.

- **Tunti → tunti.** Seuraaja alkaa heti, kun edeltäjä päättyy, vaikka se tapahtuu päivän keskellä.
- **Tunti → päivä.** Päivätehtävä ei koskaan ala päivän keskellä. Se alkaa ensimmäisenä työpäivänä sen päivän jälkeen, jona tuntitehtävä päättyy. Päivän loppuosa jää käyttämättä ja näkyy tuntitehtävän pelivarana.
- **Päivä → tunti.** Päivätehtävä vie koko viimeisen päivänsä. Tuntitehtävä alkaa sitä seuraavana ensimmäisenä työpäivänä, ensimmäisen työajan lohkon alussa.

### Pyöristys

Sovellus pyöristää tai hylkää arvon neljässä kohdassa:

- **Päivätehtävä tuntitehtävän jälkeen** alkaa seuraavana työpäivänä. Tuntitehtävä pyöristyy ikään kuin ylöspäin kokonaisiin päiviin.
- **Viive tunteina** lasketaan viivekalenterissa, oletuksena edeltäjän kalenterissa. Jos edeltäjä on päivätehtävä kalenterilla, jolla ei ole omia työajan lohkoja, kuten vakiokalenterilla, sovellus muuntaa viiveen kokonaisiksi työpäiviksi: viive jaetaan vakiotyöpäivän tunneilla ja pyöristetään kokonaisluvuksi. Puoli päivää pyöristyy ylöspäin. Kun päivässä on 8 tuntia, 1 tunti on 0 päivää, 4 tuntia on 1 päivä ja 12 tuntia on 2 päivää. Sama koskee myös tilannetta, jossa seuraaja on tuntitehtävä. Jos edeltäjä on tuntitehtävä tai sen kalenterilla on omia työajan lohkoja, viive lasketaan tarkasti työtunteina, eikä tauko lasketa mukaan.
- **Kesto päivinä** on aina kokonaisluku. Jos kirjoitetaan `1.5d`, sovellus näyttää viestin *Syötä kokonaisluku päiviä tai tunteja, esimerkiksi 2d tai 12h.* Kesto tunteina saa olla `1.5h` tai `1h 30m`.
- **Mitan vaihto** tapahtuu vain, jos tulos on tarkka (katso yllä).

## Työesimerkki: nosturi

Kalenterissa on työaika maanantaista perjantaihin 07:00–12:00 ja 13:00–16:00: vakiotyöpäivä on 8 tuntia. Projektin aloituspäivä on maanantaina 7. kesäkuuta 2027.

### Tunti, tunti ja päivä

*Place crane* kestää 12 tuntia. Maanantaina on 8 työtuntia (5 tuntia 12:00 asti ja 3 tuntia tauon jälkeen) ja tiistaina viimeiset 4 tuntia. Tehtävä alkaa maanantaina klo 07:00 ja päättyy **tiistaina 8. kesäkuuta klo 11:00**.

*Adjust elements* kestää 8 tuntia ja seuraa lopusta alkuun -riippuvuudella. Se alkaa heti tiistaina klo 11:00: se on 1 tunti ennen taukoa ja 3 tuntia tauon jälkeen. Viimeiset 4 tuntia ovat keskiviikkona klo 07:00–11:00. Loppu on **keskiviikkona 9. kesäkuuta klo 11:00**.

*Finishing* kestää 2 päivää ja seuraa tehtävää *Adjust elements*. Päivätehtävä ei ala päivän keskellä, joten se alkaa **torstaina 10. kesäkuuta** ja päättyy perjantaina 11. kesäkuuta.

### Pyöristys rajakohdassa

Jos *Adjust elements* jätetään pois ja *Finishing* sidotaan suoraan tehtävään *Place crane*, *Finishing* alkaa keskiviikkona 9. kesäkuuta ja päättyy torstaina 10. kesäkuuta. Tiistain loppuosaa (4 työtuntia) ei voi käyttää. Nämä 4 tuntia näkyvät uudelleen tehtävän *Place crane* kokonaispelivarana: puoli työpäivää.

Kun järjestys käännetään, asia on yksinkertaisempi. *Pour foundation* kestää 2 päivää, maanantaista 7. kesäkuuta tiistaihin 8. kesäkuuta. *Place crane* kestää nyt 4 tuntia ja seuraa sitä. Se alkaa **keskiviikkona 9. kesäkuuta klo 07:00** ja päättyy klo 11:00.

### Viive tunteina

Tehtävien *Place crane* (12 tuntia) ja *Adjust elements* (8 tuntia) väliin asetetaan 2 tunnin viive. *Adjust elements* ei silloin ala klo 11:00 vaan tiistaina klo **14:00**: 1 tunti ennen taukoa ja 1 tunti tauon jälkeen. Loppu siirtyy **keskiviikkona 9. kesäkuuta klo 14:00**.

Viive toimii toisin päivätehtävän jälkeen. *Pour foundation* päättyy tiistaina 8. kesäkuuta. Ilman viivettä *Finishing* alkaa keskiviikkona 9. kesäkuuta. Kun viive on 4 tuntia, se on puoli päivää, ja sovellus pyöristää sen ylöspäin: *Finishing* alkaa **torstaina 10. kesäkuuta**. Kun viive on 1 tunti, sovellus pyöristää alaspäin, ja *Finishing* alkaa yksinkertaisesti keskiviikkona.

### Vapaa perjantai-iltapäivä

Nyt perjantaissa on vain yksi lohko, klo 07:00–12:00: 5 tuntia. Muut päivät ovat edelleen 8 tuntia. Vakiotyöpäivä on edelleen 8 tuntia, koska se on yleisin päivittäinen summa. Viikossa on nyt 37 työtuntia.

Tehtävä, jonka kesto on 40 tuntia ja joka alkaa maanantaina 7. kesäkuuta klo 07:00, käyttää maanantaista torstaihin (32 tuntia) ja perjantain (5 tuntia). Viimeiset 3 tuntia ovat seuraavana maanantaina klo 07:00–10:00. Loppu on **maanantaina 14. kesäkuuta klo 10:00**. 5 päivän tehtävä veisi 37 tuntia maanantaista alkaen, ja sovellus ehdottaa juuri sitä, kun 5 päivän mitta vaihdetaan tunneiksi.

Opetusohjelmassa 4 nosturityö suunnitellaan itse tunteina, tuntisuunnittelulla.

## Seuraukset ja väärinkäsitykset

**"8 tuntia on 1 päivä."** Vain jos kalenterissa päivä on 8 tuntia. Kalenterissa, jossa perjantai-iltapäivä on vapaa, 5 päivää on 37 tuntia, ei 40.

**"Jos päivässä asetetaan enemmän tunteja, päivätehtävä päättyy aiemmin."** Ei. Päivätehtävä lasketaan kokonaisina työpäivinä. Tuntimäärä päivässä muuttaa vain sitä, mitä päivä on tunteina arvoltaan, esimerkiksi näytössä ja tunteina ilmaistavalle viiveelle. Vain tehtävässä, jolla on resursseja ja tehtävätyyppi *Kiinteä työmäärä* tai *Kiinteä yksikkömäärä*, kesto muuttuu sen mukana, koska työmäärä pysyy samana: 40 tuntia työtä on 5 päivää, kun päivässä on 8 tuntia, ja 7 päivää, kun päivässä on 6 tuntia.

**"8 tunnin tehtävä kestää yhden päivän."** Vain jos se alkaa päivän alussa. Jos se alkaa myöhemmin, kuten *Adjust elements* tiistaina klo 11:00, se jatkuu seuraavaan päivään.

**Kalenteri, jolla on omia työajan lohkoja**, toimii toisin kuin vakiokalenteri. Sellainen kalenteri syntyy, kun työajat asetetaan viikonpäivittäin tai kun valitaan työvuoromalli (*2 työvuoroa*, *3 työvuoroa*, *Yötyövuoro* tai *24/7*). Sellaisella kalenterilla viive tunteina lasketaan tarkasti työtunteina, myös päivätehtävän jälkeen.

**Tuntisuunnittelun pois kytkeminen** ei poista mitään. Tuntitehtävät jäävät, ja niitä lasketaan edelleen, mutta niitä ei voi muokata ennen kuin tuntisuunnittelu on taas päällä.

## Katso myös

- [Tuntisuunnittelun kytkeminen päälle](docs://howto-urenplanning-aanzetten): vaiheet tehtävän suunnitteluun tunteina.
- [Työaikojen asettaminen](docs://howto-werktijden-instellen): kalenterin työajan lohkojen muuttaminen.
- [Kalenterit ja työpäivät](docs://uitleg-kalenders): miten sovellus laskee työpäiviä ja mikä kalenteri on voimassa.
- [Riippuvuuksien lisääminen](docs://howto-relaties-leggen): vaiheet riippuvuuden tai viiveen lisäämiseen.

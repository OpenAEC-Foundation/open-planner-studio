# Edistyminen, raportointipäivä ja perustaso

Aikataulu on ennuste. Kun työ on käynnissä, halutaan tietää, mikä on tehty, mitä on vielä tehtävä ja mitä se tarkoittaa luovutukselle. Tämä artikkeli selittää, miten sovellus käsittelee edistymistä. Se kertoo, mitä raportointipäivä tekee. Se kertoo, miten sovellus laskee jäljellä olevan työn. Se kertoo myös, miksi aloitettu tehtävä joskus odottaa edeltäjäänsä. Lopuksi se kertoo, miten nykytilaa verrataan sopimukseen, joka alun perin sovittiin. Työstetty esimerkki näyttää luvut.

## Käsite

**Edistyminen** on se, mitä todella on tapahtunut. Sovellus tallentaa kullekin tehtävälle kolme asiaa: prosentin, **toteutuneen alkamispäivän** ja **toteutuneen valmistumispäivän**. Aikataulun ennuste säilyy rinnalla. Todellinen on se, mitä todella tapahtui.

**Raportointipäivä** on päivä, jolloin tehdään arvio. Kaikki sitä ennen tapahtunut on tosiasia. Kaikki, mikä on vielä tapahtumatta, sovellus suunnittelee sen päivän alusta alkaen. Todellinen päivä voi olla raportointipäivä, mutta ei koskaan sen jälkeen.

**Jäljellä oleva työ** on se työ, joka tehtävässä on vielä tekemättä. Tehtävässä, jonka kesto on 4 työpäivää ja joka on 25 % tehty, on jäljellä 3 työpäivän työ.

**Perustaso** on tallennettu kopio aikataulusta tietyllä hetkellä, yleensä silloin, kun sopimus hyväksyttiin. Myöhemmin asetetaan toteutunut aikataulu sen viereen. Silloin nähdään, kuinka paljon toteutus poikkeaa.

## Miten sovellus laskee

Alla oleva esimerkki käyttää laskentaprofiilia *Open Planner Studio*. Uusi projekti lasketaan sen mukaan. Myöhemmin kerrotaan, mikä eroaa Primavera P6 -profiilissa ja Microsoft Project -profiilissa.

Sovellus ei laske uudelleen itsestään. Jokaisen edistymistä tai raportointipäivää koskevan muutoksen jälkeen tilarivillä näkyy *Vanhentunut — laske uudelleen (F5)*. Paina *Laske* (F5), esimerkiksi valinnalla *Aikataulu › Aikataulu › Laske*. Jos *Laske automaattisesti* on päällä (kohdassa *Asetukset › Projekti › Sovelluksen asetukset*, välilehti *Aikataulu*, otsikko *Laskenta*), sovellus tekee tämän itse.

### Raportointipäivä

Raportointipäivällä on kolme tehtävää.

Ensinnäkin sovellus ei hyväksy todellista päivää raportointipäivän jälkeen. Raportointipäivä itse kelpaa.

Toiseksi työ, jota ei ole aloitettu, ei voi olla menneisyydessä. Jos tällainen tehtävä on suunniteltu raportointipäivää aiemmaksi, sovellus siirtää sen raportointipäivälle. Sama koskee sen jälkeisiä tehtäviä, jotka siirtyvät riippuvuuksiensa kautta. Vaikutus näkyy alla olevassa esimerkissä. Microsoft Project -profiilissa sovellus ei tee näin.

Kolmanneksi jäljellä oleva työ tehtävässä, joka on jo käynnissä, alkaa itse raportointipäivänä. Sovellus pitää raportointipäivää kyseisen päivän alkuna. Jos arvio tehdään perjantaina työajan jälkeen, raportointipäiväksi asetetaan siis maanantai. Jos raportointipäiväksi asetetaan perjantai, sovellus suunnittelee jäljellä olevan työn silti sille perjantaille.

Jos raportointipäivää ei ole vielä asetettu ja edistymistä syötetään, sovellus asettaa raportointipäiväksi tämän päivän ja kertoo siitä. Toisen päivän voi asettaa kohdassa *Aikataulu › Perustasot ja edistyminen › Raportointipäivä*. Ilman raportointipäivää sovellus laskee käynnissä olevan tehtävän eteenpäin jäljellä olevalla kestolla, mutta taaksepäin koko kestolla. Pelivara tulee silloin negatiiviseksi, ja tehtävä näyttää kriittiseltä ilman syytä.

### Prosentti, toteutuneet päivät ja jäljellä oleva kesto

Kentät riippuvat toisistaan. Kun yksi kenttä täytetään, sovellus täyttää muut.

- Prosentti yli 0 tarkoittaa, että tehtävä on alkanut. Jos toteutunutta alkamispäivää ei anneta, sovellus käyttää suunniteltua alkamispäivää. Jos tehtävä on suunniteltu alkamaan raportointipäivän jälkeen, sovellus kysyy ensin, milloin se todella alkoi.
- Prosentti 100 tarkoittaa tehtyä. Jos toteutunutta valmistumispäivää ei anneta, siitä tulee raportointipäivä, vaikka työ oli todellisuudessa tehty aiemmin.
- Toteutunut valmistumispäivä tekee tehtävästä 100 %:n. Jos tehty tehtävä asetetaan takaisin alle 100 prosenttiin, toteutunut valmistumispäivä poistuu. Jos toteutunut valmistumispäivä tyhjennetään, prosentti palaa arvoon 0 ja tehtävä pysyy tilassa *Käynnissä*, kunnes toteutunut alkamispäivä tyhjennetään myös.
- **Jäljellä oleva kesto** on kesto kerrottuna sillä, mitä on vielä tekemättä, pyöristettynä kokonaisiin työpäiviin. Tehtävässä, jonka kesto on 2 työpäivää, 0 % ja 25 % antavat molemmat 2 työpäivää jäljellä olevaa työtä. 50 % ja 75 % antavat molemmat 1 työpäivä. Kun prosentti on 90 %, sovellus pyöristää arvoon 0: jäljellä oleva työ päättyy silloin raportointipäivänä. Tuntiperusteinen tehtävä lasketaan kokonaisina minuutteina. Tehtävässä, jonka kesto on 5 tuntia ja prosentti 40 %, on jäljellä 3 tuntia työtä.
- Välitavoitteella on vain yksi todellinen päivä.
- Vaiheella (yhteenvetotehtävällä) ei ole omaa edistymistä. Laskennan jälkeen sen prosentti seuraa sen alla olevia tehtäviä: niiden prosenttien painotettu keskiarvo, jonka painona on kesto työpäivinä. Välitavoitteen paino on 0.

Kun käynnissä olevan tehtävän kestoa muutetaan, tehty työ pysyy tehtynä. Prosentti mukautuu: tehtävä, jonka kesto on 5 työpäivää ja prosentti 60 %, päätyy 30 prosenttiin, kun kestoksi asetetaan 10 työpäivää. Sovellus ei hyväksy kestoa, joka on lyhyempi kuin jo tehty työ.

### Valmiit ja käynnissä olevat tehtävät

Päättynyt tehtävä on kiinnitetty toteutuneisiin päiviinsä. Se ei enää siirry. Kun raportointipäivä on asetettu, se ei ole koskaan kriittinen. Ilman raportointipäivää päättynyt tehtävä voi silti olla kriittinen.

Käynnissä oleva tehtävä säilyttää toteutuneen alkamispäivänsä. Vain jäljellä oleva työ siirtyy. Se, mistä jäljellä oleva työ alkaa, riippuu edistymistavasta.

### Retained Logic ja Progress Override

Mitä sovellus tekee, jos tehtävä on jo alkanut, vaikka sen edeltäjä on vielä käynnissä? Tästä käytetään nimitystä **järjestyksestä poikkeava edistyminen**: edistyminen on ristiriidassa järjestyksen kanssa. Ajatellaan maalaria, joka aloittaa jo huoneessa, joka on rapattu, vaikka rappaaja on vielä kiireinen muualla.

Kaksi edistymistapaa päättää, miten sovellus tämän laskee:

- **Retained Logic** (oletus): riippuvuus pysyy voimassa. Seuraajan jäljellä oleva työ noudattaa riippuvuutta. Lopusta alkuun -riippuvuudella se alkaa vasta, kun edeltäjä on päättynyt, eikä koskaan ennen raportointipäivää.
- **Progress Override**: todellisuus ratkaisee. Seuraajan jäljellä oleva työ alkaa raportointipäivänä, odottamatta edeltäjää.

Tässä profiilissa ero on vain siinä, miten jäljellä oleva työ lasketaan tehtävissä, jotka ovat jo alkaneet, vaikka edeltäjä ei ole vielä päättynyt. Muut tehtävät lasketaan molemmissa tiloissa samalla tavalla. Sovellus kertoo tällaisesta riippuvuudesta molemmissa tiloissa: tilarivillä *Järjestyksestä poikkeavat riippuvuudet: 1* ja *Varoitukset*-paneelissa.

### Perustasot ja ero

Kun tallennetaan, sovellus tallentaa jokaiselle tehtävälle ilman alitehtäviä varhaisimman alkamispäivän, varhaisimman valmistumispäivän, keston ja välitavoitetyypin. Vaiheita siinä ei ole. Myöhemmät muutokset eivät koske perustasoa. Perustasoja voi olla useita, mutta tasan yksi on **aktiivinen**. Gantt-kaavio, eroraportti ja edistymisraportti käyttävät aktiivista perustasoa.

Plus tarkoittaa myöhempää, miinus aikaisempaa. **Ero** on työpäivinä mitattu erotus perustason ja nykyisen aikataulun välillä. Sovellus laskee projektin kalenterin mukaan. Eroraportti antaa alkamis- ja valmistumiseron tehtävittäin. Tila perustuu vain valmistumispäivän eroon: *Myöhässä* plusmerkille, *Etuajassa* miinusmerkille, muuten *Aikataulussa*. Perustason jälkeen lisätty tehtävä on *Uusi*. Tehtävä, jota ei enää ole, on *Poistunut*.

Kaksi huomiota. *Keston ero* on tehtävätaulukon sarake, ei osa eroraporttia. Se vertaa tehtävän nykyistä suunniteltua kestoa perustason kestoon. Edistyminen ei muuta tätä suunniteltua kestoa: tehtävä, joka oli suunniteltu kahdeksi työpäiväksi ja kesti kolme työpäivää, saa siis valmistumispäivän eron +1, mutta keston eron 0. Kun perustaso tallennetaan edistymisen syöttämisen jälkeen, se tallentaa tilan näiden todellisten päivien mukaan. Ero on silloin nolla.

Edistymisraportti asettaa suunnitellun edistymisen todellisen edistymisen rinnalle. Molemmat painotetaan työpäivillä. Suunniteltu on se osa kustakin tehtävästä, jonka piti perustason mukaan olla päättynyt raportointipäivään mennessä. Todellinen on syötetty prosentti.

### Missä näet sen

Gantt-kaaviossa katkoviiva merkitsee raportointipäivän, ja päivämäärä näkyy otsikkorivillä. Jokaisen käynnissä olevan tehtävän kohdalla viiva pullistuu palkin kohtaan, jonka prosentti osoittaa. Tämä on **edistymisviiva**. Jos edistymisviiva kytketään pois ja *Raportointipäivän viiva* jätetään päälle, jäljelle jää suora viiva. Kun molemmat ovat pois päältä, viiva ja nimiö häviävät. Painikkeet *Perustason peittokuva*, *Edistymisviiva* ja *Raportointipäivän viiva* löytyvät kohdasta *Näkymä › Perustasot ja edistyminen*. Ne eivät muuta laskentaa. Perustaso näkyy ohuena palkkina kunkin tehtäväpalkin alla. Tehtävätaulukossa on sarakkeet edistymiselle ja kullekin perustasolle erolle. Välilehdellä *Raportti* löydät raporttityypit *Ero* ja *Edistymisraportti*.

## Työstetty esimerkki: lisärakennus kolmen viikon jälkeen

Esimerkki on harjoitusprojekti *House extension* opetusohjelmista, siinä tilassa, kun kaikki riippuvuudet on lisätty. Siinä ei ole rakennusalan kesälomaa, resursseja eikä tunteja. Opetusohjelmassa 6 tämä tehdään itse harjoitusprojektissa. Siihen mennessä projektissa on enemmän, joten siellä luvut eroavat. Tässä luetaan, miksi luvut ovat sellaisia kuin ovat.

Lisärakennus alkaa maanantaina 7. kesäkuuta 2027. Laskettuun aikatauluun sovellus tallentaa perustason nimeltä *Baseline*: luovutus perjantaina 6. elokuuta 2027, 45 työpäivää.

### Tila maanantaina 28. kesäkuuta

Raportointipäivä on maanantaina 28. kesäkuuta 2027. Näin on tapahtunut:

- *Start of construction*, *Set up site*, *Clear garden and paving* ja *Set out the extension* on tehty suunnitelman mukaan, 7.–10. kesäkuuta.
- *Excavate foundation trench* oli suunniteltu 2 työpäiväksi (perjantai 11. ja maanantai 14. kesäkuuta) ja kesti 3 työpäivää: 11.–15. kesäkuuta.
- *Foundation formwork and reinforcement* on käynnissä 16.–18. kesäkuuta. *Reinforcement inspection* on 18. kesäkuuta, *Pour foundation* maanantaina 21. kesäkuuta.
- *Foundation brickwork* (2 työpäivää) alkoi perjantaina 25. kesäkuuta ja sen valmiusaste on 50 %.

Kun *Laske* on suoritettu, sovellus laskee näin:

- Jäljellä oleva työ tehtävässä *Foundation brickwork* on 2 × (1 − 0,5) = 1 työpäivä. Se alkaa raportointipäivänä, joten se päättyy maanantaina 28. kesäkuuta.
- *Lay hollow-core floor* seuraa tiistaina 29. kesäkuuta. Tämän seurauksena *Build inner cavity leaf* alkaa keskiviikkona 30. kesäkuuta tiistain 29. kesäkuuta sijaan. Luovutus tulee maanantaina 9. elokuuta: yhden työpäivän myöhemmin kuin perustaso. Kaivannon yksi ylimääräinen päivä on siis koko projektin myöhästyminen, koska tehtävä oli kriittisellä polulla.
- Tilarivillä näkyy *Kriittinen polku: 13 tehtävää, 46 työpäivää*, kun ennen edistymistä oli 21 tehtävää ja 45 työpäivää. Kahdeksaa valmista tehtävää, jotka olivat kriittisellä polulla, ei enää lasketa mukaan.
- Vaihe *Foundations* on valmiusasteessa 77,8 %. Sen tehtävien paino on 2 + 3 + 1 + 2 + 1 = 9 työpäivää. Valmiina on 2 + 3 + 1 työpäivää ja puolet 2 työpäivästä, yhteensä 7. Ja 7 jaettuna 9:llä on 77,8 %. Välitavoite *Reinforcement inspection* painaa 0.

Eroraportti asettaa tämän perustason viereen:

- *Excavate foundation trench*: alku 0, loppu +1 (perustason loppu 14. kesäkuuta, nyt 15. kesäkuuta).
- *Foundation brickwork*: alku +1 (24. kesäkuuta muuttui 25. kesäkuuta), loppu +1.
- *Build outer cavity leaf*: +1, +1. Tehtävä ei ole vielä kriittinen: sillä oli 2 työpäivän pelivara, ja se säilyttää sen.
- *Handover*: +1. Projektin päättymispäivä poikkeaa 1 työpäivän verran.
- Yhteensä 19 tehtävää on tilassa *Myöhässä* ja 4 tilassa *Aikataulussa*. Yhtään tehtävää ei ole tilassa *Etuajassa*.

Edistymisraportti näyttää *Suunniteltu* 28,3 % ja *Todellinen* 23,9 %. Tehtävien paino on yhteensä 46 työpäivää. Perustason mukaan 13 työpäivää olisi pitänyt olla valmiina: 4 työpäivää valmistelussa, 2 kaivannossa, 3 raudoituksessa, 1 valussa, 2 työpäivää tehtävässä *Foundation brickwork* ja 1 työpäivä tehtävässä *Lay hollow-core floor*. Todellisuudessa valmiina on 11 työpäivää: 4 + 2 + 3 + 1 sekä tehtävän *Foundation brickwork* puoli päivää.

### Entä jos raportointipäivä siirretään?

Edistyminen on sama, raportointipäivä on eri. *Foundation brickwork* -tehtävän jäljellä oleva työ alkaa aina raportointipäivänä, joten luovutus siirtyy sen mukana:

- Raportointipäivä perjantai 25. kesäkuuta: jäljellä oleva työ osuu perjantaille 25. kesäkuuta, luovutus pysyy perjantaina 6. elokuuta.
- Maanantai 28. kesäkuuta: luovutus maanantaina 9. elokuuta.
- Tiistai 29. kesäkuuta: luovutus tiistaina 10. elokuuta, 2 työpäivää perustasoa myöhemmin.

### Entä jos valmiusastetta muutetaan?

*Foundation brickwork* -tehtävä on 2 työpäivää. Valmiusasteella 0 % tai 25 % jäljellä oleva työ on 2 työpäivää: se päättyy tiistaina 29. kesäkuuta ja luovutus tulee tiistaina 10. elokuuta. Valmiusasteella 50 % tai 75 % se on 1 työpäivä: maanantai 28. kesäkuuta, luovutus maanantaina 9. elokuuta. Valmiusasteella 90 % jäljellä oleva työ on 0 ja tehtävä päättyy raportointipäivänä.

### Entä jos raportointipäivä asetetaan ilman edistymisen syöttämistä?

Jos raportointipäiväksi asetetaan vain maanantai 28. kesäkuuta eikä syötetä mitään, aikataulun mukaan mitään ei ole vielä tapahtunut. Työ, jota ei ole aloitettu, ei voi olla menneisyydessä. Sovellus siirtää siksi kaiken 28. kesäkuuta: *Start of construction* on silloin sinä päivänä ja luovutus tulee perjantaina 27. elokuuta, 15 työpäivää perustasoa myöhemmin. Syötä siis ensin olemassa oleva edistyminen.

## Esimerkki: rappaaja ja maalari

Seuraavaksi esimerkki edistymistavasta. Sama lisärakennus, mutta eri vaihe: nyt on keskiviikko 21. heinäkuuta 2027. Kaikki tehtävät *Install building services* -tehtävään asti, sen mukaan lukien, ovat valmistuneet suunnitelman mukaan. *Plastering* (4 työpäivää) alkoi tiistaina 20. heinäkuuta, ja sen edistyminen on 25 %. *Painting* (3 työpäivää) seuraa tehtävää *Plastering*, mutta maalari on aloittanut jo tänään, ja sen edistyminen on 33 %.

Ilman edistymistä *Plastering* oli suunniteltu tiistaista 20. heinäkuuta perjantaihin 23. heinäkuuta ja *Painting* maanantaista 26. heinäkuuta keskiviikkoon 28. heinäkuuta. Tilarivillä näkyy nyt *Järjestyksestä poikkeavat riippuvuudet: 1*. *Painting* on alkanut, vaikka *Plastering* ei ole vielä valmistunut. Paneelissa *Varoitukset* lukee: *Järjestyksestä poikkeava edistyminen: seuraajan edistyminen on ristiriidassa riippuvuuden kanssa*.

Plasteringin jäljellä olevaa työtä on 4 × (1 − 0,25) = 3 työpäivää: 21., 22. ja 23. heinäkuuta. Paintingin jäljellä olevaa työtä on 3 × (1 − 0,33) = 2 työpäivää.

- Tilassa **Retained Logic** jäljellä oleva työ voi alkaa vasta, kun *Plastering* on valmistunut. Se on perjantaina 23. heinäkuuta. *Painting* alkaa siis maanantaina 26. heinäkuuta ja päättyy tiistaina 27. heinäkuuta. Palkki kulkee toteutuneesta alkamispäivästä 21. heinäkuuta 27. heinäkuuta asti. Kokonaispelivara on 7 työpäivää.
- Tilassa **Progress Override** jäljellä oleva työ alkaa raportointipäivänä. *Painting* päättyy torstaina 22. heinäkuuta, ennen kuin *Plastering* on valmistunut. Kokonaispelivara on 10 työpäivää.

Luovutus on molemmissa tapauksissa edelleen perjantaina 6. elokuuta, koska tehtävällä *Painting* oli joka tapauksessa pelivaraa.

### Muut laskentaprofiilit

Profiileissa Primavera P6 ja Microsoft Project tehtävä *Painting* päättyy tässä esimerkissä samoille päivämäärille (27. ja 22. heinäkuuta). Ne eroavat seuraavissa kohdissa. Ne ovat profiilin laskentasääntöjä. Ne löytyvät kohdasta *Asetukset › Projekti › Projektin asetukset*, osasta *Laskentaprofiili ja laskentavaihtoehdot*.

- Profiilissa Microsoft Project työtä, jota ei ole aloitettu, ei siirretä raportointipäivään (laskentasääntö *Aloittamattomia tehtäviä ei siirretä raportointipäivään*). Jos yllä olevassa esimerkissä asetetaan vain raportointipäivä eikä syötetä mitään, luovutus pysyy tässä profiilissa perjantaina 6. elokuuta.
- Profiilissa Microsoft Project jäljellä oleva työ ei myöskään ala aikaisemmin kuin toteutunut alkamispäivä plus jo kulunut kesto (laskentasääntö *Jäljellä oleva työ jatkuu kuluneen ajan jälkeen*). Tämä on raportointipäivän lisäksi ylimääräinen alaraja: lasketaan myöhemmästä kahdesta. Otetaan *Build inner cavity leaf* (5 työpäivää). Se alkoi tiistaina 29. kesäkuuta. Raportointipäivänä, keskiviikkona 30. kesäkuuta, edistyminen on 40 %. Kaksi työryhmää muuraa samaan aikaan, joten 40 % on jo tehty yhdessä päivässä. Kaikki sitä edeltävä on valmistunut suunnitelman mukaan. Open Planner Studio ja Primavera P6 antavat tehtävän päättyä perjantaina 2. heinäkuuta. Microsoft Project antaa sen päättyä maanantaina 5. heinäkuuta, koska tiistai 29. kesäkuuta plus 2 kulunutta työpäivää on torstai 1. heinäkuuta, joka on raportointipäivän jälkeen.
- Primavera P6 näyttää käynnissä olevan tehtävän varhaisimpana alkamispäivänä jäljellä olevan työn alun eikä toteutunutta alkamispäivää (esimerkissä *Build inner cavity leaf* keskiviikko 30. kesäkuuta). Sarakkeessa *Alku* ja palkissa näkyy kaikissa profiileissa toteutunut alkamispäivä.
- Profiilissa Primavera P6 tilassa Progress Override riippuvuus seuraajaan, joka on jo alkanut, ei myöskään vaikuta edeltäjään. Se ei enää rajoita edeltäjän myöhäisiä päivämääriä eikä vapaata pelivaraa (laskentasääntö *Progress Override ohittaa aloitetun seuraajan myös takaperoin*). Rappaaja ja maalari -esimerkissä tätä ei näe, koska *Plastering* on joka tapauksessa kriittinen lattiatasoitteen kautta. Sen myöhäiset päivämäärät ja vapaa pelivara ovat samat tilassa Retained Logic ja tilassa Progress Override.
- Kun .xer-tiedosto avataan, sovellus ottaa edistymistavan tiedostosta. Actual Dates, kolmas P6-tila, ei ole sovellukselle tuttu. Tällainen tiedosto lasketaan tilassa Retained Logic.

## Seuraukset ja väärinymmärrykset

**"Siirrän vain raportointipäivää eteenpäin."** Jos raportointipäivää siirretään, käynnissä olevien tehtävien jäljellä oleva työ alkaa uudesta päivästä. Työ, jota ei ole vielä aloitettu, ei voi koskaan sijoittua sen päivän eteen. Raportointipäivää siirretään siis vain yhdessä edistymisen päivityksen kanssa.

**"Kun syötän 100 %, valmistuminen kirjataan."** Vain, jos myös toteutunut valmistumispäivä syötetään. Jos tehtävä asetetaan 100 %:iin ilman toteutunutta valmistumispäivää, toteutunut valmistumispäivä tulee raportointipäiväksi. Jos tehtävä oli oikeasti valmistunut aiemmin, täytetään toteutunut valmistumispäivä.

**"0 % tarkoittaa, ettei tehtävää ole aloitettu."** Jos tehtävällä on toteutunut alkamispäivä, se lasketaan aloitetuksi, vaikka edistyminen on 0 %. Jäljellä oleva työ on silloin koko kesto ja alkaa raportointipäivänä. Toteutunut alkamispäivä tyhjennetään, jotta tehtävä lasketaan taas aloittamattomaksi.

**"Progress Override ratkaisee varoituksen."** Ilmoitus järjestyksestä poikkeavasta edistymisestä jää näkyviin. Edistymistapa määrittää vain, miten sovellus laskee. Jos riippuvuus ei ole enää oikein, riippuvuutta muutetaan.

**"Jaetun tehtävän tauko katoaa."** Ei. Tauko, joka on vielä edessä, pysyy jäljellä olevassa työssä. Otetaan tehtävä, jonka kesto on 5 työpäivää ja jossa on 1 päivän tauko 2 työpäivän työn jälkeen. Se alkoi tiistaina 29. kesäkuuta. Raportointipäivänä, keskiviikkona 30. kesäkuuta, edistyminen on 40 %. Jäljellä oleva työ, 3 työpäivää, alkaa raportointipäivänä ja kulkee tauon yli. Loppu on maanantaina 5. heinäkuuta. Ilman taukoa se oli perjantaina 2. heinäkuuta.

**Tunnit ja raportointipäivä.** Aikaa ei voi syöttää valintanauhassa. Raportointipäivä täytetään päivämääränä. Jos edistymistä tarkistetaan työajan jälkeen, raportointipäiväksi asetetaan seuraava työpäivä. Tunneissa mitattava tehtävä laskee jäljellä olevan työn raportointipäivän alusta. Otetaan esimerkiksi *Lay hollow-core floor* harjoitusprojektista opetusohjelman 4 jälkeen, kun kaikki sitä edeltävä on valmistunut: 5 tuntia, maanantaina 28. kesäkuuta, työpäivä alkaa klo 07:00. Kun raportointipäivä on maanantaina 28. kesäkuuta ja prosentti 40 %, tehtävässä on jäljellä 3 tuntia työtä, joka kulkee välillä 07:00–10:00, vaikka työtä olisi jo tehty kyseisenä aamuna. Miten sovellus laskee tunnit, selitetään kohdassa [Päivät ja tunnit](docs://uitleg-dagen-en-uren).

**Perustason päivittäminen.** Sitä ei voi tehdä. Uusi perustaso tallennetaan ja vanha poistetaan. Kun projekti siirretään, todelliset päivämäärät ja raportointipäivä siirtyvät mukana. Perustasot eivät oletuksena siirry. Näin siirtymä jää näkyviin erona. Katso [Projektin siirtäminen](docs://howto-project-verplaatsen).

## Katso myös

- [Edistymisen päivittäminen](docs://howto-voortgang-bijwerken): raportointipäivän asettaminen ja edistymisen syöttäminen.
- [Edistymisen tuominen taulukkolaskennasta](docs://howto-voortgang-importeren): työmaan henkilöstöltä saatavan edistymisen lukeminen kerralla.
- [Edistymistavan valitseminen](docs://howto-voortgangsmodus-kiezen): edistymistavan asettaminen Retained Logic tai Progress Override.
- [Perustason tallentaminen ja hallinta](docs://howto-baseline-opslaan-en-beheren): perustason tallentaminen ja käyttäminen.
- [Projektin siirtäminen](docs://howto-project-verplaatsen): mitä tapahtuu todellisille päivämäärille, raportointipäivälle ja perustasoille.
- [Kriittinen polku ja pelivara](docs://uitleg-kritiek-pad): miksi tehtävä on kriittinen ja mitä pelivara tarkoittaa.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): edistyminen ja raportointipäivä projektin puolivälissä (20. toukokuuta 2027).

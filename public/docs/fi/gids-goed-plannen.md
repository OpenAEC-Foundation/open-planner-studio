# Hyvän aikataulun laatiminen

Mikä tekee aikataulusta hyvän? Ei se, kuinka siistiltä se näyttää. Ratkaisevaa on, vastaako se kysymykseen, joka on tärkein, kun rakennustyöt ovat käynnissä: jos tämä viivästyy, mitä tapahtuu luovutukselle? Tämä artikkeli selittää periaatteet, joilla luotettava aikataulu rakennetaan. Se selittää myös, miksi ne painavat Open Planner Studiossa niin paljon. Sovellus laskee vain sen, mitä syötetään, eikä mitään muuta.

Esimerkit tulevat rakentamisesta: runkotyöt, viimeistelytyöt, toimitusajat, sään aiheuttama viivästys, aliurakoitsijat ja sopimuksen mukainen luovutuspäivä. Periaatteet itsessään eivät ole sidottuja rakentamiseen.

## Konsepti

Hyvä aikataulu ei ole kuva siitä, mitä toivotaan. Se on **laskentamalli**: tehtäviä, joilla on kesto, jotka on yhdistetty riippuvuuksilla ja jotka ovat kalenterissa. Sovellus laskee päivämäärät tästä mallista. Kun jokin muuttuu, malli lasketaan uudelleen. Silloin nähdään heti, mitä muutos tarkoittaa muulle aikataululle.

Suunnittelija etenee kiinteässä järjestyksessä:

1. Tavoite: välitavoitteet ja luovutuspäivä.
2. Jaottelu: vaiheet, työpaketit, tehtävät.
3. Kunkin tehtävän kesto.
4. Riippuvuudet.
5. Rajoitteet ja kiinteät päivämäärät.
6. Kalenterit.
7. Resurssit.
8. Kriittinen polku ja pelivara.
9. Perustaso ja edistyminen.
10. Tarkistus.

Järjestys ei ole kohteliaisuutta. Jos vaihe jätetään väliin, siitä tulee yllätys. Tehtävät, joilla ei ole riippuvuuksia, eivät siirry mukana. Kesto ilman kalenteria on väärin. Perustaso, joka tallennetaan vasta myöhemmin, jäädyttää viivästyksen eikä sovittua aikataulua.

## Miten sovellus laskee aikataulun avulla

Jokainen alla oleva periaate liittyy johonkin, minkä sovellus tekee. Siksi tämä osa noudattaa samaa järjestystä.

### Aloita tavoitteesta, älä tehtävistä

Ensin määritetään hetket, jotka ovat kiinteitä, ja vasta sen jälkeen työ, jonka on mahduttava niiden väliin: työmaan valmistelun alku, lopullinen lupa, vedenpitävä runko, viimeistelyn alku ja luovutus. Nämä ovat **välitavoitteita**: pisteitä ilman kestoa. Ne syötetään välitavoitteina (*Aloitus › Tehtävät › Välitavoite ▾*). Niitä ei syötetä nollapäiväisenä tehtävänä, jonka nimi muistuttaa välitavoitetta.

Syy tähän järjestykseen: aikataulu, joka alkaa tehtäväluettelosta, muuttuu summaksi, ja summa osuu harvoin sopimuksen päivään. Kun aloitetaan välitavoitteista, kysymys on heti alussa kohdallaan: ei "kuinka kauan kaikki tämä kestää yhteensä", vaan "mahtuuko työ näiden kahden hetken väliin, ja jos ei, mitä on muutettava". Vaaditusta luovutuspäivästä edetään ajassa takaisin: milloin rakennuksen on viimeistään oltava vedenpitävä, ja sieltä alkuun.

Sopimuksella kiinteä luovutus saa valintaruudun *Pakollinen (sopimuksellinen)*. Silloin jokainen tiedoston avaaja näkee, ettei tämä hetki ole neuvoteltavissa eikä siirrettävissä. Valintaruutu on merkki Gantt-kaaviolle ja raporteille. Se ei suojaa päivää. Sen tekee tavoitepäivä tai rajoite (ks. alla).

### Jaottelu: vaiheet, työpaketit, tehtävät

Välitavoitteiden alle rakennetaan rakenne: vaiheet, niiden alle työpaketit ja niiden alle tehtävät. Se tehdään sisentämällä. Tehtävästä, jolla on alitehtäviä, tulee automaattisesti **yhteenvetotehtävä**: sovellus johtaa sen palkin ja keston sen alla olevista tehtävistä. Yhteenvetotehtävän kestoa ei siis koskaan syötetä itse.

Karkeustason peukalosääntö: **tehtävä kestää noin yhdestä päivästä kahteen viikkoon**. Lyhyempi kuin päivä tarkoittaa, että suunnitellaan työmaata eikä projektia. Se kuuluu työnjohtajan viikkosuunnitelmaan, ei laskentamalliin, jonka on kestettävä kuukausia. Pidempi kuin kaksi viikkoa tarkoittaa tehtävää, jota ei voi arvioida kunnolla eikä seurata toteutuksen aikana: "lattian viimeistely, 40 päivää, 45 % tehty" ei kerro kenellekään, ovatko asiat hyvin. Aikataulukatselmuksissa lasketaan siksi usein, montako tehtävää kestää yli noin kaksi kuukautta. Jos niiden osuus on yli muutama prosentti, se on merkki yksityiskohtien puutteesta.

Liian yksityiskohtainen jaottelu haittaa yhtä paljon kuin liian karkea. Jokainen tehtävä vaatii ylläpitoa: riippuvuuksia piirrettävänä, edistymistä kirjattavana ja uusi arvio jokaisen muutoksen jälkeen. Kuuden kuukauden projektiin tehty kahden tuhannen tehtävän aikataulu ei tule tarkemmaksi, vaan siitä tulee ylläpitämätön. Aikataulua, jota kukaan ei pidä ajan tasalla, ei ole kolmessa viikossa enää totta. Taso valitaan siten, että edistymisestä voi antaa rehellisen raportin joka viikko.

Käytännössä: "3. Finishing" on vaihe, "Finishing house 4" työpaketti, "Plastering house 4 ground floor" viiden päivän tehtävä. Ylärajan voi tarkoituksella ylittää toimitusaikojen ja valvonnan vuoksi: kymmenen viikon ikkunakehysten toimitus on todellisuudessa yksi jakamaton odotusjakso, ja jatkuva valvonta kuuluu riippumattoon eikä keinotekoisten viipaleiden sarjaan.

### Keston arviointi

Kesto on arvio siitä, kuinka kauan työ kestää, ei siitä, kuinka nopeasti se voisi edetä. Arvioidaan tavallisen päivän mukaan, työryhmällä, joka todella on käytettävissä, ei parhaan päivän mukaan parhaalla ryhmällä. Optimismi kertyy ketjussa. Aikataulu, jossa jokainen tehtävä olettaa parhaan päivän, ei lähes koskaan saavuta luovutuspäiväänsä.

Päivät tai tunnit ovat todellinen valinta, ei muotoilua. **Päivät** valitaan työlle, joka määrää tahdin työmaalla, kuten muuraukselle, rappaukselle ja laatoitukselle: se kestää viisi päivää, vaikka päivä olisi kahdeksan tai yhdeksän tuntia. **Tunnit** valitaan, kun työ mitataan tunteina ja päivän loppuosalla on merkitystä: kolmen tunnin tarkastus, neljäntoista tunnin betonivalu, joka jakautuu kahdelle päivälle, tai työvuoroissa tehtävä työ. Sovellus tallentaa valinnan tehtäväkohtaisesti. Valinta löytyy vasta, kun *Ota tuntisuunnittelu käyttöön* on ensin otettu käyttöön; ks. [Päivät ja tunnit](docs://uitleg-dagen-en-uren).

Riskiä ei piilotella yksittäisten kestojen sisään. Lisäämällä päivä kaikkialle varmuusvara peitetään niin, ettei kukaan enää näe tai ohjaa sitä, ja silloin kun sitä todella tarvittaisiin, se osoittautuu liian pieneksi. Varaus kannattaa tehdä näkyväksi: erillinen puskuritehtävä ennen luovutuspäivää tai erillinen sääpuskuri. Varo kaksinkertaista laskemista: noin 180 työpäivää vuodessa, joilla hollantilainen rakennusala laskee, on sopimuksellinen vuositason luku (UAV), josta yleiset vapaapäivät, rakennusalan kesäloma *ja* menetetyt päivät on jo vähennetty. Jos vapaapäivät ja rakennusalan kesäloma ovat jo projektikalenterissa, jäljelle jää vain säästä johtuva viivästys erillisenä kohtana. Pakkasesta ja myrskystä johtuvat viivästykset noudattavat omia sääntöjään työehtosopimuksessa Onwerkbaar weer Bouw & Infra. Odotetut menetetyt päivät asetetaan kalenteriin tai erilliseen kohtaan, eikä niitä piilotella muurauksen keston sisään.

### Riippuvuudet: ilman verkkoa ei ole aikataulua

Sovellus laskee päivät **riippuvuuksien** kautta: tehtävä alkaa vasta, kun sen edeltäjät sen sallivat. Tehtävä ilman riippuvuuksia ei ole sidottu mihinkään. Jos runkotyöt lykkääntyvät kaksi viikkoa, irrallinen viimeistelytehtävä ei seuraa, ja aikataulu antaa väärän kuvan, vaikka mikään ei muutu punaiseksi.

Tämän vuoksi jokaisella tehtävällä on vähintään yksi edeltäjä ja vähintään yksi seuraaja. Vain projektin ensimmäinen tehtävä ja viimeinen välitavoite ovat poikkeuksia. Aikataulukatselmuksen ensimmäinen tarkistus on tämä: puuttuvaa logiikkaa saa olla enintään muutamalla prosentilla tehtävistä.

**Lopusta alkuun on oletus**, ja sen pitääkin pysyä sellaisena: perustus on tehty, sitten runkotyöt. Terveessä rakennusaikataulussa noin yhdeksän riippuvuutta kymmenestä on lopusta alkuun. Tämä on luettavuusvaatimus: lopusta alkuun on ainoa tyyppi, jonka kaikki työmaalla ymmärtävät ilman selitystä, ja se käyttäytyy toteutuksen aikana ennustettavasti.

**Alusta alkuun viiveellä** on tarkoitettu työlle, joka todella kulkee rinnalla eikä odota. Klassinen esimerkki on rivitalo tai torni kerroksineen: asentaja seuraa muurausta kolme päivää jäljessä. Se on alusta alkuun -riippuvuus kolmen päivän viiveellä, ei keinotekoisesti pilkottuun tehtävään sidottu lopusta alkuun. Sen rinnalle kannattaa asettaa lopusta loppuun -riippuvuus, muuten seuraaja voisi periaatteessa päättyä ennen edeltäjäänsä. Rakentamisessa alusta loppuun -riippuvuutta käytetään lähes koskaan.

Alusta alkuun -riippuvuus kannattaa piirtää tehtävien välille, ei vaiheiden välille. Jos alusta alkuun tai alusta loppuun -riippuvuuden edeltäjä on vaihe, sovellus saa seuraajan odottamaan sitä vaiheen tehtävää, joka alkaa **viimeisenä**, ei ensimmäistä. Näin suunnitelma ei koskaan ole liian aikainen, mutta joskus myöhempi kuin oli tarkoitus. Lopusta alkuun ja lopusta loppuun -riippuvuudet, joiden edeltäjä on vaihe, odottavat vaiheen viimeisen tehtävän valmistumista, ja se on yleensä juuri se, mitä tarkoitetaan.

Viiveitä käytetään säästeliäästi, ja negatiivisia viiveitä vielä säästeliäämmin. Viive on odotusaika ilman näkyvää syytä: kukaan ei myöhemmin tiedä, miksi välissä on seitsemän päivää. Jos kyse on betonin kovettumisesta, siitä tehdään viive kalenteripäivinä (betoni kovettuu myös viikonloppuna), tai vielä parempi: tehdään erillinen "kovettuminen"-tehtävä, jonka kaikki näkevät ja voivat seurata. Negatiivista viivettä eli limitystä, päällekkäisyyttä, ei pitäisi olla lainkaan; aikataulukatselmuksessa normi on nolla. Jos halutaan päällekkäisyyttä, jaetaan edeltäjä tai käytetään alusta alkuun -riippuvuutta.

### Rajoitteet ja kiinteät päivät: mahdollisimman vähän

Jokainen tehtävä alkaa aluksi "mahdollisimman aikaisin", ja useimmissa tapauksissa sen pitääkin jäädä niin. **Rajoite** on päivärajoitus riippuvuuksien rinnalla. Mitä enemmän niitä lisää, sitä vähemmän aikataulu laskee ja sitä enemmän siitä tulee piirros. Täynnä kiinteitä päiviä oleva suunnitelma näyttää vakaalta ja piilottaa riskin juuri siksi: se ei liiku, joten se ei enää varoita.

Rajoitetta käytetään vain kovaan ulkoiseen päivään, johon aikataululla itsessään ei ole vaikutusta: lupa, jota ei saada lopulliseksi ennen 1. maaliskuuta (*Alkaa aikaisintaan (SNET)*), kunnan myöntämä sulkuaika, energiayhtiön liittymäpäivä. "Haluan tämän tehtävän toukokuuhun" ei ole ulkoinen tosiasia. Se ratkaistaan logiikalla tai toisella kestolla. Peukalosääntönä: enintään muutamalla prosentilla jäljellä olevista tehtävistä on kova päivärajoitus.

Tehtävää ei saa paikalleen kirjoittamalla aloituspäivää. Tehtävällä, jolla on edeltäjä, sovellus muuttaa kirjoitetun (tai raahatun) aloituksen rajoitteeksi *Alkaa aikaisintaan (SNET)*. Tehtävä on silloin haluamassasi kohdassa, ja se pysyy siinä, vaikka kaikki sitä edeltävät tehtävät myöhästyvät.

Jos halutaan seurata päivää ohjaamatta laskentaa, käytetään **tavoitepäivää**. Se ei siirrä mitään, mutta antaa negatiivisen pelivaran ja varoituksen heti, kun tehtävä ei enää täytä sitä. Juuri tätä signaalia halutaan nähdä. Kova kiinnitys (*Pakollinen (kiinnityslogiikka)*) on varattava äärimmäistä tapausta varten, ja silloin tiedetään, että se antaa negatiivisen pelivaran sitä edeltävässä ketjussa: aikataulu kertoo silloin, ettei se mahdu, eikä kyse ole siitä, että jokin on rikki.

### Kalenterit: ensin projekti, sitten poikkeukset

Kaikki kestot lasketaan kalenterin työpäivinä tai työtunteina. Projektikalenteri kannattaa siis asettaa kunnolla ennen kestojen syöttämistä: työpäivät, työajat, vapaapäivät ja rakennusalan kesäloma. Kalenteri, jota korjataan kesken, siirtää koko aikataulua. Ennakoitavat sulkuajat lisätään heti: pakkaskausi, jolloin betonia ei valeta, ja yrityksen tauko joulun ja uudenvuoden välillä.

Resurssille kannattaa antaa oma kalenteri vain, jos se todella poikkeaa: julkisivuasentaja, joka tulee neljänä päivänä viikossa, tai työryhmä, joka pitää eri kesälomansa. Resurssikalenteri ei muuta yhtään tehtävän päivää. Kesto jatkuu edelleen tehtävän tai projektin kalenterilla. Resurssikalenteri näyttää vain, että resurssi ei työskentele joinakin tehtävän työpäivinä, ja näkyy histogrammissa ylikuormituksena. Ero on vaikea hahmottaa, jos ei tiedä luoneensa sitä itse.

### Resurssit: kuka tekee työn ja onko se mahdollista

Aikataulu ilman resursseja vastaa vain puolta kysymystä. Kun ryhmät ja kalusto on määritetty, histogrammi näyttää sen, mitä pelkkä aikajana ei näytä: esimerkiksi 14. kesäkuuta tarvitaan kolmea rappausryhmää, vaikka niitä on kaksi.

Aloitetaan resursseista, jotka rajoittavat. Kaikkia yksityiskohtia ei tarvitse mukaan; mukaan kuuluvat torninosturi, omat ryhmät, aliurakoitsijat, joilla on kapasiteettikatto, ja pitkät toimitusajat. Jokaiselle resurssille annetaan rehellinen kapasiteetti: kaksi rappaajaa tarkoittaa kahta, ei "kahta, mutta hätätilanteessa kolmea".

Histogrammia luetaan kysymyksenä, ei virheenä. Punainen alue viivan yläpuolella tarkoittaa, että aikataulu vaatii enemmän kuin on käytettävissä sinä päivänä. Joskus vastaus on: siirrä. Usein vastaus on: tämä ei onnistu, ja juuri sen halusin tietää. **Tasaaminen** siirtää tehtäviä, kunnes kysyntä mahtuu kapasiteettiin. Jos loppupäivä voi joustaa, se sallitaan. Jos luovutuspäivä on kiinteä, tasataan vain pelivaran sisällä (valintaruutu *Tasaa vain pelivaran sisällä — projektin päättymispäivä pysyy kiinteänä*). Loppupäivä pysyy silloin paikallaan, ja jäljelle jäävästä ristiriidasta tehdään raportti. Se on rehellisempi tulos kuin aikataulu, joka vain näyttää ratkaistulta.

*Tasaamista ei* tehdä, kun kysyntä on rakenteellisesti suurempi kuin kapasiteetti. Tasaaminen järjestelee olemassa olevan työn uudelleen ajassa. Se ei palkkaa lisää rappaajia eikä rakenna toista nosturia. Kolme tornia, jotka tarvitsevat samaa ryhmää samaan aikaan, ovat tasaamisen jälkeenkin kolme tornia, jotka tarvitsevat samaa ryhmää. Ainoa muutos on, että luovutus siirtyy myöhemmäksi. Siinä auttavat vaiheistus, lisäkapasiteetti tai toisenlainen työ. Tasaamista ei myöskään tehdä ennen kuin logiikka ja kestot ovat kunnossa: silloin tasattaisiin aikataulua, joka on huomenna erilainen.

### Kriittinen polku ja pelivara: missä aikataulu on haavoittuvainen

Sovellus ei laske uudelleen jokaisen muutoksen jälkeen. Laske komennolla **Laske** (F5) ja lue vasta sen jälkeen. Jos tilarivillä lukee *Vanhentunut — laske uudelleen (F5)*, näkyy edellinen laskenta, ei tämä. Asetuksella *Laske automaattisesti* sovellus laskee itse.

**Kriittinen polku** on ketju ilman pelivaraa: jokainen siellä menetetty päivä siirtää luovutusta yhdellä päivällä. Sinne kuuluvat valvonta ja parhaat ihmiset. Punaista ei kannata katsoa yksin. **Kokonaispelivara** kertoo, kuinka paljon tehtävä saa myöhästyä vaikuttamatta luovutukseen; **vapaa pelivara** kertoo, kuinka paljon se saa myöhästyä siirtämättä seuraajaansa. Ero ei vaikuta kenenkään loppupäivään, mutta se vaikuttaa jonkun työhön. Se on hyödyllistä, kun työskennellään aliurakoitsijoiden kanssa, joita ei voi aikatauluttaa kahdesti.

Kolme merkkiä kannattaa pitää silmällä. Tehtävä, jolla on muutama päivä pelivaraa, ei ole turvallinen, vaan lähes kriittinen; asetuksella *Merkitse lähes kriittiset* tällaiset tehtävät saavat oman värinsä. Tehtävä, jolla on äärimmäisen paljon pelivaraa (aikataulukatselmuksissa yli 44 työpäivää, eli noin kaksi kuukautta), puuttuu lähes aina seuraaja. Se osoittaa suoraan verkoston aukkoihin. Negatiivinen pelivara ei ole koskaan laskentavirhe: se kertoo, että tavoitepäivä tai kiinteä päivä ei mahdu.

### Perustaso ennen aloitusta, sitten pidä ajan tasalla

Perustaso kannattaa tallentaa, kun aikataulu on hyväksytty ja ennen kuin ensimmäinen lapio menee maahan (*Aikataulu › Perustasot ja edistyminen › Hallitse perustason suunnitelmia…*). Aikataulu lasketaan ensin, koska perustaso tallentaa viimeisimmän laskennan päivät. Ilman tätä vertailukohtaa voi myöhemmin sanoa vain, *että* asiat menevät toisin, ei kuinka paljon tai siitä lähtien milloin. Juuri sitä tarvitaan työmaakokouksessa, lisätöistä ja viivästyksistä keskusteltaessa.

Perustaso tallentaa päivät, mutta ei niiden taustalla olevia oletuksia. Juuri niistä kysytään heti, kun viivästyksestä keskustellaan. Siksi tallennettaessa kirjataan lyhyesti, mihin tämä aikataulu perustuu (aikataulukäytännössä: *aikataulun perusta*): mitä tuottavuuslukuja on käytetty, mikä kalenteri on käytössä ja miksi se on asetettu näin, mitä on tietoisesti jätetty aikataulusta pois, kuka on antanut oletetut toimitusajat ja kuka on hyväksynyt aikataulun. Puoli sivua riittää.

Sen jälkeen pitäminen ajan tasalla on rytmi, ei projekti. Päivitys tehdään viikoittain samassa järjestyksessä: raportointipäiväksi asetetaan päivä, jona raportoidaan, syötetään toteutunut alkamispäivä ja toteutunut loppupäivä sille, mikä on alkanut ja päättynyt, korjataan käynnissä olevan työn jäljellä oleva kesto ja lasketaan. Pelkkä prosenttiluku ei riitä: todelliset päivät ovat tosiasiallinen kirjanpito, jota katsotaan myöhemmin.

Raportointipäivän vaikutus kannattaa tuntea. Työtä, jota ei ole vielä aloitettu, sovellus siirtää raportointipäivään, ja sen jälkeiset tehtävät siirtyvät mukana (paitsi Microsoft Project -laskentaprofiilissa). Jos tehtävän tai välitavoitteen loppupäivää ei merkitä, se siirtyy oikealle itsestään. Tämä ei ole vika, vaan malli, joka ei esitä, että menneisyydessä voisi vielä tapahtua jotain. Jos saadaan varoitus *Väärässä järjestyksessä*, työ on tehty eri järjestyksessä kuin logiikka edellyttää. Syy on yleensä järjestyksen tarkistaminen, ei varoituksen sulkeminen. Uusi perustaso tallennetaan vain todellisen laajuusmuutoksen vuoksi, ja silloin ensimmäisen rinnalle, ei sen päälle.

Lopuksi: aikataulu on luotettava vain, jos työn tekijät uskovat siihen. Työnjohtajan ja aliurakoitsijoiden kanssa viikkosuunnitelma verrataan tähän malliin. Jos viikosta toiseen saavutetaan vain puolet sovitusta, ongelma on useammin aikataulussa kuin toteutuksessa.

## Työesimerkki: kolme valintaa, jotka saavat aikataulun valehtelemaan hiljaa

Luvut tulevat kahdesta esimerkistä, jotka on esitetty muualla ohjeessa: harjoitusprojekti *House extension* opetusohjelmista ja pieni verkosto lisärakennusta varten. Tässä on kyse siitä, mitä kukin valinta tekee aikataululle. Sen voi kokeilla itse opetusohjelmassa 2 (riippuvuudet ja kriittinen polku) ja opetusohjelmassa 3 (rajoite ja tavoitepäivä).

### Unohdettu riippuvuus

Lisärakennuksessa työt alkavat maanantaina 7. kesäkuuta 2027 ja luovutus on perjantaina 6. elokuuta. *Build outer cavity leaf* (6 työpäivää) saa seuraajakseen *Install window frames*, koska ikkunakehykset ovat julkisivussa. Tällä riippuvuudella ulkokuoren pelivara on 2 työpäivää.

Jos tuo riippuvuus unohdetaan, ulkokuoren pelivara on yhtäkkiä 23 työpäivää luovutukseen asti. Aikataulussa se voi myöhästyä viikkoja, eikä kukaan odota sitä. Mikään ei muutu punaiseksi, eikä varoitus näy. Vain laskennan asetuksella *Avoimet tehtävät ovat kriittisiä* tehtävästä ilman seuraajaa tulee kriittinen, jolloin aukko näkyy.

### Kiinteä päivä riippuvuuden sijaan

Pieni verkosto: *Groundwork* (3 työpäivää), *Pour foundation* (2), *Brickwork* (5) ja *Roofing* (3) peräkkäin, alkaen maanantaina 7. kesäkuuta 2027. Projektin loppu on keskiviikkona 23. kesäkuuta.

Jos *Brickwork*-tehtävän alkupäiväksi kirjoitetaan maanantai 21. kesäkuuta, koska tiilet saapuvat vasta silloin, siitä tulee *alkaa aikaisintaan* -rajoite. Brickwork siirtyy viikon, ja projektin loppu on keskiviikkona 30. kesäkuuta. *Groundwork* ja *Pour foundation* saavat 5 työpäivää pelivaraa eivätkä ole enää kriittisiä. Jos tiilet kuitenkin saapuvat aiemmin, Brickwork pysyy 21. kesäkuuta: nyt päivämäärä ohjaa, ei logiikka.

Jos kirjoitetaan keskiviikkona 9. kesäkuuta, ennen kuin perustus päättyy, ei tapahdu mitään: riippuvuudet sallivat Brickwork-tehtävän alkaa joka tapauksessa vasta maanantaina 14. kesäkuuta.

### Tavoitepäivä rajoitteen sijaan

Jos halutaan, että *Roofing*-tehtävän loppu on perjantaina 18. kesäkuuta, siihen asetetaan tavoitepäivä. Mikään ei siirry: Roofing pysyy maanantaina 21. ja keskiviikkona 23. kesäkuuta. Ketjun pelivara on kuitenkin −3 työpäivää, ja sovellus näyttää *Tavoitepäivä 18-06-2027 ylitetty — varhaisin valmistumispäivä 23-06-2027*. Näin nähdään heti, että sovittu päivä ei sovi aikatauluun. Muutoin palkki näyttäisi oikealla paikalla, vaikka sen takana oleva ketju ei sitä tue.

## Seuraukset ja väärinkäsitykset

- **Tehtävät ilman edeltäjää tai seuraajaa.** Yleisin ja haitallisin: nämä tehtävät eivät liiku mukana ja saavat väärää pelivaraa.
- **Päivämäärien kirjoittaminen tai palkkien vetäminen logiikan piirtämisen sijaan.** Se asettaa hiljaa rajoitteen.
- **Liian monta rajoitetta ja kiinteä lukitus kirjanmerkkinä.** Silloin aikataulu ei enää laske, se vain piirtää.
- **Kolmen kuukauden tehtävät tai puolen päivän tehtävät.** Käyttökelpoinen alue on noin päivästä kahteen viikkoon.
- **Optimistiset kestot ja varaus piilossa jokaisessa tehtävässä** sen sijaan, että se näkyisi puskurina.
- **Sääaiheinen myöhästyminen ja rakennusalan kesäloma puuttuvat kalenterista.** Ne päätyvät kalenteriin joka tapauksessa, tammikuussa.
- **Viiveet tehtävien sijaan.** Seitsemän päivän nimetön odotusaika on kolme kuukautta myöhemmin käsittämätön.
- **Tasaaminen ennen kuin logiikka on määritetty**, tai tasaamisen jatkaminen rakenteellista kapasiteettipulaa vastaan.
- **Laskennan unohtaminen.** *Vanhentunut* tilarivillä tarkoittaa, että näkyvissä on edellisen laskennan tulos.
- **Ei perustasoa tai perustaso tallennettu vasta alun jälkeen.**
- **Edistyminen kirjattu pelkkinä prosentteina**, ilman todellisia päivämääriä ja ilman raportointipäivää.
- **Sulkea *Varoitukset*-paneeli lukematta sitä.** Siinä yhdistyvät ylittyneet tavoitepäivät, rikotut rajoitteet, järjestyksestä poikkeavat riippuvuudet ja ylikuormitetut resurssit (*Suunnittelu › Aikataulu › Varoitukset*).

## Katso myös

- [Kriittinen polku ja pelivara](docs://uitleg-kritiek-pad): miten sovellus laskee varhaiset ja myöhäiset päivämäärät ja pelivaran.
- [Riippuvuudet ja viive](docs://uitleg-relaties): neljä riippuvuuden tyyppiä, viive ja vaiheen riippuvuudet.
- [Rajoitteet ja tavoitepäivät](docs://uitleg-constraints): mitä kukin rajoite ja tavoitepäivä tekee laskentaan.
- [Kalenterit ja työpäivät](docs://uitleg-kalenders): miten sovellus laskee työpäivät ja mikä kalenteri ratkaisee.
- [Päivät ja tunnit](docs://uitleg-dagen-en-uren): suunnittelu päivinä, tunteina tai sekoitettuna.
- [Resurssien tasaaminen](docs://uitleg-nivelleren): mitä tasaaminen siirtää ja mitä ei.
- [Edistyminen, raportointipäivä ja perustaso](docs://uitleg-voortgang): mitä raportointipäivä tekee ja miten eroa perustasoon luetaan.
- [Tehtävien ja välitavoitteiden lisääminen](docs://howto-taken-en-mijlpalen-toevoegen): välitavoitteiden ja tehtävien syöttäminen.
- [Riippuvuuksien lisääminen](docs://howto-relaties-leggen): tehtävien linkittäminen toisiinsa.
- [Tekoälyavustajan liittäminen (MCP)](docs://howto-ai-assistent-koppelen): tekoälyavustaja, joka suunnittelee näiden periaatteiden mukaan.
- [Ilmoitukset ja varoitukset](docs://ref-meldingen): kaikki varoitukset yhdessä paikassa.

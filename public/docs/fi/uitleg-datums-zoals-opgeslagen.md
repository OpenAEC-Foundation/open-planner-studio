# Tallennetut päivämäärät

Aikataulu avataan Primaverasta tai MS Project -ohjelmasta, ja päivämäärät eroavat siitä, mitä siinä ohjelmassa näkyi. Onko tuonti mennyt pieleen? Yleensä ei. Tässä artikkelissa luetaan, miksi sovellus laskee itse uudelleen, milloin se näyttää tiedoston päivämäärät, mitä silloin jää tyhjäksi ja miten palataan sovelluksen omaan laskentaan. Lopussa oleva esimerkki seuraa kahta tehtävää koko kierron ajan.

## Periaate

Aikataulutiedosto sisältää kahta eri tyyppistä tietoa. Ensin logiikka: tehtävät, kestot, riippuvuudet, kalenterit ja rajoitteet. Toiseksi päivämäärät, jotka pakettti itse laski niiden perusteella. Kun tiedosto avataan, Open Planner Studio käyttää logiikkaa ja laskee itse. Tiedoston päivämäärät eivät siis ole syötettä.

Jos sovelluksen oma laskenta päätyy muille päivämäärille kuin tiedosto kertoo, ei voida tietää, kumpi puoli on oikein. Tiedostosta voi puuttua logiikkaa, jota pakettti käytti. Pakettikin voi laskea jossakin kohdassa eri tavalla kuin sovellus. Siksi sovellus voi näyttää päivämäärät **sellaisina kuin ne tallennettiin**: päivämäärät, jotka toinen ohjelma kirjoitti tiedostoon. Näin vertailu tehdään sen kanssa, mitä siinä ohjelmassa näkyi.

## Miten sovellus toimii tässä tilanteessa

### Mitä laskentaprofiilia sovellus käyttää

Sovellus laskee **laskentaprofiilin** avulla. Laskentaprofiili on joukko laskentasääntöjä (laskentasäännöt), jotka ratkaisevat esimerkiksi, miten tehtävän suunniteltua alkua ja rajoitteita käsitellään. Lisätietoja: [Laskentaprofiilit ja laskentasäännöt](docs://uitleg-rekenprofielen). Sovelluksessa on kolme sisäänrakennettua profiilia: *Primavera P6*, *Microsoft Project* ja *Open Planner Studio*. `.xer`-tiedosto avataan profiililla *Primavera P6* ja `.mpp`-tiedosto profiililla *Microsoft Project*. CSV, MS Project XML ja Primavera P6 XML avautuvat profiililla *Open Planner Studio*. Projektin laskentaprofiili löytyy valikosta *Tiedosto › Projektin asetukset* kohdasta *Laskentaprofiili ja laskentavaihtoehdot*. Sovelluksen oma IFC-tiedosto säilyttää profiilinsa.

### Milloin sovellus vertaa

Avattaessa sovellus kirjaa, mitä tiedosto ilmoitti, ja vertaa sitä omaan tulokseensa. Vertailu tehdään seuraaville:

- Primavera-tiedosto (`.xer`) ja Primavera P6 XML;
- MS Project XML ja MS Project -tiedostot (`.mpp`);
- IFC-tiedosto muusta ohjelmasta, niiden tehtävien osalta, joiden varhaisimmat alkamispäivät ovat tiedostossa;
- sovelluksen oma IFC-tiedosto, joka on muistanut alkuperänsä. Alla kerrotaan, milloin näin on.

Sovellus ei vertaa koskaan CSV-tiedostoa, koska CSV:n aloituspäivä on syötettä eikä laskennan tulos. Sovelluksen oma IFC-tiedosto, jolla ei ole muistettua alkuperää, ei myöskään tule vertailtavaksi.

Jos yksikään tehtävä ei poikkea, mitään ei huomata. Jos vähintään yksi tehtävä poikkeaa tiedostosta, jota tuodaan juuri nyt, sovellus kytkee näkymän heti päälle.

Primavera-tiedoston kohdalla sovellus laskee laskentaprofiililla *Primavera P6*. Se pitää tiedoston suunnitellun alkamispäivän varhaisimpana alkamispäivänä. Tehtävä, joka on tiedostossa myöhemmin kuin riippuvuudet vaativat mutta on siellä myös suunniteltu, pysyy siksi paikallaan. Silloin ei ole eroa.

### Mitä näkyy

Valintanauhan alla on ilmoitusrivi: *Päivämäärät näytetään sellaisina kuin ne ovat tiedostossa. Kun lasketaan uudelleen, 4 tehtävää siirtyisi.* Primavera-lähteen kanssa (`.xer` tai Primavera P6 XML) teksti on *Aikataulu näytetään sellaisena kuin Primavera sen tallensi. Kun lasketaan uudelleen, 1 tehtävä siirtyisi.* Ilmoitusrivin oikealla puolella on painike *Laske uudelleen*. Ilmoitusrivillä ei ole rastia.

Lisäksi näkyy viesti: *12 tehtävää näyttää päivämäärät sellaisina kuin ne ovat tiedostossa (ei laskettuina uudelleen).* Vain `.xer`-tiedostolla viesti kuuluu: *12 tehtävää näyttää päivämäärät sellaisina kuin Primavera ne tallensi (ei laskettuina uudelleen).* Tämä luku laskee kaikki tehtävät, joille tiedosto tallensi päivämäärät, myös ne tehtävät, jotka eivät poikkea. Niiden tehtävien määrä, jotka poikkeavat uudelleenlaskennan jälkeen, näkyy ilmoitusrivillä. Jokainen tehtävä, jolle tiedosto tallensi päivämäärät, näyttää paneelissa *Ominaisuudet*, suoraan kentän *Alku* yläpuolella, oranssin merkin: *Näkyvissä ovat Primaveran tallentamat päivämäärät, ei sovelluksen laskenta.* Muilla lähteillä lukee *Näkyvissä ovat tiedostossa olleet päivämäärät, ei sovelluksen laskenta.* Merkin toinen rivi kertoo, mitä tälle tehtävälle tapahtuu, kun lasketaan uudelleen: *Kun lasketaan uudelleen, tämä tehtävä muuttuu.* tai *Kun lasketaan uudelleen, tämä tehtävä pysyy samana.* Gantt-kaavio, tehtävätaulukko ja tilarivi näyttävät tiedoston päivämäärät.

### Tehtävät, jotka ovat alkaneet tai valmistuneet

Tehtävä, joka on päättynyt, on niinä päivinä, joina se todella tapahtui: toteutuneesta alkamispäivästä toteutuneeseen valmistumispäivään. Käynnissä oleva tehtävä alkaa päivänä, jona se todella alkoi. Se päättyy laskettuun loppupäivään. Tämä pätee tässä näkymässä, laskennan jälkeen ja kaikilla laskentaprofiileilla, samoin kuin Primaverassa ja Microsoft Project -ohjelmassa.

Tälle tehtävälle tiedosto kirjaa usein muita varhaisia päivämääriä. Primavera asettaa käynnissä olevan tai päättyneen tehtävän varhaisimman alkamispäivän raportointipäivälle. Nämä päivämäärät näkyvät sarakkeissa *Varhaisin alkamispäivä* ja *Varhaisin valmistumispäivä*, ei sarakkeissa *Alku* ja *Loppu*. Päättynyt tehtävä ei siksi koskaan lasketa eroksi. Käynnissä oleva tehtävä lasketaan eroksi vain silloin, kun sen loppu poikkeaa.

Tehtävän alkua ei voi enää kirjoittaa, kun tehtävä on alkanut. Tehtävätaulukossa, paneelissa *Ominaisuudet* ja kohdassa *Muokkaa tehtävää* alku on silloin vain luku. Päättyneen tehtävän osalta tämä koskee tehtävätaulukossa myös loppua. Muuta sen sijaan kenttiä *Toteutunut alkamispäivä* tai *Toteutunut valmistumispäivä* edistymisen kautta. Gantt-kaaviossa tällaisen tehtävän palkki ei siirry. Silloin näkyy viesti.

### Mikä jää tyhjäksi tässä näkymässä

Tässä näkymässä sovellus ei laske mitään. Se näyttää vain sen, minkä tiedosto tallensi. Pelivara ja kriittinen polku näkyvät siis vain, jos tiedosto sisältää ne. Jos tiedosto ei tallenna kriittisiä tehtäviä, tilarivillä lukee 0 kriittistä tehtävää. Se ei kerro mitään pakettiin itseensä tallennetusta kriittisestä polusta. Se, mikä syntyy vain laskennasta, ei ole olemassa tässä näkymässä: mitkä riippuvuudet ohjaavat aikataulua, rikotut rajoitteet, tehtävät, jotka ovat väärässä järjestyksessä, ja lähes kriittiset tehtävät.

Jos tiedosto ei tallenna kaikkea tälle tehtävälle, paneeliin *Ominaisuudet* tulee oranssin merkin kolmas rivi. Esimerkiksi: *Primavera ei tallentanut tälle tehtävälle kaikkea. Puuttuu: Vapaa pelivara.* Muilla lähteillä lukee *Tiedosto ei sisällä tälle tehtävälle kaikkea.* Kaksi ensimmäistä riviä pysyvät. Näin nähdään myös tällaisesta tehtävästä, että päivämäärät tulevat tiedostosta, ja sen, muuttuuko tehtävä, kun lasketaan uudelleen. Puuttuvat arvot ovat samoilla nimillä kuin tehtävätaulukon sarakkeet. CSV-viennissä sarakkeet *Kriittinen* ja *Kokonaispelivara* jäävät tällaiselle tehtävälle tyhjiksi keksityn nollan sijaan.

### Näkymästä poistuminen

Näkymästä poistutaan kahdella tavalla:

- Valitse ilmoitusrivillä *Laske uudelleen*, tai valitse *Laske* (F5). Sovellus laskee omilla säännöillään.
- Tehdään muutos, joka voi muuttaa päivämääriä, esimerkiksi tehtävän keston muuttaminen tai uuden tehtävän lisääminen. Sovellus poistuu näkymästä ja laskee heti uudelleen, vaikka *Laske automaattisesti* on pois päältä. Nimen, kuvauksen, työlajin tai tehtävätyypin muuttaminen ei tee sitä: näkymä jää päälle.

Resurssikirjastosta tuleva kalenterin muutos pitää näkymän päällä ja tiedoston päivämäärät ennallaan, mutta päivittää ilmoitusrivin luvun.

Poistumisen jälkeen ei ole painiketta, jolla palataan näkymään. Ctrl+Z palauttaa sen kuitenkin heti uudelleenlaskennan tai tällaisen muokkauksen jälkeen. Muuten lähdetiedoston voi avata uudelleen. Myös `.xer`-tiedoston kohdalla IFC-tiedoston avaaminen kytkee näkymän taas päälle, jos IFC-tiedosto on tallennettu uudelleenlaskennan jälkeen eikä sitä ole muokattu.

### Palautus kaatumisen jälkeen

Jos projekti palautetaan kaatumisen jälkeen, kun se oli näkymässä, näkymä jää päälle. Jos näkymä ei ollut päällä, sovellus unohtaa tiedoston päivämäärät. Aktiivinen projekti näyttää saman ilmoitusrivin kuin ennen. Projekti toisessa välilehdessä näyttää ilmoitusrivin ilman lukua: *Päivämäärät näytetään sellaisina kuin ne ovat tiedostossa. Tehtäviä ei ole laskettu uudelleen.* Lisätietoja: [Palautus kaatumisen jälkeen](docs://howto-herstellen-na-een-crash).

### Tallentaminen ja uudelleen avaaminen

Jos tallennetaan näkymässä ollessa, sovellus kirjoittaa näkyvät päivämäärät IFC-tiedostoon yhdessä lähdemuodon kanssa. Jos tämä IFC-tiedosto avataan myöhemmin uudelleen, näkymä on taas päällä, ilman uutta viestiä. Tämä pätee myös, jos näkymässä on muutettu jotakin, mikä ei vaikuta päivämääriin, esimerkiksi nimeä. Sovellus avaa tiedoston siinä tilassa, jossa se jätettiin.

Jos tallennetaan sen jälkeen, kun näkymästä on poistuttu laskemalla uudelleen tai muokkauksella, joka voi muuttaa päivämääriä, tiedostossa on sovelluksen oma laskenta. Uudelleen avattaessa näkyy tämä laskenta ilman ilmoitusriviä ja ilman merkkiä paneelissa *Ominaisuudet*. Yksi poikkeus on `.xer`-tiedosto, jota on vain laskettu uudelleen eikä muokattu (katso yllä). Muokattu aikataulu on nyt se aikataulu, eikä lähdepaketin vanhoja päivämääriä enää kuulu siihen. Jos ne halutaan vielä nähdä, avataan lähdetiedosto uudelleen.

## Esimerkki: lisärakennus

Oletetaan, että avataan Primavera-tiedosto *Uitbouw* (lisärakennus), jossa on kaksi tehtävää ja kalenteri ilman vapaapäiviä. Vuonna 2027 6. toukokuuta on helatorstai ja 17. toukokuuta helluntaimaanantai. Kun kalenterissa on vapaapäiviä, päivämäärät tulevat eri tavalla. *Fundering storten* (perustuksen valu) kestää 5 työpäivää, *Metselwerk* (muuraus) 10 työpäivää, ja Metselwerk seuraa tehtävää Fundering lopusta alkuun -riippuvuudella. Tiedostoon on tallennettu, että Fundering kulkee maanantaista 3. toukokuuta perjantaihin 7. toukokuuta 2027, ja Metselwerk maanantaista 17. toukokuuta perjantaihin 28. toukokuuta 2027. Tämä on viikko sen varhaisimman alkamispäivän jälkeen, jonka riippuvuus sallii. Metselwerkin suunniteltu alkamispäivä tiedostossa on maanantai 10. toukokuuta 2027.

Heti avaamisen jälkeen näkyvät tiedoston päivämäärät. Tilarivillä lukee *Loppu: 28-05-2027* ja *Kriittinen polku: 2 tehtävää, 20 työpäivää*. Ilmoitusrivi kertoo, että uudelleenlaskennassa 1 tehtävä poikkeaisi, ja molemmat tehtävät näyttävät oranssin merkin *Näkyvissä ovat Primaveran tallentamat päivämäärät, ei sovelluksen laskenta.* Sen alla Metselwerk kertoo *Kun lasketaan uudelleen, tämä tehtävä muuttuu.* ja Fundering kertoo *Kun lasketaan uudelleen, tämä tehtävä pysyy samana.*

Kun valitaan *Laske uudelleen*, Fundering pysyy 3.–7. toukokuuta. Metselwerk alkaa nyt maanantaina 10. toukokuuta, seuraavana työpäivänä sen jälkeen, kun Fundering päättyy, ja päättyy perjantaina 21. toukokuuta. Aikataulu päättyy 21. toukokuuta 2027 ja kestää 15 työpäivää 20 sijasta. Kriittinen polku koostuu samoista 2 tehtävästä.

Entä jos tilanne on toinen?

- Jos Metselwerk on tiedostossa suunniteltu myös maanantaille 17. toukokuuta, laskentaprofiili *Primavera P6* säilyttää sen alun. Laskenta antaa tulokseksi 17.–28. toukokuuta, eroa ei ole, eikä näkymä kytkeydy päälle.
- Lisätään tehtävä näkymässä: tapahtuu sama uudelleenlaskenta. Metselwerk siirtyy 10.–21. toukokuuta.
- Tallennetaan näkymässä ja avataan IFC-tiedosto uudelleen ilman muokkausta: Metselwerk on taas 17.–28. toukokuuta.
- Lasketaan uudelleen, tallennetaan ilman lisämuokkausta ja avataan IFC-tiedosto uudelleen: näkymä on taas päällä ja Metselwerk on 17.–28. toukokuuta.
- Muutetaan näkymässä vain nimeä tehtävästä Metselwerk, tallennetaan ja avataan uudelleen: näkymä on taas päällä ja Metselwerk on 17.–28. toukokuuta.
- Lisätään tehtävä näkymässä, tallennetaan ja avataan uudelleen: sovellus unohtaa tiedoston päivämäärät. Metselwerk on 10.–21. toukokuuta, ilman ilmoitusriviä ja ilman merkkiä.
- Fundering on tiedostossa jo päättynyt: sen toteutunut alkamispäivä on 3. toukokuuta ja toteutunut valmistumispäivä 7. toukokuuta. Tiedosto kirjaa raportointipäivän sen varhaisimmaksi alkamispäiväksi. Fundering-palkki on edelleen 3.–7. toukokuuta, sekä näkymässä että uudelleenlaskennan jälkeen. Fundering ei lasketa eroksi.

## Seuraukset ja väärinkäsitykset

**Ero ei ole tuontivirhe.** Sovellus laskee omilla säännöillään: `.xer`-tiedostolla laskentaprofiilin *Primavera P6* mukaan, `.mpp`-tiedostolla profiilin *Microsoft Project* mukaan ja CSV-, MS Project XML- sekä Primavera P6 XML -tiedostoilla profiilin *Open Planner Studio* mukaan. Miksi lähdepaketin päivämäärät tulivat eri tavalla, voi johtua tiedostosta tai paketista. Näkymä näyttää, *että* ne eroavat.

**Näkymä ei ole laskennan tulos.** Sovellus ei laskenut päivämääriä. Niitä ei oteta sellaisenaan oman aikataulun tuloksena.

**Tallentaminen näkymässä säilyttää lähdepaketin päivämäärät.** IFC-tiedostoon tallentuu silloin se, mitä lähdepaketti ilmoitti, ei se, mitä sovellus laskisi.

**Muokkauksen jälkeen, joka voi muuttaa päivämääriä, tiedoston päivämäärät eivät palaa.** Jos näkymästä poistuttiin tällaisella muokkauksella, tallentamisen ja uudelleen avaamisen jälkeen näkyy vain sovelluksen oma laskenta. Nimen muuttaminen ei laske tällaiseksi muokkaukseksi: näkymä jää silloin päälle (katso *Tallentaminen ja uudelleen avaaminen*). Avataan lähdetiedosto uudelleen, jos halutaan nähdä lähdepaketin päivämäärät.

## Katso myös

- [Tiedostot ja muodot](docs://uitleg-bestanden): mitä sovellus säilyttää tiedostossa ja mitä tuonti tai vienti kuljettaa.
- [Primavera P6 -tiedoston avaaminen (.xer)](docs://howto-xer-openen): vaiheet ja viestit `.xer`-tiedostolle.
- [MS Project -tiedoston avaaminen (.mpp)](docs://howto-mpp-openen): vaiheet ja viestit `.mpp`-tiedostolle.
- [Palautus kaatumisen jälkeen](docs://howto-herstellen-na-een-crash): mitä tälle projektille tapahtuu kaatumisen jälkeen.
- [Kriittinen polku ja pelivara](docs://uitleg-kritiek-pad): miten sovellus laskee pelivaran ja kriittisyyden silloin, kun se laskee.

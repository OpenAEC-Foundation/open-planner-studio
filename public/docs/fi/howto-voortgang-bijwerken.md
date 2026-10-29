# Edistymisen päivittäminen

Tavoite: vie työn todellinen tila aikatauluun ja laske aikataulu uudelleen: mitkä tehtävät ovat valmiita, mitkä käynnissä ja kuinka paljon työtä on vielä jäljellä., mitkä ovat käynnissä ja kuinka paljon työtä on vielä jäljellä.

## Milloin tätä tarvitaan

Edistyminen päivitetään tiettyinä hetkinä, esimerkiksi joka perjantai, kun työnjohtaja kertoo tilanteen. Aikataulu näkee näin, mitä todella on tapahtunut. Se laskee jäljellä olevan työn raportointipäivästä alkaen. Miksi sovellus toimii näin, selitetään kohdassa [Edistyminen, raportointipäivä ja perustaso](docs://uitleg-voortgang).

## Vaiheet

### 1. Aseta raportointipäivä

Raportointipäivä on päivä, jolloin edistyminen tarkistetaan. Raportointipäivä asetetaan ennen edistymisen syöttämistä.

1. Siirry kohtaan *Aikataulu › Perustasot ja edistyminen › Raportointipäivä*.
2. Kirjoita päivämäärä kolmeen ruutuun: päivä, kuukausi ja vuosi, samassa järjestyksessä kuin omassa päivämäärämerkinnässä, esimerkiksi 28, 06 ja 2027. Paina Enter. Sovellus siirtyy seuraavaan ruutuun itsestään.
3. Onko projektikalenterissa työajan lohkoja (kohta *Työajat* ikkunassa *Kalenterit*)? Silloin sovellus laskee tunneissa, ja oikealle ilmestyy aikakenttä, esimerkiksi 17:00. Kirjoita toinen aika, esimerkiksi 12:00, ja paina Enter. Jos aikakenttä tyhjennetään, jää jäljelle vain päivämäärä. Jos vain päivämäärää muutetaan, aika pysyy ennallaan. Aika noudattaa käytettyä aikamerkintää (24 tai 12 tuntia). Ilman työajan lohkoja sovellus laskee kokonaisina päivinä. Silloin aikakenttää ei ole, ja raportointipäivän rivi on päivän alussa.
4. Tyhjennä raportointipäivä painamalla kentän vieressä olevaa pientä ristiä.

Jos edistyminen tarkistetaan perjantaina työajan jälkeen, aseta raportointipäiväksi seuraava työpäivä, maanantai. Sovellus suunnittelee jäljellä olevan työn raportointipäivän alusta alkaen.

Jos edistyminen syötetään, kun raportointipäivää ei ole vielä asetettu, sovellus asettaa sen tähän päivään ja näyttää viestin: *Raportointipäivä asetettu tähän päivään (…).* Tämä kannattaa tehdä itse ensin.

### 2. Syötä edistyminen

Valitse tilanteeseen sopiva tapa. Kaikki tavat antavat saman tuloksen.

**Yksi tehtävä ominaisuuspaneelissa.** Hyödyllinen, kun päivitetään yksi tehtävä.

1. Napsauta tehtävää. Jos paneeli *Ominaisuudet* ei näy, ota se käyttöön kohdasta *Näkymä › Paneelit › Ominaisuudet*.
2. Vedä liukusäädintä *Edistyminen (%)* siihen prosenttiin, joka on tehty.
3. Täytä tarvittaessa kentät *Toteutunut alkamispäivä* ja *Toteutunut valmistumispäivä* samalla tavalla kuin raportointipäivä. Sovellus laskee kentän *Jäljellä* itse. Sitä ei voi muuttaa tässä.

Välitavoitteella on yksi kenttä, *Todellinen päivämäärä*.

**Prosenttiosuuden valitseminen valikosta.** Hyödyllinen nopeaan kirjaamiseen.

1. Napsauta hiiren kakkospainikkeella tehtäväpalkkia Gantt-kaaviossa.
2. Valitse *Edistyminen* ja sen jälkeen 0%, 25%, 50%, 75% tai 100%.

**Useita tehtäviä taulukossa.** Hyödyllinen, kun päivitetään koko luettelo.

1. Napsauta tehtävätaulukon otsikkorivin oikealla puolella olevaa **+**-painiketta (*Lisää sarake*) ja avaa luokka *Edistyminen*. Lisää sarakkeet *Toteutunut alkamispäivä*, *Toteutunut valmistumispäivä*, *Jäljellä* ja *Tila*. Sarake *Edistyminen* on jo välilehdellä *Taulukko*.
2. Kaksoisnapsauta solua, kirjoita arvo ja paina Enter. Prosentin voi kirjoittaa muodossa `50` tai `50%`, päivämäärän muodossa `25-06-2027` ja jäljellä olevan keston muodossa `1`.
3. Kaksoisnapsauta arvoa sarakkeessa *Tila* ja paina Enter. Valitse sitten *Ei aloitettu*, *Käynnissä* tai *Suoritettu*.

Jos jäljellä oleva kesto kirjoitetaan, sovellus laskee prosentin takaisin. Esimerkiksi 2 työpäivän tehtävässä jäljellä oleva kesto 1 antaa edistymiseksi 50%. Jäljellä oleva kesto 0 merkitsee, että tehtävä on suoritettu. Sarake *Toteutunut kesto* (myös luokassa *Edistyminen*) toimii toisinpäin: kirjoitetaan, kuinka paljon työtä on jo tehty, ja sovellus laskee prosenttiosuuden. 4 työpäivän tehtävässä toteutunut kesto 1 antaa 25%. Jos sarakkeessa *Tila* valitaan *Ei aloitettu*, edistymiseksi tulee 0% ja toteutuneet päivämäärät poistuvat.

**Kaikki yhden tehtävän tiedot tehtävän muokkausikkunassa.** Napsauta tehtävää hiiren kakkospainikkeella ja valitse *Muokkaa...*. Myös edistymiskentät ovat siellä. Ne otetaan käyttöön vasta, kun painetaan painiketta *Tallenna*.

**Monta tehtävää kerralla taulukkolaskennasta.** Katso [Edistymisen tuominen taulukkolaskennasta](docs://howto-voortgang-importeren).

### 3. Laske aikataulu uudelleen

Jokainen muutos edistymiseen tai raportointipäivään tekee aikataulusta vanhentuneen. Tilarivi näyttää: *Vanhentunut — laske uudelleen (F5)*. Paina **Laske** (F5), esimerkiksi kohdasta *Aikataulu › Aikataulu › Laske*. Jos *Laske automaattisesti* on päällä (kohdassa *Asetukset › Projekti › Sovelluksen asetukset*, välilehti *Aikataulu*), sovellus tekee tämän itse.

## Tuloksen tarkistaminen

- Raportointipäivällä Gantt-kaaviossa näkyy katkoviiva, jonka päivämäärä on otsikkorivillä. Käynnissä olevien tehtävien kohdalla viiva pullistuu palkin prosenttiosuuteen asti. Ota nämä viivat käyttöön tai pois käytöstä kohdissa *Näkymä › Perustasot ja edistyminen › Edistymisviiva* ja *Raportointipäivän viiva*.
- Palkin suoritettu osa muuttuu harmaaksi, jäljellä oleva osa säilyttää värinsä. Kokonaan suoritettu tehtävä on kokonaan harmaa, nimen edessä on rasti ja siinä ei ole pelivaranauhaa. Vaiheen palkki muuttuu harmaaksi myös johdettuun prosenttiosuuteen asti, joten vaiheittain nähdään, kuinka pitkällä kukin vaihe on. Jos tehtävän edeltäjät tai seuraajat näytetään, niiden palkit säilyttävät korostusvärinsä, myös kun ne on suoritettu.
- Suoritetut tehtävät eivät ole koskaan punaisia: kun raportointipäivä on asetettu, suoritettu tehtävä ei ole kriittinen.
- Vaiheet näyttävät johdetun prosenttiosuuden, ja aikataulun loppu on voinut siirtyä.
- Jos perustaso on tallennettu, kunkin palkin alla näkyy perustason mukainen aikataulu, ja raporttityyppi *Ero* näyttää eron.

## Sudenkuopat ja sovelluksen toiminta

**Päivämäärä raportointipäivän jälkeen.** Sovellus ei hyväksy toteutunutta alkamispäivää tai toteutunutta valmistumispäivää raportointipäivän jälkeen. Paneelissa kenttien alla lukee *Todellisia päivämääriä ei voi asettaa raportointipäivän jälkeen*. Taulukossa solussa näkyy *Todellinen päivämäärä on raportointipäivän jälkeen.* Raportointipäivä asetetaan ensin myöhemmäksi tai päivämäärä korjataan.

**Tehtävä, joka alkaisi vasta raportointipäivän jälkeen.** Jos edistymistä syötetään tehtävälle, jonka aikataulun mukaan ei vielä pitäisi olla alkanut, avautuu ikkuna *Anna toteutunut alkamispäivä*. Ikkuna kysyy, milloin tehtävä todella alkoi. Ehdotettu päivä on raportointipäivä. Kun *Käytä edistymistä* valitaan, päivä tallentuu. Kun *Peruuta* valitaan, mikään ei muutu.

**100% ilman päivämääriä.** Jos tehtävän arvoksi asetetaan 100% ilman toteutunutta valmistumispäivää, toteutuneeksi valmistumispäiväksi tulee raportointipäivä. Tämä pätee, vaikka tehtävä olisi päättynyt aiemmin. Toteutunut valmistumispäivä täytetään itse.

**Prosenttiosuus alle 100%.** Jos suoritetun tehtävän arvoksi muutetaan alle 100%, toteutunut valmistumispäivä poistuu. Jos vain toteutunut valmistumispäivä tyhjennetään, edistymiseksi tulee 0% ja tehtävä jää tilaan *Käynnissä*. Jos tehtävä halutaan taas aloittamattomaksi, tyhjennetään myös toteutunut alkamispäivä tai valitaan taulukossa sarakkeessa *Tila* arvo *Ei aloitettu*.

**Kesto muuttuu kesken olevalla tehtävällä.** Tehty työ pysyy tehtynä ja prosenttiosuus mukautuu. Jos 5 työpäivän tehtävä on 60% tehty ja kestoksi asetetaan 10 työpäivää, edistymiseksi tulee 30%. Sovellus ei hyväksy kestoa, joka on lyhyempi kuin jo tehty työ: *‘Build inner cavity leaf’ on jo 60% tehty: kesto, joka on lyhyempi kuin tehty työ, ei ole mahdollinen. Kestoa ei muutettu.* Taulukossa solussa näkyy *Tämä kesto on lyhyempi kuin jo tehty työ.*

**Jäljellä oleva kesto pyöristetään.** Sovellus pyöristää jäljellä olevan keston kokonaisiin työpäiviin. Kun tehtävän kesto on 2 työpäivää, sekä 50% että 75% antavat jäljellä olevaksi kestoksi 1 työpäivä.

**Vaihe.** Vaiheella ei ole omaa edistymistä. Paneelissa lukee *Johdettu alitehtävistä: muuta edistymistä siellä. Yhteenvetotehtävä päivittyy, kun aikataulu on laskettu (F5).* Taulukossa solussa näkyy *Yhteenvetotehtävän edistyminen johdetaan alitehtävistä, eikä sitä voi muuttaa tässä.*

**Raportointipäivän siirtäminen myöhemmäksi.** Käynnissä olevien tehtävien jäljellä oleva työ alkaa uudesta raportointipäivästä. Työ, joka ei ole vielä alkanut, ei voi sijoittua ennen sitä päivää. Raportointipäivää siirretään siksi vain yhdessä edistymisen päivityksen kanssa. Jos raportointipäivä asetetaan syöttämättä edistymistä, kaikki työ, joka ei ole vielä alkanut, siirtyy sille päivälle (paitsi profiilissa Microsoft Project).

**Virhe.** Yksi Ctrl+Z kumoaa yhden edistymismuutoksen.

## Katso myös

- [Edistyminen, raportointipäivä ja perustaso](docs://uitleg-voortgang): miten sovellus laskee jäljellä olevan työn ja raportointipäivän, esimerkkilaskelman kanssa.
- [Edistymisen tuominen taulukkolaskennasta](docs://howto-voortgang-importeren): edistymisen lukeminen monelle tehtävälle kerralla.
- [Edistymistavan valitseminen](docs://howto-voortgangsmodus-kiezen): mitä sovellus tekee tehtävälle, joka on alkanut, vaikka sen edeltäjä on vielä käynnissä.
- [Perustason tallentaminen ja hallinta](docs://howto-baseline-opslaan-en-beheren): aikataulun tallentaminen perustasoksi, johon edistymistä verrataan.

# Tehtävätyypin valitseminen

Tavoite: aseta jokaiselle tehtävälle, mitä sovellus säätää, kun muutetaan kestoa, kuormitusastetta tai työtä: kestoa, kuormitusastetta tai työtä itseään.

## Milloin tätä tarvitaan

Resursseja on kohdistettu tehtävälle, ja sovelluksen pitää laskea haluttulla tavalla. Esimerkki: nosturi on vuokrattu yhdeksi päiväksi, ja se päivä on kiinteä. Toinen esimerkki: tiedetään, että siinä on 160 tuntia tiilityötä, ja halutaan nähdä, kuinka kauan se kestää kolmella henkilöllä kahden sijaan. Nämä kaksi tilannetta vaativat eri tehtävätyypin.

Tehtävätyyppi päättää, mikä kolmesta suureesta kesto, kuormitusaste ja työ siirtyy mukaan, kun muutetaan jotakin muuta. Taustatiedot ja laskuesimerkit ovat kohdassa [Tehtävätyypit: kesto, kuormitusaste ja työ](docs://uitleg-werkregels).

## Vaiheet

### Tehtävätyypin näyttäminen

Tehtävätyyppi ei näy oletuksena. Kytke se kerran päälle:

1. Valitse *Asetukset › Projekti › Asetukset*, välilehti *Aikataulu*.
2. Otsikon *Laskenta* alla rastita *Tehtävätyypit käyttöön*.
3. Sulje ikkuna painikkeella *Sulje*.

Tämä on sovelluksen asetus, ei projektitiedoston asetus. Jos tiedostossa on jo tehtävätyyppejä tai tallennettua työtä, esimerkiksi MS Project- tai Primavera P6 -tiedosto, sovellus näyttää tehtävätyypin kyseiselle tiedostolle ilman tätä asetustakin. Sama pätee, kun tehtävätyyppi valitaan itse tiedostossa: näyttö pysyy silloin päällä kyseiselle tiedostolle, vaikka asetus kytkettäisiin myöhemmin pois. Näyttö pysyy päällä niin kauan kuin tiedosto on auki, ja tiedoston avaamisen jälkeen niin kauan kuin tiedostossa on tehtävätyyppi tai tallennettua työtä.

### Tehtävätyypin asettaminen tehtävälle

1. Valitse tehtävä. Paneeli *Ominaisuudet* on oikealla. Jos sitä ei näy, kytke se päälle kohdasta *Näkymä › Paneelit › Ominaisuudet*.
2. Kohdassa *Tehtävätyyppi* valitse yksi viidestä vaihtoehdosta: *Projektin oletus (Kiinteä kesto ja kuormitusaste)*, *Kiinteä kesto ja kuormitusaste*, *Kiinteä kesto ja työmäärä*, *Kiinteä työmäärä* tai *Kiinteä yksikkömäärä*. Vaihtoehdolla *Projektin oletus* tehtävä seuraa projektin oletusta.
3. Kiinnostaako, mitä vaihtoehto tekee? Avatussa pudotusvalikossa on jokaisen vaihtoehdon vieressä i-kuvake. Osoita kuvaketta tai napsauta sitä tai napauta sitä, niin selitys näkyy. Kuvakkeen napsauttaminen ei vielä valitse tehtävätyyppiä.
4. Myös suljetun kentän vieressä on i-kuvake. Se selittää tehtävätyypin, joka on nyt voimassa, esimerkiksi *Kesto seuraa työstä ja kuormitusasteesta.* Vaihtoehdolla *Projektin oletus* se on sulkeissa oleva tehtävätyyppi.

*Projektin oletus* on ensimmäinen vaihtoehto ja tehtävän oletusarvo. Sulkeissa oleva tehtävätyyppi on se, joka projektilla on nyt oletuksena. Sovelluksessa ei ole painiketta tämän projektin oletuksen vaihtamiseen: oletus tulee tuonnista (esimerkiksi MS Project- tai Primavera P6 -tiedostosta) tai MCP-yhteydestä. Jos yhdelle tehtävälle halutaan toinen tehtävätyyppi, valitse se tästä.

Tehtävätyypin voi valita myös taulukosta. Napsauta **+** tehtävätaulukon otsikkorivin oikealla puolella (*Lisää sarake*) ja valitse kohdasta *Aikataulu* sarake *Tehtävätyyppi*.

Tehtävässä ilman resurssikohdistusta ei ole mitään, mitä sitoa yhteen, joten tehtävätyyppi ei tee siinä mitään. Kohdista ensin resurssi (katso [Resurssien kohdistaminen käyrällä](docs://howto-resource-toewijzen)).

### Työn näkeminen ja muuttaminen

Tehtävälle, jolla on resurssikohdistuksia, paneelin *Ominaisuudet* osioon *Resurssikohdistukset* tulee sarake *Työ (h)*, *Kuormitusaste*-sarakkeen viereen. Se on kyseisen resurssin jäljellä oleva työ tunteina. Pieni lukko sarakkeen yläpuolella näyttää, mitä tehtävätyyppi pitää kiinteänä: *Kuormitusaste*, kun tehtävätyyppi on *Kiinteä kesto ja kuormitusaste* tai *Kiinteä yksikkömäärä*, ja *Työ (h)*, kun tehtävätyyppi on *Kiinteä kesto ja työmäärä* tai *Kiinteä työmäärä*.

Jos työ halutaan muuttaa käsin, tunnit kirjoitetaan kenttään ja painetaan Enter. Sovellus ei hyväksy arvoa, joka on 0 tai pienempi: kenttä palautuu edelliseen arvoon.

### Mitä tapahtuu

Kun tehtävätyyppi valitaan, mikään luku ei vielä muutu. Kun valittu tehtävätyyppi suojaa työtä, sovellus kiinnittää vain nykyisen työn, joten *Työ (h)* saa tallennetun arvon. Vasta seuraavassa muutoksessa tehtävätyyppi päättää, mikä siirtyy mukaan. Muuta esimerkiksi kenttää *Kuormitusaste* ja katso, mitä tapahtuu keston ja työn kanssa.

Jos tämä muuttaa tehtävän kestoa, tilarivillä lukee *Vanhentunut — laske uudelleen (F5)*. Paina **Laske** (F5), esimerkiksi kohdasta *Aloitus › Aikataulu › Laske*, ja näet uudet päivämäärät. Jos *Laske automaattisesti* on päällä (sama välilehti *Aikataulu*, otsikko *Laskenta*), sovellus tekee tämän itse.

## Mikä tehtävätyyppi sopii

- **Kiinteä kesto ja kuormitusaste** sopii, kun kesto on sovittu ja kuormitusaste on syöte. Työ seuraa näistä kahdesta. Tämä on oletus. Yhdeksi päiväksi vuokrattu nosturi kuuluu tähän: päivä on kiinteä, ja nosturien määrän päättää käyttäjä.
- **Kiinteä kesto ja työmäärä** sopii, kun tehtävä on saatava valmiiksi kiinteässä ajassa ja tunnetaan, kuinka paljon työtä siinä on. Jos kesto muuttuu, sovellus säätää kuormitusastetta.
- **Kiinteä työmäärä** sopii, kun tunnetaan, kuinka monta tuntia työtä siinä on, ja halutaan nähdä, miten kesto muuttuu henkilömäärän mukaan. Tähän kuuluu 160 tunnin tiilityö kolmella henkilöllä kahden sijaan. Harjoitusprojektin rappaus saa tämän tehtävätyypin.
- **Kiinteä yksikkömäärä** sopii, kun kuormitusaste on kiinteä, esimerkiksi yksi nosturi, ja työ päättää keston.

## Ongelmatilanteet ja mitä sovellus silloin tekee

**Kenttä *Tehtävätyyppi* puuttuu.** Silloin asetus *Tehtävätyypit käyttöön* on pois päältä ja tiedostossa ei vielä ole tehtävätyyppejä, tai on valittu välitavoite, vaihe, riippumatto tai tehtävä, jonka kestotyyppi on *kulunut aika*. Siinä ei ole tehtävätyyppiä. Valitse tavallinen tehtävä.

**Kesto muuttuu, vaikka sitä ei muutettu.** Kun tehtävätyyppi on *Kiinteä työmäärä* tai *Kiinteä yksikkömäärä*, kesto seuraa kuormitusastetta ja työtä. Jos jotakin näistä tai resurssien määrää muutetaan, sovellus säätää keston ja pyöristää sen ylöspäin kokonaisiin työpäiviin. Tehtävälle, jonka kesto on tunteina, sovellus pyöristää ylöspäin kokonaisiin minuutteihin.

**Työ ei täsmää tarkasti kuormitusasteen × keston kanssa.** Pyöristys voi aiheuttaa sen. Kentän *Työ (h)* viereen ilmestyy silloin varoitusmerkki *Poikkeaa kuormitusasteesta × kestosta*. Histogrammi seuraa tallennettua työtä.

**Materiaali ei lasketa mukaan.** Materiaaliresurssille *Työ (h)* näyttää viivan. Materiaali ei koskaan vaikuta kestoon.

**Tehtävä, jolla on edistymistä.** Tehtävätyyppi koskee jäljellä olevaa työtä. Siksi *Työ (h)* näyttää vain sen, mikä vielä on tehtävä.

**Kumoaminen.** Tehtävätyypin valinta ja jokainen muutos, jonka tehtävätyyppi laskee, kumoutuvat yhdellä kerralla komennolla *Kumoa* (Ctrl+Z). Tehtävätyyppi on silloin taas poissa, mutta kenttä *Tehtävätyyppi* pysyy näkyvissä.

## Katso myös

- [Tehtävätyypit: kesto, kuormitusaste ja työ](docs://uitleg-werkregels): miten sovellus sitoo keston, kuormitusasteen ja työn yhteen, laskuesimerkkeineen.
- [Resurssien kohdistaminen käyrällä](docs://howto-resource-toewijzen): resurssin asettaminen tehtävälle.

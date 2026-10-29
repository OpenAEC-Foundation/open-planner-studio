# Tehtävätyypit: kesto, kuormitusaste ja työ

Rappaukseen varataan yksi rappaaja, ja tehtävä kestää neljä päivää. Jos rappaajia on kaksi, työ voidaan tehdä kahdessa päivässä. Kesto voi myös pysyä neljässä päivässä, jolloin työtä on kaksi kertaa enemmän. Molemmat ovat järkeviä. Se, kumpi näistä sovellus valitsee, riippuu tehtävän **tehtävätyypistä**. Tässä artikkelissa kerrotaan, miten sovellus yhdistää keston, kuormitusasteen ja työn, ja mitä kukin tehtävätyyppi pitää vakiona.

## Käsite

Kolme suuretta on sidottu toisiinsa:

- **Kesto**: kuinka kauan tehtävä kestää, työpäivinä tai tunteina.
- **Kuormitusaste**: kuinka paljon resurssi työskentelee tehtävässä työpäivää kohden. *Ominaisuudet* -paneelissa tämän nimi on *Kuormitusaste*, muissa ikkunoissa *Kuormitusaste/pv*. Kuormitusaste 1 tarkoittaa yhtä rappaajaa koko päivän, 2 tarkoittaa kahta ja 0,5 tarkoittaa puolta päivää.
- **Työ**: kokonaistyötuntien määrä, jonka resurssi käyttää tehtävään.

Summa on: työ = kesto × kuormitusaste × tuntia työpäivässä. Tuntia työpäivässä tulee tehtävän kalenterista. Neljän työpäivän rappaus yhdellä rappaajalla on 8 tunnin työpäivällä 4 × 1 × 8 = 32 tuntia työtä.

Kun jotakin näistä kolmesta muutetaan, ainakin yhden muun on liikuttava mukana. Muuten summa ei enää täsmää. Tehtävätyyppi päättää, mikä muuttuu. Tehtävätyyppi asetetaan tehtäväkohtaisesti *Ominaisuudet* -paneelissa. Sovellus näyttää tehtävätyypin ja työn vasta, kun ne on otettu käyttöön. Miten se toimii, kerrotaan kohdassa [Tehtävätyypin valitseminen](docs://howto-werkregel-kiezen).

Tehtävätyyppi toimii vain tavallisissa tehtävissä. Välitavoitteilla, vaiheilla (yhteenvetotehtävillä), riippumatoilla ja tehtävillä, joiden *Kestotyyppi* on *Kulunut aika*, sitä ei ole: *Tehtävätyyppi* -kenttää ei näy. Myöskään materiaalit, kuten betoni tai rappauslaasti, eivät kuulu tehtävätyyppiin. Materiaalin määrä ei ohjaa koskaan kestoa, eikä sovellus muuta sitä tehtävätyypin takia.

## Näin sovellus laskee

### Tehtävätyyppi toimii sen mukaan, mitä muutat

Sovellus laskee kestoa, kuormitusastetta ja työtä uudelleen vain silloin, kun jotakin niistä muutetaan: tehtävän kestoa, resurssikohdistuksen kuormitusastetta, työtä, resurssin lisäämistä tai poistamista tai kalenterin tuntia päivässä. **Laske** (F5) ei muuta niistä yhtäkään: F5 laskee vain päivämäärät. Tehtävätyypin valitseminen ei muuta yhtäkään lukua. Tehtävätyyppi otetaan huomioon seuraavassa muutoksessa.

Jos tehtävätyyppi muuttaa tehtävän kestoa, aikataulu ei ole enää ajan tasalla. Tilarivi näyttää silloin tekstin *Vanhentunut — laske uudelleen (F5)*, ellei *Laske automaattisesti* ole päällä.

### Neljä tehtävätyyppiä

*Ominaisuudet* -paneelissa on *Tehtävätyyppi* -pudotusvalikon vieressä i-kuvake. Osoita sitä, napsauta tai napauta sitä. Sovellus selittää silloin tehtävätyypin, joka nyt on voimassa. Avatussa pudotusvalikossa jokaisella vaihtoehdolla on myös sellainen i-kuvake. Selitys alkaa lihavoidulla lauseella. Neljä tehtävätyyppiä, kukin sovelluksen lauseella:

- **Kiinteä kesto ja kuormitusaste** (*Työ seuraa kestosta ja kuormitusasteesta.*). Tämä on oletus. Sovellus ei muuta itse kestoa, ja työ seuraa kestoa ja kuormitusastetta. Jos työ kirjoitetaan itse, sovellus säätää kuormitusastetta, koska kesto on kiinteä.
- **Kiinteä kesto ja työmäärä** (*Kuormitusaste seuraa kestosta ja työstä.*). Sovellus ei muuta itse kestoa. Jos kestoa muutetaan, työ pysyy ja kuormitusaste sopeutuu.
- **Kiinteä työmäärä** (*Kesto seuraa työstä ja kuormitusasteesta.*). Työ on kiinteä, ja kesto seuraa työstä ja kuormitusasteesta.
- **Kiinteä yksikkömäärä** (*Kesto seuraa työstä ja kuormitusasteesta.*). Kuormitusaste on kiinteä, ja kesto seuraa työstä.

Kahdessa tehtävätyypissä sovellus ei muuta kestoa. Kahdella muulla kesto liikkuu mukana, kun muutetaan kuormitusastetta, työtä tai resurssien määrää. Yhden resurssin kohdalla Kiinteä työmäärä ja Kiinteä yksikkömäärä tekevät saman. Ne eroavat, kun kestoa muutetaan itse: Kiinteällä työmäärällä työ pysyy ja kuormitusaste sopeutuu, Kiinteällä yksikkömäärällä kuormitusaste pysyy ja työ kasvaa mukana. Ne eroavat myös, kun tehtävällä on enemmän resursseja (katso jäljempänä).

Esimerkit alla näyttävät, mitä kukin tehtävätyyppi tekee.

### Pyöristys

Sovellus pyöristää summasta saadun keston ylöspäin. Tehtävän kesto pyöristetään kokonaisiin työpäiviin, jos se on päivissä, ja kokonaisiin minuutteihin, jos se on tunneissa. Työ ja kuormitusaste pysyvät sellaisina kuin ne syötettiin tai kuten sovellus ne laski summasta. Siksi summa ei joskus täsmää tarkasti. Alla oleva esimerkki näyttää, mitä silloin tapahtuu.

### Useita resursseja

Jos tehtävällä on useita resursseja, pätee kaksi sopimusta. Kiinteällä kestolla ja työmäärällä, Kiinteällä työmäärällä ja Kiinteällä yksikkömäärällä kokonaistyö pysyy samana, kun resurssi lisätään tai poistetaan. Sovellus jakaa sen silloin kuormitusasteiden suhteessa. Kiinteällä kestolla ja kuormitusasteella uusi resurssi tuo oman työnsä. Kiinteällä työmäärällä ja Kiinteällä yksikkömäärällä hitain resurssi päättää keston: resurssikohtaisesti työ jaetaan kuormitusasteella, ja suurin tulos ratkaisee.

Esimerkki: kahdella resurssilla on kummallakin 32 tuntia työtä ja kuormitusaste 1, yhteensä 4 työpäivää. Ensimmäisen kuormitusasteeksi asetetaan 0,5. Kesto on silloin 8 työpäivää. Kiinteällä työmäärällä toinen resurssi säilyttää 32 tuntia työtä, ja sen kuormitusaste laskee arvoon 0,5. Kiinteällä yksikkömäärällä toinen pitää kuormitusasteensa 1:ssä, ja sen työ kasvaa 64 tuntiin.

### Edistyminen

Jos tehtävässä on jo edistymistä, tehtävätyyppi vaikuttaa jäljellä olevaan osaan: jäljellä olevaan kestoon ja jäljellä olevaan työhön. *Ominaisuudet* -paneelissa tämä työ on sarakkeessa *Työ (h)*. Tehty työ säilyy.

### Tuntitehtävät

Tuntitehtävä lasketaan samoin, mutta minuuteissa. Jos vain crane on 5 tunnin tehtävässä, työtä on 5 tuntia. Kiinteällä työmäärällä kesto kuormitusasteella 2 on silloin 2,5 tuntia. Harjoitusprojektin hollow-core floor -tehtävässä on myös carpentry crew. Se tarvitsee edelleen 5 tuntia työtä, on hitain, ja kesto pysyy siksi 5 tunnissa. Miten tunnit ja päivät liittyvät toisiinsa, kerrotaan kohdassa [Päivät ja tunnit](docs://uitleg-dagen-en-uren).

## Esimerkki: rappaus

Esimerkki on opetusohjelmien harjoitusprojekti *House extension*. Opetusohjelmassa 5 tämä lasketaan itse ja luvut tarkistetaan. Tässä kerrotaan, mitä kukin tehtävätyyppi tekee.

Rappaus kestää 4 työpäivää. Siihen on varattu yksi rappaaja, kuormitusasteella 1, ja työpäivä on 8 tuntia. Työtä on siis 32 tuntia.

### Kiinteä kesto ja kuormitusaste

- Tee kesto 6 työpäiväksi: työ kasvaa 48 tuntiin, kuormitusaste pysyy 1:ssä.
- Aseta kuormitusaste 2:ksi: kesto pysyy 4 työpäivässä, työ on 64 tuntia.
- Kirjoita *Työ (h)* -kenttään 48 tuntia: kesto pysyy 4 työpäivässä, kuormitusaste muuttuu arvoon 1,5.
- Kohdista toinen resurssi, esimerkiksi *Plasterer 2*, kuormitusasteella 1: kesto pysyy 4 työpäivässä, ja toinen resurssi tuo 32 tuntia työtä, yhteensä 64 tuntia.

### Kiinteä kesto ja työmäärä

- Tee kesto 6 työpäiväksi: työ pysyy 32 tuntina, kuormitusaste laskee arvoon 0,67.
- Aseta kuormitusaste 2:ksi: kesto pysyy 4 työpäivässä. Koska kesto on kiinteä, työ kasvaa 64 tuntiin.
- Kirjoita *Työ (h)* -kenttään 16 tuntia: kesto pysyy 4 työpäivässä, kuormitusaste on 0,5.
- Kohdista toinen resurssi, esimerkiksi *Plasterer 2*, kuormitusasteella 1: 32 tuntia jaetaan, 16 tuntia kummallekin, ja kuormitusaste on kummallakin 0,5. Kesto pysyy 4 työpäivässä.

### Kiinteä työmäärä

- Tee kesto 6 työpäiväksi: työ pysyy 32 tuntina, kuormitusaste laskee arvoon 0,67.
- Aseta kuormitusaste 2:ksi: työ pysyy 32 tuntina ja kesto on 2 työpäivää. Tämä askel tehdään opetusohjelmassa 5.
- Kirjoita *Työ (h)* -kenttään 48 tuntia: kuormitusaste pysyy 1:ssä ja kesto on 6 työpäivää.
- Kohdista toinen resurssi, esimerkiksi *Plasterer 2*, kuormitusasteella 1: 32 tuntia jaetaan, 16 tuntia kummallekin, ja kesto on 2 työpäivää. Poista toinen resurssi uudelleen, niin kesto on taas 4 työpäivää.

### Kiinteä yksikkömäärä

- Tee kesto 6 työpäiväksi: kuormitusaste pysyy 1:ssä, työ kasvaa 48 tuntiin.
- Aseta kuormitusaste 2:ksi: työ pysyy 32 tuntina ja kesto on 2 työpäivää.
- Kirjoita *Työ (h)* -kenttään 48 tuntia: kuormitusaste pysyy 1:ssä ja kesto on 6 työpäivää.
- Kohdista toinen resurssi, esimerkiksi *Plasterer 2*, kuormitusasteella 1: 32 tuntia jaetaan, 16 tuntia kummallekin, ja kesto on 2 työpäivää.

### Kun summa ei täsmää

Kiinteällä työmäärällä kuormitusasteeksi asetetaan 3. Työ on 32 tuntia, joten kesto on 32 ÷ (3 × 8) = 1,33 työpäivää. Sovellus pyöristää sen ylöspäin 2 työpäivään. Työ (32 tuntia) ja kuormitusaste (3) pysyvät, mutta 2 × 3 × 8 on 48 tuntia. Histogrammi jakaa siis 32 tuntia 2 työpäivän yli: 2 kuormitusastetta päivässä, ei 3. *Työ (h)* -kentän viereen ilmestyy varoitusmerkki, jonka teksti on *Poikkeaa kuormitusasteesta × kestosta*. Se kertoo tästä.

Kahdella resurssilla, joilla on eri kuormitusasteet, toimii sama tapa. Kun kiinteä työmäärä on päällä ja rappaajan kuormitusaste on 1, lisätään toinen resurssi, esimerkiksi *Plasterer 2*, kuormitusasteella 2. Sovellus jakaa 32 tuntia suhteessa 1 : 2, eli 10,7 ja 21,3 tuntia. Molemmat tarvitsevat silloin 1,33 työpäivää, ja kesto on 2 työpäivää.

Tiedosto P6:sta tai MS Project -ohjelmasta voi myös sisältää arvon *Työ (jäljellä)*, joka ei ole yhtä suuri kuin kuormitusaste × jäljellä oleva kesto. Silloin näkyy sama varoitusmerkki. Sovellus ei muuta tätä työtä itse. Jos tällaisen tehtävän kestoa muutetaan, sovellus noudattaa tehtävätyyppiä, myös silloin kun jäljellä oleva työ tuli tiedostosta. Tehtävätyypeissä *Kiinteä kesto ja kuormitusaste* ja *Kiinteä yksikkömäärä* jäljellä oleva työ muuttuu arvoon kuormitusaste × uusi jäljellä oleva kesto. Tehtävätyypeissä *Kiinteä kesto ja työmäärä* ja *Kiinteä työmäärä* työ pysyy, ja kuormitusaste sopeutuu. Jos tiedostosta tuleva jäljellä oleva työ katoaa tällä tavoin, saat viestin, jossa on vanha ja uusi tuntimäärä. Ctrl+Z palauttaa vanhan arvon. Varoitusmerkin selitys kertoo tehtäväkohtaisesti, kumpi kahdesta tapahtuu.

### Toinen kalenteri

Kiinteällä työmäärällä kalenterin työpäivä muuttuu 8 tunnista 6 tuntiin. Työ pysyy 32 tuntina, joten kesto on 32 ÷ 6 = 5,33, pyöristettynä ylöspäin 6 työpäiväksi. Miten sovellus laskee työpäivät ja työtunnit, selitetään kohdassa [Kalenterit ja työpäivät](docs://uitleg-kalenders). Sovellus näyttää: *Kalenterimuutoksen jälkeen tehtävätyyppi muutti 1 tehtävän kestoa (työ pysyy, tuntia päivässä muuttui).*

### Tehtävä, jolla on edistymistä

Inner cavity leaf -tehtävä vie 5 työpäivää, ja se on 40% valmis: 2 työpäivää on tehty ja 3 työpäivää (24 tuntia) on jäljellä. Kiinteällä työmäärällä kuormitusaste asetetaan 1:stä 2:een. Jäljellä oleva työ pysyy 24 tuntina, ja jäljellä oleva kesto on 1,5, pyöristettynä ylöspäin 2 työpäiväksi. Tehtävä kestää nyt 2 + 2 = 4 työpäivää, ja edistyminen on 50%. Prosentti liikkuu mukana, koska tehty osa pysyy samana ja jäljelle jäävä osa lyhenee.

## Seuraukset ja väärinkäsitykset

**"Kiinteä työmäärä tarkoittaa, että kesto on kiinteä."** Ei, päinvastoin. Kun tehtävätyyppi on *Kiinteä kesto ja kuormitusaste* tai *Kiinteä kesto ja työmäärä*, kesto on kiinteä. Kun tehtävätyyppi on *Kiinteä työmäärä* tai *Kiinteä yksikkömäärä*, kesto seuraa kahdesta muusta.

**"Jos valitsen tehtävätyypin, aikataulu muuttuu."** Ei. Valinta ei muuta yhtään lukua. Vasta seuraavassa muutoksessa tehtävätyyppi päättää, mikä liikkuu mukana. Kun tehtävätyyppi suojaa työtä, sovellus lukitsee työn valintahetkellä, jotta suojattavaa lukua on. Tällaisella tehtävällä on sen jälkeen tallennettu arvo kentässä *Työ (h)*.

**"Kesto muuttui, vaikka en koskenut siihen."** Näin voi käydä kuormitusasteen, työn, resurssien määrän tai tuntien päivässä muutoksen jälkeen, kun tehtävätyyppi on kiinteä työmäärä tai kiinteä yksikkömäärä. Tilarivi kertoo silloin, että aikataulu on vanhentunut. Paina **Laske** (F5), jolloin uudet päivämäärät näkyvät.

**Ilman resurssikohdistusta tehtävätyyppi ei tee mitään.** Silloin ei ole kuormitusastetta eikä työtä, johon kestoa voidaan sitoa.

**Tiedostot MS Project -ohjelmasta tai Primavera P6:sta näyttävät aina tehtävätyypin.** MS Project -ohjelmasta tuodussa tehtävässä sovellus säilyttää joskus työmäärään perustuvan asetuksen. Tämä tallennettu asetus muuttaa kahta tapausta. Kun *Kiinteä kesto ja työmäärä* on valittu ja tehtävä on työmäärään perustuva, työ liikkuu mukana kuormitusasteen sijaan, kun kestoa muutetaan. Kun *Kiinteä yksikkömäärä* on valittu ja tehtävä ei ole työmäärään perustuva, työ liikkuu mukana, kun resurssi lisätään tai poistetaan, ja kesto pysyy. Sovelluksessa luoduilla tehtävillä ei ole tätä asetusta. I-kuvakkeen takana oleva selitys ottaa tämän asetuksen huomioon.

## Katso myös

- [Tehtävätyypin valitseminen](docs://howto-werkregel-kiezen): vaiheet tehtävän tehtävätyypin asettamiseen.
- [Resurssien kohdistaminen käyrällä](docs://howto-resource-toewijzen): resurssin kohdistaminen tehtävään kuormitusasteen ja jakautumisen kanssa.
- [Päivät ja tunnit](docs://uitleg-dagen-en-uren): miten sovellus muuntaa päivät ja tunnit.
- [Kalenterit ja työpäivät](docs://uitleg-kalenders): miten sovellus laskee työpäivät ja työtunnit.

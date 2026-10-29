# Asettelun luominen ja käyttö

Tavoite: vaihda aikataulun näkymien välillä yhdellä napsautuksella, esimerkiksi vain kriittiset tehtävät, tehtävät työryhmittäin tai toinen lajittelujärjestys.

## Milloin tätä tarvitset

Työmaakokouksessa tilaaja haluaa nähdä vain kriittiset tehtävät. Sen jälkeen työnjohtaja haluaa nähdä työryhmittäin, kuka tarvitaan milloin. Sitten koko aikataulu halutaan takaisin. Suodattimien, ryhmittelyjen ja lajittelujärjestysten asettaminen uudelleen ja uudelleen on työlästä. **Asettelu** tallentaa tällaisen näkymän painikkeeksi valintanauhaan.

Asettelu voi tallentaa kuusi asiaa: suodattimen, ryhmittelyn, lajittelun, tehtävätaulukon sarakkeet Gantt-kaavion vieressä, aikaskaalan sekä riippuvuusviivat ja peitekerrokset (perustaso, edistymisviiva, raportointipäivän viiva, resurssikorostus, pelivarakaista ja palkkien värit). Kun painiketta napsautetaan, muuttuvat vain valitut kohdat. Muut asiat jäävät ennalleen.

Suodatus, ryhmittely ja lajittelu tehdään asettelulla. Erilliset painikkeet *Suodata…*, *Ryhmitä…* ja *Lajittele…* ovat nyt vain piilotetun asetuksen takana (katso Sudenkuopat).

## Vaiheet

### Olemassa olevan asettelun käyttö

1. Valitse välilehti *Näkymä*. Ryhmässä *Asettelu* on yksi painike kullekin asettelulle. Oletuksena se on *Resurssikaavio*.
2. Napsauta sitä. *Resurssikaavio* ryhmittelee tehtävät resurssin mukaan, lajittelee kunkin ryhmän sisällä alun mukaan ja kytkee riippuvuusviivat pois. Tehtävä, jolla on kaksi resurssia, näkyy molempien alla.
3. Kytke asettelu pois napsauttamalla uudelleen. Ruudulla näkyy taas sama kuin ennen napsautusta.

Jokainen napsautus on yksi vaihe, joka kumotaan kerralla painikkeella *Kumoa* (Ctrl+Z). Tämä pätee sekä kytkemiseen päälle että pois.

### Oman asettelun tekeminen

1. Napsauta ryhmässä *Asettelu* painiketta *Uusi asettelu*. Ikkuna *Uusi asettelu* avautuu.
2. Kirjoita nimi kenttään *Nimi* ja valitse *Kuvake*.
3. Kohdassa *Mitä tämä asettelu tallentaa?* on kuusi osaa, joilla on valintaruutu. Uudessa ikkunassa kaikki osat ovat valittuina, ja ne on täytetty sillä, mitä ruudulla näkyy juuri nyt. Poista valinta kohdista, joita asettelun ei pidä muuttaa. Jos vain suodatin on tarpeen, jätä valituksi vain *Suodatin*. *Ota nykyinen näkymä käyttöön* täyttää kaikki osat uudelleen sen mukaan, mitä ruudulla näkyy.
4. Aseta osat.
5. Napsauta *Tallenna*.

Asettelu on nyt painike valintanauhassa, mutta sitä ei ole vielä otettu käyttöön. Napsauta painiketta, kun asettelu halutaan kytkeä päälle.

### Suodattimen asettaminen

Säännöt rakennetaan kohdassa *Suodatin*. Napsauta *+ sääntö*, valitse *Kenttä*, *Operaattori* ja arvo. Jos halutaan vain kriittiset tehtävät: kenttä *Kriittinen*, operaattori *on yhtä suuri kuin*, arvo *Kyllä*. Kenttiin kuuluvat *Tehtävän nimi*, *Alku*, *Loppu*, *Kokonaispelivara*, *Edistyminen* ja *Välitavoite* sekä omat tehtäväkoodit ja kentät ja *Resurssit*. Operaattorit riippuvat kentän tyypistä: tekstille voi valita *sisältää*, numeroille ja päivämäärille *välillä*.

Saatavilla olevat operaattorit riippuvat kentän tyypistä:

- Teksti (*Tehtävän nimi*, *WBS*): *on yhtä suuri kuin*, *on eri kuin*, *sisältää*, *alkaa* ja *on tyhjä*.
- Numero ja päivämäärä (*Kokonaispelivara*, *Alku*, *Edistyminen*): *on yhtä suuri kuin*, *on eri kuin*, *pienempi kuin*, *pienempi tai yhtä suuri kuin*, *suurempi kuin*, *suurempi tai yhtä suuri kuin*, *välillä* ja *on tyhjä*. Kun valitaan *välillä*, näkyy kaksi kenttää: numerolle vihjeinä *Alkaen* ja *Asti*, päivämäärälle ilman vihjettä (ensimmäinen päivämäärä on alku, toinen loppu).
- Kyllä/ei (*Kriittinen*, *Välitavoite*, *Lähes kriittinen*): *on yhtä suuri kuin* ja *on eri kuin*, arvona *Kyllä* tai *Ei*.
- Valinta (*Työlaji*, tehtäväkoodi): *on yhtä suuri kuin*, *on eri kuin*, *on jokin näistä* (valintaruuduilla valittavin arvoin) ja *on tyhjä*.
- *Resurssit*: *on jokin näistä* ja *on tyhjä*.
- *Käynnissä*: vain *välillä*, kahdella päivämäärällä (alkaen ja asti).

Kun kentäksi valitaan *Käynnissä*, operaattoriksi *välillä* ja annetaan kaksi päivämäärää, saadaan kaikki tehtävät, jotka ovat käynnissä jonakin hetkenä tuona aikana, esimerkiksi kaikki kesäkuussa aktiiviset tehtävät.

Useita sääntöjä yhdistetään yläreunan luettelolla: *Kaikki alla olevat (JA)* näyttää tehtävät, jotka täyttävät kaikki säännöt, ja *Jokin alla olevista (TAI)* tehtävät, jotka täyttävät vähintään yhden säännön. Painikkeella *+ ryhmä* lisätään alaryhmä, jolla on omat säännöt.

Suodatus katsoo tehtäviä itseään. Ne yhteenvetotehtävät (vaiheet), joiden alle tehtävä kuuluu, jäävät näkyviin harmaina, jolloin näkee, mihin tehtävä kuuluu. Jos ryhmittelyä käytetään myös, harmaat vaiheet katoavat.

### Ryhmittely ja lajittelu

Kohdassa *Ryhmittely* lisätään kenttä painikkeella *+ taso*. Ryhmittelytasoja on enintään kaksi. Ilman ryhmittelyä näkyy WBS-puu. Kohdassa *Lajittelu* lisätään kenttä painikkeella *+ taso* ja valitaan *Nouseva* tai *Laskeva*. Kahdella tasolla toinen taso ratkaisee, kun ensimmäisen tason arvot ovat samat.

### Kokeile nopeasti ilman painiketta

Napsauta ikkunassa *Käytä tallentamatta*. Valitut osat siirtyvät ruudulle, mutta painiketta ei lisätä. Tämä sopii suodattimeen, jota tarvitaan vain kerran. Ctrl+Z kumoaa sen.

### Asettelun muokkaaminen, kopioiminen tai poistaminen

Napsauta asettelupainiketta hiiren oikealla painikkeella. Valitse *Muokkaa…*, *Monista* tai *Poista*. *Poista* kysyy ensin vahvistuksen. Kopion nimi on *nimi (kopio)*. Sisäänrakennettua asettelua, kuten *Resurssikaavio*, ei voi muokata eikä poistaa. Se monistetaan, jotta saadaan oma versio.

### Useampi asettelu samanaikaisesti

Asetteluja, jotka eivät tallenna samoja osia, voi olla päällä yhtä aikaa. Jos asettelu tallentaa vain suodattimen *Kriittinen on yhtä suuri kuin Kyllä* (nimeltään esimerkiksi *Vain kriittiset*), ja se kytketään päälle yhdessä asettelun *Resurssikaavio* kanssa (ryhmittely, lajittelu, riippuvuusviivat), saadaan kriittiset tehtävät resursseittain. Jos kaksi asettelua tallentaa saman osan, esimerkiksi molemmat suodattimen, toinen ottaa vallan ja ensimmäinen kytkeytyy pois. Kun toinen asettelu kytketään pois, palataan tilaan, joka oli ennen ensimmäistä napsautusta, ei ensimmäiseen asetteluun.

## Sudenkuopat ja sovelluksen toiminta

**Valinnan poistaminen unohtuu.** Asettelu, joka tallentaa myös sarakkeet, aikaskaalan ja peitekerrokset, palauttaa ne tallennettuun tilaan joka napsautuksella. Zoomaus hyppää silloin pois, vaikka tarvittiin vain suodatin. Tarkista ikkunasta, että valittuina on vain tarkoitetut osat.

**Keskeneräinen sääntö ei näytä mitään.** Jos kyllä/ei-kentälle ei valita arvoa (siinä lukee yhä *—*) tai kentän *Käynnissä* päivämääriä jätetään tyhjiksi, mikään tehtävä ei täsmää ja luettelo jää tyhjäksi. Täydennä sääntö.

**Käsin tehty muutos kytkee asettelun pois.** Jos itse muutetaan osaa, jonka asettelu tallentaa, esimerkiksi osaa *Riippuvuusviivat*, kun *Resurssikaavio* on päällä, kyseinen asettelu kytkeytyy pois ja muut osat palautuvat siihen tilaan, joka oli ennen asettelua. Zoomaus kytkee pois asettelun, joka tallentaa aikaskaalan, ja sarakkeen leventäminen asettelun, joka tallentaa sarakkeet. Muut asiat jäävät silloin ennalleen. Resurssikaavio ei tallenna aikaskaalaa, joten zoomaus ei vaikuta siihen.

**Sarakkeet koskevat tehtävätaulukkoa Gantt-kaavion vieressä.** Kohta *Sarakkeet* tallentaa taulukon sarakkeet aikajanan vasemmalla puolella. Välilehdellä *Taulukko* näkyvällä taulukolla on omat sarakkeensa. Sarakkeiden valinta on kuvattu kohdassa [Taulukon sarakkeiden muokkaaminen](docs://howto-tabelkolommen-aanpassen).

**Tilarivi ei seuraa suodatusta.** *Tehtävät:* tilarivillä näkyy koko projektin tehtävien määrä, vaikka suodatin näyttää vain osan niistä.

**Sisentäminen ja ulontaminen eivät ole käytössä.** Niin kauan kuin suodatus, ryhmittely tai lajittelu on päällä, näytetty järjestys ei ole aikataulun järjestys. *Sisennä* ja *Ulonna* ovat silloin pois käytöstä, ja ohjetekstissä lukee *Ei käytettävissä suodatuksen, ryhmittelyn tai lajittelun aikana*. Kytke asettelu pois, jotta rakennetta voi taas muokata, kuten kohdassa [Rakenteen muokkaaminen](docs://howto-structuur-aanpassen) kerrotaan.

**Asettelut ovat tällä laitteella, eivät projektissa.** Sovellus tallentaa asettelut ja sarakkeet kaikille projekteille tällä laitteella. Asettelun peitekerrokset (perustaso, edistymisviiva ja muut) koskevat kaikkia projekteja. Suodatus, ryhmittely ja lajittelu, jotka ovat juuri nyt päällä, kuuluvat avoinna olevaan projektiin, mutta eivät ole tallessa projektin tiedostossa: tallentamisen ja uudelleen avaamisen jälkeen näkymä on taas puhdas. Ne eivät myöskään merkitse projektia tilaan "muokattu".

**Erilliset painikkeet ovat piilossa.** Erilliset painikkeet *Sarakkeet…*, *Suodata…*, *Ryhmitä…* ja *Lajittele…* välilehdellä *Näkymä* ovat vanhaa tapaa. Ne saa takaisin avaamalla *Sovelluksen asetukset* -ikkunan (⚙ otsikkopalkissa), valitsemalla välilehden *Lisäasetukset* ja kohdan *Vanhat toiminnot* alta valinnan *Näytä klassiset näkymäpainikkeet*. Suosi asetteluja.

## Katso myös

- [Taulukon sarakkeiden muokkaaminen](docs://howto-tabelkolommen-aanpassen): sarakkeiden valinta, siirtäminen ja kiinnittäminen.
- [Raportin tekeminen ja tulostaminen](docs://howto-rapport-maken-en-afdrukken): näkymän tulostaminen paperille kohdalla *Seuraa näkymää*.
- [Rakenteen muokkaaminen](docs://howto-structuur-aanpassen): miksi sisentäminen ei onnistu suodatuksen aikana.

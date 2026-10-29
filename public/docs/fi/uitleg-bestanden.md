# Tiedostot ja muodot

Mitä tiedostoon oikeasti tallentuu? Ja mitä aikataululle tapahtuu, kun se viedään toiseen ohjelmaan? Tässä artikkelissa kuvataan, miten sovellus käsittelee tiedostoja: IFC omana muotonaan, muut muodot kääntäjinä, mitä vienti jättää pois sekä ero tallennuksen, automaattisen tallennuksen ja kaatumisen palautuksen välillä. Artikkelin lopussa oleva esimerkki näyttää numeroin, mitä vienti tekee.

## Käsite

Sovelluksella Open Planner Studio on yksi oma tiedostomuoto: **IFC**, avoin vaihtomuoto rakennustiedolle buildingSMART-järjestöltä. Sovellus kirjoittaa projektin IFC-skeeman, oletuksena IFC 4.3 ADD2 (katso [IFC-skeeman valitseminen](docs://howto-ifc-schema-kiezen)). Vientiluettelossa sen nimi on *IFC*. Erillistä, omaa projektitiedostoa ei ole. *Tallenna* kirjoittaa koko projektin IFC-tiedostoon (`.ifc`), ja *Avaa* lukee tällaisen tiedoston takaisin. Tiedoston sisältöä voi tarkastella. *IFC*-välilehti on editori, joka näyttää projektin IFC-tekstin. *Luo IFC* päivittää tekstin ja *Kopioi* vie sen leikepöydälle. Jos tekstiä muutetaan, *Käytä* lataa sen projektiksi. Tämä korvaa projektin kokonaan kyseisessä välilehdessä.

Kaikki muut muodot ovat **adaptereita**: kääntäjiä sovelluksen ja toisen ohjelman mallin välillä. Sovellus lukee CSV:tä, MS Project XML -muotoa, Primavera P6 XML -muotoa, MS Project -tiedostoja (`.mpp`) ja Primavera-tiedostoja (`.xer`). Se kirjoittaa CSV:tä, MS Project XML -muotoa, Primavera P6 XML -muotoa ja kaksi edistymislomaketta. Vientiä muotoon `.mpp` tai `.xer` ei ole.

Miksi tällä erolla on merkitystä? Kääntäjä voi siirtää vain sen, minkä molemmat osapuolet tuntevat. IFC-tiedosto säilyttää kaiken, mikä kuuluu projektiin. Jokainen muu muoto tuntee vain osan siitä, ja loput jää pois.

## Miten sovellus käsittelee tiedostoja

### Mitä avaaminen tekee

Sovellus valitsee lukijan tiedostopäätteen mukaan: `.ifc`, `.csv`, `.xml`, `.mpp` tai `.xer`. `.xml`-tiedoston sisällä se katsoo, onko kyse MS Project XML -muodosta vai Primavera P6 XML -muodosta. Tuntematon pääte käsitellään IFC:nä. Jos tiedosto ei ole IFC, sovellus näyttää virheen *Avaaminen epäonnistui* ja kertoo syyn.

Jokainen tiedosto avautuu omassa välilehdessään. Poikkeus on tyhjä ja muuttamaton välilehti: se ottaa tiedoston käyttöönsä. Yksi Primavera-tiedosto voi tuottaa useita välilehtiä, yhden jokaiselle projektille, jolla on tehtäviä.

Avaamisen jälkeen aikataulu lasketaan uudelleen aina. Jos tiedosto tulee toisesta ohjelmasta, päivämäärät voivat erota siitä, mitä tiedostossa luki. Siitä kerrotaan kohdassa [Päivämäärät tallennetussa muodossa](docs://uitleg-datums-zoals-opgeslagen).

Vain IFC-tiedosto tulee **tallennuskohteeksi**: tiedostoksi, johon *Tallenna* kirjoittaa takaisin. CSV-, XML-, `.mpp`- tai `.xer`-tiedosto ei tule tallennuskohteeksi. Tällaisella projektilla ei avaamisen jälkeen ole tiedostoa; *Tallenna* kysyy silloin, minne uusi IFC-tiedosto tallennetaan. Näin Ctrl+S ei koskaan korvaa lähdetiedostoa IFC-tekstillä.

### Mitä tallennus kirjoittaa

*Tallenna* kirjoittaa aina koko projektin. Tiedostoon kirjoitetaan:

- tehtävät rakenteineen, kestoineen, päivämäärineen ja edistymisineen;
- riippuvuudet viiveineen, rajoitteet ja tavoitepäivät;
- kalenterit, resurssit ja resurssikohdistukset sekä niiden käyrät;
- perustasot, tehtäväkoodit, mukautetut kentät ja muistiinpanot;
- ulkoiset riippuvuudet muihin projekteihin;
- projektin asetukset, kuten raportointipäivä, laskentaprofiili ja laskentavaihtoehdot;
- linkki resurssikirjastoon.

Ruudulla tehdyt valinnat, kuten zoomaus, vierityskohta, valittu tehtävä ja supistetut vaiheet, eivät kuulu projektiin eikä mene mukaan. Sovelluksen asetukset, kuten kieli ja teema, eivät ole tiedostossakaan. Sovellus pitää ne itse, sovelluksessa tai selaimessa.

Vienti toiseen muotoon ei muuta projektia. Viennin jälkeen projektilla on sama tallennuskohde, ja se on edelleen merkitty *Tallentamaton*, jos se oli merkitty jo ennen vientiä.

### Mitä vienti menettää

Jokainen adapteri kantaa mukanaan sen, minkä kyseinen muoto tuntee.

**MS Project XML** kantaa mukanaan tehtävät, riippuvuudet, kalenterit, resurssit, resurssikohdistukset, rajoitteet, tavoitepäivät ja raportointipäivän. Perustasoista mukaan menee vain aktiivinen. Tehtäväkoodit, mukautetut kentät, muistiinpanot ja ulkoiset riippuvuudet eivät mene mukaan. Tehtävän toinen rajoite ei mene mukaan. Rajoite *Täytyy alkaa (MSO)* tai *Täytyy päättyä (MFO)* ilman valintaa *Pakollinen (kiinnityslogiikka)* palaa muodossa *Alkaa aikaisintaan (SNET)* tai *Päättyy aikaisintaan (FNET)*. *Manuaalisesti ajoitettu* ja tehtävän *Tasaamisviive* eivät palaa. Riippumatto muuttuu tavalliseksi tehtäväksi, jolla on lasketut päivämäärät.

**Primavera P6 XML** kantaa mukanaan tehtävät, riippuvuudet, kalenterit, resurssit, resurssikohdistukset, rajoitteet ja raportointipäivän. Perustasot ja tavoitepäivät eivät mene mukaan, eivätkä tehtäväkoodit, mukautetut kentät, muistiinpanot ja ulkoiset riippuvuudet. Myös tässä riippumatto muuttuu tavalliseksi tehtäväksi. P6:ssa ei ole viivettä prosentteina: sovellus muuttaa sellaisen viiveen kiinteäksi määräksi päiviä. Viive kalenteripäivinä muuttuu viiveeksi työpäivinä.

**CSV** on taulukko tehtävistä. Jokaiselle tehtävälle tiedostossa on nämä sarakkeet: tehtävän tunniste, WBS, taso, nimi, kesto, alku, loppu, edeltäjät, työlaji, mukautetun työlajin tunniste (`OPS Custom Task Type ID`), tila, valmiusaste, toteutunut alkamispäivä ja toteutunut loppu, kriittinen, kokonaispelivara ja kuvaus. Resursseja, resurssikohdistuksia, kalentereita, rajoitteita, tavoitepäiviä, perustasoja ja raportointipäivää ei ole siinä. Sarakkeiden otsikot ovat aina englanniksi.

**Vain IFC kantaa mukanaan laskentaprofiilin ja laskentavaihtoehdot.** Viennissä CSV-muotoon, MS Project XML -muotoon tai Primavera P6 XML -muotoon profiili ei ole tiedostossa. Laskentavaihtoehdoista MS Project XML kirjoittaa enintään kriittisen kynnysarvon. Tällainen tiedosto avautuu uudelleen nimellä *Open Planner Studio*. Jos projekti laskettiin profiililla *Primavera P6* tai *Microsoft Project*, esimerkiksi koska se tuli `.xer`- tai `.mpp`-tiedostosta, päivämäärät voivat siksi siirtyä. Mitä laskentaprofiili on, kerrotaan kohdassa [Laskentaprofiilit ja laskentasäännöt](docs://uitleg-rekenprofielen).

Jos projekti tulee Primavera-tiedostosta (`.xer`), myös silloin kun se olisi tallennettu välissä IFC-muodossa, sovellus näyttää viennin jälkeen CSV-muotoon, MS Project XML -muotoon tai P6 XML -muotoon: *Vienti muotoon CSV menettää XER-lähdetiedot*. MS Project XML -muodon kohdalla viestissä lukee *MSPDI* sanan *CSV* sijasta, ja P6 XML -muodon kohdalla *P6*. IFC:n kohdalla viestiä ei tule, koska IFC-tiedosto kantaa Primaveran lähdetiedoston mukanaan. Aiheesta kerrotaan kohdassa [Primavera P6 -tiedoston (.xer) avaaminen](docs://howto-xer-openen).

Sovellus tekee viennin yhteydessä vielä kaksi asiaa. Jos aikataulu on vanhentunut, se lasketaan uudelleen ensin ja viedään vasta sen jälkeen. Aikataulua, jossa on kehäriippuvuus, ei viedä. Sen sijaan näkyy ilmoitus, jossa on silmukka, esimerkiksi *Kehäriippuvuus tehtävien välillä: Set up site → Demolish existing extension → Set up site*.

### Tallennus, automaattinen tallennus ja kaatumisen palautus

Nämä ovat kolme eri asiaa. Ne näyttävät samanlaisilta, mutta ne kirjoittavat eri paikkaan.

**Tallenna** on komento, joka käynnistetään käsin. Sovellus kirjoittaa projektin tiedostoon ja poistaa merkinnän *Tallentamaton*.

**Automaattinen tallennus** on oletuksena pois päältä, ja sen ottaa käyttöön kullekin projektille erikseen. Sovellus kirjoittaa silloin ilman ikkunaa samaan tiedostoon aina, kun muutoksia on, enintään kerran kymmenessä sekunnissa. Se toimii vain, jos projektilla on jo tiedosto. Aiheesta kerrotaan kohdassa [Automaattisen tallennuksen käyttöönotto](docs://howto-automatisch-opslaan).

**Kaatumisen palautus** on aina päällä. Heti kun jokin muuttuu, sovellus tallentaa palautuskopion kaikista avoimista projekteista, myös niistä, joita ei muutettu itse. Kopio tallennetaan myös enintään kerran kymmenessä sekunnissa. Kopio ei ole projektitiedostossa: työpöytäsovelluksessa se on sovelluksen datakansiossa, selaimessa selaimen tallennustilassa. Seuraavassa käynnistyksessä sovellus tarjoaa kopion. Aiheesta kerrotaan kohdassa [Palautus kaatumisen jälkeen](docs://howto-herstellen-na-een-crash). Kaatumisen palautus ei kirjoita koskaan projektitiedostoon.

Koska kopio tallennetaan enintään kerran kymmenessä sekunnissa, kaatumisessa voi kadota viimeisten sekuntien muutokset.

### Työpöytä ja selain

Työpöytäsovellus ja selainversio tekevät projektille saman, mutta ne kirjoittavat tiedostot eri tavalla.

Työpöytäsovelluksessa sovellus käyttää oikeita tiedostopolkuja. *Tallenna* kirjoittaa suoraan tiedostoon. Yleensä sovellus kirjoittaa ensin väliaikaiseen tiedostoon sen viereen (`.ops-save.tmp`) ja korvaa vasta sitten tiedoston. Kaatuminen kesken kirjoituksen ei siis katkaise vanhaa tiedostoa. Jos sovellus suljetaan muutosten ollessa tallentamatta, se kysyy jokaisesta projektista, halutaanko se tallentaa. Puhtaasti suljettaessa sovellus poistaa palautuskopionsa.

Selaimessa, joka voi tallentaa tiedostoja mihin tahansa (kuten Chrome ja Edge), tulee tavallinen avaus- ja tallennusikkuna. Sen jälkeen *Tallenna* kirjoittaa suoraan tiedostoon; avatun tiedoston kohdalla selain pyytää luvan kerran. Lista *Viimeisimmät* toimii, ja siinä näkyvät vain tiedostonimet.

Selaimessa ilman tätä ominaisuutta (kuten Firefox) sovellus avaa tiedoston tiedostonvalitsimella ja tallentaa latauksena. Kun *Tallenna* painetaan, viesti *Tallennettu latauksena: 'name.ifc' on lataukset-kansiossa. …* selittää tämän kerran istuntoa kohden. *Tallenna nimellä* ja viennit näyttävät viestin *Tallennettu latauksena: 'name.ifc' on nyt lataukset-kansiossa. Tämä ympäristö ei salli sovelluksen kirjoittaa suoraan valittuun paikkaan*. Jos selain voi näyttää tallennusikkunan, mutta ei voi kirjoittaa takaisin projektin tiedostoon, *Tallenna* kysyy paikkaa joka kerta. Myös tästä viesti kertoo kerran istuntoa kohden. *Tiedosto › Viimeisimmät* on olemassa, mutta se avaa tyhjän sivun, eikä automaattinen tallennus ole käytettävissä. Saman viestin näytetään kaikissa ympäristöissä, joissa sovellus ei saa kirjoittaa valittuun paikkaan.

## Esimerkki: esimerkkiprojektin vieminen

Esimerkkinä on projekti *Refurbishment & Extension of a Family Home* (*Tiedosto › Esimerkit*). Siinä on 20 tehtävää, joista 4 vaihetta ja 2 välitavoitetta, ja 16 riippuvuutta. Siinä on 6 resurssia ja 8 resurssikohdistusta, 1 perustaso ja linkki kirjastoon *Demo resource library*. Tehtävällä *Demolish existing extension* on rajoite *Alkaa aikaisintaan (SNET)* 14. toukokuuta 2027, ja tehtävällä *Handover inspection* on tavoitepäivä 29. heinäkuuta 2027. Aikataulu päättyy 7. heinäkuuta 2027.

Näin projekti palaa kustakin muodosta, mitattuna sen jälkeen, kun vientitiedosto on avattu uudelleen:

- IFC-tiedosto antaa kaiken takaisin: 20 tehtävää, 16 riippuvuutta, 6 resurssia, 8 resurssikohdistusta, perustason, rajoitteen, tavoitepäivän ja kirjastolinkin. Aikataulu päättyy taas 7. heinäkuuta 2027.
- MS Project XML -tiedosto antaa myös kaiken takaisin, paitsi kirjastolinkin. Aikataulu päättyy 7. heinäkuuta 2027.
- P6 XML -tiedosto antaa takaisin tehtävät, riippuvuudet, resurssit, resurssikohdistukset ja rajoitteen. Perustaso ja tavoitepäivä puuttuvat. Aikataulu päättyy silti 7. heinäkuuta 2027, koska rajoite on yhä mukana.
- CSV-tiedosto antaa takaisin 20 tehtävää ja 16 riippuvuutta. Resurssit, resurssikohdistukset, perustaso, rajoite ja tavoitepäivä puuttuvat, ja projektin nimi on *CSV Import*. Ilman rajoitetta tehtävät siirtyvät aikaisemmaksi: aikataulu päättyy 2. heinäkuuta 2027, viisi kalenteripäivää aikaisemmin.

Ilman tätä rajoitetta esimerkki päättyy itsessäänkin 2. heinäkuuta 2027. Ero johtuu siis rajoitteesta, jota CSV-tiedosto ei kanna mukanaan.

## Seuraukset ja väärinkäsitykset

**Vienti ei ole varmuuskopio.** Vain IFC säilyttää kaiken. Jos projekti halutaan säilyttää, se tallennetaan IFC-muodossa. Vientiä käytetään vain silloin, kun joku tarvitsee toisen muodon.

**Viennin avaaminen uudelleen ei aina anna samaa aikataulua.** Avattaessa aikataulu lasketaan aina uudelleen muodon kuuluvalla laskentaprofiililla. Jos logiikka puuttuu, kuten CSV-esimerkin rajoite, tai profiili laskee toisin, lopputulos muuttuu.

**Vienti on myös listassa *Viimeisimmät*.** Työpöydällä ja selaimissa, joilla on tiedostojen käyttöoikeus, vienti päätyy listaan *Viimeisimmät*, aivan kuten tallennettu projekti (edistymislomakkeet eivät). Jos vienti avataan sieltä, se avautuu kyseisen muodon tuontina.

**Tallentaminen ei ole sama asia kuin kaatumisen palautus.** Kaatumisen palautus auttaa kaatumisen jälkeen, mutta se ei korvaa tallentamista. Tallennetaan siis ennen välilehden tai sovelluksen sulkemista.

## Katso myös

- [Tiedoston avaaminen ja tallentaminen](docs://howto-bestand-openen-en-opslaan): vaiheet avaamiseen, tallentamiseen ja tallentamiseen nimellä.
- [Vieminen](docs://howto-exporteren): muodon valinta ja mitä siitä saadaan.
- [Päivämäärät tallennetussa muodossa](docs://uitleg-datums-zoals-opgeslagen): miksi tuotu aikataulu voi näyttää muita päivämääriä.
- [Rajoitteet ja tavoitepäivät](docs://uitleg-constraints): mitä rajoite tekee, ja mitä katoaa, jos se puuttuu.
- [Riippuvuudet ja viive](docs://uitleg-relaties): mitä viive on ja miten sovellus sen laskee.
- [Riippumaton luominen](docs://howto-hammock): mitä riippumatto on; vienti kirjoittaa sen tavalliseksi tehtäväksi.
- [Koodit ja mukautetut kentät](docs://howto-codes-en-velden): tehtäväkoodit ja mukautetut kentät, jotka vain IFC säilyttää.
- [Ulkoiset riippuvuudet toiseen projektiin](docs://howto-externe-relaties): linkit, joita MS Project XML ja P6 XML eivät kanna mukanaan.
- [Perustason tallentaminen ja hallinta](docs://howto-baseline-opslaan-en-beheren): perustasot, joista MS Project XML kantaa mukanaan vain aktiivisen.
- [Tuonti- ja vientimuodot](docs://ref-import-exportformaten): muodoittain, mitä siirtyy ja mitä ei.

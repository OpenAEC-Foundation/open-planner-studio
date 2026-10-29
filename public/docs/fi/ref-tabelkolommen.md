# Taulukon sarakkeet

Tehtävätaulukossa on 86 kiinteää saraketta. Lisäksi on yksi sarake jokaista projektin tehtäväkoodia ja mukautettua kenttää kohti sekä kahdeksan saraketta jokaista perustasoa kohti. Tämä artikkeli kertoo kustakin sarakkeesta, mitä se näyttää, voiko sitä muokata ja missä muodossa arvo kirjoitetaan. Sarakkeiden valinnan ja järjestyksen ohjeet löytyvät artikkelista [Taulukon sarakkeiden mukauttaminen](docs://howto-tabelkolommen-aanpassen).

## Sarakkeiden valinta

Gantt-kaavion vieressä oleva tehtävätaulukko ja *Taulukko*-välilehden taulukko valitsevat sarakkeensa kumpikin erikseen. Otsikon oikealla puolella oleva plusmerkki avaa sarakevalitsimen (ikkunan otsikko *Valitse sarake*). Välilehdellä *Taulukko* voi myös käyttää valintaa *Taulukko › Sarakkeet › Valitse sarakkeet…*. Valitsin listaa sarakkeet luokittain: *Tehtävä*, *Aikataulu*, *Rajoitteet*, *Riippuvuudet*, *Resurssit*, *Edistyminen*, *Lasketut*, *Perustason suunnitelma*, *Mukautetut* ja *Tekninen*. Haku tehdään nimen mukaan, ja *Viimeksi käytetyt* on ylimpänä. *Palauta oletus* palauttaa oletussarakkeet.

Oletuksena Gantt-kaavion vieressä oleva taulukko näyttää sarakkeet *WBS*, *Tehtävän nimi* ja *Kesto*. *Taulukko*-välilehden taulukko näyttää sarakkeet *WBS*, *Tehtävän nimi*, *Kesto*, *Alku*, *Loppu*, *Työlaji*, *Kriittinen*, *Kokonaispelivara* ja *Edistyminen*, lisäksi yhden sarakkeen projektin jokaista tehtäväkoodia ja mukautettua kenttää kohti.

## Arvojen lukeminen ja muokkaaminen

- **Lasketut sarakkeet** — *Lasketut*-luokan sarakkeet ja useat muut ovat vain luettavia: ne tulevat laskennasta. Jos vain luettavaa solua yritetään muokata, sovellus näyttää viestin *Tätä laskettua saraketta ei voi muokata.* Viesti on yleinen kaikille vain luettaville soluille, myös silloin kun sarake ei ole laskettu. Jos arvot ovat vanhentuneet, koska jotain on muutettu, niiden viereen tulee *vanhentunut*, kunnes painetaan *Laske*-painiketta.
- **Päivämäärät** — ne näkyvät muodossa, joka on valittu kohdassa *Asetukset*, välilehdellä *Ulkonäkö*, otsikon *Päivämäärän muoto* alla.
- **Kestot ja pelivara** — kesto näkyy tehtävän mitassa (`5d`, `12h`) tai *Keston näyttö* -asetuksen mukaan samalla välilehdellä (*Automaattinen (oma mitta kullekin tehtävälle)*, *Aina päivinä* tai *Aina tunteina*). Pelivara näkyy työpäivinä kahdella desimaalilla ja kielen desimaalierottimella.
- **Kyllä/Ei** — kyllä/ei-arvo näkyy muodossa *Kyllä* tai *Ei*. Tyhjä arvo näkyy viivana (—).
- **Muokkaaminen** — kirjoita arvo tai valitse se. Virheellinen arvo hylätään, ja solun alla näkyy syy, esimerkiksi *Syötä kelvollinen kesto, esimerkiksi 5d tai 8h.* tai *Syötä prosenttiarvo 0 ja 100 välillä.* Solualueen liittäminen käsittelee solut yksi kerrallaan. Vain luettavat solut ohitetaan, ja sovellus antaa raportin niiden määrästä.

## Tehtävä

- **Tehtävän nimi** — tehtävän nimi. Muokattavissa; pakollinen. Yhteenvetotehtävä näkyy lihavoituna, ja nimisolussa on vaalea taustasävy. Välitavoite näkyy lihavoituna välitavoitteen värillä, sama värisävy kuin välitavoitteella Gantt-kaaviossa. Tavallinen tehtävä pysyy ennallaan. Kyseessä on pelkkä muotoilu: valinta, vetäminen ja muokkaaminen toimivat samalla tavalla.
- **Kuvaus** — kuvaus. Muokattavissa; vapaa teksti.
- **WBS** — WBS-koodi. Muokattavissa ja pakollinen, mutta vain luettava, kun *WBS auto* on päällä.
- **Työlaji** — tehtävän työlaji (*Rakentaminen*, *Asennus*, *Purku*, *Logistiikka*, *Tarkastus*, *Siirto*, *Saneeraus*, *Huolto* tai *Muu*). Muokattavissa luettelosta.
- **Mukautettu työlaji** — projektin mukautettu työlaji tai viiva. Muokattavissa luettelosta, jossa ovat projektin mukautetut työlajit.
- **Väri** — tehtävän tallennettu väri värikoodina, esimerkiksi `#1a73e8`. Muokattavissa värinvalitsimella. Väri tallentuu IFC-tiedostoon, mutta mikään palkki tai raportti ei käytä sitä. Palkkien värit asetetaan polulla *Näkymä › Perustasot ja edistyminen › Palkkien värit*.
- **Muistiinpanot** — muistiinpanot muodossa `✓ teksti; ○ teksti`. Muokattavissa, kun muistiinpanoja on enintään yksi; silloin muokataan sen tekstiä. Kun muistiinpanoja on enemmän, ne ovat vain luettavia.

## Aikataulu

- **Välitavoite** — onko tehtävä välitavoite. Muokattavissa. Kun asetus laitetaan päälle, kesto on 0. Sovellus hylkää asetuksen yhteenvetotehtävälle ja tehtävälle, jolla on resurssikohdistuksia.
- **Välitavoitetyyppi** — *Aloitusvälitavoite* tai *Loppuvälitavoite*, tai viiva automaattiselle valinnalle. Muokattavissa vain välitavoitteella.
- **Pakollinen välitavoite** — lippu *Pakollinen (sopimuksellinen)*. Muokattavissa vain välitavoitteella.
- **Tasaamisen prioriteetti** — kokonaisluku 0–1000, oletus 500. Muokattavissa. Arvo 1000 lukitsee tehtävän tasaamiselle.
- **Jakovälit** — taukojen määrä muodossa `Jakovälit: 2`, tai viiva. Vain luettava; niitä muokataan *Ominaisuudet*-paneelissa.
- **Tehtävätyyppi** — tehtävän tehtävätyyppi. Tyhjä tarkoittaa projektin oletusta. Muokattavissa luettelosta, mutta tyhjä ja vain luettava välitavoitteella, yhteenvetotehtävällä tai riippumatolla. Näkyy valitsimessa vain, kun tehtävätyypit näkyvät (*Tehtävätyypit käyttöön*, tai tiedosto sisältää tehtävätyyppejä).
- **Riippumatto (johdettu kesto)** — onko tehtävä riippumatto. Muokattavissa, paitsi välitavoitteella tai yhteenvetotehtävällä.
- **Kalenteri** — tehtävän oman kalenterin tunnus. Tyhjä (—) tarkoittaa projektin kalenteria. Kirjoita tai valitse tunnus ehdotuksista; tuntematon tunnus hylätään. Huomautus: solu näyttää tällä hetkellä sisäisen tunnuksen eikä nimeä. Valitse kalenteri mieluummin *Ominaisuudet*-paneelista.
- **Keston tyyppi** — *Työaika* (kesto lasketaan kalenterin työpäivinä tai työtunteina) tai *Kulunut aika* (kesto lasketaan yhtenäisenä kellonaikana ilman kalenteria). Muokattavissa.
- **Keston mitta** — *Päivät* tai *Tunnit*. Muokattavissa, paitsi yhteenvetotehtävällä, riippumatolla tai välitavoitteella. Vaihto onnistuu vain, kun muunnos on tarkka ja *Ota tuntisuunnittelu käyttöön* on päällä.
- **Kesto** — tehtävän kesto tehtävän mitassa tai *Keston näyttö* -asetuksen mukaan. Muokattavissa: kirjoita `5d`, `12h` tai `1h 30m`. Kelpaa myös luku tehtävän mitassa. Vain luettava yhteenvetotehtävällä, riippumatolla ja välitavoitteella, jonka kesto on 0.
- **Alku** — näytetty alkamispäivä, sama päivä kuin Gantt-palkissa. Jos tehtävä on jo alkanut, alku on toteutunut alkamispäivä. Muokattavissa. Tehtävä, jolla on edeltäjä ja jolle annetaan uusi alku, saa rajoitteen *Alkaa aikaisintaan (SNET)* tälle päivälle. Vain luettava yhteenvetotehtävällä ja riippumatolla, ellei sitä ole ajoitettu manuaalisesti, sekä tehtävällä, joka on jo alkanut (*Tehtävä on jo alkanut; sen alkamispäivä on toteutunut alkamispäivä. Muuta se edistymisen kautta.*).
- **Loppu** — näytetty loppu. Jos tehtävä on jo päättynyt, loppu on toteutunut valmistumispäivä. Muokattavissa: uusi loppu muuttuu uudeksi kestoksi. Sovellus hylkää uuden lopun tehtävälle, joka on jo päättynyt (*Tehtävä on päättynyt; sen loppu on toteutunut valmistumispäivä. Muuta se edistymisen kautta.*), välitavoitteelle, tehtävälle, jonka keston tyyppi on *Kulunut aika*, ja tehtävälle, jossa on taukoja. Sovellus hylkää myös lopun, joka on ennen alkua (*Loppu on ennen alkua.*). Vain luettava yhteenvetotehtävällä ja riippumatolla, ellei sitä ole ajoitettu manuaalisesti.
- **Suunniteltu alku** — laskennan lähtöpäivä, josta laskenta alkaa. Se ei ole välttämättä näytetty alku. Muokattavissa. Vaikutus on sama kuin *Alku*-kentän muokkaamisessa.
- **Suunniteltu loppu** — annettu loppu. Muokattavissa vain manuaalisesti ajoitetulla tehtävällä. Muuten sovellus kertoo: *Suunniteltu loppu koskee vain manuaalisesti ajoitettua tehtävää. Loppu muutetaan Loppu-sarakkeessa tai kestossa.*

## Rajoitteet

- **Rajoitetyyppi** — rajoitteen tyyppi väliltä *Mahdollisimman aikaisin (ASAP)* – *Täytyy päättyä (MFO)*. Muokattavissa. Tehtävä ilman rajoitetta näyttää arvon *ASAP*.
- **Rajoitteen päivämäärä** — rajoitteen päivämäärä. Muokattavissa.
- **Kova rajoite** — lippu *Pakollinen (kiinnityslogiikka)*. Muokattavissa vain tyypeillä *MSO* ja *MFO*.
- **Toissijainen rajoitetyyppi** — toisen rajan tyyppi tai viiva. Muokattavissa. Taulukko tarjoaa kaikki tyypit, mutta sallimaton yhdistelmä hylätään. Toissijaisen rajoitteen on oltava *SNET*, *FNET*, *SNLT* tai *FNLT*. Ensisijaisen rajoitteen on oltava raja (ei *ASAP*, *ALAP*, *MSO*, *MFO* eikä kova rajoite). Rajojen on oltava vastakkaisilla puolilla: alaraja *SNET* tai *FNET* ja yläraja *SNLT* tai *FNLT*, tai toisin päin.
- **Toissijaisen rajoitteen päivämäärä** — toisen rajan päivämäärä. Muokattavissa.
- **Tavoitepäivä** — tehtävän loppumisen tavoitepäivä. Muokattavissa.

## Riippuvuudet

- **Edeltäjät** — edeltäjät muodossa `WBS type±lag`, erotettuina merkillä `; `, esimerkiksi `1.2 FS+2d`. Muokattavissa kirjoittamalla sama muoto. Ulkoista riippuvuutta ei lisätä tähän, vaan polulla *Aikataulu › Riippuvuudet › Linkitä › Lisää ulkoinen riippuvuus…*.
- **Seuraajat** — seuraajat samassa muodossa. Muokattavissa.
- **Ohjaavat riippuvuudet** — riippuvuudet, jotka määräävät tehtävän päivämäärän, muodossa `← 1.2` (edeltäjä) tai `→ 1.4` (seuraaja). Vain luettava. Se on vanhentunut, kunnes *Laske*-komento suoritetaan.
- **Vapaa pelivara** (luokassa *Riippuvuudet*) — vapaa pelivara riippuvuutta kohti muodossa `← 1.2: 3d`. Tämä ei ole sama sarake kuin *Vapaa pelivara* kohdassa *Lasketut*, joka näyttää tehtävän oman pelivaran. Vain luettava.
- **Varoitukset** — varoitukset riippuvuuksittain, esimerkiksi *Väärässä järjestyksessä* tai *Ei huomioida laskennassa*. Vain luettava. Katso [Ilmoitukset ja varoitukset](docs://ref-meldingen).

## Resurssit

- **Kohdistetut resurssit** — kohdistettujen resurssien nimet, erotettuina pilkuilla. Muokattavissa: nimen lisääminen kohdistaa resurssin kuormitusasteella 1 päivässä, nimen poistaminen poistaa resurssikohdistuksen. Vain luettava välitavoitteella ja yhteenvetotehtävällä.
- **Kuormitusaste päivässä** — kuormitusaste resurssia kohti muodossa `Nimi: 1; Nimi: 0.5`, enintään kahdella desimaalilla. Tallennettu arvo pysyy tarkkana. Muokattavissa tehtävällä, jolla on resurssikohdistuksia.
- **Suunniteltu kuormitusaste päivässä** — suunniteltu kuormitusaste resurssia kohti muodossa `Name: 1.11`, enintään kahdella desimaalilla, kuten *Kuormitusaste päivässä*. Vain kohdistukselle, joka on tuotu Primavera P6 -ohjelmasta ja jonka jäljellä oleva kuormitusaste on eri. Silloin *Kuormitusaste päivässä* näyttää jäljellä olevan kuormitusasteen. Vain luettava.
- **Jakautumiskäyrä** — käyrä resurssia kohti muodossa `Nimi: Tasainen`. Muokattavissa tehtävällä, jolla on resurssikohdistuksia.
- **Työikkunan alku** ja **Työikkunan loppu** — työikkuna resurssia kohti tuodusta tiedostosta muodossa `Nimi: päivämäärä`. Vain luettava.
- **Suunniteltu työ (tunnit)** ja **Toteutunut työmäärä (tunnit)** — suunniteltu työ ja toteutunut työmäärä resurssia kohti tunteina muodossa `Nimi: 617.14`, enintään kahdella desimaalilla, tuodusta tiedostosta. Vain luettava.
- **Jäljellä oleva työ (tunnit)** — jäljellä oleva työ resurssia kohti tunteina muodossa `Nimi: 6` tai `Nimi: 26.67`: tallennettu työ, muuten jäljellä oleva kesto × kuormitusaste. Muokattavissa tehtävällä, jolla on resurssikohdistuksia ja johon tehtävätyyppi soveltuu. Desimaalierottimena kelpaa pilkku tai piste. Näkyy valitsimessa vain, kun tehtävätyypit näkyvät. Keltainen ⚠ solussa tarkoittaa, että tallennettu työ eroaa kuormitusasteen × jäljellä olevan keston arvosta, kuten ⚠ kohdassa *Työ (jäljellä)* tehtäväpaneelissa.

## Edistyminen

- **Tila** — *Ei aloitettu*, *Käynnissä* tai *Suoritettu*. Muokattavissa, paitsi yhteenvetotehtävällä.
- **Edistyminen** — prosenttiosuus muodossa `40%`. Muokattavissa luvulla 0–100, paitsi yhteenvetotehtävällä.
- **Toteutunut alkamispäivä** — päivä, jona tehtävä alkoi. Muokattavissa, paitsi yhteenvetotehtävällä.
- **Toteutunut valmistumispäivä** — päivä, jona tehtävä valmistui. Muokattavissa, paitsi yhteenvetotehtävällä.
- **Toteutunut kesto** — toteutunut kesto lukuna. Muokattavissa, paitsi yhteenvetotehtävällä.
- **Jäljellä oleva kesto** — jäljellä oleva kesto tehtävän yksikössä. Muokattavissa, paitsi yhteenvetotehtävällä.
- **Jatkamispäivä** ja **Pysäytyspäivä** — tehtävän jatkamisen ja pysäyttämisen päivä käynnissä olevalle tehtävälle MS Project- tai Primavera-tiedostosta. Vain luettava.

Edistymissarakkeet noudattavat sovelluksen edistymissääntöjä: todellinen päivä raportointipäivän jälkeen hylätään. Yhteenvetotehtävällä sovellus sanoo: *Yhteenvetotehtävän edistyminen johdetaan alitehtävistä, eikä sitä voi muuttaa tässä.*

## Lasketut

Kaikki tämän luokan sarakkeet ovat vain luettavia.

- **Tasaamisviive** — kuinka monta työpäivää tasaaminen viivästytti tehtävää. Viiva, jos tasaamista ei ole sovellettu.
- **Varhaisin alkamispäivä** ja **Varhaisin valmistumispäivä** — varhaisimmat päivät laskennasta. Tehtävälle, joka on alkanut, nämä voivat poiketa kohdista *Alku* ja *Loppu*: laskentaprofiili *Primavera P6* asettaa tehtävän varhaisen alun, joka on kesken tai päättynyt, raportointipäivälle.
- **Myöhäisin alkamispäivä** ja **Myöhäisin valmistumispäivä** — viimeisimmät päivät, jolloin tehtävä saa vielä alkaa tai päättyä viivästyttämättä projektia.
- **Vapaa pelivara** — työpäivien määrä, jonka tehtävä voi siirtyä viivästyttämättä seuraajaa.
- **Kokonaispelivara** — työpäivien määrä, jonka tehtävä voi siirtyä viivästyttämättä projektin päättymispäivää. Negatiivinen, jos rajoitetta tai tavoitepäivää ei voida täyttää.
- **Kriittinen** — *Kyllä*, jos tehtävä on kriittisellä polulla.
- **Häiritsevä pelivara** — kokonaispelivara miinus vapaa pelivara.
- **Lähes kriittinen** — *Kyllä* lähes kriittiselle tehtävälle. Täytetään vain, kun *Merkitse lähes kriittiset* on päällä (*Projektin asetukset*, osio *Laskentaprofiili ja laskentavaihtoehdot*); muuten viiva.
- **Pelivarapolku** — pelivarapolun numero, 1 on kriittisin. Täytetään vain, kun *Useita pelivarapolkuja* on päällä; muuten viiva.
- **Kirjattujen päivien lähde** — niin kauan kuin sovellus näyttää päivät tiedostosta: *Osittain kirjaamatta* tehtävälle, jonka tiedostossa ei ole kaikkea. Näkyy valitsimessa vain tässä näkymässä. Kirjaamattomalla akselilla *Ei kirjattu* näkyy myöhäisten päivämäärien ja pelivaran sarakkeissa.

Katso [Kriittinen polku ja pelivara](docs://uitleg-kritiek-pad).

## Perustaso

Projektin jokaista perustasoa kohti lisätään sarakkeita. Perustason nimi on sarakkeen nimen edessä (`<perustaso> — Suunniteltu alku`). Ne ovat vain luettavia. Tehtävä, joka ei ole perustasossa, näyttää viivan, ja sen vihjeteksti on *Ei ole tässä perustason suunnitelmassa*.

- **Suunniteltu alku**, **Suunniteltu loppu** ja **Kesto** — alku, loppu ja kesto sellaisina kuin perustaso ne tallensi.
- **Alkamispäivän ero** ja **Valmistumispäivän ero** — työpäivien määrä perustason ja näytetyn alun tai lopun välillä projektin kalenterissa. Positiivinen, jos tehtävä on myöhemmin.
- **Keston ero** — nykyinen kesto miinus perustason kesto, työpäivinä.

## Mukautetut

- **Tehtäväkoodi** — yksi sarake jokaista tehtäväkoodia kohti, koodin nimellä. Näyttää valitun arvon koodin. Muokattavissa: koodi kirjoitetaan tai valitaan ehdotuksista. Tuntematon koodi hylätään. Jos koodi esiintyy useammin kuin kerran, sovellus pyytää valitsemaan sen luettelosta.
- **Mukautettu kenttä** — yksi sarake jokaista mukautettua kenttää kohti, kentän nimellä. Syöte vastaa kentän tyyppiä: teksti, luku, kokonaisluku, kustannus, päivämäärä tai kyllä/ei. Muokattavissa.

Nämä sarakkeet kuuluvat siihen projektiin, johon koodi tai kenttä kuuluu. Katso [Koodit ja mukautetut kentät](docs://howto-codes-en-velden).

## Tekninen

Kaikki tämän luokan sarakkeet ovat vain luettavia. Ne näyttävät tietoja, jotka sovellus tallentaa, mutta ei näytä tavallisessa sarakkeessa. Ne ovat esimerkiksi tuonnin tarkistamiseen.

- **Tehtävän tunnus** — tehtävän sisäinen tunnus.
- **Ylätehtävän tunnus** ja **Alitehtävien tunnukset** — ylä- ja alitehtävien tunnukset.
- **Resurssien tunnukset** — tehtävän resurssien tunnukset.
- **Resurssikohdistuksen tunnus**, **Resurssikohdistuksen tehtävän tunnus** ja **Resurssikohdistuksen resurssin tunnus** — tämän tehtävän resurssikohdistusten, tehtävien ja resurssien tunnukset.
- **Kesto (minuutteina)** ja **Jäljellä oleva kesto (minuutteina)** — kesto ja jäljellä oleva kesto minuutteina. Täytetään vain tehtävällä, jonka yksikkö on tunnit.
- **Tasaamisviive (minuutteina)** ja **Kulunut tasaamisviive** — tasaamisviive MS Projectista minuutteina, ja se, onko se kulunut aika.
- **Manuaalisesti ajoitettu** — onko tehtävä ajoitettu manuaalisesti.
- **MS Project -tehtävätyyppi (tuonti)** ja **Työmäärään perustuva** — tehtävätyyppi ja työmäärään perustuva lippu sellaisina kuin MS Project ne oli asettanut.
- **Primavera P6 -alkuperä** — lähdekentät Primavera-tiedostosta muodossa `key: value`.
- **Eksplisiittinen yhteenvetotehtävä** — onko tehtävä eksplisiittinen yhteenveto ilman alitehtäviä (Primavera-tiedostosta).
- **Ajallisesti jaettu loppulattia**, **Ajallisesti jaettu alkuankkuri**, **Ajallisesti jaetut kestosegmentit** ja **Ajallisesti jaetut jaksottumiset** — tuntijakauma MS Project -tiedostosta, päivämäärinä ja lukumäärinä.
- **Tehtäväkoodien tiedot**, **Mukautettujen kenttien tiedot** ja **Muistiinpanojen tiedot** — koodien kohdistusten, mukautettujen kenttien ja muistiinpanojen määrä.
- **Sisäisten riippuvuuksien tiedot** ja **Ulkoisten riippuvuuksien tiedot** — sisäisten ja ulkoisten riippuvuuksien määrä.
- Jokaisen perustason kohdalla myös **Välitavoite** ja **Välitavoitetyyppi** ovat täällä, sellaisina kuin perustaso ne tallensi.

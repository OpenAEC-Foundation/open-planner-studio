# Tuonti- ja vientimuodot

Tässä kerrotaan kustakin tiedostomuodosta: voiko sen avata, tallentaa ja viedä, mikä siirtyy mukana ja mikä ei, sekä millä laskentaprofiililla se avautuu. Taustat ja esimerkki luvuin ovat kohdassa [Tiedostot ja muodot](docs://uitleg-bestanden).

## Yhteenveto

**Avaaminen** onnistuu muodoilla IFC, CSV, MS Project XML, Primavera P6 XML, `.mpp` ja `.xer`. Muun tiedostopäätteen tiedosto käsitellään sovelluksessa IFC-tiedostona.

**Tallentaminen** kirjoittaa aina IFC-muodossa. Vain avattu IFC-tiedosto tulee tallennuskohteeksi. Projektilla toisesta muodosta ei ole tiedostoa avaamisen jälkeen, ja *Tallenna* kysyy silloin, mihin IFC-tiedosto tallennetaan.

**Vienti** onnistuu muotoihin IFC, MS Project XML, Primavera P6 XML, CSV ja kahteen edistymistaulukkoon (Excel ja CSV). Vienti ei muuta projektia.

**Vain luettavat** ovat `.mpp` ja `.xer`: sovellus voi avata ne, mutta ei kirjoittaa niitä.

**PDF** tulee vain raportista (katso [Raporttityypit](docs://ref-rapporttypes)). Sovellus ei lue PDF-tiedostoja.

**Sijainti.** Avaaminen: *Aloitus › Tiedosto › Avaa*, *Tiedosto › Avaa* tai Ctrl+O. Vienti: *Aloitus › Tiedosto › Vienti* tai *Tiedosto › Vienti*. Täytetyn edistymistaulukon voi tuoda sovellukseen valinnalla *Tiedosto › Tuo* tai painikkeella *Tuo edistyminen taulukosta* valintanauhan ryhmässä *Edistyminen* välilehdillä *Aikataulu*, *Taulukko* ja *Raportti*.

**Laskentaprofiili avattaessa.** Jokainen muoto avautuu laskentaprofiilin kanssa. Mitä se on, kerrotaan kohdassa [Laskentavaihtoehdot ja laskentasäännöt](docs://ref-rekenopties-en-conventies). `.xer` avautuu profiililla *Primavera P6*, `.mpp` profiililla *Microsoft Project* ja CSV, MS Project XML ja P6 XML profiililla *Open Planner Studio*. IFC säilyttää tiedostossa olevan profiilin. Sovellus näyttää `.xer`- ja `.mpp`-tiedostoille, että projekti lasketaan tällä tavalla. Vain IFC-tiedosto sisältää laskentaprofiilin ja laskentavaihtoehdot. Laskentavaihtoehdoista MS Project XML kirjoittaa enintään kriittisen kynnysarvon. Toiseen muotoon viety tiedosto, joka avataan uudelleen, lasketaan profiilina *Open Planner Studio*.

## IFC

**Avaaminen** — kyllä, `.ifc`. Sovellus lukee IFC4:ää ja IFC 4.3:a (myös ADD2). Toisen skeeman tiedosto, kuten IFC2X3, avautuu myös. Ensimmäisessä tallennuksessa valitaan skeema, jonka sovellus voi kirjoittaa (katso [IFC-skeeman valinta](docs://howto-ifc-schema-kiezen)). Laskentaprofiili: se, joka on tiedostossa.

**Tallentaminen** — kyllä, ja se on ainoa muoto, johon tallennetaan. *Tallenna* kirjoittaa koko projektin IFC-tiedostoksi projektin IFC-skeemassa (oletuksena IFC 4.3 ADD2). Tiedostosta tulee tallennuskohde.

**Vienti** — kyllä, muodossa *IFC* projektin IFC-skeemassa (oletuksena IFC 4.3 ADD2). Oletusnimi: projektin nimi tiedostopäätteellä `.ifc`. Jos projekti on linkitetty resurssikirjastoon, valintaruutu *Tallenna kirjastotiedosto rinnalle* on korttien alla kohdassa *Tiedosto › Vienti*. Kun ruutu on valittu, sovellus kysyy projektin jälkeen paikkaa tiedostolle *projectname-bibliotheek.ifc*. Valintaruutu ei ole luettelossa *Aloitus*-välilehdellä.

**Mukana** — kaikki, mikä kuuluu projektiin: tehtävät rakenteineen, kestoineen, päivämäärineen ja edistymisineen; riippuvuudet viiveineen; rajoitteet ja tavoitepäivät; kalenterit; resurssit ja resurssikohdistukset, mukaan lukien tuntijakautuminen; perustasot; tehtäväkoodit ja mukautetut kentät; muistiinpanot; ulkoiset riippuvuudet toisiin projekteihin; tauot; tehtävätyypit ja mukautetut työlajit; projektin asetukset, kuten raportointipäivä, edistymistapa, laskentaprofiili ja laskentavaihtoehdot; linkki resurssikirjastoon. Jos projekti tulee `.xer`-tiedostosta, mukana kulkee myös sen lähdetiedosto. Mukautettu työlaji tallennetaan IFC-tyyppinä `USERDEFINED`, ja sen nimi on kentässä ObjectType. Muut IFC-ohjelmat lukevat tehtävän silloin normaalisti. Sovellus säilyttää työlajin kiinteän tunnuksen, joten nimen muuttaminen ei katkaise linkkiä. Jos joku avaa tiedoston toisella tietokoneella, työlaji näkyy siellä kohdassa *Tästä projektista*, ei kohdassa *Omat työlajit*.

**Ei mukana** — näytön asetukset (zoomaus, vierityskohta, valittu tehtävä, supistetut vaiheet, valittu suodatin ja ryhmittely) ja sovelluksen asetukset ([Sovelluksen asetukset](docs://ref-instellingen)). *IFC*-välilehti on editori, jossa näkyy projektin IFC-teksti. *Luo IFC* päivittää sen, *Kopioi* vie sen leikepöydälle ja *Käytä* lataa tekstin projektiksi ja korvaa projektin tässä välilehdessä.

## MS Project XML (MSPDI)

**Avaaminen** — kyllä. Sovellus tunnistaa `.xml`-tiedoston MS Project XML:ksi juurielementin `Project` perusteella MS Project -nimiavaruudesta (tai ilman nimiavaruutta). Laskentaprofiili: *Open Planner Studio*. Avaamisen jälkeen sovellus kertoo yhdessä viestissä, mitä se ei ottanut mukaan; katso [MS Project -tiedoston (.mpp) avaaminen](docs://howto-mpp-openen).

**Tallentaminen** — ei. Tällaiselle projektille ei tule tallennuskohdetta.

**Vienti** — kyllä, muodossa *MS Project XML* (*Avattavissa ohjelmassa Microsoft Project. Täysi WBS-rakenne.*). Oletusnimi: projektin nimi tiedostopäätteellä `.xml`.

**Mukana** — tehtävät rakenteineen (taso ja WBS), kesto, päivämäärät ja edistyminen; riippuvuudet viiveineen, myös tunteina tai prosentteina; rajoitteet, tavoitepäivä mukaan lukien; kalenterit, myös tehtävä- ja resurssikalenterit; resurssit ja resurssikohdistukset, myös käyrä tai tuntijakautuminen; raportointipäivä; kriittinen kynnysarvo kokonaislukuna, joka on työpäivien määrä (0 tai enemmän), valinnalla *Kokonaispelivara ≤ kynnysarvo*; tehtävän kuvaus muistiinpanona; tehtävän tehtävätyyppi MS Project -tehtävätyyppinä; mukautettu työlaji vapaassa kentässä (`ExtendedAttribute`), jonka sovellus lukee takaisin ja jonka MS Project voi jättää huomiotta. Perustasoista mukana on vain aktiivinen perustaso, perustasona 0. Tehtävä tunneissa säilyttää yksikkönsä ja välitavoite lajinsa (alku, loppu tai automaattinen).

**Ei mukana** — muistiinpanot (tehtävän tarkistuslista), ulkoiset riippuvuudet toisiin projekteihin, tehtäväkoodit ja mukautetut kentät, toinen rajoite, merkintä *Manuaalisesti ajoitettu*, tasaamisviive, järjestyksestä poikkeavan edistymisen jatko- ja pysäytyskohta, MS Project -laskentaprofiilin laskentasäännöt *Jäljellä oleva työ jatkuu kuluneen ajan jälkeen* ja *Aloittamattomia tehtäviä ei siirretä raportointipäivään*, sekä muut laskentavaihtoehdot. Tehtävät, joissa on taukoja mutta ei tuntijakautumista, siirtyvät ilman näitä taukoja.

**Vapaapäivät avattaessa.** Johdettu kalenteri perii peruskalenterinsa poikkeukset. Kalenteri, jolla on oma työviikko eikä poikkeuksia, ei saa vapaapäiviä. Vain tyhjä kalenteri, jolla ei ole peruskalenteria, työviikkoa eikä poikkeuksia, säilyttää tavalliset hollantilaiset vapaapäivät. Jos vapaapäiviä puuttuu, loppupäivä voi erota: katso [Vapaapäivien luominen ja rakennusalan kesäloma](docs://howto-feestdagen-genereren).

**Matkalla muuttuu** — rajoite *Täytyy alkaa (MSO)* tai *Täytyy päättyä (MFO)* ilman valintaa *Pakollinen (kiinnityslogiikka)* muuttuu rajoitteeksi *Alkaa aikaisintaan (SNET)* tai *Päättyy aikaisintaan (FNET)*. Riippumatto muuttuu tavalliseksi tehtäväksi, jolla on lasketut päivämäärät. MS Project XML tallentaa tuntimäärän päivässä vain projektin kalenterille. Toinen kalenteri, jolla on oma tuntimäärä päivässä, saa avattaessa työaikansa tuntimäärinä päivässä: esimerkiksi kalenterin 8 tuntia päivässä muuttuu arvoksi 10, kun sen työaika on 10 tuntia. Tehtävä, jonka kesto on päivinä, lyhenee sitten tällaisessa kalenterissa, esimerkiksi 4 päivää 5 päivän sijaan.

## MS Project -tiedosto (`.mpp`)

**Avaaminen** — kyllä, MS Project 2010:stä 2021:een. Laskentaprofiili: *Microsoft Project*. Sovellus vain lukee tiedoston eikä muuta `.mpp`-tiedostoa koskaan. Sovellus hylkää tiedoston, joka on MS Project 2007:stä tai vanhemmasta, ja salasanalla suojatun tiedoston. Se näyttää viestin, joka ohjaa MS Project -ohjelman XML-vientiin. Avaamisen jälkeen sovellus kertoo yhdessä viestissä, mitä se ei ottanut mukaan.

**Tallentaminen** — ei, eikä tiedostolle tule tallennuskohdetta: *Tallenna* kirjoittaa uuden IFC-tiedoston.

**Vienti** — ei.

**Mukana** — tehtävät rakenteineen, kestoineen ja rajoitteineen; riippuvuudet viiveineen; kalenterit; resurssit ja resurssikohdistukset; edistyminen; WBS-koodi, joka on täytetty itse MS Projectissa. Myös MS Projectin itse laskemat päivämäärät ja pelivara luetaan, jotta ne näkyvät näkymässä *Päivämäärät tallennetussa muodossa*.

**Ei mukana** — perustasot, kustannukset ja normaalihinnat, muistiinpanot, hyperlinkit, aliprojektien ja ulkoisten tehtävien linkit, MS Projectin mukautetut kentät sekä kriittinen kynnysarvo. Katso [MS Project -tiedoston (.mpp) avaaminen](docs://howto-mpp-openen).

**Alkuperä ja lisenssi** — `.mpp`-lukija on kirjoitettu Open Planner Studiolle. Se perustuu MPXJ:n (`github.com/joniles/mpxj`, Jon Iles ym.) lähdekoodiin ja rakennetuntemukseen. MPXJ on Java-kirjasto, joka on LGPL-2.1-lisenssin alainen. Rakenne ja kenttävakiot on siirretty TypeScriptiin. Open Planner Studio itse on avointa lähdekoodia LGPL-3.0-lisenssillä. `.xer`-lukija ei ole johdannainen: MPXJ:ta käytettiin siinä vain ymmärryksen lähteenä.

## Primavera P6 XML

**Avaaminen** — kyllä. Sovellus tunnistaa `.xml`-tiedoston P6 XML:ksi juurielementin `APIBusinessObjects` perusteella. Laskentaprofiili: *Open Planner Studio*.

**Useita projekteja yhdessä tiedostossa.** Jokainen projekti, jossa on tehtäviä, avautuu omassa välilehdessään nimellä *Projektin nimi (projektitunnus)*. Sovellus ohittaa projektin, jossa ei ole tehtäviä. Aktiivinen välilehti on projekti, jossa on eniten tehtäviä. Sovellus ei ota mukaan riippuvuutta toiseen projektiin eikä tehtävää, joka ei kuulu mihinkään projektiin. Avaamisen jälkeen sovellus kertoo, kuinka monta projektia se avasi.

**Vapaapäivät avattaessa.** Samat säännöt pätevät kuin MS Project XML:ssä: kalenteri, jolla on oma työviikko eikä poikkeuksia, ei saa vapaapäiviä.

**Perustasot.** `<BaselineProject>`-elementti tiedostossa muuttuu projektinsa perustasoksi. Perustaso, jonka P6 merkitsee aktiiviseksi, on aktiivinen myös sovelluksessa.

**Resurssikohdistuksen nopeus.** Jos työtä on jäljellä, jäljellä oleva nopeus (`RemainingUnitsPerTime`) muuttuu arvoksi *Kuorm./päivä*. Muuten siitä tulee suunniteltu nopeus (`PlannedUnitsPerTime`). Materiaalilla suunniteltu nopeus pysyy. Sovellus ei laske mitään uudelleen, kun se avaa tiedoston. Kun vie P6 XML:ksi, se kirjoittaa suunnitellun nopeuden kenttään `PlannedUnitsPerTime`. Jäljellä olevan nopeuden kenttään `RemainingUnitsPerTime` se kirjoittaa vain, kun kohdistuksella on erillinen suunniteltu nopeus.

**Ei luettavia tehtäviä.** Jos sovellus ei löydä yhtään luettavaa tehtävää, se ei avaa välilehteä. Se kertoo tämän, ja syy kerrotaan, kun se tiedetään. Esimerkkejä: tehtävät ilman `ObjectId`-tunnusta tai XER-sarakkeiden nimet XML-tiedostossa. Projekti viedään sitten uudelleen P6:sta P6 XML:nä tai avataan `.xer`-tiedostona.

**Tallentaminen** — ei.

**Vienti** — kyllä, muodossa *Primavera P6 XML* (*Oracle Primavera P6 -ohjelmalle.*). Oletusnimi: projektin nimi tiedostopäätteellä `.xml`, ja suluissa projektitunnus, jos projektilla on sellainen. MS Project XML -vienti saa saman nimen, joten eri nimet on annettava itse.

**Projektin nimi ja projektitunnus.** Sovellus pitää P6:n projektitunnuksen erillään projektin nimestä, kuten `.xer`-tiedostossakin. *Projektin asetukset* näyttää vain nimen, esimerkiksi *Bid for Facility Extension*. Välilehdessä näkyy *Bid for Facility Extension (OZB-05)*. Kun projektin nimeksi muutetaan *Hall extension*, välilehden nimi on *Hall extension (OZB-05)*. Vienti P6 XML:ään kirjoittaa *OZB-05* takaisin projektitunnukseksi ja *Hall extension* nimeksi. Näin P6 tunnistaa projektin. Projekti `.xer`-tiedostosta vie mukanaan myös projektitunnuksensa. Projektitunnus säilyy, kun projekti tallennetaan IFC-muodossa. Sulut itse nimessä, kuten *New build (phase 2)*, jäävät nimeen. Projekti ilman projektitunnusta saa viennissä sovellukselta oman yksilöllisen tunnuksen, joka alkaa *OPS:*.

**Mukana** — WBS-rakenne ja tehtävät kestoineen, päivämäärineen ja edistymisineen; riippuvuudet viiveineen; rajoitteet, myös toinen rajoite pehmeänä rajoitteena; kalenterit; resurssit ja resurssikohdistukset; raportointipäivä (kenttänä `DataDate`); mukautettu työlaji omassa kentässään, `OPS Custom Task Type`, jonka sovellus lukee takaisin ja jonka P6 voi jättää huomiotta.

**Ei mukana** — perustasot ja tavoitepäivät; tehtäväkoodit, mukautetut kentät, muistiinpanot ja ulkoiset riippuvuudet; laskentavaihtoehdot; vapaapäivien nimet. P6:ssa ei ole nimeä vapaapäiville: kun tiedosto avataan uudelleen, vapaapäivä on nimeltään *Holiday* ja työpoikkeus *Working exception*. Peräkkäiset vapaapäivät palautuvat yhtenä jaksona. Sovellus lyhentää nimen tai tunnuksen, joka on P6:n sallimaa pidempi: tehtävän nimi 120 merkkiin, tehtävän tunnus tai WBS-koodi 40 merkkiin ja WBS- tai projektin nimi 100 merkkiin. Se kertoo, kuinka monta nimeä ja tunnusta se lyhensi. P6:ssa ei ole viivettä prosentteina: sovellus muuntaa sen kiinteäksi määräksi päiviä. Kalenteripäivinä annettu viive muuttuu työajan viiveeksi: 3 kalenteripäivää tulee 3 työpäiväksi. Riippumatto muuttuu tavalliseksi tehtäväksi, manuaalisesti ajoitettu tehtävä tavalliseksi tehtäväksi lasketuilla päivämäärillä, ja tasaamisviive, joka on alle päivän, pudotetaan pois.

## Primavera-tiedosto (`.xer`)

**Avaaminen** — kyllä. Laskentaprofiili: *Primavera P6*. Sovellus ainoastaan lukee tiedoston: se ei kirjoita `.xer`-tiedostoa eikä muuta tiedostoa koskaan. Jokaiselle tehtäviä sisältävälle projektille avautuu oma välilehti. Tiedoston, jossa ei ole tehtäviä tai jossa taulukot ovat vaurioituneet, sovellus hylkää viestillä.

**Tallentaminen** — ei, eikä tiedostolle ole tallennuskohdetta: *Tallenna* kirjoittaa uuden IFC-tiedoston, jonka sisällä on `.xer`-tiedosto sellaisenaan.

**Vienti** — ei. Jos `.xer`-projekti viedään CSV-, MS Project XML- tai P6 XML -muotoon, sovellus näyttää viestin, jonka mukaan XER-lähdetiedot katoavat, vaikka projekti olisi tallennettu välissä IFC-muotoon. IFC-muotoon ei katoa mitään.

**Mukana** — WBS-rakenne sekä tehtävät kestoineen, päivämäärineen, rajoitteineen ja edistymisineen; riippuvuudet viiveineen; kalenterit; resurssit ja resurssikohdistukset; tehtäväkoodit; mukautetut kentät (UDF); muistiinpanot; P6:n aikataulutusasetukset. Tehtävä, jonka tyyppi on *Level of Effort*, muuttuu riippumatoksi. Perustasoprojekti muuttuu sen projektin aktiiviseksi perustasoksi, johon se viittaa. Kahden projektin välinen riippuvuus säilytetään sovelluksessa lähdetietona.

**Resurssikohdistuksen nopeus.** Jos työtä on vielä jäljellä, jäljellä oleva nopeus (`remain_qty_per_hr`) muuttuu arvoksi *Kuorm./päivä*. Muuten arvo on suunniteltu nopeus (`target_qty_per_hr`). Suunniteltu, todellinen ja jäljellä oleva työ säilyvät tiedostossa sellaisina kuin ne ovat. Materiaalin kohdalla suunniteltu nopeus säilyy.

**Vapaa lauantai tai sunnuntai, jota ei ole tiedostossa.** Jotkin P6-viennit siirtävät viikonlopun vapaan päivän useamman vapaan päivän jakson sisältä edeltävälle perjantaille tai seuraavalle maanantaille. Jos kalenterissa työskennellään lauantaisin tai sunnuntaisin, tuo päivä muuttuisi virheellisesti työpäiväksi. Jos sovellus näkee tuon kaavan vähintään kolmen vapaan päivän jaksossa, se tekee viikonlopun päivästä silti vapaan. Kalenterissa päivä on nimeltään *Calendar exception (weekend reconstruction)*, ja se lasketaan mukaan viestin riviin *N kalenterihuomautusta.* Kalenterissa, jossa ei työskennellä viikonloppuisin, mitään ei muutu.

**Pelivara projektin päättymispäivään asti ilman päättymispäivää.** Onko P6-asetus päällä niin, että pelivara lasketaan projektin päättymispäivään asti, mutta tiedostossa ei ole projektin päättymispäivää eikä yhdenkään tehtävän suunniteltua päättymispäivää? Silloin sovellus kytkee asetuksen *Pelivara lasketaan projektin päättymispäivään asti* pois päältä. Sen jälkeen se laskee myöhäiset päivämäärät takaisinpäin viimeisimmästä varhaisimmasta valmistumispäivästä. Tämä lasketaan mukaan viestin riviin *N P6-aikataulutusasetusta käytti turvallista varavaihtoehtoa.*

**Suoritetut tehtävät raportointipäivällä.** Jotkin tiedostot eivät tallenna suoritetun tehtävän todellisia päivämääriä, vaan ikkunan, joka on raportointipäivän kohdalla. Näkymässä *Päivämäärät tallennettuina* tällainen tehtävä on silloin kapea palkki raportointipäivän kohdalla. Jos tehtävä lasketaan uudelleen ja se siirtyy toiseen paikkaan, se lasketaan mukaan nauhan antamaan tehtävien määrään. Laskentasääntö *Suoritettu tehtävä raportointipäivän ikkunassa* laskee tällaisen ikkunan, ja vain tällä laskentasäännöllä suoritettu tehtävä saa todellisen pelivaran, kun käytössä on vaihtoehto *Suoritettu tehtävä: myöhäiset päivämäärät alkaen raportointipäivästä*. Tämä laskentasääntö on arvio: sovellus on nähnyt tämän toiminnan vain P3-tulosteissa, eikä Primavera vahvista sitä missään. Siksi se on pois päältä jokaisessa valmiissa laskentaprofiilissa, myös profiilissa *Primavera P6*. Se otetaan käyttöön osiossa *Laskentaprofiili ja laskentavaihtoehdot*. Projektille tulee sen jälkeen mukautettu profiili. Katso [Laskentavaihtoehdot ja laskentasäännöt](docs://ref-rekenopties-en-conventies).

**Luvut, joissa desimaalierottimena on pilkku.** P6 tallentaa desimaalierottimen ja tuhaterottimen taulukkoon `CURRTYPE`. Sovellus lukee nämä merkit ennen kuin se muuntaa kestot, työn ja pelivaran. Jos tieto puuttuu, sovellus käyttää desimaalierottimena pistettä. Jos tiedostossa on yhä lukuja, joissa on desimaalipilkku, sovellus ei avaa mitään. Näin aikataulu, jossa luvut on luettu väärin, ei avaudu koskaan.

**Ei mukana** — projekti ilman tehtäviä sekä kahden projektin välinen riippuvuus oikeana riippuvuutena aikataulussa. Katso [Primavera P6 -tiedoston (.xer) avaaminen](docs://howto-xer-openen).

## CSV

**Avaaminen** — kyllä. Sovellus lukee erottimena `;` ja `,`. Se tunnistaa sarakeotsikot englanniksi ja hollanniksi (esimerkiksi `Name` tai `Naam`, `Duration` tai `Duur`, `Predecessors` tai `Voorgangers`). Päivämäärät voivat olla muodossa *vvvv-kk-pp*, *pp.kk.vvvv* tai *pp/kk/vvvv*. Edeltäjä kirjoitetaan WBS-koodina, riippuvuustyyppinä ja viiveenä, esimerkiksi `1.2FS+2d`. Laskentaprofiili: *Open Planner Studio*. Projektin nimi on *CSV Import*. Sarake `Task Type` sisältää työlajin, ei tehtävätyyppiä. Sovellus lukee myös otsikot `Werksoort` ja `Work category`. Arvo `Task Type`, joka ei ole yksikään kiinteistä koodeista (kuten `CONSTRUCTION` tai `INSTALLATION`, jotka sovellus kirjoittaa itse), muuttuu mukautetuksi työlajiksi kohdassa *Tästä projektista*, ei kohdassa *Omat työlajit*. Kentässä `OPS Custom Task Type ID` säilyy mukautetun työlajin tunnus.

**Tallentaminen** — ei.

**Vienti** — kyllä, muodossa *CSV (;)* (*Yleinen taulukkovienti. Kaikki tehtävät päivämäärineen ja kestoineen.*), kortilla *CSV (puolipisteillä erotettu)*. Tiedostossa erottimena on puolipiste. Tiedosto on UTF-8-muodossa BOM-merkillä, ja sarakeotsikot ovat englanniksi.

**Mukana** — tehtävää kohti nämä sarakkeet: `OPS Task ID`, `WBS`, `Outline Level`, `Name`, `Duration (days)`, `Start`, `Finish`, `Predecessors`, `Task Type`, `OPS Custom Task Type ID`, `Status`, `Completion (%)`, `Actual Start`, `Actual Finish`, `Critical`, `Total Float` ja `Description`. Sarake `Task Type` sisältää työlajin. Valmiusaste on kokonaisina prosentteina. Viive tunteina saa tuntimerkin sovelluksen kielestä: `1.2FS+2h` englanniksi, `1.2FS+2u` hollanniksi. Avaaminen lukee molemmat.

**Ei mukana** — resurssit, resurssikohdistukset, kalenterit, rajoitteet, tavoitepäivät, perustasot ja raportointipäivä. Jos päivämäärät ovat näkymässä *Päivämäärät tallennettuina*, vienti jättää sarakkeet `Critical` ja `Total Float` tyhjiksi niiden tehtävien kohdalla, joiden lähdetiedostossa niitä ei ole tallennettu.

## Edistymistaulukko (Excel ja CSV)

**Avaaminen** — kyllä, kohdasta *Tiedosto › Tuo* (*Tuo edistyminen taulukosta*) tai samannimisestä painikkeesta valintanauhan ryhmässä *Edistyminen* välilehdillä *Aikataulu*, *Taulukko* ja *Raportti*. Sovellus lukee `.xlsx`- ja `.csv`-tiedostoja, enintään 16 MB ja 50 000 riviä. Tämä ei avaa projektia: se päivittää avoimen projektin edistymisen. Katso [Edistymisen tuominen taulukosta](docs://howto-voortgang-importeren).

**Tallentaminen** — ei.

**Vienti** — kyllä, muodossa *Edistymistaulukko (Excel)* (luettelossa *Edistyminen (Excel)*) ja *Edistymistaulukko (CSV)* (*Edistyminen (CSV)*). Oletusnimi: *projectname-voortgang*. Painike *Vie edistymisen taulukko* samassa valintanauhan ryhmässä tekee Excel-taulukon yhdellä napsautuksella. Excel-taulukossa on kiinteät sarakeleveydet, lukitut kentät ja päivämäärien tarkistus. CSV-taulukko on sama sisältö pelkkänä tekstinä.

**Mukana** — sarakkeet `OPS Task ID`, `WBS`, `Name`, `Start`, `Finish`, `Completion (%)`, `Actual Start` ja `Actual Finish`. Tuotaessa sovellus lukee sarakkeet `Completion (%)`, `Actual Start` ja `Actual Finish`. `Start` ja `Finish` vain tunnistavat päivämäärämuodon eivätkä muuta aikataulua. Rivit linkitään tehtäviin tunnuksella `OPS Task ID` tai muutoin yksilöllisellä WBS-koodilla.

**Ei mukana** — kaikki näiden sarakkeiden ulkopuolella: kesto, riippuvuudet, resurssit ja muu aikataulu. Yhteenvetotehtävä ei saa edistymistä taulukosta.

## PDF

**Avaaminen** — ei.

**Tallentaminen** — ei.

**Vienti** — kyllä, raportista: välilehdellä *Raportti* painike *Vie PDF*. Sovellus ei lähetä raporttia itse tulostimelle. Paperille pääsee PDF:n kautta. Sisältö riippuu siitä, mikä raporttityyppi on valittu, katso [Raporttityypit](docs://ref-rapporttypes) ja [Raportin tekeminen ja tulostaminen](docs://howto-rapport-maken-en-afdrukken).

## Katso myös

- [Tiedostot ja muodot](docs://uitleg-bestanden): miksi IFC on oma muoto ja mitä vienti menettää, esimerkin kanssa.
- [Tiedoston avaaminen ja tallentaminen](docs://howto-bestand-openen-en-opslaan): vaiheet.
- [Vienti](docs://howto-exporteren): muodon valinta ja viestit viennin jälkeen.
- [Päivämäärät tallennettuina](docs://uitleg-datums-zoals-opgeslagen): miksi avattu tiedosto voi näyttää muita päivämääriä.
- [Laskentavaihtoehdot ja laskentasäännöt](docs://ref-rekenopties-en-conventies): laskentaprofiilit.

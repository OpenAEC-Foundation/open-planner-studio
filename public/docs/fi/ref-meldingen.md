# Ilmoitukset ja varoitukset

Sovellus kertoo, mitä tapahtuu, neljässä paikassa: alareunan tilarivillä, oikeanpuoleisessa sarakkeessa olevassa *Varoitukset*-paneelissa, ilmoituksissa, jotka näkyvät lyhyen aikaa näytön alareunassa, ja valintanauhan alla olevissa nauhoissa. Tässä artikkelissa kerrotaan kustakin paikasta, mitä siinä näkyy, milloin se näkyy ja mitä siinä voi tehdä. Miksi aikataulu on kriittinen tai ylikuormitettu, kerrotaan kohdassa [Kriittinen polku ja pelivara](docs://uitleg-kritiek-pad). Ylikuormituksen ratkaiseminen on kohdassa [Ylikuormituksen ratkaiseminen](docs://howto-overbezetting-oplossen). Riippuvuuksien luominen on kohdassa [Riippuvuuksien luominen](docs://howto-relaties-leggen).

## Neljän välinen ero

- **Tilarivi** — kiinteä rivi laskureilla. Ne tulevat viimeisimmästä laskennasta ja pysyvät, kunnes aikataulu lasketaan uudelleen.
- **Varoitukset-paneeli** — luettelo, joka on laskureiden takana. Siinä on kaikki, mitä viimeisin laskenta löysi. Napsautus vie tehtävään, riippuvuuteen tai resurssiin. Luettelo johdetaan viimeisimmästä laskennasta, eikä mitään tallenneta.
- **Ilmoitukset** — lyhyet viestit siitä, mitä juuri tehtiin (tallennus epäonnistui, riippuvuus hylättiin, tuonti luettiin). Tiedotteet katoavat itsestään. Virheet pysyvät näkyvissä, kunnes ne suljetaan. Ne eivät ole paneelissa.
- **Valintanauhan alla oleva nauha** — värillinen nauha, jossa on selitys ja yksi painike. Se liittyy asiakirjan tilaan tai toimintatilaan. Se pysyy näkyvissä niin kauan kuin tila on voimassa. Katso *Valintanauhan alla olevat nauhat*.

## Tilarivi

Alareunan tilarivi näyttää vasemmalta oikealle:

- **Tehtävät:** — lehtitehtävien määrä (yhteenvetotehtävät eivät ole mukana).
- **Välitavoitteet:** — välitavoitteiden määrä.
- **Kriittinen polku: N tehtävää, N työpäivää** — kriittisten tehtävien määrä ja projektin kesto. Näkyy vain laskennan jälkeen.
- **Loppu:** — projektin päättymispäivä laskennasta. Näkyy vain laskennan jälkeen; tyhjässä projektissa sitä ei ole.
- **N tavoitepäivä(ä) ylitetty**, **N rajoite(tta) rikottu**, **N järjestyksestä poikkeava edistyminen** ja **N resurssi(a) ylikuormitettu** — kukin on painike, jossa on varoitusmerkki. Se näkyy vain, kun laskuri on yli 0 ja laskenta on tehty. Napsautus avaa *Varoitukset*-paneelin (vihjeteksti: *Avaa varoituspaneeli (tiedot ja navigointi)*). Jos välilehti on *IFC* tai *Raportti*, sovellus siirtyy samalla kohtaan *Aloitus*, koska oikeanpuoleista saraketta ei ole siellä. Laskuri *N resurssi(a) ylikuormitettu* päivittyy myös resurssien ja resurssikohdistusten muutosten jälkeen. Muut laskurit muuttuvat vasta, kun *Laske*-komento on suoritettu. Nämä neljä laskuria ovat valinta: se, mitä paneeli näyttää lisäksi (katkaistu limitys, ohitettu riippuvuus, riippumatto ilman loppua ohjaavaa riippuvuutta, katkaistu loppupäivä, aikataulun virhe), ei ole tilarivillä.
- **Vanhentunut — laske uudelleen (F5)** — varoitusmerkillä (vihjeteksti: *Aikataulu on vanhentunut — laske uudelleen (F5)*). Näkyy heti, kun jotakin muutetaan, mikä vaikuttaa aikatauluun, eikä aikataulua ole laskettu uudelleen. Kun *Laske automaattisesti* on päällä, se ei näy. Poikkeus on laskennan virhe: silloin se jää näkyviin.
- **Valinta: N tehtävä(ä)** — valittujen tehtävien määrä. Näkyy vain, kun jotakin on valittu.
- **Mittakaava:** ja **Zoom: N px/päivä** — aikajanan aikaskaala ja zoomitaso. Aikaskaala määräytyy zoomitasosta.
- **Tallentamaton** — niin kauan kuin asiakirjassa on muutoksia, joita ei ole tallennettu tiedostoon.
- **AI** — väripiste ja sana AI, vain kun AI-tila on päällä. Vihjeteksti näyttää *AI-silta:* ja tilan: *Pois*, *Aktiivinen portissa N*, *Portti N on varattu* tai *Virhe*. Napsautus avaa *AI*-välilehden.
- **Debug-terminaali** — terminaalipainike, joka näkyy vain, kun debug-terminaali on otettu käyttöön. Se näyttää tai piilottaa terminaalin (*Näytä debug-terminaali* / *Piilota debug-terminaali*).

## Varoitukset-paneeli

- **Avaaminen** — *Aikataulu › Aikataulu › Varoitukset*, *Näkymä › Paneelit › Varoitukset*, tai laskuri tilarivillä. Paneeli on oikeanpuoleisessa sarakkeessa, *Ominaisuudet*-paneelin ja resurssitelakan alapuolella. Se avaa supistetun sarakkeen. Oletuksena paneeli on suljettu, eikä sitä muisteta istuntojen välillä. Kun paneeli on muiden paneelien alla, sen korkeutta muutetaan vetämällä reunasta. Tämä korkeus muistetaan. Rasti oikeassa yläkulmassa sulkee paneelin (*Sulje varoitukset*).
- **Otsikkorivi** — *Virheitä: N, varoituksia: N*. Jos mitään ei ole vielä laskettu, näkyy *Ei vielä laskettu — paina Laske (F5) suorittaaksesi tarkistukset*.
- **Laske** — painike otsikkorivillä. Se näkyy, niin kauan kuin aikataulu on vanhentunut tai sitä ei ole vielä laskettu. Se tekee saman kuin *Laske* valintanauhassa.
- **Varoitusmerkki otsikkorivillä** — kun aikataulu on vanhentunut, vihjetekstinä *Aikataulu vanhentunut — tämä luettelo on viimeisimmästä laskennasta. Laske uudelleen (F5)*. Luetteloa ei piiloteta, vaan se merkitään vanhentuneeksi.
- **Tyhjä luettelo** — *Ei varoituksia. Aikataulu täyttää kaikki tarkistukset*.
- **Rivi** — ylhäällä paikka (tehtävä, riippuvuus, resurssi tai projekti) ja sen alla kuvaus. Virheellä on oma kahdeksankulmainen merkki, varoituksella kolmionmuotoinen merkki. Tehtävä näkyy muodossa `WBS-nimi`. Riippuvuus näkyy muodossa `edeltäjä → seuraaja (FS+2d)`, tyyppi ja viive mukaan lukien. Napsautus vie paikkaan (vihjeteksti *Siirry: …*), katso alla. Rivi, joka kuuluu aktiiviseen tehtävään (riippuvuudessa sen seuraajaan) tai histogrammissa valittuun resurssiin, korostetaan.
- **Järjestys** — ensin virheet. Sen jälkeen rivit lajeittain alla olevan luettelon järjestyksessä. Lajin sisällä järjestys on asiakirjan mukainen: riippuvuudessa seuraajan mukaan, resurssissa resurssiluettelon mukaan. Tehtävä, riippuvuus tai resurssi, joka on poistettu viimeisimmän laskennan jälkeen, poistuu luettelosta.

### Varoitustyypit

- **Aikataulun virhe** — *Aikataulua ei voitu laskea: …* ja syy sen jälkeen, katso alla. Napsautus: kehän tapauksessa sovellus valitsee kaikki kehän tehtävät ja siirtyy ensimmäiseen. Muissa virheissä ei ole kohdetta, johon siirtyä, eikä rivi ole painike.
- **Tavoitepäivä ylitetty** — *Tavoitepäivä {date} ylitetty — varhaisin valmistumispäivä {date}*. Tehtävällä on tavoitepäivä, eikä laskenta täytä sitä. Napsautus siirtää tehtävään. Korjaus: muokkaa logiikkaa tai kestoa, tai siirrä tavoitepäivää.
- **Rikottu rajoite** — *Logiikka ylittää rajoitteen {type and date} (negatiivinen pelivara)*. Rajoitetta ei voida täyttää rikkomatta logiikkaa, ja pelivara on negatiivinen. Napsautus siirtää tehtävään. Katso [Rajoitteet](docs://uitleg-constraints).
- **Järjestyksestä poikkeava edistyminen** — *Järjestyksestä poikkeava edistyminen: seuraajan edistyminen on ristiriidassa riippuvuuden kanssa*. Seuraajan edistyminen ei sovi riippuvuuden tyyppiin. Esimerkiksi seuraaja on jo käynnissä, vaikka edeltäjää ei ole vielä tehty lopusta alkuun -riippuvuudessa. Napsautus valitsee molemmat tehtävät, ja seuraaja on aktiivinen. Tarkista todelliset päivämäärät tai riippuvuus.
- **Limitys katkaistu** — *Limitys katkaistu projektin aloituspäivän vuoksi — riippuvuutta ei noudateta täysin*. Riippuvuuden limitys ulottuu projektin aloituspäivää ennen. Napsautus valitsee molemmat tehtävät.
- **Riippuvuus ohitettu** — *Riippuvuus ohitettu: edeltäjä tai seuraaja puuttuu tai ei ole lehtitehtävä*. Laskenta ei käytä riippuvuutta. Napsautus valitsee tehtävät, jotka ovat yhä olemassa. Katso [Riippuvuudet](docs://uitleg-relaties).
- **Riippumatto ilman loppua ohjaavaa riippuvuutta** — *Riippumatto ilman loppua ohjaavaa riippuvuutta (ei FF- tai SF-edeltäjää): kesto palautuu nollaan*. Napsautus siirtää tehtävään. Katso [Riippumattotehtävät](docs://howto-hammock).
- **Loppupäivä katkaistu** — *Loppupäivä katkaistu: kalenteri tekee tehtävän aikaikkunasta käyttökelvottoman*. Laskenta saavutti hakemiensa päivien enimmäismäärän, esimerkiksi siksi, että kalenterissa on hyvin pitkä yhtäjaksoinen sarja vapaapäiviä. Napsautus siirtää tehtävään. Katso [Kalenterit ja työpäivät](docs://uitleg-kalenders).
- **Ylikuormitus** — *Ylikuormitus N pv (first – last)*. Jos kaikki päivät ovat vapaapäiviä, lisätään *resurssi ei tee työtä näinä päivinä kalenterinsa mukaan*. Sekatapauksessa lisätään *joista N pv resurssi ei tee työtä kalenterinsa mukaan*. Napsautus valitsee tehtävät, joilla on resurssikohdistus kyseiseen resurssiin, kytkee histogrammin päälle ja valitsee siinä kyseisen resurssin. Välilehdeltä *Taulukko*, *IFC* tai *Raportti* sovellus siirtyy kohtaan *Resurssit*. Katso [Resurssipaneeli](docs://ref-resourcepaneel).

### Aikataulun virheen syyt

- *Kehäriippuvuus tehtävien välillä: {path}* — riippuvuudet muodostavat kehän. Tehtävät ovat polussa. Käännä tai poista yksi riippuvuus.
- *Kalenterissa ei ole asetettu työpäiviä* — anna kalenterille vähintään yksi työpäivä, katso [Kalenteriajat](docs://ref-kalenders).
- *Virheellinen kesto päivinä tehtävälle '{task}'* ja *Virheellinen kesto tunteina tehtävälle '{task}'* — tehtävän kesto ei ole kelvollinen luku.
- *Tuntitehtävällä '{task}' ei ole kelvollisia työtunteja kalenterissaan* — tehtävä on tuntitehtävä, ja sen kalenterissa ei ole työtunteja.
- *Virheellinen aloituspäivä tehtävälle '{task}'* — tehtävän aloituspäivä ei ole kelvollinen.

## Valintanauhan alla olevat nauhat

Nauha sijaitsee suoraan valintanauhan alla, työalueen yläpuolella. Siinä on teksti ja yksi painike. Toimintatilan nauhassa ei ole ristiä. Muut nauhat suljetaan ristillä. Viisi nauhaa:

- **Linkitystila** — *Linkitystila: vedä Gantt-kaaviossa palkista toiseen luodaksesi riippuvuuden. Esc lopettaa*. Se pysyy näkyvissä niin kauan kuin linkitystila on päällä. Painike: *Lopeta*. Katso [Riippuvuuksien luominen](docs://howto-relaties-leggen).
- **Jaettu tehtävä** -tila — *Napsauta palkkia päivänä, jona tauko alkaa, ja vedä oikealle sen pituudeksi. Esc lopettaa*. Se pysyy näkyvissä niin kauan kuin *Jaa tehtävä* on päällä. Painike: *Lopeta*.
- **Tuntisuunnittelu tiedostossa** — *Tämä tiedosto sisältää tuntisuunnittelua*. Se näkyy, kun avatussa tiedostossa on tuntisuunnittelua ja *Ota tuntisuunnittelu käyttöön* on pois päältä. Painike: *Ota tuntisuunnittelu käyttöön*. Katso [Tuntisuunnittelun ottaminen käyttöön](docs://howto-urenplanning-aanzetten).
- **Rakenne lukittu** — *Ei käytettävissä suodatuksen, ryhmittelyn tai lajittelun aikana*. Se näkyy, kun tehtäviä ei voi sisentää tai ulontaa, koska tehtävätaulukko on suodatettu, ryhmitelty tai lajiteltu. Painike *Tyhjennä* poistaa suodatuksen, ryhmittelyn ja lajittelun.
- **Tallennetut päivämäärät** — Tiedoston avaamisen jälkeen, kun uudelleenlaskenta on siirtänyt päivämääriä: *Uudelleenlaskenta siirsi N tehtävää M:stä pois tiedoston päivämääristä.* Painike: *Näytä tallennetut päivämäärät*. Kun tämä näkymä on päällä: *Näytetään päivämäärät sellaisina kuin ne on tallennettu tiedostoon …* Painike: *Laske uudelleen*. Katso [Tallennetut päivämäärät](docs://uitleg-datums-zoals-opgeslagen).

## Ilmoitukset

Ilmoitukset näkyvät näytön alareunassa, myös taulukossa, Backstagessa ja esitystilassa. Ilmoitus on *virhe* tai *tieto*. Virhe on punainen, ja se pysyy näkyvissä, kunnes rastia napsautetaan. Tieto katoaa 5 sekunnin kuluttua. Ilmoitus, jossa on paljon selitystä, pysyy pidempään. Ajastimet alkavat alusta, kun pino muuttuu. Jokaisessa ilmoituksessa on rasti oikeassa yläkulmassa (vihjeteksti *Sulje ilmoitus*). Se sulkee ilmoituksen heti. Ilmoituksen tekstin napsauttaminen ei tee mitään. Hylkäys on aina virhe. Se on ilmoitus siitä, ettei sovellus suorittanut jotakin muutosta, kuten hylättyä riippuvuutta, kestoa, alkua tai välitavoitetta. Näin hylkäys ei jää huomaamatta, vaikka katse olisi hetkeksi muualla. Hylkäys katoaa Ctrl+Z:n tai Ctrl+Y:n jälkeen ja kun siirrytään toiseen asiakirjaan, koska se ei silloin enää pidä paikkaansa. Muu virhe, kuten *Tallennus epäonnistui*, pysyy näkyvissä. Sama koskee tilannetta, jossa saman toimenpiteen muu osa onnistui, esimerkiksi liitettäessä useisiin soluihin. Jos mukana on useita tehtäviä, rivi alla kertoo, mitkä tehtävät jätettiin muuttamatta, esimerkiksi *Ei muutettu: Foundation, Masonry.* Kun tehtäviä on yli viisi, rivi päättyy tekstiin *ja N tehtävää lisää*. Sama hylkäys kootaan yhdeksi riviksi laskurilla, kun se toistuu. Kerrallaan näkyy enintään kolme ilmoitusta. Kun neljäs tulee, poistuu ensin vanhin tieto. Jos tietoa ei ole, poistuu ensin vanhin hylkäys, sitten vanhin pysyvä avausilmoitus ja vasta sitten vanhin virhe. Tieto tai hylkäys ei siis koskaan työnnä pois toista virhettä, kuten *Tallennus epäonnistui*. Pino siirtyy pois avoimen valintaikkunan painikkeista ja pysyvistä toimintapalkeista. Tiedoston avaamisen yhteydessä näkyvä ilmoitus pysyy näkyvissä, kunnes rastia napsautetaan, jos sovellus täydensi, korvasi, korjasi tai jätti pois tietoja avatessaan. Kyse voi olla rivistä jäsentäjän tai kalenterin huomautuksista, lukumuodon ongelmista, luettelo-arvojen varavaihtoehdoista, P6-aikataulutusasetuksista, jotka käyttivät turvallista varavaihtoehtoa, suojaavasta perustason varavaihtoehdosta, ohitetuista perustason viittauksista, tehtävistä ilman suunniteltua alkua, joille annettiin alku, projektien välisistä riippuvuuksista tai tehtävistä ilman projektia, joita ei tuotu (P6 XML), jostakin MS Project -tiedostosta, jota ei tuotu (MS Project XML ja `.mpp`), tai käyttökelvottomasta XER-lähdearkistosta. Samoin kyse voi olla ilmoituksista kaksoistunnuksista ja riippuvuuksista, joita ei lasketa. Jos ilmoitus sisältää vain tietoa ilman tällaista muutosta, kuten projektien tai asiakirjojen määrän tai tekstin merkistökoodauksen, se katoaa 5 sekunnin kuluttua.

- **Laskuri ×N** — ilmoitus, jolla on kiinteä avain, kokoaa toiston yhdeksi riviksi laskurilla, esimerkiksi tallennusvirheen, joka toistuu, tai hylätyn riippuvuuden, jota toistetaan. Kaikki ilmoitukset eivät tee näin.
- **Lue lisää** — joillakin ilmoituksilla on linkki *Lue lisää* tai oma aihe (esimerkiksi *Tehtävätyypit selitettynä*), joka vie oppaaseen kohdassa Backstage › Ohje.
- **Toimintopainike** — ilmoituksessa laskentaprofiilista on painike *Avaa laskentaprofiili*, joka vie kohtaan Projektitiedot.

Alla oleva luettelo on valinta, ryhmitelty aiheen mukaan. Jos muuta ei mainita, ilmoitus on tieto.

### Tallentaminen, avaaminen ja palautus

- **Tallentaminen epäonnistui** (virhe) — *Tallennus epäonnistui* ja syy sen alla. Näkyy, kun tallennetaan, tallennetaan nimellä ja viedään raportti.
- **Tallennettu latauksena** (tieto) — *Tallennettu latauksena: '{name}' on nyt latauskansiossa. …* Näkyy kohdassa *Tallenna nimellä* ja vienneissä, kun ympäristö ei anna sovelluksen kirjoittaa suoraan valittuun sijaintiin. Kaksi peräkkäistä latausta kootaan yhdeksi.
- **Tallennettu latauksena (selitys)** (tieto, 15 sekuntia) — *Tallennettu latauksena: '{name}' on latauskansiossa. Tämä selain ei anna sovelluksen kirjoittaa omaan sijaintiinsa, …* Näkyy kohdassa *Tallenna* selaimessa, joka tallentaa vain latauksena. Kerran istunnossa, linkillä tiedostoja koskevaan selitykseen.
- **Selain ei kirjoita takaisin** (tieto, 15 sekuntia) — *Tämä selain ei anna sovelluksen kirjoittaa takaisin tiedostoon '{name}'. …* Näkyy kohdassa *Tallenna* projektilla, jolla on tiedosto, kun selaimelta on pyydettävä sijainti uudelleen. Kerran istunnossa, linkillä tiedostoja koskevaan selitykseen.
- **Automaattitallennus epäonnistui** (virhe) — *Automaattitallennus epäonnistui* ja syy. Koskee automaattista tallennusta tiedostoon ja palautusta varten.
- **Kirjastoa ei voitu tallentaa** (virhe) — *Kirjastoa ei voitu tallentaa*, kun tallennetaan resurssikirjastoa.
- **Tiedoston avaaminen epäonnistui** (virhe) — *Avaaminen epäonnistui* ja syy. Esimerkiksi viimeksi käytetyn tai tuodun tiedoston kohdalla.
- **Vanha tai suojattu .mpp** (virhe) — *Tämä .mpp-tiedosto on vanhemmassa muodossa (Project 2007 tai vanhempi) …* tai *Tämä .mpp-tiedosto on salasanalla suojattu …*. Molemmissa neuvotaan viemään tiedosto XML-muodossa MS Projectista ja avaamaan se.
- **Virheellinen XER-tiedosto** (virhe) — jokin XER-teksteistä, esimerkiksi *Tämä ei ole kelvollinen tai tuettu XER-tiedosto.* tai *XER-tiedosto sisältää taulun kahdesti.*, syy lisättynä.
- **IFC-tiedostoa ei voitu lukea** (virhe) — *IFC-tiedostoa ei voitu lukea* ja syy, IFC-näkymässä.
- **Palautus** (virhe) — *Palautettua tiedostoa ei voitu lukea*, *Palautus epäonnistui* ja *N palautustiedostoa ei voitu ladata ja ne ohitettiin.* Kun palautetaan odottamattoman sulkeutumisen jälkeen.
- **Haara tallennettiin mallina** (tieto) — *Haara tallennettiin mallina '{name}'*.
- **Viesti laajennuksesta** (tieto, tai virhe, jos laajennus kertoo virheestä) — *Laajennus {name}: {message}*. Laajennus saa näyttää enintään kolme uutta ilmoitusta **10** sekunnin aikana, ettei se täytä pinoa. Jos laajennuksen vaihe epäonnistuu, siinä lukee *Laajennuksen {name} vaihe aiheutti virheen. Opastus jatkuu.* Ja jos laajennuksen projektitiedostoa ei voi avata, siinä lukee *Laajennuksen {name} projektitiedostoa {file} ei voitu avata.* Molemmat ovat virheitä.
- **Muutos tuli väliin** (virhe) — *Tekoälyavustajan tai laajennuksen muutos tuli väliin. …* Kun tehtäväikkuna peruutetaan ja tekoälyavustaja tai laajennus on sillä välin muuttanut jotakin. Tehtävämuutokset, jotka tehtiin ennen sitä muutosta, eivät kumoudu. Ne jäävät tavallisiksi vaiheiksi kohtaan *Kumoa*.

### Laskenta

- **Aikataulua ei voitu laskea** (virhe) — *Aikataulua ei voitu laskea* ja syy sen alla (katso *Aikataulun virheen syyt*). Näkyy, kun valitaan *Laske*, kun vaihdetaan asiakirjaa ja kun tiedosto avataan.
- **Raportointipäivä asetettu tähän päivään** (tieto) — *Raportointipäivä asetettu tähän päivään ({date}).* Näkyy, kun edistystä kirjataan projektiin ilman raportointipäivää. Sovellus mittaa edistymisen raportointipäivään asti, joten ilman raportointipäivää se ei voi käsitellä edistystä. Eri päivän voi asettaa kohdassa *Aikataulu › Perustasot ja edistyminen › Raportointipäivä*. Linkillä *Lue lisää* pääsee sivulle [Edistyminen, raportointipäivä ja perustaso](docs://uitleg-voortgang).
- **Kesto lyhyempi kuin tehty työ** (virhe) — *'{name}' on jo {N} % tehty: kesto, joka on lyhyempi kuin tehty työ, ei ole mahdollinen. Kestoa ei muutettu.*

### Riippuvuudet ja rakenne

- **Riippuvuus hylätty** (virhe) — *Tämä riippuvuus on jo olemassa*, *Riippuvuus tehtävän ja sen oman tai sen yläpuolisen yhteenvetotehtävän välillä ei ole sallittu* tai *Tämä riippuvuus loisi aikatauluun kehän ({cycle}), joten sitä ei luotu.* Kehästä näkee tehtävät, joten nähdään, mikä riippuvuus on poistettava tai käännettävä ensin.
- **Siirto hylätty** (virhe) — *Tämä siirtymä loisi aikatauluun kehän ({cycle}): yhteenvetotehtävän riippuvuudet koskevat myös sen alitehtäviä. Mitään ei siirretty.*
- **Riippuvuudet putoavat pois siirron jälkeen** (tieto) — *Siirron jälkeen N riippuvuutta liittää tehtävän sen omaan yhteenvetotehtävään. Ne eivät enää ole mukana laskennassa.*
- **Riippuvuuksia ohitettiin lisättäessä** (virhe) — *N riippuvuutta ei luotu: virheellinen riippuvuus…*, kun liitetään tai lisätään haara. Rivi alla kertoo, mitkä riippuvuudet eivät syntyneet, esimerkiksi *Ei luotu: Foundation → Masonry.*
- **Riippuvuuksia ei lasketa tuonnin jälkeen** (tieto) — *Riippuvuuksia ei voitu ottaa mukaan laskentaan: N. Tarkista Edeltäjät- ja Seuraajat-sarakkeet.*
- **Kaksoistunnukset tuonnin jälkeen** (tieto) — *Tässä tiedostossa on kohteita, joilla on kaksoistunnus: N. Ne saivat oman tunnuksensa…*

### Tehtävien muokkaaminen

- **Alku kirjattiin rajoitteeksi** (tieto) — *'{name}' alkaa aikaisintaan {date} (SNET).* Näkyy, kun muutetaan tehtävän alkua, jolla on edeltäjä. Edeltäjä määrää alun, joten sovellus kirjaa annetun päivän rajoitteeksi *alkaa aikaisintaan* (SNET). Kun aikataulu lasketaan uudelleen (F5), tehtävä ei ala ennen sitä päivää. Jos tehtävällä oli jo tällainen rajoite, siinä lukee *'{name}' alkaa nyt aikaisintaan {date} (SNET).* Useiden tehtävien kohdalla kerrotaan niiden määrä. Linkillä *Lue lisää* pääsee sivulle [Rajoitteet ja tavoitepäivät](docs://uitleg-constraints).
- **Alkua ei käytetty** (virhe) — *Tehtävän '{name}' uutta alkua ei käytetty: tehtävällä on edeltäjä, ja rajoite {type} {date} määrää sen alun. Alun siirtämiseksi rajoitetta on muutettava.*
- **Välitavoite hylätty** (virhe) — *'{task}' on resurssikohdistuksia, eikä siitä voi tulla välitavoitetta. Poista ensin resurssikohdistukset.* tai *'{task}' on yhteenvetotehtävä, jolla on alitehtäviä, eikä siitä voi tulla välitavoitetta.* Näkyy, kun muunnetaan tehtäväikkunassa, ominaisuuspaneelissa, pikavalikossa tai taulukossa.
- **Kohdistukset siirrettiin alitehtävään** (tieto) — *Kohdistus siirrettiin alitehtävään '{child}'.* tai *N kohdistusta siirrettiin alitehtävään '{child}'.* Näkyy, kun laajennus antaa alitehtäviä tehtävälle, jolla on resurssikohdistuksia. Tehtävästä tulee yhteenvetotehtävä, eikä yhteenvetotehtävällä voi itsellään olla resurssikohdistuksia. Ne siirretään sen vuoksi ensimmäiseen uuteen alitehtävään. Sovelluksessa tämän valitaan ikkunassa *Tehtävästä tulee yhteenvetotehtävä*, eikä tätä ilmoitusta näytetä. Linkillä *Lue lisää* pääsee sivulle [Rakenteen muokkaaminen](docs://howto-structuur-aanpassen).
- **Välitavoitemerkintä poistettu** (tieto) — *'{phase}' ei ole enää välitavoite.* Näkyy, kun välitavoitteelle lisätään alitehtäviä. Välitavoite on hetki ilman alitehtäviä. Alitehtävien kanssa siitä tulee yhteenvetotehtävä. Linkillä *Lue lisää* pääsee sivulle [Rakenteen muokkaaminen](docs://howto-structuur-aanpassen).
- **Kysymys vanhentunut** (virhe) — *Tehtävät tai resurssikohdistukset muuttuivat, kun kysymys oli auki. Mitään ei muutettu; yritä uudelleen.* Näkyy, kun valitaan ikkunassa *Tehtävästä tulee yhteenvetotehtävä*, mutta kysymys ei enää vastaa muuttunutta tilaa.
- **Yhteenvetotehtävä hylätty** (virhe) — *'{phase}' ei voi tulla yhteenvetotehtäväksi: …* syy mukana, ja *Mitään ei muutettu.* Näkyy, kun laajennus antaa alitehtäviä tehtävälle, jolla on resurssikohdistuksia, eikä kohdistuksia voi siirtää ensimmäiseen uuteen alitehtävään. Sovelluksessa itsessään tätä ilmoitusta ei näytetä: siellä ikkuna *Tehtävästä tulee yhteenvetotehtävä* kysyy, mitä tehdään, ja *Siirrä* on silloin pois käytöstä.
- **Soluja ohitettiin liitettäessä** (virhe) — *Ohitettiin N solua: ne ovat vain luku -tilassa (esimerkiksi automaattisesti numeroitu WBS-koodi tai laskettu sarake).*
- **Viitteet tyhjennettiin liitettäessä** (tieto) — *N viittausta ei ollut tässä dokumentissa ja ne tyhjennettiin (tehtäväkalenterit, mukautetut työlajit, tehtäväkoodit tai mukautetut kentät lähdedokumentista).*
- **Rakenne on lukittu** (virhe, punainen nauha valintanauhan alla) — *Ei käytettävissä suodatuksen, ryhmittelyn tai lajittelun aikana*, painikkeella *Tyhjennä*. Tämä näkyy, kun luettelo on suodatettu, ryhmitelty tai lajiteltu ja tehtävää sisennetään, ulontaa tai vedetään, sekä kun käytetään painikkeita *Lisää yläpuolelle* tai *Lisää alapuolelle* (pikavalikko tai pikanäppäin). Nauha pysyy näkyvissä, kunnes rastia napsautetaan, käytetään Ctrl+Z:aa tai Ctrl+Y:tä tai siirrytään toiseen asiakirjaan. Katso [Rakenteen muokkaaminen](docs://howto-structuur-aanpassen).
- **Tehtävä lisättiin loppuun** (virhe) — *Uusi tehtävä lisättiin loppuun. Suodatuksen, ryhmittelyn tai lajittelun aikana sovellus ei voi sijoittaa sitä valinnan alle.* painikkeella *Tyhjennä*. Näkyy, kun valitaan *Tehtävä* tai *Välitavoite ▾* ja tehtävä on valittuna, kun luettelo on suodatettu, ryhmitelty tai lajiteltu. Tehtävä lisätään, mutta alimpaan kohtaan. *Tyhjennä* poistaa suodatuksen, ryhmittelyn ja lajittelun ja sulkee ilmoituksen. Katso [Tehtävien ja välitavoitteiden lisääminen](docs://howto-taken-en-mijlpalen-toevoegen).
- **Tehtävätyyppi muutti kestoja** (tieto) — *Kalenterimuutoksen jälkeen tehtävätyyppi muutti N tehtävän kestoa (työ pysyy, tuntia päivässä muuttui).* Linkillä *Tehtävätyypit selitettynä*.

### Primavera P6 XML

- **P6 XML -tiedosto avattu** (tieto) — *P6 XML -tiedosto avattu: N projektiasiakirjaa.* Näkyy P6 XML -tiedoston avaamisen jälkeen.
- **Ei tuotu** (pysyy näkyvissä) — *N riippuvuutta projektien välillä ei tuotu riippuvuuksina.* ja *N tehtävää ilman projektia ei luettu.* Kannattaa tarkistaa, onko aikataulu täydellinen.
- **Tyhjä tai käyttökelvoton** (virhe) — mitään ei avaudu. Syitä on kolme: *Tässä tiedostossa ei ole tehtäviä, joita sovellus voi lukea.*, *Tehtävillä ei ole ObjectId-tunnusta.* ja *Tiedosto käyttää XER-sarakkeiden nimiä … Avaa .xer-tiedosto itse.*

### Primavera (XER)

- **XER-tiedosto avattu** (tieto) — *XER-tiedosto avattu: N projektiasiakirjaa.* Yksi ilmoitus tiedostoa kohti, vaikka tiedosto avaa useita projekteja. Ilmoituksessa on linkki *Lue lisää* ja yksityiskohtarivejä sen alla. Aina näkyy *N projektia löytyi.* Vain, kun luku on suurempi kuin 0, näkyvät: *N tyhjää projektia ohitettiin.*, *N projektia perustasosta jätettiin pois.*, *N perustasoa luotiin.*, *N irrallista perustason viittausta ohitettiin.*, *Perustasolle käytettiin suojaavaa varavaihtoehtoa.* ja *N ulkoista riippuvuutta säilytettiin.* Vain muulle merkistölle kuin UTF-8:lle: *Tekstin merkistökoodaukseksi tunnistettiin {encoding}.* Lisäksi, kun luku on suurempi kuin 0: *N jäsentäjän huomautusta.*, *N kalenterihuomautusta.*, *N lukumuodon ongelmaa.*, *N luettelo-arvon varavaihtoehtoa* ja *N P6-aikataulutusasetusta käytti turvallista varavaihtoehtoa.*
- **Päivämäärät sellaisina kuin Primavera ne tallensi** (yksityiskohtarivi samassa ilmoituksessa) — *N tehtävää näyttää päivämäärät sellaisina kuin Primavera ne tallensi (ei laskettuina uudelleen).* N laskee jokaisen tehtävän, jolle tiedosto tallensi päivämäärät, myös ne, jotka eivät poikkea. Jos tätä tilaa ei ole otettu käyttöön, näkyy *N tehtävää eroaa tiedoston päivämääristä — voit näyttää ne.*
- **XER-lähdearkisto käyttökelvoton** (tieto) — *XER-lähdearkisto tässä tiedostossa on käyttökelvoton ja jätettiin pois; projekti itsessään avattiin kokonaan.* Syy, esimerkiksi *Syy: tarkistussumma ei vastaa lähdetavuja – arkisto on vioittunut.*, ja seuraus: *Aikataulu, laskentaprofiili ja kaikki IFC:n projektitiedot ovat täydellisiä. …* Tämä näkyy, kun avataan IFC-tiedosto, jossa aiemmin tallennettua XER-lähdearkistoa ei voi käyttää. Myös palautettaessa odottamattoman sulkeutumisen jälkeen, jos palautustallenne ei enää sisällä lähdearkistoa.
- **Vienti menettää XER-tietoja** (tieto) — *Vienti muotoon {format} menettää XER-lähdetiedot.* Näkyy, kun projekti, jonka tiedot ovat vain XER-tiedostossa, viedään onnistuneesti muuhun muotoon kuin IFC:hen. Mukana on linkki *Lue lisää*.

### Tuonti, vienti ja laskentaprofiili

- **Päivämäärät kuten tiedostossa** (tieto) — *N tehtävää näyttää päivämäärät sellaisina kuin ne ovat tiedostossa (ei laskettuina uudelleen).* (N laskee kaikki tehtävät, joille on tallennettu päivämäärät) tai *N tehtävää eroaa tiedoston päivämääristä — voit näyttää ne.* Näkyy, kun avataan tiedosto, jossa on tallennetut päivämäärät.
- **Työ ja tehtävätyypit näkyvät** (tieto) — *Tämä tiedosto sisältää tallennettua työtä tai tehtävätyyppejä. Tehtävätyyppi ja jäljellä oleva työ näkyvät tälle projektille.*
- **MS Project -aikataulu luettu** (tieto) — *Tämä MS Project -tiedosto sisältää N tehtävää, joiden aikataulu on tauotettu, tasattu tai resurssiohjattu. Ne tuodaan ja näytetään sellaisina.*
- **Taukoja ei viety** (tieto) — *N tehtävää, joissa on taukoja, vietiin ilman taukoja: MS Project ja P6 tuntevat tauot vain työn jakautumisena.* Näkyy, kun viedään MS Projectiin tai Primaveraan.
- **Projektin aloituspäivä siirtyi** (tieto) — *N tehtävää siirtyi projektin aloituksen mukana.* Näkyy, kun projektin aloituspäivä asetetaan myöhemmäksi. Siirtyvät sille päivälle vain tehtävät, joilla ei ole edeltäjää eikä rajoitetta, joka jäisi ennen uutta aloituspäivää. Linkillä *Lue lisää* pääsee sivulle [Uusi projekti ja Projektitiedot](docs://ref-projectinfo).
- **Päivämääräikkuna ei enää ohjaa** (tieto) — *MS Projectin päivämääräikkuna ei enää ohjaa N tehtävää tämän muokkauksen jälkeen; …* Kerran asiakirjaa kohti.
- **Tasamisviive pyöristetty** (tieto) — *Tasaaminen pyöristää N tehtävän MS Projectin minuuttitarkan tasaamisviiveen kokonaisiin työpäiviin.* Kerran asiakirjaa kohti.
- **Laskentaprofiili sovellettu** (tieto) — *Tämä projekti lasketaan tavalla {profile}. Muuta sitä kohdassa Tiedosto → Projektitiedot → Laskentaprofiili ja laskentavaihtoehdot.* Painikkeella *Avaa laskentaprofiili*. Soveltamisen jälkeen seuraa tarvittaessa ilmoitus *Soveltamisen jälkeen N tehtävää siirtyi.*

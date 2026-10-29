# Asetukset

Kaikki sovelluksen asetukset: mitä ne tekevät, niiden alkuarvo, mitä muuttuu ja mistä ne löytyvät. Projektin laskentavaihtoehdot (laskentaprofiili, kriittisyyden määritelmä) on kuvattu artikkelissa [Laskentavaihtoehdot ja laskentasäännöt](docs://ref-rekenopties-en-conventies). Ne kuuluvat projektitiedostoon, eivät sovellukseen.

## Mistä ne löytyvät ja miten ne toimivat

Asetuspaneeli löytyy kolmesta paikasta, ja kaikkialla se on sama paneeli: vaihdekuvake ikkunan yläreunassa, *Asetukset › Projekti › Asetukset* ja *Tiedosto › Asetukset*. Paneelissa on kolme välilehteä: *Ulkonäkö*, *Aikataulu* ja *Lisäasetukset*. Jokainen alla oleva asetus kertoo vain välilehden.

Muutos tulee voimaan heti. Painikkeita *Käytä* ja *Peruuta* ei ole.

**Koko sovellukselle, ei projektikohtaisesti.** Kaikki tämän artikkelin asetukset koskevat kaikkia projekteja ja kuuluvat tähän laitteeseen. Sovellus tallentaa ne sovelluksen tai selaimen tallennustilaan, ei projektitiedostoon. Kun toinen henkilö avaa tiedoston, näkyvät hänen omat asetuksensa. Kun selaimen tallennustila tyhjennetään, asetukset palautuvat alkuarvoihin.

## Ulkonäkö-välilehti

**Teema** — käyttöliittymän väriasetus. Vaihtoehdot: *Tumma*, *Vaalea* ja *Suuri kontrasti*. Oletus: *Tumma*. Vaikutus: koko käyttöliittymän värit, myös Gantt ja histogrammi. Löytyy: *Ulkonäkö*.

**Seuraa järjestelmän teemaa** — käyttöjärjestelmän väriteema päättää. Oletus: pois. Vaikutus: sovellus on *Vaalea* tai *Tumma* järjestelmän mukaan, ja kolme teemakorttia ovat silloin pois käytöstä. *Suuri kontrasti* ei seuraa järjestelmää, vaan se valitaan itse. Kun tämä kytketään pois, näytössä oleva teema jää voimaan. Löytyy: *Ulkonäkö*, kohdasta *Teema*.

**Kieli** — käyttöliittymän kieli. Oletus: selaimen tai järjestelmän kieli, jos sovellus tuntee sen, muuten englanti. Vaikutus: kaikki sovelluksen tekstit. Kielet on lajiteltu niiden lyhyen koodin mukaan. Arabia ja persia peilaavat käyttöliittymän oikealta vasemmalle. Ohjeartikkelien kielen asetetaan erikseen kohdassa *Dokumentaation kieli* valikossa *Tiedosto › Ohje*. Löytyy: *Ulkonäkö*.

**Fontti** — käyttöliittymän fontti. Vaihtoehdot: *Oletus*, *Järjestelmä*, *Serif* ja *Monospace*. Oletus: *Oletus*. Vaikutus: ikkunan otsikot ja teksti sekä Ganttin ja histogrammin teksti. Verkkosovellus ei seuraa järjestelmän fonttia itsestään. Siksi fontti valitaan täällä. Löytyy: *Ulkonäkö*.

**Tekstikoko** — käyttöliittymän koko. Vaihtoehdot: 90%, 100%, 110% ja 125%. Oletus: 100%. Vaikutus: valintanauhan, paneelien ja ikkunoiden teksti ja asettelu kasvavat tai pienenevät. Taulukon ja Ganttin rivikorkeus skaalautuu mukana. Yli 125% ei ole vaihtoehto, koska valintanauhan painikkeiden tekstit jakautuisivat silloin useille riveille. Löytyy: *Ulkonäkö*.

**Päivämäärän muoto** — tapa, jolla päivämäärät näkyvät sovelluksessa. Vaihtoehdot: *pp.kk.vvvv*, *kk.pp.vvvv* ja *vvvv-kk-pp*. Oletus: *pp.kk.vvvv*. Vaikutus: päivämäärät taulukossa, ikkunoissa, raporteissa ja tulosteessa. Tiedostot ja laskenta eivät muutu, vain näyttö muuttuu. Löytyy: *Ulkonäkö*.

**Kellonajan muoto** — tapa, jolla kellonajat näkyvät sovelluksessa. Vaihtoehdot: *24 tuntia (13:00)* ja *12 tuntia (1:00 PM)*. Oletus: *24 tuntia (13:00)*. Vaikutus: kellonajat kalenteri-ikkunassa, tehtävien päivämäärä ja aika tunneissa (taulukko, jaot, viestit) sekä *Tunti*-aikaskaala Ganttissa. Kellonaikakentässä voi kirjoittaa kumman tahansa muodon: *13:00*, *1300*, *13*, *1:00 PM* tai *1 pm*. Keskiyö päivän lopussa on *24:00* tai *12:00 AM*. Tiedostot ja laskenta eivät muutu: ne pysyvät 24-tuntisina. Löytyy: *Ulkonäkö*.

**Keston näyttö** — mitta, jolla tehtävän kesto näkyy. Vaihtoehdot: *Automaattinen (oma mitta kullekin tehtävälle)*, *Aina päivinä* ja *Aina tunteina*. Oletus: *Automaattinen (oma mitta kullekin tehtävälle)*. Vaikutus: tehtävätaulukossa, Ganttin palkkien teksteissä, vihjetekstissä, tulosteessa ja raporteissa. Kun valinta on *Automaattinen*, päivätehtävä näyttää päivät ja tuntitehtävä tunnit. Kun valinta on *Aina päivinä* tai *Aina tunteina*, sovellus muuntaa keston käyttäen tehtävän kalenterin tunteja päivässä. Jos tehtävän oma mitta on eri, se lisätään sulkuihin, esimerkiksi `2.25d(18h)`. Muuttuu vain näyttö. Tehtävä säilyttää oman mittansa. Löytyy: *Ulkonäkö*.

**Projektin vaihtotyyli** — tapa, jolla avoimien projektien välillä vaihdetaan. Vaihtoehdot: *Vaakasuuntaiset välilehdet*, *Pystysuuntaiset välilehdet* ja *Kapseli*. Oletus: *Vaakasuuntaiset välilehdet*. Vaikutus: *Vaakasuuntaiset välilehdet* asettaa välilehtipalkin valintanauhan alle, *Pystysuuntaiset välilehdet* projektipalkin vasemmalle ja *Kapseli* pienen projektipainikkeen otsikkopalkkiin. Löytyy: *Ulkonäkö*.

### Gantt-osio

**Näytä vain työpäivät** — tiivistää aika-akselin. Oletus: pois. Vaikutus: viikonloput ja vapaapäivät projektikalenterista ohitetaan, joten 5 työpäivän kesto on täsmälleen 5 päivän levyinen. Pikakuvakkeet *Siirry tähän päivään* ja *Sovita projektiin* laskevat silloin myös työpäivinä. Raportissa on oma valintaruutu samalla nimellä, joka ei riipu tästä asetuksesta. Löytyy: *Ulkonäkö*, kohdasta *Gantt › Aika-akseli*.

**Näytä vartit, kun zoomataan pitkälle** — ylimääräinen tarkka aikaskaala. Oletus: pois. Vaikutus: zoomaus voi mennä pidemmälle, ja *Tunti*-aikaskaalaan tulee vartin rivi. Kun tuntipalkkia vedetään, se voi loksahtaa vartteihin kokonaisten tuntien sijaan. Tämä näkyy vain, kun *Ota tuntisuunnittelu käyttöön* on päällä. Löytyy: *Ulkonäkö*, kohdasta *Gantt › Vartin zoom*.

**Palkit taukojen kohdalla** — piirretäänkö tuntitehtävä lohkoina. Vaihtoehdot: *Älä koskaan jaa*, *Jaa valinnan yhteydessä* ja *Jaa aina*. Oletus: *Jaa valinnan yhteydessä*. Vaikutus: tuntitehtävän palkki piirretään työlohkoittain eikä yhtenä jatkuvana palkkina. *Jaa valinnan yhteydessä* tekee sen vain valitulle tehtävälle. Asetus koskee vain tuntitehtäviä. Oikeasti jaettu tehtävä (*Jaa tehtävä*) näyttää taukonsa asetuksesta riippumatta. Löytyy: *Ulkonäkö*, kohdasta *Gantt*.

**Vieritys ja zoomaus › Tila** — mitä hiiren rulla tekee Ganttin päällä. Vaihtoehdot: *Sijainti*, *Näppäimet* ja *Zoomaus + vetäminen*. Oletus: *Zoomaus + vetäminen*. Vaikutus: *Zoomaus + vetäminen* -tilassa rulla zoomaa kohdistimen kohdalta, Shift + rulla vierittää rivejä, aikajanaa siirretään vetämällä taustaa ja Ctrl + vetäminen (Macissa Cmd + vetäminen) piirtää valintalaatikon. *Sijainti*-tilassa rullan vaikutus riippuu siitä, missä kohdistin on. Ctrl + rulla zoomaa aina ja Shift + rulla vierittää aina vaakasuunnassa. *Näppäimet*-tilassa valitaan itse, mikä näppäin tekee mitäkin. Valinta koskee myös jaetun näkymän toista aikajanaa. Löytyy: *Ulkonäkö*, kohdasta *Gantt › Vieritys ja zoomaus*.

**Vieritys ja zoomaus › Näytön jako** — missä kohdistin on ja mitä rulla siellä tekee. Näkyy vain tilassa *Sijainti*. Vaihtoehdot: *Vasen/oikea*, *Ylä/ala* ja *Oikea yläkulma*. Oletus: *Vasen/oikea*. Vaikutus: *Vasen/oikea* -valinnassa rulla vierittää pystysuunnassa vasemmalla puoliskolla ja vaakasuunnassa oikealla puoliskolla. *Ylä/ala* -valinnassa rulla vierittää vaakasuunnassa ylimmällä 30%:lla (lähellä aikaskaalaa) ja pystysuunnassa sen alapuolella. *Oikea yläkulma* -valinnassa rulla vierittää vaakasuunnassa oikeassa yläneljänneksessä ja pystysuunnassa muualla. Löytyy: *Ulkonäkö*, kohdasta *Gantt › Vieritys ja zoomaus*.

**Vieritys ja zoomaus › Pystysuuntainen, Vaakasuuntainen, Zoomaus** — mikä näppäin kuuluu mihinkin rullan toimintoon. Näkyy vain tilassa *Näppäimet*. Jokaiselle rullan käytölle valitaan *Vieritys*, *Ctrl + vieritys* tai *Shift + vieritys*. Oletus: *Pystysuuntainen* on *Vieritys*, *Zoomaus* on *Ctrl + vieritys* ja *Vaakasuuntainen* on *Shift + vieritys*. Vaikutus: jos valitaan näppäin, joka on jo käytössä, se vaihtuu sen kanssa, joka sitä käytti. Löytyy: *Ulkonäkö*, kohdasta *Gantt › Vieritys ja zoomaus*.

## Aikataulu-välilehti

**Ota rakennusmoodi käyttöön** — rakentamiseen suuntautuneet alkuarvot uusille projekteille. Oletus: päällä. Vaikutus: päällä antaa uudelle projektille kalenterin *Bouwkalender NL* hollantilaisine yleisine vapaapäivineen. Vapaapäivät luotaessa voi valita rakennusalan vapaapäivät. Lisäksi se tarjoaa vaiheistusmallit *Asuntorakentaminen* ja *Toimitilarakentaminen / saneeraus* ja antaa uusille tehtäville työlajin *Rakentaminen*. Pois antaa kalenterin *Standaardkalender* ilman vapaapäiviä, vain mallin *Tyhjä* ja työlajin *Muu*. Uusi tehtävä, jonka ylätehtävällä on työlaji, saa ensin ylätehtävän työlajin. Sen jälkeen käytetään *Rakentaminen* tai *Muu*. Olemassa olevat tehtävät ja kalenterit eivät muutu. Löytyy: *Aikataulu*.

**Ota tuntisuunnittelu käyttöön** — suunnittelu työtunteina työpäivien rinnalla. Oletus: pois. Vaikutus: aikaskaala *Tunti* tulee kohtaan *Näkymä › Aikaskaala*. *Kalenterit*-ikkunassa tavallinen kalenteri voi saada lohkon *Työajat*, ja kalenterissa, jossa lohkoja jo on, lohko näkyy aina; *Luo uusi projekti* -ikkunaan tulevat valinnat *Työvuoro* ja *Oletusmitta uusille tehtäville*. *Projektin asetukset* -ikkunaan tulee myös valinta *Oletusmitta uusille tehtäville*. Pois päältä sovellus toimii päiväkohtaisesti. Tehtävät, jotka ovat jo tunneissa, säilyvät ja ovat mukana laskennassa. Niiden kestoa voi muokata vasta, kun tuntisuunnittelu on päällä. Löytyy: *Aikataulu*, kohdasta *Tuntisuunnittelu*. Lisätietoja: [Tuntisuunnittelun käyttöönotto](docs://howto-urenplanning-aanzetten).

**Salli päivä- ja tuntisuunnittelu** — valitaan mitta tehtäväkohtaisesti. Näkyy vain, kun *Ota tuntisuunnittelu käyttöön* on päällä. Oletus: päällä. Vaikutus: päällä näyttää pudotusvalikon *Keston mitta* jokaisen tehtävän keston vieressä. Pois piilottaa pudotusvalikon. Löytyy: *Aikataulu*, kohdasta *Tuntisuunnittelu*. Lisätietoja: [Päivät ja tunnit](docs://uitleg-dagen-en-uren).

**Viikko alkaa** — viikon ensimmäinen päivä. Vaihtoehdot: *Maanantai* ja *Sunnuntai*. Oletus: *Maanantai*. Vaikutus: viikkojako ja viikkonumerot aikaskaalassa Ganttissa ja raporteissa (Gantt-kaavion tulostus) sekä viikonpäivien järjestys *Kalenterit*-ikkunassa. Löytyy: *Aikataulu*.

**Laske automaattisesti** — Aikataulu lasketaan uudelleen heti, kun se ei ole enää ajan tasalla. Oletus: pois. Vaikutus: pois päältä tarkoittaa, että *Laske* (F5) painetaan itse. Päällä sovellus laskee aikataulun uudelleen murto-sekunnin kuluessa muutoksesta tehtäviin, riippuvuuksiin tai kalenteriin. Vedettäessä tai kenttään kirjoitettaessa sovellus odottaa ja laskee kerran, kun muokkaus on valmis. Epäonnistuneen laskennan jälkeen sovellus laskee uudelleen vasta, kun jotakin on muutettu. Löytyy: *Aikataulu*, kohdasta *Laskenta*.

**Tehtävätyypit käyttöön** — tehtävätyypin ja työn kentät sovelluksessa. Oletus: pois. Vaikutus: päällä näyttää kentän *Tehtävätyyppi* tehtävässä ja työsarakkeen resurssikohdistuksille, ja tekee taulukon sarakkeen *Tehtävätyyppi* käytettäväksi. Pois päältä ne piilotetaan. Kesto ja kuormitusaste säilyvät, ja työ seuraa niitä. Projekti, jossa on jo tehtävätyyppi- tai työtietoja, esimerkiksi `.mpp`- tai `.xer`-tiedostosta, näyttää ne aina, vaikka asetus olisi pois. Löytyy: *Aikataulu*, kohdasta *Laskenta*. Lisätietoja: [Tehtävätyypit: kesto, kuormitusaste ja työ](docs://uitleg-werkregels).

## Lisäasetukset-välilehti

**Näytä selitys avaamisen jälkeen** — yksi valintaruutu kullekin muodolle: *Primavera-tiedosto (.xer)*, *MS Project -tiedosto (.mpp)*, *MS Project XML*, *Primavera P6 XML* ja *CSV-tiedosto*. Oletus: kaikki päällä. Vaikutus: päällä näyttää ikkunan lyhyen selityksen muodosta, kun tällainen tiedosto avataan: mitä sovellus otti mukaan, mitä ei, ja miten tallennus ja takaisinkirjoitus toimivat. *Älä näytä uudelleen …* -valinta ikkunassa tyhjentää tämän valintaruudun; täältä se otetaan takaisin käyttöön. IFC-tiedostoa, esimerkkiä tai projektia, jonka tekoälyavustaja tai laajennus avaa, ei koskaan selitetä näin. Löytyy: *Lisäasetukset*, kohdasta *Näytä selitys avaamisen jälkeen*. Lisätietoja: [Tiedoston avaaminen ja tallentaminen](docs://howto-bestand-openen-en-opslaan).

**Ota AI-tila käyttöön** — antaa tekoälyavustajan työskennellä aikataulun kanssa. Oletus: pois. Vaikutus: päällä näyttää välilehden *AI* MCP-sillan kanssa, jolloin tekoälyavustaja voi työskennellä aikataulun kanssa Model Context Protocol -protokollan kautta. Pois piilottaa välilehden ja pysäyttää sillan. Löytyy: *Lisäasetukset*, kohdasta *AI-tila*. Lisätietoja: [Tekoälyavustajan yhdistäminen (MCP)](docs://howto-ai-assistent-koppelen).

**Käynnistä silta automaattisesti** — käynnistää MCP-sillan, kun sovellus käynnistyy. Sen voi kytkeä päälle vain, kun *Ota AI-tila käyttöön* on päällä. Oletus: pois. Vaikutus: silta on heti käytössä, joten AI-asiakasohjelma voi yhdistää ilman, että *AI*-välilehteä avataan ensin. Tämä toimii vain työpöytäsovelluksessa ja kerran käynnistyksen aikana. Jos silta kytketään myöhemmin itse pois, se ei käynnisty uudelleen. Löytyy: *Lisäasetukset*, kohdasta *AI-tila*.

**Ota debug-terminaali käyttöön** — lokipaneeli vianetsintää varten. Oletus: pois. Vaikutus: päällä tilarivillä on terminaalipainike, joka näyttää tai piilottaa lokipaneelin. Pois sulkee paneelin. Löytyy: *Lisäasetukset*, kohdasta *Debug-terminaali*.

**Benchmark…** — mittaa aikataulumoottorin suorituskyvyn. Vaikutus: avaa ikkunan, jossa luodaan valitun kokoinen testiaikataulu ja mitataan keskeiset vaiheet. Avoin projekti jätetään koskemattomaksi. Se on painike eikä asetus, joten mitään ei tallenneta. Löytyy: *Lisäasetukset*, kohdasta *Benchmark*.

**Tilastot…** — kuinka monta kertaa sovellus on ladattu. Vaikutus: avaa ikkunan *Lataustilastot* julkisilla luvuilla GitHub Releases -palvelusta. Tietoja ei kerätä käyttäjältä. Se on painike eikä asetus. Löytyy: *Lisäasetukset*, kohdasta *Tilastot*. Ikkunassa:

- *Lataukset käyttöjärjestelmittäin* — per käyttöjärjestelmä sarakkeina *Lataukset*, *Asennusohjelmat* (mitä henkilö lataa) ja *Päivitykset* (mitä sovelluksen päivitin hakee), sekä rivi *Yhteensä*. Linuxissa niitä ei voi erottaa: päivitin hakee saman tiedoston `.deb`, `.rpm` tai `.AppImage`, jonka ihmiset lataavat myös käsin. Siksi siellä asennusohjelmiksi lasketaan vain snap-tiedosto. Sen alapuolella on *Päivitystarkistukset sovelluksesta*: kuinka monta kertaa asennetun sovelluksen päivitin on hakenut GitHubista versiotiedoston uuden version etsimiseksi. Ne ovat tarkistuksia, eivät asennuksia.
- *Julkaisuittain* — samat lataukset versioittain, päivämäärineen. Ensin näkyvät kuusi uusinta. Loput näkyvät painikkeella *Näytä kaikki … julkaisua*.
- *Lähde* — lukujen päivämäärä (GitHub Releases, päivitetään viikoittain) ja *Hae uudelleen nyt*. Sovellus säilyttää haetut luvut puoli tuntia. Jos haku epäonnistuu, ikkuna kertoo siitä. Asennukset Snap Store -kaupan kautta eivät kulje GitHubin kautta, joten ne puuttuvat.

**Aloita kierros** — esittelykierros uudelleen. Vaikutus: sulkee ikkunan *Asetukset* ja käynnistää kierroksen ensimmäisestä vaiheesta. Löytyy: *Lisäasetukset*, kohdasta *Kierros*.

**Versio** — sovelluksen versionumero, kahdella painikkeella. *Tarkista päivitykset* avaa päivitysikkunan. *Mitä on uutta* näyttää nykyisen version uutiset. Löytyy: *Lisäasetukset*, kohdasta *Versio*.

**Näytä vanhat näkymäpainikkeet** — korvattu toiminto, kohdasta *Vanhat toiminnot*. Oletus: pois. Vaikutus: päällä palauttaa ryhmän *Näyttö* välilehdelle *Näkymä* erillisine painikkeineen *Sarakkeet*…, *Suodatin*…, *Ryhmittely*… ja *Lajittelu*…. Ne on korvattu taulukon otsakkeen plusmerkillä, asettelupainikkeilla ja asetteluikkunalla. Löytyy: *Lisäasetukset*, kohdasta *Vanhat toiminnot*.

## Paneelin ulkopuolella muistetut näyttövalinnat

Sovellus tallentaa nämä valinnat myös tälle laitteelle. Ne asetetaan kuitenkin kohteessa itsessään, ei asetuspaneelissa.

**Perustason peittokuva** — aktiivinen perustaso ohuena palkkina tehtäväpalkin alla. Oletus: päällä. Missä: *Näkymä › Perustasot ja edistyminen › Perustason peittokuva*.

**Edistymisviiva** — edistymisen sahalaitainen viiva raportointipäivällä. Oletus: päällä. Vaikutus: viiva näkyy vain, kun projektilla on raportointipäivä. Silloin se korvaa erillisen raportointipäivän viivan. Missä: *Näkymä › Perustasot ja edistyminen › Edistymisviiva*.

**Raportointipäivän viiva** — pisteviiva raportointipäivällä. Oletus: päällä. Vaikutus: jos edistymisviiva on päällä, se piirtää merkinnän itse. Missä: *Näkymä › Perustasot ja edistyminen › Raportointipäivän viiva*.

**Resurssikorostus** — ohut raita resurssin värillä tehtäväpalkin alla. Oletus: pois. Missä: *Näkymä › Perustasot ja edistyminen › Resurssikorostus*.

**Pelivaranauha** — pelivara ei-kriittisten palkkien takana nauhana; ei valmiille tehtäville. Oletus: päällä. Missä: *Näkymä › Perustasot ja edistyminen › Pelivaranauha*.

**Palkkien värit** — tekijä, josta palkin väri riippuu. Valitse *Kriittinen polku*, *Tehtäväkohtainen — automaattinen* tai *Luokittain*. Oletus: *Kriittinen polku*. Vaikutus: koskee samanaikaisesti Gantt-kaaviota ja raporttia. Missä: *Näkymä › Perustasot ja edistyminen › Palkkien värit*.

**Histogrammi** — histogrammin kaista Gantt-kaavion alla. Oletus: pois. Missä: *Resurssit › Histogrammi › Histogrammi*, *Näkymä › Paneelit › Histogrammi* tai Ctrl+Shift+H. Korkeus asetetaan vetämällä kaistan reunaa. Oletuskorkeus on 160 pikseliä, ja sen voi asettaa 80 ja 480 pikselin välille.

**Pienoiskartta** — yleiskartta aikajanasta. Oletus: pois. Missä: *Näkymä › Esitys › Pienoiskartta*.

**Valintanauhan tiivistys** — kompakti valintanauha. Oletus: pois. Missä: nuolipainike valintanauhan oikeassa alakulmassa.

**Tehtävätaulukon leveys** — oletus 350 pikseliä, sallittu alue 150–800 pikseliä. Leveys asetetaan vetämällä tehtävätaulukon vieressä olevaa jakajaa. Se voidaan asettaa myös vasemman ja oikean nuolinäppäimen avulla, kun jakaja on kohdistettuna.

**Oikean paneelin leveys** — oletus 280 pikseliä, sallittu alue 200–900 pikseliä. Leveys asetetaan vetämällä paneelin reunaa.

**Oikean paneelin osien korkeus** — *Ominaisuudet* ja *Varoitukset*: oletus 240 ja 220 pikseliä, sallittu alue 120–2000 pikseliä. *Ominaisuudet* on tässä korkeudessa myös silloin, kun resurssilista on auki. Korkeus asetetaan osien välissä olevalla vetokahvalla. Sovellus ei muista, ovatko osiot auki vai kiinni.

**Muistiin tallennetaan myös, kuvattu muualla** — taulukon sarakkeet ([Taulukkosarakkeiden muokkaaminen](docs://howto-tabelkolommen-aanpassen)), asettelut ([Asettelun luominen ja käyttö](docs://howto-layouts-gebruiken)), raporttivalinnat ([Raporttityypit](docs://ref-rapporttypes)), omat laskentaprofiilipohjat ([Laskentavalinnat ja laskentasäännöt](docs://ref-rekenopties-en-conventies)) ja Ohjeen *Dokumentaation kieli* (*Tiedosto › Ohje*) tallennetaan myös tälle laitteelle, ei projektitiedostoon.

## Katso myös

- [Laskentavaihtoehdot ja laskentasäännöt](docs://ref-rekenopties-en-conventies): projektiin kuuluvat valinnat.
- [Tuntisuunnittelun käyttöönotto](docs://howto-urenplanning-aanzetten): vaiheet kytkimelle *Ota tuntisuunnittelu käyttöön*.
- [Päivät ja tunnit](docs://uitleg-dagen-en-uren): miten sovellus laskee päivät ja tunnit.
- [Tehtävätyypit: kesto, kuormitusaste ja työ](docs://uitleg-werkregels): mitä *Tehtävätyypit käyttöön* näyttää.
- [Pikanäppäimet](docs://ref-sneltoetsen): kaikki sovelluksen näppäimet, myös zoomaukseen ja vierittämiseen.

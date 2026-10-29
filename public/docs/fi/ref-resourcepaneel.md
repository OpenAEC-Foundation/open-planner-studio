# Resurssipaneeli

Resurssipaneelissa hallitaan resursseja: mitkä resurssit ovat käytettävissä, millä kapasiteetilla ja millä kalenterilla. Gantt-kaavion alla oleva histogrammi ja ylikuormitus kuuluvat siihen. Tässä artikkelissa kerrotaan jokaisen kentän ja painikkeen toiminta, oletusarvo ja se, mitä niistä huomataan. Resurssien luominen ja kohdistaminen on kuvattu artikkeleissa [Resurssien hallinta](docs://howto-resources-beheren) ja [Resurssikohdistus käyrän avulla](docs://howto-resource-toewijzen). Ylikuormituksen ratkaiseminen on kuvattu artikkelissa [Ylikuormituksen ratkaiseminen](docs://howto-overbezetting-oplossen).

## Missä se on

- **Koko paneeli** — *Resurssit › Hallitse › Resurssit* tai *Näkymä › Paneelit › Resurssit*. Paneeli vie koko työtilan. Rasti oikeassa yläkulmassa sulkee sen.
- **Resurssitelakka** — *Resurssit › Hallinta › Resurssitelakka* tai *Näkymä › Paneelit › Resurssitelakka*: tiivis luettelo oikealla reunalla Gantt-kaavion vieressä. Katso alla.
- **Histogrammi** — *Resurssit › Histogrammi › Histogrammi* tai *Näkymä › Paneelit › Histogrammi*: nauha Gantt-kaavion alla. Katso alla.
- **Näkymät** — jos projekti käyttää kirjastoa, paneelin oikeassa yläkulmassa on valinta: *Kirjasto*, *Projekti* tai *Käyttöaste*. Ilman kirjastoa on vain projektitaulukko. Kun paneeli avataan, näkymäksi valitaan aina *Projekti*. Näin ei huomaamatta päädy jaettuun kirjastoon.

## Uusi resurssi

- **Uusi resurssi projektiin** (näkymän *Kirjasto* painike *Uusi resurssi kirjastoon*) — painike oikeassa yläkulmassa. Se avaa luonnosrivin taulukon alaosaan. Resurssi luodaan vasta, kun nimi on annettu ja rivi on jätetty (tai painamalla Enter). Tyhjä rivi, josta klikataan pois tai painetaan Esc, ei jätä mitään jälkeensä: ei resurssia eikä askelta, jonka voi kumota painikkeella *Kumoa*. Kentät voi täyttää missä järjestyksessä tahansa. Kaikki tiedot tallentuvat kerralla. Enter tai alanuoli vahvistaa rivin ja avaa uuden luonnosrivin. Shift+Enter tai ylänuoli vahvistaa rivin ja palaa taulukkoon. Luonnosrivistä puuttuvat kapasiteetin laajennin, kalenterikynä ja roskakori, koska ne toimivat resurssiin, jota ei vielä ole. Painike *Uusi resurssi* valikossa *Resurssit › Hallitse* tekee saman.
- **Ruudukon siirtyminen** — taulukossa Enter ja Shift+Enter sekä ylä- ja alanuoli siirtävät kohdistimen rivien välillä. Enter viimeisellä rivillä avaa uuden luonnosrivin.

## Projekti-näkymä

Taulukko näyttää, mitä tämä projekti käyttää. Jokainen rivi on resurssi. Muutokset tekstiin ja normaalihintaan tulevat voimaan, kun kentästä poistutaan. Ne tallentuvat yhtenä askeleena, jonka voi kumota painikkeella *Kumoa*.

- **Väri** — väripoimija. Oletus: palettin ensimmäinen vapaa väri. Vaikutus: väri näkyy resurssikorostuksena Gantt-palkkien alla (*Näkymä › Perustasot ja edistyminen › Resurssikorostus*) ja resurssitelakan värinäytteenä.
- **Nimi** — resurssin nimi. Tyhjää nimeä ei tallenneta: kenttään palautuu vanha nimi.
- **Tyyppi** — *Työvoima*, *Kalusto*, *Materiaali*, *Aliurakoitsija* tai *Työryhmä*. Oletus uudelle resurssille: *Työvoima*. Vaikutus: tyypillä *Materiaali* on kenttä *Mitta*, eikä sitä lasketa histogrammin summaan *Kaikki resurssit*. Tasaaminen ohittaa materiaalin. Resurssi, jonka tyyppi on *Työryhmä*, voi olla muiden resurssien työryhmä. Muut tyypit lasketaan samalla tavalla.
- **Enimmäismäärä** — kuinka suuri osa resurssista on käytettävissä päivässä. Arvo on luku, joka on suurempi kuin 0. Murtoluvut sallitaan. Oletus: 1. Vaikutus: päiväkohtainen kapasiteetti. Jos kuorma on suurempi, resurssi on ylikuormitettu. Nuoli sen vieressä avaa kentän *Vaiheistettu kapasiteetti*. Nuolen vieressä oleva luku kertoo vaiheiden määrän.
- **Vaiheistettu kapasiteetti** — vaiheet, joissa on *Alkaen* (päivämäärä) ja *Enimmäismäärä*. *Lisää vaihe* lisää vaiheen, jonka päivä on tänään ja arvo 1. Ilman vaiheita näkyy: *Ei vaiheita — tasainen enimmäismäärä on aina voimassa.* Vaikutus: vaiheen päivästä alkaen sen *Enimmäismäärä* on voimassa tasaisen arvon sijaan. Voimassa on viimeinen vaihe, jonka päivä on sama tai aiempi kuin tarkasteltava päivä.
- **Kalenteri** — luettelo, jossa on *Projektikalenteri* (oletus), projektin kalenterit ja *+ Resurssikalenteri* uutta varten. Kynä (*Muokkaa…*) avaa valitun kalenterin. Kynä ei ole käytössä kohdassa *Projektikalenteri*. Vaikutus: päivät, joina resurssi työskentelee. Vapaapäivänä kapasiteetti on 0. Jos siihen on suunniteltu tehtäviä, resurssi on ylikuormitettu. Syy on *Ei työskentele tänä päivänä kalenterin "…" mukaan*. Resurssikalenteri ei muuta tehtävän päivämääriä. Katso [Kalenterin aikaikkunat](docs://ref-kalenders).
- **Normaalihinta/h** — kustannus tunnissa. Tyhjä arvo tarkoittaa, ettei hintaa ole. Virheellinen luku palautuu. Vaikutus: ei vaikutusta aikatauluun eikä kuormaan. Normaalihinta määrää sarakkeen *Yhteensä* arvon. Hinta tallentuu IFC-tiedostoon. Se kirjoitetaan mukaan vietäessä MS Projectiin (normaalihinta) ja Primavera P6 XML:ään (hinta yksikköä kohden).
- **Yhteensä** — vain luku: kuormitetut tunnit kerrottuna normaalihinnalla, kahdella desimaalilla. Ilman hintaa tai kuormaa näkyy *—*. Alareunan rivi *Yhteensä* laskee kaikkien resurssien summan. Tunnit tulevat viimeisestä laskennasta. Ne lasketaan kuormitusasteen ja tehtävän kalenterin päivittäisten tuntien tulona. Onko luku vanhentunut? Paina *Laske*.
- **Mitta** — materiaalin mittayksikkö, esimerkiksi `m³`. Kentän voi täyttää vain tyypillä *Materiaali* (ohje *Täytä vain resursseille, joiden tyyppi on Materiaali*.). Vaikutus: pelkkä teksti. Se ei laske mitään.
- **Työryhmä** — työryhmä, johon resurssi kuuluu. Valinnat tulevat resursseista, joiden tyyppi on *Työryhmä*. Oletus: *Ei mitään*. Vaikutus: pelkkä ryhmittely. Työryhmän kapasiteetti ja kuorma eivät ole sen jäsenten summa.
- **Poista** (roskakori) — poistaa resurssin. Jos resurssilla on resurssikohdistuksia, sovellus kysyy ensin: *'…' on käytössä … resurssikohdistuksessa — poistetaanko?* Vahvistus tehdään rastilla ja peruutus ristillä.
- **Kirjastoon** — vain, kun projekti käyttää kirjastoa ja resurssin nimi ei vielä tule kirjastosta. Resurssi viedään kirjastoon tai liitetään samannimiseen kohteeseen. Sovellus kertoo, mitä tapahtui: *Lisätty.*, *Oli jo kirjastossa — nyt liitetty.* tai *Liitetty olemassa olevaan kirjastokohteeseen — arvot eroavat, katso merkintä.*
- **Irrota kirjastosta** — irrotuskuvake resurssissa, joka tulee kirjastosta. Se poistaa alkuperän. Sen jälkeen kaikki kentät ovat taas vapaita.

Ilman resursseja näkyy: *Ei vielä resursseja. Lisää yksi, jotta voi aloittaa.* Jos projekti käyttää kirjastoa, näkyy: *Tämä projekti ei vielä käytä kirjaston resursseja.* ja vihje.

### Kirjastosta tulevat resurssit

Resurssi, joka tulee kirjastosta, saa pienen kirjastokuvakkeen (*Kirjastosta*). Sen kentät *Nimi*, *Tyyppi*, *Normaalihinta/h* ja *Mitta* ovat silloin pelkkää tekstiä (*Kirjaston arvo — muokkaa Kirjasto-näkymässä tai irrota tämä resurssi kirjastosta*), koska kirjasto päättää, mitä resurssi on. *Väri*, *Enimmäismäärä*, kapasiteettivaiheet, *Kalenteri* ja *Työryhmä* pysyvät muokattavina, koska projekti päättää, kuinka paljon ja milloin. Kaksi merkkiä voi näkyä: *eroaa — päätä* (napsautus avaa ikkunan *Linkitä kirjasto*) ja *ei enää kirjastossa*, jonka painike on *Poista projektista*.

## Kirjasto-näkymä

Vain, kun projekti käyttää kirjastoa. Katso [Kirjaston käyttäminen](docs://howto-resourcebibliotheek-gebruiken) ja [Kirjastojen hallinta ja jakaminen](docs://howto-bibliotheken-beheren). Ylhäällä on värillinen ilmoitus: *Tämä muokkaa kirjastoa ja koskee kaikkia projekteja. Tätä ei voi kumota.* Taulukossa on samat kentät kuin näkymässä *Projekti*, paitsi seuraavat erot:

- Sarake *Yhteensä* puuttuu, koska se on yhden projektin laskenta.
- Sarake *Työryhmä* näkyy heti, kun kirjastossa on resursseja.
- Sarake *Kalenteri* tarjoaa kirjaston kalenterit. Oletus on *Ei kalenteria*.
- **Lisää projektiin** — lisää resurssin projektiin kopiolla sen kalenterista. Kertoo *Lisätty.* tai *On jo projektissa.*
- **Poista** — kysyy: *Poistetaanko '…' kirjastosta? Tämä koskee kaikkia projekteja, eikä sitä voi perua*
- Ilman resursseja näkyy: *Allassa ei vielä ole resursseja.*

## Käyttöaste-näkymä

Vain luku -näkymä kaikille avoimille dokumenteille: siinä näkyy, missä kirjaston resursseja on varattu. Uudelle resurssille ei ole painiketta. Katso [Käyttöasteen yleiskatsauksen käyttäminen](docs://howto-bezettingsoverzicht-gebruiken).

- **Taulukko** — jokaiselle kirjaston resurssille: *Nimi*, *Dokumentit* (niiden dokumenttien määrä, joissa resurssi on), *Aikajakso* ja *Huippu / kapasiteetti* (suurin yhteinen kuorma suhteessa kapasiteettiin kyseisenä päivänä). Punainen *N päivää ylikuormitettu* tarkoittaa, että resurssilla on useissa dokumenteissa enemmän kuin sen kapasiteetti. Nuoli nimen vieressä avaa dokumentit. Jokaisella dokumentilla on aikajakso ja huippu. Napsautus rivillä näyttää resurssin histogrammin (*Valitse resurssi, jotta histogrammi näkyy*).
- **Mukaan lasketaan** — vain dokumentit, jotka ovat auki tässä sovelluksessa (*Tämä näkymä näkee vain tässä sovelluksessa avatut dokumentit*). Dokumentti, jota ei ole laskettu, saa viestin omalle rivilleen. Aktiivinen dokumentti lasketaan mukaan viimeisten laskettujen lukujen perusteella (*Vanhentunut: nämä ovat viimeksi lasketut luvut — paina F5 tässä dokumentissa*). Muu dokumentti lasketaan näkymää varten etukäteen (*Laskettu etukäteen tätä näkymää varten — dokumentti itse näyttää vanhempia päivämääriä, kunnes siellä painetaan F5 tai otetaan käyttöön “Laske automaattisesti”*). Jos *Laske automaattisesti* on päällä, näkymä laskee nämä dokumentit todella. Jos laskenta epäonnistuu, dokumentti ei ole mukana (*Ei lasketa mukaan: aikataulua ei ole laskettu — aktivoi tämä dokumentti ja paina F5*). Ilman varattuja resursseja näkyy: *Avoimissa dokumenteissa ei ole varattuja kirjaston resursseja*.
- **Järjestys** — ylimpänä ovat resurssit, joilla on ylikuormitusta. Ensin ovat ne, joilla on eniten ylikuormituspäiviä, sitten aakkosjärjestyksessä.

## Resurssitelakka

Tiivis luettelo oikealla reunalla paneelin *Ominaisuudet* vieressä. Jokaisesta resurssista näkyy: värinäyte, nimi (vain luku), punainen kolmio *Ylikuormitettu*, kun resurssilla on vähintään yksi ylikuormitettu päivä, ja muokattava *Enimmäismäärä*. Jos tehtäviä on valittuna, luettelossa ovat vain niiden tehtävien resurssit. Otsikossa ovat *Koko paneeli* (avaa koko paneelin) ja *Sulje telakka*. Ilman resursseja näkyy: *Ei vielä resursseja. Lisää yksi, jotta voi aloittaa.*

## Histogrammi

Nauha Gantt-kaavion alla. Se näyttää resurssin kuorman päivittäin. Kytke se päälle tai pois valinnalla *Resurssit › Histogrammi › Histogrammi* tai *Näkymä › Paneelit › Histogrammi*. Oletus: pois. Valinta muistetaan. Korkeus on oletuksena 160 pikseliä. Sitä voi vetää Gantt-kaavion ja histogrammin välisestä reunasta.

- **Valitsin** — vasemmalla tehtävätaulukon alla on luettelo: *Kaikki resurssit* on kiinnitetty ylös, ja sen alla on yksi rivi jokaista resurssia kohden. Napsautus valitsee rivin. Nuolinäppäimillä liikutaan rivien välillä. *Resurssit › Histogrammi › Palaa* ja *Jatka* tekevät saman. Punainen piste rivin vieressä tarkoittaa, että resurssilla on vähintään yksi ylikuormitettu päivä. Kohdassa *Kaikki resurssit* piste katsoo vain resursseja, jotka eivät ole materiaaleja. Jos tehtäviä on valittuna, luettelossa on vain niiden tehtävien resurssit. Jos valittu resurssi jää sen ulkopuolelle, nauha näyttää hetkeksi valinnan *Kaikki resurssit*.
- **Pylväät** — yksi pylväs päivää kohden: kuorma kuormitusasteina. Viiva näyttää kapasiteetin. Palkin osa kapasiteetin yläpuolella on punainen. Vasemmassa yläkulmassa on suurin arvo, jonka perässä on *kuormitusaste*. *Kaikki resurssit* laskee yhteen kaikkien resurssien kuorman ja kapasiteetin, paitsi materiaalin.
- **Ohjeteksti** — kun hiiri pysyy hetken paikallaan päivän päällä, näkyy *N tehtävää kuormittaa päivänä {date}* ja enintään kahdeksan tehtävän nimet. Kun valitulle resurssille päivä on vapaapäivä kalenterin mukaan, näkyy lisäksi *Ei työskentele tänä päivänä kalenterin "…" mukaan*.
- **Viestit nauhassa** — *Laske uudelleen (F5), jotta kuorma näkyy*, kun kuormaa ei ole. *Ei vielä resursseja*, kun resursseja ei ole. *⚠ Aikataulu vanhentunut — laske uudelleen (F5)* oikeassa yläkulmassa, kun aikataulu on vanhentunut.
- **Mukaan lasketaan** — resurssikohdistuksen kuormitusasteet jaetaan päivittäin tehtävän työpäiville käyrän mukaan (*Käyrä*) tai tuntijakautumisen mukaan (*Muokkaa tuntijakautumista*). Mukaan lasketaan vain lehtitehtävät, ei välitavoitteita. Kuorma päivittyy, kun komento *Laske* on suoritettu, sekä resurssien ja resurssikohdistusten muutosten jälkeen. Muutos tehtävien päivämääriin näkyy vasta, kun komento *Laske* on suoritettu.

## Ylikuormitus

Resurssi on ylikuormitettu päivänä, jolloin sen kuorma on suurempi kuin sen kapasiteetti. Kapasiteetti on *Enimmäismäärä* kapasiteettivaiheineen kalenterin työpäivänä ja 0 vapaapäivänä. Materiaali lasketaan tässä mukaan. Syy on joko liian pieni kapasiteetti tai päivä, jona resurssi ei kalenterinsa mukaan työskentele.

Se näkyy näissä kohdissa:

- **Resurssit › Ylikuormitus** — ylikuormitettujen resurssien määrä tai *Ei mitään*.
- **Tilarivi** — *Resurssien ylikuormitukset: N*. Napsautus avaa paneelin *Varoitukset*.
- **Varoitukset** — yksi rivi jokaiselle resurssille: *Ylikuormitus N pv (ensimmäinen – viimeinen)*. Jos kaikki päivät ovat vapaapäiviä, rivin loppuun lisätään *resurssi ei työskentele näinä päivinä kalenterinsa mukaan*. Sekatapauksessa lisätään *joista N päivänä resurssi ei työskentele kalenterinsa mukaan*. Katso [Ilmoitukset ja varoitukset](docs://ref-meldingen).
- **Histogrammi** — palkkien punaiset osat ja valitsimen punainen piste.
- **Resurssitelakka** — kolmio *Ylikuormitettu*.

Tasaaminen voi ratkaista ylikuormituksen siirtämällä tehtäviä myöhemmäksi. Oletuksena projektin päättymispäivä voi siirtyä. Vaihtoehdolla *tasaaminen* projektin päättymispäivä pysyy pelivaran rajoissa. Se ei ratkaise resurssia, jonka pitää työskennellä vapaapäivänä. Katso [Tasaaminen](docs://uitleg-nivelleren).

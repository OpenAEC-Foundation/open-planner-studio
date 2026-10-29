# Laskentaprofiilit ja laskentasäännöt

Sama aikataulu voi antaa eri päivämäärät sen mukaan, mitkä laskentasäännöt ovat käytössä. Tämä artikkeli selittää, miksi Primavera P6 ja Microsoft Project laskevat eri tavalla joissakin kohdissa. Se kertoo myös, miten sovellus tallentaa tämän eron **laskentaprofiiliin**, ja miten profiili eroaa laskentavaihtoehdoista, jotka määritetään itse projektikohtaisesti. Pieni verkko esimerkkinä näyttää, mitä tämä tekee päivämäärille.

## Käsite

Tehtävät, riippuvuudet ja kalenteri määrittävät suurimman osan aikataulusta, mutta eivät kaikkea. Mitä tapahtuu työlle, jota ei ole vielä aloitettu, kun raportointipäivä asetetaan? Mistä alkaa jo käynnissä olevan tehtävän jäljellä oleva työ? Mikä on tehtävän vapaa pelivara, kun tavoitepäivä ylittyy? Verkko ei kerro siitä mitään. Aikataulusovelluksen on valittava sääntö. Sovellus tuntee useita kohtia, joissa Primavera P6 -sääntö ja Microsoft Project -sääntö eroavat.

Sovellus kutsuu tällaista valintaa **laskentasäännöksi**. **Laskentaprofiili** on yhden ohjelmiston laskentasääntöjen joukko. Sovelluksessa on kolme profiilia:

- *Open Planner Studio*: profiili, jolla uusi projekti lasketaan. Mitään laskentasääntöä ei ole päällä.
- *Primavera P6*: laskentasäännöt, jotka sovellus tuntee P6:sta.
- *Microsoft Project*: laskentasäännöt, jotka sovellus tuntee Microsoft Project -ohjelmasta.

Profiili kertoo siis, miten ohjelmisto laskee. Se ei kerro, mitä projektilta halutaan. Sitä varten ovat **laskentavaihtoehdot**: valinnat, kuten kuinka vähän pelivaraa tekee tehtävästä kriittisen, tai missä kalenterissa viive lasketaan. Nämä asetetaan projektikohtaisesti.

## Miten sovellus laskee

### Laskentasäännöt ja laskentavaihtoehdot

Laskentasääntö on kytkin: päällä tai pois. Profiili päättää, mitkä kytkimet ovat päällä. Laskentavaihtoehto on valinta, joka tehdään itse. Eron näkee sovelluksessa itsessään lohkosta *Laskentaprofiili ja laskentavaihtoehdot*:

- **Laskentasäännöt** ovat kohdassa *Tämän profiilin laskentasäännöt*, ryhmiteltyinä aiheen mukaan, esimerkiksi *Edistyminen ja suoritettu työ*, *Riippuvuudet ja viive* ja *Pelivara ja myöhäiset päivämäärät*. Tämä osa on aluksi kokoon taitettuna. Sen otsikosta näkyy, kuinka monta laskentasääntöä on. Jos profiili poikkeaa perusarvosta, otsikossa näkyy myös merkintä *muutettu: 1*. Avaa osio napsauttamalla otsikkoa. Sisäänrakennetun profiilin jokaisen rivin perässä on merkintä *PÄÄLLÄ* tai *POIS*. Ne arvot ovat vain tiedoksi, eikä niitä voi muuttaa. Oman profiilin jokaisella rivillä on valintaruutu, ja sen perässä on perusarvo (*perusarvo: päällä* tai *perusarvo: pois*). Jos valinta poikkeaa siitä, rivi erottuu ja siihen tulee näkyviin *Palauta perusarvoon*. Rivin perässä oleva i-kuvake näyttää laskentasäännön selityksen. Vie hiiri sen päälle, siirry siihen Tab-näppäimellä tai napauta sitä. Selitys kannattaa lukea ensin, jos laskentasääntöä aiotaan muuttaa. Jos sääntö toimii vain tuntisuunnittelussa tai vain .xer-tiedoston tehtävissä, sen vieressä on sininen merkintä: *vain tuntisuunnittelussa* tai *vain .xer-tehtävät*. Tuntisuunnittelu tarkoittaa: kalenteria, jossa on työlohkoja, tehtävää, jonka kesto on tunteina, tai *Viiveen kalenteri* asetettuna arvoon *24 tunnin*. Projekti, jossa on vain päiväkalenteri ja tehtävät päivissä, ei huomaa laskentasääntöä, jonka merkintä on *vain tuntisuunnittelussa*, ellei *Viiveen kalenteri* ole asetettu arvoon *24 tunnin*. Silloin viive lasketaan tunteina, ja viivettä koskeva laskentasääntö voi muuttaa jotakin.
- **Laskentavaihtoehdot** ovat kohdassa *Tämän projektin laskentavaihtoehdot*: muun muassa *Kriittisyyden määritelmä*, *Pelivaran laskenta*, *Avoimet tehtävät ovat kriittisiä*, *Merkitse lähes kriittiset* ja *Viiveen kalenteri*. Ne kertovat, mitä projektilta halutaan, eivät sitä, miten ohjelmisto laskee. Niiden toiminta on selitetty artikkeleissa [Kriittinen polku ja pelivara](docs://uitleg-kritiek-pad) ja [Riippuvuudet ja viive](docs://uitleg-relaties).

Esimerkki kummastakin. "Tehtävä on kriittinen, jos sen kokonaispelivara on 0 tai vähemmän" on laskentavaihtoehto: kynnysarvoksi voi asettaa 4, jolloin kaikki, joilla on 4 työpäivää pelivaraa tai vähemmän, ovat kriittisiä. "Työ, jota ei ole aloitettu, siirtyy raportointipäivään" on laskentasääntö: Open Planner Studio ja Primavera P6 tekevät niin, Microsoft Project ei.

Profiili ja laskentavaihtoehdot kuuluvat projektitiedostoon, eivät sovellukseen. Kun projekti tallennetaan, ne siirtyvät sen mukana. Kaksi projektia samassa sovelluksessa voi siis laskea eri profiililla. Projekti ilman profiilia lasketaan kuten Open Planner Studio.

Jos projekti on peräisin .xer-tiedostosta, lohkon alaosassa näkyy lisäksi *Lähdetiedoston asetukset*. Niihin kuuluvat laskentavaihtoehdot, jotka vain Primavera tuntee ja jotka tiedosto toi mukanaan. Niitä ei voi muuttaa tässä. Oletusasetusten painike ja toisen profiilin valinta jättävät ne myös ennalleen. Uudessa projektissa niitä ei ole, ei edes silloin, kun valitaan *Primavera P6*.

### Missä profiili valitaan

Uudelle projektille profiili on *Uusi projekti* -ikkunassa, joka avataan kohdasta *Aloitus › Tiedosto › Uusi*. Siellä *Laskentaprofiili* on pudotusvalikko. Jos profiili valitaan siinä, sovellus korvaa jo täytetyt laskentavaihtoehdot profiilin oletusarvoilla. Vain lähdetiedoston asetukset jäävät. Profiilin *Primavera P6* kohdalla *Pelivaran laskenta* on silloin *Loppupelivara*. Profiileilla *Microsoft Project* ja *Open Planner Studio* kaikki laskentavaihtoehdot ovat oletusarvollaan, joten *Pelivaran laskenta* on *Automaattinen (oletus)*. Raportointipäivän kanssa Microsoft Project laskee myös itse samalla tavalla: aloitettu tehtävä saa loppupelivaran, ja muut tehtävät saavat pienemmän alku- ja loppupelivaran.

Olemassa olevalle projektille profiili valitaan kohdassa *Asetukset › Projekti › Projektin asetukset*, lohkossa *Laskentaprofiili ja laskentavaihtoehdot*, pudotusvalikossa *Laskentaprofiili*. Saman paikan voi avata myös kohdasta *Tiedosto › Projektin asetukset*. Profiilin vaihto tässä muuttaa vain laskentasääntöjä. Laskentavaihtoehdot pysyvät ennallaan. Jos ne poikkeavat profiilin oletusarvoista, niiden yläpuolella näkyy oranssi lohko. Se on usein tarkoituksella, esimerkiksi siksi, että vaihtoehdot tulevat avatusta tiedostosta. Jos oletusarvo halutaan silti, valitse lohkosta *Käytä kohteen … oletusasetuksia*. Rasti piilottaa lohkon tälle avatulle tiedostolle.

Ennen kuin *Käytä*-painiketta painetaan, muutos on vain lomakkeessa. Kun *Käytä* on painettu, sovellus laskee aikataulun heti uudelleen, vaikka *Laske automaattisesti* ei ole päällä. Jos tehtäviä siirtyi, sovellus kertoo määrän, esimerkiksi *Soveltamisen jälkeen 4 tehtävää siirtyi.* Koko vaihto on yksi vaihe, jonka *Kumoa* palauttaa kerralla. Jos *Kumoa* tai *Tee uudelleen* painetaan, kun *Projektin asetukset* on auki, lohko seuraa projektin tilaa. Jos lohkossa on jo tehty itse muutos, valinta säilyy. Keltainen lohko kertoo, että *Käytä* ottaa tuon valinnan käyttöön.

Kolme sisäänrakennettua profiilia ei ole muokattavissa. Muita laskentasääntöjä varten tehdään oma profiili. Sen voi myös tallentaa malliksi, jotta sitä voi käyttää muissa tämän sovelluksen projekteissa. Projektilla on aina oma kopio: jos mallia muutetaan myöhemmin, projekti ei muutu sen mukana. Vaiheet ovat artikkelissa [Laskentaprofiilin valitseminen tai tekeminen](docs://howto-rekenprofiel-kiezen).

### Milloin sovellus valitsee profiilin itse

Kun tiedosto avataan, sovellus ehdottaa profiilia tiedostomuodon perusteella:

- Tiedosto .mpp (Microsoft Project) avautuu profiililla *Microsoft Project*.
- Tiedosto .xer (Primavera P6) avautuu profiililla *Primavera P6*.
- Tiedostot muodossa *MS Project XML*, *Primavera P6 XML* ja *CSV (puolipisteillä erotettu)* avautuvat profiililla *Open Planner Studio* ilman profiiliviestiä.
- Oma projekti (.ifc) avautuu sen sisään tallennetulla profiililla.

Tiedostolle .mpp tai .xer sovellus kertoo profiilin: *Tämä projekti lasketaan tavalla Microsoft Project. Muuta sitä kohdassa Tiedosto → Projektitiedot → Laskentaprofiili ja laskentavaihtoehdot.* Painike *Avaa laskentaprofiili* viestissä vie suoraan kohtaan *Projektin asetukset*. Tiedostolle .xer tämä rivi on avausviestin ensimmäinen tietorivi. Lisää viestistä kerrotaan artikkeleissa [Primavera P6 -tiedoston (.xer) avaaminen](docs://howto-xer-openen) ja [MS Project -tiedoston (.mpp) avaaminen](docs://howto-mpp-openen).

Tiedostolle .mpp sovellus vain asettaa profiilin. Laskentavaihtoehdot jäävät tyhjiksi, kuten uudessa projektissa profiililla *Microsoft Project*: *Pelivaran laskenta* on *Automaattinen (oletus)*. Avattu .mpp-tiedosto ja uusi projekti profiililla *Microsoft Project* laskevat pelivaran siis samalla tavalla.

## Esimerkki: yksi verkko, kolme profiilia

Esimerkki on pieni verkko. Kalenterissa on työviikko maanantaista perjantaihin, eikä näinä viikkoina ole vapaapäiviä. Edistymistapa on Retained Logic (oletus). Projektin aloituspäivä on maanantaina 7. kesäkuuta 2027. Kaikkien tehtävien kesto on työpäivinä.

- *Pour foundation*: 5 työpäivää, suunniteltu alkamaan maanantaina 7. kesäkuuta.
- *Lay walls*: 5 työpäivää, edeltäjänä *Pour foundation* (lopusta alkuun).
- *Order window frames*: 3 työpäivää, ilman edeltäjää, suunniteltu alkamaan maanantaina 7. kesäkuuta.
- *Fit roof*: 2 työpäivää, edeltäjinä *Lay walls* ja *Order window frames*. Tämän tehtävän loppu on luovutus.

Luvut on laskenut sovelluksen laskentamoottori. Ne näkyvät paneelissa *Ominaisuudet*, kohdassa *CPM-tulos*.

**Ilman raportointipäivää ja ilman edistymistä kaikki kolme profiilia laskevat tämän verkon samalla tavalla.** *Pour foundation* kulkee maanantaista 7. kesäkuuta perjantaihin 11. kesäkuuta, *Lay walls* maanantaista 14. kesäkuuta perjantaihin 18. kesäkuuta ja *Fit roof* maanantaina 21. ja tiistaina 22. kesäkuuta. Luovutus on tiistaina 22. kesäkuuta. *Order window frames* (maanantaista 7. kesäkuuta keskiviikkoon 9. kesäkuuta) on 7 työpäivän kokonaispelivarassa.

Nyt kirjataan tila. Raportointipäivä on keskiviikko 9. kesäkuuta. Perustus alkoi maanantaina 7. kesäkuuta, ja sen valmiusaste on 60 %. Jäljellä oleva työ on siis 2 työpäivää (5 × 40 %). *Order window frames* ei ole alkanut. Siinä artikkelissa kerrotaan, miten [edistyminen ja raportointipäivä](docs://uitleg-voortgang) toimivat. Tässä kysytään, mitä profiili tekee sen kanssa.

### Open Planner Studio

Perustuksen jäljellä oleva työ alkaa raportointipäivästä: keskiviikkona 9. ja torstaina 10. kesäkuuta. Varhaisin alkamispäivä pysyy toteutuneena alkamispäivänä, maanantaina 7. kesäkuuta. Varhaisin valmistumispäivä on torstaina 10. kesäkuuta. *Lay walls* kulkee perjantaista 11. kesäkuuta torstaihin 17. kesäkuuta ja *Fit roof* perjantaina 18. ja maanantaina 21. kesäkuuta.

*Order window frames* oli suunniteltu alkamaan maanantaina 7. kesäkuuta, mutta sitä ei ole aloitettu. Työ, jota ei ole aloitettu, ei voi jäädä menneisyyteen. Sovellus siirtää sen siksi raportointipäivään: keskiviikosta 9. kesäkuuta perjantaihin 11. kesäkuuta. Sen kokonaispelivara on 4 työpäivää. Luovutus on maanantaina 21. kesäkuuta.

### Primavera P6

Kaikki on sama kuin Open Planner Studio -ohjelmassa, paitsi yksi kohta: tehtävän *Pour foundation* varhaisin alkamispäivä on keskiviikko 9. kesäkuuta. Se on jäljellä olevan työn alku, ei toteutunut alkamispäivä. Tämän tekee laskentasääntö *Käynnissä oleva tehtävä: varhainen alkamispäivä = jäljellä olevan työn alku*, ryhmässä *Edistyminen ja suoritettu työ*. Loppu ja pelivara eivät sen takia muutu. Luovutus on maanantaina 21. kesäkuuta.

### Microsoft Project

Tässä päivämäärät eroavat. Kaksi laskentasääntöä ryhmässä *Edistyminen Microsoft Project -tavalla* aiheuttavat sen.

*Aloittamattomia tehtäviä ei siirretä raportointipäivään*: *Order window frames* pysyy maanantaista 7. kesäkuuta keskiviikkoon 9. kesäkuuta, vaikka osa siitä on ennen raportointipäivää. Kokonaispelivara on 7 työpäivää.

*Jäljellä oleva työ jatkuu kuluneen ajan jälkeen*: jäljellä oleva työ alkaa aikaisintaan raportointipäivästä, ja aikaisintaan toteutuneesta alkamispäivästä lisättynä jo kuluneella ajalla. 60 %:sta 5 työpäivästä on tehty 3 työpäivää. Maanantai 7. kesäkuuta lisättynä 3 työpäivällä on torstai 10. kesäkuuta. Se on raportointipäivän jälkeen, joten jäljellä oleva työ kulkee torstaina 10. ja perjantaina 11. kesäkuuta. *Lay walls* kulkee maanantaista 14. kesäkuuta perjantaihin 18. kesäkuuta ja *Fit roof* maanantaina 21. ja tiistaina 22. kesäkuuta. Luovutus on tiistaina 22. kesäkuuta: yksi työpäivä myöhemmin kuin kahdessa muussa profiilissa.

### Entä jos

**Perustus on 20 %:n valmiusasteella 60 %:n sijaan.** Jäljellä oleva työ on silloin 4 työpäivää. Kaikissa kolmessa profiilissa perustus valmistuu maanantaina 14. kesäkuuta ja luovutus on keskiviikkona 23. kesäkuuta. Microsoft Project -profiilin sääntö jäljellä olevasta työstä ei tee tässä eroa: maanantai 7. kesäkuuta lisättynä 1 kuluneella työpäivällä on tiistai 8. kesäkuuta, ja se on ennen raportointipäivää. Tällainen sääntö on alaraja. Se voi vain siirtää jäljellä olevaa työtä myöhemmäksi. *Order window frames* ja Primavera P6:n varhaisin alkamispäivä eroavat silti, kuten edellä. Microsoft Project -ohjelmassa *Order window frames* saa silloin 8 työpäivää kokonaispelivaraa.

**Vain raportointipäivä asetetaan, eikä edistymistä kirjata.** Open Planner Studio -ohjelmassa ja Primavera P6:ssa koko verkko siirtyy keskiviikkoon 9. kesäkuuta. Perustus kulkee silloin keskiviikosta 9. kesäkuuta tiistaihin 15. kesäkuuta, ja luovutus on torstaina 24. kesäkuuta: kaksi työpäivää myöhemmin kuin ilman raportointipäivää. Microsoft Project -ohjelmassa kaikki pysyy paikallaan, ja luovutus on tiistaina 22. kesäkuuta.

**Profiili kootaan itse.** Open Planner Studio -ohjelmassa tehdään oma profiili painikkeella *Uusi profiili* ja lähtökohdaksi valitaan *Kopio: Open Planner Studio*. Siinä kytketään päälle vain *Aloittamattomia tehtäviä ei siirretä raportointipäivään*. Kun edistyminen on 60 %, perustus säilyttää Open Planner Studio -ohjelman päivämäärät (loppu torstaina 10. kesäkuuta ja luovutus maanantaina 21. kesäkuuta). *Order window frames* pysyy kuitenkin maanantaista 7. kesäkuuta keskiviikkoon 9. kesäkuuta, ja sen kokonaispelivara on 6 työpäivää. Profiili on siis kokoelma erillisiä kytkimiä, joita voi muuttaa yksi kerrallaan.

**Laskentavaihtoehto laskentasäännön sijaan.** Jos Open Planner Studio -ohjelmassa asetetaan *Kriittisyyden määritelmä* arvoon *Kokonaispelivara ≤ kynnysarvo* ja *Kynnysarvo (työpäivinä)* arvoon 4, *Order window frames* on kriittinen, koska sen kokonaispelivara on täsmälleen 4. Päivämäärät eivät muutu. Laskentavaihtoehto on projektikohtainen valinta, ja se on riippumaton profiilista.

**Tavoitepäivä ylittyy.** Tehtävälle *Fit roof* asetetaan tavoitepäivä perjantaiksi 18. kesäkuuta. Open Planner Studio -ohjelmassa tehtävän *Fit roof* kokonaispelivara on silloin −1 työpäivää, ja vapaa pelivara on myös −1. Primavera P6:ssa kokonaispelivara pysyy arvossa −1, mutta vapaa pelivara on 0. Sen tekee laskentasääntö *Vapaa pelivara ei koskaan negatiivinen*, ryhmässä *Pelivara ja myöhäiset päivämäärät*. Microsoft Project -ohjelmassa molemmat ovat −2, koska luovutus on siellä päivää myöhemmin. Miten tavoitepäivä toimii, on kerrottu artikkelissa [Rajoitteet ja tavoitepäivät](docs://uitleg-constraints).

## Seuraukset ja väärinkäsitykset

**"Profiili on sovelluksen asetus."** Ei. Profiili ja laskentavaihtoehdot kuuluvat projektiin ja kulkevat tiedoston mukana. Sovellukseen kuuluvat vain säilytetyt mallit. Projektilla on aina oma kopio niistä.

**"Jos projekti viedään, profiili menee mukana."** Vain omalla projektimuodolla (.ifc) profiili menee mukana. Jos projekti viedään muotoon *MS Project XML*, *Primavera P6 XML* tai *CSV (puolipisteillä erotettu)*, profiilia ei ole tiedostossa. Laskentavaihtoehdoista MS Project XML -vienti kirjoittaa enintään kriittisen kynnysarvon. Sovellus varoittaa tästä vain projektista, joka tuotiin .xer-tiedostosta. Itse luodusta projektista ei näytetä viestiä. Tiedosto avautuu sitten Open Planner Studio -projektina, ilman profiiliviestiä. Esimerkkinä on profiili Microsoft Project ja 60 %:n edistyminen. Jos se viedään muotoon *MS Project XML* ja avataan uudelleen, sovellus näyttää ensin tiedoston päivämäärät, ja luovutus on tiistaina 22. kesäkuuta. Jos laskenta tehdään uudelleen sovelluksessa, luovutus siirtyy maanantaille 21. kesäkuuta. Mitä muuta vienti menettää, on kuvattu kohdassa [Tiedostot ja muodot](docs://uitleg-bestanden).

**"Primavera P6 -profiili antaa saman tuloksen kuin P6."** Sovellus ei voi taata sitä. Profiili ottaa käyttöön P6:sta tunnetut laskentasäännöt. Ne eivät kuitenkaan ole kaikki P6:n asetukset. Retained Logic -tavan ja Progress Override -tavan lisäksi P6:ssa on kolmas edistymistapa, Actual Dates. Sovellus ei tunne sitä. Tällainen .xer-tiedosto lasketaan Retained Logic -tavalla, ja avaamisen viesti kertoo siitä, esimerkiksi *1 P6-aikataulutusasetus käytti turvallista varavaihtoehtoa.* Osa Primavera P6 -profiilin laskentasäännöistä toimii myös vain tehtävissä, jotka tulevat .xer-tiedostosta, esimerkiksi *Aloittamaton LOE käyttää tavoiteikkunaa* ja *Todellisten päivämäärien täsmällinen säilytys*. Joidenkin kohdalla selitys kertoo tämän, esimerkiksi: "vain tehtävät, joilla on P6-alkuperä". Itse luoduissa tehtävissä nämä laskentasäännöt eivät tee mitään.

**"Edistymistapa kuuluu profiiliin."** Ei. Retained Logic tai Progress Override on projektikohtainen valinta, joka tehdään erikseen profiilista. Katso [Edistymistavan valitseminen](docs://howto-voortgangsmodus-kiezen). Yksi Primavera P6 -laskentasääntö, *Progress Override ohittaa aloitetun seuraajan myös takaperoin*, vaikuttaa vain, kun valintana on Progress Override.

**"Vaihdan profiilia vain nähdäkseni, mitä tapahtuu."** Se onnistuu, sillä *Käytä* kumotaan yhdellä askeleella: *Kumoa* palauttaa profiilin ja päivämäärät yhdessä. Päivämäärät voivat kuitenkin todella siirtyä. Esimerkissä profiilin vaihto Open Planner Studio -profiilista Microsoft Project -profiiliin siirtää kaikki 4 tehtävää. Viesti kertoo tehtävien määrän. Aikataulu kannattaa tarkistaa vaihdon jälkeen, ennen jatkamista. Jos sovellus näyttää vielä tiedoston päivämäärät .xer- tai .mpp-tiedoston avaamisen jälkeen, profiilin vaihto poistaa tämän näkymän ja sovellus laskee itse. Miten tämä toimii, on kuvattu kohdassa [Tallennetut päivämäärät](docs://uitleg-datums-zoals-opgeslagen).

**Esimerkissä on neljä laskentasääntöä, ja sovelluksen luettelo on pidempi.** Esimerkin jokaisella rivillä on oma selitys. Se kannattaa lukea ensin. Myös ryhmä *Vain omat profiilit* kannattaa katsoa: nämä laskentasäännöt ovat pois päältä kaikissa sisäänrakennetuissa profiileissa, myös Primavera P6:ssa. Vain oma profiili voi ottaa ne käyttöön: luo sellainen painikkeella *Uusi profiili*.

## Katso myös

- [Laskentaprofiilin valinta tai rakentaminen](docs://howto-rekenprofiel-kiezen): profiilin valinta, vaihto tai rakentaminen.
- [Edistyminen, raportointipäivä ja perustaso](docs://uitleg-voortgang): mitä raportointipäivä ja jäljellä oleva työ tekevät, ja profiilikohtaiset erot.
- [Edistymistavan valitseminen](docs://howto-voortgangsmodus-kiezen): valinta Retained Logic tai Progress Override.
- [Kriittinen polku ja pelivara](docs://uitleg-kritiek-pad): laskentavaihtoehdot kriittiselle polulle ja pelivaralle.
- [Riippuvuudet ja viive](docs://uitleg-relaties): laskentavaihtoehto *Viiveen kalenteri*.
- [Tiedostot ja muodot](docs://uitleg-bestanden): mitä vienti kuljettaa mukanaan ja mitä ei.
- [Vieminen](docs://howto-exporteren): projektin vieminen.
- [Edistymisen päivittäminen](docs://howto-voortgang-bijwerken): prosentin, toteutuneen alkamispäivän ja raportointipäivän syöttäminen.
- [Tallennetut päivämäärät](docs://uitleg-datums-zoals-opgeslagen): miksi tuodut päivämäärät voivat erota siitä, mitä sovellus itse laskee.
- [Laskentavaihtoehdot ja laskentasäännöt](docs://ref-rekenopties-en-conventies): kaikki laskentasäännöt ja laskentavaihtoehdot yhdessä luettelossa.

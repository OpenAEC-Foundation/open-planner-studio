# Tehtävien ja välitavoitteiden lisääminen

Tavoite: lisätä uusi tehtävä tai välitavoite aikatauluun, oikeaan kohtaan.

## Milloin tätä tarvitaan

Aikataulua rakennetaan, työtä lisätään tai halutaan kirjata hetki, kuten luovutus tai tarkastus.

**Tehtävä** on työ, johon kuluu aikaa. Uusi tehtävä kestää oletuksena 5 työpäivää (tuntisuunnittelussa projektin oletus voi olla tunteina). **Välitavoite** on hetki ilman kestoa: 0 päivää. Tehtävää, jolla on alitehtäviä, kutsutaan **yhteenvetotehtäväksi**. Rakentamisessa se on usein vaihe. Sen kesto ja päivämäärät seuraavat alitehtävistä heti, kun käytetään **Laske**-komentoa (F5).

## Vaiheet

### Tehtävän lisääminen

1. Valitse *Aloitus › Tehtävät › Tehtävä*. Sama painike on välilehdellä *Taulukko*.
2. Paneeli *Ominaisuudet* avautuu ja kenttä *Nimi* on valittuna. Kirjoita nimi ja paina Enter.

Uuden tehtävän nimi on aluksi *Uusi tehtävä*, ja se alkaa projektin aloituspäivänä.

Jos tehtävä on valittuna, uusi tehtävä tulee heti sen alle samalle tasolle. Jos valittu tehtävä on yhteenvetotehtävä, uusi tehtävä tulee koko vaiheen alle, siis alitehtävien jälkeen. Jos mitään ei ole valittuna, se tulee luettelon loppuun. Painikkeen vihjeteksti kertoo, kumpi näistä tapahtuu: *Uusi tehtävä heti valinnan alle* tai *Uusi tehtävä listan alaosaan*. Jos useita tehtäviä valitaan, luodaan yksi uusi tehtävä. Se tulee valitun alimman tehtävän alle, niin kuin se näkyy ruudulla.

### Nopeasti peräkkäin tehtävätaulukossa

Tehtävätaulukossa viimeisen tehtävän alla on aina harmaa rivi *Uusi tehtävä*. Rivi ei ole vielä tehtävä. Se ei näy Gantt-kaaviossa eikä tiedostossa.

1. Napsauta tämän rivin solua tai siirry siihen alanuolella.
2. Kirjoita nimi ja paina Enter. Nyt rivistä tulee oikea tehtävä, samalle tasolle kuin yläpuolella oleva tehtävä. Kohdistin on heti harmaalla rivillä sen alla.
3. Kirjoita seuraava nimi, ja niin edelleen.

Jos harmaalla rivillä täytetään vain kesto tai päivämäärä, tehtävän nimi on *Uusi tehtävä*. Jos poistutaan täyttämättä mitään, ei tapahdu mitään: ei tehtävää eikä vaihetta *Kumoa*-toiminnossa. Tehtävän luominen ja sen ensimmäinen arvo ovat yhdessä yksi vaihe *Kumoa*-toiminnossa. Harmaa rivi näkyy vain, kun tehtävätaulukkoa ei suodateta, ryhmitellä tai lajitella.

### Hiiren oikealla tyhjään kohtaan

Napsauta tyhjää kohtaa hiiren oikealla painikkeella: tehtävätaulukossa viimeisen tehtävän alla tai Gantt-kaaviossa palkkien vieressä tai alla. Valitse *Uusi tehtävä* tai *Lisää välitavoite*. Tehtävä tulee luettelon loppuun. Gantt-kaaviossa se alkaa siitä päivästä, johon napsautit. Tehtävätaulukossa nimisolu avautuu heti, joten nimen voi kirjoittaa.

### Tietyn tehtävän yläpuolelle tai alapuolelle

Napsauta tehtävää hiiren oikealla painikkeella ja valitse *Lisää yläpuolelle* tai *Lisää alapuolelle*. Näppäimistö toimii myös: Insert lisää valitun tehtävän yläpuolelle, Ctrl+I (⌘+I Macilla) alapuolelle. Tehtävätaulukossa nimisolu avautuu heti Insert-näppäimen jälkeen, joten nimen voi kirjoittaa.

Kun useita tehtäviä on valittuna, luodaan yksi uusi tehtävä. *Lisää yläpuolelle* lisää sen valitun ylimmän tehtävän yläpuolelle, *Lisää alapuolelle* valitun alimman tehtävän alapuolelle.

### Alitehtävän lisääminen

Napsauta tehtävää hiiren oikealla painikkeella ja valitse *Lisää alitehtävä*. Uusi tehtävä tulee sen tehtävän alitehtävien loppuun. Tehtävätaulukossa Gantt-kaavion vieressä yhteenvetotehtävän nimen perässä on myös pieni **+**, joka tekee saman.

### Välitavoitteen lisääminen

1. Valitse *Aloitus › Tehtävät › Välitavoite ▾* ja sitten *Aloitusvälitavoite*, *Loppuvälitavoite* tai *Tarkastushetki (pakollinen)*.
2. Kirjoita nimi ja paina Enter. Sijoittelu noudattaa samaa sääntöä kuin kohdassa *Tehtävä*.

Nämä kolme lajia eroavat näin:

- *Aloitusvälitavoite* kuuluu päivän alkuun ja *Loppuvälitavoite* päivän loppuun. Gantt-kaaviossa timantti on vastaavasti päivän sarakkeen vasemmalla tai oikealla puolella. Tämä vaikuttaa myös seuraajaan. Oletetaan, että välitavoite on tiistaina 29. syyskuuta 2026 ja tehtävä seuraa sitä lopusta alkuun -riippuvuudella. Aloitusvälitavoitteen jälkeen tehtävä alkaa samana tiistaina. Loppuvälitavoitteen jälkeen se alkaa keskiviikkona 30. syyskuuta.
- *Tarkastushetki (pakollinen)* on loppuvälitavoite, jonka työlaji on *Tarkastus* ja jossa on valintaruutu *Pakollinen (sopimuksellinen)* rastitettuna.

### Olemassa olevan tehtävän muuttaminen välitavoitteeksi

Napsauta tehtävää hiiren oikealla painikkeella ja valitse *Välitavoite päälle/pois*. Vaihtoehtoisesti rastita *Välitavoite* paneelissa *Ominaisuudet*. Valikon kohta toimii koko valinnalle. Kesto muuttuu 0:ksi.

Jos se kytketään taas pois, siitä tulee tavallinen tehtävä, jonka kesto on 0. Anna kesto itse.

### Muut tavat

- Ctrl+M (⌘+M Macilla) lisää uuden välitavoitteen luettelon loppuun, vaikka tehtävä on valittuna. Paneeli *Ominaisuudet* ei avaudu.
- Välitavoite, jonka luot Ctrl+M:llä tai hiiren oikean painikkeen valikosta, saa työlajin *Tarkastus*. *Aloitusvälitavoite* tai *Loppuvälitavoite* valikosta *Välitavoite ▾* saa työlajin *Muu*. Työlajia voidaan tarvittaessa muuttaa paneelissa *Ominaisuudet*.
- *Lisää välitavoite* tehtävän hiiren oikean painikkeen valikossa tekee välitavoitteesta sen tehtävän alitehtävän, ei sisarta.

### Tehtävän tai koko haaran kopioiminen

1. Napsauta tehtävän palkkia Gantt-kaaviossa. Valitse lisää tehtäviä Ctrl+napsautuksella.
2. Paina Ctrl+C (⌘+C Macilla). Sovellus kopioi tehtävän kaikkine alitehtävineen, kopioitujen tehtävien väliset riippuvuudet ja niiden resurssikohdistukset.
3. Halutessasi napsauta sen tehtävän palkkia, jonka viereen kopion pitää tulla, ja paina Ctrl+V (⌘+V).

Kopio saa saman nimen, samat päivämäärät ja saman edistymisen. Se tulee valitun tehtävän sisarukseksi. Kun useita tehtäviä on valittuna, kopio tulee ensin napsauttamasi tehtävän sisarukseksi. Se tulee sisarusten loppuun. Jos mitään ei ole valittuna, kopio tulee luettelon loppuun. Kopioidut tehtävät jäävät valituiksi. WBS-koodit (kunkin tehtävän numero puussa, esimerkiksi 1.2; katso [Rakenteen muokkaaminen](docs://howto-structuur-aanpassen)) määritetään uudelleen, ja aikataulu on vanhentunut.

Leikepöytä on koko sovelluksen yhteinen, joten kopion voi liittää myös toiseen asiakirjaan. Se, mitä siellä ei ole, kuten tehtäväkalenteri, mukautettu työlaji, tehtäväkoodi tai mukautettu kenttä, sovellus tyhjentää ja kertoo siitä.

### Jälkeenpäin

Uusi tehtävä ei vielä muuta muita päivämääriä. Tilarivillä lukee *Vanhentunut — laske uudelleen (F5)*. Paina **Laske** (F5), esimerkiksi valitsemalla *Aloitus › Aikataulu › Laske*.

## Sudenkuopat ja mitä sovellus tekee

**Jokainen uusi tehtävä alkaa projektin aloituspäivänä.** Ilman riippuvuuksia tehtävä ei odota mitään. Lisää riippuvuuksia, katso [Riippuvuuksien lisääminen](docs://howto-relaties-leggen).

**Suodatus, ryhmittely tai lajittelu on päällä.** Silloin näkemäsi järjestys ei ole aikataulun järjestys. Kun tehtävä on valittuna, *Tehtävä* ja *Välitavoite ▾* lisäävät uuden tehtävän luettelon loppuun. Punainen ilmoitus kertoo: *Uusi tehtävä lisättiin loppuun. Suodatuksen, ryhmittelyn tai lajittelun aikana sovellus ei voi sijoittaa sitä valinnan alle.* *Lisää yläpuolelle* ja *Lisää alapuolelle* eivät toimi, ja niiden kohdalla näkyy ilmoitusrivi *Ei käytettävissä suodatuksen, ryhmittelyn tai lajittelun aikana*. Ilmoituksen tai ilmoitusrivin painike *Tyhjennä* poistaa suodatuksen, ryhmittelyn ja lajittelun kerralla. Tämä ei kuulu *Kumoa*-toimintoon: Ctrl+Z ei palauta niitä.

**Alitehtävä tehtävälle, jolla on resurssikohdistuksia.** Tehtävästä tulee yhteenvetotehtävä, ja yhteenvetotehtävällä ei ole itsessään resurssikohdistuksia. Sovellus siirtää resurssikohdistukset uudelle alitehtävälle ja kertoo siitä. Jos se ei onnistu, esimerkiksi koska valittiin *Lisää välitavoite* eikä välitavoitteella voi olla resurssikohdistuksia, sovellus ei lisää mitään ja kertoo syyn.

**Alitehtävä välitavoitteen alle.** Välitavoite muuttuu yhteenvetotehtäväksi. Sovellus poistaa välitavoitemerkinnän ja kertoo siitä viestillä.

**Välitavoitteen päälle kytkeminen yhteenvetotehtävälle tai tehtävälle, jolla on resurssikohdistuksia.** Sovellus kieltäytyy ja kertoo syyn. Resurssikohdistusten kanssa: poista ne ensin.

**Kopiointi tehtävätaulukossa.** Tehtävätaulukossa (ja välilehdellä *Taulukko*) Ctrl+C kopioi vain valittujen solujen arvot, kuten taulukkolaskennassa, ja Ctrl+V liittää ne soluihin. Tehtävien kopiointi onnistuu siis vain Gantt-kaaviosta: napsauta ensin palkkia.

## Katso myös

- [Rakenteen muokkaaminen](docs://howto-structuur-aanpassen): tehtävien sisentäminen ja siirtäminen sekä WBS-numeroiden pitäminen ajan tasalla.
- [Riippuvuuksien lisääminen](docs://howto-relaties-leggen): tehtävien linkittäminen toisiinsa.
- [Tehtävien valitseminen, poistaminen ja kumoaminen](docs://howto-taken-selecteren-verwijderen): tehtävän poistaminen.
- [Kriittinen polku ja pelivara](docs://uitleg-kritiek-pad): mitä sovellus laskee, kun riippuvuuksia on.
- [Tehtävän valintaikkuna ja ominaisuuspaneeli](docs://ref-taak-eigenschappen): kaikki tehtävän kentät.
- [Uusi projekti ja projektitiedot](docs://ref-projectinfo): aloittaminen vaiheistusmallilla.
- [Hiiren oikean painikkeen valikot](docs://ref-contextmenus): kaikki tehtävän valikon kohdat.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): pieni esimerkkiprojekti (*Tiedosto › Esimerkit*) jossa on neljä vaihetta, aloitusvälitavoite ja pakollinen luovutusvälitavoite.

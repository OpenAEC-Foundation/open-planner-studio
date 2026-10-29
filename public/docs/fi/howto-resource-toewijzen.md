# Resurssien kohdistaminen käyrällä

Tavoite: lisää resurssi tehtävään, kuormitusaste päivässä ja käyrä, joka päättää, miten nuo yksiköt jakautuvat tehtävän päiville.

## Milloin tätä tarvitset

Heti kun halutaan nähdä, kuka työskentelee missä ja milloin: muurari ulkokuoren muurauksella, nosturi ontelolaattojen asennuksessa. Ilman resurssikohdistusta ei ole kuormaa. Silloin ei myöskään ole histogrammia eikä ylikuormitusta.

Kaksi termiä. **Kuormitusaste** (sarakkeessa *Kuormitusaste* ja *Kohdista*-ikkunan kentässä *Kuorm./päivä*) kertoo, kuinka suuri osa resurssista työskentelee tehtävällä työpäivää kohden: 1 on yksi muurari, 2 on kaksi heistä, 0,5 on puoli päivää. **Käyrä** päättää, miten kokonaismäärä, kuormitusaste kertaa kesto, jaetaan tehtävän työpäiville. Työ on harvoin tasaista: seinässä alku on hiljainen, keskikohta kiireinen ja loppu taas hiljainen.

Ulkokuoren muuraus vie 6 työpäivää. Kun muurari on yksi ja käyrä *Tasainen*, kuormitusaste on 1 jokaisena 6 päivänä, yhteensä 6. Käyrällä *Kellomainen* yhteensä on yhä 6, mutta jakautuminen on 0, 1, 2, 2, 1 ja 0.

## Vaiheet

Resurssin voi kohdistaa kahdella tavalla. Resurssin on jo oltava olemassa (katso [Resurssien hallinta](docs://howto-resources-beheren)).

### Valintanauhan kautta

1. Valitse yksi tehtävä tehtävätaulukosta. Se on oltava tavallinen tehtävä, ei välitavoite eikä vaihe.
2. Valitse *Resurssit › Resurssikohdistus › Kohdista ▾*.
3. Täytä ikkunassa *Kuorm./päivä*-kenttä (oletus 1) ja valitse *Käyrä* (oletus *Tasainen*). Ne koskevat resurssia, jonka valitaan nyt.
4. Napsauta resurssia. Ikkuna sulkeutuu ja resurssikohdistus on lisätty.

Toisen resurssin kohdistamiseksi ikkuna avataan uudelleen. Tehtävään jo kohdistetut resurssit puuttuvat luettelosta.

### Ominaisuuspaneelin kautta

1. Valitse tehtävä. Paneeli *Ominaisuudet* on oikealla. Jos sitä ei näy, ota se käyttöön kohdasta *Näkymä › Paneelit › Ominaisuudet*.
2. Valitse *Resurssikohdistukset*-osiossa, aivan alhaalta, resurssi kohdasta *Kohdista resurssi*. Kohdistus alkaa kuormitusasteella 1 ja käyrällä *Tasainen*.
3. Muuta jokaisen kohdistuksen *Kuormitusaste*-arvoa. Napsauta resurssin nimeä, jolloin *Käyrä* näkyy, ja valitse siellä toinen käyrä.

Näin muutetaan myös olemassa olevaa resurssikohdistusta. Rivin lopussa olevalla roskakorilla (*Poista*) kohdistus poistetaan tehtävältä. Resurssi itse jää paikalleen. Kohdasta *Siirrä kohteeseen…* (näkyy, kun nimeä napsautetaan) kohdistus siirretään toiseen tehtävään.

### Käyrät

- *Tasainen*: joka päivä yhtä paljon. Tämä on oletus. Se sopii työhön, joka on joka päivä yhtä raskasta.
- *Alussa painottuva*: alku on raskaampi kuin loppu. Sopii työhön, joka alkaa raskaalla työllä, kuten linjauksella.
- *Lopussa painottuva*: loppu on raskaampi kuin alku. Sopii työhön, joka käy kiireisemmäksi, kun valmiusaste kasvaa.
- *Kellomainen*: huippu keskellä, hiljainen alku ja loppu. Sopii seinään, joka alkaa hiljaa, on täydessä vauhdissa keskellä ja hiipuu.
- *Aikainen huippu*: huippu ennen keskikohtaa. Sopii työhön, joka pääsee nopeasti vauhtiin.
- *Myöhäinen huippu*: huippu keskikohdan jälkeen. Sopii työhön, jonka kiireinen jakso tulee vasta myöhemmin.
- *Kaksoishuippu*: kaksi huippua. Sopii työhön, jossa on kaksi kiireistä hetkeä.
- *Kilpikonna*: hiljainen alku ja loppu sekä leveä huippu keskellä. Sopii pitkään työhön, joka kasvaa ja hiipuu vähitellen.

Käyrä muuttaa vain jakautumista. Kesto, päivämäärät ja kokonaismäärä pysyvät samoina. Sen jälkeen ei tarvitse laskea uudelleen. Histogrammi mukautuu heti. Sen näkee valitsemalla *Resurssit › Histogrammi › Histogrammi*. Jos tehtävä valitaan, histogrammi näyttää vain tämän tehtävän kuorman.

## Sudenkuopat ja mitä sovellus silloin tekee

**Käyrä voi nostaa huipun asettamasi kuormitusasteen yli.** Kun kuormitusaste on kokonaisluku, sovellus pyöristää arvon päivittäin kokonaisluvuiksi, ja kokonaismäärä pysyy samana. Muurari, jonka kuormitusaste on 1 ulkokuoren muurauksella ja käyrä *Kellomainen*, antaa arvot 0, 1, 2, 2, 1, 0. Kahtena keskimmäisenä päivänä kuormitusaste on silloin 2, kun *Enimmäismäärä* on 1. Histogrammi värjää nuo päivät punaisiksi, ja resurssi on silloin ylikuormitettu. Valitse toinen käyrä tai jaa tunnit itse (katso [Tuntijakautuman muokkaaminen](docs://howto-urenverdeling-aanpassen)). Kuormitusasteilla kuten 0,5 sovellus pyöristää sadasosiin. Lyhyessä tehtävässä kokonaisilla kuormitusasteilla muoto karkeutuu: 10 päivän aikana *Kilpikonna* kuormitusasteella 1 antaa jakautumisen 0, 1, 1, 2, 2, 1, 1, 1, 1, 0, täsmälleen sama kuin *Aikainen huippu*.

**Ei välitavoitetta eikä vaihetta.** *Kohdista*-painike on silloin pois käytöstä. Paneeli *Ominaisuudet* näyttää viestin *Resurssikohdistukset eivät ole mahdollisia välitavoitteissa.* tai *Resurssikohdistukset eivät ole mahdollisia yhteenvetotehtävissä.*

**Resurssi voi olla tehtävässä vain kerran.** Jos resurssi on jo tehtävässä, sitä ei ole enää luettelossa. Jos kaikki resurssit on jo kohdistettu, sovellus sanoo *Kaikki resurssit on jo kohdistettu.* Jos resursseja ei ole vielä lainkaan, se sanoo *Luo ensin resurssit (Resurssit-välilehti).*

**Kuormitusasteen on oltava suurempi kuin 0.** Sovellus ei hyväksy arvoa 0 tai sitä pienempää.

**Materiaali.** Materiaaliresurssilla kuormitusaste on määrä päivässä resurssin yksikössä, esimerkiksi m³. Materiaali ei vaikuta tehtävän kestoon.

**Tehtävätyyppi voi muuttaa kestoa.** Jos tehtävä on tyyppiä *Kiinteä työmäärä* tai *Kiinteä yksikkömäärä*, toinen resurssi muuttaa tehtävän kestoa. Aikataulu ei ole silloin enää ajan tasalla. Paina **Laske** (F5). Katso [Tehtävätyypit: kesto, kuormitusaste ja työ](docs://uitleg-werkregels).

**Oma jakautuminen.** Jos kohdistuksella on jo oma tuntijakautuma, käyrä ei ole käytössä ja näyttää *Jaksottuminen*. Vapauta tuntijakautuminen ensin kohdasta *Muokkaa tuntijakautumista…*.

**Kumoaminen.** Resurssikohdistuksen luomisen, muuttamisen tai poistamisen voi kumota kohdasta *Kumoa* (Ctrl+Z).

## Katso myös

- [Tuntijakautuman muokkaaminen](docs://howto-urenverdeling-aanpassen): tuntien asettaminen päivittäin itse.
- [Ylikuormituksen ratkaiseminen](docs://howto-overbezetting-oplossen): mitä tehdä, kun resurssilla on liikaa tehtävää yhdelle päivälle.
- [Tehtävätyypit: kesto, kuormitusaste ja työ](docs://uitleg-werkregels): mitä kestolle tapahtuu, kun kuormitusastetta muutetaan.
- [Resurssipaneeli](docs://ref-resourcepaneel): kaikki resurssipaneelin kentät ja painikkeet.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): kaikki viisi resurssityyppiä, kuusi kahdeksasta käyrästä ja torninosturi, jonka kapasiteetti muuttuu 30. elokuuta 2027 alkaen.

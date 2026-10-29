# Riippuvuuksien lisääminen

Tavoite: linkitä tehtävät toisiinsa. Tehtävä alkaa vasta, kun sitä edeltävä työvaihe on päättynyt. Tarvittaessa lisätään niiden väliin odotusaika (viive).

## Milloin tätä tarvitaan

Ilman riippuvuuksia sovellus ei tiedä, että muurari voi aloittaa vasta, kun perustus on valettu. Silloin jokainen tehtävä alkaa projektin aloituspäivänä, eikä loppupäivällä ole merkitystä. **Riippuvuus** tallentaa tämän järjestyksen. Ensimmäinen tehtävä on **edeltäjä**, toinen **seuraaja**.

Riippuvuuksia lisätään, kun laaditaan aikataulu, kun tehtävä lisätään tai kun kaksi tehtävää osoittautuu lopulta riippuvaisiksi toisistaan. **Viive** on odotusaika kahden tehtävän välillä, esimerkiksi betonin kovettuminen tai lattiatasoitteen kuivuminen.

Oletusriippuvuus on **FS** (lopusta alkuun): seuraaja voi alkaa vasta, kun edeltäjä on päättynyt. Sovellus tuntee myös SS-, FF- ja SF-riippuvuudet. Ne yhdistävät alun tai lopun alkuun tai loppuun. Esimerkiksi SS (alusta alkuun): rappaus voi alkaa vasta, kun talotekniikan asennus on alkanut.

Ei ole selvää, mitä tyyppiä tarvitaan? Tyypin valinnan alapuolella näkyy lause todellisilla tehtävien nimillä, esimerkiksi *Metselwerk voi alkaa vasta, kun Fundering on päättynyt.* Kun valitaan toinen tyyppi, lause muuttuu sen mukana. Lause näkyy *Riippuvuuden tyyppi* -ikkunassa, osiossa *Riippuvuudet* ja sarakkeissa *Edeltäjät* tai *Seuraajat*.

## Vaiheet

Riippuvuuden voi lisätä neljällä tavalla. Kaikki luovat saman riippuvuuden. Valitse se, joka sopii parhaiten tilanteeseen.

### Kahden valitun tehtävän linkittäminen

Hyödyllinen, kun työskennellään tehtävätaulukossa.

1. Napsauta tehtävätaulukossa ensimmäistä tehtävää, eli edeltäjää.
2. Pidä Ctrl-näppäintä alhaalla (macOS:ssä ⌘) ja napsauta seuraavaa tehtävää, eli seuraajaa.
3. Valitse *Aloitus › Tehtävät › Riippuvuus ▾ › Linkitä valitut tehtävät*. Sama painike on myös kohdassa *Aikataulu › Riippuvuudet*.

Sovellus luo lopusta alkuun -riippuvuuden (FS) ilman viivettä. Se näkyy nuolena Gantt-kaaviossa ja sarakkeessa *Edeltäjät*. Ilmoitus näkyy vain, jos sovellus hylkää riippuvuuden. Painike toimii vain, kun valittuna on täsmälleen kaksi tehtävää.

### Riippuvuuden piirtäminen Gantt-kaaviossa

Hyödyllinen, kun lisätään monta riippuvuutta peräkkäin.

1. Valitse *Aloitus › Tehtävät › Riippuvuus ▾ › Piirrä riippuvuus*. Aikataulun yläpuolella näkyy ilmoitus *Linkitystila: vedä Gantt-kaaviossa palkista toiseen luodaksesi riippuvuuden. Esc lopettaa*.
2. Paina edeltäjän palkkia ja vedä seuraajan palkkiin. Katkoviiva nuolineen seuraa osoitinta.
3. Vapauta hiiren painike. Pieni *Riippuvuuden tyyppi* -ikkuna avautuu. Siinä on tyyppi (oletuksena FS) ja kenttä viiveelle.
4. Muuta tarvittaessa tyyppiä tai viivettä ja paina Enter tai napsauta ikkunan ulkopuolelle. Riippuvuus luodaan.
5. Lisää seuraava heti: linkitystila pysyy päällä. Lopeta Esc-näppäimellä, ilmoituksen painikkeella *Lopeta* tai valitsemalla uudelleen *Piirrä riippuvuus*.

Jos *Riippuvuuden tyyppi* -ikkunassa painetaan Esc, mitään ei tallenneta. Yksittäiselle riippuvuudelle linkitystilaa ei tarvitse ottaa käyttöön. Pidä Shift painettuna ja vedä palkista toiseen. Palkin pikavalikon kohta *Luo riippuvuus tästä* ottaa linkitystilan käyttöön. Vetäminen tehdään silti itse. Välilehdellä *Taulukko*, ilman Gantt-kaaviota, *Piirrä riippuvuus* ei ole käytettävissä.

### Riippuvuuden lisääminen ominaisuuspaneelissa

Hyödyllinen, kun yhtä tehtävää katsotaan ja halutaan lisätä sen edeltäjiä tai seuraajia.

1. Valitse tehtävä. Oikealla on ominaisuuspaneeli *Ominaisuudet*. Jos paneelia ei näy, ota se käyttöön kohdasta *Näkymä › Paneelit › Ominaisuudet*.
2. Napsauta osiossa *Riippuvuudet* painiketta *Lisää riippuvuus*.
3. Jätä suunnaksi *Edeltäjä*, jos toinen tehtävä tulee ensin. Muuten valitse *Seuraaja*.
4. Kirjoita osa toisen tehtävän nimestä. Valitse oikea nuolinäppäimillä ja Enter-näppäimellä tai napsauta sitä.
5. Valitse tyyppi (oletuksena FS) ja täytä tarvittaessa viive.
6. Paina Enter tai napsauta valintamerkkiä (*Luo riippuvuus*).

Tehtävän riippuvuudet näkyvät sitten osiossa *Riippuvuudet*. Jokaisella on toisen tehtävän WBS-numero, tyyppi ja viive.

### Riippuvuuksien kirjoittaminen sarakkeeseen Edeltäjät

Hyödyllinen, kun työskennellään nopeasti näppäimistöllä ja WBS-numerot ovat tiedossa.

1. Napsauta tehtävätaulukon otsikkorivin oikealla puolella olevaa **+**-painiketta (*Lisää sarake*). Valitse kohdasta *Riippuvuudet* sarake *Edeltäjät*. Sarake *Seuraajat* toimii samalla tavalla.
2. Napsauta sarakkeessa *Edeltäjät* seuraajan solua.
3. Kirjoita edeltäjän WBS-numero, välilyönti ja tyyppi, esimerkiksi `2.6 FS`. Kirjoita viive heti perään: `2.6 FS+1d`. Erota useat edeltäjät puolipisteellä tai pilkulla: `3.1 FS; 3.2 SS+2d`.
4. Paina Enter.

Kirjoitettu teksti korvaa koko solun. Jos solussa on jo edeltäjiä, kirjoita nekin (katso kohta Sudenkuopat). Jos solussa painetaan Enter tai F2 kirjoittamisen sijaan, avautuu kenttä, joka säilyttää nykyiset riippuvuudet. Tehtävä haetaan WBS-numerolla tai nimellä, ja jokaiselle riippuvuudelle valitaan tyyppi ja viive.

### Viiveen asettaminen tai muuttaminen

Viive kirjoitetaan tyypin viereiseen kenttään, kaikilla yllä kuvatuilla tavoilla. Olemassa oleva viive muutetaan osiossa *Riippuvuudet*. Napsauta viivekenttää, kirjoita uusi arvo ja paina Enter.

- `3` tai `3d`: 3 työpäivää. Viikonloppua ei lasketa. Sovellus näyttää `+3d`.
- `3ed`: 3 kalenteripäivää. Viikonloppu lasketaan mukaan, kuten betoni, joka kovettuu myös lauantaina ja sunnuntaina.
- `-1`: limitys. Seuraaja voi alkaa päivää aiemmin, joten tehtävät menevät päällekkäin.
- `4h`: 4 työtuntia; sovellus näyttää sen muodossa `+4h`. Jos edeltäjä on päivätehtävä ja kalenterissa ei ole omia työaikalohkoja, kuten vakiokalenterissa, sovellus muuntaa viiveen kokonaisiksi työpäiviksi ja pyöristää lähimpään kokonaiseen päivään: `4h` vastaa silloin 1 päivä, `2h` 0 päivää. Kalenterilla, jolla on omia työaikalohkoja, tai tuntitehtävän jälkeen viive lasketaan tarkasti tunteina.
- `50%`: puolet edeltäjän kestosta.

Esimerkiksi perustusbetonin pitää kovettua, ennen kuin muurari voi työskennellä sen päällä. Siksi *Pour foundation → Foundation brickwork* saa FS-riippuvuuden viiveellä `3`. Jos valu on perjantaina 18. kesäkuuta 2027, muuraus alkaa torstaina 24. kesäkuuta **Laske**-komennon jälkeen. Maanantaista keskiviikkoon on odotusaikaa. Kun käytetään `3ed`, viikonloppu lasketaan mukaan ja muuraus alkaa tiistaina 22. kesäkuuta.

### Lopuksi: laske uudelleen

Uusi riippuvuus ei vielä siirrä palkkeja. Tilarivillä lukee *Vanhentunut — laske uudelleen (F5)*. Paina **Laske** (F5), esimerkiksi kohdasta *Aloitus › Aikataulu › Laske*. Vasta sen jälkeen seuraajat saavat uudet päivämäärät. Jos halutaan, että sovellus tekee tämän itse, ota käyttöön *Laske automaattisesti* kohdassa *Asetukset › Projekti › Asetukset*, välilehti *Aikataulu*.

## Sudenkuopat ja mitä sovellus tekee

**Väärä järjestys.** Kohdassa *Linkitä valitut tehtävät* ratkaisee napsautusjärjestys, ei luettelon järjestys. Jos myöhempi tehtävä napsautetaan ensin, riippuvuus on väärinpäin. Poista se kohdassa *Riippuvuudet* roskakorikuvakkeella ja lisää uudelleen.

**Kirjoittaminen sarakkeeseen poistaa vanhan sisällön.** Jos solussa on `3.4 FS; 3.2 FS` ja kirjoitetaan vain `3.2 FS`, riippuvuus 3.4 katoaa ilman ilmoitusta. Kirjoita kaikki edeltäjät, käytä Enter- tai F2-näppäintä niiden lisäämiseen tai peru näppäinyhdistelmällä Ctrl+Z.

**Kehä.** Jos lisätään riippuvuus, joka johtaa takaisin ketjussa aiemmin olleeseen tehtävään, aikataulu ei voisi koskaan alkaa. Sovellus ei hyväksy tällaista riippuvuutta. Se näyttää viestin *Tämä riippuvuus loisi aikatauluun kehän (…), joten sitä ei luotu*, ja kehän tehtävät näkyvät sulkeissa. Poista ensin riippuvuus, joka sulkee kehän.

**Tehtävä omaan vaiheeseensa.** Riippuvuus tehtävän ja sen yläpuolella olevan yhteenvetotehtävän välillä ei ole mahdollinen. Sovellus näyttää viestin *Riippuvuus tehtävän ja sen oman tai sen yläpuolisen yhteenvetotehtävän välillä ei ole sallittu*.

**Kaksoiskappale.** Jos riippuvuus on jo olemassa, sovellus näyttää viestin *Tämä riippuvuus on jo olemassa*, eikä mitään muutu.

**Lyhyemmät viestit sarakkeessa.** Sarake *Edeltäjät* antaa samat hylkäykset lyhyemmällä tekstillä solun alla: *Tämä muutos aiheuttaisi kehän aikatauluun*, *Tämä riippuvuus on jo olemassa* tai *Tehtävällä ei voi olla riippuvuutta oman yhteenvetotehtävänsä kanssa*. Jos kirjoitetaan pelkkä WBS-numero, kuten `3.1`, tyyppi puuttuu ja solussa lukee *Käytä esimerkiksi muotoa 1.2 FS+2d*. Solu pysyy auki. Korjaa syöte tai peru Esc-näppäimellä.

**Ei puolia päiviä viiveessä.** Päivinä ilmaistu viive on aina kokonaisluku: `1.5` muuttuu muotoon `+2d`. Päivätehtävän jälkeinen tuntiviive pyöristetään kokonaisiin työpäiviin, jos kalenterissa ei ole omia työaikalohkoja. Syötettä, jota ei voi lukea, kuten sanaa, ei tallenneta. Kenttä palaa edelliseen arvoon.

## Katso myös

- [Kriittinen polku ja pelivara](docs://uitleg-kritiek-pad): mitä sovellus laskee riippuvuuksien perusteella ja miksi tehtävästä tulee kriittinen.
- [Riippuvuudet ja viive](docs://uitleg-relaties): mitä neljä riippuvuustyyppiä ja viive tekevät päivämäärille.
- [Polun jäljittäminen](docs://howto-pad-traceren): edeltäjien ja seuraajien ketjun tuominen näkyviin.
- [Tehtävän ikkuna ja ominaisuuspaneeli](docs://ref-taak-eigenschappen): kentät riippuvuuksille ja viiveelle paneelissa ja ikkunassa.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): ketju lopusta alkuun -riippuvuuksia ja yksi alusta alkuun -riippuvuus (seinät ja katto, viive 2 päivää) sekä yksi lopusta loppuun -riippuvuus (laatoitus ja maalaus, viive 1 päivä).

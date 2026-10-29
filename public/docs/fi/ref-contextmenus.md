# Oikean painikkeen valikot

Tässä kerrotaan, mitkä valikot hiiren oikea painike avaa Gantt-kaaviossa ja tehtävätaulukossa. Tässä kerrotaan myös, mitä kukin kohta tekee ja mihin tehtäviin se vaikuttaa. Kohdat, joilla on myös painike tai pikanäppäin, ovat kohdissa [Valintanauha, välilehti kerrallaan](docs://ref-lint) ja [Pikanäppäimet](docs://ref-sneltoetsen).

## Mikä valikko missä

Valikkoja on neljä. Se, mikä valikko aukeaa, riippuu siitä, mihin napsautetaan:

- **Tehtäväpalkilla Gantt-kaaviossa** — tehtävävalikko, jonka yläosassa on *Luo riippuvuus tästä*.
- **Tehtävällä tehtävätaulukossa** — sama tehtävävalikko ilman tätä yhtä kohtaa yläosassa. Tämä koskee tehtävätaulukkoa Gantt-kaavion vasemmalla puolella ja *Taulukko*-välilehteä.
- **Ryhmän otsikkorivillä tehtävätaulukossa** — pieni valikko ryhmien laajentamiseen ja tiivistämiseen. Ryhmän otsikkorivit näkyvät vain, kun ryhmitellään, esimerkiksi *Resurssikaavio*-asettelun avulla.
- **Tyhjään tilaan** — Gantt-kaaviossa palkkien vieressä tai alapuolella ja tehtävätaulukossa viimeisen tehtävän alapuolella tai harmaalla *Uusi tehtävä* -rivillä. Valikossa ovat *Uusi tehtävä*, *Lisää välitavoite* ja *Liitä*. Gantt-kaaviossa myös *Palauta zoom* ja *Sovita projektiin*. Uusi tehtävä tai välitavoite tulee luettelon loppuun. Gantt-kaaviossa se alkaa päivästä, johon napsautettiin. Tehtävätaulukossa nimisolu avautuu heti, jotta nimi voidaan kirjoittaa.

Ryhmän otsikkorivin kaistalla Gantt-kaaviossa hiiren oikea painike avaa tyhjän tilan valikon. Ryhmän otsikkorivillä on oma valikko vain tehtävätaulukossa. Oikea napsautus aikajanan otsikossa ei tee mitään. Tehtävätaulukon sarakeotsikoilla on oma valikko, joka on kuvattu kohdassa [Taulukon sarakkeiden muokkaaminen](docs://howto-tabelkolommen-aanpassen).

**Mihin tehtäviin kohta vaikuttaa?** Napsautetaan yhtä tehtävää, mutta valinta määrittää laajuuden. Jos napsautettu tehtävä kuuluu valintaan, kohta koskee koko valintaa. Jos ei kuulu, kohta koskee vain tätä yhtä tehtävää. Kun palkkia Gantt-kaaviossa tai riviä tehtävätaulukossa napsautetaan hiiren oikealla painikkeella, tämä tehtävä korvaa valinnan, jos se ei kuulunut siihen. Jokainen kohta, joka muuttaa jotakin, on yksi vaihe, joka kumotaan komennolla *Kumoa*, myös koko valinnalle.

## Tehtävävalikko

Kohdat ovat tässä järjestyksessä. Viiva ryhmien välissä on valikon erotin.

**Luo riippuvuus tästä** — vain Gantt-kaaviossa palkilla. Riippuvuustila otetaan käyttöön, kun tämä tehtävä on valittuna. Sen jälkeen vedetään seuraajan kohdalle. Katso [Riippuvuuksien lisääminen](docs://howto-relaties-leggen).

**Poista tauko** ja **Poista kaikki tauot** — vain Gantt-kaaviossa palkilla, jossa on taukoja. *Poista tauko* näkyy vain, jos napsautetaan taukoa tai tauon jälkeistä osaa ja tauko on muokattavissa. Se poistaa vain tämän yhden tauon. *Poista kaikki tauot* poistaa kaikki, myös tiedostosta peräisin olevat tauot, joita ei voi muokata. Katso [Tehtävän jakaminen](docs://howto-taak-splitsen).

**Muokkaa...** — avaa tämän tehtävän *Muokkaa tehtävää* -ikkunan. Katso [Tehtävän valintaikkuna ja ominaisuuspaneeli](docs://ref-taak-eigenschappen).

**Lisää yläpuolelle** ja **Lisää alapuolelle** — lisää yhden uuden tehtävän valinnan ylimmän tehtävän yläpuolelle tai alimman tehtävän alapuolelle, samalle tasolle. Lisäys onnistuu vain puhtaassa puunäkymässä, ilman suodatusta, ryhmittelyä tai lajittelua. Muutoin sovellus ei tee lisäystä ja näyttää viestin. Katso [Tehtävien ja välitavoitteiden lisääminen](docs://howto-taken-en-mijlpalen-toevoegen).

**Lisää alitehtävä** — lisää uuden alitehtävän napsautetulle tehtävälle alitehtävien loppuun. Koskee vain tätä yhtä tehtävää, ei koko valintaa.

**Lisää välitavoite** — lisää napsautetulle tehtävälle välitavoitteen alitehtävänä. Koskee vain tätä yhtä tehtävää.

**Lisää riippuvuus** — sama kuin *Luo riippuvuus tästä*: riippuvuustila otetaan käyttöön, kun tämä tehtävä on valittuna. Tehtävätaulukossa kohta on poissa käytöstä, jos Gantt-kaavio ei ole näkyvissä. Ohjeteksti on *Käytettävissä vain, kun Gantt-kaavio on näkyvissä*.

**Sisennä** ja **Ulontaa** — valinnan tehtäviä siirretään yhden tason syvemmälle tai ylemmäs WBS-rakenteessa. Nämä kaksi ovat vain puhtaassa puunäkymässä. Katso [Rakenteen muokkaaminen](docs://howto-structuur-aanpassen).

**Vaihda välitavoite** — muuttaa tehtävän välitavoitteeksi tai takaisin tehtäväksi. Uusi tila seuraa napsautetusta tehtävästä ja koskee koko valintaa: jos se on tavallinen tehtävä, kaikista valinnan tehtävistä tulee välitavoitteita. Yhteenvetotehtävä ja tehtävä, jolla on resurssikohdistuksia, eivät muutu välitavoitteeksi. Muut valinnan tehtävät muuttuvat, ja kustakin syystä näytetään viesti.

**Määritä kalenteri ▸** — alivalikko, jossa on *Projektikalenteri* (tehtävällä ei tällöin ole omaa kalenteria) ja sen alla käytettävissä olevat kalenterit. Nykyisessä valinnassa on valintamerkki. Tehtävä, joka on jo tällä kalenterilla, ei lasketa mukaan eikä luo uutta vaihetta komennolle *Kumoa*. Katso [Kalenterin luominen ja määrittäminen](docs://howto-kalender-maken-en-toewijzen).

**Edistyminen ▸** — alivalikko, jossa ovat 0%, 25%, 50%, 75% ja 100%. Nykyisessä arvossa on valintamerkki. Yhteenvetotehtävällä ei ole omaa edistymistä. Jos valinnassa on yhteenvetotehtävä, sen lehtitehtävät saavat prosentin. Ilman raportointipäivää sovellus asettaa sen tähän päivään ja näyttää viestin. Tehtävä, joka on suunniteltu alkamaan vasta raportointipäivän jälkeen eikä sillä ole vielä toteutunutta alkamispäivää, johtaa ensin kysymykseen toteutuneen alkamispäivän asettamisesta. Jos kysymys peruutetaan, mitään ei muuteta. Katso [Edistymisen päivittäminen](docs://howto-voortgang-bijwerken).

**Prioriteetti ▸** — alivalikko, jossa ovat *Matala* (100), *Normaali* (500) ja *Korkea* (900). Se on tehtävän tasaamisen prioriteetti. Nykyisessä arvossa on valintamerkki. Katso [Resurssien tasaaminen](docs://uitleg-nivelleren).

**Jäljitä polku** — näyttää tämän tehtävän edeltäjät ja seuraajat. Jos jäljittäminen on jo päällä, kohdan nimi on *Lopeta polun jäljittäminen*. Katso [Polun jäljittäminen](docs://howto-pad-traceren).

**Tiivistä**, **Laajenna** ja **Tallenna haara mallipohjana** — vain yhteenvetotehtävälle. *Tiivistä* ja *Laajenna* ovat aina molemmat näkyvissä, vaikka tehtävä on jo tiivistetty tai laajennettu, ja ne koskevat koko valintaa. *Tallenna haara mallipohjana* tallentaa tehtävän alitehtävineen ja niiden väliset riippuvuudet WBS-mallipohjana. Katso [WBS-mallipohjien tallentaminen ja lisääminen](docs://howto-wbs-sjablonen).

**Poista** — poistaa valinnan tehtävät alitehtävineen. Vahvistusta ei kysytä. Ne palautetaan painamalla Ctrl+Z, yhdellä vaiheella koko valinnalle. Katso [Tehtävien valitseminen, poistaminen ja kumoaminen](docs://howto-taken-selecteren-verwijderen).

## Ryhmän otsikkorivin valikko

Tämä valikko on olemassa vain tehtävätaulukossa, ryhmän otsikkorivillä:

**Tiivistä ryhmä** tai **Laajenna ryhmä** — tiivistää tai laajentaa vain tämän ryhmän. Kohdan nimi kertoo, mitä voidaan tehdä.

**Laajenna kaikki** ja **Tiivistä kaikki** — laajentaa tai tiivistää kaikki ryhmät kerralla.

Ryhmittely määritetään asettelun avulla. Katso [Asettelun luominen ja käyttäminen](docs://howto-layouts-gebruiken).

## Katso myös

- [Vetäminen, siirtäminen ja zoomaus Gantt-kaaviossa](docs://howto-gantt-bedienen): mitä vetäminen vasemmalla ja keskimmäisellä hiiren painikkeella tekee.
- [Valintanauha, välilehti kerrallaan](docs://ref-lint): painikkeet, joilla on samat toiminnot.
- [Pikanäppäimet](docs://ref-sneltoetsen): näppäimet, jotka kuuluvat niihin.

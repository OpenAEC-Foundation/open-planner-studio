# Resurssien hallinta

Tavoite: luoda, muokata ja poistaa projektin resursseja (henkilöitä, koneita ja materiaaleja), jotta niitä voidaan kohdistaa tehtäviin.

## Milloin tätä tarvitaan

Ennen kuin muurari tai nosturi kohdistetaan tehtävään, henkilön tai koneen on oltava olemassa resurssina. Resurssiin tallennetaan, kuinka monta sitä on ja mihin päiviin se on käytettävissä. Sovellus laskee tämän perusteella, onko sitä vaadittu liikaa yhtenä päivänä. Resurssia muokataan, kun henkilöstö muuttuu, esimerkiksi kun toinen muurari tulee mukaan.

Kaksi termiä. **Enimmäismäärä** on kapasiteetti työpäivää kohden: 1 on yksi henkilö tai kone, 2 on kaksi niistä. **Resurssikohdistus** on resurssi tehtävällä (katso [Resurssien kohdistaminen käyrän avulla](docs://howto-resource-toewijzen)).

## Vaiheet

### Resurssin luominen

1. Valitse *Resurssit › Hallinta › Uusi resurssi*. Resurssipaneeli avautuu koko työtilaan ja taulukon alareunaan ilmestyy tyhjä rivi. Paneelin voi avata myös valitsemalla *Resurssit › Hallinta › Resurssit* ja sen jälkeen *Uusi resurssi projektiin*.
2. Kirjoita nimi, esimerkiksi *Bricklayer*.
3. Valitse *Tyyppi*: *Työvoima* (oletus), *Kalusto*, *Materiaali*, *Aliurakoitsija* tai *Työryhmä*.
4. Täytä muut kentät tarvittaessa. Kaikille kentille on oletusarvo: *Enimmäismäärä* on 1 ja *Kalenteri* on *Projektikalenteri*. *Normaalihinta/h* on tyhjä. *Mitta* voidaan täyttää vain, kun tyyppi on *Materiaali*, esimerkiksi m³.
5. Paina Enter tai napsauta rivin ulkopuolelle. Resurssi on taulukossa. Enter avaa heti tyhjän rivin sen alapuolelle seuraavaa resurssia varten. Kun työ on valmis, paina Esc.

Rivistä tulee resurssi vasta, kun sillä on nimi. Esc-näppäimellä tai napsauttamalla muualle ilman nimeä sovellus ei luo mitään. Täyttöjärjestyksellä ei ole merkitystä: tyypin voi valita ensin ja nimen kirjoittaa sen jälkeen.

### Resurssin muokkaaminen

Muokkaa rivin kenttiä. Sovellus tallentaa nimen, normaalihinnan ja mitan, kun kentästä poistutaan. Muut kentät tallennetaan heti.

- *Enimmäismäärä* hyväksytään vain, jos arvo on suurempi kuin 0. Jos arvo on 0 tai pienempi, kentän reunus muuttuu punaiseksi ja arvo palaa edelliseen.
- *Kalenteri* määrää, mihin päiviin resurssi on käytettävissä. Valitse *Projektikalenteri* tai oma kalenteri. Painikkeella *+ Resurssikalenteri* luodaan uusi kalenteri, ja kynä (*Muokkaa…*) avaa valitun kalenterin. Jos tehtävä on ajoitettu päivälle, jolloin resurssi ei ole kalenterinsa mukaan käytettävissä, kyseinen päivä lasketaan ylikuormitukseksi. Resurssikalenterin luominen on kuvattu ohjeessa [Resurssikalenterin asettaminen](docs://howto-resourcekalender-instellen).
- *Normaalihinta/h* ja *Yhteensä*: *Yhteensä* on resurssin kuormitetut tunnit kerrottuna normaalihinnalla. Rappari, jonka kuormitus on 32 tuntia ja normaalihinta 50 per tunti, on yhteensä 1 600,00. Taulukon alareunassa on kaikkien resurssien summa.
- *Työryhmä* ryhmittelee resurssin resurssin alle, jonka tyyppi on *Työryhmä*. Kyse on pelkästä ryhmittelystä: sovellus ei laske jäsenten kapasiteettia tai kuormitusta yhteen työryhmään.
- Värillinen ruutu vasemmalla on resurssin väri. Se on pelkkä näyttö eikä vaikuta aikatauluun.

### Kapasiteetti, joka muuttuu ajan myötä

Saapuuko toinen muurari vasta 19. heinäkuuta? Napsauta *Enimmäismäärä*-kentän vieressä olevaa nuolta. Valitse kohdassa *Vaiheistettu kapasiteetti* *Lisää vaihe*. Jokaisella vaiheella on päivämäärä (*Alkaen*) ja luku (*Enimmäismäärä*). Siitä päivästä alkaen pätee kyseinen luku. Ilman vaiheita pätee aina tasainen arvo.

Uusi vaihe alkaa tämän päivän päivämäärästä ja arvosta 1. Muuta molemmat, koska muuten kapasiteetti 1 pätee tästä päivästä alkaen.

### Resurssin poistaminen

1. Napsauta rivin roskakorikuvaketta.
2. Jos resurssilla on resurssikohdistuksia, sovellus pyytää vahvistuksen, esimerkiksi *'Bricklayer' on käytössä 4 resurssikohdistuksessa — poistetaanko?* Poista napsauttamalla valintamerkkiä. Peruuta napsauttamalla ristiä. Ilman resurssikohdistuksia resurssi katoaa heti.

Resurssin resurssikohdistukset poistuvat myös. Jos tehtävällä on muu tehtävätyyppi kuin *Kiinteä kesto ja kuormitusaste*, sovellus jakaa poistetun resurssin työn jäljelle jääville resursseille. Tehtävätyypistä riippuen tämä muuttaa niiden kuormitusastetta tai tehtävän kestoa. Jos kesto muuttuu, aikataulu ei ole enää ajan tasalla.

Luomisen, muokkauksen ja poistamisen voi kumota painikkeella *Kumoa* (Ctrl+Z).

### Pieni yleiskatsaus sivupalkissa

*Resurssit › Hallinta › Resurssitelakka* näyttää tiivistetyn yleiskatsauksen oikeanpuoleisessa sivupalkissa, *Ominaisuudet*-paneelin vieressä. Siellä näkyvät kunkin resurssin nimi ja väri. Ylikuormitetun resurssin vieressä on varoitusmerkki (*Ylikuormitettu*). Siellä voi muuttaa vain *Enimmäismäärä*-arvoa. Jos valitaan yksi tai useampi tehtävä, yleiskatsaus näyttää vain näiden tehtävien resurssit.

## Sudenkuopat ja mitä sovellus silloin tekee

**Vain tyyppi *Materiaali* vaikuttaa laskentaan.** *Työvoima*, *Kalusto*, *Aliurakoitsija* ja *Työryhmä* käsitellään samalla tavalla. Materiaali ei lisää tehtävän kestoa, eikä sitä tasata. Myös histogrammissa rivi *Kaikki resurssit* ei laske materiaalia mukaan.

**Ei nimeä, ei resurssia.** Tyhjä rivi katoaa jälkiä jättämättä.

**Uusi vaihe kapasiteetissa.** Jos päivämäärää ja lukua ei muuteta, kapasiteetti on 1 tästä päivästä alkaen.

**Tarvittavan resurssin poistaminen.** Jos resurssi poistetaan vahingossa, paina heti Ctrl+Z. Myös resurssikohdistukset palautuvat.

## Katso myös

- [Resurssien kohdistaminen käyrän avulla](docs://howto-resource-toewijzen): resurssin asettaminen tehtävälle.
- [Resurssikalenterin asettaminen](docs://howto-resourcekalender-instellen): yhden resurssin työpäivien kiinnittäminen.
- [Ylikuormituksen ratkaiseminen](docs://howto-overbezetting-oplossen): mitä tehdään, kun resurssilla on liikaa tehtävää yhtenä päivänä.
- [Resurssipaneeli](docs://ref-resourcepaneel): kaikki resurssipaneelin kentät ja painikkeet.

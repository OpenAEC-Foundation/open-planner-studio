# Vetäminen, siirtäminen ja zoomaus Gantt-kaaviossa

Tavoite: käytä aikajanaa hiirellä. Siirrä palkkia tai muuta sen kestoa, siirrä aikajanaa, valitse tehtäviä laatikolla ja lähennä tai loitonna.

## Kun tätä tarvitaan

Gantt-kaaviosta nähdään, että muuraus pitää aloittaa kaksi päivää myöhemmin, tai että valu kestää yhden päivän pidempään. Silloin muutos halutaan tehdä suoraan palkilla. Tai projekti on kuukausien mittainen, ja silloin halutaan selata nopeasti rakennusalan vapaapäivään. Hiirellä on siihen muutama ele. Mikä ele tekee mitä, riippuu siitä, mistä vetäminen aloitetaan, ja vierityksen asetuksesta.

## Vaiheet

### Palkin siirtäminen

1. Paina tehtäväpalkin keskikohtaa ja vedä vaakasuunnassa. Alku ja loppu siirtyvät yhdessä kokonaisina päivinä. Kesto pysyy samana.
2. Vapauta hiiren painike. Palkki jää uuteen paikkaansa. Aikataulu ei ole silloin enää ajan tasalla. Paina *Laske* (F5), tai anna sovelluksen tehdä se itse, jos *Laske automaattisesti* on päällä.

Jos tehtävällä on edeltäjä, sovellus lisää uuden alun rajoitteeksi *Alkaa aikaisintaan (SNET)*. Sovellus ilmoittaa siitä, kun hiiren painike vapautetaan. Miksi näin tehdään ja mitä tapahtuu toisen rajoitteen kanssa, kerrotaan kohdassa [Rajoitteet ja tavoitepäivät](docs://uitleg-constraints). Jos palkki vedetään takaisin alkuperäiseen alkuun, myös alkuperäinen rajoite palautuu.

Jos palkkia vedetään enimmäkseen ylös tai alas eikä sivulle, tehtävä siirtyy toiselle riville, ja päivämäärät pysyvät. Suunta, joka valitaan ensimmäisten muutaman pikselin aikana, pätee koko vetoon. Yksi ele ei muuta koskaan päivämääriä ja rakennetta samalla kertaa. Katso [Rakenteen muuttaminen](docs://howto-structuur-aanpassen).

### Keston muuttaminen

1. Siirrä osoitin palkin oikeaan reunaan. Osoitin muuttuu nuolelle, joka osoittaa vasemmalle ja oikealle.
2. Vedä reunaa. Vedettäessä näkyy pieni tunniste teeman korostusvärissä (oletuksena oranssi). Se näyttää keston, jonka tehtävä saisi nyt, esimerkiksi *4d*. Tunniste päivittyy reaaliajassa, joten uusi kesto nähdään ennen kuin hiiren painike vapautetaan. Oikealla reunalla tunniste on palkin sisällä, vasemmalla reunalla juuri palkin vasemmalla puolella. Tunniste näyttää keston samalla tavalla kuin keston sarake.
3. Vapauta hiiren painike. Kesto on se, jonka tunniste näytti.

Vasen reuna siirtää alkua ja jättää lopun paikalleen, joten tehtävä lyhenee tai pitenee alusta. Sama SNET-sääntö koskee tätä kuin siirtämistä. Kun palkin keskikohtaa vedetään, tunniste ei näy, koska kesto ei muutu.

Kesto lasketaan tehtävän kalenterin työpäivinä. Viikonloput ja vapaapäivät eivät laske mukaan. Päivissä mitattu tehtävä ei voi lyhentyä alle yhden työpäivän. Tunneissa mitatulle tehtävälle sovellus pyöristää keston aikajanan askeleeseen hiiren kohdalla: vähintään tuntiin, tai varttiin, jos lähennetään riittävästi ja *Näytä vartit lähennettäessä paljon* on päällä.

Yksi veto on yksi askel *Kumoa*-toiminnossa, pituudesta riippumatta. Jaetun palkin reunat toimivat eri tavalla. Katso [Tehtävän jakaminen](docs://howto-taak-splitsen).

### Aikajanan siirtäminen

Mitä vetäminen tyhjällä taustalla tekee, riippuu vierityksen tilasta. Valitse *Asetukset*-ikkunan välilehti *Ulkonäkö*. Asetus on kohdassa *Gantt › Vieritys ja zoomaus*, asetus *Tila*:

- **Zoomaus + vetäminen** (oletus): jos tyhjää taustaa vedetään vasemmalla hiiren painikkeella, aikajana liikkuu hiiren mukana kuin kartta. Osoitin on käsi. Palkin päällä vetäminen käynnistää vain palkin eleen.
- **Sijainti** ja **Näppäimet**: sama veto tekee valintalaatikon. Aikajanaa siirretään rullalla (katso [Asetukset](docs://ref-instellingen)) tai keskipainikkeella.

**Keskimmäinen painike** (rulla painettuna) siirtää aikajanaa kaikissa tiloissa, myös silloin, kun vetäminen alkaa palkilta. Se ei toimi, kun toinen ele on käynnissä, esimerkiksi palkin vetäminen.

### Tehtävien valitseminen laatikolla

Laatikko valitsee kaikki tehtävät, joiden rivejä se koskettaa. Vain laatikon korkeus lasketaan, ei aikaskaala.

1. Aloita tyhjältä taustalta. Kun tila on *Zoomaus + vetäminen*, pidä Ctrl-näppäintä pohjassa (⌘ Macilla) samalla kun vetäminen aloitetaan. Tilassa *Sijainti* ja *Näppäimet* sitä ei tarvita.
2. Vedä niiden rivien yli, jotka halutaan valita. Valinnan ympärille tulee kehys.
3. Vapauta hiiren painike. Jos Esc painetaan vedettäessä, laatikko peruuntuu ja valinta pysyy ennallaan.

Lisätietoja valitsemisesta on kohdassa [Tehtävien valitseminen, poistaminen ja kumoaminen](docs://howto-taken-selecteren-verwijderen). Tehtävätaulukon tyhjällä alueella vetäminen ei tee mitään.

### Lähentäminen ja loitontaminen

1. Käytä painikkeita *Lähennä +* ja *Loitonna -* (*Aloitus › Zoomaus*) tai näppäimiä + ja -. Rulla zoomaa myös. Milloin se tekee niin, riippuu vierityksen tilasta (katso [Asetukset](docs://ref-instellingen)).
2. Jos halutaan koko projekti näkyviin, valitse *Näkymä › Aikaskaala › Sovita projektiin* tai paina Ctrl+0. *Palauta* (välilehdellä *Näkymä*) tai 0-näppäin palauttaa zoomin oletusarvoon.
3. Tilarivin oikeassa alakulmassa on zoomaus pikseleinä päivässä, esimerkiksi *Zoom: 15 px/päivä*.

Mitä pidemmälle loitonnetaan, sitä vähemmän ruudukkoviivoja on. Kun zoomaus on vähintään 8 pikseliä päivässä, jokaiselle päivälle on viiva, ja viikon rajalla on paksumpi viiva. Kun zoomaus on 2–8 pikseliä päivässä, jäljelle jää vain viikon raja. Alle 2 pikseliä päivässä, vuositasolla, jäävät jäljelle vain kuukausirajat. Muuten piirtoalue muuttuisi tasaiseksi raidoitukseksi, jossa palkit häviävät. Harmaat viikonloput ja vapaapäivät sekä vuorotellen värjätyt viikkokaistat näkyvät joka tasolla. Ne kantavat viikkorakennetta, kun viivat häviävät. Aikaskaalan otsikkorivillä viikkonumerot ja päivänumerot näkyvät vain, kun niille on tilaa. Alkaen 40 pikselistä päivässä näytetään myös viikonpäivä päivänumeron edessä.

Tehtävän nimi näkyy palkissa, jos se mahtuu kokonaan. Jos ei mahdu, esimerkiksi kun loitonnetaan, koko nimi näkyy palkin oikealla puolella.

### Tehtävän tietojen katsominen

Pidä hiiri paikallaan palkin päällä. Palkin päälle ilmestyy pieni kortti. Kortissa näkyvät tehtävän nimi sekä *WBS*, *Kesto*, *Alku*, *Loppu*, *Tila*, *Kriittinen* ja *Kokonaispelivara*. Vedettäessä, aikajanaa siirrettäessä, valintalaatikkoa käytettäessä tai hiiren kakkospainikkeen valikon ollessa auki kortti katoaa.

## Ongelmatilanteet ja mitä sovellus silloin tekee

**Alku ei siirry.** Jos tehtävällä on edeltäjä ja muu rajoite kuin SNET, esimerkiksi *Mahdollisimman myöhään (ALAP)*, sovellus ei käytä vedettyä alkua. Kun hiiren painike vapautetaan, sovellus kertoo, mikä rajoite pitää alun paikallaan. Muuta sitä rajoitetta, jotta alku siirtyy. Oikea reuna toimii, koska se muuttaa vain kestoa.

**Ele tekee jotain muuta.** Riippuvuustilassa ja jakotilassa palkkieleet toimivat eri tavalla. Esc lopettaa nämä tilat. Jos Shift-näppäin pidetään pohjassa ja vedetään palkilta, luodaan riippuvuus palkin siirron sijaan. Katso [Riippuvuuksien lisääminen](docs://howto-relaties-leggen).

**Tilassa *Sijainti* tai *Näppäimet* vasen hiiren painike ei siirrä aikajanaa.** Silloin näkyy tavallinen osoitin käden sijaan. Käytä rullaa tai keskipainiketta, tai aseta tilaksi *Zoomaus + vetäminen*.

**Klikkaus jaetun palkin tauossa** valitsee tehtävän, eikä se käynnistä vetoa tai laatikkoa.

## Katso myös

- [Hiiren kakkospainikkeen valikot](docs://ref-contextmenus): valikot palkille, riville ja ryhmän otsikolle.
- [Pikanäppäimet](docs://ref-sneltoetsen): näppäimet zoomaukseen ja eleen peruuttamiseen.
- [Asetukset](docs://ref-instellingen): vierityksen tila ja aikaskaala.
- [Rajoitteet ja tavoitepäivät](docs://uitleg-constraints): miksi siirretty alku muuttuu rajoitteeksi.

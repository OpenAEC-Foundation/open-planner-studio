# MS Project -tiedoston (.mpp) avaaminen

Tavoite: avaa Microsoft Project -aikataulu suoraan sovelluksessa, ilman että se viedään ensin.

## Milloin tätä tarvitaan

Urakoitsija, konsultti tai asiakas lähettää aikataulunsa `.mpp`-tiedostona. Tiedostoa halutaan katsoa, laskea tai kehittää edelleen. Sovellus lukee `.mpp`-tiedostoja MS Project 2010:stä 2021:een asti. Se vain lukee: se ei kirjoita `.mpp`-tiedostoa eikä muuta tiedostoa koskaan. Tiedostosta se ottaa aikataulun itsensä: tehtävät rakenteineen, kestoineen ja rajoitteineen, riippuvuudet viiveineen, kalenterit, resurssit, resurssikohdistukset ja edistymisen. Se lukee myös MS Projectin itse laskemat päivämäärät ja pelivarat, mutta käyttää niitä vain näkymässä *Tallennetut päivämäärät*, ei koskaan syötteenä.

## Vaiheet

1. Valitse *Aloitus › Tiedosto › Avaa* tai paina Ctrl+O. Valitse `.mpp`-tiedosto.
2. Projekti avautuu uuteen välilehteen tai nykyiseen välilehteen, jos se oli vielä tyhjä eikä sitä ollut muutettu. Projektilla ei ole tiedostoa. *Tallenna* kirjoittaa myöhemmin uuden IFC-tiedoston. Sen jälkeen ikkunassa kerrotaan lyhyesti, mitä sovellus otti tiedostosta mukaansa ja miten tallentaminen toimii. Katso [Tiedoston avaaminen ja tallentaminen](docs://howto-bestand-openen-en-opslaan).
3. Lue viesti alareunasta: *Tämä projekti lasketaan tavalla Microsoft Project. Muuta sitä kohdassa Tiedosto → Projektitiedot → Laskentaprofiili ja laskentavaihtoehdot.* Sovellus laskee tämän projektin MS Project -ohjelman laskentasäännöillä: laskentaprofiilina *Microsoft Project*. Valitsemalla *Avaa laskentaprofiili* siirrytään asetukseen. *Lue lisää* avaa ohjeen laskentaprofiileista.
4. Katso, näkyykö valintanauhan alla ilmoitus: *Päivämäärät näytetään sellaisina kuin ne ovat tiedostossa. Kun lasketaan uudelleen, 4 tehtävää siirtyisi.* Näissä tehtävissä sovelluksen laskema tulos poikkeaa silloin MS Project -ohjelman tallentamista päivämääristä. Vaiheen 3 viestin alla on lisäksi rivi: *4 tehtävää näyttää päivämäärät sellaisina kuin ne ovat tiedostossa (ei laskettuina uudelleen).* Mitä tämä tarkoittaa ja miten sovelluksen oma laskenta otetaan käyttöön, kerrotaan kohdassa [Tallennetut päivämäärät](docs://uitleg-datums-zoals-opgeslagen).
5. Jos näkyy *Tämä tiedosto sisältää tuntisuunnittelua.* ja painike *Ota tuntisuunnittelu käyttöön*, tiedosto sisältää tuntitietoja. Katso [Tuntisuunnittelun käyttöönotto](docs://howto-urenplanning-aanzetten).

Jos tiedostossa on tehtäviä, joiden aikataulu on tauotettu, tasattu tai resurssiohjattu, näkyy lisäksi toinen viesti, esimerkiksi *Tämä MS Project -tiedosto sisältää 3 tehtävää, joiden aikataulu on tauotettu, tasattu tai resurssiohjattu. Ne tuodaan ja näytetään sellaisina.* Kun tehtävä on vain yksi, viesti on yksikkömuodossa.

## Sudenkuopat ja mitä sovellus silloin tekee

**Kaikki ei tule mukana.** Kun projekti on avattu, sovellus kertoo yhdellä viestillä, mitä se ei ottanut mukaansa: *Kaikkea tästä MS Project -tiedostosta ei tuotu.* Sen alla on yksi rivi kohtaa kohden, ja siinä on määrä, esimerkiksi *2 perustasoa ei tuotu.* Kun tiedosto on `.mpp`, vaiheen 3 laskentaprofiilia koskeva lause on tämän viestin ensimmäinen rivi. Viesti pysyy näkyvissä, kunnes ristiä napsautetaan. Jos mitään ei jää pois, viestiä ei näy. Rivi voi koskea seuraavia asioita:

- lisätyt projektit (aliprojektit): sovellus lukee ne tavallisena tehtävänä ilman linkkiä toiseen tiedostoon;
- ulkoiset tehtävät toisesta projektista: sovellus lukee ne tavallisina tehtävinä;
- perustasot: `.mpp`-tiedostosta sovellus ei ota mukaan lainkaan perustasoa. MS Project XML:stä se ottaa mukaan vain tehtävien perustason 0, ja siitäkin vain päivämäärät ja keston (tehtävässä, jonka kesto on tunneissa, myös kellonajan; ei työtä eikä kustannuksia, eikä resurssien ja resurssikohdistusten perustasoja);
- MS Project XML:n kanssa: resurssikohdistus, jonka perustaso on eri päivämäärillä kuin sen tehtävä. Sovellus säilyttää vain tehtävän perustason. Jos päivämäärät ovat samat, mitään ei jää pois eikä sovellus näytä mitään. Eri kellonaika samana päivänä lasketaan myös eroksi;
- mukautetut kentät, joissa on arvoja, esimerkiksi mukautetut kentät, arvot hakutaulukosta ja rakennekoodit (sovellus ei laske `.mpp`-tiedoston kyllä/ei-kenttiä mukaan);
- muistiinpanot (myös pelkkä kuva sisältävä muistiinpano) resursseista ja resurssikohdistuksista, ja `.mpp`-tiedostosta myös tehtävistä (MS Project XML:stä tehtävän muistiinpano tulee mukaan kuvauksena);
- hyperlinkit;
- tehtävien kiinteät kustannukset;
- resurssien normaalihinnat: `.mpp`-tiedostosta ei lainkaan normaalihintaa, MS Project XML:stä vain normaalihinta;
- vain MS Project XML:n kanssa: manuaalisesti ajoitetut tehtävät (sovellus laskee niiden päivämäärät automaattisesti), käytöstä poistetut tehtävät (ne otetaan mukaan laskentaan) ja tasaamisviive;
- vain `.mpp`-tiedoston kanssa: MS Project -ohjelman kriittinen kynnysarvo; sovellus käyttää kynnysarvoa 0.

WBS-koodi, joka on täytetty itse MS Project -ohjelmassa, otetaan mukaan. Muuten sovellus numeroi tehtävät rakenteen mukaan.

**Tiedosto MS Project 2007:stä tai vanhemmasta.** Sovellus ei avaa sitä ja näyttää: *Tämä .mpp-tiedosto on vanhassa muodossa (Project 2007 tai vanhempi). Vie se MS Projectissa XML-muodossa (Tiedosto → Tallenna nimellä → XML) ja avaa se.* Viestin alla sovellus lisää teknisen syyn englanniksi.

**Salasanalla suojattu tiedosto.** Sovellus näyttää: *Tämä .mpp-tiedosto on suojattu salasanalla. Vie se MS Projectissa XML-muodossa (Tiedosto → Tallenna nimellä → XML) ja avaa se.* Tässäkin viestin mukana tulee tekninen syy englanniksi.

**Tiedosto, joka ei olekaan `.mpp`.** Sovellus näyttää: *Avaaminen epäonnistui*, ja mukana on tekninen syy.

**XML-vienti lasketaan toisin.** Jos avataan MS Project -ohjelman XML-vienti `.mpp`-tiedoston sijaan, sovellus laskee laskentaprofiililla *Open Planner Studio* eikä viestiä *Microsoft Project* näy. Päivämäärät voivat silloin olla erilaisia kuin `.mpp`-tiedostolla. Myös XML-viennissä sovellus kertoo, mitä se ei ota mukaan; katso *Kaikki ei tule mukana*.

**Muokkaus irrottaa tehtävän MS Project -ohjelman ohjauksesta.** Jos muokataan tehtävää, jonka aikataulua ohjasi MS Project -ohjelman päivämääräikkuna, sovellus näyttää kerran projektia kohden: *MS Projectin päivämääräikkuna ei enää ohjaa 2 tehtävää tämän muokkauksen jälkeen. Työn jakautuminen sen sijaan pätee edelleen ja säilyy tiedostossa.* Kun tehtävä on vain yksi, viesti on yksikkömuodossa.

**Tallentaminen ei koskaan korvaa `.mpp`-tiedostoa.** Projektilla ei ole tiedostoa. *Tallenna* kysyy, minne uusi IFC-tiedosto tallennetaan.

## Katso myös

- [Tiedostot ja muodot](docs://uitleg-bestanden): miksi `.mpp`-tiedostoa vain luetaan ja mitä tallennus kirjoittaa.
- [Tallennetut päivämäärät](docs://uitleg-datums-zoals-opgeslagen): näkymä MS Projectin omista päivämääristä.
- [Tuntisuunnittelun käyttöönotto](docs://howto-urenplanning-aanzetten): jos tiedostossa on tuntitietoja.
- [Primavera P6 -tiedoston (.xer) avaaminen](docs://howto-xer-openen): sama Primaveralle.
- [Tuonti- ja vientimuodot](docs://ref-import-exportformaten): muodoittain, mitä siirtyy mukana ja mitä ei.
- [Laskentaprofiilit ja laskentasäännöt](docs://uitleg-rekenprofielen): miksi MS Project -tiedosto avautuu omalla laskentaprofiilillaan.

# Projektin siirtäminen

Tavoite: siirrä koko aikataulu uuteen aloituspäivään, ja katso etukäteen, mitä se tekee projektin päättymispäivälle.

## Milloin tätä tarvitaan

Työn alku siirtyy: lupa tulee myöhemmin, tai aiemman talon aikataulua käytetään uudelleen seuraavaa taloa varten. Jokaisen tehtävän siirtäminen erikseen vie paljon aikaa. Valitsemalla **Siirrä projekti** syötetään yksi uusi aloituspäivä, ja sovellus siirtää kaiken mukanaan.

Projektin päättymispäivä ei aina siirry yhtä paljon kuin aloituspäivä. Kalenteri ei siirry mukana: vapaapäivät, rakennusalan kesäloma ja talvipysäytys pysyvät kiinteillä päivämäärillä. Esimerkki: projekti luodaan komennolla *Aloitus › Tiedosto › Uusi*, jossa *Aloituspäivä* on 29.09.2026, *Maa* on *Alankomaat* ja *Rakennusalan kesäloma* on *Ei mitään*. Projektiin lisätään 30 työpäivän aikataulu, joka päättyy 9. marraskuuta 2026. Jos se siirretään 14. joulukuuta 2026, eli 76 kalenteripäivää myöhemmin, se päättyy 26. tammikuuta 2027. Loppu siirtyy silloin 78 päivää, koska 25. joulukuuta ja 1. tammikuuta ovat nyt aikataulun sisällä vapaapäiviä. Kesto pysyy 30 työpäivänä. Ikkunan esikatselu näyttää tämän ennen kuin muutat mitään.

## Vaiheet

1. Valitse *Aikataulu › Aikataulu › Siirrä projekti…*. Painike on pois käytöstä niin kauan kuin projektilla ei ole aloituspäivää.
2. Kohdassa *Nykyinen projektin aloituspäivä* näkyy, mistä projekti alkaa nyt. Valitse kohdassa *Uusi projektin aloituspäivä* uusi päivämäärä.
3. Jos projektilla on perustasoja, ruutu *Siirrä myös perustasot* tulee näkyviin. Jätä ruutu tyhjäksi, jos halutaan, että muutos näkyy erona (katso valkuilut).
4. Valitse *Laske esikatselu*. Sovellus laskee siirretyn aikataulun kokonaan, eikä muuta projektia.
5. Tarkista esikatselu (katso alla). Jos se on oikein, valitse *Siirrä*.

Esikatselussa näkyy:

- siirtymä kalenteripäivinä (*Siirtymä: 76 kalenteripäivää eteenpäin*);
- *Projektin aloituspäivä* ja *Projektin päättymispäivä*, ennen ja jälkeen;
- punainen varoitus, jos kalenteri häiritsee, tai viesti, että projektin kesto pysyy samana;
- siirrettyjen tehtävien määrä ja se, mikä muu siirtyy mukana;
- varoitukset, jotka kannattaa lukea (katso valkuilut).

Sovellus laskee uuden aikataulun heti, joten **Laske**-komentoa (F5) ei tarvitse käyttää. Sovellus sovittaa myös näkymän koko projektiin. Koko toimenpide on yksi vaihe. Sen voi kumota komennolla *Kumoa* (Ctrl+Z).

*Siirrä*-painike toimii vain virheettömän esikatselun jälkeen, ja vain jos uusi päivämäärä eroaa nykyisestä. Jos päivämäärää tai ruutua muutetaan, esikatselu katoaa. Laske sitten uudelleen.

### Mikä siirtyy mukana ja mikä ei

Siirtyy: kunkin tehtävän alku ja loppu, toteutunut alkamispäivä ja toteutunut valmistumispäivä, rajoitteiden päivämäärät (myös kiinteän *Mandatory*-rajoitteen, katso [Rajoitteet ja tavoitepäivät](docs://uitleg-constraints)), tavoitepäivät, raportointipäivä, ulkoisten riippuvuuksien ankkurit ja resurssien saatavuusvaiheet. Projektin aloituspäivä siirtyy myös. Jos projektin päättymispäivä on täytetty, sekin siirtyy.

Ei siirry:

- kalenterit, eli vapaapäivät, rakennusalan kesäloma ja talvipysäytys;
- perustasot, ellei valita *Siirrä myös perustasot*;
- täytetty mukautettu kenttä, jonka tyyppi on *Päivämäärä*.

## Valkuilut ja mitä sovellus tekee

**Loppu siirtyy eri määrän päiviä.** Jos esikatselu näkee, että loppu siirtyy enemmän tai vähemmän kalenteripäiviä kuin alku, tai että projektin kesto työpäivinä muuttuu, se näyttää punaisen varoituksen, jossa on luvut. Silloin peruminen on yhä mahdollista.

**Perustasot pysyvät ennallaan.** Perustason tarkoitus on mitata ero. Jos projekti siirretään ja ruutu on tyhjä, siirron ero näkyy perustasosta. Jos ruutu on valittu, perustasot siirtyvät aikataulun mukana. Vain niiden päivämäärät siirtyvät. Päivämäärä, jolloin perustaso tallennettiin, ei siirry.

**Käynnissä oleva projekti.** Todelliset päivämäärät siirtyvät mukana. Projektissa, johon edistyminen on jo syötetty, tämä ei aina ole haluttu. Sovellus varoittaa: *Tarkista, onko tämä oikein käynnissä olevalle projektille.*

**Ulkoiset riippuvuudet.** Ankkuri omassa projektissa siirtyy mukana, lähdeprojekti ei siirry. Lataa ulkoiset riippuvuudet siirron jälkeen uudelleen komennolla *Aloitus › Tehtävät › Linkitä ▾ › Lataa kaikki ulkoiset riippuvuudet uudelleen*. Katso [Ulkoiset riippuvuudet toiseen projektiin](docs://howto-externe-relaties).

**Vapaapäivät eivät ulotu tarpeeksi pitkälle.** Kalenterissa, jossa on generoituja vapaapäiviä, ne kattavat tietyn määrän vuosia. Jos siirretty aikataulu menee niiden yli, sovellus laskee sen vuoden ilman vapaapäiviä. Esikatselu varoittaa siitä, esimerkiksi: *Kalenterin “Bouwkalender NL” generoidut vapaapäivät kattavat 2025–2029; siirretty aikataulu jatkuu vuoteen 2030. Generoi vapaapäivät uudelleen.* Siirrä projekti ensin. Avaa sitten *Aikataulu › Kalenteri › Kalenteri*: vapaapäivien vieressä lukee nyt *Luo uudelleen*. Vahvista painikkeella *Käytä*, jolloin sovellus laskee uudelleen. Uusien vapaapäivien väli seuraa projektin päivämääriä, joten uudelleen luominen ennen siirtoa ei auta.

**Päivämäärä on menneisyydessä.** Se on sallittu, mutta esikatselu mainitsee sen: *Uusi aloituspäivä on menneisyydessä.*

**Projektin aloituspäivän muuttaminen projektin asetuksissa on jotain muuta.** Jos aloituspäivä muutetaan kohdassa *Asetukset › Projekti › Projektin asetukset* ja valitaan *Käytä*, aikataulu ei siirry. Vain tehtävät ilman edeltäjää tai rajoitetta, jotka sijoittuisivat uuden alun eteen, siirtyvät sille päivälle, ja sovellus kertoo niiden määrän. Jos kaikki halutaan siirtää, käytetään *Siirrä projekti…* -toimintoa.

## Katso myös

- [Kriittinen polku ja pelivara](docs://uitleg-kritiek-pad): miten aikataulu lasketaan ja miksi loppu siirtyy.
- [Riippuvuuksien lisääminen](docs://howto-relaties-leggen): riippuvuudet jäävät yksinkertaisesti paikoilleen siirron yhteydessä.
- [Uusi projekti ja projektin asetukset](docs://ref-projectinfo): mitä aloituspäivä projektin asetuksissa tekee.

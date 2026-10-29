# Taulukon sarakkeiden muokkaaminen

Tavoite: valitse, mitkä sarakkeet tehtävätaulukossa näkyvät, missä järjestyksessä ja kuinka leveinä.

## Milloin tätä tarvitaan

Kokouksessa halutaan nähdä tavoitepäivä ja kokonaispelivara jokaisen tehtävän vieressä. Työnjohtaja haluaa nimen viereen vain alun ja lopun. Tai sarake on niin kapea, että sen otsikko katkeaa. Tehtävätaulukko koostuu sarakkeista, jotka valitaan itse: niitä on kymmeniä, esimerkiksi *Tehtävän nimi*, *Kesto*, *Tavoitepäivä*, *Vapaa pelivara* ja *Kohdistetut resurssit*.

On kaksi tehtävätaulukkoa. Kummassakin on omat sarakkeet:

- **Gantt-kaavion vieressä oleva tehtävätaulukko** näkyy muun muassa välilehdillä *Aloitus*, *Aikataulu* ja *Näkymä*, aikajanan vasemmalla puolella. Oletuksena siinä ovat *WBS*, *Tehtävän nimi* ja *Kesto*, jotta aikajanalle jää tilaa.
- **Taulukko-välilehden taulukko** käyttää koko työtilaa. Oletuksena siinä ovat *WBS*, *Tehtävän nimi*, *Kesto*, *Alku*, *Loppu*, *Työlaji*, *Kriittinen*, *Kokonaispelivara* ja *Edistyminen*, sekä sarakkeet jokaiselle projektin tehtäväkoodille ja mukautetulle kentälle.

Muutos yhteen taulukkoon ei muuta toista.

## Vaiheet

### Sarakkeen lisääminen

1. Napsauta plusmerkkiä (**+**) taulukon otsikkorivin oikeassa reunassa. Välilehdellä *Taulukko* voidaan käyttää myös valikkopolkua *Taulukko › Sarakkeet › Valitse sarakkeet…*. Avautuu *Valitse sarake* -ikkuna.
2. Etsi sarake. Jos sarakkeita on valittu aiemmin, ylhäällä on *Viimeksi käytetyt*. Kirjoita osa nimestä kenttään *Hae*, esimerkiksi *tavo*, joka hakee sarakkeen *Tavoitepäivä*. Tai avataan luokka: *Tehtävä*, *Aikataulu*, *Rajoitteet*, *Riippuvuudet*, *Resurssit*, *Edistyminen*, *Lasketut*, *Perustaso*, *Mukautetut* tai *Tekninen*.
3. Napsauta saraketta. Se tulee taulukon loppuun ja ikkuna sulkeutuu.

Sarake, joka on jo taulukossa, näkyy harmaana eikä sitä voida valita.

### Sarakkeen poistaminen

Napsauta sarakeotsikon miinusmerkkiä (*Poista: Tavoitepäivä*). Tai napsauta otsikkoa hiiren oikealla painikkeella ja valitse *Poista: Tavoitepäivä*. Ctrl+Z palauttaa sarakkeen. Sarake voidaan myös valita uudelleen plusmerkillä.

### Leveyden säätäminen

Vedä sarakeotsikon oikeaa reunaa vasemmalle tai oikealle. Kaksoisnapsauta reunaa tai valitse otsikon valikosta (hiiren oikea painike) *Sovita automaattisesti*, jolloin sarake on sisältöään vastaavan levyinen, enintään 480 pikseliä. Jos reunalla on kohdistus, nuolinäppäimillä levennetään tai kavennetaan saraketta askel kerrallaan.

### Sarakkeiden kiinnittäminen

Napsauta otsikkoa hiiren oikealla painikkeella ja valitse *Kiinnitä*. Kiinnitetyt sarakkeet siirtyvät eteen ja pysyvät vasemmalla, kun vierität vaakasuunnassa. Tämä toimii niin kauan kuin ne eivät yhdessä ole ikkunaa leveämpiä. *Irrota* palauttaa ne riviin.

### Järjestyksen muuttaminen

Vedä sarakeotsikko toiseen paikkaan. Kiinnitetty sarake siirretään kiinnitettyjen sarakkeiden joukossa, tavallinen sarake tavallisten sarakkeiden joukossa.

### Palautus oletukseen

Avaa *Valitse sarake* -ikkuna ja napsauta alareunassa *Palauta oletus*. Painike on harmaa, jos sarakkeet ovat jo oletuksena. Välilehden *Taulukko* taulukkoon lisätään myös sarake jokaiselle projektin tehtäväkoodille ja mukautetulle kentälle, vaikka ne olisi poistettu aiemmin. Nämä sarakkeet kuuluvat siihen projektiin, johon koodi tai kenttä kuuluu. Lisätietoja näistä koodeista ja kentistä on kohdassa [Koodit ja mukautetut kentät](docs://howto-codes-en-velden).

## Ongelmatilanteet ja mitä sovellus tekee

**Otsikko on katkaistu.** Kapea sarake katkaisee nimensä, esimerkiksi *Kokonaispelivara* muotoon *Kokon…*. Kaksoisnapsauta otsikon reunaa, jotta sarake sopii.

**Muokataan väärää taulukkoa.** Gantt-kaavion vieressä olevan tehtävätaulukon sarakkeet ja välilehden *Taulukko* sarakkeet ovat erillään. Kun välilehti *Näkymä* tai *Aloitus* on auki, muokataan Gantt-kaavion vieressä olevaa taulukkoa. Plusmerkki välilehdellä *Taulukko* muokkaa suurta taulukkoa.

**Asettelu palauttaa sarakkeet.** Jos asettelussa on *Sarakkeet*-osa valittuna, asettelun painikkeen napsautus palauttaa Gantt-kaavion vieressä olevan tehtävätaulukon sarakkeet tallennettuun tilaan. Välilehden *Taulukko* taulukkoa ei muuteta. Katso [Asettelun luominen ja käyttö](docs://howto-layouts-gebruiken).

**Sarakkeet ovat laitteessa, eivät projektissa.** Sovellus tallentaa sarakevalinnan kaikille projekteille tällä laitteella, eikä sitä tallenneta projektitiedostoon. Projektia ei myöskään merkitä "muokatuksi". Jokaisen sarakemuutoksen voi kumota painikkeella *Kumoa* (Ctrl+Z). Vaiheiden nimet ovat esimerkiksi *Lisää sarake Tavoitepäivä* ja *Muuta sarakkeen Tehtävän nimi leveyttä*.

## Katso myös

- [Asettelun luominen ja käyttö](docs://howto-layouts-gebruiken): sarakkeiden asettaminen painikkeelle yhdessä suodattimen tai lajittelun kanssa.
- [Koodit ja mukautetut kentät](docs://howto-codes-en-velden): omien sarakkeiden luominen, joita voi valita täältä.
- [Taulukon sarakkeet](docs://ref-tabelkolommen): kaikki sarakkeet ja mitä ne näyttävät.

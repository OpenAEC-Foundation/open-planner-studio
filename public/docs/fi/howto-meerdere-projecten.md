# Usean projektin käsittely samanaikaisesti

Tavoite: useamman aikataulun avaaminen samaan aikaan, niiden välillä vaihtaminen ja niiden erillinen sulkeminen.

## Milloin tätä tarvitaan

Asuinalueen rakennushanke on työn alla, mutta työmaakokouksessa käsitellään myös seurojentalon remonttia. Tai muunnelma halutaan pitää alkuperäisen rinnalla. Jokaisella projektilla on oma välilehti, omat tehtävät, oma laskenta ja oma aikaikkuna. Vaihtaminen tapahtuu yhdellä napsautuksella, eikä mitään menetetä.

## Vaiheet

### Toisen projektin avaaminen

1. Napsauta välilehtien oikealla puolella olevaa plusmerkkiä (*Aloita projekti*). *Aloita projekti* -ikkuna avautuu.
2. Valitse *Uusi projekti* tyhjää aikataulua varten tai *Avaa olemassa oleva projekti* tiedoston valitsemiseksi. *Peruuta* sulkee ikkunan.
3. Kun *Uusi projekti* on valittu, täytä *Uusi projekti* -ikkunassa tiedot ja napsauta *Luo*.

Projekti tulee omalle välilehdelleen ja on heti aktiivinen. Myös *Uusi* ja *Avaa* valintanauhassa, Ctrl+O sekä esimerkit valikossa *Tiedosto › Esimerkit* avaavat projektin uudelle välilehdelle. Vain tuore, tyhjä aikataulu, jota ei ole vielä muokattu, käytetään uudelleen välilehden lisäämisen sijaan.

### Projektien välillä vaihtaminen

- Napsauta projektin välilehteä.
- Paina näppäinyhdistelmää Ctrl+1 – Ctrl+9 (macOS:ssa ⌘ Ctrl-näppäimen sijaan) siihen projektiin, joka on rivissä tietyssä kohdassa. Kohdat lasketaan vasemmalta oikealle.
- Napsauta välilehtien vasemmalla puolella olevaa valikkokuvaketta (*Kaikki projektit*). Yleiskatsaus *Avoimet projektit* näyttää kortin jokaisesta projektista: nimen, tiedostonimen (jos projektilla on tiedosto), pikkukuvan aikataulusta, tehtävien määrän, kriittisten tehtävien määrän ja loppupäivän. Napsauta korttia. Sovellus siirtyy silloin projektiin. Esc sulkee yleiskatsauksen.

Jokaisessa välilehdessä on projektin värillinen piste. Välilehdessä, jonka perässä on pieni piste, on tallentamattomia muutoksia.

Jos välilehdet eivät mahdu leveyteen kokonaan, välilehtien ja plusmerkin väliin ilmestyy kaksi nuolta (*Vieritä välilehtiä alkuun* ja *Vieritä välilehtiä loppuun*). Jokainen napsautus siirtää välilehtiä kaksi paikkaa. Nuoli on harmaa, kun ollaan jo alussa tai lopussa. Voit vierittää myös hiiren rullalla välilehtien päällä. Valitsemasi välilehti siirtyy aina näkyviin itsestään.

### Projektin sulkeminen

Napsauta välilehden nimen vieressä olevaa ruksia (*Sulje*) tai yleiskatsauksen kortin ruksia. Projekti, jossa ei ole muutoksia, sulkeutuu heti. Jos siinä on tallentamattomia muutoksia, sovellus kysyy *Tallentamattomat muutokset* ja tarjoaa kolme vaihtoehtoa:

- *Tallenna* tallentaa projektin ja sulkee sen.
- *Älä tallenna* sulkee projektin ja hylkää muutokset.
- *Peruuta* jättää projektin auki.

Jos tallentaminen peruutetaan, esimerkiksi sulkemalla tallennusikkuna, projekti jää auki.

Kun viimeinen projekti suljetaan, jäljelle jää tyhjä aikataulu nimeltä *Uusi aikataulu*.

### Vaihtotyylin valitseminen

Välilehtien tyyli on valittavissa. Avaa *Asetukset* -ikkuna otsikkorivin vaihdekuvakkeesta, siirry *Ulkonäkö* -välilehdelle ja valitse kohdasta *Asiakirjan vaihtotyyli*:

- *Vaakasuuntaiset välilehdet*: oletus. Rivi välilehtiä valintanauhan alla.
- *Pystysuuntaiset välilehdet*: kapea kaistale vasemmalla, jossa on painike jokaiselle projektille (nimen ensimmäiset kirjaimet) ja plusmerkki. Kun osoitin on painikkeen päällä, näkyy nimi, tiedostonimi, tehtävien määrä, kriittisten tehtävien määrä ja loppupäivä. Ylin painike avaa yleiskatsauksen.
- *Kapseli*: yksi kapseli otsikkorivissä, jossa on aktiivisen projektin nimi ja laskuri, esimerkiksi *2 avoinna*. Napsauta sitä. Yleiskatsaus avautuu, ja projektia voi vaihtaa siellä.

Kaikki kolme tyyliä avaavat saman yleiskatsauksen, ja Ctrl+1 – Ctrl+9 toimii kaikissa tyyleissä.

## Sudenkuopat ja mitä sovellus tekee

**Mikä kuuluu projektille ja mikä on yhteistä.** Jokaisella projektilla on oma näkymä: zoomaus ja sijainti, aktiivinen asettelu suodattimineen, ryhmittelyineen tai lajitteluineen, jaettu näkymä, riippuvuusviivat ja supistetut vaiheet. Kun toiseen projektiin vaihdetaan, siellä näkyy sen oma näkymä. Kaikille projekteille yhteisiä ovat valintanauhan valittu välilehti, pienoiskartta, peitot (perustason peitto, edistymisviiva ja muut), sarakevalinta, asettelut ja raporttivalinnat.

**Vaihtaminen ei onnistu, kun ikkuna on auki.** Niin kauan kuin ikkuna on auki, esimerkiksi *Asetukset* -ikkuna tai tehtäväikkuna, Ctrl+1 – Ctrl+9 eivät tee mitään sovelluksessa. Selaimessa ne vaihtavat selaimen välilehteä. Sulje ensin ikkuna. Myös Backstagen *Projektin asetukset* -kohdan muutos, jota ei ole vielä otettu käyttöön, estää vaihtamisen.

**Ctrl+1 – Ctrl+9 laskevat järjestyksen mukaan.** Pikanäppäin vie siihen projektiin, joka on rivissä tietyssä kohdassa. Kun projekti suljetaan, muut kohdat siirtyvät vasemmalle. Kun yli yhdeksän projektia on auki, loput projektit saavutetaan vain välilehtien tai yleiskatsauksen kautta.

**Laske ja raportit koskevat aktiivista projektia.** Laske (F5), *Vie PDF* ja raportit koskevat sitä projektia, joka on nyt aktiivinen.

## Katso myös

- [Asettelun luominen ja käyttäminen](docs://howto-layouts-gebruiken): näkymän määrittäminen kullekin projektille.
- [Raportin tekeminen ja tulostaminen](docs://howto-rapport-maken-en-afdrukken): aktiivisen projektin raportti.

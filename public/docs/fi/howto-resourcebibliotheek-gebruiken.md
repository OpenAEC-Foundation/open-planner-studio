# Resurssikirjaston käyttäminen

Tavoite: käyttää resurssikirjaston resursseja projektissa ja lisätä projektissa tehty resurssi kirjastoon, jotta kaikki projektit käyttävät samoja tietoja.

## Milloin tätä tarvitaan

Muurariryhmä, nosturi ja rappari ovat vakituisia ja esiintyvät useissa projekteissa. Ilman kirjastoa ne kirjoitetaan jokaiseen projektiin uudelleen. Nimet ja normaalihinnat voivat silloin erota. Yksikään projekti ei näe, että toinen projekti tarvitsee samaa ryhmää. Kirjastoon ne tallennetaan kerran.

Mitä kirjasto on ja mitä projekti siitä ottaa, kerrotaan kohdassa [Resurssikirjasto](docs://uitleg-resourcebibliotheek). Tämä artikkeli käsittelee toimintoja. Kirjastojen luominen, vieminen ja poistaminen on kuvattu kohdassa [Resurssikirjastojen hallinta ja jakaminen](docs://howto-bibliotheken-beheren).

## Vaiheet

### 1. Liitä projekti kirjastoon

Kirjastoa käytetään vain, jos projekti on liitetty siihen. Ilman liitosta resurssipaneeli ei näytä vaihtokytkintä *Kirjasto*, *Projekti* ja *Käyttöaste*.

Uudelle projektille:

1. Valitse *Tiedosto › Uusi*. *Uusi projekti* -ikkuna avautuu.
2. Katso kohtaa *Kirjasto*. Kenttään on asetettu oletuksena oleva kirjasto. Toisen kirjaston voi valita. Vaihtoehtoina ovat myös *ei kirjastoa (erillinen projekti)* ja *+ Uusi kirjasto…*.
3. Napsauta *Luo*.

Olemassa olevalle projektille:

1. Valitse *Tiedosto › Projektin asetukset*.
2. Valitse kohdassa *Kirjasto* haluamasi kirjasto.
3. Napsauta *Käytä*. Siihen asti alareunassa lukee *Muutoksia ei ole sovellettu. Säilytä ne napsauttamalla Käytä.*

Jos projektissa on jo resursseja, joiden nimi on sama kuin kirjastokohteen, avautuu ikkuna *Linkitä kirjasto*, jossa on osio *Tunnistettu*. Jokaisella osuman saaneella resurssilla lukee *Ehdotus: Bricklayer*. Napsauta *Linkitä*, jos haluat liittää sen, tai *Linkitä kaikki ehdotukset*, jos ehdotuksia on useampia. Sovellus vertaa nimiä välittämättä isoista kirjaimista tai kaksoisvälilyönneistä. Kun resurssi liitetään, se ottaa kirjastokohteelta nimen, tyypin, normaalihinnan, mitan ja kuvauksen. *Enimmäismäärä* säilyy sellaisena kuin se oli projektissa. Ikkuna näyttää myös projektin kalenterit, joilla on sama nimi kuin kirjaston kalenterilla. Kun valitaan *Päätä myöhemmin*, ikkuna suljetaan liittämättä mitään.

### 2. Lisää resurssi kirjastoon

1. Valitse *Resurssit › Hallinta › Resurssit*. Resurssipaneeli vie koko työtilan. Se avautuu aina kohdassa *Projekti*, myös liitetyssä projektissa.
2. Valitse oikeasta yläkulmasta *Kirjasto*. Taulukon yläpuolella lukee *Tämä muokkaa kirjastoa ja koskee kaikkia projekteja. Tätä ei voi kumota.*
3. Napsauta *Uusi resurssi kirjastoon*. Taulukon alareunaan tulee tyhjä rivi.
4. Kirjoita nimi, esimerkiksi *Bricklayer*, ja paina Enter. Resurssi on nyt kirjastossa, ja heti aukeaa tyhjä rivi seuraavaa varten. Kun kirjoittaminen on valmis, paina Esc. Ilman nimeä sovellus ei luo mitään.
5. Täytä rivin muut kentät. *Tyyppi* on oletuksena *Työvoima*. Kohdassa *Enimmäismäärä* ilmoitetaan, kuinka monta tätä resurssia on yhteensä, esimerkiksi 3, kun muurareita on kolme. Käyttöasteen yleiskuva käyttää tätä lukua kapasiteettina. *Normaalihinta/h* on valinnainen. Kenttään *Mitta* voi kirjoittaa vain, kun tyyppi on *Materiaali*. Kohdassa *Kalenteri* valitaan kalenteri kirjastosta tai *+ Resurssikalenteri*, jolla luodaan uusi, katso [Resurssikalenterin asettaminen](docs://howto-resourcekalender-instellen). Sovellus tallentaa nimen, normaalihinnan ja mitan, kun kenttä jätetään, ja muut kentät heti.

Jokainen muutos kirjastossa siirtyy heti muokkaamattomiin kopioihin avoimissa projekteissa.

### 3. Kohdista resurssi projektiin

1. Valitse näkymässä *Kirjasto* resurssin kohdalta *Kohdista projektiin*. Taulukon yläpuolella lukee *Lisätty.* Jos napsautetaan uudelleen, lukee *On jo projektissa.* eikä toista kopiota tule.
2. Valitse *Projekti*. Kopio on taulukossa, ja sen nimen vieressä on pieni kirjastokuvake, nimeltään *Kirjastosta*. Nimi, tyyppi, normaalihinta ja mitta ovat tavallista tekstiä. Kun hiiri viedään niiden päälle, näkyy teksti *Kirjaston arvo — muokkaa Kirjasto-näkymässä tai irrota tämä resurssi kirjastosta.*
3. Aseta projektille *Enimmäismäärä*. Kenttä alkaa kirjaston arvosta ja pysyy muokattavana projektissa.
4. Kohdista resurssi nyt tehtäviin kuten mikä tahansa muu resurssi, katso [Resurssien kohdistaminen käyrällä](docs://howto-resource-toewijzen). *Resurssit › Resurssikohdistus › Kohdista* näyttää vain resurssit, jotka ovat jo projektissa, joten lisää kirjaston resurssi ensin projektiin tällä tavalla.

*Kohdista projektiin* on olemassa vain projektin *Kirjasto*-näkymässä, jos projekti on liitetty kyseiseen kirjastoon.

### 4. Vie projektin resurssi kirjastoon

Tämä tehdään resurssille, joka on luotu projektissa ja jota käytetään useammin, esimerkiksi vuokrattu nosturi.

1. Valitse näkymässä *Projekti* resurssin kohdalta *Siirrä kirjastoon*. Painike näkyy vain liitetyssä projektissa resurssilla, jolla on nimi ja joka ei vielä tule kirjastosta.
2. Lue taulukon yläpuolella oleva viesti.

Viesti voi kertoa kolme asiaa:

- *Lisätty.* Kirjastossa ei ollut kohdetta tällä nimellä. Uusi kohde luotiin, ja resurssi liitettiin siihen.
- *Oli jo kirjastossa — nyt liitetty.* Kirjastossa oli kohde samalla nimellä ja samoilla tiedoilla. Resurssi liitettiin siihen.
- *Liitetty olemassa olevaan kirjastokohteeseen — arvot eroavat, katso merkintä.* Kirjastossa oli kohde samalla nimellä, mutta tiedot erosivat. Resurssi liitettiin siihen ja se merkitään heti *eroaa — päätä*. Jatka vaiheesta 6.

### 5. Irrota kopio kirjastosta

Jos halutaan poiketa kirjastosta yhdessä projektissa, esimerkiksi eri normaalihinnalla, kopio irrotetaan.

1. Napsauta näkymässä *Projekti* rivin lopussa kuvaketta *Irrota kirjastosta*.
2. Resurssi on nyt tavallinen projektiresurssi. Kaikki kentät voi muokata, eikä resurssi enää seuraa kirjastoa. Myös kalenteri, joka tuli resurssin mukana, irrotetaan, ellei tässä projektissa ole toista resurssia, joka vielä seuraa sitä.

Irrottaminen perutaan painamalla *Kumoa* (Ctrl+Z).

### 6. Ratkaise ero

Kopio, jossa lukee *eroaa — päätä*, eroaa kirjaston kohteesta. Sovellus ei valitse, kumpi on oikein.

1. Napsauta resurssin merkintää *eroaa — päätä*. Ikkuna *Linkitä kirjasto* avautuu. Se avautuu myös itsestään, kun avataan tiedosto, jossa on tällainen kopio.
2. Valitse osiossa *Erot*, mitä kohteelle halutaan. Katso alla.
3. Napsauta *Päätä myöhemmin*, jos valintaa ei haluta vielä tehdä. Ikkuna suljetaan, ja merkintä jää paikalleen.

Erolle on kaksi vaihtoehtoa:

- *Käytä kirjaston arvoja*: kopio saa tiedot kirjastosta.
- *Ota tiedoston arvot kirjastoon*: kirjasto saa tiedot kopiosta. Sen alla lukee *Huomio: tämä muuttaa kirjastoa ja koskee kaikkia projekteja.* Kopiot muissa avoimissa projekteissa seuraavat.

## Valkuilut ja mitä sovellus silloin tekee

**Esimerkkiprojekteilla on oma kirjasto.** Jos avataan yksi kolmesta esittelyesimerkistä (*Tiedosto › Esimerkit*, tai ohjeen linkin kautta), sovellus luo kerran kirjaston *Demo-kirjasto* ja liittää projektin siihen. Projektin resurssit, joilla on sama nimi kuin kirjastokohteella, liitetään heti. Kalentereita ei liitetä. Omiin kirjastoihin ei kosketa. Jos kaksi esittelyesimerkkiä avataan rinnakkain, ne näyttävät yhdessä ristiriidat kohdassa [Käyttöasteen yleiskuvan käyttäminen](docs://howto-bezettingsoverzicht-gebruiken), esimerkiksi muurariryhmässä (*Masonry crew*) projektien *Refurbishment & Extension of a Family Home* ja *6 New Terraced Houses, De Akkers* välillä.

**Et näe vaihtokytkintä.** Projekti ei ole liitetty kirjastoon. Tee vaihe 1.

**Kirjastoa muokataan vahingossa.** Paneeli avautuu aina kohdassa *Projekti*, jotta tämä estetään. Muutokset näkymässä *Kirjasto* koskevat kaikkia projekteja, eikä niitä voi perua painikkeella *Kumoa*.

**Resurssi poistetaan kirjastosta.** Sovellus kysyy ensin *Poistetaanko 'Bricklayer' kirjastosta? Tämä koskee kaikkia projekteja, eikä sitä voi perua.* Kopiot projekteissa jäävät paikalleen ja toimivat edelleen. Niihin tulee merkintä *ei enää kirjastossa*, ja ne voi muokata kokonaan. Painikkeella *Poista projektista* kopio poistetaan projektista.

**Kun kohdassa *Kirjasto* valitaan toinen kirjasto tai *ei kirjastoa (erillinen projekti)*.** Edellisen kirjaston alkuperämerkinnät poistuvat. Resurssit jäävät projektiin tavallisina projektiresursseina. Toisen kirjaston kanssa sovellus etsii resursseja samalla nimellä uudelleen.

**Resurssilla ei ole ehdotusta osiossa *Tunnistettu*.** Siinä lukee *Ei ehdotusta — valitse käsin*, mutta tässä ikkunassa ei ole siihen painiketta. Se vaikuttaa puutteelta. Vie tällainen resurssi kirjastoon painikkeella *Siirrä kirjastoon* (vaihe 4).

## Katso myös

- [Resurssikirjasto](docs://uitleg-resourcebibliotheek): mitä kirjasto päättää, mitä projekti päättää ja miten kopiot seuraavat.
- [Resurssikirjastojen hallinta ja jakaminen](docs://howto-bibliotheken-beheren): kirjastojen luominen, vieminen ja tuonti.
- [Käyttöasteen yleiskuvan käyttäminen](docs://howto-bezettingsoverzicht-gebruiken): nähdään, tarvitsevatko kaksi projektia saman resurssin samaan aikaan.
- [Resurssien hallinta](docs://howto-resources-beheren): yhden projektin resurssit.

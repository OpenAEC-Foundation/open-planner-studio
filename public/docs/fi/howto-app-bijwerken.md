# Sovelluksen päivittäminen

Tavoite: selvittää, onko uusin versio käytössä, päivittää sovellus ja lukea, mitä versiossa on uutta.

## Milloin tätä tarvitaan

Open Planner Studiosta julkaistaan säännöllisesti uusia versioita. Tieto siitä, onko uusin versio jo käytössä, on tarpeen esimerkiksi ennen virheestä kertomista tai silloin, kun laajennus vaatii uudemman version. Tai sovellus on juuri päivitetty, ja halutaan nähdä, mitä on muuttunut.

Päivittäminen toimii vain työpöytäsovelluksessa. Selainversiossa ei ole päivitystoimintoa.

## Vaiheet

### Päivitä, kun sovellus itse kertoo uudesta versiosta

1. Käynnistä työpöytäsovellus. Käynnistyksen yhteydessä sovellus tarkistaa taustalla, onko uusi versio saatavilla. Jos uutta versiota ei ole tai tarkistus epäonnistuu, esimerkiksi ilman internetyhteyttä, mitään ei huomata.
2. Jos uusi versio on saatavilla, avautuu ikkuna *Ohjelmiston päivitys*. Siinä näkyvät *Nykyinen versio*, *Uusi versio*, viesti *Uusi versio on saatavilla* ja kohdassa *Mitä on uutta* päivitykseen kuuluva teksti.
3. Tallenna avoimet projektit.
4. Valitse *Lataa ja asenna*. Ikkunassa näkyy latauksen edistyminen ja teksti *Ladataan…*. Sen jälkeen asennus alkaa. Latauksen aikana ikkunaa ei voi sulkea.
5. Odota, kunnes sovellus käynnistyy itse uudelleen. Silloin uusi versio on käytössä.

Juuri ennen kuin päivitys asennetaan, sovellus tallentaa myös varmuuskopion avoimista muutoksista (kaatumisen palautusta varten). Katso [Palautus kaatumisen jälkeen](docs://howto-herstellen-na-een-crash).

### Tarkista uusi versio itse

1. Valitse *Asetukset › Projekti › Asetukset*. Vaihtoehtoisesti valitse *Tiedosto › Asetukset*, tai valitse ylhäältä vaihteen kuvake.
2. Valitse välilehti *Lisäasetukset*. Kohdassa *Versio* näkyy nykyisen version numero.
3. Valitse *Tarkista päivitykset*. Ikkuna *Ohjelmiston päivitys* avautuu, ja siinä lukee *Tarkistetaan…*. Sen jälkeen siinä lukee *Käytössä on uusin versio* tai viesti, että uusi versio on saatavilla. Painike on silloin sama: *Lataa ja asenna*.

Selainversiossa tämä painike ei tee mitään erityistä. Ikkuna kertoo heti *Käytössä on uusin versio*, eikä sovellus tarkista mitään.

### Lue, mitä on uutta

1. Jos työpöytäsovellus käynnistetään ensimmäistä kertaa eri versiolla kuin viimeksi, ikkuna avautuu itsestään. Ikkunan otsikko on *Päivitys on tehty!*. Tuoreen asennuksen jälkeen ikkuna ei avaudu, koska ensimmäinen käynnistys ei ole päivitys. Jos ikkuna halutaan silti nähdä, käytä painiketta *Mitä on uutta* (katso alla).
2. Ylhäällä näkyy siirtymä edellisestä versiosta uuteen. Painikkeella *Mitä on uutta* näkyy vain uusi versio.
3. Jos sovelluksessa on tälle versiolle sisäänrakennettu yhteenveto, näkyy yksi pääkohta ja neljä pienempää kohtaa. Pääkohdassa voi olla painike *Lue opas*. Muuten näkyy vain versiosiirtymä ja sen alla oleva sisältö.
4. Valitsemalla *Näytä koko julkaisutiedot* avataan muutosloki GitHubissa. Jos avaaminen ei onnistu, ikkunassa lukee *Julkaisutietoja ei voitu avata*.
5. Kohdassa *Tämä päivitys lukuina* näkyy päivien määrä edellisestä julkaisusta, muutosten (commit) määrä ja lisättyjen koodirivien määrä. Jos sovellus voi hakea asennuspaketin koon muutoksen, sekin näkyy. Jokainen luku näkyy vain, jos sen tieto on saatavilla.
6. Sulje ikkuna valitsemalla *Selvä*.

Jos tämä ikkuna halutaan avata myöhemmin uudelleen, valitse *Asetukset › Projekti › Asetukset*, välilehti *Lisäasetukset* ja kohdassa *Versio* painike *Mitä on uutta*. Ikkuna avautuu silloin nykyiselle versiolle, ilman edellistä versiota.

## Ongelmatilanteet ja sovelluksen toiminta niissä

**Päivitys epäonnistuu.** Ikkunassa lukee *Päivityksessä tapahtui virhe*. Sen alla näkyy tekninen syy. Painike on *Yritä uudelleen*.

**Sovellus on asennettu .deb-paketina ja asennus epäonnistuu.** Ikkunassa lukee: *Asenna uusi versio käsin suorittamalla tämä komento päätteessä tai lataa uusin paketti*. Kohdassa *Asennuskomento* on komento ja painike *Kopioi komento*. Kopioinnin jälkeen lukee *Kopioitu*. Valitsemalla *Avaa lataussivu* avataan uusimman version lataussivu.

**Sovellus on asennettu Snap Storen kautta.** Sovellus ei silloin päivitä itseään, eikä se tarkista päivityksiä käynnistyksen yhteydessä. Snap Store hoitaa sen. Ikkunassa lukee *Tämä versio päivittyy automaattisesti Snap Storen kautta — mitään ei tarvitse tehdä*.

**Käynnistyksen yhteydessä ei näy mitään.** Tämä on normaalia, jos uusin versio on jo käytössä. Käynnistyksen tarkistus ei näytä virheitä. Jos halutaan varmistaa, että versio on uusin, tarkista se itse yllä kuvatulla tavalla.

## Katso myös

- [Palautteen antaminen](docs://howto-feedback-geven): kerro virheestä uusimmassa versiossa.

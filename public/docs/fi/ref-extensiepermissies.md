# Laajennuksen oikeudet

Kaikki oikeudet, jotka laajennus voi ilmoittaa manifestissaan: mitä ne sallivat, mitä tapahtuu, kun oikeus puuttuu, ja mitä niistä näkyy, kun laajennus asennetaan. Laajennuksen asentaminen ja hallinta on kuvattu artikkelissa [Laajennuksen asentaminen ja hallinta](docs://howto-extensie-installeren).

## Mikä oikeus on ja mikä ei ole

Oikeus on **tekijän ilmoitus**: mitkä sovelluksen käyttöliittymän osat laajennus haluaa käyttää. Se ei ole este. Laajennuksen koodi toimii samassa ympäristössä kuin sovellus itse. Siksi se voi tehdä enemmän kuin oikeudet sanovat, koska hiekkalaatikkoa ei ole. Sovellus kertoo tämän myös asennusikkunassa. Laajennuksia asennetaan vain tekijöiltä, joihin luotetaan.

Sovellus valvoo oikeutta yhdellä kolmesta tavasta. Ero on tärkeä:

**Tiukka valvonta.** Jos oikeus puuttuu, vastaava metodi heittää virheen (hollanniksi, esimerkiksi *Extensie "…" mist permissie: ribbon*) ennen kuin mitään tapahtuu.

**Varoitus.** Jos oikeus puuttuu, metodi toimii silti, mutta sovellus kirjoittaa lokiin varoituksen. Tulevassa versiossa siitä tulee hylkäys.

**Vain tiedoksi.** Oikeuteen ei ole liitetty mitään käyttöliittymän osaa. Sovellus näyttää sen asennuksessa eikä tee sillä muuta.

Ilman oikeutta toimii laajennusliittymän perusta: projektin, kalenterin, tehtävien, riippuvuuksien, resurssien ja resurssikohdistusten lukeminen; tehtävien ja riippuvuuksien lisääminen ja tehtävien muuttaminen; projektin lataaminen, aikataulun laskeminen uudelleen ja useiden muutosten yhdistäminen; oman asetuksen tallentaminen, omien mukana toimitettujen tiedostojen lukeminen ja ilmoituksen näyttäminen.

**Manifesti.** Oikeudet ovat manifestissa luettelona. Nyt asennettava laajennus, jolla on oikeus, jota tämä sovellusversio ei tunne, hylätään. Jo tallennetun vanhemman laajennuksen kohdalla sovellus jättää tuntemattomat oikeudet pois ja kirjaa siitä lokiin.

## Miten sovellus kysyy

Asennettaessa luettelosta (*Tiedosto › Laajennukset › Selaa › Asenna*) tai tiedostosta (*ZIP* tai *JS*) sovellus näyttää ikkunan *Asennetaanko laajennus?*. Kysymys tulee kerran, asennuksen yhteydessä. Se ei tule joka kerta, kun laajennus kytketään päälle.

Ikkuna näyttää nimen, version, kuvauksen, tekijän ja tarvittaessa lähdekoodivaraston. Kohdassa *Alkuperä* kerrotaan, mistä laajennus tulee (*Verkon laajennusluettelosta*, *ZIP-tiedostosta tällä tietokoneella* tai *JavaScript-tiedostosta tällä tietokoneella*). Siinä kerrotaan myös, onko lataus tarkistettu: tarkistussumma tulee luettelosta, ei tarkistettu, koska luettelo ei anna tarkistussummaa, tai tiedosto on itse valittu. Kohdassa *Mihin suostutaan* kerrotaan, että laajennus on ohjelmakoodia, joka toimii samoilla oikeuksilla kuin sovellus. Käytännössä se tarkoittaa työpöytäsovelluksessa muun muassa tiedostojen lukemista ja kirjoittamista missä tahansa käyttäjäkansiossa sekä pääsyä projekteihin, asetuksiin ja leikepöytään. Selaimessa se tarkoittaa pääsyä tallennettuihin projekteihin ja asetuksiin, tiedostoihin, joihin on myönnetty pääsy, sekä verkkoon.

Kohdassa *Mitä laajennus sanoo käyttävänsä* ovat manifestin oikeudet lyhyinä nimikkeinä, nimi kuten alla. Siinä lukee: *Tämä on tekijän ilmoitus, ei rajoitus. Koodi voi silti tehdä enemmän*. Jos laajennuksella ei ole oikeuksia, siinä lukee *Ei ilmoitettu mitään*. Kahdella oikeudella on selitys: *importSource* ja *help*. Muilla kuudella on vain nimike.

Valitsemalla *Asenna* asennus hyväksytään. *Peruuta*, Esc-näppäin ja napsautus ikkunan ulkopuolelle hylkäävät asennuksen.

## Oikeudet

**ribbon** — sijoittaa painikkeen valintanauhaan. Vaikutus: laajennus saa lisätä painikkeen valintanauhan välilehden ryhmään. Laajennus ilman tätä oikeutta saa virheilmoituksen, kun se yrittää. Painikkeet näkyvät valitun välilehden lopussa laajennuksen ryhmänimikkeen alla ja poistuvat, kun laajennus kytketään pois päältä tai poistetaan. Oletus: ei myönnetty; vain se, mikä on manifestissa. Valvonta: tiukka. Missä: valitulla välilehdellä.

**events** — seurata sovelluksen tapahtumia ja lähettää tapahtumia itse. Vaikutus: laajennus saa tilata tapahtumia ja peruuttaa tilauksen, sekä lähettää tapahtumia itse. Sovellus itse lähettää neljä tapahtumaa: projekti ladataan (tuonnin, avaamisen tai laajennuksen tekemän latauksen jälkeen), luodaan tyhjä projekti, aikataulu lasketaan tai lasketaan uudelleen ja käyttäjä pyytää opetusohjelmaa. Viimeinen tapahtuma lähetään vain opetusohjelmien laajennukselle. Oletus: ei myönnetty; vain se, mikä on manifestissa. Valvonta: tiukka. Missä: ei missään; laajennus reagoi tapahtumaan.

**backstage** — tarjota tuontimuoto. Vaikutus: laajennus saa rekisteröidä tuojan. Se näkyy kohdassa *Tiedosto › Tuo*, missä muoto valitaan napsauttamalla ja tiedosto valitaan. Sovelluksen omat muodot ovat tästä erillään (katso [Tuonti- ja vientimuodot](docs://ref-import-exportformaten)). Oletus: ei myönnetty; vain se, mikä on manifestissa. Valvonta: varoitus. Jos oikeus puuttuu, rekisteröinti toimii silti, ja lokiin tulee varoitus. Tämä on siirtymäjärjestely, koska olemassa olevat laajennukset eivät aina luettele oikeutta. Missä: *Tiedosto › Tuo*.

**pdf-fonts** — toimittaa fontin PDF-vientiin. Vaikutus: laajennus saa rekisteröidä fonttitarjoajan. PDF-vienti käyttää sitä merkkeihin, joita sovelluksen omat fontit eivät kata, kuten kiinan, japanin ja korean merkkeihin. Oletus: ei myönnetty; vain se, mikä on manifestissa. Valvonta: tiukka. Missä: raportin PDF-tiedostossa. Asennusikkunassa on vain nimike.

**importSource** — lukea tuodun tiedoston alkuperäiset tavut. Vaikutus: laajennus saa pyytää tuodun projektin lähdetiedoston koko sisällön (toistaiseksi Primavera-tiedoston), mukaan lukien kentät, jotka sovellus tarkoituksella jättää projektiin ottamatta, kuten tarkastus- ja alkuperätiedot, kustannukset sekä katselmointi- ja sijaintikentät. Tämä on paljon laajempi kuin muu käyttöliittymä, ja siksi se on oma oikeutensa. Ilman oikeutta sovellus ei lue lähdetiedostosta yhtäkään tavua: jokainen metodi heittää virheen ennen kuin mitään haetaan. Oletus: ei myönnetty; vain se, mikä on manifestissa. Valvonta: tiukka, oletuksena kielletty. Missä: asennusikkunassa oikeuden mukana on selitys: *importSource – kunkin tuodun tiedoston täydelliset lähdetavut (esimerkiksi raaka Primavera-tiedosto), myös kentät, jotka eivät koskaan päädy projektiin*.

**help** — lisätä ohjeartikkeleita ja opastusta. Vaikutus: laajennus saa rekisteröidä ja poistaa ohjeartikkeleita (opetusohjelmia), avata mukana toimitetun `.ifc`-tiedoston uutena asiakirjana sekä käynnistää ja pysäyttää opastuksen, joka osoittaa sovelluksen osia. Mukana toimitettu projekti ei koskaan korvaa asiakirjaa, jota työstetään: se avautuu uutena asiakirjana tai ottaa haltuunsa vain tyhjän ja muuttumattoman välilehden. Sopimusversiosta 1.4.0 alkaen. Oletus: ei myönnetty; vain se, mikä on manifestissa. Valvonta: tiukka. Missä: ikkuna *Ohje* (artikkelit), uutena välilehtenä (projekti) ja opastuksena, joka osoittaa painikkeisiin. Asennusikkunassa oikeuden mukana on selitys: *help – saa lisätä ohjeartikkeleita, avata mukana toimitettuja projekteja uutena asiakirjana ja näyttää opastuksen, joka osoittaa sovelluksen osia*.

**filesystem** — laajennus sanoo käyttävänsä tiedostoja. Vaikutus: ei mitään. Käyttöliittymän osaa ei ole liitetty siihen, eikä sovellus voi valvoa sitä. Oletus: ei myönnetty; vain se, mikä on manifestissa. Valvonta: vain tiedoksi. Missä: nimikkeenä asennusikkunassa.

**network** — laajennus sanoo käyttävänsä verkkoa. Vaikutus: ei mitään, kuten *filesystem*. Oletus: ei myönnetty; vain se, mikä on manifestissa. Valvonta: vain tiedoksi. Missä: nimikkeenä asennusikkunassa.

## Katso myös

- [Tuonti- ja vientimuodot](docs://ref-import-exportformaten): muodot, jotka sovellus tuntee itse, ja mitä laajennukset lisäävät kohtaan *Tiedosto › Tuo*.
- [Laajennuksen asentaminen ja hallinta](docs://howto-extensie-installeren): laajennuksen asentaminen, poistaminen käytöstä ja poistaminen.

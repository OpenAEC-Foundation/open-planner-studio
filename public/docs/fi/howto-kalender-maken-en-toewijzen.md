# Kalenterin luominen ja määrittäminen

Tavoite: luoda oma kalenteri, esimerkiksi kuuden päivän työviikko, ja antaa se tehtäville, jotka on laskettava siinä.

## Milloin tätä tarvitaan

Aliurakoitsija työskentelee myös lauantaisin. Työryhmä työskentelee vain maanantaista torstaihin. Tehtävä osuu aikaan, jona vain kyseinen tehtävä on paikallaan. Projektikalenterin työpäivät ovat silloin vääriä. Omalla kalenterilla sovellus laskee nuo tehtävät oikeina päivinä, ja loput pysyvät projektikalenterissa. Sen, mitä sovellus kalenterilla tarkalleen tekee, voi lukea kohdasta [Kalenterit ja työpäivät](docs://uitleg-kalenders).

## Toimenpiteet

### Kalenterin luominen

1. Valitse *Aikataulu › Kalenteri › Kalenteri*. Sama painike on kohdassa *Asetukset › Kalenteri › Kalenteri*. Ikkuna *Kalenterit* avautuu. Vasemmalla ovat projektin kalenterit. Projektikalenterissa on tähti.
2. Napsauta luettelon alla plusmerkillä merkittyä painiketta (*Uusi kalenteri*). Uusi kalenteri on kopio vakiosta: maanantaista perjantaihin kello 07:00–16:00, tunnin tauolla. Jos *Rakennustila* on päällä, mukana ovat myös Alankomaiden viralliset vapaapäivät. Jos lähtökohdaksi halutaan olemassa oleva kalenteri, valitse se luettelosta ja napsauta luettelon alla kahden arkin kuvalla merkittyä painiketta (*Monista*).
3. Anna kalenterille nimi kohtaan *Nimi*. Nimi kertoo, kuka kalenteria käyttää, esimerkiksi *Six-day week*.
4. Napsauta kohdan *Työpäivät* alla viikonpäiviä käyttöön tai pois käytöstä. *Ma–pe* palauttaa vakioviikon kello 07:00–16:00. Jos kalenterissa on työaikalohkoja, *Ma–pe* ottaa käyttöön vain maanantaista perjantaihin, ja jokainen päivä säilyttää lohkonsa. *Jatkuva (24/7)* ottaa käyttöön kaikki seitsemän päivää kello 00:00–24:00.
5. Muuta tarvittaessa työaikoja: *Alku (tunti)*, *Loppu (tunti)*, *Tauko alkaa* ja *Tauon kesto (minuuttia)*. Kellonajat kirjoitetaan muodossa HH:MM. Nuolilla niitä nostetaan tai lasketaan neljännestunnilla. Jos tauon kestoksi asetetaan 0, kalenteri toimii ilman taukoa. *Vakiotyöpäivä* lasketaan sovelluksessa itse. Jos kalenterissa on viikonpäivittäin työaikalohkoja (esimerkiksi MS Project -ohjelmasta), näitä kenttiä ei näy. Sen sijaan näkyy lohko *Työajat*, myös kun tuntisuunnittelu on pois päältä. Katso [Työaikojen asettaminen](docs://howto-werktijden-instellen).
6. Muuta tarvittaessa vapaapäiviä. Niiden toiminta on kuvattu kohdassa [Vapaapäivien luominen ja rakennusalan kesäloma](docs://howto-feestdagen-genereren).
7. Napsauta *Käytä*. Sovellus laskee aikataulun uudelleen heti ja sulkee ikkunan. Painikkeella *Peruuta* muutokset hylätään. Kun arvo vahvistetaan syötekentässä, tallennus tehdään välissä ja aikataulu lasketaan myös uudelleen, mutta ikkuna ei sulkeudu. Tällöin *Peruuta* kumoaa vain sen, mitä on muutettu sen jälkeen.

### Kalenterin antaminen tehtäville

Uusi kalenteri vaikuttaa vasta, kun tehtävä käyttää sitä. Siihen on kaksi tapaa.

**Ominaisuuspaneelin kautta**

1. Valitse tehtävä. Jos paneeli *Ominaisuudet* ei näy, ota se käyttöön kohdasta *Näkymä › Paneelit › Ominaisuudet*.
2. Valitse kohdan *Tehtävä* alla *Kalenteri*-luettelosta kalenteri. Ylimmässä valinnassa *Projektikalenteri* ja kalenterin nimi tarkoittaa, että tehtävällä ei ole omaa kalenteria.

**Hiiren oikean painikkeen valikon kautta**

1. Napsauta tehtävää hiiren oikealla painikkeella tehtävätaulukossa tai Gantt-kaavion palkilla.
2. Valitse *Määritä kalenteri* ja sen jälkeen kalenteri, tai valitse *Projektikalenteri*, jolloin tehtävän oma kalenteri poistetaan. Nyt käytössä oleva kalenteri on merkitty valintamerkillä.
3. Jos halutaan antaa yksi kalenteri useille tehtäville kerralla, valitse ne ensin Ctrl-näppäimellä (Macilla ⌘) ja napsauta jotakin valituista tehtävistä hiiren oikealla painikkeella. Valinta koskee kaikkia valittuja tehtäviä. Jos tehtävää, jota ei ole valittu, napsautetaan hiiren oikealla painikkeella, valinta koskee vain sitä tehtävää.

Uusi kalenterivalinta ei vielä tee aikataulusta ajantasaista: tilarivi näyttää *Vanhentunut — laske uudelleen (F5)*. Paina **Laske** (F5), esimerkiksi kohdasta *Aloitus › Aikataulu › Laske*. Jos *Laske automaattisesti* on käytössä (*Asetukset › Projekti › Asetukset*, välilehti *Aikataulu*, otsikko *Laskenta*), sovellus tekee tämän itse.

### Projektikalenterin vaihtaminen

1. Avaa *Aikataulu › Kalenteri › Kalenteri* ja valitse luettelosta kalenteri.
2. Napsauta lomakkeen yläpuolella *Aseta projektin oletukseksi*. Tähti siirtyy kyseiseen kalenteriin.
3. Napsauta *Käytä*.

Vain tehtävät, joilla ei ole omaa kalenteria, siirtyvät mukana.

### Kalenterin poistaminen

1. Avaa ikkuna *Kalenterit* ja valitse luettelosta kalenteri.
2. Napsauta luettelon alla roskakorilla merkittyä painiketta (*Poista*). Tämä painike on pois käytöstä niin kauan kuin kalentereita on vain yksi.
3. Napsauta *Käytä*. Tehtävät ja resurssit, jotka käyttivät kalenteria, palaavat projektikalenteriin. Jos projektikalenteri itse poistetaan, luettelon ensimmäisestä kalenterista tulee projektikalenteri.

## Sudenkuopat ja mitä sovellus silloin tekee

**Ei työpäiviä.** Jos kaikki viikonpäivät poistetaan käytöstä, sovellus ei voi laskea. Laskettaessa se näyttää: *Kalenterissa ei ole asetettu työpäiviä*.

**Virheellinen syöte.** Tauko työpäivän ulkopuolella, alkuaika lopetusajan jälkeen tai vapaapäivä, jonka päivämäärä on väärin, saa kentän kohdalle punaisen ilmoituksen, ja *Käytä* on pois käytöstä, kunnes virhe korjataan. Virheellisen tauon tai vapaapäivän kohdalla luettelossa kalenterin vieressä on myös varoitusmerkki (*Tämä kalenteri sisältää virheellisiä syötteitä*).

**Kalenteri vaiheessa.** Vaihe lasketaan aina projektikalenterin mukaan, koska sen kesto seuraa sen tehtävistä. Anna kalenteri itse tehtäville.

**Sama kalenteri, kaksi valintaa.** Luettelossa projektikalenteri näkyy kahdesti: kerran nimellä *Projektikalenteri: nimi* ja kerran tavallisena kalenterina tällä nimellä. Jos valitaan jälkimmäinen, se on oma valinta kyseiselle tehtävälle. Tehtävä ei siirry mukana, kun myöhemmin valitaan toinen projektikalenteri.

**Eri tuntimäärä päivässä.** Jos työaikoja tai taukoa muutetaan niin, että kalenterin *Vakiotyöpäivä* muuttuu, tehtävä päivinä mitattuna saa yhä saman määrän päiviä. Tehtävälle, jolla on resursseja ja tehtävätyyppi *Kiinteä työmäärä* tai *Kiinteä yksikkömäärä*, kesto muuttuu mukana, koska työ pysyy samana. Neljäkymmentä tuntia työtä on 5 päivää, kun päivässä on 8 tuntia, ja 7 päivää, kun päivässä on 6 tuntia. Sovellus näyttää, montako tehtävää sai eri keston.

## Katso myös

- [Kalenterit ja työpäivät](docs://uitleg-kalenders): miten sovellus laskee työpäivät ja mikä kalenteri ratkaisee.
- [Päivät ja tunnit](docs://uitleg-dagen-en-uren): mitä vakiotyöpäivä tekee.
- [Resurssikalenterin asettaminen](docs://howto-resourcekalender-instellen): kalenteri resurssille tehtävän sijaan.
- [Kalenteri-ikkunat](docs://ref-kalenders): kaikki kalenteri-ikkunien kentät.

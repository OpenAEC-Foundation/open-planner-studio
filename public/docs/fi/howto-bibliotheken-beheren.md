# Kirjastojen hallinta ja jakaminen

Tavoite: kirjastojen luominen ja poistaminen, kalenterien lisääminen niihin, sekä kirjaston vieminen tai tuominen varmuuskopioksi tai käyttöön toisella tietokoneella.

## Milloin tarvitset tätä

Kirjasto ei ole projektitiedostoissa. Se on sovelluksessa: työpöytäsovelluksessa tiedostossa tällä tietokoneella, selaimessa selaimen tallennustilassa. Kirjastoa ei synkronoida. Jos selaimen sivustotiedot tyhjennetään, kirjasto katoaa, joten vie se varmuuskopioksi. Jos kollega haluaa työskennellä samojen miehistöjen ja normaalihintojen kanssa, kirjasto annetaan myös tiedostona. Jos organisaatiolla on useita toimintayhtiöitä omine miehistöineen, tehdään jokaiselle oma kirjasto. Uudelle projektille valitaan, mitä kirjastoa se käyttää.

Mitä kirjasto on, kerrotaan kohdassa [Kirjasto](docs://uitleg-resourcebibliotheek). Resursseja itseään ei muokata tässä, vaan resurssipaneelissa. Katso [Kirjaston käyttäminen](docs://howto-resourcebibliotheek-gebruiken).

## Vaiheet

### Avaa hallintanäkymä

Valitse *Tiedosto › Kirjasto*. Vasemmalla on luettelo *Kirjastot*. Oikealla ovat napsauttamasi kirjaston tiedot: nimi, painikkeet ja luettelo *Kalenterit*. Yläreunassa lukee, että resursseja hallitaan *Resurssit*-välilehdellä.

### Luo, nimeä uudelleen ja valitse oletuskirjasto

1. Napsauta luettelon yläpuolella olevaa plusmerkkiä (*Lisää kirjasto*). Kirjasto *Uusi kirjasto* lisätään, ja se valitaan heti.
2. Kirjoita uusi nimi oikeanpuoleisen osan yläreunan nimikenttään ja paina Enter-näppäintä, tai napsauta kentän ulkopuolelle. Sovellus ei hyväksy tyhjää nimeä.
3. Napsauta *Aseta oletukseksi*. Tämä kirjasto on silloin valittuna uusille projekteille tästä lähtien. Oletuskirjaston nimen edessä on luettelossa tähti.

### Lisää kalenteri kirjastoon

1. Napsauta kohdassa *Kalenterit* painiketta *Lisää projektista*. Avautuu luettelo aktiivisen projektin kalentereista.
2. Napsauta pientä nuolta kalenterin kohdalla, jonka haluat lisätä kirjastoon. Luettelon yläpuolella lukee *Lisätty.* Kalenteri, joka on jo liitetty tähän kirjastoon, saa nimensä perään tekstin *jo liitetty*.
3. Kalenteri on nyt kirjaston luettelossa *Kalenterit*. Kynän kuvakkeella (*Muokkaa*) muutetaan nimeä, ja tallennetaan rastimerkillä. Roskakorin kuvake poistaa kalenterin heti, ilman vahvistuspyyntöä. Projektien kopiot säilyvät.

Kohdan *Kalenterit* jälkeen näkyy versionumero, esimerkiksi *v2*. Se kasvaa aina, kun kirjastoon tehdään muutos. Kirjaston kalenteri siirtyy projektiin, kun sille liitetty resurssi määritetään käyttämään sitä. Kalenteri liitetään resurssiin välilehden *Resurssit* näkymässä *Kirjasto*, sarakkeessa *Kalenteri*.

### Vie kirjasto

1. Valitse kirjasto luettelosta.
2. Napsauta *Vie*.
3. Työpöytäsovelluksessa sekä Chromessa ja Edgessä valitaan tiedostolle sijainti. Muissa selaimissa tiedosto menee suoraan latauskansioon, ja sovellus kertoo sen. Tiedoston nimi on `bibliotheek-`, jota seuraa kirjaston nimi, ja pääte on `.ifc`.

Painikkeiden alla lukee *Vienti toimii myös varmuuskopiona: säilytä tiedosto turvallisessa paikassa.*

### Tuo kirjasto

1. Napsauta *Tuo*. Ikkuna *Tuo kirjasto* avautuu kirjastolle, joka oli valittuna luettelossa.
2. Napsauta *Valitse tiedosto*… ja valitse vientitiedosto, jonka pääte on `.ifc`. Jos tiedosto ei sisällä kirjastoa, lukee *Tämä IFC-tiedosto ei sisällä kirjastoa.*
3. Sovellus näyttää sisällön, esimerkiksi *2 kalenteria, 5 resurssia (versio 3).*
4. Valitse, mitä tiedostolle tehdään. Katso vaihtoehdot alla.
5. Napsauta *Lisää* tai *Korvaa*. Napsauta *Peruuta*, jos halutaan lopettaa.

Vaihtoehtoja on kaksi:

- *Lisää uutena kirjastona*: tiedostosta tulee erillinen kirjasto nykyisten kirjastojen rinnalle. Sen alla lukee, millä nimellä, esimerkiksi *Lisätään nimellä “Mijn resourcebibliotheek (2)”.* Mitään ei katoa, ja aktiivinen projekti pysyy liitettynä omaan kirjastoonsa.
- *Korvaa olemassa oleva kirjasto*: valitun kirjaston koko sisältö korvataan tiedoston sisällöllä. Sovellus kertoo sen myös: *Tuonti korvaa valitun kirjaston allasta kokonaan.* Jos kirjastoja on kaksi tai enemmän, valitaan kohdassa *Tuo kirjastoon* se kirjasto, johon tuonti kohdistuu. Jos kirjasto on tiedostoa uudempi, sovellus varoittaa: *Paikallinen kirjasto on uudempi — tuonti voi korvata tekemäsi muutokset.*

Sovellus ehdottaa valinnan itse. Jos tiedostossa oli oletuskirjasto, valittuna on *Lisää uutena kirjastona*. Jos tiedoston kirjasto on jo tällä tietokoneella eikä se ole oletuskirjasto, valittuna on *Korvaa olemassa oleva kirjasto*, ja juuri se kirjasto on valittu. Jos valinta on epäselvä, valitaan lisääminen: se ei korvaa mitään.

### Poista kirjasto

1. Valitse kirjasto luettelosta ja napsauta *Poista kirjasto*. Painike on harmaa viimeisellä kirjastolla, koska yksi kirjasto jää aina jäljelle.
2. Vahvista painikkeella *Poista*. Kysymys on *Poistetaanko tämä kirjasto?* Jos avoimia projekteja on liitetty siihen, lukee *Tämä kirjasto on liitetty 1 avoimeen projektiin. Poistaminen irrottaa projektin. Jatketaanko?* Useammalle projektille lukee sama asia lukumäärän kanssa, esimerkiksi *liitetty 2 avoimeen projektiin*.

Kirjasto on sen jälkeen poissa, kaikkine resursseineen ja kalentereineen. Avoimet projektit, joita se käytti, irrotetaan: niiden resurssit jäävät tavallisiksi projektiresursseiksi. Vie kirjasto ensin, jos sisältö on säilytettävä.

### Luovuta projekti kirjastonsa kanssa

Projektitiedosto sisältää omat kopiot resursseista. Jos halutaan luovuttaa myös koko kirjasto, toimitaan seuraavasti. Vienti itsessään on kuvattu myös kohdassa [Vieminen](docs://howto-exporteren).

1. Avaa projekti, joka on liitetty kirjastoon, ja valitse *Tiedosto › Vienti*.
2. Valitse valintaruutu *Tallenna kirjastotiedosto rinnalle*. Ruutu näkyy vain liitetylle projektille.
3. Valitse kortti *IFC* ja tallenna tiedosto. Sovellus pyytää sen jälkeen myös toisen tiedoston. Sen nimi on sama kuin projektin, ja perään tulee `-bibliotheek`. Se sisältää kirjaston.

Valintaruutu toimii vain IFC-viennissä, ei muissa vientimuodoissa. Kollega tuo toisen tiedoston yllä kuvatulla tavalla.

## Sudenkuopat ja mitä sovellus silloin tekee

**Kaksi suunnittelijaa, kaksi kirjastoa.** Sovellus ei synkronoi kirjastoja tietokoneiden välillä. Tuontiikkuna näyttää siitä aina varoituksen: *Huomautus: kirjastoja ei synkronoida koneiden välillä. Jos kaksi suunnittelijaa käyttää samaa kirjastoa, kirjastot voivat erkaantua. Jos organisaatio jakaa miehistöt toimintayhtiöiden kesken, valitse tietoisesti yksi yhteinen kirjasto.*

**Korvaaminen ylikirjoittaa kaiken.** Valitun kirjaston kaikki sisältö katoaa, eikä kirjaston muutos kuulu toimintoon *Kumoa*. Jos tilanne on epäselvä, vie kirjasto ensin. Projektit säilyttävät omat kopionsa. Sovellus päivittää kopiot, jotka ovat yhä uudessa tiedostossa. Kopiot, joita ei enää ole uudessa tiedostossa, saavat merkinnän *ei enää kirjastossa* ja toimivat edelleen. Jos kopio poikkeaa, avautuu ikkuna *Linkitä kirjasto* (katso [Kirjaston käyttäminen](docs://howto-resourcebibliotheek-gebruiken)).

**Kalenterin poisto luettelosta tapahtuu heti.** Sovellus ei kysy vahvistusta, toisin kuin resurssin poistossa. Tämä näyttää puutteelta. Kirjastomuutokset eivät kuulu toimintoon *Kumoa*.

## Katso myös

- [Kirjasto](docs://uitleg-resourcebibliotheek): miten kirjasto ja projekti liittyvät toisiinsa.
- [Kirjaston käyttäminen](docs://howto-resourcebibliotheek-gebruiken): resurssien liittäminen, niiden määrittäminen ja poikkeamien ratkaiseminen.
- [Vieminen](docs://howto-exporteren): vientimuodot, IFC kirjastotiedoston kanssa mukaan lukien.

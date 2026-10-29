# Laskentaprofiilin valitseminen tai luominen

Tavoite: päätetään, mitä laskentasääntöjä projekti käyttää. Valitaan sisäänrakennettu profiili tai luodaan oma profiili omilla laskentasäännöillään.

## Milloin tätä tarvitaan

Avataan projekti, jonka täytyy laskea kuten Primavera P6 tai Microsoft Project, tai halutaan asettaa yksi laskentasääntö toisin kuin profiili sen tekee. Mikä profiili on ja miksi päivämäärät voivat siirtyä, on kohdassa [Laskentaprofiilit ja laskentasäännöt](docs://uitleg-rekenprofielen).

## Vaiheet

### Profiilin valitseminen uudelle projektille

1. Valitse *Aloitus › Tiedosto › Uusi*. *Uusi projekti* -ikkuna avautuu.
2. Valitse profiili pudotusvalikossa *Laskentaprofiili*: *Open Planner Studio*, *Primavera P6* tai *Microsoft Project*.
3. Luo projekti. Sovellus korvaa aiemmin täytetyt laskentavaihtoehdot profiilin oletusarvoilla.

### Olemassa olevan projektin profiilin vaihtaminen

1. Valitse *Asetukset › Projekti › Projektin asetukset*. Sama kohta löytyy myös kohdasta *Tiedosto › Projektin asetukset*.
2. Avaa osiossa *Laskentaprofiili ja laskentavaihtoehdot* pudotusvalikko *Laskentaprofiili* ja valitse toinen profiili.
3. Valitse **Käytä**. Aikataulu lasketaan uudelleen heti, vaikka *Laske automaattisesti* on pois päältä. Jos tehtäviä siirtyi, sovellus kertoo niiden määrän.

Ennen kuin valitaan *Käytä*, muutos on vain lomakkeessa. Koko vaihto on yksi askel, jonka voi kumota painikkeella *Kumoa*. Vaihto muuttaa vain laskentasääntöjä. Laskentavaihtoehdot säilyvät ennallaan.

### Oman profiilin luominen

1. Napsauta osiossa *Laskentaprofiili ja laskentavaihtoehdot* pudotusvalikon vieressä painiketta *Uusi profiili*.
2. Anna nimi. Sovellus ehdottaa nimeksi valitun profiilin kopiota, esimerkiksi *Open Planner Studio* -kopio.
3. Valitse *Luo*. Osa *Tämän profiilin laskentasäännöt* laajenee.
4. Ota laskentasäännöt käyttöön tai poista ne käytöstä valintaruuduilla. Rivin jälkeinen i-kuvake näyttää kyseisen laskentasäännön selityksen. Laskentasääntö, joka poikkeaa perusarvosta, saa merkinnän *Palauta perusarvoon*.
5. Valitse **Käytä**. Vasta sitten projekti lasketaan uudella profiililla.

Kolme sisäänrakennettua profiilia ei voi muuttaa. Niiden laskentasäännöt näytetään vain tietona.

### Oman profiilin tallentaminen malliksi

1. Tarvittaessa anna omalle profiilille toinen nimi kenttään *Oman profiilin nimi*.
2. Valitse *Tallenna malliksi*. Sovellus kertoo, että malli tallennettiin, tai syyn, miksi tallennus epäonnistui.
3. Toisessa projektissa samassa sovelluksessa malli on pudotusvalikossa *Laskentaprofiili*.

Jos profiili myöhemmin poikkeaa mallista, keltainen osio kertoo siitä. Valitse sitten *Uudista malli tästä projektista* tai *Uudista mallista*.

Malli poistetaan painikkeella *Poista malli*. Sovellus kysyy ensin vahvistuksen.

## Tuloksen tarkistaminen

- Osio *Laskentaprofiili ja laskentavaihtoehdot* näyttää valitun profiilin.
- Kun *Käytä* on valittu, sovellus kertoo siirtyneiden tehtävien määrän, esimerkiksi *Soveltamisen jälkeen 4 tehtävää siirtyi.*
- Laskentavaihtoehtojen yläpuolella oleva oranssi osio kertoo, että laskentavaihtoehdot poikkeavat profiilin oletusarvosta. Se on usein tarkoituksellista. Jos oletusarvo halutaan silti, valitse *Käytä kohteen … oletusasetuksia*.

## Sudenkuopat ja mitä sovellus tekee

**Päivämäärät siirtyvät.** Toinen profiili voi muuttaa todellisia päivämääriä. Tarkista tulos. Jos tulos ei sovi, valitse *Kumoa*: profiili ja päivämäärät palautuvat yhdessä.

**Keltainen osio kumoamisen jälkeen.** Jos painetaan *Kumoa* tai *Tee uudelleen*, kun projektin asetukset ovat auki, osio seuraa projektin tilaa. Jos osiossa on jo muutettu jotakin itse, valinta säilyy. Keltainen osio kertoo silloin, että *Käytä* palauttaa valinnan.

**Malleja voi olla enintään 100.** Jos niitä on jo 100, sovellus ei tallenna mallia ja kertoo siitä. Malli on ensin poistettava. Jos sovelluksen tallennustila on täynnä tai puuttuu, sovellus antaa myös ilmoituksen.

**Mallit kuuluvat sovellukseen, profiili projektiin.** Projektissa on aina oma kopio profiilista. Jos mallia muutetaan myöhemmin, projekti ei muutu sen mukana.

**Asetukset lähdetiedostosta.** Jos projektille valitaan *Primavera P6* tai *Microsoft Project* ja projekti tulee toisesta tiedostosta, lähdetiedoston asetukset säilyvät. Niitä ei voi muuttaa täällä.

## Katso myös

- [Laskentaprofiilit ja laskentasäännöt](docs://uitleg-rekenprofielen): mikä profiili on ja mitä se tekee päivämäärille.
- [Laskentavaihtoehdot ja laskentasäännöt](docs://ref-rekenopties-en-conventies): kaikki laskentasäännöt ja laskentavaihtoehdot yhdellä silmäyksellä.
- [Edistymistavan valitseminen](docs://howto-voortgangsmodus-kiezen): Retained Logic tai Progress Override, erillään profiilista.

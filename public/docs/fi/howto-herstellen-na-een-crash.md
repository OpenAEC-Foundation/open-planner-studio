# Palautus kaatumisen jälkeen

Tavoite: työn palauttaminen, kun sovellus tai selain pysähtyi odottamatta eikä tallennusta ollut tehty.

## Milloin tarvitset tätä

Kannettava tietokone sammui, sovellus jäätyi tai selainvälilehti kaatui. Viimeisiä muutoksia ei ollut vielä tallennettu. Heti kun jokin muuttuu, sovellus tallentaa taustalla palautuskopiot kaikista avoimista projekteista. Kopio tehdään enintään kerran kymmenessä sekunnissa. Palautuskopio on erillään projektitiedostosta. Eron tallentamisen ja automaattitallennuksen välillä luet artikkelista [Tiedostot ja muodot](docs://uitleg-bestanden).

## Vaiheet

1. Käynnistä sovellus uudelleen. Selaimessa lataa sama välilehti uudelleen: palautuskopio kuuluu juuri siihen välilehteen.
2. Jos sovellus löysi kopioita, näkyviin tulee *Palauta tallentamaton työ* -ikkuna: *Open Planner Studio ei sulkeutunut normaalisti. Seuraavissa asiakirjoissa oli tallentamattomia muutoksia, jotka voidaan palauttaa:* Jokaisesta projektista näkyy nimi, tiedoston polku, jos projektilla on tiedosto (selaimessa vain tiedoston nimi), tehtävien määrä ja kopion aika, esimerkiksi *21 tehtävää* ja *Tallennettu: Sep 29, 2026 9:41 AM*. Aika noudattaa asetusta *Kellonajan muoto*. Ikkunassa voi näkyä myös projekteja, joita ei ollut muutettu.
3. Valitse *Palauta*. Sovellus avaa kaikki listan projektit, kukin omassa välilehdessään, viimeisimmän kopion tilassa. Enter tekee saman.
4. Tarkista projektit ja tallenna ne heti näppäinyhdistelmällä Ctrl+S.

Jos palauttamista ei haluta, on kaksi vaihtoehtoa. *Älä palauta* poistaa kopiot, eikä sitä voi kumota. Jos ikkuna suljetaan Escape-näppäimellä, rastilla tai klikkaamalla sen viereen, kopiot jäävät, ja sovellus kysyy asiaa uudelleen seuraavalla käynnistyksellä.

Kysymysmerkki ikkunan oikeassa yläkulmassa avaa tämän artikkelin valitsematta mitään. Kun ohjetta luetaan, ikkuna odottaa. Kun palataan takaisin, ikkuna on taas näkyvissä, ja palauttaminen on yhä mahdollista.

## Sudenkuopat ja mitä sovellus silloin tekee

**Palautetaan viimeisimmän kopion tila.** Viimeisten sekuntien muutokset ennen kaatumista voivat puuttua. Projekti, jossa oli muutoksia, on merkitty taas *Tallentamaton*-tilaan. *Kumoa*-historia on tyhjä: vaiheita ennen kaatumista ei voi kumota. Zoomaus, vierityskohta ja valinta rakennetaan uudelleen.

**Työpöytäsovelluksessa palautettu projekti säilyttää tiedostonsa, selaimessa ei.** Työpöytäsovelluksessa *Tallenna* kirjoittaa alkuperäiseen tiedostoon palautetulla tilalla. Selaimessa palautettu projekti ei ole enää yhteydessä tiedostoonsa: *Tallenna* kysyy, minne tiedosto tallennetaan. *Automaattitallennus*-kytkin on silloin myös harmaa, kunnes projekti on tallennettu kerran.

**Projekti näkymässä *Tallennetut päivämäärät* pysyy siinä näkymässä.** Katso [Tallennetut päivämäärät](docs://uitleg-datums-zoals-opgeslagen).

**Työpöytäsovelluksessa ikkuna ei tule näkyviin joka käynnistyksellä.** Palautuskopiot ovat sovelluksen datakansiossa IFC-tiedostoina, joiden nimi alkaa sanalla *recovery*. Kun sovellus suljetaan normaalisti, se tyhjentää omat kopionsa. Ikkuna tulee siis näkyviin odottamattoman lopetuksen jälkeen, sovelluspäivityksen takia tehdyn uudelleenkäynnistyksen jälkeen tai jos palautus lykättiin edellisellä käynnistyksellä.

**Selaimessa kopio säilytetään välilehtikohtaisesti.** Kopio on selaimen tallennustilassa. Uusi välilehti tai ikkuna ei tarjoa toisen välilehden kopioita. Kopiot välilehdistä, joita ei enää ole, tyhjennetään seitsemän päivän kuluttua, heti kun sovellus kirjoittaa kopioita taas.

**Selaimessa ikkuna tulee näkyviin myös tavallisen uudelleenlatauksen jälkeen.** Näin tapahtuu, vaikka kaikki oli tallennettu. Jos kaikki tallennettiin juuri ennen uudelleenlatausta eikä mitään muutettu sen jälkeen, *Älä palauta* voidaan valita turvallisesti: tiedosto on ajan tasalla.

**Ikkuna ei tule näkyviin.** Silloin sovellus ei löytänyt kopiota. Näin käy, jos muutoksia ei ole vielä tehty, jos selaimessa käytetään uutta välilehteä, jos palautukset on aiemmin poistettu valinnalla *Älä palauta*, tai jos kaatuminen tapahtui ennen kuin sovellus tallensi ensimmäisen kopion. Siihen voi mennä enintään noin kymmenen sekuntia ensimmäisestä muutoksesta.

**Kopio on vioittunut.** Sovellus näyttää *Palautettua tiedostoa ei voitu lukea* ja syyn, ja tarjoaa muut projektit. Jos valitaan *Palauta*, sovellus poistaa jälkeenpäin kaikki kopiot, myös lukukelvottoman. Jos yhtäkään kopiota ei voi lukea, ikkuna ei tule näkyviin ja kopiot säilyvät.

**Palautus epäonnistuu.** Sovellus näyttää *Palautus epäonnistui* ja syyn. Kopiot säilyvät, ja kysymys tulee takaisin seuraavalla käynnistyksellä.

**Osa projekteista ei voi latautua.** Sovellus näyttää: *2 palautustiedostoa ei voitu ladata ja ne ohitettiin.* Yhdestä tiedostosta se sanoo *1 palautustiedostoa ei voitu ladata ja se ohitettiin.* Muut projektit palautetaan. Koska jotakin ohitettiin, kaikki kopiot säilyvät, ja ikkuna tulee takaisin seuraavalla käynnistyksellä samalla listalla. Jos kaikki mahdollinen on jo palautettu, valitaan *Älä palauta*.

## Katso myös

- [Tiedostot ja muodot](docs://uitleg-bestanden): tallentaminen, automaattitallennus ja palautus rinnakkain.
- [Automaattitallennuksen käyttöönotto](docs://howto-automatisch-opslaan): sovelluksen annetaan päivittää tiedosto itse.
- [Tiedoston avaaminen ja tallentaminen](docs://howto-bestand-openen-en-opslaan): tallentaminen palauttamisen jälkeen.
- [Tallennetut päivämäärät](docs://uitleg-datums-zoals-opgeslagen): mitä projektille tapahtuu tässä näkymässä.

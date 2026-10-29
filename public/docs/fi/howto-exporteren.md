# Vieminen

Tavoite: aikataulu siirretään tiedostona toisessa muodossa henkilölle, joka ei lue IFC:tä, tai toiselle ohjelmalle.

## Milloin tätä tarvitaan

Konsultti työskentelee MS Project -ohjelmassa. Asiakas käyttää Primaveraa. Aliurakoitsija haluaa tehtävät Excelissä. Aikataulu lähetetään ohjelmalle, joka ei käsittele IFC:tä. Vienti on kopio toisessa muodossa. Jos projekti itse halutaan säilyttää, tallennetaan se: silloin kirjoitetaan IFC-muodossa ja kaikki tieto tulee mukaan. Mitä kukin muoto kantaa ja mitä ei, kerrotaan kohdassa [Tiedostot ja muodot](docs://uitleg-bestanden).

## Vaiheet

1. Valitse *Aloitus › Tiedosto › Vie* ja valitse muoto luettelosta, tai valitse *Tiedosto › Vie*. Siellä jokainen muoto on kortti, jossa on lyhyt kuvaus.
2. Valitse ikkunassa nimi ja paikka. Sovellus ehdottaa projektin nimeä ja muodon tiedostopäätettä. Edistymistaulukot ovat nimeltään *projektinnimi-voortgang* ja ne avautuvat lataukset-kansioon, jos se on mahdollista.
3. Vahvista vienti. Jos vienti onnistuu, ei näy viestiä. Poikkeuksena ovat alla olevat viestit. Kohdasta *Tiedosto › Vie* palataan sen jälkeen välilehdelle *Aloitus*, vaikka ikkuna peruttaisiin. Jos ikkuna peruutetaan viennissä, joka on valittu välilehden *Aloitus* luettelosta, ei tapahdu mitään.

Jos selain tallentaa vain latauksena (kuten Firefox), tiedosto on lataukset-kansiossa heti vaiheen 1 jälkeen. Näkyviin tulee viesti *Tallennettu latauksena: 'name.xml' on nyt lataukset-kansiossa. Tämä ympäristö ei salli sovelluksen kirjoittaa suoraan valittuun paikkaan.*

### Mikä muoto valitaan?

Välilehden *Aloitus* luettelo ja kortit kohdassa *Tiedosto › Vie* tarjoavat samat muodot:

- *Edistyminen (Excel)* ja *Edistyminen (CSV)*, kortit *Edistymistaulukko (Excel)* ja *Edistymistaulukko (CSV)*: kevyt taulukko, jossa ovat tunnus, WBS, nimi, päivämäärät ja valmiusaste. Se lähetetään eteenpäin sille, joka täyttää edistymisen.
- *CSV (;)*, kortilla *CSV (puolipisteillä erotettu)*: tehtävätaulukko, joka avataan laskentataulukossa.
- *MS Project XML*: voidaan avata Microsoft Project -ohjelmassa.
- *Primavera P6 XML*: Oracle Primavera P6 -ohjelmalle.
- *IFC*: sovelluksen oma muoto, jossa on kaikki tieto projektin IFC-skeemassa (oletus IFC 4.3 ADD2).

### IFC-vienti kirjastotiedoston kanssa

Jos projekti on yhdistetty kirjastoon, valintaruutu *Tallenna kirjastotiedosto rinnalle* on korttien alapuolella kohdassa *Tiedosto › Vie*. Jos valintaruutu valitaan ja valitaan *IFC*, sovellus kysyy paikkaa kahdesti: ensin projektille ja sitten tiedostolle *projektinnimi-bibliotheek.ifc*. Tämä valintaruutu on vain kohdassa *Tiedosto › Vie*, ei välilehden *Aloitus* luettelossa.

### Täytetyn edistymistaulukon lukeminen

Täytetty edistymistaulukko luetaan takaisin kohdasta *Tiedosto › Tuo*. Katso [Edistymisen tuominen laskentataulukosta](docs://howto-voortgang-importeren).

## Valkuilut ja mitä sovellus silloin tekee

**Projektia ei muuteta.** Projektin tiedosto pysyy samana, ja merkki *Tallentamaton* säilyy, jos se oli näkyvissä.

**Vanhentunut aikataulu lasketaan uudelleen ensin.** Näin saadaan nykyiset päivämäärät, vaikka painiketta *Laske* ei ole painettu.

**Vienti näkyy myös kohdassa Viimeisimmät.** Tämä ei koske edistymistaulukoita. Jos vienti avataan sieltä, se avautuu kyseisen muodon tuontina.

**Vienti ei kanna kaikkea.** CSV-tiedostossa eivät ole resurssit eivätkä rajoitteet, ja P6 XML:ssä eivät ole perustasot eivätkä tavoitepäivät. Myöskään laskentaprofiilia ei viedä mukana: uudelleen avattu vienti lasketaan profiilin *Open Planner Studio* mukaan. Vain IFC kantaa kaiken. Esimerkin, jossa on lukuja, löytyy kohdasta [Tiedostot ja muodot](docs://uitleg-bestanden).

**Kaksi muotoa samalla tiedostopäätteellä.** MS Project XML ja Primavera P6 XML saavat molemmat nimen *projektinnimi.xml*. Anna niille itse eri nimet, muuten ei myöhemmin tiedetä, mikä tiedosto on mikäkin muoto.

**Aikataulua, jossa on kehäriippuvuus, ei viedä.** Sovellus laskee aikataulun ensin ja pysähtyy, jos silmukka on. Välilehdellä *Aloitus* tulee viesti *Aikataulua ei voitu laskea*, ja sen alla esimerkiksi *Kehäriippuvuus tehtävien välillä: Set up site → Demolish existing extension → Set up site*. Kohdassa *Tiedosto › Vie* sivulla on vain tuo jälkimmäinen teksti. Poista silmukka ja vie uudelleen.

**Primaverasta tuotu projekti menettää lähdetiedot.** Jos tällainen projekti viedään CSV-, MS Project XML- tai P6 XML -muotoon, sovellus näyttää viestin: *Vienti muotoon CSV menettää XER-lähdetiedot.* Kohdassa MS Project XML se sanoo *MSPDI*, kohdassa P6 XML *P6*. Katso [Primavera P6 -tiedoston (.xer) avaaminen](docs://howto-xer-openen).

**Jaetut tehtävät menettävät jakonsa.** MS Project ja Primavera tuntevat jaon vain tuntien jakautumisena. Jos projektissa on jaettuja tehtäviä ilman tuntien jakautumista, sovellus näyttää viennin jälkeen muotoon MS Project XML tai P6 XML viestin: *2 tehtävää, joissa on taukoja, vietiin ilman taukoja: MS Project ja P6 tuntevat tauot vain työn jakautumisena.* Yhdelle tehtävälle se sanoo *1 tehtävä, jossa on taukoja, vietiin ilman taukoja: MS Project ja P6 tuntevat tauot vain työn jakautumisena.* Katso [Tehtävän jakaminen](docs://howto-taak-splitsen).

**Aikataulu näkymässä *Tallennetut päivämäärät*.** Jos viedään CSV-muotoon, kun lähdetiedoston päivämäärät näkyvät, sovellus jättää kentät `Critical` ja `Total Float` tyhjiksi niille tehtäville, joiden osalta lähdetiedosto ei ollut tallentanut tätä tietoa. Katso [Tallennetut päivämäärät](docs://uitleg-datums-zoals-opgeslagen).

## Katso myös

- [Tiedostot ja muodot](docs://uitleg-bestanden): mitä kukin muoto kantaa ja mitä ei.
- [Tiedoston avaaminen ja tallentaminen](docs://howto-bestand-openen-en-opslaan): projektin säilyttäminen IFC-muodossa.
- [Edistymisen tuominen laskentataulukosta](docs://howto-voortgang-importeren): täytetyn edistymistaulukon lukeminen sovellukseen.
- [Tuonti- ja vientimuodot](docs://ref-import-exportformaten): muodoittain, mikä siirtyy mukana ja mikä ei.

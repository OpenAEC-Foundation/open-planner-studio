# Aikajakson valitseminen

Tavoite: päätä, mitä ajanjaksoa raportti kattaa, esimerkiksi seuraavat neljä viikkoa tai kesäkuu.

## When you need this

Viikkokokous haluaa tietää, mitä tapahtuu seuraavien neljän viikon aikana. Kuukausiraportti kattaa kesäkuun. Ilman aikajaksoa tulostuu koko aikataulu. Siksi viisi raporttia käyttää valintaa *Aikajakso:*: *Look-ahead*, *Edistymisraportti*, *Resurssikuormitus*, *Resurssikohdistukset* ja *Resurssikaavio*. Muilla raporteilla ei ole aikajaksoa.

Aikajakso ei ole sidottu kalenterikuukauteen, vaan **viitepäivään**: projektin raportointipäivään (päivään, jolloin edistys mitataan, katso [Edistyminen, raportointipäivä ja perustaso](docs://uitleg-voortgang)), tai tänään, jos projektilla ei ole raportointipäivää. *Seuraavat 4 viikkoa* lasketaan tästä päivästä. Jos raportointipäivää siirretään, aikajakso siirtyy sen mukana.

## Vaiheet

### 1. Aseta raportointipäivä

Jos käytetään suhteellista valintaa, kuten *Seuraavat 4 viikkoa* tai *Edellinen kuukausi*, aseta ensin raportointipäivä. Valitse *Aikataulu › Perustasot ja edistyminen* ja täytä kenttä *Raportointipäivä*. Ruksilla sen vieressä (*Tyhjennä raportointipäivä*) päivä poistetaan uudelleen. Jos käytetään kiinteää aikajaksoa (vaihe 4), tätä ei tarvita.

### 2. Valitse raportti, jossa on aikajakso

Avaa *Raportti*-välilehti ja valitse yksi viidestä raportista kohdasta *Raporttityyppi*. Luettelo *Aikajakso:* on kohdassa *Raporttivalinnat*. Raportissa *Resurssikaavio* se on kohdassa *Asetukset*, neljän kyseisen raportin valintaruudun alla.

Jokainen raportti muistaa oman aikajaksonsa. Nämä ovat alkuarvot:

- *Look-ahead*: *Seuraava kuukausi*.
- *Edistymisraportti*: *Edellinen kuukausi*.
- *Resurssikuormitus*, *Resurssikohdistukset* ja *Resurssikaavio*: *Koko projekti*.

### 3. Valitse aikajakso luettelosta

Luettelossa ovat *Seuraava viikko*, *Seuraavat 2 viikkoa*, *Seuraavat 4 viikkoa*, *Seuraavat 6 viikkoa*, *Seuraavat 8 viikkoa*, *Seuraavat 12 viikkoa*, *Seuraava kuukausi*, samat seitsemän *edellisinä*, *Koko projekti* ja *Mukautettu*. Alla ovat *Alkaen* ja *Asti*, päivämäärät, jotka valinta antaa. Niitä voi vain lukea täällä.

Molemmat päivät kuuluvat jaksoon. Jos raportointipäivä on torstai 20. toukokuuta, *Seuraava viikko* kestää 20.–26. toukokuuta mukaan lukien ja *Seuraavat 4 viikkoa* 20. toukokuuta – 16. kesäkuuta mukaan lukien (28 päivää). *Seuraava kuukausi* päättyy yhtä päivää ennen samaa päivää seuraavassa kuussa, tässä tapauksessa 19. kesäkuuta mukaan lukien. *Edelliset 2 viikkoa* kestää 7.–20. toukokuuta mukaan lukien.

*Koko projekti* ottaa aikataulun ensimmäisestä alkamispäivästä viimeiseen loppupäivään.

### 4. Tai valitse Mukautettu

Kun valitaan *Mukautettu*, *Alkaen* ja *Asti* muuttuvat kahdeksi päivämääräkentäksi. Ne alkavat päivämääristä, jotka juuri ennen tehty valinta antoi. Täytä molemmat, esimerkiksi 1. ja 14. kesäkuuta. Jos syöte ei ole oikein, raportti pysyy viimeisessä kelvollisessa aikajaksossa ja näyttää punaisella:

- *Loppupäivä on ennen alkamispäivää.* jos *Asti* on aikaisempi kuin *Alkaen*.
- *Täytä molemmat päivämäärät.* jos toinen kentistä on tyhjä.

### 5. Lue aikajakso raportista

Raporteissa *Look-ahead*, *Resurssikuormitus* ja *Resurssikohdistukset* aikajakso näkyy otsikon alla, esimerkiksi *Aikajakso: 20-05-2027 – 19-06-2027*. Jos valitaan *Koko projekti*, päivämäärien perään lisätään *Koko projekti*. *Edistymisraportti* näyttää aikajakson yhteenvedossa kohdassa *Aikajakso*. Raportissa *Resurssikaavio* aika-akseli kattaa tarkalleen aikajakson.

### Mitä aikajakso tekee kussakin raportissa

Aikajakso ei toimi joka raportissa samalla tavalla.

- **Look-ahead** ottaa mukaan keskeneräiset tehtävät, jotka osuvat aikajaksoon, myös jos ne kestävät koko aikajakson. Myös myöhässä olevat tehtävät ennen raportointipäivää sisältyvät, kunhan aikajakson loppu ei ole ennen raportointipäivää. Kokonaan menneisyydessä oleva mukautettu aikajakso katsoo taaksepäin: se näyttää vain sen, mikä oli silloin käynnissä ja on yhä kesken, ilman tähän päivään asti myöhässä olevia tehtäviä.
- **Edistymisraportti** käyttää aikajaksoa kohdassa *Valmistunut edellisellä aikajaksolla*. Kohta *Alkaa seuraavalla aikajaksolla* katsoo eteenpäin raportointipäivästä alkaen, päivämäärään asti, joka on yhteenvedossa kohdassa *Ennakkonäkymä asti*. Jos valitaan *edellinen* aikajakso, raportti katsoo eteenpäin yhtä pitkälle kuin taaksepäin: valinnalla *Edelliset 2 viikkoa* ja raportointipäivällä 20. toukokuuta se näyttää *Ennakkonäkymä asti* 3. kesäkuuta. Kokonaan menneisyydessä oleva mukautettu aikajakso tai *Koko projekti* ei peilaudu.
- **Resurssikuormitus** näyttää kokonaisina jokaisen viikon tai kuukauden, joka osuu aikajaksoon. Jos aikajakso kulkee keskiviikosta keskiviikkoon, nähdään siis kokonaisia viikkoja. Rivi näyttää siten aina saman luvun kuin histogrammi.
- **Resurssikohdistukset** näyttää niiden tehtävien resurssikohdistukset, jotka osuvat aikajaksoon. Kun valitaan *Koko projekti*, päivämäärän mukaan ei suodateta.
- **Resurssikaavio** näyttää vain tehtävät, jotka osuvat aikajaksoon. Yhteenvedossa *Aikajakson ulkopuolella:* lasketaan, kuinka monta tehtävää jätettiin pois.

## Sudenkuopat ja mitä sovellus tekee

**Raportointipäivää ei ole.** Sovellus käyttää silloin tänään. Neljän taulukkoraportin kohdalla, joissa on aikajakso (*Look-ahead*, *Edistymisraportti*, *Resurssikuormitus* ja *Resurssikohdistukset*), näytetään yläreunassa suhteellisella valinnalla *Raportointipäivää ei ole asetettu — raportti laskee tänään (29-09-2026).* Päivämäärä on tämän päivän päivämäärä. *Resurssikaavio* ei näytä tätä. Katso siksi kohtaa *Alkaen* ja *Asti*: ne ovat silloin lähellä tätä päivää, eivät aikataulun ympärillä.

**Aikajakso on aikataulun ulkopuolella.** Silloin raportti on tyhjä. *Resurssikaavio* näyttää tästä viestin *Ei tehtäviä aikajaksolla — valitse toinen aikajakso tai Koko projekti.* (luettelossa tämä valinta on nimeltään *Koko projekti*). Muissa raporteissa näkyy nolla tehtävää tai ei yhtään riviä.

**Päivämäärät näkyvät asetusten muodossa.** *Alkaen* ja *Asti* noudattavat asetuksissa valittua päivämäärämuotoa. Poikkeus ovat kentät, jotka näkyvät valinnalla *Mukautettu*: ne näyttävät selaimen muodon.

**Aikajakso liikkuu mukana.** Suhteellinen valinta, kuten *Seuraava kuukausi*, määritetään joka kerta uudelleen. Jos raportointipäivä muuttuu, tai jos raportointipäivää ei ole ja seuraava päivä alkaa, aikajakso liikkuu heti mukana. Kiinteää aikajaksoa varten valitse *Mukautettu*.

**Valinta koskee kaikkia projekteja.** Mukautettu aikajakso koskee myös kaikkia tämän laitteen projekteja, ei vain avoinna olevaa projektia.

## Katso myös

- [Raportin tekeminen ja tulostaminen](docs://howto-rapport-maken-en-afdrukken): koko reitti raporttityypistä PDF-tiedostoon.
- [Edistyminen, raportointipäivä ja perustaso](docs://uitleg-voortgang): mikä raportointipäivä on ja miksi sovellus laskee sen avulla.
- [Ylikuormituksen ratkaiseminen](docs://howto-overbezetting-oplossen): mitä tehdään viikoilla, jotka näkyvät raportissa *Resurssikuormitus*.
- [Raporttityypit](docs://ref-rapporttypes): kaikki raporttityypit ja niiden valinnat.

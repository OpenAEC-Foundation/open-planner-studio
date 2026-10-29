# Käyttöasteen näkymän käyttö

Tavoite: nähdä, minä päivinä kaksi tai useampi avoin projekti yhdessä tarvitsee enemmän resurssia kuin kirjastossa on.

## Milloin tätä tarvitaan

Muurariryhmä työskentelee yhdessä projektissa julkisivuissa ja toisessa autotalleissa. Jokaisessa projektissa muurariryhmä näyttää olevan siististi suunniteltu, koska projektin histogrammi ja ylikuormitus tarkastelevat vain sitä yhtä projektia. Vasta kun projektit asetetaan rinnakkain, käy ilmi, että samoina päivinä ne yhdessä tarvitsevat enemmän muurareita kuin niitä on. Käyttöasteen näkymä tekee tämän rinnakkain asettamisen.

Näkymä laskee vain resursseja, jotka tulevat resurssikirjastosta, ja vain projekteista, jotka on liitetty samaan kirjastoon. Miten tämä lasketaan, kuvataan kohdassa [Resurssikirjasto](docs://uitleg-resourcebibliotheek).

## Vaiheet

### 1. Valmistele projektit

1. Avaa projektit, jotka haluat verrata, kukin omassa välilehdessä. Katso [Useiden projektien käyttö samaan aikaan](docs://howto-meerdere-projecten). Näkymä näkee vain projektit, jotka ovat auki tässä sovelluksessa.
2. Liitä jokainen projekti samaan kirjastoon ja käytä kirjaston resurssia jokaisessa projektissa. Ilman kirjastoliitosta resurssipaneeli ei näytä näkymää. Katso [Resurssikirjaston käyttö](docs://howto-resourcebibliotheek-gebruiken).
3. Laske projektit komennolla *Laske* (F5) tai ota käyttöön *Laske automaattisesti*. Mitä näkymä tekee vanhentuneille projekteille, kuvataan alla olevissa sudenkuopissa.

### 2. Avaa näkymä

1. Siirry johonkin projektiin ja valitse *Resurssit › Hallinta › Resurssit*.
2. Valitse oikeasta yläkulmasta *Käyttöaste*. Näkymä kuuluu sen projektin kirjastoon, jossa olet. Tässä paneelissa ei voi muuttaa mitään: se on vain luku -ikkuna.

### 3. Lue taulukko

Jokainen kirjaston resurssi, joka on varattu vähintään yhteen avoimeen projektiin, saa rivin. Resursseja ilman varausta ei listata. Eniten ylikuormitettuja päiviä sisältävät rivit ovat ylimpänä, sen jälkeen aakkosjärjestyksessä.

- *Dokumentit* kertoo, monessako projektissa resurssi on varattu, esimerkiksi *2 dokumenttia*.
- *Aikajakso* kulkee ensimmäisestä viimeiseen päivään, jolla on kuormaa. Päivät kirjoitetaan muodossa vvvv-kk-pp, esimerkiksi *2027-06-07 – 2027-06-14*.
- *Huippu / Kapasiteetti* näyttää kaikkien projektien yhteisen suurimman päivittäisen kuorman verrattuna kirjaston resurssin kapasiteettiin, esimerkiksi *4.0 / 3.0*. Jos on vähintään yksi ylikuormitettu päivä, se näkyy punaisena.
- Rivin perässä oleva punainen merkki, esimerkiksi *3 päivää ylikuormitettu*, laskee päivät, joina summa on suurempi kuin kapasiteetti. Kun viet hiiren sen päälle, näet päivämäärät.

### 4. Katso projekteittain

1. Napsauta resurssin nimen edessä olevaa pientä nuolta. Rivi avautuu.
2. Ylhäällä ovat ylikuormitetut päivämäärät: ensin viisi, ja jos niitä on enemmän, *… ja 3 muuta*. Sen alla on projektikohtaisesti projektin nimi, aikajakso ja kyseisen projektin huippu, esimerkiksi *Houses North 2027-06-07 – 2027-06-11 Huippu: 2.0*.
3. Napsauta rivin itseään, jolloin alareunaan tulee histogrammi. Jokaisella projektilla on oma väri ja pylväät on pinottu. Katkoviiva on kirjaston kapasiteetti. Jos se muuttuu ajan myötä, näet portaita. Ylikuormitetut päivät saavat punaisen nauhan pylväiden taakse. Napsauta riviä uudelleen, jolloin histogrammi sulkeutuu. Ilman valittua riviä lukee *Valitse resurssi, jotta histogrammi näkyy.*

### 5. Ratkaise tilanne

Näkymä näyttää ongelman, mutta ei ratkaise sitä. Vaihtoehtoja on kaksi:

- Siirrä tehtävää yhdessä projektissa tai anna sille vähemmän kuormitusastetta päivässä. Paina sitten F5 kyseisessä projektissa, jolloin se lasketaan uudelleen.
- Jos joku todella liittyy mukaan, nosta kirjaston resurssin arvoa *Enimmäismäärä*. Se tehdään kohdassa *Resurssit › Hallinta › Resurssit*, näkymässä *Kirjasto*.

*Tasaa…* valintanauhassa ei auta tässä: se tarkastelee vain sen yhden projektin resursseja, jossa olet. Katso [Resurssien tasaaminen](docs://uitleg-nivelleren).

## Sudenkuopat ja mitä sovellus silloin tekee

**Näkymä on tyhjä.** Siinä lukee *Avoimissa dokumenteissa ei ole varattuja kirjaston resursseja.* Silloin mikään avoin projekti ei ole määrittänyt kirjaston resurssia yhteenkään tehtävään.

**Painiketta *Käyttöaste* ei näy.** Projekti, jossa olet, ei ole liitetty kirjastoon.

**Projekti ei lasketa mukaan.** Se ei ole auki tässä sovelluksessa, se on liitetty toiseen kirjastoon tai siinä oleva resurssi on kyseisen projektin oma resurssi. Näkymän alareunassa lukee aina *Tämä näkymä näkee vain tässä sovelluksessa avatut dokumentit.* Myöskään kopio resurssista, joka on sittemmin poistettu kirjastosta, ei lasketa mukaan.

**Kopio tai muunnelma lasketaan kokonaan mukaan.** Jokainen avoin projekti, joka on liitetty kirjastoon, lasketaan mukaan, myös silloin kun se on toisen avoimen projektin kopio tai muunnelma, esimerkiksi tekoälyavustajan tekemä muunnelma komennolla `planner_duplicate_document`. Alkuperäinen ja muunnelma yhdessä voivat silloin näyttää ylikuormituksen, jota todellisuudessa on vain kerran. Näkymä ei suodata tätä hiljaa pois: sulje muunnelma hetkeksi tai jätä se huomiotta, kun luet näkymää.

**Projekti on vanhentunut.** Projekti on vanhentunut, jos aikataulua on muutettu laskematta sitä uudelleen. Näkymä käsittelee silloin projektia seuraavasti:

- Projektille, joka ei ole aktiivinen välilehti, näkymä laskee sen etukäteen itse, muuttamatta projektia. Taulukon yläpuolella lukee silloin *Muutetut dokumentit on laskettu etukäteen tätä näkymää varten. Paina F5 dokumentissa tai ota käyttöön “Laske automaattisesti”, jotta tämä tapahtuu aina.* Projektin jälkeen lukee *Laskettu etukäteen tätä näkymää varten — dokumentti itse näyttää vanhempia päivämääriä, kunnes siellä painetaan F5 tai otetaan käyttöön “Laske automaattisesti”.* Jos *Laske automaattisesti* on päällä (*Asetukset › Projekti › Asetukset*, välilehti *Aikataulu*), sovellus laskee tällaiset projektit oikeasti uudelleen heti, kun katsot näkymää, ja ilmoitus katoaa. Jos myös aktiivinen projekti on vanhentunut, taulukon yläpuolella näkyy sen sijaan seuraavan kohdan ilmoitus.
- Näkymä ei laske itse sitä projektia, jossa olet. Jos se on vanhentunut, näkymässä lukee *Muutettua dokumenttia ei ole vielä laskettu uudelleen. Se on mukana viimeksi lasketuin luvuin. Paina F5 siinä dokumentissa tai ota käyttöön “Laske automaattisesti”.* Projektin jälkeen lukee *Vanhentunut: nämä ovat viimeksi lasketut luvut — paina F5 tässä dokumentissa.* Huomio: *viimeksi lasketut luvut* ei ole aivan oikein. Näkymä ottaa vanhat alkamispäivät, mutta jo muutetun keston tai kuormituksen. Luvut voivat siksi poiketa sekä vanhasta että uudesta aikataulusta, eivätkä ne välttämättä vastaa Gantt-kaavion palkkeja. Luota niihin vasta F5-painalluksen jälkeen.
- Jos näkymä ei voi laskea projektia, esimerkiksi riippuvuuksien silmukan takia, projekti ei lasketa mukaan. Se näkyy silti listassa, merkintänä *Ei lasketa mukaan: aikataulua ei ole laskettu — aktivoi tämä dokumentti ja paina F5.* Taulukon yläpuolella lukee *Vähintään yksi dokumentti on laskematta, eikä se ole mukana käyttöasteessa.*

**Näkymä ei vastaa odotuksia.** Kapasiteetti tulee kirjastosta (kirjastokohteen *Enimmäismäärä* tai sen *Vaiheistettu kapasiteetti* kyseisenä päivänä), ei projektin kopion *Enimmäismäärästä*. Summa, joka on yhtä suuri kuin kapasiteetti, ei ole ylikuormitus.

## Katso myös

- [Resurssikirjasto](docs://uitleg-resourcebibliotheek): miten käyttöaste lasketaan, havainnollisen esimerkin avulla.
- [Resurssikirjaston käyttö](docs://howto-resourcebibliotheek-gebruiken): projektien liittäminen kirjastoon ja resurssien määrittäminen.
- [Ylikuormituksen ratkaiseminen](docs://howto-overbezetting-oplossen): ylikuormitus yhden projektin sisällä.

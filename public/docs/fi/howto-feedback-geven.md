# Palautteen antaminen

Tavoite: kertoa virheestä tai esittää ideaa suoraan sovelluksesta, tarvittaessa kuvakaappauksen kanssa.

## Milloin tarvitset tätä

Aikataulu laskee jotain, mitä et ymmärrä, painike ei tee sitä, mitä sen pitäisi, tai sovelluksesta puuttuu jotain. Hyvä ilmoitus auttaa tekijöitä löytämään ongelman. Siksi sovellus itse lisää raporttiin version, käyttöjärjestelmän ja kielen. Se, mitä kuvaat itse, ratkaisee, voivatko he tehdä sillä jotain: mitä teit, mitä odotit ja mitä tapahtui.

## Vaiheet

1. Napsauta ikkunan yläreunassa olevaa *Anna palautetta* -painiketta. Tämä painike on aina otsikkorivillä. Sen teksti vaihtuu kymmenen minuutin välein: *Anna palautetta*, *Tee virheraportti* tai *Lisää uusi ominaisuus*. Se on aina sama painike. *Anna palautetta* -ikkuna avautuu.
2. Valitse ilmoituksen tyyppi. *Jokin ei toimi* on virhettä varten: jokin ei toimi niin kuin pitäisi. *Idea* on tarkoitettu asioille, joita kaipaat tai haluaisit toisin. *Kysymys tai huomautus* on kaikkea muuta varten. *Jokin ei toimi* on oletuksena valittuna.
3. Täytä kenttä *Otsikko* ja sen jälkeen kenttä *Kuvaus*. Tyhjissä kentissä näkyy esimerkki: otsikossa esimerkiksi *Esim. Kriittinen polku siirtyy tallennuksen jälkeen*, ja kuvauksessa kysymys *Mitä tehtiin, mitä odotettiin ja mitä tapahtui?* Niin kauan kuin *Lähetä*-painike on harmaa, sen vieressä oleva harmaa rivi kertoo syyn. Esimerkiksi *Anna otsikko.* tai että otsikossa ja kuvauksessa on kirjoitettava yhteensä vähintään 10 merkkiä.
4. Jos haluat vastauksen, täytä kenttä *Sähköpostiosoite*. Tämä kenttä on valinnainen. Sovellus muistaa osoitteen onnistuneen ilmoituksen jälkeen, joten se on jo määritetty seuraavalla kerralla.
5. Jos haluat näyttää jotakin, ota käyttöön *Liitä kuvakaappaus*. Sovellus ottaa sen jälkeen kuvan sovelluksesta ilman tätä ikkunaa. Hetken kuluttua näkyy pieni esikatselu, jonka vieressä on kolme painiketta: *Merkitse*, *Ota uudelleen* ja *Poista*.
6. *Merkitse* avaa muokkaimen. Muokkaimella kuvaan lisätään nuolia, suorakulmioita, vapaita viivoja ja tekstiä. Painikkeella *Peitä* piirretään musta alue kohteen päälle, joka ei saa mennä mukaan, esimerkiksi nimen tai summan. Tämä kohta poistuu silloin todella kuvasta, jonka sovellus lähettää. Väri valitaan itse. Viimeisen toiminnon voi peruuttaa painikkeella *Kumoa* tai aloittaa alusta painikkeella *Tyhjennä kaikki*. Muutokset säilyvät, kun valitaan *Tehty*. Ne hylätään valitsemalla *Peruuta* tai painamalla Esc.
7. *Ota uudelleen* ottaa uuden kuvakaappauksen ja tyhjentää merkinnät. *Poista* poistaa kuvakaappauksen ja poistaa valinnan valintaruudusta.
8. Katso lomakkeen alla olevaa harmaata riviä *Mukana*. Se näyttää, mitä sovellus lähettää mukana automaattisesti: version, käyttöjärjestelmän ja kielen. Esimerkiksi *Mukana: v2026.10.1 · Windows · English*.
9. Napsauta *Lähetä*-painiketta. Lähetyksen aikana painikkeessa lukee *Lähetetään…*.
10. Näkyviin tulee *Kiitos, ilmoitus on lähetetty.* Jos ilmoitukselle luotiin GitHubissa ongelma, näkyy myös painike *Näytä GitHubissa*. Napsauta *Sulje*-painiketta.

## Minne ilmoituksesi menee

Sovellus lähettää ilmoituksesi OpenAECin Open Feedback Studiolle. Tähän ei tarvita tiliä, ei myöskään GitHubissa. Tekijät näkevät ilmoituksesi yleiskatsauksessaan. Jos sovellus on siellä yhdistetty GitHubiin, Open Feedback Studio muuttaa ilmoituksen myös julkiseksi GitHub-ongelmaksi. Jos valitaan *Jokin ei toimi*, ongelmalle annetaan tunniste *bug*. Jos valitaan *Idea*, tunniste on *enhancement*. Kuvauksen alla on silloin rivi, jossa ovat Open Planner Studion versio, käyttöjärjestelmä ja sovelluksen kieli.

## Sudenkuopat ja mitä sovellus silloin tekee

**Ilmoituksesi voi tulla julkiseksi.** Älä kirjoita siihen mitään, mitä et halua jakaa. Sama koskee kuvakaappausta: kuvassa näkyy kaikki, mikä sovelluksessa on silloin näkyvissä, esimerkiksi projektisi tehtävien nimet ja resurssit. Sovellus ottaa kuvakaappauksen sillä hetkellä, kun *Liitä kuvakaappaus* otetaan käyttöön. Jos näyttö ei ole vielä oikein, sulje ikkuna, aseta näyttö oikeaksi, avaa ikkuna uudelleen ja napsauta *Ota uudelleen*. Peitä, mitä et halua näyttää, painikkeella *Peitä*.

**Kuvakaappaus on liian suuri.** Sovellus pienentää kuvakaappauksen ennen lähettämistä. Jos se on sen jälkeenkin liian suuri, ilmoitus lähtee ilman kuvaa. Kiitosnäytössä lukee silloin *Kuvakaappaus oli liian suuri, eikä sitä lähetetty mukaan.*

**Lähettäminen ei onnistu.** Ikkunassa näkyy viesti, ja teksti jää paikalleen. Silloin on neljä tapausta:

- *Ilmoitusta ei hyväksytty.* Tarkista teksti ja sähköpostiosoite. Ilmoitus, joka koostuu lähes kokonaan linkeistä, hylätään.
- *Olet lähettänyt monta ilmoitusta lyhyessä ajassa.* Yritä uudelleen tunnin kuluttua.
- *Lähettäminen epäonnistui.* Yhteyttä ei ole tai palvelin ei vastaa. Yritä uudelleen tai napsauta *Avaa GitHubissa*. Tätä painiketta ei ole, jos edellinen yritys jäi epävarmaksi (katso alla).
- *Emme ole varmoja, onko ilmoitus tullut perille. Odota minuutti ja lähetä se sitten uudelleen; jos se on jo perillä, huomaamme sen itsestään.* Yhteys katkesi sen jälkeen, kun sovellus oli lähettänyt ilmoituksesi. Teksti jää paikalleen. Painiketta *Avaa GitHubissa* ei ole, koska ilmoituksesi voi vielä tulla perille. Tilanne pysyy tällaisena, kunnes ilmoitus on lähetetty tai vastaanotettu jo aiemmin, myös jos suljet ikkunan välissä ja avaat sen uudelleen.

**Ilmoitus on jo vastaanotettu.** Jos lähetät ilmoituksen, joka on jo perillä, lomakkeen yläpuolelle tulee tämä teksti: *Tämä ilmoitus on jo meillä. Halutaanko lisätä jotakin? Muokkaa silloin tekstiä ja lähetä se uudelleen.* Teksti jää paikalleen ja sähköpostiosoite muistetaan. Napsauta *Sulje*-painiketta, jos et halua lisätä mitään; lomake on seuraavalla kerralla tyhjä. Jos kirjoitat jotakin lisää, viesti katoaa ja voit lähettää uudelleen. Painike on silloin taas nimeltään *Tallenna ja sulje*, ja tekstisi säilyy.

**Avaa GitHubissa.** Tämä on tie ilman Open Feedback Studiota. Siihen tarvitset GitHub-tilin. Ilman kuvakaappausta GitHubin sivu, jolla uusi ongelma luodaan, aukeaa heti selaimessa, ja otsikko ja kuvaus ovat jo täytettyinä. Kuvakaappauksen kanssa näet ensin ilmoituksen *Melkein tehty — kuvakaappaus on leikepöydällä.*, jossa on neljä vaihetta. Napsauta *OK, siirry GitHubiin*, napsauta ongelmasivun suurta tekstikenttää ja paina Ctrl+V (Macissa Cmd+V). Napsauta sitten alareunassa *Lähetä uusi ongelma*. Vasta sen jälkeen ilmoituksesi lähtee.

**Liittäminen ei onnistu.** GitHub-tiellä kuvakaappaus tallennetaan myös tiedostona tietokoneelle. Työpöytäsovelluksessa ikkunassa mainitaan polku: *Eikö liittäminen onnistu? Tallensimme kuvakaappauksen myös polkuun* tuo polku *— vedä tiedosto tekstialueeseen.* Selaimessa sovellus lataa kuvan nimellä `feedback-` ja numero sekä tiedostopääte `.png`. Löydät sen lataustiedostojen kansiosta ja vedät sen tekstialueeseen.

**Kuvakaappaus epäonnistuu.** Ikkunassa lukee *Kuvakaappauksen ottaminen epäonnistui. Palautteen voi silti lähettää ilman kuvakaappausta.* Valintaruudun valinta poistuu, ja ilmoituksen voi lähettää ilman kuvaa.

**Suljet ikkunan ennen lähettämistä.** Jos lomakkeessa on jotakin, ikkunan alareunan painike on nimeltään *Tallenna ja sulje*. Jos lomake on tyhjä, painike on nimeltään *Sulje*. *Tallenna ja sulje*, rasti ja Esc sulkevat ikkunan, ja ilmoitus säilyy luonnoksena, kunnes se lähetetään tai napsautetaan *Tyhjennä*. Kun avaat ikkunan uudelleen, tyyppi, teksti, sähköpostiosoite ja merkinnöillä varustettu kuvakaappaus ovat yhä tallella. Luonnos säilyy niin kauan kuin sovellus on auki; kun sovelluksen sulkee, luonnos katoaa. Onnistuneen ilmoituksen jälkeen lomake on taas tyhjä. Jos lomake halutaan tyhjentää itse, napsauta *Tyhjennä* ikkunan vasemmassa alakulmassa. Napsautus ikkunan ulkopuolella ei sulje sitä. Lähetyksen aikana Esc ei sulje ikkunaa.

## Katso myös

- [Sovelluksen päivittäminen](docs://howto-app-bijwerken): tarkista ennen raportin lähettämistä, onko käytössä uusin versio.

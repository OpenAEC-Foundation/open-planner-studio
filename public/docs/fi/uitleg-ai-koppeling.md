# Miten AI-linkki toimii

Mitä tapahtuu, kun tekoälyavustaja työskentelee aikataulussa? Tässä artikkelissa kerrotaan, mikä linkki on ja miksi se eroaa tiedoston vaihtamisesta. Lisäksi kerrotaan, mitkä rajoitukset sovellus itse valvoo ja miten tekoälyavustaja saa tietää, miten aikataulu rakennetaan. Esimerkki lopussa näyttää lukuina, mitä avustaja voi tehdä kerralla ja mitä siitä palautuu takaisin.

## Käsite

Tekoälyavustaja, esimerkiksi chat-ohjelma tai ohjelmointiavustaja, voi käyttää toista ohjelmaa **Model Context Protocol** (MCP) -protokollan kautta. Open Planner Studio toimii tässä vaihdossa palvelimena. Työpöytäsovellus käynnistää omalle tietokoneelle pienen palvelimen, **sillan**. Tekoälyavustaja yhdistyy siihen ja saa luettelon **työkaluja**. Työkalut ovat välineitä, joiden nimi alkaa tekstillä `planner_`, esimerkiksi tehtävien lukeminen, riippuvuuden lisääminen tai perustason tallentaminen. Mitkä työkalut on olemassa, kerrotaan kohdassa [AI-työkalut](docs://ref-ai-tools).

Merkittävintä on, että tekoälyavustaja työskentelee projektissa, joka on juuri auki, eikä kopiossa. Mitään ei tarvitse viedä eikä tuoda. Ei ole hetkeä, jolloin käyttäjä ja tekoälyavustaja katsovat kahta eri versiota. Tehtävä, jonka tekoälyavustaja lisää, näkyy Gantt-kaaviossa heti. Sovellus ottaa tämän huomioon: tekoälyavustaja käyttää samaa laskentaa, samaa kumoushistoriaa ja samoja sääntöjä kuin käyttäjä.

Miten linkki käynnistetään, kerrotaan kohdassa [Tekoälyavustajan yhdistäminen (MCP)](docs://howto-ai-assistent-koppelen). Alla kerrotaan, miten se toimii.

## Miten sovellus sen hoitaa

### Palvelin, jonka kuulee vain oma tietokone

Silta kuuntelee vain omaa tietokonetta (`127.0.0.1`) yhdellä portilla, oletuksena 3877. Se hyväksyy pyynnöt vain osoitteessa `/mcp`. Lisäksi pyynnön otsakkeessa `Authorization: Bearer` on oltava kelvollinen **tunnus**. Pyyntö ilman kelvollista tunnusta hylätään. Selaimesta tuleva pyyntö, jonka tunnistaa `Origin`-otsake, hylätään myös. Näin avoinna oleva verkkosivu ei voi puhua aikatauluun. Silta käsittelee pyynnöt tiukasti yksi kerrallaan.

Kytkentä on tavallista HTTP:tä omalla tietokoneella; sovellus itse ei lähetä mitään ulos. Mitä tekoälyavustaja tekee lukemallaan aikataululla, esimerkiksi mitä sen palveluntarjoaja sillä tekee, on tekoälyavustajan vastuulla eikä kuulu sovellukseen.

### Tekoälyavustaja työskentelee yhdessä asiakirjassa

Tekoälyavustajan ensimmäisen muutoksen yhteydessä silta sitoo kytkennän siihen asiakirjaan, joka on silloin aktiivinen. Jos välilehteä vaihdetaan itse myöhemmin, sovellus hylkää tekoälyavustajan seuraavan muutoksen (koodi `DOC_DRIFT`). Hylkäys jatkuu, kunnes tekoälyavustaja vahvistaa komennolla `planner_switch_document`, mihin asiakirjaan se haluaa työskennellä. Näin mikään ei päädy väärään projektiin. Tekoälyavustaja, joka avaa tai kopioi asiakirjan itse, työskentelee sen jälkeen uudessa asiakirjassa.

### Jokainen muutos laskee uudelleen

Sovelluksessa aikataulu tehdään käsin: muutos tehdään, ja sen jälkeen painetaan painiketta *Laske* (F5), ellei *Laske automaattisesti* ole päällä. Tämä ei koske tekoälyavustajan muutosta. Jokainen tekoälyavustajan kirjoitustoimenpide kulkee yhden tapahtuman läpi. Jos projektin tiedot muuttuvat sen kautta, sovellus laskee lopuksi itse uudelleen, kerran komentosarjaa kohden. Lukutyökalu antaa aina ajantasaiset päivämäärät. Jos aikataulu ei ole ajan tasalla, esimerkiksi koska muutos on tehty käsin eikä painiketta *Laske* ole vielä painettu, lukutyökalu laskee ensin uudelleen. Yksi poikkeus on tämä: jos projekti on näkymässä *Kirjatut päivämäärät* (tuonnin jälkeen), lukutyökalu ei laske hiljaa uudelleen, koska se korvaisi nuo päivämäärät. Tekoälyavustaja saa silloin kirjatut päivämäärät ja ilmoituksen, että niitä ei ole laskettu uudelleen. Tekoälyavustajan oma muutos laskee aina uudelleen, silloinkin. Painiketta *Laske* ei tarvitse painaa tekoälyavustajan muutoksen jälkeen. Tekoälyavustaja lukee tuloksen, kuten projektin lopun ja kriittisen polun, takaisin lukutyökaluilla. Katso myös [Kirjatut päivämäärät](docs://uitleg-datums-zoals-opgeslagen).

### Komentosarja on yksi vaihe

Tekoälyavustaja voi lähettää sarjan vaiheita kokonaisena komennolla `planner_batch`. Komentosarjassa on enintään 100 vaihetta. Tämä antaa yhden kumousvaiheen, yhden laskennan ja yhden varmuuskopion. Jos yksi vaihe epäonnistuu rakenteellisesti, esimerkiksi tuntemattoman työkalun tai kehäriippuvuuden takia, sovellus kumoaa koko komentosarjan. Aikataulu ei koskaan jää puolitiehen. Yhden kohteen hylkäys suuressa erässä on lievempi: esimerkiksi yksi virheellinen edistymisrivi kahdestakymmenestä jää pois, ja muu tehdään. Hylkäykset näkyvät vastauksen alussa.

### Omat rajat

Neljä asetusta määritetään itse välilehdellä *AI*:

- *Keskeytä* ja *Vain luku* pitävät tekoälyavustajan kytkettynä, mutta hylkäävät jokaisen muutoksen. Lukeminen on edelleen mahdollista. Siihen kuuluu myös vanhentuneen aikataulun uudelleenlaskenta lukemisen yhteydessä. Ne ovat laskettuja kenttiä eikä projektitietoja. Siksi kumousvaihetta ei lisätä, eikä projektia merkitä muutetuksi. Jos muokkaus on kesken itse, esimerkiksi kun palkin vedetään tai kenttään kirjoitetaan, lukutyökalu ei laske uudelleen. Tekoälyavustaja saa silloin päivämäärät ennen muokkausta ja ilmoituksen, että ne ovat vanhentuneet.
- Avoin valintaikkuna estää kaiken. Jos esimerkiksi tehtävän valintaikkuna, asetukset, esitystila tai tervetuloikkuna on auki, sovellus hylkää myös lukemisen, koska käyttäjä on kesken manuaalisessa toimenpiteessä. Tekoälyavustaja saa virhekoodin `DIALOG_OPEN`. Viestissä mainitaan avoinna olevan asian sisäinen nimi, esimerkiksi `showTaskDialog` tehtävän valintaikkunalle.
- *Automaattinen varmuuskopio* kirjoittaa IFC-kopion ennen ensimmäistä muutosta kutakin asiakirjaa kohden. Jos varmuuskopiointi epäonnistuu, sovellus ei tee muutosta.
- *Toimintapaneeli* näyttää jokaisen kutsun, sen argumentit ja vastauksen.

Tämän lisäksi on käytössä tavallinen *Kumoa* (Ctrl+Z). Tekoälyavustaja jakaa tämän historian käyttäjän kanssa, ja sillä on itselläänkin työkalut `planner_undo` ja `planner_redo`.

### Mitä tekoälyavustaja ei voi tehdä

Silta on tarkoituksella kapeampi kuin sovellus. Sillä, mitä tekoälyavustaja ei voi tehdä, on yleensä yksi kolmesta syystä.

**Se ulottuu pidemmälle kuin projektiin.** Tekoälyavustaja ei voi muuttaa resurssikirjastoa. Kirjasto on yhteinen kaikille projekteille ja jää kumoushistorian ulkopuolelle. Yksi normaalihinnan muutos vaikuttaisi silloin projekteihin, jotka eivät edes ole auki. Kirjastosta tulevan resurssin nimi, tyyppi, kuvaus, normaalihinta ja mittayksikkö ovat kiinteitä, samoin kuin resurssipaneelissa. Mitä projekti päättää, jää tekoälyavustajalle: enimmäismäärä, saatavuus ajan kuluessa, kalenteri ja työryhmä. Se ei myöskään voi valita, mikä kalenteri on projektikalenteri. Se voi lukea laskentaprofiilin ja laskentavaihtoehdot, mutta ei muuttaa niitä. Se voi asettaa vain edistymistavan ja projektin oletuksen tehtävätyypille. Asetuksille, teemalle, kielelle, laajennuksille ja päivityksille ei ole työkaluja.

**Sitä ei voi luotettavasti tarkistaa.** Tekoälyavustaja ei voi asettaa riippumattoa, asettaa tehtävää käsin aikataulutettavaksi, asettaa toista rajoitetta, täyttää muistiinpanoja, värejä, tehtäväkoodeja, mukautettuja kenttiä tai ulkoisia riippuvuuksia, eikä se voi asettaa tasaamisviivettä käsin. Se ei myöskään valitse WBS:ää. Sovellus määrittää sen itse.

**Se koskee asiaa, josta käyttäjän on päätettävä itse.** Edistymistä kirjataan vain, jos raportointipäivä on asetettu. Tekoälyavustaja ei valitse sitä itse. Se on käyttäjän raportointipäivä. Jos tehtävä, jota ei ole vielä aloitettu, on suunniteltu alkamaan raportointipäivän jälkeen, tekoälyavustajan on annettava toteutunut alkamispäivä. Se lukee ja kirjoittaa tiedostoja vain käyttäjän kansiossa, ja se korvaa olemassa olevan tiedoston vain, jos pyytää sitä nimenomaan. Vienti ei ole *Tallenna*: projekti jää sovelluksessa tallentamattomaksi.

### Miten tekoälyavustaja tietää, miten suunnitellaan

Tekoälyavustaja, joka tuntee työkalut, voi silti rakentaa aikataulun, josta suunnittelija ei hyödy: tehtäviä ilman riippuvuuksia, kiinteä päivämäärä joka tehtävälle tai liian hienojakoinen rakenne. Sovellus antaa sille siksi kolme asiaa.

**Ydinsäännöt MCP-kättelyssä.** Kun kytkentä muodostetaan, silta lähettää lyhyen tekstin MCP-kättelyn kenttään `instructions`. Monet asiakasohjelmat lisäävät tekstin järjestelmäkehotteeseen, mutta se riippuu asiakasohjelmasta. Säännöt ovat seuraavat: aloita välitavoitteista ja toimituspäivästä, tee tehtävät noin päivän ja kahden viikon pituisiksi, ohjaa aikataulua riippuvuuksilla eikä kiinteillä päivämäärillä, käytä rajoitteita vain tiukkoihin ulkoisiin päivämääriin, korjaa ensin epäonnistunut laskenta, käytä `planner_batch`-komentoa yhtenäiseen sarjaan, kirjaa edistyminen vain raportointipäivällä ja annetuilla todellisilla päivämäärillä, ja kerro lopuksi, mitä oletit ja mitä jätit tahallaan tekemättä.

**Opas tekoälyavustajille.** Työkalu `planner_get_planning_guide` palauttaa oppaan, joka on kirjoitettu erityisesti tekoälyavustajille. Opas noudattaa samoja periaatteita kuin [Hyvä aikataulutus](docs://gids-goed-plannen). Tekoälyavustaja toimii kuitenkin eri tavalla: se ei paina F5:tä eikä klikkaa valintanauhassa, vaan kutsuu työkaluja ja sovellus laskee sen puolesta. Opas nimeää siksi jokaiselle periaatteelle työkalut, joita tekoälyavustaja käyttää, ja selittää, mitä se tekee *Kirjatut päivämäärät* -näkymän tai epäonnistuneen laskennan kanssa. Opas on englanniksi, kuten kaikki, mitä tekoälyavustaja lukee linkin kautta. Työkalu hyväksyy yhä kielivalinnan vanhemmille tekoälyavustajille, mutta se ei muuta tekstiä. Oppaan voi lukea myös itse osoitteessa `https://open-planner-studio.open-aec.com/agent/planning-guide.md`. Kytkentäkehote ikkunasta *Kytkentätiedot* pyytää tekoälyavustajaa lukemaan oppaan ensin. Työkalu toimii myös, kun valintaikkuna on auki, kun kytkentä on keskeytetty tai kun se on vain luku -tilassa, koska se ei lue aikataulua.

**Kaksi taitoa.** Taito on pieni ohjetiedosto, jonka tekoälyavustaja lukee mukaan jokaiseen istuntoon. Taitoja on kaksi, koska työ on kahta lajia. Aikataulun rakentaminen koskee logiikkaa. Edistymisen päivittäminen koskee tosiasioita, jotka vain käyttäjä tietää. Taito *goed-plannen* on tarkoitettu aikataulun rakentamiseen tai uudelleenjärjestelyyn: työkalujen käyttöjärjestys, laskentasääntö, `planner_batch` ja velvollisuus kertoa oletukset. Taito *progress-update* on viikoittaista edistymispäivitystä varten: ensin raportointipäivä, sitten toteutunut alkamispäivä ja toteutunut loppupäivä sekä prosenttia valmiina, ja sen jälkeen raportti eroista perustasoon, kriittisestä polusta ja uudesta loppupäivästä. Aikataulutuksen periaatteet ovat itse oppaassa. Molemmat taidot ovat englanniksi. Työkalu palauttaa molemmat ja kertoo, mihin ne kuuluvat. Asennus on kohdassa [Tekoälyavustajan yhdistäminen (MCP)](docs://howto-ai-assistent-koppelen).

## Esimerkki

Tekoälyavustajalta pyydetään seuraavaa: rakenna lisärakennus, jossa on Foundation, Brickwork ja Roof, tässä järjestyksessä. Projekti alkaa maanantaina 2. maaliskuuta 2026. Tekoälyavustaja lukee ensin oppaan ja lähettää sitten yhden komentosarjan:

1. projektin aloituspäivä 2. maaliskuuta 2026;
2. kolme tehtävää: Foundation 5 työpäivää, Brickwork 10 työpäivää ja Roof 4 työpäivää;
3. kaksi lopusta alkuun -riippuvuutta: Foundation–Brickwork ja Brickwork–Roof.

Sovellus suorittaa kolme vaihetta ja laskee uudelleen. Jos tekoälyavustaja lukee tulokset takaisin, se näkee: projektin loppu torstaina 26. maaliskuuta 2026, projektin kesto 19 työpäivää ja kaikki kolme tehtävää kriittisiä. Tämä vastaa summaa: 5 + 10 + 4 on 19 työpäivää, ja 19 työpäivää maanantaista 2. maaliskuuta päättyy torstaina 26. maaliskuuta. Koko komentosarja on yksi vaihe kumoushistoriassa. Yksi *Kumoa* poistaa kolme tehtävää, kaksi riippuvuutta ja uuden projektin aloituspäivän.

Nyt tulee mitä-jos-vaihtoehto. Sen jälkeen tekoälyavustajalta pyydetään edistymisen päivittämistä, ja se asettaa raportointipäivän maanantaiksi 16. maaliskuuta. Raportointipäivä ei ole pelkkä nimi: työ, jota ei ole aloitettu, ei saa jäädä ennen tätä päivää, vaan siirtyy siihen. Ilman yhtään edistymisriviä koko aikataulu siirtyy siis mukana: Foundation kulkee 16.–20. maaliskuuta, Brickwork 23. maaliskuuta – 7. huhtikuuta ja Roof 8.–13. huhtikuuta. Projektin loppu siirtyy kohdasta 26. maaliskuuta kohtaan 13. huhtikuuta. Aikataulu siirtyy eteenpäin kaksi työviikkoa. Tässä esimerkissä kalenteri *Bouwkalender NL* sisältää pitkäperjantain (3. huhtikuuta) ja pääsiäisen (5. ja 6. huhtikuuta). Nämä kaksi vapaata arkipäivää siirtävät loppua vielä kaksi päivää. Siksi tekoälyavustaja asettaa raportointipäivän vain pyynnöstä, ja vain silloin, kun kirjattavaa todellista edistymistä on.

## Seuraukset aikataulussa ja yleiset väärinkäsitykset

**Tekoälyavustajalla ei ole omaa kopiota.** Se, mitä tekoälyavustaja muuttaa, muuttaa projektia. Kun automaattinen varmuuskopio on päällä, IFC-varmuuskopio on olemassa ennen sen ensimmäistä muutosta. Kun *Vain luku* on päällä, tekoälyavustaja voi analysoida muuttamatta mitään.

**Uusi tunnus katkaisee kaikki kytkennät.** Tunnus on sillan salasana. Uusi tunnus mitätöi vanhan, myös käynnissä olevalla sillalla, ja tekoälyavustajalle on annettava uusi tunnus.

**Se, että tekoälyavustaja sanoo onnistuneensa, ei ole todiste.** Toimintapaneeli näyttää, minkä työkalun tekoälyavustaja todella kutsui ja mitä siihen palautui. Hylkäys nimeää lähes aina kentän, joka oli väärin, ja tavan, joka toimii.

**Tekoälyavustaja ei voi tehdä mitä-jos-kokeilua kumottavasti.** Se jakaa kumoushistorian käyttäjän kanssa, joten vaihtoehtoja varten se kopioi asiakirjan komennolla `planner_duplicate_document`. Kopio on irrallinen, sillä ei ole tiedostopolkua, ja se näkyy tallentamattomana. Tekoälyavustaja ei sulje vaihtoehtoja. Sen päättää käyttäjä.

**Tekoälyavustajan vienti ei ole tallennus.** Se kirjoittaa IFC-tiedoston polkuun, jonka se valitsee itse käyttäjän kansiosta, ja korvaa olemassa olevan tiedoston vain, jos pyytää sitä nimenomaan. Projekti pysyy sovelluksessa tallentamattomana ja säilyttää oman tallennuskohteensa. Jos tekoälyavustaja tuo tiedoston, se avautuu uudessa välilehdessä tai tyhjässä, muuttumattomassa välilehdessä.

## Katso myös

- [Tekoälyavustajan yhdistäminen (MCP)](docs://howto-ai-assistent-koppelen): vaiheet sillan käynnistämiseen, tekoälyavustajan yhdistämiseen ja taidon asentamiseen.
- [AI-työkalut](docs://ref-ai-tools): kaikki työkalut ryhmittäin, mitä ne hylkäävät ja kuinka kauan varmuuskopioita säilytetään.
- [Hyvä aikataulutus](docs://gids-goed-plannen): aikataulutuksen periaatteet; tekoälyavustaja saa ne englanninkielisenä versiona, johon työkalut on lisätty.
- [Edistyminen, raportointipäivä ja perustaso](docs://uitleg-voortgang): mitä raportointipäivä tekee aikataululle.

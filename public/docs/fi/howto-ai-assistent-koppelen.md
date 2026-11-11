# MCP-asiakkaan yhdistäminen

Tavoite: antaa MCP-asiakkaan lukea aikataulua ja muokata sitä. Toimet näkyvät, ja rajat asetetaan itse.

## Pikaohje: anna Clauden tehdä se

Käytetäänkö Claude Desktop -sovellusta tai Claude Code -ohjelmaa? Silloin Claude voi asentaa yhteyden itse:

1. Valitse alla oleva *Kopioi kehote*.
2. Liitä kehote uuteen keskusteluun Clauden kanssa ja lähetä se.

Claude asentaa sitten Open Planner Studio -laajennuksen ja selittää samalla, mitä se tekee. Jos jokin vaihe pitää tehdä itse, esimerkiksi napsauttaa Claude Desktop -sovelluksessa *Asenna*-painiketta, Claude kertoo tarkalleen, mikä napsautus on kyseessä. Tokenia ei tarvita.

```prompt
Asenna minulle Open Planner Studio -laajennus, jotta Claude voi lukea ja muuttaa rakennushankkeiden aikatauluja Open Planner Studio -sovelluksessa. Tee mahdollisimman paljon itse. Kerro ennen jokaista vaihetta yhdellä selkeällä lauseella, mitä tehdään ja miksi. Jos tarvitaan minua, kysy kerrallaan yksi asia ja odota vastaustani. Jos minun pitää itse tehdä jotain, kerro tarkalleen, mikä yksi napsautus tai toimenpide se on ja missä.

Tämä on hyvä tietää:
- Laajennus on yksi tiedosto, open-planner-studio-<version>.mcpb, uusimmassa julkaisussa: https://github.com/OpenAEC-Foundation/open-planner-studio/releases/latest. Suora linkki löytyy osoitteesta https://api.github.com/repos/OpenAEC-Foundation/open-planner-studio/releases/latest (tiedosto, jonka nimi päättyy .mcpb). Tiedosto on ZIP-tiedosto.
- Laajennus toimii Open Planner Studio -työpöytäsovelluksen kanssa ja ilman sovellusta. Kun sovellus on auki ja sen MCP-silta on käynnissä, työskennellään sovelluksessa avoinna olevassa suunnitelmassa. Kun sovellus on suljettu, työskennellään tiedostojen kanssa, jotka sisältävät aikatauluja, työkansiossa, jonka minä valitsen.
- Asennus ei tarvitse tokenia eikä salasanaa. Älä pyydä minulta sellaista äläkä lue tai näytä sitä.

Jos käytössä on Claude Desktop:
1. Jos tiedoston voidaan ladata ja avata tietokoneellani, tee se .mcpb-tiedostolla. Jos ei voida, anna minulle suora latauslinkki ja pyydä minua kaksoisnapsauttamaan tiedoston, kun lataus on valmis.
2. Claude Desktop näyttää sitten laajennuksen Open Planner Studio. Pyydä minua napsauttamaan Asenna. Pyydä sen jälkeen minua valitsemaan kohdasta Working folder se kansio, jossa aikataulut ovat.
3. Pyydä minua aloittamaan uusi keskustelu ja kysymään siellä Claudelta, mitä Open Planner Studio -sovelluksen työkaluja näkyy.

Jos käytössä on Claude Code:
1. Tarkista, että Node.js 22 tai uudempi on asennettu. Jos ei ole, kerro minulle, miten se asennetaan, ja lopeta.
2. Kysy minulta, missä kansiossa aikataulut ovat. Tämä kansio on työkansio.
3. Lataa .mcpb-tiedosto ja pura se uuteen, omaan kansioon käyttäjäkansiossani. Lue siellä oleva manifest.json: server.mcp_config kertoo, miten palvelin käynnistyy. Korvaa ${__dirname} puretulla kansiolla ja ${user_config.workdir} työkansiolla.
4. Suorita claude mcp list. Jos palvelin nimeltä open-planner-studio on jo olemassa, kysy minulta, saako sen korvata. Älä näytä sen asetuksia, koska ne voivat sisältää tokenin.
5. Lisää palvelin minun käyttäjätililleni, esimerkiksi: claude mcp add open-planner-studio --scope user -e OPS_MCP_ROOT=<työkansio> -- node <purettu kansio>/server/index.mjs
6. Pyydä minua aloittamaan uusi Claude Code -istunto. Kerro minulle, että siellä /mcp näyttää, onko open-planner-studio yhdistetty.

Jos käytössä on jokin muu, esimerkiksi claude.ai selaimessa, kerro minulle, että tämä vaatii Claude Desktop -sovelluksen tai Claude Code -ohjelman. Jos ei tiedetä, missä ollaan, kysy minulta.

Kun asennus on valmis, selitä muutamalla lauseella:
- miten sallin Clauden työskennellä avoimessa sovelluksessa: Open Planner Studio -sovelluksessa valitse Asetukset › Projekti › Sovelluksen asetukset, välilehti Lisäasetukset, ja ota käyttöön Salli MCP-yhteys. Napsauta sitten Käynnistä silta MCP-välilehdeltä.
- että ilman sovellusta muutos näkyy tiedostossa vasta sen jälkeen, kun se on tallennettu, ja ettei olemassa olevaa tiedostoa korvata, kun sovellus on auki.
Jos vaihe epäonnistuu, kerro minulle yhdellä lauseella, mikä meni pieleen ja mitä voin tehdä. Älä arvaa.
```

Halutaanko asennus tehdä itse, vai käytetäänkö toista MCP-asiakasta? Silloin noudatetaan alla olevia vaiheita.

## Milloin tätä tarvitaan

Halutaan, että MCP-asiakas lukee, analysoi tai muuttaa aikataulua. Esimerkiksi alustava WBS voidaan laatia, tehtäviä korjata tai kriittinen polku selittää. Tämä toimii **Model Context Protocol** (MCP) -standardin kautta. Standardin avulla tekoälyohjelma, eli **MCP-asiakas**, voi käyttää toisen ohjelman työkaluja. Tätä varten Open Planner Studio käynnistää omalle tietokoneelle pienen palvelimen, eli **silta**. Se tarjoaa joukon työkaluja, joiden nimi alkaa `planner_`. Työkalut lukevat ja muuttavat seuraavia: tehtävät, riippuvuudet, resurssit, kalenterit, perustasot, asiakirjat ja tiedostot. Mitä työkaluja on, ja mitä ne eivät hyväksy, kerrotaan kohdassa [MCP-työkalut](docs://ref-ai-tools). MCP-asiakas toimii avoinna olevassa projektissa eikä kopiossa: lisätty tehtävä näkyy Gantt-kaaviossa heti. Se käyttää samaa laskentaa ja samaa *Kumoa*-historiaa kuin käyttäjä.

Silta toimii vain työpöytäsovelluksessa. Jos selaimessa otetaan MCP-yhteyden salliminen käyttöön, *MCP*-välilehti näkyy, mutta painike *Käynnistä silta* on harmaa, ja siinä lukee *Silta toimii vain työpöytäsovelluksessa.* Loppu tästä artikkelista koskee työpöytäsovellusta. Selaimessa myös *Varmuuskopioi nyt* ja *Avaa varmuuskopiokansio* ovat harmaita.

## Vaiheet

### 1. Salli MCP-kytkentä

1. Valitse *Asetukset › Projekti › Sovelluksen asetukset*. Valitse myös *Tiedosto › Asetukset* tai napsauta ylhäällä olevaa hammasratasta.
2. Valitse välilehti *Lisäasetukset* ja ota käyttöön *Salli MCP-kytkentä*. Välilehti *MCP* tulee näkyviin valintanauhaan.
3. Jos silta halutaan aktiiviseksi heti, kun sovellus käynnistyy, ota myös käyttöön *Käynnistä silta automaattisesti*. Tämä toimii vain, kun MCP-kytkentä on päällä, ja vain työpöytäsovelluksessa. Oletuksena se on pois päältä, koska portin avaaminen on tietoinen valinta.

Jos MCP-kytkentä kytketään pois päältä, silta pysähtyy ja välilehti *MCP* katoaa.

### 2. Käynnistä silta

1. Siirry välilehdelle *MCP* ja napsauta *Käynnistä silta* -painiketta ryhmässä *Palvelin*.
2. Katso painikkeen vieressä olevaa tilaa. Siinä lukee *Pois*, *Aktiivinen portissa 3877*, *Portti 3877 on varattu* tai *Virhe*. Jos käynnistys onnistuu, siinä lukee *Aktiivinen portissa 3877* ja painikkeen nimi on *Pysäytä silta*. Kun tila on *Portti 3877 on varattu* tai *Virhe*, painikkeen nimi pysyy *Käynnistä silta*; katso ongelmatilanteet.

Silta kuuntelee vain omalla tietokoneella, yhdessä portissa. Oletuksena se on 3877. Ryhmässä *Kytkentä* voidaan valita toinen portti kentässä *Portti*, mutta vain silloin, kun silta on pysäytetty. Kytkentä tapahtuu tavallisella HTTP:llä omalla tietokoneella. Sovellus itse ei lähetä mitään ulospäin. Se, mitä MCP-asiakas tekee aikataululle, esimerkiksi mitä sen palveluntarjoaja siitä tekee, on sovelluksen ulkopuolella.

### 3. Yhdistä MCP-asiakas

1. Napsauta *Yhdistä* ryhmässä *Kytkentä*. Ikkuna *Kytkentätiedot* avautuu.
2. Valitse, mitä MCP-asiakas tarvitsee, katso alla.
3. Token on piilotettu. Silmäkuvakkeella token näytetään. Kopiointipainikkeet kopioivat aina todellisen arvon, vaikka näyttö piilottaa tokenin.
4. Pyydä MCP-asiakasta hakemaan työkalujen luettelo. Tämä tarkistus on myös yhdistämiskehotteessa: asiakkaan pitää nähdä työkalut, joiden etuliite on `planner_`. Odotettu määrä on yhdistämiskehotteessa.

Ikkuna tarjoaa neljä tapaa yhdistää:

- *Anna Claude hoitaa asian*: sama kehote kuin tämän artikkelin alussa, painikkeella *Kopioi kehote*. Tämä on tarkoitettu Claude Desktop -ohjelmalle ja Claude Code -ohjelmalle. Tokenia ei tarvita tähän.
- *Asetuskatkelma*: asetusten pätkä, joka liitetään MCP-asiakkaan asetuksiin.
- *Yhdistämiskehote*: teksti, joka liitetään MCP-asiakkaaseen, jonka jälkeen asiakas yhdistää itsensä.
- *Päätepiste* ja *Todennus*: erilliset tiedot. Päätepiste on `http://localhost:3877/mcp` ja kuljetustapa on *suoratoistettava HTTP*. Jokainen pyyntö tarvitsee otsakkeen `Authorization: Bearer`, jota seuraa token. MCP-asiakkaan on myös tuettava MCP-istuntoja: yhdistäessään silta antaa istuntokoodin otsakkeessa `Mcp-Session-Id`, ja se hylkää jokaisen myöhemmän pyynnön ilman tätä koodia. Claude Code ja `mcp-remote` tekevät tämän itse.

**Yhdistä uudelleen sovelluksen päivityksen jälkeen.** Jos MCP-asiakas oli jo yhdistettynä sovelluksen vanhempaan versioon, se ei vielä lähetä istuntokoodia, ja silta hylkää jokaisen pyynnön. Yhdistä siksi päivityksen jälkeen uudelleen: aloita uusi istunto Claude Code -ohjelmassa ja sulje Claude Desktop kokonaan ja käynnistä se uudelleen.

**Claude Code.** Asetuskatkelma sopii suoraan Claude Code -ohjelmaan. Anna tämä komento päätteessä ja korvaa `<token>` omalla tokenilla:

```
claude mcp add --transport http open-planner-studio http://localhost:3877/mcp --header "Authorization: Bearer <token>"
```

Asetuskatkelman voi myös lisätä projektikansiossa olevaan tiedostoon `.mcp.json`. Silloin tiedostoa ei pidä laittaa gitiin, koska token antaa pääsyn aikatauluun. Palvelin tiedostosta `.mcp.json` on hyväksyttävä ensimmäisellä kerralla Claude Code -ohjelmassa.

**Claude Desktop.** Claude Desktop -ohjelmalle on laajennus: tiedosto `open-planner-studio-<version>.mcpb`. Claude Desktop asentaa sen kaksoisnapsautuksella. Tähän ei tarvita Node.js:ää. Laajennus toimii sovelluksen kanssa ja ilman sovellusta. Artikkelin alun kehotteella se on nopeampi; alla ovat vaiheet käsin.

1. Lataa tiedosto `.mcpb` uusimmasta julkaisusta: `https://github.com/OpenAEC-Foundation/open-planner-studio/releases/latest`.
2. Kaksoisnapsauta tiedostoa. Claude Desktop avautuu ja näyttää laajennuksen *Open Planner Studio*. Asenna se. Jos kaksoisnapsautus ei toimi, avaa Claude Desktop -ohjelmassa *Asetukset › Laajennukset* ja asenna tiedosto siellä.
3. Valitse kohdassa *Työkansio* kansio, jossa aikataulutiedostot ovat. Claude käyttää tätä kansiota vain silloin, kun sovellus on suljettu. Claude lukee ja kirjoittaa sen jälkeen vain tässä kansiossa.
4. Ota laajennus käyttöön ja aloita uusi keskustelu. Kysy Claudelta, mitä Open Planner Studio -sovelluksen työkaluja se näkee.

Tokenia tai porttia ei tarvitse syöttää. Kun silta on käynnissä, laajennus löytää sovelluksen itse. Jokaisen Clauden pyynnön kohdalla laajennus valitsee uudelleen:

- *Sovellus on auki ja silta on käynnissä*: Claude työskentelee sovelluksessa avoinna olevassa aikataulussa. Jokainen muutos näkyy sovelluksessa heti.
- *Sovellus on suljettu tai silta on pois päältä*: Claude työskentelee työkansiossa olevan aikataulutiedoston kanssa. Muutos on tiedostossa vasta, kun Claude tallentaa tiedoston. Automaattista tallennusta ei ole. Kun sovellus on auki, Claude ei korvaa olemassa olevaa tiedostoa, vaan tallentaa sen uudella nimellä.

Jos sovellus avautuu tai sulkeutuu, kun Claude työskentelee, laajennus vaihtaa ja kertoo siitä Claudelle. Claude valitsee tai avaa aikataulun ensin uudelleen ja vasta sitten muuttaa jotakin. Jos Claudella on vielä muutoksia ilman sovellusta, joita ei ole tallennettu, laajennus jatkaa työskentelyä ilman sovellusta, kunnes Claude on tallentanut ne. Näin mitään työtä ei menetetä. Jos laajennus ei tavoita sovellusta, eikä käyttökelpoista työkansiota ole, Claude näkee vain työkalun `open_planner_studio_status`, jonka viesti kertoo, mitä on tehtävä.

**Claude Desktop ilman laajennusta.** Jos laajennusta ei voi käyttää, Claude Desktop yhdistetään ulkoisella työkalulla `mcp-remote`. Asetuskatkelma ei sovi suoraan Claude Desktop -ohjelmaan: tiedostossa `claude_desktop_config.json` nimetään ohjelma, jonka Claude Desktop käynnistää itse, eikä osoite. `mcp-remote` tarvitsee Node.js:ää. Valitse Claude Desktop -ohjelmassa *Asetukset › Kehittäjä › Muokkaa asetustiedostoa*, lisää tämä tiedostoon (korvaa token omalla tokenilla) ja käynnistä Claude Desktop uudelleen:

```
{
  "mcpServers": {
    "open-planner-studio": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:3877/mcp", "--header", "Authorization:${AUTH_HEADER}"],
      "env": { "AUTH_HEADER": "Bearer <token>" }
    }
  }
}
```

Token on tarkoituksella `env`-kohdassa eikä `args`-kohdassa: Windowsissa Claude Desktop rikkoo argumentin, jossa on välilyönti. *Mukautettu liitin* Claudessa (*Mukauta › Liittimet*) ei toimi sillan kanssa. Silloin Claude yhdistää Anthropicin pilvestä, eikä pilvi tavoita siltaa omalla tietokoneella.

Ryhmässä *Kytkentä* on myös kenttä *Token*. Se on pitkä, satunnainen koodi, jonka sovellus luo ja tallentaa tälle tietokoneelle. Ikkunassa lukee *Tämä token antaa pääsyn avoimeen aikatauluun. Älä jaa sitä muille*. Kuvakkeella *Luo uusi token* luodaan uusi token. Sovellus kysyy ensin *Uuden tokenin luominen katkaisee kaikki nykyiset yhteydet. Jatketaanko?* Jos silta on käynnissä, se käynnistyy uudelleen uudella tokenilla, eikä vanha token toimi enää.

**Näin laajennus löytää sovelluksen.** Kun silta on käynnissä, työpöytäsovellus kirjoittaa portin ja tokenin tiedostoon `mcp/runtime.json` sovelluksen datakansiossa. Claude Desktop -laajennus lukee tämän tiedoston jokaisen pyynnön kohdalla. Linuxissa ja macOS:ssa vain oma käyttäjätili voi lukea tiedoston. Windowsissa tiedostoa suojaa profiilikansion oletuskäyttöoikeudet (ACL); sovellus ei tarkista tätä erikseen. Kun silta pysäytetään tai MCP-kytkentä kytketään pois päältä, sovellus poistaa tiedoston. Sovellus pitää lisäksi luetteloa avoimista tiedostoista tiedostossa `mcp/open-files.json`, vaikka MCP-kytkentä on pois päältä. Niin kauan kuin tuo tiedosto on olemassa, laajennus ja ilman käyttöliittymää toimiva MCP-palvelin eivät korvaa yhtään olemassa olevaa tiedostoa, eivät myöskään tiedostoa, joka on juuri avattu ja joka ei vielä ole luettelossa. Uuden tiedoston luominen on sallittua. Lukeminen on sallittua myös: Claude näkee silloin levyllä olevan version ilman tallentamattomia muutoksia.

### 4. Katso, mitä MCP-asiakas tekee

1. Napsauta *Toimintapaneeli* ryhmässä *Toimintaloki*. Sivupalkkiin avautuu paneeli *MCP-toiminta*.
2. Jokainen sillan kutsu on omalla rivillään, uusin ylimpänä: aika, mitä tapahtui, kuinka kauan se kesti ja onnistuiko se vai ei. Napsauta riviä, jolloin *Argumentit* ja *Vastaus* tulevat näkyviin.
3. Painikkeella *Tyhjennä* tyhjennetään luettelo. Paneeli säilyttää viimeiset 500 kutsua. Niin kauan kuin mitään ei ole tapahtunut, siinä lukee *Ei vielä MCP-toimintaa. Sillan kutsut näkyvät tässä*.

Kun MCP-kytkentä on päällä, tilarivillä oikeassa alareunassa on piste, jonka vieressä on teksti *MCP*. Sen väri kertoo sillan tilan, ja pisteen napsauttaminen vie välilehdelle *MCP*.

### 5. Aseta rajoitukset

Ryhmässä *Turvallisuus* ovat painikkeet, joilla MCP-asiakasta rajoitetaan:

- *Keskeytä*: MCP-asiakas ei saa hetkeksi muuttaa mitään, lukeminen on edelleen sallittua. Silta pysyy aktiivisena. Painike muuttuu nimeksi *Jatka*.
- *Vain luku*: kaikki työkalut, jotka muuttavat jotakin, hylätään niin kauan kuin tämä on päällä.
- *Auto-varmuuskopio: päällä*: ennen MCP-asiakkaan ensimmäistä muutosta asiakirjassa sovellus kirjoittaa IFC-varmuuskopion. Tämä on oletuksena päällä. Painikkeella se kytketään pois, ja silloin siinä lukee *Auto-varmuuskopio: pois*. Tämä tapahtuu kerran asiakirjaa kohden joka kerta, kun silta käynnistetään.
- *Varmuuskopioi nyt*: tekee varmuuskopion aktiivisesta asiakirjasta heti. Sen jälkeen siinä lukee *Varmuuskopio luotu:* ja tiedoston nimi.
- *Avaa varmuuskopiokansio*: avaa kansion, jossa varmuuskopiot ovat.

Varmuuskopiot ovat kansiossa `ai-backups` sovelluksen datakansiossa. Sovellus säilyttää tuoreet varmuuskopiot ja karsii vanhempia; tarkka tapa on kuvattu kohdassa [MCP-työkalut](docs://ref-ai-tools).

### 6. Varmista, että MCP-asiakas suunnittelee hyvin

MCP-asiakas suunnittelee hyvin vain, jos se tuntee suunnittelusäännöt. Tämä tehdään itse:

1. **Ydinsääntöihin ei tarvitse tehdä mitään.** Ne tulevat mukana yhdistettäessä: silta lähettää ne MCP-kättelyn kentässä `instructions`. Se, asetetaanko ne asiakkaan järjestelmäkehotteeseen, riippuu asiakkaasta.
2. **Anna oppaan lukea.** Yhdistämiskehote ikkunasta *Kytkentätiedot* pyytää MCP-asiakasta lukemaan oppaan työkalulla `planner_get_planning_guide`. Jos kehotetta ei käytetä, pyydä MCP-asiakasta: *Lue suunnitteluopas työkalulla planner_get_planning_guide ennen kuin mitään muutetaan.* Oppaan voi lukea itse osoitteessa `https://open-planner-studio.open-aec.com/agent/planning-guide.md`.
3. **Valinnainen: asenna taidot.** Tämä toimii vain MCP-asiakkaalla, joka tukee taitoja. Aseta taitojen *goed-plannen* ja *progress-update* tiedostot `SKILL.md` kohtiin `.claude/skills/goed-plannen/SKILL.md` ja `.claude/skills/progress-update/SKILL.md` projektikansioon, jossa MCP-asiakas toimii, tai kansioon `~/.claude/skills/` kaikille projekteille.

Tiedostot saadaan kahdella tavalla. Pyydä MCP-asiakasta kutsumaan työkalua `planner_get_planning_guide`, jossa `part` on asetettu arvoon `skill`: vastaus sisältää molemmat tekstit ja kullekin taidolle paikan, johon se kuuluu. Tai lataa ne osoitteista `https://open-planner-studio.open-aec.com/skills/goed-plannen/SKILL.md` ja `https://open-planner-studio.open-aec.com/skills/progress-update/SKILL.md`. Jos *goed-plannen* on vielä jäljellä vanhemmasta sovellusversiosta, korvaa se: vanha teksti on hollanniksi ja viittaa ohjeartikkeliin MCP-asiakkaiden oppaan sijaan.

Sen, onko MCP-asiakas todella lukenut oppaan, näkee paneelista *Toimintapaneeli*: siellä on silloin kutsu `planner_get_planning_guide`. MCP-asiakkaan lopullisen vastauksen pitäisi sisältää luettelo olettamuksista: arvioidut kestot, valittu jaottelu, itse luodut riippuvuudet ja jokainen asetettu rajoite. Jos luettelo puuttuu, pyydä sitä. Edistymisen päivityksen jälkeen, *progress-update*-taidon mukaan, vastauksessa pitää mainita raportointipäivä, uusi loppupäivä ja ero perustasoon verrattuna.

## Ongelmatilanteet ja mitä sovellus silloin tekee

**MCP-asiakkaan tekemä muutos halutaan perua.** Jokainen MCP-asiakkaan muutos on vaihe, jonka voi kumota komennolla *Kumoa* (Ctrl+Z). Muutossarja, jonka MCP-asiakas antaa eteenpäin yhtenä kokonaisuutena, on yksi vaihe. Sen jälkeen projekti näkyy tallentamattomana. Muutoksen jälkeen aikataulu lasketaan uudelleen, joten F5:tä ei tarvitse painaa itse.

**Sovellus hylkää MCP-asiakkaan kutsun.** Kun *Keskeytä* ja *Vain luku* ovat päällä, sovellus hylkää kaikki muutokset. Lukeminen on silti mahdollista, myös se, että vanhentunut aikataulu lasketaan uudelleen. Jos muokkaus on kesken itse tehtynä, esimerkiksi palkin vetäminen tai kenttään kirjoittaminen, MCP-asiakas saa muokkausta edeltävät päivämäärät ja ilmoituksen, että ne ovat vanhentuneet. Jos avoinna on ikkuna, esimerkiksi asetukset, tehtäväikkuna tai tervetuloikkuna, tai jos esitystila on päällä, sovellus hylkää kaikki kutsut, myös lukemisen, kunnes ikkuna suljetaan. MCP-asiakas saa silloin virheilmoituksen, jossa on avoinna olevan asian sisäinen nimi, esimerkiksi `showTaskDialog`. Vain `planner_get_planning_guide` toimii edelleen, koska se ei lue aikataulua.

**Välilehteä vaihdetaan, kun MCP-asiakas työskentelee.** MCP-asiakas työskentelee asiakirjassa, johon sen ensimmäinen muutos osui. Jos välilehteä vaihdetaan sillä välin, sovellus hylkää sen seuraavan muutoksen, kunnes se vahvistaa, että haluaa työskennellä toisessa välilehdessä. Näin mikään ei päädy väärään projektiin. Jos MCP-asiakas avaa tai monistaa asiakirjan itse, se työskentelee sen jälkeen uudessa asiakirjassa.

**MCP-asiakas kirjoittaa tai avaa tiedoston.** MCP-asiakas voi kirjoittaa aikataulun IFC-tiedostoksi ja avata aikataulutiedoston uudeksi välilehdeksi. Se voi tehdä sen vain käyttäjäkansiossa. Olemassa olevan tiedoston se korvaa vain, jos pyytää sitä nimenomaisesti.

**Tila on *Portti 3877 on varattu*.** Toinen ohjelma käyttää porttia. Sovelluksen viesti näkyy sen alla. Porttikenttä jää silloin lukkoon (*Muokattavissa vain, kun palvelin on pysäytetty.*), vaikka silta ei ole käynnissä, eikä pysäytyspainiketta ole. Tämä on tunnettu puute. Siihen asti kytke *Salli MCP-kytkentä* pois ja uudelleen päälle. Tila palautuu silloin tilaan *Pois*, ja toinen portti voidaan valita. Kopioi sen jälkeen kytkentätiedot uudelleen, koska päätepiste sisältää portin.

**MCP-asiakas ei voi yhdistää uuden tokenin jälkeen.** Uusi token katkaisee kaikki nykyiset kytkennät. Anna asiakkaalle uusi token tai liitä asetuskatkelma uudelleen. Claude Desktop -laajennus lukee uuden tokenin itse; siellä ei tarvitse tehdä mitään.

**Silta pysäytettiin itse, eikä se käynnisty itsestään.** *Käynnistä silta automaattisesti* toimii kerran joka kerta, kun sovellus käynnistyy. Kun silta pysäytetään itse, sovellus ei kytke sitä hiljaa uudelleen päälle.

**Välilehti *MCP* on kadonnut.** MCP-kytkentä on pois päältä. Kytke se päälle vaiheessa 1.

**Verkkosivu selaimessa ei voi tavoittaa siltaa.** Silta hylkää jokaisen pyynnön, joka tulee selaimesta, ja jokaisen pyynnön, jossa ei ole oikeaa tokenia.

## Ilman sovellusta

Lisäksi on olemassa MCP-palvelin, joka toimii ilman työpöytäsovellusta: **headless MCP -palvelin**. Se tarjoaa samat `planner_*`-työkalut, mutta se toimii levyllä olevassa tiedostossa, jossa on aikataulu, avoimen projektin sijaan. Siksi muutoksia ei näy Gantt-kaaviossa, eikä sovelluksen *Kumoa*-komento koske niihin. Sitä käytetään, kun sovellusta ei haluta avata tai koneessa ei ole näyttöä.

Claude Desktop -laajennus käynnistää tämän palvelimen itse, kun sovellus on suljettu (katso vaihe 3). Alla olevat vaiheet koskevat muuta MCP-asiakasohjelmaa, kuten Claude Code.

Julkaisussa ei ole valmista palvelimen latausta. Palvelin rakennetaan lähdekoodista komennolla `npm run build:mcp-server`; siihen tarvitaan Node.js 22 tai uudempi. Tuloksena on yksi tiedosto, `server.mjs`.

1. Valitse työkansio, jossa ovat aikataulutiedostot. Palvelin lukee ja kirjoittaa vain siinä kansiossa.
2. Yhdistä MCP-asiakasohjelma. Claude Code -ohjelman komento on näiden vaiheiden alla.
3. Pyydä MCP-asiakasohjelmaa avaamaan aikataulu, esimerkiksi `~/plan.ifc`. Tässä palvelimessa `~` tarkoittaa työkansiota.
4. Pyydä MCP-asiakasohjelmaa tallentamaan tulos. Automaattista tallennusta ei ole: MCP-asiakasohjelma kirjoittaa tiedoston työkalulla `planner_export_ifc`. Mitä ei tallenneta, katoaa, kun palvelin pysähtyy.

Vaiheessa 2 annetaan Claude Code -ohjelmassa tämä komento päätteessä omilla poluilla:

```
claude mcp add open-planner -- node /path/to/server.mjs --root /path/to/working-folder
```

Ennen kunkin asiakirjan ensimmäistä muutosta palvelin tekee MCP-varmuuskopion, kuten sovellus. Palvelin hylkää MCP-asiakasohjelman pyynnön, jos se valitsee polun työkansion ulkopuolella, myös pikakuvakkeen (symbolisen linkin) kautta. Kun sovellus on auki, palvelin ei korvaa olemassa olevaa tiedostoa.

## Katso myös

- [Palautteen antaminen](docs://howto-feedback-geven): jos yhteys toimii toisin kuin tässä kuvataan, siitä kannattaa antaa palautetta.
- [MCP-työkalut](docs://ref-ai-tools): kaikki `planner_*`-työkalut ryhmittäin, virhekoodit ja se, kuinka kauan varmuuskopioita säilytetään.
- [Sovelluksen asetukset](docs://ref-instellingen): MCP-asetukset.

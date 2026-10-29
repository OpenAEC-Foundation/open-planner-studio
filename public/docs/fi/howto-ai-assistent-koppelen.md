# Tekoälyavustajan yhdistäminen (MCP)

Tavoite: tekoälyavustaja voi seurata aikataulua ja työskennellä siinä. Toiminta näkyy, ja rajat asetetaan itse.

## Milloin tätä tarvitaan

Halutaan, että tekoälyavustaja lukee, analysoi tai muuttaa aikataulua. Esimerkiksi se laatii alustavan WBS:n, korjaa tehtäviä tai selittää kriittisen polun. Tämä toimii **Model Context Protocol** (MCP) -standardin avulla. Standardi kertoo, miten tekoälyavustaja käyttää ohjelman työkaluja. Tätä varten Open Planner Studio käynnistää pienen palvelimen omalle tietokoneelle: **sillan**. Silta tarjoaa joukon työkaluja, joiden nimi alkaa `planner_`: tehtävien, riippuvuuksien, resurssien, kalenterien, perustasojen, asiakirjojen ja tiedostojen lukeminen ja muuttaminen. Mitä työkaluja on ja mitä ne estävät, kerrotaan artikkelissa [AI-työkalut](docs://ref-ai-tools). Miksi AI-linkki toimii näin, kerrotaan artikkelissa [Miten AI-linkki toimii](docs://uitleg-ai-koppeling).

Silta toimii vain työpöytäsovelluksessa. Kun AI-tila otetaan käyttöön selaimessa, välilehti *AI* näkyy, mutta painike *Käynnistä silta* on harmaa ja siinä lukee *Silta toimii vain työpöytäsovelluksessa.* Tämän artikkelin loput koskevat työpöytäsovellusta. Selaimessa myös *Varmuuskopioi nyt* ja *Avaa varmuuskopiokansio* ovat harmaita.

## Vaiheet

### 1. Ota AI-tila käyttöön

1. Valitse *Asetukset › Projekti › Asetukset*. Voidaan myös valita *Tiedosto › Asetukset* tai ylhäällä oleva rataskuvake.
2. Valitse välilehti *Lisäasetukset* ja valitse *Ota AI-tila käyttöön*. Välilehti *AI* ilmestyy valintanauhaan.
3. Jos silta halutaan käyntiin heti, kun sovellus käynnistyy, valitse myös *Käynnistä silta automaattisesti*. Tämä kytkeytyy päälle vain, kun AI-tila on käytössä, ja toimii vain työpöytäsovelluksessa. Oletuksena se on pois, koska portin avaaminen on tietoinen valinta.

Jos AI-tila poistetaan käytöstä, silta pysähtyy ja välilehti *AI* katoaa.

### 2. Käynnistä silta

1. Siirry välilehdelle *AI* ja klikkaa kohdassa *Palvelin* painiketta *Käynnistä silta*.
2. Katso painikkeen vieressä olevaa tilaa. Siinä lukee *Pois*, *Aktiivinen portissa 3877*, *Portti 3877 on varattu* tai *Virhe*. Jos käynnistys onnistuu, siinä lukee *Aktiivinen portissa 3877* ja painikkeen nimi on *Pysäytä silta*. Jos siinä lukee *Portti 3877 on varattu* tai *Virhe*, painikkeessa lukee yhä *Käynnistä silta*. Katso kohta Ongelmatilanteet.

Silta kuuntelee vain omalla tietokoneella, yhdessä portissa. Oletuksena portti on 3877. Ryhmässä *Kytkentä* voi valita toisen portin kohdasta *Portti*, mutta vain silloin, kun silta on pysäytetty.

### 3. Yhdistä tekoälyavustaja

1. Klikkaa kohdassa *Kytkentä* painiketta *Yhdistä*. Ikkuna *Kytkentätiedot* avautuu.
2. Valitse, mitä asiakas tarvitsee. Katso alla.
3. Token on piilotettu. Silmäkuvakkeella sen voi näyttää. Kopiointipainikkeet kopioivat aina todellisen arvon, vaikka näyttö piilottaisi tokenin.
4. Pyydä avustajaa hakemaan työkalujen luettelo. Sama tarkistus on myös yhdistämiskehotteessa: avustajan pitää nähdä työkalut, joiden etuliite on `planner_`. Odotettu määrä on yhdistämiskehotteessa.

Ikkuna tarjoaa kolme tapaa kytkeytyä:

- *Asetuskatkelma*: pieni asetusteksti, joka liitetään asiakkaan MCP-asetuksiin.
- *Yhdistämiskehote*: teksti, joka liitetään tekoälyavustajaan. Sen jälkeen avustaja kytkeytyy itse.
- *Päätepiste* ja *Todennus*: erilliset tiedot. Päätepiste on `http://localhost:3877/mcp` ja kuljetustapana *streamable HTTP*. Jokainen pyyntö tarvitsee otsakkeen `Authorization: Bearer`, jota seuraa token. Asiakkaan on myös tuettava MCP-istuntoja: yhdistettäessä silta antaa istuntokoodin otsakkeessa `Mcp-Session-Id`, ja se hylkää jokaisen myöhemmän pyynnön ilman tätä koodia. Claude Code ja `mcp-remote` hoitavat tämän itse.

**Yhdistä uudelleen sovelluksen päivityksen jälkeen.** Jos tekoälyasiakas oli jo yhdistettynä sovelluksen vanhempaan versioon, se ei vielä lähetä istuntokoodia, ja silta hylkää jokaisen pyynnön. Yhdistä siksi päivityksen jälkeen uudelleen: aloita uusi istunto Claude Code -ohjelmassa ja sulje Claude Desktop kokonaan ja käynnistä se uudelleen.

**Claude Code.** Asetuskatkelma sopii suoraan Claude Code -ohjelmaan. Anna tämä komento päätteessä ja korvaa `<token>` omalla tokenillasi:

```
claude mcp add --transport http open-planner-studio http://localhost:3877/mcp --header "Authorization: Bearer <token>"
```

Katkelman voi myös laittaa tiedostoon `.mcp.json` projektikansiossa. Tätä tiedostoa ei silloin tallenneta gitiin, koska token antaa pääsyn aikatauluun. Palvelin tiedostosta `.mcp.json` on hyväksyttävä Claude Code -ohjelmassa ensimmäisellä kerralla.

**Claude Desktop.** Asetuskatkelma ei sovi suoraan Claude Desktop -ohjelmaan. Tiedostossa `claude_desktop_config.json` nimetään ohjelma, jonka Claude Desktop käynnistää itse, eikä osoite. Käytä siksi välissä ulkoista työkalua `mcp-remote`, joka vaatii Node.js:n. Valitse Claude Desktop -ohjelmassa *Asetukset › Kehittäjä › Muokkaa asetuksia*, lisää tiedostoon tämä (omalla tokenillasi) ja käynnistä Claude Desktop uudelleen:

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

Token on tarkoituksella kohdassa `env` eikä kohdassa `args`: Windowsissa Claude Desktop rikkoo argumentin, jossa on väli. *Mukautettu liitin* Claudessa (*Mukauta › Liittimet*) ei toimi sillan kanssa. Claude yhdistää silloin Anthropicin pilvestä, eikä se pääse sillalle omalla tietokoneellasi.

Ryhmässä *Kytkentä* on myös kenttä *Token*. Se on pitkä, satunnainen koodi, jonka sovellus luo ja tallentaa tälle tietokoneelle. Ikkunassa lukee *Tämä token antaa pääsyn avoimeen aikatauluun. Älä jaa sitä muille.* Painikkeella *Luo uusi token* luodaan uusi token. Sovellus kysyy ensin *Uuden tokenin luominen katkaisee kaikki nykyiset yhteydet. Jatketaanko?* Jos silta on käynnissä, se käynnistyy uudelleen uudella tokenilla, eikä vanha token toimi enää.

### 4. Katso, mitä tekoäly tekee

1. Klikkaa kohdassa *Toimintaloki* painiketta *Toimintapaneeli*. Sivupalkissa avautuu paneeli *AI-toiminta*.
2. Jokainen sillan kutsu on omalla rivillään, uusin ylimpänä: kellonaika, mitä tapahtui, kuinka kauan se kesti ja onnistuiko se vai ei. Klikkaa riviä, jos halutaan nähdä *Argumentit* ja *Vastaus*.
3. Painikkeella *Tyhjennä* luettelo tyhjennetään. Paneeli säilyttää viimeiset 500 kutsua. Niin kauan kuin mitään ei ole tapahtunut, paneelissa lukee *Ei vielä AI-toimintaa. Sillan kutsut näkyvät tässä.*

Kun AI-tila on päällä, tilarivin oikeassa alareunassa näkyy piste ja teksti *AI*. Pisteen väri kertoo sillan tilan, ja klikkaamalla pistettä siirrytään välilehdelle *AI*.

### 5. Aseta rajat

Kohdassa *Turvallisuus* ovat painikkeet, joilla tekoälyä rajoitetaan:

- *Keskeytä*: tekoäly ei saa tilapäisesti muuttaa mitään, lukeminen on yhä sallittu. Silta pysyy aktiivisena. Painikkeessa lukee *Jatka*.
- *Vain luku*: kaikki työkalut, jotka muuttavat jotakin, estetään, kun tämä on päällä.
- *Auto-varmuuskopio: päällä*: ennen tekoälyn ensimmäistä muutosta asiakirjassa sovellus kirjoittaa IFC-varmuuskopion. Tämä on oletuksena päällä. Painikkeella sen voi kytkeä pois, jolloin siinä lukee *Auto-varmuuskopio: pois*. Tämä tapahtuu kerran asiakirjaa kohden aina, kun silta käynnistetään.
- *Varmuuskopioi nyt*: tekee heti varmuuskopion aktiivisesta asiakirjasta. Sen jälkeen siinä lukee *Varmuuskopio luotu:* ja tiedoston nimi.
- *Avaa varmuuskopiokansio*: avaa kansion, jossa varmuuskopiot ovat.

Varmuuskopiot ovat kansiossa `ai-backups` sovelluksen datakansiossa. Sovellus säilyttää uusimmat varmuuskopiot ja karsii vanhempia. Tarkka tapa on kuvattu artikkelissa [AI-työkalut](docs://ref-ai-tools).

### 6. Varmista, että tekoälyavustaja suunnittelee hyvin

Avustaja suunnittelee hyvin vain, jos se tuntee suunnittelusäännöt. Miksi se on tärkeää ja mitä säännöt sisältävät, kerrotaan artikkelissa [Miten AI-linkki toimii](docs://uitleg-ai-koppeling). Nämä vaiheet tehdään itse:

1. **Ydinsäännöille ei tehdä mitään.** Ne tulevat mukaan yhdistettäessä. Se, laitetaanko ne asiakkaan järjestelmäkehotteeseen, riippuu asiakkaasta.
2. **Pyydä avustajaa lukemaan suunnitteluopas.** Ikkunassa *Kytkentätiedot* oleva yhdistämiskehote pyytää avustajaa lukemaan oppaan työkalulla `planner_get_planning_guide`. Jos kehotetta ei käytetä, pyydä avustajaa itse: *Lue suunnitteluopas työkalulla planner_get_planning_guide ennen kuin muutat mitään.* Oppaan voi lukea myös itse osoitteessa `https://open-planner-studio.open-aec.com/agent/planning-guide.md`.
3. **Valinnainen: asenna taidot.** Tämä toimii vain avustajalla, joka tukee taitoja. Sijoita taitojen *goed-plannen* ja *progress-update* `SKILL.md` polkuihin `.claude/skills/goed-plannen/SKILL.md` ja `.claude/skills/progress-update/SKILL.md` projektikansiossa, jossa avustaja työskentelee. Vaihtoehtoisesti ne voi sijoittaa kansioon `~/.claude/skills/`, jolloin ne ovat käytössä kaikissa projekteissa.

Tiedostot saadaan kahdella tavalla. Pyydä avustajaa kutsumaan työkalua `planner_get_planning_guide`, kun `part` on `skill`: vastaus sisältää molemmat tekstit ja kummallekin taidolle paikan, johon se kuuluu. Tiedostot voi myös ladata osoitteista `https://open-planner-studio.open-aec.com/skills/goed-plannen/SKILL.md` ja `https://open-planner-studio.open-aec.com/skills/progress-update/SKILL.md`. Jos *goed-plannen* on yhä tallella sovelluksen vanhemmasta versiosta, korvaa se: vanha teksti on hollanniksi ja viittaa ohjeartikkeliin eikä avustajien oppaaseen.

Sen, onko avustaja todella lukenut oppaan, näkyy paneelissa *Toimintapaneeli*: silloin siellä on kutsu työkalulle `planner_get_planning_guide`. Avustajan lopullisen vastauksen pitäisi sisältää luettelo tekemistään oletuksista: arvioidut kestot, valittu rakenne, itse luodut riippuvuudet ja jokainen asettamansa rajoite. Jos luettelo puuttuu, pyydä sitä. Edistymispäivityksen jälkeen, kun *progress-update* on käytetty, vastauksessa pitäisi mainita raportointipäivä, uusi loppupäivä ja ero perustasoon verrattuna.

## Ongelmatilanteet ja mitä sovellus silloin tekee

**Tekoäly muuttaa jotakin, minkä halutaan perua.** Jokainen tekoälyn muutos on yksi vaihe, jonka voi perua painikkeella *Kumoa* (Ctrl+Z). Sarja muutoksia, jonka tekoäly välittää yhtenä kokonaisuutena, on yksi vaihe. Sen jälkeen projekti näkyy tallentamattomana. Muutoksen jälkeen aikataulu lasketaan uudelleen, joten näppäintä F5 ei tarvitse painaa itse.

**Sovellus hylkää tekoälyn kutsun.** Kun *Keskeytä* ja *Vain luku* ovat päällä, sovellus hylkää kaikki muutokset. Lukeminen on yhä mahdollista, myös vanhentuneen aikataulun uudelleenlaskenta. Jos muokkaus on kesken, esimerkiksi palkin vetäminen tai kentän kirjoittaminen, tekoäly saa päivämäärät ennen tätä muokkausta ja ilmoituksen, että ne ovat vanhentuneet. Jos ikkuna on auki, esimerkiksi asetukset, tehtäväikkuna tai tervetuloikkuna, tai jos esitystila on päällä, sovellus hylkää kaikki kutsut, myös lukemisen, kunnes ikkuna suljetaan. Tekoäly saa silloin virheilmoituksen, jossa on avoinna olevan asian sisäinen nimi, esimerkiksi `showTaskDialog`. Vain `planner_get_planning_guide` toimii yhä, koska se ei lue aikataulua.

**Välilehden vaihtaminen, kun tekoäly työskentelee.** Tekoäly työskentelee asiakirjassa, johon sen ensimmäinen muutos osui. Jos välilehteä vaihdetaan sillä välin, sovellus hylkää sen seuraavan muutoksen, kunnes tekoäly vahvistaa haluavansa työskennellä toisella välilehdellä. Näin mikään ei päädy väärään projektiin.

**Tekoäly kirjoittaa tai avaa tiedoston.** Tekoäly voi kirjoittaa aikataulun IFC-tiedostona ja avata aikataulutiedoston uutena välilehtenä. Se voi tehdä sen vain käyttäjäkansiossa. Olemassa olevan tiedoston se korvaa vain, jos pyytää sitä nimenomaisesti.

**Tila on *Portti 3877 on varattu*.** Toinen ohjelma käyttää porttia. Sovelluksen viesti näkyy sen alla. Portti-kenttä jää silloin lukituksi (*Muokattavissa vain, kun palvelin on pysäytetty.*), vaikka silta ei ole käynnissä, eikä pysäytyspainiketta ole. Tämä on tunnettu puute. Kunnes asia on korjattu: poista *Ota AI-tila käyttöön* käytöstä ja ota se uudelleen käyttöön. Tila on silloin taas *Pois*, ja portin voi valita. Kopioi sitten kytkentätiedot uudelleen, koska päätepiste sisältää portin.

**Asiakas ei voi yhdistää uuden tokenin jälkeen.** Uusi token katkaisee kaikki nykyiset yhteydet. Anna asiakkaalle uusi token tai liitä asetuskatkelma uudelleen.

**Silta pysäytettiin käsin, eikä se käynnisty itsestään.** *Käynnistä silta automaattisesti* toimii kerran aina, kun sovellus käynnistyy. Jos sillan pysäyttää itse, sovellus ei käynnistä sitä hiljaa uudelleen.

**Välilehti *AI* on poissa.** AI-tila on pois päältä. Ota se käyttöön vaiheessa 1.

**Verkkosivu selaimessa ei voi keskustella sillan kanssa.** Silta hylkää jokaisen pyynnön, joka tulee selaimesta, ja jokaisen pyynnön, jossa ei ole oikeaa tokenia.

## Katso myös

- [Palautteen antaminen](docs://howto-feedback-geven): jos yhteys toimii eri tavalla kuin tässä kuvataan, ilmoita siitä.
- [Miten AI-linkki toimii](docs://uitleg-ai-koppeling): mitä linkki on, miksi avustaja työskentelee avoimessa projektissa ja mitä se ei saa tehdä.
- [AI-työkalut](docs://ref-ai-tools): kaikki `planner_*`-työkalut ryhmittäin, virhekoodit ja se, kuinka kauan varmuuskopioita säilytetään.
- [Hyvä suunnittelu](docs://gids-goed-plannen): suunnitteluperiaatteet. Avustaja saa ne englanninkielisenä versiona, johon on lisätty työkalut.
- [Asetukset](docs://ref-instellingen): tekoälyn asetukset.

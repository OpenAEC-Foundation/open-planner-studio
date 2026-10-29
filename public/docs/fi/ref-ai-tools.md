# Tekoälytyökalut (planner_*)

Tässä luetellaan kaikki työkalut, joita tekoälyavustaja voi kutsua sillan kautta. Kaikkien nimet alkavat etuliitteellä `planner_`. Kytkentäkehote *Kytkentätiedot* -ikkunassa näyttää nykyisen numeron. Tekoälyavustaja saa koko luettelon kuvauksineen sillalta itseltään (`tools/list`). Miten AI-kytkentä toimii, kerrotaan kohdassa [Miten AI-kytkentä toimii](docs://uitleg-ai-koppeling). Miten kytkentä otetaan käyttöön, kerrotaan kohdassa [Tekoälyavustajan yhdistäminen (MCP)](docs://howto-ai-assistent-koppelen).

## Tämän luettelon lukeminen

**Lukeminen** tarkoittaa: työkalu ei muuta mitään. Se toimii myös, kun *Keskeytä* tai *Vain luku* on päällä. Auki oleva valintaikkuna estää sen kuitenkin (katso alla kohta *Kun työkalu hylätään*). Lukutyökalu antaa aina ajantasaiset päivämäärät. Jos aikataulu ei ole ajan tasalla, työkalu laskee sen ensin uudelleen. Tämä tehdään myös, kun *Keskeytä* tai *Vain luku* on päällä. Nämä estävät vain muutokset, eivät laskentaa lukemisen aikana. Jos muokkaus on kesken (palkin vetäminen, kentän kirjoittaminen), aikataulua ei lasketa uudelleen. Tekoälyavustaja saa silloin päivämäärät ennen muokkausta. Mukana on ilmoitus, että ne eivät ole ajan tasalla. Jos projekti on näkymässä *Tallennetut päivämäärät*, aikataulua ei lasketa uudelleen. Tekoälyavustaja saa silloin tallennetut päivämäärät ja ilmoituksen, että niitä ei ole laskettu uudelleen.

**Muutos** tarkoittaa: työkalu muuttaa projektia. Se hylätään, kun *Keskeytä* tai *Vain luku* on päällä, tai kun valintaikkuna on auki. Sama koskee työkaluja ilman merkintää alla (`planner_undo`, `planner_redo`, tiedostotyökalut ja asiakirjatyökalut, paitsi `planner_list_documents`). Jokainen muutos on yksi vaihe kumoamishistoriassa. Kun projektitiedot muuttuvat, sovellus laskee aikataulun uudelleen itse. Painiketta *Laske* ei tarvitse painaa. Ennen asiakirjan ensimmäistä muutosta sovellus kirjoittaa varmuuskopion, jos *Automaattinen varmuuskopiointi* on päällä.

**Joukkokäsittely** tarkoittaa: yksi kutsu voi sisältää useita kohteita. Virheellinen kohde hylätään syyn kanssa. Kelvolliset kohteet jäävät voimaan. Vastauksessa nimetään hylätyt kohteet.

## Luku: aikataulu

- `planner_get_project_info` (luku) — projektin tiedot ja tärkeimmät luvut: tehtävien, riippuvuuksien, resurssien ja välitavoitteiden määrä, raportointipäivä, projektin loppu ja kesto, tieto siitä, onko aikataulu ajan tasalla, laskentaprofiili ja kalenterien yhteenveto. Hyvä ensimmäinen kutsu.
- `planner_get_project_overview` (luku) — koko WBS-puu yhdessä vastauksessa: tehtävätunnuksittain WBS, nimi, kesto, aikaisimmat päivämäärät, edistyminen, tieto siitä, onko kriittinen, ja lähtevät riippuvuudet riippuvuuden tunnuksineen.
- `planner_list_tasks` (luku) — tehtävät suodattimilla (kriittinen, tila, päivämääräväli, tehtävät ilman riippuvuuksia) ja sivutuksella.
- `planner_get_task` (luku) — yksi tehtävä tarkasti: päivämäärät, pelivara, edistyminen, rajoitteet, tavoitepäivä, kalenteri, resurssikohdistukset, edeltäjät ja seuraajat sekä tauot.
- `planner_get_critical_path` (luku) — kriittiset tehtävät kokonaispelivaroineen ja riippuvuudet, jotka määräävät polun.
- `planner_list_resources` (luku) — resurssit kapasiteetin, normaalihinnan, kalenterin, työryhmän ja saatavuuden sekä yhteenvedon niiden resurssikohdistuksista. Jos resurssi tulee kirjastosta, näytetään, mitkä kentät ovat lukittuja.
- `planner_get_resource_histogram` (luku) — kuormitus suhteessa kapasiteettiin resursseittain, päivittäin, viikoittain tai kuukausittain (oletuksena viikoittain). Ilman aikaväliä ja resursseja se antaa yhteenvedon resursseittain. Aikavälin tai resurssien kanssa se antaa koko sarjan ja tehtävät, jotka aiheuttavat ylikuormituksen.
- `planner_get_calendars` (luku) — kaikki kalenterit koko määritelmineen ja tieto siitä, kuinka monta tehtävää ja resurssia kukin käyttää.

## Luku: perustasot ja erot

- `planner_list_baselines` (luku) — tallennetut perustasot ja se, joka on aktiivinen.
- `planner_compare_baseline` (luku) — nykyinen suunnitelma verrattuna aktiiviseen perustasoon: vain tehtävät, jotka eroavat, ja ero projektin lopussa työpäivinä nykyisen projektikalenterin mukaan. Ilman aktiivista perustasoa työkalu hylkää kutsun.
- `planner_analyze_delay` (luku) — myöhästymisanalyysi aktiiviseen perustasoon verrattuna: ero toimituksessa ja kriittiset tehtävät, jotka ovat siirtyneet. Ilman aktiivista perustasoa työkalu hylkää kutsun.

## Tehtävät ja rakenne

- `planner_add_tasks` (muutos, joukkokäsittely) — luo tehtäviä, myös sisäkkäisen WBS:n yhdellä kutsulla. Jokainen tehtävä saa oman väliaikaisen nimen (`tmp-…`), jotta lapsitehtävä voi viitata emotehtäväänsä. Ilman kestoa tehtävä saa 5 työpäivää. Välitavoitteen kesto on 0. Kaikki saman kutsun tehtävät onnistuvat yhdessä tai epäonnistuvat yhdessä.
- `planner_update_tasks` (muutos, joukkokäsittely) — muuttaa olemassa olevien tehtävien kenttiä: nimi, kuvaus, kesto päivissä tai tunneissa, keston tyyppi, työlaji, välitavoite, pakollisuus, prioriteetti, rajoite, tavoitepäivä, kalenteri ja tehtävätyyppi. Mukana on myös edistymiskentät: prosenttia valmiina, toteutunut alkamispäivä ja toteutunut valmistumispäivä. Muu kenttä hylätään syyn kanssa.
- `planner_delete_tasks` (muutos) — poistaa tehtäviä, mukaan lukien koko alipuun, riippuvuudet ja resurssikohdistukset. Vastauksessa nimetään tarkasti, mitä niiden mukana poistui.
- `planner_move_task` (muutos) — siirtää tehtävän toisen emotehtävän alle tiettyyn paikkaan. Kehäviite tai tehtävän sijoittaminen itsensä alle hylätään.
- `planner_set_task_splits` (muutos) — asettaa yhden tehtävän tauot: kuinka monen työpäivän (tai työtunnin) työn jälkeen ja kuinka monen työpäivän (tai työtunnin) tauko tulee. Tyhjä luettelo poistaa kaikki tauot. Katso [Tehtävän jakaminen](docs://howto-taak-splitsen).

## Riippuvuudet

- `planner_add_dependencies` (muutos, joukkokäsittely) — luo riippuvuuksia tyypillä (`FS`, `SS`, `FF`, `SF` tai pitkä muoto) ja viiveellä, esimerkiksi `+2d`.
- `planner_update_dependencies` (muutos, joukkokäsittely) — muuttaa olemassa olevan riippuvuuden tyyppiä, viivettä, edeltäjää tai seuraajaa riippuvuuden tunnuksen perusteella. Se on yksi vaihe, eikä riippuvuutta tarvitse poistaa ja luoda uudelleen.
- `planner_remove_dependencies` (muutos, joukkokäsittely) — poistaa riippuvuuksia riippuvuuden tunnuksen perusteella.

## Projekti ja kalenterit

- `planner_update_project` (muutos) — nimi, kuvaus, tekijä, yritys, aloituspäivä, loppupäivä, raportointipäivä, edistymistapa ja projektin oletus tehtävätyypille. Aloituspäivä on uusien tehtävien ankkuri. Jos tekoälyavustaja asettaa sen myöhemmin, siirtyvät vain vapaat tehtävät (ilman edeltäjää ja ilman rajoitetta, joka asettaa alarajan, kuten *alkaa aikaisintaan*). Vastauksessa ilmoitetaan niiden määrä kenttänä `anchorsClamped`. Muu aikataulu pysyy paikallaan. Katso [Uusi projekti ja projektitiedot](docs://ref-projectinfo). Raportointipäivä ei ole pelkkä merkintä, vaan laskennan vertailupäivä: aikataulussa ilman edistymistä kaikki siirtyy mukana. Loppupäivä on vain tietoa.
- `planner_move_project` (muutos) — siirtää koko nykyisen aikataulun uuteen aloituspäivään. Kalenterit eivät siirry mukana, joten loppu voi hypätä eri määrän päiviä kuin alku. Perustasot pysyvät paikallaan, ellei tekoälyavustaja erikseen pyydä niitä siirtymään myös. Katso [Projektin siirtäminen](docs://howto-project-verplaatsen).
- `planner_update_calendar` (muutos, joukkokäsittely) — muuttaa tai luo kalentereita: työpäivät, työtunnit, tauko, tuntilohkot, vapaapäivät (luodaan maan ja alueen mukaan tai määritetään suoraan) ja poikkeukselliset työpäivät. Se ei voi vaihtaa, mikä kalenteri on projektikalenteri.

## Resurssit ja kuormitusasteet

- `planner_manage_resources` (muutos, joukkokäsittely) — luo, muuttaa tai poistaa resursseja: nimi, tyyppi (labor, equipment, material, subcontractor tai crew), kuvaus, enimmäismäärä, normaalihinta tunnissa, aikaperuste, kalenteri, työryhmä ja saatavuus ajan mukaan. Resurssia, jolla on resurssikohdistuksia, ei poisteta ennen kuin tekoälyavustaja vahvistaa sen erikseen. Kirjaston resurssilla nimi, tyyppi, kuvaus, normaalihinta ja aikaperuste ovat lukittuja.
- `planner_manage_assignments` (muutos, joukkokäsittely) — lisää, muuttaa, siirtää tai poistaa resurssikohdistuksia: kuormitusaste työpäivää kohden, käyrä ja jäljellä oleva työ. Vain lehtitehtävään, ja saman resurssin voi kohdistaa tehtävään vain kerran. Mitä kuormitusasteen muutos tekee kestolle, riippuu tehtävän tehtävätyypistä, kuten kohdassa [Tehtävätyypit: kesto, kuormitusaste ja työ](docs://uitleg-werkregels).
- `planner_level_resources` (muutos) — tasaa ylikuormituksen. Oletuksena tasaaminen tapahtuu pelivaran sisällä, joten loppupäivä pysyy. Kun `constrainToFloat: false`, loppupäivä voi siirtyä. Koeajolla tekoälyavustaja saa ensin esikatselun, eikä mitään muuteta. Materiaaliresurssit ohitetaan. Katso [Resurssien tasaaminen](docs://uitleg-nivelleren).
- `planner_clear_leveling` (muutos) — poistaa kaikki tasaamisviiveet.

## Perustasojen hallinta

- `planner_save_baseline` (muutos) — tallentaa nykyisen aikataulun perustasona ja tekee sen heti aktiiviseksi. Ennen tallennusta se laskee vanhentuneet päivämäärät uudelleen. Sitä ei voi käyttää komentosarjassa.
- `planner_activate_baseline` (muutos) — tekee perustason aktiiviseksi tai ei yhtään.
- `planner_rename_baseline` (muutos) — nimeää perustason uudelleen.
- `planner_delete_baseline` (muutos) — poistaa yhden perustason. Jos se oli aktiivinen, jäljelle jäänyt viimeinen perustaso tulee aktiiviseksi. Jos mitään ei jää, aktiivista perustasoa ei ole.

## Kumoaminen

- `planner_undo` ja `planner_redo` — kumoavat tai tekevät uudelleen yhden vaiheen aktiivisessa asiakirjassa. Historia on sama kuin käyttäjän oma historia. Vastauksessa kerrotaan, onko jotakin todella kumottu.

## Asiakirjat ja tiedostot

- `planner_list_documents` (luku) — kaikki avoimet asiakirjat nimineen, tieto siitä, ovatko ne aktiivisia ja muokattuja, tehtävien määrä, projektin aloituspäivä ja lasketty loppu.
- `planner_new_document` — uusi tyhjä asiakirja omassa välilehdessään, ilman *Uusi projekti* -ikkunaa.
- `planner_duplicate_document` — kopioi aktiivisen asiakirjan uuteen välilehteen, esimerkiksi mitä-jos-laskelmaa tai tarjousvarianttia varten. Kopio irrotetaan alkuperäisestä, eikä sillä ole tiedostopolkua.
- `planner_switch_document` — tekee toisen asiakirjan aktiiviseksi. Sillä varmistetaan myös, mihin asiakirjaan tekoälyavustaja työskentelee, kun välilehteä on vaihdettu.
- `planner_import_schedule` — avaa aikataulutiedoston levyltä asiakirjana: `.ifc`, `.xml` (Primavera P6 tai MS Project, tunnistetaan sisällön perusteella), `.csv`, `.xer` ja `.mpp` (MS Project 2010–2021). Mitään ei yhdistetä nykyiseen suunnitelmaan. CSV-tiedostossa ei ole kalenteria, joten päivämäärät voivat siirtyä. Vain käyttäjäkansiosta. CSV-, XML- tai `.mpp`-tuonnin jälkeen asiakirjalla ei ole tallennuskohdetta. Vain IFC-tiedosto antaa asiakirjalle tallennuskohteen.
- `planner_export_ifc` — kirjoittaa aktiivisen asiakirjan IFC-tiedostoksi projektin IFC-skeemassa (oletus IFC 4.3 ADD2). Vain käyttäjäkansioon, ja olemassa oleva tiedosto korvataan vain erikseen pyydettäessä. Jos asiakirja on avattu skeemassa, jota sovellus ei voi kirjoittaa (esimerkiksi IFC2X3), työkalu ei kirjoita tiedoston päälle. Projekti jää tallentamatta.

## Opas ja lähteen alkuperä

- `planner_get_planning_guide` (luku) — englanninkielinen opas tekoälyavustajille (periaatteet kohdasta [Hyvin suunnitteleminen](docs://gids-goed-plannen), työkaluineen kullekin periaatteelle) sekä kaksi taitoa, *goed-plannen* (aikataulun laatiminen) ja *progress-update* (edistymisen päivittäminen), tai kaikki. Valitse `part`-parametrilla: `guide`, `skill` (molemmat taidot) tai `both`. Oletus on `both`. Vastauksessa kerrotaan kullekin taidolle, mihin se kuuluu, ja latausosoitteet. Parametri `language` hyväksytään yhä vanhemmille tekoälyavustajille, mutta teksti on aina englanniksi. Aikataulua ei muuteta.
- `planner_inspect_xer_provenance` (luku) — tarkastaa avatun Primavera P6 -tiedoston (`.xer`) säilytetyn lähdemerkityksen: mitä tiedosto sisälsi, sekä tuonnin ja diagnoosin määrät. Vapaatekstikentät eivät näy oletuksena. Tekoälyavustajan on pyydettävä ne erikseen. Resurssien nimet piilotetaan myös oletuksena, koska P6-resurssi on yleensä henkilö. Resurssikoodit näkyvät. Tekoälyavustajan on kysyttävä lupa ennen kuin se pyytää resurssien nimet, koska ne menevät silloin tekoälyntarjoajalle. Sitä ei voi käyttää komentosarjassa.

## Komentosarja

- `planner_batch` — suorittaa komentosarjan, jossa on enintään 100 vaihetta, yhtenä muutoksena: yksi kumoamisvaihe, yksi uudelleenlaskenta ja yksi varmuuskopio. Jos vaihe epäonnistuu rakenteellisesti, koko komentosarja perutaan. Vastauksessa kerrotaan vaiheittain, mitä tehtiin, mikä epäonnistui ja mihin ei päästy. `planner_add_tasks`-työkalun väliaikaiset nimet (`tmp-…`) toimivat myöhemmissä vaiheissa. Vaiheena ei sallita: `planner_batch` itse, kumoaminen ja uudelleen tekeminen, asiakirja- ja tiedostotyökalut, `planner_save_baseline`, `planner_get_planning_guide` ja `planner_inspect_xer_provenance`. Komentosarja ei ole ohjelmointikieli: siinä ei ole muuttujia, ehtoja eikä silmukoita.

## Kun työkalu hylätään

Tekoälyavustaja saa silloin vastauksen, jossa on virhekoodi ja selitys.

- `PAUSED` — *Keskeytä* on päällä.
- `READ_ONLY` — *Vain luku* on päällä.
- `DIALOG_OPEN` — valintaikkuna on auki. Tämä koskee myös lukemista, paitsi työkalua `planner_get_planning_guide`. Vastauksessa nimetään, mikä on auki, sen sisäisellä nimellä, esimerkiksi `showTaskDialog`.
- `DOC_DRIFT` — välilehti vaihdettiin, kun tekoälyavustaja työskenteli. Tekoälyavustajan on vahvistettava `planner_switch_document`-työkalulla, mihin asiakirjaan se työskentelee.
- `VALIDATION` — argumentit eivät vastaa skeemaa, tai pyydettyä muutosta ei sallita. Vastauksessa nimetään kenttä.
- `NOT_FOUND` — tunnusta tai asiakirjaa ei ole olemassa.
- `CYCLE` — muutos luisi kehän. Kaikki tämän kutsun muutokset perutaan.
- `SCOPE` — tiedostopolku on käyttäjäkansion ulkopuolella.
- `BACKUP_FAILED` — muutosta edeltävä varmuuskopio epäonnistui. Muutosta ei tehty.
- `INTERNAL` — työkalun suorituksessa tapahtui odottamaton virhe, esimerkiksi epäonnistunut tiedostotoiminto. Vastauksessa on alkuperäinen virheviesti.
- `STALE_PRECONDITION` — kuuluu sillan sopimukseen, mutta yksikään nykyinen työkalu ei palauta tätä koodia.

Pyyntöä, joka odotti jonossa yli 110 sekuntia, sovellus ei enää suorita. Asiakas on jo saanut aikakatkaisun. Suorittaminen muuttaisi asioita kahdesti, jos pyyntö lähetettäisiin uudelleen. Kutsu, joka kestää yli 120 sekuntia, saa sillalta aikakatkaisun.

## Mitä tekoälyavustaja ei voi asettaa

Tehtävän tasolla tekoälyavustaja ei voi asettaa seuraavia: riippumatto, manuaalisesti ajoitettu tila, toinen rajoite, muistiinpanot, väri, tehtäväkoodit, mukautetut kentät, ulkoiset riippuvuudet eikä tasaamisviivettä käsin. Sovellus laskee WBS-koodin itse. Projektitasolla tekoälyavustaja ei voi muuttaa laskentaprofiilia eikä laskennan asetuksia. Asetukset, teema, kieli, laajennukset ja päivitykset ovat tekoälyavustajan ulottumattomissa, samoin resurssikirjasto. Avustajalla ei myöskään ole raportteja, asetteluja, suodattimia tai näkymiä. Syy kerrotaan kohdassa [Miten AI-kytkentä toimii](docs://uitleg-ai-koppeling).

## Mitä sovellus tallentaa

- **Token** on tässä tietokoneessa, sovelluksen tallennetuissa asetuksissa. Se on 64 merkkiä pitkä ja satunnainen. *Luo uusi token* korvaa sen.
- **Portti** on oletuksena 3877. Sitä voi muuttaa vain, kun silta on pysäytetty.
- **Toimintapaneeli** tallentaa viimeiset 500 kutsua, vain sovelluksen ollessa auki. Kentän argumentit ja vastaukset katkaistaan 20 kB:n kohdalta. *Tyhjennä* tyhjentää luettelon.
- **Varmuuskopiot** ovat kansiossa `ai-backups` sovelluksen datakansiossa. *Avaa varmuuskopiokansio* vie kyseiseen kansioon. Ne nimetään muotoon `<project name>-<timestamp>.ifc`. Tallennetulla projektitiedostolla on yksi kansio kaikissa istunnoissa. Asiakirjalle, jota ei ole koskaan tallennettu, tehdään oma kansio jokaisessa istunnossa. Kun silta käynnistetään, kustakin asiakirjasta tehdään yksi varmuuskopio. Lisäksi voi tehdä varmuuskopioita painikkeella *Varmuuskopioi nyt*.
- **Karsiminen** tapahtuu itsestään, kansio kerrallaan. Viimeisen 7 päivän varmuuskopiot säilyvät kaikki, enintään 20 kappaletta. Käynnissä olevan istunnon varmuuskopiot säilyvät aina. Sen jälkeen säilyy yksi kappale viikossa enintään 30 päivää vanhoista, yksi kuukaudessa enintään vuoden vanhoista ja sen jälkeen yksi vuodessa. Asiakirjan, jota ei ole koskaan tallennettu, varmuuskopiot poistuvat kokonaan vuoden kuluttua. Kansion tiedostoihin, jotka eivät kuulu sovellukseen, ei kosketa.

## Katso myös

- [Miten AI-kytkentä toimii](docs://uitleg-ai-koppeling): miksi silta on rakennettu näin ja mitä tekoälyavustaja saa ja ei saa tehdä.
- [Tekoälyavustajan yhdistäminen (MCP)](docs://howto-ai-assistent-koppelen): käynnistä silta, yhdistä ja asenna taito.
- [Asetukset](docs://ref-instellingen): kaksi AI-kytkintä.
- [Ilmoitukset ja varoitukset](docs://ref-meldingen): AI-piste tilarivillä.

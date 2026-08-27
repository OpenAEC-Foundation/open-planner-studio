# Instellingen

Het venster **Instellingen** bevat de app-instellingen: voorkeuren die op dit apparaat gelden, los van het projectbestand. Elke wijziging wordt direct toegepast en bewaard — er is geen OK-knop. Reken-opties die de berekende planning veranderen staan níet hier maar bij het project — zie [Projectinformatie](docs://ref-projectgegevens).

## Openen — drie ingangen, zelfde inhoud

- Het **tandwiel** (⚙) in de titelbalk.
- **Instellingen** (ribbontab) → lintgroep **Project** → **Instellingen**.
- **Bestand** → **Instellingen** (Backstage).

Alle drie tonen exact dezelfde instellingen. Afhankelijk van je versie staan ze verdeeld over drie
of vier tabs — een vierde, **Toepassing**, is onlangs afgesplitst van het staartje van de eerste tab
— maar de instellingen zelf en wat ze doen zijn in beide gevallen identiek; dit artikel groepeert ze
als **Algemeen**, **Taal** en **Tijdlijn / Zoomen**.

## Tab Algemeen

**Weergave:**

- **Thema** — **Donker**, **Licht** of **Hoog contrast**; klik op een kaartje om te wisselen.
- **Lettertype** — **Standaard**, **Systeem**, **Met schreef** of **Monospace**; overschrijft het lettertype van de interface. Web-apps volgen niet automatisch de systeemlettertype-instelling, dus dit en de volgende instelling zijn hoe je het zelf kiest.
- **Tekengrootte** — 90%, 100%, 110% of 125%; schaalt de interface-tekst en -indeling.
- **Documentwissel-stijl** — hoe je tussen geopende documenten wisselt: **Horizontale tabbladen**, **Verticale tabbladen** of **Pil**.
- **Datumnotatie** — **dd-mm-jjjj**, **mm-dd-jjjj** of **jjjj-mm-dd**. Bepaalt alleen de weergave; bestanden en berekeningen blijven ongewijzigd.
- **Bouwmodus** — **Bouwmodus inschakelen** wisselt de standaarden voor *nieuwe* projecten tussen bouwgericht (een bouwkalender met NL-feestdagen, bouwvak, faseringssjablonen) en een neutrale, bouw-agnostische opzet. Bestaande projecten blijven in beide gevallen ongewijzigd.

**Toepassing:**

- **Versie** — het versienummer van de app (alleen-lezen), met een link **Controleren op updates** die het update-venster opent. Updates installeren werkt alleen in de desktop-app; Snap- en AppImage-installaties updaten via hun eigen kanaal. Los daarvan verschijnt de eerste keer dat je de app opent nadat die zichzelf automatisch heeft bijgewerkt, vanzelf een eenmalige "Je bent net geüpdatet"-dialoog — de versiesprong, het grootteverschil van de installer, het aantal dagen sinds de vorige release en de GitHub-releasebeschrijving, voor zover die op te halen waren. Dat is een ander, automatisch moment dan de handmatige link **Controleren op updates** hierboven.
- **Projectinformatie...** — een snelkoppeling naar het venster [Projectinformatie](docs://ref-projectgegevens).
- **Rondleiding** — **Rondleiding starten** speelt de introductie-rondleiding opnieuw af. Dezelfde herstart zit ook in ribbontab **Beeld** → **Rondleiding** en in de Backstage (**Bestand** → **Rondleiding starten**).
- **Benchmark** — opent de ingebouwde benchmark-tool, om de reken-/renderprestaties van deze machine te meten. Je kiest een planningsgrootte en het aantal resources; de gegenereerde planning heeft een echt relatienetwerk, waarin elke taak zonder subtaken minstens één relatie krijgt. Kies nul resources om te zien wat de resourcebelasting zelf kost.
- **AI-modus** — **AI-modus inschakelen** toont het lint-tabblad **AI** met de MCP-bridge, zodat een AI-assistent via het Model Context Protocol met je planning kan werken; uitzetten stopt een lopende bridge meteen. **Bridge automatisch starten** (alleen beschikbaar met AI-modus aan) zet de bridge meteen live bij het opstarten van de app, zonder eerst het AI-tabblad te hoeven openen — alleen in de desktop-app. Zie de in-app AI-assistent-gids voor het volledige verhaal.
- **Debug-terminal** — **Debug-terminal inschakelen** toont het logpaneel voor probleemonderzoek.

## Tab Taal

- **Taal** — de weergavetaal van de app, direct toegepast.

## Tab Tijdlijn / Zoomen

- **Urenplanning** — **Urenplanning inschakelen** zet uren-/minuten-scheduling aan: een uur-tijdschaal, ploegen met werktijd-banden en uur-precieze taakbalken. Uit ⇒ nieuwe taken starten in dagen; bestaande urentaken blijven exact bewaard. Met de schakelaar aan kunnen dag- en urentaken vanzelf naast elkaar bestaan. Zie [Kalenders & uren-planning](docs://gids-kalenders-uren).
- **Duurweergave** — **Automatisch (eigen eenheid per taak)**, **Altijd dagen** of **Altijd uren**.
- **Taakbalken bij onderbrekingen** — **Nooit opsplitsen**, **Opsplitsen bij selectie** of **Altijd opsplitsen**: of een balk visueel splitst rond niet-werkdagen.
- **Tijd-as** — **Alleen werkbare dagen tonen** comprimeert de tijdlijn: weekenden en feestdagen uit de projectkalender worden overgeslagen, zodat een taak van 5 werkdagen precies 5 kolommen breed is, ongeacht wat de kalender daartussen doet.
- **Week begint op** — **Maandag** of **Zondag** (weekindeling van de tijdschaal).
- **Kwartieren tonen bij ver inzoomen** — extra kwartier-gradatie op de uur-tijdschaal.
- **Berekenen** — **Automatisch berekenen** herberekent de planning zodra die verouderd raakt, in plaats van te wachten op F5.
- **Scrollen & zoomen** — **Modus**:
- **Zoom + slepen** (de standaard) — scrollwiel zoomt (gecentreerd op de cursor); de achtergrond van de planning versleep je om te verschuiven; Shift+scrollwiel scrolt door de rijen; Ctrl/⌘+slepen tekent een selectiekader.
- **Positie** — de plek van de cursor bepaalt de scrollrichting; met **Schermverdeling** (**Links/rechts**, **Boven/onder** of **Rechtsboven-hoek**). Ctrl+scroll = zoomen, Shift+scroll = horizontaal.
- **Toetsen** — wijs zelf toe welke besturing (**Scrollen**, **Ctrl + scrollen**, **Shift + scrollen**) welke functie krijgt (**Verticaal**, **Horizontaal**, **Zoomen**) door de knopjes te verslepen; een bezette plek wisselt om.

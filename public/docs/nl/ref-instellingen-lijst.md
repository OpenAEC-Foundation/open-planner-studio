# Instellingen

Elke instelling van de app: wat ze doet, wat de beginwaarde is, wat er verandert en waar je haar vindt. Voor de rekenopties van een project (rekenprofiel, kritiek-definitie) zie [Rekenopties en conventies](docs://ref-rekenopties-en-conventies): die horen bij het projectbestand, niet bij de app.

## Waar vind je ze en hoe werken ze

Het instellingenpaneel staat op drie plekken, en overal is het hetzelfde paneel: het tandwiel bovenin het venster, *Instellingen › Project › Instellingen* en *Bestand › Instellingen*. Het paneel heeft drie tabbladen: *Weergave*, *Planning* en *Geavanceerd*. Bij elke instelling hieronder staat alleen het tabblad.

Een wijziging werkt direct. Er is geen knop *Toepassen* en geen *Annuleren*.

**App-breed, niet per project.** Alle instellingen in dit artikel gelden voor al je projecten en horen bij dit apparaat. De app bewaart ze in de opslag van de app of van je browser, niet in het projectbestand. Iemand anders die je bestand opent, ziet dus zijn eigen instellingen. Een browser waarvan je de opslag wist, begint weer met de beginwaarden.

## Tabblad Weergave

**Thema** — het kleurenschema van de interface. Keuze uit *Donker*, *Licht* en *Hoog contrast*. Standaard: *Donker*. Effect: kleuren van de hele interface, ook de Gantt en het histogram. Waar: *Weergave*.

**Volg systeemthema** — laat het kleurenschema van je besturingssysteem kiezen. Standaard: uit. Effect: de app is *Licht* of *Donker*, naar wat je systeem heeft; de drie themakaarten staan dan uit. *Hoog contrast* volgt je systeem niet: dat kies je zelf. Zet je de schakelaar uit, dan blijft het thema staan dat op dat moment in beeld was. Waar: *Weergave*, onder *Thema*.

**Taal** — de taal van de interface. Standaard: de taal van je browser of systeem als de app die kent, anders Engels. Effect: alle teksten in de app; de veertien talen staan gesorteerd op hun korte code. Arabisch en Perzisch spiegelen de interface van rechts naar links. De taal van de Help-artikelen stel je apart in, bij *Documentatietaal* in *Bestand › Help*. Waar: *Weergave*.

**Lettertype** — het lettertype van de hele interface. Keuze uit *Standaard*, *Systeem*, *Met schreef* en *Monospace*. Standaard: *Standaard*. Effect: koppen en tekst in het venster, en de tekst in de Gantt en het histogram. Een webapp volgt het lettertype van je systeem niet vanzelf; daarom kies je het hier. Waar: *Weergave*.

**Tekengrootte** — schaal van de interface. Keuze uit 90%, 100%, 110% en 125%. Standaard: 100%. Effect: tekst en indeling van het lint, de panelen en dialogen worden groter of kleiner, en de rijhoogte van de tabel en de Gantt schaalt mee. Boven 125% is er geen keuze, omdat de knoplabels in het lint dan over meerdere regels breken. Waar: *Weergave*.

**Datumnotatie** — hoe datums in de app staan. Keuze uit *dd-mm-jjjj*, *mm-dd-jjjj* en *jjjj-mm-dd*. Standaard: *dd-mm-jjjj*. Effect: datums in de tabel, de dialogen, de rapporten en de afdruk. Bestanden en berekeningen veranderen niet: alleen de weergave. Waar: *Weergave*.

**Duurweergave** — in welke eenheid de duur van een taak staat. Keuze uit *Automatisch (eigen eenheid per taak)*, *Altijd dagen* en *Altijd uren*. Standaard: *Automatisch (eigen eenheid per taak)*. Effect: in het taakraster, de balklabels van de Gantt, de tooltip, de afdruk en de rapporten. Bij *Automatisch* toont een dagtaak dagen en een urentaak uren. Bij *Altijd dagen* of *Altijd uren* rekent de app om met de uren per dag van de taakkalender en zet, als de eenheid van de taak verschilt, de eigen eenheid erachter tussen haakjes, bijvoorbeeld `2,25d(18h)`. Alleen de weergave verandert; de taak houdt haar eigen eenheid. Waar: *Weergave*.

**Documentwissel-stijl** — hoe je wisselt tussen geopende projecten. Keuze uit *Horizontale tabbladen*, *Verticale tabbladen* en *Pil*. Standaard: *Horizontale tabbladen*. Effect: bij *Horizontale tabbladen* staat een tabbalk onder het lint; bij *Verticale tabbladen* een projectbalk links; bij *Pil* een kleine projectknop in de titelbalk. Waar: *Weergave*.

### Onderdeel Gantt

**Alleen werkbare dagen tonen** — comprimeert de tijd-as. Standaard: uit. Effect: weekenden en feestdagen uit de projectkalender worden overgeslagen, zodat een taak van 5 werkdagen precies 5 kolommen breed is. De sneltoetsen voor *Spring naar vandaag* en *Passend maken op project* tellen dan ook in werkdagen. Het rapport heeft een eigen vinkje met dezelfde naam, dat los van deze instelling staat. Waar: *Weergave*, onder *Gantt › Tijd-as*.

**Kwartieren tonen bij ver inzoomen** — extra fijne tijdschaal. Standaard: uit. Effect: je kunt verder inzoomen en de uurschaal krijgt een extra kwartierrij. Een urenbalk slepen kan dan op kwartieren snappen in plaats van op hele uren. Je ziet dit alleen als *Urenplanning inschakelen* aan staat. Waar: *Weergave*, onder *Gantt › Kwartierzoom*.

**Taakbalken bij onderbrekingen** — of een urentaak in blokken wordt getekend. Keuze uit *Nooit opsplitsen*, *Opsplitsen bij selectie* en *Altijd opsplitsen*. Standaard: *Opsplitsen bij selectie*. Effect: de balk van een urentaak wordt dan per werkblok getekend in plaats van als één doorlopend blok. *Opsplitsen bij selectie* doet dat alleen voor de geselecteerde taak. Het gaat alleen over urentaken; een echt gesplitste taak (met *Taak splitsen*) toont haar onderbreking los van deze instelling. Waar: *Weergave*, onder *Gantt*.

**Scrollen & zoomen › Modus** — wat het scrollwiel boven de Gantt doet. Keuze uit *Positie*, *Toetsen* en *Zoom + slepen*. Standaard: *Zoom + slepen*. Effect: bij *Zoom + slepen* zoomt het wiel rond de cursor, scrolt Shift+wiel door de rijen, verschuif je de tijdlijn door de achtergrond te slepen en maakt Ctrl+slepen (Cmd op een Mac) een selectiekader. Bij *Positie* hangt de functie van het wiel af van waar je cursor staat; Ctrl+wiel zoomt altijd en Shift+wiel scrolt altijd horizontaal. Bij *Toetsen* kies je zelf welke toets wat doet. De keuze geldt ook voor de tweede tijdlijn van de split view. Waar: *Weergave*, onder *Gantt › Scrollen & zoomen*.

**Scrollen & zoomen › Schermverdeling** — waar de cursor staat voor welke functie. Alleen zichtbaar bij de modus *Positie*. Keuze uit *Links/rechts*, *Boven/onder* en *Rechtsboven-hoek*. Standaard: *Links/rechts*. Effect: bij *Links/rechts* scrolt het wiel verticaal boven de linker helft en horizontaal boven de rechter helft. Bij *Boven/onder* scrolt het wiel horizontaal boven de bovenste 30% (bij de tijdschaal) en verticaal daaronder. Bij *Rechtsboven-hoek* scrolt het wiel horizontaal in het rechterbovenkwadrant en verticaal in de rest. Waar: *Weergave*, onder *Gantt › Scrollen & zoomen*.

**Scrollen & zoomen › Verticaal, Horizontaal, Zoomen** — welke toets bij welke wielfunctie hoort. Alleen zichtbaar bij de modus *Toetsen*. Per functie kies je uit *Scrollen*, *Ctrl + scrollen* of *Shift + scrollen*. Standaard: *Verticaal* is *Scrollen*, *Zoomen* is *Ctrl + scrollen* en *Horizontaal* is *Shift + scrollen*. Effect: kies je een toets die al in gebruik is, dan wisselt hij met de functie die hem had. Waar: *Weergave*, onder *Gantt › Scrollen & zoomen*.

## Tabblad Planning

**Bouwmodus inschakelen** — bouwgerichte beginwaarden voor nieuwe projecten. Standaard: aan. Effect: aan geeft een nieuw project de kalender *Bouwkalender NL* met de Nederlandse feestdagen, laat je bij het genereren van feestdagen een bouwvak kiezen, biedt de fasesjablonen *Woningbouw* en *Utiliteitsbouw / renovatie* aan en geeft nieuwe taken het taaktype *Bouw*. Uit geeft de kalender *Standaardkalender* zonder feestdagen, alleen het sjabloon *Leeg* en het taaktype *Overig*. Bestaande taken en kalenders veranderen niet. Waar: *Planning*.

**Urenplanning inschakelen** — plannen in werkuren naast werkdagen. Standaard: uit. Effect: de tijdschaal *Uur* verschijnt onder *Beeld › Tijdschaal*, het venster *Kalenders* krijgt het blok *Werktijden*, en het venster *Nieuw project* krijgt de keuzes *Ploeg* en *Standaardeenheid voor nieuwe taken*. Ook *Projectinfo* krijgt de keuze *Standaardeenheid voor nieuwe taken*. Uit werkt de app dag-granulair. Taken die al in uren staan blijven bestaan en rekenen mee; hun duur bewerk je pas als je urenplanning aanzet. Waar: *Planning*, onder *Urenplanning*. Zie [Urenplanning aanzetten](docs://howto-urenplanning-aanzetten).

**Gemengde dag/uur-planning toestaan** — of je per taak de eenheid kiest. Alleen zichtbaar als *Urenplanning inschakelen* aan staat. Standaard: aan. Effect: aan toont bij elke taak de keuzelijst *Duureenheid* naast de duur. Uit verbergt die keuzelijst. Waar: *Planning*, onder *Urenplanning*. Zie [Dagen en uren](docs://uitleg-dagen-en-uren).

**Week begint op** — de eerste dag van de week. Keuze uit *Maandag* en *Zondag*. Standaard: *Maandag*. Effect: de weekindeling en weeknummers van de tijdschaal in de Gantt en in de afdruk, en de volgorde van de weekdagen in het venster *Kalenders*. Waar: *Planning*.

**Automatisch berekenen** — rekent de planning door zodra ze verouderd is. Standaard: uit. Effect: uit betekent dat je zelf op *Bereken* drukt (F5). Aan laat de app na een wijziging van taken, relaties of kalender de planning binnen een fractie van een seconde herberekenen. Tijdens een sleepgebaar of terwijl je in een veld typt, wacht de app en rekent hij één keer als je klaar bent. Na een mislukte berekening rekent hij pas opnieuw nadat je iets hebt gewijzigd. Waar: *Planning*, onder *Berekenen*.

**Toon werkregels en werk** — de werkregel- en werkvelden in de app. Standaard: uit. Effect: aan toont het veld *Werkregel* bij een taak en de kolom voor werk bij de toewijzingen, en maakt de tabelkolom *Werkregel* beschikbaar. Uit verbergt ze; de duur en de inzet blijven staan en het werk rekent mee. Een project dat al werkregel- of werkgegevens bevat, bijvoorbeeld uit een `.mpp`- of `.xer`-bestand, toont ze altijd, ook als de instelling uit staat. Waar: *Planning*, onder *Berekenen*. Zie [Werkregels: duur, inzet en werk](docs://uitleg-werkregels).

## Tabblad Geavanceerd

**AI-modus inschakelen** — laat een AI-assistent met je planning werken. Standaard: uit. Effect: aan toont het tabblad *AI* met de MCP-bridge, zodat een AI-assistent via het Model Context Protocol met je planning kan werken. Uit verbergt het tabblad en stopt de bridge. Waar: *Geavanceerd*, onder *AI-modus*.

**Bridge automatisch starten** — start de MCP-bridge bij het opstarten. Alleen aanzetbaar als *AI-modus inschakelen* aan staat. Standaard: uit. Effect: de bridge staat direct live, zodat een AI-client kan koppelen zonder dat je eerst het tabblad *AI* opent. Dit werkt alleen in de desktopapp, en eenmalig per start: zet je de bridge daarna zelf uit, dan start hij niet opnieuw. Waar: *Geavanceerd*, onder *AI-modus*.

**Debug-terminal inschakelen** — een logpaneel voor probleemonderzoek. Standaard: uit. Effect: aan zet een terminalknop in de statusbalk, waarmee je het logpaneel toont of verbergt. Uit sluit het paneel. Waar: *Geavanceerd*, onder *Debug-terminal*.

**Benchmark…** — meet de prestaties van de rekenmotor. Effect: opent een venster waarin je een testplanning van een gekozen grootte laat genereren en de kernfasen laat meten. Je geopende project blijft onaangeroerd. Het is een knop, geen instelling: er is niets om te onthouden. Waar: *Geavanceerd*, onder *Benchmark*.

**Statistieken…** — hoe vaak de app is gedownload. Effect: opent een venster met openbare downloadcijfers per besturingssysteem en per release, uit GitHub Releases. Er wordt niets van jou verzameld. Het is een knop, geen instelling. Waar: *Geavanceerd*, onder *Statistieken*.

**Rondleiding starten** — de introductierondleiding opnieuw. Effect: sluit het instellingenvenster en start de rondleiding vanaf de eerste stap. Waar: *Geavanceerd*, onder *Rondleiding*.

**Versie** — het versienummer van de app, met twee knoppen. *Controleren op updates* opent het updatevenster. *Wat is er nieuw* toont de nieuwigheden van de huidige versie. Waar: *Geavanceerd*, onder *Versie*.

**Klassieke weergaveknoppen tonen** — een vervangen functie, achter *Legacy-functies*. Standaard: uit. Effect: aan zet op het tabblad *Beeld* een groep *Weergave* terug met de losse knoppen *Kolommen…*, *Filteren…*, *Groeperen…* en *Sorteren…*. Die zijn vervangen door de plus in de tabelkop, de layoutknoppen en het layoutvenster. Waar: *Geavanceerd*, onder *Legacy-functies*.

## Onthouden weergavekeuzes buiten het paneel

Deze keuzes bewaart de app ook op dit apparaat, maar je stelt ze in bij het onderdeel zelf, niet in het instellingenpaneel.

**Baseline-overlay** — de actieve baseline als dunne balk onder de taakbalk. Standaard: aan. Waar: *Beeld › Baselines & voortgang › Baseline-overlay*.

**Voortgangslijn** — de zigzaglijn van de voortgang op de statusdatum. Standaard: aan. Effect: de lijn verschijnt alleen als het project een statusdatum heeft, en vervangt dan de losse statusdatumlijn. Waar: *Beeld › Baselines & voortgang › Voortgangslijn*.

**Statusdatumlijn** — een gestippelde lijn op de statusdatum. Standaard: aan. Effect: staat de voortgangslijn aan, dan tekent die zelf de markering. Waar: *Beeld › Baselines & voortgang › Statusdatumlijn*.

**Resource-accent** — een dun streepje in de resourcekleur onder de taakbalk. Standaard: uit. Waar: *Beeld › Baselines & voortgang › Resource-accent*.

**Spelingsband** — de speling als band achter niet-kritieke balken. Standaard: aan. Waar: *Beeld › Baselines & voortgang › Spelingsband*.

**Balkkleuren** — waar de kleur van een balk van afhangt. Keuze uit *Kritiek pad*, *Per taak — automatisch* en *Op categorie*. Standaard: *Kritiek pad*. Effect: geldt voor de Gantt en het rapport tegelijk. Waar: *Beeld › Baselines & voortgang › Balkkleuren*.

**Histogram** — de histogramstrook onder de Gantt. Standaard: uit. Waar: *Resources › Histogram › Histogram*, *Beeld › Panelen › Histogram* of Ctrl+Shift+H. De hoogte van de strook (standaard 160 pixels, tussen 80 en 480) stel je in door de rand te slepen.

**Mini-map** — een overzichtskaart van de tijdlijn. Standaard: uit. Waar: *Beeld › Presentatie › Mini-map*.

**Lint inklappen** — een compact lint. Standaard: uit. Waar: de pijltjesknop rechtsonder in het lint.

**Breedte van de taaktabel** — standaard 350 pixels, tussen 150 en 800. Je stelt haar in door de scheidingsbalk naast de tabel te slepen, of met pijl links en pijl rechts als de balk de focus heeft.

**Breedte van het rechterpaneel** — standaard 280 pixels, tussen 200 en 900. Je stelt haar in door de rand van het paneel te slepen.

**Hoogte van *Eigenschappen* en *Waarschuwingen* in het rechterpaneel** — standaard 240 en 220 pixels, tussen 120 en 2000. *Eigenschappen* heeft die hoogte als ook de resourcelijst openstaat. Je stelt de hoogte in met de sleepgrens tussen de secties. Of de secties open of dicht staan, onthoudt de app niet.

**Ook onthouden, elders beschreven** — de kolommen van de tabel ([Tabelkolommen aanpassen](docs://howto-tabelkolommen-aanpassen)), je layouts ([Een layout maken en gebruiken](docs://howto-layouts-gebruiken)) en de rapportopties ([Rapporttypes](docs://ref-rapporttypes)) bewaart de app ook op dit apparaat, niet in het projectbestand.

## Zie ook

- [Rekenopties en conventies](docs://ref-rekenopties-en-conventies): de opties die bij een project horen.
- [Urenplanning aanzetten](docs://howto-urenplanning-aanzetten): de stappen bij de schakelaar *Urenplanning inschakelen*.
- [Dagen en uren](docs://uitleg-dagen-en-uren): hoe de app dagen en uren telt.
- [Werkregels: duur, inzet en werk](docs://uitleg-werkregels): wat *Toon werkregels en werk* zichtbaar maakt.
- [Sneltoetsen](docs://ref-sneltoetsen-lijst): alle toetsen van de app, ook die voor zoomen en scrollen.

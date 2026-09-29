# Lint per tabblad

Het lint bovenin het scherm heeft tabbladen, en elk tabblad heeft groepen met knoppen. Dit artikel zegt per knop wat hij doet en waar je het resultaat ziet. Hoe je een taak aanpakt, staat in de how-to's; hier zoek je op wat een knop is. Een knop die alleen onder een voorwaarde bestaat of werkt, heeft die voorwaarde erbij.

## Hoe het lint zich gedraagt

- **Tabbladen** — links staat *Bestand*, daarna *Start*, *Planning*, *Resources*, *Beeld*, *Instellingen*, *Tabel*, *IFC*, *Rapport* en, alleen met AI-modus, *AI*.
- **Smal venster** — past het lint niet, dan krimpen knoppen van rechts naar links tot een icoon. De naam staat dan als tooltip op de knop. Elke knop zonder eigen tooltip toont zijn naam.
- **Lint inklappen** — het pijltje rechtsonder in het lint maakt er een platte strip van, met alleen iconen. De groep *Baselines & voortgang* en de groep *Verbinding* op het AI-tabblad verdwijnen dan achter één knop met een uitklapvenster. Standaard: uitgeklapt. De keuze blijft bewaard.
- **Extensieknoppen** — een extensie kan achteraan een tabblad een eigen groep zetten. Zo'n knop doet wat de extensie hem meegeeft.

## Bestand

Klik je op *Bestand*, dan neemt een eigen scherm (de Backstage) de werkruimte over. Het heeft geen lint. *Terug* sluit het weer. Heb je bij *Projectinfo* een wijziging gemaakt die je niet hebt toegepast, dan vraagt de app eerst wat hij ermee moet doen.

- **Nieuw** — opent het venster *Nieuw project* en sluit de Backstage.
- **Openen** — kiest een bestand en opent het als document. Sluit de Backstage.
- **Recent** — lijst met recent geopende projecten; een klik opent het. Alleen zichtbaar als de omgeving bestanden kan heropenen: in de desktop-app en in browsers die bestandstoegang bieden, zoals Chrome en Edge. In andere browsers staat de knop er wel, maar blijft de pagina leeg.
- **Voorbeelden** — meegeleverde voorbeeldplanningen, verdeeld in *Volledige showcase-planningen* (badge *Alle functies*) en *Eenvoudige voorbeelden*. Een klik opent er een in een nieuw tabblad.
- **Opslaan** — schrijft het project naar het bestand van dit document. Heeft het document nog geen bestand, dan kies je eerst naam en plek. Een geopend bestand in een ander formaat dan IFC wordt nooit overschreven; dan vraagt *Opslaan* om een naam en plek voor een IFC-bestand.
- **Opslaan als** — kiest een nieuwe naam of plek en slaat daar als IFC op.
- **Exporteren** — kaarten per exportformaat, met een omschrijving. Een klik zet het project om en slaat het op, en brengt je terug naar *Start*. Heeft de planning een kring, dan staat de fout in de Backstage en blijf je daar. Is het project aan een resourcebibliotheek gekoppeld, dan staat eronder het vinkje *Bibliotheekbestand ernaast opslaan*; dat werkt alleen bij de IFC-kaart.
- **Importeren** — bovenaan de kaart *Voortgang bijwerken uit een blad* (uitgeschakeld zonder taken), daaronder de importers die extensies toevoegen.
- **Afdruk** — de knop *Open afdrukvoorbeeld* brengt je naar het tabblad *Rapport*.
- **Projectinfo** — de metadata en het rekenprofiel van dit project. Wijzigingen werken pas na *Toepassen*. Zie [Rekenprofielen en conventies](docs://uitleg-rekenprofielen).
- **Instellingen** — dezelfde instellingen als het venster *Instellingen*.
- **Extensies** — beheer en installatie van extensies; zie [Een extensie installeren en beheren](docs://howto-extensie-installeren).
- **Bibliotheek** — beheer van resourcebibliotheken; zie [Resourcebibliotheken beheren en delen](docs://howto-bibliotheken-beheren).
- **Help** — de ingebouwde documentatie, met zoeken en een documentatietaal.
- **Rondleiding starten** — sluit de Backstage en start de rondleiding bij stap 1.
- **Sluit project** — sluit het actieve document. Heeft het niet-opgeslagen wijzigingen, dan vraagt de app om bevestiging.

## Start

### Start › Bestand

- **Nieuw**, **Opslaan**, **Openen** en **Opslaan als** — dezelfde acties als in *Bestand*.
- **Recent** — uitklapmenu met de recente projecten; een klik opent het. Alleen zichtbaar onder dezelfde voorwaarde als *Bestand › Recent*. Zonder recente bestanden staat er *Geen recente bestanden*.
- **Exporteren** — uitklapmenu met de exportformaten (korte namen). Een klik zet het project om en slaat het op.

### Start › Bewerken

- **Ongedaan** — draait de laatste wijziging terug. Uitgeschakeld als er niets terug te draaien is.
- **Opnieuw** — zet de laatst teruggedraaide wijziging terug. Uitgeschakeld als er niets terug te zetten is.
- **Verwijder** — verwijdert de geselecteerde taken, samen met hun subtaken, als één stap. Uitgeschakeld zonder selectie.

### Start › Taken

- **Taak** — voegt een taak toe met de naam *Nieuwe taak*, met een duur van 5 werkdagen en beginnend op de projectstart. (Staat *Urenplanning inschakelen* aan en is de *Standaardeenheid voor nieuwe taken* in *Projectinfo* uren, dan is de duur 5 uur.) Is er een taak geselecteerd en staat de weergave in de gewone boom, dan komt hij direct onder de onderste geselecteerde taak (tooltip *Nieuwe taak direct onder de selectie*). Is er geen selectie, dan komt hij onderaan (tooltip *Nieuwe taak onderaan de lijst*). Is er wel een selectie maar wordt er gefilterd, gegroepeerd of gesorteerd, dan komt hij ook onderaan en meldt een strook *Niet beschikbaar tijdens filteren/groeperen/sorteren*. De nieuwe taak wordt de enige selectie, de Gantt springt ernaartoe en de naam staat klaar om te overschrijven in het paneel *Eigenschappen*.
- **Mijlpaal ▾** — keuzemenu dat een mijlpaal (duur 0) op dezelfde plek zet als *Taak*. *Startmijlpaal* en *Eindmijlpaal* zetten de soort mijlpaal; de nieuwe mijlpaal heet *Nieuwe mijlpaal* en krijgt taaktype *Overig*. *Inspectiemoment (verplicht)* maakt een eindmijlpaal met taaktype *Keuring/Inspectie* en de vlag *Verplicht (contractueel)*, met de naam *Nieuw inspectiemoment*.
- **Relatie ▾** — keuzemenu met vier vaste acties; de hoofdknop verandert nooit van betekenis. Zie *Planning › Relaties* voor de vier acties.
- **Taak splitsen** — zet de splits-modus aan of uit. Aan: een strook onder het lint legt uit dat je op een balk klikt waar de onderbreking begint en naar rechts sleept voor de lengte. Uitgeschakeld als de Gantt niet in beeld is (op de tabbladen *Tabel*, *IFC*, *Rapport* en onder het volledige resourcepaneel); de tooltip zegt dan *Alleen beschikbaar als de Gantt in beeld is*. Zie [Een taak splitsen](docs://howto-taak-splitsen).

### Start › Planning

- **Bereken** — rekent de planning door: datums, speling, kritiek pad en resourcebelasting. Dat gebeurt nooit vanzelf, tenzij je *Automatisch berekenen* aanzet (*Instellingen*, tabblad *Planning*, kop *Berekenen*). Zolang de planning verouderd is, staat onderaan *Verouderd — herbereken (F5)*.

### Start › Zoomen

- **Zoomen +** — zoomt de tijdas 10 pixels per dag in.
- **Zoomen -** — zoomt de tijdas 10 pixels per dag uit.

## Planning

### Planning › Planning

De knop *Bereken* is dezelfde als op *Start*.

- **Project verplaatsen…** — opent het venster *Project verplaatsen*. Uitgeschakeld zonder projectstartdatum. Zie [Project verplaatsen](docs://howto-project-verplaatsen).
- **Waarschuwingen** — toont of verbergt het paneel *Waarschuwingen* in de rechterkolom. De knop licht op zolang je het paneel ziet. Aanzetten klapt een ingeklapte kolom uit. Wat erin staat, lees je in [Meldingen en waarschuwingen](docs://ref-meldingen).

### Planning › Relaties

De groep heeft de knop *Relatie ▾* met vier acties en de knop *Taak splitsen* (zelfde als op *Start*). De vier acties:

- **Relatie tekenen** — zet de relatiemodus aan of uit; een vinkje staat erbij als hij aan is, en de hoofdknop licht op. Aan: je sleept in de Gantt van de ene balk naar de andere om een relatie te leggen, en een strook onder het lint zegt hoe je stopt (*Stoppen* of Esc). Uitgeschakeld als de Gantt niet in beeld is.
- **Geselecteerde taken koppelen** — legt een relatie Eind-Start zonder lag tussen twee taken; de eerst geselecteerde wordt voorganger. Alleen beschikbaar bij precies twee geselecteerde taken (anders *Selecteer precies twee taken*). Een dubbele relatie of een kring wordt geweigerd met een melding.
- **Externe relatie toevoegen…** — opent een venster om een externe voorganger of opvolger aan de geselecteerde taak toe te voegen. Alleen beschikbaar bij precies één geselecteerde taak (anders *Selecteer precies één taak*).
- **Alle externe relaties vernieuwen** — ververst de ankers van alle externe relaties en meldt in het menu hoeveel er zijn bijgewerkt of ontbreken. Alleen beschikbaar als het project externe relaties heeft (anders *Dit project bevat geen externe relaties*).

Voor het waarom van relaties zie [Relaties leggen](docs://howto-relaties-leggen) en [Relaties en lag](docs://uitleg-relaties).

### Planning › Pad traceren

- **Voorgangers** — markeert in de Gantt de voorgangers van de geselecteerde taken, keten voor keten.
- **Opvolgers** — markeert de opvolgers van de geselecteerde taken.

Je kunt beide tegelijk aan hebben; een tweede klik op een knop zet die kant weer uit. Bepalende relaties krijgen een sterkere tint. Zie [Een pad traceren](docs://howto-pad-traceren).

### Planning › Kalender

- **Kalender** — opent het venster *Kalenders* met de kalenderbibliotheek van het project. Zie [Kalendervensters](docs://ref-kalenders).

### Planning › Structuur

- **Codes & velden** — opent het venster *Codes & velden* voor activity codes en gebruikersvelden. Zie [Codes en eigen velden](docs://howto-codes-en-velden).
- **WBS auto** — zet automatisch nummeren van de WBS-codes aan of uit. Standaard: uit. Aan: de hele boom wordt meteen hernummerd, de codes volgen daarna elke structuurwijziging en het veld *WBS Code* in het paneel en de dialoog wordt uitgeschakeld.
- **Hernummer WBS** — nummert de WBS-codes eenmalig opnieuw volgens de boompositie (1.2.3). Uitgeschakeld zolang *WBS auto* aan staat.
- **Sjablonen** — uitklapmenu met opgeslagen WBS-sjablonen, elk met het aantal taken en relaties. Een klik voegt het sjabloon in onder de geselecteerde taak, of op het hoogste niveau zonder selectie. Het prullenbakje verwijdert een sjabloon. Zonder sjablonen staat er hoe je er een bewaart (rechtsklik op een samenvattingstaak, *Bewaar tak als sjabloon*). Zie [WBS-sjablonen bewaren en invoegen](docs://howto-wbs-sjablonen).
- **Inspringen** — maakt de geselecteerde taken subtaak van hun voorgaande taak. Uitgeschakeld zonder selectie en zodra er gefilterd, gegroepeerd of gesorteerd wordt; de tooltip zegt dan *Niet beschikbaar tijdens filteren/groeperen/sorteren*.
- **Uitspringen** — verplaatst de geselecteerde taken één niveau omhoog, direct na hun huidige bovenliggende taak. Zelfde voorwaarden als *Inspringen*.

### Planning › Baselines & voortgang

- **Baselines beheren…** — opent het baselinevenster. Zie [Een baseline opslaan en beheren](docs://howto-baseline-opslaan-en-beheren).
- **Statusdatum** — de datum tot waar je de voortgang meet. Typ een datum; het kruisje (*Statusdatum leegmaken*) wist hem. Effect: voortgang wordt tot die datum gemeten, en de statusdatumlijn en voortgangslijn in de Gantt staan erop. Zie [Voortgang, statusdatum en baseline](docs://uitleg-voortgang).
- **Voortgangsmodus** — keuze tussen *Retained Logic* en *Progress Override*. Standaard: *Retained Logic*. Effect: bij *Retained Logic* volgt het restwerk van een gestarte opvolger de relatie; bij *Progress Override* begint het restwerk op de statusdatum, zonder op de voorganger te wachten. Zie [De voortgangsmodus kiezen](docs://howto-voortgangsmodus-kiezen).

In het ingeklapte lint staan deze drie achter één vlaggetjesknop met de titel *Baselines & voortgang*.

### Planning › Voortgang

- **Voortgangsblad exporteren** — maakt een `.xlsx`-blad met de taken, om voortgang buiten de app in te vullen. Uitgeschakeld zonder taken.
- **Voortgang bijwerken uit een blad** — opent het importvenster voor een teruggestuurd blad. Uitgeschakeld zonder taken. Zie [Voortgang uit een spreadsheet importeren](docs://howto-voortgang-importeren).

Deze groep staat ook op *Tabel* en *Rapport*.

## Resources

### Resources › Beheer

- **Resources** — opent het volledige resourcepaneel; het neemt de werkruimte over. Licht op zolang je dat paneel ziet. Zie [Resourcepaneel](docs://ref-resourcepaneel).
- **Resourcedock** — zet het compacte resourcepaneel vast in de rechterkolom, naast de Gantt. Licht op zolang de dock zichtbaar is; een tweede klik sluit hem. De dock toont alleen naam, kleur, een waarschuwing bij overbelasting en *Max. eenheden*, en bij een taakselectie alleen de resources van die taken.
- **Nieuwe resource** — opent het volledige resourcepaneel met een lege conceptrij voor een nieuwe resource. Er ontstaat pas iets zodra je een naam invult; wegklikken laat niets achter. De resource komt in de bibliotheek of in het project, afhankelijk van de weergave.

### Resources › Toewijzing

- **Toewijzen ▾** — wijst een resource toe aan de geselecteerde taak. Alleen beschikbaar bij precies één geselecteerde taak die een bladtaak is en geen mijlpaal; anders staat de knop grijs. In het menu stel je eerst *Eenh./dag* (standaard 1) en *Curve* (standaard *Uniform*) in; een klik op een resource wijst hem daarmee toe. Het menu toont alleen resources die nog niet aan de taak hangen. Zie [Resources toewijzen met een curve](docs://howto-resource-toewijzen).

### Resources › Histogram

- **Histogram** — toont of verbergt de histogramstrook onder de Gantt. Standaard: uit. De keuze blijft bewaard.
- **Vorige** en **Volgende** — bladeren door de resources in de kiezer van de histogramstrook, met *Alle resources* als extra stap in de ronde. Uitgeschakeld als het histogram uit staat of het project geen resources heeft.

### Resources › Nivellering

- **Nivelleren…** — opent het venster *Resources nivelleren*. Zie [Nivelleren](docs://uitleg-nivelleren).
- **Nivellering wissen** — zet de door nivelleren aangebrachte vertragingen en pauzes terug. Uitgeschakeld als geen enkele taak nivelleeruitkomst heeft.

### Resources › Overallocatie

- **Overallocatie** — geen knop maar een teller: het aantal resources met minstens één overbelaste dag, of *Geen*. Rood met waarschuwingsicoon zodra er een is. Het getal ververst na *Bereken* en na wijzigingen aan resources en toewijzingen; wijzig je de datums van taken, dan telt dat pas mee na *Bereken*.

## Beeld

### Beeld › Tijdschaal

- **Zoomen +** en **Zoomen -** — zoomen de tijdas 10 pixels per dag in of uit.
- **Herstellen** — zet de zoom terug op de standaard van 30 pixels per dag.
- **Passend maken op project** — zoomt en scrolt zodat het hele project in beeld past.
- **Schaalkeuze** — een keuzelijst met *Jaar*, *Kwartaal*, *Maand*, *Week*, *Dag* en, alleen met *Urenplanning inschakelen* aan, *Uur*. Een keuze zet een vaste zoom; de getoonde waarde volgt de huidige zoom, en eronder staat die zoom in pixels per dag.

### Beeld › Weergave

- **Kolommen…**, **Filteren…**, **Groeperen…** en **Sorteren…** — alleen zichtbaar als *Klassieke weergaveknoppen tonen* aan staat (*Instellingen*, tabblad *Geavanceerd*, kop *Legacy-functies*). Standaard: uit. *Kolommen…* brengt je naar *Tabel* en opent daar de kolomkiezer. *Filteren…* opent meteen het filtervenster zolang er geen opgeslagen filter is; met opgeslagen filters opent het een menu met *Filteren…*, *Wissen* (alleen als er een filter actief is) en de opgeslagen filters. *Groeperen…* laat twee niveaus toe. *Sorteren…* laat meer niveaus toe. Een knop licht op als die weergave actief is. In het nieuwe lint doe je dit met layoutknoppen; zie [Een layout maken en gebruiken](docs://howto-layouts-gebruiken).

### Beeld › Overzicht

- **Inklappen** — klapt de geselecteerde samenvattingstaken in; zonder selectie alle. In een gegroepeerde weergave klapt hij alle groepen in en heeft een selectie geen effect.
- **Uitklappen** — het omgekeerde.

### Beeld › Layout

- **Layoutknoppen** — elke layout is een schakelaar met icoon en naam. Meegeleverd is *Resourcediagram*. Eén klik zet de layout aan, nog een klik zet hem uit en brengt het beeld van vóór de klik terug. Layouts met verschillende delen kunnen samen aanstaan. Rechtsklik op een layout: *Bewerken…*, *Dupliceren* en *Verwijderen* (na bevestiging). Een meegeleverde layout kun je alleen dupliceren.
- **Nieuwe layout** — opent het layoutvenster voor een nieuwe layout.

### Beeld › Presentatie

- **Presentatie** — zet de presentatiemodus aan of uit (F11 of Esc om te stoppen): alleen de Gantt vult het scherm. Zie [Presenteren op een groot scherm](docs://howto-presentatie).
- **Split view** — splitst de Gantt in twee tijdvensters die beide beginnen met je huidige zoom en positie (verdeling 50 procent), of maakt er weer één van. Standaard: uit. Zie [Split view en mini-map gebruiken](docs://howto-split-view-en-mini-map).
- **Mini-map** — toont of verbergt de mini-map. Standaard: uit. De keuze blijft bewaard.

### Beeld › Panelen

- **Eigensch.** — toont of verbergt het paneel *Eigenschappen* in de rechterkolom. Standaard: aan. Zie [Taakdialoog en eigenschappenpaneel](docs://ref-taak-eigenschappen).

De knoppen *Resources*, *Resourcedock* en *Histogram* zijn dezelfde als op *Resources*, en *Waarschuwingen* is dezelfde als op *Planning*.

### Beeld › Baselines & voortgang

Deze groep heeft dezelfde naam als die op *Planning*, maar bevat de tekenopties van de Gantt.

- **Baseline-overlay** — toont de actieve baseline als dunne balk onder elke taakbalk. Standaard: aan. Zonder actieve baseline is er niets te zien.
- **Voortgangslijn** — tekent een lijn op de statusdatum die per taak uitsteekt naar de voortgang. Standaard: aan. Zonder statusdatum is er niets te zien. Staat de voortgangslijn aan, dan is die lijn ook de markering van de statusdatum.
- **Statusdatumlijn** — tekent een gestippelde lijn op de statusdatum. Standaard: aan. Je ziet hem alleen als de voortgangslijn uit staat, want anders neemt die lijn zijn plaats in. Het label met de datum in de kop blijft wel staan zolang minstens één van de twee aan is.
- **Balkkleuren** — kiest waarmee de balken zijn gekleurd: *Kritiek pad* (standaard), *Per taak — automatisch* of *Op categorie* met een keuze van het veld. Is dat veld niet in dit project, dan meldt het menu dat *Taaktype* tijdelijk wordt gebruikt. Buiten *Kritiek pad* markeert een rode rand het kritieke pad. De keuze geldt ook voor het rapport.
- **Resource-accent** — tekent een dun streepje in de resourcekleur onder elke bladbalk, verdeeld naar rato van de eenheden per dag. Standaard: uit.
- **Spelingsband** — tekent de groene band na een niet-kritieke balk, tot het laatste einde van de taak. Standaard: aan.
- **Relatielijnen** — toont of verbergt de relatielijnen tussen taken. Standaard: aan. De keuze hoort bij het document en bij de layout.

## Instellingen

### Instellingen › Project

- **Projectinfo** — opent het venster *Projectinfo*: de metadata van het project en, in het blok *Rekenprofiel en reken-opties*, hoe het project rekent.
- **Instellingen** — opent het venster *Instellingen* met de tabbladen *Weergave*, *Planning* en *Geavanceerd*. Dezelfde instellingen staan onder *Bestand › Instellingen*.

### Instellingen › Kalender

De knop *Kalender* is dezelfde als op *Planning*.

### Instellingen › Sneltoetsen

- **Sneltoetsen** — opent het venster *Sneltoetsen*.

## Tabel

Het tabblad *Tabel* toont de taken als volledige tabel in plaats van de Gantt. De groepen *Bestand*, *Bewerken*, *Taken*, *Planning* en *Pad traceren* zijn dezelfde als op *Start* en *Planning* en werken op dezelfde selectie. Er is geen groep *Zoomen*, want zoomen schaalt alleen de tijdas van de Gantt. De knoppen *Taak splitsen* en *Relatie tekenen* zijn hier uitgeschakeld: er is geen Gantt.

### Tabel › Kolommen

- **Kolommen…** — opent de kolomkiezer van deze tabel. Dezelfde kolomkiezer opent met het plusje in de tabelkop. De tooltip zegt *Kolommen van de Tabel-weergave kiezen*. Zie [Tabelkolommen aanpassen](docs://howto-tabelkolommen-aanpassen) en [Tabelkolommen](docs://ref-tabelkolommen).

## IFC

Het tabblad toont in de werkruimte het IFC-paneel. Het lint heeft hier geen knoppen, alleen de tekstregel *IFC 4x3 - Industry Foundation Classes*.

## Rapport

### Rapport › Rapportage

- **Afdruk** — staat alleen op dit tabblad en doet hier niets, omdat *Rapport* al open is; de rapportkeuzes staan in het rapportscherm.

## AI

Het tabblad *AI* bestaat alleen als *AI-modus inschakelen* aan staat (*Instellingen*, tabblad *Geavanceerd*, kop *AI-modus*). Standaard: uit. Uitzetten haalt het tabblad weg en stopt de bridge. Een AI-assistent werkt met je planning via een MCP-bridge die je hier start. Zie [Een AI-assistent koppelen (MCP)](docs://howto-ai-assistent-koppelen).

### AI › Server

- **Bridge starten** en **Bridge stoppen** — start of stopt de MCP-bridge. Ernaast staat de status: *Uit*, *Actief op poort …*, *Poort … bezet* (met de reden) of *Fout*. Uitgeschakeld in de webversie; de tooltip zegt *De bridge werkt alleen in de desktop-app.* Dezelfde status staat als bolletje met *AI* in de statusbalk.

### AI › Verbinding

- **Poort** — de poort van de bridge. Standaard: 3877. Alleen te wijzigen als de status *Uit* is (tooltip *Alleen wijzigbaar wanneer de server gestopt is.*).
- **Token** — het wachtwoord van de bridge, verborgen weergegeven. Kleine knoppen *Token tonen*/*Token verbergen*, *Kopiëren* en *Nieuw token*. *Nieuw token* vraagt eerst bevestiging, want een nieuw token verbreekt alle bestaande koppelingen; draait de bridge, dan herstart hij met het nieuwe token.
- **Verbinden** — toont de verbindingsgegevens: endpoint, token, een configuratiefragment en een koppelprompt die je in je AI-agent plakt.

### AI › Veiligheid

- **Pauzeren** / **Hervatten** — weigert tijdelijk alle wijzigingen door de AI; lezen blijft toegestaan en de bridge blijft actief. De knop licht rood op zolang het gepauzeerd is.
- **Alleen lezen** — weigert alle wijzigende tools zolang dit aan staat.
- **Auto-backup: aan** / **Auto-backup: uit** — maakt vóór de eerste AI-wijziging per document automatisch een IFC-backup. Standaard: aan.
- **Nu backup maken** — schrijft meteen een backup en meldt de bestandsnaam. Alleen in de desktop-app.
- **Backup-map openen** — opent de map met de backups. Alleen in de desktop-app.

### AI › Activiteit

- **Activiteitenpaneel** — toont of verbergt het paneel *AI-activiteit* met de aanroepen van de bridge, met hun argumenten en antwoord.

# Rapporten & printen

Een planning is pas af als je hem ook kunt delen — op papier voor een bouwvergadering, als
afbeelding in een presentatie, of als overzicht van wat er straks moet gebeuren en wat er al
verschoven is. Daarvoor is er het tabblad **Rapport**, met drie rapporttypen en een printvoorbeeld.

## Wat je hier leert

- De drie rapporttypen op het tabblad **Rapport**: Gantt-afdruk, mijlpalen-overzicht, variance.
- Hoe het printvoorbeeld werkt: papierformaat, oriëntatie en welke elementen je aan/uit zet.
- Hoe je een rapport daadwerkelijk afdrukt of als bestand bewaart.
- Wat **Ctrl+P** doet in deze app.

## Naar het rapportscherm

Er zijn drie ingangen naar hetzelfde scherm: klik op het lint-tabblad **Rapport**, ga naar
**Backstage → Afdrukken** (dat opent direct het rapportscherm), of druk op **Ctrl+P**. Alle drie
komen uit op dezelfde plek — er is geen los "print"-dialoogvenster, het rapportscherm ís het
afdrukvoorbeeld.

Het scherm is in twee kolommen opgedeeld: links een instellingenpaneel met bovenaan de keuze
**Rapporttype**, rechts een live voorbeeld dat direct meebeweegt met wat je links instelt.

## De drie rapporttypen

### Gantt-afdruk

Een volledige, opgemaakte afdruk van de Gantt-balken — dit is het enige rapporttype met een
instellingenblok:

- **Papier**: A4, A3, A2 of A1.
- **Oriëntatie**: liggend of staand.
- **Auto-fit op papier** (aan = de tijdas automatisch naar het gekozen formaat comprimeert) of een
  handmatige **zoom**-schuif als je auto-fit uitzet. Ook bij een meerjarige planning blijven de
  activiteitenkolom en rapporttekst daarbij even groot op A4, A3, A2 en A1; alleen de tijdas wordt
  dichter of ruimer.
- **Lettergrootte** — 90, 100, 110 of 125%; schaalt de rapporttekst, rijhoogte en kop/voet mee, los
  van het zoomniveau hierboven.
- **Kop op elke pagina herhalen** — standaard aan; houdt de rapportkop zichtbaar op elke afgedrukte
  pagina in plaats van alleen de eerste.
- **Tijdlijn over** — verdeelt de Gantt-tijdlijn over 1 tot 8 pagina's naast elkaar; alleen
  beschikbaar met auto-fit aan. Kies meer pagina's wanneer je de tijdas minder wilt comprimeren
  zonder de tabeltekst kleiner te maken.
- Aan/uit-schakelaars voor **taaknamen op staafjes**, **voltooiing tonen**, **kritiek pad**,
  **speling tonen**, **afhankelijkheden**, **weekenden** en **legenda**.
- **Balkkleuren** — één keuze die het Gantt-scherm en het rapport samen gebruiken. *Kritiek pad*
  geeft het vertrouwde rood/oranje/blauw; *Per taak — automatisch* geeft iedere taak een vaste
  paletkleur; met *Op categorie* kiest u een veld uit dezelfde lijst als bij **Groeperen**. Kies
  bijvoorbeeld **Taaktype** om constructie, installatie en sloop ieder één kleur te geven, of de
  activiteitcode **Discipline** om per discipline te kleuren. Ook WBS, gebruikersvelden en
  **Resource** zijn beschikbaar. Bij Resource wordt een taak met meerdere partijen gesegmenteerd
  naar verhouding van hun inzet. Taken zonder waarde krijgen neutraal grijs. Buiten *Kritiek pad*
  houdt een **rode rand** de kritieke taken herkenbaar en toont de legenda alleen de waarden die in
  het rapport voorkomen. Verandert u deze keuze onder **Beeld**, dan staat hij hier meteen gelijk
  — en andersom. Bestaat een eerder gekozen projectveld niet in het huidige project, dan gebruikt
  de app tijdelijk Taaktype zonder uw keuze te vergeten.
- **Statuslijn** — *Geen* (standaard), *Statusdatumlijn* (een verticale stippellijn op de
  statusdatum van het project) of *Voortgangslijn* (dezelfde zigzaglijn als op het scherm: per taak
  een uitstulping naar de voortgangspositie). Zonder statusdatum in het project tekent niets —
  stel er eerst één in via de projectgegevens; het paneel wijst u daarop.
- **Volg weergave** — staat dit aan, dan print de export precies wat u op het scherm ziet: het
  actieve filter, de groepering, de sortering én ingeklapte groepen blijven ingeklapt. Uit
  (standaard) print de export de volledige takenboom.
- Een **bedrijf**-veld (vult automatisch de projectinstelling, maar is hier los aanpasbaar) en de
  **auteur** (alleen-lezen, uit de projectgegevens).

De relatielijnen in het rapport gebruiken dezelfde tekentaal als het Gantt-scherm: een
**doorgetrokken** lijn is een bepalende (driving) relatie, een **gestreepte** lijn een
niet-bepalende, en een bepalende relatie tussen twee kritieke taken is **rood**. Zet je *kritiek pad*
uit, dan worden ook die lijnen neutraal. De legenda onderaan vat het verschil samen. Is er nog niet
gerekend, dan staan alle lijnen neutraal doorgetrokken — druk eerst op *Bereken* (F5).

Het overzichtsblok erboven toont live het aantal taken, bladtaken, kritieke taken en relaties in
het project. Het instellingenpaneel onthoudt je keuzes tussen sessies — open het tabblad Rapport
later opnieuw en papierformaat, schakelaars, lettergrootte en de rest staan er weer precies zo bij
als je ze achterliet. Alleen het bedrijfsveld reset: dat begint altijd bij de eigen instelling van
het project, zodat een rapport nooit de bedrijfsnaam van een ander project meesleept.

### Mijlpalen-overzicht

Een tabel van alle mijlpalen in het project: WBS, naam, soort (automatisch/start/eind), datum, de
onderliggende beperking of deadline, speling, of de mijlpaal verplicht is, en status (op schema /
kritiek / te laat). Het overzichtsblok toont het totaal aantal mijlpalen, hoeveel er verplicht zijn
en hoeveel er te laat zijn. Dit rapport heeft geen papierformaat-/oriëntatie-instellingen — het
print de tabel zoals getoond.

### Variance

Vergelijkt de huidige planning met de actieve baseline: baseline-start/-einde tegenover de huidige
start/einde, het verschil in werkdagen voor start en einde, en een status per taak (op schema /
later / eerder / nieuw / vervallen). Is er geen actieve baseline, dan meldt het scherm dat expliciet
in plaats van een leeg rapport te tonen. Het overzichtsblok toont ook de verschuiving van de
projecteinddatum in werkdagen, als die er is. Zie de gids [Baselines & voortgang](docs://gids-baselines-voortgang)
voor hoe je een baseline vastlegt vóórdat je dit rapport zinvol kunt gebruiken.

## Afdrukken en exporteren

Onderaan het instellingenpaneel staat altijd een knop **Afdrukken...** — die opent een apart
afdrukvenster met het rapport erin en start meteen de browser-/systeem-printdialoog. Bij het
Gantt-rapport gebruikt dat venster het gekozen papierformaat en de oriëntatie; het mijlpalen- en
variance-rapport printen de tabel zoals weergegeven.

Alleen bij het Gantt-rapport staat er ook een knop **Exporteer PDF**. Die bewaart het huidige
voorbeeld als een echt PDF-bestand (bestandsnaam eindigend op `-planning.pdf`) — één pagina op de
fysieke maat van het gekozen papierformaat en de oriëntatie. Het PDF-bestand is **vectorgrafisch**:
balken, lijnen en tekst worden als PDF-tekenopdrachten opgeslagen in plaats van als één ingebedde
afbeelding, dus het blijft haarscherp op elk zoomniveau en de tekst is selecteerbaar en doorzoekbaar
in elke PDF-viewer. Dit geldt voor Latijnse, Cyrillische, Griekse, Arabische en Perzische tekst — Arabisch en Perzisch
worden eveneens als vector geshapet en ingebed. Chinese, Japanse en Koreaanse tekst is opt-in:
installeer je een font-extensie die die glyphs levert, dan wordt ook die tekst als vector ingebed
(selecteerbaar en doorzoekbaar); zonder zo'n extensie wordt die tekst als raster-afbeelding
geëxporteerd — nog steeds correct leesbaar, maar niet selecteerbaar of doorzoekbaar. Handig voor e-mail of archief zonder de systeem-printdialoog erbij te hoeven halen.
Wil je liever direct printen (of via de systeemdialoog naar PDF, bijvoorbeeld om een ander
papierformaat te kiezen dan hierboven ingesteld), gebruik dan **Afdrukken...**.

## Rapporten in de praktijk

Elk rapporttype dient een ander gesprek:

- Het **Gantt-rapport** is de klassieke bouwvergadering-uitdraai: het kritieke pad rood/gemarkeerd,
  de speling zichtbaar op de niet-kritieke balken, en de legenda die uitlegt wat welke kleur
  betekent. Zet **taaknamen op staafjes** en **voltooiing tonen** aan als het publiek de planning
  zelf niet kent; zet ze uit voor een strak overzicht op A1 als er toch een aparte takenlijst
  bijgaat.
- Het **mijlpalen-overzicht** is bedoeld voor wie alleen de belangrijke data wil zien zonder door
  tientallen taakregels te bladeren — bijvoorbeeld een opdrachtgever die vooral wil weten of de
  verplichte opleverdata gehaald worden. Het ◆-symbool voor een mijlpaalnaam in de tabel markeert
  een **verplichte** mijlpaal.
- Het **variance-rapport** is het gesprek over bijsturen: welke taken lopen uit ten opzichte van de
  baseline, en met hoeveel werkdagen. Bekijk dit rapport in de praktijk in de showcase
  [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc), die twee
  baselines bevat (een contractbaseline en een herbaseline na meerwerk) met eigen voortgang en
  statusdatum — een goed voorbeeld om te zien hoe de Δ-kolommen zich vullen zodra er daadwerkelijk
  verschil is tussen baseline en actuele planning.

Het live voorbeeld rechts ververst bij elke wijziging aan de instellingen links — er is geen aparte
"vernieuwen"-knop nodig, en niets wordt pas bij het afdrukken zelf berekend.

## Verder lezen

- Een variance-rapport heeft pas iets te vergelijken als er een baseline is vastgelegd — lees de
  gids [Baselines & voortgang](docs://gids-baselines-voortgang).
- Kritiek pad en speling die op het Gantt-rapport getoond worden, komen uit dezelfde berekening als
  in de Gantt-weergave zelf — lees de gids
  [Kritiek pad & geavanceerde analyse](docs://gids-kritiek-pad-analyse) voor hoe je dat leest.

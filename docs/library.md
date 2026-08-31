# Resourcebibliotheken

Het model kent **twee werelden**. De *resourcebibliotheek* is de gedeelde bron: hij hoort bij de
organisatie, leeft buiten de projecten en wordt door meerdere projecten gebruikt. Het *project*
bepaalt wat je hier daadwerkelijk inzet. Een project kan aan één resourcebibliotheek hangen, of los
staan — dan werkt alles gewoon, alleen zonder gedeelde bron. Een resourcebibliotheek vertegenwoordigt
doorgaans één bedrijf of organisatie — vandaar dat de code en het IFC-formaat er nog steeds
`companyId`/`companyName` voor gebruiken; de gebruikersterm is "resourcebibliotheek" (of kortweg
"bibliotheek"), "bedrijf" alleen waar het echt over de organisatie zelf gaat.

Toewijzen vanuit de bibliotheek aan een project **is** materialiseren: er bestaat geen los
"toevoegen", "kopiëren", "bijwerken-uit" of "promoveren" meer als losse gebruikershandeling naast
elkaar — drie gerichte acties (zie verderop) dekken alles. Wat een project gebruikt, is een
bewerkbare kopie **met herkomststempel** in het project zelf: een gedeeld projectbestand blijft
daardoor altijd compleet en zelfstandig ("gebeiteld": zelfstandig, niet read-only).

## Resourcebibliotheken en koppeling

Er is altijd één standaardbibliotheek (vaste standaardnaam: "Mijn resourcebibliotheek" — bestaande
installaties die de oudere naam "Mijn bedrijf" al hadden staan, houden die naam; hij is gewoon
hernoembaar). Beheer resourcebibliotheken via **Bestand → Bibliotheek** (aanmaken, hernoemen,
verwijderen — de laatste resourcebibliotheek blijft altijd bestaan — en één als standaard aanwijzen).

De koppeling tussen een project en zijn resourcebibliotheek (`project.companyId`) is **altijd zichtbaar
en bewerkbaar**, ook met maar één resourcebibliotheek — niet iets dat impliciet ontstaat bij de eerste
bibliotheekactie. Eén gedeeld paneel verzorgt de selector op alle drie de plekken waar projectinfo
voorkomt:

- **Projectwizard** ("Nieuw project"): een bibliotheekselector, voorgeselecteerd op de standaardbibliotheek.
- **Projectinfo** (bestaand project, via dialoog of Backstage → Projectinfo): dezelfde selector;
  wijzigen bindt/herbindt/ontkoppelt direct.

De ≥2-bibliotheken-regel geldt uitsluitend voor **secundaire** selectors elders — bijvoorbeeld de
bedrijfsselector bij de "vervangen"-route in de pool-importdialoog (Backstage → Bibliotheek →
Importeren, zie verderop): met precies één resourcebibliotheek vervangt die route stilzwijgend die ene
bibliotheek en toont geen keuze. De "toevoegen als nieuwe resourcebibliotheek"-route heeft sowieso geen
bedrijfsselector nodig — ze maakt altijd een nieuw bedrijf aan, ongeacht hoeveel er al bestaan.

Wisselen naar een andere resourcebibliotheek (**omkoppelen**) strip de herkomststempels van de vórige
bibliotheek op alle projectitems (ze worden "vreemd" — de herkenningsstap moet ze opnieuw koppelen aan
de nieuwe bibliotheek); wisselen naar dezelfde bibliotheek of de allereerste koppeling doet dat niet.
Ontkoppelen (naar "geen bibliotheek") strip alle stempels net zo.

## De pool

Elke resourcebibliotheek heeft een **pool**: de verzameling bibliotheekkalenders en -resources, met een
oplopend versienummer (`poolVersion`) en een tijdstempel (`modifiedAt`). De `id` van elke
kalender/resource **in** de pool is diens stabiele identiteit — herkomststempels
(`libraryOrigin.libraryItemId`) wijzen daarnaar.

## Resources-tab: twee weergaven, drie soorten rijen

De Resources-tab heeft, zodra het project aan een resourcebibliotheek gekoppeld is, twee weergaven
naast elkaar (een schuifknop rechtsboven in het paneel, "Bibliotheek"/"Project"). Beide weergaven
delen dezelfde volledige inline-tabel-editor; alleen de rolverdeling verschilt:

- **Bibliotheekweergave** — de bron beheren. Toont de pool van de gekoppelde resourcebibliotheek als
  een volledige editor: alles is hier bewerkbaar (naam, type, beschrijving, tarief/uur, eenheid,
  bibliotheekkalenders), inclusief nieuwe poolitems aanmaken en poolitems verwijderen. Wijzigingen
  gelden **meteen voor alle projecten** die uit deze bibliotheek putten, en vallen buiten ongedaan
  maken (Ctrl+Z) — pools zijn app-globaal, geen projectdata. Vanuit hier gebeurt ook **"Toewijzen aan
  project"** (zie hieronder). Default-weergave zodra de pool inhoud heeft; een lege pool of een los
  (ongekoppeld) project toont in plaats daarvan de Projectweergave.
- **Projectweergave** — wat dit project gebruikt, over de gewone projecttabel. Hier bestaan drie
  soorten rijen:

  1. **Uit de bibliotheek** (draagt een herkomststempel, herkenbaar aan een klein
     bibliotheek-icoontje `resource.fromLibraryBadge`): naam, type, beschrijving, tarief/uur en
     eenheid zijn geërfd en worden als **platte tekst** getoond (geen invoerveld) — die bewerk je in
     de Bibliotheekweergave. Max. eenheden, de tijdgefaseerde beschikbaarheid en de kalenderkeuze
     zijn wél altijd een echt invoerveld, ook op zo'n geërfde rij: dat is de inzet op dít project.
  2. **Projecteigen** (geen stempel): volledig bewerkbaar, gewoon een input per veld. Ook een project
     dat aan een resourcebibliotheek hangt kan zulke resources hebben — voor eenmalige zaken (een
     gehuurde kraan, een onderaannemer voor dit ene werk) die je niet in de gedeelde pool wilt.
     Vanuit zo'n rij kun je zelf de brug oversteken met **"Naar de bibliotheek"** (zie hieronder).
  3. **Wees** (het bibliotheekorigineel is verdwenen, badge "niet meer in de bibliotheek"): de kopie
     blijft gewoon bruikbaar en volledig bewerkbaar — een stempel die nergens meer naar wijst,
     vergrendelt niets. Je kunt hem losmaken (het overbodige stempel opruimen) of met de expliciete
     rijactie uit het project verwijderen.

Materialiseren (Toewijzen aan project) gebeurt uitsluitend op een project dat al aan díé
resourcebibliotheek gekoppeld is — er is geen "stille eerste koppeling" meer via een toewijs-actie op
een nog ongebonden project.

Kalenderpromotie (projectkalender → poolkalender) leeft, als **bewuste fase-1-interim**, nog
uitsluitend in Backstage → Bibliotheek in plaats van in de Resources-tab (er is geen "Naar de
bibliotheek"-rijactie voor kalenders); resourcepromotie/-CRUD is al volledig naar de Resources-tab
verhuisd.

## Wat volgt de bibliotheek — en wat niet

Dit is de kern, en de plek waar het model door meerdere reviewrondes is bijgesteld — dus expliciet:

- **Volgt de bibliotheek** (wordt bij een verversing overgenomen): de **identiteitsvelden** van een
  bibliotheekresource — naam, type, beschrijving, tarief/uur, eenheid. De bibliotheek bepaalt WAT de
  resource IS; dat geldt voor elk project dat 'm gebruikt.
- **Volgt de bibliotheek**: de **inhoud** van een meegereisde kalender (werkdagen, uren, vrije
  dagen/feestdagen). Wijs je een bibliotheekresource toe, dan reist zijn kalender mee als gestempelde
  kopie die de pool blijft volgen — precies als de resource zelf.
- **Volgt de bibliotheek NIET**: max. eenheden en de tijdgefaseerde beschikbaarheid. Dat is
  projectinzet — hoeveel dit project van de resource opeist, en op welk ritme — geen
  bedrijfsafspraak. Je mag ze vrij aanpassen zonder dat het als afwijking geldt, ook op een geërfde
  rij.
- **Volgt de bibliotheek NIET**: de **keuze** wélke kalender aan een resource hangt. Dat is een
  projectkeuze (dezelfde ploeg kan op een spoedklus een andere kalender draaien dan op een gewoon
  project). De **inhoud** van die kalender komt wél uit de bibliotheek — zie hierboven. Dit
  onderscheid is subtiel: de kalender-*keuze* (welk dropdown-item) is projectinzet en verandert nooit
  vanuit de bibliotheek; de kalender-*inhoud* (wat er eenmaal gekozen is in die kalender staat) is wél
  een bibliotheekafspraak en ververst/vraagt gewoon mee als elke andere gevolgde waarde.

### Overzichtstabel: waar bewerk je het, en volgt het de bibliotheek?

Geldt voor een resource **uit de bibliotheek** (rijtype 1 hierboven). Projecteigen resources en wezen
zijn altijd volledig bewerkbaar in de Projectweergave — voor hen is de vraag "volgt de bibliotheek"
niet van toepassing (er is geen actieve koppeling).

| Veld | Waar bewerk je het | Volgt de bibliotheek? |
| --- | --- | --- |
| Naam | Bibliotheekweergave | Ja |
| Type | Bibliotheekweergave | Ja |
| Beschrijving | Bibliotheekweergave | Ja |
| Tarief/uur | Bibliotheekweergave | Ja |
| Eenheid | Bibliotheekweergave | Ja |
| Max. eenheden | Projectweergave (dit project) | Nee — projectinzet |
| Tijdgefaseerde beschikbaarheid | Projectweergave (dit project) | Nee — projectinzet |
| Kalenderkeuze (welke kalender hangt eraan) | Projectweergave (dit project) | Nee — projectkeuze |
| Kalenderinhoud (werkdagen/uren/vrije dagen van de gekozen, meegereisde kalender) | Bibliotheekweergave (de pool-kalender) | Ja |

## Drie acties verbinden de werelden

- **Toewijzen aan project** (Bibliotheekweergave, op een poolitem): maakt een bewerkbare kopie mét
  herkomst in het project — dé gebruikshandeling. Dedup op herkomst: staat er al een kopie van dít
  poolitem in het project, dan wordt die hergebruikt in plaats van gedupliceerd.
- **Naar de bibliotheek** (Projectweergave, op een projecteigen rij): tilt het item naar de gedeelde
  pool en koppelt het meteen. Bestaat er al een gelijknamig bibliotheekitem (unieke
  genormaliseerde-naam-match), dan koppelt hij daaraan in plaats van te dupliceren ("bestond al —
  gekoppeld"); anders komt er een nieuw poolitem bij.
- **Losmaken van de bibliotheek** (Projectweergave, op een geërfde of wees-rij): verwijdert het
  herkomststempel; daarna is alles weer bewerkbaar en volgt het item de bibliotheek niet meer. De
  meegereisde kalender gaat mee los, tenzij een andere nog-gestempelde resource in dit project 'm nog
  gebruikt (dan blijft die kalender de pool volgen voor die collega-resource).

## Het afwijkingenscherm (koppel-/synchronisatiescherm)

Eén gedeeld scherm — geen aparte add/update-dialogen meer — met twee secties:

1. **Herkennen** — niet-gestempelde projectitems met hun unieke naam-match uit de pool (per stuk of
   "alle voorstellen koppelen"). De matcher draait **alleen op koppelmomenten** (niet doorlopend):
   exacte match na Unicode-NFC, onzichtbare formatting-tekens (zero-width spaties/joiners, BOM,
   soft-hyphen) strippen, trim, samengevouwen witruimte en hoofdletterongevoeligheid — expliciet geen
   fuzzy matching. Geen of meerdere kandidaten met dezelfde naam ⇒ geen voorstel, handmatige keuze.
   De naam-matching is bewust locale-onafhankelijk (`toLowerCase`, niet `toLocaleLowerCase`): de
   Turkse dotless-İ-nuance wordt niet toegepast, zodat de matcher hetzelfde resultaat geeft ongeacht
   de machine-locale.
2. **Afwijkingen** — gestempelde items die van hun bibliotheekorigineel zijn afgeweken (`deviated`) of
   waarvan het origineel uit de pool is verwijderd (`removed`/"niet meer in de bibliotheek"). Per
   `deviated`-item zijn er **drie uitkomsten**: **bibliotheekwaarden gebruiken** (ververs het
   projectitem naar de pool), **overnemen in de bibliotheek** (schrijf de bestandswaarden terug in de
   pool — bumpt de pool, dus geldt voor alle projecten die eruit putten — en ververs de siblings in
   andere open documenten), of het scherm sluiten zonder te kiezen ("later beslissen": de markering
   blijft staan, heropbaar via de Projectweergave-badge of een volgende koppelmoment).

Een `removed`-item (niet meer in de bibliotheek) los je **niet** in dit scherm op — het item blijft
gewoon bruikbaar in het project; opruimen (losmaken/verwijderen) doe je zelf via de Projectweergave.

Elke uitgang (backdrop-klik, Escape, X-knop, "Later beslissen") loopt door hetzelfde sluitpad; het
scherm leest live uit de store (geen momentopname), dus een documentwissel terwijl het openstaat laat
geen verouderde inhoud achter.

## Waarom `syncedHash` bestaat: behind vs. deviated

Elke projectkopie draagt naast de gewone herkomststempel een `syncedHash`: een hash van de gevolgde
velden (zie de overzichtstabel hierboven — dit zijn precies de identiteitsvelden, niet max.
eenheden/beschikbaarheid/kalenderkeuze) op het moment van materialiseren/laatste verversing, met
**exact dezelfde normalisatie** als de diff-vergelijking (dezelfde veldenlijst, dezelfde
array-als-multiset-sortering, dezelfde NFC/witruimte-behandeling). Dat maakt het verschil tussen twee
heel verschillende situaties:

- **`behind`** — het bestand is sinds de laatste synchronisatie **niet** lokaal bewerkt (huidige hash
  == `syncedHash`), maar de pool is intussen bijgewerkt. Dit wordt **stil** ververst — geen vraag.
- **`deviated`** — het bestand ís lokaal bewerkt (huidige hash ≠ `syncedHash`) sinds de laatste sync.
  Dit wordt **gevraagd** in het afwijkingenscherm — nooit stilzwijgend overschreven.

Een projectitem zonder `syncedHash` (een bestand van vóór dit veld bestond) valt aan de veilige kant:
het telt altijd als mogelijk lokaal bewerkt, dus als `deviated` — nooit als `behind`.

## De vier verversingsgrenzen

De resourcebibliotheek ververst nooit doorlopend of "live" — alleen op vier vaste momenten:

1. **Openen** (bestand openen, of hernieuwde koppeling in de wizard) — ná volledige hydratatie van
   het document: `behind`-items ververst stil, `≥1 deviated`-item opent het afwijkingenscherm.
2. **Documentwissel** (tabblad wisselen, sluiten naar een buurdocument) — stil, `behind`-only; er komt
   nooit een dialoog bij een documentwissel, alleen bij openen/crash-herstel.
3. **Pool-bewerking** (iets in de Bibliotheekweergave of Backstage wijzigt de pool) — ververst
   `behind`-items in zowel het actieve document als élke slapende (niet-actieve) documentpayload, in
   één keer; slapende documenten herrekenen hun planning pas zodra ze weer geactiveerd worden.
4. **Crash-herstel** (auto-save-herstel bij opstarten) — draait dezelfde openings-check als grens 1.

Op elke grens blijven `deviated`-items ongemoeid — die wachten op een expliciete keuze in het
afwijkingenscherm.

## Ctrl+Z/verversing-eigenaardigheid

Een verversing (elke van de vier grenzen, en "bibliotheekwaarden gebruiken" in het afwijkingenscherm)
is **niet ongedaan te maken**: het is geen aparte undo-stap, en het **wist de redo-stapel**. Dat betekent
concreet: als je vlak vóór een verversing iets ongedaan had gemaakt (Ctrl+Z) en er stond nog een
redo-stap klaar, verdwijnt die redo-mogelijkheid stil op het moment dat de verversing draait — "opnieuw"
zou anders oude, inmiddels-achterhaalde poolwaarden kunnen terugzetten. Omgekeerd: undo van een gewone
bewerking van vóór de verversing kan tijdelijk oude waarden laten terugkeren, totdat de eerstvolgende
grens ze weer bijwerkt. Het discrete signaal **"N onderdelen bijgewerkt vanuit de bibliotheek"**
(zelf-opruimend na 4 seconden) is het enige zichtbare antwoord op een stille verversing — er is geen
aparte log of geschiedenis van wát er ververst is.

Dit geldt ook voor de twee keuzes in het afwijkingenscherm zelf, maar met een belangrijk onderscheid:
**"bibliotheekwaarden gebruiken" én "overnemen in de bibliotheek" zijn allebei niet met Ctrl+Z terug te
draaien** — de eerste is een niet-undoable verversing van het projectitem, de tweede wijzigt de
resourcebibliotheek zelf, die überhaupt buiten de projecthistorie valt (pools zijn app-globaal, niet
projectdata). **Koppelen, ontkoppelen en losmaken (herkenningsstap, bind/rebind/unbind, "Losmaken van
de bibliotheek") kunnen wél** ongedaan gemaakt worden — dat zijn wél gewone undo-snapshotted
projectacties.

Een aanverwante eigenaardigheid: **undo van omkoppelen** (bibliotheek A → B) herstelt de
herkomststempels van bibliotheek A wel, maar herstelt niet automatisch de binding als een "volwaardige"
A-koppeling terug — de herstelde A-stempels gedragen zich tot je écht weer terugkoppelt naar A net als
een los/onbekende bibliotheek zou (`project.companyId` valt zelf buiten de undo-snapshot-scope van deze
mutatie in dat pad). Dit is bewust gedrag, geen bug.

## Identiteit rust op id, niet op naam

Herkomst wordt uitsluitend gevolgd via het stabiele poolitem-`id`, nooit via de naam. Verwijder je een
poolitem en maak je vervolgens een nieuw poolitem met **exact dezelfde naam**, dan herlinkt een
projectkopie die ooit naar het oude item wees **niet automatisch** naar het nieuwe — voor het systeem
zijn het twee volledig ongerelateerde items (het oude item is domweg "niet meer in de bibliotheek",
`removed`, een wees). De handmatige uitweg is de herkenningsstap: het item toont als niet-gestempeld
(of als `removed`) en je koppelt het zelf opnieuw, expliciet, aan het nieuwe poolitem.

## Demo-resourcebibliotheek bij de showcase-voorbeelden

De drie meegeleverde showcase-voorbeelden delen één vaste **"Demo-resourcebibliotheek"**: het idee is
"dezelfde ploeg in twee projecten" zichtbaar maken zonder dat de gebruiker zelf iets hoeft op te
zetten. Open je een showcase-voorbeeld, dan wordt deze bibliotheek **idempotent** aangemaakt (bestaat
hij al, dan gebeurt er niets — ook de inhoud wordt niet overschreven, je mag 'm zelf bewerkt hebben) en
gekoppeld aan het net-geopende voorbeeldproject; ondubbelzinnige naam-matches op **resources** worden
meteen gekoppeld, zonder het afwijkingenscherm te tonen (het is een demo, geen vraag). Bestaande, eigen
resourcebibliotheken blijven volledig ongemoeid — de demo-bibliotheek is gewoon een extra bibliotheek
naast de jouwe.

**Kalenders koppelen hier bewust NIET automatisch mee** (fix issue #19): een showcase-kalender kan
zelf bewust gemodelleerd zijn (bijv. een eigen `hoursPerDay` of een specifieke vakantie) en voedt de
CPM-berekening rechtstreeks — een stille naam-match zou die inhoud vervangen door de demo-versie en zo
het eigen punt (en de CPM-uitkomst) van de showcase ondermijnen. De demo-pool draagt wél eigen
kalenders (zichtbaar in de Bibliotheekweergave), maar die worden nooit automatisch aan
showcase-kalenders gekoppeld — alleen handmatig via de gewone koppel-/herkenningsstap.

## Ontvangen bestanden (los)

Een bestand dat via een **volledig-vervangende** load binnenkomt — plakken/laden in het IFC-paneel,
een menu-actie die het hele document vervangt, of een extensie-import — komt binnen als **los
document**: `companyId`/`companyName` en alle herkomststempels worden gestript, ook als het bestand
oorspronkelijk aan een resourcebibliotheek gekoppeld was. Reden: zonder deze reset zou een bestand van
een collega (met stempels die naar resourcebibliotheken op ZIJN machine wijzen, niet noodzakelijk
dezelfde pools als op de jouwe) valse "niet meer in de bibliotheek"-markeringen tonen tegen een pool
die er niets mee te maken heeft. **Openen** via de normale bestand-openen-actie (of "recent bestand")
is dat niet — dat behoudt de koppeling en herkomststempels, en draait gewoon grens 1 (openen);
crash-herstel behoudt ze net zo en draait dezelfde check.

## Pool-import: twee expliciete routes (issue #19)

Bij pool-import (Backstage → Bibliotheek → Importeren) kies je, nadat je een IFC-bestand hebt gekozen,
expliciet tussen twee acties — geen impliciete "openen" meer dat in werkelijkheid altijd overschreef:

1. **"Toevoegen als nieuwe resourcebibliotheek"** (`importPoolAsNewCompany`) — de bibliotheek uit het
   bestand komt er als NIEUW bedrijf bij, met de naam uit het bestand (`resolveUniqueCompanyName` plakt
   er bij een lokale naamsbotsing een oplopend " (2)", " (3)", … achter). De **identiteit**
   (`companyId`) uit het bestand blijft behouden zolang die lokaal nog vrij is, GEEN reserved id is
   (zie hieronder) en een veilige state-sleutel is — dat is precies wat het deel-scenario nodig heeft:
   een meegestuurd project van een collega, met herkomststempels die naar het companyId uit het bestand
   wijzen, herkent zijn bibliotheek na deze import meteen als gekoppeld (geen valse "niet meer in de
   bibliotheek"-markering, geen handmatige herkenningsstap) — MITS die collega zelf óók al meerdere
   losse bibliotheken had (dus een niet-reserved companyId); zie de uitzondering hieronder voor de
   praktisch veel voorkomende tegenovergestelde situatie. Bestaat het id al lokaal (aantoonbaar
   dezelfde bibliotheek, al eerder geïmporteerd of gedeeld), dan krijgt de nieuwe bibliotheek een vers
   gegenereerd id en komt ze als losse kopie náást de bestaande te staan. Deze route bindt het actieve
   project NIET automatisch aan de nieuwe bibliotheek — dat blijft een aparte, bewuste koppelactie via
   Projectinfo.
2. **"Een bestaande resourcebibliotheek vervangen"** (`replacePool`) — het oude gedrag, ongewijzigd: de
   HELE pool van de gekozen resourcebibliotheek wordt vervangen. Alleen bij déze route toont de dialoog
   de bedrijfsselector (zie hierboven, ≥2-regel) en de demping-waarschuwing.

**Voorselectie** (`resolvePoolImportPreselection`, puur en los-testbaar van de dialoog). Bevat het
bestand een `companyId` dat lokaal nog niet bestaat, dan staat "toevoegen" voorgeselecteerd (de
standaardklik kan dan nooit onherstelbaar iets overschrijven). Herkent de app het id wél (aantoonbaar
dezelfde bibliotheek, een andere versie), dan staat "vervangen" voorgeselecteerd met precies díe
bibliotheek al gekozen in de selector.

**Uitzondering — reserved id's (critreview F1, blokkerende bevinding).** `DEFAULT_COMPANY_ID`
("company-default", de automatische standaardbibliotheek van élke verse installatie) en
`DEMO_COMPANY_ID` (de idempotente demo-seed) zijn GEEN identiteitsbewijs: vrijwel elke gebruiker heeft
hooguit één resourcebibliotheek, dus vrijwel elk geëxporteerd bestand draagt zo'n reserved id. Zonder
uitzondering zou de voorselectie dat id bij bijna elke ontvanger als "aantoonbaar dezelfde bibliotheek"
herkennen en "vervangen" voorstellen — op de EIGEN bibliotheek van de ontvanger, met de bevestigknop
één klik verwijderd van een onherstelbare overschrijving. `isReservedCompanyId` sluit deze twee ids
daarom altijd uit van een match: ze selecteren ALTIJD "toevoegen" voor, en `importPoolAsNewCompany`
mint er ALTIJD een vers id voor (nooit het bestand-id, ook niet als dat toevallig lokaal vrij is). Voor
de praktische consequentie hiervan (geen automatische herkenning voor de meeste eenpitter-gebruikers)
zie de gebruikersgids (`public/docs/*/gids-resourcebibliotheken.md`).

Daarnaast valideert `isSafeFileCompanyId` (critreview F2) elk bestand-companyId vóór het als
state-sleutel gebruikt wordt: `readPoolIFC` laat elke niet-lege string door, en een vijandig bestand
met bijv. `"__proto__"` als companyId zou zonder validatie een ongevangen Immer-crash geven
(`s.pools[id] = …` op zo'n sleutel) — de bevestigknop zou dan zichtbaar niets meer doen. Een onveilig
id telt ook nooit als preselectie-match en krijgt in `importPoolAsNewCompany` altijd een vers id.

De rest van deze sectie geldt uitsluitend voor route 2 ("vervangen") — route 1 overschrijft per
definitie niets en kent dus geen van onderstaande eigenaardigheden. Wél draait `runOpenBoundary()` (de
grens-1-check) na ELKE bevestiging, ook na "toevoegen" — dat is meestal een no-op (de nieuwe
bibliotheek is per definitie nog nergens aan gekoppeld), BEHALVE wanneer het actieve document al aan
precies dat companyId hangt (het deel-scenario zelf: een meegestuurd project met stempels naar het
zojuist geïmporteerde companyId). Dan ververst grens 1 'behind'-items stil naar de nieuwe pool en opent
bij ≥1 'deviated'-item het koppel-/afwijkingenscherm — exact hetzelfde grens-1-gedrag als na een gewone
bestand-opening, niet een aparte routine voor pool-import.

Bij "vervangen" vervangt de gekozen IFC-pool de **hele** pool van de doelbibliotheek, ná bevestiging. Is
de lokale pool nieuwer dan de te importeren pool (hogere `poolVersion` óf recentere `modifiedAt`), dan
waarschuwt de dialoog daarvoor vooraf — maar die waarschuwing is de **enige** poort. Ná bevestiging
draait de import als een externe wijziging: grens 1 (niet de stille grens 3) voor het actieve document.
Die classificatie kent geen begrip "vooruit" versus "achteruit" — hij vergelijkt alleen of het bestand
ongewijzigd is (`behind`) of lokaal bewerkt (`deviated`). Een projectitem dat in-sync stond met de (nu
overschreven) nieuwere pool en zelf niet lokaal bewerkt is, wordt dus **stil teruggezet** naar de
oudere, zojuist geïmporteerde waarden — de vraag in het afwijkingenscherm guardt alleen bestanden die
zelf extern/lokaal bewerkt zijn, niet het feit dat de pool zojuist ouder is geworden. De
demping-waarschuwing vooraf is dus de bewuste, enige poort tegen dit scenario.

De afwijkingsvraag bij "vervangen" geldt uitsluitend het **actieve** document (`replacePool` draait
bewust geen grens-3-verversing over slapende documenten). Slapende gekoppelde documenten tonen hun
afwijkingen als markering (de `deviated`/`removed`-badges in de Projectweergave) zodra je ernaartoe
wisselt — dat is live classificatie tegen de nu-geïmporteerde pool, geen aparte verversingsstap — maar
de vraag zelf (het afwijkingenscherm) verschijnt pas weer bij hun eerstvolgende **opening** (grens 1),
niet bij het wisselen zelf (grens 2 is en blijft stil, zie hierboven).

## Resourcebibliotheek verwijderen ontkoppelt open documenten, opgeslagen bestanden niet

Een resourcebibliotheek verwijderen (Bestand → Bibliotheek) ontkoppelt expliciet elk **geopend**
document (actief én slapend) dat eraan gekoppeld was: `companyId`/`companyName` gewist, alle
herkomststempels van die bibliotheek gestript. De verwijder-bevestiging meldt hoeveel geopende
documenten dit raakt. Bestanden die op dat moment niet open staan, blijven ongewijzigd op schijf staan
mét hun oude stempels — die gedragen zich bij een latere open-actie gewoon als een normaal gekoppeld
bestand tegen een resourcebibliotheek die dan niet meer bestaat: de scope-check (een lokaal bestaande
resourcebibliotheek) valt terug op los-gedrag (geen markering, geen mechaniek) omdat de
resourcebibliotheek lokaal onbekend is.

## Omkoppelen ruimt oude pool-promoties niet op

Wissel je een project naar een andere resourcebibliotheek (of ontkoppel je het), dan verdwijnen alleen
de herkomststempels op het project — niet de poolkopieën die je zelf ooit per ongeluk (of bewust) naar
de **vorige** bibliotheek promoveerde. Die blijven daar gewoon staan; opruimen is een handmatige stap
via de Bibliotheekweergave (of Backstage) van de oude bibliotheek.

## Export, import & back-up

Een pool exporteer je als één IFC 4.3-bestand per resourcebibliotheek; dat is tevens je **back-up**. Bij
projectexport kun je met "Bibliotheekbestand ernaast opslaan" de gekoppelde pool als tweede, los
bestand naast het project schrijven (geen embed; no-op als het project niet gekoppeld is). Bij import
kies je expliciet tussen de bibliotheek er als nieuw bedrijf bij toevoegen of een bestaande bibliotheek
volledig vervangen — zie de vorige sectie voor de twee routes, de voorselectie en waarom "toevoegen" de
identiteit uit het bestand behoudt (het deel-scenario: een meegestuurd project moet zijn bibliotheek
blijven herkennen).

## Bekende beperkingen (bewust niet opgelost)

Alle drie komen voort uit dezelfde wortel — **er is geen gedeelde opslag tussen machines**
(local-first, geen server) — en worden opgelost in een apart vervolgproject "gedeelde opslag/sync"
(zie ook `docs/TODO.md`).

1. **Twee planners, zelfde resourcebibliotheek.** Pools kunnen op verschillende machines uiteenlopen.
   Kies je bij import de route "een bestaande resourcebibliotheek vervangen", dan waarschuwt de
   import-demping wanneer je een oudere pool over een nieuwere lokale pool importeert ("jouw lokale
   bibliotheek is nieuwer"), maar kan divergentie niet vóórkomen — zie hierboven ook de
   stille-terugzet-eigenaardigheid als je toch doorzet. De route "toevoegen als nieuwe
   resourcebibliotheek" kent dit risico niet — ze overschrijft nooit een bestaande pool.

2. **Bezettingsoverzicht ziet alleen dit programma.** Het bezettingsoverzicht bestaat sinds B1b
   (Resources-tab, derde weergave "Bezetting"): per bibliotheekresource de boekingen over alle
   geopende, aan die bibliotheek gekoppelde documenten heen, met markering van dubbelbezetting
   (som > bedrijfscapaciteit van het poolitem). Het ziet alleen wat in dít programma geopend is — niet
   een ander venster of een andere toepassing op dezelfde machine, en al helemaal niet de boekingen op
   de machine van een collega, die lokaal niet bestaan. Een bibliotheekbreed bezettingsoverzicht is dus
   beperkt tot wat in deze programma-instantie bekend is — de weergave zelf meldt die grens als
   permanente voetnoot.

3. **Twee tabbladen, zelfde machine.** De bibliotheek leeft app-breed in-memory en wordt bij elke
   wijziging weggeschreven; twee open tabbladen (of twee vensters) op dezelfde machine overschrijven
   elkaars laatste schrijfactie stilzwijgend — zelfde wortel als punt 1 hierboven, alleen dan zonder de
   expliciete import-stap en dus zonder demping-waarschuwing.

4. **Automatische herkenning bij "toevoegen" werkt niet voor eenpitters (critreview F1).** De
   identiteit die "toevoegen als nieuwe resourcebibliotheek" behoudt, is het `companyId` uit het
   bestand — maar dat id is `DEFAULT_COMPANY_ID`/`DEMO_COMPANY_ID` bij iedereen die zelf nooit een
   tweede bibliotheek aanmaakte (de meeste gebruikers), en die twee ids zijn bewust GEEN
   identiteitsbewijs (zie hierboven). Een meegestuurd project van zo iemand herkent zijn bibliotheek
   dus NIET automatisch — de ontvanger moet de herkenningsstap zelf doorlopen (matching op naam neemt
   het dan over). Structurele fix (het standaardbedrijf bij eerste start een gegenereerd i.p.v. een
   vast id geven) staat als openstaand punt in `docs/TODO.md` — vergt een migratie voor bestaande
   installaties en opgeslagen stempels, daarom nu niet gedaan.

5. **Verdeler-kern bestaat, nog zonder schrijfpad/paneel.** Sinds B1c-etappe 2
   (`src/services/library/distribute.ts`) is er een pure rekenkern die, gegeven een poolitem en de
   geopende documenten die erop boeken, een verdelingsvoorstel berekent: documenten worden één voor
   één, in een opgegeven rangorde, tegen de restcapaciteit geplaatst — nummer 1 nivelleert alleen
   tegen vaste last, elk volgend document ziet de echte boekingen van zijn voorgangers. Er toetst
   daarbij TWEE grootboeken tegelijk: de eigen projectinzet van het document én de gedeelde
   restcapaciteit van het poolitem (`min(projectinzet, poolrest)`, zelfde formule als het
   bezettingsoverzicht hierboven). Past een taak niet, dan wordt ze als tekort geregistreerd en boekt
   ze niets in het gedeelde grootboek — een tekort cascadeert dus niet naar de volgende documenten in
   de rangorde. Deze kern draait volledig puur (`computeDistribution`, headless getest in
   `tests/library/check-distribute.ts`); het schrijfpad (de gevonden verschuivingen daadwerkelijk
   toepassen) en het paneel dat dit voorstel toont, bestaan nog niet.

## Bekende kleine punten

- **CRLF wordt genormaliseerd.** Tekstvelden (namen, omschrijvingen) met Windows-regeleinden (CRLF)
  komen na een schrijf/lees-cyclus terug met LF.
- **Onbekende extra velden gaan verloren.** Een geïmporteerd poolbestand met velden die dit systeem
  niet kent, verliest die velden bij normalisatie (de opgeslagen pool bevat alleen de bekende vorm:
  `companyId`/`companyName`/`poolVersion`/`modifiedAt`/`calendars`/`resources`).
- **Pool-exports zijn niet byte-identiek tussen exports.** Twee exports van dezelfde pool verschillen
  op tijdstempel-regels in het IFC-bestand; de inhoud (kalenders/resources/versienummer) is gelijk.
- **Undo van een promote laat de poolkopie staan.** Ongedaan maken van "Naar de bibliotheek"
  (resources) of "promoveer kalender naar bibliotheek" (Backstage-interim) verwijdert de
  herkomststempel op het bron-projectitem, maar de zojuist toegevoegde kopie in de pool blijft staan
  (pools zijn app-globaal en niet undo-beschermd). Het item opnieuw promoveren voegt dus een nieuwe
  pool-kopie toe; de dedup bij materialiseren herstelt de oude koppeling niet.

**Aanbeveling.** Deelt jullie organisatie ploegen over werkmaatschappijen heen, kies dan bewust
**één gezamenlijke pool** in plaats van per werkmaatschappij een eigen resourcebibliotheek.
Dubbelbezetting van een resource tussen losse organisaties (bijvoorbeeld een onderaannemer die voor
twee aannemers werkt) is bewust geen probleem van dit systeem — dat is het planningsprobleem van die
resource zelf.

# Hyperkritische review — bestandsformaten F0-brief + ontwerp

> **Herkomst (2026-08-15):** geoogst uit de parallelle branch `file-format-implementation`
> (verwijderd na oogst, eigenaarsbesluit — de code van die branch is bewust NIET overgenomen).
> Let op: de MPP-conclusies hierin (npm-`cfb`-spoor) zijn ingehaald door de inmiddels gebouwde
> native MPP14-lezer in `src/services/mpp/`; de XER/PMXML/PP-delen zijn actuele input voor
> etappe 2. Verifieer beweringen tegen de huidige code.


Status: IN PROGRESS (incrementeel geschreven). Read-only, geen wijzigingen.

Reviewer-context: GLM-5.3 voert elk gat in het plan trouw als bug uit. Dus
elk gat/ambiguïteit in de F0-brief = potentiële bug.

---

## Bevindingen (ergste bovenaan, live-append)

### [BLOCKER] B3b bevestigd - en de test bewijst niets (fixtures zijn eigen platte writer-output)

[BEVESTIGD] p6xmlReader.ts r156-166 getAllByLocalName scant alleen
doc.documentElement.children (directe kinderen van de root). Reader haalt
Activity (r329), WBS (r278), Relationship, Resource, Calendar allemaal zo op.

Echte P6-export pmxml-samples/UploadScheduleP6.xml (V18.8.1/OPC): Activity
staat op regel 388, GENEST binnen Project (r284). 4 Activities, allen binnen
Project. getAllByLocalName(doc,Activity) -> 0 hits -> 0 taken. BUG bevestigd op
echt bestand.

WAAROM IS check-adapters-hours.ts GROEN (de vraag van de user):
[BEVESTIGD] p6xmlWriter.ts r243-260 schrijft Project...sluit Project op r260,
DAARNA pusht leafTasks (r240-424) Activity op indent(1) - dus als root-level
SIBLING van Project, niet genest. OPS eigen output is PLAT. De flat-reader parst
platte output prima. De test round-trippt uitsluitend eigen writer-output en raakt
daardoor NOOIT het geneste-pad. De groene test is schijnzekerheid: hij dekt precies
de enige structuur die in het wild niet voorkomt.

GEVOLG VOOR PLAN: F0-brief T-lijst noemt B3b NIET als taak. Spec zet B3b-fix
bij F0/F1 (r51-52) maar F0-brief (plans f0-brief-concept.md r46-59) heeft geen
taak die de nesting-bug dicht. F2 (spec r95) doet geneste Activity-parsing.
Inconsistentie: spec claimt B3b hoort bij F0/F1, brief levert pas in F2.

VOORSTEL: expliciete taak toevoegen OF de bug bewust naar F2 schuiven en spec
rechttrekken. Fix = getAllByLocalName recursief OF per Project itereren (nodig
voor multi-project sowieso). En de round-trip-test MOET een echt genest fixture
krijgen, anders blijft groen liegen.

### [BLOCKER] T2 is fout over XER: een tekstformaat dat cp1252 nodig heeft kan NIET op het string-pad blijven

[BEVESTIGD] fileAccess/tauriBackend.ts r12 leest via readTextFile (UTF-8-decode);
webBackend.ts r69/r93 via file.text() (UTF-8). Tegen de tijd dat openFile de
content krijgt, is die AL als UTF-8 gedecodeerd.

XER is default CP1252 (ram-rapport 1.2, MPXJ). Echt bestand
P6-Viewer/XER Files/Hotel Project.xer bevat byte 0xA3 (cp1252 pound-teken) op
offset ~486, in een CURRTYPE-record. 0xA3 is een INVALIDE UTF-8 lead/continuation
-> readTextFile/file.text() vervangt het door U+FFFD. Data is dan al vernietigd
VOORDAT enige reader draait.

F0-brief T2 (plans r42-43): "Tekstformaten blijven het string-pad gebruiken
(geen churn); alleen mpp/astapp lezen bytes." Dit is FOUT: XER is een tekstformaat
MAAR heeft de rauwe bytes nodig om cp1252 (of BOM-detectie) toe te passen. Als GLM
T2 letterlijk uitvoert, wordt élk XER-bestand met niet-ASCII (pond, e-accenten,
niet-westerse namen) stil corrupt. F1 (spec r92) claimt "CP1252-default
(TextDecoder windows-1252)" maar dat kan alleen als de bytes overleven -> dus het
BYTES-PAD moet ook voor XER, in F0, niet alleen mpp/astapp.

VOORSTEL: T2 herformuleren: fileAccess levert ALTIJD ook de rauwe bytes (of een
readBytes-variant), en de per-formaat-decode gebeurt NA detectie (XER: cp1252/BOM,
mpp/astapp: bytes, rest: utf-8). "alleen mpp/astapp lezen bytes" schrappen.

### [BLOCKER] Ordening T1 voor T2: detector kan MPP/astapp niet herkennen zolang openFile een string doorgeeft

[BEVESTIGD] OpenedFile.content is string-only (fileAccess/index.ts r27). MPP-magic
is D0 CF 11 E0 (binair); SQLite-magic 53 51 4C 69... Binaire bytes overleven een
UTF-8-textdecode niet (readTextFile/file.text()), dus in een string zijn die magics
weg (U+FFFD-rommel).

F0-brief zet T1 (detector, wired in alle vier open-paden) VOOR T2 (bytes-pad), en
zegt (r33-34) "openFile/openRecentFile/parseExternalSource/MCP parseByExtension gaan
alle vier door de detector". Maar tot T2 krijgen die de STRING. Detector ziet dan
nooit D0CF11E0/SQLite-magic -> retourneert 'unknown' -> gooit fout. T1-tests
(check-format-detect.ts) gebruiken SYNTHETISCHE Uint8Array-content en zijn groen,
dus de bug is onzichtbaar in de test maar echt in de app.

Bovendien specificeert de brief NIET dat openFile de BYTES aan detectFormat moet
geven. Een GLM die `detectFormat(name, opened.content)` schrijft, detecteert
mpp/astapp NOOIT, ook niet na T2, want opened.content blijft string. Interface-gat.

VOORSTEL: expliciteer dat detectFormat op RAUWE BYTES werkt (of string|bytes maar
met bytes voor de binaire magics), en dat T2 VOOR de detector-wiring in de
open-paden moet landen. Volgorde omdraaien of samenvoegen, en de brief moet zeggen:
openFile geeft opened.bytes door, niet opened.content.

### [MAJOR] Ruime <Project>-fallback matcht ProjectLibre .pod (en gelijk welk MSPDI-achtig dialect)

[BEVESTIGD] parseProjectXml (fileSlice r41-48) en formatOf/parseByExtension
(fileTools r155-172) sniffen op content.includes('<Project'). Detector-brief T1
houdt de ruime <Project-fallback als laatste tak.
crawl-pod/EstimacionTP_v10_es.pod (ProjectLibre) heeft
xmlns="http://schemas.microsoft.com/project" en root <Project> -> matcht de
MSPDI-tak. Dat is (toevallig) correct want ProjectLibre schrijft MSPDI-compatibel,
maar de detector-BESLUIT is dan op de verkeerde grond genomen (fallback i.p.v.
namespace). Alle 13 crawl-mspdi-bestanden hebben WEL de microsoft-namespace, dus de
volgorde PMXML->MSPDI-ns->ruime-<Project werkt voor de geteste corpus. Restrisico:
elk niet-MSPDI XML met een <Project>-element (config, of een toekomstig dialect)
valt hier stil in de MSPDI-reader. De spec (B1) noemt dit als op te lossen, de brief
lost het half op (ns-first) maar houdt de ruime tak. Acceptabel als de ruime tak
ALLEEN bij .xml-extensie geldt en anders 'unknown' teruggeeft — dat moet expliciet
in de brief, anders raadt GLM.

### [MAJOR] parseExternalSource (r405-422) ontbreekt in T2/T3 en heeft dezelfde bytes/detector-gaten

[BEVESTIGD] fileSlice r411: parseExternalSource dispatcht zelf op extensie met
else->readIFC (readTextFile, Tauri-only). F0-brief T1 zegt dat parseExternalSource
"door de detector" gaat (plans r33), maar T2/T3 raken deze functie niet en de brief
geeft geen concrete aanwijzing hoe. Voor XER-als-externe-bron geldt hetzelfde
cp1252-corruptieprobleem (readTextFile UTF-8). Als GLM T1 letterlijk toepast maar
parseExternalSource vergeet, blijft dit pad een tweede stille IFC-fallback. Punt:
de brief moet de vier call-sites (openFile, openRecentFile, parseExternalSource,
parseByExtension) EXPLICIET met regelnummers opsommen als te-wijzigen, anders mist
GLM er een.

### [MAJOR] T4 corpus-runner: paden buiten de repo, binaire reads, en onduidelijk runner-mechanisme

[BEVESTIGD] Paden bestaan nu: "/home/nozzit/open-aec/voor claude/testdata-crawl/"
en ".../test bestanden voor file implementation/" bestaan. MAAR ze liggen BUITEN
de worktree/repo (repo = .../open-planner-studio/.claude/worktrees/...). Een
scripts/corpus-check.ts met een hardgecodeerd absoluut pad is machine-specifiek en
niet herbruikbaar door de orchestrator/CI/andere agents. Spatie in "voor claude" en
"test bestanden voor file implementation" -> makkelijk te breken in shell-glue.

Verder: T4 moet binaire bestanden (mpp/pp) detecteren, maar er is in F0 nog GEEN
mpp/astapp-reader (die komen F4/F5). De brief zegt "parseert met de bijpassende
reader" — voor mpp/astapp bestaat die niet. De exit-code-regel ("bekende-onbekende
formaten falen = ok") vangt dat af, maar dat moet GLM expliciet zo bouwen, en de
brief moet zeggen: mpp/astapp in F0 = gedetecteerd maar overgeslagen (verwacht
onbekend), geen parse-poging.

Mechanisme onduidelijk: scripts/*.ts draaien via ? (tsx/esbuild/ts-node). run.sh
bundelt met esbuild. De brief noemt geen runner voor scripts/corpus-check.ts. Node
kan binaire reads (readFileSync zonder encoding -> Buffer), maar detectFormat moet
dan een Uint8Array/Buffer aankunnen — sluit aan op het T1-interface-gat hierboven.
VOORSTEL: pad via env-var of CLI-arg (default naar een repo-relatieve fixtures-map),
en expliciteer de runner + Buffer-input.

### [MINOR] Detector-magic-claims allemaal geverifieerd op echte bestanden
[BEVESTIGD] Op de echte corpus: IFC start met "ISO-10303-21;" (juist);
mpp = D0 CF 11 E0 A1 B1 1A E1 (juist); .pp = "SQLite format 3\0" (juist);
XER ERMHDR eerste regel (juist, maar versie is hier "6.0", niet het "8.2.0"-patroon
dat ram aannam — versieparser moet 1- en 2-cijferige majors aankunnen).
crawl-ics-bestand begint met "BEGIN:VEVENT" (niet BEGIN:VCALENDAR!) — een
ics-detector op "BEGIN:VCALENDAR" zou dit invalide-testbestand missen. .ics is
export-only dus geen detector nodig, maar als besluit 3 een mijlpalen-import
toevoegt, moet de detector op "BEGIN:V" of "BEGIN:VCALENDAR" tolerant zijn.

### [BEVESTIGD] B5 lagMinutes: solver-fix bestaat, TODO.md is stale, dag-afronding-restrisico echt
CPMSolver.ts r80-101 resolveEffectiveLagDays heeft de fase-2.10-tak
(days===0 && lagMinutes!==0 -> omrekenen met hoursPerDay, Math.round). Bestaat dus.
docs/TODO.md r231-239 beschrijft het nog als onopgelost ("resolveEffectiveLagDays
kent seq.lagMinutes niet") — VEROUDERD. p6xmlReader r519-528 keyt lagMinutes op de
OPVOLGER (taskHourById.get(succId)) met lagDays:0. Bij dag-voorganger rondt de
solver de minuut-lag op hele dagen (r97-98) -> 4u wordt 1 dag. Restrisico reeel.
T3 (brief r50) zegt terecht "TODO.md r231-239 bijwerken (solver-fix bestaat)".
KLOPT. Maar de brief laat de reader-keying-scheefte (opvolger i.p.v. voorganger)
ongemoeid en zegt niet of nieuwe XER-reader de voorganger moet keyen (spec B5 r58
zegt "nieuwe readers volgen de voorganger-conventie"). Dat staat NIET in de F0-brief.
GLM bouwt geen XER-reader in F0 (dat is F1), dus ok voor F0, maar de F1-brief moet
dit erven.

### [MAJOR] documentContract-gevolg ontkend maar XER/PMXML brengen WEL nieuwe domeinvelden
[BEVESTIGD] rat-rapport §6.7 en spec (aanhaakpunt-checklist r111) zeggen
"documentContract alleen bij nieuw domeinveld". Maar XER draagt activity codes
(ACTVTYPE/ACTVCODE/TASKACTV) en UDF's, en PMXML draagt baselines/BaselineProject.
ImportResult HEEFT al velden activityCodeTypes/customFieldDefs/baselines (rat §2),
dus als de nieuwe readers alleen die BESTAANDE velden vullen is er geen contract-
wijziging. MAAR: XER-specifieke zaken (suspend/resume-datums, external relations,
multi-project, CURRTYPE-valuta, calendar exceptions-per-weekday) hebben mogelijk
GEEN bestaand veld. Als een reader die wil bewaren -> DOCUMENT_FIELDS + DocumentPayload
+ IFC-round-trip nodig (compile-afgedwongen). F0 raakt dit niet, maar de brief zou
moeten waarschuwen dat de F1+-briefs dit per veld expliciet moeten beslissen (bewaren
via contract, of bewust laten vallen met KNOWN_GAPS). Anders bouwt GLM stil velden
die bij document-switch/undo/save verdampen (AGENTS.md-valkuil).

### [MAJOR] Round-trip-matrix vs exportAs: XER-schrijven vereist ExportFormat-uitbreiding, niet in F0
[BEVESTIGD] ExportFormat = 'ifc'|'csv'|'mspdi'|'p6' (fileSlice r50); exportAs-switch
r335-366 heeft geen xer/ics. Formaten-matrix (spec r24) zet XER op lezen EN
schrijven met round-trip-eis. Maar F0 levert geen XER-writer/ExportFormat. Dat is
F1. Ok voor F0-scope, maar de round-trip-HARNAS die T4/F0 bouwt kan XER nog niet
round-trippen (geen writer). De corpus-runner T4 kan XER dus alleen "lezen zonder
crash" testen, niet round-trippen. Brief moet dat expliciet zeggen, anders bouwt
GLM een round-trip-check die niet kan slagen.

### [MINOR] .ics-import = scope-creep tenzij user het wil; besluit correct uitgesteld
[BEVESTIGD] Spec besluit 3 (r72-75) houdt .ics export-only + minimale mijlpalen-
import "TENZIJ de user dat overbodig vindt — expliciet voorleggen". Dat is de juiste
gate. De round-trip-eis "elke export importeerbaar" dwingt strikt genomen een
.ics-import af, maar een VEVENT->mijlpaal-import is lossy (geen relaties, geen
duur-semantiek) en dus geen echte round-trip. Aanbeveling: leg de user voor dat
.ics-round-trip inherent lossy is en vraag of export-only volstaat. Niet in F0
(F3). Geen blocker.

### [MINOR] Geen Tauri file-associations; "drop een .mpp en het werkt" onhaalbaar zonder config
[BEVESTIGD] src-tauri/tauri.conf.json heeft GEEN fileAssociations-blok. ram-rapport
3.4 noemt de wens "drop een .mpp en het werkt". Dubbelklikken op een .xer/.mpp opent
OPS niet zonder bundle.fileAssociations + een deep-link/opened-file-handler. Buiten
F0-scope, maar niet in enige fase belegd. Aandachtspunt voor F6.

### [MAJOR] Performance/security ontbreken volledig in F0-poort en brief
[BEVESTIGD] Corpus bevat 1000+-activiteiten-XER (xer-corpus/02-large-1000-activities)
en XER's tot 3,8MB (Hotel_Construction_TEC.xer). MPP tot 11,8MB
(calendar-exception-precedence.mpp). De F0-poort (spec r89) is alleen "bestaande
suites groen + harnas draait op corpus". Geen performance-budget, geen
geheugen-limiet voor browser (3MB MPP in-memory + cfb-parse + sql.js WASM ~1,5MB).
Geen security-overweging: XML-bommen (billion-laughs) via DOMParser, malicious
SQLite via sql.js (sql.js voert geen SQL van het bestand uit, maar een corrupte DB
kan sql.js laten crashen/OOM). De briefs noemen niets over resource-limieten of
untrusted-input-hardening. Voor F0 (detector + bytes + harnas) minder acuut, maar
de detector MOET wel een grootte-cap of streaming-limiet overwegen voordat hij een
heel bestand als string/bytes in het geheugen trekt. Aanbeveling: expliciteer in de
F0-brief dat detectFormat alleen de EERSTE N bytes (bv. 512) nodig heeft voor magic,
niet het hele bestand — scheelt geheugen en is veiliger.

### [MINOR] xmldom-shim mist CDATA/namespaces -> corpus-runner op echte PMXML onbetrouwbaar in Node
[BEVESTIGD] tests/planning/xmldom-shim.ts r51-79: regex-parser, strip <?..?> en
comments, GEEN CDATA-afhandeling (CDATA-inhoud wordt als tekst/tags misgeparsed),
localName = split op ':' (naive). PMXML-notities zijn HTML-in-CDATA (ram 2.2). De
corpus-runner T4 draait op Node -> als hij de shim gebruikt, faalt hij op echte
PMXML met CDATA of geeft verkeerde resultaten. Brief B4 (spec r56) zegt "xmldom-shim
moet namespaces/CDATA leren" maar T4/F0 plant die shim-uitbreiding NIET expliciet in.
Als de corpus-runner in Node draait moet OF de shim uitgebreid (F0), OF de runner een
echte DOMParser (bv. @xmldom/xmldom als devDep) gebruiken. Ongespecificeerd = GLM
raadt, waarschijnlijk de bestaande kreupele shim.

### [BEVESTIGD, nuance op de rapporten] De "stille IFC-fallback" is NIET meer volledig stil — hij gooit
readIFC gooit sinds K4 een IfcParseError('not-step') als de STEP-kop ontbreekt
(ifcReader r66-71, assertIfcIntegrity). Dus een .xer die via de else->readIFC-tak
komt (openFile r205-207, openRecentFile r479-481, parseByExtension r171,
parseExternalSource r411) FAALT met "Geen IFC/STEP-bestand: de verplichte kop
'ISO-10303-21' ontbreekt" — niet met een leeg "Imported Project".

Dit corrigeert rat-rapport r16 ("faalt daar of levert een leeg Imported Project")
en spec-risico 2 gedeeltelijk: het IS een nette fout, alleen de BOODSCHAP is
misleidend (zegt "geen IFC-bestand" terwijl de gebruiker een .xer opende die OPS
straks wel kan). De detector (T1) verbetert dit terecht naar een expliciete
"onbekend formaat"-fout. Geen blocker, maar de brief overdrijft het "stille"
karakter; het echte defect is de misleidende fouttekst + dat .xer/.mpp/.pp NIET
in de dialoog-filters staan (openFile r191-196: alleen ifc/csv/xml), dus de
gebruiker kan ze in Tauri niet eens selecteren. Dat filter-punt staat NIET in de
F0-brief T-lijst (het is spec-aanhaakpunt maar F6). Voor F0 kan de gebruiker dus
geen enkel nieuw formaat kiezen — het harnas test alles, de UI biedt niets. Dat is
consistent met de fasering (UI in F6), maar de brief zou moeten zeggen dat T1 de
dialoogfilters bewust NOG NIET aanraakt, anders "helpt" GLM en breekt de i18n-poort.

### [MINOR] check-format-detect.ts esbuild-patroon is haalbaar
[BEVESTIGD] tests/planning/run.sh bundelt met esbuild op Node; Uint8Array is native
in Node, dus een detector-test met synthetische byte-arrays draait triviaal. GEEN
DOMParser nodig als detectFormat puur op magic/prefix werkt (geen XML-parse voor
detectie). Let op: als detectFormat voor de XML-tak een echte parse doet, trekt hij
de DOMParser-shim binnen (domShim eerst importeren, zoals check-adapters-hours r23-25).
Beter: detecteer XML-dialect op string-includes (zoals nu), geen parse. Brief laat
dit impliciet; expliciteren voorkomt dat GLM een DOMParser in de detector legt en de
headless-bundel sloopt.

### [MINOR] Multi-project XER/PMXML: getAllByLocalName-fix moet per-Project itereren, niet globaal recursief
[BEVESTIGD] pmxml-samples bevat MultiprojectWithExternal.xml en p6_multiproject.xml.
Als de B3b-fix "gewoon recursief alle <Activity> pakken" wordt, verliest de reader
de project-toewijzing (welke Activity bij welk Project) en de cross-project externe
relaties (ram 2.5). Spec r52 zegt terecht "recursief zoeken (of per Project itereren
— nodig voor multi-project sowieso)". De F1/F2-brief MOET per-Project kiezen, niet
plat recursief, anders smelten meerdere projecten samen tot één taakhoop. Nu nog niet
in F0, maar de valkuil moet in de F2-brief expliciet.

### [BEVESTIGD] B3 stille P6-baseline-verlies: writer heeft NUL baseline-referenties (zelfs geen warn)
grep op "baseline" in p6xmlWriter.ts = 0 hits; in p6xmlReader.ts = 0 hits. Dus
OPS-baselines gaan bij P6-export volledig + STIL verloren, en een P6-bestand met
<BaselineProject> wordt bij import genegeerd. T3 (brief r48) zegt "baselines-verlies
expliciet (console.warn) — of schrijven indien PMXML dat draagt (beslis na
ram-rapport)". Ram-rapport 2.4 bevestigt: PMXML DRAAGT baselines (<BaselineProject>
naast <Project>, CurrentBaselineProjectObjectId). Dus de eerlijke keuze is: minstens
een warn in F0, echt schrijven pas in F2 (BaselineProject-lezen staat in F2, spec r95).
De brief laat de keuze open ("beslis na ram-rapport") — nu ram er is, MOET de
definitieve brief zeggen: F0 = alleen warn (verlies expliciet maken), schrijven=F2.
Anders bouwt GLM of niets, of een half BaselineProject-writer buiten scope. Beslis
het, laat het niet aan het goedkope model over.

### [BEVESTIGD] MCP-description (fileTools r289-309) noemt P6-baseline-verlies NIET
De VERLIES-PER-FORMAAT-alinea (r294-296) noemt CSV-kalenderverlies en
P6-Nonlabor->EQUIPMENT, maar NIET dat P6-export baselines/notes/hammock/externe
links/schedulingOptions stil dumpt. T3 (brief r49) "verlies-paragrafen actualiseren"
moet dit concreet toevoegen, anders adviseert de AI-brug de gebruiker verkeerd
("MSPDI is het rijkst na IFC" verzwijgt dat P6 baselines verliest en MSPDI ook).

### [MAJOR] Detector-tegenstrijdigheid: "magic eerst, extensie als tiebreaker" botst met ".xml met ERMHDR"
[BEVESTIGD] Brief T1 r24-25: "Inhouds-magic eerst, extensie als tiebreaker" en r37
als testcase: ".xml met ERMHDR erin". Als magic ECHT eerst gaat, wint ERMHDR en
wordt een .xml als XER geparsed. Dat is meestal juist (een misgenoemd XER). Maar
denk aan het omgekeerde: een PMXML-notitieveld met de letterlijke tekst "ERMHDR" of
"SQLite format 3" in een CDATA/HTML-note (ram 2.2: notities zijn HTML). Een naief
"content.includes('ERMHDR')" of magic-scan over het HELE bestand matcht dat mid-file.
De magic MOET aan het BEGIN staan (na BOM), niet ergens in de content. Brief r26 zegt
"ERMHDR aan het begin (na optionele BOM)" — goed voor XER. Maar r28 "SQLite format 3\0"
en r27 "D0CF11E0" moeten OOK strikt op offset 0, en de XML-markers (r29-31) mogen NIET
mid-file matchen op een noot. Nu doet parseProjectXml al includes() over alles (r42-44)
— dat is de bestaande zwakte. Als de detector dat 1:1 overneemt, kan een PMXML-noot met
"schemas.microsoft.com/project" erin een P6-bestand als MSPDI misdetecteren. VOORSTEL:
brief moet zeggen: magic strikt op offset 0; XML-dialect op de root-element-tag +
xmlns-attribuut (eerste ~2KB), niet op vrije includes() over het hele bestand.

### [BEVESTIGD] Bewijs schaal T2-blocker: 11 XER-bestanden in de corpus hebben high-bytes (cp1252)
Gemeten: 11 van de crawl-xer/P6-Viewer .xer-bestanden bevatten bytes 0x80-0xFF.
Elk daarvan wordt door het huidige readTextFile/file.text()-string-pad (UTF-8)
stil corrupt. Dit is geen theoretisch randgeval maar ~een kwart van de XER-corpus.
Geen UTF-16-BOM XER/ics aangetroffen, maar cp1252-decode is onmisbaar.

---

## F0-opknip-oordeel (thread f): T1-T4 volgorde is FOUT

T1 (detector) VOOR T2 (bytes) is de verkeerde volgorde: de detector kan binaire
magics (mpp/astapp) niet zien zolang openFile een UTF-8-string doorgeeft, en kan
XER-cp1252 niet redden. Correcte volgorde:
  1. T2-bytes-pad EERST (fileAccess levert rauwe bytes + per-formaat-decode-hook).
  2. T1-detector daarbovenop (op offset-0-magic uit bytes; XML-dialect op root/xmlns).
  3. T3 (writer-verlies-fixes) is ONAFHANKELIJK — kan parallel/eerst, raakt T1/T2 niet.
  4. T4 (corpus-runner) LAATST — hangt van T1+T2 af.
T3 is een goede losse GLM-run (zelfstandig, geen afhankelijkheid). T1/T2 zijn zo
verweven (interface: string vs bytes) dat ze beter ÉÉN run zijn, of T2 strikt eerst
met een expliciet bytes-interfacecontract dat T1 consumeert. Zoals nu genummerd
bouwt GLM T1 op strings en zet zichzelf klem.

---

## Kon ik NIET (volledig) controleren
- Of writeP6XML echt een BaselineProject KAN schrijven met de huidige datastructuur
  (ik zag alleen dat er nu 0 baseline-code is; de haalbaarheid van de F2-writer niet
  getoetst).
- Runtime-gedrag van sql.js/cfb in de browser-build (geheugen bij 3MB+ MPP): puur
  uit rapport, niet gedraaid.
- Of de xmldom-shim op een ECHTE PMXML met CDATA daadwerkelijk crasht of stil fout
  parst — ik las de shim-code (geen CDATA-tak) maar draaide hem niet op UploadScheduleP6.
- MPP/Asta binaire parsing: buiten F0-scope, niet beoordeeld op code (bestaat nog niet).
- verify-poort zelf niet gedraaid (read-only, geen npm per opdracht).

---

## POORT-OORDEEL: NEE — niet doorlaten in deze vorm

De spec is fundamenteel gezond (besluiten goed onderbouwd, corpus is goud). De
F0-BRIEF is NIET klaar voor een goedkoop model dat elk gat trouw als bug uitvoert.
Drie blockers zouden GLM regelrecht een kapotte F0 laten bouwen:

MINIMAAL vereist vóór GLM mag beginnen:
1. [BLOCKER] T2 herschrijven: bytes-pad geldt OOK voor XER (cp1252/BOM-decode na
   detectie). "alleen mpp/astapp lezen bytes" schrappen. 11 van 38 XER-corpusbestanden
   (crawl-xer + P6-Viewer, gemeten) bewijzen de noodzaak.
2. [BLOCKER] T1/T2-volgorde omdraaien of samenvoegen + expliciteren dat detectFormat
   op RAUWE BYTES (offset-0-magic) werkt en dat openFile opened.bytes doorgeeft, niet
   opened.content. Anders detecteert de detector mpp/astapp nooit.
3. [BLOCKER] B3b-nesting: OF een expliciete F0-taak toevoegen die getAllByLocalName
   per-Project/recursief maakt MET een echt genest fixture, OF de bug expliciet naar
   F2 verschuiven en de spec (r51-52 "hoort bij F0/F1") rechttrekken. En de
   round-trip-test MOET een echt genest P6-fixture krijgen — de groene
   check-adapters-hours bewijst niets omdat hij alleen platte eigen writer-output test.

Sterk aangeraden (anders levert GLM half werk):
4. Vier call-sites (openFile r198-207, openRecentFile r472-481, parseExternalSource
   r411, parseByExtension r166-171) met regelnummers EXPLICIET in de brief als
   te-wijzigen opsommen.
5. T4-corpuspaden via env/arg i.p.v. hardgecodeerd absoluut pad met spaties;
   Buffer-input; mpp/astapp = gedetecteerd-maar-overgeslagen in F0.
6. Detector: magic strikt offset-0, XML-dialect op root+xmlns (niet includes() over
   hele bestand); grootte-cap (eerste ~512 bytes voor magic).
7. Brief moet zeggen: T1 raakt de dialoogfilters/UI NOG NIET (F6), zodat GLM de
   i18n-poort niet breekt.
8. T3 baseline-besluit definitief maken (F0=warn, schrijven=F2) nu ram er is.

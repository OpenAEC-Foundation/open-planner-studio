# B1c — Nivelleren tegen restcapaciteit (ontwerp)

Datum: 2026-08-17 · Herzien: 2026-08-27 — twee hyperkritische reviewronden (NO-GO →
GO-MITS, alle punten verwerkt) én rebase op main (472 commits, o.a. de .mpp-etappe en de
store-runtime-verbouwing). Status: **ontwerp compleet** — alle beslispunten besloten
(§11); volgende stap: implementatieplan. De speelbare prototypes staan als
privé-artifacts: "Wie wijkt?" (rondes 1–3) en "Interface-lab" (vier tune-bedieningen).

## 1. Doel en aanleiding

B1b (bezettingsoverzicht) maakt bibliotheekbrede knelpunten zichtbaar; B1c maakt ze oplosbaar:
vanuit een conflictregel in `ResourceOccupancyView` de overboeking wegwerken door de last te
**verdelen** over de geopende documenten die het poolitem boeken. Vervolg op B1b-spec §12
(`2026-08-14-b1b-bezettingsoverzicht-design.md`).

Twee richtingen zijn in ronde 1 met speelbare prototypes afgewogen en **afgevallen** (besluit
eigenaar 2026-08-17): "één document wijkt" (te grof, geen lastverdeling) en volautomatisch
oplossen met undo (de app neemt dan stilzwijgend een planningsbeslissing). De kern van B1c is
een *verdeler* met de planner aan het stuur.

## 2. Wat er sinds het eerste ontwerp veranderd is (rebase-feiten)

Deze spec is herschreven tegen de main van 2026-08-27. Drie feiten die het eerste ontwerp
achterhaald maakten, alle drie in de code geverifieerd:

1. **Taak-splitsing bestaat al** (besluit eigenaar 2026-08-27: "taak-splitsing bestaat al
   sinds de native .mpp-import"). `Task.splitGaps` (`src/types/task.ts`, offset-gebaseerde
   werkonderbrekingen) wordt gevuld door de .mpp-import, round-tript door IFC
   (`OPS_TaskSplits`-pset), wordt geconsumeerd door de CPM (`duration.ts`'s
   `splitTotalSpanMinutes`, vier aangrijpingspunten in `CPMSolver.ts`) en de renderer tekent
   onderbroken balken in Gantt/print/PDF. **De F1/F2-motorknip uit het eerste ontwerp vervalt**:
   de onderbreek-modus is geen nieuwe motorcapaciteit maar "de verdeler leert `splitGaps`
   schrijven". Beide standen van de schakelaar zitten dus in v1 (§3).
2. **Maar de lastspreiding is split-blind.** `ResourceLoad.ts` (`computeResourceLoad`/
   `distributeUnits`), de bezettingskern (`occupancy.ts`) én de nivelleerder
   (`bookDemandAt`) kennen `splitGaps` niet (nul verwijzingen). Een geïmporteerde taak met
   splits telt vandaag zijn pauzedagen als belasting — een bestaande fout in het
   B1b-overzicht die vóór B1c gerepareerd moet zijn (werkpakket W0, §4).
3. **`createAppStore()` bestaat** (onderhoudbaarheidsitem 41 is af) en de transactie-runtime
   (undo-volgnummers, coalescing, batch-diepte) is sinds 2026-08-24 per store-instantie
   (`src/state/runtime/storeRuntime.ts`). Een **headless scratch-instantie** is daarmee een
   reëel mechanisme om een slapend document met de échte acties te bewerken (§5). App-globale
   registers (extensies, MCP, bibliotheek-persistentie) kennen nog één store — split-view
   blijft buiten scope, maar dat raakt een headless instantie zonder UI-randen niet.

## 3. Harde randvoorwaarden

1. **Uitsluitend doorgerekende (counted) cijfers.** Restcapaciteit uit een stale document is
   nivelleren tegen een getal dat nergens vandaan komt (B1b-critreview). B1b's efemere solve
   (§4.3b aldaar) maakt stale documenten normaal counted; blijft een document uncounted
   (mislukte solve), dan is de nivelleeractie voor conflicten waarin dat document meedoet
   **geblokkeerd met uitleg** — geen stille uitsluiting.
2. **Matching via `libraryOrigin`-stempels** (companyId + libraryItemId), nooit via naam.
3. **Alleen geopende documenten op deze machine** — zelfde beperking en hint als B1b.
3a. **"Datums zoals opgeslagen" (issue #63) = impliciet gepind.** Een document in die modus
   meldt `counted: true` met datums die de motor niet berekend heeft, en `applyLeveling`
   zou de modus stil verlaten en de opgeslagen datums overschrijven. Daarom: zo'n document
   kan niet wijken (het staat als vaste last in het profiel, met een eigen label in de
   fasestrook — "vastgezet: datums zoals opgeslagen") en B1c raakt zijn data nooit aan.
   Wil de planner het laten meedoen, dan verlaat hij eerst bewust die modus in het document
   zelf.
4. **Prestatiebudget, meetbaar** (twee onafhankelijke metingen, Node, synthetische
   projecten; kwadratische kern `computePF`): één nivelleerrun ≈ 117 ms bij 200 taken /
   40 boekend, ≈ 405 ms bij 1000 taken / 40 boekend, ≈ 2,4 s bij 5000 taken, ≈ 2,9 s bij
   1000 taken / 200 boekend. Bindende regels voor de UI (§7):
   - **Ondersteunde schaal**: tot ~1000 taken per document en ~40 boekende taken per
     poolitem is één verdeel-pass (één run per deelnemend document) ≤ ~0,5 s per document —
     vier documenten ≈ ≤ 2 s, met bezig-toestand. Daarboven schakelt het paneel om:
     doorrekenen gebeurt dan uitsluitend op de knoppen "Verdeel automatisch"/"Herbereken"
     (handle-loslating rekent niet meer automatisch; het effectlabel toont "— druk op
     Herbereken"). Dat ís de gedefinieerde degradatie; niets bevriest stil.
   - Doorrekenen gebeurt alleen op **discrete momenten**: paneel openen, "Verdeel
     automatisch"/"Herbereken", loslaten van een handle of een toetsenbord-stap, pin-,
     rangorde- of gereedschapswijziging — nooit per sleep-pixel.
   - **"Gevraagd X, dichtst haalbare Y" kost géén zoektocht**: het is één pass met het
     gevraagde plafond; de dichtst haalbare stand is de benutting die uit diezelfde pass
     rolt (benut ≤ plafond). Geen iteratie over kandidaat-plafonds.
   - De kostenlabels in de rangordelijst ("alleen dit project laten opschuiven kost +N")
     zijn elk óók een volledige run: ze worden alleen onder de ondersteunde schaal bij
     paneelopening berekend en gecachet tot invalidatie (§6a); daarboven on-demand per knop.

## 4. Rekenkern

### W0 — voorwaardelijk werkpakket: split-bewuste lastspreiding

Vóór de verdeler bestaat, moeten motor, lastlezers én renderer dezelfde dagen zien. Vier
items, elk ook zonder B1c een reparatie van bestaand gedrag:

1. **Split-bewuste lastverdeling.** `computeResourceLoad`/`distributeUnits` leggen belasting
   alleen op échte werkdagen (gaten uit `splitGaps` overslaan); de bezettingskern erft dat.
   **Curve-besluit** (dit verandert bestaande B1b-cijfers voor split-taken, en dat is de
   reparatie): de werkcurve (BELL/EARLY_PEAK/…) wordt over de *werkdagen* gelegd — werkdag
   *k* draagt gewicht *k* van de curve; gaten rekken de spanne, niet de verdeling.
2. **Split-bewuste motor-boekhouding.** `bookDemandAt` boekt nu de eerste
   `scheduleDuration` werkdagen vanaf de start — voor een gesplitste taak zijn dat de
   verkeerde dagen. Boeking volgt dezelfde gat-bewuste wandeling als (1). Testplicht: een
   case met taakkalender ≠ projectkalender door beide paden (motor-boeking én
   `computeResourceLoad`) — de review vermoedt (hoog) dat die vandaag al uiteenlopen.
3. **`levelingDelay` in één kalender-eenheid.** De leveler meet de delay op de
   projectkalender (`workDaysBetween` op `projEngine`) maar de CPM past hem toe op de
   táákkalender (`shiftByLevelingDelay` via `engineFor(task)`) — een taak met eigen
   `calendarId` landt dus ergens anders dan de preview beloofde. Meten en toepassen worden
   beide de taakkalender.
4. **Renderer op de H1-as.** `splitBarGeometry.ts` loopt nog op de pre-H1-asinterpretatie
   (`prevAfter = gap.afterMinutes` i.p.v. `afterMinutes + gapMinutes` cumulatief) en tekent
   een taak met ≥2 gaten aantoonbaar fout (door de review gereproduceerd: tweede segment te
   lang, derde segment achterstevoren ná het taakeinde). Repareren, en de suite laat
   x-posities toetsen in plaats van alleen rechthoeken te tellen
   (`check-split-bar-render.ts`).

### Het plaatsingsprotocol (de verdeler)

De eerste versie van deze spec gaf een formule die verdelen onmogelijk maakte (iedereen zag
iedereen op zijn huidige plek → nergens rest). Het protocol is **sequentieel, in rangorde**:

1. Bepaal de **vaste last**: per dag de som van (a) gepinde documenten en (b) documenten
   buiten de verdeling (niet in het conflict betrokken maar wel boekend op het poolitem).
   Uncounted documenten blokkeren de hele actie (§3.1) en komen hier dus nooit in voor.
2. Plaats documenten **één voor één in rangorde** (nr. 1 eerst). Er zijn **twee
   grootboeken**, want de motor toetst per `resourceId` en de bibliotheekvraag leeft per
   poolitem: (a) de bestaande per-resource-toets tegen de **eigen projectinzet**
   (`maxUnitsOn(projectresource, dag)` — voorkomt dat B1c een bibliotheekconflict oplost
   door een projectconflict te maken), én (b) een **gedeeld poolitem-grootboek** met
   `maxUnitsOn(poolitem, dag) − vasteLast(dag) − Σ boekingen van reeds geplaatste
   documenten(dag)`, geklemd op minimaal 0. Een dag past alleen als béíde toetsen slagen.
   Twee gestempelde resources op hetzelfde poolitem in één document trekken zo van
   hetzelfde poolitem-grootboek — geen dubbeltelling.
3. Nr. 1 pakt als eerste zijn plek (hij nivelleert alleen tegen de vaste last); elk volgend
   document ziet de werkelijke boekingen van zijn voorgangers. **Het
   niet-plaatsbaar-geval is gedefinieerd, niet weggeboekt**: de huidige motor boekt bij
   "geen slot" de vraag tóch in het grootboek (onvoorwaardelijke `bookDemandAt`), waardoor
   het restprofiel negatief zou worden en elk volgend document mee zou cascaderen. In de
   verdeler geldt daarom: kan een taak binnen plafond en profiel niet geplaatst worden, dan
   wordt zijn vraag **niet** in het poolitem-grootboek geboekt maar als **tekort per
   document** geregistreerd (eigen reden-code, zichtbaar in het voorstel); het restprofiel
   blijft ≥ 0. De haalbaarheidsgarantie geldt zo voor wat wél geplaatst is: de som van
   geplaatste boekingen blijft ≤ capaciteit. Een voorstel met tekorten is een geldige
   preview maar blokkeert Toepassen (uitgeschakeld-met-reden, §4-concept stap 3). Eén pass,
   geen iteratie; de rangorde ís de fairness-knop.

Binnen één document plaatst de bestaande motor (`levelResources`): uitloop-modus =
`levelingDelay` per taak (bestaand), onderbreek-modus = **gap-invoeging**: de verdeler
kiest pauzedagen en schrijft ze als `splitGaps` op de taak. Model, IFC-round-trip en
(na W0.4) rendering bestaan — maar dit is méér dan plaatsingslogica; vier afspraken horen
erbij, alle vier ontwerp:

- **Herkomst.** `TaskSplitGap` krijgt een optioneel herkomstveld (`source?: 'leveling'`;
  afwezig = importdata, byte-identiek voor bestaande bestanden), mee door de
  `OPS_TaskSplits`-round-trip. `applyLeveling` (idempotent herschrijven), "nivellering
  wissen" en "alles terugdraaien" raken uitsluitend leveling-gaps; importsplits zijn
  brondata en blijven staan.
- **Invalidatie.** Een bewerking die de tijdbasis van de taak raakt (duur, kalender,
  handmatige datums, voortgang) wist de leveling-gaps van díé taak — een gat op een
  verouderde as is geen planning maar ruis. Importsplits volgen dit niet (bestaand gedrag).
- **As- en eenheidconversie.** `afterMinutes` ligt op MSP's cumulatieve elapsedWork-as (elk
  gat telt zichzelf mee voor de positie van het volgende — de H1-definitie in
  `duration.ts`) en wordt door de CPM afgelopen als **werk**minuten op de **taak**kalender.
  De verdeler kiest pauzedagen dus op de taakkalender en schrijft ze via één gedeelde
  conversieroutine naast `splitTotalSpanMinutes`; testplicht bij taakkalender ≠
  projectkalender en niet-gehele `hoursPerDay`.
- **In-progress.** MSP's eigen formulering is *"splits in **remaining** work"*. In v1
  voegt de verdeler alleen gaps toe aan **niet-gestarte taken** (`completion === 0`);
  gestarte taken wijken uitsluitend via uitloop. De restwerktak van de CPM
  (vijfde aangrijpingspunt) blijft daarmee buiten schot.

### De naad in de nivelleerder — breder dan `capacityOf`

Het capaciteitsprofiel komt binnen via `capacityOf`, maar daar hangen meelezers aan die met
een restprofiel de verkeerde diagnose stellen; die worden in dezelfde beweging herzien:

- `calendarOk` leest `capacityOf(...) <= 0` nu als "kalender-onhaalbaar"; met een restprofiel
  is 0 de normale waarde van een volle dag. Kalender-haalbaarheid en capaciteit worden
  gescheiden getoetst.
- De **conflictverzamelaar** mist de nul-guard die `fits` wél heeft: met een geklemd profiel
  van 0 zou een dag met nul vraag als conflictdag gerapporteerd worden. Beide paden krijgen
  dezelfde guard.
- **`scanLimit`** (nu `totalWork + 10`) rust op het argument dat een volledig
  geserialiseerde plaatsing binnen de som van de eigen taakduren past — dat geldt niet meer
  zodra het grootboek externe vaste last bevat: het eerste vrije venster kan ver voorbij die
  horizon liggen. De scan krijgt een horizon afgeleid van het restprofiel, en "geen venster
  binnen de horizon" wordt een eigen, eerlijke reden in plaats van een verzonnen "geen slot".
- `reasonFor`/`maxCapacityOf` vergelijken de piekvraag met de **projectresource**-capaciteit;
  met een restprofiel is dat betekenisloos. De reden-taxonomie (`LevelingReason`) krijgt
  nieuwe, eerlijke uitkomsten: *restcapaciteit vol* (anderen bezetten de pool), *plafond te
  krap* (uitloop-plafond verhindert een oplossing), *document kan niet wijken* (alle taken
  gepind/priority 1000), naast de bestaande kalender- en capaciteitsredenen. §3's belofte
  "validatie wijst altijd een uitweg aan" staat of valt met deze taxonomie.
- **Plafond-referentiepunt**: het plafond "maximale uitloop van de einddatum = X werkdagen"
  is gedefinieerd t.o.v. de **huidige opgeslagen projecteinddatum** (mét bestaande
  nivellering). De motor vertaalt dat naar een per-taak-venster (`ls + X`), berekend op een
  baseline die de bestaande `levelingDelay`s **behoudt** (de huidige interne baseline stript
  ze — dat wordt aangepast, zie ook "scope-behoudend toepassen" in §5). Deadlines en
  backward-constraints (SNLT/FNLT/MSO/MFO) kunnen een plafond onhaalbaar maken vóórdat het
  bereikt is; dat meldt de taxonomie als eigen reden ("uitloop geven helpt hier niet — taak X
  heeft een deadline"), niet als generiek capaciteitstekort.

### Het concept: F — gereedschap → rangorde → automatisch → tunen

Besluit eigenaar 2026-08-17 ("we gaan sowieso voor F"). Vier stappen, gestart vanuit een
conflictregel; **beide gereedschapsstanden vanaf v1** (§2.1):

- **Stap 0 · Gereedschap** — schakelaar "Onderbrekingen toestaan" (MS Project-equivalent:
  *"Leveling can create splits in remaining work"*). Uit = alleen uitlopen (fasen schuiven
  als geheel); aan = de verdeler mag pauzedagen invoegen. Naast de schakelaar het
  doorgerekende prijskaartje van beide standen — berekend bij paneelopening en bij
  invalidatie, niet live (§3.4).
- **Stap 1 · Rangorde** — sleepbare lijst "wie wordt het meest ontzien?", startvolgorde op
  float gesorteerd (float van een document = de kleinste totale float over zijn boekende
  taken op dit poolitem, uit de counted cijfers — bij een stale document dus uit de efemere
  solve). Per regel: float en het gecachete kostenlabel.
- **Stap 2 · Verdeel automatisch** — het plaatsingsprotocol hierboven; eerst float benutten
  (kost geen einddatum), dan het restant zó dat de grootste einddatum-verschuiving minimaal
  is, binnen de rangorde. Het voorstel is een **preview** — niets wordt geschreven vóór
  "Toepassen".
- **Stap 3 · Tunen** — plafonds en pins per document via de fasestroken (§6). Plafond 0 =
  einddatum staat vast maar binnen de float mag de motor werken; plafonds zijn maxima, geen
  opdrachten. Toepassen is uitgeschakeld-met-reden zolang het tekort niet gedekt is.

## 5. Toepassen: schrijven in meerdere documenten

Toepassen schrijft in elk document dat in het voorstel meedoet. Twee schrijfpaden, één
gedeelde afronding:

- **Het actieve document** (vrijwel altijd deelnemer — de gebruiker kijkt er via het
  bezettingsoverzicht naar) gaat door het gewone top-level-pad: één undo-snapshot, delays/
  gaps schrijven, `runCPM`.
- **Slapende documenten** gaan bij voorkeur via een **headless scratch-instantie**
  (`createAppStoreContext()`, §2.3): payload hydrateren, dezelfde acties draaien
  (undo-snapshot op de eigen stack, schrijven, doorrekenen), payload terug capturen. Zo
  gelden `MAX_UNDO`, coalescing en het documentcontract vanzelf. **Twee bekende
  singleton-randen worden expliciet dichtgezet** (door de review aangewezen; geen bestaande
  poort dekt ze): (a) `runCPM` vuurt `emitExtensionEvent('schedule:calculated')` op een
  app-globale luisteraar-map — extensies zouden cijfers krijgen van een document waar de
  gebruiker niet naar kijkt; de emitter wordt context-bewust/injecteerbaar en staat in de
  scratch-instantie uit. (b) `notify` schrijft in de `ui.notifications` van de eigen
  context — in een scratch-instantie rendert niemand die; fouten uit de scratch-run
  (cyclus, lege kalender) bubbelen daarom op als blokkerende reden in het voorstel, nooit
  als onzichtbare melding. De terugvaloptie (payload-spread naar het patroon van
  `recalculateStaleSleepingDocuments`, mét undo-snapshot vooraf in de payload-stack) is
  kleiner maar eerlijk benoemd zwakker: hij omzeilt `beginUndoable` en moet
  `MAX_UNDO`-trimming en coalescing zelf naborgen — precies wat het scratch-pad gratis
  meekrijgt.

Afspraken die in beide paden gelden:

- **Scope-behoudend toepassen — op drie plekken.** `applyLeveling` reset vandaag álle
  `levelingDelay`s, én de motor stript ze intern nóg een keer (`workTasks`), en de
  plafond-baseline moet ze juist behouden. Selectief worden dus alle drie: de reset-lus in
  `applyLeveling`, de interne strip in `levelResources`, en de baseline waarop het plafond
  rekent — steeds "alleen taken binnen de scope". De moduleheader van de leveler voert de
  volledige strip nu op als invariant; het implementatieplan valideert expliciet dat
  `computePF` met behouden out-of-scope-delays overweg kan.
- **De doorrekening wordt gepersisteerd.** Het voorstel is berekend op doorgerekende cijfers;
  toepassen zonder de nieuwe datums te schrijven zou payloads achterlaten waarop het
  toegepaste voorstel niet gebaseerd was. `cpmResult`/`scheduleStale` zitten als `'ref'` in
  de snapshot, dus undo draait ook de doorrekening terug — mits de snapshot vóór de hele
  operatie genomen is.
- **Ook in handmatige modus.** B1b §4.3b schrijft alleen terug wanneer "Automatisch
  berekenen" aanstaat; B1c's Toepassen schrijft onvoorwaardelijk — de gebruiker drukte
  expliciet op een knop, dat is geen stille bijwerking. Dit is een bewuste grensverlegging
  op dat eerdere besluit en staat open als beslispunt §11.5.
- **De terugweg woont in het paneel, niet in een melding.** Het meldingenkanaal (K8a) kent
  geen actieknoppen en ruimt `info` na 5 s op — ongeschikt als enige terugweg. Na toepassen
  toont het paneel zelf een persistente "toegepast"-strook met **"alles terugdraaien"**
  (draait de undo-stap van elk beschreven document terug, via dezelfde twee paden); daarnaast
  werkt gewone per-document-undo na het activeren van dat document. De melding blijft puur
  informatief.

## 6. De tune-bediening: fasestrook-handles + pins (besluit)

Vier bedieningen zijn speelbaar vergeleken in het Interface-lab (ster met trekpunten —
idee eigenaar —, verdeelbalk, communicerende vaten, fasestrook-handles). **Besluit eigenaar
2026-08-27: fasestrook-handles, met de pin uit de vaten-variant mee in v1.**

- **Wat de strook toont.** Per document één strook met zijn **boeking** op het poolitem: de
  vereniging van álle taken van dat document die (via een gestempelde resource) op dit
  poolitem boeken — mogelijk niet-aaneengesloten; interne gaten (bestaande splits of
  ingevoegde pauzes) worden als gaten getekend, zoals de Gantt-renderer dat al doet. "De
  fase" uit de prototypes is dus formeel: *de boeking van dit document op dit poolitem*.
- **De handle** zit aan het rechtereinde van de strook en zet het plafond "maximale uitloop
  van de einddatum" (§4-referentiepunt). Omdat het boekingseinde en de projecteinddatum
  alleen samenvallen als de boeking het laatste werk is, toont het label bij de handle
  **altijd het einddatum-effect** ("eind +1 dag" / "eind ongewijzigd") — het doorgerekende
  effect, niet de sleepafstand. Sleep-feedback tijdens het slepen is de plafondwaarde;
  het effect verschijnt bij loslaten (discrete doorrekenmomenten, §3.4). Een gestippelde
  staart toont *toegestaan maar niet benut*.
- **De pin** per strook bevriest het document volledig — einddatum én werkdagen. Een gepind
  document doet niet mee in de verdeling (ook niet binnen float) en telt als vaste last in
  het profiel (§4). De pin is daarmee hét gereedschap voor "houd ook je dágen"; los daarvan
  bestaat er in de motor al een taak-pin (priority 1000) — een document dat daardoor niet
  kán wijken krijgt zijn eigen reden-code (§4-taxonomie), geen generieke capaciteitsmelding.
- **Bediening**: pointer-slepen (blijft werken buiten het element) én toetsenbord
  (`role="slider"`, pijltjes = één werkdag, Home/End, `aria-valuetext` met plafond, benutting
  en einddatum-effect); pin met `aria-pressed`. Snappen op hele werkdagen.
- Twee **systeembevindingen** uit het lab blijven van kracht: (1) de som garanderen is de
  oplossing niet garanderen — elke stand vergt een echte haalbaarheidscheck; (2) de haalbare
  standen zijn schaars — de bediening toont "gevraagd X, dichtst haalbare Y" in plaats van
  elke tussenstand te beloven.

### 6a. Levensduur van het voorstel

Het voorstel (en de gecachete kostenlabels) is berekend over een momentopname van de
betrokken documenten. Het **vervalt met reden** — zichtbaar in het paneel, niet stil — bij:
wijziging van rangorde, plafond, pin of gereedschapsstand (gewone hertriggering); elke
mutatie in een betrokken document (actief: store-mutatie; slapend: payload-vervanging);
sluiten of openen van een document dat op het poolitem boekt; en documentwissel. Het paneel
bewaakt dit met een vingerafdruk per betrokken document: payload-referentie voor slapers, en
voor het actieve document een **monotone mutatieteller die de store-runtime exposeert**
(nieuw, klein — het interne undo-volgnummer zit in een closure en `undoStack.length` is
onbruikbaar door `MAX_UNDO`-trimming). `resetDocumentScopedUI` leert dit paneel kennen.

## 7. Plek in de UI

Vanuit een conflictregel in `ResourceOccupancyView` (Resources-tab, derde weergave). De flow
is te groot voor een uitklapregel; voorzien als paneel/dialoog vanuit de conflictregel:
bovenin het histogram als voor/na-preview, daaronder de fasestroken-met-handles-en-pins
(stap 3), daarboven de gereedschapsschakelaar en de rangordelijst (stappen 0–2), onderaan
Toepassen/verwerpen en na toepassen de terugdraai-strook (§5). Alle doorrekening op de
discrete momenten uit §3.4, met bezig-toestand. Detaillering in het implementatieplan.

## 8. i18n en documentatie

Volledig via `t(...)`, veertien talen, CLDR-pluralen (dag/dagen-teksten!). Gebruikersgids
(minimaal nl+en) met manifest-entry — de schakelaar "onderbrekingen" met het MS
Project-equivalent erbij, en de pin/plafond-semantiek in gewone taal (einddatum vs. werkdagen).

## 9. Tests

Headless, in de bestaande suites:

- **W0**: split-bewuste lastverdeling (`computeResourceLoad` slaat gaten over, curve over
  werkdagen; motor-boeking en loadverdeling tellen dezelfde dagen, inclusief de
  taakkalender≠projectkalender-case); bestaande .mpp-split-miscount als regressiecase;
  `levelingDelay` gemeten én toegepast op de taakkalender; renderer-x-posities voor ≥2
  gaten op de H1-as (de multi-gat-cases in `check-split-bar-render.ts` gebruiken nu
  as-waardes die elkaar overlappen en het verschil maskeren — die worden vervangen).
- **Verdeler**: float eerst; uitschieter minimaal; rangorde gerespecteerd (nr. 1 nivelleert
  alleen tegen vaste last); plafonds hard; plafond t.o.v. einddatum-mét-bestaande-delays;
  plafond onhaalbaar door deadline/backward-constraint ⇒ eigen reden; gepind document
  volledig ongemoeid én meegeteld als vaste last; priority-1000-document ⇒ "kan niet wijken";
  `min` met projectinzet; dubbele stempel in één document (gedeeld grootboek, niet dubbel);
  som-≠-oplossing-geval; niet-plaatsbaar document ⇒ tekort geregistreerd, restprofiel
  blijft ≥ 0, geen cascade naar latere documenten; document in "datums zoals opgeslagen"
  ⇒ impliciet gepind; onderbreek-modus schrijft geldige `splitGaps` (mét herkomstveld,
  door de `OPS_TaskSplits`-round-trip) die door de bestaande CPM-checks heen komen;
  leveling-gaps gewist bij tijdbasis-bewerking terwijl importsplits blijven.
- **Naad**: capaciteitsinjectie × reden-taxonomie (restprofiel-0 is geen kalender-mismatch);
  scope-behoudend toepassen laat delays buiten de scope staan.
- **Store-niveau**: toepassen over actief + slapende documenten; "alles terugdraaien"
  herstelt alle beschreven documenten inclusief doorrekening; uncounted document blokkeert;
  voorstel-invalidatie bij mutatie/sluiten/wisselen; scratch-instantie-pad laat geen sporen
  na in de app-globale registers.

## 10. Buiten scope (bewust)

- Simultaan optimaliseren over documenten in één solve (de rangorde ís de volgorde;
  split-view en de resterende gedeelde registers uit de store-factory-lijst blijven apart).
- Cross-machine boekingen — wacht op gedeelde opslag/sync (B1.1-beperking).
- MCP-tools voor de verdeler — additief zodra gevraagd.
- Automatisch hernivelleren bij elke bewerking — rekenen blijft expliciet (F5-filosofie).

## 11. Beslispunten voor de eigenaar

1. ~~Tune-bediening~~ — **fasestrook-handles + pin in v1 (§6), besloten 2026-08-27.**
2. ~~Undo-vorm~~ — **per document een gewone undo-stap; terugweg als persistente
   paneel-strook "alles terugdraaien", niet in het meldingenkanaal (§5), besloten
   2026-08-27.**
3. ~~Float-benutting als last voor rang 1?~~ — **Nee; wie een project volledig wil bevriezen
   gebruikt de pin (§6), besloten 2026-08-27.**
4. ~~Onderbrekingen in v1?~~ — **Ja, in v1** (besloten eigenaar 2026-08-27; na de tweede
   review opnieuw voorgelegd mét de kosten — de vier bindende afspraken in §4 — en
   herbevestigd). De schakelaar met beide standen is er vanaf de eerste oplevering.
5. ~~Toepassen in handmatige modus?~~ — **Ja, Toepassen schrijft altijd** (besloten
   eigenaar 2026-08-27): de expliciete klik is de toestemming; delays/gaps én de
   doorrekening worden geschreven en gepersisteerd, ook met "Automatisch berekenen" uit;
   één "alles terugdraaien" zet alles terug. Bewuste, opgeschreven grensverlegging op
   B1b §4.3b.

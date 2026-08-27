# B1c — Nivelleren tegen restcapaciteit (ontwerp)

Datum: 2026-08-17, bijgewerkt 2026-08-27 · Status: **ontwerp compleet** — alle beslispunten
zijn door de eigenaar besloten (concept F §3; fasestrook-handles §6; undo-vorm §5;
float-en-pin §11.3). Volgende stap: implementatieplan voor F1. Dit document is de neerslag
van drie prototyperondes met de eigenaar op 2026-08-17; de speelbare prototypes staan als
privé-artifacts: "Wie wijkt?" (rondes 1–3, zelfde link, versiegeschiedenis) en
"Interface-lab" (vier tune-bedieningen).

## 1. Doel en aanleiding

B1b (bezettingsoverzicht) maakt bibliotheekbrede knelpunten zichtbaar; B1c maakt ze oplosbaar:
vanuit een conflictregel in `ResourceOccupancyView` de overboeking wegwerken door de last te
**verdelen** over de geopende documenten die het poolitem boeken. Vervolg op B1b-spec §12
(`2026-08-14-b1b-bezettingsoverzicht-design.md`).

Twee richtingen zijn in ronde 1 met speelbare prototypes afgewogen en **afgevallen** (besluit
eigenaar 2026-08-17): "één document wijkt" (een wat-als-ranking per kandidaat — te grof, geen
lastverdeling mogelijk) en volautomatisch oplossen met undo (de app neemt dan stilzwijgend een
planningsbeslissing). De kern van B1c is dus een *verdeler*: het capaciteitstekort wordt over
meerdere documenten gespreid, met de planner aan het stuur.

## 2. Harde randvoorwaarden

1. **Uitsluitend doorgerekende (counted) cijfers.** Restcapaciteit afgeleid uit boekingen van
   een stale document is nivelleren tegen een getal dat nergens vandaan komt (B1b-critreview).
   B1b's efemere solve (§4.3b aldaar) maakt stale documenten normaal gesproken counted; blijft
   een document uncounted (mislukte solve), dan is de nivelleeractie voor conflicten waar dat
   document in meedoet **geblokkeerd met uitleg** — geen stille uitsluiting.
2. **Matching via `libraryOrigin`-stempels** (companyId + libraryItemId), nooit via naam.
3. **Alleen geopende documenten op deze machine** — zelfde beperking en zelfde hint als B1b.
4. **Geen `createAppStore()`-factory** (onderhoudbaarheidsitem 41): er is géén live simultaan
   cross-document solve. B1c rekent op payload-snapshots en schrijft resultaten per document
   terug (§5); dat is hetzelfde mechanisme als B1b's terugschrijfpad.
5. **De `ResourceLeveler` schaalt kwadratisch** (één volledige CPM-solve per geplaatste taak in
   `computePF`). B1c maakt dat niet erger — de verdeler roept de bestaande motor per document
   aan — maar elke bediening die "live bij elke sleepstap" hernivelleert moet daarmee rekenen
   (debounce/preview op de pure functie, nooit op de store).

## 3. Het concept: F — gereedschap → rangorde → automatisch → tunen

Besluit eigenaar 2026-08-17 ("we gaan sowieso voor F"), gevormd in drie prototyperondes.
Vier stappen in één flow, gestart vanuit een conflictregel in het bezettingsoverzicht:

**Stap 0 · Gereedschapskeuze** — schakelaar **"Onderbrekingen toestaan"** (aan/uit), bekend
equivalent: MS Project *"Leveling can create splits in remaining work"*.

- **Uit — alleen uitlopen:** fasen mogen alleen als geheel later beginnen. Dit is wat de
  bestaande motor (`levelingDelay` + CPM-herberekening) vandaag al kan.
- **Aan — onderbrekingen (pauzedagen):** de nivelleerder mag een fase midden in het werk
  pauzeren en later hervatten. Dit vereist **taak-splitsing, een nieuwe motorcapaciteit** —
  zie de fasering in §4.
- Naast de schakelaar staat het doorgerekende prijskaartje van beide standen ("met
  onderbrekingen: max +1 dag · zonder: max +3"), zodat de keuze geïnformeerd is. In het
  referentiescenario van de prototypes is dat verschil precies het bestaansrecht van de
  schakelaar: zonder onderbrekingen valt de last vrijwel altijd op één document.

**Stap 1 · Rangorde** — sleepbare lijst "wie wordt het meest ontzien?", startvolgorde op float
gesorteerd. Per regel: float en "alleen dit project laten opschuiven kost +N dagen".

**Stap 2 · Verdeel automatisch** — de verdeler rekent een voorstel door dat de rangorde
respecteert (nr. 1 wijkt pas als het niet anders kan): eerst float benutten (kost geen
einddatum), dan het restant zó plaatsen dat de grootste einddatum-verschuiving minimaal is.
Het voorstel is een **preview** — er wordt niets geschreven vóór "Toepassen".

**Stap 3 · Tunen** — per document een instelbaar **plafond "maximale uitloop van de
einddatum"** (bediening: §6). Besluit uit ronde 3: dit plafond betekent in **beide**
gereedschapsstanden hetzelfde — het stuurt op de uitkomst die de planner voelt, niet op het
mechaniek. Plafond 0 betekent "einddatum staat vast", maar bínnen de float mag de nivelleerder
blijven pauzeren of schuiven; alle plafonds op 0 is daardoor geen doodlopend eind. De motor
pauzeert of schuift nooit meer dan nodig (plafonds zijn maxima, geen opdrachten). Validatie
wijst altijd een uitweg aan ("Nog 1 ploegdag tekort — geef een project minstens 1 dag uitloop
(bijvoorbeeld De Linde +1), of sta onderbrekingen toe"); Toepassen is uitgeschakeld-met-reden
zolang het tekort niet gedekt is.

## 4. Rekenkern en fasering

**Restcapaciteitsprofiel.** Per poolitem per werkdag:
`rest(dag) = maxUnitsOn(poolitem, dag) − Σ dailyLoad(dag)` over de **andere** open documenten
(counted, uit de B1b-kern `computeLibraryOccupancy` — het veld `dailyLoad` bestaat daar al).
De nivelleerder van het wijkende document krijgt dit profiel als capaciteitsinvoer in plaats
van een vlak `maxUnits`-getal; `capacityOf(resId, dag)` in `ResourceLeveler.ts` is daarvoor
de natuurlijke naad.

**Nieuwe invoervorm.** De nivelleerder moet per document een plafond *"maximale uitloop van de
einddatum = X werkdagen"* accepteren, in plaats van alleen "nivelleer dit document" — plus een
**pin-vlag** per document: gepind = de boeking ligt volledig vast (ook binnen float) en telt
alleen als vaste last mee in het capaciteitsprofiel.

**Fasering (reële faseringsgrens, besluit ronde 3):**

- **F1 — uitloop-modus** op de bestaande motor: `levelingDelay` per taak, capaciteitsprofiel
  per dag erin, plafonds erop. Geen nieuwe motorcapaciteit; uitleverbaar als eerste stap.
  In F1 is er nog géén gereedschapskeuze in de UI: stap 0 (de schakelaar, met het
  prijskaartje van beide standen) verschijnt pas met F2 — een schakelaar met één werkende
  stand zou dood UI zijn. De F1-flow begint dus bij de rangorde; de fasestroken tonen er
  geschoven blokken (gestippelde omtrek op de oude plek), nog geen gearceerde pauzedagen.
- **F2 — onderbreek-modus**: taak-splitsing (een fase in segmenten met pauzedagen ertussen).
  Raakt het taakmodel, de renderer (gesplitste balken), de IFC-round-trip en de motor; eigen
  ontwerpronde waard zodra F1 staat.

De verdeler zelf (float eerst, dan uitschieter minimaliseren, rangorde-gestuurd) is een pure
functie bovenop de bestaande bouwstenen (`DailyLoad`, `maxUnitsOn`, `CalendarEngine`,
`solveProject`) en in beide fasen gelijk — alleen het gereedschap eronder verschilt.

## 5. Schrijven in meerdere documenten

Toepassen schrijft in élk document dat in het voorstel meedoet — ook slapende. Mechanisme:
zelfde patroon als B1b's `recalculateStaleSleepingDocuments` (payload-clone → solve →
volledige payload-spread terug), maar nu mét `levelingDelay`-wijzigingen en dus mét
dirty-markering. **De undo-vorm (besluit eigenaar 2026-08-27):** per document een gewone
undo-stap op de bestaande per-document-stack, gebundeld onder één samenvattende melding met
een "alles terugdraaien"-knop. Geen samengestelde undo-transactie over documentgrenzen —
die raakt `snapshot.ts`/`transaction.ts` en kan altijd nog als de praktijk erom vraagt.

## 6. De tune-bediening: fasestrook-handles (besluit)

Vier bedieningen zijn speelbaar vergeleken in het Interface-lab (zelfde verdeler, zelfde
scenario): ster met trekpunten (idee eigenaar; buitenveelhoek = plafond, binnenvlak =
werkelijk benut), verdeelbalk (tekort als balk met sleepbare wanden), communicerende vaten
(direct aan de einddatum-uitkomst trekken, pins bevriezen een project) en fasestrook-handles
(slepen in de tijdlijn zelf). **Besluit eigenaar 2026-08-27: de fasestrook-handles.**

Concreet: onder het voor/na-histogram staat per betrokken document een fasestrook (werkdagen
van de fase, gearceerde pauzedagen, meetlat met float en overschrijding — zoals in de
prototypes), met op het einde van elke strook een **sleepbare handle**. De handle zet het
plafond "maximale uitloop van de einddatum" voor dat document (§3 stap 3); de nivelleerder
benut nooit meer dan nodig, dus een strook kan een gestippelde staart tonen: *toegestaan maar
niet benut*. Bediening: pointer-slepen (blijft werken buiten het element tijdens de sleep) én
toetsenbord (`role="slider"`, pijltjes = één werkdag, Home/End, `aria-valuetext` met plafond,
benutting en einddatum-effect). De bediening woont dus ín de tijdlijn — er is geen apart
instelpaneel; het histogram erboven en de fasestroken eronder zijn samen de hele tune-stap.
Waarom deze won: het is de meest planner-eigen plek (je ziet de kalenderconsequentie op de
plaats waar hij valt), en hij hergebruikt de fasestrook-weergave die de voorstel-preview
sowieso nodig heeft — de bediening is een handle op een bestaand element, geen extra visuele
taal ernaast. De keerzijde uit het lab-oordeel (vraagt fijnmotoriek) wordt gedempt door de
toetsenbordbediening en door snappen op hele werkdagen.

Uit de vaten-variant komt de **pin mee naar v1** (besluit eigenaar 2026-08-27): per
fasestrook een vastzetknopje dat het document volledig bevriest — einddatum én werkdagen.
Een gepind document doet niet mee in de verdeling, ook niet binnen zijn float; de verdeler
behandelt zijn boeking als vaste last (hij telt gewoon mee in het capaciteitsprofiel). De
pin is daarmee hét gereedschap voor "houd ook je dágen" — zie §11.3 voor het besluit
waarom float-benutting verder niet als last telt.

Twee **systeembevindingen** uit het lab gelden ook voor deze bediening:

1. **De som garanderen is de oplossing niet garanderen**: 6 tekortdagen "netjes" verdelen kan
   alsnog tekort opleveren, omdat een pauze de staart van een fase naar een nieuwe drukke dag
   duwt. Elke bediening heeft dus een live haalbaarheidscheck nodig, geen rekensommetje.
2. **De haalbare standen zijn schaars** (een project kan bv. alleen +0 of +3 zijn): een
   vloeiende schuif op de uitkomst kan de vinger niet volgen. De bediening moet "gevraagd X,
   dichtst haalbare Y" tonen in plaats van elke tussenstand te beloven.

## 7. Plek in de UI

Vanuit een conflictregel in `ResourceOccupancyView` (Resources-tab, derde weergave). De flow
(stappen 0–3) is te groot voor een uitklapregel; voorzien als paneel/dialoog vanuit de
conflictregel. De opbouw volgt uit het §6-besluit: bovenin het histogram als voor/na-preview,
daaronder de fasestroken-met-handles die zelf de tune-bediening zijn, met daarboven de
gereedschapsschakelaar en de rangordelijst (stappen 0–2). Detaillering in het
implementatieplan.

## 8. i18n en documentatie

Volledig via `t(...)`, veertien talen, CLDR-pluralen (dag/dagen-teksten!). Gebruikersgids
(minimaal nl+en) met manifest-entry — de schakelaar "onderbrekingen" verdient uitleg met het
MS Project-equivalent erbij.

## 9. Tests

Headless, in de bestaande suites: verdeler-cases (float eerst, uitschieter minimaal, rangorde
gerespecteerd, plafonds hard, gepind document volledig ongemoeid, som-≠-oplossing-geval),
restcapaciteitsprofiel-afleiding uit de occupancy-kern, uitloop-oplosser (hele fasen, geen
gaten), en store-niveau: toepassen over meerdere payloads + terugdraaien + "uncounted
document blokkeert".

## 10. Buiten scope (bewust)

- Taak-splitsing/onderbreek-modus (F2) — eigen ontwerpronde (§4).
- Simultaan cross-document nivelleren in één solve — wacht op item 41.
- Cross-machine boekingen — wacht op gedeelde opslag/sync (B1.1-beperking).
- MCP-tools voor de verdeler — triviaal additief zodra gevraagd.

## 11. Beslispunten voor de eigenaar — alle besloten (2026-08-27)

1. ~~De tune-bediening~~ — **fasestrook-handles (§6).**
2. ~~De undo-vorm~~ — **per document een gewone undo-stap, gebundeld onder één melding met
   "alles terugdraaien"-knop (§5).**
3. ~~Telt float-benutting als "last" voor rang 1?~~ — **Nee: "ontzien" beschermt de
   einddatum, niet de werkdagen; schuiven binnen float blijft toegestaan en wordt zichtbaar
   getoond in de fasestrook. Wie een project volledig wil bevriezen (einddatum én werkdagen)
   gebruikt de pin, die in v1 meekomt (§6).**

# Gebruikstest taaktypes en werkregels (PR #170, E1), 24-09

Ik heb de werkregels in de echte browser gebruikt zoals een planner dat zou doen. De rekenkern doet wat de gids belooft. Onder *Vast werk* maakt meer inzet de taak korter, onder *Vaste duur en werk* stijgt de inzet, en een resource erbij of eraf volgt dezelfde regel. Elke stap is één keer Ongedaan maken, en werkregel en werk overleven opslaan als IFC, heropenen en crashherstel. De interface eromheen hindert de gebruiker wel op drie punten. In de toewijzingstabel verdwijnen de resourcenamen zodra de kolom *Werk (rest)* erbij komt, en daardoor is het XER-geval EC2370 (7× werk 90 en 2× werk 30, zonder namen) onleesbaar. Verder heten drie verschillende dingen "taaktype". En de knop "Lees meer" in de melding bij openen leidt naar de gids over rekenprofielen, niet naar de gids over taaktypes.

- **Stand:** `claude/taaktypes-integratie` @ `6e448f63` (detached worktree). De latere fixes op de branch, zoals `ef40c195` (kalenderdialoog K2 e.a., nog niet gepusht), zitten hier **niet** in.
- **Omgeving:** browser-dev-build op poort 3038, Playwright Chromium headless shell 1600×1000, UI-taal Nederlands.
- **Model:** Claude Opus 5.5 (uitvoerder-opus-midden).
- **Werkwijze:**
  - Echte klikken, toetsen, wielbewegingen en selects: tandwiel, lintknoppen, Backstage, de lintknop Taak, de keuzelijst Duureenheid met "Voorstel toepassen", de resourcetabel, "Resource toewijzen", de werkregel-keuzelijst, typen in Werk en Inzet, Ctrl+Z, F5, het contextmenu → Bewerken, Nivelleren… → Berekenen → Toepassen, Openen via de bestandskiezer, Ctrl+S, herladen en Herstellen.
  - `window.__OPS__` is alleen gebruikt om state te lezen, plus deze fixtures:
    - welkomstdialoog verbergen en `uiFontScale` zetten;
    - `showOpenFilePicker`/`showSaveFilePicker` weghalen, zodat de bestandsinvoer en de download-terugval werken;
    - één nivelleerpauze (`splitGaps` met `source: 'leveling'`), want de UI kan die niet maken (zie G9);
    - in stap 6 `showTaskTypes: false`, om documentontsluiting te bewijzen.
- **Bestanden:**
  - `.mpp`: `crawl-mpp/MSP2016_OzBuild/OzBuild Workshop 17 Leveling.mpp` (18 taken, 20 toewijzingen), plus ter vergelijking `MSP2021_OzBuild/OzBuild Workshop With Resources.mpp` (geen toewijzingen) en `mpxj/junit/data/timephased-actual-work-resource.mpp`.
  - XER: `crawl-xer/HarbourPointe_AssistedLiving.xer`.
- **Screenshots en scripts:** `/home/nozzit/.t3/worktrees/open-planner-studio/t3code-181adcaa/qa/gebruikstest-170/`. De scripts heten `s*.mjs`, de helpers `lib.mjs` en `common2.mjs`. De map staat in `.gitignore`. De testworktree is verwijderd.
- **MCP:** niet getest, de MCP-brug is Tauri-only.

## Per stap: wat ik deed, zag en verwachtte

### 1. Instelling *Toon taaktypes* op de drie plekken

- **Tandwiel → Planning:** het vinkje staat onder de kop **Urenplanning**, onder "Urenplanning inschakelen", met een grijze bijschrifttekst eronder (`01c-sectie-urenplanning.png`). Aanzetten schrijft `ops-showTaskTypes = true`.
- **Instellingen-tab → Instellingen → Planning:** het vinkje staat daar al aan. Uitzetten gaat door naar de store.
- **Backstage → Instellingen → Planning:** het vinkje staat uit (zelfde stand). Weer aanzetten werkt, en de stand overleeft een pagina-herlaad. [BEVESTIGD]
- **Gezien:** op alle drie de plekken is de stand gelijk, en het is één gedeelde component. Het bijschrift is het bestaande huispatroon (`scrollzoom-hint`, 24× gebruikt in dat paneel), maar inhoudelijk is het jargon: "welke hoek van werk = restduur × inzet vast staat". Zie G6.
- **Op Backstage** oogt het vinkje direct na de klik als een bruin, half-gevuld bolletje, niet als het oranje van "aan" (`01e-backstage-planning-aan.png`). Waarschijnlijk hover/focus. [VERMOED]
- **Vooraf verwacht:** gelijke stand overal, en geen losse bijschriften (memory-regel). Het eerste klopt. Het tweede botst met het huispatroon, zie E5.

### 2. Nieuw project, urentaak, werkregel in paneel en dialoog

- **Opzet:**
  - Nieuw via de wizard, lintknop Taak.
  - Duureenheid → Uren → "Exact omzetvoorstel: 40h. Voorstel toepassen" → duur 16.
  - Resource "Metselaar" (max 2) aangemaakt en via "Resource toewijzen" gekoppeld, dan F5. Uitgangspunt: 16 u, einde 25-09 16:00.
- **Paneel:** de werkregel-keuzelijst staat onder Duur, met eronder "🔒 Beschermd: duur en inzet (werk volgt)" (`02c-na-taak.png`).
  - **Vast werk:** er verandert geen getal en het werk wordt vastgelegd op 16 u.
  - **Werk 32 getypt + Enter:** de duur wordt 32 u. *Gepland einde* schuift van 25-09 16:00 naar **29-09 16:00**, en de planning wordt verouderd.
  - **Inzet 1 → 2:** de duur wordt 16 u en het einde schuift terug naar 25-09 16:00.
  - **Eén Ctrl+Z:** terug naar inzet 1 en 32 u, einde 29-09. [BEVESTIGD]
  - **Vaste duur en werk, werk 64 getypt:** de duur blijft 32 u en de inzet wordt **2**. [BEVESTIGD]
  - Screenshots: `02i…`, `02j…`, `02k-werk-32.png` (+ `-crop`), `02l-inzet-2.png`, `02m-vdw-werk-64.png`.
- **Taakdialoog:** geopend via rechtsklik → Bewerken (dubbelklik op de naam start inline bewerken).
  - Werkregel "Vaste duur en werk" en werk 32 werken direct: inzet 2, duur blijft (`02n-taakdialoog-100.png`, `02o-taakdialoog-werk32-{100,125}.png`).
  - Na **Opslaan** is de eerste Ctrl+Z zichtbaar niets, pas de tweede draait het werk terug. Zie G7.
  - **Annuleren** laat werkregel en werk gewoon staan. Zie G5.
- **Gantt:** de balk blijft tot F5 op de oude lengte. De statusbalk zegt "Verouderd — herbereken (F5)". Dat is consistent met handmatig plannen.

### 3. Resource erbij/eraf onder Vast werk, en de nivelleerpauze

- **Resource erbij:** taak van 16 u onder Vast werk met Metselaar 1. "Opperman" erbij geeft 8 u per persoon, duur **8 u**, einde 24-09 16:00 (`03a-vastwerk-resource-erbij.png`).
- **Resource eraf:** Opperman weer weg (prullenbak) geeft duur **16 u**, einde 25-09 16:00 (`03b…`). [BEVESTIGD]
- **Nivelleren:** Nivelleren… → Berekenen → Toepassen, met twee taken op één Opperman (max 1). Dit zet alleen een **nivelleervertraging** (`levelingDelay 3`) op de tweede taak, zonder pauze *in* een taak (`03c/03d/03e…`). De dialoog kent geen optie "splitsen toestaan": pauzes (`splitGaps` met source `leveling`) komen alleen uit de verdeelkern van de bibliotheek, en die heeft nog geen UI. Zie G9.
- **Nivelleerpauze via fixture:** ik heb in de tweede taak (Vast werk, 2 d) een pauze gezet.
  - Metselaar erbij: de duur wordt 1 d en **de pauze is weg**. Undo zet hem terug.
  - Opperman eraf (de enige resource): de pauze is weg en de duur blijft 2 d.
  - Screenshots: `03g-fixture-pauze.png`, `03h-pauze-na-resource-erbij.png`. [BEVESTIGD]
- De **nivelleervertraging** (`levelingDelay 3`) blijft staan als je een resource toevoegt, ook als de duur halveert. De gids noemt alleen de *pauze*, dus dit klopt letterlijk. Een gebruiker zou wel kunnen verwachten dat een verouderde nivellering gemeld wordt. [BEVESTIGD]

### 4. `.mpp` openen

- **Instelling:** "Toon taaktypes" stond uit, en toch zijn de bedieningselementen ontsloten (`taskTypesVisible: true`).
  - OzBuild 17: 4× Vaste duur en inzet, 14× Vaste inzet.
  - `timephased-actual-work-resource.mpp`: 5× Vaste inzet.
- **Meldingen:** er komen twee toasts rechtsonder (`04a-mpp-geopend-meldingen.png`):
  - "Dit MS Project-bestand bevat 8 taken met een onderbroken, genivelleerde of resource-gedreven planning…";
  - de profielmelding "Dit project rekent als Microsoft Project…". Daarin staat de **detailregel** "Dit bestand bevat taaktypes (werkregels of opgeslagen werk); … Uitleg: Help → „Taaktypes en werk”.", met de links **Lees meer** en **Rekenprofiel openen**.

  Daarboven staat de gele balk "Dit bestand bevat urenplanning. [Urenplanning aanzetten]". Samen zijn dat vier meldingsvlakken bij één keer openen.
- **Gidslink:** **Lees meer** opent Backstage → Help op **"Rekenprofielen"**, niet op "Taaktypes en werk" (`04b-lees-meer.png`). Zie G3. In de Help-lijst staan "Taaktypes en werk" **en** "Taaktypen" vlak onder elkaar. Zie G2.
- **Toewijzingen in het paneel:** bij "Determine Installation Requirements" (Vaste inzet, 2 resources) zijn **de resourcenamen onzichtbaar** (`04d-mpp-werk-verdubbeld.png`, `04e-toewijzingen-100-met-werk.png`, `04e-toewijzingen-125-met-werk.png`). Zie G1.
  - Onder de keuzelijst staan "Beschermd: inzet (duur volgt het werk)" en "Uit MS Project: niet effort-driven".
  - In de DOM staat het slotje op de inzetkolom (`lock-units=locked`), maar het icoon is 0 px breed en dus niet te zien.
- **Werk 32 → 64:** de duur gaat van 4 naar 8 d. Er verschijnt een derde toast: "Het datumvenster uit MS Project stuurt 1 taak niet meer na deze bewerking… Lees meer". Eén Ctrl+Z geeft 4 d en werk 32. [BEVESTIGD]
- **Raster (Tabel → +):**
  - Kolomkiezer, zoeken op "werk": Werkregel, Begroot/Verricht/**Resterend werk (uren)** en meer. De gids noemt de kolom "Resterend werk", zonder "(uren)".
  - Zoeken op "taaktype": **Taaktype**, **Eigen taaktype**, **Microsoft Project-taaktype**, maar *niet* Werkregel.
  - Met de kolom Werkregel erbij (`04h-tabel-werkkolommen.png`) staat "Vaste duur en inzet" op **verzameltaken** en "Vaste inzet" op **mijlpalen** (Approval to Bid, Bid Document Submitted). De gids zegt dat die geen werkregel hebben. Zie G8.
  - Het standaardraster toont al een kolom **TAAKTYPE = "Bouw"**.

### 5. XER openen (HarbourPointe), EC2370

- **Melding:** één XER-toast met als detailregels "1 project gezien", "14 taken tonen de datums zoals Primavera ze opsloeg" en de taaktypes-regel, plus Lees meer en Rekenprofiel openen. Daarnaast twee gele balken: "Dit bestand bevat urenplanning" en "Je ziet de planning zoals Primavera hem opsloeg… [Herberekenen]". Ook een tweede toast met dezelfde tekst als die laatste balk (`05a-xer-geopend-melding.png`). Voor taaktypes is het dus inderdaad één detailregel, maar de gebruiker krijgt bij openen vier meldingsvlakken. [BEVESTIGD]
- **EC2370 "Final Inspections and Punchlist":** 336 u = 42 d, projectstandaard Vaste duur en inzet, 9 toewijzingen van elk **0.26** eenh./dag (opgeslagen 0,26785714) (`05b-ec2370-paneel.png`).
  - Werk (rest) toont **90, 90, 90, 90, 90, 90, 30, 90, 30**.
  - De twee regels met 30 zijn de twee Painter-toewijzingen, maar **dat zie je niet**: alle namen zijn weggedrukt (G1).
  - Nergens staat waarom twee regels met dezelfde inzet 30 tonen en de rest 90. Geen markering, geen tooltip-verschil in beeld, geen "wijkt af"-badge.
- **Histogram:** Resources-tab → Histogram → Volgende tot Painter (`05c-histogram-aan.png`, `05d-histogram-painter.png`).
  - Op jaarschaal is de balk rond Q2 2013 een paar pixels hoog. De resourcelijst linksonder heeft een overlappende kop: "Alle resources" valt over "Electrician".
  - Gemeten via de store: de twee Painter-toewijzingen van EC2370 dragen samen **≈ 8,7 eenheid-dagen** bij in het taakvenster, voor en na het verwijderen van die twee toewijzingen via de UI.
  - Volgens inzet × duur zou dat 2 × 0,268 × 42 = 22,5 eenheid-dagen zijn, dus 2 × 90 u.
  - Het histogram volgt dus ongeveer het **werk** (2 × 30 u), en níet de getoonde inzet × duur. [BEVESTIGD dat het geen 22,5 is; de precieze verdeling (≈ 69 u in plaats van 60 u) heb ik niet verklaard, VERMOED kalender/venster-effect.]
- **Wat de gebruiker ziet:** inzet 0,26 (drie keer hetzelfde getal), werk 30 bij twee naamloze regels, en een histogram dat die 30 lijkt te volgen. Begrijpelijk is dat niet. Zonder namen en zonder uitleg lijkt 30 een tikfout of een bug. Zie E7.

### 6. IFC opslaan/heropenen en crashherstel

- **Opslaan:** Ctrl+S (download-terugval) geeft de in-app melding "Opgeslagen als download…" (`06a-na-opslaan.png`).
- **Heropenen**, met "Toon taaktypes" eerst **uit**:
  - regel `FIXED_WORK`, 40 u, werk 40 u, inzet 1, einde 30-09 16:00. Alles identiek aan vóór opslaan.
  - De werkregel-UI is zichtbaar (documentontsluiting), met de melding "Dit bestand bevat taaktypes…; … zichtbaar. Lees meer" (`06b-heropend-ifc.png`). [BEVESTIGD]
- **Crashherstel:** inzet 1 → 2 (duur 20 u, einde 28-09 11:00), 12 s gewacht, pagina herladen.
  - De browser stelt eerst een native `beforeunload`-vraag. Dat is standaard browsergedrag, geen app-dialoog.
  - Daarna verschijnt de dialoog "Niet-opgeslagen werk herstellen" → **Herstellen**.
  - Resultaat: regel `FIXED_WORK`, 20 u, inzet 2, werk 40 u, en het werkveld toont 40 (`06c-na-herladen.png`, `06d-na-herstel.png`). [BEVESTIGD]

### 7. MCP

Niet getest (Tauri-only).

## Bevindingen, gerangschikt

**G1 [BEVESTIGD] — hoog. Met de kolom *Werk (rest)* verdwijnen de resourcenamen in de toewijzingstabel.**
- **Gemeten** in het paneel (standaardbreedte 280):
  - naamkolom **0 px** met Werk (rest) erbij, tegen 17,5 px zonder;
  - rij-scrollbreedte 290 tegen 259;
  - op 125 %: 0 px, scrollbreedte 357.
- **Zichtbaar zodra** er een *Verplaats naar…*-keuzelijst in de rij staat, dus zodra het project meer dan één resource heeft. Ook in de dialoog is het krap. De prullenbak valt eraf (`04d`, `05b`).
- **Gevolg:** bij EC2370 zie je negen rijen "0.26 | 90/30 | Uniform | ▥ | Verplaats n…" zonder te weten welke resource welke regel is. Het slotje op de inzetkolom (`Lock size 9`) wordt door "EENH./DAG" in een `w-14` weggedrukt tot 0 px. Onder de projectstandaard zie je dus nooit een slotje. De kop "WERK (REST)" breekt over twee regels.
- *Aanbeveling:* zet de toewijzing over twee regels, met de naam bovenaan op volle breedte en daaronder inzet, werk, curve en acties. Of verplaats *Verplaats naar…* en *Urenverdeling…* naar een ⋯-menu. Zet het slotje in een eigen, vaste kolom in plaats van in de tekstspan.

**G2 [BEVESTIGD] — hoog. "Taaktype" betekent drie verschillende dingen.**
- Het paneel en het raster hebben al **Type/Taaktype = "Bouw"** (classificatie, gids "Taaktypen"). De kolomkiezer kent daarnaast "Eigen taaktype" en "Microsoft Project-taaktype".
- Deze PR voegt de instelling **"Toon taaktypes (werkregels)"** toe, en de gids **"Taaktypes en werk"** staat in Help direct naast **"Taaktypen"**. In het Engels: "Task types and work" naast "Task types".
- Zoeken op "taaktype" in de kolomkiezer vindt de werkregel niet.
- Een gebruiker die "Toon taaktypes" aanzet, verwacht iets met het veld *Type*.
- *Aanbeveling:* noem de functie in de UI consequent **Werkregel** (instelling "Toon werkregels en werk", gids "Werkregels en werk"). Bewaar "taaktype" alleen als synoniemverwijzing in de gidstekst ("in MS Project heet dit *taaktype*"). Dat is ook de term die het paneel en het raster al gebruiken.

**G3 [BEVESTIGD] — middel. "Lees meer" in de openingsmelding (.mpp/XER) leidt naar "Rekenprofielen", niet naar "Taaktypes en werk".**
- De taaktypes-detailregel hangt aan de profielmelding. Die heeft maar één `helpArticleId` (`gids-rekenprofielen`, `fileSlice.ts` ±533). De gids "Taaktypes en werk" is alleen als tekst genoemd ("Uitleg: Help → „Taaktypes en werk”"): vindbaar, maar niet aanklikbaar.
- Bij IFC-heropenen komt een losse taaktypes-melding, en daar gaat "Lees meer" wél naar de juiste gids.
- *Aanbeveling:* geef de detailregel een eigen link. Zie E4.

**G4 [BEVESTIGD] — middel. E7: inzet, werk en histogram vertellen bij EC2370 drie verschillende verhalen, zonder uitleg in beeld.**
- Details staan bij stap 5.
- *Aanbeveling:* zie E7.

**G5 [BEVESTIGD] — middel. In de taakdialoog zijn werkregel en werk al toegepast vóór Opslaan. Annuleren draait ze niet terug.**
- Ik koos "Vaste duur en werk", typte werk 32 (inzet → 2) en drukte op **Annuleren**. Regel, werk en inzet bleven staan. Alleen Ctrl+Z (twee keer) haalt ze terug.
- De dialoog heeft Annuleren/Opslaan, dus de gebruiker verwacht dat Annuleren alles terugzet. Het commentaar in `TaskWorkRuleField` noemt het "instant-apply", maar in de dialoog staat daarover geen blok of hint.
- *Aanbeveling:* laat Annuleren de sinds het openen gemaakte toewijzings- en werkregelwijzigingen terugdraaien (één undo-groep per dialoogsessie). Of zet in de dialoog een gekleurd blok boven Toewijzingen: "Wijzigingen in toewijzingen en werkregel gelden meteen".

**G6 [BEVESTIGD] — laag/middel. Plaats en bijschrift van de instelling.**
- De instelling staat onder de kop **Urenplanning**, maar heeft niets met urenplanning te maken: ze werkt ook op dagtaken.
- Het bijschrift ("welke hoek van werk = restduur × inzet vast staat… Uit ⇒ …") is formule-jargon als losse grijze tekst.
- Zie E5.

**G7 [BEVESTIGD] — laag. Opslaan in de taakdialoog zonder verdere wijziging pusht een extra undo-stap.**
- Na Opslaan doet de eerste Ctrl+Z niets zichtbaars aan regel, werk, inzet of duur. De tweede draait het werk terug.
- [VERMOED] De dialoog schrijft zijn draft nog een keer weg, ook als die gelijk is.

**G8 [BEVESTIGD] — laag. De rasterkolom Werkregel toont een regel op verzameltaken en mijlpalen.**
- De gids zegt: "Mijlpalen, verzameltaken, hangmatten en taken op doorlooptijd hebben geen werkregel". Het paneel verbergt het veld daar ook (`workRuleApplies`), maar het raster toont "Vaste duur en inzet" en "Vaste inzet" (`04h`).
- Of de cel daar bewerkbaar is, heb ik niet getest.

**G9 [BEVESTIGD] — laag, informatief. Een nivelleerpauze is met de UI niet te maken.**
- Nivelleren… zet alleen `levelingDelay`. Pauzes komen uit de verdeelkern, en die heeft nog geen UI (memory B1c). De gidsregel "Een pauze die het nivelleren in de taak had gelegd, vervalt" is dus nu alleen relevant voor geïmporteerde of eerder via de kern gemaakte pauzes.
- Het gedrag zelf klopt (fixture): de pauze vervalt bij resource erbij en eraf, en undo herstelt hem.

**G10 [BEVESTIGD, mogelijk niet van deze PR] — laag. Het Start-veld in het paneel wordt leeg na F5 bij een urentaak.**
- Een urentaak aangemaakt via Duureenheid → Uren: vóór F5 toont Start "24-09-2026". Na F5 is `scheduleStart = "2026-09-24T00:00"` en is het Start-invoerveld **leeg** (`02o-taakdialoog-werk32-125.png`, rechterpaneel).
- Ook het tijdstip 00:00, terwijl de werkdag om 07:00 begint, is vreemd.
- [VERMOED] Dit komt van de B1-wijziging "scheduleStart kreeg alleen zijn datetime-vorm", niet van #170. Controleren op `main`.

**Kleine punten [BEVESTIGD]:**
- De werkregel, Constraint en "Resource toewijzen" zijn native `<select>`s; Type, Kalender en Duureenheid zijn de eigen `Select`. Twee stijlen onder elkaar.
- De werkcel heeft geen eenheid: de kop zegt "WERK (REST)", en "uren" staat alleen in de tooltip.
- De inzet 0,26785714 wordt als "0.26" getoond, met een punt in een Nederlandse UI.
- Op 125 % breekt "Resourcedock" in het lint af als "Resourcedo / ck". Dat stond er al, het komt niet van deze PR.

## Advies per eigenaarsvraag

**E4 — meldingsvorm.** De detailregel in de ene bestandsmelding is de goede richting: bij de XER is het echt één taaktypes-regel. Maar zo'n regel valt weg tussen vier meldingsvlakken (twee gele balken en twee of drie toasts), en de enige knop "Lees meer" gaat naar de verkeerde gids (G3). Mijn advies:
- Houd het bij één regel in de bestandsmelding, maar maak **"Taaktypes en werk"** in die regel zelf een link naar `gids-taaktypes`, of geef de melding een tweede actie "Werkregels uitgelegd".
- Noem in die regel wat de gebruiker ziet, niet wat het bestand bevat. Bijvoorbeeld: "Bij 18 taken staat nu een *werkregel* en bij de toewijzingen het resterende *werk*."
- Geen aparte toast erbij.

**E5 — UI-vorm van de instelling.** Het vinkje werkt en de stand is overal gelijk, maar:
- verplaats het uit de sectie Urenplanning naar een eigen kop **"Werk en werkregels"**, of naar Berekenen;
- hernoem het naar **"Toon werkregels en werk"** (G2);
- vervang het formulebijschrift door één gewone zin in een gekleurd infoblok (memory-regel), bijvoorbeeld: "Bestanden uit MS Project of P6 tonen dit altijd. Uit: duur en inzet blijven staan, het werk rekent mee." Het formulepraatje hoort in de gids.

**E7 — inzet tegenover werk (EC2370).** De gebruiker ziet drie dingen die elkaar tegenspreken: overal inzet 0,26, werk 90 bij zeven regels en 30 bij twee, en een histogram dat bij Painter het werk volgt. Een gebruiker kan niet zien dat 30 het opgeslagen P6-werk is en 90 de afleiding. Mijn advies:
1. Los eerst G1 op, want zonder namen is dit geval niet te lezen.
2. Markeer opgeslagen werk dat afwijkt van inzet × duur in de werkcel, met een klein oranje afwijkingsteken, en zet in het paneel onder de tabel een gekleurd blok: "2 toewijzingen hebben opgeslagen werk dat afwijkt van inzet × duur (30 u in plaats van 90 u). Het histogram volgt het opgeslagen werk." Met een actie **"Werk gelijkzetten aan inzet × duur"** en een actie **"Inzet afleiden uit werk"** (0,089).
3. Ontwerp het niet zo dat de inzet stil wordt aangepast bij import: de P6-inzet is brondata, en dan zegt de inzetkolom iets anders dan P6.
4. Toon inzet met twee decimalen en een decimale komma volgens de locale.

## UI-fixronde (25-09)

De toewijzingstabel toont nu bij EC2370 weer bij elke regel de resourcenaam, ook op 125 %, en het slotje op de inzetkolom is zichtbaar. De twee Painter-regels met 30 u krijgen een oranje waarschuwingsteken. Als je dat aanwijst, zie je beide getallen en dat het histogram het opgeslagen werk volgt. De taakdialoog gedraagt zich nu als een dialoog: Annuleren draait werkregel, werk en toewijzingen terug, en Opslaan is één stap ongedaan maken. De instelling heet "Toon werkregels en werk" en staat nu onder Berekenen, met één zin uitleg in een gekleurd blok.

- **Stand:** `claude/taaktypes-integratie` @ `85812af8` (gepusht). Hij bouwt voort op `ee96e5e9` en voegt 8 commits toe, één per punt.
- **Model:** Claude Opus 5.5 (uitvoerder-opus-midden).
- **Screenshots:** `qa/pr170-ui/` op 100 % en 125 % (donker) en op 100 % licht. Het script is `shots.mjs`.
  - `01` is de XER-melding bij openen.
  - `02` is EC2370 met de toewijzingen.
  - `03` is het werkregelblok.
  - `04` is de instelling.

### Per punt: wat er gebouwd is en welke proef rood werd zonder de fix

- **G1 (`62ba046f`):** elke toewijzing staat nu over twee regels.
  - Bovenaan staan de naam (volle breedte, afgekapt met title) en de prullenbak. Daaronder staan inzet, werk, curve, urenverdeling en verplaatsen. Curve en verplaatsen krimpen mee.
  - Het slotje is een eigen `shrink-0`-icoon.
  - Gemeten bij EC2370: naambreedte 242 px (100 %) en 236 px (125 %), slotje 9×9 px.
  - Browsertest `toewijzingstabel … (100 %)/(125 %)`. Met de oude component werden beide rood op "Metselploeg Noord hidden".
- **G3/E4 (`4638a335`):**
  - `taskTypesNeedNotice`: een regel die alleen uit `mspTaskType`/`p6DurationType` volgt, ontsluit stil. Er komt alleen een melding bij opgeslagen werk, een projectstandaard of een eigen regel.
  - Is er wel een melding, dan blijft het één detailregel in de ene bestandsmelding, dus geen extra toast. Die regel heeft nu een eigen link "Werkregels uitgelegd" naar `gids-taaktypes` (`NotificationDetailLine.helpArticleId`/`linkKey`).
  - Bij HarbourPointe blijft het bij één toast plus de twee bestaande gele balken (`01-…png`). Een gewone `.mpp` met alleen afgeleide regels opent nu zonder taaktypes-regel.
  - Mutatieproeven:
    - de voorwaarde weg uit `applyOpenedImport` ⇒ T4-18b rood;
    - de detailregel zonder link ⇒ T4-18c rood;
    - de oude `NotificationHost` ⇒ de browsertest "bestandsmelding" rood.
- **G5/G7 (`8b62b400`):**
  - De dialoog laat de relationele secties direct op de store werken (review B4), maar bij openen legt hij `historyMark` vast.
  - Annuleren, Esc en X roepen `revertHistorySince` aan: undo tot het beginpunt, zonder redo-rest.
  - Opslaan roept `squashHistorySince` aan: één undo-stap "Taak bewerken".
  - Opslaan patcht alleen wat verschilt (`taskPatchChanges`), dus Opslaan zonder wijziging geeft geen lege stap meer.
  - Mutatieproef: de oude `TaskDialog` ⇒ de browsertest rood (regel, inzet en werk blijven staan na Annuleren).
- **E5/G6 (`8f6645d0`):**
  - De instelling is hernoemd in 14 locales en verplaatst naar Berekenen, zonder eigen kop. De tabs-test telt nog steeds 4 koppen.
  - Nieuw blokpatroon `.ops-note`: neutraal vlak, accentbalk (inset 3px) en icoon in kleur, tekstrol small.
  - In het paneel staan "Beschermd: …" en het MS Project-vinkje samen in één amber blok.
  - Mutatieproef: de oude componenten ⇒ de browsertest "gekleurd blok" rood.
  - Spanning met de memory-regel "uitleg achter een info-icoon, blok voor een toestand": ik heb het orkestratorbesluit "gekleurd blok" gevolgd.
- **G2 (`2e8ee709`):**
  - De MSP-kolom heet nu "MS Project-taaktype (import)" (14 locales).
  - De gids heet "Werkregels en werk": in het manifest in alle 14 titels, in de kop voor nl en en.
  - De werkregelkolom heette al "Werkregel".
  - "Eigen taaktype" (`customTaskType`, de classificatie) is bewust niet hernoemd.
  - Mutatieproef: de oude `task.json` ⇒ de browsertest "kolomkiezer" rood.
- **E7 (`f6b56bbe`):**
  - Opgeslagen werk dat meer dan 1 % afwijkt van inzet × restduur krijgt een oranje ⚠ naast de werkcel. De title noemt beide getallen en het histogramgedrag.
  - De inzet wordt niet aangepast. Een toewijzing met een contour krijgt geen markering.
  - Gids nl+en: nieuwe alinea "Werk uit P6 of MS Project kan afwijken…". Een eigen spanne per toewijzing komt later. Ook de E4-meldregel en het G5-dialooggedrag staan erin.
  - Bij EC2370 zie je nu precies op de twee Painter-regels `30/90`.
  - Mutatieproef: de component van vóór de commit ⇒ de browsertest "werkcel" rood.
- **G8 (`c3e95dbe`):**
  - De rasterkolom Werkregel leest leeg op mijlpaal, verzameltaak en hangmat. Taken op doorlooptijd blijven zoals ze waren, want de regel mag daar staan en de driehoek negeert hem.
  - Check n7b; de mutatieproef (`read: task => task.workRule`) ⇒ rood.
- **G10 (alleen onderzocht, niet gebouwd):** het Start-veld is leeg bij een urentaak na F5. Dat komt niet uit #170.
  - `DateTextInput.isoToSegments` accepteert alleen `YYYY-MM-DD`. Een urentaak krijgt na het rekenen een `earlyStart`/`scheduleStart` met tijd (`…T00:00`), en dan is het veld leeg.
  - `TaskTimeFields.tsx` en `DateTextInput.tsx` zijn identiek aan de merge-base `c11754cf` met `origin/claude/rekenprofielen`. In `src/engine/scheduler/` wijzigt deze branch alleen `ResourceLoad.ts`.
  - Ook te zien in `03-…png` bij EC2370, dat 336 u in uren draagt.
- **Punt 8, uit de her-check (`85812af8`):**
  - `syncAssignmentWorkToContour` laat bij een eerste urenverdeling zonder actual-periodes het verrichte werk staan, en zet de rest op contoursom − verricht (geklemd op 0).
  - Checks: v8 (10 d, 50 % ⇒ 2400/2400) en v9 (7 d, 33 %: verricht onveranderd, samen 7 slots).
  - Mutatieproef: de tak uit ⇒ v8 rood met `[2400,0,4800]`, v9 rood.

### Poorten (op exitcode, alle 0)

- `typecheck` en `lint`.
- De losse `verify:*`: examples, docs, i18n, release-highlights-json, store-boundaries, conventions, gantt-boundaries, cycles en text-roles.
- `bash tests/planning/run.sh` zonder corpus: exit 0, 0 XX-regels, tijdzonematrix groen.
- `test:mcp`: 42/0.
- `test:library`: exit 0.
- Browserspecs `work-rule` (10 tests, 7 nieuw), `contour-dialog`, `settings-tabs`, `scheduling-profile`, `text-roles`, `unapplied-and-toasts`, `help-panel` en `table-presentation`: 31 passed. Alles liep achter `flock`.

### Wat ik zag en wat bleef liggen

- **Inzetcel:** 0,26785714 staat nog als "0.26" op 100 % en als afgekapt "0.267" op 125 %, met een punt in de Nederlandse UI. Dat is een bestaand punt (UnitsInput), niet aangeraakt.
- **Afgekapte keuzelijsten:** op 125 % lezen curve en verplaatsen als "Unif…"/"Verp…". De title staat erop. Beter wordt het met een ⋯-menu voor verplaatsen, maar dat heb ik niet gebouwd.
- **Kopregel:** de kop "WERK (REST)" breekt over twee regels en staat boven de tweede regel van elke toewijzing, niet boven de naam.
- **Aantekening met BOM:** EC2370 heeft een aantekening "ï»¿", een BOM-rest uit de XER-lezer. Dat staat los van #170.

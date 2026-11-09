# Handoff — gebouwmodel behouden + IFCX (#804)

Bijgewerkt: zie git log van dit bestand. Dit bestand is de bron bij compactie en voor Trias. Houd het actueel bij elke stap.
Gaat vóór de merge van de laatste PR naar `docs/archive/handoffs/`.

## Waar het staat (gewone taal)

Ethan heeft de IFCX-keuzes genomen (9 november, op advies van Bjorn). Ontwerp v10 verwerkt ze; omdat het eigendom in
IFCX daardoor anders werkt, beoordelen Opus en Sol de nieuwe delen in ronde 9. Daarna: handoff naar het archief, #839
op ready, merge door Trias, en dan fase 0.

## Doel van de sessie (Ethan, 2026-11-07)

- **IFCX volledig inbouwen** in deze sessie: openen en opslaan, alles uit de checklist van #804. Niet alleen ontwerpen
  (correctie door Ethan, 2026-11-07, na mijn verkeerde samenvatting).
- **Alles wat geen planning is, blijft bewaard** in het bestand: het gebouwmodel en gegevens van andere programma's.
  In het huidige IFC (IFC4/IFC4X3, STEP) én in IFCX.
- Eerst een ontwerp door de council (Opus, Sol, Fable), doelcijfer 9. **Fable op high, niet xhigh** (Ethan).
- "IFC CA" in het voicetranscript = de repo `OpenAEC-Foundation/ifccad` (Ethan, bevestigd).
- Ethan is zelf geen fan van IFCX, maar het moet: de aanvrager (DutchSailor, #804) wil het.

## Besluiten

| Besluit | Wie, wanneer | Bron |
|---|---|---|
| #804 wordt gebouwd, IFC + IFCX, model behouden | Ethan, 2026-11-07 | voicetranscript in deze sessie |
| Council mag; Fable high | Ethan, 2026-11-07 | idem |
| Doel = volledig bouwen in deze sessie | Ethan, 2026-11-07 | correctie in deze sessie |
| Handoff.md constant bijhouden | Ethan, 2026-11-07 | deze sessie |
| Council voorlopig alleen Opus + Sol; Fable alleen op echt belangrijke momenten | Ethan, 2026-11-09 | deze sessie |
| Namespace IFCX: `openaec::planning::` voor algemene planningsgegevens (taken, relaties, …); `openaec::ops::` voor app-eigen instellingen en weergaven. ifcx-explorer gaat ook `openaec::planning::activity` lezen. Later andere structuur: oude naam blijven lezen | Bjorn (maintainer IFCCAD/ifcx-explorer), 2026-11-09 08:52–09:30; Ethan: "volg dit" | chatbericht (schermafbeelding in de sessie) |

Open besluiten voor Ethan: §11 van de spec (namespace `ops::`; `openaec::activity` meeschrijven). Eén voor één
voorleggen, met voorbeeld en aanbeveling, pas als de council klaar is.

## Werk

- Branch: `t3/ifc-building-model-support`, worktree `/home/aia09/.t3/worktrees/open-planner-studio/t3-ee8453c4`.
- Draft PR: https://github.com/OpenAEC-Foundation/open-planner-studio/pull/839 (gelinkt aan de thread).
- Spec: `docs/superpowers/specs/2026-11-07-gebouwmodel-behouden-ifc-ifcx-design.md`. v1 = `07968697d`, v2 = `270af9b96`.

## Kern van ontwerp v2 (voor na compactie)

- Eén route voor elk IFC-bestand. Lezen als **bytes**. Elk stuk (entiteit + tekst ervoor) in klasse
  **P** planning (opnieuw geschreven), **C** context (IfcProject, owner history, units: lezen, byte-gelijk),
  **A** aanhangsel (vreemd, verwijst naar P: byte-gelijk, behalve als een P-doel verwijderd is), **V** vreemd (byte-gelijk).
- Bestaande P-ids blijven staan; nieuwe ids boven het maximum van de bron. Daardoor blijven aanhangsels byte-gelijk.
- Zonder vreemd deel: de huidige writer, ongewijzigd.
- Ongewijzigd Bonsai/Synchro-object = bronstuk; gewijzigd = slot-samenvoeging (`ifcTaskSlots.ts`).
- Koppelingen taak↔bouwdeel blijven A; afgeleide alleen-lezen `elementLinks {direction, ref}`.
- Projectnaam e.d. met vreemde context in `OPS_ProjectSettings`.
- Controles vóór schrijven: bytes per stuk + opnieuw lezen. In CI ook IfcOpenShell.
- Herstel: bron per sha256; "bron ontbreekt" blokkeert Opslaan/AutoSave/MCP-export naar het oude doel.
- Tabel van alle tien `writeIFC`-aanroepers in spec §4.13.
- IFCX: `ifcx_alpha`; kop/imports/schemas van een ander blijven; profielversie alleen in `ops::document.formatVersion`;
  paden = kale UUID (= GlobalId-bits), geen voorloop-`/`; entries als bytes, alleen entries met `"ops::` parsen
  (getallen als tekst); eigendom per attribuut, volgorde behouden; compositiecontrole volgens IFC5 `compose.ts`.
- Flags `ifcForeignContent` en `ifcx` tijdens de bouw; weigering PR #547 blijft actief tot de flag eraf gaat.
- Fasen: 0 proef (corpus, meting, IfcOpenShell) → 1–2 STEP → 3 IFCX planning → 4 IFCX met vreemde inhoud.

## Council

| Ronde | Opus 5.5 (xhigh) | GPT-6.1-Sol (xhigh) | Fable 5.1 (high) |
|---|---|---|---|
| 1 (v1) | 6 | 6 | 7 |
| 2 (v2) | 6 | 6 | 7 |
| 3 (v3) | 6 | 6 | 8 |
| 4 (v4) | 7 | 6 | 7 |
| 5 (v5) | 7 | 7 | 8 |
| 6 (v6) | 7 | 7 | 8 |
| 7 (v7) | 7 | 8 | 9 |
| 8 (v8) | 9 | 9 | 9 |
| 9 (v10) | 7 | 8 | — (Ethan: voorlopig zonder Fable) |
| 10 (v11) | … | … | — |

**Doel gehaald in ronde 8 (7 november 2026).** v9 verwerkt de kleine punten die de leden vóór fase 1 vroegen.

Fable r4 liep via de native Agent-tool (model fable, effort high): de T3-taak faalde met "timed out while registering its
MCP tools". Fable r4 (7/10), aanvullend op Opus: zelfde blokkade Ext door D (proef `scratchpad/proef/bonsai-achtig.ifc`,
fix `classify-stop.py`); baseline-definitie: de lezer maakt nooit een baseline uit een schema (`extractBaselines`,
`ifcReader.ts:3623-3660`, alleen `OPS_Baselines`-JSON) → BASELINE-schema is D alleen met `OPS_Baselines`-pset; anders vreemd en
de aggregatie plan→(live, vreemde baseline) volgt §4.6-regel. Vervolg: alleen tokens met `#` in letterlijke slots bewaren
(Ext statisch); structurele A-rels (Nests/Aggregates/AssignsToControl met één vreemd lid) → dubbele decompositie, §4.6
generaliseren naar vier reltypen; script trekt live-taken niet af van baselineboom (`ifcReader.ts:3610`); IFCX tussenversie:
nieuwe velden in bekend attribuut gaan verloren → tussenversie voegt alleen attributen toe, of onbekende velden als token;
`formatRegistry.ts` staat in `src/services/`; `exportProjectWithPool`; AutoSave naar bestand vervangt ook `ifcSource`.

### Ronde 9 (v10, alleen IFCX-besluiten) — Opus 7, Sol 8 — verwerkt in v11

Opus 7 (proeven `scratchpad/r9/opus/`: `adapter-proef.mjs`, `compose-proef.mjs`). STEP-deel klopt nog; fase 0–2 kan
starten. Blokkeert voor fase 3–4: (O1) gedeelde velden hebben één vaste waardevorm (ifcx-explorer leest `start`/
`endExclusive` als datum zonder tijd, `viewer/src/studios/adapters.ts:403-407`; `status` = rijpheid van gegevens, niet
voortgang) → vorm per veld vast, uur e.d. naar `openaec::ops::`; lijst voor Bjorn. (O2) eigen kopie van een gedeeld schema
geeft `SCHEMA_CONFLICT` (`graph.rs:81-84`); ecosysteem importeert schema's (`urn:openaec:reference:schema`) → één bron,
elke wijziging (ook toevoeging) nieuwe naam. (O3) herkomst weg na eerste opslaan (brontoken alleen zonder `ops::` bij
openen) + `bsi::ifc::class` van een ander dubbel → brontoken altijd als veld onveranderd; class alleen eigen in entry met
ander eigen attribuut; nooit class toevoegen. (O4) IFC5-composer: pad met `/` nooit wortel (`cycles.ts:50`), `children`
naar `/planning/work-0` → `Unknown node` (`compose.ts:167`), `children`-sleutels niet vast → controle 3 per pad op platte
knopen, sleutels als token. (O5) eigen attribuut zonder domeinobject (tweede werkplan, losse `ops::task`) gaat verloren;
"zoals selectPlanning" klopt niet (STEP neemt alle taken, `ifcReader.ts:1749`) → eigen = bekende attributen op paden die
domeinobject worden. (O6, VERMOED hoog) afbeelding vreemde activity op importcontract ontbreekt (`recordedTimesOrigin`,
`recordedFields`, `timeModel`, `minuteModel.ts:451-454`; naam in `openaec::label`; `predecessor`; id voor niet-UUID pad).
Vervolg: afwezige velden blijven afwezig; werkschema zonder ops-attribuut; validator alleen eigen attributen;
`openaec::activity` = oude naam? (Bjorn); `foreign` voor IFCX; rondgang via IFCCAD kost ops-gegevens; adapter
ifcx-explorer schrijft ook `'OPS'` als applicatie (`adapters.ts:358`). Eruit: "van een ander programma", leeg
marker-attribuut, "eigen pad"; één tokenstructuur per (pad, attribuut); controle 3 op platte knopen.

Sol 8 (proef `scratchpad/r9/sol/proef-ontwerp.py`; STEP-proeven 915/138/1512 P). Blokkeert: (S1) = O3: merkteken
`openaec::ops::` maakt eigendom van class en brontokens anders na opslaan/heropenen → stabiele regel + test openen →
opslaan → sluiten → heropenen → opslaan. Vervolg: (S2) paden zonder UUID (`/planning/work-0..21`, nul werkplannen):
bronpad behouden, stabiele domein-id, nieuw werkplan; positieve bewerkproef met omgezette fixture. Eruit: lege
merk-attributen.

v11 (2026-11-09): eigendom alleen op domeinobject; brontoken per veld altijd als onveranderd; één bron + vaste vorm per
gedeeld veld, elke wijziging nieuwe naam; id = pad, GlobalId uit UUID of UUID v5; geen werkplan → nieuw; WBS als veld
`parent` (geen `children`); controle 3 per pad (`FlattenCompositionInput`, `compose.ts:60`); importcontract (handmatig
gepland, `recordedTimesOrigin 'ifcx'`); afwezig blijft afwezig; lijst voor Bjorn in §11.

### Ronde 8 — Opus 9, Sol 9, Fable 9 (geen blokkade) — kleine punten verwerkt in v9

Sol 9 (vervolg, proeven `scratchpad/r8sol/`): (S1) = F1/O2 lidmaatschap vreemd lid bewaken in controle 1 + route "laatste
notitie wissen → opslaan → heropenen → opslaan"; (S2) voorproef volgde de lege terugval van `OPS_StructureMeta` niet
(`ifcReader.ts:2219`; proef `lege-structuurmeta-met-templates.ifc` gaf 157 vreemde leden) → hersteld in `classify-v9.py`.

Fable 9 (vervolg): (F1) vreemd lid raakt los als de writer de pset niet meer schrijft (lege pset overgeslagen,
`ifcWriter.ts:694, 910`) → pset met vreemde leden toch schrijven; (F2) plek P-blok zonder P-stuk in de bron (model zonder
planning) → na het laatste stuk, vóór de staart; (F3) blokzin leest als volgorde → "het blok zoals de writer het zonder
vreemd deel schrijft"; (F4) `:1397` eerste owner history = die van het model → test vergelijkt domeinveld, §4.4
Author/Organization is voorwaarde (writer schrijft ze nu niet, `ifcWriter.ts:676-694`); (F5) `#n`-wachtrij bij gemengde
A-rel na het blok (VERMOED); (F6) keten "property → pset" (pset heeft OwnerHistory).
Opus 9 (vervolg; "punten 1–3 vóór de eerste PR van fase 1 in de tekst"; proef `scratchpad/r8opus/wachtrij.mts`):
(O1) vreemd `GUID#n`-lid breekt wachtrij (lezer sorteert op n, `ifcReader.ts:3464, 3494`; merge 6 vs planOnly 3) en
vreemde "Zone" wordt waarde zodra planner veld "Zone" maakt (`:2351`) → "bij opslaan vervalt elk vreemd lid dat de
herkenner in de uitvoer als eigen zou lezen"; voor OPS_Assignments: elke GUID-vormsleutel is eigen; (O2) = F1
(`ifcPsets.ts:487, 612, 637`); (O3) kaart en klassen van de nieuwe bron komen van de writer (wat hij als P schreef, met
sessie-domein-ids), niet uit herindeling; "live-schema van eigen herkomst sluit baselinebomen altijd uit" (`:3610`);
(O4) meer volgorde-afhankelijke lezing (`:284, 2412, 3279, 3494`) → writer nummert `#n` in leesvolgorde van de uitvoer;
lijst toegestane normalisaties van `planningCanon` invullen; plek bewaarde vreemde R t.o.v. `assign_<taak>`;
(O5) hulpstuk-ids: begin bij hoogste id van niet-P plus 1, sla D-ids over (vast punt); (O6) tekst: plek P-blok zonder
P-stuk; §3 r.58 "op hun plek"; r.207 noemt classify-v7.py; keten r.441; `:1397`. Wat eruit kan: test met regelnummers
→ `planningCanon` neemt volgorde en keuzes mee; k-de-sleutel + naambotsing → één regel; IFCX één globaal volgnummer.

### Ronde 7 — Opus 7 ("daarna 8 tot 9"), Sol 8, Fable 9 — verwerkt in v8 (spec §12 "Na ronde 7")

Fable 9: geen blokkade. Vervolg: (F1) tegenspraak naam vreemde `IfcRelNests` (afgeleid vs bewaard slot) → bij vreemde
herkomst brontoken; (F2) legacy kale-GUID-sleutel in `OPS_Assignments` (`ifcReader.ts:3461, 3494`); (F3) codering:
terugval `OPS_`-psets zonder `IfcApplication` = letterlijk (`:1161, 3802-3808`) houden; (F4) pset heeft wel OwnerHistory;
(F5) vervangen van `ifcSource` behoudt `detached`.
Sol 8 (proeven `scratchpad/r7sol/`, `bewijs.txt`). Blokkeert: (S1) herkenners fout: `OPS_Timephased` = één vaste
property `Windows` (JSON, `ifcReader.ts:3380-3390`), `OPS_TimephasedWindow` = vast `FinishFloor`/`StartAnchor`
(`ifcPsets.ts:628-636`), `OPS_Assignments` ook kale GUID; codetypen/velden uit `OPS_StructureMeta` vóór template
(`ifcReader.ts:2202`); fixtures `tests/planning/fixtures/vast-werk-oude-writer.ifc`, `ifc-arity-oude-writer.ifc` faalden;
(S2) `detached` mist `foreignMembers` (pset-identiteit) → Ctrl+Z hangt vreemd lid niet terug.
Opus 7 (proeven `scratchpad/r7opus/`: volgorde.mts, kal.mts, kaal.mts, bonsaikal.mts). Blokkeert:
- (O1) **D op bronplek breekt volgorde**: wortelvolgorde komt uit bestandsvolgorde `IFCTASK` (`ifcReader.ts:1749`;
  Nests onder schema genegeerd `:2394`; WBS `taskTree.ts:94-98`, `taskSlice.ts:1497-1500`); projectkalender = eerste
  `IFCWORKCALENDAR` (`ifcReader.ts:1449, 3256`, `ifcWriter.ts:418`). Proef: één IFCTASK verschuiven → "1. Preparation"
  laatste; kalenders verwisselen → andere projectkalender. Voorstel: hele P-blok in writer-volgorde op de plek van het
  eerste P-stuk van de bron (D houdt #id); test elke "eerste X"-keuze (`ifcReader.ts:267, 438-445, 1377-1378, 1397,
  1449, 3256`) merge = planOnly; tests wortel verplaatsen, nieuwe wortel bovenaan, andere projectkalender, kind + WBS.
- (O2) kale GUID-sleutels in `OPS_Assignments` (≤ v2026.7.3, `git show 87ebd4d46^:…ifcWriter.ts` r.638-641) → eigen
  bestand krijgt vreemd deel (proef 77 vreemde leden) → herkenner neemt kale GlobalId van toegewezen resource; poort met
  concrete oude tags per formaatwissel.
- (O3) Ledenregel gooit Bonsai-kalendertoewijzing weg: lezer slaat rel naar eerste kalender over (`ifcReader.ts:3272`),
  writer schrijft die nooit (`ifcWriter.ts:1452`) → `#64` in bonsai-achtig vervalt al bij openen+opslaan. Voorstel:
  koppeling met projectkalender = "volgt projectkalender" (geen eigen calendarId).
Vervolg: (O4) Bonsai hangt alleen wortels via Controls aan schema; writer alle taken (`ifcWriter.ts:549-553`) → fase 0;
(O5) AutoSave stale-check (`useAutoSave.ts:155`) moet ook `ifcSource` identiek eisen; (O6) `detached` ook slots van
vervallen vreemde R per koppeling; (O7) naambotsing vreemd lid ↔ nieuwe eigen property → vreemd lid vervalt; (O8)
codetypen/velden komen uit JSON `OPS_StructureMeta` (`ifcReader.ts:2200-2219`), template is terugval → index; lege
`createdAt` → CreationDate nu maar `ifcDateTime('')` = `$` (`ifcWriter.ts:113, 474`; `xerReader.ts:1239`); herkomst-slot
= `OwningApplication`; IFCX `children` is map → volgorde in `ops::` (fase 3).

### Ronde 6 — Opus 7 ("daarna 8 tot 9"), Sol 7, Fable 8 — verwerkt in v7 (spec §12 "Na ronde 6")

Opus-proeven in `scratchpad/r6opus/` (`twee-werkplannen.ifc`, `sim-order.py`, `propnames.py`).
Blokkeert:
- (F1/O1) **Herkomst slaat om na één opslaan**: OwnerHistory is een verwijzingsslot → de writer zet overal zijn eigen
  OPS-owner history (`ifcWriter.ts:185, 394, 1835`, `ifcTaskSlots.ts:326`) → ronde 2: werkplan 'Plan' wordt 'Proj',
  Bonsai-relaties per resource worden per taak gegroepeerd (QuantityInProcess weg), Bonsai-Status wordt writerwaarde.
  Voorstel (beide): OwnerHistory van een D/R-stuk van vreemde herkomst = constant `#`-slot (brontoken), doel start van
  Ext → C. Test: vanaf opslaan 2 byte-gelijk aan opslaan 1; Bonsai-tests na twee rondes.
- (O2) Ledenregel R van vreemde herkomst ("zelfde leden zolang ze bestaan") draait bewerkingen terug: taak een niveau
  hoger (#34 Nests in bonsai-achtig), toewijzing verwijderd, andere kalender (`ifcReader.ts:3283-3293` kiest de laatste).
  Voorstel: lid blijft alleen zolang het domein dezelfde relatie heeft (type + relating; ToProcess: paar taak/resource).
- (O3) Eerste werkplan wisselt na opslaan: niet-P vóór P → tweede werkplan (V) komt eerst (proef: D {20} → {70}).
  Voorstel: D-stukken op hun bronplek schrijven; alleen hulpstukken en R achteraan.
Sol (7/10, proeven `scratchpad/r6sol/`): zelfde herkomst-, leden- en werkplanblokkade; plus (S1) "alle" bij
dynamische psets klopt niet: lezer gebruikt `OPS_Assignments` alleen bij een passende toewijzing (wachtrij per GlobalId,
`ifcReader.ts:3455-3470, 3489`) en `OPS_ActivityCodes` alleen met codetype uit template + waarde uit opsomming
(`:2225-2246, 2359-2366`) → `VendorSecretNote` ging verloren. In v7: herkenners, gemeten met `classify-v7.py`.
Vervolg: (F2/O6) codering: kies per P-stuk op de app achter zijn eigen OwnerHistory-slot, los van klasse (oud01: OH is C
door het project → nu verkeerd); (F3) index moet PredefinedType, Name+CreationDate van schema's en `Baselines`-JSON
bevatten; BASELINE alleen D zonder taken (staat in script, niet in tekst); (F4/O4) twee lijsten: `IFC_SAVE_KEYS` (Pick,
asserts `ifcSaveInput.ts:116-131`) en `IFC_DIRTY_KEYS` zonder `ifcSource` voor `sameIFCSource`, `commitSavedDocument`,
`markAutoSaveVersionSaved` (`documentSlice.ts:598-602`), `recoveryDelta.ts:88`; `recoverySnapshotInput.ts:12` moet
`ifcSource` weglaten (anders 150 MB naar worker per 10 s); (F5) writer-Nests voor nieuwe leden sluit leden in bewaarde
relaties uit; (O5) `OPS_Project` niet in `PSET` (`ifcWriter.ts:413`, `ifcReader.ts:384`) → toevoegen + test "elke
psetnaam van de writer staat in PSET"; (O7) controle "bestand vervangen" mist size/mtime in ifcSource en raakt eigen
bestanden → alleen met `foreign`; AutoSave: één melding en stoppen; (O8) manifeststap best effort
(`RecoveryStorageUnavailableError`, #582); (O9) baselinesleutel via `ifcDateTime(createdAt)` (`ifcWriter.ts:112-119,
474`) en gedecodeerde Name; (O10) §4.4 r.224 tekstfout (lezer leest `IfcProject.Name`, `ifcReader.ts:1419`); IFCX-vorm
van ifcSource/manifest/bron ontbreekt beschrijven; handleiding in fase 3–4; melding na crash zonder bron alleen als er
echt vreemde tokens waren.

### Ronde 5 — Opus 7 ("daarna 8 tot 9"), Sol 7, Fable 8 — te verwerken in v6

Beide via native Agent (Fable high, Opus xhigh). Opus-proeven in `scratchpad/r5/` (`sim.py`: drie opslagrondes, aantal
stukken blijft gelijk na ronde 1; `prop.ifc`, `oud01.ifc`).
Blokkeert:
- (F1/O1) Eigen bestand zonder vreemd deel: nummering en slots zoals de huidige writer (vanaf #1, geen kaart, geen
  brontokens), anders faalt de 100 %-P-poort. Opus: vier soorten slots — domein, afgeleid (altijd writer-waarde, bv.
  `StatusTime` `ifcWriter.ts:1542`, `IfcTaskTime.Name`, Nests-naam `:1600`, werkplan/schema-datums `:447-449`, baseline
  `:465-466`), constant (alleen hier brontoken), verwijzing; elk slot in elke descriptor een soort, test faalt zonder.
  Tokens alleen uit huidige lay-out (oude: IfcTask 12 args `ifcReader.ts:1768`, resource 9 args `ifcWriter.ts:1728`,
  LagTime `ifcReader.ts:1984`). Poortgeval: eigen bestand, statusdatum wijzigen, taak/baseline hernoemen = writer-uitvoer.
- (O2) `ifcSource` buiten `IFCSaveSource` → 26 aanroepen moeten het met de hand doorgeven (`ifcSaveInput.ts:13,66-69,
  116-126`). Voorstel: `buildWriteIFCInput(src, mode: 'merge'|'planOnly')` verplicht; eigen sleutellijst voor
  `sameIFCSource`; schrijflaag weigert planOnly naar het eigen doel van een document met vreemd deel.
- (O3) Projectnaam: regel geldt voor "project niet P", niet alleen C. Bonsai: project V bij openen, naam 'Proj'
  (`ifcReader.ts:1414`), werkplan 'Plan' → na opslaan C → controle 2 faalt. Naam in `OPS_ProjectSettings.ProjectName`.
- (O4) Gemengde relatie alleen als de relating in D zit; vreemde relating (bv. IfcCostItem → taken) = A met §4.7.
- (O5) "Bron ontbreekt" alleen met vreemd deel: manifest `foreign: boolean`; zonder vreemd deel huidige route + melding.
- (O6) Onbekende property in bekende pset: script laat hem weg (`scratchpad/r5/prop.ifc`). Kiezen: belofte schrappen
  (verlieslijst) of property-namen in de index en C. `OPS_CustomFields`-namen komen uit templates (`ifcReader.ts:2343-2357`).
Sol (7/10, proeven in `scratchpad/r5sol/`), blokkeert: (S1) onbekende property in bekende pset wordt P via stap 3
(`IfcPropertySingleValue` is een W-type; proef `#906 VendorSecretNote` aan `OPS_Calendar`) = O6; (S2) R-sleutel niet uniek:
FS `#65` + SS `#67` tussen zelfde taken = één sleutel; writer groepeert toewijzingen per taak in één rel
(`ifcWriter.ts:1830`), aparte QuantityInProcess past niet → bron-slots op bron-`#id`, sequences via domein-id
(`ifcReader.ts:2062`), gegroepeerde rels beschrijven; (S3) codering: oude `0.1`-applicatie blijft C en bepaalt de
decodeerkeuze bestandsbreed (`ifcReader.ts:1156`) = O7 → herkomst codering per stuk, oude P-tokens normaliseren, beide
richtingen in de poort; (S4) gedeelde `OPS_Calendar` op kalender én wand → rel A, pset V → lezer mist `HoursPerDay=8`
(leidt 9 af uit 07–16) → leesrecht los van schrijfrecht: bekende planningsproperties ook via gemengde propertyrel lezen;
bewerking laat gedeeld deel intact.
Vervolg: register in script wijkt af (zes XER/P6-markers geen pset; mist `OPS_P6Progress`, `ifcPsets.ts:77,707`) →
genereren uit `ifcPsets.ts`; baselinesleutel vastleggen (GlobalId `guidOf(ctx,'baseline_ws_'+id)`, salt project-id
`ifcWriter.ts:227-232`, terugval Name+CreationDate); MCP-backup: terugzetten = P uit backup + vreemd deel van het huidige
document (geen bron per sha); vaste lijst letterlijke `#`-slots noemen (`Usage`, `BaseCosts`, `BaseQuantity`); slots per
naam via lay-outbewuste descriptor; één R-sleutel met psetnaam; `IfcRelSequence` D (domein-id, SS+FF tussen zelfde paar,
`sequenceSlice.ts:79`); R-id-regel schrappen (geen attribuut wijst naar de zeven reltypen, VERMOED); detached-ids boven
hulpstukken, soort "teruggezet" in wijzigingslijst; twee-keer-opslaan-test vergelijkt vanaf ronde 1; extra werkplannen
gaan verloren (`ifcWriter.ts:452`) → verlieslijst; decodeerkeuze aan de app achter de eigen owner history van P
(`ifcReader.ts:1156-1161`, `oud01.ifc`); `ifcSource` vervangen bij elk geslaagd schrijven los van dirty
(`fileSlice.ts:576-594`), niet bij exportAs/zonder model; model op schijf vervangen → grootte+mtime check; corpus: project
→ eigen owner history; gemengde `IfcRelDefinesByProperties` één zin.

### Ronde 4 — Opus (7/10, "daarna 8 tot 9") — verwerkt in v5 (Sol 6: ook ifcSource zonder vreemd deel, register i.p.v. OPS_-prefix, crash tussen opslaan en manifest; spec §12)

Blokkeert (tekstfixes): (1) Ext mag niet door D ∪ R heen lopen (anders wordt de TaskTime en eigen owner history van een
gekoppelde taak C en stapelt per opslaan een wees op; proef `scratchpad/r4/k1..k3.ifc`, fix `scratchpad/r4/classify-stop.py`);
doelen van bewaarde slot-tokens blijven startpunt; test: twee keer opslaan met 4D-koppeling + vreemde pset = zelfde aantal
stukken. (2) R-tabel: `IfcRelAssignsToControl` ook kalender → resources/taken (`ifcWriter.ts:1482, 1490`); script volgt de
tabel niet (`classify-v4.py:77`), letterlijk geeft appartementencomplex P 4224 C 39 A 1 (`scratchpad/r4/classify-spec.py`).
Vervolg: (3) script regel 71 (`D |= base_tasks`) eruit; D bevat alleen BASELINE-schema's die bij een item in
`OPS_Baselines` horen. (4) R-relaties uit Bonsai/Synchro verliezen QuantityInProcess, UserDefinedSequenceType, Name/
Description, Creators → R in `sourceSlots` of verlieslijst. (5) R-id via objectleden niet uniek → R houdt `#id` alleen als
een niet-P-stuk ernaar wijst, sleutel (type, leden, psetnaam). (6) `sameIFCSource` kijkt alleen naar `IFC_SAVE_KEYS`;
herstel (`recoveryDelta.ts:88`) → nieuwe sha via manifest-metadata; herstel moet kaart/sourceSlots/elementLinks opnieuw
opbouwen. (7) "Onbekend schema geweigerd" alleen met vreemd deel. (8) MCP-backups houden per sha een modelkopie vast
(`backupService.ts:170-181`) → meten of alleen de nieuwste. (9) `detached`: welke versie bij twee opslagen; id-botsing.

### Ronde 3 — Opus (6/10, "daarna 8 tot 9") — verwerkt in v4 (Sol 6 en Fable 8 vonden grotendeels hetzelfde; spec §12)

Blokkeert: (1) §4.2 geeft voor eigen bestanden geen 100 % P (bewezen met script
`scratchpad/r3proof/classify.py` op `public/examples/showcase-appartementencomplex.ifc`): psets/lagtijden niet vooruit
bereikbaar; letterlijk worden alle wortels C; eigen baselines dragen geen `OPS_`-pset (`ifcWriter.ts:469-483`); resources
zonder toewijzing vallen weg (lezer leest alle resources, `ifcReader.ts:~2428`); stap 3↔4 kring; `IfcRelDeclares`
project→werkplan is volgens de regel P. → vaste-punt-berekening (a) domeinobjecten (werkplan, live-schema's + taken zoals
de lezer kiest, álle resources en kalenders, eigen baselinekoppen), (b) P-rels (objectleden P of C-project; LagTime en
owner history tellen niet als lid; `OPS_`-psets/templates), (c) Own = vooruit bereikbaar uit (a)+(b) binnen writer-typen,
(d) Ext = vooruit bereikbaar uit alles buiten Own, (e) P = Own − Ext (domeinobjecten blijven P), C = Own ∩ Ext; 100 %-P-test
als poort in fase 0. (2) C één niveau diep: gedeelde owner history → zijn PersonAndOrganization e.d. P zonder GlobalId →
loze ref → C = hele afsluiting van Ext; doelen van bewaarde `domain:false`-tokens zijn startpunten van Ext. (3) Controle 2:
`canon` sleutelt op wbsCode+naam (`check-ifc-roundtrip.ts:855-881`) en normaliseert de invoer (projectkalender uit
`resourceCalendars`, `:929`) → vergelijk twee herlezingen: canon(read(samengevoegd)) === canon(read(writeIFC zonder vreemd
deel)); `canon` naar `src/`. (4) Opslaan + Ctrl+Z verliest koppelingen/slots/psets (ifcSource `none`, `ifcGlobalIds` `data`)
→ `ifcSource.detached` per sessie, terugzetten als GlobalId terugkomt; of besluit Ethan.
Vervolg: (5) `selectPlanning` = huidige regel letterlijk incl. #336 (baseline is planning als live-schema leeg is; losse
taken buiten schema). (6) Alleen Task/TaskTime hebben descriptors; work control alleen posities; kalender/resource/sequence
zijn sjablonen (`ifcWriter.ts:1268, 1675`) → alle slots + waarde bij openen bewaren; vijf descriptortabellen in fase 2;
LagTime zonder GlobalId. (7) Dubbele GlobalIds → koppel domein-id → bron-#id (`taskStepIdMap`, `resourceStepIdMap`);
"geen dubbel #id" in controle 1. (8) sha256 wijzigt elk opslaan door tijdstempels (`ifcWriter.ts:394`) → browser niet elke
keer 150 MB kopiëren (handle opnieuw lezen), backups opruimen, byte-test alleen op niet-P. (9) AutoSave kan blijven
schrijven (`sameIFCSource`, `ifcSaveInput.ts:135`) → ifcSource vervangen in dezelfde `set()` die dirty wist. (10) IFCX:
eigen deel van gemengde entry direct ná de entry, niet achteraan. (11) IFCX: "eigen pad" met `ops::x` van een ander;
onbekende `ops::`-attributen; wanneer is een kop eigen. (12) IFC2X3-planningsbestanden van anderen openen nu wel (#292) →
zonder `IfcProduct` de huidige route houden. (13) Route `openExampleFromString` (tekst), `devBridge.saveToPath`.
(14) `openaec::links`-doelen zijn paden → `elementLinks.target`; oudere eigen bestanden uit release-tags in de corpus.

### Ronde 2 — Opus (6/10) — verwerkt in v3 (Sol 6 en Fable 7 vonden grotendeels hetzelfde; zie spec §12)

Blokkeert: (1) klasse-regels maken van elk eigen bestand een bestand met vreemd deel (writer schrijft OwnerHistory-keten,
units, context, IfcProject, `IFCRELAGGREGATES` plan→schema, templates; die staan niet in de P-lijst) → afsluiting =
bereikbaarheid vanuit P-wortels, beperkt tot writer-typen, C alleen als ook niet-P ernaar verwijst; rel met alleen
P-leden = P; test "elk voorbeeld en elke writer-uitvoer = 100 % P". (2) Meerdere werkschema's: `:445` is
`collectIfcGlobalIds`, niet de taakkeuze; taken komen uit alle IFCTASK behalve baselinebomen (`:1749`, `3570-3612`) →
één gedeelde functie "welke taken neemt de app over" voor indeling én lezer; baselinebomen van Bonsai V. (3) Controle 2
faalt bij gewoon werk (nieuwe ids `seq-ifc-<GlobalId>`, `res-ifc-…` na herlezen) → canonieke vergelijking op GlobalId;
bij refs/GlobalIds alleen "geen nieuwe" t.o.v. bron. (4) `ifcSource` onveranderlijk → melding elke keer opnieuw, herstel
zegt "bron ontbreekt" na opslaan → na geslaagd opslaan wordt de uitvoer de nieuwe bron. (5) Slot-samenvoeging te smal:
criterium = writer schrijft alleen slots die de lezer naar een domeinveld vertaalt én die gewijzigd zijn; ook voor
IfcWorkPlan/IfcWorkSchedule (`ifcWorkControlSlots.ts`), resources (type PRODUCT→EQUIPMENT, `ifcConstants.ts:52-56`),
kalenders, sequences. (6) Leesbasis + stukken per object ontbreken in `ifcSource`; ids alleen behouden voor P met
GlobalId gekoppeld aan domeinobject (+ IfcTaskTime); test wordt "niet-P byte-gelijk + tweede opslaan byte-gelijk aan
eerste" (writer schrijft altijd plan, schema, kalender, `OPS_ProjectSettings`).
Verder: (7) A-stukken van `IfcRelAssignsToProcess/Product` wél parsen (richting, GlobalId); gemengde rel alleen splitsen
als toewijzingen van die taak gewijzigd zijn. (8) Bezit van de bytes: in `ifcSource` op de hoofdthread, kopie naar
scanner; samenvoeging met `subarray` op de hoofdthread. (9) Headless contracten bytes in/uit (`core/index.ts:53`,
`api.ts:120`, `nodeFs.ts:358`, `backupFs.ts:35`). (10) Controle 1 kan niet falen → per niet-P-stuk id+bytes+volgorde op
de scan van de uitvoer, directe bytevergelijking. (11) §4.5 richting omgedraaid; algemene regel lid/lege lijst/enkele
ref. (12) IFCX: compositiecontrole alle eigen bijdragen eruit; `openaec::activity` vereist `status`, schema meeschrijven;
`openaec::links` lezen voor koppelingen; "eigen pad" definiëren; kop van een ander niet aanraken (ook geen timestamp).
(13) Ontbrekende routes: `exportAs('ifc')` (`fileSlice.ts:1396-1399`), `exportProjectWithPool` (`:1474`), Recent
(`tauriBackend.ts:87-90`, `fileSlice.ts:1658`), `parseExternalSource` (`:1500`). (14) `OPS_ProjectSettings` blijft op
IfcProject (nieuwe P-rel naar C-project); naam/beschrijving al in IfcWorkPlan; alleen auteur/bedrijf nieuw. (15) Herstel-
manifest versie 6 (`recoveryManifest.ts:4`), opruimen kijkt alleen naar `xerArchive` (`recoveryStore.ts:378`).
Eruit: lezen van een bestand met alleen `openaec::activity`; schema-generator (handmatig + validatortest); JSON-parser
met getallen als tekst (eigen leden met tokenizer eruit knippen); sha256 per stuk.

Hoe ze draaien: Sol en Fable via T3 `delegate_task`. Opus via T3 faalde twee keer ("timed out while registering its
MCP tools"); daarom via de native `Agent`-tool (subagent `reviewer`, model opus, effort xhigh). Elke ronde: nieuwe taak
per lid, met de samenvatting van de vorige ronde. Wijzig de spec niet terwijl een ronde loopt. Ronde 1 duurde ~50 min
(machine zwaar belast).

Ronde 1, in het kort (alles verwerkt in v2, zie spec §12): tegenstrijdige indeling eigen/vreemd; projectcontext; lezen
als bytes; herstel zonder model kon het modelbestand overschrijven; niet alle `writeIFC`-routes; `IfcRelAssignsToProduct`
dubbel; Bonsai-attributen; IFCX `dataVersion`, paden met `/`, imports/schemas, eigendom per entry, volgorde,
getalprecisie; grens zonder meting; inschatting te optimistisch; foute commit in de bronnen.

## Vastgestelde feiten

- Weigering gebouwmodel: `src/services/ifc/ifcReader.ts:178-185`, lijst `ifcBuildingModelTypes.ts`
  (gegenereerd door `scripts/ifc-product-types.py`). PR #547, commit `5b2812f94`.
- Writer: `ifcWriter.ts:317` e.v.; vaste entiteiten `:395-410`; ids via teller `ctx.nextId`; regels met `'\n'` (`:287`).
  Schrijft alleen `OPS_*`-psets.
- Lezer: projectnaam/id/auteur uit IFCPROJECT + eerste owner history (`:1377-1423`); eerste live-werkschema (`:445`);
  producten in `IFCRELASSIGNSTOPROCESS` stil weg (`:3487-3490`); complexe instanties overgeslagen (`:982-985`);
  `readFileSchema` kent `ADD1`/`TC1` niet (`:1105-1107`).
- `writeIFC`-aanroepers: fileSlice, useAutoSave, recoverySnapshotInput, mcp/backupService, mcp/tools/fileTools,
  IFCPanel, core/index, library/libraryIfc, benchmark/runner, devBridge.
- Voorbeeld voor bronblok buiten undo: `xerSourceArchive` (`documentContract.ts:298`) + `'recovery-reference'`.
- IFC5 (buildingSMART `1a63082`): `ifcx_alpha`; imports = lagen; later wins per attribuut; geen planningsschema's.
- Ecosysteem: `ifcx_alpha`; namespace per programma (`ocss::`, `oses::`, `openbim::`, `openaec::`); ifcx-explorer
  `openaec::activity` + `openaec::links`; UUID v5 = GlobalId (128 bits). IFCCAD: alleen IFCX/CBOR, bewaart bronbytes.

## Voorproef indeling (v9)

`scripts/proef/classify-v9.py` (Python, alleen stdlib; draaien met `python3 -I`) voert §4.2 uit. Register uit de
`OPS_*`-namen in `ifcPsets.ts`/`ifcWriter.ts`; bekende propertynamen = tekstliteralen in `src/services/ifc/` (benadering);
`OPS_Assignments`/`OPS_ActivityCodes` hebben namen uit de data (alle properties eigen); `OPS_CustomFields` via template.
Uitkomst 7 november: 35 eigen bestanden 100 % P zonder vreemde leden; 8 IFC5-modellen 100 % V; `prop.ifc` (Opus) en
`onbekende-property.ifc` (Sol) geven een vreemd lid; `parallelle-relaties.ifc` (Sol) twee D-sequences; Fable's lege
Bonsai-baseline (`scratchpad/r5/eigen-plus-bonsai-baseline.ifc`) is V. v7: herkenners voor `<GlobalId>#n` (wachtrij) en
codetypes; vreemde herkomst via `IfcOwnerHistory.OwningApplication` (argument 1!) → owner history van een ander is C;
eigen bestanden 0 vreemde herkomst, Bonsai-voorbeeld 10; Sol's `dynamisch-*.ifc` elk 1 vreemd lid. v8: alleen
`OPS_Assignments` dynamisch (ook kale GUID), `OPS_StructureMeta` eerst; ook `tests/planning/fixtures/*.ifc` (10) in de
poort: alle echte writer-uitvoer 100 % P; uitzonderingen kloppen (`ifc-arity-oude-writer-merged.ifc` heeft een model,
`werkdag-einde-tussenwaarde.ifc` heeft bewust hernoemde properties → vreemde leden). v9: elke GlobalId-vormsleutel in
`OPS_Assignments` eigen; `OPS_StructureMeta` alleen als een lijst niet leeg is (anders templates). Basis voor fase 0.

## Omgeving en valkuilen

- aia09-mp50 is zwaar belast door andere sessies (load ~45 op 8 cores, 2 GB vrij om 18:14). Korte, gerichte commando's.
- Deze worktree heeft geen `node_modules`: `verify:docs` draait hier niet. CI op de PR controleert.
- Clones van ecosysteem-repo's (alleen lezen):
  `/tmp/claude-1000/-home-aia09--t3-worktrees-open-planner-studio-t3-ee8453c4/ed17101e-1f1f-42d8-8b7b-bb2a1d7b5750/scratchpad/repos/`
- `gh issue view` faalt (Projects classic); gebruik `gh api repos/OpenAEC-Foundation/open-planner-studio/issues/<n>`.
- Trias (wrakko) is op de hoogte van dit bestand (bericht 2026-11-07 ~18:20).

## Volgende stappen

1. Klaar: council (ronde 8: 9/9/9), v9.
2. Besluiten voor Ethan, één tegelijk: (1) namespace `ops::` of `openaec::planner::` (voorgelegd 2026-11-07 ~21:55,
   aanbeveling `ops::`) → **besloten 2026-11-09**: advies Bjorn volgen (zie Besluiten). Gevolg: besluit 2 (afgeleide
   kopie `openaec::activity`) vervalt, want ifcx-explorer leest straks `openaec::planning::activity`. Eigendom in IFCX kan
   niet meer op namespace (gedeeld): eigen pad = pad met een `openaec::ops::`-attribuut (uit te werken in §5.2/§6.2).
   Besluit 3 (Ethan, 2026-11-09, optie 1): planning van een ander programma in `openaec::planning::` openen en bewerken.
   Alles verwerkt in spec **v10** (`e6f128ea3`). Wrakko ingelicht (2026-11-09 ~10:50).
   **Council ronde 9 loopt** (alleen Opus + Sol, brief `scratchpad/r9/brief.md`, diff `scratchpad/r9/v9-naar-v10.diff`):
   Sol via delegate_task (codex gpt-6.1-sol xhigh), Opus via native Agent (reviewer, xhigh). Doel weer 9.
   Ronde 9: Opus 7, Sol 8 → v11. **Ronde 10 loopt** (Opus + Sol op v11).
3. Afspraak Trias (wrakko, 2026-11-07 ~21:58): #839 blijft draft tot beide keuzes in de spec staan. Dan: keuzes in de
   spec; `handoff.md` naar `docs/archive/handoffs/`; #839 op ready en de head aan wrakko melden. Trias laat Sol het
   ontwerp reviewen (docs-only) en merget bij ja en groene CI.
4. Fase 0 op een eigen branch vanaf `main`, na de merge van #839. De PR van fase 0 mag eerder voorbereid worden, maar
   gaat pas na die merge naar review.
5. Weekendstop (zaterdag 23:00 tot maandag 01:00) is voorbij.
6. Bouwen: fase 0 eerst. Kleine PR's naar `main`; worker (Opus medium) voor gewoon werk, expert (Opus xhigh) voor
   scanner/indeling, verliesbewaking en herstel. Review per PR door Sol (BLOKKEERT/VERVOLG). Geen zware runs lokaal.

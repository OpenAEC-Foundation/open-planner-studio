# Formaat-naslagrapport: XER, PMXML, MPP, Asta PP, iCalendar

> **Herkomst (2026-08-15):** geoogst uit de parallelle branch `file-format-implementation`
> (verwijderd na oogst, eigenaarsbesluit — de code van die branch is bewust NIET overgenomen).
> Let op: de MPP-conclusies hierin (npm-`cfb`-spoor) zijn ingehaald door de inmiddels gebouwde
> native MPP14-lezer in `src/services/mpp/`; de XER/PMXML/PP-delen zijn actuele input voor
> etappe 2. Verifieer beweringen tegen de huidige code.


Doel: technische basis voor **native TypeScript** parsers/writers (geen JVM, geen MPXJ-dependency).
Bronnen: MPXJ-broncode (`testdata-crawl/mpxj/src/main/java/org/mpxj/`, sparse checkout uitgebreid met
`mpp`, `mspdi`, `mpx`, `planner`, `common`, `reader`), testbestanden in `mpxj/junit/data/`,
`cpp-cpm-engine/validation/xer-corpus/` (13 bewust gevarieerde/kapotte cases), `pmxml-samples/`,
`crawl-pp/` (echte .pp SQLite-bestanden), plus webbronnen (Oracle docs, RFC 5545, SheetJS cfb, sql.js/wa-sqlite).

Alle regelverwijzingen zijn naar de MPXJ-checkout van 2025-11 (XerFile.java gedateerd 2025-11-12).

---

## 1. Primavera XER — prioriteit 1, lezen ÉN schrijven

**Moeilijkheidsoordeel TS: LAAG-MIDDEL. Volledig haalbaar, incl. writer. Dit is een tab-gescheiden tekstformaat met één rare sub-grammatica (clndr_data).**

### 1.1 Bestandsstructuur

Regelgeoriënteerd, tab-gescheiden (`\t`). Recordtypen in kolom 1 (MPXJ `XerFile.java` RECORD_TYPE_MAP):

| Token | Betekenis |
|---|---|
| `ERMHDR` | Header, altijd eerste regel (fingerprint: MPXJ herkent XER via regex `ERMHDR.*`) |
| `%T` | Tabelnaam (bv. `%T\tTASK`) — MPXJ lowercased de naam bij inlezen |
| `%F` | Veldnamen van de volgende `%R`-records (ook lowercased) |
| `%R` | Datarij |
| *leeg* | **Vervolg van een multiline-veld**: een regel die níet met een token begint hoort bij het vorige `%R`-record (RECORD_TYPE_MAP mapt `""` op DATA). Newlines in memovelden veroorzaken dit. |
| `%E` | Einde bestand (stop met parsen; alles erna negeren) |

`ERMHDR`-velden (positioneel): versie (bv. `8.2.0`, `20.12`, ook `12.x`, `15.x`, `18.x` in het wild), exportdatum (`yyyy-MM-dd`), exporttype (`Project`), gebruikersnaam, volledige naam, databasenaam, moduletitel (`Project Management`), en op **index 8 de default-valuta** (bv. `USD`; MPXJ pakt `record.get(8)`, valt terug op `"USD"` als het veld ontbreekt). MPXJ's eigen writer schrijft hardcoded versie `20.12`.

### 1.2 Encoding

- **Default CP1252** (`PrimaveraXERFileReader`: `m_charset = CharsetHelper.CP1252`), niet UTF-8! P6 schrijft in de Windows-ANSI-codepage van de machine. Voor niet-westerse installaties komen ook CP936 e.d. voor; MPXJ laat de charset overridebaar.
- UTF-8/UTF-16 BOM's komen voor (UniversalProjectReader checkt BOM vóór fingerprinting). TS-aanpak: BOM detecteren, anders windows-1252 decoderen (`TextDecoder('windows-1252')` is in elke browser en Node aanwezig).
- Escaping: alleen dubbele aanhalingstekens: `""` → `"` bij lezen; writer vervangt `"` door `""` (XerWriter.format). Tabs komen in de praktijk niet voor binnen velden (er ís geen escape voor).

### 1.3 Minimaal benodigde tabellen

MPXJ leest ~40 tabellen (READ_REQUIRED_TABLES) en negeert de rest. Minimum voor onze doelen:

| Doel | Tabel | Sleutelvelden |
|---|---|---|
| Project | `PROJECT` | `proj_id`, `proj_short_name`, `plan_start_date`, `scd_end_date`, `last_recalc_date` (= data date/statusdatum!), `clndr_id`, `export_flag`, `sum_base_proj_id` |
| WBS | `PROJWBS` | `wbs_id`, `proj_id`, `parent_wbs_id`, `wbs_short_name`, `wbs_name`, `proj_node_flag`, `seq_num` |
| Activiteiten | `TASK` | `task_id`, `proj_id`, `wbs_id`, `clndr_id`, `task_code`, `task_name`, `task_type`, `status_code`, `target_drtn_hr_cnt`, `remain_drtn_hr_cnt`, `act_start_date`, `act_end_date`, `early_start_date`, `early_end_date`, `late_start_date`, `late_end_date`, `restart_date`/`reend_date` (remaining early), `cstr_type`, `cstr_date`, `cstr_type2`, `cstr_date2`, `total_float_hr_cnt`, `free_float_hr_cnt`, `phys_complete_pct`, `complete_pct_type`, `suspend_date`, `resume_date` |
| Relaties | `TASKPRED` | `task_pred_id`, `task_id` (successor!), `pred_task_id`, `pred_type`, `lag_hr_cnt` |
| Kalenders | `CALENDAR` | `clndr_id`, `clndr_name`, `clndr_type`, `base_clndr_id`, `default_flag`, `day_hr_cnt`, `week_hr_cnt`, `month_hr_cnt`, `year_hr_cnt`, `clndr_data` |
| Resources | `RSRC` | `rsrc_id`, `parent_rsrc_id`, `clndr_id`, `rsrc_name`, `rsrc_short_name`, `rsrc_type` |
| Toewijzingen | `TASKRSRC` | `taskrsrc_id`, `task_id`, `rsrc_id`, `role_id`, `target_qty`, `remain_qty`, `act_reg_qty`, `act_ot_qty`, `target_cost`, `remain_cost`, `act_reg_cost`, `cost_per_qty`, `curv_id`, `rate_type` |
| Valuta | `CURRTYPE` | `curr_id`, `curr_short_name`, `decimal_symbol`, `digit_group_symbol`, `decimal_digit_cnt` |
| Scheduling-opties | `SCHEDOPTIONS` | o.a. `sched_calendar_on_relationship_lag` |
| Activity codes | `ACTVTYPE` (definities), `ACTVCODE` (waarden, hiërarchisch via `parent_actv_code_id`), `TASKACTV` (koppeling task↔code) |
| UDF's | `UDFTYPE`, `UDFVALUE` (generiek: `udf_type_id`, `fk_id` verwijst naar rij in doeltabel via `table_name`) |

Ontbrekende tabellen zijn normaal: schrijf een parser die per `%T` beslist of hij de tabel bewaart of overslaat, puur op veldnamen uit `%F` (kolomvolgorde is niet gegarandeerd en verschilt per P6-versie).

### 1.4 Datatypes en datumformaat

MPXJ typeert velden via één globale naam→type-map (veldnaam bepaalt type, niet de tabel; er is exact één bekende collision: `projcost.target_qty` is CURRENCY i.p.v. DURATION).

- **Datums**: `yyyy-MM-dd HH:mm` (soms met `:ss`, soms alleen datum). MPXJ's tolerante fallback-patroon: `yyyy-M-dd[ HH[:][.]mm[[:][.]ss]]` — er bestaan dus files met `.` i.p.v. `:` in de tijd. Onparsebare datumvelden geeft MPXJ als string terug i.p.v. te crashen.
- **Duur/werk**: altijd **uren** als decimaal getal (`target_drtn_hr_cnt`, `lag_hr_cnt`, `remain_qty` etc.).
- **Booleans**: `Y`/`N`.
- **Decimalen: valuta-afhankelijk!** De `CURRTYPE`-rij van de default-valuta (naam uit ERMHDR veld 8) bepaalt `decimal_symbol` en `digit_group_symbol`. Een Europese export kan `1.234,56` bevatten. MPXJ doet daarom een tweede parse-pass over eerder gelezen currency-records zodra CURRTYPE bekend is. TS-parser: CURRTYPE vóór interpretatie van numerieke velden verwerken, of net als MPXJ een re-parse doen (CURRTYPE staat meestal als eerste tabel in het bestand, maar reken er niet op).
- **GUID's**: 22-char base64-achtige string (`M31SEvDY9ki6TH6LB6ihnQ`); MPXJ decodeert dit met bytevolgorde-swap naar een UUID. Niet-standaard waarden (kale integers) komen voor.

### 1.5 De clndr_data-blob (het beruchte ()-formaat)

Eén veld in `CALENDAR` bevat een compleet genest sub-formaat ("structured text", MPXJ `StructuredTextParser`). Grammatica:

```
record   := '(' nummer '||' [naam] '(' attrs ')' '(' record* ')' ')'
attrs    := (veldnaam '|' waarde ('|' veldnaam '|' waarde)*)?
```

Voorbeeld uit een echt bestand (junit/data/PredecessorCalendar.xer):

```
(0||CalendarData()(
  (0||DaysOfWeek()(
    (0||1()())                              ← zondag, geen kinderen = niet-werkdag
    (0||2()((0||0(s|08:00|f|12:00)())(0||1(s|13:00|f|17:00)())))   ← maandag, 2 tijdvakken
    ...t/m (0||7()())
  ))
  (0||Exceptions()(
    (0||0(d|43650)())                       ← uitzondering, d = dagen sinds epoch
    (0||1(d|43651)((0||0(s|08:00|f|12:00)())))  ← uitzondering mét werkuren
  ))
))
```

Regels/valkuilen:
- **Dagnummering 1=zondag … 7=zaterdag.**
- Werkuren per dag: kinderen met attrs `s` (start) en `f` (finish), formaat `HH:mm` (24h). MPXJ ondersteunt ook een 12-uursvariant met spatie+AM/PM. Incomplete records (ontbrekende `s` of `f`) negeren.
- **Exceptions: attribuut `d` = dagen sinds epoch 1899-12-30** (`EXCEPTION_EPOCH`). Een exception zonder kind-uurrecords = niet-werkdag; mét = afwijkende werktijden.
- Nieuwere P6-versies stoppen er extra secties in (o.a. `VIEW`); onbekende record-namen gewoon negeren.
- MPXJ parset met `raiseExceptionOnParseError=false` voor kalenders: bij structuurfouten zoveel mogelijk data teruggeven. Doe dat ook: kapotte blobs komen voor.
- Whitespace/control chars tussen records overslaan (de blob bevat vaak `\x7f\x7f` als scheiding in oudere versies; MPXJ's `skipWhitespaceAndRead` slikt ISO-control-chars).
- **Uren-per-periode**: `day_hr_cnt` etc. staan als kolommen op de CALENDAR-rij. Ontbreken ze, dan berekent MPXJ ze uit de weekuren (week/werkdagen, maand=week×4, jaar=maand×12). P6 valideert deze waarden nergens — neem ze over zoals ze zijn. Ze zijn essentieel voor het omrekenen van `*_hr_cnt`-velden naar dagen bij weergave.
- Writer-kant: P6 **weigert imports met dubbele exceptions** (commentaar in ProjectCalendarStructuredTextWriter) — dedupliceer exception-datums.

### 1.6 Enumeraties (mapping naar interne types)

| XER-waarde | Betekenis |
|---|---|
| `pred_type`: `PR_FS`/`PR_SS`/`PR_FF`/`PR_SF` | FS/SS/FF/SF. **Let op: er bestaan files met suffixen (`PR_FF1`, `PR_FF2`)** — trim tot 5 tekens. Onbekend → FS. |
| `cstr_type`: `CS_MSO`, `CS_MSOA`, `CS_MSOB`, `CS_MEO`, `CS_MEOA`, `CS_MEOB`, `CS_ALAP`, `CS_MANDSTART`, `CS_MANDFIN` | Start On / Start On or After / Start On or Before / Finish On / … / As Late As Possible / Mandatory Start / Mandatory Finish. Leeg = As Soon As Possible. `cstr_type2`/`cstr_date2` = secundaire constraint. |
| `task_type`: `TT_Task`, `TT_Rsrc`, `TT_LOE`, `TT_Mile`, `TT_FinMile`, `TT_WBS` | Task-dependent, Resource-dependent, Level of Effort, Start-/Finish-milestone, WBS summary |
| `status_code`: `TK_NotStart`, `TK_Active`, `TK_Complete` | voortgangsstatus |
| `complete_pct_type`: `CP_Phys`, `CP_Drtn`, `CP_Units` | percent-complete-type |
| `duration_type`: `DT_FixedRate` (Fixed Units/Time), `DT_FixedDrtn`, `DT_FixedQty` (Fixed Units), `DT_FixedDUR2` (Fixed Duration & Units) | |
| `clndr_type`: `CA_Base` (global), `CA_Project`, `CA_Rsrc` | |
| `sched_calendar_on_relationship_lag`: `rcal_Predecessor`, `rcal_Successor`, `rcal_ProjDefault`, `rcal_24Hour` | **welke kalender de lag interpreteert** — cruciaal voor CPM-pariteit; default Predecessor |

### 1.7 Voortgang

- `phys_complete_pct` alleen betrouwbaar bij `CP_Phys`; bij `CP_Drtn` berekent men % uit `remain_drtn_hr_cnt` vs `target_drtn_hr_cnt`; bij `CP_Units` uit units.
- Actuals: `act_start_date`/`act_end_date` gezet ⇒ status afleiden als die kolom ontbreekt.
- Statusdatum = `PROJECT.last_recalc_date`.
- Suspend/resume-datums bestaan (`suspend_date`, `resume_date`).

### 1.8 Multi-project en externe relaties

Eén XER kan meerdere `PROJECT`-rijen bevatten; `export_flag=Y` markeert het "hoofd"-project. TASKPRED kan verwijzen naar task-ids van niet-geëxporteerde projecten ⇒ **externe relaties**: als pred óf succ ontbreekt niet weggooien maar apart bijhouden (MPXJ `ExternalRelation`).

### 1.9 Schrijven (P6-compatibel)

- Volgorde die MPXJ aanhoudt en die P6 accepteert: ERMHDR, CURRTYPE, ROLES/ROLERATE, RSRC/RSRCRATE, PROJECT, CALENDAR, SCHEDOPTIONS, PROJWBS, TASK, TASKPRED, TASKRSRC, (rest), `%E`. FK-volgorde respecteren (kalenders vóór tasks etc.).
- CRLF is niet vereist; MPXJ schrijft `\n`.
- Lege waarde = leeg veld (geen `NULL`-literal nodig; hoewel P6 zelf soms `NULL`-strings schrijft in ERMHDR-velden — zie corpus).
- `proj_node_flag=Y` op de PROJWBS-wortelrij.
- Getallen met `.` als decimaalteken plus bijpassende CURRTYPE-rij schrijven, dan is er geen ambiguïteit.

### 1.10 Tien gemeenste edge-cases (uit MPXJ-code, corpus en inspectie)

1. **Multiline memo-velden**: newline midden in een `%R` ⇒ vervolgregels zonder token horen bij het vorige record.
2. **Decimaalkomma-exports** (CURRTYPE `decimal_symbol=','`): numerieke velden verkeerd parsen zonder tweede pass.
3. **`PR_FS1`-achtige relatietypes** met numerieke suffix.
4. **Kapotte/afwijkende `clndr_data`**: missende records, extra secties, lege blob ⇒ soepel parsen, terugvallen op `day_hr_cnt` en een default werkweek.
5. **Datum-varianten**: `yyyy-M-dd`, tijd met `.` i.p.v. `:`, alleen-datum, en onparsebare rommel in datumvelden (string laten staan / negeren).
6. **Dubbele task-ids over projecten heen** in multi-projectexports; MPXJ hernummert via een ClashMap.
7. **Externe relaties** (ontbrekende pred/succ-taak) — niet als corruptie behandelen.
8. **`%E` ontbreekt** of er staat rommel na `%E`; ook truncated files (corpus case 09 heeft opzettelijk kapotte structuur) ⇒ parse tot EOF, rapporteer regelnummer bij fouten.
9. **Onbekende tabellen/velden per versie**: P6 12→25 voegt continu kolommen toe; nooit op kolomposities vertrouwen, altijd `%F`-mapping.
10. **`""`-escaping** alleen voor quotes; velden kunnen verder rauwe tekens bevatten incl. control chars in CP1252.

Corpusdekking voor tests: `cpp-cpm-engine/validation/xer-corpus/cases/` (13 cases: negatieve float, out-of-sequence progress, no-logic, disconnected fragments, 1000+ activiteiten, corrupt-by-design) plus echte P6-exports in `mpxj/junit/data/*.xer`.

---

## 2. Primavera PMXML — bestaande support verbeteren

**Moeilijkheidsoordeel TS: LAAG (lezen), LAAG-MIDDEL (schrijven met P6-importpariteit). Gewoon XML; de moeite zit in semantiek en volume.**

### 2.1 Schema en versies

- Root: `<APIBusinessObjects xmlns="http://xmlns.oracle.com/Primavera/P6/V{ver}/API/BusinessObjects">`. In het wild gezien (pmxml-samples): `P6/V8.3`, `P6/V18.8.1`, `P6Professional/V18.8`, `P6Professional/V20.12`, `P6Professional/V24.12`. MPXJ codeert intern tegen V25.12 en **negeert de namespace-versie volledig** (NamespaceFilter forceert één namespace). Doe hetzelfde: namespace-agnostisch parsen op localName.
- **Oudere bestanden gebruiken rootelement `BusinessObjects`** i.p.v. `APIBusinessObjects` — accepteer beide (NamespaceFilter hernoemt).
- Schema is zeer backwards-compatibel: elementen komen erbij, verdwijnen zelden.
- XSD's zijn te vinden in de P6-installatie (`p6apibo.xsd`); praktisch is MPXJ's `primavera/schema/`-map (~500 gegenereerde klassen) de beste veldreferentie.

### 2.2 Encoding-verrassingen

- P6 schrijft soms **karakters die illegaal zijn in XML 1.0** of verkeerd gecodeerd zijn. MPXJ leest daarom níet met een strikte XML-reader direct van de stream, maar via een filter dat invalid chars vervangt (`PrimaveraInputStreamReader`) + een pre-scan van de `encoding=`-declaratie.
- Bekende specifieke bug: trailing `&#0;` na ge-embedde HTML in notitievelden (`&lt;/HTML&gt;&#0;`) — MPXJ stript die byte-sequentie vóór het parsen. In TS: DOMParser weigert `&#0;`; een pre-pass die `&#0;` (en rauwe besturingstekens < 0x20 behalve tab/lf/cr) verwijdert is nodig.
- UTF-8 mét BOM komt voor (zie samples).
- Notities zijn HTML-in-CDATA/escaped-HTML.

### 2.3 Structuur en minimum-elementen

Top-level (in `APIBusinessObjects`): globale objecten eerst (`Calendar`* (globale), `Currency`, `Resource`, `ActivityCodeType`/`ActivityCode` op EPS-niveau, `UDFType`), dan `Project`* en `BaselineProject`*.

Per `Project`: `ObjectId`, `Id` (short name), `Name`, `DataDate`, `PlannedStartDate`, `MustFinishByDate`, `ActivityDefaultCalendarObjectId`, dan kinderen: `Calendar`* (projectkalenders), `WBS`* (plat, hiërarchie via `ParentObjectId`), `Activity`*, `Relationship`*, `ResourceAssignment`*, `ActivityCodeType`/`ActivityCode`, `UDF`-waardes inline per object (`<UDF><TypeObjectId/><TextValue/>…`).

Belangrijke semantische verschillen met XER:

| Aspect | XER | PMXML |
|---|---|---|
| Duur/werk-eenheid | uren (`*_hr_cnt`) | **uren als decimaal in `…Duration`/`…Units`-elementen** (zelfde eenheid, andere veldnamen: `PlannedDuration`, `RemainingDuration`, `AtCompletionDuration`) |
| Datums | `yyyy-MM-dd HH:mm` | ISO-achtig `yyyy-MM-dd'T'HH:mm:ss` |
| Enums | codes (`TT_Task`, `CS_MEO`) | **leesbare strings** (`"Task Dependent"`, `"Finish On"`, `"Finish Start"`, `"Predecessor Activity Calendar"`) — aparte mapping-tabellen nodig (MPXJ *Helper-klassen hebben beide) |
| Relaties | TASKPRED per project | `Relationship` met `PredecessorProjectObjectId`/`SuccessorProjectObjectId` ⇒ cross-projectrelaties expliciet |
| Kalender | clndr_data-blob | nette XML (`StandardWorkWeek`/`WorkTime` met `Start`/`Finish`, `HolidayOrExceptions` met datum) — geen blob! |
| Voortgang | phys/complete pct-velden | `PercentCompleteType` + `PercentComplete`, plus aparte `PhysicalPercentComplete`, `DurationPercentComplete`, `UnitsPercentComplete` |
| GUID | 22-char base64 | `{UUID}` met accolades, uppercase |
| WBS-nummering | `wbs_short_name` per niveau | idem (`Code`), volledige paden zelf opbouwen |

### 2.4 Baselines

- `<BaselineProject>` staat naast `<Project>` binnen hetzelfde bestand; heeft (bijna) dezelfde kindstructuur als `Project` plus `OriginalProjectObjectId` (koppeling naar het echte project) en `BaselineTypeName`/`BaselineTypeObjectId`.
- Het project zelf draagt `CurrentBaselineProjectObjectId`.
- MPXJ-strategie: baseline-project apart inlezen als volwaardig project, dan per activiteit velden overnemen. Twee strategieën: `PLANNED_ATTRIBUTES` (PlannedStart/PlannedFinish e.d., dit is wat P6 toont) vs `CURRENT_ATTRIBUTES`. Als er géén baselineproject is, komt de baseline uit de planned-velden van het project zelf.
- P6-quirks: voor voltooide activiteiten laat P6 veel planned-velden leeg in PMXML (commentaar XmlProjectReader:578); P6 schrijft sommige attributen niet maar leest ze wél (XmlProjectWriter:508); currency schrijft P6 met 8 decimalen (writer rondt matching af).

### 2.5 Multi-project

Meerdere `<Project>`-elementen per bestand zijn normaal; relaties over projectgrenzen zijn met ObjectIds volledig gedefinieerd (in tegenstelling tot XER). ObjectId-ruimte is database-globaal, dus geen clash-hernummering nodig zolang je één bestand leest.

### 2.6 Schrijf-aandachtspunten

- P6 weigert import bij dubbele kalender-exceptions (zelfde commentaar als XER-writer, XmlWriter:342).
- Het schema markeert veel elementen nillable; MPXJ stript `xsi:nil`-elementen via XSLT omdat P6's eigen import daar slecht tegen kan ⇒ **laat lege elementen gewoon weg**.
- Elementvolgorde binnen een type is sequence-gebonden (XSD); P6's importer is daar gevoelig voor. Volg de volgorde van een echte P6-export.

---

## 3. MS Project MPP — alleen lezen

**Moeilijkheidsoordeel TS: HOOG. Container is makkelijk (npm `cfb` bestaat en is bewezen), de inhoud is ongedocumenteerd reverse-engineered binair. "Taken+datums+relaties" is MIDDEL-HOOG; volledige fidelity is ZEER HOOG (MPXJ heeft er ~128 klassen en 20 jaar reverse engineering in zitten).**

### 3.1 Container: CFB/OLE2

- .mpp is een Compound File Binary (dezelfde container als oud .doc/.xls). Spec: MS-CFB (openbaar, goed gedocumenteerd).
- **JS-parser bestaat**: npm **`cfb`** (SheetJS js-cfb, v1.2.2, gebruikt door honderden pakketten; puur JS, werkt in browser + Node/Tauri). `CFB.parse(buffer)` → streams per pad. Bevroren sinds ~2022 maar het CFB-formaat is ook bevroren; alternatief `ole2-reader` (zero-dep, actiever). Container is dus géén risico.
- NB: MS-PROJ (Microsofts eigen "documentatie" van het .mpp-bestandsformaat) beschrijft feitelijk alleen de container en verwijst voor de inhoud naar "internal structures not documented" — de echte kennis zit in MPXJ.

### 3.2 Versiedetectie

Stream `\x01CompObj` in de root bevat een file-format-string (MPXJ `CompObj.getFileFormat()`):
`MSProject.MPP8` (Project 98) / `MPP9` (2000–2003) / `MPP12` (2007) / `MPP14` (2010 **en alle latere versies t/m nu** — Project 2013/2016/2019/365 schrijven nog steeds MPP14). Ook `MPT`- en `GLOBAL`-varianten.

### 3.3 Interne structuur (per versie)

Root bevat `PropsN`-stream + een projectdirectory met versie-afhankelijke naam (let op: **drie spaties** prefix):

| Versie | Projectdir | Viewdir | Props-variant |
|---|---|---|---|
| MPP9 | `   19` | `   29` | Props9 |
| MPP12 | `   112` | `   212` | Props12 |
| MPP14 | `   114` | `   214` | Props14 |

In de projectdir per entiteit een subdirectory: `TBkndTask`, `TBkndRsrc`, `TBkndCal`, `TBkndAssn`, `TBkndOutlCode`, plus `Props`. Per entiteitsdir vier streams:

- **`FixedData` + `FixedMeta`**: records met vaste lengte; FixedMeta geeft itemcount + offsets. MPXJ's FixedData-commentaar: "offsets that are out of sequence, and items that may overlap" — defensief lezen.
- **`Var2Data` + `VarMeta`**: variabele velden als (uniqueID, veldkey) → offset in datapool. VarMeta9 gebruikt 16-bit structuren, VarMeta12 32-bit.
- **`Props`**: key/value-blok (int size, int key, data, 2-byte-aligned). Bevat o.a. de **FieldMap**: welke veldtypes op welke fixed-offset/var-key zitten. MPP12/14 hebben per bestand een dynamische field map (FieldMap12/14 lezen die uit Props); MPP9 is grotendeels hardcoded.
- Datums: **epoch 1983-12-31**; datums als dagen sinds epoch (16-bit), tijden als tienden van minuten sinds middernacht, timestamps als combinatie (dagen + tijd×6 s).
- "Encryptie" bij wachtwoordbeveiliging is een 1-byte XOR (`0xFF - code`), triviaal (`DocumentInputStreamFactory`). Echte leesblokkade alleen bij write-reserved wachtwoord? Nee — MPXJ kan met XOR alles lezen; het wachtwoord-hash-check is optioneel te omzeilen.

### 3.4 Realistisch TS-plan

1. **Haalbaar en zinnig**: MPP9/12/14 lezen voor taken (naam, ID/uniqueID, outline, datums, duur, milestone-flag), relaties, kalenders, resources, assignments, voortgang. Dat is porteren van FixedData/VarMeta/Var2Data/Props + FieldMap-logica + de task/resource/assignment-factories. Schat: de kern is ~10–15k regels Java om te porten; de meeste GanttBar*/View*/filter-klassen (± helft van de map) kun je overslaan.
2. **MPP8 overslaan** (Project 98; ander formaat, nauwelijks nog in omloop).
3. **Niet doen in TS**: volledige fidelity (custom fields met lookup-tables, grafische indicatoren, views/tabellen/filters, subprojects, timephased data). Timephased assignment-data is het zwaarste subonderdeel.
4. **Pragmatisch alternatief eerst aanbieden**: gebruikers laten exporteren naar **MSPDI (.xml)** — dat is een schoon, gedocumenteerd XML-formaat dat elke Project-versie kan schrijven, en in TS in een fractie van de tijd te ondersteunen. MPP-native lezen dan als fase 2 voor "drop een .mpp en het werkt".

Deelniveau-inschatting: alleen taken/datums/relaties uit MPP14: 3–6 weken serieus werk mét MPXJ als referentie en junit/data als testcorpus (200+ .mpp-fixtures aanwezig). Volledige pariteit met MPXJ: maanden, niet aan beginnen.

### 3.5 Edge-cases (uit MPXJ-commentaar)

1. Deleted tasks staan nog in FixedData (flag in FixedMeta); soms twee keer; uniqueID dan alleen als 16-bit short.
2. Null/ghost tasks die alle checks passeren (aparte "catch invalid tasks"-pass).
3. FixedMeta-blokgroottes variëren per schrijvende MSP-versie (bv. assignments: 142 bytes uit MSP2007, 110 uit MSP2010 in dezelfde MPP12-indeling).
4. Overlappende/uit-volgorde offsets in FixedData.
5. "MPP14 files seem to exhibit some occasional weirdness" in blokstructuren (MPP12Reader:1303) — defensief valideren, records met onmogelijke lengtes overslaan.
6. Elapsed-duration-eenheden verkeerd gecodeerd (MPPUtility: reset naar uren als onbekend).
7. Wachtwoord-"encryptie" (XOR) detecteren via Props `PASSWORD_FLAG`.
8. Task-ID's zijn contiguous in MSP; gaten duiden op corrupte/verwijderde entries.
9. Custom-field-data verschilt structureel per versie (CustomFieldValueReader9/12/14).
10. Karakterdata is UTF-16LE in var-data; korte strings soms single-byte codepage.

---

## 4. Asta Powerproject .pp — alleen lezen

**Moeilijkheidsoordeel TS: MIDDEL. Twee routes; de SQLite-route (alle moderne bestanden) is goed haalbaar met sql.js/wa-sqlite; de tekstroute is een quirky maar behapbare parser. De semantische mapping (bars/tasks) is het echte werk.**

### 4.1 Formaatdetectie

`AstaFileReader` kijkt naar de magic: begint het bestand met `"SQLite format"` (eigenlijk `SQLite format 3\0`) → SQLite-route; anders tekstroute. UniversalProjectReader herkent tekst-.pp aan fingerprint `00 00 30 30 30 30 30 30` ("\0\0000000").

### 4.2 Tekstformaat (oudere versies, EasyProject/PowerProject ≤ ~v13)

- **UTF-8**, komma-gescheiden tokens, quoted strings als `<"..">` (kunnen komma's bevatten en over meerdere tokens doorlopen — MPXJ plakt tokens met prefix `<"` weer aan elkaar).
- Bestand begint met een versietoken (eerste byte NUL): `\0\0<versie> ...`, bv. `13004`. Ondersteunde versies en mapping (FILE_VERSION_MAP): **8020** (EasyProject 2), **9006** (EP3), **10008** (EP4), **11004** (EP5/PowerProject 11), **12002**, **12005** (PP12), **13001**, **13004** (PP13). Onbekende versie = hard falen (kolomdefinities zijn per versie).
- Rijen beginnen met een **RowHeader**: `#<id>:<seq>:<type>[:<subtype>]` — `type` selecteert de tabel. Tabelnummer→naam (FileFormat13004): 2=PROJECT_SUMMARY, 7=BAR, 11=CALENDAR, 12=EXCEPTIONN, 14=EXCEPTION_ASSIGNMENT, 15=TIME_ENTRY, 17=WORK_PATTERN, 18=TASK_COMPLETED_SECTION, 21=TASK, 22=MILESTONE, 23=EXPANDED_TASK, 24=HAMMOCK_TASK, 25=LINK, 61=CONSUMABLE_RESOURCE, 62=PERMANENT_RESOURCE, 63=PERM_RESOURCE_SKILL, 67=PERMANENT_SCHEDUL_ALLOCATION, 190=WBS_ENTRY.
- Kolomdefinities: per FileFormat-klasse een geordende namenlijst (kolommen puur positioneel). Voor TS: die arrays 1-op-1 overnemen uit FileFormat8020..13004.
- **Datums**: twee encodings, per formaatversie (`epochDateFormat()`-flag). Epoch-variant: `"<dagen> <seconden>"` waar dagen een Juliaanse dagteller is (ASTA_EPOCH = 2415021 = 1900-01-01) en `-1 -1` = null; korte variant zonder spatie = alleen tijd `HHmmss`. Niet-epoch-variant: `yyyyMMdd HHmmss` (ook `"0"` = null).

### 4.3 SQLite-formaat (PowerProject v13+; alle moderne .pp)

- Gewone SQLite 3-database. Inspectie van echte bestanden (crawl-pp): V15-templates zijn **UTF-16LE**-databases, V16/V17 UTF-8; `user_version` bevat de PP-versie (bv. 150113, 160102, 170101). SQLite-drivers abstraheren de tekstencoding, dus dit is alleen relevant als je zelf pages zou parsen (niet doen).
- Tabellen die AstaSqliteReader leest (de facto de minimale set): `DODSCHEM` (schemaversie), `PROJECT_SUMMARY`, `PROGRESS_PERIOD`, `USERR` (o.a. current_baseline_id), `EXCEPTIONN`, `WORK_PATTERN` (+ kolommen `work_patterns`, `exceptions`, `shifts` als geneste data op CALENDAR/WORK_PATTERN), `CALENDAR`, `PERMANENT_RESOURCE`, `CONSUMABLE_RESOURCE`, `BAR`, `EXPANDED_TASK`, `TASK`, `MILESTONE`, `HAMMOCK_TASK`, `TASK_COMPLETED_SECTION`, `LINK`, `PERMANENT_SCHEDUL_ALLOCATION`, `PERM_RESOURCE_SKILL`, `UDF_DEFN`, `UDF_DATA`, `BASELINE_SUMMARY`. Geverifieerd: al deze tabellen bestaan in de V17-template (127 tabellen totaal; de rest is view/opmaak).
- Vrijwel alle queries filteren op `projid` — één .pp kan meerdere projecten (incl. embedded baselines als aparte projid's) bevatten. Baseline-koppeling: `USERR.current_baseline_id` → `BASELINE_SUMMARY.baseline_project_id`.
- **Pure-JS SQLite in browser + Tauri: ja.** Twee opties:
  - **sql.js** (SQLite→WASM, in-memory): perfect voor ons read-only scenario — laad de bytes van het .pp-bestand, `new SQL.Database(bytes)`, query, klaar. Werkt identiek in browser en Tauri-webview. Bundelgrootte ~1–1,5 MB WASM (lazy-loaden bij eerste .pp-import).
  - **wa-sqlite**: flexibeler (VFS, OPFS) maar dat hebben we niet nodig voor lezen van een geheugenbuffer.
  - Aanrader: sql.js, dynamic import in de fileAccess-laag.

### 4.4 Semantische mapping (het echte werk, beide routes identiek)

Asta's model wijkt af: een **BAR** is de visuele regel; **TASK**s en **MILESTONE**s hangen onder bars; **EXPANDED_TASK** vormt de samenvattings-hiërarchie; **HAMMOCK_TASK** = hangmat (MPXJ exporteert die niet). MPXJ merge't task+milestone-lijsten, mapt bar-IDs, en slaat bars met precies één kindtaak plat over. Relaties: `LINK` met `LINK_KIND` (relatietype), `START_LAG_TIME`/`END_LAG_TIME` + eenheidvelden. Kalenders: CALENDAR → WORK_PATTERN (weekpatronen) + EXCEPTIONN (uitzonderingstypes) + assignments; default-instellingen staan als CSV-string in één kolom. Voortgang: TASK_COMPLETED_SECTION + percentages; "deleted items" komen in tabellen voor en moeten gefilterd (MPXJ: "These appear to be deleted items"). Early/late-datums kunnen ontbreken en moeten dan berekend.

Aanrader: alleen de SQLite-route bouwen voor v1 (dekt PP13+ en alles wat klanten vandaag aanleveren), tekstroute alleen als er vraag naar legacy-EasyProject komt.

---

## 5. iCalendar .ics — alleen schrijven

**Moeilijkheidsoordeel TS: TRIVIAAL-LAAG. Paar honderd regels, geen dependencies nodig. Grootste risico is folding/escaping-details.**

RFC 5545-minimum voor taak/milestone-export als VEVENT:

### 5.1 Skelet

```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//OpenAEC//Open Planner Studio X.Y.Z//NL
CALSCALE:GREGORIAN
METHOD:PUBLISH          ← optioneel; weglaten is prima
BEGIN:VEVENT
UID:...
DTSTAMP:20260814T090000Z
DTSTART:...
DTEND:... (of weglaten bij milestone)
SUMMARY:...
END:VEVENT
END:VCALENDAR
```

Verplicht per VEVENT: `UID` + `DTSTAMP` (altijd UTC met `Z`). `DTSTART` verplicht als de kalender geen METHOD heeft. `DTEND` is exclusief.

### 5.2 Kernbeslissingen

- **UTC i.p.v. VTIMEZONE.** Schrijf datetimes als UTC (`20260814T120000Z`); dan is geen VTIMEZONE-component nodig en importeert elke client correct. VTIMEZONE zelf genereren vereist een tz-database — vermijden. Alternatief dat óók zonder VTIMEZONE mag: floating time (zonder Z), maar UTC is voorspelbaarder over clients heen.
- **All-day vs datetime**: taken zonder tijdcomponent exporteren als `DTSTART;VALUE=DATE:20260814` met `DTEND;VALUE=DATE:` = dag ná de laatste dag (exclusief!). Een taak van één dag: DTEND = DTSTART+1d. Mixen van DATE en DATE-TIME binnen één event is verboden.
- **Milestones**: VEVENT met alleen `DTSTART` (punt-event) of DATE-waarde zonder DTEND; optioneel `DURATION:PT0S` weglaten (DTEND weglaten volstaat).
- **UID-stabiliteit**: UID moet bij her-export van hetzelfde project gelijk blijven, anders krijgen gebruikers duplicaten bij re-import in hun agenda. Bouw hem deterministisch: bv. `opsp-{projectGUID}-{taskUniqueID}@openaec.org`. Geen random UUID per export. `SEQUENCE:` ophogen bij wijziging is netjes maar optioneel.
- **Folding**: regels max **75 octetten** (bytes, niet chars!) inclusief naam; vervolg-regel begint met één spatie (of tab). Vouw op UTF-8-bytegrenzen zonder een multi-bytekarakter te splitsen (RFC raadt aan op karaktergrens te vouwen). Regeleinde is **CRLF** (`\r\n`), verplicht.
- **Escaping in TEXT-waarden** (SUMMARY, DESCRIPTION, LOCATION, CATEGORIES-onderdelen): `\` → `\\`, `;` → `\;`, `,` → `\,`, newline → `\n` (letterlijk backslash-n). Dubbele quote hoeft niet geëscaped. Geen andere escapes gebruiken.
- Nuttige optionele velden: `DESCRIPTION` (WBS-pad, voortgang), `CATEGORIES` (WBS of activity code), `STATUS:CONFIRMED`, `PERCENT-COMPLETE` bestaat alleen op VTODO — voortgang dus in DESCRIPTION stoppen of taken als VTODO exporteren (niet doen: agenda-apps tonen VTODO's slecht; blijf bij VEVENT).
- PRODID verplicht op kalender-niveau; VERSION altijd `2.0`.

### 5.3 Validatie

Testen tegen: import in Google Calendar, Apple Calendar en Outlook (drie verschillende parsers, drie verschillende gevoeligheden — Outlook is het strengst op CRLF en folding). `icalendar.org/validator` als snelle check in de feedbackloop.

---

## 6. Samenvattend moeilijkheidsoordeel

| Formaat | Richting | Oordeel | Kern van het werk |
|---|---|---|---|
| XER | lezen+schrijven | **Laag-middel** | Tab-parser is triviaal; clndr_data-parser (±150 regels), CURRTYPE-decimalenpass, enum-mappings, ClashMap voor multi-project. Writer: kolomsets + volgorde uit PrimaveraXERFileWriter overnemen. Beste eerst te bouwen. |
| PMXML | lezen+schrijven (verbeteren) | **Laag-middel** | Namespace-agnostisch DOM-parsen, invalid-char-pre-pass, enum-stringmappings, baseline-projecten, elementvolgorde bij schrijven. |
| MPP | alleen lezen | **Hoog** (kern MPP14 taken/relaties: middel-hoog; volledige fidelity: niet doen) | Container via npm `cfb` (opgelost). Porteren van Props/FixedData/VarMeta/Var2Data + FieldMap12/14 + defensieve deleted-task-logica. MSPDI als goedkope tussenstap aanbevolen. |
| Asta PP | alleen lezen | **Middel** | SQLite-route met sql.js (dynamisch geladen WASM) + ~20 tabellen + bar/task/milestone-mapping. Tekstroute uitstellen. |
| ICS | alleen schrijven | **Triviaal-laag** | 75-octet folding, CRLF, escaping, stabiele UIDs, all-day-exclusieve DTEND. |

Aanbevolen bouwvolgorde: **ICS → XER → PMXML → Asta-SQLite → MPP(14)**, met MSPDI-import als quick win vóór MPP-native.

### Herbruikbare testdata

- XER: `mpxj/junit/data/*.xer`, `cpp-cpm-engine/validation/xer-corpus/cases/*` (incl. corrupt-by-design), `pmxml-samples/testXer.xer`
- PMXML: `pmxml-samples/*.xml` (V8.3 t/m V24.12, incl. baselines en multi-project met externe relaties)
- MPP: `mpxj/junit/data/*.mpp` (honderden, per versie gelabeld)
- PP: `crawl-pp/*.pp` (SQLite V15/V16/V17), workshops-zips

# Regels in de toolbeschrijvingen (#818)

Per tool staan hier de regels uit de oude beschrijvingen die een agent moet kennen. Bij elke regel staat
waar hij in de nieuwe tekst staat, of waarom hij weg mag. "tool" = de toolbeschrijving, "param `x`" = de
beschrijving van parameter `x`. Een regel die het schema al afdwingt (enum, `required`, `pattern`,
`minimum`/`maximum`, `additionalProperties: false`) staat niet nog eens in tekst.

Redenen om iets weg te laten:

- **schema** — het schema zegt het al (naam, type, enum, verplicht veld, grens).
- **antwoord** — het antwoord van de tool meldt het zelf; de agent hoeft het vooraf niet te weten.
- **detail** — uitleg of achtergrond zonder invloed op de aanroep, de planning of de data.
- **dubbel** — stond twee keer (tool en param, of in twee tools); één plek blijft.

`planner_get_planning_guide` is niet aangeraakt: een andere branch (`docs/818-gids-zuinig`) herschrijft hem.

## Gedeelde stukken

| regel | nieuwe plek |
|---|---|
| `tempId` begint met `tmp-`/`tmp_` (gereserveerde batchsyntax) | schema `pattern` bij add_tasks; tool planner_batch; param `tempId` bij manage_resources (daar zonder pattern, code weigert) |
| Taakvelden: onbekende sleutel wordt geweigerd | schema `additionalProperties: false`; tool add_tasks ("fails the whole call"), tool update_tasks ("refused per item") |
| `status`, `parentId`, `resourceIds`, `time` zijn geen schrijfvelden; route via `progress`, move_task, manage_assignments, `duration` | `TASK_FIELDS_DOC` in tool add_tasks en update_tasks |
| `duration` in de maat van `durationUnit`; zonder eenheid dagen; fractie blijft exact | param `duration` (test `cases-taskfields`: "fraction") |
| FIXED_WORK-taak staat altijd in uren (dagen × uren per dag) | param `duration` |
| Mijlpaal: duur 0; verzameltaak: duur afgeleid, weglaten | param `duration` |
| Dag-/uurmaat per rekenprofiel (OPS: één werkdag = één dag; P6/MSP: dagen × werktijd) | weg: detail; de agent geeft dagen zoals de gebruiker ze noemt, het profiel rekent |
| `durationUnit` samen met `duration` geven | param `durationUnit` |
| Uurmaat vraagt een taakkalender met werktijd | weg: elke kalender met werktijd voldoet; zonder werktijd faalt de berekening al (update_calendar) |
| `isMilestone: true` zet duur 0 (niet op verzameltaak of taak met toewijzingen); `false` laat 0 staan tot je `duration` stuurt | param `isMilestone` |
| `taskType` is de werkcategorie, niet het taaktype (`workRule`) | param `taskType` |
| `customTaskType` zet USERDEFINED; bestaand id houdt zijn naam | param `customTaskType` |
| Constraint: `null` wist; `date` nodig behalve ASAP/ALAP; `hard` alleen MSO/MFO; null/ASAP/ALAP wissen ook de secundaire; ongeldig paar geweigerd | param `constraint` |
| `deadline` begrenst alleen de late finish | param `deadline` |
| `calendarId`: bibliotheekkalender; `null` = projectkalender | param `calendarId` |
| `workRule`: vier waarden met betekenis en MSP/P6-namen (let op: "Fixed Units" betekent in MSP en P6 iets anders); wisselen verandert geen getal; `null` = projectstandaard; alleen gewone bladtaken | param `workRule` |
| Fase-overgang: toewijzingen gaan naar de eerste nieuwe subtaak, mijlpaal verliest vlag, `phaseTransitions`; anders faalt de hele aanroep | `PHASE_TRANSITION_DOC` in tool add_tasks en move_task |
| Lag: getal of "+2d", fractie toegestaan, negatief = lead, "+50%" van de voorganger, andere vorm geweigerd | param `lag` (test `cases-update-dependencies`: "fraction") |
| Een lag zetten wist de andere lagvormen | param `lag` |
| Lag-dagen per rekenprofiel | weg: detail (zie `duration`) |
| `LAG_DOC` in de toolbeschrijvingen | weg: dubbel met param `lag`; de constante is verwijderd |
| Relatietype: lange of korte vorm (FS/FF/SS/SF) | schema `enum` noemt beide; beschrijving van `SEQ_TYPE_SCHEMA` weg |
| Verse planning bij leestools: eerst herberekenen (`scheduleRecalculated`); niet bij `datesAsRecorded`, tijdens een bewerking van de gebruiker (`scheduleStale`), na een mislukte berekening (`scheduleError`) | `FRESH_NOTE` (kort) in de zeven leestools met berekende waarden |
| Optionele paginering: `limit` 1–1000, standaard 50, `offset`; zonder beide de hele lijst | `OPTIONAL_PAGE_NOTE` in tool; schemavelden zonder beschrijving (dubbel) |

## planner_add_tasks

| regel | nieuwe plek |
|---|---|
| Geneste WBS in één aanroep; items in elke volgorde | tool |
| `parentId` = bestaand id of tempId uit dezelfde aanroep; weggelaten = wortel | tool + param `parentId` |
| `tempId` uniek in de aanroep, sleutel in `created`; latere batchstappen mogen hem gebruiken | param `tempId` |
| `position` wordt geklemd | param `position` |
| Zonder `duration`: projectstandaard (5 werkdagen; 5 uur bij uurmaat in het OPS-profiel) | tool, ingekort tot "normally 5 working days": de agent hoort zelf een duur te geven |
| Onbekende sleutel of ongeldig item laat de hele aanroep falen (alles-of-niets) | tool |
| Antwoord: tempId → id, datums, projecteinde | tool (één zin) |

## planner_update_tasks

| regel | nieuwe plek |
|---|---|
| `fields` zonder voortgang; `progress` alleen `completion`, `actualStart`, `actualFinish` | tool + schema (`additionalProperties: false`) |
| Onbekende sleutel en lege `progress` per item geweigerd; geweigerd `fields`-blok verandert niets | tool |
| Voortgang vraagt een statusdatum; die zet de tool nooit zelf | tool |
| Actuals na de statusdatum geweigerd; `completion` 0–100 | tool + schema `minimum`/`maximum` + param `actualStart`/`actualFinish` |
| `completion` > 0 leidt actualStart af, behalve als de geplande start na de statusdatum ligt: dan `actualStart` meegeven | tool |
| Verzameltaak: voortgang afgeleid, `progress` geweigerd | tool |
| Duurwijziging op lopende taak houdt het gedane werk (voorbeeld 10 d / 40 % → 12 d), `progressAdjusted`; korter dan gedaan werk geweigerd | tool |
| Toewijzingen volgen de duur per `workRule`; overschreven restwerk in `remainingWorkRecomputed`, aan de gebruiker melden | tool |
| What-if-overschrijding via duur of SNET; geregistreerde voortgang via `progress` | tool |
| Eén id kan in `updated` én in de weigeringen staan | tool |
| `actualFinish` ≥ `actualStart`; `null` wist | param `actualFinish` |
| Lijst met toegestane veldnamen in tekst | weg: schema (properties + `additionalProperties: false`) |

## planner_delete_tasks

| regel | nieuwe plek |
|---|---|
| Verwijdert de hele subboom met relaties en toewijzingen | tool |
| Controleer `deletedTaskIds`, `cascadedTaskIds`, aantallen | tool |
| Onbekend id per item geweigerd | tool |
| Id dat al door een cascade verdween telt als succes; `deleted` = gevraagde ids | weg: antwoord |

## planner_move_task

| regel | nieuwe plek |
|---|---|
| `newParentId: null` = wortel; `position` geklemd | tool |
| Onder zichzelf of een afstammeling = fout | tool |
| Kring via verzameltaakrelaties = harde fout (CYCLE), hele aanroep terug | tool |
| Fase-overgang | `PHASE_TRANSITION_DOC` |

## planner_add_dependencies

| regel | nieuwe plek |
|---|---|
| Verzameltaak als eindpunt TOEGESTAAN (geldt voor de bladtaken) | tool (test `cases-sync2-integration`) |
| Onbekende ids, dubbele relatie, relatie naar eigen voorouder per item geweigerd | tool |
| Kring = harde fout, hele aanroep terug | tool |
| Wijzigen via update_dependencies (houdt id, één undo-stap), niet verwijderen + toevoegen | tool |
| Type- en lagvormen | schema enum + param `lag` |

## planner_update_dependencies

| regel | nieuwe plek |
|---|---|
| Op `seqId` (deel na `#` in de leestools, voorbeeld) | tool |
| Houdt id, één undo-stap; gebruik in plaats van remove + add | tool |
| Alleen opgegeven velden veranderen | tool |
| Verzameltaak als nieuw eindpunt TOEGESTAAN | tool (test `cases-sync2-integration`) |
| Per item geweigerd: onbekend seqId/veld/taak, relatie met zichzelf, voorouderrelatie, duplicaat, item zonder wijziging | tool |
| Dubbele seqIds geweigerd | param `updates` ("One item per seqId") |
| Kring = harde fout | tool |
| Antwoord: `changes` voor/na | tool |

## planner_remove_dependencies

| regel | nieuwe plek |
|---|---|
| Op sequence-id uit de leestools; onbekend id per item geweigerd | tool |
| Wijzigen via update_dependencies | tool |

## planner_undo / planner_redo

| regel | nieuwe plek |
|---|---|
| Alleen het ACTIEVE document | tool |
| Controleer `undone`/`redone`: `ok` zonder effect is mogelijk | tool |
| Geschiedenis gedeeld met de gebruiker, ook rasterinstellingen | tool (undo) |
| What-if via duplicate_document, niet undo | tool (undo) |
| `undoDepth`/`redoDepth` gelden voor het actieve document; andere documenten tellen niet | weg: antwoord |
| Een nieuwe wijziging wist alleen botsende redo-scopes | weg: detail |

## planner_set_task_splits

| regel | nieuwe plek |
|---|---|
| `interruptions` vervangt de lijst; `[]` wist | tool |
| Posities op de WERK-as (voorbeeld) | tool |
| Uurtaak: `afterWorkHours`/`pauseHours`; niet mengen | tool |
| Alleen hele eenheden | tool |
| Werk blijft gelijk, taak wordt langer | tool |
| Niet splitsbaar: mijlpaal, verzameltaak, hamer, ELAPSEDTIME, handmatig, korter dan twee eenheden, niet-bewerkbare geïmporteerde splits | tool |
| Niet in al gedaan werk | tool |
| Alles-of-niets | tool |
| Leesvorm in get_task | tool get_task |

## planner_update_calendar

| regel | nieuwe plek |
|---|---|
| Eén aanroep = één undo-stap | tool |
| Bestaand id, of `create: true` met eigen label (`id` + `requestedId` terug); onbekend id zonder `create` geweigerd | tool |
| Kalender-id's per document; nooit een id uit een ander document | tool |
| `generate` VERVANGT de lijst | tool |
| `rawHolidays` VOEGT TOE (samengevoegd op datum) | tool + param `holidaysMode` (test `cases-stille-noops`: "add", "replace") |
| `holidaysMode: "replace"`: lijst wordt exact `rawHolidays`, enige manier om te verwijderen; `[]` wist alles | tool + param `holidaysMode` |
| Lege `rawHolidays` in merge-modus geweigerd | param `rawHolidays` |
| `holidays` vervangt exact; niet samen met `rawHolidays`/`holidaysMode`/`generate` | tool + param `holidays` |
| Losse dagen maken de kalender letterlijk (`becameLiteral`), niet meer te regenereren | tool |
| `create` zonder feestdagvelden erft de feestdagen van de app-standaard (`holidaysFrom`); geen feestdagen: `holidays: []` | tool (de route `generate: {country: "none"}` staat bij param `country`) |
| Overzetten: object uit get_calendars letterlijk terug met `create: true`; afgeleide velden genegeerd (`ignoredFields`) | tool |
| Dagkalender met pauze: `hoursPerDay` afgeleid, afwijkende waarde geweigerd; wijzig begin/einde of pauze | tool |
| Zonder pauzevelden is `hoursPerDay` vrij te zetten | weg: volgt uit "with a break" |
| Pauze buiten de werkdag of over de hele dag geweigerd | param `simpleBreakDurationMinutes` |
| `generate` óf `generation`, nooit beide; `generation` schrijft alleen herkomst | param `generation` |
| `workTime` maakt een uurkalender, `null` terug naar dag | tool + param `workTime` |
| Taakduren worden nooit omgerekend; datums en projecteinde kunnen schuiven | tool. De oude param-tekst "this redefines the duration of every task" sprak de toolbeschrijving tegen en was verouderd; die zin is weg |
| `modeChangedFrom`, `taskDurationsPreserved` | weg: antwoord |
| Bij `workTime` volgen `workDays` altijd en `hoursPerDay` tenzij bewust afwijkend (P6 day_hr_cnt); opgegeven `hoursPerDay` wint | tool |
| Opgegeven `workDays` mag de banden niet tegenspreken | weg: de tool weigert met reden; zeldzaam |
| Alleen `workDays` op uurkalender: nieuwe dag kopieert banden van de eerste dag met banden (zo, ma … za); vervallen dag verliest banden | param `workDays` |
| Terugval als geen dag banden heeft (eigen werkdag, dan 07–12 + 13–16) | weg: randgeval; zo'n kalender heeft geen werktijd en faalt al; wie banden wil, geeft `workTime` |
| Ongebruikte kalenders overleven IFC opslaan + laden; geen taak nodig om hem te bewaren | tool (test `cases-uurkalender`) |
| Uurbanden per weekdag overleven IFC | weg: geruststelling zonder invloed op de aanroep |
| Taken passen niet meer: waarschuwing met `cappedTaskIds` | tool |
| Geen werktijd over: berekening faalt, hele aanroep terug | tool |
| `generate`-bereik in jaren (bijwerken: startjaar − 1 t/m jaar na het latere projecteinde, zonder einde startjaar + 3; aanmaken: − 1 … + 3) | param `generate` |
| Landcode exact uit de lijst (hoofdletters); `none` wist gegenereerde dagen en herkomst | schema enum + param `country` (test `cases-stille-noops`: "none") |
| `bouwvak` alleen NL, standaard `geen` | param `bouwvak` |
| `byWeekday`: alle zeven sleutels verplicht; banden in minuten, oplopend, niet overlappend; `[]` = vrije dag; `end` > `start`, telt door na middernacht | param `byWeekday` (één keer; de dagschema's dragen geen beschrijving meer, ze stonden acht keer in het schema) |
| `workStartHour`/`workEndHour` in UREN, pauzevelden in MINUTEN | params |
| `workingExceptions`: complete lijst, vervangt, `[]` wist; `bands` optioneel | param `workingExceptions` |
| Datums inclusief | param `endDate` in feestdag- en uitzonderingsitems |
| `shift: null` wist | schema (nullable enum) |
| Afgeleide leesvelden (`isProjectDefault`, `usedBy*`, `libraryOrigin`) genegeerd | tool ("derived read fields are ignored"); per veld weg (dubbel) |

## planner_manage_assignments

| regel | nieuwe plek |
|---|---|
| Eén aanroep = één undo-stap | tool |
| Velden per actie | tool |
| Ids en velden gelijk aan de leestools | tool |
| Alleen op bladtaken, geen mijlpaal/verzameltaak | tool |
| Zelfde resource één keer per taak, ook binnen de aanroep | tool |
| `workRule` bepaalt wat meebeweegt: FIXED_WORK/FIXED_RATE verandert de DUUR; standaardregel niet, `remainingWorkMinutes` zet daar de eenheden | tool |
| Lees de taak opnieuw voor de nieuwe duur | tool |
| `unitsPerDay` per WERKDAG, 1 = 100 % | param `unitsPerDay` |
| `remainingWorkMinutes` in werkminuten; alleen gewone bladtaak op werktijd; materiaal telt niet voor de duur | param `remainingWorkMinutes` |
| `curve` weggelaten = UNIFORM | param `curve` |
| Geweigerde items in de lijst, geldige blijven | tool |

## planner_manage_resources

| regel | nieuwe plek |
|---|---|
| Tegenhanger van manage_assignments | tool (test `cases-resource-crud`) |
| Velden per actie | tool |
| Veldnamen gelijk aan list_resources | tool |
| `null` wist een optioneel veld; weggelaten sleutel blijft | tool |
| `description` leegmaken met `""` (niet `null`) | param `description` |
| VERWIJDEREN wist alle toewijzingen en het ploeglidmaatschap; met toewijzingen geweigerd tot `cascade: true` | tool + param `cascade` |
| `tempId` (`tmp-`/`tmp_`) bij `create`, echt id in `created`; latere batchstappen | tool + param `tempId` |
| Bibliotheekresource: vijf velden vast; bied de gebruiker twee routes (bibliotheek wijzigen of ontkoppelen) | tool |
| Wat het project bepaalt blijft schrijfbaar (`maxUnits`, `calendarId`, `parentId`, `availabilitySteps`) | weg: volgt uit de lijst vaste velden |
| `maxUnits` per WERKDAG, standaard 1; `type` standaard LABOR; `unitOfMeasure` alleen MATERIAL; `parentId` = CREW-resource | params |
| `availabilitySteps`: vanaf `from` geldt `maxUnits`, 0 = niet beschikbaar; `[]`/`null` wist | param `availabilitySteps` |

## planner_level_resources / planner_clear_leveling

| regel | nieuwe plek |
|---|---|
| `constrainToFloat: true` (standaard) binnen de speling, einde vast; `false` mag het einde verschuiven (`projectEndDelta`, `warnings`) | tool |
| Onoplosbare pieken in `unresolved` met redenen | tool |
| Materiaal nooit genivelleerd | tool |
| Eerst `dryRun: true`; geen undo-stap; onberekende planning wordt toch eerst berekend (`recomputed`) | tool + param `dryRun` |
| Nivelleren reset zichzelf, herhalen stapelt niet | tool |
| clear_leveling vóór level_resources is zinloos | tool clear_leveling (test `cases-mutate-cal-res`) |

## planner_update_project / planner_move_project / planner_save_baseline

| regel | nieuwe plek |
|---|---|
| Onbekend veld geweigerd met de lijst | tool |
| `startDate` = anker voor NIEUWE taken, schuift de planning niet; zet hem vóór add_tasks | tool |
| Uitzondering: een latere `startDate` klemt wortelankers zonder voorganger/constraint naar voren (`anchorsClamped`) | tool (test `cases-project-start-anchor`) |
| Hele planning verschuiven = move_project | tool (test `cases-mutate-cal-res`) |
| `statusDate` = DATA DATE; niet-gestart werk (completion 0) schuift naar die datum, ook zonder voortgang | tool + param `statusDate` (test `cases-statusdatum`) |
| Zet de statusdatum alleen voor voortgang; `statusDateEffect` | tool |
| Statusdatum wissen maakt actuals inert | tool |
| `statusDate` met tijd tot de minuut bij uurplanning (`YYYY-MM-DDTHH:mm`) | param `statusDate` (test `cases-statusdatum`) |
| `endDate` is metadata, stuurt wel het bereik van `generate` | tool + param `endDate` |
| `defaultWorkRule`: `null` = FIXED_DURATION_RATE; naar FIXED_WORK zet taken zonder eigen regel om naar uren (`hourMeasureTaskIds`); terug houdt uren | param `defaultWorkRule` |
| move_project: hele planning; kalenders en externe ankers schuiven niet, einde kan anders schuiven; baselines alleen met `shiftBaselines` | tool |
| save_baseline: wordt actief; verouderde planning eerst herberekend; niet in een batch | tool |

## Basislijnen (list / activate / rename / delete)

| regel | nieuwe plek |
|---|---|
| Ids komen uit list_baselines | tool activate/rename/delete |
| `null` = geen actieve baseline; compare/analyze weigeren dan | tool activate |
| Al actief / zelfde naam: `changed: false` | tool activate; rename: weg (antwoord) |
| Naam niet leeg; dubbele naam geeft `warning` | tool rename |
| Verwijderen niet te herbouwen (gebruiker kan undo); actieve weg ⇒ laatste overgebleven of geen | tool delete |

## Documenten

| regel | nieuwe plek |
|---|---|
| list_documents: `title` is een weergavetitel; `notCalculated` vs `calculationError`; actief document eerst herberekend, andere rijen `scheduleStale`/`datesAsRecorded` | tool |
| Precieze titelregels ("New schedule (2)") | weg: detail; de tool zegt dat de titel geen bewijs van een projectnaam is |
| new_document: zonder wizard, standaardkalender, drift-anker verhuist; kopie via duplicate | tool |
| duplicate_document: what-if zonder undo; los (geen bestandspad, eigen undo, `isDirty`); naamregel; anker verhuist, eerst terugschakelen; varianten niet sluiten | tool |
| switch_document: lost DOC_DRIFT op; ids per document | tool |
| Schakelen naar het al actieve document mag | weg: detail zonder risico |

## Bestanden

| regel | nieuwe plek |
|---|---|
| export_ifc: ACTIEF document, projectschema (`ifcSchema`), alleen in de thuismap ("home folder" blijft: de headless server vertaalt die term) | tool |
| Bestaand bestand alleen met `overwrite: true` | tool |
| Export, geen "opslaan als"; document blijft onopgeslagen | tool |
| Noem het pad aan de gebruiker | tool |
| IFC2X3-bron niet overschrijven; identiteit niet te bewijzen ⇒ geweigerd; dan IFC 4.3 ADD2 met `schemaNotice` | tool |
| import_schedule: opent als document, wordt actief, niets samengevoegd | tool |
| Formaten en verlies per formaat aan de gebruiker melden | tool |
| Oudere IFC herberekend: `minuteModelConversion` + `notice` melden | tool |
| Alleen een IFC-import neemt het bronpad als opslagdoel | tool |
| Gebruik `documents` uit het antwoord | tool |
| `documentId` wijst voor compatibiliteit naar het actieve document | weg: de tool zegt `documents` te gebruiken |
| Kalender-id's per document; herbouwen via update_calendar; projectkalender via `projectDefaultId` | tool (verwijst naar get_calendars, waar de `projectDefaultId`-regel staat) |

## Leestools

| regel | nieuwe plek |
|---|---|
| get_project_info: `criticalTasks` alleen bladtaken | tool (test `cases-read`) |
| `statusDate` = DATA DATE, stuurt het projecteinde | tool (test `cases-statusdatum`) |
| `schedulingProfile`/`schedulingOptions` alleen-lezen; `leveling` uit bronbestand bewaard, niet toegepast | tool |
| `startToStartLagFrom` en conventie-uitleg | weg: leesinformatie, geen aanroep |
| get_project_overview: elk relatie één keer, één aanroep genoeg; `id` voor muterende tools; `parentId` om de boom te bouwen; `#seq` = seqId; notatie = invoervorm | tool |
| `wbs` alleen-lezen en afgeleid; `wbsCode` geen schrijfveld | tool overview + get_task (test `cases-stille-noops`) |
| list_tasks: filters met AND; `kritiek` telt verzameltaken mee (`summary: true`); venster inclusief; `zonder_relaties` alleen bladtaken; paginering; strikte filtercontrole | tool (test `cases-read`) |
| get_task: verzameltaak leidt voortgang af; `interruptions` + `splitsEditable`; bronvelden alleen-lezen; `effectiveId` → `calendarId`; negatieve speling; `actualFinishAdjusted` | tool (test `cases-statusdatum`) |
| Lijst van MPP- en P6-bronvelden | weg: detail; ze staan in het antwoord en zijn alleen-lezen |
| get_critical_path: `drivingRelations` null vs `[]`; `pathsMode`; `criticalPaths` alleen bij FREE_FLOAT; paginering over `criticalTasks` | tool |
| list_resources: veldnamen gelijk aan manage_resources; `library.lockedFields` | tool |
| get_resource_histogram: aggregaat zonder filters, detail met filters; onbekend id = fout; weekoverhang; grens 10000 buckets | tool |
| Bucketwaarden zijn Nederlands (`dag`, `week`, `maand`) | schema enum + param `bucket` |
| get_calendars: object letterlijk terug te schrijven; `create: true` in ander document; projectkalender via `projectDefaultId`; standaard niet te wisselen via de bridge | tool |
| compare_baseline: alleen afwijkingen; geen actieve baseline = fout; maat is de huidige kalender | tool |
| analyze_delay: impact = `projectEndDelta`, nooit optellen; `projectEndDeltaAvailable` | tool |

## planner_batch

| regel | nieuwe plek |
|---|---|
| Max. 100 stappen, één undo-stap, één herberekening | tool (test `cases-batch`: "100") + schema `maxItems` |
| Structurele stapfout ⇒ hele batch terug; weigeringen per item zacht (`rejections`) | tool |
| tempId-syntax; vervanging in LATERE stappen, nooit in vrije tekst; alleen binnen deze batch | tool |
| Args liggen vast: alleen een laatste leesstap is zinvol; ids vooraf opzoeken | tool (test `cases-batch`: "final") |
| Uitgesloten tools | tool |
| Rapport per stap bij een fout; "geen scripttaal" | weg: antwoord / volgt uit "args fixed at submission" |

## planner_inspect_xer_provenance

| regel | nieuwe plek |
|---|---|
| Alleen-lezen, begrensd, niet batchable | tool |
| Secties; paginering | tool + params |
| Zonder `includeRawRows` alleen id/code/label, afgekapt op 200 tekens | tool |
| Met `includeRawRows` vrije tekst tot 2.000 tekens, 200 cellen per rij, paginagrens 100 | param `includeRawRows` + param `limit` |
| Elke pagina onder 256 kB, BEHALVE rawSource (max. 8 chunks) | tool (test `cases-xer-provenance`: "EXCEPT rawSource") |
| rawSource vraagt `includeRawSource: true` | param `includeRawSource` |
| `taskSourceRowsByProject` vraagt `projectId` uit `selector.availableProjectIds` | param `projectId` |
| Zonder archief `sourcePresent: false` + `archiveIssue` | tool |
| Lijst met `archiveIssue`-codes | weg: antwoord |
| Resourcenamen verborgen; eerst toestemming van de gebruiker, want persoonsgegevens gaan naar de AI-aanbieder | tool + param `includeResourceNames` (test `cases-xer-provenance` eist het op beide plekken) |
| Codes altijd zichtbaar | param `includeResourceNames` |

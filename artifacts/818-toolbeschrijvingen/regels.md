# Regels in de toolbeschrijvingen (#818)

Per tool staan hier de regels uit de oude beschrijvingen die een agent moet kennen. Bij elke regel staat waar hij
in de nieuwe tekst staat, of waarom hij weg mag. "tool" = de toolbeschrijving, "param `x`" = de beschrijving van
parameter `x`.

Redenen om iets weg te laten:

- **schema**: het schema zegt het al (naam, type, enum, verplicht veld, grens, `additionalProperties: false`).
- **antwoord**: het antwoord van de tool meldt het zelf, met een veld of een weigering met reden. De agent hoeft
  het niet vooraf te weten om de aanroep goed te doen. Voorbeelden: `scheduleNote` bij een niet-verse planning,
  `itemRejections` bij een geweigerd item, `phaseTransitions`, `cascadedTaskIds`.
- **detail**: uitleg of achtergrond zonder invloed op de aanroep, de planning of de data.
- **dubbel**: stond op twee plekken (tool en param, twee tools, of tool en instructies); één plek blijft.

Wat bewust bleef: elke regel die zonder voorkennis tot een foute aanroep, een foute planning, een fout verslag aan de
gebruiker of dataverlies leidt. Een weigering achteraf is geen ramp, maar een stille verkeerde uitkomst wel; die
regels staan er allemaal nog.

Het invoercontract is gelijk: geen naam, type, enum, `required`, `default`, `pattern` of grens is veranderd.
Alleen `description`-velden zijn korter of weg. De enums blijven volledig staan, ook de lange: de constrainttypen
(`ASAP` … `MFO`), de bouwvakwaarden (`geen`/`noord`/`midden`/`zuid`), `bucket` (`dag`/`week`/`maand`), de
landcodes, `shift`, `workRule`, `taskType` en de curves.

`planner_get_planning_guide` (in `guideTools.ts`) is niet aangeraakt: PR #836 (`docs/818-gids-zuinig`) herschrijft die
tool en de gids.

## Gedeelde stukken

| regel | nieuwe plek |
|---|---|
| `tempId` begint met `tmp-`/`tmp_` | schema `pattern` bij add_tasks; tool planner_batch; param `tempId` bij manage_resources (daar zonder pattern; de code weigert) |
| Onbekende sleutel in taakvelden wordt geweigerd | schema `additionalProperties: false`; tool add_tasks ("one invalid item fails the whole call"); tool update_tasks ("a refused item changes nothing") |
| `status`, `parentId`, `resourceIds` zijn geen schrijfvelden van update_tasks; route via `progress`, move_task, manage_assignments | `TASK_FIELDS_DOC`, nu alleen in update_tasks. In add_tasks stond hij ook, maar daar is `parentId` juist wél een veld: die zin was daar fout en is weg |
| `time` is geen schrijfveld | schema (`additionalProperties: false`); de weigering noemt `duration` |
| `duration` in de maat van `durationUnit`; zonder eenheid werkdagen; een fractie blijft exact | param `duration` (test `cases-taskfields`: "fraction") |
| FIXED_WORK-taak staat altijd in uren (dagen × uren per dag) | param `duration` |
| Mijlpaal: duur 0; verzameltaak: duur afgeleid, weglaten | param `duration` |
| Dag- en uurmaat per rekenprofiel (OPS: een werkdag = een dag; P6/MSP: dagen × werktijd) | weg: detail; de agent geeft dagen zoals de gebruiker ze noemt, het profiel rekent |
| `durationUnit` samen met `duration` geven | param `durationUnit` |
| Uurmaat vraagt een taakkalender met werktijd | weg: elke kalender met werktijd voldoet; zonder werktijd faalt de berekening al |
| `isMilestone: true` zet duur 0 (niet op verzameltaak of taak met toewijzingen); `false` laat 0 staan tot je `duration` stuurt | param `isMilestone` |
| `taskType` is de werkcategorie, niet het taaktype `workRule` | param `taskType` |
| `customTaskType` zet USERDEFINED; een bestaand id houdt zijn naam | param `customTaskType` |
| Constraint: `null` wist; `date` nodig behalve ASAP/ALAP; `hard` alleen MSO/MFO; null/ASAP/ALAP wissen ook de secundaire; ongeldig paar geweigerd | param `constraint`; de typen staan als enum |
| `deadline` begrenst alleen de late finish | param `deadline` |
| `calendarId`: bibliotheekkalender; `null` = projectkalender | param `calendarId` |
| `workRule`: vier waarden met betekenis en MSP/P6-namen ("Fixed Units" betekent in MSP en P6 iets anders); wisselen verandert geen getal; `null` = projectstandaard; alleen gewone bladtaken | param `workRule` |
| Veldbeschrijvingen van add_tasks en update_tasks.fields | dubbel: alleen bij add_tasks; update_tasks zegt "`fields` take the same fields as planner_add_tasks items" (`TASK_FIELD_SCHEMA_PROPERTIES_BARE`, zelfde schema zonder `description`) |
| Fase-overgang: toewijzingen gaan naar de eerste nieuwe subtaak (`phaseTransitions`) | `PHASE_TRANSITION_DOC` in add_tasks en move_task; dat een mijlpaal zijn vlag verliest en wanneer de aanroep faalt: antwoord |
| Lag: getal of "+2d", fractie toegestaan, negatief = lead, "+50%" van de voorganger, andere vorm geweigerd; een lag zetten wist de andere lagvormen | param `lag` (test `cases-update-dependencies`: "fraction") |
| `LAG_DOC` in de toolbeschrijvingen | dubbel met param `lag`; de constante is weg |
| Relatietype: lange of korte vorm (FS/FF/SS/SF) | schema: de enum noemt beide |
| Verse planning bij leestools: eerst herberekenen | `FRESH_NOTE` ("Recalculates a stale schedule first.") in de zeven leestools met berekende waarden |
| Uitzonderingen op verse datums (`datesAsRecorded`, `scheduleStale` tijdens een bewerking, `scheduleError`) | antwoord: de envelop draagt dan `scheduleNote` of `scheduleError`. `datesAsRecorded` en `scheduleError` staan ook in `MCP_INSTRUCTIONS` |
| Optionele paginering: `limit` 1–1000, `offset`; zonder beide de hele lijst | `OPTIONAL_PAGE_NOTE`; standaard 50 en `total`/`has_more`/`next_offset`: antwoord |
| "One call = one undo step" bij de bulktools | weg: detail, geldt voor elke wijzigende tool; bij planner_batch blijft hij staan omdat hij daar het doel is |
| "Refused items are listed; valid ones apply" bij de bulktools | weg: antwoord (`itemRejections`) |

## planner_add_tasks

| regel | nieuwe plek |
|---|---|
| Geneste WBS in één aanroep; items in elke volgorde | tool |
| `parentId` = bestaand id of tempId uit dezelfde aanroep; weggelaten = wortel | tool + param `parentId` |
| `tempId` uniek in de aanroep; latere batchstappen mogen hem gebruiken | param `tempId` |
| `position` = index tussen de broers | param `position`; dat hij geklemd wordt: weg (de taak komt altijd ergens geldig) |
| Zonder `duration`: projectstandaard (5 werkdagen; 5 uur bij uurmaat in het OPS-profiel) | tool, als "normally 5 working days": de agent hoort zelf een duur te geven |
| Eén ongeldig item laat de hele aanroep falen (alles-of-niets) | tool |
| Antwoord: `created` (tempId → id) | tool; datums en projecteinde: antwoord |

## planner_update_tasks

| regel | nieuwe plek |
|---|---|
| `fields` = dezelfde velden als add_tasks, zonder voortgang | tool |
| Geweigerd item verandert niets aan die taak | tool |
| Onbekende sleutel en lege `progress` geweigerd | schema + antwoord |
| Voortgang vraagt een statusdatum; die wordt nooit vanzelf gezet | tool |
| Actuals na de statusdatum geweigerd | tool + param `actualStart`/`actualFinish` |
| `completion` > 0 leidt actualStart af, behalve als de geplande start na de statusdatum ligt: dan `actualStart` meegeven | tool |
| Geen `progress` op verzameltaken (afgeleid) | tool |
| Duurwijziging op een lopende taak houdt het gedane werk (voorbeeld 10 d / 40 % → 12 d) | tool; `progressAdjusted` en de weigering bij "korter dan gedaan werk": antwoord |
| Overschreven restwerk (`remainingWorkRecomputed`) aan de gebruiker melden | tool |
| Toewijzingen volgen de duur per `workRule` | param `workRule` bij add_tasks (de vier regels) |
| Hypothetische vertraging = duur of constraint, niet `progress` | tool |
| Eén id kan in `updated` én in de weigeringen staan | weg: antwoord |
| `actualFinish` ≥ `actualStart`; `null` wist | param `actualFinish` |

## planner_delete_tasks / planner_move_task

| regel | nieuwe plek |
|---|---|
| Verwijdert de hele subboom met relaties en toewijzingen; controleer `cascadedTaskIds` | tool |
| Onbekend id per item geweigerd; id dat al door een cascade verdween telt als succes | weg: antwoord |
| move_task: `newParentId: null` = wortel; `position` = index | tool |
| Onder zichzelf of een afstammeling; kring via verzameltaakrelaties (CYCLE) | weg: antwoord (harde fout met reden; de aanroep verplaatst maar één taak) |
| Fase-overgang | `PHASE_TRANSITION_DOC` |

## planner_add_dependencies / planner_update_dependencies / planner_remove_dependencies

| regel | nieuwe plek |
|---|---|
| Verzameltaak als eindpunt TOEGESTAAN (geldt voor de bladtaken) | tool add en update (test `cases-sync2-integration`) |
| Relatie naar een eigen voorouder geweigerd | tool add en update (test: "ancestor") |
| Kring = harde fout, hele aanroep terug | tool add en update |
| Onbekende ids, duplicaat, relatie met zichzelf, item zonder wijziging | weg: antwoord (zachte weigering per item) |
| Wijzigen via update_dependencies (houdt het id), niet verwijderen + toevoegen | tool add, update en remove |
| `seqId` = deel na `#` in de leestools | tool update; het voorbeeld "→2.3 FS+2d #seq-7" staat bij get_project_overview |
| Alleen opgegeven velden veranderen | tool update |
| Dubbele seqIds geweigerd; antwoord `changes` | weg: antwoord |

## planner_undo / planner_redo

| regel | nieuwe plek |
|---|---|
| Alleen het ACTIEVE document | tool |
| Controleer `undone`/`redone`: `ok` zonder effect is mogelijk | tool |
| Geschiedenis gedeeld met de gebruiker, ook rasterinstellingen; what-if via duplicate_document | tool undo |
| `undoDepth`/`redoDepth`; redo-scopes | weg: antwoord / detail |

## planner_set_task_splits

| regel | nieuwe plek |
|---|---|
| Vervangt de lijst; `[]` wist | tool |
| Posities op de WERK-as (voorbeeld) | tool |
| Uurtaak: `afterWorkHours`/`pauseHours` | tool |
| Alleen hele eenheden; taak wordt langer, werk blijft | tool |
| Niet splitsbaar: mijlpaal, verzameltaak, hamer, ELAPSEDTIME, handmatig | tool |
| Korter dan twee eenheden, niet-bewerkbare geïmporteerde splits, positie in gedaan werk, dag- en uursleutels mengen, alles-of-niets | weg: antwoord (fout met index en reden; er wordt niets geschreven) |

## planner_update_calendar

| regel | nieuwe plek |
|---|---|
| Bestaand id, of `create: true` met eigen label; gebruik daarna het teruggegeven echte `id` | tool |
| Onbekend id zonder `create` geweigerd | weg: antwoord |
| Kalender-id's per document; nooit een id uit een ander document | tool |
| `generate` VERVANGT de lijst | tool |
| `rawHolidays` VOEGT TOE, bestaande dagen blijven | tool (test `cases-stille-noops`: "add") |
| `holidaysMode: "replace"`: lijst wordt exact `rawHolidays`, enige manier om te verwijderen | tool (test: "replace") + param `holidaysMode` |
| Lege `rawHolidays` in merge-modus geweigerd; `replace` met `[]` wist alles | weg: antwoord / volgt uit "exactly `rawHolidays`" |
| `holidays` vervangt exact; niet samen met `rawHolidays`/`holidaysMode`/`generate` | tool + param `holidays` |
| Losse dagen beëindigen de koppeling met de generator (`becameLiteral`) | tool |
| `create` zonder feestdagvelden erft de feestdagen van de app-standaard; geen feestdagen: `holidays: []` | tool (de route `generate: {country: "none"}` staat bij param `country`) |
| Overzetten: object uit get_calendars letterlijk terug, met `create: true` om te kopiëren | tool |
| Afgeleide leesvelden (`isProjectDefault`, `usedBy*`, `libraryOrigin`) genegeerd (`ignoredFields`) | weg: antwoord; per veld geen beschrijving meer |
| Dagkalender met pauze: `hoursPerDay` afgeleid; wijzig de uren of de pauze | tool; de weigering van een afwijkende waarde: antwoord |
| Pauze buiten de werkdag of over de hele dag geweigerd | weg: antwoord |
| `generate` óf `generation`; `generation` schrijft alleen herkomst | param `generation` |
| `workTime` maakt een uurkalender, `null` terug naar dag | param `workTime` + tool |
| Taakduren worden nooit omgerekend; datums kunnen schuiven | tool. De oude param-tekst van `workTime` ("this redefines the duration of every task") sprak de toolbeschrijving tegen en was verouderd; die zin is weg |
| Bij `workTime` volgen `workDays` altijd en `hoursPerDay` tenzij bewust afwijkend; opgegeven `hoursPerDay` wint | tool |
| Alleen `workDays` op uurkalender: nieuwe dag kopieert de banden van de eerste dag met banden (zo, ma … za) | param `workDays`; dat een vervallen dag zijn banden verliest volgt uit "geen werkdag" |
| Terugval als geen dag banden heeft (eigen werkdag, dan 07–12 + 13–16) | weg: randgeval; zo'n kalender heeft geen werktijd en faalt al; wie banden wil, geeft `workTime` |
| Ongebruikte kalenders overleven IFC opslaan + laden; geen taak nodig om hem te bewaren | tool (test `cases-uurkalender`) |
| Uurbanden per weekdag overleven IFC | weg: geruststelling zonder invloed op de aanroep |
| Taken passen niet meer (`cappedTaskIds`); geen werktijd over ⇒ hele aanroep terug | weg: antwoord |
| `generate`-bereik in jaren | param `generate` |
| Landcode exact uit de lijst; `none` wist gegenereerde dagen | schema enum + param `country` (test `cases-stille-noops`: "none") |
| `bouwvak` alleen NL | param `bouwvak` + enum |
| `byWeekday`: alle zeven sleutels verplicht; banden in minuten, oplopend, niet overlappend; `[]` = vrije dag; `end` > `start`, telt door na middernacht (voorbeeld) | param `byWeekday`, één keer. De dagschema's dragen geen beschrijving meer: ze stonden acht keer in het schema |
| `workStartHour`/`workEndHour` in UREN, pauzevelden in MINUTEN | params |
| `workingExceptions`: complete lijst, vervangt; `bands` optioneel | param `workingExceptions` |
| Datums inclusief | param `endDate` van feestdag- en uitzonderingsitems |

## planner_manage_assignments

| regel | nieuwe plek |
|---|---|
| Velden per actie | tool |
| Alleen op bladtaken, geen mijlpaal; een resource één keer per taak | tool |
| Onder FIXED_WORK/FIXED_RATE veranderen eenheden of een extra resource de DUUR; onder de standaardregel zet `remainingWorkMinutes` de eenheden | tool |
| Lees de taak opnieuw voor de nieuwe duur | tool |
| `unitsPerDay`: 1 = één persoon voltijd | param `unitsPerDay` |
| `remainingWorkMinutes` in werkminuten | param; "alleen gewone bladtaak op werktijd, materiaal telt niet": antwoord / detail |
| `curve` weggelaten = UNIFORM | param `curve` |
| Dubbele resource ook binnen één aanroep geweigerd | volgt uit "a resource once per task" |

## planner_manage_resources

| regel | nieuwe plek |
|---|---|
| Tegenhanger van manage_assignments | tool (test `cases-resource-crud`) |
| Velden per actie | tool |
| `null` wist een veld; weggelaten sleutel blijft | tool |
| `description` leegmaken met `""`, niet `null` | param `description` |
| VERWIJDEREN wist ook alle toewijzingen; met toewijzingen alleen met `cascade: true` | tool |
| Ploeglidmaatschap van de leden vervalt bij verwijderen | weg: antwoord (`orphanedCrewMemberIds`) |
| `tempId` (`tmp-`/`tmp_`) bij `create`, echt id in `created`; latere batchstappen | tool + param `tempId` |
| Bibliotheekresource: vijf velden vast; bied de gebruiker de twee routes | tool |
| Wat het project bepaalt blijft schrijfbaar | weg: volgt uit de lijst vaste velden |
| `maxUnits` per WERKDAG, standaard 1; `type` standaard LABOR; `unitOfMeasure` alleen MATERIAL; `parentId` = CREW-resource; `availabilitySteps` | params |
| Veldnamen gelijk aan list_resources | tool list_resources |

## planner_level_resources / planner_clear_leveling

| regel | nieuwe plek |
|---|---|
| `constrainToFloat: true` (standaard) binnen de speling, einde vast, pieken kunnen blijven; `false` mag het einde verschuiven | tool |
| Materiaal nooit genivelleerd | tool |
| Eerst `dryRun: true`; verandert niets | tool + param `dryRun` |
| Nivelleren reset zichzelf; herhalen stapelt niet | tool |
| `delays`, `shifts`, `unresolved`, projecteinde voor/na, `recomputed` | weg: antwoord |
| clear_leveling vóór level_resources is zinloos | tool clear_leveling (test `cases-mutate-cal-res`) |

## planner_update_project / planner_move_project / planner_save_baseline

| regel | nieuwe plek |
|---|---|
| `startDate` = anker voor NIEUWE taken, schuift de planning niet; zet hem vóór add_tasks | tool |
| Een latere `startDate` klemt losse wortelankers naar voren (`anchorsClamped`) | tool (test `cases-project-start-anchor`) |
| Hele planning verschuiven = move_project | tool (test `cases-mutate-cal-res`) |
| `statusDate` = DATA DATE; niet-gestart werk (completion 0) schuift naar die datum, ook zonder voortgang; alleen zetten voor voortgang (`statusDateEffect`) | tool + param `statusDate` (test `cases-statusdatum`) |
| Statusdatum wissen maakt actuals inert | tool |
| `statusDate` met tijd tot de minuut (`YYYY-MM-DDTHH:mm`) | param `statusDate` (test `cases-statusdatum`) |
| `endDate` dwingt niets af | tool; dat hij het bereik van `generate` stuurt: param `generate` ("year after the project end") |
| Onbekend veld geweigerd met de lijst | weg: schema + antwoord |
| `defaultWorkRule`: `null` = FIXED_DURATION_RATE; FIXED_WORK zet taken zonder eigen regel om naar uren, ook na terugschakelen | param `defaultWorkRule` |
| move_project: hele planning; kalenders schuiven niet, dus het einde kan anders schuiven; baselines alleen met `shiftBaselines` | tool |
| Ankers van externe koppelingen schuiven niet mee | weg: detail; het antwoord meldt het verschil |
| save_baseline: wordt de actieve baseline; niet in een batch | tool |
| Verouderde planning eerst herberekend (`recomputed`) | weg: antwoord |

## Basislijnen (list / activate / rename / delete)

| regel | nieuwe plek |
|---|---|
| list_baselines geeft de ids en welke actief is | tool |
| activate: maat voor compare/analyze; `null` = geen | tool |
| Al actief (`changed: false`), dubbele naam (`warning`), compare/analyze weigeren zonder actieve baseline | weg: antwoord |
| rename: naam niet leeg | tool |
| delete: niet te herbouwen; actieve weg ⇒ laatste overgebleven wordt actief | tool |

## Documenten

| regel | nieuwe plek |
|---|---|
| list_documents: om varianten te vergelijken; `title` is geen projectnaam; alleen het actieve document wordt herberekend, andere kunnen `scheduleStale` zijn | tool |
| `notCalculated`, `calculationError`, `datesAsRecorded` per rij | weg: antwoord (zelfverklarende velden) |
| new_document: wordt actief, latere aanroepen gaan daarheen; kopie via duplicate | tool |
| Zonder wizard, standaardkalender | weg: detail |
| duplicate_document: voor what-if; naamregel; latere aanroepen gaan naar de kopie, eerst terugschakelen; sluiten laat je aan de gebruiker | tool |
| De kopie heeft geen bestandspad en een eigen undo-geschiedenis | weg: detail |
| switch_document: lost DOC_DRIFT op; ids per document | tool |

## Bestanden (alleen desktop en headless; niet in de SuperCloud-set)

| regel | nieuwe plek |
|---|---|
| export_ifc: ACTIEF document, compleet, alleen in de thuismap ("home folder" blijft: de headless server vertaalt die term) | tool |
| Bestaand bestand alleen met `overwrite: true` | tool |
| Export, geen "opslaan als"; document blijft onopgeslagen | tool |
| Noem het pad aan de gebruiker | tool |
| Bronbestand van een onschrijfbaar schema (IFC2X3), of een bestand dat niet aantoonbaar anders is, wordt niet overschreven: kies een nieuwe naam | tool |
| `ifcSchema`, `schemaNotice` | weg: antwoord |
| import_schedule: formaten; opent als nieuw actief document; niets samengevoegd | tool |
| Verlies per formaat aan de gebruiker melden | tool |
| `notice` doorgeven (o.a. herberekende oudere IFC) | tool; `minuteModelConversion`: antwoord |
| Gebruik `documents` uit het antwoord (één bestand kan meer documenten openen) | tool |
| Kalender-id's per document; herbouwen met update_calendar | tool |
| Alleen een IFC-import neemt het bronpad als opslagdoel; leeg tabblad hergebruikt; `documentId` | weg: detail |

## Leestools

| regel | nieuwe plek |
|---|---|
| get_project_info: goede eerste aanroep; `criticalTasks` alleen bladtaken | tool (test `cases-read`) |
| `statusDate` = DATA DATE, kan het projecteinde bepalen | tool (test `cases-statusdatum`) |
| `schedulingOptions.leveling` uit een bronbestand wordt niet toegepast | tool |
| `schedulingProfile`, `startToStartLagFrom` | weg: leesinformatie, geen aanroep |
| get_project_overview: elke relatie één keer, één aanroep genoeg; `id` voor muterende tools; `parentId` voor de boom; `#seq` = seqId | tool (test `cases-stille-noops`: `id`) |
| `wbs` alleen-lezen en afgeleid; `wbsCode` geen schrijfveld | tool overview + get_task (test `cases-stille-noops`) |
| Veldenlijst van de rij | weg: antwoord |
| list_tasks: filters met AND; `kritiek` telt verzameltaken mee (`summary: true`); venster inclusief; `zonder_relaties` alleen bladtaken | tool (test `cases-read`) |
| get_task: `interruptions` in de vorm van set_task_splits; `effectiveId` → `calendarId`; negatieve speling; `actualFinishAdjusted` | tool (test `cases-statusdatum`) |
| Verzameltaak leidt voortgang af | tool update_tasks |
| MPP- en P6-bronvelden alleen-lezen | weg: schema (geen schrijfveld) |
| get_critical_path: `drivingRelations` null vs `[]`; paginering over `criticalTasks` | tool |
| `pathsMode`, `criticalPaths` alleen bij FREE_FLOAT | weg: antwoord |
| list_resources: veldnamen gelijk aan manage_resources; `library.lockedFields` | tool |
| get_resource_histogram: samenvatting zonder filters, buckets met filters; weekoverhang | tool |
| Onbekend id = fout; grens 10000 buckets | weg: antwoord (fout met uitweg) |
| Bucketwaarden zijn Nederlands | enum + param `bucket` |
| get_calendars: object letterlijk terug te schrijven, `create: true` in een ander document; projectkalender via `projectDefaultId`; standaard alleen in de app te wisselen | tool |
| compare_baseline: afwijkingen; maat is de huidige kalender | tool |
| analyze_delay: impact = `projectEndDelta`, nooit optellen | tool |
| Geen actieve baseline ⇒ VALIDATION; `projectEndDeltaAvailable` | weg: antwoord |

## planner_batch

Aanvulling van de orkestrator: PR #836 haalde deze details uit de agentgids; ze staan nu alleen hier.

| regel | nieuwe plek |
|---|---|
| Max. 100 stappen | tool (test `cases-batch`: "100") + schema `maxItems` |
| Eén undo-stap, één herberekening; gebruik voor een samenhangende reeks | tool (de "wanneer"-zin stond eerst in `MCP_INSTRUCTIONS`) |
| Een falende stap ⇒ hele batch terug; weigeringen per item zacht (`rejections`) | tool |
| tempId wordt in LATERE stappen van deze batch vervangen, nooit in vrije tekst | tool |
| Args liggen vast: alleen een laatste leesstap is zinvol; ids vooraf opzoeken | tool (test `cases-batch`: "final") |
| Uitgesloten: planner_batch, undo/redo, document- en bestandstools, planner_save_baseline | tool |
| Rapport per stap bij een fout; "geen scripttaal" | weg: antwoord / volgt uit "args are fixed at submission" |

## planner_inspect_xer_provenance

| regel | nieuwe plek |
|---|---|
| Alleen-lezen, niet batchable | tool |
| Zonder `includeRawRows` alleen id/code/label | tool |
| Met `includeRawRows` vrije tekst; niet voor summary en rawSource | param `includeRawRows` |
| Elke pagina onder 256 kB, BEHALVE rawSource (max. 8 chunks) | tool (test `cases-xer-provenance`: "EXCEPT rawSource") + param `limit` |
| rawSource vraagt `includeRawSource: true`; taskSourceRowsByProject vraagt `projectId` | params |
| Resourcenamen verborgen; eerst toestemming, want persoonsgegevens gaan naar de AI-aanbieder | tool + param `includeResourceNames` (test eist het op beide plekken) |
| Afkapgrenzen (200/2.000 tekens, 200 cellen), `archiveIssue`-codes, `sourcePresent` | weg: antwoord |

## MCP_INSTRUCTIONS (`src/services/mcp/dispatcher.ts`)

Aanvulling van de orkestrator. De instructies gaan in elke systeemprompt mee. Ze houden de kernregels die
`tests/mcp/cases-planning-guide.ts` vastlegt; wat een tool doet staat in zijn eigen beschrijving, de uitleg per
principe in de agentgids.

| regel | nieuwe plek |
|---|---|
| Echte planning waar iemand op vertrouwt | instructies |
| Begin bij mijlpalen en opleverdatum | instructies (test: "milestone") |
| Taken van een dag tot twee weken; verzameltaken geen eigen duur | instructies (test: "two weeks") |
| Waarom (te fijn onbeheersbaar, te grof onstuurbaar) | weg: gids |
| Relaties, geen vaste datums; FS standaard; elke taak een voorganger en opvolger; constraints alleen voor harde externe datums; nooit negatieve lag | instructies (test: "Finish-to-start", "negative lag") |
| Hoogstens een paar procent constraints | weg: gids |
| Geen aparte herbereken-stap; resultaat lezen met get_project_info en get_critical_path | instructies (test) |
| `datesAsRecorded`: datums uit het bestand; meld dat; de eerste wijziging rekent ze opnieuw | instructies (test) |
| `scheduleError`: eerst oplossen; een wijziging die het laat staan wordt teruggedraaid | instructies (test) |
| Gebruik planner_batch voor een samenhangende reeks | dubbel: nu in tool planner_batch |
| Voortgang vraagt de statusdatum van de gebruiker; nooit verzinnen | instructies (test: "status date") |
| Actuele start- en einddatums van de gebruiker doorgeven | weg: dubbel met update_tasks |
| Afsluiten met de aannames en wat je niet deed | instructies (test: "assumed") |
| Gids en skills via planner_get_planning_guide of de URL | instructies (test) |

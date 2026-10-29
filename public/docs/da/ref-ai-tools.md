# AI-værktøjer (planner_*)

Alle værktøjer, en AI-assistent kan kalde via broen, pr. gruppe, med hvad de gør og hvad de afviser. Alle begynder med `planner_`. Forbindelsesprompten i vinduet *Forbindelsesoplysninger* viser det aktuelle portnummer, og assistenten får den fulde liste med beskrivelser fra broen selv (`tools/list`). Hvorfor forbindelsen virker, som den gør, står i [Sådan fungerer AI-forbindelsen](docs://uitleg-ai-koppeling). Hvordan du slår den til, står i [Forbind en AI-assistent (MCP)](docs://howto-ai-assistent-koppelen).

## Sådan læser du listen

**Læs** betyder: værktøjet ændrer ikke noget. Det virker også under *Pausér* og *Skrivebeskyttet*. En åben dialog blokerer det dog (se *Når et værktøj afvises* nedenfor). Et læseværktøj giver altid aktuelle datoer. Hvis tidsplanen er forældet, genberegner det først, også under *Pausér* og *Skrivebeskyttet*. Disse tilstande holder ændringer tilbage, ikke genberegningen ved læsning. Hvis du er midt i en redigering (du trækker i en bjælke eller skriver i et felt), genberegner det ikke. Assistenten får så datoerne fra før din redigering, med en besked om at de er forældede. Hvis projektet står i visningen *Datoer som registreret*, genberegner det ikke. Assistenten får så de registrerede datoer, med en besked om at de ikke er genberegnet.

**Ændr** betyder: værktøjet ændrer dit projekt. Det afvises under *Pausér*, *Skrivebeskyttet* og når en dialog er åben. Det gælder også for værktøjerne uden mærkning nedenfor (`planner_undo`, `planner_redo`, fil-værktøjerne og dokumentværktøjerne, undtagen `planner_list_documents`). Hver ændring er ét trin i din fortrydelseshistorik. Hvis projektdata ændres, genberegner appen tidsplanen bagefter af sig selv. Du behøver ikke trykke på *Beregn*. Før den første ændring pr. dokument laver appen en backup, hvis *Automatisk backup* er slået til.

**Flere ad gangen** betyder: ét kald kan indeholde flere elementer. Et ugyldigt element afvises med en begrundelse, og de gyldige elementer bliver. Svaret nævner de afviste elementer.

## Læs: tidsplan

- `planner_get_project_info` (læs) — projektets detaljer og nøgletal: antal opgaver, afhængigheder, ressourcer og milepæle, statusdatoen, projektets slutdato og varighed, om tidsplanen er forældet, beregningsprofilen og en sammenfatning af kalenderne. Et godt første kald.
- `planner_get_project_overview` (læs) — hele WBS-træet i ét svar: pr. opgave-id: WBS, navn, varighed, tidlige datoer, fremdrift, kritisk, og de udgående afhængigheder med id for afhængigheden.
- `planner_list_tasks` (læs) — opgaver med filtre (kritisk, status, datovindue, opgaver uden afhængigheder) og paginering.
- `planner_get_task` (læs) — én opgave i detaljer: datoer, slæk, fremdrift, begrænsninger, deadline, kalender, tildelinger, foregående og efterfølgende opgaver, afbrydelser.
- `planner_get_critical_path` (læs) — de kritiske opgaver med deres samlede slæk, og de afhængigheder, der styrer den kritiske sti.
- `planner_list_resources` (læs) — ressourcer med kapacitet, standardsats, kalender, mandskab, tilgængelighed og en sammenfatning af deres tildelinger. Hvis en ressource kommer fra et bibliotek, vises hvilke felter der er låst.
- `planner_get_resource_histogram` (læs) — belastning mod kapacitet pr. ressource, pr. dag, uge eller måned (uge som standard). Uden vindue og uden ressourcer får du en sammenfatning pr. ressource. Med et vindue eller med ressourcer får du hele serien og de opgaver, der forårsager en overallokering.
- `planner_get_calendars` (læs) — alle kalendere med hele definitionen, og hvor mange opgaver og ressourcer der bruger dem.

## Læs: oprindelige planer og afvigelser

- `planner_list_baselines` (læs) — de gemte oprindelige planer, og hvilken der er aktiv.
- `planner_compare_baseline` (læs) — den aktuelle plan mod den aktive oprindelige plan: kun de opgaver, der afviger, og forskellen i projektets slutdato i arbejdsdage på den aktuelle projektkalender. Uden aktiv oprindelig plan afvises kaldet.
- `planner_analyze_delay` (læs) — analyse af forsinkede opgaver mod den aktive oprindelige plan: forskellen i levering og de kritiske opgaver, der er flyttet. Uden aktiv oprindelig plan afvises kaldet.

## Opgaver og struktur

- `planner_add_tasks` (ændr, flere ad gangen) — opret opgaver, inklusive en indlejret WBS i ét kald. Hver opgave får et eget midlertidigt navn (`tmp-…`), så en underopgave kan henvise til sin hovedopgave. Uden varighed får en opgave 5 arbejdsdage. En milepæl har varighed 0. Alle opgaver i ét kald lykkes samlet eller mislykkes samlet.
- `planner_update_tasks` (ændr, flere ad gangen) — ændr felter på eksisterende opgaver: navn, beskrivelse, varighed med enhed (dage eller timer), varighedstype, arbejdskategori, milepæl, obligatorisk, prioritet, begrænsning, deadline, kalender og opgavetype. Også en fremdriftssti: % færdigt, faktisk startdato og faktisk slutdato. Enhver anden nøgle afvises med en begrundelse.
- `planner_delete_tasks` (ændr) — slet opgaver, inklusive hele undertræet, afhængigheder og tildelinger. Svaret nævner præcis hvad der fulgte med.
- `planner_move_task` (ændr) — flyt en opgave under en anden hovedopgave, på en bestemt position. En cyklus, eller at sætte en opgave under sig selv, afvises.
- `planner_set_task_splits` (ændr) — sæt afbrydelserne for en opgave: efter hvor mange arbejdsdage (eller arbejdstimer) der er arbejdet, og hvor mange arbejdsdage (eller arbejdstimer) afbrydelsen varer. En tom liste fjerner alle afbrydelser. Se [Opdeling af en opgave](docs://howto-taak-splitsen).

## Afhængigheder

- `planner_add_dependencies` (ændr, flere ad gangen) — opret afhængigheder med en type (`FS`, `SS`, `FF`, `SF` eller den lange form) og en forsinkelse, for eksempel `+2d`.
- `planner_update_dependencies` (ændr, flere ad gangen) — ændr type, forsinkelse, foregående opgave eller efterfølgende opgave for en bestående afhængighed, med id for afhængigheden. Det er ét trin i stedet for at slette og oprette igen.
- `planner_remove_dependencies` (ændr, flere ad gangen) — slet afhængigheder med id for afhængigheden.

## Projekt og kalendere

- `planner_update_project` (ændr) — navn, beskrivelse, forfatter, virksomhed, startdato, slutdato, statusdato, fremdriftsmetode og projektets standard for opgavetypen. Projektets startdato er ankerpunktet for nye opgaver. Hvis assistenten ændrer den senere, flyttes kun løse opgaver med (uden foregående opgave og uden en begrænsning, der sætter en nedre grænse, som *Start ikke tidligere end*). Svaret angiver antallet som `anchorsClamped`. Resten af tidsplanen bliver stående. Se [Opret nyt projekt og Projektinfo](docs://ref-projectinfo). Statusdatoen er ikke en etiket, men referencedatoen for beregningen: i en tidsplan uden fremdrift flytter alt sig med. Slutdatoen er kun metadata.
- `planner_move_project` (ændr) — flyt hele den bestaande tidsplan til en ny startdato. Kalendere flyttes ikke med, så slutdatoen kan springe et andet antal dage end startdatoen. Oprindelige planer bliver stående, medmindre assistenten udtrykkeligt beder om at flytte dem også. Se [Flytning af et projekt](docs://howto-project-verplaatsen).
- `planner_update_calendar` (ændr, flere ad gangen) — ændr eller opret kalendere: arbejdsdage, arbejdstimer, pause, tidsbånd, helligdage (genereret for et land og en region, eller angivet direkte) og arbejdsundtagelser. Den kan ikke ændre, hvilken kalender der er projektkalender.

## Ressourcer og tildelingsenheder

- `planner_manage_resources` (ændr, flere ad gangen) — opret, ændr eller slet ressourcer: navn, type (arbejdskraft, udstyr, materiale, underleverandør eller mandskab), beskrivelse, maksimalt antal enheder, omkostning pr. time, enhed, kalender, mandskab og tilgængelighed over tid. Det afvises at slette en ressource med tildelinger, medmindre assistenten udtrykkeligt bekræfter det. Ved en ressource fra et bibliotek er navn, type, beskrivelse, standardsats og enhed låst.
- `planner_manage_assignments` (ændr, flere ad gangen) — tilføj, ændr, flyt eller fjern tildelinger: tildelingsenheder pr. arbejdsdag, kurve og resterende arbejde. Kun på en bladopgave, og samme ressource kun én gang pr. opgave. Hvad en ændring i tildelingsenheder gør ved varigheden, afhænger af opgavens opgavetype, som beskrevet i [Opgavetyper: varighed, tildelingsenheder og arbejde](docs://uitleg-werkregels).
- `planner_level_resources` (ændr) — udjævning fjerner overallokeringer. Som standard holder den sig inden for slækken, så slutdatoen forbliver den samme. Med `constrainToFloat: false` må slutdatoen flytte. Med en tørkørsel får assistenten først en forhåndsvisning uden ændringer. Den springer materiale over. Se [Ressourceudjævning](docs://uitleg-nivelleren).
- `planner_clear_leveling` (ændr) — fjern alle udjævningsforskydninger.

## Styring af oprindelige planer

- `planner_save_baseline` (ændr) — gem den aktuelle tidsplan som oprindelig plan, og gør den straks aktiv. Den genberegner først forældede datoer. Kan ikke bruges i et script.
- `planner_activate_baseline` (ændr) — gør en oprindelig plan aktiv, eller ingen.
- `planner_rename_baseline` (ændr) — omdøb en oprindelig plan.
- `planner_delete_baseline` (ændr) — slet én oprindelig plan. Var det den aktive, bliver den sidste resterende oprindelige plan aktiv, eller ingen, hvis ingen bliver tilbage.

## Fortryd

- `planner_undo` og `planner_redo` — fortryd eller gentag ét trin i det aktive dokument. Historikken er den samme som din egen. Svaret angiver, om noget faktisk blev tilbageført.

## Dokumenter og filer

- `planner_list_documents` (læs) — alle åbne dokumenter med titel, om de er aktive og ændret, antal opgaver, projektstartdatoen og den beregnede slutdato.
- `planner_new_document` — et nyt, tomt dokument i sin egen fane, uden vinduet *Opret nyt projekt*.
- `planner_duplicate_document` — kopier det aktive dokument til en ny fane, til en hvad-nu-hvis-variant eller en udbudsvariant. Kopien er frakoblet og har ingen filsti.
- `planner_switch_document` — gør et andet dokument aktivt. Det er også måden at bekræfte, hvilket dokument assistenten arbejder i, efter at du har skiftet fane.
- `planner_import_schedule` — åbn en tidsplanfil fra disken som dokument: `.ifc`, `.xml` (Primavera P6 eller MS Project, genkendt på indholdet), `.csv`, `.xer` og `.mpp` (MS Project 2010 til 2021). Intet flettes sammen med den aktuelle plan. En CSV har ingen kalender, så datoer kan ændre sig. Kun inden for din brugermappe. Efter en import af CSV, XML eller `.mpp` har dokumentet intet gemmemål; kun en IFC-fil overtager stien.
- `planner_export_ifc` — skriv det aktive dokument som IFC-fil i IFC-skemaet for projektet (standard IFC 4.3 ADD2). Kun inden for din brugermappe, og en eksisterende fil overskrives kun efter udtrykkelig anmodning. Hvis dokumentet er åbnet i et skema, som appen ikke kan skrive (for eksempel IFC2X3), afviser værktøjet selv at skrive over den fil. Projektet forbliver ugemt.

## Vejledning og kildeherkomst

- `planner_get_planning_guide` (læs) — den engelske vejledning for assistenten (principperne i [Planlægning med omtanke](docs://gids-goed-plannen), med de værktøjer for hvert princip), de to færdigheder *goed-plannen* (opsætning af en tidsplan) og *progress-update* (opdatering af fremdrift), eller alt. Vælg med `part`: `guide`, `skill` (begge færdigheder) eller `both`; `both` er standard. For hver færdighed giver det de steder, hvor den hører hjemme, og downloadadresserne. Parameteren `language` accepteres stadig for ældre assistenter, men teksten er altid på engelsk. Den rører ikke tidsplanen.
- `planner_inspect_xer_provenance` (læs) — undersøg den bevarede kildesemantik i en åbnet Primavera P6-fil (`.xer`): hvad filen indeholdt, med tællinger af import og diagnostik. Fritekstfelter fra filen er som standard usynlige; assistenten skal udtrykkeligt spørge om dem. Ressourcenavne er også som standard usynlige, fordi en P6-ressource normalt er en person; ressourcekoderne forbliver synlige. Assistenten skal bede dig om tilladelse, før den henter navnene, for de sendes så til AI-udbyderen. Kan ikke bruges i et script.

## Scriptet

- `planner_batch` — kør et script med højst 100 trin som én ændring: ét trin i fortrydelseshistorikken, én genberegning og én backup. Hvis et trin fejler strukturelt, rulles hele scriptet tilbage, og svaret angiver for hvert trin, hvad der blev udført, hvad der fejlede, og hvad der ikke blev nået. Midlertidige navne (`tmp-…`) fra `planner_add_tasks` gælder i de senere trin. Ikke tilladt som trin: `planner_batch` selv, fortryd og gentag, dokument- og filværktøjerne, `planner_save_baseline`, `planner_get_planning_guide` og `planner_inspect_xer_provenance`. Et script er ikke et programmeringssprog: der er ingen variabler, betingelser eller løkker.

## Når et værktøj afvises

Assistenten får så et svar med en fejlkode og en forklaring.

- `PAUSED` — *Pausér* er slået til.
- `READ_ONLY` — *Skrivebeskyttet* er slået til.
- `DIALOG_OPEN` — en dialog er åben. Det gælder også for læsning, undtagen for `planner_get_planning_guide`. Svaret nævner, hvad der er åbent, med det interne navn, for eksempel `showTaskDialog`.
- `DOC_DRIFT` — du har skiftet fane, mens assistenten arbejdede. Den skal bekræfte med `planner_switch_document`, hvilket dokument den arbejder i.
- `VALIDATION` — argumenterne passer ikke til skemaet, eller den ønskede ændring er ikke tilladt. Svaret nævner feltet.
- `NOT_FOUND` — et id eller et dokument findes ikke.
- `CYCLE` — ændringen ville skabe en cyklisk reference. Alt i kaldet rulles tilbage.
- `SCOPE` — filstien ligger uden for din brugermappe.
- `BACKUP_FAILED` — backuppen før ændringen mislykkedes; ændringen blev ikke udført.
- `INTERNAL` — en uventet fejl under kørsel af et værktøj, for eksempel en filhandling, der mislykkedes. Svaret viser den oprindelige fejlmeddelelse.
- `STALE_PRECONDITION` — hører til broens kontrakt, men ingen af de aktuelle værktøjer returnerer denne kode.

En forespørgsel, der har ventet i køen i mere end 110 sekunder, udføres ikke længere af appen: klienten har allerede fået en timeout. Udførelse ville ændre tingene to gange ved et nyt forsøg. Et kald, der tager mere end 120 sekunder, får en timeout fra broen.

## Det assistenten ikke kan angive

Pr. opgave kan assistenten ikke angive: hængekøje, manuel planlægning, en ekstra begrænsning, noter, farve, opgavekoder, brugerdefinerede felter, eksterne afhængigheder og en udjævningsforskydning manuelt. Appen beregner selv WBS-koden. På projektniveau kan den ikke ændre beregningsprofilen eller beregningsindstillingerne. Indstillinger, tema, sprog, udvidelser og opdateringer ligger uden for rækkevidde, og det samme gælder ressourcebiblioteket. Den har heller ingen rapporter, layouts, filtre eller visning. Årsagen står i [Sådan fungerer AI-forbindelsen](docs://uitleg-ai-koppeling).

## Hvad appen gemmer

- **Tokenet** ligger på denne computer, i appens gemte indstillinger. Det er 64 tegn langt og tilfældigt. *Opret nyt token* erstatter det.
- **Porten** er 3877 som standard. Den kan kun ændres, når broen er stoppet.
- **Logpanelet** gemmer de sidste 500 kald, kun så længe appen er åben. Argumenter og svar afkortes efter 20 kB pr. felt. *Ryd* tømmer listen.
- **Backuppene** ligger i mappen `ai-backups` i appens datamappe; *Åbn backupmappe* bringer dig derhen. De har navnet `<project name>-<timestamp>.ifc`. En gemt projektfil har én mappe på tværs af alle sessioner. Et dokument, du aldrig har gemt, får sin egen mappe pr. session. Der laves én backup pr. dokument, hver gang du starter broen, plus de backups du selv laver med *Lav backup nu*.
- **Udtynding** sker af sig selv, pr. mappe. De seneste 7 dage bliver alle, op til 20. Det, den kørende session har lavet, bliver altid. Derefter bliver én pr. uge i op til 30 dage, én pr. måned i op til et år, og derefter én pr. år. Backups af et dokument, du aldrig har gemt, forsvinder helt efter et år. Filer i mappen, der ikke hører til appen, lades i fred.

## Se også

- [Sådan fungerer AI-forbindelsen](docs://uitleg-ai-koppeling): hvorfor broen er opsat på denne måde, og hvad assistenten må og ikke må.
- [Forbind en AI-assistent (MCP)](docs://howto-ai-assistent-koppelen): start broen, forbind og installer færdigheden.
- [Indstillinger](docs://ref-instellingen): de to AI-kontakter.
- [Meddelelser og advarsler](docs://ref-meldingen): AI-prikken i statuslinjen.

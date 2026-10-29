# KI-verktøy (planner_*)

Alle verktøy en KI-assistent kan kalle via broen, per gruppe, med hva de gjør og hva de avviser. De begynner alle med `planner_`. Meldingen om tilkobling i vinduet *Tilkoblingsdetaljer* viser det gjeldende nummeret, og assistenten får hele listen med beskrivelser fra selve broen (`tools/list`). Hvorfor koblingen virker slik den gjør, står i [Slik fungerer KI-koblingen](docs://uitleg-ai-koppeling). Hvordan du slår den på, står i [Koble til en KI-assistent (MCP)](docs://howto-ai-assistent-koppelen).

## Slik leser du denne listen

**Les** betyr: verktøyet endrer ingenting. Det fungerer også under *Avbrudd* og *Skrivebeskyttet*. En åpen dialog blokkerer det likevel (se *Når et verktøy avvises* nedenfor). Et lesverktøy gir alltid gjeldende datoer. Er tidsplanen utdatert, omberegner det den først, også under *Avbrudd* og *Skrivebeskyttet*. Disse stopper endringer, ikke omberegningen når du leser. Hvis du er midt i en redigering (du drar en stolpe, eller skriver i et felt), omberegner det ikke. KI-assistenten får da datoene fra før redigeringen, med et varsel om at de er utdatert. Er prosjektet i visningen *Datoer slik de er registrert*, omberegner det ikke. KI-assistenten får da de registrerte datoene, med et varsel om at de ikke er omberegnet.

**Endre** betyr: verktøyet endrer prosjektet ditt. Det blir avvist under *Avbrudd*, under *Skrivebeskyttet* og når en dialog er åpen. Det gjelder også for verktøyene uten merking nedenfor (`planner_undo`, `planner_redo`, filverktøyene og dokumentverktøyene, bortsett fra `planner_list_documents`). Elke endring er ett steg i angrehistorikken din. Hvis prosjektdata endres, beregner appen tidsplanen etterpå av seg selv. Du trenger ikke trykke på *Beregn*. Før første endring i et dokument lager appen en sikkerhetskopi, hvis *Automatisk sikkerhetskopiering* er på.

**Flere om gangen** betyr: ett kall kan inneholde flere elementer. Et ugyldig element blir da avvist med en grunn, og de gyldige elementene gjennomføres. Svaret nevner de avviste elementene.

## Les: tidsplan

- `planner_get_project_info` (les) — prosjektdetaljer og nøkkeltall: antall aktiviteter, avhengigheter, ressurser og milepæler, statusdatoen, prosjektslutten og varigheten, om tidsplanen er utdatert, beregningsprofilen og en oversikt over kalenderne. Et godt første kall.
- `planner_get_project_overview` (les) — hele WBS-treet i ett svar: per aktivitets-ID WBS, navn, varighet, tidlige datoer, fremdrift, om den er kritisk, og de utgående avhengighetene med avhengighets-ID.
- `planner_list_tasks` (les) — aktiviteter med filtre (kritiske, status, datovindu, aktiviteter uten avhengigheter) og paginering.
- `planner_get_task` (les) — én aktivitet i detalj: datoer, slakk, fremdrift, begrensninger, tidsfrist, kalender, tilordninger, forgjengere og etterfølgere, avbrudd.
- `planner_get_critical_path` (les) — de kritiske aktivitetene med totalslakk, og avhengighetene som styrer den kritiske banen.
- `planner_list_resources` (les) — ressurser med kapasitet, standardsats, kalender, mannskap, tilgjengelighet og en oversikt over tilordningene. Kommer en ressurs fra biblioteket, viser den hvilke felter som er låst.
- `planner_get_resource_histogram` (les) — belastning mot kapasitet per ressurs, per dag, uke eller måned (uke som standard). Uten tidsvindu og uten ressurser gir det en oversikt per ressurs. Med tidsvindu eller ressurser gir det hele serien og aktivitetene som gir overallokering.
- `planner_get_calendars` (les) — alle kalendere med full definisjon, og hvor mange aktiviteter og ressurser som bruker dem.

## Les: grunnlinjer og avvik

- `planner_list_baselines` (les) — de lagrede grunnlinjene, og hvilken som er aktiv.
- `planner_compare_baseline` (les) — den gjeldende planen mot den aktive grunnlinjen: bare aktivitetene som avviker, og forskjellen i prosjektslutt, i arbeidsdager på den gjeldende kalenderen for prosjektet. Uten aktiv grunnlinje avviser det kallet.
- `planner_analyze_delay` (les) — analyse av forsinkede aktiviteter mot den aktive grunnlinjen: forskjellen i leveringsdato, og de kritiske aktivitetene som har flyttet seg. Uten aktiv grunnlinje avviser det kallet.

## Aktiviteter og struktur

- `planner_add_tasks` (endre, flere om gangen) — opprett aktiviteter, også en nøstet WBS i ett kall. Hver aktivitet får et eget midlertidig navn (`tmp-…`), så at et barn kan vise til forelderen. Uten varighet får en aktivitet 5 arbeidsdager. En milepæl har varighet 0. Alle aktiviteter i ett kall lykkes sammen, eller mislykkes sammen.
- `planner_update_tasks` (endre, flere om gangen) — endre felt på bestående aktiviteter: navn, beskrivelse, varighet med enhet (dager eller timer), varighetstype, arbeidskategori, milepæl, obligatorisk, prioritet, begrensning, tidsfrist, kalender og aktivitetstype. Det finnes også en egen måte å endre fremdrift på: prosent fullført, faktisk start og faktisk slutt. Enhver annen nøkkel avvises med en grunn.
- `planner_delete_tasks` (endre) — slett aktiviteter, inkludert hele undertreet, avhengigheter og tilordninger. Svaret nevner nøyaktig hva som ble slettet sammen med dem.
- `planner_move_task` (endre) — flytt en aktivitet under en annen forelder, med en posisjon. En syklus (en sirkulær referanse), eller at en aktivitet legges under seg selv, avvises.
- `planner_set_task_splits` (endre) — still inn avbruddene for én aktivitet: etter hvor mange arbeidsdager (eller arbeidstimer) det er arbeid, og hvor lenge hvert avbrudd varer, i arbeidsdager (eller arbeidstimer). En tom liste fjerner alle avbrudd. Se [Dele en aktivitet](docs://howto-taak-splitsen).

## Avhengigheter

- `planner_add_dependencies` (endre, flere om gangen) — opprett avhengigheter med en type (`FS`, `SS`, `FF`, `SF` eller den lange skrivemåten) og forsinkelse, for eksempel `+2d`.
- `planner_update_dependencies` (endre, flere om gangen) — endre type, forsinkelse, forgjenger eller etterfølger for en eksisterende avhengighet, med avhengighets-ID. Det er ett steg, i stedet for å slette og opprette på nytt.
- `planner_remove_dependencies` (endre, flere om gangen) — slett avhengigheter med avhengighets-ID.

## Prosjekt og kalendere

- `planner_update_project` (endre) — navn, beskrivelse, forfatter, firma, startdato, sluttdato, statusdato, fremdriftsmodus og prosjektets standard for aktivitetstype. Startdatoen er ankeret for nye aktiviteter. Endrer KI-assistenten den senere, flyttes bare løse aktiviteter med (de uten forgjenger og uten en begrensning som setter en nedre grense, som *Start ikke tidligere enn*). Svaret oppgir antallet i `anchorsClamped`. Resten av tidsplanen blir stående, se [Nytt prosjekt og prosjektinfo](docs://ref-projectinfo). Statusdatoen er ikke bare en merkelapp, men referansedatoen for beregningen: i en tidsplan uten fremdrift flytter alt med. Sluttdatoen er bare metadata.
- `planner_move_project` (endre) — flytt hele den eksisterende tidsplanen til en ny startdato. Kalenderne flyttes ikke med, så slutten kan hoppe et annet antall dager enn starten. Grunnlinjer blir stående, med mindre KI-assistenten uttrykkelig ber om at de også flyttes. Se [Flytte et prosjekt](docs://howto-project-verplaatsen).
- `planner_update_calendar` (endre, flere om gangen) — endre eller opprett kalendere: arbeidsdager, arbeidstimer, pause, tidsbånd, helligdager (generer for et land og en region, eller angi dem direkte) og arbeidsunntak. Den kan ikke endre hvilken kalender som er prosjektkalenderen.

## Ressurser og enheter

- `planner_manage_resources` (endre, flere om gangen) — opprett, endre eller slett ressurser: navn, type (arbeidskraft, utstyr, materiale, underentreprenør eller mannskap), beskrivelse, maksimalt antall, kostnad per time, enhet, kalender, mannskap og tilgjengelighet over tid. Den avviser å slette en ressurs som har tilordninger, før KI-assistenten bekrefter det uttrykkelig. For en ressurs fra biblioteket er navn, type, beskrivelse, standardsats per time og enhet låste.
- `planner_manage_assignments` (endre, flere om gangen) — legg til, endre, flytt eller fjern tilordninger: tildelingsenheter per arbeidsdag, kurve og gjenstående arbeid. Bare på en aktivitet uten underaktiviteter, og samme ressurs bare én gang per aktivitet. Hva en endring i tildelingsenheter gjør med varigheten, avhenger av aktivitetstypen for aktiviteten, som i [Aktivitetstyper: varighet, enheter og arbeid](docs://uitleg-werkregels).
- `planner_level_resources` (endre) — jevn ut overallokeringen. Innenfor slakken som standard, så sluttdatoen blir stående. Med `constrainToFloat: false` kan slutten flytte seg. Med en tørrkjøring får KI-assistenten først en forhåndsvisning, uten at noe endres. Det hopper over materiale. Se [Utjevning av ressurser](docs://uitleg-nivelleren).
- `planner_clear_leveling` (endre) — fjern alle utjevningsforsinkelser.

## Administrer grunnlinjer

- `planner_save_baseline` (endre) — lagre den gjeldende tidsplanen som grunnlinje, og gjør den straks aktiv. Den omberegner først der datoene er utdatert. Kan ikke brukes i et skript.
- `planner_activate_baseline` (endre) — gjør en grunnlinje aktiv, eller ingen i det hele tatt.
- `planner_rename_baseline` (endre) — gi en grunnlinje nytt navn.
- `planner_delete_baseline` (endre) — slett én grunnlinje. Var det den aktive, blir den siste som er igjen aktiv. Er ingen igjen, blir ingen aktiv.

## Angre

- `planner_undo` og `planner_redo` — angre eller gjør om ett steg i det aktive dokumentet. Historikken er den samme som din. Svaret sier om noe faktisk ble angret.

## Dokumenter og filer

- `planner_list_documents` (les) — alle åpne dokumenter med tittel, om de er aktive og endret, antall aktiviteter, prosjektstart og beregnet slutt.
- `planner_new_document` — et nytt, tomt dokument i en egen fane, uten vinduet *Opprett nytt prosjekt*.
- `planner_duplicate_document` — kopier det aktive dokumentet til en ny fane, for en scenarievariant eller en anbudsvariant. Kopien er løsrevet og har ingen filsti.
- `planner_switch_document` — gjør et annet dokument aktivt. Det er også måten å bekrefte, etter at du har byttet faner, hvilket dokument KI-assistenten jobber med.
- `planner_import_schedule` — åpne en tidsplanfil fra disken som dokument: `.ifc`, `.xml` (Primavera P6 eller MS Project, gjenkjent på innholdet), `.csv`, `.xer` og `.mpp` (MS Project 2010 til 2021). Ingenting slås sammen med den gjeldende planen. En CSV har ingen kalender, så datoene kan forskyves. Bare i brukermappen din. Etter import av en CSV, XML eller `.mpp` har dokumentet ikke et lagringsmål. Bare en IFC overtar filstien.
- `planner_export_ifc` — skriv det aktive dokumentet som en IFC-fil i prosjektets IFC-skjema (standard IFC 4.3 ADD2). Bare i brukermappen din, og en bestående fil overskrives bare på uttrykkelig forespørsel. Hvis dokumentet er åpnet i et skjema appen ikke kan skrive (for eksempel IFC2X3), nekter verktøyet å skrive over den filen selv. Prosjektet forblir ulagret.

## Veiledning og opprinnelse av kildene

- `planner_get_planning_guide` (les) — den engelske veiledningen for assistenter (prinsippene i [Planlegg godt](docs://gids-goed-plannen), med verktøyene for hvert prinsipp), de to ferdighetene *goed-plannen* (tidsplan opprettes) og *progress-update* (fremdrift oppdateres), eller alt. Velg med `part`: `guide`, `skill` (begge ferdighetene) eller `both`. `both` er standard. Svaret gir for hver ferdighet hvor den hører hjemme, og nedlastingsadressene. Parameteren `language` godtas fortsatt for eldre assistenter, men teksten er alltid på engelsk. Endrer ikke tidsplanen.
- `planner_inspect_xer_provenance` (les) — undersøk de bevarte opplysningene fra kilden i en åpnet Primavera P6-fil (`.xer`): hva filen inneholdt, med tall for importen og diagnosene. Fritekstfelter fra filen er som standard usynlige. KI-assistenten må spørre uttrykkelig etter dem. Ressursnavn er også som standard skjult, fordi en P6-ressurs vanligvis er en person. Ressurskodene forblir synlige. KI-assistenten må be deg om tillatelse før den henter navnene, fordi de da går til KI-leverandøren. Kan ikke brukes i et skript.

## Skriptet

- `planner_batch` — kjør et skript med høyst 100 steg som én endring: ett angresteg, én omberegning, én sikkerhetskopi. Feiler et steg strukturelt, blir hele skriptet tilbakeført. Svaret sier per steg hva som ble utført, mislyktes, eller ikke ble nådd. Midlertidige navn (`tmp-…`) fra `planner_add_tasks` gjelder i de senere stegene. Ikke tillatt som steg: `planner_batch` selv, angre og gjør om, dokument- og filverktøyene, `planner_save_baseline`, `planner_get_planning_guide` og `planner_inspect_xer_provenance`. Et skript er ikke et programmeringsspråk: der finnes ingen variabler, betingelser eller løkker.

## Når et verktøy avvises

KI-assistenten får da et svar med en feilkode og en forklaring.

- `PAUSED` — *Avbrudd* er på.
- `READ_ONLY` — *Skrivebeskyttet* er på.
- `DIALOG_OPEN` — en dialog er åpen. Det gjelder også for lesing, bortsett fra `planner_get_planning_guide`. Svaret nevner hva som er åpent, med det interne navnet, for eksempel `showTaskDialog`.
- `DOC_DRIFT` — du byttet faner mens KI-assistenten jobbet. Den må bekrefte med `planner_switch_document` hvilket dokument den jobber med.
- `VALIDATION` — argumentene passer ikke til skjemaet, eller den ønskede endringen er ikke tillatt. Svaret nevner feltet.
- `NOT_FOUND` — en ID eller et dokument finnes ikke.
- `CYCLE` — endringen ville skape en syklus (en sirkulær referanse). Alt i det kallet blir tilbakeført.
- `SCOPE` — filstien ligger utenfor brukermappen din.
- `BACKUP_FAILED` — sikkerhetskopien før endringen mislyktes. Endringen ble ikke utført.
- `INTERNAL` — en uventet feil under kjøring av et verktøy, for eksempel en filoperasjon som mislyktes. Svaret gir den opprinnelige feilmeldingen.
- `STALE_PRECONDITION` — er en del av kontrakten for broen, men ingen av de gjeldende verktøyene gir denne koden.

Har en forespørsel stått i køen lenger enn 110 sekunder, utfører appen den ikke lenger. Klienten har allerede fått et tidsavbrudd, og utføring ville endret ting to ganger ved et nytt forsøk. Et kall som tar lenger enn 120 sekunder, får et tidsavbrudd fra broen.

## Hva KI-assistenten ikke kan angi

Per aktivitet kan KI-assistenten ikke angi: hengekøye, manuelt planlagt, en andre begrensning, notater, farge, aktivitetskoder, egendefinerte felt, koblinger mellom prosjekter og en utjevningsforsinkelse for hånd. Appen beregner selv WBS-koden. På prosjektnivå kan den ikke endre beregningsprofilen og beregningsvalgene. Innstillinger, tema, språk, utvidelser og oppdateringer er utenfor rekkevidde, og det samme gjelder biblioteket. Den har heller ingen rapporter, oppsett, filtre eller visning. Hvorfor det er slik, står i [Slik fungerer KI-koblingen](docs://uitleg-ai-koppeling).

## Hva appen lagrer

- **Tokenet** ligger på denne datamaskinen, i de lagrede innstillingene til appen. Det er 64 tegn langt og tilfeldig. *Opprett nytt token* erstatter det.
- **Porten** er som standard 3877, og den kan bare endres når broen er stoppet.
- **Aktivitetspanelet** beholder de siste 500 kallene, bare mens appen er åpen. Argumentene og svarene kappes etter 20 kB per felt. *Tøm* tømmer listen.
- **Sikkerhetskopiene** ligger i mappen `ai-backups` i datamappen til appen. *Åpne backup-mappen* tar deg dit. De heter `<project name>-<timestamp>.ifc`. En lagret prosjektfil har én mappe for alle økter. Et dokument du aldri lagret, får en egen mappe per økt. Det lages én sikkerhetskopi per dokument hver gang du starter broen, i tillegg til sikkerhetskopiene du lager selv med *Ta backup nå*.
- **Opprydding** skjer av seg selv, per mappe. De sikkerhetskopiene fra de siste 7 dagene blir alle værende, til maksimalt 20. Det den kjørende økten laget, blir alltid værende. Deretter blir det én per uke for sikkerhetskopier opptil 30 dager gamle, én per måned opptil ett år gamle, og deretter én per år. Sikkerhetskopiene av et dokument du aldri lagret, forsvinner helt etter ett år. Filer i mappen som ikke hører til appen, lar appen være i fred.

## Se også

- [Slik fungerer KI-koblingen](docs://uitleg-ai-koppeling): hvorfor broen er satt opp slik, og hva assistenten får og ikke får gjøre.
- [Koble til en KI-assistent (MCP)](docs://howto-ai-assistent-koppelen): start broen, koble til og installer ferdigheten.
- [Innstillinger](docs://ref-instellingen): de to KI-bryterne.
- [Meldinger og advarsler](docs://ref-meldingen): KI-prikken i statuslinjen.

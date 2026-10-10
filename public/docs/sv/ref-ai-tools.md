# AI-verktyg (planner_*)

Alla verktyg som en AI-assistent kan anropa via bryggan, per grupp, med vad de gör och vad de avvisar. Alla börjar med `planner_`. Anslutningsrutan i fönstret *Anslutningsuppgifter* visar det aktuella numret. Assistenten får hela listan med beskrivningar från bryggan själv (`tools/list`). Varför länken fungerar som den gör finns i [Så fungerar AI-kopplingen](docs://uitleg-ai-koppeling). Hur du slår på den finns i [Koppla en AI-assistent (MCP)](docs://howto-ai-assistent-koppelen).

## Så läser du listan

**Läs** betyder: verktyget ändrar ingenting. Det fungerar även under *Stoppa tillfälligt* och *Skrivskyddad*. En öppen dialogruta blockerar det dock (se *När ett verktyg avvisas* nedan). Ett läsverktyg ger alltid aktuella datum. Är tidsplanen inaktuell, beräknar det först om, även under *Stoppa tillfälligt* och *Skrivskyddad*. Dessa spärrar ändringar, inte omberäkningen vid läsning. Mitt i en redigering (du drar en balk eller skriver i ett fält) beräknar det inte om. Assistenten får då datumen från före din redigering, med en notis om att de är inaktuella. Är projektet i vyn *Datum som registrerats*, beräknar det inte om. Assistenten får då de registrerade datumen, med en notis om att de inte har beräknats om.

**Ändra** betyder: verktyget ändrar ditt projekt. Det avvisas under *Stoppa tillfälligt*, under *Skrivskyddad* och när en dialogruta är öppen. Det gäller också för verktyg utan markering nedan (`planner_undo`, `planner_redo`, filverktygen och dokumentverktygen, utom `planner_list_documents`). Varje ändring är ett steg i din ångrahistorik. Ändras projektdata, beräknar appen tidsplanen efteråt själv. Du behöver inte trycka på *Beräkna*. Före den första ändringen per dokument skriver appen en backup, om *Automatisk backup* är på.

**Samlat** betyder: ett anrop kan innehålla flera poster. En ogiltig post avvisas då med en orsak, och de giltiga posterna blir kvar. Svaret anger de avvisade posterna.

## Läs: tidsplan

- `planner_get_project_info` (läs) — projektuppgifter och nyckeltal: antal uppgifter, samband, resurser och milstolpar, rapportdatum, projektslut och varaktighet, om tidsplanen är inaktuell, beräkningsprofilen och en sammanfattning av kalendrarna. Ett bra första anrop.
- `planner_get_project_overview` (läs) — hela WBS-trädet i ett svar: per uppgifts-id, WBS, namn, varaktighet, tidiga datum, framdrift, kritisk och de utgående sambanden med deras samband-id.
- `planner_list_tasks` (läs) — uppgifter med filter (kritisk, status, datumintervall, uppgifter utan samband) och sidindelning.
- `planner_get_task` (läs) — en uppgift i detalj: datum, slack, framdrift, restriktioner, måldatum, kalender, tilldelningar, föregående och efterföljande uppgifter, avbrott.
- `planner_get_critical_path` (läs) — de kritiska uppgifterna med deras totalt slack, och de samband som driver den kritiska vägen.
- `planner_list_resources` (läs) — resurser med kapacitet, standardkostnad, kalender, besättning, tillgänglighet och en sammanfattning av deras tilldelningar. Kommer en resurs från ett bibliotek, visar den vilka fält som är låsta.
- `planner_get_resource_histogram` (läs) — belastning mot kapacitet per resurs, per dag, vecka eller månad (standard per vecka). Utan intervall och resurser ger det en sammanfattning per resurs. Med ett intervall eller med resurser ger det hela serien och de uppgifter som orsakar en överbeläggning.
- `planner_get_calendars` (läs) — alla kalendrar med hela deras definition och hur många uppgifter och resurser som använder dem.

## Läs: baslinjer och avvikelser

- `planner_list_baselines` (läs) — de sparade baslinjerna och vilken som är aktiv.
- `planner_compare_baseline` (läs) — den aktuella planen mot den aktiva baslinjen: bara de uppgifter som skiljer sig och skillnaden i projektslut, i arbetsdagar på den aktuella projektkalendern. Utan aktiv baslinje avvisar det anropet.
- `planner_analyze_delay` (läs) — förseningsanalys mot den aktiva baslinjen: skillnaden i leverans och de kritiska uppgifter som har flyttats. Utan aktiv baslinje avvisar det anropet.

## Uppgifter och struktur

- `planner_add_tasks` (ändra, samlat) — skapar uppgifter, inklusive en inbäddad WBS i ett anrop. Varje uppgift får ett eget tillfälligt namn (`tmp-…`), så att en underordnad uppgift kan hänvisa till sin överordnade. Utan varaktighet får en uppgift 5 arbetsdagar. En milstolpe har varaktighet 0. Alla uppgifter i ett anrop lyckas tillsammans eller misslyckas tillsammans.
- `planner_update_tasks` (ändra, samlat) — ändrar fält i befintliga uppgifter: namn, beskrivning, varaktighet med enhet (dagar eller timmar), varaktighetstyp, uppgiftstyp, milstolpe, obligatorisk, prioritet, restriktion, måldatum, kalender och arbetsregel. Verktyget kan också uppdatera framdriften: procent färdig, verklig start och verkligt slut. Varje annan nyckel avvisas med en orsak.
- `planner_delete_tasks` (ändra) — tar bort uppgifter, inklusive hela underträdet, samband och tilldelningar. Svaret anger exakt vad som togs bort tillsammans med dem.
- `planner_move_task` (ändra) — flyttar en uppgift under en annan överordnad uppgift, på en viss plats. Ett cirkelberoende, eller att lägga en uppgift under sig själv, avvisas.
- `planner_set_task_splits` (ändra) — ställer in avbrotten för en uppgift: efter hur många arbetsdagar (eller arbetstimmar) av arbete, och hur många arbetsdagar (eller arbetstimmar) av paus. En tom lista tar bort alla avbrott. Se [Dela upp en uppgift](docs://howto-taak-splitsen).

## Samband

- `planner_add_dependencies` (ändra, samlat) — skapar samband med en typ (`FS`, `SS`, `FF`, `SF` eller den långa formen) och en fördröjning, till exempel `+2d`.
- `planner_update_dependencies` (ändra, samlat) — ändrar typ, fördröjning, föregående eller efterföljande uppgift för ett befintligt samband, via samband-id. Det är ett steg, i stället för att ta bort och skapa på nytt.
- `planner_remove_dependencies` (ändra, samlat) — tar bort samband via samband-id.

## Projekt och kalendrar

- `planner_update_project` (ändra) — namn, beskrivning, författare, företag, startdatum, slutdatum, rapportdatum, framdriftsläge och projektets standard för arbetsregeln. Startdatumet är ankaret för nya uppgifter. Sätter assistenten det senare, flyttas bara lösa uppgifter med (utan föregående uppgift och utan restriktion som sätter en nedre gräns, till exempel *Starta tidigast*). Svaret anger antalet i `anchorsClamped`. Resten av tidsplanen blir kvar, se [Nytt projekt och Projektinfo](docs://ref-projectinfo). Rapportdatumet är inte bara en etikett utan referensdatumet för beräkningen: i en tidsplan utan framdrift flyttas allt med. Slutdatumet är enbart metadata.
- `planner_move_project` (ändra) — flyttar hela den befintliga tidsplanen till ett nytt startdatum. Kalendrarna flyttas inte med. Därför kan slutet hoppa ett annat antal dagar än starten. Baslinjer blir kvar, om assistenten inte uttryckligen låter dem flyttas med. Se [Flytta ett projekt](docs://howto-project-verplaatsen).
- `planner_update_calendar` (ändra, samlat) — ändrar eller skapar kalendrar: arbetsdagar, arbetstider, rast, band, helgdagar (genereras för ett land och en region, eller anges uttryckligen) och undantag i arbetstiden. Den kan inte ändra vilken kalender som är projektkalender.

## Resurser och enheter

- `planner_manage_resources` (ändra, samlat) — skapar, ändrar eller tar bort resurser: namn, typ (arbetskraft, utrustning, material, underentreprenör eller besättning), beskrivning, max enheter, standardkostnad per timme, enhet, kalender, besättning och tillgänglighet över tid. Den vägrar att ta bort en resurs med tilldelningar förrän assistenten uttryckligen bekräftar. För en resurs från ett bibliotek är namn, typ, beskrivning, standardkostnad per timme och enhet låsta.
- `planner_manage_assignments` (ändra, samlat) — lägger till, ändrar, flyttar eller tar bort tilldelningar: tilldelningsenheter per arbetsdag, kurva och återstående arbete. Endast på en lövuppgift, och samma resurs bara en gång per uppgift. Vad en ändring i tilldelningsenheter gör med varaktigheten beror på uppgiftens arbetsregel, se [Arbetsregler: varaktighet, enheter och arbete](docs://uitleg-werkregels).
- `planner_level_resources` (ändra) — jämnar ut överbeläggningar. Som standard inom slacket, så att slutdatumet blir kvar. Med `constrainToFloat: false` får slutdatumet flyttas. Med en provkörning får assistenten först en förhandsvisning utan att något ändras. Material hoppas över. Se [Resursutjämning](docs://uitleg-nivelleren).
- `planner_clear_leveling` (ändra) — rensar alla förskjutningar pga utjämning.

## Hantera baslinjer

- `planner_save_baseline` (ändra) — sparar den aktuella tidsplanen som baslinje och gör den direkt aktiv. Den beräknar om inaktuella datum först. Kan inte användas i ett skript.
- `planner_activate_baseline` (ändra) — gör en baslinje aktiv, eller ingen alls.
- `planner_rename_baseline` (ändra) — byter namn på en baslinje.
- `planner_delete_baseline` (ändra) — tar bort en baslinje. Var det den aktiva, blir den sist kvarvarande baslinjen aktiv, eller ingen om inget finns kvar.

## Ångra

- `planner_undo` och `planner_redo` — ångrar eller gör om ett steg i det aktiva dokumentet. Historiken är densamma som din. Svaret anger om något verkligen återställdes.

## Dokument och filer

- `planner_list_documents` (läs) — alla öppna dokument med titel, om de är aktiva och ändrade, antal uppgifter, projektstart och beräknat slut.
- `planner_new_document` — ett nytt, tomt dokument i en egen flik, utan fönstret *Nytt projekt*.
- `planner_duplicate_document` — kopierar det aktiva dokumentet till en ny flik, för ett hypotetiskt scenario eller en anbudsvariant. Kopian är frikopplad och har ingen sökväg till en fil.
- `planner_switch_document` — gör ett annat dokument aktivt. Det är också sättet att bekräfta, efter att du bytt flik, vilket dokument assistenten arbetar i.
- `planner_import_schedule` — öppnar en tidsplanfil från disken som dokument: `.ifc`, `.xml` (Primavera P6 eller MS Project, känns igen på innehållet), `.csv`, `.xer` och `.mpp` (MS Project 2010 till 2021). Inget slås samman med den aktuella planen. En CSV-fil har ingen kalender, så datum kan förskjutas. Endast inom din användarmapp. Efter import av en CSV-, XML- eller `.mpp`-fil har dokumentet inget sparmål. Endast en IFC-fil ger dokumentet sin egen sökväg.
- `planner_export_ifc` — skriver det aktiva dokumentet som IFC 4.3-fil. Endast inom din användarmapp, och en befintlig fil skrivs bara över på uttrycklig begäran. Projektet förblir osparat.

## Guide och källa

- `planner_get_planning_guide` (läs) — den engelska guiden för assistenter (principerna i [Planera väl](docs://gids-goed-plannen), med verktygen för varje princip), de två skills *goed-plannen* (att sätta upp en tidsplan) och *progress-update* (att uppdatera framdrift), eller allt. Välj med `part`: `guide`, `skill` (båda skills) eller `both`. Standard är `both`. Svaret ger, per skill, de platser där den hör hemma och nedladdningsadresserna. Parametern `language` accepteras fortfarande för äldre assistenter, men texten är alltid på engelska. Rör inte tidsplanen.
- `planner_inspect_xer_provenance` (läs) — granskar den bevarade källsemantiken i en öppnad Primavera P6-fil (`.xer`): vad filen innehöll, med antal för importen och diagnostiken. Fritextfält från filen är som standard osynliga. Assistenten måste uttryckligen begära dem. Kan inte användas i ett skript.

## Skriptet

- `planner_batch` — kör ett skript med högst 100 steg som en enda ändring: ett ångrasteg, en omberäkning och en backup. Om ett steg misslyckas strukturellt, rullas hela skriptet tillbaka. Svaret anger per steg vad som utfördes, misslyckades eller inte nåddes. Tillfälliga namn (`tmp-…`) från `planner_add_tasks` gäller i senare steg. Följande är inte tillåtet som steg: `planner_batch` självt, ångra och gör om, dokument- och filverktygen, `planner_save_baseline`, `planner_get_planning_guide` och `planner_inspect_xer_provenance`. Ett skript är inte ett programmeringsspråk. Det finns inga variabler, villkor eller loopar.

## När ett verktyg avvisas

Assistenten får då ett svar med en felkod och en förklaring.

- `PAUSED` — *Stoppa tillfälligt* är på.
- `READ_ONLY` — *Skrivskyddad* är på.
- `DIALOG_OPEN` — en dialogruta är öppen. Det gäller även för läsning, utom för `planner_get_planning_guide`. Svaret anger vad som är öppet med dess interna namn, till exempel `showTaskDialog`.
- `DOC_DRIFT` — du bytte flik medan assistenten arbetade. Assistenten måste bekräfta med `planner_switch_document` vilket dokument den arbetar i.
- `VALIDATION` — argumenten stämmer inte med schemat, eller den begärda ändringen är inte tillåten. Svaret anger fältet.
- `NOT_FOUND` — ett id eller dokument finns inte.
- `CYCLE` — ändringen skulle skapa ett cirkelberoende. Allt i det anropet rullas tillbaka.
- `SCOPE` — sökvägen till filen ligger utanför din användarmapp.
- `BACKUP_FAILED` — backupen före ändringen misslyckades. Ändringen utfördes inte.
- `INTERNAL` — ett oväntat fel när ett verktyg kördes, till exempel en filåtgärd som misslyckades. Svaret ger det ursprungliga felmeddelandet.
- `STALE_PRECONDITION` — ingår i bryggans kontrakt, men inget av de aktuella verktygen returnerar denna kod.

En begäran som låg i kön längre än 110 sekunder utförs inte längre av appen. Klienten har redan fått en timeout. Om den utfördes skulle saker ändras två gånger vid ett nytt försök. Ett anrop som tar längre än 120 sekunder får en timeout från bryggan.

## Vad assistenten inte kan ställa in

Per uppgift kan assistenten inte ställa in: hängmatta, manuellt schemalagd, en andra restriktion, anteckningar, färg, uppgiftskoder, egna fält, externa samband och en förskjutning pga utjämning för hand. Appen beräknar WBS-koden själv. På projektnivå kan den inte ändra beräkningsprofilen och beräkningsalternativen. Inställningar, tema, språk, tillägg och uppdateringar ligger utanför räckhåll, och det gäller även biblioteket. Den har inte heller rapporter, layouter, filter eller vy. Varför det är så finns i [Så fungerar AI-kopplingen](docs://uitleg-ai-koppeling).

## Vad appen lagrar

- **Token** finns på den här datorn, i appens sparade inställningar. Den är 64 tecken lång och slumpmässig. *Ny token* ersätter den.
- **Porten** är 3877 som standard och kan bara ändras när bryggan är stoppad.
- **Loggpanelen** behåller de senaste 500 anropen, bara medan appen är öppen. Argument och svar kapas efter 20 kB per fält. *Rensa* tömmer listan.
- **Backuperna** ligger i mappen `ai-backups` i appens datamapp. *Öppna backupmapp* tar dig dit. De heter `<project name>-<timestamp>.ifc`. En sparad projektfil har en mapp för alla sessioner. Ett dokument som du aldrig sparade får en egen mapp per session. Per dokument görs en backup varje gång du startar bryggan, plus de backuper du gör själv med *Gör backup nu*.
- **Gallring** sker av sig själv, per mapp. Av de senaste 7 dagarna blir alla kvar, upp till 20. Allt som den pågående sessionen skapade blir alltid kvar. Därefter blir en per vecka kvar i upp till 30 dagar, en per månad upp till ett år, och sedan en per år. Backuperna av ett dokument som du aldrig sparade försvinner helt efter ett år. Filer i mappen som inte hör till appen lämnas ifred.

## Se även

- [Så fungerar AI-kopplingen](docs://uitleg-ai-koppeling): varför bryggan är uppsatt så och vad assistenten får och inte får göra.
- [Koppla en AI-assistent (MCP)](docs://howto-ai-assistent-koppelen): starta bryggan, koppla, installera skillen.
- [Inställningar](docs://ref-instellingen): de två AI-omkopplarna.
- [Meddelanden och varningar](docs://ref-meldingen): AI-pricken i statusfältet.

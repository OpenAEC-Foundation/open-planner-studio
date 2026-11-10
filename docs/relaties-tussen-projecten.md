# Relaties tussen projecten: onderzoek en ontwerp

Datum: 2 november 2026, besluiten bijgewerkt op 3 november 2026, stand van de bouw op 10 november 2026. Status:
ontwerp met besluiten; deel 1 is gebouwd, op stap 1.7 na (in bouw in #860, als vinkje; besluit 10 november). Ethan
besliste over alle keuzes in hoofdstuk 10. De bouw gaat in kleine PR's, in de volgorde van hoofdstuk 9. Wat al
gebouwd is, staat in paragraaf 9.1.

## 1. Doel en grens

Ethan, letterlijk (2 november 2026, via de orkestrator): "het doel is altijd om BETER te zijn dan de concurrentie.
De scope is niet exteren relaties met nog andere bestandsformaten, nee, het gaat om relaties tussen projecten die
allemaal in ifc en door OPS geschreven zijn. Het gaat hier om een klant die dan gelijk in de open aec supercloud wil
werken. Het doel is dus om relaties tussen projecten perfect te krijgen binnen de supercloud en zo perfect als
mogelijk zonder clouddienst erbuiten".

Daaruit volgen drie grenzen:

- **Alleen IFC van OPS.** Een bronproject is een IFC-bestand dat Open Planner Studio schreef. MSPDI, `.mpp`, P6 XML,
  XER en CSV vallen erbuiten. Knownbug 837 (*Bron vernieuwen* vindt een MSPDI-taak niet terug) blijft daarom liggen;
  het werk ervoor staat geparkeerd in draft-PR #796. Voorstel 3 en 4 uit #792 (MS Project en P6) vallen ook weg.
- **Twee standen.** In de SuperCloud zo goed als het kan. Zonder clouddienst, met alleen IFC-bestanden, zo goed
  als mogelijk.
- **Beter dan de concurrentie.** Hoofdstuk 4 zegt per punt wat MS Project, P6 en Asta doen; hoofdstuk 5 zegt waar
  OPS beter wordt.

## 2. Wat er nu is

Dit hoofdstuk beschrijft de app vóór de bouw (2 november 2026). Wat sindsdien veranderde, staat in paragraaf 9.1.

- **Model.** Een externe relatie (`ExternalLink`) koppelt een taak aan een taak in een ander project. Ze rekent op
  een vast **anker**: een datum van de brontaak op het moment van lezen. Er is geen berekening over twee documenten
  tegelijk. Een externe voorganger is een ondergrens (de vroege datum van de bron). Een externe opvolger is een
  bovengrens (de late start of het late einde van de bron, sinds #794).
- **Bewaren.** Alles staat in het IFC, in de pset `OPS_ExternalLink` als één JSON-veld. Een onbekend extra veld blijft
  bij lezen en opslaan staan (`storedExternalLinks` in `src/engine/externalLinks.ts`). Een nieuwe versie van OPS kan
  dus velden toevoegen zonder dat een oudere versie ze weggooit.
- **Bron lezen.** Alleen in de desktop-app, alleen vanaf schijf en alleen voor een bestand uit de recente bestanden
  (`parseExternalSource` in `fileSlice.ts`). De bron gaat door dezelfde laadgrens als openen (#792), en de late datums
  tellen alleen als het bestand ze droeg (#794).
- **Herkennen.** Bij verversen zoekt OPS de bron eerst op project-id (`InternalProjectId` in het IFC), dan op pad.
  Daarna zoekt het de brontaak op taak-id (`OPS_TaskIdentity`). Voor IFC van OPS zijn beide vast.
- **In de browser.** Alleen de handmatige route: project-id, taak-id en anker zelf invullen. In de SuperCloud draait
  OPS in de browser, dus daar is er nu alleen die handmatige route.
- **Wat de planner ziet.** Tokens in de kolommen *Voorgangers* en *Opvolgers*, een grijze spookbalk in de Gantt, het
  label *verouderd* als de bron niet gelezen is, en *Bron vernieuwen* / *Alle externe relaties vernieuwen*.
- **Wat ontbreekt** (uit #792, hoofdstuk 4):
  - het bronproject weet niet dat een ander project ervan afhangt;
  - een wijziging in de bron komt pas door als de planner zelf ververst;
  - een te krap anker geeft alleen negatieve speling, geen melding (knownbug 6);
  - de AI-assistent (MCP) ziet geen externe relaties.

## 3. Hoe OPS nu in de SuperCloud draait

Dit hoofdstuk beschrijft de stand van 2 november 2026, vóór de bouw. Wat OPS sindsdien kan, staat in paragraaf 9.1.

Labels: **GEZIEN** = ik las het zelf in de genoemde bron. **VERMOED** = afgeleid, of uit een bron die ik niet zelf
kon lezen.

### 3.1 Twee manieren

1. **De werkplek (browser).** De SuperCloud laadt de platformbouw van OPS in een iframe op de site van de klant, onder
   `/werkplek/app/planner/`. Het iframe heeft de sandbox `allow-scripts allow-modals` zonder `allow-same-origin`, dus
   een *opaque origin*: geen IndexedDB en geen localStorage. GEZIEN in #706 (DutchSailor, oktober 2026). Openen en
   opslaan via `window.openaecHost` werken daar; GEZIEN in #706.
2. **OpenAEC Linux (gestreamd).** De SuperCloud geeft elke gebruiker een eigen Linux-container met de Linux-versies van
   de tools, gestreamd naar de browser. De werkmap is `OPENAEC_MAP` (in de SuperCloud `/openaec`). GEZIEN in
   OpenAEC-Blueprint#61 en #753. Voor OPS staat #753 nog open; of OPS daar al draait, weet ik niet. Hoe `/openaec` gevuld
   wordt (een gekoppelde schijf of een sync): niet gevonden, VERMOED een koppeling met OpenAEC Storage.

De desktop-app kan ook met de SuperCloud werken via de sync-client `openaec-cloud-desktop`: die zet de bestanden in
een gewone lokale map. GEZIEN in `open-office-studio/docs/supercloud.md`. Voor OPS is dat gewoon werken met
bestanden op schijf (stand B in hoofdstuk 7).

### 3.2 Het hostcontract van OPS

`docs/platformbouw.md` en `src/services/fileAccess/siteHost.ts` beschrijven het. De site zet `window.openaecHost` met
een `storage` van vier functies:

| functie | wat |
|---|---|
| `list({ extensions })` | de bestanden die de tool mag openen |
| `open(id, version?)` | de inhoud; zonder versie de nieuwste, met `file.version` erbij |
| `save({ id?, name, data, baseVersion? })` | een nieuwe versie; `conflict` als het bestand intussen verder is |
| `versions(id)` | de versies, nieuwste eerst |

Een document draagt `siteFileId` en `siteFileVersion` (niet in het IFC, alleen in de sessie en het herstelmanifest).
Verder: `initialFileId`, `taal` en het event `openaec-host-ready`.

Voor relaties tussen projecten mist dit contract vier dingen:

- **een ander bestand volgen**: de host kan de tool niet laten weten dat een bestand een nieuwe versie kreeg;
- **terugzoeken**: er is geen vraag "welke bestanden hangen af van dit bestand?";
- **een melding naar een ander**: de tool kan geen bericht sturen aan de planner van een ander project;
- **een ander bestand tonen**: de tool kan geen tweede tabblad openen (de sandbox heeft geen `allow-popups`).

`list` en `open` zijn er wel. In de werkplek is `list` waarschijnlijk beperkt tot de map van het geopende bestand
(zie 3.3). Met de bestaande vier functies kan OPS dus al een bronproject lezen dat in dezelfde map staat, en met
`versions(id)` zien of het een nieuwe versie heeft. Op 2 november 2026 gebruikte OPS dat nog niet; stap 1.9 bouwde
het (paragraaf 9.1).

### 3.3 Het werkplekprotocol

De werkplek praat met een tool via `postMessage`. Het protocol staat in de issues van DutchSailor bij Open PDF Studio
(OpenAEC-Foundation/open-pdf-studio#694 en open-pdf-studio#704, oktober 2026). GEZIEN daar. De bron is volgens open-pdf-studio#704 de hostcode in
de werkplekrepo, `frontend/apps/werkplek/src/gast/ouder.ts`; die repo kon ik niet lezen.

| soort | wat (samengevat uit #694/#704) |
|---|---|
| `hallo` | handdruk, elke 250 ms tot er antwoord is |
| `open` | bytes van een bestand: "Only the page's file, or a file that `lijst` returned" |
| `opslaan` | nieuwe versie; bij een conflict een kopie en een `melding` |
| `lijst` | "the files this app may open in the folder of the opened file" |
| `versies` | de versies van een bestand |
| `geopend` | de tool zegt welk bestand open is |
| `melding` | de host toont een tekst in zijn eigen statusbalk |
| `ai.vraag` | een vraag aan de assistent, betaald uit het AI-tegoed van de klant |

Belangrijk voor dit ontwerp:

- De tool mag alleen bestanden uit **dezelfde map** lezen. Een installateur en een aannemer zetten hun planning
  meestal in verschillende mappen of zelfs ruimtes. GEZIEN (de tekst van `lijst`).
- Er is **geen bericht van host naar tool** buiten de antwoorden. Een "nieuwe versie"-signaal kan de tool dus alleen
  krijgen door zelf te vragen (`versies`). GEZIEN (het protocol kent geen ander bericht).
- `melding` gaat naar de **eigen** statusbalk van de host, niet naar een andere gebruiker. GEZIEN.
- De werkplekbrug voor OPS vult `window.openaecHost` op basis van deze berichten. VERMOED: #706 zegt dat openen en
  opslaan werken, en `open-calc-studio/docs/supercloud.md` zegt "De host injecteert een bootstrap/berichtbrug binnen
  het frame". Hoe de brug `list` en `versions` van OPS invult, kon ik niet lezen.

### 3.4 OpenAEC Storage

`OpenAEC-Foundation/openaec-storage` is de Frappe-app voor bestanden in de SuperCloud. GEZIEN in de README en
`openaec_storage/api.py` (main, 2 november 2026). Wat er al is:

- **ruimtes** met leden en rollen (`beheerder`, `schrijver`, `lezer`, `gast`), mappen en bestanden met versies;
- **`info(bestand)`** met `huidige_versie` en het slot, en **`versies(bestand)`**;
- **`wijzigingen(ruimte, sinds)`**: een wijzigingenlijst per ruimte met een cursor (voor de sync-client);
- **delen per bestand of map** met een collega (`lezen`, `schrijven`, `beheren`) of als link, en het tabblad
  *Gedeeld met mij*;
- **meldingen** bij delen: een melding in de desk (Notification Log) en een e-mail aan de ontvanger;
- **vergrendelen** (`vergrendel`/`ontgrendel`) en conflictkopieën bij een verouderde `basis_versie`;
- **`kopieer`**: een kopie is een nieuw bestand met dezelfde inhoud, dus ook met hetzelfde project-id in het IFC.

Wat er niet is (gezocht in `api.py` en de README):

- geen push naar een browser of tool (geen `frappe.publish_realtime` in de code);
- geen gegevens over de inhoud van een bestand (zoals "dit bestand hangt af van dat bestand");
- geen manier om een bestand te volgen, en geen melding aan volgers bij een nieuwe versie;
- geen haak of gebeurtenis bij `upload_klaar` voor andere apps. Het ontwerp van Open BIM Platform vraagt die ook
  (`open-bim-platform/docs/superpowers/specs/2026-10-26-open-bim-platform-design.md`, 7.4 punt 2).

### 3.5 Wie bouwt de SuperCloud

- **De repo.** De ontwerpdocumenten heten `openaec-supercloud/docs/apps-harmoniseren.md` en
  `openaec-bench/docs/werkplek.md`, en er is een issue `openaec-supercloud#6` (tools-gateway). GEZIEN als verwijzing
  in het ontwerp van Open BIM Platform en in `open-office-studio/docs/supercloud.md`. De repo zelf is niet zichtbaar
  voor het account Nozzit: niet in OpenAEC-Foundation en niet in een andere organisatie waar ik bij kan. VERMOED:
  een privérepo van OpenAEC Studio BV (de organisatie `OpenAECStudio` heeft 13 privérepo's, waarvan Nozzit er geen
  ziet).
- **Openbaar en bereikbaar** zijn `openaec-storage` (bestanden), `openaec-cloud-desktop` (sync-client) en
  `openaec-accounts-server`/`-client`. GEZIEN.
- **De makers.** DutchSailor (Maarten Vroegindeweij) schreef alle SuperCloud-issues bij de tools (#582, #583, #706,
  #716 hier; #694, #704 bij Open PDF Studio; OpenAEC-Blueprint#61) en is de enige bijdrager aan `openaec-storage`.
  GEZIEN. Over berichten aan de kant van de werkplek zegt `open-office-studio/docs/supercloud.md`: "de beslissing ligt
  bij Jan-Adriaan". GEZIEN; wie dat precies is (VERMOED: JanAdriaan891 op GitHub), heb ik niet kunnen nagaan.

## 4. De concurrentie

Bronnen per bewering. De citaten met "(zelf nagelezen)" heb ik in de ruwe pagina teruggevonden. De andere komen van
researcher-agents op Haiku 5.5, via een ophaaltool die de pagina samenvat; die zijn niet tegen de ruwe pagina
nagekeken. De bronnen uit #792 (hoofdstuk 3) gelden nog.

### 4.1 Microsoft Project

- **Geen automatische update.** "Your project schedule is not updated automatically when external dependencies
  change, so it is important to review and update dependencies regularly." GEZIEN (zelf nagelezen):
  [MS Support, View and update task dependencies (links) across projects](https://support.microsoft.com/en-us/office/view-and-update-task-dependencies-links-across-projects-a69dfdd8-efaa-4157-b53a-a294cf466298).
- **De dialoog *Links Between Projects*** opent bij het openen van een plan met externe links en heeft een kolom
  *Differences*: "Differences usually include a new start or finish date for the external predecessor or external
  successor." Met *Accept* en *All*, en de optie "Automatically accept new external data". GEZIEN (zelf nagelezen),
  zelfde bron. Volgens dezelfde pagina toont MS Project bij het openen ook de gevolgen: "When you open a plan that
  has external links, the external predecessors, external successors, and effects on your schedule are displayed,
  and you can choose to accept any or all changes." GEZIEN (zelf nagelezen, 9 november 2026). Wat die gevolgen zijn
  (alleen de nieuwe datum in *Differences*, of ook wat er in het eigen plan verschuift), is niet vastgesteld: we hebben
  MS Project niet zelf gedraaid.
- **Masterproject.** Een ingevoegd subproject is gekoppeld: "changes in the subproject are reflected in the master
  project, and vice-versa". GEZIEN via de ophaaltool:
  [MS Support, Link projects to create a master project](https://support.microsoft.com/en-us/project/link-projects-to-create-a-master-project-in-project-desktop).
  Of het masterproject live over de subprojecten rekent: niet gevonden.
- **Ontbrekend bestand.** De dialoog toont "File Not Found" en de gebruiker kiest het bestand opnieuw (*Browse*).
  VERMOED: alleen gevonden in een archiefkopie van KB 245845 uit 2003.
- **Project Server / Project Online: *Deliverables*.** Een projectmanager publiceert een levering; anderen nemen er
  een afhankelijkheid op. "all the project managers who have taken a dependency on the deliverable get informed of the
  change with the deliverable when they open their project plan." En: "It is by design that the project manager needs
  to explicitly update the deliverable dates." Een rood uitroepteken toont de wijziging; *Accept Change from Server*
  neemt haar over. GEZIEN (zelf nagelezen):
  [Microsoft Project blog (archief, 2007), Managing cross project dependencies with deliverables](https://learn.microsoft.com/en-us/archive/blogs/project/managing-cross-project-dependencies-with-deliverables).
  De leveringen staan in een SharePoint-lijst. Daarop kan een gebruiker zelf alerts en RSS-feeds instellen: "Users can
  easily setup alerts, create RSS feeds". GEZIEN (zelf nagelezen, 9 november 2026), zelfde bron. Een afnemer kan zo
  een bericht krijgen over een gewijzigde levering, zonder zijn plan te openen. Een automatische melding van een
  conflict is dat niet. Dit is de enige functie die ik vond waarin de andere kant iets merkt.
- **Project Online stopt.** "Microsoft Project Online will retire on September 30, 2026." VERMOED: gezien in een kopie
  van het Microsoft 365 Message Center ([MC1478955](https://mc.merill.net/message/MC1478955)), niet bij Microsoft zelf.
- **Project for the web / Planner.** Geen afhankelijkheden tussen plannen. VERMOED: een forumantwoord, niet van
  Microsoft ([Tech Community](https://techcommunity.microsoft.com/discussions/project/project-for-the-web----how-to-link-tasks-between-different-projects-/4385836)).
- **Een automatische melding aan de andere planner** (e-mail, waarschuwing) bij een conflict of een verschuiving,
  buiten de SharePoint-alerts van Project Server hierboven: niet gevonden.

### 4.2 Primavera P6

- **Open projecten rekenen samen.** Met de optie voor open-ended activiteiten op *Opened Projects*: "Schedules external
  relationships on the backward pass using the latest finish date of all opened projects and external relationship
  dates to calculate late dates of activities." GEZIEN (zelf nagelezen):
  [Oracle P6 Help 90519](https://docs.oracle.com/cd/G18294_01/p6help/en/90519.htm). Op dezelfde pagina staat de
  optie *Ignore relationships to and from other projects*: "Determines whether to ignore activity relationships
  between projects."
- **Automatisch herberekenen is een instelling.** "Schedule automatically when a change affects dates: Mark to
  calculate the schedule each time a significant change is made to an activity, relationship, or resource. If you
  clear this checkbox, changes to activities are reflected in the schedule after you calculate the schedule." GEZIEN
  (zelf nagelezen, 9 november 2026):
  [Oracle P6 Professional, General tab - Schedule Options](https://docs.oracle.com/cd/G48902_01/client_help/en_US/general_tab_-_schedule_options_dialog_box.htm).
  In P6 Professional is twee projecten openen dus niet genoeg voor direct doorrekenen; dat gebeurt alleen met deze
  instelling aan. In P6 EPPM rekent *Schedule Now* alle geopende projecten samen ("This schedules all open projects at
  the same time"), en *Project Scheduled Services* kan automatisch rekenen. GEZIEN (zelf nagelezen, 9 november 2026):
  [Oracle P6 EPPM, Scheduling Projects](https://docs.oracle.com/cd/G18294_01/p6help/en/7878.htm). Of EPPM direct
  herberekent bij elke wijziging, is niet vastgesteld.
- **Relaties bij de activiteit.** "If multiple projects are open, you can create external relationships. You can also
  create new relationships and view or configure existing predecessor or successor relationships, from the
  Relationships detail window." GEZIEN (zelf nagelezen, 9 november 2026):
  [Oracle P6 Help 8004](https://docs.oracle.com/cd/G18294_01/p6help/en/8004.htm).
- **Zonder server.** P6 Professional kan zelfstandig draaien: "With embedded SQLite database as the data store, a
  standalone install becomes a true single-user system. Data is stored in a single file on the client workstation's
  disk". GEZIEN (zelf nagelezen, 9 november 2026):
  [Oracle P6 Professional, Standalone Database FAQ](https://docs.oracle.com/cd/F88968_01/English/Installing/p6_pro_install_config_standalone/89396.htm).
  P6 EPPM werkt met een server.
- **Projecten die niet in de database staan.** Na een import zonder het bronproject houdt een activiteit de datums
  van de verloren relatie in *External Early Start* / *External Late Finish*: "The early start date for imported
  activities with external relationships to projects that do not exist in the database." GEZIEN (zelf nagelezen,
  9 november 2026): [Oracle P6 Help 47222](https://docs.oracle.com/cd/G18294_01/p6help/en/47222.htm). Een gesloten
  project in dezelfde database is een andere toestand; dat onderscheid maakt ook Eastwood Harris (#792). Bij export
  naar XER blijven die datums alleen onder voorwaarden bewaard: het project is eerder geïmporteerd met relaties naar
  projecten die niet in de database staan, en het is berekend met de optie *Ignore Relationships To and From Other
  Projects*. Dan geldt: "the module will preserve the external activity dates". GEZIEN (zelf nagelezen, 9 november
  2026):
  [Oracle P6 Admin, Export projects to an XER file](https://docs.oracle.com/cd/F51303_01/English/admin/p6_pro_importing_exporting/export_projects_to_an_xer_file.htm).
- **Wie hangt van mij af.** Het rapport *Cross Project Relationships* in P6 EPPM "Lists the projects and associated
  activities that are predecessors or successors to the selected project, providing visibility into cross project
  impacts." GEZIEN (zelf nagelezen):
  [Oracle P6 EPPM Reporting 62944](https://docs.oracle.com/cd/G18294_01/English/Admin/p6_eppm_reporting/62944.htm).
  Beide projecten staan in dezelfde database, dus de bron kan de relatie zien, ook bij de activiteit als de projecten
  open staan (zie hierboven). Een melding: niet gevonden.
- **Valkuil.** Een gesloten project met relaties kan negatieve speling geven die de planner niet begrijpt. VERMOED:
  forum ([Planning Planet](https://planningplanet.com/comment/78388)).
- **Primavera Cloud.** Relaties tussen projecten bestaan in het datamodel ("The unique ID of the project that owns the
  predecessor activity"). GEZIEN via de ophaaltool:
  [Oracle Primavera Cloud Data Dictionary](https://docs.oracle.com/cd/E80480_01/help/en/user/233316.htm). Of de cloud
  ze live doorrekent en of er meldingen zijn: niet gevonden.

### 4.3 Asta Powerproject en andere

- **Asta Powerproject.** In de help van Elecosoft vond de researcher geen pagina over links naar een ander
  projectbestand. Planners zeggen dat het kan als meerdere projecten in één bestand staan: "you can have any number
  of open projects in one file and link tasks between projects." VERMOED: forum
  ([Planning Planet](https://planningplanet.com/index.php/comment/90826)).
- **Asta Enterprise.** Volgens Elecosoft werken meerdere gebruikers samen aan projectbestanden, en worden wijzigingen
  meteen gesynchroniseerd. GEZIEN via de ophaaltool, uit twee pagina's: de
  [startpagina van Elecosoft](https://elecosoft.com/us/) en de
  [pagina van Asta Enterprise](https://elecosoft.com/us/products/asta/asta-enterprise/). Over doorrekenen tussen
  projecten of meldingen zeggen die pagina's niets.
- **Smartsheet.** Geen voorgangers over sheets heen; een celkoppeling is de omweg. VERMOED: community-berichten.

### 4.4 Samengevat

| wat | MS Project (bestanden) | Project Server | P6 | OPS op 2 november 2026 |
|---|---|---|---|---|
| bron verandert → eigen plan weet het | bij openen, dialoog *Links Between Projects* | bij openen, rood uitroepteken | geopende projecten rekenen samen (Professional: direct als *Schedule automatically when a change affects dates* aanstaat; EPPM: met *Schedule Now* of geplande diensten); een bronproject buiten de database via opgeslagen externe datums | alleen na *Bron vernieuwen* (desktop) |
| zien wat er in het eigen plan verschuift vóór accepteren | niet vastgesteld (de help noemt "effects on your schedule") | niet gevonden | niet gevonden | nee |
| bron ziet wie ervan afhangt | VERMOED: spooktaak als de bron de link kent | niet vastgesteld (de bron toont alleen de afnemer die een gewijzigde levering ziet) | ja: het rapport *Cross Project Relationships* (EPPM), en met de projecten open het venster *Relationships* | nee |
| melding aan de andere planner | niet gevonden | bij openen een rood uitroepteken; een SharePoint-alert op de lijst met leveringen is in te stellen; een conflictmelding: niet gevonden | niet gevonden | nee |
| werkt zonder server | ja | nee | Professional: ja, met een lokale SQLite-database voor één gebruiker; EPPM: nee | ja |
| werkt in de browser | nee | deels (PWA) | EPPM web | alleen handmatig |

De kolom *P6* geldt voor P6 Professional en P6 EPPM samen; waar ze verschillen, staat de uitvoering erbij. De kolom
*OPS op 2 november 2026* is de stand bij het onderzoek, vóór de bouw van deel 1. Wat sindsdien gebouwd is, staat in
paragraaf 9.1.

In de geraadpleegde bronnen vonden we geen actieve conflictmelding aan de andere planner. Daar kan OPS beter zijn. Of een
product vóór het accepteren toont wat er in het eigen plan verschuift, is niet vastgesteld. Bij MS Project noemt de
help wel "effects on your schedule"; wat dat precies is, weten we niet (4.1). Bij P6 vonden we zo'n stap niet.

## 5. Ontwerp: wat in beide standen geldt

### 5.1 Uitgangspunten

1. **Het anker blijft.** Elke externe relatie houdt haar anker in het IFC. De berekening gebruikt alleen dat anker.
   Zo rekent een plan overal hetzelfde, ook zonder netwerk, en verschuift een plan nooit stil door werk van een ander.
2. **De eigenaar blijft eigenaar.** OPS verandert nooit het andere project. Een conflict geeft een melding aan de
   planners, geen wijziging in andermans plan. Daarom rekent OPS geopende projecten niet samen door, zoals P6 dat
   kan: in de SuperCloud horen de projecten vaak bij verschillende bedrijven.
3. **De bron is de laatst opgeslagen versie.** Het anker komt uit wat de andere planner opsloeg: zijn officiële
   planning, niet zijn halve werk.
4. **Eén route voor verversen.** Bron lezen (door de laadgrens), vergelijken, de gevolgen tonen, accepteren als één
   undo-stap. Alleen de plek waar de bron vandaan komt, verschilt per stand.
5. **Herkennen.** In de SuperCloud eerst op het vaste id van het site-bestand, dan op project-id, dan op pad. Zonder
   cloud op project-id, dan op pad (zoals nu). Het site-id is uniek, ook voor een kopie (`kopieer` in Storage geeft
   een kopie met hetzelfde project-id in het IFC).

### 5.2 Waar OPS beter wordt dan de concurrentie

Elk punt met een voorbeeld. *Aannemer.ifc* hangt af van *Installateur.ifc*: de ruwbouw (Aannemer) gaat FS naar
*Installatie* (Installateur), en *Terreinafwerking* (Aannemer) wacht FS op *Kabels leggen* (Installateur).

1. **De wijziging komt vanzelf binnen.** De aannemer opent zijn planning en ziet een balk: "Installateur.ifc heeft
   een nieuwe versie (12, Anna, 2 november 14:05). 2 koppelingen veranderen. [Bekijken]". MS Project doet dit ook bij
   openen; OPS doet het in de SuperCloud ook terwijl het plan open staat (punt 6.2), en zonder cloud ook als het
   venster weer actief wordt.
2. **Eerst de gevolgen, dan accepteren.** *Bekijken* toont per koppeling het oude en het nieuwe anker, en wat er in
   het eigen plan verschuift: "Accepteren verschuift 4 taken. Het einde van het project gaat van 18 juni naar
   25 juni 2027 (+5 werkdagen)." Daarna *Accepteren* (één undo-stap, met herberekening) of *Later*. Of MS Project bij
   het openen ook de verschuiving in het eigen plan toont, is niet vastgesteld (4.1). P6 rekent geopende projecten
   samen door (in P6 Professional direct als die instelling aanstaat); een voorbeeld vóór accepteren vonden we daar
   niet (4.2).
3. **De bron ziet wie ervan afhangt.** De installateur ziet bij *Installatie*: "Aannemer rekent hierop: Ruwbouw moet
   klaar zijn vóór de start, uiterlijk 15 maart 2027". In de Gantt staat een klein merkteken aan de balk. P6 toont
   relaties tussen projecten in een rapport en, met de projecten open, bij de activiteit; beide binnen één database
   (4.2).
4. **Een conflict gaat naar beide planners.** Zet de installateur *Installatie* eerder dan de aannemer kan leveren,
   dan ziet hij vóór het opslaan: "Na opslaan moet *Installatie* al starten 5 werkdagen vóórdat de ruwbouw van Aannemer
   klaar is." Na het opslaan krijgt de planner van de aannemer een melding met een link. De aannemer ziet na F5 ook zelf een
   regel: "De externe opvolger *Installatie* (Installateur) begint 5 werkdagen voordat deze taak klaar is" (voorstel 2
   uit #792, knownbug 6). In de geraadpleegde bronnen vonden we geen actieve conflictmelding aan de andere planner.
5. **De herkomst van elk anker.** De tooltip zegt: "Anker uit versie 12 van Installateur.ifc, gelezen op 2 november
   14:10". Zonder cloud: de wijzigingstijd van het bestand. Zo is achteraf te zien waarop een plan rekende.
6. **Doorklikken.** Rechtsklik op de koppeling: *Bronproject openen bij deze taak*. In de SuperCloud opent de host
   het bronproject in een nieuw tabblad met de taak geselecteerd; in de desktop-app opent het als tweede document.
7. **De AI-assistent ziet de koppelingen.** De MCP-leestools geven externe relaties terug, en een tool ververst ze
   (voorstel 8 uit #792).

### 5.3 Voorstellen uit #792 die meegaan

- **Voorstel 2** (melding bij een geschonden externe opvolger): punt 4 hierboven. Ook een externe voorganger krijgt
  een melding als het anker verouderd is en verversen het plan later maakt.
- **Voorstel 5** (verversen uit een geopend document, en een knop *Bronbestand kiezen…* in de browser): hoofdstuk 7.
- **Voorstel 6** (lagkalender): een externe lag telt in de lagkalender die het project voor relaties kiest, net als
  een interne lag. Geldt in beide standen. Besloten (keuze 9).
- **Voorstel 7** (*Project verplaatsen*): externe ankers niet meer meeschuiven, want het andere project beweegt niet
  mee. Besloten (keuze 8).
- **Voorstel 8** (MCP en de gidszin over fasen): punt 7 hierboven, en de zin "Kies je een fase, dan geldt de
  koppeling voor elke taak in die fase" in de gids. Besloten (keuze 11).

### 5.4 Wat er in het IFC-formaat verandert

Drie nieuwe velden per koppeling, allemaal optioneel, in het bestaande JSON-veld van `OPS_ExternalLink`:

| veld | wat | voorbeeld |
|---|---|---|
| `sourceRef.siteFileId` | het vaste id van het bronbestand op de site | `"b7c1…"` |
| `sourceVersion` | de versie van de bron bij het lezen (site), of de wijzigingstijd (bestand) | `"12"` of `"2026-11-02T14:05:00Z"` |
| `anchorReadAt` | wanneer OPS het anker las | `"2026-11-02T14:10:00Z"` |

Een oudere versie van OPS laat deze velden bij openen en opslaan staan (`storedExternalLinks` houdt onbekende velden).
Twee randgevallen:

- Ververst een oudere versie het anker, dan blijven `sourceVersion` en `anchorReadAt` op de oude waarde staan. De
  nieuwe versie toont dan nog een keer de balk; *Bekijken* vindt geen verschil en zet de velden goed.
- Bewerkt een oudere versie de koppeling in de dialoog, dan vallen de nieuwe velden weg: de bronroute bouwt een nieuwe
  koppeling (`ExternalLinkDialog.tsx`, `submit`). De nieuwe versie herkent de bron dan weer op project-id en pad,
  zoals nu.

Ethan keurde de drie velden goed op 3 november 2026 (keuze 4).

Het lijstje "wie hangt van mij af" komt niet in het IFC: in de SuperCloud houdt de host het bij, zonder cloud zoekt OPS
het op (6.4 en 7.3). Wel in het IFC komt de map waarin OPS zonder cloud zoekt: een projectinstelling, één per project
(keuze 7, besloten op 3 november 2026). Ook die is optioneel: een oudere versie opent het bestand gewoon. Maar een
oudere versie bewaart haar niet. De reader en de writer van zo'n versie kennen in `OPS_ProjectSettings` alleen hun
eigen velden. Slaat een planner het bestand op met een versie van vóór stap 1.11 (tot en met 2026.44.0), dan is de
map weg en kiest hij haar opnieuw.

## 6. Stand A: in de SuperCloud

### 6.1 Koppelen

In de dialoog *Externe (cross-project) koppeling* komt een route *Project op de site*. OPS vraagt de host om de lijst
(`list`), de planner kiest een project en daarna een taak. OPS leest de bron met `open(id)` door de laadgrens, net als
nu vanaf schijf. De koppeling krijgt `siteFileId` en `sourceVersion` (5.4).

- **Nu al mogelijk:** een bron in dezelfde map als het geopende project (3.3).
- **Nodig van de SuperCloud:** een bron in een andere map of ruimte, of uit *Gedeeld met mij* (contractvoorstel
  C1). In de bouw is dat het gewone geval: de installateur deelt zijn planning vanuit zijn eigen ruimte met de
  aannemer, met recht `lezen` (dat bestaat al in Storage).

### 6.2 Volgen

Bij het openen vraagt OPS voor elke bron de nieuwste versie (`versions(id)`). Is die nieuwer dan `sourceVersion`, dan
verschijnt de balk uit 5.2 punt 1.

- **Nu al mogelijk:** vragen bij het openen, en opnieuw als het tabblad weer actief wordt.
- **Nodig van de SuperCloud:** een bericht van de host als een gevolgd bestand een nieuwe versie krijgt (C2). Dan komt
  de balk ook terwijl de planner werkt, zonder steeds te vragen.

### 6.3 Verversen

*Bekijken* in de balk leest de nieuwste versie (`open(id)`), ververst de ankers in een kopie van het plan, rekent die
door en toont het verschil (5.2 punt 2). *Accepteren* zet het resultaat als één undo-stap. Heeft de planner geen
leesrecht meer, dan krijgt de koppeling de status *Geen toegang tot de bron* en blijft het anker staan.

### 6.4 Wie hangt van mij af

Bij elke opslag stuurt OPS de host de lijst van zijn externe koppelingen per bronbestand mee (C3): eigen taak,
brontaak, richting, type en anker. De host bewaart die per versie. Opent de installateur zijn planning, dan vraagt
OPS de host "wie verwijst naar dit bestand?" en toont dat bij de taken (5.2 punt 3). Iedereen die het bronbestand mag
lezen, ziet naam, taak en datum. De koppeldialoog zegt dat vooraf: "De planners van Installateur zien deze koppeling en
de datum waarop je rekent." (keuze 2, besloten).

### 6.5 Een conflict melden

- **Bij de bron, vóór het opslaan.** OPS vergelijkt de nieuwe datums met de ankers uit 6.4. Wordt een anker van een
  ander project te krap (een externe opvolger daar komt te vroeg, of een externe voorganger daar schuift later), dan
  ziet de planner dat vóór het opslaan (5.2 punt 4).
- **Na het opslaan, naar de ander.** OPS vraagt de host een melding te sturen aan de planners die het afhankelijke
  bestand volgen (C4). Alleen langs een koppeling die het afhankelijke project zelf registreerde (6.4); zo kan niemand
  willekeurige mensen berichten.
- **Ook zonder OPS bij de bron.** Slaat de installateur op via de sync-client of WebDAV, dan draait er geen OPS. De
  aannemer krijgt dan toch het signaal "nieuwe versie" (C2). Later kan de server zelf vergelijken met de headless kern
  van OPS (`@openaec/open-planner-core`), na een gebeurtenis bij een nieuwe versie (C6).

### 6.6 Doorklikken

*Bronproject openen bij deze taak* vraagt de host om het bestand in de werkplek te openen, in een nieuw tabblad, met
het taak-id erbij (C5). De sandbox laat de tool zelf geen tabblad openen.

### 6.7 OpenAEC Linux

Draait OPS als desktop-app in de gestreamde container (Blueprint#61), dan werkt het met bestanden in `/openaec`. Dat is
stand B (hoofdstuk 7). Of OPS daar ook het site-id van een bestand kan weten, hangt af van hoe `/openaec` gekoppeld is;
dat is niet gevonden.

## 7. Stand B: zonder clouddienst

### 7.1 De bron kiezen en lezen

- **Desktop** (ook de sync-map van `openaec-cloud-desktop`, en OpenAEC Linux): elk IFC-bestand via de bestandskiezer,
  niet alleen een recent bestand.
- **Browser zonder host:** een knop *Bronbestand kiezen…* (alle browsers). In Chromium onthoudt OPS het
  bestandshandvat (zoals bij de recente bestanden), zodat later opnieuw lezen één klik voor toestemming kost. In
  andere browsers kiest de planner het bestand opnieuw.
- **Een geopend document** met hetzelfde project-id gaat voor (voorstel 5). Heeft dat document niet-opgeslagen
  wijzigingen, dan neemt OPS het anker standaard uit het opgeslagen bestand en zegt dat. Met het vinkje *Ankers uit
  geopende documenten halen* in de projectinstellingen rekent het project met het geopende document, met de
  niet-opgeslagen wijzigingen (keuze 5, besloten; vorm besloten op 10 november).

### 7.2 Een gewijzigde bron opmerken

In de desktop-app bewaakt OPS de map van elk bronbestand (de feature `watch` van `tauri-plugin-fs`, met de rechten
`watch` en `unwatch`). Verandert een bronbestand, dan verschijnt de balk meteen, ook als het venster al actief is.
Als vangnet kijkt OPS bij het openen van een document en als het venster weer actief wordt naar de wijzigingstijd van
elk bronbestand (desktop: `stat`; Chromium: `getFile().lastModified` met een handvat). Is de tijd anders dan
`sourceVersion`, dan verschijnt dezelfde balk als in de SuperCloud. In de browser is er geen bewaking; daar geldt
alleen het vangnet (keuze 6, besloten).

### 7.3 Wie hangt van mij af

Een knop *Afhankelijke projecten zoeken…* leest de IFC-bestanden in een gekozen map alleen-lezen en zoekt koppelingen
naar dit project (op project-id). Geopende documenten tellen ook mee. Het resultaat staat bij de taken, net als in de
SuperCloud. In de browser: een map kiezen in Chromium, of een paar bestanden kiezen in andere browsers. OPS onthoudt de
map als projectinstelling, zodat de controle bij elk openen vanzelf gaat (keuze 7, besloten). Hoe dat in de browser
uitpakt, staat bij stap 1.11 in paragraaf 9.1.

### 7.4 Meldingen

Zonder cloud is er geen kanaal naar de andere planner. OPS meldt het conflict alleen aan wie het ziet: de afhankelijke
planner na F5, en de bronplanner als hij de afhankelijke projecten kent (7.3).

## 8. Contractvoorstellen voor de SuperCloud

Elk voorstel staat ook als issue bij de SuperCloud (hoofdstuk 11). De namen van berichten en velden zijn een
voorstel; de SuperCloud beslist.

| | behoefte | waar (VERMOED voor de werkplek) | nu |
|---|---|---|---|
| C1 | een bestand buiten de map van het geopende bestand lezen, ook uit *Gedeeld met mij* | werkplek (`lijst`/`open`) | alleen dezelfde map |
| C2 | een bestand volgen: bericht van host naar tool bij een nieuwe versie | werkplek + Storage | alleen zelf vragen (`versies`) |
| C3 | koppelingen tussen bestanden bewaren en terugvragen ("wie verwijst naar dit bestand?") | Storage + werkplek | niets |
| C4 | een melding aan de planner van een ander bestand, langs een geregistreerde koppeling | werkplek + Storage (Notification Log) | `melding` alleen in de eigen statusbalk |
| C5 | een ander bestand openen in een nieuw tabblad, met een plek in dat bestand | werkplek | niets (sandbox zonder popups) |
| C6 | een gebeurtenis bij een nieuwe versie, voor een app op de server | Storage | niets (ook gevraagd door Open BIM Platform) |

## 9. Bouwvolgorde

Stap 1 heeft niets van de SuperCloud nodig. Stap 2 tot en met 4 wachten op de contracten C1–C6 (hoofdstuk 8 en 11).

1. **Zonder iets van de SuperCloud, beide standen.** Elk punt is een eigen kleine PR vanaf `main`, met tests:
   1. *Project verplaatsen* schuift de externe ankers niet meer mee (keuze 8).
   2. Een externe lag telt in de lagkalender van het project, met de terugval en de melding; de gidszin verandert
      (keuze 9).
   3. De herkomst: de drie velden in het IFC-formaat, gevuld bij verversen, en de tooltip "Anker uit …" (keuze 4).
   4. De melding na F5 bij een geschonden externe opvolger (voorstel 2 uit #792).
   5. De balk bij een nieuwe versie van een bron, met *Bekijken* (de gevolgen), *Accepteren* en *Later*; opmerken bij
      openen en als het venster weer actief wordt (keuze 1, en keuze 6 als vangnet).
   6. De map van een bron bewaken in de desktop-app (keuze 6, de feature `watch` van `tauri-plugin-fs`).
   7. Verversen uit een geopend document: standaard het opgeslagen bestand met een melding; met het vinkje *Ankers
      uit geopende documenten halen* het geopende document (keuze 5, voorstel 5).
   8. *Bronbestand kiezen…* in de browser (voorstel 5).
   9. Een bron in dezelfde map op de site (stand A met het bestaande hostcontract, `siteFileId`).
   10. De MCP-tools: externe relaties in de leestools, een tool om te verversen, en de gidszin over fasen (keuze 11).
   11. *Afhankelijke projecten zoeken…* in een map die OPS per project onthoudt, en de waarschuwing vóór het opslaan
       bij de bron (keuze 7, keuze 3 zonder cloud).
2. **Met C1 en C2:** bronnen uit andere mappen en uit *Gedeeld met mij*, en de balk terwijl het plan open staat.
3. **Met C3, C4 en C5:** wie hangt van mij af (met de zin in de koppeldialoog van keuze 2), de melding aan de andere
   planner (keuze 3), doorklikken.
4. **Met C6:** de controle op de server, ook als de bron buiten OPS opgeslagen is.

Toetsen: de rekenregels (verversen, gevolgen, conflict) in `tests/planning/`; de route in de browser met de nep-site
(`?fakeSite=1`), uitgebreid met een tweede project, versies en de nieuwe hostberichten.

Teksten en controle: Trias kiest de teksten die de planner ziet, kort en zakelijk, in alle 28 talen van de app. Een
controle door Ethan in de app vóór de merge is niet meer nodig (opdracht van Ethan via Trias, 7 november 2026: "waarom
zou je het niet afmaken?"). Een echte productkeuze die dit ontwerp niet dekt, gaat wel naar Ethan.

### 9.1 Stand van de bouw (9 november 2026)

Deel 1 wordt helemaal gebouwd. Deel 2 tot en met 4 wachten op de SuperCloud (C1–C6) en worden nu niet gebouwd.

| Stap | Wat | PR | Stand |
|---|---|---|---|
| 1.1 | *Project verplaatsen* laat de externe ankers staan | #807 | gemerged in main |
| 1.2 | Externe lag in de lagkalender | #808 | gemerged in main |
| 1.3 | Herkomst van het anker | #809 | gemerged in main |
| 1.4 | Melding na F5 bij een te krappe externe opvolger | #810 | gemerged in main |
| 1.5 | Balk bij een nieuwe versie van een bron | #811 | gemerged in main |
| 1.6 | De map van een bron bewaken (desktop) | #812 | gemerged in main |
| 1.7 | Verversen uit een geopend document (vinkje in de projectinstellingen) | #860 | open (niet gemerged) |
| 1.8 | *Bronbestand kiezen…* in de browser | #858 | gemerged in main |
| 1.9 | Een bron in dezelfde map op de site | #859 | gemerged in main |
| 1.10 | MCP-tools voor externe relaties | #813 | gemerged in main |
| 1.11 | *Afhankelijke projecten zoeken…* en de waarschuwing vóór opslaan | #857 | gemerged in main |

Wat in de bouw anders liep dan hierboven staat:

- **1.2.** Een harde MSO/MFO-pin met een externe opvolger telt een te late pin op de as van de lagkalender. De
  melding van 1.4 gebruikt dezelfde regel. Een interne SS-keten met ELAPSEDTIME en lag 0 rekent nog niet zo; dat staat
  als VERVOLG in `knownbugs.md` (punt 876).
- **1.4.** Bij SS en SF noemt de melding de werkelijke start als die er is, net als de controle. De algemene
  melding bij een harde pin zegt nog "negatieve speling", ook als de pin staat met speling nul; dat staat als
  VERVOLG in `knownbugs.md` (punt 882).
- **1.5.** Blijven bij een nieuwe versie alle ankerdatums en de status *brontaak ontbreekt* gelijk, dan komt er geen
  balk (paragraaf 5.4 zei: *Bekijken* vindt geen verschil en zet de velden goed); een balk zonder gevolg is ruis.
  Verdwijnt een brontaak of komt ze terug, dan komt er wel een balk, ook als de ankerdatum gelijk blijft. De herkomst
  wordt bijgewerkt bij de volgende *Accepteren* of *Vernieuwen*. Het venster *Bekijken* rekent opnieuw als de planner F5
  drukt terwijl het open staat.
- **1.6.** De bewaking is niet getest in de echte desktop-app: een build op aia wacht op het besluit over de SSD
  (14 november 2026). Het testplan staat als VERVOLG in `knownbugs.md` (punt 883).
- **1.8.** De knop *Bronbestand kiezen…* staat ook in de desktop-app (de bestandskiezer, niet alleen een recent
  bestand, §7.1). In de browser heeft een koppeling geen pad; ze herkent haar bron op project-id, en Chromium onthoudt
  het handvat per project-id. Twee bronbestanden met hetzelfde project-id zijn in de browser dus niet te onderscheiden
  (VERVOLG, `knownbugs.md` punt 974). Bij *Alle externe relaties vernieuwen* vraagt de app alle toestemmingen in één
  keer na de klik. Een bron die niet gelezen is, kiest de planner opnieuw met *Bronbestanden kiezen…* in het
  Relatie-menu. De desktoproute is niet getest in de echte app (punt 970).
- **1.9.** Een koppeling met een site-id leest altijd via de site. Een bron met pad of uit de browser raakt haar
  niet, ook niet bij hetzelfde project-id. Op de site noemt de balk het versienummer en wie de versie opsloeg. Geeft
  de site op `versions` en `open` verschillende versies, dan kan de balk een versie noemen die de app niet las
  (VERVOLG, `knownbugs.md` punt 992). De desktop-app en de MCP-tool lezen geen site (punt 984). De echte werkplek en
  de SuperCloud-vorm van de host zijn niet getest (punt 982).
- **1.10.** De MCP-tool `planner_refresh_external_links` zet ook de herkomst (bronversie en leestijd), en haalt de
  balk van 1.5 weg voor de bronnen die hij las, zoals de app. Alleen een koppeling naar een bron die echt gelezen is,
  wordt ververst; dat geldt ook voor *Alle externe relaties vernieuwen* in de app. Een koppeling die de planner tijdens
  het lezen naar een ander bronbestand zet, houdt haar nieuwe pad en anker.
- **1.11.** Het zoekresultaat staat in het eigenschappenpaneel van de taak, onder *Afhankelijkheden*. Alleen de
  desktop-app schrijft een gekozen map in het IFC-bestand, als `OPS_ProjectSettings/DependentProjectsFolder` (het
  absolute pad). Een map die de planner in Chromium kiest, onthoudt OPS alleen lokaal, als handvat in IndexedDB per
  project-id; bij openen zoekt OPS daar alleen vanzelf als de toestemming al gegeven is (VERVOLG, `knownbugs.md` punt
  977). Andere browsers onthouden niets. Een in de browser gekozen map reist dus niet mee met het bestand. Een
  desktoppad dat al in het bestand staat, blijft bij opslaan in de browser wel in het IFC staan; de browser zoekt er
  niet mee. De vraag vóór opslaan rekent op een kopie van het bestand zoals het opgeslagen wordt, net als het
  afhankelijke project; het geopende document rekent niet. Mislukt die controle, dan valt ze nog stil terug op de
  huidige datums (VERVOLG, `knownbugs.md` punt 995). Met gevonden koppelingen kost elke opslag met de hand extra tijd,
  geschat 2 s bij 10.000 taken (VERVOLG, punt 996). Submappen, de MCP-kant en een melding aan de andere planner zijn er
  nog niet (punten 975, 976 en 979).

## 10. Keuzes voor Ethan (alle besloten)

Op volgorde van belang. Per keuze: wat de planner ziet en doet, de opties, mijn advies en het besluit. Ethan besliste
keuze 10 op 2 november 2026 en de andere keuzes op 3 november 2026. De orkestrator gaf ze door; ze staan ook in de wiki
van de orkestrator (`wiki/besluiten/2026-11-03 …`, bij het onderwerp *Relaties tussen projecten*). Eerdere besluiten
die meetellen:

- **Een vast anker, geen berekening over twee documenten.** Ontwerp 2.9
  (`docs/superpowers/specs/2026-07-06-2.9-research-domein.md` §3, juli 2026). Wie het besloot, staat er niet bij.
- **Het anker van een externe opvolger is de late datum van de bron.** Ethan, 2 november 2026 (voorstel 1 uit #792,
  gebouwd in #794).
- **Een gestarte of klare bronkant geeft de vroege (echte) datum.** Ethan, 2 november 2026 (keuze 10 hieronder).
- **Automatisch opslaan staat uit voor een site-bestand**, omdat elke ronde een nieuwe versie zou maken
  (`docs/platformbouw.md`, #309). Daarom stuurt OPS de koppelingen (C3) alleen mee bij Opslaan.
- **De Rust-kant blijft dun**: elk nieuw command is publiek oppervlak (AGENTS.md). Dat telt bij keuze 6.

### Keuze 1. Wat doet OPS als een bronproject een nieuwe versie heeft?

Voorbeeld: de aannemer opent zijn planning. De installateur sloeg gisteren een nieuwe versie op.

1. **Melding, gevolgen bekijken, één klik accepteren.** De aannemer ziet de balk "Installateur.ifc heeft een nieuwe
   versie (12, Anna, 1 november 16:20). 2 koppelingen veranderen. [Bekijken]". *Bekijken* toont: "Accepteren verschuift
   4 taken; het einde gaat van 18 juni naar 25 juni 2027". Hij klikt *Accepteren* of *Later*.
2. **Automatisch overnemen.** OPS ververst de ankers en rekent zelf; de balk zegt achteraf "2 ankers bijgewerkt uit
   versie 12; het einde ging van 18 juni naar 25 juni 2027. [Ongedaan maken]".
3. **Alleen met de hand**, zoals nu: geen balk; de planner kiest zelf *Alle externe relaties vernieuwen*.

Advies: optie 1 als standaard, met optie 2 als instelling per project. Een plan verschuift dan nooit zonder dat de
planner het ziet, en wie dat wil, kan het automatisch laten gaan. MS Project kent dezelfde twee standen
("Automatically accept new external data"); of MS Project daarbij de gevolgen in het eigen plan toont, is niet
vastgesteld (4.1).

**Besluit (3 november 2026, Ethan):** "Advies". Er verschijnt een balk met de versie, wie hem opsloeg en hoeveel
koppelingen veranderen. *Bekijken* toont de gevolgen. De planner kiest *Accepteren* of *Later*. Er wordt niets
automatisch overgenomen. Optie 2 als instelling per project komt er nu dus niet.

### Keuze 2. Ziet het bronproject wie ervan afhangt?

Voorbeeld: de installateur opent zijn planning en ziet bij *Installatie*: "Aannemer rekent hierop: Ruwbouw moet klaar
zijn vóór de start, uiterlijk 15 maart 2027".

1. **Ja, met naam, taak en datum, voor iedereen die het bronproject mag lezen.** De koppeldialoog zegt dat vooraf: "De
   planners van Installateur zien deze koppeling en de datum waarop je rekent."
2. **Alleen een aantal** ("2 projecten hangen af van deze taak"); naam, taak en datum alleen voor wie ook het
   afhankelijke project mag lezen.
3. **Nee.** Alleen de afhankelijke kant weet ervan, zoals nu.

Advies: optie 1. Een koppeling is een afspraak tussen twee partijen; de bron moet weten waarop de ander rekent, anders
kan hij geen rekening houden met een verschuiving. Optie 2 is veiliger, maar dan ziet de installateur niet *wat* hij
raakt. Dit raakt ook de SuperCloud (C3); zij moeten het beleid kunnen afdwingen.

**Besluit (3 november 2026, Ethan):** optie 1. Naam, taak en datum zijn zichtbaar voor iedereen die het bronproject
mag lezen. De koppeldialoog meldt dat vooraf.

### Keuze 3. Wie krijgt een melding bij een conflict?

Voorbeeld: de installateur zet *Installatie* eerder. Dan moet *Installatie* al starten 5 werkdagen vóórdat de ruwbouw
klaar is.

1. **Beide planners.** De installateur ziet het vóór het opslaan; de aannemer krijgt na het opslaan een melding in de
   SuperCloud (en na F5 een regel in zijn eigen plan).
2. **Alleen de afhankelijke planner**, na F5 in zijn eigen plan.
3. **Geen melding**, alleen negatieve speling (zoals nu).

Advies: optie 1. Zonder cloud wordt het vanzelf optie 2, plus de bronplanner als hij de afhankelijke projecten kent
(7.3).

**Besluit (3 november 2026, Ethan):** optie 1. Beide planners krijgen een melding.

### Keuze 4. Mogen er drie velden bij in het IFC-formaat?

Voorbeeld: de tooltip van een koppeling zegt "Anker uit versie 12 van Installateur.ifc, gelezen op 2 november 14:10".
Daarvoor bewaart OPS per koppeling `sourceRef.siteFileId`, `sourceVersion` en `anchorReadAt` (5.4).

1. **Ja, nu.** Oudere versies van OPS laten de velden staan.
2. **Nee.** Dan is er geen herkomst, en in de SuperCloud alleen herkennen op project-id (een kopie met hetzelfde
   project-id is dan niet te onderscheiden).

Advies: optie 1. Zonder `siteFileId` werkt stand A niet goed, en zonder `sourceVersion` kan OPS niet zien of de bron
nieuwer is.

**Besluit (3 november 2026, Ethan):** optie 1, ja. Ethan keurt hiermee de drie velden in het IFC-formaat goed.

### Keuze 5. Waar komt het anker vandaan als de bron ook open staat, met niet-opgeslagen wijzigingen?

Voorbeeld: één planner heeft *Fase 1.ifc* en *Fase 2.ifc* tegelijk open. Hij verschuift in fase 1 een taak en slaat
nog niet op. Dan ververst hij fase 2.

1. **Uit het opgeslagen bestand**, met de melding "Fase 1.ifc heeft niet-opgeslagen wijzigingen; het anker komt uit
   de opgeslagen versie."
2. **Uit het geopende document**, met de niet-opgeslagen wijziging erbij (dichter bij P6 met beide projecten open).

Advies: optie 1. Dan komt het anker altijd uit iets wat de ander ook kan zien (uitgangspunt 3), en is de herkomst
(keuze 4) altijd een echte versie.

**Besluit (3 november 2026, Ethan):** "1, 2 als optie". Standaard komt het anker uit het opgeslagen bestand, met de
melding. Rekenen met het geopende document (met de niet-opgeslagen wijzigingen) komt erbij als optie.

**Vorm van de optie (10 november 2026, Ethan):** een vaste instelling per project, het vinkje *Ankers uit geopende
documenten halen* in de projectinstellingen (standaard uit), niet een knop per keer. Staat het aan, dan neemt
*vernieuwen* het anker meteen uit het geopende document. De automatische controle (openen, wisselen, terug in het
venster, bron gewijzigd) toont de balk van keuze 1 met de gevolgen; het plan verandert niets zonder klik. Een anker uit
het geopende document heeft geen versie. Wordt de bron daarna opgeslagen zonder andere datum, dan komt er geen balk
en houdt de koppeling "versie onbekend" tot de volgende echte datumwijziging (derde keuze, 10 november: geen balk als
alleen de versie verandert).

### Keuze 6. Zonder cloud: hoe merkt OPS een gewijzigde bron op?

Voorbeeld: de installateur stuurt een nieuwe versie per mail; de aannemer zet die over de oude in zijn projectmap.

1. **Bij openen en als het venster weer actief wordt**: OPS kijkt naar de wijzigingstijd van de bronbestanden en toont
   de balk uit keuze 1.
2. **De map live bewaken**: de balk verschijnt meteen, ook als het venster al actief is. Dat vraagt de `watch`-functie
   van `tauri-plugin-fs` (een Rust-wijziging en extra rechten).
3. **Alleen met de hand**, zoals nu.

Advies: optie 1. Dat dekt het gewone geval zonder de Rust-kant te raken.

**Besluit (3 november 2026, Ethan):** optie 2, "Ja". OPS bewaakt de map van de bron, en de balk uit keuze 1 verschijnt
meteen. Optie 1 blijft als vangnet: bij openen en bij terugkeer naar het venster kijkt OPS naar de wijzigingstijd.
Hiervoor is de feature `watch` van `tauri-plugin-fs` nodig, met de rechten `watch` en `unwatch`. Dat is een
plugin-feature, geen nieuw Rust-command.

### Keuze 7. Zonder cloud: afhankelijke projecten zoeken in een map?

Voorbeeld: de installateur kiest *Afhankelijke projecten zoeken…* en de map `Projecten/Zuidas`. OPS vindt
*Aannemer.ifc* met twee koppelingen naar zijn planning.

1. **Ja, en OPS onthoudt de map per project** (een projectinstelling, dus in het IFC), zodat de controle bij elk openen
   vanzelf gaat.
2. **Ja, maar zonder onthouden**: elke keer de map kiezen.
3. **Nee.**

Advies: optie 1.

**Besluit (3 november 2026, Ethan):** optie 1. OPS onthoudt de map per project, als projectinstelling in het
IFC-bestand.

### Keuze 8. *Project verplaatsen*: externe ankers meeschuiven? (voorstel 7 uit #792)

Voorbeeld: de aannemer verschuift zijn hele project 2 weken. Nu schuiven de ankers mee, met een waarschuwing *externe
ankers*.

1. **Niet meer meeschuiven.** Het andere project beweegt niet mee; het anker blijft de datum van de bron.
2. **Zoals nu**: meeschuiven met een waarschuwing.

Advies: optie 1. Meeschuiven maakt het anker een datum die in geen enkel bronbestand staat. Met keuze 1 komt de echte
datum toch terug bij de volgende versie.

**Besluit (3 november 2026, Ethan):** optie 1. Externe ankers schuiven niet meer mee.

### Keuze 9. Externe lag in de lagkalender van het project? (voorstel 6 uit #792)

Voorbeeld: het project rekent een relatielag in de kalender *24 uur*. Een interne lag van 2 dagen telt dan 48 uur, een
externe lag nu 2 werkdagen in de kalender van de eigen taak.

1. **Ja**: een externe lag telt zoals een interne. De gidszin "De werkdagen en de werktijd tellen in de kalender van je
   eigen taak" verandert.
2. **Nee**: zoals nu.

Advies: optie 1. Een planner verwacht dat een lag overal hetzelfde telt.

**Besluit (3 november 2026, Ethan):** "ik volg hier jouw advies", dus optie 1. Een externe lag telt in de lagkalender
van het project (`lagCalendar`), net als een interne lag. De gidszin over "de kalender van je eigen taak" verandert.
Eén geval vraagt een terugval: de lagkalender is *voorganger* (de standaard) en de voorganger staat in het andere
project, of de lagkalender is *opvolger* en de opvolger staat daar. Die kalender staat niet in het eigen bestand. OPS
telt de lag dan in de kalender van de eigen taak, zoals nu, en meldt dat. Ethan vroeg of dit een aparte optie moest
worden; het antwoord is nee: de projectinstelling geldt overal.

### Keuze 10. Een gestarte of klare bronkant: terugvallen op de vroege datum? (besloten)

Voorbeeld: *Installatie* is al gestart. Haar late start ligt in de berekening ná de werkelijke start; die speling
bestaat niet meer. Gebouwd in #794: het anker valt dan terug op de vroege datum.

1. **Ja**, zoals gebouwd.
2. **Nee**: ook dan de late datum.

**Besluit:** Ethan koos optie 1 op 2 november 2026. Is die kant van de brontaak al begonnen of klaar, dan blijft het
anker de vroege (echte) datum. Het besluit staat in de wiki van de orkestrator en in de PR-tekst van #794. De code
verandert er niet door.

### Keuze 11. MCP-tools en de gidszin over fasen (voorstel 8 uit #792)

Voorbeeld: de planner vraagt de AI-assistent "Welke taken hangen af van een ander project?" Nu ziet de assistent geen
externe relaties.

1. **Ja**: externe relaties in de leestools, een tool om te verversen, en de zin over fasen in de gids.
2. **Nee.**

Advies: optie 1.

**Besluit (3 november 2026, Ethan):** optie 1. De MCP-leestools geven externe relaties terug, er komt een tool om te
verversen, en de gids krijgt de zin "Kies je een fase, dan geldt de koppeling voor elke taak in die fase".

## 11. Issues bij de SuperCloud

De repo `openaec-supercloud` (met de werkplek) is voor ons niet zichtbaar. De issues staan daarom in de openbare
repo van de SuperCloud, `OpenAEC-Foundation/openaec-storage`, in het Nederlands, met per issue een regel "Waar" voor
het deel dat bij de werkplek hoort. Vooraf gezocht: in `openaec-storage` stond alleen #1 (versienummer), en in de
andere repo's van OpenAEC-Foundation was er geen issue voor deze behoeften. In de privérepo kon ik niet zoeken.

| | issue |
|---|---|
| C1 | [openaec-storage#2](https://github.com/OpenAEC-Foundation/openaec-storage/issues/2): een bestand lezen buiten de map van het geopende bestand, ook uit *Gedeeld met mij* |
| C2 | [openaec-storage#3](https://github.com/OpenAEC-Foundation/openaec-storage/issues/3): een bestand volgen, bericht bij een nieuwe versie |
| C3 | [openaec-storage#4](https://github.com/OpenAEC-Foundation/openaec-storage/issues/4): koppelingen tussen bestanden bewaren en terugvragen |
| C4 | [openaec-storage#5](https://github.com/OpenAEC-Foundation/openaec-storage/issues/5): een melding aan de planner van een ander bestand |
| C5 | [openaec-storage#6](https://github.com/OpenAEC-Foundation/openaec-storage/issues/6): een ander bestand openen in een nieuw tabblad |
| C6 | [openaec-storage#7](https://github.com/OpenAEC-Foundation/openaec-storage/issues/7): een haak bij een nieuwe versie, voor een app op de server |

## 12. Bronnen

- Open Planner Studio: `docs/platformbouw.md`, `src/services/fileAccess/siteHost.ts`, `src/engine/externalLinks.ts`,
  #706, #716, #753, #792, #794.
- SuperCloud: OpenAEC-Foundation/OpenAEC-Blueprint#61; open-pdf-studio#694, #704; open-calc-studio#28, #30 en
  `docs/supercloud.md`; open-office-studio `docs/supercloud.md`; open-bim-platform
  `docs/superpowers/specs/2026-10-26-open-bim-platform-design.md`; openaec-storage `README.md` en
  `openaec_storage/api.py` (main, 2 november 2026); ifcx-explorer `docs/reference/studio-integration-recon.md`.
- Concurrentie: de links in hoofdstuk 4. Researcher-agents op Haiku 5.5 zochten de bronnen; de citaten met "(zelf
  nagelezen)" heb ik in de ruwe pagina teruggevonden.

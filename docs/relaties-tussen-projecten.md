# Relaties tussen projecten: onderzoek en ontwerp

Datum: 2 november 2026. Status: onderzoek en ontwerp, nog niets gebouwd. Ethan beslist over de keuzes in
hoofdstuk 7. Tot zijn ja verandert er niets aan het IFC-formaat of aan wat de planner ziet.

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
bestanden op schijf (stand B in hoofdstuk 6).

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
`versions(id)` zien of het een nieuwe versie heeft. OPS gebruikt dat nog niet.

### 3.3 Het werkplekprotocol

De werkplek praat met een tool via `postMessage`. Het protocol staat in de issues van DutchSailor bij Open PDF Studio
(OpenAEC-Foundation/open-pdf-studio#694 en #704, oktober 2026). GEZIEN daar. De bron is volgens #704 de hostcode in
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
  zelfde bron. De dialoog toont dus de nieuwe datum van de externe taak, niet wat er in het eigen plan verschuift.
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
  Dit is de enige functie die ik vond waarin de andere kant iets merkt, en dan pas bij het openen.
- **Project Online stopt.** "Microsoft Project Online will retire on September 30, 2026." VERMOED: gezien in een kopie
  van het Microsoft 365 Message Center ([MC1478955](https://mc.merill.net/message/MC1478955)), niet bij Microsoft zelf.
- **Project for the web / Planner.** Geen afhankelijkheden tussen plannen. VERMOED: een forumantwoord, niet van
  Microsoft ([Tech Community](https://techcommunity.microsoft.com/discussions/project/project-for-the-web----how-to-link-tasks-between-different-projects-/4385836)).
- **Een melding aan de andere planner** (e-mail, waarschuwing) bij een verschuiving: niet gevonden.

### 4.2 Primavera P6

- **Open projecten rekenen samen.** Met de optie voor open-ended activiteiten op *Opened Projects*: "Schedules external
  relationships on the backward pass using the latest finish date of all opened projects and external relationship
  dates to calculate late dates of activities." GEZIEN (zelf nagelezen):
  [Oracle P6 Help 90519](https://docs.oracle.com/cd/G18294_01/p6help/en/90519.htm). Daar ook: "Ignore relationships
  to and from other projects option — Determines whether to ignore activity relationships between projects."
- **Gesloten projecten** tellen mee via *External Early Start* / *External Late Finish*, die als beperkingen werken.
  GEZIEN in #792 (Eastwood Harris). Bij export naar XER blijven ze bewaard: "the module will preserve the external
  activity dates". GEZIEN via de ophaaltool:
  [Oracle P6 Admin, Export projects to an XER file](https://docs.oracle.com/cd/F51303_01/English/admin/p6_pro_importing_exporting/export_projects_to_an_xer_file.htm).
- **Wie hangt van mij af.** Het rapport *Cross Project Relationships* in P6 EPPM "Lists the projects and associated
  activities that are predecessors or successors to the selected project, providing visibility into cross project
  impacts." GEZIEN (zelf nagelezen):
  [Oracle P6 EPPM Reporting 62944](https://docs.oracle.com/cd/G18294_01/English/Admin/p6_eppm_reporting/62944.htm).
  Beide projecten staan in dezelfde database, dus de bron kan de relatie zien. Een melding: niet gevonden.
- **Valkuil.** Een gesloten project met relaties kan negatieve speling geven die de planner niet begrijpt. VERMOED:
  forum ([Planning Planet](https://planningplanet.com/comment/78388)).
- **Primavera Cloud.** Relaties tussen projecten bestaan in het datamodel ("The unique ID of the project that owns the
  predecessor activity"). GEZIEN via de ophaaltool:
  [Oracle Primavera Cloud Data Dictionary](https://docs.oracle.com/cd/E80480_01/help/en/user/233316.htm). Of de cloud
  ze live doorrekent en of er meldingen zijn: niet gevonden.
- **Een Oracle-cloudproduct (2020)** zegt over afhankelijkheden van andere projecten: "In this release, any date
  changes made to the predecessor tasks will not change the dates in the current project." GEZIEN via de ophaaltool;
  welk product het is, is niet zeker ([Oracle, Working with Project Dependencies](https://docs.oracle.com/cd/F12984_01/help/en/user/81703.htm)).

### 4.3 Asta Powerproject en andere

- **Asta Powerproject.** In de help van Elecosoft vond de researcher geen pagina over links naar een ander
  projectbestand. Planners zeggen dat het kan als meerdere projecten in één bestand staan: "you can have any number
  of open projects in one file and link tasks between projects." VERMOED: forum
  ([Planning Planet](https://planningplanet.com/index.php/comment/90826)).
- **Asta Enterprise.** "allows multiple users to work collaboratively across project files … with all updates
  synchronised in real-time." GEZIEN via de ophaaltool
  ([Elecosoft](https://elecosoft.com/us/products/asta/asta-enterprise/)). Over doorrekenen tussen projecten of
  meldingen zegt de pagina niets.
- **Smartsheet.** Geen voorgangers over sheets heen; een celkoppeling is de omweg. VERMOED: community-berichten.
- **Procore Scheduling.** De help over afhankelijkheden noemt geen afhankelijkheden tussen projecten. GEZIEN via de
  ophaaltool, als negatief resultaat.

### 4.4 Samengevat

| wat | MS Project (bestanden) | Project Server | P6 | OPS nu |
|---|---|---|---|---|
| bron verandert → eigen plan weet het | bij openen, dialoog *Links Between Projects* | bij openen, rood uitroepteken | live als beide open zijn; anders opgeslagen externe datums | alleen na *Bron vernieuwen* (desktop) |
| zien wat er in het eigen plan verschuift vóór accepteren | nee, alleen de nieuwe datum van de externe taak | nee | n.v.t. (rekent direct) | nee |
| bron ziet wie ervan afhangt | VERMOED: spooktaak als de bron de link kent | de leverancier ziet de afhankelijkheden | ja, rapport *Cross Project Relationships* | nee |
| melding aan de andere planner | niet gevonden | niet gevonden (alleen bij openen) | niet gevonden | nee |
| werkt zonder server | ja | nee | nee (database) | ja |
| werkt in de browser | nee | deels (PWA) | EPPM web | alleen handmatig |

Geen enkel product dat ik vond, meldt een conflict actief aan de andere planner. Geen enkel product toont vóór
het accepteren wat er in het eigen plan verschuift. Daar kan OPS beter zijn.

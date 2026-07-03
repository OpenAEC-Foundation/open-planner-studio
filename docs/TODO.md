# To-do

Lijst met dingen die we nog willen doen, afgeleid van de roadmap in
[PLAN.md](../PLAN.md) (§6, "Functionaliteiten — Roadmap in 6 Fases").
Hieronder staan **alleen items die nog niet in de code zitten** — wat al af is
(zie Gantt/CPM-engine, IFC/CSV/MSP/P6 I/O, thema's, undo/redo, 14 talen) is
weggelaten. Per fase gegroepeerd zodat het terug te koppelen is naar PLAN.md.

Werkwijze: voeg nieuwe items toe in de juiste fase. Afgeronde items worden uit
deze lijst verwijderd — wat klaar is, staat in de changelog en git-historie.

## Openstaand

### UX & Desktop-shell

- [ ] **Native recovery-dialog vervangen door een echte in-app dialog.** Bij het
      opstarten vraagt de herstel-flow nu via een *native* OS-dialog
      (`ask()` uit `@tauri-apps/plugin-dialog`, tekst `confirm.restoreRecovery`,
      twee aanroepen in `App.tsx`) of een niet-opgeslagen sessie hersteld moet
      worden. Vervang dit door een eigen, gestylede React-dialog (zoals de
      overige dialogen) — consistente look-and-feel en ruimte om meer context te
      tonen (welk(e) document(en), bestandspad, tijdstip van de snapshot).

- [ ] **Taakdialoog (dubbelklik) gelijktrekken met het eigenschappenpaneel.** Dubbelklik op een
  taak opent `TaskDialog` (`src/components/dialogs/TaskDialog.tsx`), maar die biedt alleen de
  fase-1-velden (naam, WBS, omschrijving, type, mijlpaal-vinkje, start, duur, oudertaak). Alles
  wat het `TaskPropertiesPanel` sindsdien kreeg ontbreekt: mijlpaal-soort (start/eind) en
  verplicht-vlag (2.4), datumconstraints + deadline (2.3), voortgang, prioriteit en de
  toewijzingen-sectie (2.5). De dialoog moet dezelfde opties bieden als het paneel — bij
  voorkeur door de secties als gedeelde componenten te delen i.p.v. te dupliceren (zelfde
  patroon als `SettingsPanelContent`/`CalendarForm`), zodat dit niet opnieuw kan divergeren.
- [ ] **Relatietype kiezen bij het slepen van een afhankelijkheid.** Nu maakt de
      sleep-actie op het Gantt-canvas altijd een `FINISH_START`-relatie aan
      (hardcoded in `GanttCanvas.tsx`, bij het loslaten van de dependency-drag).
      Het type en de lag zijn inmiddels wél achteraf te wijzigen (eigenschappen-
      paneel en relatietabel, via `updateSequence`), maar tijdens het slepen kun
      je ze nog niet kiezen. *Aanpak:* toon bij het loslaten een klein
      contextmenu/popover om het relatietype (FS/SS/FF/SF) en eventueel de lag
      te kiezen in plaats van meteen FS aan te maken.

### Distributie & Release

#### Snap-packaging — follow-ups
Snap-packaging is werkend en zit op `main` (zie changelog +
[ontwerp](superpowers/specs/2026-06-26-snap-packaging-design.md)): `snap/snapcraft.yaml`
(core22, strict, gnome-extensie) herverpakt de release-deb, en `snap.yml` bouwt op
tag-push de `.snap` als release-asset. Geverifieerd via een `workflow_dispatch`-run tegen
`v2026.6.0` (groene build, geldig `.snap`, WebKitGTK uit de gnome-runtime). Wat rest:

- [ ] **In-app updater overslaan binnen de snap.** In een read-only strict snap kan de
      Tauri-updater de binary niet vervangen — de Snap Store doet de refresh. Zonder dit
      krijgen snap-gebruikers een "update beschikbaar"-melding die niets kan uitvoeren.
      *Aanpak:* detecteer de snap-runtime via de door snapd gezette env `SNAP`
      (Rust-zijde, dun gehouden conform "keep Rust thin"), geef dat door aan de frontend
      en sla de updater-check over wanneer actief (updater-logica zit in `App.tsx`).
- [ ] **Live gaan in de Snap Store — eigenaar-stappen.** Daarna publiceert de al
      bestaande gated stap in `snap.yml` (`snapcore/action-publish`, kanaal `stable`)
      automatisch bij elke release-tag:
      1. `snapcraft register open-planner-studio` (eenmalig; vereist een Snap Store-account
         en claimt de naam).
      2. Genereer credentials met `snapcraft export-login --snaps open-planner-studio
         --channels stable -` en voeg de output toe als GitHub-repo-secret
         `SNAPCRAFT_STORE_CREDENTIALS`.

### Fase 2 — Professionele Planning (v0.5)

> §2.1 Volledige dependencies is afgerond (lag-eenheid, procent-lag, leads, driving-markering,
> relatietabel, path tracing) — zie changelog en
> [ontwerp](superpowers/specs/2026-07-02-volledige-dependencies-design.md).

> §2.2 WBS & structuur is afgerond (auto-nummering, activity codes, custom fields,
> groeperingsweergave, WBS-templates; kopieer/plak bestond al) — zie changelog en
> [ontwerp](superpowers/specs/2026-07-02-wbs-structuur-design.md). Bewust v2: WBS-maskers/
> prefixen, hiërarchische codewaarden, indicator-velden/formules, adapter-export van
> codes/velden (CSV/MSPDI/P6), N×N-matrix.

> §2.3 Constraints & deadlines is afgerond (alle 8 datum-constraints in CPM met
> P6-soft-semantiek, deadline per taak, negatieve float, Gantt-indicatoren +
> statusbar-waarschuwingen) — zie changelog en
> [ontwerp](superpowers/specs/2026-07-02-constraints-deadlines-design.md).
> Bewust 2.9: logica-brekende Mandatory-pins, secundaire constraints,
> scheduling-options (float-berekeningswijze, honor-toggle, retained logic).

> §2.4 Mijlpalen is afgerond (start-/eindmijlpalen via het dag-granulaire
> grens-model naar P6-voorbeeld, verplichte/contractuele mijlpalen met
> inspectiemoment-knop, mijlpalen-overzicht als tweede rapporttype) — zie
> changelog en [ontwerp](superpowers/specs/2026-07-02-mijlpalen-design.md).
> Bewust later: MTA/baseline-variance (vereist 2.6-snapshots),
> checklijsten bij inspectiemomenten (fase 3.2).

> §2.5 Resources is afgerond (vijf resourcetypes incl. ploeg, tijd-gefaseerde
> capaciteit, toewijzingen met units/dag + zes verdeelcurves, belasting- en
> overallocatie-engine in runCPM, resource-nivellering én smoothing via serieel
> SGS met float-constraint, Resources-ribbontab + beheerpaneel + histogramstrook
> + nivelleer-dialoog, IFC/P6/MSPDI-round-trip, taak-prioriteit) — zie changelog
> en [ontwerp](superpowers/specs/2026-07-03-resources-design.md). Bewust later:
> resource-kalenders zijn nu informatief (registry), nog niet hard afgedwongen in
> de scheduling; kostenkoppeling van resources hoort bij fase 3.5.

#### 2.6 Baselines & voortgang
- [ ] Baseline opslaan (snapshot van huidige planning)
- [ ] Meerdere baselines (onbeperkt)
- [ ] Baseline vergelijking (visueel overlay in Gantt)
- [ ] Baseline-variance rapport
- [ ] Statusdatum instellen
- [ ] Voortgangslijnen in Gantt
- [ ] Out-of-sequence progress detectie
- [ ] Progress override opties (Retained Logic / Progress Override)

#### 2.7 Weergaven
- [ ] Extra tijdschalen: uur en jaar als directe keuze (kwartaal bestaat al)
- [ ] Kolom-aanpassing in tabel (kies zichtbare velden)
- [ ] Groeperen op elk veld (WBS, fase, resource)
- [ ] Sorteren op elk veld
- [ ] Filteren met AND/OR-logica
- [ ] Custom layouts opslaan/laden
- [ ] Presentation mode (full screen Gantt)
- [ ] Split view (meerdere planningen naast elkaar)
- [ ] Mini-map (thumbnail overzicht)

#### 2.8 Kalender-uitbreidingen
- [ ] **Hardgecodeerde bouwvak/feestdagen in de standaardkalender opknappen.** `createDefaultCalendar()`
  (`src/types/calendar.ts`) bakt een vaste 2026-feestdagenlijst in, inclusief drie weken
  "Bouwvak (regio Noord)" (20 jul – 7 aug 2026). Drie problemen: (1) de regiokeuze is willekeurig
  (Noord/Midden/Zuid hebben verschoven weken); (2) alle datums zijn jaargebonden — projecten in 2027
  hebben stilzwijgend géén feestdagen meer; (3) gebruikers zien niet dat er drie weken vakantie in hun
  planning zit tot een taak eroverheen valt (kwam uit de fase-2.5-QA: een 5-daagse taak leek een
  "opgerekte balk van vier weken"). Richting: feestdagen jaar-onafhankelijk genereren voor de
  projectperiode, bouwvak-regiokeuze + feestdagenoverzicht in de projectwizard (kalender-presets in
  `ProjectInfoDialog`), en evt. een naamlabel in de Gantt-arcering bij meerdaagse feestdagen.
- [ ] Meerdere kalenders per project
- [ ] Taak-specifieke kalender
- [ ] Duitse feestdagen (per Bundesland)
- [ ] Europese feestdagensets (BE, FR, VK, AT, CH)
- [ ] Seizoensgebonden kalenders
- [ ] Winterstop/vorstperiode
- [ ] 24-uurs kalender
- [ ] Dag/nacht ploegen-kalender
- [ ] Uren-based en minuten-based scheduling

#### 2.9 Geavanceerde CPM
- [ ] Alle constraint-types meenemen in CPM-berekening
- [ ] Hammock-taken
- [ ] Externe dependencies (cross-project links)
- [ ] Near-critical path analyse
- [ ] Meerdere kritieke paden
- [ ] Interfering float
- [ ] Scheduling options (keuze berekeningsmethoden)

#### 2.10 Gebruikersdocumentatie (afsluiter van fase 2)
- [ ] **Volledige gebruikersdocumentatie schrijven** — aan het einde van fase 2, als alle
  planningsfeatures er zijn. Gebruikers moeten nu nog gokken hoe alles werkt; er is geen
  handleiding. Dekking: projecten aanmaken (wizard, kalender-presets), taken/WBS/inspringen,
  relaties + lags, constraints + deadlines, mijlpalen (soorten, verplicht), resources
  (types, kalenders, capaciteitsstappen, toewijzen, curves), histogram lezen, nivelleren vs.
  smoothing (en wanneer welke), rapporten/printen, import/export (IFC/P6/MSP/CSV, incl. wat
  wél/niet meereist per formaat), multi-document, sneltoetsen, instellingen en de updater.
  Vorm: gebruikersgericht (taakgericht "hoe doe ik X", niet feature-opsomming), NL als brontaal,
  vindbaar vanuit de app (Backstage → Help of vergelijkbaar), met screenshots. Bestaande
  vindplaats voor auteurs: alleen `docs/extensions.md` (extensie-auteurs) — eindgebruikers
  hebben nu niets.

### Fase 3 — Bouwsector & Nederlandse Features (v1.0)

#### 3.1 Lean Construction & Last Planner System
- [ ] Phase Planning / Pull Planning (faseplanningsbord)
- [ ] Look-ahead Planning (6-8 weken vooruit, constraint-check)
- [ ] Weekly Work Plan (weekplanning met commitments)
- [ ] Commitment tracking (wie belooft wat)
- [ ] PPC-berekening (Percent Plan Complete) + dashboard
- [ ] Variance/Root Cause analysis
- [ ] Constraint log (belemmeringen-register)
- [ ] Constraint-ready indicator (taak kan starten: groen/rood)
- [ ] Make-ready process tracking
- [ ] Takt planning (repetitieve eenheden, bijv. per verdieping)
- [ ] Kanban-bord weergave
- [ ] Digitaal post-it bord (collaborative planning)
- [ ] Dagstart-dashboard (daily huddle board)
- [ ] Naadloze integratie LPS ↔ CPM (geen dubbel werk)

#### 3.2 Nederlandse bouwstandaarden
- [ ] RAW-besteksposten koppelen aan taken
- [ ] STABU-bestekscodes in WBS
- [ ] UAV-gc ondersteuning (Systems Engineering, V&V-planning)
- [ ] BRL-normen koppelen aan inspectiemomenten
- [ ] Wkb (Wet kwaliteitsborging) kwaliteitsborgingsplan-integratie
- [ ] CROW-publicaties referenties (bijv. CROW 400)
- [ ] Nederlandse aanbestedingsfasen (Aanbestedingswet 2012)
- [ ] VISI-koppeling (NL bouwcommunicatiestandaard)
- [ ] BLVC-plan (Bereikbaarheid, Leefbaarheid, Veiligheid, Communicatie)
- [ ] Asbestinventarisatie-milestones
- [ ] Omgevingsvergunning-milestones
- [ ] V&G-plan taken (veiligheidsmaatregelen)
- [ ] Bouwlogistiek planning

#### 3.3 Duitse/DACH bouwstandaarden
- [ ] VOB/B ondersteuning (Terminplanung conform VOB)
- [ ] HOAI-fasen (Leistungsphasen 1-9) als WBS-structuur
- [ ] DIN-normen referenties

#### 3.4 Earned Value Management (EVM)
- [ ] BCWP, BCWS, ACWP berekeningen
- [ ] CPI (Cost Performance Index)
- [ ] SPI (Schedule Performance Index)
- [ ] EAC (Estimate at Completion)
- [ ] S-curve (cumulatieve voortgang/kosten)
- [ ] Kostencurve (gepland vs. werkelijk)
- [ ] Cashflow-prognose
- [ ] EVM-dashboard

#### 3.5 Kosten & budget
- [ ] Kostenberekening per taak (uren × tarief + materiaal)
- [ ] Budget vs. actual kosten tracking
- [ ] Cost loading (kosten verspreid over taakduur)
- [ ] Kostenrapportage
- [ ] Budget-overschrijding waarschuwingen

#### 3.6 Weergave-uitbreidingen
- [ ] Netwerkdiagram (PDM/Activity-on-Node)
- [ ] Line of Balance (LOB) diagram voor repetitieve werken
- [ ] Kalenderweergave (maandoverzicht)
- [ ] Timeline-weergave (horizontale tijdlijn, MS Project-stijl)

#### 3.7 Bouwspecifieke features
- [ ] Weercondities per taak (buitenwerk/binnenwerk markering)
- [ ] Inspectiemomenten als verplichte mijlpalen met checklijst
- [ ] Fasering-templates (fundering, ruwbouw, afbouw, installatie, oplevering)
- [ ] Seizoensgebonden restricties (geen buitenwerk in winter)
- [ ] Kraanplanning (beschikbaarheid, capaciteit)
- [ ] Bouwplaatsinrichting-milestones

#### 3.8 Import/export
- [ ] MS Project MPP import (readonly)
- [ ] Primavera XML (PMXML) import/export
- [ ] Asta Powerproject PP import
- [ ] SVG-export van Gantt (PNG bestaat al)
- [ ] iCalendar (.ics) export
- [ ] Clipboard-ondersteuning (kopieer taken naar Excel)

#### 3.9 Rapportage
- [ ] Afdrukken naar printer (multi-page)
- [ ] Rapport-wizard (kies inhoud, layout, filters)
- [ ] Standaard rapporten: taaklijst, kritiek pad, resources, voortgang
- [ ] Custom rapporten (kies velden, groepering, filters)
- [ ] Grafische rapporten (histogrammen, pie charts)
- [ ] Look-ahead rapport (komende 3/6/8 weken)
- [ ] Voortgangsrapport (per periode)
- [ ] Executive dashboard (samenvatting op 1 pagina)
- [ ] Opleverpuntenlijst
- [ ] Kostenrapport

> §3.10 Volledige meertaligheid is afgerond (14 locales) — staat daarom niet als to-do.

### Fase 4 — 4D/5D BIM & Geavanceerde Analyse (v2.0)

#### 4.1 4D BIM
- [ ] IFC-gebouwmodel laden en renderen (Three.js + web-ifc)
- [ ] Taken koppelen aan IFC-elementen (drag & drop)
- [ ] 4D simulatie: tijdlijn-animatie
- [ ] Bouwfase-visualisatie (kleurcodering per status)
- [ ] Scrub door tijdlijn (slider)
- [ ] Camera-posities opslaan
- [ ] Screenshot/video-export van simulatie
- [ ] BIM-model filteren op verdieping/sectie
- [ ] Transparantie voor toekomstige elementen

#### 4.2 5D kosten-koppeling
- [ ] Quantity takeoff vanuit BIM-model
- [ ] Kosten koppelen aan IFC-elementen
- [ ] 5D visualisatie (kosten per fase in 3D)
- [ ] Cumulatieve kostencurve gekoppeld aan 4D-simulatie

#### 4.3 Risico-analyse
- [ ] Probabilistische duurschatting (3-point: optimistisch/realistisch/pessimistisch)
- [ ] Monte Carlo simulatie (Rust backend)
- [ ] Tornado-diagram (gevoeligheidsanalyse)
- [ ] Risico-register met koppeling aan taken
- [ ] Confidence level-analyse (P50, P80, P90 einddatums)
- [ ] Weather-risk integration (historische weersdata)

#### 4.4 Claims & delay analysis
- [ ] As-planned vs. as-built vergelijking (visueel)
- [ ] Time Impact Analysis (TIA)
- [ ] Window analysis (period-by-period delay)
- [ ] Delay-rapport genereren
- [ ] Snapshot-vergelijking (wijzigingen per periode)
- [ ] Trend-analyse (voortgang per week/maand)

#### 4.5 Clashdetectie & ruimtelijke analyse
- [ ] Detectie gelijktijdige werkzaamheden op zelfde locatie
- [ ] Kraanreikwijdte-analyse
- [ ] Hijszone-conflicten
- [ ] Logistieke route-conflicten
- [ ] Veiligheidszone-analyse

#### 4.6 Geavanceerde weergaven
- [ ] Tijd-weg diagram (lineaire projecten: wegen, tunnels, spoor)
- [ ] 3D Gantt (locatie × tijd × activiteit)
- [ ] Resource-heatmap (overbelasting visueel)
- [ ] Dashboard-builder (drag & drop widgets)

### Fase 5 — AI, Automatisering & Integratie (v3.0)

#### 5.1 MCP-server (AI-integratie)
- [ ] MCP-server voor Claude en andere AI-assistenten
- [ ] Alle planning-operaties als MCP tools (zie PLAN.md §5.2 tool-lijst)
- [ ] Natural language planning ("maak fundering in week 10, 3 dagen, 2 timmerlieden")
- [ ] AI-gestuurde planning suggesties
- [ ] AI risico-analyse
- [ ] AI resource-optimalisatie
- [ ] AI duurschatting op basis van historische data
- [ ] Conversational planning (chat-interface in app)
- [ ] Publieke TypeScript API-laag (`window.planner`) als basis hiervoor

#### 5.3 ERPNext-integratie
- [ ] Projecten synchroniseren (planning ↔ ERP)
- [ ] Inkoop-triggers vanuit planning (materiaalbestelling bij start taak)
- [ ] Timesheet-koppeling (uren ↔ voortgang)
- [ ] Factuurmomenten koppelen aan mijlpalen
- [ ] Kosten-synchronisatie (budget ERP ↔ planning)
- [ ] Subcontractor-management

#### 5.4 Automatisering
- [ ] Macro's/scripting (TypeScript API)
- [ ] REST API (voor externe integraties)
- [ ] Regels/triggers (als X dan Y)
- [ ] Batch-updates (bulk wijzigingen)
- [ ] Automatische resource-toewijzing (AI-gestuurd)
- [ ] Templates met parametrisering (bijv. "woning, 3 verdiepingen, met kelder")
- [ ] Planning-validatie regels (check op ontbrekende dependencies)

#### 5.5 Externe integraties
- [ ] BIM Collaboration Format (BCF) import/export
- [ ] Relatics-koppeling (UAV-gc SE)
- [ ] VISI-koppeling (communicatieprotocol)
- [ ] Procore-koppeling
- [ ] BIM360/Autodesk Construction Cloud koppeling
- [ ] Trimble Connect koppeling
- [ ] Webhook-ondersteuning (events naar externe systemen)

### Fase 6 — Samenwerking, Cloud & Enterprise (v4.0)

#### 6.1 Multi-user samenwerking
- [ ] Gelijktijdig bewerken (CRDT-based conflict resolution)
- [ ] Gebruikersrechten/rollen (admin, planner, viewer, subcontractor)
- [ ] Audit trail (volledige wijzigingslog: wie/wanneer/wat)
- [ ] Commentaar per taak (threaded discussions)
- [ ] @mentions en notificaties
- [ ] Bijlagen per taak (foto's, PDF's, documenten)
- [ ] Subcontractor-portal (beperkte toegang)

#### 6.2 Cloud-synchronisatie
- [ ] Cloud storage backend (self-hosted of managed)
- [ ] Realtime sync (WebSocket/CRDT)
- [ ] Offline mode (werk lokaal, sync later)
- [ ] Versiegeschiedenis (terugkeren naar eerdere versie)
- [ ] Project-sharing (link delen)
- [ ] Multi-project portfolio-overzicht

#### 6.3 Mobiele app
- [ ] PWA of native Tauri Mobile
- [ ] Voortgang registreren in het veld (foto + % gereed)
- [ ] Dagplanning bekijken
- [ ] Push-notificaties
- [ ] Offline voortgangsregistratie
- [ ] QR-code scanning voor locatie-registratie

#### 6.4 Enterprise features
- [ ] Single Sign-On (SSO) / SAML / OAuth2
- [ ] LDAP/Active Directory integratie
- [ ] Multi-project resource pool
- [ ] Portfolio-management (overzicht alle projecten)
- [ ] Cross-project dependencies
- [ ] Organisatie-breed dashboard
- [ ] Capaciteitsplanning (organisatie-niveau)
- [ ] Compliance-rapportage (BRL, Wkb, VOB/B)
- [ ] Data-export voor BI-tools (Power BI, Tableau)
- [ ] White-label opties

#### 6.5 Communicatie & notificaties
- [ ] E-mail notificaties bij wijzigingen
- [ ] Push-notificaties (desktop + mobiel)
- [ ] Weekrapport automatisch genereren en versturen
- [ ] Slack/Teams integratie
- [ ] Agenda-integratie (Outlook, Google Calendar)

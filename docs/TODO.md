# To-do

Lijst met dingen die we nog willen doen, afgeleid van de roadmap in
[PLAN.md](../PLAN.md) (§6, "Functionaliteiten — Roadmap in 6 Fases").
Hieronder staan **alleen items die nog niet in de code zitten** — wat al af is
(zie Gantt/CPM-engine, IFC/CSV/MSP/P6 I/O, thema's, undo/redo, 14 talen) is
weggelaten. Per fase gegroepeerd zodat het terug te koppelen is naar PLAN.md.

Werkwijze: voeg nieuwe items toe in de juiste fase. Vink af door het item naar
**Afgerond** onderaan te verplaatsen (met datum).

## Openstaand

### Fase 1 — Fundament (MVP) — restpunten
Fase 1 is grotendeels af; dit zijn de laatste gaten.

- [ ] Multi-document: meerdere projecten tegelijk open (FileTabBar)
- [ ] Nieuw-project wizard (nu alleen reset naar leeg project)

### Fase 2 — Professionele Planning (v0.5)

#### 2.1 Volledige dependencies
- [ ] Negatieve lag (lead/overlap) volledig correct in CPM (nu deels)
- [ ] Lag in werkdagen vs. kalenderdagen
- [ ] Procentuele lag (bijv. SS+50%)
- [ ] Driving/non-driving relationship markering
- [ ] Dependency-matrix/tabel weergave
- [ ] Path tracing (trace alle voorgangers/opvolgers)

#### 2.2 WBS & structuur
- [ ] WBS-codes automatisch genereren (gestructureerd 1.2.3.4)
- [ ] Activity codes (vrij definieerbare categorisering)
- [ ] Custom fields (gebruikersvelden)
- [ ] Kopieer/plak WBS-takken
- [ ] WBS-templates (herbruikbare structuren)
- [ ] Meerdere WBS-indelingen (per locatie EN per discipline)

#### 2.3 Constraints & deadlines
- [ ] Datum-constraints (ASAP, ALAP, SNET, SNLT, FNET, FNLT, MFO, MSO) in CPM
- [ ] Deadline-datum per taak met waarschuwing bij overschrijding
- [ ] Negatieve float detectie
- [ ] Constraint-indicatoren in Gantt

#### 2.4 Mijlpalen
- [ ] Onderscheid start-mijlpalen en eind-mijlpalen
- [ ] Inspectiemomenten als verplichte mijlpalen
- [ ] Mijlpalen-overzicht/rapport

#### 2.5 Resources
- [ ] Resource-kalenders afdwingen in scheduling (beschikbaarheid per resource)
- [ ] Resource-histogram onder Gantt
- [ ] Resource overallocatie-detectie (markering)
- [ ] Resource-nivellering (automatisch, met opties)
- [ ] Resource-smoothing (minimaliseer pieken)
- [ ] Team/ploeg-toewijzing
- [ ] Resource-curves (front-loaded, back-loaded, bell)

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
- [ ] Extra tijdschalen: uur, kwartaal, jaar (nu dag/week/maand)
- [ ] Kolom-aanpassing in tabel (kies zichtbare velden)
- [ ] Groeperen op elk veld (WBS, fase, resource)
- [ ] Sorteren op elk veld
- [ ] Filteren met AND/OR-logica
- [ ] Custom layouts opslaan/laden
- [ ] Presentation mode (full screen Gantt)
- [ ] Split view (meerdere planningen naast elkaar)
- [ ] Mini-map (thumbnail overzicht)

#### 2.8 Kalender-uitbreidingen
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
- [ ] PNG/SVG-export van Gantt
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

## Extensiesysteem & store — vervolgpunten

Voortgekomen uit de bouw van het extensiesysteem en de store-refactor (2026-06-12).

_(geen openstaande punten meer — zie Afgerond)_

## Afgerond

- [x] (2026-06-24) Taken kopiëren/plakken (Ctrl+C / Ctrl+V). Intern klembord in de task-slice (`taskClipboard`, app-state — geen IFC-round-trip, geen undo-snapshot). `copyTasks` neemt de selectie incl. subtaken mee plus interne relaties en resource-toewijzingen (deep-cloned, overleeft verwijderen van het origineel); `pasteTasks` maakt verse ids, plakt als sibling van de selectie (of root), herstelt boomstructuur + interne relaties + toewijzingen, en selecteert de geplakte takken. Eén undo maakt een plak-actie ongedaan.
- [x] (2026-06-19) Catalogus-repo `OpenAEC-Foundation/open-planner-studio-extensions` (publiek) aangemaakt met `catalog.json`; de voorbeeld-extensie is de eerste entry. **Hosting via `raw`, niet via Releases**: browser-`fetch` van release-assets wordt door CORS geblokkeerd (geen `Access-Control-Allow-Origin`), `raw.githubusercontent.com` stuurt `*`. De ZIP staat daarom in de repo en `downloadUrl` wijst naar de raw-URL. `fetchCatalog` gebruikt `cache:'no-store'` tegen stale catalogus. End-to-end geverifieerd: Bladeren → Install werkt (download, central-directory-parse, activeren, importer functioneel).
- [x] (2026-06-19) `window.__openPlannerStudioSdk` gevuld met een echte SDK (`src/extensions/sdk.ts`): versie, categorieën/permissies, `hostEvents`, `utils` en `factory`-helpers; `require('open-planner-studio')` geeft 'm terug.
- [x] (2026-06-19) Voorbeeld-extensie gemaakt: `examples/extensions/voorbeeld-takenlijst-importer/` (importer + ribbon-knop + host-event, met README en voorbeeld-invoer).
- [x] (2026-06-19) `minAppVersion` wordt afgedwongen bij activeren (extensie gaat naar status `error` als de app te oud is).
- [x] (2026-06-19) Host-lifecycle-events op de extensie-event-bus: `host:project-loaded`, `host:project-new`, `host:schedule-calculated` (event-bus verhuisd naar `src/extensions/eventBus.ts`).
- [x] (2026-06-19) `catalogError` via i18n-interpolatie (`{{error}}`) in alle 14 locales; component gebruikt `t(..., { error })`.
- [x] (2026-06-19) `installFromCatalog`-fouten tonen in de CatalogCard (nieuwe i18n-key `installError`).
- [x] (2026-06-19) `removeResource`/`unassignResource` ruimen nu verweesde ids in `task.resourceIds` op.
- [x] (2026-06-19) `openFile`/`openRecentFile` XML-detectie robuuster: P6 vóór MS Project, en een onbekend formaat gooit i.p.v. stil als MSPDI te parsen.
- [x] (2026-06-19) ZIP-parser leest maten uit de central directory (lost de data-descriptor-overshoot op); local-header-scan als fallback.


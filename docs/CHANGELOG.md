# Changelog

Alle noemenswaardige wijzigingen aan Open Planner Studio worden hier vastgelegd.
Nieuwe wijzigingen komen bovenaan onder **Ongepubliceerd**; houd ze gegroepeerd
per type (`Toegevoegd`, `Gewijzigd`, `Opgelost`, `Documentatie`).

## Ongepubliceerd

### Toegevoegd
- **WBS & structuur (fase 2.2)** — de structuurlaag op professioneel niveau
  (ontwerp: `docs/superpowers/specs/2026-07-02-wbs-structuur-design.md`):
  - **Automatische WBS-nummering** (1.2.3.4 uit de boompositie): nieuwe projecten
    nummeren live bij elke structuurmutatie (aan/uit via Planning → Structuur);
    bestaande bestanden behouden hun vrije codes (MSP-model) met een expliciete
    **Hernummer WBS**-actie. Nieuwe taken krijgen ook zonder auto een afgeleide
    code, en plakken hernummert de geplakte tak (geen code-duplicaten meer).
  - **Activity codes** (P6-model): projectgebonden codetypes (bv. Locatie,
    Discipline) met waarden (code + omschrijving + kleur), max één waarde per
    type per taak; beheer via de nieuwe dialoog *Codes & velden*, toewijzing in
    het eigenschappen-paneel en als tabelkolommen.
  - **Custom fields**: getypeerde gebruikersvelden (tekst/getal/geheel getal/
    kosten/datum/ja-nee) per taak, zichtbaar als tabelkolommen.
  - **Meerdere WBS-indelingen**: Beeld → *Groeperen op* toont tabel én Gantt als
    banden per codewaarde (kleurstrook + label, P6 Group & Sort-stijl) — de
    vakstandaard voor locatie × discipline zonder tweede opgeslagen boom.
  - **WBS-templates** (Asta task-pools-stijl): rechtsklik op een samenvattingstaak
    → *Bewaar tak als sjabloon* (taken + interne relaties incl. lag); invoegen en
    beheren via Planning → Structuur → *Sjablonen*. App-niveau (localStorage).
  - **IFC 4.3-round-trip** voor dit alles: definities als `IfcPropertySetTemplate`
    (+ `IfcPropertyEnumeration` voor codetypes, gedeclareerd via `IfcRelDeclares`),
    waarden per taak als `OPS_CustomFields`/`OPS_ActivityCodes`-psets met
    getypeerde waarden, projectvlag in `OPS_ProjectSettings`; verliesloze
    meta-JSON voor eigen bestanden en template-terugval voor bestanden van derden.
  - Kopiëren/plakken van WBS-takken bestond al; de nieuwe velden liften mee en
    plakken behoudt nu ook `lagUnit`/`lagPercent` van interne relaties (fix).
- **Volledige dependencies (fase 2.1)** — het relatiemodel is op het niveau van professionele
  planners gebracht (ontwerp: `docs/superpowers/specs/2026-07-02-volledige-dependencies-design.md`):
  - **Lag-eenheid per relatie**: werkdagen (default) of **kalenderdagen** (24/7, bv. uitharden
    van beton) — IFC-conform als `IfcTaskDurationEnum` (`WORKTIME`/`ELAPSEDTIME`); notatie `2d`
    vs. `3ed` in editors, CSV en MSPDI (LagFormat 8).
  - **Procentuele lag** (bv. `SS+50%`, MS Project-semantiek): percentage van de duur van de
    voorganger, bij elke CPM-run opnieuw geëvalueerd; round-tript via IFC (`IfcRatioMeasure`)
    en MSPDI (LagFormat 19/20); P6-export bakt uit naar vaste uren (met logmelding).
  - **Negatieve lag (lead) afgerond**: klem op de projectstart blijft (P6/MSP-conform) maar een
    **afgekapte lead** wordt nu gemarkeerd, net als een lead groter dan de voorgangerduur;
    leads serialiseren ISO-8601-conform (`-P2D`) en de omgewisselde `IfcLagTime`-attributen
    (LagValue ↔ DurationType) zijn rechtgezet — oude bestanden blijven leesbaar.
  - **Driving/non-driving relaties** (P6-definitie: relationship free float = 0, gelijkspel
    toegestaan): doorgetrokken vs. gestreepte pijlen in de Gantt (rood = kritieke driving-lijn),
    ⚡-indicator in het eigenschappen-paneel en de relatietabel.
  - **Relatietabel** — nieuwe ribbon-tab *Relaties*: alle relaties in één sorteerbare, inline
    bewerkbare tabel (voorganger, type, lag, opvolger, driving, vrije speling per relatie,
    waarschuwingen) + "nieuwe relatie uit selectie"; de Beheer-knop op de Planning-tab opent hem.
  - **Path tracing** (MSP Task Path-stijl): trace-knoppen (voorgangers/opvolgers) op de
    Planning- en Relaties-tab + contextmenu "Pad traceren" — transitieve voorgangers goud,
    opvolgers paars (driving-ketens donkerder), de rest gedimd; Escape stopt.
  - Relaties zijn nu ook **bewerkbaar** in het eigenschappen-paneel (type + lag-notatie
    `2d/3ed/50%/-25e%`); nieuwe store-actie `updateSequence` met undo.
  - Testsuite uitgebreid: 129 → **159 cases** (nieuwe batterijen `cases-lag-advanced.json` en
    `cases-driving.json`; harness kent `lagUnit`/`lagPercent`/`drivingSet`/`truncatedLeadSet`).

### Documentatie
- To-do-lijst (`docs/TODO.md`) toegevoegd en vanuit `CLAUDE.md` verwezen.
- Dit changelog-document toegevoegd en vanuit `CLAUDE.md` verwezen.
- README-screenshots aangevuld en documentatie gelijkgetrokken met de actuele code.
- `CLAUDE.md`: State-sectie gecorrigeerd, multi-worktree dev-setup, i18n/settings/Rust-feiten
  bijgewerkt en verwijzing naar de self-test harness toegevoegd.
- README-architectuur gecorrigeerd: app-shell volgt Open 2D Studio / OpenFEM2D Studio, terwijl
  het extensiesysteem en de styling naar Open Calc Studio gemodelleerd zijn.
- Spec voor de moderne UI-overhaul (Polished Forge + Soft Depth) toegevoegd.
- `read_file`/`write_file` in de Rust-backend gedocumenteerd als bewuste escape-hatch.

### Toegevoegd
- **Snap-packaging werkend gemaakt** — `snap/snapcraft.yaml` toegevoegd (core22, strict
  confinement, gnome-extensie) die de release-deb herverpakt. `snap.yml` herschreven:
  triggert nu op tag-push én `workflow_dispatch`, downloadt de release-deb i.p.v. de
  Tauri-app opnieuw te bouwen, hangt de `.snap` als release-asset, en publiceert naar de
  Snap Store zodra het `SNAPCRAFT_STORE_CREDENTIALS`-secret bestaat. Follow-ups:
  in-app updater overslaan binnen de snap, en Store-registratie van de naam.
- **Multi-document (back-end)** — `documentSlice` houdt meerdere geopende projecten bij; het
  actieve document leeft op top-level (alle bestaande slices/renderer ongewijzigd), inactieve als
  payload-snapshot. Acties `newDocument`/`switchDocument`/`closeDocument` + `getOpenDocuments`.
  View (zoom/scroll), undo-historie, selectie en dirty-status zijn per document; het klembord is
  gedeeld zodat takken tussen documenten te kopiëren zijn.
- **Multi-document (UI)** — drie wisselstijlen, kiesbaar in Instellingen (verschijnt in alle drie
  de settings-oppervlakken) met default *Horizontale tabbladen*: **horizontale tabbladen** onder
  het lint (A), **verticale tabbladen** (projectbalk) links met hover-flyout (B) en een **pil** in
  de titelbalk (C). Alle drie delen één **projectoverzicht-overlay** (kaarten met mini-Gantt +
  taken/kritiek/einde per document). Per project een stabiele identiteitskleur (afgeleid uit de
  project-id) en 2-letter-code. Bestand openen opent voortaan een nieuw tabblad (hergebruikt het
  lege beginscherm); 'Nieuw' opent een nieuw tabblad i.p.v. het actieve te wissen; `⌘/Ctrl 1–9`
  springt naar het n-de open document. Front-end-only, UI-state in de `ui`-slice.
- **Multi-document recovery** — auto-save bewaart nu *alle* open documenten: één manifest
  (`recovery[.<slug>].documents.json`) + per document een IFC-snapshot, met opruimen van
  snapshots van gesloten documenten. Bij het opstarten worden alle documenten hersteld (id's,
  actief document en dirty-status blijven behouden); de oude losse `recovery.ifc` wordt nog
  herkend als terugval. Tauri-only.
- **Sluit-bevestiging (3-weg)** — een document met niet-opgeslagen wijzigingen sluiten toont nu
  een dialoog met *Opslaan* / *Niet opslaan* / *Annuleren* i.p.v. een simpele bevestiging.
  *Opslaan* bewaart het document (maakt het zo nodig eerst actief, evt. via 'Opslaan als…') en
  sluit het daarna; bij een geannuleerd opslaan blijft het document open.
- **Nieuw-project wizard** — `ProjectInfoDialog` is nu dubbel-modus: naast 'projectinfo bewerken'
  ook een wizard die bij *Nieuw* een project opzet met naam/opdrachtgever/startdatum, een
  **kalender-preset** (bouwkalender NL incl. bouwvak / NL-feestdagen zonder bouwvak / 5-daags) en
  een **fasering-template** (Leeg / Woningbouw / Utiliteitsbouw) die de WBS met hoofdfasen vult.
  Alle 'Nieuw'-acties (titelbalk, lint, menubalk, Backstage) en `Ctrl/⌘ N` openen de wizard;
  `createNewProject` maakt het project atomair (geen undo-ruis) in een eigen tabblad (hergebruikt
  een leeg, ongewijzigd tabblad). Hiermee is Fase 1 compleet.
- **Taken kopiëren/plakken** — Ctrl+C / Ctrl+V dupliceren de geselecteerde takken inclusief
  subtaken, interne relaties en resource-toewijzingen. Geplakt als sibling van de selectie (of op
  rootniveau) met verse ids; één undo maakt het ongedaan.
- **Extensiesysteem** — extensies (manifest + main.js, als ZIP/JS of uit de catalogus) kunnen
  importers en ribbon-knoppen registreren. Beheer via Bestand → Extensies; importeren via
  Bestand → Importeren. Naar het model van Open Calc Studio.
- **Extensie-SDK** — `require('open-planner-studio')` geeft nu een echte host-SDK (versie,
  categorieën/permissies, `hostEvents`, `utils` en `factory`-helpers) i.p.v. een leeg object.
- **Host-events** — de app zendt `host:project-loaded`, `host:project-new` en
  `host:schedule-calculated` op de extensie-event-bus; extensies kunnen erop abonneren via
  `api.events.on`.
- **Voorbeeld-extensie** — `examples/extensions/voorbeeld-takenlijst-importer/` als werkende
  referentie (importer + ribbon-knop + host-event); ook gepubliceerd in de catalogus.
- **Extensie-catalogus** — publieke repo `OpenAEC-Foundation/open-planner-studio-extensions`
  met `catalog.json`; Bladeren toont en installeert er extensies uit. ZIP's via `raw` gehost
  (release-assets falen op browser-CORS); `fetchCatalog` met `cache:'no-store'` tegen stale data.
- **Settings unificatie** — instellingen gedeeld over tandwiel ⚙, Settings-ribbon-tab en
  File-backstage via één gedeelde settings-component.
- **Gantt** — instelbaar scrollen en zoomen over de Gantt-weergave.
- **UI** — herbruikbare themed `Select`-dropdown met migratie weg van native selects.
- **Dev** — poort en recovery-bestand per worktree geïsoleerd, zodat meerdere
  desktop-builds tegelijk kunnen draaien.
- **Tauri** — Linux desktop-icoon metadata.
- **Devtools** — Tier 2 `ops-test` controlekanaal (echte Tauri save/open + dispatch).

### Gewijzigd
- **UI moderne overhaul** — koele "Soft-Depth"-look over alle oppervlakken (Fase 1 koele tokens,
  schaduw/radius, AA-control-rand en fonts; Fase 2 doorgevoerd over de hele app).
- **Store-architectuur** — de monolithische Zustand-store is opgesplitst in tien slices
  (`src/state/slices/`); `appStore.ts` is nu een compositie-root. Geen gedragswijziging.
- **Performance** — O(n³)/O(n²) lookups in IFC-nesting en het tekenen van Gantt-pijlen weggewerkt.
- `isTauri()` gecentraliseerd in `src/utils/platform.ts`.
- CI naar Node 24-compatibele GitHub Actions-versies gebracht.
- CODEOWNERS bijgewerkt naar de nieuwe product owner.

### Opgelost
- **Scheduler** — kritiek pad klopt nu; geen spook-float meer op predecessors.
- **Scheduler** — `runCPM` kan niet meer bevriezen of crashen op rare/ongeldige data.
- **UI** — light-mode contrast verbeterd (diepere tint, zichtbare randen/lijnen, helder amber,
  extra contrast op canvas-lijnen).
- **Extensies** — `minAppVersion` wordt nu afgedwongen; een te oude app weigert te activeren.
- **Extensies** — catalogus-foutmelding via i18n-interpolatie (`{{error}}`) i.p.v. string-plakken
  (alle 14 locales); catalogus-installfouten worden in de kaart getoond.
- **Extensies** — ZIP-parser leest maten uit de central directory (lost data-descriptor-overshoot op).
- **Resources** — `removeResource`/`unassignResource` ruimen verweesde ids in `task.resourceIds` op.
- **Bestanden** — XML-import-detectie robuuster (P6 vóór MS Project; onbekend formaat gooit nu).
- **i18n** — thema-namen worden nu vertaald in de theme-picker.
- **Taken** — standaard einddatum volgt nu de duur.
- **Bestanden** — bestandsextensie wordt geborgd bij opslaan (Linux/GTK plakt 'm niet).
- **IFC** — STEP-entiteiten correct getermineerd met `;` (ongeldige IFC-output verholpen),
  inclusief de voorbeeldgenerator.
- **Devtools** — self-test harness draait op chromium-headless i.p.v. webkit.

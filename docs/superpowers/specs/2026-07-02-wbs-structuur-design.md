# Ontwerp: Fase 2.2 — WBS & structuur

*Datum: 2026-07-02 · Status: **geïmplementeerd** (zelfde dag; zie changelog "WBS & structuur (fase 2.2)") · Bron: [docs/TODO.md](../../TODO.md) §2.2, [PLAN.md](../../../PLAN.md) §2.2.C + §6 Fase 2.2*

> Implementatienotities t.o.v. dit ontwerp: WBS-templates bevatten bewust GEEN
> activity-code-/custom-field-waarden — die verwijzen naar projectgebonden
> definities die in een ander project niet bestaan (sjablonen zijn app-globaal).
> De groeperingsweergave gebruikt in de renderer een (Task|null)-rijmodel
> (null = bandrij); hit-tests lopen via getTaskAtY en degraderen op bandrijen
> vanzelf. Naast de conformante pset-templates schrijft de IFC-writer een
> autoritaire OPS_StructureMeta-JSON zodat ids/kleuren/omschrijvingen de eigen
> round-trip verliesloos overleven; de reader valt voor bestanden van derden
> terug op de templates.

Gebaseerd op drie onderzoekssporen: code-audit, PLAN.md-intentie (C-blok van de
concurrentiematrix) en vakstandaard-semantiek (P6 / MS Project / Asta / IFC 4.3).

## 1. Kernbeslissingen (uit het onderzoek)

- **Eén fysieke WBS-boom.** "Meerdere WBS-indelingen (per locatie EN per
  discipline)" wordt níét een tweede opgeslagen boom: de vakconsensus (P6/Asta,
  én de LBS-wereld) is één WBS + **activity codes** als extra dimensies +
  groeperingsweergaven. C11 = groepeer-op-codetype in tabel en Gantt.
- **WBS-codes: stabiel-met-hernummeren (MSP-model), puur numeriek 1.2.3.4 (v1).**
  `wbsCode` blijft het opgeslagen, bewerkbare veld. Nieuw: (a) een afgeleide
  nummering uit de boompositie; (b) projectvlag `wbsAutoNumber` — aan ⇒ codes
  worden bij elke structuurmutatie live hergenereerd; uit ⇒ vrije tekst zoals nu,
  met een expliciete actie **"Hernummer WBS"**; (c) `addTask` geeft een taak
  zonder code voortaan direct een afgeleide code (lege codes breken CSV/MSP-
  export), en plakken hernummert de geplakte tak (nu ontstaan letterlijke
  duplicaten). Maskers/prefixen (P6/MSP-maskers) zijn bewust v2.
- **Canonieke sibling-volgorde.** Audit-gotcha: `childIds`-volgorde vs. positie
  in `s.tasks` divergeren; alle renderers gebruiken de array-positie. Besluit:
  **de array-volgorde van `s.tasks` is canoniek** (renderers ongewijzigd); de
  WBS-nummering volgt exact dezelfde flattener. IFC-nesting schrijft/leest
  volgorde-behoudend (IfcRelNests-volgorde is significant).
- **Activity codes: het P6-model, projectgebonden.**
  `ActivityCodeType { id, name, values: ActivityCodeValue[] }`,
  `ActivityCodeValue { id, code, description?, color? }`; per taak
  `activityCodes?: Record<typeId, valueId>` — **maximaal één waarde per type**
  (P6-invariant; houdt groeperen welgedefinieerd). Vlakke waardenlijst (geen
  hiërarchische waarden in v1). Kleur beschikbaar voor groepsbanden.
- **Custom fields: P6-vormig getypeerd.**
  `CustomFieldDef { id, name, type: 'text'|'number'|'integer'|'cost'|'date'|'boolean' }`
  (indicator/formules/lookups bewust uitgesteld — enumeraties zijn precies
  waar activity codes voor zijn); per taak `customFields?: Record<defId, string|number|boolean>`.
- **Kopieer/plak WBS-takken is grotendeels geshipt** (deep copy, interne
  relaties, verse ids, cross-document). 2.2 voegt toe: WBS-hernummering van de
  geplakte tak, en de nieuwe per-taak-velden liften automatisch mee (deep clone).
- **WBS-templates: Asta-"task pools"-vorm.** "Bewaar tak als sjabloon"
  (taken + duur/mijlpaal/taaktype/codes/velden + interne relaties, geen
  datums/voortgang) en "Sjabloon invoegen" (onder knoop of op rootniveau,
  verse ids, hernummering). Opslag: **app-niveau** in localStorage
  (`ops-wbs-templates`, zelfde categorie als taskClipboard/extensies — geen
  IFC-round-trip-verplichting); de bestaande wizard-faseringssjablonen blijven
  onaangeroerd als aparte instap.

## 2. IFC 4.3-round-trip (het ontwerpgat in PLAN.md §5)

Nieuw in de writer/reader (geverifieerd tegen buildingSMART-docs):

- **Definities** (projectniveau): één `IFCPROPERTYSETTEMPLATE` per verzameling —
  custom-field-defs als `IFCSIMPLEPROPERTYTEMPLATE` (`P_SINGLEVALUE`,
  `PrimaryMeasureType` = IfcText/IfcReal/IfcInteger/IfcMonetaryMeasure/IfcDate/
  IfcBoolean), activity-code-types als `P_ENUMERATEDVALUE` met
  `IFCPROPERTYENUMERATION` (waardenlijst); gedeclareerd aan het project via
  `IFCRELDECLARES`. Kleur/omschrijving van codewaarden in een parallelle
  metadata-pset (`OPS_ActivityCodeMeta`).
- **Waarden** (per taak): eigen psets (géén `Pset_`-prefix): `OPS_CustomFields`
  met `IFCPROPERTYSINGLEVALUE` en `OPS_ActivityCodes` met
  `IFCPROPERTYENUMERATEDVALUE`, gekoppeld via `IFCRELDEFINESBYPROPERTIES`.
- `wbsCode` blijft `IfcTask.Identification`; hiërarchie blijft `IfcRelNests`
  (volgorde-behoudend maken); `wbsAutoNumber`-projectvlag in een kleine
  `OPS_ProjectSettings`-pset op het project.
- `IfcClassification`-route (STABU/RAW, fase 3) is gedocumenteerd alternatief,
  bewust later.

## 3. Store & threading

- Nieuwe slice `structureSlice`: `activityCodeTypes`, `customFieldDefs` +
  CRUD-acties (met undo-snapshot + `isDirty`), `setTaskActivityCode`,
  `setTaskCustomField`, `renumberWbs`, `setWbsAutoNumber`.
- `Snapshot` uitbreiden met `activityCodeTypes` + `customFieldDefs`
  (definitie-wijzigingen zijn undoable); per-taak-waarden liften mee met tasks.
- `documentSlice`: beide definitiesets in `DocumentPayload` + alle vier de
  payload-functies en de recovery-vormen.
- Pure helpers in `src/utils/wbs.ts`: `flattenOrder(tasks)` (zelfde volgorde als
  de renderers), `deriveWbsCodes(tasks) → Map<id, code>`, gedeeld door
  renumber-actie, addTask-default en paste.
- Templates: `src/utils/wbsTemplates.ts` (localStorage-CRUD) + store-acties
  `saveBranchAsTemplate(taskId, name)` / `insertTemplate(templateId, parentId | null)`
  (hergebruikt de paste-machinerie).

## 4. UI (coherent met bestaande patronen)

- **Ribbon-tab Planning** krijgt groep "Structuur": toggle **WBS auto**,
  knop **Hernummer WBS**, knop **Codes & velden** (opent beheerdialoog),
  knop **Sjablonen** (dropdown: tak opslaan / invoegen).
- **Beheerdialoog `StructureDialog`** (patroon CalendarDialog): twee tabbladen —
  activity-code-types (naam + waardenlijst met code/omschrijving/kleur) en
  custom fields (naam + type). `ui.showStructureDialog`.
- **TaskPropertiesPanel**: sectie "Codes & velden" — per codetype een dropdown
  (leeg = geen waarde), per custom field een getypeerde input.
- **TableEditor**: custom fields en codetypes verschijnen als extra kolommen
  achter de vaste set (v1: automatisch alle gedefinieerde; kolom-kiezen is
  fase 2.7). Waarden inline bewerkbaar.
- **Groeperen (C11)**: `view.groupBy?: string` (codetype-id) — in TableEditor én
  GanttRenderer vervangt de groepering de boom-flattening door codewaarde-banden
  (band-rij met waarde-naam/kleur; taken vlak eronder; taken zonder waarde onder
  "(geen)"). Bediening: dropdown in de Beeld-ribbontab ("Groeperen op: WBS /
  <codetype>"). Gantt-bandrij = label + kleurstrook, geen balk.
- Contextmenu: "Bewaar tak als sjabloon" op een summary-taak.

## 5. Wat bewust NIET in 2.2

- Maskers/prefixen voor WBS-codes (MSP WBS Code Definition) — v2.
- Hiërarchische codewaarden, indicator-velden, formules, lookup-tables.
- Tweede opgeslagen boom / OBS/CBS/RBS/EBS (C3-C6) en WBS-dictionary (C14).
- Adapter-export van codes/velden naar CSV/MSPDI/P6 (IFC is het native formaat;
  adapters blijven wbsCode-gebaseerd zoals nu; gedocumenteerde beperking).
- Parametrische templates (fase 5.4) en bouwspecifieke faseringstemplates (3.7).

## 6. Uitvoeringsvolgorde

1. `utils/wbs.ts` (ordening + nummering, headless getest) + `renumberWbs` +
   `wbsAutoNumber` + addTask-defaultcode + paste-hernummering.
2. Types + `structureSlice` + snapshot/document-threading.
3. IFC: pset-templates + psets, reader + writer + legacy-loos (nieuw), met
   headless round-trip-verificatie.
4. StructureDialog + panel-sectie + tabelkolommen + ribbon-groep.
5. GroupBy-weergave (view-state, TableEditor, GanttRenderer, Beeld-tab).
6. WBS-templates (utils + acties + UI).
7. Zelftest (Playwright + __OPS__), i18n (14 locales), docs, commits.

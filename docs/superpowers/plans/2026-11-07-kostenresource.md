# Plan: kostenresource (issue #815)

Status: plan, nog niet gebouwd. Lees dit als *waarom en hoe*, niet als *wat er is*.

## Vraag

Issue #815 ("Add a Cost-Type Resource"): een resource maken en er een vast bedrag aan geven, zonder
uitsplitsing in materiaal en arbeid. Voorbeeld: een vergunning van € 2.500 op één taak.

## Besluiten

| besluit | wie, wanneer | bron |
|---|---|---|
| Nieuw `ResourceType` `'COST'`; het bedrag staat **per toewijzing** (taak A € 2.500, taak B € 800 op dezelfde resource "Vergunningen"). Niet: één bedrag op de resource, en niet: een veld "Vaste kosten" op de taak. | Ethan, 2026-11-07 | sessie, optie 1 van 3 |
| Doorgaan, omdat MS Project en P6 ongeveer hetzelfde doen. | Ethan, 2026-11-07 | sessie |
| Een kostenresource mag op een mijlpaal staan (bv. "Leges € 1.200" op "Vergunning aangevraagd"). Werk- en materiaalresources blijven op een mijlpaal geweigerd; samenvattingstaken blijven voor alle types geweigerd. Niet: een korte neptaak voor het bedrag. | Ethan, 2026-11-07 | sessie, optie 1 van 2 |

Nagegaan in de bronnen (researcher, 2026-11-07):

- MS Project: resource met type Cost; het bedrag vul je per toewijzing in (Taakinformatie, tabblad
  Resources, veld Cost); geen agenda. MSPDI `<Resource><Type>` 0 = materiaal, 1 = werk, 2 = kosten.
  [support.microsoft.com/en-us/project/enter-costs-for-resources](https://support.microsoft.com/en-us/project/enter-costs-for-resources),
  [MSPDI Type element](https://learn.microsoft.com/en-us/office-project/xml-data-interchange/type-element-multiple-parents).
- P6: geen kostenresource (alleen Labor, Nonlabor, Material), wel *expenses* per activiteit met een
  herbruikbare *expense category*; "not time-based". XER `PROJCOST` (`cost_type_id`, `target_cost`, …).
  [P6 expenses](https://docs.oracle.com/cd/G18294_01/p6help/en/17939_1.htm),
  [XER map PROJCOST](https://docs.oracle.com/cd/F25600_01/English/Mapping_and_Schema/xer_import_export_data_map_project/97884.htm).
- Niet bevestigd: de schaal van MSPDI `<Assignment><Cost>` (MPXJ deelt valuta door 100). Bewijzen met een
  fixture vóór PR2.

Technische keuzes in dit plan zijn van de orkestrator; de reden staat erbij.

## Gedrag

- Een kostenresource heeft geen tarief, geen max. eenheden, geen kalender, geen eenheid, geen ploeg en geen
  werk/uren.
- Hij telt niet mee voor belasting, overallocatie, histogram en nivelleren, en stuurt nooit de duur
  (werkregelbrug). Een toewijzing toevoegen, verwijderen of het bedrag wijzigen maakt de planning niet stale.
- Het resourcepaneel telt per kostenresource de bedragen van zijn toewijzingen op; het totaal telt mee.
- Alleen een begroot bedrag. Werkelijke kosten (MSP ActualCost, P6 `act_cost`) vallen buiten deze PR's;
  imports tellen ze als verlies. Reden: het issue gaat over begroten; de app kent nog geen kostenvoortgang.

## 1. Datamodel

- `ResourceType` (`src/types/resource.ts:10`) krijgt `'COST'`. Twee helpers, zodat er geen losse
  `!== 'MATERIAL'`-checks bij komen: `resourceDrivesDuration(r)` (geen MATERIAL, geen COST) en
  `resourceHasLoad(r)` (geen COST).
- `ResourceAssignment.costAmount?: number`: het begrote bedrag, alleen op een toewijzing aan een
  COST-resource. Eindig en ≥ 0. Geen `fixedCost`: dat is in MSP een taakveld (nu als verlies geteld,
  `importTypes.ts:445`).
- Valuta: de app kent geen projectvaluta; het bedrag volgt `costPerHour` (kaal getal, 2 decimalen).
- `unitsPerDay` blijft verplicht; een COST-toewijzing krijgt vast `1` en geen berekening leest het.
- Werkvelden (`plannedUnitsPerDay`, `curve`, `curveValues`, `*WorkMinutes`, `workWindow*`) komen nooit op
  een COST-toewijzing; lezers wissen ze, de store weigert ze.
- Store: nieuwe actie `setAssignmentCost(id, amount | undefined)` in `resourceSlice` (undoable, `isDirty`,
  geen `scheduleStale`, zoals `setAssignmentContour`), lichaam in `assignmentMutations.ts`, MCP-tweeling in
  `createMcpTransactions.ts`. `acceptedAssignmentPatch`, `setAssignmentWork` en `contoursAfterEdit` weigeren
  COST. `insertAssignment`/`removeAssignment`/`relocateAssignment` slaan voor COST `invalidate(task)` over.
- Typewissel naar of van COST: geweigerd zolang de resource toewijzingen heeft. Zonder toewijzingen wist de
  wissel naar COST tarief, kalender, stappen, eenheid en ploeg, en zet `maxUnits` op 1. Reden: anders moet
  inzet/werk stil in een bedrag vertaald worden en terug.
- `resources` en `assignments` staan al in `DOCUMENT_FIELDS` en `IFC_SAVE_KEYS`; geen nieuw documentveld.

## 2. Plekken die op het type schakelen

| plek | COST |
|---|---|
| `ResourceLoad.ts:427-430` | toewijzing overslaan |
| `ResourceLeveler.ts:237`, `LevelingDialog.tsx:34` | niet renewable |
| `workRuleApply.ts:106-109, 595, 1200`; `mppReader.ts:1494` | `drivesDuration` via de helper |
| `ganttRenderOptions.ts:130, 162`, `useGanttHistogramInteraction.ts:156` | niet in somrij en histogramkiezer |
| `TaskAssignmentsSection.tsx` | bedragveld, zie §7 |
| `taskColumnRegistry.ts:769, 1148-1229` | geen ⚠; inzet/curve/werk tonen "—" en weigeren invoer (celfout `assignmentCostResource`); nieuwe alleen-lezen kolom bedrag |
| `filterEval.ts:86` | `'COST'` achteraan in `RESOURCE_TYPE_BAND_ORDER` |
| `resourceGantt.ts`, `useTableReportSpec.tsx`, `App.tsx:226`, `ReportPanel.tsx:500`, `noneLabel.ts:18` | label `resource.type.cost` |
| `resourceLoading.ts`, `resourceAssignments.ts:83` (rapporten) | overslaan; rij toont het bedrag |
| `distribute.ts:255, 330` | geen vraag; COST-poolitem geblokkeerd zoals materiaal |
| `extTypes.ts`, `extMappers.ts` | `'COST'` en `costAmount` |
| `p6xmlWriter.ts:93-104` | zie §4 |
| `RESOURCE_TYPES` in `ResourcePanel.tsx:18`, `resourceTools.ts:54, 610` | `'COST'` erbij |

## 3. IFC

- Resource: `IFCCONSTRUCTIONMATERIALRESOURCE` met `ObjectType 'COST'` en `PredefinedType .USERDEFINED.`
  (route 1 van `docs/ifc-round-trip.md`). Reden voor materiaal als drager: een oudere app ziet dan
  MATERIAL, en dat stuurt de duur niet en wordt niet genivelleerd. LABOR/SUBCONTRACTOR zou bij een oude
  versie de duur gaan sturen. `RESOURCE_TYPE_TO_IFC` krijgt COST; de inverse sluit COST expliciet uit.
  `extractResources` leest `args[4] === 'COST'` + `.USERDEFINED.` op de materiaalentiteit als COST.
- Bedrag: in het bestaande `OPS_Timephased`-blob onder `GUID#N` als `costAmount`
  (`ifcWriter.ts:1892-1936`, lezer `ifcReader.ts:3405-3414, 3502-3515`). Niet native: `IfcRelAssignsToProcess`
  draagt geen psets en `BaseCosts` laat in de schematabel geen type toe.
- Oudere versie: ziet MATERIAL met inzet 1, negeert bedrag en markering, geen crash. Na opslaan daar zijn
  markering en bedrag weg. Restrisico: twee parallelle taken met dezelfde kostenresource geven daar
  overallocatie. Noemen in de releasenotes.
- Schema's IFC4X3_ADD2, IFC4X3 en IFC4 kennen de entiteit en `USERDEFINED`; `check-ifc-schema.ts` toetst.
- Bibliotheekpool (`OPS_Library`-JSON) neemt `'COST'` letterlijk mee.

## 4. Import en export

- PR1, schrijvers:
  - MSPDI: `<Type>2</Type>` zonder MaxUnits/MaterialLabel/StandardRate; toewijzing `<Cost>` (schaal zoals
    vastgesteld) en geen `<Work>`.
  - XER en P6 XML: COST-resources en hun toewijzingen overslaan, met verliescode `costResources`
    (`xerWriteTypes.ts` `LOSS_ORDER`, `p6XmlExportNotice.ts`).
  - CSV schrijft geen resources; geen werk.
- PR2, MS Project lezen: MSPDI `Type=2` → COST, bedrag uit `<Assignment><Cost>`; `.mpp` `isCost` → COST
  (`mppEntities.ts:336-346`), `costResourceIds` weg; bedrag via `AssignmentField.COST` met een bytefixture,
  anders eerst als verlies tellen. Lost knownbug 441 op; 440 (tak "precies één toewijzing",
  `mppReader.ts:~1517`) filtert ook op `drivesDuration`.
- PR3, P6-expenses: `COSTTYPE` → COST-resource, `PROJCOST`-rij → toewijzing met `costAmount = target_cost`;
  export omgekeerd, P6 XML `ExpenseCategory` + `ActivityExpense`. Verlies tellen voor `act_cost`,
  `cost_per_qty`/`target_qty`, account, vendor/PO, `cost_load_type`. COST niet in de archief-`resourceCatalog`
  (`xerSourceArchive.ts:831`): een oudere app weigert dan het archief.

## 5. MCP (blijft 41 tools)

- `resourceTools.ts`: COST in enum; zachte weigering van `maxUnits≠1`, `costPerHour`, `unitOfMeasure`,
  `calendarId`, `availabilitySteps`, `parentId`; typewissel met toewijzingen geweigerd.
- `planner_manage_assignments`: `costAmount` (≥ 0 | `null`) alleen voor COST; `unitsPerDay` optioneel
  (standaard 1); `unitsPerDay`, `curve`, `remainingWorkMinutes` op COST geweigerd.
- `readTools.ts`: `get_task` geeft `costAmount`; `list_resources` geeft `totalCostAmount` en houdt COST
  buiten `totalUnitsPerDay`; histogram/level op een COST-id geeft een duidelijke weigering.
- `public/agent/planning-guide.md` één zin.

## 6. Bibliotheek

COST mag in de pool; `type` zit al in `RESOURCE_DIFF_FIELDS`; het bedrag is projectdata, geen diff-veld.
Bezetting valt vanzelf weg via `computeResourceLoad`; `ResourceOccupancyView` laat COST weg.

## 7. UI

- `TaskAssignmentsSection.tsx`: voor COST staat in de inzetkolom een bedragveld (`setAssignmentCost`); werk
  "—"; geen curve en geen Urenverdeling; "Verplaats naar…" blijft. Toevoegen blijft `assignResource(…, 1)`.
- `ResourcePanel.tsx`: voor COST max. eenheden, stappen, kalender, tarief en eenheid uit, met hint
  `resource.notForCost`; ook in draft en pool. `costByResource` = Σ `costAmount`.
- Alleen bestaande tekstrollen. i18n nl + en via `npm run i18n:add`.
- Gidsen nl + en: nieuw `howto-vast-bedrag-toekennen.md` + manifest; bijwerken `howto-resources-beheren`,
  `howto-resource-toewijzen`, `ref-resourcepaneel`, `ref-taak-eigenschappen`, `howto-overbezetting-oplossen`,
  `howto-resourcebibliotheek-gebruiken`, `ref-ai-tools`. PR2/PR3: importartikelen.

## 8. PR's

Geen feature flag, mits PR1 compleet is (IFC-round-trip in dezelfde PR).

| PR | inhoud | releasebaar |
|---|---|---|
| PR1 kern | §1, §2, §3, §5, §6, §7; schrijvers uit §4 | ja; import blijft als op main |
| PR2 MS Project lezen | §4 PR2; knownbug 440 + 441 eruit | ja |
| PR3 P6-expenses | §4 PR3 | ja |

## 9. Tests

- PR1: `check-ifc-roundtrip.ts` (`costAmount` in de `Required<ResourceAssignment>`-fixture, `RCost`,
  entiteit + markering, blob met alleen `costAmount`), `check-ifc-schema.ts`, nieuw `check-cost-resource.ts`
  (geen belasting/histogram/nivelleren, duur onder FIXED_WORK onveranderd, niet stale, weigeringen, undo,
  MSPDI-writer, XER/P6-verlies), `check-resource-cost-hours.ts`, `check-work-rule-store.ts`,
  `check-xer-export-loss.ts`, `check-p6xml-export-loss.ts`, `tests/library/check-occupancy.ts`,
  MCP `cases-resource-crud.ts`, `cases-assignment-invalidation.ts`, `cases-work-rule.ts`; browser: stap in
  het bestaande scenario van `resource-cost-total.spec.ts`. `expected-checks.txt` opnieuw.
- PR2: `check-mpp-walk-units.ts`, `check-mpp-import.ts`, nieuw `check-mspdi-cost-resource.ts`,
  `check-work-rule-mapping.ts`.
- PR3: `check-xer-writer.ts`, `check-xer-field-whitelist.ts`, `check-xer-p6xml-parity.ts`,
  `check-p6xml-writer-p6.ts`, `check-xer-export-loss.ts`, archieftoets.

## 10. Open

- Kosten op mijlpalen: besloten (zie Besluiten). De weigering in `resourceSlice.ts:165` krijgt een
  uitzondering voor COST op een mijlpaal; ook MCP (`planner_manage_assignments`), de UI-toevoegknop en de
  importpaden moeten die regel volgen. PR1.
- PR3: een taak met meer `PROJCOST`-rijen in dezelfde categorie. Besluit vóór PR3.

import type { XerResourceCatalog } from '@/services/xer/xerResources';
import type { XerResourceReadResult } from '@/services/xer/xerResourceTypes';

declare const catalog: XerResourceCatalog;
declare const projectView: XerResourceReadResult;

// @ts-expect-error Catalogusresources zijn diep readonly.
catalog.resources[0].name = 'verboden';
// @ts-expect-error Beschikbaarheidstappen in de catalogus zijn diep readonly.
catalog.resources[0].availabilitySteps![0].maxUnits = 99;
// @ts-expect-error Identiteiten in de catalogus zijn readonly.
catalog.identities[0].sourceId = 'verboden';
// @ts-expect-error Rijen en hun cellen in de catalogus zijn readonly.
catalog.rows.assignments[0].cells.taskrsrc_id = 'verboden';
// @ts-expect-error Rate-entiteiten in de catalogus zijn diep readonly.
catalog.rows.rates[0].entity.sourceId = 'verboden';
// @ts-expect-error Rate-kostentuples in de catalogus zijn readonly.
catalog.rows.rates[0].costs[0] = 99;
// @ts-expect-error Curvepunten in de catalogus zijn readonly tuples.
catalog.rows.curves[0].rawPoints[0] = '99';
// @ts-expect-error Numerieke curvepunten in de catalogus zijn readonly tuples.
catalog.rows.curves[0].numericPoints![0] = 99;
// @ts-expect-error Catalogusissues zijn readonly.
catalog.issues[0].sourceId = 'verboden';

projectView.resources[0].name = 'toegestaan';
projectView.sources.assignments[0].entity.sourceId = 'toegestaan';
projectView.sources.assignments[0].assignedRole!.sourceId = 'toegestaan';
projectView.sources.assignments[0].quantities.target = 1;
projectView.sources.assignments[0].costs.target = 1;
projectView.sources.assignments[0].rawCurves.target = 'TC';

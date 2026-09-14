// B1c-etappe3 fixronde 2 — de PURE laag achter de voor/na-grafiek van de verdeeldialoog.
//
// Twee bevindingen worden hier mechanisch vastgezet:
//
//  B1 — DE SCHAAL VAN EEN GESTAPELDE GRAFIEK IS DE STAPELSOM. De grafiek stapelde alle documenten
//       op elkaar maar leende de verticale schaal van de fasestroken, en die rekent per document.
//       Twee documenten die elk 1 boeken op een capaciteit van 1 gaven dus schaal 1: de eerste
//       staaf klom naar volle hoogte en de tweede zakte op de zichtbaarheidsbodem van 0,5 px — het
//       conflict dat de gebruiker naar deze dialoog bracht, door de schaal onzichtbaar gemaakt.
//       Bovendien werd de conflictband vóór de staven getekend, dus een volle staaf schilderde 'm
//       dicht. Deze check toetst de schaal, de gelijke staafhoogtes en de aanwezigheid van de
//       conflictdag — en dat een pin daar niets aan verandert.
//
//  B11 — `diffReason` VERGELEEK MET `JSON.stringify`. Dezelfde bediening in een andere
//       sleutelvolgorde (of met een expliciete `false`/`null` erbij) las dan als een wijziging en
//       liet het voorstel ten onrechte vervallen. De vergelijking is nu een sleutelverzameling:
//       afwezig ≡ `false` voor `pinned`, afwezig ≡ `null` (= onbegrensd) voor `ceilings`.
import { buildOccupancyAxis } from '@/components/panels/occupancyAxis';
import {
  assignDocColors, buildStackedChart, chartScaleMax, CHART_PLOT,
} from '@/components/dialogs/DistributionDialog/chartGeometry';
import { diffReason } from '@/components/dialogs/DistributionDialog/useDistributionProposal';
import type { DistributionUiState } from '@/state/slices/types';

let failures = 0;
function ok(cond: boolean, msg: string): void {
  if (cond) console.log(`OK  ${msg}`);
  else { console.log(`XX  ${msg}`); failures++; }
}
function near(a: number, b: number, eps = 0.01): boolean {
  return Math.abs(a - b) <= eps;
}

// ── B1: twee eendaagse projecten, elk 1 eenheid, capaciteit 1 ────────────────────────────────
const DAY = '2026-09-07';
const DOC_A = 'doc-a';
const DOC_B = 'doc-b';
const CAPACITY = 1;
const capacityOn = (): number => CAPACITY;

const axis = buildOccupancyAxis([DAY]);
ok(axis !== null, 'B1 — de as over één geboekte dag bestaat');

if (axis !== null) {
  const bookingByDay: Record<string, Record<string, number>> = {
    [DOC_A]: { [DAY]: 1 },
    [DOC_B]: { [DAY]: 1 },
  };
  // De NA-stand van een geslaagde verdeling: B schuift een dag op, dus nergens meer een conflict.
  const afterLoadByDay: Record<string, Record<string, number>> = {
    [DOC_A]: { [DAY]: 1 },
    [DOC_B]: { '2026-09-08': 1 },
  };

  const scale = chartScaleMax(axis, capacityOn, [bookingByDay, afterLoadByDay]);
  ok(scale === 2, `B1 — de schaal is de STAPELSOM (2), niet de capaciteit of één term (kreeg ${scale})`);

  const before = buildStackedChart(axis, capacityOn, bookingByDay, [DOC_A, DOC_B], scale);
  const barA = before.bars.find(b => b.docId === DOC_A);
  const barB = before.bars.find(b => b.docId === DOC_B);
  ok(barA !== undefined && barB !== undefined, 'B1 — beide documenten leveren een staaf');
  if (barA && barB) {
    const half = CHART_PLOT.height / 2;
    ok(near(barA.h, half) && near(barB.h, half),
      `B1 — beide staven zijn even hoog en samen de volle plot (${barA.h} / ${barB.h}, verwacht ${half})`);
    ok(barA.h > 10 && barB.h > 10,
      'B1 — geen enkele staaf valt terug op de zichtbaarheidsbodem van 0,5 px');
    // Gestapeld: B staat bovenop A, dus B's bovenkant ligt hoger (kleinere y) dan A's.
    ok(barB.y < barA.y, 'B1 — de tweede staaf staat ECHT bovenop de eerste (gestapeld, niet geklemd)');
  }

  ok(before.conflictDays.length === 1 && before.conflictDays[0].key === DAY,
    'B1 — de conflictdag (stapelsom 2 > capaciteit 1) staat in de VOOR-stand gemarkeerd');

  const after = buildStackedChart(axis, capacityOn, afterLoadByDay, [DOC_A, DOC_B], scale);
  ok(after.conflictDays.length === 0, 'B1 — de NA-stand houdt geen conflictdag over');

  // Een pin verandert de rangorde-bediening, niet het grootboek: `bookingByDay`/`afterLoadByDay`
  // dragen de boeking van élk document, ook een gepind document (dat telt daarnaast als vaste last
  // in de fasestrook). De schaal van de grafiek mag daar dus niet van afhangen — vóór deze fix
  // sprong hij van 1 naar 2 zodra er één document gepind werd, en dan pas klopte de tekening.
  const scalePinned = chartScaleMax(axis, capacityOn, [bookingByDay, afterLoadByDay]);
  const beforePinned = buildStackedChart(axis, capacityOn, bookingByDay, [DOC_A, DOC_B], scalePinned);
  ok(scalePinned === scale, 'B1 — met één document gepind blijft de schaal dezelfde');
  ok(JSON.stringify(beforePinned.bars) === JSON.stringify(before.bars),
    'B1 — met één document gepind is de staafgeometrie identiek');
  ok(beforePinned.conflictDays.length === 1, 'B1 — met één document gepind blijft de conflictband staan');

  // De capaciteit blijft de bovengrens zolang die het hoogst is (een lege grafiek deelt niet door 0).
  const emptyScale = chartScaleMax(axis, () => 4, [{}, {}]);
  ok(emptyScale === 4, `B1 — zonder boeking bepaalt de capaciteit de schaal (kreeg ${emptyScale})`);
}

// De kleurtoewijzing is stabiel en per rangorde — de dialoog deelt 'm met de fasestroken.
const colors = assignDocColors([DOC_A, DOC_B, DOC_A]);
ok(colors.size === 2 && colors.get(DOC_A) !== colors.get(DOC_B),
  'B9 — elk document krijgt één eigen, onderscheidbare kleur (gedeeld door strook en grafiek)');

// ── B11: `diffReason` is volgorde-ongevoelig ─────────────────────────────────────────────────
function tune(over: Partial<DistributionUiState>): DistributionUiState {
  return {
    companyId: 'lib', libraryItemId: 'item', allowSplits: false,
    order: [DOC_A, DOC_B], pinned: {}, ceilings: {}, applied: null,
    ...over,
  };
}

ok(diffReason(tune({ pinned: { a: true, b: false } }), tune({ pinned: { b: false, a: true } })) === null,
  'B11 — dezelfde pins in een andere sleutelvolgorde is GEEN wijziging');
ok(diffReason(tune({ pinned: { a: true } }), tune({ pinned: { a: true, b: false } })) === null,
  'B11 — een afwezige pin is gelijk aan `false`');
ok(diffReason(tune({ pinned: { a: true } }), tune({ pinned: { a: false } })) === 'pin',
  'B11 — een écht omgezette pin blijft een wijziging');
ok(diffReason(tune({ pinned: {} }), tune({ pinned: { a: true } })) === 'pin',
  'B11 — een nieuw gezette pin blijft een wijziging');

ok(diffReason(tune({ ceilings: { a: 3, b: null } }), tune({ ceilings: { b: null, a: 3 } })) === null,
  'B11 — dezelfde plafonds in een andere sleutelvolgorde is GEEN wijziging');
ok(diffReason(tune({ ceilings: { a: 3 } }), tune({ ceilings: { a: 3, b: null } })) === null,
  'B11 — een afwezig plafond is gelijk aan `null` (onbegrensd)');
ok(diffReason(tune({ ceilings: { a: 3 } }), tune({ ceilings: { a: 0 } })) === 'ceiling',
  'B11 — plafond 0 is iets anders dan plafond 3 (en iets anders dan onbegrensd)');
ok(diffReason(tune({ ceilings: { a: 0 } }), tune({ ceilings: {} })) === 'ceiling',
  'B11 — plafond 0 tegen onbegrensd is een wijziging');

// De taxonomie-volgorde blijft staan: gereedschap vóór rangorde vóór pin vóór plafond.
ok(diffReason(tune({}), tune({ allowSplits: true, order: [DOC_B, DOC_A] })) === 'tool',
  'B11 — het gereedschap wint van de rangorde in de redenvolgorde');
ok(diffReason(tune({}), tune({ order: [DOC_B, DOC_A], pinned: { a: true } })) === 'rank',
  'B11 — de rangorde wint van de pin in de redenvolgorde');
ok(diffReason(tune({}), tune({})) === null, 'B11 — een identieke tune levert geen reden op');

if (failures > 0) {
  console.log(`\n${failures} afwijking(en) in check-distribution-chart-scale`);
  process.exit(1);
}
console.log('\nalles groen — check-distribution-chart-scale');

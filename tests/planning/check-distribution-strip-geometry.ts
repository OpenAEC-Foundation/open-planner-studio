// B1c-plan4 taak 1 — de PURE balkgeometrie van de verdeeldialoog (spec §4/§9).
//
// Drie gevallen uit spec §9, plus de verschil-prijs van §2.2. De as is bewust minimaal: één
// aaneengesloten reeks kalenderdagen, zodat elke x-positie met de hand na te rekenen is
// (`AXIS.padLeft + index * dayWidth`).
//
// De werkdagdefinitie komt als predicaat binnen — deze check gebruikt "ma t/m vr", zodat er geen
// kalendermotor aan te pas komt en de pauzedag-logica geïsoleerd getoetst wordt.
import { AXIS, buildOccupancyAxis, expandDays } from '@/components/panels/occupancyAxis';
import {
  STRIP, buildStripGeometry, savingsWorkdays, maxEndShiftWorkdays,
} from '@/components/dialogs/DistributionDialog/stripGeometry';

let failures = 0;
function ok(cond: boolean, msg: string): void {
  if (cond) console.log(`OK  ${msg}`);
  else { console.log(`XX  ${msg}`); failures++; }
}

// 2026-09-07 is een maandag. Twee volle weken + een dag.
const DAYS = expandDays('2026-09-07', '2026-09-25');
const axis = buildOccupancyAxis(DAYS, { targetWidth: 560 })!;
const dw = axis.dayWidth;
const xAt = (iso: string): number => axis.xOf(iso)!;
const isWorkingDay = (iso: string): boolean => {
  const day = new Date(`${iso}T00:00:00`).getDay();
  return day >= 1 && day <= 5;
};
const load = (isos: string[]): Record<string, number> =>
  Object.fromEntries(isos.map(iso => [iso, 1]));

ok(axis !== null, 'de as over de fixture-dagen bestaat');
ok(dw > 0, `de dagbreedte is positief (${dw})`);

// ── Geval 1: BINNEN DE SPELING ───────────────────────────────────────────────────────────────
// Oorspronkelijk ma 7 t/m wo 9; na de verdeling di 8 t/m do 10. Speling 3 werkdagen: het nieuwe
// einde valt er ruim binnen, dus er hoort GEEN rood te staan.
{
  const before = load(['2026-09-07', '2026-09-08', '2026-09-09']);
  const after = load(['2026-09-08', '2026-09-09', '2026-09-10']);
  const g = buildStripGeometry({
    axis,
    beforeLoadByDay: before,
    loadByDay: after,
    fixedLoadByDay: {},
    isWorkingDay,
    slackWorkdays: 3,
    ceilingWorkdays: 3,
    endShiftWorkdays: 0,
  });

  ok(g.blocks.length === 3, `1 — drie dagblokjes (kreeg ${g.blocks.length})`);
  ok(g.blocks.every(b => b.kind === 'work'), '1 — alle drie zijn werkdagblokjes, geen pauzedag');
  ok(g.blocks[0].x === xAt('2026-09-08'), '1 — het eerste blokje staat op de nieuwe startdag');
  ok(g.blocks[0].w === dw, '1 — een blokje is precies één dagbreedte');
  ok(g.phaseEndX === xAt('2026-09-10') + dw, '1 — het fase-einde ligt achter de laatste geboekte dag');

  // De meetlat: grijs vanaf het OORSPRONKELIJKE einde (wo 9 + 1 = do 10), drie werkdagen lang
  // (do 10, vr 11, ma 14) — dus tot en met ma 14, x = xAt(ma 14) + dw.
  ok(g.slackBar !== null, '1 — er is een grijze spelingsmeetlat');
  ok(g.slackBar!.x === xAt('2026-09-09') + dw, '1 — de speling begint achter het oorspronkelijke fase-einde');
  ok(g.slackBar!.x + g.slackBar!.w === xAt('2026-09-14') + dw,
    '1 — drie WERKdagen speling slaat het weekend over en eindigt na ma 14');
  ok(g.overrunBar === null, '1 — binnen de speling staat er geen rood');

  // Plafond 3 werkdagen, benut 0 ⇒ de handle staat drie werkdagen voorbij het fase-einde
  // (vr 11, ma 14, di 15).
  ok(g.handleX === xAt('2026-09-15') + dw, '1 — de handle staat drie werkdagen voorbij het fase-einde');
  ok(g.freeBox !== null && g.freeBox.x === g.phaseEndX,
    '1 — de gestippelde rest begint op het fase-einde');
  ok(g.freeBox !== null && g.freeBox.x + g.freeBox.w === g.handleX,
    '1 — de gestippelde rest loopt tot de handle');
  ok(g.ceilingEndIso === '2026-09-15', `1 — de plafonddatum is di 15 (kreeg ${g.ceilingEndIso})`);
}

// ── Geval 2: VOORBIJ DE SPELING ──────────────────────────────────────────────────────────────
// Zelfde oorspronkelijke fase, maar het nieuwe einde ligt op do 17 en de speling is maar 1 werkdag.
{
  const before = load(['2026-09-07', '2026-09-08', '2026-09-09']);
  const after = load(['2026-09-15', '2026-09-16', '2026-09-17']);
  const g = buildStripGeometry({
    axis,
    beforeLoadByDay: before,
    loadByDay: after,
    fixedLoadByDay: {},
    isWorkingDay,
    slackWorkdays: 1,
    ceilingWorkdays: null,
    endShiftWorkdays: 5,
  });

  // Eén werkdag speling vanaf do 10 ⇒ de grijze meetlat eindigt na do 10.
  ok(g.slackBar !== null && g.slackBar.x + g.slackBar.w === xAt('2026-09-10') + dw,
    '2 — de grijze meetlat is precies één werkdag lang');
  ok(g.overrunBar !== null, '2 — voorbij de speling staat een rode meetlat');
  ok(g.overrunBar!.x === xAt('2026-09-10') + dw, '2 — het rood begint waar de speling ophoudt');
  ok(g.overrunBar!.x + g.overrunBar!.w === g.phaseEndX, '2 — het rood loopt tot het fase-einde');
  // Onbegrensd plafond ⇒ de handle staat aan het einde van de as (spec §5).
  ok(g.handleX === axis.width - AXIS.padRight, '2 — een onbegrensd plafond zet de handle aan het aseinde');
  ok(g.ceilingEndIso === null, '2 — een onbegrensd plafond heeft geen plafonddatum');
}

// ── Geval 3: MET ONDERBREKINGEN ──────────────────────────────────────────────────────────────
// De fase loopt ma 7 → vr 11, met di 8 en do 10 als ingevoegde pauzedagen. Het weekend ertussen
// telt NIET als pauzedag.
{
  const before = load(['2026-09-07', '2026-09-08', '2026-09-09']);
  const after = load(['2026-09-07', '2026-09-09', '2026-09-11']);
  const g = buildStripGeometry({
    axis,
    beforeLoadByDay: before,
    loadByDay: after,
    fixedLoadByDay: load(['2026-09-07', '2026-09-08']),
    isWorkingDay,
    slackWorkdays: 2,
    ceilingWorkdays: 2,
    endShiftWorkdays: 1,
  });

  ok(g.blocks.length === 5, `3 — vijf blokjes: drie werkdagen + twee pauzedagen (kreeg ${g.blocks.length})`);
  const pauses = g.blocks.filter(b => b.kind === 'pause').map(b => b.iso);
  ok(pauses.join(',') === '2026-09-08,2026-09-10',
    `3 — precies di 8 en do 10 zijn pauzedagen (kreeg ${pauses.join(',')})`);
  ok(g.blocks.every(b => b.iso >= '2026-09-07' && b.iso <= '2026-09-11'),
    '3 — er staat niets buiten de fasespanne');

  // De vaste last is één aaneengesloten band over ma 7 en di 8.
  ok(g.fixedBands.length === 1, `3 — de vaste last is één band (kreeg ${g.fixedBands.length})`);
  ok(g.fixedBands[0].x === xAt('2026-09-07') && g.fixedBands[0].w === 2 * dw,
    '3 — die band beslaat precies twee dagen');

  // Week- en maandlijnen: maandagen 7, 14 en 21 binnen dit domein; geen 1e van de maand.
  ok(g.weekLines.length === 3, `3 — drie weekscheidingen (kreeg ${g.weekLines.length})`);
  ok(g.monthLines.length === 0, '3 — geen maandlijn binnen september');
}

// ── De verschil-prijs (§2.2) ─────────────────────────────────────────────────────────────────
ok(savingsWorkdays(5, 2) === 3, 'prijs — uit 5, aan 2 ⇒ bespaart 3 werkdagen');
ok(savingsWorkdays(4, 4) === 0, 'prijs — even duur ⇒ bespaart niets');
ok(savingsWorkdays(1, 3) === 0, 'prijs — aan is duurder ⇒ geklemd op nul, nooit negatief');
ok(maxEndShiftWorkdays([{ endShiftWorkdays: 1 }, { endShiftWorkdays: 4 }, { endShiftWorkdays: 0 }]) === 4,
  'prijs — de prijs is de UITSCHIETER over de deelnemers, niet de som');
ok(maxEndShiftWorkdays([]) === 0, 'prijs — zonder deelnemers is de prijs nul');

// ── De maatvoering uit het prototype ─────────────────────────────────────────────────────────
ok(STRIP.labelWidth === 150 && STRIP.endWidth === 132 && STRIP.trackHeight === 32,
  'maten — label 150, uitkomstlabel 132, track 32 (prototype tabblad 4)');
ok(STRIP.handleWidth === 15 && STRIP.handleHeight === 30, 'maten — de handle is 15×30');
ok(STRIP.blockHeight === 15 && STRIP.blockTop === 5, 'maten — een dagblokje is 15 hoog op y=5');

if (failures > 0) { console.log(`\n${failures} fout(en)`); process.exit(1); }
console.log('\nalles groen');

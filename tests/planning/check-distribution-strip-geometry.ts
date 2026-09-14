// B1c-plan4 taak 1 — de PURE balkgeometrie van de verdeeldialoog (spec §4/§9).
//
// Drie gevallen uit spec §9, plus de verschil-prijs van §2.2. De hoofd-as is bewust minimaal: één
// aaneengesloten reeks kalenderdagen, zodat elke x-positie met de hand na te rekenen is
// (`AXIS.padLeft + index * dayWidth`).
//
// Daarnaast vier randgevallen uit de review (bevinding B4), die stuk voor stuk een echte fout
// afvangen: een deels benutte uitloop (4), een as met een INGEKLAPT gat waarin de telling over de
// kalender moet lopen en niet over de asdagen (5), een volledig tekort zonder enige na-boeking (6),
// en speling die de as uitloopt (7).
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

// ── Geval 4 (bevinding B4a): BENUTTE UITLOOP MET EEN EINDIG PLAFOND ──────────────────────────
// De uitloop is deels opgesoupeerd (`endShiftWorkdays` 2) terwijl het plafond 5 werkdagen is. Wat
// er dan nog openstaat zijn 3 werkdagen ACHTER het nieuwe fase-einde — dat is de gestippelde rest
// en de stand van de greep.
{
  const before = load(['2026-09-09', '2026-09-10', '2026-09-11']);
  const after = load(['2026-09-14', '2026-09-15', '2026-09-16']);
  const g = buildStripGeometry({
    axis,
    beforeLoadByDay: before,
    loadByDay: after,
    fixedLoadByDay: {},
    isWorkingDay,
    slackWorkdays: 1,
    ceilingWorkdays: 5,
    endShiftWorkdays: 2,
  });

  // Vanaf wo 16: do 17, vr 18, ma 21.
  ok(g.ceilingEndIso === '2026-09-21', `4 — plafond 5 met 2 benut komt uit op ma 21 (kreeg ${g.ceilingEndIso})`);
  ok(g.handleX === xAt('2026-09-21') + dw, '4 — de greep staat drie werkdagen voorbij het fase-einde');
  ok(g.freeBox !== null && g.freeBox.x === g.phaseEndX && g.freeBox.x + g.freeBox.w === g.handleX,
    '4 — de gestippelde rest loopt van het fase-einde tot de greep');
  ok(g.overrunBar !== null && g.overrunBar.x + g.overrunBar.w === g.phaseEndX,
    '4 — voorbij de ene werkdag speling staat rood tot aan het fase-einde');
}

// ── Geval 5 (bevinding B4b): EEN AS MET EEN INGEKLAPT GAT ────────────────────────────────────
// Dit document boekt 2 t/m 6 maart; een ander boekt pas 1 t/m 5 juni. `buildOccupancyAxis` klapt
// dat gat van bijna drie maanden weg, dus de as heeft twee segmenten. Het plafond moet dan op de
// ECHTE kalenderdatum uitkomen (vr 13 maart), terwijl er niets dwars door de breuk getekend wordt.
{
  const mine = load(expandDays('2026-03-02', '2026-03-06'));
  const theirs = load(expandDays('2026-06-01', '2026-06-05'));
  const gapAxis = buildOccupancyAxis([...Object.keys(mine), ...Object.keys(theirs)], { targetWidth: 560 })!;
  const segmentEnd = gapAxis.segments[0].x0 + gapAxis.segments[0].days.length * gapAxis.dayWidth;
  const g = buildStripGeometry({
    axis: gapAxis,
    beforeLoadByDay: mine,
    loadByDay: mine,
    fixedLoadByDay: theirs,
    isWorkingDay,
    slackWorkdays: 5,
    ceilingWorkdays: 5,
    endShiftWorkdays: 0,
  });

  ok(gapAxis.segments.length === 2, `5 — de as valt in twee segmenten (kreeg ${gapAxis.segments.length})`);
  ok(gapAxis.breaks.length === 1, '5 — er is één breukmarkering');
  // Vijf werkdagen ná vr 6 maart: ma 9, di 10, wo 11, do 12, vr 13. Dat is een KALENDERwandeling;
  // over de asdagen zou hij in juni uitkomen.
  ok(g.ceilingEndIso === '2026-03-13', `5 — het plafond komt uit op vr 13 maart (kreeg ${g.ceilingEndIso})`);
  ok(g.handleX === segmentEnd, '5 — de greep wordt op de rechterrand van het eerste segment geklemd');
  ok(g.handleX < gapAxis.breaks[0], '5 — de greep staat vóór de breuk, niet erachter');
  const beyondBreak = (band: { x: number; w: number } | null): boolean =>
    band !== null && band.x + band.w > segmentEnd;
  ok(!beyondBreak(g.slackBar), '5 — de spelingsmeetlat loopt niet door de breuk heen');
  ok(!beyondBreak(g.freeBox), '5 — de gestippelde rest loopt niet door de breuk heen');
  ok(!beyondBreak(g.overrunBar), '5 — de rode meetlat loopt niet door de breuk heen');
  ok(g.blocks.every(b => b.iso <= '2026-03-06'), '5 — er staat geen dagblokje in het tweede segment');
}

// ── Geval 6 (bevinding B4c): VOLLEDIG TEKORT — NIETS MEER GEBOEKT ────────────────────────────
// Past er niets, dan is de na-stand leeg. De rij hoort dan nog steeds bij het werk zoals het er
// vóór stond en niet aan het begin van de as te landen.
{
  const before = load(['2026-09-16', '2026-09-17']);
  const g = buildStripGeometry({
    axis,
    beforeLoadByDay: before,
    loadByDay: {},
    fixedLoadByDay: {},
    isWorkingDay,
    slackWorkdays: 2,
    ceilingWorkdays: 3,
    endShiftWorkdays: 0,
  });

  ok(g.blocks.length === 0, '6 — een lege na-stand tekent geen dagblokjes');
  ok(g.phaseEndX === xAt('2026-09-17') + dw,
    '6 — het fase-einde valt terug op het oorspronkelijke einde, niet op de linkerrand');
  ok(g.phaseEndX !== AXIS.padLeft, '6 — de rij ankert dus niet aan het begin van de as');
  // Drie werkdagen ná do 17: vr 18, ma 21, di 22.
  ok(g.ceilingEndIso === '2026-09-22', `6 — de plafonddatum rekent vanaf dat anker (kreeg ${g.ceilingEndIso})`);
  ok(g.handleX === xAt('2026-09-22') + dw, '6 — de greep staat rechts van het oorspronkelijke einde');
  ok(g.slackBar !== null && g.slackBar.x === g.phaseEndX,
    '6 — de meetlat sluit aan op datzelfde anker');
  ok(g.overrunBar === null, '6 — zonder boeking is er geen einddatum-verschuiving te tekenen');
}

// ── Geval 7 (bevinding B4d): SPELING DIE DE AS UITLOOPT ──────────────────────────────────────
// Tien werkdagen speling vanaf wo 23 sep loopt ruim voorbij de laatste asdag (vr 25). De meetlat
// mag de track niet verlaten, maar de plafonddatum blijft de echte kalenderdatum.
{
  const before = load(['2026-09-22', '2026-09-23']);
  const trackRight = axis.width - AXIS.padRight;
  const g = buildStripGeometry({
    axis,
    beforeLoadByDay: before,
    loadByDay: before,
    fixedLoadByDay: {},
    isWorkingDay,
    slackWorkdays: 10,
    ceilingWorkdays: 10,
    endShiftWorkdays: 0,
  });

  ok(g.slackBar !== null, '7 — er is een spelingsmeetlat');
  ok(g.slackBar!.x + g.slackBar!.w === trackRight, '7 — die wordt op de rechterrand van de track geklemd');
  ok(g.handleX === trackRight, '7 — de greep verlaat de track niet');
  // Tien werkdagen ná wo 23 sep: do 24, vr 25, ma 28 … vr 2 okt, ma 5, di 6, wo 7.
  ok(g.ceilingEndIso === '2026-10-07',
    `7 — de plafonddatum blijft de ECHTE kalenderdatum, ook buiten de as (kreeg ${g.ceilingEndIso})`);
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

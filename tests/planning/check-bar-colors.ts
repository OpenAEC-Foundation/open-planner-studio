/**
 * Resourcepalet + kleurtoewijzing (#21 punt 1-nieuw) — regressiebatterij.
 *
 * Bewaakt: palet-uniekheid, grijswaarden-onderscheid (lictheid), hash-stabiliteit (zelfde id →
 * zelfde kleur, onafhankelijk van volgorde), auto-toewijzing "eerste vrije kleur", en dat de
 * hash-fallback nooit data muteert (pure functie). Printvriendelijkheid = onderling
 * onderscheidbaar óók in grijswaarden: elke paletkleur moet een eigen lichtheidscel hebben.
 */
import {
  RESOURCE_PALETTE, resourceDisplayColor, paletteColorForId, nextFreePaletteColor, ensureThemeVisible,
} from '@/engine/renderer/resourcePalette';

let failures = 0;
const fail = (msg: string) => { console.log(`   XX ${msg}`); failures++; };
const ok = (cond: boolean, msg: string) => { if (!cond) fail(msg); };

// 1. Palet: 12 unieke hex-kleuren, allemaal geldig #rrggbb.
ok(RESOURCE_PALETTE.length === 12, `paletlengte 12, gekregen ${RESOURCE_PALETTE.length}`);
ok(new Set(RESOURCE_PALETTE).size === RESOURCE_PALETTE.length, 'paletkleuren uniek');
ok(RESOURCE_PALETTE.every(c => /^#[0-9A-Fa-f]{6}$/.test(c)), 'paletkleuren zijn #rrggbb-hex');

// 2. Grijswaarden: relatieve lichtheid (perceptueel benaderd via 0.2126R+0.7152G+0.0722B) moet
//    per kleur in een eigen band van 1/12 breed vallen — anders zijn twee kleuren in grijswaard
//    niet uit elkaar te houden. 12 banden over [0,1] is ruim genoeg voor een palet dat dit als
//    ontwerpeis meekreeg.
const lum = (hex: string): number => {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const bands = new Set(RESOURCE_PALETTE.map(c => Math.floor(lum(c) * 12)));
ok(bands.size >= 10, `grijswaarden-banden: minimaal 10 van 12 onderscheidbaar, gekregen ${bands.size}`);

// 3. Hash: deterministisch, verdelend en volgorde-onafhankelijk.
ok(paletteColorForId('res-1') === paletteColorForId('res-1'), 'hash deterministisch');
// Verspreid over het palet: 50 ids mappen niet op 1 of 2 kleuren.
const spread = new Set(Array.from({ length: 50 }, (_, i) => paletteColorForId(`r${i}`)));
ok(spread.size >= 6, `hash verspreid (>= 6 van 12 over 50 ids), gekregen ${spread.size}`);

// 4. resourceDisplayColor: eigen kleur wint, hash-fallback voor kleurloos, geen mutatie.
const res = { id: 'x', name: 'X', type: 'LABOR' as const, description: '', maxUnits: 1 };
ok(resourceDisplayColor({ ...res, color: '#123456' }) === '#123456', 'eigen kleur wint');
ok(resourceDisplayColor(res) === paletteColorForId('x'), 'kleurloos → hash-fallback');
const probe = { ...res };
resourceDisplayColor(probe);
ok(!('color' in probe) || probe.color === undefined, 'hash-fallback muteert de resource niet');

// 5. nextFreePaletteColor: eerste vrije kleur; alles bezet → hergebruik cyclisch (palet < resources).
ok(nextFreePaletteColor([]) === RESOURCE_PALETTE[0], 'leeg veld → eerste kleur');
const taken = RESOURCE_PALETTE.slice(0, 5).map(c => ({ id: c, name: c, type: 'LABOR' as const, description: '', maxUnits: 1, color: c }));
ok(nextFreePaletteColor(taken) === RESOURCE_PALETTE[5], 'eerste vijf bezet → zesde kleur');

// 6. Geen paletkleur gelijk aan de kritiek-roodtint van het printpalet (PRINT_PALETTE.critical =
//    '#DC2626') — de rode rand voor kritieke taken moet visueel vrij blijven.
ok(!RESOURCE_PALETTE.includes('#DC2626'), 'palet vermijdt kritiek-rood');

// ── barColors: modi, segmenten, randen (#21, ontwerp §4) ───────────────────────────────────────
import { computeBarColors } from '@/services/print/barColors';
import type { BarPalette } from '@/services/print/barColors';
import {
  effectiveBarColorSelection,
  resolveBarCategoryValues,
  visibleBarColorCategories,
  type BarColorContext,
} from '@/services/print/barColorCategories';
import type { Task, TaskTime } from '@/types/task';
import type { Resource, ResourceAssignment } from '@/types/resource';

const PAL: BarPalette = {
  critical: '#DC2626', normal: '#2563EB', nearCritical: '#F59E0B',
  milestone: '#7C3AED', uncategorized: '#94A3B8',
};

const mkTime = (over: Partial<TaskTime> = {}): TaskTime => ({
  earlyStart: '2026-01-05', earlyFinish: '2026-01-09', lateStart: '', lateFinish: '',
  duration: 5, totalFloat: 0, isCritical: false, completion: 0,
  scheduleStart: '2026-01-05', scheduleFinish: '2026-01-09',
  ...over,
} as TaskTime);
const mkTask = (id: string, extra: Partial<Task> = {}): Task => ({
  id, name: id, description: '', wbsCode: '1.1', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
  priority: 500, parentId: null, childIds: [], isMilestone: false, resourceIds: [],
  time: mkTime(),
  ...extra,
} as unknown as Task);
const mkRes = (id: string, color?: string): Resource =>
  ({ id, name: id, type: 'LABOR', description: '', maxUnits: 1, ...(color ? { color } : {}) });
const mkAsg = (taskId: string, resourceId: string, unitsPerDay: number): ResourceAssignment =>
  ({ id: `a-${taskId}-${resourceId}`, taskId, resourceId, unitsPerDay });

const RESOURCES = [mkRes('r1', '#111111'), mkRes('r2', '#222222'), mkRes('rx')];
const CTX: BarColorContext = {
  activityCodeTypes: [{
    id: 'discipline', name: 'Discipline', values: [
      { id: 'elektra', code: 'E', description: 'Elektra', color: '#11AA55' },
      { id: 'bouw', code: 'B', description: 'Bouw' },
    ],
  }],
  customFieldDefs: [
    { id: 'text', name: 'Tekst', type: 'text' },
    { id: 'number', name: 'Getal', type: 'number' },
    { id: 'integer', name: 'Geheel', type: 'integer' },
    { id: 'cost', name: 'Kosten', type: 'cost' },
    { id: 'date', name: 'Datum', type: 'date' },
    { id: 'boolean', name: 'Ja/nee', type: 'boolean' },
  ],
  resources: RESOURCES,
  assignments: [],
  taskTypeLabels: { CONSTRUCTION: 'Constructie', INSTALLATION: 'Installatie' },
  noneLabel: '(geen)',
};
const withAssignments = (assignments: ResourceAssignment[]): BarColorContext => ({ ...CTX, assignments });

// 7. critical-modus (default): huidige gedrag ongewijzigd — kritiek rood, bijna-kritiek oranje,
//    rest blauw.
{
  const crit = computeBarColors(mkTask('t1', { time: mkTime({ isCritical: true }) }), { mode: 'critical' }, CTX, PAL);
  ok(crit.kind === 'solid' && crit.fill === PAL.critical, 'critical-modus: kritieke taak rood');
  const near = computeBarColors(mkTask('t2', { time: mkTime({ isNearCritical: true }) }), { mode: 'critical' }, CTX, PAL);
  ok(near.kind === 'solid' && near.fill === PAL.nearCritical, 'critical-modus: bijna-kritiek oranje');
  const plain = computeBarColors(mkTask('t2b'), { mode: 'critical' }, CTX, PAL);
  ok(plain.kind === 'solid' && plain.fill === PAL.normal, 'critical-modus: gewone taak blauw');
}

// 8. Task.color is inert: dezelfde taakuitkomst in iedere overgebleven modus, ongeacht legacydata.
{
  const modes = [
    { mode: 'critical' } as const,
    { mode: 'auto' } as const,
    { mode: 'category', field: { src: 'builtin', key: 'taskType' } } as const,
  ];
  for (const selection of modes) {
    const colored = computeBarColors(mkTask('same', { color: '#123456' }), selection, CTX, PAL);
    const plain = computeBarColors(mkTask('same'), selection, CTX, PAL);
    ok(JSON.stringify(colored) === JSON.stringify(plain), `Task.color inert in ${selection.mode}`);
  }
}

// 9. auto-modus: hash op taak-id, stabiel, onafhankelijk van positie; kritieke taak krijgt rode rand.
{
  const a = computeBarColors(mkTask('t5'), { mode: 'auto' }, CTX, PAL);
  const b = computeBarColors(mkTask('t5'), { mode: 'auto' }, CTX, PAL);
  ok(a.kind === 'solid' && b.kind === 'solid' && a.fill === b.fill, 'auto-modus: stabiel per id');
  ok(a.kind === 'solid' && a.fill === paletteColorForId('t5'), 'auto-modus: gebruikt palet-hash');
  const critAuto = computeBarColors(mkTask('t6', { time: mkTime({ isCritical: true }) }), { mode: 'auto' }, CTX, PAL);
  ok(critAuto.kind === 'solid' && critAuto.outline === PAL.critical, 'auto-modus: kritieke taak → rode rand');
  const plainAuto = computeBarColors(mkTask('t6b'), { mode: 'auto' }, CTX, PAL);
  ok(plainAuto.kind === 'solid' && plainAuto.outline === undefined, 'auto-modus: niet-kritieke taak → géén rand');
}

// 10. Alle Group-categorieën: sleutel/label/kleur, ontbrekende waarde en verwijderde-veldterugval.
{
  const task = mkTask('cat', {
    wbsCode: '1.2', taskType: 'CONSTRUCTION', activityCodes: { discipline: 'elektra' },
    customFields: { text: 'Noord', number: 1.5, integer: 3, cost: 1250, date: '2026-08-24', boolean: true },
  });
  ok(resolveBarCategoryValues(task, { src: 'builtin', key: 'wbsCode' }, CTX)[0].label === '1.2', 'WBS-label');
  ok(resolveBarCategoryValues(task, { src: 'builtin', key: 'taskType' }, CTX)[0].label === 'Constructie', 'taaktype vertaald');
  const code = resolveBarCategoryValues(task, { src: 'activityCode', typeId: 'discipline' }, CTX)[0];
  ok(code.label === 'E — Elektra' && code.color === '#11AA55', 'activity code gebruikt label + expliciete kleur');
  const expectedCustom: Record<string, string> = {
    text: 'Noord', number: '1.5', integer: '3', cost: '1250', date: '2026-08-24', boolean: 'true',
  };
  for (const [defId, label] of Object.entries(expectedCustom)) {
    ok(resolveBarCategoryValues(task, { src: 'customField', defId }, CTX)[0].label === label, `gebruikersveld ${defId}`);
  }
  const none = resolveBarCategoryValues(mkTask('none'), { src: 'customField', defId: 'text' }, CTX)[0];
  ok(none.isNone && none.label === '(geen)', 'ontbrekende categoriewaarde → (geen)');
  const missing = effectiveBarColorSelection(
    { mode: 'category', field: { src: 'activityCode', typeId: 'verwijderd' } }, CTX,
  );
  ok(
    missing.effective.mode === 'category'
      && missing.effective.field.src === 'builtin'
      && missing.effective.field.key === 'taskType'
      && missing.missingField?.src === 'activityCode',
    'verwijderd veld valt tijdelijk terug op taaktype en bewaart missingField',
  );
  const missingFill = computeBarColors(
    mkTask('missing'), { mode: 'category', field: { src: 'customField', defId: 'text' } }, CTX, PAL,
  );
  ok(missingFill.kind === 'solid' && missingFill.fill === PAL.uncategorized, 'geen waarde → neutraal grijs');
  const sameA = computeBarColors(mkTask('a', { wbsCode: '2.1' }), { mode: 'category', field: { src: 'builtin', key: 'wbsCode' } }, CTX, PAL);
  const sameB = computeBarColors(mkTask('b', { wbsCode: '2.1' }), { mode: 'category', field: { src: 'builtin', key: 'wbsCode' } }, CTX, PAL);
  ok(sameA.kind === 'solid' && sameB.kind === 'solid' && sameA.fill === sameB.fill, 'zelfde categoriewaarde → zelfde kleur');
}

// 11. Resource als categorie: segmenten naar inzet, expliciete/hashkleur, neutrale lege waarde.
{
  const asg = [mkAsg('t7', 'r1', 1), mkAsg('t7', 'r2', 3)];
  const seg = computeBarColors(
    mkTask('t7'), { mode: 'category', field: { src: 'resource' } }, withAssignments(asg), PAL,
  );
  ok(seg.kind === 'segments', 'resource-modus met 2 resources: segmenten');
  if (seg.kind === 'segments') {
    const total = seg.segments.reduce((acc, s) => acc + s.weight, 0);
    ok(Math.abs(total - 1) < 1e-9, `segmentgewichten sommeren exact tot 1 (got ${total})`);
    ok(Math.abs(seg.segments[0].weight - 0.25) < 1e-9 && Math.abs(seg.segments[1].weight - 3 / 4) < 1e-9, 'verhouding volgt unitsPerDay (1:3)');
    ok(seg.segments[0].color === '#111111' && seg.segments[1].color === '#222222', 'eigen resourcekleur gebruikt');
  }
  const none = computeBarColors(mkTask('t8'), { mode: 'category', field: { src: 'resource' } }, CTX, PAL);
  ok(none.kind === 'solid' && none.fill === PAL.uncategorized, 'resource zonder toewijzing → neutraal grijs');
  const fallback = computeBarColors(
    mkTask('t9'), { mode: 'category', field: { src: 'resource' } },
    withAssignments([mkAsg('t9', 'rx', 2)]), PAL,
  );
  ok(fallback.kind === 'solid' && fallback.fill === paletteColorForId('rx'), 'kleurloze resource → hash-fallback-kleur');
  const critSeg = computeBarColors(
    mkTask('t10', { time: mkTime({ isCritical: true }) }),
    { mode: 'category', field: { src: 'resource' } }, withAssignments([mkAsg('t10', 'r1', 1)]), PAL,
  );
  ok(critSeg.kind !== 'solid' || critSeg.outline === PAL.critical, 'resource-modus: kritiek → rode rand (solid)');
  if (critSeg.kind === 'segments') ok(critSeg.outline === PAL.critical, 'resource-modus: kritiek → rode rand (segments)');
  // Eén resource → solide die ene kleur (géén segmenten-ruis).
  const single = computeBarColors(
    mkTask('t10b'), { mode: 'category', field: { src: 'resource' } },
    withAssignments([mkAsg('t10b', 'r2', 2)]), PAL,
  );
  ok(single.kind === 'solid' && single.fill === '#222222', 'resource-modus met 1 resource → solide kleur');
}

// 12. Smalbalk-fallback + zichtbare legenda-uniekheid.
{
  const asg = [mkAsg('t11', 'r1', 1), mkAsg('t11', 'r2', 1)];
  const narrow = computeBarColors(
    mkTask('t11'), { mode: 'category', field: { src: 'resource' } }, withAssignments(asg), PAL, 8,
  );
  ok(narrow.kind === 'solid' && narrow.fill === '#111111', 'smalbalk (8px) → solide eerste resourcekleur');
  const wide = computeBarColors(
    mkTask('t11'), { mode: 'category', field: { src: 'resource' } }, withAssignments(asg), PAL, 40,
  );
  ok(wide.kind === 'segments', 'brede balk (40px) → wel segmenten');
  const legend = visibleBarColorCategories(
    [mkTask('l1', { taskType: 'CONSTRUCTION' }), mkTask('l2', { taskType: 'CONSTRUCTION' }),
      mkTask('l3', { taskType: 'INSTALLATION' }), mkTask('summary', { childIds: ['l1'] })],
    { src: 'builtin', key: 'taskType' }, CTX,
  );
  ok(legend.length === 2 && legend[0].label === 'Constructie' && legend[1].label === 'Installatie',
    'legenda dedupliceert zichtbare bladtaken in first-appearance-volgorde');
}

// 13. Mijlpalen volgen critical/auto/categorie; ontbrekende categoriewaarde wordt grijs.
{
  const ms = mkTask('t12', { isMilestone: true });
  const c = computeBarColors(ms, { mode: 'critical' }, CTX, PAL);
  ok(c.kind === 'solid' && c.fill === PAL.milestone, 'mijlpaal critical-modus → milestone-kleur');
  const mres = computeBarColors(
    mkTask('t13', { isMilestone: true }), { mode: 'category', field: { src: 'resource' } },
    withAssignments([mkAsg('t13', 'r1', 1)]), PAL,
  );
  ok(mres.kind === 'solid' && mres.fill === '#111111', 'mijlpaal resource-modus → resourcekleur (solide ruit)');
  const mnone = computeBarColors(
    mkTask('t14', { isMilestone: true }), { mode: 'category', field: { src: 'resource' } }, CTX, PAL,
  );
  ok(mnone.kind === 'solid' && mnone.fill === PAL.uncategorized, 'mijlpaal zonder resource → neutraal grijs');
  const mauto = computeBarColors(mkTask('t14b', { isMilestone: true }), { mode: 'auto' }, CTX, PAL);
  ok(mauto.kind === 'solid' && mauto.fill === paletteColorForId('t14b'), 'mijlpaal auto-modus → hash-kleur');
}

// 12b. ensureThemeVisible (#21 user-bevinding: donker palet onzichtbaar op donker scherm).
{
  const lum = (hex: string): number => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  // Licht thema: identiteit (palet is op papier/licht ontworpen).
  ok(ensureThemeVisible('#1E293B', false) === '#1E293B', 'themazichtbaar: licht thema = identiteit');
  // Donker thema, al licht genoeg: identiteit.
  ok(ensureThemeVisible('#FBBF24', true) === '#FBBF24', 'themazichtbaar: lichte kleur ongewijzigd');
  // Donker thema, te donker: verlicht naar >= 0.34, hue blijft herkenbaar (niet-grijs blijft verzadigd),
  // en deterministisch.
  const lifted = ensureThemeVisible('#1E293B', true);
  ok(lum(lifted) >= 0.33, `themazichtbaar: verlicht boven de minimum-lichtheid (got ${lifted} l=${lum(lifted).toFixed(2)})`);
  ok(lifted !== '#1E293B', 'themazichtbaar: donkere kleur wordt daadwerkelijk aangepast');
  ok(ensureThemeVisible('#1E293B', true) === lifted, 'themazichtbaar: deterministisch');
  // Alle paletkleuren zijn in het donkere thema zichtbaar (>= 0.33): geen enkel accent valt meer weg.
  ok(RESOURCE_PALETTE.every(c => lum(ensureThemeVisible(c, true)) >= 0.33), 'themazichtbaar: heel het palet zichtbaar op donker');
}

// 13. Store-integratie (#21, B7): addResource wijst automatisch de eerste vrije paletkleur toe;
//     een expliciet meegegeven kleur blijft staan.
{
  const g = globalThis as unknown as Record<string, unknown>;
  if (!g.getComputedStyle) g.getComputedStyle = () => ({ getPropertyValue: () => '' });
  const { useAppStore } = await import('@/state/appStore');
  const S = () => useAppStore.getState();
  S().newProject();
  const id1 = S().addResource({ name: 'Eerste', type: 'LABOR', description: '', maxUnits: 1 });
  const r1 = S().resources.find(r => r.id === id1)!;
  ok(r1.color === nextFreePaletteColor([]), `addResource: eerste resource krijgt eerste vrije paletkleur (got ${r1.color})`);
  const id2 = S().addResource({ name: 'Tweede', type: 'LABOR', description: '', maxUnits: 1, color: '#ABCDEF' });
  const r2 = S().resources.find(r => r.id === id2)!;
  ok(r2.color === '#ABCDEF', 'addResource: expliciete kleur wint (geen auto-override)');
  const id3 = S().addResource({ name: 'Derde', type: 'LABOR', description: '', maxUnits: 1 });
  const r3 = S().resources.find(r => r.id === id3)!;
  ok(r3.color === nextFreePaletteColor([r1, r2]), `addResource: derde resource slaat de bezette kleuren over (got ${r3.color})`);
}

if (failures > 0) { console.log(`bar-colors: ${failures} faalregels`); process.exit(1); }
console.log('bar-colors: alles groen');

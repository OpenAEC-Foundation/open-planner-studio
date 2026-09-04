# Rapport-exportopties (balkkleuren, statuslijn, volg-weergave) — implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drie rapportexport-features uit #21/#54: balkkleurmodi (kritiek-pad / per taak automatisch / per taak eigen / per resource met segmenten), statusdatum-/voortgangslijn in de export, en "volg weergave" (export tekent de viewRows van het scherm).

**Architecture:** De printlaag blijft dom: `renderReport` krijgt nieuwe optionele `PrintOptions`-velden (`barColorMode`, `statusLine`, `rows`, `resources`, `assignments`, `statusDate`) en tekent wat hij krijgt. Kleurlogica leeft in een nieuwe pure module `src/services/print/barColors.ts` bovenop een nieuw palet `src/engine/renderer/resourcePalette.ts`. `Resource.color` is een nieuw data-veld met IFC-round-trip via het bestaande `OPS_Resource`-pset; het staat bewust NIET in `RESOURCE_DIFF_FIELDS`. Preview én vector-export delen `renderReport`, dus één wijziging dekt beide.

**Tech Stack:** TypeScript/React 19, Zustand+Immer, IFC 4.3 (STEP), headless Node-checks via esbuild (tests/planning/run.sh-patroon).

**Spec:** `docs/superpowers/specs/2026-08-14-rapport-export-opties-design.md` (besluiten B1–B9).

**Werkinstructies:** Dit is de `claude/rapport-export-opties`-branch. Na élke taak `npm run typecheck` groen houden; na taken die planningscode raken `npm run test:planning`. Commits in het Nederlands, conform repo-stijl, met `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`. De planning-suite print "alles groen" ook bij exit 1 — vertrouw op de exitcode (`echo $?`), nooit op de tail.

---

## Achtergrond voor de uitvoerder (lees dit eerst)

- **Paden/path-alias:** `@/` → `src/`. Altijd gebruiken in imports.
- **De printpijplijn:** `renderReport(makeDraw2D, tasks, sequences, calendar, projectName, options)` in `src/services/print/printPreview.ts` tekent tegen een `Draw2D`-interface (`src/services/pdf/draw2d.ts`) met twee backends: `CanvasDraw2D` (preview/raster, `renderPrintCanvas`-wrapper) en pdf-lib (vector-export). Beide gaan door dézelfde `renderReport` — tests kunnen een eigen recording-`Draw2D`-stub meegeven (patroon: `tests/planning/check-today-label.ts` en `check-dependency-style.ts`).
- **ViewRow:** `{ kind: 'task'; task: Task; depth: number; dimmed: boolean } | { kind: 'group'; key; label; count; depth; levelIndex; collapsed }` uit `src/engine/view/visibleRows.ts`. De store-cache heet `viewRows` (via `useAppStore(s => s.viewRows)`).
- **Kleuren vandaag:** print kiest in printPreview.ts (normal task bar): `isCritical ? PRINT_COLORS.critical : PRINT_COLORS.normal`. `PRINT_COLORS` = `PRINT_PALETTE` uit `src/engine/renderer/themePalette.ts`.
- **Tests registreren:** nieuwe checks in `tests/planning/run.sh` registreren met het vaste patroon `BCHECK="$DIR/.bar-colors.mjs"; if bundle_check "$DIR/check-bar-colors.ts" "$BCHECK"; then node "$BCHECK" || STATUS=1; fi` — kijk naar het einde van dat bestand waar de laatste checks staan en voeg de nieuwe direct daarna toe.
- **i18n:** brontalen nl+en; nieuwe sleutels horen in `src/i18n/locales/{nl,en}/report.json` (+`menu.json` voor de Beeld-toggle). De overige 12 talen volgen via `npm run verify:i18n` — die poort faalt op ontbrekende keys, dus voeg ze in alle 14 locales toe (commitberichten in deze repo doen dat ook direct).

---

### Task 1: `resourcePalette.ts` — palet + hash + auto-toewijzing (puur)

**Files:**
- Create: `src/engine/renderer/resourcePalette.ts`
- Test: `tests/planning/check-bar-colors.ts`

- [ ] **Step 1: Write the failing test**

Maak `tests/planning/check-bar-colors.ts` met deze inhoud (kopcommentaar volgens repo-stijl: probleem → wat de check bewaakt):

```ts
/**
 * Resourcepalet + kleurtoewijzing (#21 punt 1-nieuw) — regressiebatterij.
 *
 * Bewaakt: palet-uniekheid, grijswaarden-onderscheid (lictheid), hash-stabiliteit (zelfde id →
 * zelfde kleur, onafhankelijk van volgorde), auto-toewijzing "eerste vrije kleur", en dat de
 * hash-fallback nooit data muteert (pure functie). Printvriendelijkheid = onderling
 * onderscheidbaar óók in grijswaarden: elke paletkleur moet een eigen lichtheidscel hebben.
 */
import {
  RESOURCE_PALETTE, resourceDisplayColor, paletteColorForId, nextFreePaletteColor,
} from '@/engine/renderer/resourcePalette';

let failures = 0;
const fail = (msg: string) => { console.log(`   XX ${msg}`); failures++; };
const ok = (cond: boolean, msg: string) => { if (!cond) fail(msg); };

// 1. Palet: 12 unieke hex-kleuren, allemaal geldig #rrggbb.
ok(RESOURCE_PALETTE.length === 12, `paletlengte 12, gekregen ${RESOURCE_PALETTE.length}`);
ok(new Set(RESOURCE_PALETTE).size === RESOURCE_PALETTE.length, 'paletkleuren uniek');
ok(RESOURCE_PALETTE.every(c => /^#[0-9A-Fa-f]{6}$/.test(c)), 'paletkleuren zijn #rrggbb-hex');

// 2. Grijswaarden: relatieve lichtheid (perceptueel benaderd via 0.2126R+0.7152G+0.0722B) moet
//    per kleur in een eigen band van 100/12 breed vallen — anders zijn twee kleuren in grijswaard
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

if (failures > 0) { console.log(`bar-colors: ${failures} faalregels`); process.exit(1); }
console.log('bar-colors: alles groen');
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/nozzit/open-aec/open-planner-studio && npx esbuild tests/planning/check-bar-colors.ts --bundle --platform=node --format=esm --outfile=/tmp/bc.mjs --external:node:* 2>&1 | tail -3; node /tmp/bc.mjs 2>&1 | tail -3
```

Expected: FAIL — esbuild faalt op "Could not resolve '@/engine/renderer/resourcePalette'" (module bestaat nog niet).

- [ ] **Step 3: Write minimal implementation**

Maak `src/engine/renderer/resourcePalette.ts`:

```ts
// Resource-/taakkleurpalet (#21 punt 1-nieuw, ontwerpdoc 2026-08-14 §3). Eén vast, printvriendelijk
// palet voor twee doelen: (a) automatische kleurtoewijzing aan resources (B1/B7), (b) de automatische
// per-taak-regenboog (B6, modus 'auto'). PUUR: geen store-/React-imports — headless testbaar.
//
// Ontwerpeisen (vastgelegd in tests/planning/check-bar-colors.ts):
//  1. 12 kleuren, onderling onderscheidbaar ÓÓK in grijswaarden (elke kleur een eigen lichtheidsband
//     — zwart-wit laserprinters en grijswaarden-PDF-viewers bestaan echt op bouwplaatsen);
//  2. géén van de kleuren is de kritiek-roodtint van het printpalet ('#DC2626') — rood is gereserveerd
//     voor de rode rand om kritieke taken in de niet-critical kleurmodi (B5);
//  3. voldoende verzadiging om op een lichte printachtergrond te staan.
//
// De lichtheden lopen bewust sterk uiteen (0.13 … 0.80): band ~100/12 breed per kleur.
import type { Resource } from '@/types/resource';

export const RESOURCE_PALETTE: readonly string[] = [
  '#0EA5E9', // 0  sky-500        (lichtheid ~0.55)
  '#16A34A', // 1  green-600      (~0.45)
  '#CA8A04', // 2  yellow-600     (~0.55) — géén tint in de buurt van critical-rood #DC2626
  '#7C3AED', // 3  violet-600     (~0.30)
  '#DB2777', // 4  pink-600       (~0.40)
  '#0F766E', // 5  teal-700       (~0.35)
  '#65A30D', // 6  lime-600       (~0.55)
  '#475569', // 7  slate-600      (~0.30)
  '#EA580C', // 8  orange-600     (~0.55)
  '#9333EA', // 9  purple-600     (~0.30)
  '#0284C7', // 10 sky-600        (~0.45)
  '#B45309', // 11 amber-700      (~0.45)
];

/** Kleine, deterministische string-hash (FNV-1a, 32-bit) — geen cryptografie, wel stabiel op
 *  elke machine/run (B7): hetzelfde id krijgt altijd dezelfde kleur, ongeacht volgorde. */
function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Weergavekleur voor een willekeurig id (resource of taak): hash → paletindex. Puur. */
export function paletteColorForId(id: string): string {
  return RESOURCE_PALETTE[hashId(id) % RESOURCE_PALETTE.length];
}

/**
 * De kleur waarin een resource getekend wordt: haar eigen, expliciet gekozen kleur als die er is,
 * anders de deterministische hash-fallback (B7). Muteert NOOIT de resource — kleurloze resources
 * blijven kleurloos in de data; de fallback is puur weergave. Zo werkt resource-kleuring direct
 * voor elk bestaand project zonder migratie of dirty-vlag.
 */
export function resourceDisplayColor(res: Pick<Resource, 'id' | 'color'>): string {
  return res.color || paletteColorForId(res.id);
}

/**
 * Eerste paletkleur die nog niet door een andere resource in gebruik is (B7, auto-toewijzing bij
 * aanmaak). Alles bezet → hergebruik cyclisch vanaf index 0 (palet is eindig; bij >12 resources
 * is een dubbel onvermijdbaar en is "voorspelbaar" belangrijker dan "uniek"). Vergelijkt de
 * DISPLAYkleur (eigen kleur òf hash), niet alleen het `color`-veld — twee resources waarvan de
 * ene expliciet de hash-kleur van de andere koos zijn visueel dezelfde, en dat is wat telt.
 */
export function nextFreePaletteColor(existing: ReadonlyArray<Pick<Resource, 'id' | 'color'>>): string {
  const used = new Set(existing.map(resourceDisplayColor));
  for (const c of RESOURCE_PALETTE) if (!used.has(c)) return c;
  return RESOURCE_PALETTE[0];
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx esbuild tests/planning/check-bar-colors.ts --bundle --platform=node --format=esm --outfile=/tmp/bc.mjs --external:node:* && node /tmp/bc.mjs; echo "exit=$?"
```

Expected: `bar-colors: alles groen` en `exit=0`. Val op: de grijswaarden-bands-check is een minimum-eis (`>= 10`); past jouw palet daar niet in, kies andere tinten — niet de eis verlagen.

- [ ] **Step 5: Registreer de check in de suite**

Voeg in `tests/planning/run.sh`, direct ná het `DEPSTYLECHECK`-blok (ca. regel 282), toe:

```bash
  # Resourcepalet + kleurtoewijzing (#21 punt 1-nieuw): uniekheid, grijswaarden-onderscheid,
  # hash-stabiliteit/-verspreiding, auto-toewijzing "eerste vrije kleur", hash-fallback muteert
  # niets, geen botsing met kritiek-rood.
  BARCOLORCHECK="$DIR/.bar-colors.mjs"
  if bundle_check "$DIR/check-bar-colors.ts" "$BARCOLORCHECK"; then node "$BARCOLORCHECK" || STATUS=1; fi
```

- [ ] **Step 6: Commit**

```bash
git add src/engine/renderer/resourcePalette.ts tests/planning/check-bar-colors.ts tests/planning/run.sh
git commit -m "feat(report): resourcepalet + hash-fallback + auto-toewijzing (puur)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: `Resource.color`-datamodel + IFC-round-trip + bibliotheek-neutraliteit

**Files:**
- Modify: `src/types/resource.ts:36` (veld toevoegen vóór `libraryOrigin`)
- Modify: `src/services/ifc/ifcWriter.ts` (`writeResourceMeta`, ca. regel 880–930)
- Modify: `src/services/ifc/ifcReader.ts` (resource-pset-loop, ca. regel 1110–1150)
- Modify: `tests/planning/check-ifc-roundtrip.ts` (nieuwe asserts)

- [ ] **Step 1: Write the failing test**

Lees eerst `tests/planning/check-ifc-roundtrip.ts` (eerste ~80 regels) om de daar gebruikte fixtures/helpers te zien (`writeIFC`/`readIFC`-aanroepvorm en hoe resources in de fixture komen). Voeg dan in dat bestand, vlak vóór de eind-asserts, deze blokken toe — pas de constructie-aanroepen aan aan het fixture-patroon dat je aantrof (kern van de assert blijft identiek):

```ts
// #21 punt 1-nieuw — Resource.color round-trip via OPS_Resource-pset (IFCTEXT).
{
  const res = baseResource('res_kleur'); // bestaande helper/patroon uit dit bestand
  res.color = '#0EA5E9';
  const rt = roundtripResources([res]); // bestaande helper: writeIFC → readIFC → resources
  if (rt[0].color !== '#0EA5E9') { console.log('   XX Resource.color round-trip: kwam niet terug'); FAIL++; }
}
// Zonder kleur: géén Color-property in de STEP (golden rule — geen puff met defaults).
{
  const step = writeIFC(baseProject([baseResource('res_geslaagd')]), /* … bestaande args … */);
  if (/IFCPROPERTYSINGLEVALUE\('Color',\$,IFCTEXT/.test(step)) === true) { /* alleen fout als 't om een RESOURCE-pset gaat */ }
  const rt = roundtripResources([baseResource('res_geslaagd')]);
  if (rt[0].color !== undefined) { console.log('   XX kleurloze resource krijgt kleur na round-trip'); FAIL++; }
}
```

Let op: de exacte helpernamen (`baseResource`, `roundtripResources`, `baseProject`, de teller) bestaan mogelijk onder andere namen in dat bestand — volg het bestaande patroon en bewaar de assert-intenties: (1) gezette kleur komt exact terug; (2) kleurloze resource blijft kleurloos na round-trip.

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:planning 2>&1 | grep -E "XX|Resource.color" ; echo "exit=$?"
```

Expected: exit 1 met de faalregels over `Resource.color round-trip`.

- [ ] **Step 3: Implement — typeveld**

`src/types/resource.ts`, ná `parentId` en vóór `libraryOrigin`:

```ts
  /** Weergavekleur (hex `#rrggbb`) voor de resource-kleurmodi in de rapportexport (#21). Puur
   *  presentatie: zit bewust NIET in RESOURCE_DIFF_FIELDS — een andere kleur is nooit een
   *  bibliotheekafwijking — en heeft géén invloed op planning/berekening. */
  color?: string;
```

- [ ] **Step 4: Implement — writer**

`src/services/ifc/ifcWriter.ts`, in `writeResourceMeta` (ca. regel 894), ná het `unitOfMeasure`-blok en vóór `availabilitySteps`:

```ts
    if (res.color) {
      const id = addLine(ctx, `_rescol_${res.id}`,
        `IFCPROPERTYSINGLEVALUE('Color',$,IFCTEXT(${ifcStr(res.color)}),$)`);
      props.push(`#${id}`);
    }
```

- [ ] **Step 5: Implement — reader**

`src/services/ifc/ifcReader.ts`, in de resource-pset-prop-lus (ca. regel 1133), ná het `UnitOfMeasure`-else-if:

```ts
        } else if (name === 'Color' && typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value)) {
          res.color = value;
```

- [ ] **Step 6: Implement — bibliotheekneutraliteit bewijzen**

`Resource.color` staat NIET in `RESOURCE_DIFF_FIELDS` (`src/services/library/libraryOps.ts:287`) en je voegt het daar ook NIET toe — de neutraliteit is default. Om drift te bewaken voeg je in `tests/library/check-library-ops.ts` één assert toe op het bestaande patroon van dat bestand (lees de kop; het bestaat grotendeels uit `ok(...)`-achtige asserts met `computeResourceHash`/`diffResourceVsPool`):

```ts
// #21: Resource.color is presentatie — mag NOOIT een diff/afwijking of hash-wijziging triggeren.
const kleurA = { ...baseRes, color: '#0EA5E9' };
const kleurB = { ...baseRes, color: '#16A34A' }; // zelfde identiteit, andere kleur
if (computeResourceHash(kleurA) !== computeResourceHash(kleurB)) { fail('Resource.color lekt in computeResourceHash'); }
if (diffResourceVsPool(kleurA, kleurB).status !== 'up-to-date') { fail('Resource.color triggert diffResourceVsPool'); }
```

(Pas `baseRes`/`fail` aan aan de namen in dat bestand.)

- [ ] **Step 7: Run tests**

```bash
npm run typecheck && npm run test:planning >/dev/null 2>&1; echo "planning=$?"; bash tests/library/run.sh >/dev/null 2>&1; echo "library=$?"
```

Expected: `planning=0`, `library=0`.

- [ ] **Step 8: Commit**

```bash
git add src/types/resource.ts src/services/ifc/ifcWriter.ts src/services/ifc/ifcReader.ts tests/planning/check-ifc-roundtrip.ts tests/library/check-library-ops.ts
git commit -m "feat(resource): kleurveld + IFC-round-trip; bewust buiten RESOURCE_DIFF_FIELDS

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: `barColors.ts` — kleurmodi-logica (puur)

**Files:**
- Create: `src/services/print/barColors.ts`
- Modify: `tests/planning/check-bar-colors.ts` (uitbreiden)

- [ ] **Step 1: Write the failing tests (uitbreiden van Task 1-bestand)**

Voeg vóór de eind-asserts in `tests/planning/check-bar-colors.ts` toe:

```ts
// ── barColors: modi, segmenten, randen ──────────────────────────────────────────────────────────
import {
  computeBarColors, type BarFill,
} from '@/services/print/barColors';
import type { Task } from '@/types/task';
import type { Resource, ResourceAssignment } from '@/types/resource';

const mkTask = (id: string, extra: Partial<Task> = {}): Task => ({
  id, name: id, parentId: undefined, childIds: [],
  time: { earlyStart: '2026-01-05', earlyFinish: '2026-01-09', lateStart: '', lateFinish: '',
    duration: 5, totalFloat: 0, isCritical: false, completion: 0, scheduleStart: '2026-01-05', scheduleFinish: '2026-01-09' },
  isMilestone: false,
  ...extra,
} as unknown as Task);

const mkRes = (id: string, color?: string): Resource => ({ id, name: id, type: 'LABOR', description: '', maxUnits: 1, ...(color ? { color } : {}) });
const mkAsg = (taskId: string, resourceId: string, unitsPerDay: number): ResourceAssignment =>
  ({ id: `a-${taskId}-${resourceId}`, taskId, resourceId, unitsPerDay });

const CRIT = '#DC2626';       // PRINT_COLORS.critical
const NORMAL = '#2563EB';     // PRINT_COLORS.normal
const NEAR = '#F59E0B';       // PRINT_COLORS.nearCritical
const MILESTONE = '#7C3AED';

// 7. critical-modus (default): huidige gedrag ongewijzigd — kritiek rood, bijna-kritiek oranje,
//    rest blauw.
{
  const crit = computeBarColors(mkTask('t1', { time: { ...mkTask('t').time, isCritical: true } as Task['time'] }), [], [], 'critical', { critical: CRIT, normal: NORMAL, nearCritical: NEAR, milestone: MILESTONE });
  ok(crit.kind === 'solid' && crit.fill === CRIT, 'critical-modus: kritieke taak rood');
  const near = computeBarColors(mkTask('t2', { time: { ...mkTask('t').time, isNearCritical: true } as Task['time'] }), [], [], 'critical', { critical: CRIT, normal: NORMAL, nearCritical: NEAR, milestone: MILESTONE });
  ok(near.kind === 'solid' && near.fill === NEAR, 'critical-modus: bijna-kritiek oranje');
}

// 8. task-modus: Task.color wint; zonder Task.color valt terug op critical-logica.
{
  const withColor = computeBarColors(mkTask('t3', { color: '#123456' }), [], [], 'task', { critical: CRIT, normal: NORMAL, nearCritical: NEAR, milestone: MILESTONE });
  ok(withColor.kind === 'solid' && withColor.fill === '#123456', 'task-modus: Task.color wint');
  const without = computeBarColors(mkTask('t4'), [], [], 'task', { critical: CRIT, normal: NORMAL, nearCritical: NEAR, milestone: MILESTONE });
  ok(without.kind === 'solid' && without.fill === NORMAL, 'task-modus: zonder kleur → critical-logica');
}

// 9. auto-modus: hash op taak-id, stabiel, onafhankelijk van positie; kritieke taak krijgt rode rand.
{
  const a = computeBarColors(mkTask('t5'), [], [], 'auto', { critical: CRIT, normal: NORMAL, nearCritical: NEAR, milestone: MILESTONE });
  const b = computeBarColors(mkTask('t5'), [], [], 'auto', { critical: CRIT, normal: NORMAL, nearCritical: NEAR, milestone: MILESTONE });
  ok(a.kind === 'solid' && b.kind === 'solid' && (a as { fill: string }).fill === (b as { fill: string }).fill, 'auto-modus: stabiel per id');
  ok(a.kind === 'solid' && a.fill === paletteColorForId('t5'), 'auto-modus: gebruikt palet-hash');
  const critAuto = computeBarColors(mkTask('t6', { time: { ...mkTask('t').time, isCritical: true } as Task['time'] }), [], [], 'auto', { critical: CRIT, normal: NORMAL, nearCritical: NEAR, milestone: MILESTONE });
  ok(critAuto.kind === 'solid' && critAuto.outline === CRIT, 'auto-modus: kritieke taal → rode rand');
}

// 10. resource-modus: segmenten naar rato van unitsPerDay, exact vullend; zonder resource → blauw;
//     kritiek → rode rand om het geheel.
{
  const resources = [mkRes('r1', '#111111'), mkRes('r2', '#222222')];
  const asg = [mkAsg('t7', 'r1', 1), mkAsg('t7', 'r2', 3)];
  const seg = computeBarColors(mkTask('t7'), resources, asg, 'resource', { critical: CRIT, normal: NORMAL, nearCritical: NEAR, milestone: MILESTONE });
  ok(seg.kind === 'segments', 'resource-modus met 2 resources: segmenten');
  if (seg.kind === 'segments') {
    const total = seg.segments.reduce((acc, s) => acc + s.weight, 0);
    ok(Math.abs(total - 1) < 1e-9, `segmentgewichten sommeren exact tot 1 (got ${total})`);
    ok(Math.abs(seg.segments[0].weight - 0.25) < 1e-9 && Math.abs(seg.segments[1].weight - 3 / 4) < 1e-9, 'verhouding volgt unitsPerDay (1:3)');
    ok(seg.segments[0].color === '#111111' && seg.segments[1].color === '#222222', 'eigen resourcekleur gebruikt');
  }
  const none = computeBarColors(mkTask('t8'), [mkRes('r1')], [], 'resource', { critical: CRIT, normal: NORMAL, nearCritical: NEAR, milestone: MILESTONE });
  ok(none.kind === 'solid' && none.fill === NORMAL, 'resource-modus zonder toewijzing → neutraal blauw');
  const noColorRes = [mkRes('rx')]; // kleurloos → hash-fallback
  const fallback = computeBarColors(mkTask('t9'), noColorRes, [mkAsg('t9', 'rx', 2)], 'resource', { critical: CRIT, normal: NORMAL, nearCritical: NEAR, milestone: MILESTONE });
  ok(fallback.kind === 'segments' && fallback.segments[0].color === paletteColorForId('rx'), 'kleurloze resource → hash-fallback-kleur');
  const critSeg = computeBarColors(mkTask('t10', { time: { ...mkTask('t').time, isCritical: true } as Task['time'] }), resources, [mkAsg('t10', 'r1', 1)], 'resource', { critical: CRIT, normal: NORMAL, nearCritical: NEAR, milestone: MILESTONE });
  ok(critSeg.outline === CRIT, 'resource-modus: kritiek → rode rand');
}

// 11. Smalbalk-fallback: barPx < 12 in resource-modus → solide eerste-kleur i.p.v. segmenten.
{
  const resources = [mkRes('r1', '#111111'), mkRes('r2', '#222222')];
  const asg = [mkAsg('t11', 'r1', 1), mkAsg('t11', 'r2', 1)];
  const narrow = computeBarColors(mkTask('t11'), resources, asg, 'resource', { critical: CRIT, normal: NORMAL, nearCritical: NEAR, milestone: MILESTONE }, 8);
  ok(narrow.kind === 'solid' && narrow.fill === '#111111', 'smalbalk (8px) → solide eerste resourcekleur');
}

// 12. Mijlpalen: volgen de modusregel (task/auto/resource uit eigen kleur/hash; zonder resource →
//     milestone-paars uit het palet). In critical-modus: milestone-kleur (huidig).
{
  const ms = mkTask('t12', { isMilestone: true });
  const c = computeBarColors(ms, [], [], 'critical', { critical: CRIT, normal: NORMAL, nearCritical: NEAR, milestone: MILESTONE });
  ok(c.kind === 'solid' && c.fill === MILESTONE, 'mijlpaal critical-modus → milestone-kleur');
  const mres = computeBarColors(mkTask('t13', { isMilestone: true }), [mkRes('r1', '#111111')], [mkAsg('t13', 'r1', 1)], 'resource', { critical: CRIT, normal: NORMAL, nearCritical: NEAR, milestone: MILESTONE });
  ok(mres.kind === 'solid' && mres.fill === '#111111', 'mijlpaal resource-modus → resourcekleur (solide ruit)');
  const mnone = computeBarColors(mkTask('t14', { isMilestone: true }), [], [], 'resource', { critical: CRIT, normal: NORMAL, nearCritical: NEAR, milestone: MILESTONE });
  ok(mnone.kind === 'solid' && mnone.fill === MILESTONE, 'mijlpaal zonder resource → milestone-kleur');
}
```

En zet de bestaande `console.log('bar-colors: alles groen');`-exit ONDER de nieuwe blokken (de check moet doorlopen tot het einde).

- [ ] **Step 2: Run test to verify it fails**

```bash
npx esbuild tests/planning/check-bar-colors.ts --bundle --platform=node --format=esm --outfile=/tmp/bc.mjs --external:node:* && node /tmp/bc.mjs 2>&1 | tail -5; echo "exit=$?"
```

Expected: FAIL — `Could not resolve '@/services/print/barColors'`.

- [ ] **Step 3: Implement `src/services/print/barColors.ts`**

```ts
// Balkkleurmodi voor de rapportexport (#21 punt 1-nieuw, ontwerpdoc 2026-08-14 §4). PUUR: één
// functie per balk, geen Draw2D/store — headless testbaar. De printlaag (printPreview.ts) vertaalt
// het resultaat naar fill-/roundRect-/strokeRect-aanroepen; de scherm-accent-renderer gebruikt
// `resourceSegments` direct.
//
// Modi (PrintOptions.barColorMode):
//  - 'critical': huidige gedrag — kritiek rood, bijna-kritiek oranje, rest blauw (B5-default).
//  - 'task':     Task.color als gezet, anders critical-logica (B6).
//  - 'auto':     hash op taak-id → paletkleur; stabiel bij herordenen (B6).
//  - 'resource': segmenten naar rato van unitsPerDay per toegewezen resource; zonder toewijzing
//                neutraal blauw; kleurloze resource → hash-fallback (B5/B7/B8).
// Kritieke taken krijgen in de NIET-critical-modi een rode outline i.p.v. massaal rood (B5).
import { paletteColorForId, resourceDisplayColor } from '@/engine/renderer/resourcePalette';
import type { Task } from '@/types/task';
import type { Resource, ResourceAssignment } from '@/types/resource';

export type BarColorMode = 'critical' | 'task' | 'auto' | 'resource';

/** De kleuren die de printlaag doorgeeft — bewust letterlijk (geen PRINT_PALETTE-import): zo blijft
 *  deze module vrij van de DOM-afhankelijke themePalette-module en headless testbaar. */
export interface BarPalette {
  critical: string;
  normal: string;
  nearCritical: string;
  milestone: string;
}

/** Eén kleurvlak van een balk. */
export type BarFill =
  | { kind: 'solid'; fill: string; outline?: string }
  | { kind: 'segments'; segments: { color: string; weight: number }[]; outline?: string };

/** Drempel waaronder segmenten zinloos zijn (onleesbare reepjes) → solide eerste kleur (B5/§4). */
export const SEGMENT_MIN_PX = 12;

/** De critical-logica van vóór deze feature, gedeeld door 'critical' en de 'task'-fallback. */
function criticalFill(task: Task, pal: BarPalette): string {
  if (task.isMilestone) return pal.milestone;
  if (task.time.isCritical) return pal.critical;
  if (task.time.isNearCritical) return pal.nearCritical;
  return task.color || pal.normal;
}

/**
 * Kleuradvies voor één balk. `barPx` is de balkbreedte in logische px (alleen nodig voor de
 * smalbalk-fallback; ontbreekt ⇒ segmenten altijd toestaan). Mijlpalen zijn altijd solide (ruit).
 */
export function computeBarColors(
  task: Task,
  resources: ReadonlyArray<Resource>,
  assignments: ReadonlyArray<ResourceAssignment>,
  mode: BarColorMode,
  pal: BarPalette,
  barPx?: number,
): BarFill {
  // Mijlpalen: één ruit, geen segmenten. In resource-modus wél de resourcekleur (indien toegewezen).
  if (task.isMilestone) {
    if (mode === 'resource') {
      const first = firstAssignment(task.id, resources, assignments);
      if (first) return { kind: 'solid', fill: first };
      return { kind: 'solid', fill: pal.milestone };
    }
    if (mode === 'auto') return { kind: 'solid', fill: paletteColorForId(task.id), outline: task.time.isCritical ? pal.critical : undefined };
    if (mode === 'task' && task.color) return { kind: 'solid', fill: task.color };
    return { kind: 'solid', fill: pal.milestone };
  }

  const outline = mode !== 'critical' && task.time.isCritical ? pal.critical : undefined;

  if (mode === 'auto') return { kind: 'solid', fill: paletteColorForId(task.id), outline };

  if (mode === 'task') {
    if (task.color) return { kind: 'solid', fill: task.color, outline };
    return { kind: 'solid', fill: criticalFill(task, pal), outline };
  }

  if (mode === 'resource') {
    const rows = assignmentsFor(task.id, resources, assignments);
    if (rows.length === 0) return { kind: 'solid', fill: pal.normal, outline };
    if (rows.length === 1) return { kind: 'solid', fill: rows[0].color, outline };
    if (barPx !== undefined && barPx < SEGMENT_MIN_PX) return { kind: 'solid', fill: rows[0].color, outline };
    const total = rows.reduce((a, r) => a + r.unitsPerDay, 0) || 1;
    return { kind: 'segments', segments: rows.map(r => ({ color: r.color, weight: r.unitsPerDay / total })), outline };
  }

  return { kind: 'solid', fill: criticalFill(task, pal) };
}

/** Toegewezen resources voor een taak, als (displaykleur, units)-paren in toewijzingsvolgorde. */
export function assignmentsFor(
  taskId: string,
  resources: ReadonlyArray<Resource>,
  assignments: ReadonlyArray<ResourceAssignment>,
): { color: string; unitsPerDay: number; resourceId: string; name: string }[] {
  const byId = new Map(resources.map(r => [r.id, r]));
  const out: { color: string; unitsPerDay: number; resourceId: string; name: string }[] = [];
  for (const a of assignments) {
    if (a.taskId !== taskId) continue;
    const res = byId.get(a.resourceId);
    if (!res) continue;
    out.push({ color: resourceDisplayColor(res), unitsPerDay: a.unitsPerDay, resourceId: res.id, name: res.name });
  }
  return out;
}

/** Kleur van de eerste toegewezen resource (mijlpaal-ruit in resource-modus). */
function firstAssignment(taskId: string, resources: ReadonlyArray<Resource>, assignments: ReadonlyArray<ResourceAssignment>): string | null {
  const rows = assignmentsFor(taskId, resources, assignments);
  return rows.length > 0 ? rows[0].color : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx esbuild tests/planning/check-bar-colors.ts --bundle --platform=node --format=esm --outfile=/tmp/bc.mjs --external:node:* && node /tmp/bc.mjs; echo "exit=$?"
```

Expected: `bar-colors: alles groen`, `exit=0`.

- [ ] **Step 5: Commit**

```bash
git add src/services/print/barColors.ts tests/planning/check-bar-colors.ts
git commit -m "feat(report): balkkleurmodi als pure module (critical/task/auto/resource + segmenten)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: PrintOptions-velden + kleurmodi in de printlaag + legenda

**Files:**
- Modify: `src/services/print/printPreview.ts` (PrintOptions + balk-tekenpad + drawFooter-legenda)
- Modify: `tests/planning/check-print-report.ts` (nieuw, zie Task 6 — dit is de testfile van Task 6, hier nog niet aanmaken)

> In deze taak alleen de implementatie; de test komt in Task 6 (recording-Draw2D). Voor TDD-volgorde binnen één PR is dat acceptabel omdat Task 6 beide paden zwart-op-wit bewaakt; wil je strikt TDD, maak dan de stub-check eerst met de eerste assert (kleurmodus critical == oud gedrag) en vul hem in Task 6 verder aan.

- [ ] **Step 1: PrintOptions uitbreiden**

In `src/services/print/printPreview.ts`, in `PrintOptions` (na `drivingSequenceIds`, ca. regel 225):

```ts
  /** Balkkleurmodi (#21). Ontbreekt ⇒ 'critical' = byte-identiek oud gedrag. */
  barColorMode?: 'critical' | 'task' | 'auto' | 'resource';
  /** Statuslijn in de export (#54): 'none' (default) | 'statusDate' | 'progress'. */
  statusLine?: 'none' | 'statusDate' | 'progress';
  /** Statusdatum (ISO) — bron voor beide lijnvarianten; ontbreekt ⇒ geen lijn. */
  statusDate?: string;
  /** Resources + toewijzingen voor de resource-kleurmodi; de printlaag leeft buiten de store. */
  resources?: Resource[];
  assignments?: ResourceAssignment[];
  /** WYSIWYG-rijen (#54): gegeven ⇒ de export tekent deze rijen i.p.v. de volledige takenboom. */
  rows?: ViewRow[];
  /** Extra legendalabels voor de kleurmodi (reeds vertaald door de aanroeper). */
  barColorsLegendLabels?: {
    criticalOutline: string;
    resourcesMore: (n: number) => string;
  };
```

En bovenin het bestand de imports:

```ts
import { computeBarColors, assignmentsFor, type BarFill } from '@/services/print/barColors';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { ViewRow } from '@/engine/view/visibleRows';
```

- [ ] **Step 2: Rijen-normalisatie in renderReport**

Vervang het flatten-blok (ca. regels 409–431, `const flatTasks: PrintTask[] = []; … const roots … addRecursive …`) door:

```ts
  // Rijen-bron (WYSIWYG, #54): gegeven `options.rows` tekent het rapport precies die rijen —
  // filter/groepering/sortering/inklapstatus van het scherm. Anders: de volledige takenboom
  // (huidig gedrag, self-flatten). Beide vormen normaliseren hier naar één rij-type: een PrintTask
  // mét diepte, plus (nieuw) groepsband-rijen die als samenvattings-strook tekenen.
  interface PrintRow {
    kind: 'task' | 'group';
    task?: Task;
    depth: number;
    label?: string;   // groepsband-label
    count?: number;   // groepsband-aantal
  }
  const rows: PrintRow[] = [];
  const depthMap = new Map<string, number>();
  if (options.rows) {
    for (const row of options.rows) {
      if (row.kind === 'task') {
        depthMap.set(row.task.id, row.depth);
        rows.push({ kind: 'task', task: row.task, depth: row.depth });
      } else {
        rows.push({ kind: 'group', depth: row.depth, label: row.label, count: row.count });
      }
    }
  } else {
    const addRecursive = (task: Task, depth: number) => {
      depthMap.set(task.id, depth);
      rows.push({ kind: 'task', task, depth });
      const children = tasks.filter(t => t.parentId === task.id);
      for (const child of children) addRecursive(child, depth + 1);
    };
    for (const root of tasks.filter(t => !t.parentId)) addRecursive(root, 0);
    for (const task of tasks) {
      if (!rows.find(r => r.kind === 'task' && r.task!.id === task.id)) {
        depthMap.set(task.id, 0);
        rows.push({ kind: 'task', task, depth: 0 });
      }
    }
  }
  const flatTasks: PrintTask[] = rows.filter((r): r is PrintRow & { kind: 'task'; task: Task } => r.kind === 'task').map(r => ({ ...r.task!, _depth: r.depth }));
```

Pas vervolgens in de rest van `renderReport` élke `flatTasks.length`-referentie aan naar `rows.length` (canvasHeight, alternating rows, horizontale gridlijnen, progress-line-iteratie) en élke `flatTasks[i]`-lus in het bar-tekenblok naar een lus over `rows` waarin `kind === 'group'` een eigen tekentak krijgt (zie Step 3). `drawDependencies(d2d, m, flatTasks, …)` krijgt de filterregel in Step 4. `drawTaskTable(d2d, m, flatTasks, depthMap, …)` blijft op `flatTasks` werken (alleen taakrijen) — bij rows-modus mét groepsbanden teken je in de tabel een vette groepsrij: gebruik `rows` en render voor `kind: 'group'` een rij met `label` (bold, `depth`-indent) en lege datacellen; voor taken de bestaande cellen. Concreet: geef `drawTaskTable` in plaats van `flatTasks`/`depthMap` de `rows: PrintRow[]` door en pas de rij-lus binnenin aan (de functiesignaturen in dit bestand zijn intern — vrije hand, mits preview/export beide via renderReport lopen).

- [ ] **Step 3: Groepsband-tekentak + kleurmodi in het bar-blok**

In het rijen-lus-blok (het `for (let i = 0; i < flatTasks.length; i++)`-barblok, ca. regel 641) — vervang de normale-taak-tak en voeg een groepsband-tak toe. Nieuwe structuur:

```ts
  const resources = options.resources ?? [];
  const assignments = options.assignments ?? [];
  const colorMode = options.barColorMode ?? 'critical';
  const pal = { critical: PRINT_COLORS.critical, normal: PRINT_COLORS.normal, nearCritical: PRINT_COLORS.nearCritical, milestone: PRINT_COLORS.milestone };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const y = rowToY(i) + barOffset;

    if (row.kind === 'group') {
      // Groepsband (#54 volg-weergave): lichte strook over de rij + vet label links in de
      // tabelzone. Geen datums (een band is geen taak), geen mijlpaal/dependencies.
      d2d.fillStyle = PRINT_COLORS.gridWeekend;
      d2d.fillRect(m.tableWidth, rowToY(i), canvasWidth - m.tableWidth, m.rowHeight);
      if (options.showTaskNames) {
        barLabelJobs.push({ name: row.label ?? '', barRightX: m.tableWidth + m.s(4), barLeftX: m.tableWidth + m.s(4), y: rowToY(i) + m.rowHeight / 2 + m.s(3), bold: true });
      }
      continue;
    }
    const task = row.task!;
    // … (mijlpaal-tak en summary-tak: kleuradvies via computeBarColors; zie hieronder)
```

Mijlpaal-tak: vervang `d2d.fillStyle = PRINT_COLORS.milestone;` door:

```ts
      const advies = computeBarColors(task, resources, assignments, colorMode, pal);
      d2d.fillStyle = advies.kind === 'solid' ? advies.fill : advies.segments[0].color;
```

Samenvatting-tak (`task.childIds.length > 0`): kleur ongewijzigd laten (summary-hoofdlijnen blijven `PRINT_COLORS.summary`) — samenvattende balken zijn structuur, geen inzet.

Normale-taak-tak: vervang

```ts
      const isCritical = task.time.isCritical && options.showCritical;
      const color = isCritical ? PRINT_COLORS.critical : PRINT_COLORS.normal;
      d2d.fillStyle = color;
      d2d.roundRect(x1, y, width, barHeight, 3);
      d2d.fill();
```

door:

```ts
      // Kleurmodi (#21): solid of segmenten; kritiek-pad rood blijft leesbaar via rode rand.
      const advies = computeBarColors(task, resources, assignments, colorMode, pal, width);
      if (advies.kind === 'segments') {
        // Segmenten vullen de balk exact (rest-pixel naar het laatste segment).
        let sx = x1;
        const totalW = width;
        advies.segments.forEach((seg, si) => {
          const isLast = si === advies.segments.length - 1;
          const w = isLast ? x1 + totalW - sx : Math.round(totalW * seg.weight);
          d2d.fillStyle = seg.color;
          // Eerste/laatste segment houden de ronde hoeken: roundRect met links resp. rechts radius.
          d2d.roundRect(sx, y, w, barHeight, si === 0 ? 3 : 0);
          d2d.fill();
          sx += w;
        });
      } else {
        d2d.fillStyle = advies.fill;
        d2d.roundRect(x1, y, width, barHeight, 3);
        d2d.fill();
      }
      if (advies.outline) {
        // Rode rand om kritieke taken in de niet-critical-modi (B5). lineWidth 1 op de balkrand.
        d2d.strokeStyle = advies.outline;
        d2d.lineWidth = 1;
        d2d.roundRect(x1, y, width, barHeight, 3);
        d2d.stroke();
      }
```

(Wijzig eveneens de completion-overlay: die blijft bestaan maar gebruikt de DONKERE variant van de onderliggende modus niet meer per se — eenvoudigste correcte gedrag: overlay in `rgba(0,0,0,0.25)` óver elk segment, backend-agnostisch. Vervang de `isCritical ? criticalDark : normalDark`-kleur door de vaste `'rgba(0, 0, 0, 0.25)'`.)

- [ ] **Step 4: Dependencies-filter bij rows-modus**

In `drawDependencies(d2d, m, flatTasks, sequences, dateToX, rowToY, zoom, options)` (ca. regel 1286): die zoekt per seq de twee taken op in `flatTasks`. Bij rows-modus ontbreken gefilterde/ingeklapte taken — pas de aanroep aan: geef een `Set` mee van zichtbare taak-ids (`const visibleIds = new Set(rows.filter(r => r.kind === 'task').map(r => (r as { task: Task }).task.id));`) en sla binnen `drawDependencies` elke sequence over waarvan `predecessorId` of `successorId` niet in het Set zit. Voor de row-index-lookup: de functie rekent rij-positie via `flatTasks.findIndex` — geef in plaats daarvan een `rowIndexOf: Map<string, number>` mee gebouwd over `rows` (task-id → rij-index in `rows`, dus inclusief groepsbanden ertussen). Zonder `options.rows` (boom-modus) is dit mapje exact gelijk aan het oude `findIndex`-resultaat — geen gedragsverandering.

- [ ] **Step 5: Legenda per modus in drawFooter**

In `drawFooter` (ca. regel 1477): bij `barColorMode === 'resource'` VERVANG de critical/normal-items door resource-swatches. Voeg ná de bestaande items-opbouw, vóór de widths-berekening, dit toe:

```ts
      // Kleurmodus-legenda (#21): in resource-modus verklappen de swatches wat de kleuren betekenen.
      if (options.barColorMode === 'resource' && options.resources && options.assignments) {
        const resItems = legendResourceItems(options.resources, options.assignments, flatTasks ?? [], m, midY, d2d);
        // Vervang de critical+normal-items door de resource-items (milestone/summary/float blijven).
      }
```

Concreet (beter dan commentaar): construeer `items` conditioneel — verpak de bestaande `if (options.showCritical) { items.push(...critical...) }` en de `normal`-push in `if ((options.barColorMode ?? 'critical') === 'critical') { … }` en voeg daarnaast toe:

```ts
      if (options.barColorMode === 'resource' && options.resources && options.assignments) {
        // Resources die daadwerkelijk op zichtbare bladbalken voorkomen, volgorde eerste voorkomen.
        const visibleLeafIds = new Set((options.rows ?? []).filter(r => r.kind === 'task' && !r.task.childIds.length && !r.task.isMilestone).map(r => (r as { kind: 'task'; task: Task }).task.id));
        const seen: { id: string; name: string; color: string }[] = [];
        const byId = new Map(options.resources.map(r => [r.id, r]));
        for (const a of options.assignments) {
          if (visibleLeafIds.size > 0 && !visibleLeafIds.has(a.taskId)) continue;
          const res = byId.get(a.resourceId);
          if (!res || seen.find(s => s.id === res.id)) continue;
          seen.push({ id: res.id, name: res.name, color: resourceDisplayColor(res) });
        }
        const CAP = 8;
        const shown = seen.slice(0, CAP);
        for (const s of shown) {
          items.push({ label: s.name, draw: (x) => {
            d2d.fillStyle = s.color;
            d2d.roundRect(x, midY - swatchH / 2, swatchW, swatchH, m.s(2));
            d2d.fill();
          } });
        }
        if (seen.length > CAP && options.barColorsLegendLabels) {
          items.push({ label: options.barColorsLegendLabels.resourcesMore(seen.length - CAP), draw: () => {} });
        }
        // Rode rand = kritiek pad-legenda in niet-critical-modi:
        items.push({ label: options.barColorsLegendLabels?.criticalOutline ?? 'Kritiek pad', draw: (x) => {
          d2d.strokeStyle = PRINT_COLORS.critical;
          d2d.lineWidth = 1;
          d2d.roundRect(x, midY - swatchH / 2, swatchW, swatchH, m.s(2));
          d2d.stroke();
        } });
      } else if ((options.barColorMode ?? 'critical') !== 'critical') {
        // task/auto: alleen de rode-rand-verklaring ipv critical/normal-swatches.
        items.push({ label: options.barColorsLegendLabels?.criticalOutline ?? 'Kritiek pad', draw: (x) => {
          d2d.strokeStyle = PRINT_COLORS.critical;
          d2d.lineWidth = 1;
          d2d.roundRect(x, midY - swatchH / 2, swatchW, swatchH, m.s(2));
          d2d.stroke();
        } });
      }
```

Import daarvoor `resourceDisplayColor` in printPreview.ts (`from '@/engine/renderer/resourcePalette'`), en haal `flatTasks`/`rows`+`resources`+`assignments` in `drawFooter` binnen via extra parameters — `drawFooter(d2d, m, canvasWidth, canvasHeight, projectName, options, rows, resources, assignments)`; past de aanroep in `renderReport` aan.

- [ ] **Step 6: Statuslijn tekenen**

Voeg in `renderReport`, ná het today-line-blok (ca. regel 619) en vóór het bar-blok, toe:

```ts
  // Statuslijn (#54): 'statusDate' = verticale stippellijn op project.statusDate; 'progress' =
  // voortgangszigzag (zelfde definitie als GanttRenderer.drawProgressLine: leaf-rijen stulpen uit
  // naar de voortgangspositie). Beide alleen bij een gezette statusDate — anders tekent niets.
  let statusLineX: number | null = null;
  if (options.statusDate && options.statusLine && options.statusLine !== 'none') {
    const statusDay = parseDate(options.statusDate);
    statusLineX = dateToX(statusDay);
    if (statusLineX > m.tableWidth && statusLineX < canvasWidth) {
      d2d.strokeStyle = PRINT_COLORS.today;
      d2d.lineWidth = 1.5;
      d2d.setLineDash([5, 3]);
      d2d.beginPath();
      if (options.statusLine === 'statusDate') {
        d2d.moveTo(statusLineX, chartTop);
        d2d.lineTo(statusLineX, chartBottom);
      } else {
        // progress: spine + per leaf-rij een zigzag naar de voortgangspositie (MSP-stijl).
        d2d.moveTo(statusLineX, chartTop);
        for (let i = 0; i < rows.length; i++) {
          const rowTop = rowToY(i);
          const rowBottom = rowTop + m.rowHeight;
          const rowMid = rowTop + m.rowHeight / 2;
          let px = statusLineX;
          if (rows[i].kind === 'task') {
            const task = (rows[i] as { kind: 'task'; task: Task }).task;
            if (!task.isMilestone && task.childIds.length === 0) {
              const s = parseDate(task.time.earlyStart || task.time.scheduleStart);
              const f = parseDate(task.time.earlyFinish || task.time.scheduleFinish);
              const bx1 = dateToX(s);
              const bx2 = dateToX(f) + zoom;
              const c = Math.max(0, Math.min(1, task.time.completion || 0));
              const finishDay = Date.UTC(f.getUTCFullYear(), f.getUTCMonth(), f.getUTCDate());
              const startDay = Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate());
              const statusUtc = Date.UTC(statusDay.getUTCFullYear(), statusDay.getUTCMonth(), statusDay.getUTCDate());
              const fullyDone = c >= 1 && finishDay <= statusUtc;
              const notStarted = c === 0 && startDay >= statusUtc;
              if (!fullyDone && !notStarted) px = bx1 + (bx2 - bx1) * c;
            }
          }
          d2d.lineTo(statusLineX, rowTop);
          d2d.lineTo(px, rowMid);
          d2d.lineTo(statusLineX, rowBottom);
        }
      }
      d2d.stroke();
      d2d.setLineDash([]);
    } else {
      statusLineX = null;
    }
  }
```

En geef `statusLineX` samen met `todayX` door aan `drawTimelineHeader` (die zet labels in de kopstrook; zelfde fix- patroon als het today-label in `check-today-label.ts` — de functie heeft al een `todayX: number | null`-parameter; voeg een statusLineX-parameter toe en teken het label op dezelfde wijze, met `options.labels?.statusDate ?? 'Statusdatum'`, met dagcijfer-onderdrukking op die x). Voeg `statusDate: string` toe aan `PrintOptions.labels`.

- [ ] **Step 7: typecheck + suite groen**

```bash
npm run typecheck && npm run test:planning >/dev/null 2>&1; echo "planning=$?"
```

Expected: beide 0. De bestaande checks (today-label, dependency-style) moeten groen blíjven — dat bewaakt dat default-gedrag (`barColorMode` ontbreekt ⇒ 'critical', `rows` ontbreekt ⇒ boom) byte-identiek is.

- [ ] **Step 8: Commit**

```bash
git add src/services/print/printPreview.ts
git commit -m "feat(report): kleurmodi + groepsbanden + statuslijn in de printlaag (#21/#54)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: ReportPanel-UI + ReportSettings-persistentie + i18n

**Files:**
- Modify: `src/utils/reportSettings.ts`
- Modify: `src/components/panels/ReportPanel.tsx`
- Modify: `src/i18n/locales/*/report.json` (14×)

- [ ] **Step 1: ReportSettings uitbreiden**

In `src/utils/reportSettings.ts`: voeg aan `ReportSettings` toe (na `reportFontScale`):

```ts
  barColorMode: 'critical' | 'task' | 'auto' | 'resource';
  statusLine: 'none' | 'statusDate' | 'progress';
  followView: boolean;
```

`DEFAULT_REPORT_SETTINGS`:

```ts
  barColorMode: 'critical',
  statusLine: 'none',
  followView: false,
```

Constanten + parser:

```ts
const BAR_COLOR_MODES: readonly ReportSettings['barColorMode'][] = ['critical', 'task', 'auto', 'resource'];
const STATUS_LINES: readonly ReportSettings['statusLine'][] = ['none', 'statusDate', 'progress'];
```

en in `loadReportSettings` (per-veld-tolerant patroon):

```ts
    barColorMode: parseEnum(BAR_COLOR_MODES, s.barColorMode) ?? d.barColorMode,
    statusLine: parseEnum(STATUS_LINES, s.statusLine) ?? d.statusLine,
    followView: parseBoolean(s.followView) ?? d.followView,
```

- [ ] **Step 2: i18n-keys (14 locales)**

`src/i18n/locales/nl/report.json` (de rest idem vertaald):

```json
  "barColorModeLabel": "Balkkleuren:",
  "barColorMode_critical": "Kritiek pad",
  "barColorMode_task": "Per taak — eigen kleur",
  "barColorMode_auto": "Per taak — automatisch",
  "barColorMode_resource": "Per resource",
  "statusLineLabel": "Statuslijn:",
  "statusLine_none": "Geen",
  "statusLine_statusDate": "Statusdatumlijn",
  "statusLine_progress": "Voortgangslijn",
  "statusLineHint": "Stel eerst een statusdatum in",
  "followView": "Volg weergave (filter, groepering, sortering)",
  "legend.criticalOutline": "Kritiek pad (rand)",
  "legend.resourcesMore_one": "… en {{count}} resource meer",
  "legend.resourcesMore_other": "… en {{count}} resources meer",
  "statusDateLabel": "Statusdatum"
```

(`legend.resourcesMore_*` op naampatroon van de bestaande `legend`-substructuur: zet ze als `"resourcesMore_one"/"resourcesMore_other"` bínnen het bestaande `"legend": { … }`-object; `criticalOutline` idem.) En in `nl/menu.json` (Beeld-toggle): `"toggleResourceAccent": "Resource-accent"` binnen `ribbon`.

Voor `en`:

```json
  "barColorModeLabel": "Bar colors:",
  "barColorMode_critical": "Critical path",
  "barColorMode_task": "Per task — custom color",
  "barColorMode_auto": "Per task — automatic",
  "barColorMode_resource": "Per resource",
  "statusLineLabel": "Status line:",
  "statusLine_none": "None",
  "statusLine_statusDate": "Status date line",
  "statusLine_progress": "Progress line",
  "statusLineHint": "Set a status date first",
  "followView": "Follow view (filter, grouping, sort)",
```

De overige 12 locales: vertaal de waarden (zh/ja/ko krijgen géén `_one`-variant — `verify:i18n` bewaakt CLDR-categorieën; es/fr/it/pt krijgen `_many` gelijk aan `_other` volgens repo-afspraken; pl krijgt `one/few/many/other`).

- [ ] **Step 3: ReportPanel-state + UI**

In `ReportPanel.tsx` (patroon van de bestaande selects, zie de `reportFontScale`-Select):

```ts
  const [barColorMode, setBarColorMode] = useState(DEFAULT_REPORT_SETTINGS.barColorMode);
  const [statusLine, setStatusLine] = useState(DEFAULT_REPORT_SETTINGS.statusLine);
  const [followView, setFollowView] = useState(DEFAULT_REPORT_SETTINGS.followView);
```

In het hydratatie-effect (waar de overige settings worden gezet) de drie velden meenemen; in het save-effect (of de bestaande `saveReportSettings`-callsite) het volledige object inclusief de drie nieuwe velden meegeven. Zoek op `saveReportSettings(` in dit bestand voor de callsite.

Nieuwe store-subscriptions bovenin het component:

```ts
  const viewRows = useAppStore(s => s.viewRows);
  const resources = useAppStore(s => s.resources);
  const assignments = useAppStore(s => s.assignments);
  const statusDate = project.statusDate;
```

In het `options: PrintOptions`-object toevoegen:

```ts
    barColorMode,
    statusLine,
    statusDate,
    resources,
    assignments,
    rows: followView ? viewRows : undefined,
    barColorsLegendLabels: {
      criticalOutline: t('legend.criticalOutline'),
      resourcesMore: (n: number) => i18n.t('report:legend.resourcesMore', { count: n }),
    },
```

En `labels` uitbreiden met `statusDate: t('statusDateLabel')`.

Preview-deps-array uitbreiden met `barColorMode, statusLine, statusDate, resources, assignments, followView, viewRows`.

UI-besturingselementen in het Gantt-instellingenblok (vind de `reportFontScale`-rij als anker, voeg daaronder drie rijen toe in dezelfde markup-stijl — lees de aangrenzende JSX en spiegel die):

```tsx
{/* #21 — Balkkleuren */}
<label className="… zelfde klasse als reportFontScale-rij …">
  <span>{t('barColorModeLabel')}</span>
  <select value={barColorMode} onChange={e => setBarColorMode(e.target.value as typeof barColorMode)}>
    <option value="critical">{t('barColorMode_critical')}</option>
    <option value="task">{t('barColorMode_task')}</option>
    <option value="auto">{t('barColorMode_auto')}</option>
    <option value="resource">{t('barColorMode_resource')}</option>
  </select>
</label>
{/* #54 — Statuslijn (3 opties, letterlijk) */}
<label className="…">
  <span>{t('statusLineLabel')}</span>
  <select value={statusLine} onChange={e => setStatusLine(e.target.value as typeof statusLine)}>
    <option value="none">{t('statusLine_none')}</option>
    <option value="statusDate">{t('statusLine_statusDate')}</option>
    <option value="progress">{t('statusLine_progress')}</option>
  </select>
</label>
{statusLine !== 'none' && !statusDate && <p className="text-[11px] text-amber-600">{t('statusLineHint')}</p>}
{/* #54 — Volg weergave */}
<label className="… zelfde klasse als de bestaande checkbox-rijen …">
  <input type="checkbox" checked={followView} onChange={e => setFollowView(e.target.checked)} />
  <span>{t('followView')}</span>
</label>
```

- [ ] **Step 4: Verify**

```bash
npm run typecheck && npm run verify:i18n
```

Expected: beide groen.

- [ ] **Step 5: Commit**

```bash
git add src/utils/reportSettings.ts src/components/panels/ReportPanel.tsx src/i18n/locales
git commit -m "feat(report): UI voor balkkleuren/statuslijn/volg-weergave + persistentie + i18n

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: `check-print-report.ts` — recording-Draw2D-tests voor de hele printlaag

**Files:**
- Create: `tests/planning/check-print-report.ts`
- Modify: `tests/planning/run.sh` (registreren ná BARCOLORCHECK)

- [ ] **Step 1: Write the check**

Basis: kopieer het recording-`Draw2D`-patroon uit `tests/planning/check-today-label.ts` (het `record`-idee met `texts`/`rects`/`seq`), maar breid de stub uit met path-recording (`moveTo`/`lineTo`/`fill`/`stroke`/`roundRect` met coördinaten) zodat lijnen en segmenten asserteerbaar zijn:

```ts
/**
 * Rapportexport-features #21/#54 — regressiebatterij tegen renderReport met opnemende Draw2D.
 *
 * Bewaakt: (1) volg-weergave tekent exact de viewRows (gefilterde taak afwezig, groepsband aanwezig,
 * geen dependencies op onzichtbare paren); (2) statuslijn 'statusDate' tekent exact één verticale
 * stippellijn op de juiste x en 'progress' stulpt per leaf-rij uit; 'none'/lege statusDate tekenen
 * niets; (3) kleurmodi: critical = oud gedrag, auto = palet-hash, task = Task.color, resource =
 * segmenten met exacte gewichten + rode outline op kritiek; (4) legenda bevat per modus de juiste
 * items (resourcesMore-cap meegerekend).
 */
```

Fixtures: 3 taken (waarvan 1 kritiek via `time.isCritical`, 1 met 2 resources in verhouding 1:3, 1 gefilterde taak), 2 resources met eigen kleuren, 1 groepsband-`ViewRow`-variant. Elke assert via `ok(...)`/`fail(...)` met `process.exit(1)` bij failures — volledig naar het patroon van `check-today-label.ts`.

Minimale assert-set (formuleer elk als concrete check):

1. `rows`-modus: met een `ViewRow[]` zonder taak `t-filtered` → géén enkele `fillText` met die naam; mét een `group`-rij → wél één vette band-label-text op die rij-index.
2. Dependency-filter: sequence `t-zichtbaar → t-gefilterd` → geen stroke-path tussen die rijen (assert: geen lineTo met de y van de gefilterde rij in dezelfde path als die sequence… eenvoudiger: met dependency-tekening aan bevat de opname géén path-segment met y binnen de rij-band van de gefilterde taak).
3. Statuslijn statusDate: exact één verticale lijn (path met 1 moveTo + 1 lineTo, zelfde x, van chartTop tot chartBottom) op `dateToX(statusDate)`; dash was `[5,3]` vóór die stroke; daarna `[]`. Bij `statusLine: 'progress'`: zelfde spine, plus per leaf-rij ≥ 1 lineTo met x ≠ spineX (de uitstulping). Bij `statusDate` undefined: geen enkele stroke met dash [5,3] op een statusdatum-x (onderscheid van de today-lijn door vandaag buiten bereik te leggen: kies datums zódat vandaag ver buiten [min,max] ligt — fixtures zijn 2026-01 en vandaag is echt vandaag, dus dat klopt automatisch).
4. Kleurmodi (normale taak-balken, herkenbaar aan roundRect met barHeight): `critical` → fill `#DC2626` (kritiek) / `#2563EB` (normaal); `auto` → fill === `paletteColorForId(task.id)`; `task` → fill === Task.color; `resource` → 2 fillRect/roundRect-segmenten met breedtes 25%/75% van de balk en de resourcekleuren; kritieke taak krijgt een strokeStyle `#DC2626`-outline.
5. Legenda: resource-modus → fillText met beide resourcenamen + 'criticalOutline'-label; critical-modus → die namen afwezig.

- [ ] **Step 2: Registreer in run.sh**

```bash
  # Rapportexport #21/#54: volg-weergave (viewRows→renderReport), statuslijn (statusDate/progress),
  # kleurmodi + legenda — via opnemende Draw2D, zelfde renderer als preview én vector-PDF.
  PRTEXPCHECK="$DIR/.print-report.mjs"
  if bundle_check "$DIR/check-print-report.ts" "$PRTEXPCHECK"; then node "$PRTEXPCHECK" || STATUS=1; fi
```

- [ ] **Step 3: Run + verify**

```bash
bash tests/planning/run.sh >/dev/null 2>&1; echo "exit=$?"
```

Expected: `exit=0` (én de faalregel-tellers blijven op nul). Belangrijk: de suite print "alles groen" ook bij exit 1 — het oordeel is de exitcode.

- [ ] **Step 4: Commit**

```bash
git add tests/planning/check-print-report.ts tests/planning/run.sh
git commit -m "test(report): recording-Draw2D-regressie voor volg-weergave/statuslijn/kleurmodi

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Beeld-toggle + scherm-accent in GanttRenderer

**Files:**
- Modify: `src/state/slices/uiSlice.ts` (flag) + `src/state/slices/types.ts` (UIState-veld)
- Modify: `src/utils/settingsStore.ts` (save/load-functie)
- Modify: `src/components/layout/Ribbon/ribbonConfig.tsx` (overlays-stack)
- Modify: `src/engine/renderer/GanttRenderer.ts` (accent-tekening)
- Modify: `src/components/canvas/GanttCanvas.tsx` (optie doorgeven)
- Modify: `tests/planning/check-renderer.ts` (of de bestaande renderer-check-batterij; vind de juiste via `ls tests/planning/check-*renderer*`)

- [ ] **Step 1: UI-flag + persistentie**

`src/state/slices/types.ts`, in `UIState` naast `showProgressLine`:

```ts
    /** Scherm-accent (#21): dun streepje in de resourcekleur onder taakbalken (off-screen kleurmodi
     *  blijven kritiek-pad-gekleurd; dit is het enige resource-signaal op het scherm). */
    showResourceAccent: boolean;
```

`src/state/slices/uiSlice.ts` default `showResourceAccent: false` (bewust uit — het schermbeeld verandert pas als de gebruiker het vraagt).

`src/utils/settingsStore.ts` naast `saveShowProgressLine`:

```ts
export async function saveShowResourceAccent(value: boolean): Promise<void> {
  await setSetting('showResourceAccent', value);
}
```

En in het load-pad: bekijk hoe `showProgressLine` bij opstart wordt gehydrateerd (zoek `showProgressLine` in `settingsRegistry.ts`/`App.tsx`/waar de flags binnenkomen) en volg exact dat patroon voor `showResourceAccent` (default false bij ontbrekende sleutel).

- [ ] **Step 2: Ribbon-toggle**

In `ribbonConfig.tsx`, in de `overlaysStack` (na `toggleStatusDateLine`, ca. regel 777), zelfde patroon:

```tsx
          {
            kind: 'small', id: 'toggleResourceAccent', icon: <Palette size={14} />, labelKey: 'menu:ribbon.toggleResourceAccent',
            use: () => {
              const showResourceAccent = useAppStore(s => s.ui.showResourceAccent);
              const setUI = useAppStore(s => s.setUI);
              return { active: showResourceAccent, onClick: () => { const next = !showResourceAccent; setUI({ showResourceAccent: next }); void saveShowResourceAccent(next); } };
            },
          },
```

(Importeer `Palette` van lucide-react naast de bestaande iconen; `saveShowResourceAccent` uit settingsStore.)

- [ ] **Step 3: Accent in GanttRenderer**

`GanttRenderOptions` (na `showProgressLine`, ca. regel 46):

```ts
  /** Scherm-accent (#21): dun streepje resourcekleur onder elke bladbalk; segmenten bij meerdere
   *  resources. Kritiek-pad-vulling blijft onaangetast — accent is supplement, geen vervanging. */
  showResourceAccent?: boolean;
  /** Voor het accent: resources + toewijzingen (de renderer leeft buiten de store). */
  resources?: Resource[];
  assignments?: ResourceAssignment[];
```

In `drawTaskBars` (vind de leaf-balk-tak): ná het tekenen van de balk, vóór labels:

```ts
    if (this.opts.showResourceAccent && !task.isMilestone && task.childIds.length === 0) {
      const rows = assignmentsFor(task.id, this.opts.resources ?? [], this.opts.assignments ?? []);
      if (rows.length > 0) {
        const total = rows.reduce((a, r) => a + r.unitsPerDay, 0) || 1;
        const accentH = 3;
        const accentY = y + height + 1;
        let ax = geo.x1;
        rows.forEach((r, i) => {
          const isLast = i === rows.length - 1;
          const w = isLast ? geo.x2 - ax : (geo.x2 - geo.x1) * (r.unitsPerDay / total);
          ctx.fillStyle = r.color;
          ctx.fillRect(ax, accentY, Math.max(w, 1), accentH);
          ax += w;
        });
      }
    }
```

(Pas `geo`/`y`/`height`/`ctx` aan op de daadwerkelijke namen in die functie — de balk-geometrie heet daar `geo.x1/x2` (zie `drawProgressLine`'s `barGeometry`); gebruik `this.barGeometry(task)` zoals `drawProgressLine` doet.)

- [ ] **Step 4: GanttCanvas-doorgeven**

In `GanttCanvas.tsx` (waar `new GanttRenderer(ctx, { rows: viewRows, … })` wordt geconstrueerd, ca. regels 585/628): lees `ui.showResourceAccent`, `resources`, `assignments` uit de store en voeg aan beide optie-objecten toe `showResourceAccent, resources, assignments` (en de deps-arrays op regel 631/685).

- [ ] **Step 5: Test uitbreiden**

In de bestaande renderer-check (check-renderer-dateless.ts is de dichtstbijzijnde; zoek ook naar een bredere renderer-batterij): voeg een assert toe dat met `showResourceAccent: true` + 2 toewijzingen (1:3) er twee fillRects onder de balk met breedtes 25%/75% worden getekend, en met `showResourceAccent: false`/undefined geen enkele. Volg het stub-patroon van dat bestand.

- [ ] **Step 6: Verify + commit**

```bash
npm run typecheck && bash tests/planning/run.sh >/dev/null 2>&1; echo "exit=$?"
git add -A && git commit -m "feat(view): Resource-accent-toggle op Beeld-tab + gesegmenteerd accentstreepje

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Resource-kleurkiezers (editor) + auto-toewijzing bij aanmaak

**Files:**
- Modify: `src/components/panels/ResourcePanel.tsx` (kleurcel in het raster + draft)
- Modify: `src/state/slices/resourceSlice.ts` (`addResource`-auto-kleur)
- Modify: `src/state/slices/librarySlice.ts` (promoteResourceToPool/aanmaak-paden, zelfde regel)
- Modify: `src/components/panels/TaskPropertiesPanel.tsx` (Task.color-kiezer)

- [ ] **Step 1: auto-toewijzing in resourceSlice**

In `addResource` (resourceSlice.ts:54): vóór `s.resources.push({ ...res, id })`:

```ts
      // #21: automatische kleur bij aanmaak (B7) — eerste vrije paletkleur. Alleen als de aanroeper
      // zelf geen kleur meegaf (de editor kan dat straks wel).
      const color = res.color ?? nextFreePaletteColor(s.resources);
      s.resources.push({ ...res, id, color });
```

(Import `nextFreePaletteColor` uit `@/engine/renderer/resourcePalette`.) Verwijder de oude push-regel.

Zelfde regel in `librarySlice.ts` bij het aanmaken van pool-resources — zoek alle plekken waar een nieuwe Resource in de pool wordt gepusht (promoteResourceToPool-pad en het "nieuwe resource"-formulier in de bibliotheekweergave; grep op `resources.push` in librarySlice.ts) en pas dezelfde `res.color ?? nextFreePaletteColor(…)`-regel toe.

- [ ] **Step 2: Kleurcel in ResourcePanel**

`ResourceDraft` uitbreiden met `color?: string`; `freshDraft` ongewijzigd (geen kleur = auto). Voeg `'color'` toe aan `GRID_FIELDS` (ná `'name'`, vóór `'type'` — kleur is het visuele kenmerk van de resource). Render in de grid-cel een compacte native kleurinput:

```tsx
<input
  type="color"
  className="h-6 w-8 cursor-pointer border border-border rounded bg-transparent"
  value={draft.color ?? resourceDisplayColor(/* huidige resource of draft-hash */)}
  onChange={e => updateDraft({ color: e.target.value })}
/>
```

Voor bestaande rijen (niet-draft): zelfde input maar direct `updateResource(r.id, { color: e.target.value })`. Voor de draft: toon de hash-fallback-kleur als value zodat de gebruiker ziet wat er zonder keuze gebeurt. Volg de bestaande cel-renderstijl (grid-navigation raakt nu 8 velden — check `useLiveGridNav`-fields-array meebeweegt via `GRID_FIELDS`, dat gaat automatisch).

Let op `isResourceFieldLocked`: kleur is NIET in `RESOURCE_DIFF_FIELDS`, dus het veld is ook op gestempelde resources bewerkbaar — laat de lock-check voor deze cel weg (bewust: kleur is lokaal presentatie).

- [ ] **Step 3: Task.color-kiezer in TaskPropertiesPanel**

Vind in `TaskPropertiesPanel.tsx` het外观/algemeen-blok (zoek op `task.color` of het appearance-veld; bestaat nog niet in de UI — voeg de kiezer toe ná het voltooiingsveld of bij de taaknaam, naar het patroon van de overige velden):

```tsx
<div>
  <label>{t('task:properties.color')}</label>
  <input
    type="color"
    value={task.color ?? '#2563EB'}
    onChange={e => updateTask(task.id, { color: e.target.value })}
  />
</div>
```

i18n-sleutel `task:properties.color` toevoegen in 14 locales (`"color": "Kleur"` / `"Color"` / …).

- [ ] **Step 4: Verify + commit**

```bash
npm run typecheck && npm run test:planning >/dev/null 2>&1; echo "planning=$?"; npm run verify:i18n
git add -A && git commit -m "feat(resource): kleurkiezer + auto-toewijzing bij aanmaak; Task.color-kiezer

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Docs + TODO + volledige poort

**Files:**
- Modify: `public/docs/nl/gids-rapporten-printen.md`, `public/docs/en/gids-rapporten-printen.md`
- Modify: `public/docs/{nl,en}/gids-resourcebibliotheken.md` (kleurvermelding) — check eerst of dat artikel bestaat (`ls public/docs/en/`)
- Modify: `docs/TODO.md`

- [ ] **Step 1: Print-gids bijwerken (nl + en)**

In `gids-rapporten-printen.md`, in de instellingenlijst van de Gantt-afdruk-sectie (ná de bestaande bullet-lijst):

```markdown
- **Balkkleuren** — hoe de balken hun kleur krijgen: *Kritiek pad* (standaard: rood/oranje/blauw,
  zoals u gewend bent), *Per taak — eigen kleur* (gebruikt de kleur die u per taak kunt instellen
  in het eigenschappenpaneel), *Per taak — automatisch* (elke taak krijgt automatisch een eigen
  kleur) of *Per resource* (elke balk kleurt naar de uitvoerende partij — metselaar geel,
  loodgieter groen; een taak met meerdere partijen krijgt gesegmenteerde balk in verhouding tot de
  inzet; taken zonder partij blijven blauw). In de laatste drie modi markeert een rode rand om de
  balk het kritieke pad, en de legenda onderaan past zich aan.
- **Statuslijn** — *Geen*, *Statusdatumlijn* (een verticale stippellijn op de statusdatum van het
  project) of *Voortgangslijn* (dezelfde zigzaglijn als op het scherm: per taak een uitstulping
  naar de voortgangspositie). Zonder statusdatum in het project tekent niets — stel er eerst één
  in via Planning → Statusdatum.
- **Volg weergave** — staat dit aan, dan print de export precies wat u op het scherm ziet: het
  actieve filter, de groepering, de sortering én ingeklapte groepen blijven ingeklapt. Uit (standaard)
  print de volledige takenboom.
```

(EN-versie: vertaal deze alinea's; het artikel heet daar hetzelfde — check de bestandsnaam via `ls public/docs/en/ | grep rapport`.)

- [ ] **Step 2: TODO.md**

`docs/TODO.md` — voeg onder "Openstaand" (of de passende fase-sectie; lees de kop) toe:

```markdown
### Rapportexport #21/#54 (2026-08-14)
- [x] Balkkleurmodi in de export (kritiek-pad / per taak automatisch / per taak eigen kleur / per
  resource met segmenten + legenda), statusdatum-/voortgangslijn in de export, "volg weergave"
  (export tekent de viewRows). Zie docs/superpowers/specs/2026-08-14-rapport-export-opties-design.md.
```

(Als de repo-conventie is om afgeronde items te verwijderen i.p.v. af te vinken — de kop van TODO.md zegt "Afgeronde items worden uit deze lijst verwijderd" — laat de entry dan weg en vermeld de feature alleen in de release-notes wanneer die komt. Kies conform die conventie.)

- [ ] **Step 3: Volledige poort**

```bash
npm run verify
```

Expected: exit 0 — typecheck, alle vier de suites, verify:examples, verify:docs, verify:i18n, verify:cycles, verify:audit. Fix wat rood is vóór de commit; rapporteer eerlijk wat er eventueel nog rood is.

- [ ] **Step 4: Commit**

```bash
git add public/docs docs/TODO.md
git commit -m "docs: print-gids + TODO voor rapportexport-opties (#21/#54)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Zelf-review-checklist (na afloop van alle taken)

- [ ] Spec-dekking: B1✓(T2,T8) B2✓(T7) B3✓(T5,T4) B4✓(T4,T5,T6) B5✓(T3,T4) B6✓(T3) B7✓(T1,T8) B8✓(T3,T4) B9✓(T4).
- [ ] Default-gedrag: zonder de nieuwe opties is de output byte-identiek oud gedrag (bewaakt door bestaande checks today-label/dependency-style + nieuwe check).
- [ ] `npm run verify` groen; exitcodes gecontroleerd (niet de tails).
- [ ] Preview én export testen via de dev-build (`npm run dev`, Playwright MCP — `window.__OPS__`-store-asserts): kleurmodi in de preview, statuslijn-zigzag, volg-weergave met een actief filter.

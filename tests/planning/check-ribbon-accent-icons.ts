// Tijdelijke flag `lint-iconen-accent` (Ethan, 7 november 2026): flag uit toont de linticonen van main, flag aan de
// nieuwe tekeningen. Weg met de flag en `src/components/icons/ribbonAccentIcons.ts`.
import fs from 'node:fs';
import path from 'node:path';
import { B2_ICONS, type IconMaster } from '@/components/icons/b2/icons.generated';
import { RIBBON_ACCENT_FLAG, ribbonAccentIcon, type RibbonAccentIconId } from '@/components/icons/ribbonAccentIcons';
import { FEATURE_FLAGS, isFeatureEnabled } from '@/utils/featureFlags';

const diffs: string[] = [];
const ok = (condition: boolean, message: string) => { if (!condition) diffs.push(message); };
const accentParts = (m: IconMaster) => m.parts.filter(part => part[1] === 1).length;
const primaryParts = (m: IconMaster) => m.parts.filter(part => part[1] === 0).length;
const IDS: RibbonAccentIconId[] = ['task.add', 'resource.level', 'resource.clear-level'];

const flag = FEATURE_FLAGS.find(f => f.id === RIBBON_ACCENT_FLAG);
ok(!!flag, 'de flag staat in het register');
ok(flag?.writesNewIfcData === false, 'de flag schrijft geen IFC-data en is dus schakelbaar');
ok(!isFeatureEnabled({}, RIBBON_ACCENT_FLAG), 'standaard uit');
ok(isFeatureEnabled({ [RIBBON_ACCENT_FLAG]: true }, RIBBON_ACCENT_FLAG), 'aan te zetten');

// Flag uit: het id zelf met de Blueprint-tekening, en die is (nog) helemaal grijs zoals op main.
for (const id of IDS) {
  const shown = ribbonAccentIcon(id, false);
  ok(shown.id === id && shown.drawing === undefined, `${id}: flag uit toont het eigen id zonder andere tekening`);
  for (const size of ['s16', 's24'] as const) {
    ok(accentParts(B2_ICONS[id][size]) === 0,
      `${id} ${size}: de vastgezette Blueprint-tekening heeft al oranje; staat de nieuwe set er al in, haal dan de flag weg`);
  }
}

// Flag aan: Taak toont de plus van Nieuwe resource; Nivelleren en Nivellering wissen de nieuwe tekening.
const task = ribbonAccentIcon('task.add', true);
ok(task.id === 'resource.new' && task.drawing === undefined, 'task.add: flag aan toont resource.new');
for (const size of ['s16', 's24'] as const) {
  ok(accentParts(B2_ICONS['resource.new'][size]) === 2 && primaryParts(B2_ICONS['resource.new'][size]) === 1,
    `resource.new ${size}: de plus met twee oranje helften en een grijze staande lijn`);
}
for (const id of ['resource.level', 'resource.clear-level'] as const) {
  const shown = ribbonAccentIcon(id, true);
  ok(shown.id === id && !!shown.drawing, `${id}: flag aan geeft een eigen tekening`);
  for (const [size, w] of [['s16', 1.25], ['s24', 1.75]] as const) {
    const m = shown.drawing?.[size];
    ok(!!m && m.w === w, `${id} ${size}: lijndikte ${w}`);
    ok(!!m && accentParts(m) === 1 && primaryParts(m) >= 2, `${id} ${size}: één oranje deel naast grijs`);
  }
}

// Het lint gebruikt de wissel voor precies deze drie knoppen.
const root = path.resolve(import.meta.dirname, '../..');
const ribbon = fs.readFileSync(path.join(root, 'src/components/layout/Ribbon/ribbonConfig.tsx'), 'utf8');
for (const id of IDS) {
  ok(ribbon.includes(`<RibbonAccentIcon id="${id}"`), `ribbonConfig: ${id} loopt via RibbonAccentIcon`);
  ok(!ribbon.includes(`<Icon id="${id}"`), `ribbonConfig: ${id} niet meer rechtstreeks als Icon`);
}
const wrapper = fs.readFileSync(path.join(root, 'src/components/layout/Ribbon/RibbonAccentIcon.tsx'), 'utf8');
ok(/isFeatureEnabled\(s\.ui\.featureFlags, RIBBON_ACCENT_FLAG\)/.test(wrapper), 'RibbonAccentIcon leest de flag uit de store');

if (diffs.length > 0) {
  for (const diff of diffs) console.log(`XX  ribbon-accent-icons: ${diff}`);
  process.exit(1);
}
console.log('OK  ribbon-accent-icons: flag uit = iconen van main, flag aan = nieuwe tekeningen');

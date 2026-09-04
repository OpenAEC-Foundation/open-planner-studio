import './domStub';
import {
  DEFAULT_BAR_COLOR_SELECTION,
  TASK_TYPE_BAR_COLOR_FIELD,
} from '@/types/barColor';
import {
  loadBarColorSelection,
  migrateLegacyBarColorSelection,
  parseBarColorSelection,
  saveBarColorSelection,
} from '@/utils/barColorSettings';

let failures = 0;
const ok = (condition: boolean, message: string) => {
  if (!condition) {
    console.log(`XX  ${message}`);
    failures++;
  }
};
const deepEqual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const category = {
  mode: 'category',
  field: { src: 'activityCode', typeId: 'discipline' },
} as const;

ok(deepEqual(parseBarColorSelection(category), category), 'geldige categorie blijft behouden');
ok(
  parseBarColorSelection({ mode: 'category', field: { src: 'activityCode' } }) === undefined,
  'categorie zonder typeId wordt geweigerd',
);
ok(
  deepEqual(migrateLegacyBarColorSelection('resource', undefined), {
    mode: 'category', field: { src: 'resource' },
  }),
  'resource migreert naar categorie/resource',
);
ok(
  deepEqual(migrateLegacyBarColorSelection('task', undefined), DEFAULT_BAR_COLOR_SELECTION),
  'eigen taakkleur migreert naar kritiek pad',
);
ok(
  deepEqual(migrateLegacyBarColorSelection('critical', { barColorMode: 'auto' }), { mode: 'auto' }),
  'niet-standaard rapportkeuze wint van standaard schermkeuze',
);
ok(
  deepEqual(migrateLegacyBarColorSelection('auto', { barColorMode: 'resource' }), { mode: 'auto' }),
  'niet-standaard schermkeuze wint bij conflict',
);

localStorage.clear();
await saveBarColorSelection(category);
ok(deepEqual(await loadBarColorSelection(), category), 'canonieke selectie round-tript');

localStorage.clear();
localStorage.setItem('ops-screenBarColorMode', 'resource');
ok(
  deepEqual(await loadBarColorSelection(), { mode: 'category', field: { src: 'resource' } }),
  'legacy instelling wordt geladen en canoniek teruggeschreven',
);
ok(localStorage.getItem('ops-barColorSelection') !== null, 'migratie schrijft de nieuwe sleutel');
ok(
  deepEqual(TASK_TYPE_BAR_COLOR_FIELD, { src: 'builtin', key: 'taskType' }),
  'vaste terugval is taaktype',
);

if (failures > 0) {
  console.log(`bar-color-settings: ${failures} faalregels`);
  process.exit(1);
}
console.log('bar-color-settings: alles groen');

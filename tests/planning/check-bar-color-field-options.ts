import {
  barColorFieldOptions,
  effectiveBarColorControl,
} from '@/components/viewControls/barColorFieldOptions';
import { groupFieldList, type FieldCatalogCtx } from '@/components/viewControls/fieldCatalog';
import {
  encodeFieldRef,
  RibbonInlineSelect,
} from '@/components/layout/Ribbon/ribbonPrimitives';
import type { ChangeEvent } from 'react';

let failures = 0;
const ok = (condition: boolean, label: string) => {
  if (!condition) {
    console.log(`   XX ${label}`);
    failures++;
  }
};

const ctx: FieldCatalogCtx = {
  activityCodeTypes: [{
    id: 'discipline', name: 'Discipline',
    values: [{ id: 'bouw', code: 'B', description: 'Bouw' }],
  }],
  customFieldDefs: [
    { id: 'zone', name: 'Zone', type: 'text' },
    { id: 'fase', name: 'Fase', type: 'integer' },
  ],
  resources: [],
  builtinLabels: {
    wbsCode: 'WBS', name: 'Naam', duration: 'Duur', start: 'Start', finish: 'Einde',
    taskType: 'Taaktype', isCritical: 'Kritiek', totalFloat: 'Speling', completion: 'Gereed',
    isMilestone: 'Mijlpaal', freeFloat: 'Vrije speling', interferingFloat: 'Storende speling',
    isNearCritical: 'Bijna kritiek', floatPath: 'Spelingpad', activeDuring: 'Actief tussen',
  },
  taskTypeLabels: { CONSTRUCTION: 'Constructie' },
  resourceLabel: 'Resource',
  activityCodeSuffix: 'activiteitcode',
  customFieldSuffix: 'eigen veld',
};

const actual = barColorFieldOptions(ctx).map(option => encodeFieldRef(option.field));
const expected = groupFieldList(ctx).map(encodeFieldRef);
ok(JSON.stringify(actual) === JSON.stringify(expected), 'Balkkleuren gebruikt exact dezelfde velden en volgorde als Group');

const original = { mode: 'category', field: { src: 'activityCode', typeId: 'verwijderd' } } as const;
const control = effectiveBarColorControl(original, ctx);
ok(
  control.effective.mode === 'category'
    && control.effective.field.src === 'builtin'
    && control.effective.field.key === 'taskType',
  'verwijderd veld gebruikt effectief Taaktype',
);
ok(
  control.missingField?.src === 'activityCode' && control.missingField.typeId === 'verwijderd',
  'missingField bewaart de oorspronkelijke veldreferentie',
);
ok(original.field.typeId === 'verwijderd', 'de globale selectie wordt niet gemuteerd');

// Regressie: een categorieveld stond eerst in een tweede, geportalde Popover. De buitenste
// Balkkleuren-popover zag de mousedown in dat portaal als buitenklik en ontkoppelde de opties vóór
// hun click-handler. Een echte inline select heeft geen tweede kliklaag en moet de gekozen waarde
// direct via zijn eigen change-event doorgeven.
const taskTypeValue = encodeFieldRef({ src: 'builtin', key: 'taskType' });
const resourceValue = encodeFieldRef({ src: 'resource' });
let selectedValue = '';
const inlineSelect = RibbonInlineSelect({
  value: taskTypeValue,
  options: [
    { value: taskTypeValue, label: 'Taaktype' },
    { value: resourceValue, label: 'Resource' },
  ],
  onChange: value => { selectedValue = value; },
  ariaLabel: 'Kleurcategorie',
});
ok(inlineSelect.type === 'select', 'categorieveld is een directe select zonder tweede popover');
ok(
  inlineSelect.props['aria-label'] === 'Kleurcategorie',
  'inline categorieveld heeft een toegankelijke naam',
);
inlineSelect.props.onChange?.({
  currentTarget: { value: resourceValue },
} as ChangeEvent<HTMLSelectElement>);
ok(selectedValue === resourceValue, 'categorieveld geeft een nieuwe keuze direct door');

if (failures > 0) {
  console.log(`bar-color-field-options: ${failures} faalregels`);
  process.exit(1);
}
console.log('bar-color-field-options: alles groen');

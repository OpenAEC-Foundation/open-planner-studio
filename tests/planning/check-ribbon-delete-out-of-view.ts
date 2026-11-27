import './domStub';
import fs from 'node:fs';
import path from 'node:path';
import { useAppStore } from '@/state/appStore';
import { COMMANDS, hasEditableSelection, isCommandEnabled } from '@/state/commands';
import { isTaskListInView } from '@/state/ganttVisibility';
import {
  RIBBON_TABS, type RibbonButtonSpec, type RibbonGroupSpec, type RibbonItemSpec,
} from '@/components/layout/Ribbon/ribbonConfig';

const S = () => useAppStore.getState();
const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};

function findButton(id: string): RibbonButtonSpec | undefined {
  const walk = (items: RibbonItemSpec[]): RibbonButtonSpec | undefined => {
    for (const item of items) {
      if (item.kind === 'stack') {
        const hit = item.items.find(sub => sub.kind !== 'component' && sub.id === id);
        if (hit && hit.kind !== 'component') return hit;
      } else if (item.kind !== 'component' && item.id === id) {
        return item;
      }
    }
    return undefined;
  };
  for (const groups of Object.values(RIBBON_TABS) as RibbonGroupSpec[][]) {
    for (const group of groups) {
      const hit = walk(group.items);
      if (hit) return hit;
    }
  }
  return undefined;
}

const deleteSpec = findButton('delete');
const dissolveSpec = findButton('dissolve');
eq('1 lintconfig bevat de knoppen delete en dissolve', [deleteSpec?.id, dissolveSpec?.id], ['delete', 'dissolve']);

const commandsSrc = fs.readFileSync(path.join(process.cwd(), 'src/state/commands.ts'), 'utf8');
eq('2 COMMANDS.delete.isEnabled is de gedeelde predicate', /isEnabled: hasEditableSelection/.test(commandsSrc), true);
const ribbonSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/layout/Ribbon/ribbonConfig.tsx'), 'utf8');
const dissolveBlock = ribbonSrc.slice(ribbonSrc.indexOf("id: 'dissolve'"));
eq('3 dissolve-knop leest de gedeelde predicate', /useAppStore\(hasEditableSelection\)/.test(dissolveBlock.slice(0, 600)), true);
eq('4 dissolve-knop zet disabled uit die predicate', /disabled: !editable/.test(dissolveBlock.slice(0, 600)), true);

S().newProject();
S().setProject({ startDate: '2026-06-01' });
const idA = S().addTask({ name: 'A' });
S().addTask({ name: 'B' });
S().selectTask(idA);
S().setUI({ activeRibbonTab: 'start', showResourcePanel: false, resourcePanelDocked: false });

eq('5 takenlijst in beeld: isTaskListInView', isTaskListInView(S().ui), true);
eq('6 takenlijst in beeld: COMMANDS.delete enabled (lintknop Verwijderen aan)', isCommandEnabled(COMMANDS.delete, S()), true);
eq('7 takenlijst in beeld: hasEditableSelection (lintknop Dissolve aan)', hasEditableSelection(S()), true);

S().setUI({ activeRibbonTab: 'resources', showResourcePanel: true, resourcePanelDocked: false });
S().setUI({ activeRibbonTab: 'start' });
eq('8 paneel open op Start: isTaskListInView', isTaskListInView(S().ui), false);
eq('9 paneel open op Start: COMMANDS.delete disabled', isCommandEnabled(COMMANDS.delete, S()), false);
eq('10 paneel open op Start: hasEditableSelection', hasEditableSelection(S()), false);
eq('11 selectie staat nog steeds op A', S().selectedTaskIds, [idA]);

S().setUI({ activeRibbonTab: 'table' });
eq('12 paneel open op Tabel: isTaskListInView', isTaskListInView(S().ui), false);
eq('13 paneel open op Tabel: COMMANDS.delete disabled', isCommandEnabled(COMMANDS.delete, S()), false);
eq('14 paneel open op Tabel: hasEditableSelection', hasEditableSelection(S()), false);

S().setUI({ activeRibbonTab: 'start', showResourcePanel: false });
eq('15 paneel dicht: COMMANDS.delete enabled', isCommandEnabled(COMMANDS.delete, S()), true);
eq('16 paneel dicht: hasEditableSelection', hasEditableSelection(S()), true);

S().setUI({ showResourcePanel: true, resourcePanelDocked: true });
eq('17 GEDOCKT paneel deelt de werkruimte: takenlijst in beeld', isTaskListInView(S().ui), true);
eq('18 gedockt paneel: hasEditableSelection', hasEditableSelection(S()), true);

S().setUI({ showResourcePanel: false, resourcePanelDocked: false });
S().deselectAll();
eq('19 geen selectie: COMMANDS.delete disabled', isCommandEnabled(COMMANDS.delete, S()), false);
eq('20 geen selectie: hasEditableSelection', hasEditableSelection(S()), false);

if (diffs.length > 0) {
  console.error(`XX check-ribbon-delete-out-of-view: ${diffs.length} van ${checks} checks rood`);
  for (const d of diffs) console.error(`XX ${d}`);
  process.exit(1);
}
console.log(`check-ribbon-delete-out-of-view: alle ${checks} checks groen`);

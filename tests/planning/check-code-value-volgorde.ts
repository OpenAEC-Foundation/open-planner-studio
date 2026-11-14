// Volgorde van activiteitscode-waarden (issue #885): de planner zet de waarden van een code in een eigen
// volgorde (Codes & velden). De volgorde is de array-volgorde van `ActivityCodeType.values`; de keuzelijst
// op taken (tabelkolom en filter/groepering) volgt die. Bewezen tegen de echte store:
//   A. verplaatsen omhoog/omlaag, en de randen (eerste omhoog, laatste omlaag) doen niets;
//   B. herordenen verandert nooit de waarde op een taak en is één undo-stap;
//   C. de keuzelijst (kolomopties en veldkiezer) volgt de volgorde;
//   D. de volgorde overleeft IFC opslaan en heropenen (en een oud bestand houdt zijn volgorde).
import { createAppStoreContext } from '@/state/appStoreFactory';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { selectOptions } from '@/components/viewControls/fieldCatalog';
import { activityCodeColumnId } from '@/engine/taskGrid/fieldIds';
import { buildTaskColumnRegistry } from '@/engine/taskGrid/taskColumnRegistry';
import { createDefaultTaskTime } from '@/utils/taskDefaults';

let fails = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) console.log(`ok  ${label}`);
  else { console.log(`XX  ${label} — kreeg ${JSON.stringify(got)}, verwacht ${JSON.stringify(want)}`); fails++; }
};

const ctx = createAppStoreContext();
const S = () => ctx.store.getState();
const codes = (typeId: string) => S().activityCodeTypes.find(t => t.id === typeId)!.values.map(v => v.code);
const applied = () => S().historyEvents.filter(e => e.state === 'applied').length;

S().newProject();
const typeId = S().addActivityCodeType('PCS');
const df = S().addActivityCodeValue(typeId, { code: 'Design freeze' });
S().addActivityCodeValue(typeId, { code: 'RFQ issued' });
const order = S().addActivityCodeValue(typeId, { code: 'Order placed' });
const quote = S().addActivityCodeValue(typeId, { code: 'Quote received' }); // staat onderaan
const taskId = S().addTask({ name: 'Staalbestelling', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 1) });
S().setTaskActivityCode(taskId, typeId, quote);

eq('A0 uitgangspunt: aanmaakvolgorde', codes(typeId), ['Design freeze', 'RFQ issued', 'Order placed', 'Quote received']);

// A + B: 'Quote received' twee omhoog, tussen RFQ en Order
const before = applied();
S().moveActivityCodeValue(typeId, quote, -1);
S().moveActivityCodeValue(typeId, quote, -1);
eq('A1 twee keer omhoog', codes(typeId), ['Design freeze', 'Quote received', 'RFQ issued', 'Order placed']);
eq('B1 elke verplaatsing is één undo-stap', applied() - before, 2);
eq('B2 de waarde op de taak blijft', S().tasks.find(t => t.id === taskId)!.activityCodes?.[typeId], quote);

S().moveActivityCodeValue(typeId, quote, 1);
eq('A2 omlaag', codes(typeId), ['Design freeze', 'RFQ issued', 'Quote received', 'Order placed']);
const n = applied();
S().moveActivityCodeValue(typeId, df, -1);
S().moveActivityCodeValue(typeId, order, 1);
S().moveActivityCodeValue(typeId, 'bestaat-niet', 1);
eq('A3 de randen doen niets', codes(typeId), ['Design freeze', 'RFQ issued', 'Quote received', 'Order placed']);
eq('A4 een nutteloze verplaatsing maakt geen undo-stap', applied(), n);

S().undo();
eq('B3 één undo draait één verplaatsing terug', codes(typeId), ['Design freeze', 'Quote received', 'RFQ issued', 'Order placed']);
S().redo();
eq('B4 redo zet hem terug', codes(typeId), ['Design freeze', 'RFQ issued', 'Quote received', 'Order placed']);

// C: keuzelijsten
const labels = (xs: readonly { label?: string }[]) => xs.map(x => x.label);
const fieldCtx = {
  activityCodeTypes: S().activityCodeTypes, customFieldDefs: [], resources: [], builtinLabels: {} as never,
  taskTypeLabels: {}, resourceLabel: '', activityCodeSuffix: '', customFieldSuffix: '',
};
eq('C1 veldkiezer volgt de volgorde', labels(selectOptions({ src: 'activityCode', typeId }, fieldCtx)),
  ['Design freeze', 'RFQ issued', 'Quote received', 'Order placed']);
const col = buildTaskColumnRegistry({
  projectId: 'p', activityCodeTypes: S().activityCodeTypes, customFieldDefs: [], baselines: [],
}).find(c => c.id === activityCodeColumnId('p', typeId));
eq('C2 tabelkolom volgt de volgorde', labels(col?.editorOptions ?? []),
  ['Design freeze', 'RFQ issued', 'Quote received', 'Order placed']);

// D: IFC rondreis
const reopened = createAppStoreContext();
reopened.store.getState().applyLoadedProject(readIFC(writeIFC(buildWriteIFCInput(S(), 'planOnly'))), { recompute: true });
const t2 = reopened.store.getState().activityCodeTypes.find(t => t.name === 'PCS')!;
eq('D1 IFC opslaan en heropenen behoudt de volgorde', t2.values.map(v => v.code),
  ['Design freeze', 'RFQ issued', 'Quote received', 'Order placed']);
eq('D2 de taakwaarde wijst na heropenen naar dezelfde code', 
  t2.values.find(v => v.id === reopened.store.getState().tasks.find(t => t.name === 'Staalbestelling')!.activityCodes?.[t2.id])?.code, 'Quote received');

// E: twee waarden met dezelfde codetekst (de app staat dat toe): herordenen mag na opslaan en heropenen
// nooit een andere waarde aan de taak hangen (review Sol, #889).
{
  const dup = createAppStoreContext();
  const D = () => dup.store.getState();
  D().newProject();
  const dType = D().addActivityCodeType('Status');
  const q1 = D().addActivityCodeValue(dType, { code: 'Q', description: 'Offerte ontvangen', color: '#111111' });
  const q2 = D().addActivityCodeValue(dType, { code: 'Q', description: 'Offerte goedgekeurd', color: '#222222' });
  const dTask = D().addTask({ name: 'Dubbel', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 1) });
  D().setTaskActivityCode(dTask, dType, q1);
  const viaIfc = () => {
    const re = createAppStoreContext();
    re.store.getState().applyLoadedProject(readIFC(writeIFC(buildWriteIFCInput(D(), 'planOnly'))), { recompute: true });
    const st = re.store.getState();
    const ty = st.activityCodeTypes.find(t => t.name === 'Status')!;
    const val = ty.values.find(v => v.id === st.tasks.find(t => t.name === 'Dubbel')!.activityCodes?.[ty.id]);
    return { order: ty.values.map(v => v.description), taak: val?.description };
  };
  eq('E1 dubbele codetekst: eerste waarde blijft de taakwaarde', viaIfc(),
    { order: ['Offerte ontvangen', 'Offerte goedgekeurd'], taak: 'Offerte ontvangen' });
  D().moveActivityCodeValue(dType, q2, -1);
  eq('E2 na herordenen en IFC-rondreis houdt de taak dezelfde waarde', viaIfc(),
    { order: ['Offerte goedgekeurd', 'Offerte ontvangen'], taak: 'Offerte ontvangen' });
  D().setTaskActivityCode(dTask, dType, q2);
  eq('E3 de tweede waarde blijft de tweede', viaIfc().taak, 'Offerte goedgekeurd');
}

console.log(fails === 0 ? 'EINDOORDEEL: GROEN' : `EINDOORDEEL: ROOD (${fails})`);
process.exit(fails === 0 ? 0 : 1);

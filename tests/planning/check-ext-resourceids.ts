// `resourceIds` via de extensie-API — `api.data.addTask` en `api.data.updateTask` (audit
// resources-kalenders R8).
//
// AANLEIDING. `fromExtTaskInput`/`fromExtTaskUpdates` gaven `resourceIds` rauw door aan de store.
// Gemeten: de taak leek toegewezen (`resourceIds: [kraan]`), maar er was geen toewijzing, dus geen
// belasting in het histogram, en na IFC opslaan + openen was het weg. `resourceIds` is een afgeleide
// van de toewijzingen (de lezers reconstrueren hem daaruit); MCP weigert het veld ook.
//
// WAT HIER VASTLIGT (zelfde vorm als de ouderwijziging, check-ext-parent.ts / #183). Gelijk aan de
// huidige waarde ⇒ genegeerd (een ongewijzigd `getTasks()`-object mag terug, ook in een andere
// volgorde; `[]` bij een nieuwe taak); een andere waarde ⇒ een fout naar de extensie vóór er iets
// gewijzigd is, met de route die wél toewijst. De overige velden blijven werken zoals voorheen.
//
// Draait via run.sh. Exit 0 = alles groen.
import './domStub';
import { createAppStoreContext, type AppStoreContext } from '@/state/appStore';
import { capturePayload } from '@/state/documentContract';
import { createExtensionApi, type ExtensionHostBinding } from '@/extensions/extensionApi';
import type { ExtensionApi } from '@/extensions/types';
import { createDefaultTaskTime } from '@/utils/taskDefaults';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};

const EXT_ID = 'resourceids-test';

function setup(): { ctx: AppStoreContext; api: ExtensionApi; kraan: string; heien: string } {
  const ctx = createAppStoreContext();
  const host: ExtensionHostBinding = { app: ctx, showNotification: () => {} };
  const api = createExtensionApi(EXT_ID, [], undefined, ctx, host);
  const S = ctx.store.getState;
  S().setProject({ startDate: '2026-06-01' });
  const kraan = S().addResource({ name: 'Kraan', type: 'EQUIPMENT', description: '', maxUnits: 1 });
  const heien = S().addTask({ name: 'Heien', time: createDefaultTaskTime('2026-06-01', 3) });
  return { ctx, api, kraan, heien };
}

const taskOf = (ctx: AppStoreContext, id: string) => ctx.store.getState().tasks.find(t => t.id === id)!;
const applied = (ctx: AppStoreContext) => ctx.store.getState().historyEvents.filter(e => e.state === 'applied').length;
const sameDocument = (ctx: AppStoreContext, voor: ReturnType<typeof capturePayload>) =>
  JSON.stringify(capturePayload(ctx.store.getState())) === JSON.stringify(voor);

function thrown(fn: () => void): string | null {
  try {
    fn();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

// ── 1. updateTask met een ANDERE resourceIds: fout, niets gewijzigd ─────────────────────────────
{
  const { ctx, api, kraan, heien } = setup();
  const voor = capturePayload(ctx.store.getState());
  const err = thrown(() => api.data.updateTask(heien, { resourceIds: [kraan], name: 'Heien (nieuw)' }));
  eq('1a updateTask met nieuwe resourceIds gooit een fout', err !== null, true);
  eq('1b de fout noemt de extensie en het veld', /^Extensie "resourceids-test": `resourceIds`/.test(err ?? ''), true);
  eq('1c de fout wijst naar de toewijzingsroute', /getAssignments\(\).*loadProject/.test(err ?? ''), true);
  eq('1d niets gewijzigd — ook de naam uit dezelfde aanroep niet', sameDocument(ctx, voor), true);
  eq('1e geen schijntoewijzing op de taak', taskOf(ctx, heien).resourceIds, []);
}

// ── 2. addTask met resourceIds: fout, geen taak ─────────────────────────────────────────────────
{
  const { ctx, api, kraan } = setup();
  const voor = capturePayload(ctx.store.getState());
  const err = thrown(() => { api.data.addTask({ name: 'Stort', resourceIds: [kraan] }); });
  eq('2a addTask met resourceIds gooit een fout', err !== null, true);
  eq('2b geen taak toegevoegd', sameDocument(ctx, voor), true);
  // `[]` (bv. uit de SDK-taakfabriek) mag gewoon mee.
  const id = api.data.addTask({ name: 'Stort', resourceIds: [] });
  eq('2c addTask met resourceIds [] werkt', taskOf(ctx, id).name, 'Stort');
}

// ── 3. Ongewijzigd terugschrijven is geen wijziging ─────────────────────────────────────────────
{
  const { ctx, api, kraan, heien } = setup();
  const kraan2 = ctx.store.getState().addResource({ name: 'Kraan 2', type: 'EQUIPMENT', description: '', maxUnits: 1 });
  ctx.store.getState().assignResource(heien, kraan, 1);
  ctx.store.getState().assignResource(heien, kraan2, 1);
  ctx.store.getState().runCPM();
  const ext = api.data.getTasks().find(t => t.id === heien)!;
  eq('3a getTasks toont de afgeleide resourceIds', ext.resourceIds, [kraan, kraan2]);

  const voor = capturePayload(ctx.store.getState());
  const undoVoor = applied(ctx);
  eq('3b alleen de huidige resourceIds terugschrijven gooit niet', thrown(() => api.data.updateTask(heien, { resourceIds: ext.resourceIds })), null);
  eq('3c …en laat document en undo-geschiedenis ongemoeid', [sameDocument(ctx, voor), applied(ctx) - undoVoor], [true, 0]);
  eq('3d andere volgorde telt als gelijk', thrown(() => api.data.updateTask(heien, { resourceIds: [kraan2, kraan] })), null);

  // Een heel getTasks()-object terug met een gewijzigde naam: de naam gaat door, resourceIds genegeerd.
  eq('3e ongewijzigd getTasks()-object met nieuwe naam gooit niet', thrown(() => api.data.updateTask(heien, { ...ext, name: 'Heien fase 2' })), null);
  eq('3f de naam is gewijzigd', taskOf(ctx, heien).name, 'Heien fase 2');
  eq('3g de toewijzingen zijn ongemoeid', ctx.store.getState().assignments.filter(a => a.taskId === heien).map(a => a.resourceId), [kraan, kraan2]);
  eq('3h resourceIds blijft de afgeleide', taskOf(ctx, heien).resourceIds, [kraan, kraan2]);

  // Een toewijzing wegschrijven via resourceIds kan ook niet.
  eq('3i een resource weglaten gooit een fout', thrown(() => api.data.updateTask(heien, { resourceIds: [kraan] })) !== null, true);
  eq('3j de toewijzing blijft staan', ctx.store.getState().assignments.filter(a => a.taskId === heien).length, 2);
}

// ── 4. Overige velden en onbekende id: gedrag als voorheen ──────────────────────────────────────
{
  const { ctx, api, heien } = setup();
  api.data.updateTask(heien, { name: 'Heien A' });
  eq('4a updateTask zonder resourceIds werkt als voorheen', taskOf(ctx, heien).name, 'Heien A');
  const voor = capturePayload(ctx.store.getState());
  eq('4b onbekend taak-id blijft een stille no-op', thrown(() => api.data.updateTask('bestaat-niet', { resourceIds: ['x'] })), null);
  eq('4c …zonder iets te wijzigen', sameDocument(ctx, voor), true);
}

if (diffs.length) {
  for (const d of diffs) console.log(`XX  ext-resourceids: ${d}`);
  console.log(`ext-resourceids: ${checks - diffs.length}/${checks} groen`);
  process.exit(1);
}
console.log(`OK  ext-resourceids: ${checks}/${checks} groen`);

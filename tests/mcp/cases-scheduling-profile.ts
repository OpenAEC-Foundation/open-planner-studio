import { appStoreContext, makeMcpContext, useAppStore, test, assert, assertEq, run } from './harness';
import { getTool } from '@/services/mcp/toolRegistry';
import type { McpToolOk, McpToolResult } from '@/services/mcp/contracts';
import { builtInProfile } from '@/engine/scheduler/conventions/registry';

const S = () => useAppStore.getState();
const call = async (name: string, args: unknown = {}) =>
  await getTool(name)!.handler(args, makeMcpContext(appStoreContext, {})) as McpToolResult;
type ProfileView = { id: string; baseId: string; overrides: Record<string, boolean>; conventions: Record<string, boolean> };

test('get_project_info toont het profiel met de opgeloste conventies', async () => {
  S().newProject();
  S().setProject({ schedulingProfile: { ...builtInProfile('p6'), overrides: { clampNegativeFreeFloat: false } } });
  const res = await call('planner_get_project_info');
  assert(res.ok, 'get_project_info moet slagen');
  const profile = ((res as McpToolOk).data as { project: { schedulingProfile?: ProfileView } }).project.schedulingProfile;
  assertEq(profile?.id, 'p6', 'profiel-id');
  assertEq(profile?.conventions.p6RelationFinishBoundary, true, 'B1 opgelost aan onder P6');
  assertEq(profile?.conventions.clampNegativeFreeFloat, false, 'afwijking verwerkt in de opgeloste set');
  assertEq(profile?.overrides, { clampNegativeFreeFloat: false }, 'afwijkingen letterlijk');
});

test('get_project_info toont ook een OPS-project expliciet', async () => {
  S().newProject();
  const res = await call('planner_get_project_info') as McpToolOk;
  const profile = (res.data as { project: { schedulingProfile?: ProfileView } }).project.schedulingProfile;
  assertEq([profile?.id, profile?.baseId, Object.keys(profile?.conventions ?? {}).length], ['ops', 'ops', 29], 'ops expliciet, negenentwintig conventies');
});

test('get_project_info toont de SS-lag-variant (projectoptie) expliciet', async () => {
  S().newProject();
  type OptionsView = { schedulingOptions?: { startToStartLagFrom?: string; lagCalendar?: string } };
  const plain = await call('planner_get_project_info') as McpToolOk;
  assertEq((plain.data as { project: OptionsView }).project.schedulingOptions?.startToStartLagFrom, 'earlyStart',
    'afwezig ⇒ earlyStart expliciet');
  S().setProject({ schedulingOptions: { lagCalendar: 'successor', startToStartLagFrom: 'actualStart' } });
  const set = await call('planner_get_project_info') as McpToolOk;
  assertEq((set.data as { project: OptionsView }).project.schedulingOptions,
    { lagCalendar: 'successor', startToStartLagFrom: 'actualStart' }, 'projectopties letterlijk');
});

test('update_project weigert schedulingOptions (ook de SS-lag-variant) met een verwijzing naar Projectinstellingen', async () => {
  S().newProject();
  const res = await call('planner_update_project', { schedulingOptions: { startToStartLagFrom: 'actualStart' } });
  assert(!res.ok && /startToStartLagFrom/.test(res.error) && /Project settings/.test(res.error),
    `weigertekst noemt de optie en Projectinstellingen: ${res.ok ? '' : res.error}`);
});

test('get_project_info toont het nivelleerblok alleen-lezen en letterlijk', async () => {
  S().newProject();
  const leveling = {
    preserveScheduledDates: false, levelAllResources: false,
    priority: [{ field: 'priority_type', direction: 'ASC' as const }],
    resources: [{ resourceId: 'xer-resource:6900', maxUnitsPerHour: 1 }],
  };
  S().setProject({ schedulingOptions: { leveling } });
  const res = await call('planner_get_project_info') as McpToolOk;
  assertEq((res.data as { project: { schedulingOptions?: { leveling?: unknown } } }).project.schedulingOptions?.leveling,
    leveling, 'nivelleerblok letterlijk');
});

test('update_project weigert leveling met de reden "gelezen, nog niet toegepast"', async () => {
  S().newProject();
  const res = await call('planner_update_project', { leveling: { levelAllResources: true } });
  assert(!res.ok && /leveling/.test(res.error) && /NOT applied yet/.test(res.error),
    `weigertekst noemt leveling en dat het nog niet wordt toegepast: ${res.ok ? '' : res.error}`);
});

test('update_project weigert schedulingProfile met een verwijzing naar Projectinstellingen', async () => {
  S().newProject();
  const res = await call('planner_update_project', { schedulingProfile: { id: 'p6' } });
  assert(!res.ok, 'moet weigeren');
  assert(!res.ok && /Project settings/.test(res.error), `weigertekst noemt Projectinstellingen: ${res.ok ? '' : res.error}`);
});

await run();

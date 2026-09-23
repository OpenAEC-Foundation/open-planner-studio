// Rekenprofielen via MCP (plan taak C9): tonen, opgeloste set, en een eerlijke weigering bij schrijven.
// Mutatiebewijs: `schedulingProfile` uit PROJECT_REFUSED halen ⇒ de derde case rood (generieke
// "onbekend veld"-tekst zonder Projectinfo).
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
  assertEq([profile?.id, profile?.baseId, Object.keys(profile?.conventions ?? {}).length], ['ops', 'ops', 22], 'ops expliciet, tweeëntwintig conventies');
});

test('update_project weigert schedulingProfile met een verwijzing naar Projectinfo', async () => {
  S().newProject();
  const res = await call('planner_update_project', { schedulingProfile: { id: 'p6' } });
  assert(!res.ok, 'moet weigeren');
  assert(!res.ok && /Projectinfo/.test(res.error), `weigertekst noemt Projectinfo: ${res.ok ? '' : res.error}`);
});

await run();

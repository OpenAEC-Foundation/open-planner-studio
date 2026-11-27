import type { CatalogEntry, ExtensionStatus } from './types';
import type { InstallOutcome } from './extensionService';
import { HOST_EVENTS, type HostTutorialRequest } from '@/services/extensionEvents';

export const TUTORIALS_EXTENSION_ID = 'tutorials';

export type FirstTutorialOutcome =
  | { kind: 'started' }
  | { kind: 'declined' }
  | { kind: 'unavailable'; reason: FirstTutorialUnavailableReason };

export type FirstTutorialUnavailableReason =
  | 'catalog-error'
  | 'no-entry'
  | 'install-failed'
  | 'not-active'
  | 'no-tutorial'
  | 'not-started';

export interface FirstTutorialDeps {
  extensionStatus(id: string): ExtensionStatus | null;
  whenSettled(id: string): Promise<void>;
  enable(id: string): Promise<void>;
  fetchCatalog(): Promise<void>;
  catalog(): { entries: readonly CatalogEntry[]; error: string | null };
  install(entry: CatalogEntry): Promise<InstallOutcome>;
  firstTutorialId(extensionId: string): string | null;
  emit(event: string, data: HostTutorialRequest): void;
  guideRunningFor(extensionId: string): boolean;
}

export async function startFirstTutorial(
  deps: FirstTutorialDeps,
  extensionId: string = TUTORIALS_EXTENSION_ID,
): Promise<FirstTutorialOutcome> {
  let status = deps.extensionStatus(extensionId);

  if (status === 'loading') {
    await deps.whenSettled(extensionId);
    status = deps.extensionStatus(extensionId);
  }

  if (status === 'disabled') {
    await deps.enable(extensionId);
    await deps.whenSettled(extensionId);
    status = deps.extensionStatus(extensionId);
    if (status !== 'enabled') return { kind: 'unavailable', reason: 'not-active' };
  }

  if (status !== 'enabled') {
    await deps.fetchCatalog();
    const { entries, error } = deps.catalog();
    const entry = entries.find(e => e.id === extensionId);
    if (!entry) return { kind: 'unavailable', reason: error ? 'catalog-error' : 'no-entry' };

    const installed = await deps.install(entry);
    if (installed === 'declined') return { kind: 'declined' };
    if (installed === 'failed') return { kind: 'unavailable', reason: 'install-failed' };
    await deps.whenSettled(extensionId);
    if (deps.extensionStatus(extensionId) !== 'enabled') return { kind: 'unavailable', reason: 'not-active' };
  }

  const tutorialId = deps.firstTutorialId(extensionId);
  if (!tutorialId) return { kind: 'unavailable', reason: 'no-tutorial' };

  deps.emit(HOST_EVENTS.tutorialRequested, { extensionId, tutorialId });
  return deps.guideRunningFor(extensionId) ? { kind: 'started' } : { kind: 'unavailable', reason: 'not-started' };
}

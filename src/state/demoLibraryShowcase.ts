import { useAppStore } from './appStore';

export function applyDemoLibraryToShowcaseProject(): void {
  const store = useAppStore.getState();
  const companyId = store.seedDemoLibrary();
  store.bindProjectToCompany(companyId);
  const links = store.computeRecognition()
    .filter((c) => c.kind === 'resource' && c.suggestedPoolId !== null)
    .map((c) => ({ kind: c.kind, projectId: c.projectId, poolId: c.suggestedPoolId as string }));
  if (links.length > 0) store.linkRecognizedItems(links);
  if (!store.isDirty) useAppStore.setState({ isDirty: false });
}

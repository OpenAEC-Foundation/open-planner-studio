import { useAppStore } from '@/state/appStore';

export function StatusBar() {
  const tasks = useAppStore(s => s.tasks);
  const cpmResult = useAppStore(s => s.cpmResult);
  const selectedTaskIds = useAppStore(s => s.selectedTaskIds);
  const view = useAppStore(s => s.view);
  const isDirty = useAppStore(s => s.isDirty);

  const leafTasks = tasks.filter(t => t.childIds.length === 0);
  const milestones = tasks.filter(t => t.isMilestone);
  const criticalCount = cpmResult?.criticalPath.length || 0;

  return (
    <div className="flex items-center h-6 bg-surface-alt border-t border-border px-3 text-[10px] text-text-secondary select-none gap-4">
      <span>Taken: {leafTasks.length}</span>
      <span>Mijlpalen: {milestones.length}</span>
      {cpmResult && (
        <>
          <span className="text-critical">Kritiek pad: {criticalCount} taken, {cpmResult.projectDuration} werkdagen</span>
          <span>Einde: {cpmResult.projectEnd}</span>
        </>
      )}
      {selectedTaskIds.length > 0 && (
        <span>Selectie: {selectedTaskIds.length} taak/taken</span>
      )}
      <div className="flex-1" />
      <span>Schaal: {view.timeScale}</span>
      <span>Zoom: {Math.round(view.zoom)}px/dag</span>
      {isDirty && <span className="text-yellow-500">Niet opgeslagen</span>}
    </div>
  );
}

import { useState, useCallback } from 'react';
import { useAppStore } from '@/state/appStore';
import { openPrintPreview } from '@/services/print/printPreview';

export function ReportPanel() {
  const tasks = useAppStore(s => s.tasks);
  const sequences = useAppStore(s => s.sequences);
  const calendar = useAppStore(s => s.calendar);
  const projectName = useAppStore(s => s.project.name);
  const viewStartDate = useAppStore(s => s.view.viewStartDate);

  const [showCritical, setShowCritical] = useState(true);
  const [showFloat, setShowFloat] = useState(true);
  const [showDeps, setShowDeps] = useState(true);
  const [showWeekends, setShowWeekends] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [paperSize, setPaperSize] = useState<'A3' | 'A4' | 'A1'>('A3');
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');

  const handlePreview = useCallback(() => {
    openPrintPreview(tasks, sequences, calendar, projectName, viewStartDate);
  }, [tasks, sequences, calendar, projectName, viewStartDate]);

  const criticalCount = tasks.filter(t => t.time.isCritical && t.childIds.length === 0).length;
  const leafCount = tasks.filter(t => t.childIds.length === 0).length;
  const summaryCount = tasks.filter(t => t.childIds.length > 0).length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-surface">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-surface-alt">
        <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">Rapportage</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-lg flex flex-col gap-4">
          {/* Project summary */}
          <div className="bg-surface-alt border border-border rounded-lg p-4">
            <h3 className="text-sm font-bold mb-3">Projectoverzicht</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <span className="text-text-secondary">Totaal taken:</span>
              <span>{tasks.length}</span>
              <span className="text-text-secondary">Bladtaken:</span>
              <span>{leafCount}</span>
              <span className="text-text-secondary">Samenvatting:</span>
              <span>{summaryCount}</span>
              <span className="text-text-secondary">Kritiek pad:</span>
              <span className="text-red-400 font-bold">{criticalCount} taken</span>
              <span className="text-text-secondary">Relaties:</span>
              <span>{sequences.length}</span>
            </div>
          </div>

          {/* Report options */}
          <div className="bg-surface-alt border border-border rounded-lg p-4">
            <h3 className="text-sm font-bold mb-3">Rapport instellingen</h3>

            <div className="flex flex-col gap-2 text-xs">
              <div className="flex items-center gap-3">
                <label className="text-text-secondary w-24">Papierformaat:</label>
                <select
                  value={paperSize}
                  onChange={e => setPaperSize(e.target.value as 'A3' | 'A4' | 'A1')}
                  className="px-2 py-1 bg-surface border border-border rounded focus:border-accent focus:outline-none"
                >
                  <option value="A4">A4</option>
                  <option value="A3">A3</option>
                  <option value="A1">A1</option>
                </select>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-text-secondary w-24">Orientatie:</label>
                <select
                  value={orientation}
                  onChange={e => setOrientation(e.target.value as 'landscape' | 'portrait')}
                  className="px-2 py-1 bg-surface border border-border rounded focus:border-accent focus:outline-none"
                >
                  <option value="landscape">Liggend</option>
                  <option value="portrait">Staand</option>
                </select>
              </div>

              <label className="flex items-center gap-2 mt-2">
                <input type="checkbox" checked={showCritical} onChange={e => setShowCritical(e.target.checked)} className="accent-accent" />
                <span>Kritiek pad markeren</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={showFloat} onChange={e => setShowFloat(e.target.checked)} className="accent-accent" />
                <span>Speling tonen</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={showDeps} onChange={e => setShowDeps(e.target.checked)} className="accent-accent" />
                <span>Afhankelijkheidspijlen</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={showWeekends} onChange={e => setShowWeekends(e.target.checked)} className="accent-accent" />
                <span>Weekenden markeren</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={showLegend} onChange={e => setShowLegend(e.target.checked)} className="accent-accent" />
                <span>Legenda tonen</span>
              </label>
            </div>
          </div>

          {/* Action */}
          <button
            onClick={handlePreview}
            className="px-6 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover text-sm font-medium self-start"
          >
            Afdrukvoorbeeld openen
          </button>
        </div>
      </div>
    </div>
  );
}

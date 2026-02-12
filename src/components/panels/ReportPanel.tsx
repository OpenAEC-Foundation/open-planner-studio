import { useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '@/state/appStore';
import { renderPrintCanvas, PrintOptions } from '@/services/print/printPreview';

export function ReportPanel() {
  const tasks = useAppStore(s => s.tasks);
  const sequences = useAppStore(s => s.sequences);
  const calendar = useAppStore(s => s.calendar);
  const projectName = useAppStore(s => s.project.name);

  const [showCritical, setShowCritical] = useState(true);
  const [showFloat, setShowFloat] = useState(true);
  const [showDeps, setShowDeps] = useState(true);
  const [showWeekends, setShowWeekends] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [paperSize, setPaperSize] = useState<'A3' | 'A4' | 'A1'>('A3');
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const options: PrintOptions = {
    showCritical, showFloat, showDeps, showWeekends, showLegend,
    paperSize, orientation,
  };

  // Re-render the canvas whenever data or options change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderPrintCanvas(canvas, tasks, sequences, calendar, projectName, options);
  }, [tasks, sequences, calendar, projectName, showCritical, showFloat, showDeps, showWeekends, showLegend, paperSize, orientation]);

  const handlePrint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html>
<html><head><title>${projectName}</title>
<style>
  * { margin: 0; padding: 0; }
  body { display: flex; justify-content: center; }
  img { max-width: 100%; height: auto; }
  @page { size: ${orientation}; margin: 8mm; }
</style>
</head><body>
<img src="${dataUrl}" />
<script>window.onload=function(){window.print();}</script>
</body></html>`);
    printWindow.document.close();
  }, [projectName, orientation]);

  const criticalCount = tasks.filter(t => t.time.isCritical && t.childIds.length === 0).length;
  const leafCount = tasks.filter(t => t.childIds.length === 0).length;

  return (
    <div className="flex-1 flex overflow-hidden bg-surface">
      {/* Left: Settings panel */}
      <div className="w-64 flex-shrink-0 border-r border-border overflow-y-auto p-3 flex flex-col gap-3">
        <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">Rapportage</span>

        {/* Project summary */}
        <div className="bg-surface-alt border border-border rounded-lg p-3">
          <h3 className="text-xs font-bold mb-2">Overzicht</h3>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span className="text-text-secondary">Taken:</span>
            <span>{tasks.length}</span>
            <span className="text-text-secondary">Bladtaken:</span>
            <span>{leafCount}</span>
            <span className="text-text-secondary">Kritiek:</span>
            <span className="text-red-400 font-bold">{criticalCount}</span>
            <span className="text-text-secondary">Relaties:</span>
            <span>{sequences.length}</span>
          </div>
        </div>

        {/* Report options */}
        <div className="bg-surface-alt border border-border rounded-lg p-3">
          <h3 className="text-xs font-bold mb-2">Instellingen</h3>
          <div className="flex flex-col gap-2 text-xs">
            <div className="flex items-center gap-2">
              <label className="text-text-secondary w-20">Papier:</label>
              <select
                value={paperSize}
                onChange={e => setPaperSize(e.target.value as 'A3' | 'A4' | 'A1')}
                className="flex-1 px-2 py-1 bg-surface border border-border rounded text-xs focus:border-accent focus:outline-none"
              >
                <option value="A4">A4</option>
                <option value="A3">A3</option>
                <option value="A1">A1</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-text-secondary w-20">Orientatie:</label>
              <select
                value={orientation}
                onChange={e => setOrientation(e.target.value as 'landscape' | 'portrait')}
                className="flex-1 px-2 py-1 bg-surface border border-border rounded text-xs focus:border-accent focus:outline-none"
              >
                <option value="landscape">Liggend</option>
                <option value="portrait">Staand</option>
              </select>
            </div>

            <label className="flex items-center gap-2 mt-1">
              <input type="checkbox" checked={showCritical} onChange={e => setShowCritical(e.target.checked)} className="accent-accent" />
              <span>Kritiek pad</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showFloat} onChange={e => setShowFloat(e.target.checked)} className="accent-accent" />
              <span>Speling tonen</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showDeps} onChange={e => setShowDeps(e.target.checked)} className="accent-accent" />
              <span>Afhankelijkheden</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showWeekends} onChange={e => setShowWeekends(e.target.checked)} className="accent-accent" />
              <span>Weekenden</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showLegend} onChange={e => setShowLegend(e.target.checked)} className="accent-accent" />
              <span>Legenda</span>
            </label>
          </div>
        </div>

        {/* Print button */}
        <button
          onClick={handlePrint}
          className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover text-xs font-medium"
        >
          Afdrukken...
        </button>
      </div>

      {/* Right: Live preview */}
      <div className="flex-1 overflow-auto bg-neutral-200 p-4">
        <div className="inline-block shadow-lg rounded bg-white">
          <canvas ref={canvasRef} />
        </div>
      </div>
    </div>
  );
}

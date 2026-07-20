import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Gauge, Copy, Check, Play, AlertTriangle } from 'lucide-react';
import { useAppStore } from '@/state/appStore';
import { Dialog } from '@/components/common/Dialog';
import type { TFunction } from 'i18next';
import { BENCHMARK_SIZES } from '@/services/benchmark/generateProject';
import {
  runBenchmark, formatResultsMarkdown, formatBytes,
  type BenchmarkResult, type ProgressUpdate, type PhaseId,
} from '@/services/benchmark/runner';

/** Grootte waarboven de "kan lang duren"-waarschuwing verschijnt (audit-punt 2). */
const LARGE_SIZE_THRESHOLD = 2500;

/** Gelokaliseerde Detail-kolomtekst per fase, opgebouwd uit de gestructureerde resultaatvelden
 *  (audit-punt 1) — geen hardgecodeerde strings uit de runner meer. */
function phaseDetail(phase: PhaseId, r: BenchmarkResult, t: TFunction): string {
  switch (phase) {
    case 'generate': return t('benchmark.detailGenerate', { tasks: r.tasks, sequences: r.sequences });
    case 'cpm': return t('benchmark.detailCpm', { leaf: r.leafTasks, sequences: r.sequences, critical: r.criticalTasks });
    case 'ifcWrite': return formatBytes(r.ifcBytes);
    case 'ifcRead': return t('benchmark.detailIfcRead', {
      count: r.roundTripTasks,
      status: t(r.roundTripOk ? 'benchmark.roundtripOk' : 'benchmark.roundtripFail'),
    });
    case 'render': return r.renderAvailable
      ? t('benchmark.detailRender', { rows: r.renderRows, w: r.renderWidth, h: r.renderHeight })
      : t('benchmark.renderUnavailable');
  }
}

/** ms-weergave: NaN (bv. render niet beschikbaar) toont een streepje i.p.v. "NaN"/"0.00". */
const fmtMs = (v: number) => (Number.isNaN(v) ? '—' : v.toFixed(2));

/**
 * Ingebouwde benchmark-tool (pakket S). Kiest een planningsgrootte, draait een meetreeks over vijf
 * fasen (genereren, CPM-kern, IFC-schrijven, IFC-lezen, Gantt-render) en toont mediaan/min/max per
 * fase. ISOLATIE: alles draait op lokaal gegenereerde data via direct geïnstantieerde engine-
 * klassen — de store en het open project blijven ongemoeid (geen mutaties, geen undo, geen dirty).
 */
export function BenchmarkDialog() {
  const { t } = useTranslation('common');
  const setUI = useAppStore((s) => s.setUI);
  const close = () => { if (!running) setUI({ showBenchmarkDialog: false }); };

  const [size, setSize] = useState<number>(1000);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [result, setResult] = useState<BenchmarkResult | null>(null);
  const [copied, setCopied] = useState(false);

  const phaseLabel = (phase: PhaseId) => t(`benchmark.phase.${phase}`);

  const run = useCallback(async () => {
    setRunning(true);
    setResult(null);
    setCopied(false);
    setProgress(null);
    // Yield eerst één frame zodat de "bezig"-status rendert vóór de zware synchrone fasen.
    await new Promise((r) => setTimeout(r, 0));
    try {
      const r = await runBenchmark({
        size,
        version: __APP_VERSION__,
        onProgress: (u) => setProgress(u),
      });
      setResult(r);
    } finally {
      setRunning(false);
      setProgress(null);
    }
  }, [size]);

  const copy = useCallback(async () => {
    if (!result) return;
    const text = formatResultsMarkdown(result);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Klembord-API kan geblokkeerd zijn (headless/permissies): val terug op een selecteerbare
      // textarea zodat de gebruiker handmatig kan kopiëren.
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* geef op */ }
      document.body.removeChild(ta);
    }
  }, [result]);

  const pct = progress ? Math.round((progress.iteration / progress.iterations) * 100) : 0;

  return (
    <Dialog
      onBackdropClick={close}
      onCancel={close}
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[640px] max-h-[88vh] flex flex-col overflow-hidden"
      panelProps={{ 'data-ops-benchmark-dialog': true }}
    >
      {/* Kop */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
        <span className="text-sm font-semibold flex items-center gap-2" style={{ fontFamily: 'var(--font-heading)' }}>
          <Gauge size={16} />
          {t('benchmark.title')}
        </span>
        <button onClick={close} disabled={running} className="p-1 hover:bg-surface-hover rounded-[8px] disabled:opacity-40" aria-label={t('close')}>
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-xs">
        <p className="text-text-secondary">{t('benchmark.intro')}</p>

        {/* Grootte-keuze */}
        <div>
          <div className="font-semibold mb-2">{t('benchmark.sizeLabel')}</div>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('benchmark.sizeLabel')}>
            {BENCHMARK_SIZES.map((s) => (
              <button
                key={s}
                role="radio"
                aria-checked={size === s}
                disabled={running}
                onClick={() => setSize(s)}
                className={
                  'px-3 py-1.5 rounded-[8px] border text-xs transition-colors disabled:opacity-40 ' +
                  (size === s
                    ? 'bg-accent/10 border-accent text-text-primary font-semibold'
                    : 'bg-surface border-border text-text-secondary hover:bg-surface-hover')
                }
                data-ops-benchmark-size={s}
              >
                {t('benchmark.tasksCount', { count: s })}
              </button>
            ))}
          </div>
          {size >= LARGE_SIZE_THRESHOLD && (
            <p className="mt-2 text-text-secondary flex items-start gap-1.5" data-ops-benchmark-warning>
              <AlertTriangle size={13} className="text-critical shrink-0 mt-0.5" />
              <span>{t('benchmark.largeWarning')}</span>
            </p>
          )}
        </div>

        {/* Run-knop + voortgang */}
        <div className="flex items-center gap-3">
          <button
            onClick={run}
            disabled={running}
            className="btn btn--sm btn--primary flex items-center gap-1.5"
            data-ops-benchmark-run
          >
            <Play size={13} />
            {running ? t('benchmark.running') : t('benchmark.run')}
          </button>
          {running && progress && (
            <div className="flex-1" data-ops-benchmark-progress>
              <div className="flex justify-between mb-1 text-text-secondary">
                <span>{t('benchmark.progress', {
                  phase: phaseLabel(progress.phase),
                  index: progress.phaseIndex + 1,
                  total: progress.totalPhases,
                })}</span>
                <span>{progress.iteration}/{progress.iterations}</span>
              </div>
              <div className="h-1.5 bg-surface-hover rounded-full overflow-hidden">
                <div className="h-full bg-accent transition-[width] duration-150" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* Resultaten */}
        {result && (
          <div className="flex flex-col gap-3" data-ops-benchmark-result>
            <div className="flex items-center justify-between">
              <div className="font-semibold">{t('benchmark.resultsTitle')}</div>
              <button onClick={copy} className="btn btn--sm btn--secondary flex items-center gap-1.5" data-ops-benchmark-copy>
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? t('benchmark.copied') : t('benchmark.copy')}
              </button>
            </div>

            {/* Samenvatting */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-text-secondary bg-surface-hover rounded-[8px] p-3">
              <SummaryRow label={t('benchmark.summaryTasks')} value={`${result.tasks} (${result.leafTasks} leaf)`} />
              <SummaryRow label={t('benchmark.summarySequences')} value={String(result.sequences)} />
              <SummaryRow label={t('benchmark.summaryResources')} value={`${result.resources} · ${result.assignments}`} />
              <SummaryRow label={t('benchmark.summaryCritical')} value={String(result.criticalTasks)} />
              <SummaryRow label={t('benchmark.summaryIfc')} value={formatBytes(result.ifcBytes)} />
              <SummaryRow
                label={t('benchmark.summaryRoundtrip')}
                value={result.roundTripOk ? t('benchmark.roundtripOk') : t('benchmark.roundtripFail')}
                warn={!result.roundTripOk}
              />
            </div>

            {/* Fase-tabel */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="text-text-secondary text-left border-b border-border">
                    <th className="py-1.5 pr-2 font-semibold">{t('benchmark.colPhase')}</th>
                    <th className="py-1.5 px-2 font-semibold text-right">{t('benchmark.colIterations')}</th>
                    <th className="py-1.5 px-2 font-semibold text-right">{t('benchmark.colMedian')}</th>
                    <th className="py-1.5 px-2 font-semibold text-right">{t('benchmark.colMin')}</th>
                    <th className="py-1.5 px-2 font-semibold text-right">{t('benchmark.colMax')}</th>
                    <th className="py-1.5 pl-2 font-semibold">{t('benchmark.colDetail')}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.phases.map((p) => (
                    <tr key={p.phase} className="border-b border-border/50">
                      <td className="py-1.5 pr-2">{phaseLabel(p.phase)}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums">{p.iterations}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums font-semibold">{fmtMs(p.median)}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums text-text-secondary">{fmtMs(p.min)}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums text-text-secondary">{fmtMs(p.max)}</td>
                      <td className="py-1.5 pl-2 text-text-secondary">{phaseDetail(p.phase, result, t)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="text-text-secondary flex justify-between">
              <span>{result.version}</span>
              <span>{new Date(result.timestamp).toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}

function SummaryRow({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span>{label}</span>
      <span className={warn ? 'text-critical font-semibold' : 'text-text-primary font-medium'}>{value}</span>
    </div>
  );
}

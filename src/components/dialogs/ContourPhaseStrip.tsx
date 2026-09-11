import { useRef, useState } from 'react';
import type { ContourPhase } from '@/engine/contour/contourPhases';
import { movePhaseBoundary, phaseStartDay, phasesTotalDays, setPhaseUnits } from '@/engine/contour/contourPhases';

/**
 * Fasen-editor (2026-09) — de SLEEPBARE strook boven de fasentabel in `ContourDialog`: elke fase is
 * een blok over haar werkdagen, de hoogte is de inzet. Twee handvatten per blok, beide met echte
 * pointer-events en `setPointerCapture` (zoals `DataGridHeader`'s kolomresize):
 *  - de verticale GRENS tussen twee blokken: slepen verschuift de grens per hele werkdag
 *    (`movePhaseBoundary`; de buur vangt het verschil op, het totaal blijft de taakduur);
 *  - de BOVENRAND van een blok: slepen zet de inzet, gesnapt op 0,05 eenheid (`setPhaseUnits`).
 * Dubbelklik op een dag binnen een blok splitst de fase daar (`onSplit`). Enkelklik selecteert
 * (markeert de rij in de tabel). Verricht werk staat als grijze dagstaven ónder de blokken en is
 * niet sleepbaar. Puur presentationeel: geen store, alle wijzigingen gaan via `onChange`.
 */
export function ContourPhaseStrip({
  phases, actualSlots, slotMinutes, isos, scaleMax, selected, onChange, onSelect, onSplit, fmtDay, fmtUnits,
}: {
  phases: readonly ContourPhase[];
  /** Verricht werk per werkdagslot in minuten (zelfde index als de dagen). */
  actualSlots: readonly number[];
  slotMinutes: number;
  isos: readonly string[];
  /** Bovengrens van de verticale as in eenheden (bv. max. eenheden van de resource). */
  scaleMax: number;
  selected: number | null;
  onChange: (next: ContourPhase[]) => void;
  onSelect: (index: number | null) => void;
  /** Splits fase `index` ná `afterDays` dagen. */
  onSplit: (index: number, afterDays: number) => void;
  fmtDay: (iso: string | undefined) => string;
  fmtUnits: (units: number) => string;
}) {
  const W = 512;
  const H = 120;
  const PAD_TOP = 14;
  const LABEL_H = 16;
  const totalDays = Math.max(1, phasesTotalDays(phases));
  const dw = W / totalDays;
  const plotH = H - PAD_TOP;
  const yOf = (units: number) => PAD_TOP + plotH * (1 - Math.min(1, Math.max(0, units) / Math.max(0.05, scaleMax)));
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ kind: 'boundary' | 'top'; index: number } | null>(null);

  const localPoint = (e: React.PointerEvent): { x: number; y: number } => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return { x: 0, y: 0 };
    return { x: ((e.clientX - rect.left) / rect.width) * W, y: ((e.clientY - rect.top) / rect.height) * (H + LABEL_H) };
  };

  const startDrag = (e: React.PointerEvent, kind: 'boundary' | 'top', index: number) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setDrag({ kind, index });
    onSelect(index);
  };
  const moveDrag = (e: React.PointerEvent) => {
    if (!drag) return;
    const { x, y } = localPoint(e);
    if (drag.kind === 'boundary') {
      onChange(movePhaseBoundary(phases, drag.index, x / dw));
    } else {
      const raw = ((PAD_TOP + plotH - y) / plotH) * Math.max(0.05, scaleMax);
      const snapped = Math.round(raw / 0.05) * 0.05;
      onChange(setPhaseUnits(phases, drag.index, Math.max(0, Math.round(snapped * 100) / 100)));
    }
  };
  const endDrag = (e: React.PointerEvent) => {
    if (!drag) return;
    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
    setDrag(null);
  };

  const blocks = phases.map((p, i) => {
    const start = phaseStartDay(phases, i);
    return { i, p, start, x: start * dw, w: p.days * dw, y: yOf(p.unitsPerDay) };
  });

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H + LABEL_H}`}
      width="100%"
      style={{ display: 'block', touchAction: 'none', userSelect: 'none' }}
      data-ops-contour-strip
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {/* Achtergrond + dagraster */}
      <rect x={0} y={PAD_TOP} width={W} height={plotH} fill="var(--theme-surface-alt, transparent)" stroke="var(--theme-border-light)" />
      {Array.from({ length: totalDays - 1 }, (_, d) => (
        <line key={`g${d}`} x1={(d + 1) * dw} x2={(d + 1) * dw} y1={PAD_TOP} y2={PAD_TOP + plotH} stroke="var(--theme-border-light)" strokeDasharray="2 3" />
      ))}
      {/* Verricht werk per dag (alleen-lezen) */}
      {actualSlots.map((m, d) => (m > 0 ? (
        <rect key={`a${d}`} x={d * dw} y={yOf(m / slotMinutes)} width={dw} height={PAD_TOP + plotH - yOf(m / slotMinutes)} fill="var(--theme-text-dim)" opacity={0.35} />
      ) : null))}
      {/* Fasenblokken */}
      {blocks.map(({ i, p, start, x, w, y }) => (
        <g key={`b${i}`} data-ops-contour-block={i}>
          <rect
            x={x} y={y} width={w} height={PAD_TOP + plotH - y}
            fill="var(--theme-accent)" opacity={selected === i ? 0.85 : 0.6}
            stroke="var(--theme-accent)" strokeWidth={1}
            style={{ cursor: 'pointer' }}
            onClick={() => onSelect(i)}
            onDoubleClick={(e) => {
              const rect = svgRef.current?.getBoundingClientRect();
              if (!rect || rect.width === 0) return;
              const day = Math.floor(((e.clientX - rect.left) / rect.width) * W / dw);
              const after = day - start;
              if (after >= 1 && after < p.days) onSplit(i, after);
            }}
          />
          {/* Inzetlabel */}
          <text x={x + w / 2} y={Math.max(PAD_TOP - 3, y - 3)} textAnchor="middle" fontSize={10} fill="var(--theme-text)">
            {fmtUnits(p.unitsPerDay)}
          </text>
          {/* Bovenrand-handvat */}
          <rect
            x={x} y={y - 4} width={w} height={8} fill="transparent"
            style={{ cursor: 'row-resize' }}
            data-ops-contour-top={i}
            onPointerDown={(e) => startDrag(e, 'top', i)}
          />
          {/* Startdatumlabel */}
          <text x={x + 2} y={H + LABEL_H - 4} fontSize={9} fill="var(--theme-text-dim)">
            {fmtDay(isos[start])}
          </text>
        </g>
      ))}
      {/* Grenshandvatten tussen fasen */}
      {blocks.slice(0, -1).map(({ i, x, w }) => (
        <g key={`h${i}`}>
          <line x1={x + w} x2={x + w} y1={PAD_TOP} y2={PAD_TOP + plotH} stroke="var(--theme-text)" strokeWidth={1.5} />
          <rect
            x={x + w - 5} y={PAD_TOP} width={10} height={plotH} fill="transparent"
            style={{ cursor: 'col-resize' }}
            data-ops-contour-boundary={i}
            onPointerDown={(e) => startDrag(e, 'boundary', i)}
          />
        </g>
      ))}
    </svg>
  );
}

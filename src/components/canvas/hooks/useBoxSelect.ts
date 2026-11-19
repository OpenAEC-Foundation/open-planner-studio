import { RefObject, useEffect, useState } from 'react';
import { GanttRenderer } from '@/engine/renderer/GanttRenderer';
import { BOX_SELECT_THRESHOLD } from './constants';
import { listenWindowDrag } from '@/hooks/listenWindowDrag';
import { uniqueTaskIds } from '@/engine/view/visibleRows';
import type { SelectionAnchor } from '@/state/slices/types';

/** Sleep vanaf lege achtergrond, nog ONDER de drempel — nog geen kader, alleen
 *  bijhouden vanaf waar we moeten meten. Wordt bij overschrijding gepromoveerd tot BoxSelectState;
 *  blijft de sleep onder de drempel tot mouseup, dan gebeurt er niets (de normale click volgt). */
export interface BoxSelectCandidate {
  startClientX: number;
  startClientY: number;
}

/** Actief selectie-kader (na de drempel). Client-coördinaten, net als
 *  DependencyDragState — omgerekend naar canvas-relatief op het moment van tekenen/meten. */
export interface BoxSelectState {
  startClientX: number;
  startClientY: number;
  currentClientX: number;
  currentClientY: number;
}

interface UseBoxSelectOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  rendererRef: RefObject<GanttRenderer | null>;
  selectTasks: (ids: string[], additive: boolean, activeTaskId?: string | null, anchor?: SelectionAnchor) => void;
  setGridActiveRowKey: (rowKey: string) => void;
  deselectAll: () => void;
  /** Gedeelde vlag met pan + click-handler: onderdrukt de eerstvolgende click ná een kader. */
  justBoxSelectedRef: RefObject<boolean>;
}

// Box-selectie (kader-select vanaf lege achtergrond / takentabel). Bezit de twee fases —
// kandidaat (onder drempel) en gepromoveerd kader — met elk hun eigen window-listeners. Het
// centrale mousedown-hittest roept `startBoxSelect(...)` aan (zet de kandidaat).
export function useBoxSelect({ canvasRef, rendererRef, selectTasks, setGridActiveRowKey, deselectAll, justBoxSelectedRef }: UseBoxSelectOptions) {
  // Box-selection: kandidaat (onder drempel) en gepromoveerd kader (boven drempel).
  const [boxSelectCandidate, setBoxSelectCandidate] = useState<BoxSelectCandidate | null>(null);
  const [boxSelectState, setBoxSelectState] = useState<BoxSelectState | null>(null);

  // Kandidaatfase (nog onder de drempel). Bij overschrijding promoveren
  // we tot een echt kader; onder de drempel bij mouseup gebeurt niets (de gewone click-afhandeling
  // doet dan gewoon zijn normale werk, want justBoxSelectedRef staat niet).
  useEffect(() => {
    if (!boxSelectCandidate) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - boxSelectCandidate.startClientX;
      const dy = e.clientY - boxSelectCandidate.startClientY;
      if (Math.hypot(dx, dy) < BOX_SELECT_THRESHOLD) return;
      setBoxSelectCandidate(null);
      setBoxSelectState({
        startClientX: boxSelectCandidate.startClientX,
        startClientY: boxSelectCandidate.startClientY,
        currentClientX: e.clientX,
        currentClientY: e.clientY,
      });
    };

    const handleMouseUp = () => setBoxSelectCandidate(null);

    return listenWindowDrag({ onMove: handleMouseMove, onUp: handleMouseUp, onDocumentSwitch: () => setBoxSelectCandidate(null) });
  }, [boxSelectCandidate]);

  // Het gepromoveerde kader. Rij-intersectie via de gedeelde hit-test
  // (GanttRenderer.getRowsInYRange) — alléén de Y-band telt, de X-as (tijd-as) doet niet mee,
  // dus takentabel en chart gedragen zich identiek. Ctrl/Cmd bij mouseup = toevoegen, anders
  // vervangen. Escape annuleert zonder selectie-wijziging.
  useEffect(() => {
    if (!boxSelectState) return;

    const handleMouseMove = (e: MouseEvent) => {
      setBoxSelectState(prev => prev ? { ...prev, currentClientX: e.clientX, currentClientY: e.clientY } : null);
    };

    const handleMouseUp = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      const renderer = rendererRef.current;
      if (canvas && renderer) {
        const rect = canvas.getBoundingClientRect();
        const y1 = boxSelectState.startClientY - rect.top;
        const y2 = e.clientY - rect.top;
        const rows = renderer.getRowsInYRange(Math.min(y1, y2), Math.max(y1, y2));
        const ids = uniqueTaskIds(rows);
        const additive = e.ctrlKey || e.metaKey;
        // De bovenste taakrij in het kader is het anker voor Shift, op die rij (review #1004): bij
        // groeperen op resource staat dezelfde taak ook elders.
        const top = rows.find(row => uniqueTaskIds([row]).length > 0);
        if (top && ids.length > 0) {
          const taskIds = uniqueTaskIds([top]);
          selectTasks(ids, additive, taskIds[0], { rowKey: top.rowKey, taskIds });
          // Die rij is ook de cursorrij, net als na een klik: verwijderen kiest de buur vanaf daar
          // (review #1004, ronde 7).
          setGridActiveRowKey(top.rowKey);
        } else if (!additive) {
          deselectAll();
        }
      }
      // Onderdruk de eerstvolgende click zodat de zojuist gezette selectie niet meteen weer
      // overschreven/gedeselecteerd wordt door de normale klik-afhandeling.
      justBoxSelectedRef.current = true;
      armJustBoxSelectedClear();
      setBoxSelectState(null);
    };

    // Annuleren: geen selectie-wijziging. De muis is nog ingedrukt, dus onderdruk ook de eerstvolgende
    // click (anders verandert de selectie alsnog als gevolg van de geannuleerde sleep). Ook bij een
    // documentwissel (review #1004, ronde 12): het kader hoort bij het document waarin het begon.
    const cancel = () => {
      justBoxSelectedRef.current = true;
      armJustBoxSelectedClear();
      setBoxSelectState(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // De globale Escape-sneltoets (edit.deselect in shortcutRegistry.ts) luistert ook op window
      // (bubble-fase) en zou anders ALSNOG deselectAll() aanroepen — capture-fase +
      // stopImmediatePropagation wint gegarandeerd van die bubble-fase-listener (ongeacht
      // registratievolgorde), zodat de selectie echt onaangeroerd blijft.
      e.stopImmediatePropagation();
      cancel();
    };

    // Dode-klik-vangnet (zelfde gat als bij de rijsleep): eindigt de sleep buiten
    // het canvas, dan bereikt geen canvas-click de handler die de vlag normaal consumeert — hij
    // zou blijven staan en de eerstvolgende echte canvas-klik inslikken. Eenmalige window-listener
    // in de BUBBLE-fase wist 'm alsnog (idempotent als een canvas-click 'm al had gewist).
    function armJustBoxSelectedClear(): void {
      window.addEventListener('click', () => { justBoxSelectedRef.current = false; }, { once: true });
    }

    return listenWindowDrag({
      onMove: handleMouseMove, onUp: handleMouseUp, onKeyDown: handleKeyDown, keyCapture: true, onDocumentSwitch: cancel,
    });
  }, [boxSelectState, canvasRef, rendererRef, selectTasks, setGridActiveRowKey, deselectAll, justBoxSelectedRef]);

  return {
    boxSelectCandidate,
    boxSelectState,
    startBoxSelect: setBoxSelectCandidate,
    active: !!boxSelectCandidate || !!boxSelectState,
  };
}

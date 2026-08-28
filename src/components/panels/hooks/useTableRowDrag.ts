// Issue #26 punt 6: verticaal rijen slepen in de TABEL (TableEditor). Dit is de DOM-tegenhanger
// van `src/components/canvas/hooks/useRowDrag.ts` — zelfde twee fasen (kandidaat → gepromoveerde
// sleep), zelfde drempel (`ROW_DRAG_THRESHOLD`, geïmporteerd, niet gedupliceerd), zelfde
// zone-verdeling (25 / 50 / 25) en zelfde regel: muteren gebeurt UITSLUITEND op mouseup, dus één
// sleep = één undo-stap.
//
// Bewust gedeeld: de droplogica zelf zit in `resolveDropTarget` (`@/engine/view/dropTarget`) en
// wordt hier alleen aangeroepen. Zou de tabel zijn eigen doelberekening krijgen, dan zouden tabel
// en Gantt uiteenlopen in waar een gesleepte taak landt.
//
// Het enige echt nieuwe stuk is de rij-MEETING: het canvas rekent met scrollY/rowHeight, de tabel
// is DOM en meet dus met `document.elementFromPoint` + `getBoundingClientRect` op de rij-elementen
// (die daarvoor een `data-ops-row-index`-attribuut dragen).

import { RefObject, useCallback, useEffect, useRef, useState } from 'react';
import type { ViewRow } from '@/engine/view/visibleRows';
import type { Task } from '@/types/task';
import { resolveDropTarget, type DropTarget } from '@/engine/view/dropTarget';
import { shouldPromoteToRowDrag } from '@/engine/taskGrid/rowDragIntent';
import { ROW_DRAG_THRESHOLD } from '@/components/canvas/hooks/constants';

/** Nog ONDER de drempel: alleen onthouden vanaf waar we meten. Blijft de sleep onder de drempel
 *  tot mouseup, dan gebeurt er niets en volgt de gewone klik/selectie. */
export interface TableRowDragCandidate {
  taskId: string;
  startClientX: number;
  startClientY: number;
}

/** Actieve rijsleep (na de drempel). `dropTarget` is het actuele `moveTaskTo`-doel (null = geen
 *  geldig doel); `hoverRowIndex`/`hoverZone` voeden de indicator op de rij zelf. */
export interface TableRowDragState {
  taskId: string;
  hoverRowIndex: number | null;
  hoverZone: 'before' | 'after' | 'nest' | null;
  dropTarget: DropTarget | null;
}

export interface UseTableRowDragOptions {
  /** De VOLLEDIGE `viewRows` (inclusief groepsrijen) — `resolveDropTarget` indexeert hierin. */
  rows: readonly ViewRow[];
  tasksById: Map<string, Task>;
  moveTaskTo: (id: string, target: DropTarget) => void;
  /** Issue #26 (vervolgmelding): de huidige selectie. Sleep je een rij die daar deel van uitmaakt
   *  én telt de selectie meer dan één taak, dan verhuist de HELE groep (`moveTasksTo`). Sleep je
   *  een niet-geselecteerde rij, dan verhuist alleen die rij en blijft de selectie elders met rust
   *  — het gedrag dat men uit MS Project en de bestandsverkenner kent. */
  selectedTaskIds: string[];
  moveTasksTo: (ids: string[], target: DropTarget) => void;
  /** = `isTreeMode(view)`. Net als op het canvas wordt dit door de AANROEPER bepaald. */
  enabled: boolean;
  /** Aangeroepen wanneer er écht gesleept wordt (drempel gehaald) terwijl `enabled` false is —
   *  zo krijgt de gebruiker de uitleg te zien bij een echte poging, niet bij elke klik. */
  onBlocked?: () => void;
  /** Gedeelde vlag met de click-handler: onderdrukt de eerstvolgende click ná een rijsleep. */
  justDraggedRef: RefObject<boolean>;
}

export function useTableRowDrag({ rows, tasksById, moveTaskTo, selectedTaskIds, moveTasksTo, enabled, onBlocked, justDraggedRef }: UseTableRowDragOptions) {
  const [candidate, setCandidate] = useState<TableRowDragCandidate | null>(null);
  const [dragState, setDragState] = useState<TableRowDragState | null>(null);
  // Buiten de effecten gehouden (zie `armJustDraggedClear`) zodat de opruimer óók bij UNMOUNT
  // bereikbaar is en niet meelift op de cleanup van de sleep-effect (die loopt al bij elke
  // dragState-wijziging, dus óók direct ná de drop — dan mogen de listeners juist blijven staan).
  const justDraggedClearRef = useRef<(() => void) | null>(null);

  /** Meet de rij onder de cursor via het DOM en vertaalt hem naar rijindex + zone + droptarget.
   *  Geen rij-element onder de cursor (of een groepsrij, die het attribuut niet draagt) ⇒ null. */
  const computeHover = (
    clientX: number,
    clientY: number,
    draggedTaskId: string,
  ): { rowIndex: number; zone: 'before' | 'after' | 'nest'; target: DropTarget | null } | null => {
    const el = document.elementFromPoint(clientX, clientY)?.closest('[data-ops-row-index]');
    if (!el) return null;
    const rowIndex = Number(el.getAttribute('data-ops-row-index'));
    if (!Number.isFinite(rowIndex)) return null; // kapot/afwezig attribuut ⇒ als "niet gevonden"
    const rect = el.getBoundingClientRect();
    // Zelfde 25/50/25-verdeling als `GanttRenderer.getRowZone`, zodat tabel en canvas identiek
    // reageren op dezelfde verticale positie binnen een rij.
    const frac = rect.height > 0 ? (clientY - rect.top) / rect.height : 0.5;
    let zone: 'before' | 'after' | 'nest' = frac < 0.25 ? 'before' : frac > 0.75 ? 'after' : 'nest';
    // draggedTaskId gaat mee zodat de resolver compenseert voor de remove-dan-insert-verschuiving
    // bij herordenen binnen dezelfde ouder.
    let target = resolveDropTarget(rows, rowIndex, zone, tasksById, draggedTaskId);
    // Nestelen kan alleen op een summary; op een gewone taak gaf de middelste 50% van de rij dus
    // GEEN doel, waardoor de indicator over de halve rijhoogte wegviel en de oranje balk in twee
    // stappen leek te springen. Val in dat geval terug op de dichtstbijzijnde rand-zone, en geef
    // die zone óók terug — zone en doel komen zo uit dezelfde berekening en de indicator kan niet
    // iets anders tonen dan waar de taak landt. `resolveDropTarget` blijft de enige autoriteit.
    if (zone === 'nest' && target === null) {
      zone = frac < 0.5 ? 'before' : 'after';
      target = resolveDropTarget(rows, rowIndex, zone, tasksById, draggedTaskId);
    }
    return { rowIndex, zone, target };
  };

  // Kandidaatfase: pas bij |dy| >= drempel ÉN een overwegend verticale beweging promoveren tot een
  // echte sleep. De canvas-kant mag zuiver op |dy| gaan (mousedown begint daar in de rijgutter, niet
  // op selecteerbare tekst); hier begint mousedown middenin een celwaarde, dus zonder de
  // asintentie-check van `shouldPromoteToRowDrag` promoveerde een horizontale tekstselectie met wat
  // verticale muisruis onterecht tot een rijsleep (browserreview, observatie 2).
  useEffect(() => {
    if (!candidate) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dy = e.clientY - candidate.startClientY;
      const dx = e.clientX - candidate.startClientX;
      if (!shouldPromoteToRowDrag(dx, dy, ROW_DRAG_THRESHOLD)) return;
      setCandidate(null);
      // Vangnet bij het promoveren tot een echte sleep: is er tóch al een tekstselectie over de
      // rijen ontstaan (de `user-select: none` op de rijen komt pas na de render van de
      // kandidaatfase), wis die dan — anders sleep je met een half blauwgeverfde tabel.
      document.getSelection()?.removeAllRanges();
      if (!enabled) {
        // Buiten pure boommodus is de structuur op slot: uitleggen en verder niets doen.
        onBlocked?.();
        return;
      }
      const hover = computeHover(e.clientX, e.clientY, candidate.taskId);
      setDragState({
        taskId: candidate.taskId,
        hoverRowIndex: hover?.rowIndex ?? null,
        hoverZone: hover?.zone ?? null,
        dropTarget: hover?.target ?? null,
      });
    };

    const handleMouseUp = () => setCandidate(null);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate, enabled]);

  // Opruimen van de "net-gesleept"-vlag. Zelfde idee als in `useRowDrag`, maar met een EXTRA
  // vangnet dat het canvas niet nodig heeft: het canvas is één blijvend element, dus daar volgt
  // na de mouseup altijd een click. In de DOM-tabel niet — begon de sleep op rij A en eindigt
  // hij op rij B, dan herrendert de drop de rijen en is het mouseup-doel losgekoppeld, waardoor
  // Chromium HELEMAAL geen click meer stuurt (zelf gemeten). De vlag zou dan blijven staan en de
  // eerstvolgende echte klik inslikken. Daarom wissen we óók bij de eerstvolgende mousedown:
  // die markeert onmiskenbaar een nieuwe interactie, en komt altijd vóór de bijbehorende click.
  // De click-listener blijft in de BUBBLE-fase, zodat de rij-onClick de vlag nog ziet en de
  // sleep-afsluitende klik wél onderdrukt wordt.
  const armJustDraggedClear = useCallback((): void => {
    const clear = () => {
      justDraggedRef.current = false;
      window.removeEventListener('click', clear);
      window.removeEventListener('mousedown', clear);
      justDraggedClearRef.current = null;
    };
    justDraggedClearRef.current = clear;
    window.addEventListener('click', clear);
    window.addEventListener('mousedown', clear);
  }, [justDraggedRef]);

  // Deze twee listeners ruimen zichzelf op bij de eerstvolgende muisactie, maar bij een unmount
  // vlak ná een drop komt die actie nooit — daarom hier expliciet. Bewust een APART effect met een
  // lege dependency-array: het mag alléén bij unmount lopen, niet bij elke dragState-wijziging.
  useEffect(() => () => {
    const clear = justDraggedClearRef.current;
    if (!clear) return;
    window.removeEventListener('click', clear);
    window.removeEventListener('mousedown', clear);
    justDraggedClearRef.current = null;
  }, []);

  // Gepromoveerde fase: doelrij+zone continu herberekenen (GEEN mutatie) zodat de indicator het
  // actuele doel toont. mouseup is de enige plek waar `moveTaskTo` wordt aangeroepen.
  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const hover = computeHover(e.clientX, e.clientY, dragState.taskId);
      setDragState(prev => prev ? {
        ...prev,
        hoverRowIndex: hover?.rowIndex ?? null,
        hoverZone: hover?.zone ?? null,
        dropTarget: hover?.target ?? null,
      } : null);
    };

    const handleMouseUp = () => {
      if (dragState.dropTarget) {
        // Onderdeel van een meervoudige selectie ⇒ de hele groep mee (issue #26-vervolgmelding);
        // anders exact het oude pad. `moveTasksTo` doet de groep in één undo-stap.
        const groepssleep = selectedTaskIds.length > 1 && selectedTaskIds.includes(dragState.taskId);
        if (groepssleep) moveTasksTo(selectedTaskIds, dragState.dropTarget);
        else moveTaskTo(dragState.taskId, dragState.dropTarget);
      }
      // Geen geldig doel ⇒ stille no-op; de store-actie guardt cykels zelf ook nog eens.
      justDraggedRef.current = true;
      armJustDraggedClear();
      setDragState(null);
    };

    // Escape annuleert ZONDER mutatie. Capture-fase + stopImmediatePropagation, net als bij het
    // canvas: anders kan een globale Escape-sneltoets er eerst tussen komen.
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      justDraggedRef.current = true;
      armJustDraggedClear();
      setDragState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragState, moveTaskTo, moveTasksTo, selectedTaskIds, justDraggedRef, armJustDraggedClear]);

  return {
    startRowDrag: setCandidate,
    dragState,
    active: !!candidate || !!dragState,
  };
}

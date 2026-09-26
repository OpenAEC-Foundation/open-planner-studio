// Verticaal rijen slepen in het DOM-taakraster. Aangeroepen door
// `TaskGridSurface` in `task-grid/FullTaskGrid.tsx`, dus zowel op de Tabel-tab (`FullTaskGrid`) als
// in de takenlijst links van de Gantt (`GanttTaskGrid`). Het canvas heeft geen eigen rijsleep: een
// verticale balkbody-sleep draagt zijn kandidaat via `ganttRowDragBridge` aan déze hook over.
// Twee fasen (kandidaat → gepromoveerde sleep), drempel `ROW_DRAG_THRESHOLD` (geïmporteerd, niet
// gedupliceerd), zone-verdeling 25 / 50 / 25, en muteren gebeurt UITSLUITEND op mouseup, dus één
// sleep = één undo-stap.
//
// De droplogica zelf zit in `resolveDropTarget` (`@/engine/view/dropTarget`) en wordt hier alleen
// aangeroepen; die blijft de enige autoriteit over waar een gesleepte taak landt.
//
// De rij-MEETING gaat via het DOM: `document.elementFromPoint` + `getBoundingClientRect` op de
// rij-elementen (die daarvoor een `data-ops-row-index`-attribuut dragen, gezet in `DataGridCore`).

import { RefObject, useCallback, useEffect, useRef, useState } from 'react';
import type { ViewRow } from '@/engine/view/visibleRows';
import type { Task } from '@/types/task';
import { resolveDropTarget, type DropTarget } from '@/engine/view/dropTarget';
import { shouldPromoteToRowDrag } from '@/engine/taskGrid/rowDragIntent';
import { ROW_DRAG_THRESHOLD } from '@/components/canvas/hooks/constants';
import { useLatestRef } from '@/hooks/useLatestRef';
import { listenWindowDrag } from '@/hooks/listenWindowDrag';

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
  /** De huidige selectie. Sleep je een rij die daar deel van uitmaakt
   *  én telt de selectie meer dan één taak, dan verhuist de HELE groep (`moveTasksTo`). Sleep je
   *  een niet-geselecteerde rij, dan verhuist alleen die rij en blijft de selectie elders met rust
   *  — het gedrag dat men uit MS Project en de bestandsverkenner kent. */
  selectedTaskIds: string[];
  moveTasksTo: (ids: string[], target: DropTarget) => void;
  /** = `isTreeMode(view)`. Wordt door de AANROEPER bepaald (`TaskGridSurface`), niet door deze hook. */
  enabled: boolean;
  /** Aangeroepen wanneer er écht gesleept wordt (drempel gehaald) terwijl `enabled` false is —
   *  zo krijgt de gebruiker de uitleg te zien bij een echte poging, niet bij elke klik. */
  onBlocked?: () => void;
  /** Gedeelde vlag met de click-handler: onderdrukt de eerstvolgende click ná een rijsleep. */
  justDraggedRef: RefObject<boolean>;
  /** Het grid-element zelf. Staat de pointer NIET boven een rij (bv. boven het Gantt-canvas naast
   *  het grid, bij een overgedragen balkbody-sleep — zie `ganttRowDragBridge`), dan wordt de rij op
   *  dezelfde HOOGTE binnen dit element gezocht. Rijen in grid en canvas delen hun verticale
   *  positie, dus dat is exact de rij waar de balk visueel overheen hangt. Zonder ref: alleen
   *  rijen recht onder de pointer. */
  probeRootRef?: RefObject<HTMLElement | null>;
}

/** Terugval voor een pointer die niet boven een rij staat: zoek binnen `root` de rij die deze
 *  hoogte beslaat.
 *
 *  Uitsluitend op Y, en zonder `elementFromPoint`: een prik op een vaste X hangt af van wat daar
 *  toevallig ligt (in RTL landt hij op `.gantt-workspace-splitter`). De rijen dragen hun index al
 *  als attribuut, dus er valt niets te raden — dit is ook immuun voor overlays en portals boven
 *  het grid.
 *
 *  Buiten de verticale band van het grid, boven de kop of onder de laatste rij beslaat geen enkele
 *  rij deze hoogte, dus blijft het antwoord "geen rij". */
function probeRowInRoot(root: HTMLElement | null, clientY: number): Element | null {
  if (!root) return null;
  const rect = root.getBoundingClientRect();
  if (clientY < rect.top || clientY > rect.bottom) return null;
  for (const row of root.querySelectorAll('[data-ops-row-index]')) {
    const rowRect = row.getBoundingClientRect();
    if (clientY >= rowRect.top && clientY < rowRect.bottom) return row;
  }
  return null;
}

export function useTableRowDrag({ rows, tasksById, moveTaskTo, selectedTaskIds, moveTasksTo, enabled, onBlocked, justDraggedRef, probeRootRef }: UseTableRowDragOptions) {
  const [candidate, setCandidate] = useState<TableRowDragCandidate | null>(null);
  const [dragState, setDragState] = useState<TableRowDragState | null>(null);
  const optionsRef = useLatestRef({
    rows,
    tasksById,
    moveTaskTo,
    selectedTaskIds,
    moveTasksTo,
    enabled,
    onBlocked,
    justDraggedRef,
    probeRootRef,
  });
  const candidateRef = useLatestRef(candidate);
  const dragStateRef = useLatestRef(dragState);
  const candidateActive = candidate !== null;
  const dragActive = dragState !== null;
  // Buiten de effecten gehouden (zie `armJustDraggedClear`) zodat de opruimer óók bij UNMOUNT
  // bereikbaar is en niet meelift op de cleanup van de sleep-effect (die loopt al bij elke
  // dragState-wijziging, dus óók direct ná de drop — dan mogen de listeners juist blijven staan).
  const justDraggedClearRef = useRef<(() => void) | null>(null);

  /** Meet de rij onder de cursor via het DOM en vertaalt hem naar rijindex + zone + droptarget.
   *  Geen rij-element onder de cursor (of een groepsrij, die het attribuut niet draagt) ⇒ null. */
  const computeHover = useCallback((
    clientX: number,
    clientY: number,
    draggedTaskId: string,
  ): { rowIndex: number; zone: 'before' | 'after' | 'nest'; target: DropTarget | null } | null => {
    const current = optionsRef.current;
    const el = document.elementFromPoint(clientX, clientY)?.closest('[data-ops-row-index]')
      ?? probeRowInRoot(current.probeRootRef?.current ?? null, clientY);
    if (!el) return null;
    const rowIndex = Number(el.getAttribute('data-ops-row-index'));
    if (!Number.isFinite(rowIndex)) return null; // kapot/afwezig attribuut ⇒ als "niet gevonden"
    const rect = el.getBoundingClientRect();
    // 25/50/25-verdeling. Een overgedragen balkbody-sleep (`ganttRowDragBridge`) loopt ook hierdoor,
    // dus tabel en canvas reageren identiek op dezelfde verticale positie binnen een rij.
    const frac = rect.height > 0 ? (clientY - rect.top) / rect.height : 0.5;
    let zone: 'before' | 'after' | 'nest' = frac < 0.25 ? 'before' : frac > 0.75 ? 'after' : 'nest';
    // draggedTaskId gaat mee zodat de resolver compenseert voor de remove-dan-insert-verschuiving
    // bij herordenen binnen dezelfde ouder.
    let target = resolveDropTarget(current.rows, rowIndex, zone, current.tasksById, draggedTaskId);
    // Nestelen kan alleen op een summary; op een gewone taak geeft de middelste 50% van de rij dus
    // GEEN doel (de indicator zou over de halve rijhoogte wegvallen). Val in dat geval terug op de
    // dichtstbijzijnde rand-zone, en geef
    // die zone óók terug — zone en doel komen zo uit dezelfde berekening en de indicator kan niet
    // iets anders tonen dan waar de taak landt. `resolveDropTarget` blijft de enige autoriteit.
    if (zone === 'nest' && target === null) {
      zone = frac < 0.5 ? 'before' : 'after';
      target = resolveDropTarget(current.rows, rowIndex, zone, current.tasksById, draggedTaskId);
    }
    return { rowIndex, zone, target };
  }, [optionsRef]);

  // Kandidaatfase: pas bij |dy| >= drempel ÉN een overwegend verticale beweging promoveren tot een
  // echte sleep. De canvas-kant mag zuiver op |dy| gaan (mousedown begint daar in de rijgutter, niet
  // op selecteerbare tekst); hier begint mousedown middenin een celwaarde, dus zonder de
  // asintentie-check van `shouldPromoteToRowDrag` promoveert een horizontale tekstselectie met wat
  // verticale muisruis onterecht tot een rijsleep.
  useEffect(() => {
    if (!candidateActive) return;

    const handleMouseMove = (e: MouseEvent) => {
      const currentCandidate = candidateRef.current;
      if (!currentCandidate) return;
      const dy = e.clientY - currentCandidate.startClientY;
      const dx = e.clientX - currentCandidate.startClientX;
      if (!shouldPromoteToRowDrag(dx, dy, ROW_DRAG_THRESHOLD)) return;
      setCandidate(null);
      // Vangnet bij het promoveren tot een echte sleep: is er tóch al een tekstselectie over de
      // rijen ontstaan (de `user-select: none` op de rijen komt pas na de render van de
      // kandidaatfase), wis die dan — anders sleep je met een half blauwgeverfde tabel.
      document.getSelection()?.removeAllRanges();
      const currentOptions = optionsRef.current;
      if (!currentOptions.enabled) {
        // Buiten pure boommodus is de structuur op slot: uitleggen en verder niets doen.
        currentOptions.onBlocked?.();
        return;
      }
      const hover = computeHover(e.clientX, e.clientY, currentCandidate.taskId);
      setDragState({
        taskId: currentCandidate.taskId,
        hoverRowIndex: hover?.rowIndex ?? null,
        hoverZone: hover?.zone ?? null,
        dropTarget: hover?.target ?? null,
      });
    };

    const handleMouseUp = () => setCandidate(null);

    return listenWindowDrag({ onMove: handleMouseMove, onUp: handleMouseUp });
  }, [candidateActive, candidateRef, optionsRef, computeHover]);

  // Opruimen van de "net-gesleept"-vlag, met een EXTRA vangnet dat een canvas niet nodig zou
  // hebben: een canvas is één blijvend element, dus daar volgt na de mouseup altijd een click.
  // In de DOM-tabel niet — begon de sleep op rij A en eindigt hij op rij B, dan herrendert de drop
  // de rijen en is het mouseup-doel losgekoppeld, waardoor Chromium HELEMAAL geen click meer
  // stuurt. De vlag zou dan blijven staan en de eerstvolgende echte klik
  // inslikken. Daarom wissen we óók bij de eerstvolgende mousedown:
  // die markeert onmiskenbaar een nieuwe interactie, en komt altijd vóór de bijbehorende click.
  // De click-listener blijft in de BUBBLE-fase, zodat de rij-onClick de vlag nog ziet en de
  // sleep-afsluitende klik wél onderdrukt wordt.
  const armJustDraggedClear = useCallback((): void => {
    const clear = () => {
      optionsRef.current.justDraggedRef.current = false;
      window.removeEventListener('click', clear);
      window.removeEventListener('mousedown', clear);
      justDraggedClearRef.current = null;
    };
    justDraggedClearRef.current = clear;
    window.addEventListener('click', clear);
    window.addEventListener('mousedown', clear);
  }, [optionsRef]);

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
    if (!dragActive) return;

    const handleMouseMove = (e: MouseEvent) => {
      const current = dragStateRef.current;
      if (!current) return;
      const hover = computeHover(e.clientX, e.clientY, current.taskId);
      setDragState(prev => prev ? {
        ...prev,
        hoverRowIndex: hover?.rowIndex ?? null,
        hoverZone: hover?.zone ?? null,
        dropTarget: hover?.target ?? null,
      } : null);
    };

    const handleMouseUp = () => {
      const current = dragStateRef.current;
      const options = optionsRef.current;
      if (current?.dropTarget) {
        // Onderdeel van een meervoudige selectie ⇒ de hele groep mee; anders alleen deze rij.
        // `moveTasksTo` doet de groep in één undo-stap.
        const groepssleep = options.selectedTaskIds.length > 1
          && options.selectedTaskIds.includes(current.taskId);
        if (groepssleep) options.moveTasksTo(options.selectedTaskIds, current.dropTarget);
        else options.moveTaskTo(current.taskId, current.dropTarget);
      }
      // Geen geldig doel ⇒ stille no-op; de store-actie guardt cykels zelf ook nog eens.
      options.justDraggedRef.current = true;
      armJustDraggedClear();
      setDragState(null);
    };

    // Escape annuleert ZONDER mutatie. Capture-fase + stopImmediatePropagation, net als bij het
    // canvas: anders kan een globale Escape-sneltoets er eerst tussen komen.
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      optionsRef.current.justDraggedRef.current = true;
      armJustDraggedClear();
      setDragState(null);
    };

    return listenWindowDrag({ onMove: handleMouseMove, onUp: handleMouseUp, onKeyDown: handleKeyDown, keyCapture: true });
  }, [dragActive, dragStateRef, optionsRef, computeHover, armJustDraggedClear]);

  return {
    startRowDrag: setCandidate,
    dragState,
    active: !!candidate || !!dragState,
  };
}

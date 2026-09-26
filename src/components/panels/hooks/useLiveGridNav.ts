import { useCallback, useRef, type KeyboardEvent } from 'react';
import {
  controlKindOf, isLastGridRow, liveGridNavDirection, neighbourGridCell, scrollDeltaToReveal,
} from '@/utils/gridNavigation';

/**
 * Toetsenbordnavigatie voor een **live raster**: een `<table>` waarin elke cel al een echt
 * invoerveld/`<select>` is (de resourcetabel, issue #48). De cursor is daar de DOM-focus, niet
 * React-state — verzetten betekent dus `focus()` op het besturingselement van de buurcel.
 *
 * Waarom niet de navigatie van het taakraster hergebruiken: dat kent maar één editor tegelijk,
 * houdt zijn cursor als React-state bij en heeft een eigen toetsbeleid (`resolveTaskGridCommand` in
 * `engine/taskGrid/navigation.ts`). De rekensom en het toetsbeleid voor live rasters staan in
 * `@/utils/gridNavigation`. Zie de kop van dat bestand.
 *
 * Bedrading in de tabel:
 * - de scroll-container krijgt `ref={gridRef}`;
 * - elke rij krijgt `{...rowProps(rowId)}`;
 * - elk besturingselement krijgt `{...cellProps(rowId, field)}`.
 *
 * Cellen zonder (bruikbaar) besturingselement — geërfde/bibliotheek-velden renderen als platte
 * tekst, de eenheid-kolom is `disabled` op niet-materiaal — worden bij het navigeren OVERGESLAGEN,
 * in dezelfde richting doorlopend.
 */
export function useLiveGridNav<F extends string>({ rowIds, fields, onAppendRow }: {
  /** Rij-id's in weergavevolgorde. Een concept-rij hoort hier gewoon in (als laatste). */
  rowIds: readonly string[];
  /** Kolomsleutels in weergavevolgorde. */
  fields: readonly F[];
  /**
   * Enter/↓ op de laatste rij: maak een nieuwe rij. `true` = er is er een gemaakt (de aanroeper
   * regelt zelf de focus, want de rij bestaat pas ná de volgende render).
   */
  onAppendRow?: () => boolean;
}) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  /** Focus die pas ná de volgende render kan landen (nieuwe rij, net gecommitte concept-rij). */
  const pendingFocus = useRef<{ rowId: string; field: F } | null>(null);

  const cellElement = useCallback((rowId: string, field: F): HTMLElement | null => {
    const root = gridRef.current;
    if (!root) return null;
    const sel = `[data-ops-grid-cell="${cssEscape(rowId)}:${cssEscape(field)}"]`;
    const el = root.querySelector<HTMLElement>(sel);
    if (!el) return null;
    if ((el as HTMLInputElement).disabled) return null;
    return el;
  }, []);

  /**
   * Scroll de RIJ van dit element volledig in beeld. Expliciet, want `focus()` scrolt alleen mee
   * wanneer de focus echt verspringt — en bij doorlopend invoeren met Enter blijft de cursor in
   * hetzelfde naamveld staan (zie `scrollDeltaToReveal`). De rij i.p.v. de cel, zodat je de hele
   * regel ziet waarin je typt.
   */
  const revealElement = useCallback((el: HTMLElement) => {
    const root = gridRef.current;
    if (!root) return;
    const row: HTMLElement = el.closest('tr') ?? el;
    const head = root.querySelector('thead');
    const delta = scrollDeltaToReveal(
      root.getBoundingClientRect(),
      row.getBoundingClientRect(),
      head ? head.getBoundingClientRect().height : 0,
    );
    if (delta !== 0) root.scrollTop += delta;
  }, []);

  /** Breng de rij van deze cel in beeld zonder de focus te verzetten. */
  const revealCell = useCallback((rowId: string, field: F): boolean => {
    const el = cellElement(rowId, field);
    if (!el) return false;
    revealElement(el);
    return true;
  }, [cellElement, revealElement]);

  /** Zet de focus op precies deze cel. `false` = die cel heeft geen bruikbaar element. */
  const focusCell = useCallback((rowId: string, field: F): boolean => {
    const el = cellElement(rowId, field);
    if (!el) return false;
    // preventScroll + eigen scroll: de impliciete scroll van `focus()` blijft weg zodra de focus
    // niet verspringt, en dat is precies het geval waarin de rij uit beeld zakt.
    el.focus({ preventScroll: true });
    revealElement(el);
    // Spreadsheet-gedrag, gelijk aan de takentabel (`selectAll` bij klik/F2): wie met het
    // toetsenbord op een cel landt en begint te typen vervangt de waarde.
    if (el instanceof HTMLInputElement && el.type !== 'number') el.select();
    return true;
  }, [cellElement, revealElement]);

  /**
   * Focus die pas kan landen na de volgende render. Wordt afgehandeld door `flushPendingFocus`,
   * die de tabel na elke relevante statuswijziging aanroept (zie `ResourcePanel`).
   */
  const requestFocus = useCallback((rowId: string, field: F) => {
    pendingFocus.current = { rowId, field };
  }, []);

  const flushPendingFocus = useCallback(() => {
    const want = pendingFocus.current;
    if (!want) return;
    pendingFocus.current = null;
    focusCell(want.rowId, want.field);
  }, [focusCell]);

  /** Verplaats de focus; sla cellen zonder bruikbaar element over. */
  const move = useCallback((rowId: string, field: F, direction: 'up' | 'down'): boolean => {
    let cur = { rowId, field };
    for (let guard = 0; guard <= rowIds.length; guard++) {
      const next = neighbourGridCell(rowIds, fields, cur, direction);
      if (!next) break;
      if (focusCell(next.rowId, next.field)) return true;
      cur = next;
    }
    if (direction === 'down' && isLastGridRow(rowIds, rowId) && onAppendRow) return onAppendRow();
    return false;
  }, [rowIds, fields, focusCell, onAppendRow]);

  /** Bind dit op elk besturingselement in het raster. */
  const cellProps = useCallback((rowId: string, field: F) => ({
    'data-ops-grid-cell': `${rowId}:${field}`,
    onKeyDown: (e: KeyboardEvent) => {
      const target = e.target as HTMLElement & { type?: string };
      const direction = liveGridNavDirection(e, controlKindOf(target));
      if (!direction) return;
      e.preventDefault();
      // De globale sneltoetsen laten een INPUT/SELECT met rust (`isTypingTarget`), maar dat is een
      // afspraak elders — hier vangen we de toets zelf af, dus houden we hem ook zelf binnen.
      e.stopPropagation();
      move(rowId, field, direction);
    },
  }), [move]);

  const rowProps = useCallback((rowId: string) => ({ 'data-ops-grid-row': rowId }), []);

  return { gridRef, cellProps, rowProps, focusCell, revealCell, requestFocus, flushPendingFocus, move };
}

/**
 * `CSS.escape` is er in elke browser die deze app draait, maar niet in de headless testomgeving en
 * niet in oudere jsdom-versies — vandaar de terugval. Id's zijn hier `res-<base36>`/`__draft`, dus
 * de terugval hoeft alleen de aanhalingstekens en backslashes te ontlopen.
 */
function cssEscape(value: string): string {
  const g = globalThis as { CSS?: { escape?: (v: string) => string } };
  if (typeof g.CSS?.escape === 'function') return g.CSS.escape(value);
  return value.replace(/["\\]/g, '\\$&');
}

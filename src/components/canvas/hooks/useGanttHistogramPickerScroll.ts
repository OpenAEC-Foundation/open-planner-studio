import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import {
  histogramPickerMaxScroll,
  histogramPickerRowHeight,
  histogramPickerVisibleRows,
} from '@/engine/renderer/HistogramRenderer';

interface GanttHistogramPickerScrollInput {
  /** De container-div rond het histogramcanvas (`histogramContainerRef` uit de viewport-
   *  coördinator) — de wielscroll wordt hier native op geluisterd (React's `onWheel` is passive,
   *  `preventDefault` moet hier juist wél kunnen). */
  containerRef: RefObject<HTMLDivElement | null>;
  /** De container-div bestaat alleen in de DOM zolang de strook getoond wordt (`ui.showHistogram`,
   *  achter een portal in `GanttCanvas`) — zonder dit signaal zou de wheel-listener zich nooit
   *  opnieuw hechten wanneer de strook pas ná deze hook z'n eerste mount wordt aangezet. */
  enabled: boolean;
  /** Breedte van uitsluitend de kiezerzone — wielscroll telt alleen mee links van deze grens. */
  pickerWidth: number;
  /** Hoogte van de histogramstrook (== canvasHeight van de renderer). */
  canvasHeight: number;
  /** Lengte van de VOLLEDIGE pickerlijst, inclusief de gepinde "alle resources"-rij op index 0. */
  itemCount: number;
  /** Zelfde volgorde/id's als `buildHistogramPicker`, voor de reveal-logica (punt 4). */
  pickerIds: (string | undefined)[];
  selectedResourceId: string | undefined;
  fontScale: number;
}

interface GanttHistogramPickerScrollOutput {
  /** Sessiestate — NIET gepersisteerd, NIET in de undo-snapshot of het documentcontract: puur
   *  render-/interactiestate van deze ene strook. Al afgeklemd op `[0, maxScroll]`. */
  pickerScrollY: number;
}

/**
 * Bezit de verticale scrollpositie van de histogram-resourcekiezer (R2a). De kiezerlijst deelt het
 * canvas met de dagplot rechts ervan, dus "wielscroll boven de lijst" wordt hier onderscheiden van
 * de rest van de strook via de X-positie van het wielevent — niet via een apart DOM-element, want
 * de lijst zelf is getekend, niet een echte scrollbare lijstbox.
 */
export function useGanttHistogramPickerScroll(
  input: GanttHistogramPickerScrollInput,
): GanttHistogramPickerScrollOutput {
  const [pickerScrollY, setPickerScrollY] = useState(0);
  const latest = useRef(input);
  latest.current = input;

  // Klemmen bij elke wijziging die het scrollbare bereik kan verkleinen (minder resources, een
  // smallere/lagere strook, of een grotere interface-tekstschaal) — anders blijft een oude
  // scrollpositie voorbij het nieuwe einde staan en toont de lijst een leeg gat.
  useEffect(() => {
    const max = histogramPickerMaxScroll(input.itemCount, input.canvasHeight, input.fontScale);
    setPickerScrollY(current => Math.min(current, max));
  }, [input.itemCount, input.canvasHeight, input.fontScale]);

  // Wielscroll boven de kiezerzone scrolt de lijst i.p.v. de Gantt erboven. De Gantt-viewport-
  // coördinator bedient alleen de primaire/secundaire pane (`useGanttViewportCoordinator`) — deze
  // strook had vóór R2a helemaal geen wheel-eigenaar, dus dit is puur additief: buiten de kiezerzone
  // (boven de dagplot) gebeurt nog steeds niets, exact zoals voorheen.
  useEffect(() => {
    if (!input.enabled) return;
    const container = latest.current.containerRef.current;
    if (!container) return;
    const handleWheel = (event: WheelEvent) => {
      const current = latest.current;
      const rect = container.getBoundingClientRect();
      const x = event.clientX - rect.left;
      if (x >= current.pickerWidth) return;
      const max = histogramPickerMaxScroll(current.itemCount, current.canvasHeight, current.fontScale);
      if (max <= 0) return;
      event.preventDefault();
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      setPickerScrollY(prev => Math.min(max, Math.max(0, prev + delta)));
    };
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [input.containerRef, input.enabled]);

  // Punt 4: een van buiten (waarschuwingenpaneel, resourcepaneel) gekozen resource die buiten beeld
  // ligt, scrollt de lijst zodat hij zichtbaar wordt. Reageert uitsluitend op een ECHTE
  // selectiewissel — niet op elke render — zodat een handmatige scrollpositie van de gebruiker niet
  // steeds wordt teruggedrukt zolang de selectie ongewijzigd blijft.
  useEffect(() => {
    const current = latest.current;
    const idx = current.pickerIds.indexOf(current.selectedResourceId);
    if (idx <= 0) return; // gepinde rij (idx 0, altijd zichtbaar) of niet gevonden
    const scrollIdx = idx - 1; // index binnen het scrollbare deel (exclusief de gepinde rij)
    const rowH = histogramPickerRowHeight(current.fontScale);
    const rowTop = scrollIdx * rowH;
    const rowBottom = rowTop + rowH;
    const visibleHeight = histogramPickerVisibleRows(current.canvasHeight, current.fontScale) * rowH;
    setPickerScrollY(prev => {
      if (rowTop < prev) return rowTop;
      if (rowBottom > prev + visibleHeight) return Math.max(0, rowBottom - visibleHeight);
      return prev;
    });
    // Bewust alleen op de selectiewissel reageren; `pickerIds`/`canvasHeight`/`fontScale` komen via
    // `latest.current` mee zonder de reveal opnieuw te forceren bij een render die de selectie niet
    // verandert (`react-hooks/exhaustive-deps` ziet de `.current`-lezingen niet als afhankelijkheid).
  }, [input.selectedResourceId]);

  return { pickerScrollY };
}

import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { flushSync } from 'react-dom';

/**
 * De statusbalk is altijd één rij hoog; deze hook zoekt de laagste vouwstand waarin alles past. De
 * meting is de echte DOM, dus taal, tekstschaal en lettertype tellen vanzelf mee. Verandert de breedte
 * of `contentKey`, dan begint de zoektocht weer bij 0. Alles gebeurt vóór het tekenen: zolang de balk
 * overloopt zet de layout-effect de volgende stand, dus geen tussenstand komt in beeld. `liveText`
 * verandert vaak (de zoomtekst, bij elk wieltje): die meet alleen opnieuw en begint niet bij 0.
 */
export function useStatusFold(
  barRef: RefObject<HTMLElement | null>,
  maxLevel: number,
  contentKey: string,
  liveText: string,
): number {
  const [level, setLevel] = useState(0);
  const [measureRound, setMeasureRound] = useState(0);
  const lastKey = useRef('');
  const key = `${measureRound}|${contentKey}`;

  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    if (lastKey.current !== key) {
      lastKey.current = key;
      if (level > 0) {
        setLevel(0);
        return;
      }
    }
    if (level < maxLevel && bar.scrollWidth > bar.clientWidth) setLevel(level + 1);
  }, [barRef, key, level, maxLevel, liveText]);

  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar || typeof ResizeObserver === 'undefined') return;
    let width = -1;
    const observer = new ResizeObserver(() => {
      if (bar.clientWidth === width) return;
      width = bar.clientWidth;
      // Binnen dezelfde frame opnieuw vouwen, anders staat er één frame overloop in beeld.
      flushSync(() => setMeasureRound(round => round + 1));
    });
    observer.observe(bar);
    // Het lettertype komt later binnen dan de eerste meting en verandert de breedtes.
    void document.fonts?.ready.then(() => setMeasureRound(round => round + 1));
    return () => observer.disconnect();
  }, [barRef]);

  return level;
}

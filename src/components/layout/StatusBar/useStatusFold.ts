import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { flushSync } from 'react-dom';

/**
 * De statusbalk is altijd één rij hoog; deze hook zoekt de laagste vouwstand waarin alles past. De
 * meting is de echte DOM, dus taal, tekstschaal en lettertype tellen mee. Verandert de breedte, de
 * `contentKey`, de stijl van `<html>` (tekstgrootte en lettertype) of laadt er een lettertype, dan
 * begint de zoektocht weer bij 0. Alles gebeurt vóór het tekenen: zolang de balk
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
    // Tekstgrootte en lettertype zet App als CSS-variabelen op <html>, ná deze meting en zonder dat de
    // balk breder of smaller wordt. De callback komt vóór het tekenen, dus geen frame overloop.
    const styleObserver = new MutationObserver(() => flushSync(() => setMeasureRound(round => round + 1)));
    styleObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
    // Een lettertype komt later binnen dan de eerste meting en verandert de breedtes.
    const remeasure = () => setMeasureRound(round => round + 1);
    void document.fonts?.ready.then(remeasure);
    document.fonts?.addEventListener?.('loadingdone', remeasure);
    return () => {
      observer.disconnect();
      styleObserver.disconnect();
      document.fonts?.removeEventListener?.('loadingdone', remeasure);
    };
  }, [barRef]);

  return level;
}

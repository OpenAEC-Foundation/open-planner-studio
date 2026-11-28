import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { flushSync } from 'react-dom';

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
      flushSync(() => setMeasureRound(round => round + 1));
    });
    observer.observe(bar);
    const styleObserver = new MutationObserver(() => flushSync(() => setMeasureRound(round => round + 1)));
    styleObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
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

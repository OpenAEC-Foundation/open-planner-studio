import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './Tooltip.css';

/**
 * Globale non-native tooltip. Eén host (in App.tsx gemount) onderschept via event-delegatie ELK
 * element met een `title`-attribuut: de native browser-tooltip wordt onderdrukt (het `title` wordt
 * tijdens de hover tijdelijk weggehaald en bij vertrek teruggezet) en in plaats daarvan verschijnt
 * na een korte vertraging het thema-bewuste `.ops-tooltip`-bubbeltje. Zo krijgt élke bestaande
 * `title=` in de app automatisch dezelfde tooltip — zonder per knop iets te bedraden.
 *
 * Het bubbeltje gaat via een portal naar `document.body` (net als {@link Popover}) zodat overflow-
 * clips (bv. de ribbon-strook) het niet afsnijden; de horizontale positie wordt binnen de viewport
 * geklemd.
 */
const DELAY_MS = 400;

interface TipState { text: string; x: number; y: number; }

export function TooltipHost() {
  const [tip, setTip] = useState<TipState | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const activeEl = useRef<HTMLElement | null>(null);
  const stashed = useRef<string | null>(null);

  useEffect(() => {
    // Zet het weggehaalde `title` terug op het element waar we het van leenden.
    const restore = () => {
      if (activeEl.current && stashed.current !== null) {
        activeEl.current.setAttribute('title', stashed.current);
      }
      activeEl.current = null;
      stashed.current = null;
    };
    const dismiss = () => {
      if (timer.current) clearTimeout(timer.current);
      restore();
      setTip(null);
    };
    // Dichtstbijzijnde voorouder (incl. het element zelf) met een niet-leeg `title`.
    const titledAncestor = (start: EventTarget | null): HTMLElement | null => {
      let el = start as HTMLElement | null;
      while (el && el !== document.body && el.nodeType === 1) {
        const t = el.getAttribute?.('title');
        if (t) return el;
        el = el.parentElement;
      }
      return null;
    };
    // Een `title` die pas bij binnenkomst van de muis wordt gezet (de taakgrid meet dan pas of een
    // cel afknipt, issue #89) bestaat nog niet op het moment dat deze capture-listener loopt: React
    // verwerkt zijn mouseenter-state ná ons. Kijk daarom bij een leeg resultaat één keer opnieuw
    // zodra die update is doorgevoerd; blijft het leeg, dan is er gewoon niets te tonen.
    let retryTarget: EventTarget | null = null;
    const onOver = (e: MouseEvent, retried = false) => {
      const el = titledAncestor(e.target);
      if (!el && !retried) {
        retryTarget = e.target;
        setTimeout(() => {
          if (retryTarget === e.target) onOver(e, true);
        }, 0);
        return;
      }
      if (!el || el === activeEl.current) return;
      dismiss();
      const text = el.getAttribute('title');
      if (!text) return;
      activeEl.current = el;
      stashed.current = text;
      el.removeAttribute('title'); // onderdrukt de native tooltip
      timer.current = setTimeout(() => {
        const r = el.getBoundingClientRect();
        setTip({ text, x: r.left + r.width / 2, y: r.bottom + 6 });
      }, DELAY_MS);
    };
    const onOut = (e: MouseEvent) => {
      if (!activeEl.current) return;
      const to = e.relatedTarget as Node | null;
      if (to && activeEl.current.contains(to)) return; // nog binnen het actieve element
      dismiss();
    };

    const onOverEvent = (e: MouseEvent) => { retryTarget = null; onOver(e); };
    document.addEventListener('mouseover', onOverEvent, true);
    document.addEventListener('mouseout', onOut, true);
    document.addEventListener('mousedown', dismiss, true);
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('blur', dismiss);
    return () => {
      document.removeEventListener('mouseover', onOverEvent, true);
      document.removeEventListener('mouseout', onOut, true);
      document.removeEventListener('mousedown', dismiss, true);
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('blur', dismiss);
      dismiss();
    };
  }, []);

  // Horizontaal binnen de viewport houden (triggers vlak bij de rand).
  useLayoutEffect(() => {
    if (!tip || !bubbleRef.current) return;
    const half = bubbleRef.current.offsetWidth / 2;
    const cx = Math.max(half + 6, Math.min(tip.x, window.innerWidth - half - 6));
    bubbleRef.current.style.left = `${cx}px`;
  }, [tip]);

  if (!tip) return null;
  return createPortal(
    <div ref={bubbleRef} className="ops-tooltip" role="tooltip" style={{ left: tip.x, top: tip.y }}>
      {tip.text}
    </div>,
    document.body,
  );
}

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './Tooltip.css';

const DELAY_MS = 400;
const isInstant = (el: HTMLElement): boolean => el.hasAttribute('data-tooltip-instant');
const instantDelay = (el: HTMLElement): number => (isInstant(el) ? 0 : DELAY_MS);
const DESCRIPTION_ID = 'ops-tooltip-description';
const hasLead = (el: HTMLElement): boolean => el.hasAttribute('data-tooltip-lead');

function TipText({ text, lead }: { text: string; lead?: boolean }) {
  if (!lead || !text.includes('\n')) return <>{text}</>;
  const [first, ...rest] = text.split('\n');
  return (
    <>
      <strong className="ops-tooltip__lead">{first}</strong>
      {rest.map((line, i) => <span key={i} className="ops-tooltip__line">{line}</span>)}
    </>
  );
}

interface TipState { text: string; x: number; y: number; above: number; lead?: boolean; }

export function TooltipHost() {
  const [tip, setTip] = useState<TipState | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const activeEl = useRef<HTMLElement | null>(null);
  const stashed = useRef<string | null>(null);
  const descriptionRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const removal = new MutationObserver(() => {
      if (activeEl.current && !activeEl.current.isConnected) dismiss();
    });
    const titleWatch = new MutationObserver(() => {
      const el = activeEl.current;
      const next = el?.getAttribute('title');
      if (!el || !next) return;
      stashed.current = next;
      el.removeAttribute('title');
      if (el.getAttribute('aria-describedby') === DESCRIPTION_ID && descriptionRef.current) {
        descriptionRef.current.textContent = next;
      }
      setTip(prev => (prev ? { ...prev, text: next } : prev));
    });
    const restore = () => {
      removal.disconnect();
      titleWatch.disconnect();
      if (activeEl.current && stashed.current !== null && !activeEl.current.hasAttribute('title')) {
        activeEl.current.setAttribute('title', stashed.current);
      }
      if (activeEl.current?.getAttribute('aria-describedby') === DESCRIPTION_ID) {
        activeEl.current.removeAttribute('aria-describedby');
      }
      if (descriptionRef.current) descriptionRef.current.textContent = '';
      activeEl.current = null;
      stashed.current = null;
    };
    const dismiss = () => {
      if (timer.current) clearTimeout(timer.current);
      restore();
      setTip(null);
    };
    const titledAncestor = (start: EventTarget | null): HTMLElement | null => {
      let el = start as HTMLElement | null;
      while (el && el !== document.body && el.nodeType === 1) {
        const t = el.getAttribute?.('title');
        if (t) return el;
        el = el.parentElement;
      }
      return null;
    };
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
      if (focusTip()) return;
      show(el, instantDelay(el));
    };
    const focusTip = (): boolean => !!activeEl.current && isInstant(activeEl.current)
      && document.activeElement === activeEl.current;
    const show = (el: HTMLElement, delay: number) => {
      dismiss();
      const text = el.getAttribute('title');
      if (!text) return;
      activeEl.current = el;
      stashed.current = text;
      removal.observe(document.body, { childList: true, subtree: true });
      el.removeAttribute('title');
      titleWatch.observe(el, { attributes: true, attributeFilter: ['title'] });
      if (isInstant(el) && !el.hasAttribute('aria-describedby') && descriptionRef.current) {
        descriptionRef.current.textContent = text;
        el.setAttribute('aria-describedby', DESCRIPTION_ID);
      }
      timer.current = setTimeout(() => {
        const r = el.getBoundingClientRect();
        setTip({ text: stashed.current ?? text, x: r.left + r.width / 2, y: r.bottom + 6, above: r.top - 6, lead: hasLead(el)});
      }, delay);
    };
    const instantTarget = (target: EventTarget | null): HTMLElement | null => {
      const el = target instanceof Element ? target.closest<HTMLElement>('[data-tooltip-instant]') : null;
      return el && (el === activeEl.current || el.getAttribute('title')) ? el : null;
    };
    const onFocusIn = (e: FocusEvent) => {
      const el = instantTarget(e.target);
      if (el && el !== activeEl.current) show(el, 0);
    };
    const onFocusOut = (e: FocusEvent) => {
      if (!activeEl.current || !isInstant(activeEl.current)) return;
      const to = e.relatedTarget as Node | null;
      if (e.target === activeEl.current && !(to && activeEl.current.contains(to))) dismiss();
    };
    const onClick = (e: MouseEvent) => {
      const el = instantTarget(e.target);
      if (!el) return;
      if (el.closest('label')) e.preventDefault();
      if (el !== activeEl.current) show(el, 0);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !activeEl.current) return;
      if (!activeEl.current.isConnected) { dismiss(); return; }
      if (isInstant(activeEl.current)) { e.preventDefault(); e.stopPropagation(); }
      dismiss();
    };
    const onScroll = () => {
      const el = activeEl.current;
      if (el && isInstant(el) && stashed.current !== null && (document.activeElement === el || el.matches(':hover'))) {
        const r = el.getBoundingClientRect();
        setTip({ text: stashed.current, x: r.left + r.width / 2, y: r.bottom + 6, above: r.top - 6, lead: hasLead(el) });
        return;
      }
      dismiss();
    };
    const onOut = (e: MouseEvent) => {
      if (!activeEl.current || focusTip()) return;
      if (!(e.target instanceof Node) || !activeEl.current.contains(e.target)) return;
      const to = e.relatedTarget as Node | null;
      if (to && activeEl.current.contains(to)) return;
      dismiss();
    };

    const onOverEvent = (e: MouseEvent) => { retryTarget = null; onOver(e); };
    document.addEventListener('mouseover', onOverEvent, true);
    document.addEventListener('mouseout', onOut, true);
    document.addEventListener('mousedown', dismiss, true);
    document.addEventListener('focusin', onFocusIn, true);
    document.addEventListener('focusout', onFocusOut, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('blur', dismiss);
    return () => {
      document.removeEventListener('mouseover', onOverEvent, true);
      document.removeEventListener('mouseout', onOut, true);
      document.removeEventListener('mousedown', dismiss, true);
      document.removeEventListener('focusin', onFocusIn, true);
      document.removeEventListener('focusout', onFocusOut, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('blur', dismiss);
      dismiss();
    };
  }, []);

  useLayoutEffect(() => {
    if (!tip || !bubbleRef.current) return;
    const half = bubbleRef.current.offsetWidth / 2;
    const cx = Math.max(half + 6, Math.min(tip.x, window.innerWidth - half - 6));
    bubbleRef.current.style.left = `${cx}px`;
    const h = bubbleRef.current.offsetHeight;
    if (tip.y + h > window.innerHeight - 6 && tip.above - h >= 6) {
      bubbleRef.current.style.top = `${tip.above - h}px`;
    }
  }, [tip]);

  return createPortal(
    <>
      <span ref={descriptionRef} id={DESCRIPTION_ID} hidden />
      {tip && (
        <div ref={bubbleRef} className="ops-tooltip" role="tooltip" style={{ left: tip.x, top: tip.y }}>
          <TipText text={tip.text} lead={tip.lead} />
        </div>
      )}
    </>,
    document.body,
  );
}

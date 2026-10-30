// Issue #741: tijdelijke schakelaar tussen de varianten voor een baseline zonder kleur. Alleen op de
// dev-server (`?baselineStijl=vorm|patroon|label|kleur`, `&zw=1` voor een zwart-witbeeld); in een
// build is het altijd `kleur`. Verdwijnt zodra de eigenaar een variant kiest.
import { useSyncExternalStore } from 'react';
import { BASELINE_MARK_STYLES, type BaselineMarkStyle } from '@/engine/renderer/baselineStrip';

const params = () => new URLSearchParams(window.location.search);

const readStyle = (): BaselineMarkStyle => {
  if (!import.meta.env.DEV) return 'kleur';
  const v = params().get('baselineStijl');
  return (BASELINE_MARK_STYLES as readonly string[]).includes(v ?? '') ? v as BaselineMarkStyle : 'kleur';
};

let style: BaselineMarkStyle = readStyle();
let grayscale = import.meta.env.DEV && params().get('zw') === '1';
const listeners = new Set<() => void>();
let snapshot = { style, grayscale };

function applyGrayscale(): void {
  document.documentElement.style.filter = grayscale ? 'grayscale(1)' : '';
}
if (import.meta.env.DEV) applyGrayscale();

function publish(): void {
  snapshot = { style, grayscale };
  const p = params();
  p.set('baselineStijl', style);
  if (grayscale) p.set('zw', '1'); else p.delete('zw');
  window.history.replaceState(null, '', `${window.location.pathname}?${p.toString()}${window.location.hash}`);
  applyGrayscale();
  listeners.forEach(l => l());
}

export function setDevBaselineMarkStyle(next: BaselineMarkStyle): void {
  style = next;
  publish();
}

export function setDevGrayscale(next: boolean): void {
  grayscale = next;
  publish();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => { listeners.delete(l); };
};

/** De gekozen variant (`kleur` buiten de dev-server). */
export function useBaselineMarkStyle(): BaselineMarkStyle {
  return useSyncExternalStore(subscribe, () => snapshot.style);
}

export function useDevBaselineSwitch(): { style: BaselineMarkStyle; grayscale: boolean } {
  return useSyncExternalStore(subscribe, () => snapshot);
}


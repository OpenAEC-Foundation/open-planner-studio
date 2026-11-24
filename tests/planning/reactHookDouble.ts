// Een kleine React-dubbel voor één hook buiten React: `check-ifc-foreign-grens.ts` zet hem in de bundel in plaats van
// `react` en `react-i18next` in `src/hooks/useRecoveryRestore.ts`. Zo draait de proef de echte herstelactie (de
// callback `onRestore` van de herstelvraag) in plaats van een nagebouwde voorwaarde. Naar de proef van de reviewer van
// #1127 (ronde 3). `mount` draait de hook één keer met zijn effecten; `until` wacht tot een state-waarde er is.
import { EventEmitter, once } from 'node:events';

class Frame {
  readonly values: unknown[] = [];
  readonly effects: (() => void)[] = [];
  readonly changed = new EventEmitter();
  async until<T>(read: () => T | false): Promise<T> {
    const signal = AbortSignal.timeout(10_000);
    for (;;) {
      const result = read();
      if (result !== false) return result;
      await once(this.changed, 'changed', { signal });
    }
  }
}
let frame = new Frame();

export function mount(hook: () => unknown): Frame {
  frame = new Frame();
  hook();
  for (const effect of frame.effects) effect();
  return frame;
}

export const useRef = <T>(current: T) => ({ current });
export const useEffect = (effect: () => void) => { frame.effects.push(effect); };
export function useState<T>(initial: T): [T, (value: T) => void] {
  const active = frame;
  const index = active.values.push(initial) - 1;
  return [initial, (value) => {
    active.values[index] = value;
    active.changed.emit('changed');
  }];
}
export function useTranslation() {
  return { t: (key: string) => key };
}

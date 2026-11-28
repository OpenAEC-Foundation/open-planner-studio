import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { buildImportLabels } from '@/i18n/importLabels';
import { isTauri } from '@/utils/platform';
import { externalSourceWatchTargets, watchEventTouchesSource } from '@/engine/externalSourceWatch';

const WATCH_DELAY_MS = 1000;

export function useExternalSourceWatch(): void {
  const { t } = useTranslation('common');

  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let key = '';
    let files = new Set<string>();
    let stops: Array<() => void> = [];
    let generation = 0;

    const stopAll = () => {
      for (const stop of stops) stop();
      stops = [];
    };

    const watchDirs = async (dirs: string[]) => {
      const current = ++generation;
      stopAll();
      if (dirs.length === 0) return;
      const { watch } = await import('@tauri-apps/plugin-fs');
      for (const dir of dirs) {
        try {
          const stop = await watch(dir, (event) => {
            if (!watchEventTouchesSource(event, files)) return;
            void useAppStore.getState().checkExternalSources(buildImportLabels(t));
          }, { recursive: false, delayMs: WATCH_DELAY_MS });
          if (disposed || current !== generation) { stop(); return; }
          stops.push(stop);
        } catch (err) {
          console.warn('useExternalSourceWatch: kan de map niet bewaken, alleen het vangnet blijft:', dir, err);
        }
      }
    };

    const update = (tasks: ReturnType<typeof useAppStore.getState>['tasks']) => {
      const targets = externalSourceWatchTargets(tasks);
      if (targets.key === key) return;
      key = targets.key;
      files = targets.files;
      void watchDirs(targets.dirs);
    };

    update(useAppStore.getState().tasks);
    const unsubscribe = useAppStore.subscribe((state, previous) => {
      if (state.tasks !== previous.tasks) update(state.tasks);
    });
    return () => {
      disposed = true;
      generation++;
      unsubscribe();
      stopAll();
    };
  }, [t]);
}

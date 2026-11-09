import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { buildImportLabels } from '@/i18n/importLabels';
import { isTauri } from '@/utils/platform';
import { externalSourceWatchTargets, watchEventTouchesSource } from '@/engine/externalSourceWatch';

/** Wachttijd van de bewaking: een opslag geeft vaak een reeks meldingen, die tellen dan als één. */
const WATCH_DELAY_MS = 1000;

/**
 * Keuze 6 (Ethan, 2026-11-03; stap 1.6 en 7.2 in `docs/relaties-tussen-projecten.md`): in de desktop-app
 * bewaakt OPS de map van elk bronbestand van het actieve document (`watch` van `tauri-plugin-fs`). Verandert
 * een bronbestand, dan kijkt de app meteen (`checkExternalSources`), ook als het venster al actief is; een
 * nieuwe versie geeft dan de balk. Lukt de bewaking niet (een map buiten de toegestane plekken, een
 * netwerkschijf), dan blijft het vangnet van `useExternalSourceCheck`: bij openen en bij terugkeer naar het
 * venster. In de browser doet deze hook niets.
 *
 * De hook leest de store buiten React (`subscribe`): een bewerking van een taak laat de app niet opnieuw
 * renderen; alleen een andere set bronbestanden geeft een nieuwe bewaking.
 */
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
      // Per map een eigen bewaking: een map die niet lukt, houdt de andere niet tegen.
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

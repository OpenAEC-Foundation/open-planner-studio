import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { isActivePristine } from '@/state/slices/fileSlice';
import { buildImportLabels } from '@/i18n/importLabels';
import { isTauri } from '@/utils/platform';
import { DEMO_START_EXAMPLE } from '@/utils/buildFlags';
import { runsEmbedded } from '@/services/fileAccess/siteHost';
import type { RecoveryState } from './useRecoveryRestore';

interface ExampleEntry {
  file: string;
  name: string;
  category?: string;
}

export function useDemoStartExample(recoveryResolved: boolean, recovery: RecoveryState | null): void {
  const { t } = useTranslation('common');
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !recoveryResolved || recovery !== null) return;
    started.current = true;
    if (!DEMO_START_EXAMPLE || isTauri() || !import.meta.env.PROD || runsEmbedded()) return;
    if (!isActivePristine(useAppStore.getState())) return;

    void (async () => {
      try {
        const manifestRes = await fetch(`${import.meta.env.BASE_URL}examples/manifest.json`);
        if (!manifestRes.ok) throw new Error(`HTTP ${manifestRes.status}`);
        const { examples = [] } = (await manifestRes.json()) as { examples?: ExampleEntry[] };
        const example = examples.find(entry => entry.category === 'showcase');
        if (!example) return;

        const res = await fetch(`${import.meta.env.BASE_URL}examples/${example.file}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const content = await res.text();
        await useAppStore.getState().openExampleFromString(content, example.name, buildImportLabels(t));
      } catch (err) {
        console.error('[Demo-start] Voorbeeldplanning laden mislukt:', err);
      }
    })();
  }, [recoveryResolved, recovery, t]);
}

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

// Demo-start (issue #276): de live browserbouw opent met een voorbeeldplanning in plaats van een
// leeg document, zodat een bezoeker meteen iets ziet. Alleen de productiebouw van de browser: de
// dev-server, de browsertests en de desktop-app blijven leeg starten. Pas na de recovery-keuze, en
// alleen als het actieve document nog leeg is, zodat niets van de gebruiker wordt overschreven.
// De voorbeeldplanning is de eerste showcase uit het manifest (het instapvoorbeeld). Het document moet
// schoon blijven (`isDirty` onwaar), anders neemt de herstel-dialoog het over bij de volgende herlaad.
// De platformbouw (#310, `DEMO_START_EXAMPLE` uit) en elke host (#716) starten met een leeg document
// of het bestand van de host.
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
        // Demo-start blijft zonder bibliotheek-koppeling; alleen expliciet geopende showcase-
        // voorbeelden gebruiken `applyDemoLibraryToShowcaseProject`. De laadroute blijft schoon:
        // een document dat de bezoeker niet aanraakte is geen niet-opgeslagen gebruikerswerk.
        await useAppStore.getState().openExampleFromString(content, example.name, buildImportLabels(t));
      } catch (err) {
        console.error('[Demo-start] Voorbeeldplanning laden mislukt:', err);
      }
    })();
  }, [recoveryResolved, recovery, t]);
}

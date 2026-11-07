import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/icons';
import { useFileDrop } from '@/hooks/useFileDrop';

/**
 * Slepen en neerzetten (issue #771, keuze van Ethan op 7 november 2026: optie 1): tijdens het slepen
 * van een bestand boven het venster ligt er een laag over het hele venster, met in het midden
 * "Laat los om te openen" en daaronder "Projectbestand of import". Loslaten opent via de gewone
 * openroute (`useFileDrop` → `state/fileDrop.ts`).
 *
 * Eén keer gemount in `App.tsx`, buiten de `inert`-blokken en in beide vertakkingen (ook in de
 * presentatiemodus): zonder de luisteraars opent de browser een gesleept bestand zelf en verlaat hij
 * de app. De laag vangt de sleep-events zelf op (de kaart niet, zie `.file-drop-overlay`), zodat
 * geen onderdeel eronder de `drop` kan inslikken.
 */
export function FileDropOverlay() {
  const active = useFileDrop();
  const { t } = useTranslation('common');
  if (!active) return null;
  return (
    <div className="file-drop-overlay" data-ops-file-drop-overlay>
      <div className="file-drop-overlay-card">
        <Icon id="file.open" size={32} className="text-text-secondary" />
        <p className="text-heading font-semibold leading-6">{t('fileDrop.title')}</p>
        <p className="text-body leading-5 text-text-secondary">{t('fileDrop.subtitle')}</p>
      </div>
    </div>
  );
}

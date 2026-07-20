import { useCallback } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { saveRibbonCompact } from '@/utils/settingsStore';
import { RibbonTab } from '@/state/slices/types';
import { RibbonTabContent } from './RibbonTabContent';
import { ExtensionRibbonGroups } from './ribbonWidgets';
import './Ribbon.css';

/**
 * Ribbon-schil (audit P18): tabs-balk + generiek render-pad + inklap-toggle. De tab-inhoud is
 * volledig declaratief (RIBBON_TABS in ribbonConfig.tsx) en wordt door RibbonTabContent
 * gerenderd; complexe widgets zitten in ribbonWidgets.tsx. Deze schil abonneert alleen op
 * `activeRibbonTab` en `ribbonCompact` — de ~45 selectors uit de oude god-functie zijn naar de
 * afzonderlijke item-bindings/widgets verhuisd.
 */
export function Ribbon() {
  const { t: tMenu } = useTranslation('menu');
  const setUI = useAppStore(s => s.setUI);
  const ribbonCompact = useAppStore(s => s.ui.ribbonCompact);
  const activeTab = useAppStore(s => s.ui.activeRibbonTab);

  const setActiveTab = useCallback((tab: RibbonTab) => {
    setUI({ activeRibbonTab: tab });
  }, [setUI]);

  return (
    <div className={`ribbon-container${ribbonCompact ? ' compact' : ''}`}>
      {/* Tabs — 'file' is de speciale amber backstage-tab links.
          data-tour-anchor (fase 2.10, onderdeel 3, tourstap 1): altijd zichtbaar, ook tijdens
          Backstage, dus geen prepare() nodig voor deze stap. */}
      <div className="ribbon-tabs" data-tour-anchor="ribbon-tabs">
        <button
          key="file"
          className={`ribbon-tab ribbon-tab--file ${activeTab === 'file' ? 'active' : ''}`}
          onClick={() => setActiveTab('file')}
        >
          {tMenu('ribbon.file')}
        </button>
        {(['start', 'planning', 'resources', 'relations', 'beeld', 'instellingen', 'table', 'ifc', 'report'] as RibbonTab[]).map(tab => (
          <button
            key={tab}
            className={`ribbon-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tMenu(`ribbon.${tab === 'beeld' ? 'view' : tab === 'instellingen' ? 'settings' : tab}`)}
          </button>
        ))}
      </div>

      {/* Content — verborgen wanneer File-tab actief is (Backstage neemt de hele body over) */}
      {activeTab !== 'file' && (
      <div className="ribbon-content">
      <div className="ribbon-content-scroll">
        <RibbonTabContent tab={activeTab} />
        <ExtensionRibbonGroups tab={activeTab} />
      </div>
        {/* Compacte-modus-toggle rechtsonder (Word-web-stijl): ↑ = inklappen, ↓ = uitklappen.
            position:absolute (zie CSS) zodat de pijl een vaste plek in de hoek houdt en
            nooit kan worden dichtgeschoven/onklikbaar gemaakt door drukke tab-inhoud
            (QA-bevinding 2.6a) — onafhankelijk van de flex-flow van de groepen ernaast. */}
        <button
          className="ribbon-collapse-toggle"
          title={tMenu(ribbonCompact ? 'ribbon.expandRibbon' : 'ribbon.collapseRibbon')}
          aria-label={tMenu(ribbonCompact ? 'ribbon.expandRibbon' : 'ribbon.collapseRibbon')}
          onClick={() => {
            const next = !ribbonCompact;
            setUI({ ribbonCompact: next });
            void saveRibbonCompact(next);
          }}
        >
          {ribbonCompact ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>
      )}
    </div>
  );
}

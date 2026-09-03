import { Suspense, lazy, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Maximize2, PanelRightClose, X } from 'lucide-react';
import { useAppStore } from '@/state/appStore';
import { useSplitter } from '@/hooks/useSplitter';
import { TaskPropertiesPanel } from '@/components/panels/TaskPropertiesPanel';
import { ResourcePanelCompact } from '@/components/panels/ResourcePanelCompact';
import { WarningsPanel } from '@/components/panels/WarningsPanel';
import {
  RIGHT_PANEL_MIN_WIDTH,
  RAIL_SECTION_MIN_HEIGHT,
  saveRightPanelWidth,
  saveRailPropertiesHeight,
  saveRailWarningsHeight,
} from '@/utils/settingsStore';

const DebugTerminal = lazy(() => import('@/components/panels/DebugTerminal').then(m => ({ default: m.DebugTerminal })));
const AIActivityPanel = lazy(() => import('@/components/panels/AIActivityPanel').then(m => ({ default: m.AIActivityPanel })));

/**
 * De rechter-rail: TWEE GELIJKWAARDIGE PANELEN boven elkaar (issue #46, slotpunt).
 *
 * ── Wat hier is teruggedraaid ────────────────────────────────────────────────────────────────
 * Architect-besluit 5 van fase 2.10 luidde: "hergebruik de bestaande rechter-rail, mutueel
 * exclusief met het eigenschappenpaneel (resources gedockt ⇒ properties-rail tijdelijk vervangen).
 * Eén rail, geen tweede breedte/collapsed-veld." De melder van issue #46 liep daar precies tegenaan:
 * het Resourcedock VERVING het eigenschappenpaneel, dus je verloor de taakeigenschappen zodra je de
 * resources erbij wilde.
 *
 * Wat blijft staan van dat besluit: **één rail en één breedte** — er is nog steeds precies één
 * `rightPanelWidth` en één breedte-splitter. Wat erbij komt is uitsluitend de verticale as: een
 * hoogteverdeling (`railPropertiesHeight`) met een sleepgrens.
 *
 * ── Het model, in drie regels ───────────────────────────────────────────────────────────────
 * De rail huisvest twee panelen die elk hun eigen aan/uit-vlag hebben: `showPropertiesPanel` en
 * `resourcePanelDocked`. Er is GEEN samengevouwen tussentoestand — staat een paneel aan, dan zie
 * je zijn inhoud. Daaruit volgt de hele layout:
 *
 *   - twee panelen aan  → Eigenschappen krijgt `railPropertiesHeight` px, de resourcelijst de
 *                         rest, met een sleepbare grens ertussen (ondergrens per paneel);
 *   - één paneel aan    → dat paneel krijgt de volle hoogte, ongeacht `railPropertiesHeight`;
 *   - geen paneel aan   → geen rail (App.tsx rendert dit component dan niet eens).
 *
 * De enige manier om de verdeling te wijzigen is die sleepgrens; de enige manier om een paneel weg
 * te krijgen is zijn eigen aan/uit — bereikbaar vanaf de lintknop (Beeld → Panelen, en voor de
 * resourcelijst ook de Resources-tab) én vanaf de ✕ in zijn eigen kopbalk. Dat is twee ingangen
 * naar ÉÉN schakelaar, niet twee mechanieken.
 *
 * `rightPanelCollapsed` is bewust iets anders en blijft bestaan: dat verbergt de hele kolom
 * tijdelijk — de Gantt krijgt de breedte — zónder de paneelkeuze te vergeten. Vandaar de knop
 * rechts in de bovenste kopbalk en de smalle strip die 'm terughaalt.
 *
 * ── Issue #53: het Waarschuwingenpaneel, ónder de stapel ───────────────────────────────────
 * Het derde railpaneel (`showWarningsPanel`) raakt het tweepanelenmodel hierboven niet aan: het
 * staat als aparte sectie ONDER de stapel, met een eigen sleepgrens erboven (`railWarningsHeight`,
 * het spiegelbeeld van `railPropertiesHeight`). Staat er nog een ander paneel aan, dan heeft de
 * waarschuwingensectie een vaste hoogte en verdeelt de stapel erboven de rest volgens het bestaande
 * model; staat alleen dit paneel aan, dan vult het de hele rail. Zelfde aan/uit-mechaniek
 * (lintknop Beeld → Panelen, statusbalk, ✕ in de kopbalk), zelfde `setUI`-invarianten.
 */
export function RightRail() {
  const { t } = useTranslation('common');
  const { t: tMenu } = useTranslation('menu');
  const setUI = useAppStore(s => s.setUI);
  const rightPanelCollapsed = useAppStore(s => s.ui.rightPanelCollapsed);
  const rightPanelWidth = useAppStore(s => s.ui.rightPanelWidth);
  const showPropertiesPanel = useAppStore(s => s.ui.showPropertiesPanel);
  const showResourcePanel = useAppStore(s => s.ui.showResourcePanel);
  const resourcePanelDocked = useAppStore(s => s.ui.resourcePanelDocked);
  const propsHeight = useAppStore(s => s.ui.railPropertiesHeight);
  const showWarningsPanel = useAppStore(s => s.ui.showWarningsPanel);
  const warningsHeight = useAppStore(s => s.ui.railWarningsHeight);
  const debugTerminalEnabled = useAppStore(s => s.ui.debugTerminalEnabled);
  const debugTerminalOpen = useAppStore(s => s.ui.debugTerminalOpen);
  const aiMode = useAppStore(s => s.ui.aiMode);
  const aiActivityOpen = useAppStore(s => s.ui.aiActivityOpen);

  /** Staat het resourcepaneel in de rail aan? (Het VOLLEDIGE resourcepaneel is iets anders: dat
   *  vervangt de hele werkruimte en komt hier niet langs — App.tsx rendert deze rail dan niet.) */
  const dockOn = showResourcePanel && resourcePanelDocked;
  const bothOn = showPropertiesPanel && dockOn;
  /** Staat er iets in de stapel bóven het waarschuwingenpaneel? */
  const stackOn = showPropertiesPanel || dockOn;
  /** Aantal panelen in die stapel — bepaalt de ondergrens die de waarschuwingssectie moet laten. */
  const stackCount = (showPropertiesPanel ? 1 : 0) + (dockOn ? 1 : 0);

  /** Container waarbinnen de twee panelen gestapeld staan — de referentie voor de sleepklem. */
  const stackRef = useRef<HTMLDivElement>(null);
  /** Stapel + waarschuwingensectie samen — de referentie voor de sleepklem van issue #53. */
  const bodyRef = useRef<HTMLDivElement>(null);

  // Breedte slepen (ongewijzigd t.o.v. de oude rail): één splitter, één `rightPanelWidth`.
  const widthSplitter = useSplitter({
    min: RIGHT_PANEL_MIN_WIDTH,
    max: () => Math.round(window.innerWidth * 0.6),
    computeSize: e => Math.round(document.documentElement.dir === 'rtl' ? e.clientX : window.innerWidth - e.clientX),
    onResize: w => useAppStore.getState().setUI({ rightPanelWidth: w }),
    onCommit: () => { void saveRightPanelWidth(useAppStore.getState().ui.rightPanelWidth); },
  });

  // Hoogte slepen — hetzelfde `useSplitter`-patroon, nu op de verticale as. De bovengrens is
  // dynamisch: de stapel-hoogte minus de minimumhoogte van het onderste paneel, zodat de
  // resourcelijst nooit tot 0 px wordt geknepen. Beide grenzen zijn in px van de stapel-top af.
  const heightSplitter = useSplitter({
    min: RAIL_SECTION_MIN_HEIGHT,
    max: () => {
      const h = stackRef.current?.getBoundingClientRect().height ?? 0;
      return Math.max(RAIL_SECTION_MIN_HEIGHT, Math.round(h - RAIL_SECTION_MIN_HEIGHT));
    },
    computeSize: e => {
      const top = stackRef.current?.getBoundingClientRect().top ?? 0;
      return Math.round(e.clientY - top);
    },
    onResize: h => useAppStore.getState().setUI({ railPropertiesHeight: h }),
    onCommit: () => { void saveRailPropertiesHeight(useAppStore.getState().ui.railPropertiesHeight); },
  });

  // Issue #53: de grens tussen de stapel en het waarschuwingenpaneel. Gemeten vanaf de ONDERkant
  // (het paneel groeit omhoog), met dezelfde ondergrens per paneel als de stapelgrens hierboven.
  const warningsSplitter = useSplitter({
    min: RAIL_SECTION_MIN_HEIGHT,
    max: () => {
      const h = bodyRef.current?.getBoundingClientRect().height ?? 0;
      // Elk paneel in de stapel houdt zijn eigen ondergrens (hyperkritische review #53).
      return Math.max(RAIL_SECTION_MIN_HEIGHT, Math.round(h - RAIL_SECTION_MIN_HEIGHT * Math.max(1, stackCount)));
    },
    computeSize: e => {
      const bottom = bodyRef.current?.getBoundingClientRect().bottom ?? 0;
      return Math.round(bottom - e.clientY);
    },
    onResize: h => useAppStore.getState().setUI({ railWarningsHeight: h }),
    onCommit: () => { void saveRailWarningsHeight(useAppStore.getState().ui.railWarningsHeight); },
  });

  // ── Ingeklapte rail: de verticale strip ────────────────────────────────────────────────────
  // Eén knop, één label, één actie: de kolom terughalen zoals je 'm achterliet. Er valt niets meer
  // te kiezen — de panelen die aan staan komen allemaal terug — dus een label per paneel zou een
  // keuze suggereren die er niet is. Het label noemt daarom wát er terugkomt: de naam van het ene
  // paneel als er één aan staat, en anders het verzamelwoord "Panelen" (`menu:ribbon.panels`,
  // dezelfde term als de lintgroep waar de schakelaars staan).
  if (rightPanelCollapsed) {
    const onCount = [showPropertiesPanel, dockOn, showWarningsPanel].filter(Boolean).length;
    const label = onCount > 1
      ? tMenu('ribbon.panels')
      : dockOn ? t('resource.compact.title') : showWarningsPanel ? t('warnings.title') : t('properties');
    return (
      <button
        onClick={() => setUI({ rightPanelCollapsed: false })}
        title={t('sidebar.expandRail')}
        className="ui-card flex flex-col items-center justify-center gap-2 py-4 hover:bg-surface-hover overflow-hidden"
        style={{ width: 28 }}
        data-ops-rail-strip
      >
        <ChevronRight size={14} className="text-text-secondary ops-icon-inline-flip" />
        <span
          className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider"
          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
        >
          {label}
        </span>
      </button>
    );
  }

  return (
    <div
      className="ui-card flex flex-col overflow-visible"
      style={{ width: rightPanelWidth, minWidth: RIGHT_PANEL_MIN_WIDTH, position: 'relative' }}
      data-tour-anchor="properties-panel"
      data-ops-rail
    >
      {/* Sleepgrijpzone voor de BREEDTE: grijpt 8 px aan weerszijden van de zichtbare scheiding.
          De rail zelf houdt zijn inhoud in de stapel hieronder geknipt; de buitenste kaart blijft
          bewust zichtbaar zodat de helft die boven de Gantt hangt niet door `overflow-hidden`
          verdwijnt. `insetInlineStart` spiegelt de zone voor ar/fa. */}
      <div
        onMouseDown={e => { e.preventDefault(); widthSplitter.start(); }}
        style={{ position: 'absolute', insetInlineStart: -8, top: 0, bottom: 0, width: 16, cursor: 'col-resize', zIndex: 10 }}
        data-ops-right-panel-resize
      />

      <div ref={bodyRef} className="flex-1 flex flex-col overflow-hidden" style={{ minHeight: 0 }}>
      {stackOn && (
      // `minHeight` = één kopbalk per paneel in de stapel: met de waarschuwingssectie eronder
      // (vaste hoogte) zou een lage rail anders de hele stapel tot 0 px knijpen — de flex-basis van
      // deze wrapper is 0, dus zonder klem absorbeert hij álle negatieve ruimte (zie de meting in
      // `RailPanel` hieronder; die klem zit één niveau te diep om dit te vangen).
      <div ref={stackRef} className="flex-1 flex flex-col overflow-hidden" style={{ minHeight: showWarningsPanel ? `${stackCount * 2}rem` : 0 }}>
        {showPropertiesPanel && (
          <RailPanel
            id="properties"
            title={t('properties')}
            // De rail-als-geheel-knop hangt aan de BOVENSTE kopbalk, zodat er precies één zo'n knop
            // is. Eigenschappen staat altijd bovenaan wanneer het aan staat; staat het uit, dan
            // erft de resourcelijst hem (zie hieronder).
            onCollapseRail={() => setUI({ rightPanelCollapsed: true })}
            collapseRailTitle={t('sidebar.collapseRail')}
            // Vaste hoogte alleen als er écht twee panelen aan staan; anders vult het ene paneel de
            // rail (`flex: 1`) en is er niets te verdelen.
            fixedHeight={bothOn ? propsHeight : undefined}
            grow={!bothOn}
            actions={
              <button
                onClick={() => setUI({ showPropertiesPanel: false })}
                title={t('sidebar.closeProperties')}
                className="p-0.5 hover:bg-surface-hover rounded text-text-secondary"
              >
                <X size={14} />
              </button>
            }
          >
            <TaskPropertiesPanel />
          </RailPanel>
        )}

        {bothOn && (
          // Onzichtbare horizontale grijpzone tussen de twee panelen — spiegelbeeld van de
          // breedte-grijpzone hierboven: geen eigen balk, alleen een cursor. De zichtbare
          // scheiding is de `border-t` van de kopbalk van het paneel eronder.
          <div
            onMouseDown={e => { e.preventDefault(); heightSplitter.start(); }}
            style={{ height: 0, position: 'relative', zIndex: 10, flexShrink: 0 }}
          >
            <div style={{ position: 'absolute', insetInline: 0, top: -4, height: 8, cursor: 'row-resize' }} data-ops-rail-resize />
          </div>
        )}

        {dockOn && (
          <RailPanel
            id="resources"
            title={t('resource.compact.title')}
            withTopBorder={showPropertiesPanel}
            grow
            // Staat Eigenschappen uit, dan is dit de bovenste kopbalk en hoort de rail-knop hier.
            onCollapseRail={showPropertiesPanel ? undefined : () => setUI({ rightPanelCollapsed: true })}
            collapseRailTitle={t('sidebar.collapseRail')}
            actions={
              <>
                <button
                  onClick={() => setUI({ resourcePanelDocked: false })}
                  title={t('resource.compact.expandFull')}
                  className="p-0.5 hover:bg-surface-hover rounded text-text-secondary"
                >
                  <Maximize2 size={13} />
                </button>
                <button
                  onClick={() => setUI({ showResourcePanel: false, resourcePanelDocked: false })}
                  title={t('resource.compact.closeDock')}
                  className="p-0.5 hover:bg-surface-hover rounded text-text-secondary"
                >
                  <X size={14} />
                </button>
              </>
            }
          >
            <ResourcePanelCompact />
          </RailPanel>
        )}
      </div>
      )}

        {stackOn && showWarningsPanel && (
          // Issue #53: grijpzone tussen de stapel en het waarschuwingenpaneel — zelfde vorm als de
          // stapelgrens hierboven (geen eigen balk, alleen een cursor).
          <div
            onMouseDown={e => { e.preventDefault(); warningsSplitter.start(); }}
            style={{ height: 0, position: 'relative', zIndex: 10, flexShrink: 0 }}
          >
            <div style={{ position: 'absolute', insetInline: 0, top: -4, height: 8, cursor: 'row-resize' }} data-ops-rail-warnings-resize />
          </div>
        )}

        {showWarningsPanel && (
          <RailPanel
            id="warnings"
            title={t('warnings.title')}
            withTopBorder={stackOn}
            fixedHeight={stackOn ? warningsHeight : undefined}
            grow={!stackOn}
            // Staat er niets boven, dan is dit de bovenste kopbalk en hoort de rail-knop hier.
            onCollapseRail={stackOn ? undefined : () => setUI({ rightPanelCollapsed: true })}
            collapseRailTitle={t('sidebar.collapseRail')}
            actions={
              <button
                onClick={() => setUI({ showWarningsPanel: false })}
                title={t('warnings.close')}
                className="p-0.5 hover:bg-surface-hover rounded text-text-secondary"
                data-ops-warnings-close
              >
                <X size={14} />
              </button>
            }
          >
            <WarningsPanel />
          </RailPanel>
        )}
      </div>

      {debugTerminalEnabled && debugTerminalOpen && (
        <Suspense fallback={null}><DebugTerminal /></Suspense>
      )}
      {aiMode && aiActivityOpen && (
        <Suspense fallback={null}><AIActivityPanel /></Suspense>
      )}
    </div>
  );
}

interface RailPanelProps {
  id: string;
  title: string;
  children: React.ReactNode;
  /** Knoppen rechts in de kopbalk (sluiten, en voor de resourcelijst "volledig paneel"). */
  actions?: React.ReactNode;
  /** De knop die de HELE kolom inklapt — hangt alleen aan de bovenste kopbalk. */
  onCollapseRail?: () => void;
  collapseRailTitle?: string;
  /** Vaste hoogte in px (alleen wanneer beide panelen aan staan). */
  fixedHeight?: number;
  /** Vult dit paneel de resterende ruimte? */
  grow?: boolean;
  withTopBorder?: boolean;
}

function RailPanel({
  id, title, children, actions, onCollapseRail, collapseRailTitle,
  fixedHeight, grow, withTopBorder,
}: RailPanelProps) {
  // Twee details die pas bij het NAmeten bleken te kloppen, allebei voor de rail die KORTER is dan
  // de opgeslagen verdeling (laag venster, geopende debugterminal, uitgeklapt AI-paneel):
  //
  //  1. De vaste-hoogte-tak staat op `flex-shrink: 1` (`0 1 auto`), niet op `0 0 auto`. Anders
  //     weigert het vastgezette paneel te krimpen en wordt alle overloop op het andere afgewenteld.
  //  2. Béide takken hebben een `minHeight` van precies één kopbalk (`2rem`, dezelfde `h-8` als de
  //     kopbalk zelf — en dus meeschalend met de interface-lettertypeschaal). Zonder die op de
  //     GROEIENDE tak is `flex: 1 1 0` bij negatieve vrije ruimte gewoon 0 px: gemeten op 1280×430
  //     kromp de resourcelijst dan tot 1 px terwijl Eigenschappen 146 px hield — de lijst verdween
  //     zonder dat iets dat aangaf. Met de klem houden beide panelen minstens hun kopbalk.
  const HEADER = '2rem';
  const style: React.CSSProperties = grow
    ? { flex: '1 1 0', minHeight: HEADER }
    : { flex: '0 1 auto', height: fixedHeight, minHeight: HEADER };

  return (
    <div
      className={`flex flex-col overflow-hidden${withTopBorder ? ' border-t border-border' : ''}`}
      style={style}
      data-ops-rail-panel={id}
    >
      <div className="flex items-center h-8 px-3 border-b border-border flex-shrink-0">
        <span className="flex-1 min-w-0 text-[10px] font-bold uppercase tracking-wider text-text-secondary truncate">
          {title}
        </span>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {actions}
          {onCollapseRail && (
            <button
              onClick={onCollapseRail}
              title={collapseRailTitle}
              className="p-0.5 hover:bg-surface-hover rounded text-text-secondary"
            >
              <PanelRightClose size={14} className="ops-icon-inline-flip" />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

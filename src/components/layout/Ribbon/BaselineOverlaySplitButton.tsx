import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, LayoutGrid } from 'lucide-react';
import { Popover } from '@/components/common/Popover';
import { useAppStore } from '@/state/appStore';
import { BASELINE_SLOT_COLOR } from '@/components/canvas/BaselineTooltipContent';
import { buildBaselineLayers, MAX_COMPARED_BASELINES } from '@/types/baseline';

/**
 * Issue #391: grote gesplitste lintknop Baseline-overlay, zoals Plakken in Word.
 *
 * - Het bovenste deel (pictogram) zet de overlay aan of uit, precies zoals de oude knop.
 * - Het onderste deel (label + ▾) opent het menu "Toon in de Gantt": per baseline een vinkje en een
 *   kleurstrookje.
 *   De actieve baseline staat bovenaan, is altijd aan en draagt "actief". Maximaal drie tegelijk;
 *   daarna zijn de overige vinkjes uitgeschakeld.
 *
 * Het lint had nog geen gesplitste knop. Dit hergebruikt het patroon van de grote knop Relatie
 * (`RelationDropdown`): een `Popover` met een grote `ribbon-btn` en "▾" achter het label. In de smalle
 * pictogramweergave (automatische inpassing, `data-ribbon-mini`) blijft het een eigen kolom: groot
 * pictogram boven, alleen ▾ eronder. De keuze is alleen
 * UI-state (`ui.comparedBaselineIds`), niet in het document en niet in de instellingen.
 */
export function BaselineOverlaySplitButton() {
  const { t: tMenu } = useTranslation('menu');
  const [open, setOpen] = useState(false);
  const showBaselineOverlay = useAppStore(s => s.ui.showBaselineOverlay);
  const setOverlays = useAppStore(s => s.setOverlays);
  const baselines = useAppStore(s => s.baselines);
  const activeBaselineId = useAppStore(s => s.activeBaselineId);
  const compared = useAppStore(s => s.comparedBaselineIds);
  const toggleCompared = useAppStore(s => s.toggleComparedBaseline);

  const layers = useMemo(
    () => buildBaselineLayers(baselines, activeBaselineId, compared),
    [baselines, activeBaselineId, compared],
  );
  const slotOf = (id: string) => layers.find(l => l.baselineId === id)?.slot;
  const full = layers.filter(l => l.slot !== 0).length >= MAX_COMPARED_BASELINES;
  // Actief bovenaan, daarna de overige in de volgorde van Baselines beheren.
  const ordered = [
    ...baselines.filter(b => b.id === activeBaselineId),
    ...baselines.filter(b => b.id !== activeBaselineId),
  ];

  const label = tMenu('ribbon.toggleBaselineOverlay');
  const menuLabel = tMenu('ribbon.baselineMenuOpen');

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      fitViewport
      panelStyle={{
        marginTop: 2, zIndex: 9999, minWidth: 240, maxWidth: 320, padding: 6,
        display: 'flex', flexDirection: 'column', gap: 2,
      }}
      trigger={
        <div className={`ribbon-split-large${showBaselineOverlay ? ' active' : ''}`} data-ops-baseline-split>
          {/* Bovenste deel: overlay aan/uit. Het label staat verborgen in dit deel (de automatische
              inpassing van het lint zoekt knoppen met pictogram én label); zichtbaar staat het
              in het onderste deel, zoals bij Plakken in Word. */}
          <button
            className={`ribbon-btn ribbon-split-top${showBaselineOverlay ? ' active' : ''}`}
            title={label}
            aria-label={label}
            aria-pressed={showBaselineOverlay}
            data-ops-ribbon-item="toggleBaselineOverlay"
            onClick={() => setOverlays({ baseline: !showBaselineOverlay })}
          >
            <span className="ribbon-btn-icon"><LayoutGrid size={20} /></span>
            <span className="ribbon-btn-label ribbon-split-top-label">{label}</span>
          </button>
          {/* Onderste deel: label met ▾ (zoals de knop Relatie), opent het menu. */}
          <button
            className={`ribbon-split-bottom${showBaselineOverlay ? ' active' : ''}${open ? ' open' : ''}`}
            title={menuLabel}
            aria-label={menuLabel}
            aria-haspopup="menu"
            aria-expanded={open}
            data-ops-baseline-menu-toggle
            onClick={() => setOpen(o => !o)}
          >
            {/* Breed: "label ▾" loopt als één tekst door (zoals Relatie ▾). Smal: alleen de losse ▾. */}
            <span className="ribbon-btn-label">{label} ▾</span>
            <span className="ribbon-split-caret" aria-hidden="true">▾</span>
          </button>
        </div>
      }
    >
      {/* Kop en voetregel blijven staan; alleen de lijst scrolt als het venster te laag is. */}
      <div
        role="menu"
        aria-label={tMenu('ribbon.baselineMenu')}
        data-ops-baseline-menu
        style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: '1 1 auto' }}
      >
        <div className="ribbon-info" style={{ fontWeight: 600, padding: '2px 6px 4px', flex: 'none' }}>
          {tMenu('ribbon.baselineMenu')}
        </div>
        {ordered.length === 0 && (
          <div className="ribbon-info" style={{ padding: '2px 6px', whiteSpace: 'normal', maxWidth: 280 }}>{tMenu('ribbon.baselineMenuEmpty')}</div>
        )}
        <div
          data-ops-baseline-menu-list
          style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: 0, flex: '1 1 auto' }}
        >
          {ordered.map(b => {
            const isActive = b.id === activeBaselineId;
            const slot = slotOf(b.id);
            const checked = slot !== undefined;
            const disabled = isActive || (!checked && full);
            return (
              <button
                key={b.id}
                role="menuitemcheckbox"
                aria-checked={checked}
                aria-disabled={disabled || undefined}
                data-ops-baseline-menu-item={b.id}
                className={`ribbon-check-item${disabled ? ' is-disabled' : ''}`}
                onClick={() => {
                  if (disabled) return;
                  toggleCompared(b.id);
                }}
              >
                <span className={`ribbon-check-box${checked ? ' is-checked' : ''}`} aria-hidden="true">
                  {checked && <Check size={11} strokeWidth={3} />}
                </span>
                <span
                  className={`ribbon-check-strip${checked ? '' : ' is-empty'}`}
                  style={checked ? { background: BASELINE_SLOT_COLOR[slot] } : undefined}
                  aria-hidden="true"
                />
                <span className="ribbon-check-label">{b.name}</span>
                {isActive && <span className="ribbon-check-note">{tMenu('ribbon.baselineMenuActive')}</span>}
              </button>
            );
          })}
        </div>
        <div
          className="ribbon-info"
          data-ops-baseline-menu-hint
          style={{ padding: '6px 6px 2px', borderTop: '1px solid var(--theme-border)', marginTop: 4, whiteSpace: 'normal', maxWidth: 280, flex: 'none' }}
        >
          {tMenu('ribbon.baselineMenuHint')}
        </div>
      </div>
    </Popover>
  );
}

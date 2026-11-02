import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Icon } from './Icon';
import { B2_ICONS, type IconId, type IconMaster } from './b2/icons.generated';
import { DOCK_PROPOSALS, dockProposal, type DockProposal } from './dockProposal';
import { useAppStore } from '@/state/appStore';

/**
 * TIJDELIJK iconenblad, alleen op de dev-server, om iconen in de echte themakleuren te beoordelen:
 * - `?iconen=status`: alle statusiconen, met het kader in de statuskleur en het teken in oranje (voorstel a,
 *   gekozen door Ethan op 2 november 2026);
 * - `?iconen=dock`: de voorstellen voor Resourcedock uit `dockProposal.ts`, naast elkaar.
 * Gaat eruit samen met het dockvoorstel.
 */
type Mode = 'status' | 'dock';

const STATUS_IDS = (Object.keys(B2_ICONS) as IconId[]).filter(id => B2_ICONS[id].semantic);

/** Dezelfde themakleur als `.oa-icon--<rol>` in icons.css, voor de voorbeeldtekst naast het icoon. */
const TEXT_COLOR: Record<NonNullable<(typeof B2_ICONS)[IconId]['semantic']>, string> = {
  error: 'var(--theme-critical-text)',
  warning: 'var(--theme-warning-text)',
  success: 'var(--theme-success-text, #16a34a)',
  info: 'var(--theme-info-text, #2563eb)',
  'text-secondary': 'var(--theme-text-dim)',
};

function hrefWith(changes: Record<string, string | null>): string {
  const params = new URLSearchParams(window.location.search);
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) params.delete(key);
    else params.set(key, value);
  }
  return `${window.location.pathname}?${params.toString()}`;
}

function StatusRow({ id }: { id: IconId }) {
  const semantic = B2_ICONS[id].semantic!;
  return (
    <tr data-icon-sheet-row={id}>
      <td className="py-1 pe-3 whitespace-nowrap">{id}</td>
      <td className="py-1 pe-3 text-text-secondary">{semantic}</td>
      <td className="py-1 pe-3"><Icon id={id} size={16} /></td>
      <td className="py-1 pe-3"><Icon id={id} size={24} /></td>
      <td className="py-1">
        <span className="inline-flex items-center gap-1" style={{ color: TEXT_COLOR[semantic] }}>
          <Icon id={id} size={16} />Voorbeeldtekst
        </span>
      </td>
    </tr>
  );
}

/** Eén voorstel op een vaste maat, met dezelfde opbouw als `Icon` (zelfde klassen, dus dezelfde kleuren). */
function MasterIcon({ master, box, variant }: { master: IconMaster; box: 16 | 24; variant: string }) {
  return (
    <svg className="oa-icon" width={box} height={box} viewBox={`0 0 ${box} ${box}`} data-dock-variant={variant} aria-hidden="true">
      {master.parts.map(([kind, tone, d], index) => {
        const paint = tone === 1 ? 'var(--icon-accent, currentColor)' : 'currentColor';
        return kind === 0
          ? <path key={index} d={d} fill="none" stroke={paint} strokeWidth={master.w} strokeLinecap="round" strokeLinejoin="round" />
          : <path key={index} d={d} fill={paint} fillRule="evenodd" />;
      })}
    </svg>
  );
}

function DockRow({ variant, label, s16, s24 }: { variant: string; label: string; s16: IconMaster; s24: IconMaster }) {
  const current = (dockProposal ?? 'nu') === variant;
  return (
    <tr data-icon-sheet-row={variant}>
      <td className="py-2 pe-3 align-middle"><MasterIcon master={s16} box={16} variant={variant} /></td>
      <td className="py-2 pe-3 align-middle"><MasterIcon master={s24} box={24} variant={variant} /></td>
      <td className="py-2 pe-3 align-middle">{label}</td>
      <td className="py-2 align-middle whitespace-nowrap">
        {current
          ? <span className="font-semibold text-accent">nu in het lint</span>
          : <a className="underline" data-dock-proposal-link={variant}
            href={hrefWith({ dockVoorstel: variant === 'nu' ? null : variant })}>in het lint zetten</a>}
      </td>
    </tr>
  );
}

function IconReviewSheet({ mode }: { mode: Mode }) {
  const [open, setOpen] = useState(true);
  const setUI = useAppStore(s => s.setUI);
  if (!open) {
    return (
      <button type="button" className="btn btn--sm btn--secondary fixed bottom-10 end-4 z-[9999]" onClick={() => setOpen(true)}>
        Iconenblad tonen
      </button>
    );
  }
  const blueprint = B2_ICONS['resource.dock'];
  return (
    <aside
      data-icon-sheet={mode}
      className="fixed top-2 bottom-8 end-2 z-[9999] w-[520px] overflow-y-auto rounded-[8px] border border-border bg-surface p-4 !text-body text-text-primary shadow-[var(--shadow-lg)]"
    >
      <div className="flex items-center justify-between gap-2">
        <strong className="!text-large">{mode === 'dock' ? 'Resourcedock: voorstellen' : 'Statusiconen'}</strong>
        <button type="button" className="inline-flex" aria-label="Sluiten" title="Sluiten" onClick={() => setOpen(false)}>
          <Icon id="ui.close" size={16} />
        </button>
      </div>
      {mode === 'dock' ? (
        <>
          <p className="mt-2 text-text-secondary">
            Per voorstel 16 en 24 px. Met de link komt dat voorstel in het lint, op Resources en op Beeld.
          </p>
          <table className="mt-2"><tbody>
            <DockRow variant="nu" label="nu: de Blueprint, helemaal grijs (één vorm)" s16={blueprint.s16} s24={blueprint.s24} />
            {(Object.keys(DOCK_PROPOSALS) as DockProposal[]).map(key => (
              <DockRow key={key} variant={key} {...DOCK_PROPOSALS[key]} />
            ))}
          </tbody></table>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn btn--sm btn--secondary" onClick={() => setUI({ activeRibbonTab: 'resources' })}>Tab Resources</button>
            <button type="button" className="btn btn--sm btn--secondary" onClick={() => setUI({ activeRibbonTab: 'beeld' })}>Tab Beeld</button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 text-text-secondary">Het kader in de statuskleur, het teken in oranje (voorstel a).</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn btn--sm btn--secondary" onClick={() => setUI({ showWarningsPanel: true })}>Waarschuwingen openen</button>
            <button type="button" className="btn btn--sm btn--secondary" onClick={() => setUI({ activeRibbonTab: 'resources' })}>Tab Resources</button>
            <button type="button" className="btn btn--sm btn--secondary" onClick={() => setUI({ activeRibbonTab: 'ai' })}>Tab AI</button>
          </div>
          <table className="mt-3"><tbody>{STATUS_IDS.map(id => <StatusRow key={id} id={id} />)}</tbody></table>
        </>
      )}
    </aside>
  );
}

export function mountIconReviewSheet(mode: Mode): void {
  const host = document.createElement('div');
  host.id = 'ops-icon-review-sheet';
  document.body.appendChild(host);
  createRoot(host).render(<IconReviewSheet mode={mode} />);
}

import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Icon } from './Icon';
import { B2_ICONS, type IconId } from './b2/icons.generated';
import { STATUS_PROPOSAL_IDS, statusProposal } from './statusProposal';
import { useAppStore } from '@/state/appStore';

/**
 * TIJDELIJK statusblad, alleen op de dev-server met `?iconen=status`: alle statusiconen in de echte themakleuren,
 * om het voorstel uit `statusProposal.ts` te beoordelen. Gaat eruit samen met dat voorstel.
 */
const PROPOSALS: { key: 'a' | 'b' | 'c'; label: string }[] = [
  { key: 'a', label: 'a: teken oranje, kader in statuskleur' },
  { key: 'b', label: 'b: kader oranje, teken in statuskleur' },
  { key: 'c', label: 'c: zoals nu, geen oranje' },
];

const STATUS_IDS = (Object.keys(B2_ICONS) as IconId[]).filter(id => B2_ICONS[id].semantic);

/** Dezelfde themakleur als `.oa-icon--<rol>` in icons.css, voor de voorbeeldtekst naast het icoon. */
const TEXT_COLOR: Record<NonNullable<(typeof B2_ICONS)[IconId]['semantic']>, string> = {
  error: 'var(--theme-critical-text)',
  warning: 'var(--theme-warning-text)',
  success: 'var(--theme-success-text, #16a34a)',
  info: 'var(--theme-info-text, #2563eb)',
  'text-secondary': 'var(--theme-text-dim)',
};

function proposalHref(key: string): string {
  const params = new URLSearchParams(window.location.search);
  if (key === 'c') params.delete('statusVoorstel');
  else params.set('statusVoorstel', key);
  return `${window.location.pathname}?${params.toString()}`;
}

function Row({ id }: { id: IconId }) {
  const semantic = B2_ICONS[id].semantic!;
  return (
    <tr data-status-sheet-row={id}>
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

function StatusIconSheet() {
  const [open, setOpen] = useState(true);
  const setUI = useAppStore(s => s.setUI);
  const current = statusProposal ?? 'c';
  if (!open) {
    return (
      <button type="button" className="btn btn--sm btn--secondary fixed bottom-10 end-4 z-[9999]" onClick={() => setOpen(true)}>
        Statusblad tonen
      </button>
    );
  }
  const without = STATUS_IDS.filter(id => STATUS_PROPOSAL_IDS.has(id));
  const withOrange = STATUS_IDS.filter(id => !STATUS_PROPOSAL_IDS.has(id));
  return (
    <aside
      data-status-sheet
      className="fixed top-2 bottom-8 end-2 z-[9999] w-[520px] overflow-y-auto rounded-[8px] border border-border bg-surface p-4 !text-body text-text-primary shadow-[var(--shadow-lg)]"
    >
      <div className="flex items-center justify-between gap-2">
        <strong className="!text-large">Statusiconen: voorstel voor het oranje element</strong>
        <button type="button" className="inline-flex" aria-label="Sluiten" title="Sluiten" onClick={() => setOpen(false)}>
          <Icon id="ui.close" size={16} />
        </button>
      </div>
      <p className="mt-2 text-text-secondary">Kies een voorstel. De link laadt de app opnieuw met dat voorstel.</p>
      <div className="mt-2 flex flex-col gap-1">
        {PROPOSALS.map(p => (
          <a key={p.key} href={proposalHref(p.key)} data-status-sheet-proposal={p.key}
            className={p.key === current ? 'font-semibold text-accent' : 'underline'}>
            {p.key === current ? `${p.label} (nu)` : p.label}
          </a>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn btn--sm btn--secondary" onClick={() => setUI({ showWarningsPanel: true })}>Waarschuwingen openen</button>
        <button type="button" className="btn btn--sm btn--secondary" onClick={() => setUI({ activeRibbonTab: 'resources' })}>Tab Resources</button>
        <button type="button" className="btn btn--sm btn--secondary" onClick={() => setUI({ activeRibbonTab: 'ai' })}>Tab AI</button>
      </div>
      <h3 className="mt-4 font-semibold">Zonder oranje element in de Blueprint ({without.length})</h3>
      <table className="mt-1"><tbody>{without.map(id => <Row key={id} id={id} />)}</tbody></table>
      <h3 className="mt-4 font-semibold">Al met een oranje element ({withOrange.length})</h3>
      <table className="mt-1"><tbody>{withOrange.map(id => <Row key={id} id={id} />)}</tbody></table>
    </aside>
  );
}

export function mountStatusIconSheet(): void {
  const host = document.createElement('div');
  host.id = 'ops-status-icon-sheet';
  document.body.appendChild(host);
  createRoot(host).render(<StatusIconSheet />);
}

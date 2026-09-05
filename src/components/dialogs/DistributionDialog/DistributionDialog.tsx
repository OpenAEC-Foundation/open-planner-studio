// B1c-plan3 taak 8 — de verdeeldialoog (spec §7 "plek in de UI", §3.4 "discrete rekenmomenten").
//
// LOSSE DIALOOG, GEEN DRILL-DOWN (besluit eigenaar 2026-08-31). Het patroon is letterlijk dat van
// `LevelingDialog`: een `ui.show*`-vlag, gemount vanuit `App.tsx`, de gedeelde `Dialog` (focus-trap,
// Escape, backdrop) en opgenomen in `hasBlockingDialogOpen()`. Het bezettingsoverzicht blijft
// gewoon zichtbaar ONDER de dialoog — de verdeling is een handeling óp dat overzicht, geen
// vervanging ervan.
//
// WAT HIER (NOG) NIET STAAT. Taak 9 vervangt de minimale strook-regels door de echte fasestroken met
// sleepbare plafondhandles, en vult het voor/na-histogram. Taak 12 bedraadt "Toepassen" op
// `applyDistribution`. Tot dan staat de knop er wél, maar uitgeschakeld MET REDEN — een knop die er
// niet is laat de gebruiker raden of de functie bestaat.
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { useAppStore } from '@/state/appStore';
import { Dialog } from '@/components/common/Dialog';
import { DISTRIBUTION_BLOCK_KEY } from '@/utils/levelingReasonKey';
import { planDistributionWrites } from '@/services/library/applyDistribution';
import { documentFloatOn, useDistributionProposal } from './useDistributionProposal';

export function DistributionDialog() {
  const { t, i18n } = useTranslation('common');
  const tune = useAppStore(s => s.ui.levelingDistribution);
  const pools = useAppStore(s => s.pools);
  const setUI = useAppStore(s => s.setUI);

  const { proposal, busy, staleReason, lastStaleReason, degraded, recompute, inputs } =
    useDistributionProposal(tune);

  const close = () => setUI({ showDistributionDialog: false });

  const poolItem = tune ? pools[tune.companyId]?.resources.find(r => r.id === tune.libraryItemId) : undefined;
  const itemName = poolItem?.name || tune?.libraryItemId || '';

  const numberFmt = useMemo(
    () => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }),
    [i18n.language],
  );

  // De rangordelijst leest UITSLUITEND uit `tune.order` — de bron van waarheid voor de rangorde.
  // Documenten die na het openen zijn bijgekomen sluiten achteraan aan (zie `buildDistributionInputs`).
  const rankRows = useMemo(() => {
    if (!tune) return [];
    const byId = new Map(inputs.map(doc => [doc.docId, doc]));
    const ordered = [...tune.order.filter(id => byId.has(id)), ...inputs.map(d => d.docId).filter(id => !tune.order.includes(id))];
    return ordered.map(docId => {
      const doc = byId.get(docId)!;
      return { docId, title: doc.title, float: documentFloatOn(doc, tune.companyId, tune.libraryItemId) };
    });
  }, [tune, inputs]);

  const move = (docId: string, delta: -1 | 1) => {
    if (!tune) return;
    const order = rankRows.map(row => row.docId);
    const from = order.indexOf(docId);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= order.length) return;
    [order[from], order[to]] = [order[to], order[from]];
    setUI({ levelingDistribution: { ...tune, order } });
  };

  const toggleSplits = () => {
    if (!tune) return;
    setUI({ levelingDistribution: { ...tune, allowSplits: !tune.allowSplits } });
  };

  // Waarom Toepassen (nog) uit staat. De eerste drie redenen zijn ECHT en blijven na taak 12
  // bestaan; de vierde is de tijdelijke: het schrijfpad is er (taak 6) maar wordt pas in taak 12
  // bedraad. Er is bewust geen eigen sleutel voor die vierde toestand aangemaakt — hij verdwijnt
  // in taak 12 en zou dan veertien locales met een dode sleutel achterlaten.
  const applyBlockReason = useMemo(() => {
    if (!proposal) return t('resource.distribution.compute.pressRecompute');
    if (proposal.blocked) return t(DISTRIBUTION_BLOCK_KEY[proposal.blocked.reason]);
    const plan = planDistributionWrites(proposal, {});
    if (!plan.ok && plan.reason === 'shortfall') return t('resource.distribution.applyBlockedShortfall');
    return t('resource.distribution.applyBlockedNothing');
  }, [proposal, t]);

  const blockedDocTitles = useMemo(() => {
    if (!proposal?.blocked) return '';
    const byId = new Map(inputs.map(doc => [doc.docId, doc.title]));
    return proposal.blocked.docIds.map(id => byId.get(id) ?? id).join(', ');
  }, [proposal, inputs]);

  const showStale = staleReason !== null || busy;

  return (
    <Dialog
      onBackdropClick={close}
      onCancel={close}
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[960px] max-w-[95vw] max-h-[90vh] flex flex-col overflow-hidden"
      panelProps={{
        'data-ops-distribution-dialog': '',
        ...(lastStaleReason ? { 'data-ops-distribution-last-stale-reason': lastStaleReason } : {}),
      }}
    >
      {/* (1) Kop */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate" style={{ fontFamily: 'var(--font-heading)' }}>
            {tune ? itemName : t('resource.distribution.title')}
          </div>
          <div className="text-[11px] text-text-secondary truncate">
            {tune ? t('resource.distribution.subtitle', { item: itemName }) : t('resource.distribution.selectHint')}
          </div>
        </div>
        <button onClick={close} className="p-1 hover:bg-surface-hover rounded-[8px] shrink-0" title={t('resource.distribution.back')}>
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-xs">
        {!tune ? (
          <div className="text-text-secondary" data-ops-distribution-select-hint>
            {t('resource.distribution.selectHint')}
          </div>
        ) : proposal?.blocked ? (
          /* (2) Blokkade — één vorm voor alle drie de redenen (§3.1: nooit een stille uitsluiting). */
          <div
            className="px-3 py-2 rounded-[8px] border"
            style={{ borderColor: 'var(--error)', color: 'var(--error)' }}
            role="status"
            data-ops-distribution-blocked
          >
            {t(DISTRIBUTION_BLOCK_KEY[proposal.blocked.reason], { docs: blockedDocTitles })}
          </div>
        ) : (
          <>
            {/* (3) Gereedschap — schakelaar met prijskaartje. De prijs is `computeDistribution`
                opnieuw draaien met de andere stand (§6); tot taak 9 die vergelijking maakt staat er
                eerlijk "prijs onbekend". */}
            <section className="flex flex-col gap-1.5">
              <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--theme-text-muted)' }}>
                {t('resource.distribution.tool.title')}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={tune.allowSplits}
                  onClick={toggleSplits}
                  className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${tune.allowSplits ? 'bg-accent' : 'bg-surface-hover border border-border'}`}
                  data-ops-distribution-allow-splits
                >
                  <span
                    className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                    style={{ left: tune.allowSplits ? 18 : 2 }}
                  />
                  <span className="sr-only">{t('resource.distribution.tool.allowSplits')}</span>
                </button>
                <span className="font-medium">{t('resource.distribution.tool.allowSplits')}</span>
                <span className="text-text-secondary" data-ops-distribution-tool-price>
                  {t('resource.distribution.tool.priceUnknown')}
                </span>
              </div>
              <span className="text-[10px] text-text-secondary">{t('resource.distribution.tool.allowSplitsHint')}</span>
            </section>

            {/* (4) Rangorde */}
            <section className="flex flex-col gap-1.5">
              <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--theme-text-muted)' }}>
                {t('resource.distribution.rank.title')}
              </span>
              <span className="text-[10px] text-text-secondary">{t('resource.distribution.rank.hint')}</span>
              <div className="flex flex-col">
                {rankRows.map((row, index) => (
                  <div
                    key={row.docId}
                    className="flex items-center gap-2 px-2 py-1 border-b border-border-light last:border-b-0"
                    data-ops-distribution-rank-row
                    data-ops-doc-id={row.docId}
                  >
                    <span className="tabular-nums text-text-secondary w-5">{index + 1}</span>
                    <span className="truncate font-medium flex-1 min-w-0">{row.title}</span>
                    <span className="tabular-nums text-text-secondary">
                      {t('resource.distribution.rank.float', {
                        days: row.float === null ? '—' : numberFmt.format(row.float),
                      })}
                    </span>
                    <button
                      type="button"
                      className="p-0.5 rounded hover:bg-surface-hover disabled:opacity-40"
                      title={t('resource.distribution.rank.moveUp')}
                      aria-label={t('resource.distribution.rank.moveUp')}
                      disabled={index === 0}
                      onClick={() => move(row.docId, -1)}
                    >
                      <ChevronUp size={13} />
                    </button>
                    <button
                      type="button"
                      className="p-0.5 rounded hover:bg-surface-hover disabled:opacity-40"
                      title={t('resource.distribution.rank.moveDown')}
                      aria-label={t('resource.distribution.rank.moveDown')}
                      disabled={index === rankRows.length - 1}
                      onClick={() => move(row.docId, 1)}
                    >
                      <ChevronDown size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* (5) Fasestroken — taak 9 vult ze; hier alleen de regel per document met het effect. */}
            <section className="flex flex-col gap-1" data-ops-distribution-strips>
              {(proposal?.docs ?? []).map(doc => (
                <div
                  key={doc.docId}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-[8px] border border-border-light"
                  data-ops-distribution-strip
                  data-ops-doc-id={doc.docId}
                >
                  <span className="truncate font-medium flex-1 min-w-0">{doc.title}</span>
                  {!doc.participated && (
                    <span className="text-text-secondary">
                      {doc.pinnedReason === 'dates-as-recorded'
                        ? t('resource.distribution.strip.pinnedRecorded')
                        : t('resource.distribution.strip.pinned')}
                    </span>
                  )}
                  {doc.cannotMove && (
                    <span className="text-text-secondary">{t('resource.distribution.strip.cannotMove')}</span>
                  )}
                  <span className="tabular-nums text-text-secondary" data-ops-distribution-end-shift>
                    {doc.endShiftWorkdays === 0
                      ? t('resource.distribution.strip.endUnchanged')
                      : t('resource.distribution.strip.endShift', { count: doc.endShiftWorkdays })}
                  </span>
                </div>
              ))}
            </section>

            {/* (6) Voor/na-histogram — plaatshouder; taak 9 tekent hem. */}
            <section
              className="rounded-[8px] border border-dashed border-border px-2 py-3 text-text-secondary"
              data-ops-distribution-histogram
            >
              {t('resource.distribution.preview.before')} / {t('resource.distribution.preview.after')} / {t('resource.distribution.preview.capacity')}
            </section>

            {/* Tekorten (§4 stap 3): een geldige preview, maar Toepassen blijft uit. */}
            {proposal?.hasShortfall && (
              <section className="flex flex-col gap-0.5" data-ops-distribution-shortfall>
                <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--theme-text-muted)' }}>
                  {t('resource.distribution.shortfall.title')}
                </span>
                {proposal.docs.filter(doc => doc.shortfalls.length > 0).map(doc => (
                  <span key={doc.docId} style={{ color: 'var(--error)' }}>
                    {t('resource.distribution.shortfall.doc', { doc: doc.title, count: doc.shortfalls.length })}
                  </span>
                ))}
              </section>
            )}
          </>
        )}
      </div>

      {/* (7) Stale-strook + knoppenbalk */}
      <div className="border-t border-border px-4 py-3 flex flex-col gap-2 text-xs bg-surface">
        {degraded && (
          <div className="text-text-secondary" data-ops-distribution-degraded>
            {t('resource.distribution.compute.degraded')}
          </div>
        )}
        {showStale && (
          <div
            className="px-2.5 py-1.5 rounded-[8px] border text-text-secondary"
            style={{
              background: 'color-mix(in srgb, var(--theme-text-dim) 12%, transparent)',
              borderColor: 'var(--theme-text-dim)',
            }}
            role="status"
            data-ops-distribution-stale
            data-ops-distribution-stale-reason={staleReason ?? ''}
          >
            {staleReason
              ? `${t(`resource.distribution.stale.${staleReason}`)}${busy ? ` ${t('resource.distribution.compute.busy')}` : degraded ? ` ${t('resource.distribution.compute.pressRecompute')}` : ''}`
              : t('resource.distribution.compute.busy')}
          </div>
        )}
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            className="px-3 py-1.5 rounded-[8px] border border-border hover:bg-surface-hover disabled:opacity-40"
            onClick={recompute}
            disabled={busy || !tune}
          >
            {proposal === null
              ? t('resource.distribution.compute.auto')
              : t('resource.distribution.compute.recalculate')}
          </button>
          <span className="text-text-secondary flex-1 min-w-0 truncate" data-ops-distribution-apply-reason>
            {applyBlockReason}
          </span>
          <button
            type="button"
            className="px-3 py-1.5 rounded-[8px] bg-accent text-white disabled:opacity-40"
            disabled
            title={applyBlockReason}
          >
            {t('resource.distribution.apply')}
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded-[8px] border border-border hover:bg-surface-hover"
            onClick={close}
          >
            {t('resource.distribution.discard')}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

// B1c-plan3 taak 8 — de verdeeldialoog (spec §7 "plek in de UI", §3.4 "discrete rekenmomenten").
//
// LOSSE DIALOOG, GEEN DRILL-DOWN (besluit eigenaar 2026-08-31). Het patroon is letterlijk dat van
// `LevelingDialog`: een `ui.show*`-vlag, gemount vanuit `App.tsx`, de gedeelde `Dialog` (focus-trap,
// Escape, backdrop) en opgenomen in `hasBlockingDialogOpen()`. Het bezettingsoverzicht blijft
// gewoon zichtbaar ONDER de dialoog — de verdeling is een handeling óp dat overzicht, geen
// vervanging ervan.
//
// WAT HIER (NOG) NIET STAAT. Taak 11 vult het voor/na-histogram. Taak 12 bedraadt "Toepassen" op
// `applyDistribution`. Tot dan staat de knop er wél, maar uitgeschakeld MET REDEN — een knop die er
// niet is laat de gebruiker raden of de functie bestaat.
//
// RANGORDE MET DE MUIS (taak 10, spec §4 stap 1). Native HTML5 drag-and-drop — hetzelfde mechanisme
// als `DataGridHeader`'s kolomherordening (`draggable` + `onDragStart`/`onDragOver`/`onDrop`), niet
// een tweede pointer-events-sleepmechaniek erbij. De lijst is klein en niet virtualized, dus een
// per-rij `onDragOver`/`onDrop` volstaat hier — de window-brede dragover/drop-vangnet-luisteraars die
// de kolomkop nodig heeft (voor een sleep die de headerrij verlaat) zijn voor een rangordelijst met
// eigen scrolgebied niet nodig. De "naar boven/beneden"-knoppen (`move`) blijven de toetsenbordroute
// en het testanker; slepen (`reorderTo`) roept dezelfde `setUI` aan, dus een herordening met de muis
// zet net als de knoppen `staleReason = 'rank'` via `diffReason` in `useDistributionProposal`.
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { useAppStore } from '@/state/appStore';
import { Dialog } from '@/components/common/Dialog';
import { DISTRIBUTION_BLOCK_KEY } from '@/utils/levelingReasonKey';
import { planDistributionWrites } from '@/services/library/applyDistribution';
import { maxUnitsOn } from '@/engine/scheduler/ResourceLoad';
import { buildOccupancyAxis, expandDays } from '@/components/panels/occupancyAxis';
import { parseDate, formatDate, addCalendarDays } from '@/utils/dateUtils';
import { documentFloatOn, useDistributionProposal } from './useDistributionProposal';
import { PhaseStrip } from './PhaseStrip';
import { BeforeAfterChart } from './BeforeAfterChart';

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

  // Slepen (zie het moduleblok): `draggedDocId` is de rij die vastgehouden wordt, `dropTarget` de
  // rij + plaatsing (boven/onder de rijmidden) waar hij op dit moment op zou landen — puur voor
  // visuele feedback tijdens het slepen, `reorderTo` op `onDrop` is het enige commit-moment.
  const [draggedDocId, setDraggedDocId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ docId: string; placement: 'before' | 'after' } | null>(null);

  const reorderTo = (docId: string, targetDocId: string, placement: 'before' | 'after') => {
    if (!tune || docId === targetDocId) return;
    const order = rankRows.map(row => row.docId);
    const from = order.indexOf(docId);
    if (from < 0) return;
    order.splice(from, 1);
    let to = order.indexOf(targetDocId);
    if (to < 0) return;
    if (placement === 'after') to += 1;
    order.splice(to, 0, docId);
    setUI({ levelingDistribution: { ...tune, order } });
  };

  const toggleSplits = () => {
    if (!tune) return;
    setUI({ levelingDistribution: { ...tune, allowSplits: !tune.allowSplits } });
  };

  const setPinned = (docId: string, value: boolean) => {
    if (!tune) return;
    setUI({ levelingDistribution: { ...tune, pinned: { ...tune.pinned, [docId]: value } } });
  };
  const setCeiling = (docId: string, value: number | null) => {
    if (!tune) return;
    setUI({ levelingDistribution: { ...tune, ceilings: { ...tune.ceilings, [docId]: value } } });
  };

  // De BOEKING per document per dag (§6, de gevulde blokken van een fasestrook + taak 11b de
  // VOOR-stand van de voor/na-grafiek). `computeDistribution` levert dat zelf terug als
  // `proposal.bookingByDay` (letterlijk het grootboek dat de kern al opbouwt) — een tweede aanroep
  // van `computeLibraryOccupancy` hier zou stilzwijgend van diezelfde bron kunnen afwijken, dus die
  // is verwijderd; dit leest uitsluitend uit het voorstel dat toch al berekend wordt.
  const bookingByDoc = useMemo(() => {
    const empty = new Map<string, Record<string, number>>();
    if (!proposal || proposal.blocked) return empty;
    return new Map(Object.entries(proposal.bookingByDay));
  }, [proposal]);

  // De GEDEELDE tijdas van alle stroken plus de verticale schaal. De as loopt door tot voorbij de
  // laatste geboekte dag, zodat een gestippelde staart (toegestaan-maar-niet-benut) er nog binnen
  // past; werkdagen worden daarbij als kolommen van één dagbreedte getekend.
  const stripView = useMemo(() => {
    if (!tune || !proposal || proposal.blocked || !poolItem) return null;
    const rankIndex = new Map(rankRows.map((row, index) => [row.docId, index]));
    const docs = [...proposal.docs].sort((a, b) =>
      (rankIndex.get(a.docId) ?? rankRows.length) - (rankIndex.get(b.docId) ?? rankRows.length));

    const days = new Set<string>(Object.keys(proposal.fixedLoadByDay));
    for (const doc of docs) for (const iso of Object.keys(bookingByDoc.get(doc.docId) ?? {})) days.add(iso);
    if (days.size === 0) return { axis: null, docs, scaleMax: 1 };

    const outlook = docs.reduce(
      (n, doc) => Math.max(n, doc.endShiftWorkdays, tune.ceilings[doc.docId] ?? 0), 0);
    if (outlook > 0) {
      const last = [...days].sort()[days.size - 1];
      // Werkdagen → kalenderdagen (5/7) plus een marge, en hoe dan ook begrensd: de staart mag de
      // as verbreden, niet laten ontsporen.
      const extra = Math.min(90, Math.ceil(outlook * 7 / 5) + 2);
      for (const iso of expandDays(
        formatDate(addCalendarDays(parseDate(last), 1)),
        formatDate(addCalendarDays(parseDate(last), extra)),
      )) days.add(iso);
    }

    const axis = buildOccupancyAxis([...days], { targetWidth: 560 });
    let scaleMax = 1;
    if (axis) {
      for (const segment of axis.segments) {
        for (const iso of segment.days) {
          const capacity = maxUnitsOn(poolItem, iso);
          if (capacity > scaleMax) scaleMax = capacity;
          const fixed = proposal.fixedLoadByDay[iso] ?? 0;
          for (const doc of docs) {
            const stacked = fixed + (bookingByDoc.get(doc.docId)?.[iso] ?? 0);
            if (stacked > scaleMax) scaleMax = stacked;
          }
        }
      }
    }
    return { axis, docs, scaleMax };
  }, [tune, proposal, poolItem, rankRows, bookingByDoc]);

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

  // Taak 11b (voor/na-grafiek): welke documenten een tekort houden, met hun teller — dezelfde
  // `DistributionDocResult.shortfalls` als het bestaande tekortblok (7), hier omgezet naar de vorm
  // die `BeforeAfterChart` nodig heeft om de NA-onvolledigheid bij de na-grafiek zelf te melden.
  const shortfallDocs = useMemo(() => {
    if (!proposal || proposal.blocked) return [];
    return proposal.docs
      .filter(doc => doc.shortfalls.length > 0)
      .map(doc => ({ docId: doc.docId, title: doc.title, count: doc.shortfalls.length }));
  }, [proposal]);

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
                    draggable
                    data-ops-distribution-rank-dragging={draggedDocId === row.docId ? 'true' : undefined}
                    data-ops-distribution-rank-drop-before={
                      dropTarget?.docId === row.docId && dropTarget.placement === 'before' ? 'true' : undefined
                    }
                    data-ops-distribution-rank-drop-after={
                      dropTarget?.docId === row.docId && dropTarget.placement === 'after' ? 'true' : undefined
                    }
                    onDragStart={event => {
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('text/plain', row.docId);
                      setDraggedDocId(row.docId);
                    }}
                    onDragOver={event => {
                      if (draggedDocId === null || draggedDocId === row.docId) return;
                      event.preventDefault();
                      const rect = event.currentTarget.getBoundingClientRect();
                      const placement: 'before' | 'after' = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
                      setDropTarget({ docId: row.docId, placement });
                    }}
                    onDrop={event => {
                      event.preventDefault();
                      if (draggedDocId !== null && dropTarget !== null) reorderTo(draggedDocId, dropTarget.docId, dropTarget.placement);
                      setDraggedDocId(null);
                      setDropTarget(null);
                    }}
                    onDragEnd={() => {
                      setDraggedDocId(null);
                      setDropTarget(null);
                    }}
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

            {/* (5) Fasestroken (§6). Eén rij per document, in RANGORDE — dezelfde volgorde als de
                lijst hierboven, zodat een pin of plafond de stroken niet onder de muis vandaan
                herschikt. De legenda benoemt de achtergrondband; de blokken zijn de eigen boeking. */}
            <section className="flex flex-col gap-1" data-ops-distribution-strips>
              <span className="text-[10px] text-text-secondary flex items-center gap-1.5">
                <span
                  className="inline-block rounded-[2px] shrink-0"
                  style={{ width: 8, height: 8, background: 'var(--theme-text-dim)', opacity: 0.35 }}
                />
                {t('resource.distribution.strip.fixedLoad')}
              </span>
              {(stripView?.docs ?? []).map(doc => {
                const recorded = doc.pinnedReason === 'dates-as-recorded';
                return (
                  <PhaseStrip
                    key={doc.docId}
                    docId={doc.docId}
                    title={doc.title}
                    axis={stripView?.axis ?? null}
                    dailyLoad={bookingByDoc.get(doc.docId) ?? {}}
                    fixedLoadByDay={proposal?.fixedLoadByDay ?? {}}
                    scaleMax={stripView?.scaleMax ?? 1}
                    endShiftWorkdays={doc.endShiftWorkdays}
                    ceiling={tune.ceilings[doc.docId] ?? null}
                    pinned={recorded || tune.pinned[doc.docId] === true}
                    recorded={recorded}
                    cannotMove={doc.cannotMove}
                    degraded={degraded}
                    onTogglePin={() => setPinned(doc.docId, tune.pinned[doc.docId] !== true)}
                    onCeilingChange={next => setCeiling(doc.docId, next)}
                  />
                );
              })}
            </section>

            {/* (6) Voor/na-histogram (taak 11b, spec §7): dezelfde as als de fasestroken hierboven. */}
            <section
              className="rounded-[8px] border border-border px-2 py-3"
              data-ops-distribution-histogram
            >
              {poolItem ? (
                <BeforeAfterChart
                  poolItem={poolItem}
                  axis={stripView?.axis ?? null}
                  scaleMax={stripView?.scaleMax ?? 1}
                  docs={(stripView?.docs ?? []).map(doc => ({ docId: doc.docId, title: doc.title }))}
                  bookingByDay={proposal?.bookingByDay ?? {}}
                  afterLoadByDay={proposal?.afterLoadByDay ?? {}}
                  afterIncomplete={proposal?.afterIncomplete ?? false}
                  shortfallDocs={shortfallDocs}
                />
              ) : (
                <span className="text-text-secondary">
                  {t('resource.distribution.preview.before')} / {t('resource.distribution.preview.after')} / {t('resource.distribution.preview.capacity')}
                </span>
              )}
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

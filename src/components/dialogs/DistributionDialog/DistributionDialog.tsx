// B1c-plan3 taak 8 — de verdeeldialoog (spec §7 "plek in de UI", §3.4 "discrete rekenmomenten").
//
// LOSSE DIALOOG, GEEN DRILL-DOWN (besluit eigenaar 2026-08-31). Het patroon is letterlijk dat van
// `LevelingDialog`: een `ui.show*`-vlag, gemount vanuit `App.tsx`, de gedeelde `Dialog` (focus-trap,
// Escape, backdrop) en opgenomen in `hasBlockingDialogOpen()`. Het bezettingsoverzicht blijft
// gewoon zichtbaar ONDER de dialoog — de verdeling is een handeling óp dat overzicht, geen
// vervanging ervan.
//
// TWEE STANDEN (bedieningsreparatie 2026-09-11). Zonder gekozen poolitem (`ui.levelingDistribution
// === null`) is dit een KIEZER: de lijst met bibliotheekitems die nú een conflict hebben over de
// geopende documenten (`DistributionPicker`), plus alleen een sluitknop. Pas met een gekozen item
// verschijnen het voorstel en de knoppenbalk. De weg terug is "Ander item kiezen…" onderin, die de
// tune-state op `null` zet — inclusief het `applied`-record, want dat hoort bij dít item.
//
// TOEPASSEN EN DE TERUGWEG (taak 12, spec §5). De knop is nooit "gewoon uit": hij is
// UITGESCHAKELD MET REDEN, in `applyGate` hieronder — een knop die er niet is (of er grijs staat
// zonder uitleg) laat de gebruiker raden. Na een geslaagd Toepassen woont de terugweg HIER, in een
// permanente strook met "Alles terugdraaien", en niet in het meldingenkanaal: dat kent geen
// actieknoppen en ruimt een `info` na 5 s op. De melding die er daarnaast uit gaat is puur
// informatief.
//
// RANGORDE MET DE MUIS (taak 10, spec §4 stap 1) — POINTER-EVENTS, NIET HTML5-DND.
//
// Dit was native HTML5 drag-and-drop (`draggable` + `onDragStart`/`onDragOver`/`onDrop`), naar het
// model van `DataGridHeader`'s kolomherordening. In de GEBRUIKSTEST van de eigenaar (2026-09-12)
// deed "Sleep om de volgorde te veranderen" simpelweg niets. Dat is geen toeval en ook geen bug in
// deze component: HTML5-dnd hangt aan een apart, door de host geleverd drag-protocol
// (`dragstart` → `DataTransfer` → `drop`) dat buiten een gewoon browsertabblad onbetrouwbaar is.
// De app draait juist óók in een iframe-preview (de t3-omgeving) en in een Tauri-webview (WebKitGTK
// op Linux), en daar wordt de dragstart geregeld door de host afgevangen of nooit uitgezonden —
// dan valt het hele mechanisme stil, zónder foutmelding. Pointer-events kennen dat probleem niet:
// `setPointerCapture` houdt de gebeurtenissen binnen dit document, ongeacht de host.
//
// Het patroon is daarom letterlijk dat van de plafond-handle in `PhaseStrip.tsx`: capture op de
// GREEP zelf (het ⋮⋮-icoon, `cursor: grab`), geen document-brede listeners, één actieve pointer,
// en `pointercancel` als opruimpad. Tijdens het slepen licht de gesleepte rij op en toont de
// doelrij een invoegindicator (inset-boxshadow, dus geen layoutverschuiving).
//
// De "naar boven/beneden"-knoppen (`move`) blijven onveranderd de toetsenbordroute en het
// testanker; slepen (`reorderTo`) roept dezelfde `setUI` aan, dus een herordening met de muis zet
// net als de knoppen `staleReason = 'rank'` via `diffReason` in `useDistributionProposal`.
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, GripVertical, X } from 'lucide-react';
import { useAppStore } from '@/state/appStore';
import { Dialog } from '@/components/common/Dialog';
import { DISTRIBUTION_BLOCK_KEY } from '@/utils/levelingReasonKey';
import { planDistributionWrites } from '@/services/library/applyDistribution';
import { scopeTaskIdsFor } from '@/services/library/distribute';
import { maxUnitsOn } from '@/engine/scheduler/ResourceLoad';
import { buildOccupancyAxis, expandDays } from '@/components/panels/occupancyAxis';
import { parseDate, formatDate, addCalendarDays } from '@/utils/dateUtils';
import { documentFloatOn, useDistributionProposal } from './useDistributionProposal';
import { assignDocColors } from './chartGeometry';
import { PhaseStrip } from './PhaseStrip';
import { DistributionPicker } from './DistributionPicker';
import { BeforeAfterChart } from './BeforeAfterChart';

export function DistributionDialog() {
  const { t, i18n } = useTranslation('common');
  const tune = useAppStore(s => s.ui.levelingDistribution);
  const pools = useAppStore(s => s.pools);
  const setUI = useAppStore(s => s.setUI);
  const notify = useAppStore(s => s.notify);
  const applyDistribution = useAppStore(s => s.applyDistribution);
  const undoDistribution = useAppStore(s => s.undoDistribution);

  const {
    proposal, busy, labelsBusy, staleReason, lastStaleReason, staleDocs, degraded, recompute, inputs,
    costByDoc, toolPrice,
  } = useDistributionProposal(tune);

  // Taak 13 (spec §4 stap 1 / §6): de labels zijn gecachet (zie de hook), maar mogen NOOIT getoond
  // worden zolang het voorstel zelf niet meer bij de documenten hoort — een gecachet getal bij een
  // vervallen voorstel is misleidender dan geen getal. Dus: staleReason of degraded ⇒ altijd de
  // "druk op Herbereken"-tekst, ongeacht wat er nog in de cache staat.
  const labelsValid = staleReason === null && !degraded;
  // De labelpas loopt in eigen macrotasks ná het hoofdvoorstel (fixronde-2 bevinding B6), dus er is
  // een echt venster waarin het voorstel al staat en de getallen nog niet. Dat venster hoort
  // ZICHTBAAR te zijn: "Bezig…" bij de labels, terwijl de hoofdknoppen gewoon bruikbaar blijven —
  // deze pas raakt het voorstel zelf niet. Zonder deze toestand las hetzelfde venster als "druk op
  // Herbereken", terwijl er juist gerekend werd.
  const labelsPending = busy || labelsBusy;
  const costLabel = (docId: string): string => {
    if (labelsPending) return t('resource.distribution.compute.busy');
    const cost = labelsValid ? costByDoc[docId] : undefined;
    if (cost === undefined) return t('resource.distribution.compute.pressRecompute');
    return cost === 0
      ? t('resource.distribution.rank.costNone')
      : t('resource.distribution.rank.cost', { count: cost });
  };
  const priceText = (workdays: number): string => (workdays === 0
    ? t('resource.distribution.tool.priceNone')
    : t('resource.distribution.tool.price', { count: workdays }));
  // Het prijskaartje benoemt WELKE STAND het getal hoort (gebruikstest 2026-09-12, gebrek 1). Er
  // stonden twee kale prijzen naast elkaar ("kost 27 werkdagen uitloop · kost 27 werkdagen
  // uitloop"): zonder "uit:"/"aan:" leest dat als een weergavefout in plaats van als twee standen.
  // En als beide standen even duur zijn — wat op de showcase-fixture aantoonbaar het geval is,
  // want daar lost onderbreken de interne overallocatie van het grote project niet op — is één
  // prijs met "in beide standen" eerlijker dan hetzelfde getal twee keer.
  const toolPriceLabel = (): string => {
    if (labelsPending) return t('resource.distribution.compute.busy');
    if (!labelsValid || !toolPrice) return t('resource.distribution.tool.priceUnknown');
    if (toolPrice.off === toolPrice.on) {
      return t('resource.distribution.tool.priceSame', { price: priceText(toolPrice.off) });
    }
    return `${t('resource.distribution.tool.priceOff', { price: priceText(toolPrice.off) })}`
      + ` · ${t('resource.distribution.tool.priceOn', { price: priceText(toolPrice.on) })}`;
  };
  // Gepind/#63/cannotMove-documenten krijgen GEEN kostenlabel (§4 stap 1: "ze wijken niet") — dat
  // leest rechtstreeks uit het LAATST BEREKENDE voorstel (`participated`/`cannotMove`), niet uit
  // `costByDoc`: die twee vragen zijn onafhankelijk van elkaar (een document kan best deelnemen
  // terwijl zijn label nog niet — of niet meer — gecached is).
  const isCostCandidate = (docId: string): boolean => {
    if (!proposal || proposal.blocked) return false;
    const docResult = proposal.docs.find(d => d.docId === docId);
    return docResult !== undefined && docResult.participated && !docResult.cannotMove;
  };

  const close = () => setUI({ showDistributionDialog: false });

  const poolItem = tune ? pools[tune.companyId]?.resources.find(r => r.id === tune.libraryItemId) : undefined;
  const itemName = poolItem?.name || tune?.libraryItemId || '';

  const numberFmt = useMemo(
    () => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }),
    [i18n.language],
  );

  // De VOLLEDIGE rangorde, inclusief docId's die de LAATSTE run niet gezien heeft (fixronde-2
  // bevinding B10). `rankRows` hieronder toont alleen wat er in `inputs` zit — dat is juist voor de
  // weergave, maar een herordening mag daar niet uit gebouwd worden: `order = rankRows.map(...)`
  // gooide elk id weg dat toevallig niet in het laatste voorstel zat (een document dat nog niet in
  // `inputs` stond omdat er sinds het openen nog niet gerekend is). Die rangorde was dan stilletjes
  // weg. Dus: `tune.order` is de basis, en alleen nieuw gezien docId's sluiten achteraan aan.
  const orderBase = useMemo(() => {
    if (!tune) return [];
    const known = new Set(tune.order);
    return [...tune.order, ...inputs.map(doc => doc.docId).filter(id => !known.has(id))];
  }, [tune, inputs]);

  // De rangordelijst leest UITSLUITEND uit `tune.order` — de bron van waarheid voor de rangorde.
  // Documenten die na het openen zijn bijgekomen sluiten achteraan aan (zie `buildDistributionInputs`).
  const rankRows = useMemo(() => {
    if (!tune) return [];
    const byId = new Map(inputs.map(doc => [doc.docId, doc]));
    return orderBase.filter(id => byId.has(id)).map(docId => {
      const doc = byId.get(docId)!;
      return { docId, title: doc.title, float: documentFloatOn(doc, tune.companyId, tune.libraryItemId) };
    });
  }, [tune, inputs, orderBase]);

  // Eén plaats omhoog/omlaag = een VERWISSELING met de dichtstbijzijnde ZICHTBARE buur binnen
  // `orderBase`. Onbekende id's ertussen worden overgeslagen en blijven op hun eigen index staan —
  // een verwisseling raakt per definitie alleen de twee betrokken plekken (bevinding B10).
  const move = (docId: string, delta: -1 | 1) => {
    if (!tune) return;
    const order = [...orderBase];
    const visible = new Set(rankRows.map(row => row.docId));
    const from = order.indexOf(docId);
    if (from < 0) return;
    let to = from + delta;
    while (to >= 0 && to < order.length && !visible.has(order[to])) to += delta;
    if (to < 0 || to >= order.length) return;
    [order[from], order[to]] = [order[to], order[from]];
    setUI({ levelingDistribution: { ...tune, order } });
  };

  // Slepen verplaatst ÉÉN id binnen `orderBase` (bevinding B10): alleen het gesleepte id wordt
  // eruit gehaald en opnieuw ingevoegd, de rest — inclusief de docId's die dit voorstel niet gezien
  // heeft — houdt zijn onderlinge volgorde.
  const reorderTo = (docId: string, targetDocId: string, placement: 'before' | 'after') => {
    if (!tune || docId === targetDocId) return;
    const order = [...orderBase];
    const from = order.indexOf(docId);
    if (from < 0) return;
    order.splice(from, 1);
    let to = order.indexOf(targetDocId);
    if (to < 0) return;
    if (placement === 'after') to += 1;
    order.splice(to, 0, docId);
    setUI({ levelingDistribution: { ...tune, order } });
  };

  // Slepen (zie het moduleblok): `draggedDocId` is de rij die vastgehouden wordt, `dropTarget` de
  // rij + plaatsing (boven/onder de rijmidden) waar hij op dit moment op zou landen — puur voor
  // visuele feedback tijdens het slepen, het loslaten is het enige commit-moment.
  const [draggedDocId, setDraggedDocId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ docId: string; placement: 'before' | 'after' } | null>(null);
  // De levende rij-elementen, zodat een pointermove de doelrij uit de ECHTE geometrie kan halen.
  // Bij HTML5-dnd deed de browser die hit-test (per-rij `onDragOver`); met pointer capture komen
  // alle moves op de greep binnen, dus doen we het zelf. Een `ref`-map en geen `querySelectorAll`:
  // die zou ook de rijen van een eventuele tweede lijst vangen.
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  // Eén actieve pointer tegelijk (zoals `PhaseStrip`): `moved` onderscheidt een zuivere klik op de
  // greep — die commit niets — van een echte sleep.
  const dragRef = useRef<{ pointerId: number; docId: string; moved: boolean } | null>(null);

  /** De rij + plaatsing onder deze y-coördinaat. Buiten de lijst: de dichtstbijzijnde rand, zodat
   *  een sleep die boven of onder de lijst uitschiet nog steeds een zinnig doel houdt. */
  const dropTargetAt = (clientY: number, dragged: string): { docId: string; placement: 'before' | 'after' } | null => {
    let best: { docId: string; placement: 'before' | 'after'; distance: number } | null = null;
    for (const row of rankRows) {
      if (row.docId === dragged) continue;
      const el = rowRefs.current.get(row.docId);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const middle = rect.top + rect.height / 2;
      const placement: 'before' | 'after' = clientY < middle ? 'before' : 'after';
      const distance = clientY < rect.top ? rect.top - clientY : clientY > rect.bottom ? clientY - rect.bottom : 0;
      if (best === null || distance < best.distance) best = { docId: row.docId, placement, distance };
    }
    return best === null ? null : { docId: best.docId, placement: best.placement };
  };

  const onGripPointerDown = (docId: string) => (event: React.PointerEvent<HTMLSpanElement>) => {
    if (dragRef.current) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, docId, moved: false };
    setDraggedDocId(docId);
    setDropTarget(null);
  };

  const onGripPointerMove = (event: React.PointerEvent<HTMLSpanElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.moved = true;
    setDropTarget(dropTargetAt(event.clientY, drag.docId));
  };

  const endDrag = (commit: boolean) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (commit && drag !== null && drag.moved && dropTarget !== null) {
      reorderTo(drag.docId, dropTarget.docId, dropTarget.placement);
    }
    setDraggedDocId(null);
    setDropTarget(null);
  };

  const onGripPointerUp = (event: React.PointerEvent<HTMLSpanElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    endDrag(true);
  };

  const onGripPointerCancel = (event: React.PointerEvent<HTMLSpanElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    endDrag(false);
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

  // De GEDEELDE tijdas van alle stroken plus de verticale schaal VAN DE STROKEN. De as loopt door
  // tot voorbij de laatste geboekte dag, zodat een gestippelde staart (toegestaan-maar-niet-benut)
  // er nog binnen past; werkdagen worden daarbij als kolommen van één dagbreedte getekend.
  //
  // `scaleMax` hier is bewust de PER-DOCUMENT-schaal: een fasestrook toont de vaste last plus de
  // boeking van ÉÉN document, dus het hoogste van die per-document-stapelingen is precies de juiste
  // bovengrens. De voor/na-grafiek stapelt ALLE documenten en heeft daarom een eigen, hogere schaal
  // (`chartScaleMax` in `chartGeometry.ts`) — deze waarde daar hergebruiken liet het conflict
  // letterlijk van de grafiek af vallen (fixronde-2 bevinding B1).
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

  // Eén kleurtoewijzing voor de hele dialoog (fixronde-2 bevinding B9): de fasestroken EN de
  // legenda/staven van de voor/na-grafiek lezen dezelfde map, zodat "project B" boven en onder
  // dezelfde kleur heeft. Stond dit in de grafiek, dan tekende de strook zijn boeking in het
  // accentkleur en klopte de belofte "strook en grafiek matchen" alleen op de x-as.
  const docColors = useMemo(
    () => assignDocColors((stripView?.docs ?? []).map(doc => doc.docId)),
    [stripView],
  );

  const blockedDocTitles = useMemo(() => {
    if (!proposal?.blocked) return '';
    const byId = new Map(inputs.map(doc => [doc.docId, doc.title]));
    return proposal.blocked.docIds.map(id => byId.get(id) ?? id).join(', ');
  }, [proposal, inputs]);

  // De taken die dit poolitem daadwerkelijk boeken, per document — de scope waarbinnen
  // `applyLeveling` mag schrijven (§5, scope-behoudend toepassen). Bewust dezelfde `scopeTaskIdsFor`
  // op dezelfde `inputs` als `computeDistribution` intern gebruikt: `DistributionDocResult` draagt de
  // lijst niet, en een tweede afleiding zou stilzwijgend van de gerekende snit kunnen afwijken.
  const scopeTaskIdsByDoc = useMemo(() => {
    const out: Record<string, string[]> = {};
    if (!tune) return out;
    for (const doc of inputs) out[doc.docId] = scopeTaskIdsFor(doc, tune.companyId, tune.libraryItemId);
    return out;
  }, [inputs, tune]);

  // Waarom Toepassen wel of niet mag — en zo niet, met welke tekst (spec §4 stap 3: validatie wijst
  // altijd een uitweg aan). De volgorde is die van de taakomschrijving: eerst "er is nog niets",
  // dan de blokkade, dan het tekort, dan een vervallen voorstel, en pas daarna het triviale
  // "er valt niets te schrijven".
  const applyGate = useMemo<{ ok: boolean; reason: string }>(() => {
    if (busy) return { ok: false, reason: t('resource.distribution.compute.busy') };
    if (!proposal) return { ok: false, reason: t('resource.distribution.compute.pressRecompute') };
    if (proposal.blocked) {
      return { ok: false, reason: t(DISTRIBUTION_BLOCK_KEY[proposal.blocked.reason], { docs: blockedDocTitles }) };
    }
    if (proposal.hasShortfall) return { ok: false, reason: t('resource.distribution.applyBlockedShortfall') };
    if (staleReason !== null) {
      return { ok: false, reason: t(`resource.distribution.stale.${staleReason}`, { docs: staleDocs }) };
    }
    const plan = planDistributionWrites(proposal, scopeTaskIdsByDoc);
    if (!plan.ok) {
      return {
        ok: false,
        reason: plan.reason === 'shortfall'
          ? t('resource.distribution.applyBlockedShortfall')
          : t('resource.distribution.applyBlockedNothing'),
      };
    }
    return { ok: true, reason: '' };
  }, [busy, proposal, staleReason, staleDocs, blockedDocTitles, scopeTaskIdsByDoc, t]);

  /** Het laatst toegepaste record — leeft in de tune-state en overleeft dus een sluiting van de
   *  dialoog (§7) én een documentwissel (fixronde B1c-etappe-3, bevinding B3), zodat opnieuw openen
   *  op hetzelfde poolitem de terugweg nog toont. Dat laatste is essentieel: een verdeling schrijft
   *  in MEERDERE documenten, en die beoordeel je door ernaartoe te wisselen — de dialoog gaat daarbij
   *  dicht (`resetDocumentScopedUI`), maar "Alles terugdraaien" moet daarna nog bestaan. */
  const applied = tune?.applied ?? null;

  const onApply = () => {
    if (!proposal || !applyGate.ok) return;
    const outcome = applyDistribution(proposal, scopeTaskIdsByDoc);
    // Mislukt = ZICHTBAAR mislukt (fixronde B1c-etappe-3, bevinding B5). Dit pad is bereikbaar
    // ondanks `applyGate`: de poort kijkt naar de render, de store naar het moment van de klik — een
    // document dat er tussendoor uitvalt, of een slaper waarvan de doorrekening vastloopt, komt hier
    // uit. Vóór deze ronde deed de knop dan geruisloos niets. `detail` draagt de rauwe reden; de
    // vertaalde tekst blijft één zin (het meldingenkanaal kent geen actieknoppen).
    if (!outcome.ok) {
      notify({
        severity: 'error',
        messageKey: 'notifications.distributionApplyFailed',
        detail: outcome.error ?? outcome.reason,
      });
      return;
    }
    const record = outcome.record;
    const current = useAppStore.getState().ui.levelingDistribution;
    if (current) setUI({ levelingDistribution: { ...current, applied: record } });
    // Puur informatief (spec §5) — de terugweg is de strook hieronder, niet deze melding.
    notify({
      severity: 'info',
      messageKey: 'resource.distribution.applied',
      params: { count: record.docs.length },
    });
    // Er is nu in élk beschreven document gemuteerd; de vingerafdruk-bewaking in
    // `useDistributionProposal` ziet dat vanzelf en zet `staleReason = 'edited'`. Dat is exact wat
    // §6a voorschrijft en vraagt hier dus geen eigen tak: het voorstel op het scherm hóórt niet
    // meer bij de documenten, en Toepassen gaat daarmee op slot tot "Herbereken".
  };

  const onUndoAll = () => {
    if (!applied) return;
    const report = undoDistribution(applied);
    const current = useAppStore.getState().ui.levelingDistribution;
    if (current) setUI({ levelingDistribution: { ...current, applied: null } });
    if (report.skippedDocIds.length > 0) {
      const byId = new Map(applied.docs.map(doc => [doc.docId, doc.title]));
      notify({
        // Het meldingenkanaal kent alleen `error` en `info` (K8a). Een gedeeltelijke terugdraaiing
        // is geen fout, maar mág niet na 5 s verdwijnen: de gebruiker denkt anders dat álles terug
        // is terwijl één project zijn vertraging houdt. `error` is de enige plakkende severity.
        severity: 'error',
        messageKey: 'resource.distribution.undonePartial',
        params: { docs: report.skippedDocIds.map(id => byId.get(id) ?? id).join(', ') },
      });
    } else {
      notify({ severity: 'info', messageKey: 'resource.distribution.undoneAll' });
    }
  };

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
          {/* De kiezer-stand zet zijn eigen uitleg boven de lijst (en zijn eigen zin wanneer er
              niets te kiezen valt); die hier herhalen gaf een kop die "kies een conflict" zei boven
              een paneel dat meldt dat er geen conflict is. */}
          {tune && (
            <div className="text-[11px] text-text-secondary truncate">
              {t('resource.distribution.subtitle', { item: itemName })}
            </div>
          )}
          {/* Eén regel die de hele handeling uitlegt (gebruikstest 2026-09-12, gebrek 4). Bewust
              NIET afgekapt (`truncate`) zoals de ondertitel erboven: een uitleg die halverwege
              ophoudt met "…" legt niets uit. */}
          {tune && (
            <div className="text-[11px] text-text-secondary mt-0.5" data-ops-distribution-intro>
              {t('resource.distribution.intro')}
            </div>
          )}
        </div>
        <button onClick={close} className="p-1 hover:bg-surface-hover rounded-[8px] shrink-0" title={t('resource.distribution.back')}>
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-xs">
        {!tune ? (
          /* (1b) KIEZER-STAND (bedieningsreparatie 2026-09-11). Zonder gekozen poolitem stond hier
             alleen `selectHint` plus drie uitgeschakelde knoppen — een dialoog waarin niets kon.
             Nu is de lege stand de keuzelijst zelf; zie `DistributionPicker`. */
          <DistributionPicker />
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
            {/* (3) Gereedschap — schakelaar met prijskaartje (taak 13, spec §6): `computeDistribution`
                één keer met `allowSplits: false` en één keer met `true` — de prijs is de grootste
                `endShiftWorkdays` over de deelnemers. Gecachet in de hook tot invalidatie; zolang het
                voorstel niet actueel is staat er eerlijk "prijs onbekend". */}
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
                  // Gebruikstest 2026-09-12, gebrek 3: de knop stond niet gecentreerd. Drie
                  // oorzaken, alle drie geometrie — en de kern is dat de wortel-fontgrootte in deze
                  // app 13px is, niet 16px. Tailwind's `w-9`/`h-5`/`w-4` zijn rem-maten, dus het
                  // spoor is 29,25 × 16,25 px en de knop 13 × 13 px; de `left`-waarden stonden in
                  // VASTE pixels en klopten dus met geen enkele stand. (a) Verticaal zette
                  // `top-0.5` (2px) de knop te hoog — nu centreert `top-1/2 -translate-y-1/2`
                  // exact, ongeacht de fontgrootte. (b) De rand zat alléén in de uit-stand, dus de
                  // binnenbreedte sprong tussen de standen; nu heeft het spoor in BEIDE standen een
                  // rand (in de aan-stand in de accentkleur, dus onzichtbaar). (c) De marge staat
                  // nu in dezelfde rem-basis als de knop zelf: `0.125rem` links in de uit-stand en
                  // `calc(100% - 1rem - 0.125rem)` in de aan-stand — `100%` is de binnenbreedte van
                  // het spoor, dus links en rechts blijft per definitie evenveel over. Het blijft
                  // een `left`, zodat de knop nog steeds glijdt in plaats van te springen.
                  className={`relative w-9 h-5 rounded-full transition-colors shrink-0 border ${tune.allowSplits ? 'bg-accent border-accent' : 'bg-surface-hover border-border'}`}
                  data-ops-distribution-allow-splits
                  title={t('resource.distribution.help.allowSplits')}
                >
                  <span
                    className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white transition-all"
                    style={{ left: tune.allowSplits ? 'calc(100% - 1rem - 0.125rem)' : '0.125rem' }}
                  />
                  <span className="sr-only">{t('resource.distribution.tool.allowSplits')}</span>
                </button>
                <span className="font-medium" title={t('resource.distribution.help.allowSplits')}>
                  {t('resource.distribution.tool.allowSplits')}
                </span>
                <span
                  className="text-text-secondary"
                  title={t('resource.distribution.help.price')}
                  data-ops-distribution-tool-price
                >
                  {toolPriceLabel()}
                </span>
              </div>
              <span className="text-[10px] text-text-secondary">{t('resource.distribution.tool.allowSplitsHint')}</span>
            </section>

            {/* (4) Rangorde */}
            <section className="flex flex-col gap-1.5">
              <span
                className="text-[10px] uppercase tracking-wide"
                style={{ color: 'var(--theme-text-muted)' }}
                title={t('resource.distribution.help.rank')}
              >
                {t('resource.distribution.rank.title')}
              </span>
              <span className="text-[10px] text-text-secondary" title={t('resource.distribution.help.rank')}>
                {t('resource.distribution.rank.hint')}
              </span>
              <div className="flex flex-col">
                {rankRows.map((row, index) => (
                  <div
                    key={row.docId}
                    ref={el => {
                      if (el) rowRefs.current.set(row.docId, el);
                      else rowRefs.current.delete(row.docId);
                    }}
                    className={`flex items-center gap-2 px-2 py-1 border-b border-border-light last:border-b-0 ${
                      draggedDocId === row.docId ? 'bg-surface-hover' : ''}`}
                    // De invoegindicator is een INSET-boxshadow en geen border: een echte rand van
                    // 2px zou de rij hoger maken en de lijst onder de muis laten verspringen —
                    // precies tijdens het mikken.
                    style={{
                      boxShadow: dropTarget?.docId === row.docId
                        ? dropTarget.placement === 'before'
                          ? 'inset 0 2px 0 0 var(--accent)'
                          : 'inset 0 -2px 0 0 var(--accent)'
                        : undefined,
                    }}
                    data-ops-distribution-rank-row
                    data-ops-doc-id={row.docId}
                    data-ops-distribution-rank-dragging={draggedDocId === row.docId ? 'true' : undefined}
                    data-ops-distribution-rank-drop-before={
                      dropTarget?.docId === row.docId && dropTarget.placement === 'before' ? 'true' : undefined
                    }
                    data-ops-distribution-rank-drop-after={
                      dropTarget?.docId === row.docId && dropTarget.placement === 'after' ? 'true' : undefined
                    }
                  >
                    {/* De GREEP (gebruikstest 2026-09-12, gebrek 2). Slepen was onzichtbaar: de hele
                        rij was `draggable`, zonder greep en zonder `cursor: grab`, dus niets aan de
                        rij verried dat hij te verslepen was — laat staan dat het mechanisme het in
                        een webview deed. `touchAction: 'none'` houdt de sleep bij de pointer in
                        plaats van bij de scroll van de dialoog. */}
                    <span
                      role="button"
                      tabIndex={-1}
                      aria-label={t('resource.distribution.rank.drag')}
                      title={t('resource.distribution.help.dragHandle')}
                      className="shrink-0 text-text-secondary hover:text-text-primary"
                      style={{ cursor: draggedDocId === row.docId ? 'grabbing' : 'grab', touchAction: 'none' }}
                      data-ops-distribution-rank-grip
                      onPointerDown={onGripPointerDown(row.docId)}
                      onPointerMove={onGripPointerMove}
                      onPointerUp={onGripPointerUp}
                      onPointerCancel={onGripPointerCancel}
                    >
                      <GripVertical size={13} />
                    </span>
                    <span className="tabular-nums text-text-secondary w-5">{index + 1}</span>
                    <span className="truncate font-medium flex-1 min-w-0">{row.title}</span>
                    <span className="tabular-nums text-text-secondary">
                      {t('resource.distribution.rank.float', {
                        days: row.float === null ? '—' : numberFmt.format(row.float),
                      })}
                    </span>
                    {isCostCandidate(row.docId) && (
                      <span
                        className="tabular-nums text-text-secondary"
                        title={t('resource.distribution.help.rankCost')}
                        data-ops-distribution-cost
                      >
                        {costLabel(row.docId)}
                      </span>
                    )}
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
                    color={docColors.get(doc.docId) ?? 'var(--theme-accent)'}
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
              title={t('resource.distribution.help.chart')}
              data-ops-distribution-histogram
            >
              {poolItem ? (
                <BeforeAfterChart
                  poolItem={poolItem}
                  axis={stripView?.axis ?? null}
                  docs={(stripView?.docs ?? []).map(doc => ({ docId: doc.docId, title: doc.title }))}
                  docColors={docColors}
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

      {/* (7) Stale-strook + knoppenbalk.

          IN DE KIEZER-STAND STAAT HIER NIETS BEHALVE "SLUITEN" (bedieningsreparatie 2026-09-11).
          "Verdeel automatisch", "Toepassen" en "Verwerpen" slaan zonder gekozen poolitem nergens
          op; ze stonden er grijs, en drie grijze knoppen lezen als "deze functie is stuk" in plaats
          van "kies eerst iets". De handeling die hier wél bestaat — een item kiezen — staat in het
          paneel erboven. */}
      <div className="border-t border-border px-4 py-3 flex flex-col gap-2 text-xs bg-surface">
        {!tune ? (
          <div className="flex items-center justify-end">
            <button
              type="button"
              className="px-3 py-1.5 rounded-[8px] border border-border hover:bg-surface-hover"
              onClick={close}
            >
              {t('close')}
            </button>
          </div>
        ) : (
        <>
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
              ? `${t(`resource.distribution.stale.${staleReason}`, { docs: staleDocs })}${busy ? ` ${t('resource.distribution.compute.busy')}` : degraded || staleReason === 'edited' ? ` ${t('resource.distribution.compute.pressRecompute')}` : ''}`
              : t('resource.distribution.compute.busy')}
          </div>
        )}

        {/* Spec §5: de terugweg woont HIER, niet in het meldingenkanaal (dat kent geen actieknoppen
            en ruimt info na 5 s op). Permanent zolang het record geldig is — hij verdwijnt alleen
            door "Alles terugdraaien" of doordat een NIEUW Toepassen hem vervangt. */}
        {applied && (
          <div
            className="px-2.5 py-1.5 rounded-[8px] border flex items-center gap-2"
            style={{
              background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
              borderColor: 'var(--accent)',
            }}
            role="status"
            data-ops-distribution-applied
          >
            <span className="flex-1 min-w-0">
              {t('resource.distribution.applied', { count: applied.docs.length })}
            </span>
            <button
              type="button"
              className="px-2 py-1 rounded-[8px] border border-border bg-surface hover:bg-surface-hover shrink-0"
              onClick={onUndoAll}
            >
              {t('resource.distribution.undoAll')}
            </button>
          </div>
        )}
        <div className="flex items-center justify-end gap-2">
          {/* Terug naar de kiezer. Geen bevestigingsdialoog (die zou over een dialoog heen moeten,
              en `hasBlockingDialogOpen` weert dat terecht) — in plaats daarvan ZEGT de knop wat er
              verdwijnt zodra er een `applied`-record staat: twee losse sleutels, want de waarschuwende
              variant is een andere zin en geen ingevulde parameter. `levelingDistribution: null` is
              de bestaande regel "ander poolitem = verse tune-state": het `applied`-record hoort bij
              dít item en vervalt dus mee. De terugdraai-strook is daarmee weg, de schrijfactie in de
              documenten blijft staan (die draai je terug met de gewone undo per document). */}
          <button
            type="button"
            className="px-3 py-1.5 rounded-[8px] border border-border hover:bg-surface-hover mr-auto"
            data-ops-distribution-pick-another
            title={t('resource.distribution.help.pickAnother')}
            onClick={() => setUI({ levelingDistribution: null })}
          >
            {applied
              ? t('resource.distribution.pickAnotherApplied')
              : t('resource.distribution.pickAnother')}
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded-[8px] border border-border hover:bg-surface-hover disabled:opacity-40"
            onClick={recompute}
            disabled={busy}
            title={t('resource.distribution.help.recompute')}
          >
            {proposal === null
              ? t('resource.distribution.compute.auto')
              : t('resource.distribution.compute.recalculate')}
          </button>
          <span className="text-text-secondary flex-1 min-w-0 truncate" data-ops-distribution-apply-reason>
            {applyGate.reason}
          </span>
          <button
            type="button"
            className="px-3 py-1.5 rounded-[8px] bg-accent text-white disabled:opacity-40"
            disabled={!applyGate.ok}
            title={applyGate.reason || t('resource.distribution.help.apply')}
            onClick={onApply}
          >
            {t('resource.distribution.apply')}
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded-[8px] border border-border hover:bg-surface-hover"
            title={t('resource.distribution.help.discard')}
            onClick={close}
          >
            {t('resource.distribution.discard')}
          </button>
        </div>
        </>
        )}
      </div>
    </Dialog>
  );
}

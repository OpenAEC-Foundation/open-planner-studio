import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import type { CompanyPool } from '@/types/library';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { Task } from '@/types/task';
import type { DocumentPayload } from '@/state/documentContract';
import {
  computeLibraryOccupancy,
  type OccupancyDocInput,
  type OccupancyRow,
} from '@/services/library/occupancy';
import { documentTitle, untitledOrdinals, displayDocumentTitle, DOC_PALETTE } from '@/utils/documents';
import { maxUnitsOn } from '@/engine/scheduler/ResourceLoad';
import { parseDate, formatDate, addCalendarDays, diffDays } from '@/utils/dateUtils';

/** Maximaal getoonde conflictdatums in de badge-tooltip/subregel (§5: "max. ~5, dan …"). */
const MAX_CONFLICT_DATES_SHOWN = 5;

/** De bibliotheek-relevante snit van één documentpayload (§7-cache, zie `librarySlice`). */
export interface LibrarySlice {
  resources: Resource[];
  assignments: ResourceAssignment[];
  tasks: Task[];
}

/** Alleen de documentvelden die het bezettingsoverzicht werkelijk leest. */
type OccupancyPayload = Pick<
  DocumentPayload,
  | 'project'
  | 'filePath'
  | 'resources'
  | 'assignments'
  | 'tasks'
  | 'sequences'
  | 'calendar'
  | 'calendars'
  | 'scheduleStale'
>;

/**
 * Expliciet cache-eigenaarsrecord. De company en de concrete poolreferentie zijn onderdeel van de
 * sleutel; de WeakMap daarbinnen mag daarom uitsluitend payloads uit die ene context bevatten.
 */
export interface LibrarySliceCache {
  companyId: string;
  pool: CompanyPool;
  slices: WeakMap<OccupancyPayload, LibrarySlice>;
}

/**
 * De bibliotheek-relevante snit van een payload: alleen de resources met een stempel naar déze
 * bibliotheek én een nog bestaand poolitem, alleen de toewijzingen op díé resources, en alleen de
 * taken waar die toewijzingen naar wijzen.
 *
 * Dit is de per-payload-cachebare helft van de §7-maatregel (critreview bevinding 4). De snit is
 * aantoonbaar betekenis-behoudend voor wat `computeLibraryOccupancy` uit het resultaat leest:
 * `computeResourceLoad` bouwt `load[resourceId]` per resource onafhankelijk op uit de toewijzingen
 * van díé resource, en de leaf-/mijlpaalfilter kijkt uitsluitend naar de taak van de toewijzing
 * zelf (`task.isMilestone`, `task.childIds`) — niet naar broers of ouders. De velden die wél over
 * álle resources gaan (`capacity`, `overallocatedDays`) leest de bezettingskern niet; hij gebruikt
 * de POOL-capaciteit via `maxUnitsOn` (§6). De kern filtert `resources` bovendien zelf op precies
 * dezelfde stempelvoorwaarde, dus vooraf snijden verandert zijn `stampedResources` niet.
 */
function librarySlice(payload: OccupancyPayload, companyId: string, poolItemIds: Set<string>): LibrarySlice {
  const resources = payload.resources.filter(r =>
    r.libraryOrigin !== undefined &&
    r.libraryOrigin.companyId === companyId &&
    poolItemIds.has(r.libraryOrigin.libraryItemId));
  if (resources.length === 0) return { resources: [], assignments: [], tasks: [] };
  const resourceIds = new Set(resources.map(r => r.id));
  const assignments = payload.assignments.filter(a => resourceIds.has(a.resourceId));
  const taskIds = new Set(assignments.map(a => a.taskId));
  return { resources, assignments, tasks: payload.tasks.filter(task => taskIds.has(task.id)) };
}

/**
 * Vind of bouw de bibliotheeksnit met een zichtbare company-/poolgrens. Dit is los van React
 * gehouden zodat dezelfde payload-referentie aantoonbaar niet tussen twee bibliotheken kan lekken.
 */
export function resolveLibrarySliceCache(
  current: LibrarySliceCache | undefined,
  payload: OccupancyPayload,
  companyId: string,
  pool: CompanyPool,
): { cache: LibrarySliceCache; slice: LibrarySlice } {
  const cache = current?.companyId === companyId && current.pool === pool
    ? current
    : { companyId, pool, slices: new WeakMap<OccupancyPayload, LibrarySlice>() };
  let slice = cache.slices.get(payload);
  if (slice === undefined) {
    slice = librarySlice(payload, companyId, new Set(pool.resources.map(resource => resource.id)));
    cache.slices.set(payload, slice);
  }
  return { cache, slice };
}

/**
 * B1b — bezettingsoverzicht per bibliotheek over álle open documenten (spec
 * 2026-08-14-b1b-bezettingsoverzicht-design.md §5/§5a, herzien na critreview). Derde stand van de
 * Resources-schakelaar (`ui.resourcesView === 'occupancy'`, gerenderd vanuit `ResourcePanel` onder
 * dezelfde `linked`-conditie als de Bibliotheekweergave). Leesvenster: er valt hier niets te
 * muteren.
 *
 * Aanlevering (§4.4): het actieve document wordt uit expliciet geabonneerde top-level velden
 * opgebouwd; slapende documenten komen per referentie uit `documents`. De zware memo leest dus
 * geen verse storewaarde via een stabiele getter die onzichtbaar buiten zijn dependencylijst valt.
 *
 * Stale documenten (§4.3b): de kern rekent ze efemeer door op een kloon van hun taken — deze
 * weergave levert daarvoor `solveInput` aan (volledige taken/relaties + de projectopties) en zo'n
 * document telt gewoon mee (`counted: true`) met `scheduleStale: true` als INFORMATIEVE markering
 * (`staleComputedDoc`/`staleComputedBanner`, hint-stijl — geen fout): de cijfers verschijnen gewoon
 * en het document doet gewoon mee in de som, de chart en de legenda. Lukt de solve niet (cyclus,
 * solverfout), dan valt het document terug op het vangnet (§4.3): `counted: false`, geen cijfers —
 * die booking blijft de bestaande "—"-subregel met ⚠ en de staleDoc-uitleg. De banner kiest tussen
 * de twee: minstens één ONGETELDE booking ⇒ de bestaande waarschuwing (`staleBanner`); zijn er
 * alléén gételde stale boekingen ⇒ de informatieve variant (`staleComputedBanner`). Een rij met
 * uitsluitend ongetelde boekingen toont "—" voor periode/piek, krijgt nooit een conflictbadge en
 * bij selectie geen chart maar de stale-uitleg.
 *
 * Uitzondering op §4.3b — het ACTIEVE document (perf-poort, TODO na de critreview van v2026.8.0):
 * dat krijgt `skipEphemeralSolve` mee en wordt hier dus nooit doorgerekend. Reden: elke bewerking
 * daarin invalideert de zware memo, dus anders draait er per toetsaanslag een volledige CPM-solve
 * synchroon in de render. Het telt gewoon mee met zijn laatst berekende cijfers — dezelfde
 * staleness die de Gantt ernaast toont — en krijgt de derde markering
 * (`staleAsShownDoc`/`staleAsShownBanner`) in plaats van de "alvast doorgerekend"-variant. Staat
 * "Automatisch berekenen" aan, dan lopen die cijfers hooguit één debounce-tick achter.
 *
 * Prestaties (§7): lazy — dit component mount alleen in de Bezettingsweergave — en één `useMemo`
 * rond `computeLibraryOccupancy`, met als afhankelijkheden de identiteiten van `s.documents`, de
 * pool en de top-level velden van het actieve document, PLUS `s.project` en `s.filePath` (de
 * titelafleiding leest die twee; zonder deze deps bevriezen de titels na hernoemen/Opslaan-als —
 * critreview bevinding 3, zelfde dep-lijst als `useDocumentCards`).
 *
 * Per-payload-cache (§7, critreview bevinding 4) — met een BEWUSTE AFWIJKING van de letterlijke
 * ontwerptekst. Zolang de weergave openstaat is elke bewerking in het actieve document een
 * memo-invalidatie; zonder maatregel rekent dan de volledige load van álle N documenten opnieuw.
 * De `WeakMap` hier is gesleuteld op payload-referentie (slapende payloads zijn referentiestabiel,
 * het actieve document krijgt bij een relevante edit een nieuwe expliciete invoer) en cachet de bibliotheek-snit
 * van elk document (`librarySlice`). Wat het ontwerp beschrijft — de gecachte per-document-LOAD,
 * zodat alleen het actieve document nog rekent — kan hier niet: `computeLibraryOccupancy` rekent
 * die load intern en accepteert niets voorgerekends, en de kern openbreken valt buiten deze
 * wijziging (de aggregatie in de weergave nabouwen zou de conflictdefinitie van §6 een tweede bron
 * geven — precies wat §5a verbiedt). Het effect van de gekozen snit: de engine-pass per document
 * schaalt niet meer met de projectgrootte maar met het aantal bibliotheekboekingen erin, en de
 * snit zelf wordt per bewerking nog maar voor één document gedaan. Restkost per bewerking:
 * O(actief document) + O(N × bibliotheekboekingen), i.p.v. O(N × volledig document).
 *
 * De §5a-chart rendert alleen voor de geselecteerde rij en memoïseert zijn volledige geometrie
 * (segmentindeling, staven, capaciteitspaden, labels) op [row, poolItem].
 */
export function ResourceOccupancyView({ companyId, pool }: { companyId: string; pool: CompanyPool }) {
  const { t, i18n } = useTranslation('common');

  // §7-invoer. Elk actief documentveld dat de bezettingsberekening of titel leest, wordt
  // geabonneerd en verderop tot één OccupancyPayload samengevoegd. Geen hidden getter-read.
  const documents = useAppStore(s => s.documents);
  const activeProject = useAppStore(s => s.project);
  const activeFilePath = useAppStore(s => s.filePath);
  const activeResources = useAppStore(s => s.resources);
  const activeAssignments = useAppStore(s => s.assignments);
  const activeTasks = useAppStore(s => s.tasks);
  const activeSequences = useAppStore(s => s.sequences);
  const activeCalendar = useAppStore(s => s.calendar);
  const activeCalendars = useAppStore(s => s.calendars);
  const activeScheduleStale = useAppStore(s => s.scheduleStale);

  // §4.3b terugschrijfbesluit: staat "Automatisch berekenen" aan, dan worden verouderde SLAPENDE
  // documenten hier écht bijgewerkt in plaats van alleen efemeer doorgerekend (het actieve document
  // heeft zijn eigen pad, `useAutoCalcCPM`). Zie het effect verderop.
  const autoCalcCPM = useAppStore(s => s.ui.autoCalcCPM);
  const activeDocumentId = useAppStore(s => s.activeDocumentId);
  const recalculateStaleSleepingDocuments = useAppStore(s => s.recalculateStaleSleepingDocuments);

  const untitledLabel = t('project.untitled');

  const activeOccupancyPayload = useMemo<OccupancyPayload>(() => ({
    project: activeProject,
    filePath: activeFilePath,
    resources: activeResources,
    assignments: activeAssignments,
    tasks: activeTasks,
    sequences: activeSequences,
    calendar: activeCalendar,
    calendars: activeCalendars,
    scheduleStale: activeScheduleStale,
  }), [
    activeProject, activeFilePath, activeResources, activeAssignments, activeTasks, activeSequences,
    activeCalendar, activeCalendars, activeScheduleStale,
  ]);

  const openDocumentPayloads = useMemo(
    () => documents.map(document => ({
      id: document.id,
      payload: document.id === activeDocumentId ? activeOccupancyPayload : document.payload!,
    })),
    [documents, activeDocumentId, activeOccupancyPayload],
  );

  // §7-cache: de ref bewaart maximaal één expliciet benoemde company/pool-context. Een andere
  // bibliotheek of een nieuwe Immer-poolreferentie vervangt het hele record.
  const sliceCacheRef = useRef<LibrarySliceCache | undefined>(undefined);

  // Hoeveel SLAPENDE documenten een verouderde planning dragen. Goedkoop (een scan over de
  // registry-entries, geen engine-werk) en het is de enige trigger die het effect hieronder nodig
  // heeft: de bijgewerkte payloads laten de teller vanzelf naar 0 lopen.
  const staleSleepingCount = useMemo(
    () => documents.reduce(
      (n, d) => n + (d.id !== activeDocumentId && d.payload?.scheduleStale === true ? 1 : 0),
      0,
    ),
    [documents, activeDocumentId],
  );

  // §4.3b, terugschrijven mét "Automatisch berekenen" (besluit eigenaar 2026-08-14, tweede ronde).
  // Staat de instelling AAN, dan is het onlogisch dat de gebruiker alsnog F5 moet drukken in een
  // document dat dit overzicht al heeft doorgerekend: de slapende stale documenten worden hier écht
  // bijgewerkt (taken/`cpmResult`/`scheduleStale: false`) en hun ⚠ verdwijnt. Staat hij UIT, dan
  // gebeurt er niets — dan blijft het overzicht een leesvenster dat efemeer rekent en nooit
  // terugschrijft (issue #63, handmatige rekenaars).
  //
  // Geen oneindige lus: de actie zet `scheduleStale` op false, dus `staleSleepingCount` daalt naar 0
  // en de conditie dooft. Blijft er een document over dat niet kan rekenen (relatiecyclus), dan
  // muteert de actie helemaal niets — geen nieuwe `documents`-referentie, dus ook geen nieuwe render
  // die dit effect opnieuw zou starten. De ref is de expliciete her-entree-garantie: de actie is
  // synchroon, maar hij muteert de store waarop dit component zelf geabonneerd is.
  const recalcRunning = useRef(false);
  useEffect(() => {
    if (!autoCalcCPM || staleSleepingCount === 0 || recalcRunning.current) return;
    recalcRunning.current = true;
    try {
      recalculateStaleSleepingDocuments();
    } finally {
      recalcRunning.current = false;
    }
  }, [autoCalcCPM, staleSleepingCount, recalculateStaleSleepingDocuments]);

  const { rows, anyUncountedStale, anyCountedStale, anyStaleAsShown, docColors } = useMemo(() => {
    const payloads = openDocumentPayloads;
    // Zelfde titel-afleiding als de tabbladen: rauwe titels eerst, dan volgnummers voor naamloze
    // documenten, dan het vertaalde label eromheen (zie `getOpenDocuments`/`useDocumentCards`).
    const rawTitles = payloads.map(({ payload }) => documentTitle(payload.filePath, payload.project.name));
    const ordinals = untitledOrdinals(rawTitles);
    const inputs: OccupancyDocInput[] = payloads.map(({ id, payload }, i) => {
      // Perf-poort (TODO na de critreview van v2026.8.0): het ACTIEVE document wordt hier NIET
      // efemeer doorgerekend. Elke bewerking daarin invalideert deze memo, dus anders draait er per
      // toetsaanslag een volledige CPM-solve over de complete takenlijst synchroon in de render
      // (gemeten 700 ms–2,6 s op 3000 taken/1500 relaties). Het actieve document heeft zijn eigen
      // rekenpad (F5 of `useAutoCalcCPM`); het telt hier mee met zijn laatst berekende toestand —
      // dezelfde staleness die de Gantt ernaast toont — en krijgt de "verouderd"-markering. Het
      // wordt op ID herkend, niet op positie in de lijst.
      const isActive = id === activeDocumentId;
      // De titel hoort bewust NIET in de cache: die hangt aan de locale en aan de volgnummers van
      // de ándere documenten, niet aan deze payload.
      const resolved = resolveLibrarySliceCache(sliceCacheRef.current, payload, companyId, pool);
      sliceCacheRef.current = resolved.cache;
      const { slice } = resolved;
      return {
        docId: id,
        title: displayDocumentTitle(rawTitles[i], ordinals[i], untitledLabel),
        scheduleStale: payload.scheduleStale,
        companyId: payload.project.companyId ?? null,
        resources: slice.resources,
        assignments: slice.assignments,
        tasks: slice.tasks,
        calendar: payload.calendar,
        calendars: payload.calendars,
        skipEphemeralSolve: isActive,
        // §4.3b: invoer voor de efemere doorrekening van een stale document. Bewust de VOLLEDIGE
        // takenlijst en relaties van de payload (niet de bibliotheek-snit): een gesnoeide graaf zou
        // een andere planning opleveren dan F5 in dat document. Referenties, geen kopieën — de
        // kosten vallen pas bij een daadwerkelijke solve, en die kloont zelf. Voor het actieve
        // document laten we hem bewust weg: daar wordt nooit gesolved (zie hierboven).
        ...(isActive ? {} : {
          solveInput: {
            tasks: payload.tasks,
            sequences: payload.sequences,
            dataDate: payload.project.statusDate,
            progressMode: payload.project.progressMode,
            schedulingOptions: payload.project.schedulingOptions,
          },
        }),
      };
    });
    const result = computeLibraryOccupancy(companyId, pool, inputs);
    // Weergavesortering (§5): conflicten bovenaan (meeste conflictdagen eerst), daarna alfabetisch
    // op poolnaam — de kern levert bewust de neutrale poolvolgorde.
    const sorted = [...result.rows].sort((a, b) =>
      (b.conflictDays.length - a.conflictDays.length) || a.name.localeCompare(b.name, i18n.language));
    // Twee stale-soorten (§4.3b) voor de banner-keuze: minstens één ONGETELDE booking (vangnet,
    // §4.3) ⇒ de bestaande waarschuwing wint; zijn alle stale boekingen gewoon geteld (efemeer
    // doorgerekend) ⇒ de informatieve variant. `result.anyStale` dekt beide gevallen samen en is
    // hier niet fijnmazig genoeg voor die keuze.
    let anyUncountedStale = false;
    let anyCountedStale = false;
    // Derde soort (perf-poort): een document dat hier NIET efemeer wordt doorgerekend (het actieve)
    // maar wél stale is — de cijfers zijn zijn laatst berekende, dus "verouderd", niet "alvast
    // doorgerekend". De banner-keuze is: ongeteld (waarschuwing) > verouderd-zoals-getoond >
    // alvast-doorgerekend.
    let anyStaleAsShown = false;
    // Unieke documentkleuren (i.p.v. de hash-gebaseerde `documentColor`, die bij toeval kan
    // botsen): één toewijzing per docId, op volgorde van eerste verschijnen in de zichtbare data
    // (de gesorteerde rijen + hun docs). Zo blijft elke docId uniek zolang het palet reikt, en
    // hergebruikt na uitputting — en de toewijzing is stabiel zolang dezelfde documenten in
    // dezelfde volgorde zichtbaar blijven, want ze wordt puur uit `sorted` afgeleid.
    const docColors = new Map<string, string>();
    for (const row of sorted) {
      for (const doc of row.docs) {
        if (!doc.counted) anyUncountedStale = true;
        else if (doc.scheduleStale) {
          if (doc.ephemeralComputed) anyCountedStale = true;
          else anyStaleAsShown = true;
        }
        if (!docColors.has(doc.docId)) {
          docColors.set(doc.docId, DOC_PALETTE[docColors.size % DOC_PALETTE.length]);
        }
      }
    }
    return { rows: sorted, anyUncountedStale, anyCountedStale, anyStaleAsShown, docColors };
  }, [
    openDocumentPayloads, activeDocumentId, pool, companyId, untitledLabel, i18n.language,
  ]);

  // Uitklap (chevron) en histogram-selectie zijn twee losse assen: uitklappen toont de
  // per-document-subregel (§5), selecteren voedt het histogram eronder (§5a).
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  // Piek/capaciteit met één decimaal ("3,0 / 2,0", §5) — de "/" is opmaak, geen tekst.
  const unitsFmt = useMemo(
    () => new Intl.NumberFormat(i18n.language, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    [i18n.language],
  );

  const selectedRow = selectedItem !== null ? rows.find(r => r.libraryItemId === selectedItem) : undefined;
  const selectedPoolItem = selectedRow ? pool.resources.find(r => r.id === selectedRow.libraryItemId) : undefined;
  const selectedAllUncounted = selectedRow !== undefined && selectedRow.docs.every(d => !d.counted);

  /** Totale periode van een rij: min `firstDay` … max `lastDay` over de GETELDE documenten (§5) —
   *  ongetelde boekingen hebben geen datums (kern §4.3), dus die vallen er vanzelf uit. */
  const rowPeriod = (row: OccupancyRow): string => {
    let first: string | null = null;
    let last: string | null = null;
    for (const d of row.docs) {
      if (d.firstDay !== null && (first === null || d.firstDay < first)) first = d.firstDay;
      if (d.lastDay !== null && (last === null || d.lastDay > last)) last = d.lastDay;
    }
    return first !== null && last !== null ? `${first} – ${last}` : '—';
  };

  /** De eerste ~5 conflictdatums, daarna "… en {{count}} meer" (§5). */
  const conflictDatesLabel = (row: OccupancyRow): string => {
    const shown = row.conflictDays.slice(0, MAX_CONFLICT_DATES_SHOWN);
    const rest = row.conflictDays.length - shown.length;
    return rest > 0
      ? `${shown.join(', ')} ${t('resource.occupancy.moreDays', { count: rest })}`
      : shown.join(', ');
  };

  return (
    <div className="flex-1 overflow-auto" data-ops-occupancy-view>
      {anyUncountedStale ? (
        // Vangnetpad (§4.3): minstens één booking telt niet mee — een echte waarschuwing. Zelfde
        // vorm als de Bibliotheekweergave-hint: semantische --warning-token + per-thema
        // --theme-warning-text, leesbaar in alle drie de thema's.
        <div
          className="flex items-center gap-2 mx-2 mt-2 px-2.5 py-1.5 rounded-[8px] border font-medium"
          style={{
            background: 'color-mix(in srgb, var(--warning) 14%, transparent)',
            borderColor: 'var(--warning)',
            color: 'var(--theme-warning-text)',
          }}
          role="alert"
          data-ops-occupancy-stale-banner
        >
          <AlertTriangle size={14} className="shrink-0" aria-hidden />
          <span>{t('resource.occupancy.staleBanner')}</span>
        </div>
      ) : anyStaleAsShown ? (
        // Perf-poort: minstens één document telt mee met zijn LAATST BEREKENDE cijfers (het actieve
        // document, dat hier bewust niet efemeer wordt doorgerekend). Informatief, dim-stijl —
        // dezelfde vorm als de "alvast doorgerekend"-banner hieronder.
        <div
          className="flex items-center gap-2 mx-2 mt-2 px-2.5 py-1.5 rounded-[8px] border font-medium text-text-secondary"
          style={{
            background: 'color-mix(in srgb, var(--theme-text-dim) 12%, transparent)',
            borderColor: 'var(--theme-text-dim)',
          }}
          role="status"
          data-ops-occupancy-stale-as-shown-banner
        >
          <AlertTriangle size={14} className="shrink-0" aria-hidden />
          <span>{t('resource.occupancy.staleAsShownBanner')}</span>
        </div>
      ) : anyCountedStale && (
        // §4.3b: alle stale documenten in dit overzicht zijn efemeer doorgerekend en tellen gewoon
        // mee — informatief, geen fout. Zelfde vorm als hierboven, maar met de bestaande "dim"-stijl
        // (--theme-text-dim / text-text-secondary) in plaats van de waarschuwingskleur.
        <div
          className="flex items-center gap-2 mx-2 mt-2 px-2.5 py-1.5 rounded-[8px] border font-medium text-text-secondary"
          style={{
            background: 'color-mix(in srgb, var(--theme-text-dim) 12%, transparent)',
            borderColor: 'var(--theme-text-dim)',
          }}
          role="status"
          data-ops-occupancy-stale-computed-banner
        >
          <AlertTriangle size={14} className="shrink-0" aria-hidden />
          <span>{t('resource.occupancy.staleComputedBanner')}</span>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="p-4 text-text-secondary" data-ops-occupancy-empty>{t('resource.occupancy.empty')}</div>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="sticky top-0 z-10" style={{ background: 'var(--theme-surface-alt)' }}>
              <th className="text-left px-2 py-1.5 font-semibold border-b border-border" style={{ minWidth: 160 }}>{t('resource.name')}</th>
              <th className="text-left px-2 py-1.5 font-semibold border-b border-border" style={{ width: 120 }}>{t('resource.occupancy.documents')}</th>
              <th className="text-left px-2 py-1.5 font-semibold border-b border-border" style={{ width: 190 }}>{t('resource.occupancy.period')}</th>
              <th className="text-right px-2 py-1.5 font-semibold border-b border-border" style={{ width: 130 }}>
                {t('resource.occupancy.peak')} / {t('resource.occupancy.capacity')}
              </th>
              <th className="text-left px-2 py-1.5 font-semibold border-b border-border" style={{ width: 190 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const open = expandedItem === row.libraryItemId;
              const isSelected = selectedItem === row.libraryItemId;
              // §4.3/§5: uitsluitend ongetelde (stale) boekingen ⇒ "—" voor periode en piek, en
              // NOOIT een conflictbadge. De kern levert zonder getelde belasting sowieso geen
              // conflictdagen; de `!allUncounted` maakt die eis hier alsnog hard op weergaveniveau.
              const allUncounted = row.docs.every(d => !d.counted);
              const hasConflict = row.conflictDays.length > 0 && !allUncounted;
              return (
                <Fragment key={row.libraryItemId}>
                  <tr
                    className={`border-b border-border-light cursor-pointer ${isSelected ? 'bg-surface-hover' : 'hover:bg-surface-hover'}`}
                    onClick={() => setSelectedItem(isSelected ? null : row.libraryItemId)}
                    aria-selected={isSelected}
                    data-ops-occupancy-row={row.libraryItemId}
                  >
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1 min-w-0">
                        <button
                          onClick={e => { e.stopPropagation(); setExpandedItem(open ? null : row.libraryItemId); }}
                          title={t('resource.occupancy.documents')}
                          className="p-0.5 rounded hover:bg-surface-hover text-text-secondary flex-shrink-0"
                          data-ops-occupancy-expand
                        >
                          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        </button>
                        <span className="truncate font-medium">{row.name}</span>
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-text-secondary">
                      {t('resource.occupancy.docCount', { count: row.docs.length })}
                    </td>
                    <td className="px-2 py-1.5 tabular-nums text-text-secondary">{rowPeriod(row)}</td>
                    <td
                      className="px-2 py-1.5 text-right tabular-nums"
                      style={hasConflict ? { color: 'var(--error)' } : undefined}
                    >
                      {allUncounted ? '—' : <>{unitsFmt.format(row.totalPeak)} / {unitsFmt.format(row.capacityAtPeak)}</>}
                    </td>
                    <td className="px-2 py-1.5">
                      {hasConflict && (
                        <span
                          className="badge badge--red"
                          title={conflictDatesLabel(row)}
                          data-ops-occupancy-conflict
                        >
                          {t('resource.occupancy.conflictDays', { count: row.conflictDays.length })}
                        </span>
                      )}
                    </td>
                  </tr>
                  {open && (
                    // Zelfde subrij-patroon als de availabilitySteps-uitklap in `ResourcePanel`.
                    <tr style={{ background: 'var(--theme-surface-alt)' }} data-ops-occupancy-docs={row.libraryItemId}>
                      <td colSpan={5} className="px-3 py-2">
                        <div className="flex flex-col gap-1">
                          {hasConflict && (
                            <span className="text-[10px]" style={{ color: 'var(--error)' }}>
                              {conflictDatesLabel(row)}
                            </span>
                          )}
                          {row.docs.map(doc => (
                            <div key={doc.docId} className="flex items-center gap-2 min-w-0">
                              <span
                                className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
                                style={{ background: docColors.get(doc.docId) }}
                                aria-hidden
                              />
                              <span className="truncate font-medium">{doc.title || untitledLabel}</span>
                              {/* §5 (herzien): ongetelde boekingen tonen "—" op de cijferplekken. */}
                              <span className="tabular-nums text-text-secondary">
                                {doc.counted && doc.firstDay !== null && doc.lastDay !== null
                                  ? `${doc.firstDay} – ${doc.lastDay}` : '—'}
                              </span>
                              <span className="tabular-nums text-text-secondary">
                                {t('resource.occupancy.peak')}: {doc.counted ? unitsFmt.format(doc.peak) : '—'}
                              </span>
                              {!doc.counted ? (
                                // Vangnetpad (§4.3): geen cijfers, echte waarschuwing.
                                <span
                                  className="inline-flex items-center gap-1 flex-shrink-0"
                                  style={{ color: 'var(--theme-warning-text)' }}
                                  title={t('resource.occupancy.staleDoc')}
                                  data-ops-occupancy-stale-doc
                                >
                                  <AlertTriangle size={12} aria-hidden />
                                  <span className="text-[10px]">{t('resource.occupancy.staleDoc')}</span>
                                </span>
                              ) : doc.scheduleStale && (
                                // Twee informatieve varianten (dim-stijl, geen fout):
                                // efemeer doorgerekend (§4.3b) ⇒ de cijfers hierboven zijn al de
                                // actuele; niet doorgerekend (perf-poort, het actieve document) ⇒
                                // het zijn de laatst berekende cijfers.
                                <span
                                  className="inline-flex items-center gap-1 flex-shrink-0 text-text-secondary"
                                  title={doc.ephemeralComputed
                                    ? t('resource.occupancy.staleComputedDoc')
                                    : t('resource.occupancy.staleAsShownDoc')}
                                  {...(doc.ephemeralComputed
                                    ? { 'data-ops-occupancy-stale-computed-doc': '' }
                                    : { 'data-ops-occupancy-stale-as-shown-doc': '' })}
                                >
                                  <AlertTriangle size={12} aria-hidden />
                                  <span className="text-[10px]">
                                    {doc.ephemeralComputed
                                      ? t('resource.occupancy.staleComputedDoc')
                                      : t('resource.occupancy.staleAsShownDoc')}
                                  </span>
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      )}

      {/* §5a: histogram voor het geselecteerde poolitem; zonder selectie de hint; een rij met
          uitsluitend ongetelde boekingen toont geen chart maar de stale-uitleg. */}
      {rows.length > 0 && (
        <div className="px-3 py-2 border-t border-border" data-ops-occupancy-histogram-section>
          {selectedRow && selectedPoolItem ? (
            selectedAllUncounted ? (
              <p
                className="flex items-center gap-1.5"
                style={{ color: 'var(--theme-warning-text)' }}
                data-ops-occupancy-chart-stale
              >
                <AlertTriangle size={13} className="shrink-0" aria-hidden />
                {t('resource.occupancy.staleDoc')}
              </p>
            ) : (
              <OccupancyHistogram row={selectedRow} poolItem={selectedPoolItem} untitledLabel={untitledLabel} docColors={docColors} />
            )
          ) : (
            <p className="text-text-secondary">{t('resource.occupancy.selectHint')}</p>
          )}
        </div>
      )}

      {/* Permanente voetnoot (§5, scope-grens 2): zichtbaar in het product zelf, niet alleen docs. */}
      <p className="px-3 py-2 text-[10px]" style={{ color: 'var(--theme-text-muted)' }} data-ops-occupancy-machine-only>
        {t('resource.occupancy.machineOnly')}
      </p>
    </div>
  );
}

// --- §5a: SVG-histogram per geselecteerd poolitem ------------------------------------------------

/** Vaste tekenmaten van het histogram (viewBox-eenheden ≈ px; horizontaal scrollbaar). */
const CHART = {
  plotHeight: 130,
  axisGap: 16,     // ruimte onder de plot voor datumlabels
  padLeft: 34,     // ruimte links voor de y-as-waarden
  padRight: 8,
  padTop: 8,
  minDayWidth: 4,
  maxDayWidth: 16,
  targetWidth: 760, // richtbreedte; meer dagen ⇒ breder (scroll), minder ⇒ bredere staven
  breakWidth: 14,   // breedte van de "⋯"-breukmarkering tussen segmenten
};

/** Gaten langer dan dit aantal kalenderdagen zonder enige boeking worden ingeklapt (§5a). */
const GAP_COMPRESS_DAYS = 30;

/** Minimale horizontale ruimte tussen twee datumlabels (viewBox-eenheden ≈ px bij fontSize 8). */
const MIN_LABEL_GAP = 48;

interface ChartSegment {
  /** Alle kalenderdagen van het segment (granulariteit één dag, incl. boekingsloze dagen). */
  days: string[];
  /** x-positie (viewBox) van de eerste dag. */
  x0: number;
}

/** Alle ISO-kalenderdagen van `from` t/m `to` (inclusief). */
function expandDays(from: string, to: string): string[] {
  const days: string[] = [];
  for (let d = parseDate(from); ; d = addCalendarDays(d, 1)) {
    const iso = formatDate(d);
    if (iso > to) break;
    days.push(iso);
  }
  return days;
}

/**
 * Gestapeld daghistogram voor één poolitem (§5a, herzien): per ISO-dag de bijdrage per GETELD
 * document (vaste kleur per document + legenda), de capaciteitslijn van het poolitem via
 * `maxUnitsOn` per dag (availabilitySteps-knikken zichtbaar als trapjes) en de conflictdagen rood
 * gemarkeerd — letterlijk `row.conflictDays` uit de kern, geen tweede berekening.
 *
 * X-as-domein (critreview bevinding 5): de vereniging van de getelde geboekte dagen, met
 * GATCOMPRESSIE — een aaneengesloten gat van meer dan 30 kalenderdagen zonder boeking klapt in
 * tot één smalle "⋯"-breukmarkering, zodat ver uiteenliggende documenten geen duizenden lege
 * kolommen produceren. Binnen een segment blijft de granulariteit één dag; het geheel scrollt
 * horizontaal in zijn eigen container. Alle segmentindeling en padopbouw zit BINNEN de memo.
 *
 * De chart is geforceerd LTR (ook onder ar/fa) — een tijdas spiegelt in dit product nergens; de
 * omringende tabel en legenda volgen gewoon de documentrichting. SVG in de DOM; bewust niet de
 * canvas-`HistogramRenderer` (die hangt aan de tijdschaal van het actieve project).
 */
function OccupancyHistogram({ row, poolItem, untitledLabel, docColors }: {
  row: OccupancyRow;
  poolItem: Resource;
  untitledLabel: string;
  /** Unieke documentkleuren (§ zie boven) — dezelfde toewijzing als de tabel/legenda. */
  docColors: Map<string, string>;
}) {
  const { t } = useTranslation('common');

  const chart = useMemo(() => {
    const countedDocs = row.docs.filter(d => d.counted);

    // Domein: de vereniging van de GETELDE geboekte dagen (ongetelde boekingen hebben per §4.3
    // geen cijfers en dragen dus ook geen as-domein bij).
    const bookedDays = new Set<string>();
    for (const d of countedDocs) for (const iso of Object.keys(d.dailyLoad)) bookedDays.add(iso);
    const sortedBooked = [...bookedDays].sort();
    if (sortedBooked.length === 0) return null;

    // Gatcompressie: een aaneengesloten reeks kalenderdagen ZONDER boeking die langer is dan
    // GAP_COMPRESS_DAYS breekt het domein in twee segmenten. `diffDays(prev, iso) - 1` is precies
    // de lengte van dat gat (opeenvolgende dagen ⇒ 0). Binnen een segment worden álle
    // kalenderdagen getoond, ook boekingsloze, zodat de tijd daar proportioneel blijft.
    const ranges: { from: string; to: string }[] = [];
    let from = sortedBooked[0];
    let prev = from;
    for (let i = 1; i < sortedBooked.length; i++) {
      const iso = sortedBooked[i];
      if (diffDays(prev, iso) - 1 > GAP_COMPRESS_DAYS) {
        ranges.push({ from, to: prev });
        from = iso;
      }
      prev = iso;
    }
    ranges.push({ from, to: prev });

    const totalDays = ranges.reduce((n, r) => n + diffDays(r.from, r.to) + 1, 0);
    const dayWidth = Math.max(
      CHART.minDayWidth,
      Math.min(CHART.maxDayWidth, Math.floor(CHART.targetWidth / totalDays)),
    );

    const segments: ChartSegment[] = [];
    const breaks: number[] = []; // x-middens van de breukmarkeringen tussen de segmenten
    let cursor = CHART.padLeft;
    for (const range of ranges) {
      if (segments.length > 0) {
        breaks.push(cursor + CHART.breakWidth / 2);
        cursor += CHART.breakWidth;
      }
      const days = expandDays(range.from, range.to);
      segments.push({ days, x0: cursor });
      cursor += days.length * dayWidth;
    }
    const width = cursor + CHART.padRight;
    const height = CHART.padTop + CHART.plotHeight + CHART.axisGap;

    // Belasting en capaciteit per getoonde dag; y-schaal over beide.
    const capacityOf = new Map<string, number>();
    let maxVal = 1;
    for (const seg of segments) {
      for (const iso of seg.days) {
        const cap = maxUnitsOn(poolItem, iso);
        capacityOf.set(iso, cap);
        let sum = 0;
        for (const d of countedDocs) sum += d.dailyLoad[iso] ?? 0;
        if (cap > maxVal) maxVal = cap;
        if (sum > maxVal) maxVal = sum;
      }
    }
    const maxY = maxVal * 1.1;
    const yOf = (units: number) => CHART.padTop + CHART.plotHeight * (1 - units / maxY);

    // Geometrie volledig hier, niet in de render-body (§5a): staven, conflictbanden, het
    // capaciteitspad per segment en de datumlabels.
    const conflictSet = new Set(row.conflictDays);
    const bars: { key: string; x: number; y: number; w: number; h: number; fill: string }[] = [];
    const conflictRects: { key: string; x: number }[] = [];
    const capPaths: string[] = [];

    // Labels worden in oplopende x gepusht; te dicht op elkaar ⇒ overslaan. Een vastgezet label
    // (segmentbegin, laatste dag) wint van een niet-vastgezet buurlabel dat in de weg staat.
    const labels: { x: number; text: string; anchor: 'start' | 'end'; pinned: boolean }[] = [];
    const pushLabel = (x: number, text: string, anchor: 'start' | 'end', pinned: boolean) => {
      const last = labels[labels.length - 1];
      // Een rechts uitgelijnd label loopt naar links wég van zijn x, dus dat heeft de dubbele
      // tussenruimte nodig ten opzichte van het (links uitgelijnde) label ervóór.
      const needed = anchor === 'end' ? MIN_LABEL_GAP * 2 : MIN_LABEL_GAP;
      if (last !== undefined && x - last.x < needed) {
        if (!pinned || last.pinned) return;
        labels.pop();
      }
      labels.push({ x, text, anchor, pinned });
    };

    for (const seg of segments) {
      let capPath = '';
      let prevCap: number | null = null;
      for (let i = 0; i < seg.days.length; i++) {
        const iso = seg.days[i];
        const x = seg.x0 + i * dayWidth;
        // Conflictband (§6-definitie, letterlijk `row.conflictDays` — geen tweede berekening).
        if (conflictSet.has(iso)) conflictRects.push({ key: iso, x });
        // Gestapelde bijdrage per geteld document, in de vaste documentvolgorde van de rij.
        let acc = 0;
        for (const doc of countedDocs) {
          const units = doc.dailyLoad[iso] ?? 0;
          if (units <= 0) continue;
          const y0 = yOf(acc);
          acc += units;
          const y1 = yOf(acc);
          bars.push({
            key: `${iso}-${doc.docId}`,
            x: x + 0.5,
            y: y1,
            w: Math.max(1, dayWidth - 1),
            h: Math.max(0.5, y0 - y1),
            fill: docColors.get(doc.docId) ?? DOC_PALETTE[0],
          });
        }
        // Capaciteits-traplijn: horizontaal over de dag, verticaal op elke knik.
        const cap = capacityOf.get(iso)!;
        const y = yOf(cap);
        if (prevCap === null) capPath += `M ${x} ${y}`;
        else if (cap !== prevCap) capPath += ` L ${x} ${y}`;
        capPath += ` L ${x + dayWidth} ${y}`;
        prevCap = cap;
      }
      capPaths.push(capPath);
      // Datumlabels: het begin van elk segment (vastgezet — het markeert de breuk), plus de
      // maandovergangen binnen een lang segment.
      pushLabel(seg.x0, seg.days[0], 'start', true);
      if (seg.days.length > 45) {
        seg.days.forEach((iso, i) => {
          if (i > 0 && iso.endsWith('-01')) pushLabel(seg.x0 + i * dayWidth, iso, 'start', false);
        });
      }
    }
    // Laatste dag rechts uitgelijnd, zodat het label niet buiten de viewBox valt.
    const lastSeg = segments[segments.length - 1];
    if (lastSeg.days.length > 1) {
      pushLabel(
        lastSeg.x0 + lastSeg.days.length * dayWidth,
        lastSeg.days[lastSeg.days.length - 1],
        'end',
        true,
      );
    }

    const capStart = capacityOf.get(segments[0].days[0])!;
    return {
      dayWidth, width, height,
      bars, conflictRects, capPaths, breaks, labels,
      baselineY: yOf(0),
      capStartY: yOf(capStart),
      capStartValue: capStart,
    };
  }, [row, poolItem, docColors]);

  if (chart === null) {
    // Kan alleen bij een rij zonder getelde boekingen — de aanroeper vangt dat al af (§5a).
    return <p className="text-text-secondary">{t('resource.occupancy.empty')}</p>;
  }

  return (
    <div className="flex flex-col gap-1.5" data-ops-occupancy-histogram={row.libraryItemId}>
      <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--theme-text-muted)' }}>
        {row.name}
      </span>
      {/* Geforceerd LTR (§5a): een tijdas spiegelt nergens in dit product, ook niet onder ar/fa. */}
      <div className="overflow-x-auto" dir="ltr" style={{ direction: 'ltr' }}>
        <svg
          width={chart.width}
          height={chart.height}
          viewBox={`0 0 ${chart.width} ${chart.height}`}
          role="img"
          aria-label={row.name}
          style={{ display: 'block' }}
        >
          {chart.conflictRects.map(r => (
            <rect
              key={`c-${r.key}`}
              x={r.x}
              y={CHART.padTop}
              width={chart.dayWidth}
              height={CHART.plotHeight}
              fill="var(--error)"
              opacity={0.16}
            />
          ))}
          {chart.bars.map(b => (
            <rect key={b.key} x={b.x} y={b.y} width={b.w} height={b.h} fill={b.fill} />
          ))}
          {/* Nullijn + y-as-waarden. */}
          <line
            x1={CHART.padLeft} y1={chart.baselineY} x2={chart.width - CHART.padRight} y2={chart.baselineY}
            stroke="var(--theme-border)" strokeWidth={1}
          />
          <text x={CHART.padLeft - 4} y={chart.baselineY + 3} textAnchor="end" fontSize={9} fill="var(--theme-text-muted)">0</text>
          {/* Capaciteitslijn van het poolitem (maxUnitsOn per dag — knikken zichtbaar), per segment. */}
          {chart.capPaths.map((d, i) => (
            <path key={`cap-${i}`} d={d} fill="none" stroke="var(--theme-text-dim)" strokeWidth={1.5} strokeDasharray="5 3" />
          ))}
          <text
            x={CHART.padLeft - 4}
            y={chart.capStartY + 3}
            textAnchor="end"
            fontSize={9}
            fill="var(--theme-text-dim)"
          >{chart.capStartValue}</text>
          {/* Breukmarkeringen van de gatcompressie. */}
          {chart.breaks.map((x, i) => (
            <text
              key={`b-${i}`}
              x={x}
              y={CHART.padTop + CHART.plotHeight / 2}
              textAnchor="middle"
              fontSize={11}
              fill="var(--theme-text-muted)"
            >⋯</text>
          ))}
          {/* Datumlabels (segmentbegin, maandovergangen, laatste dag — al ontdubbeld in de memo). */}
          {chart.labels.map((l, i) => (
            <text
              key={`l-${i}`}
              x={l.x}
              y={CHART.padTop + CHART.plotHeight + 11}
              textAnchor={l.anchor}
              fontSize={8}
              fill="var(--theme-text-muted)"
            >{l.text}</text>
          ))}
        </svg>
      </div>
      {/* Legenda: alle documenten van de rij met hun vaste kleur; ongetelde met ⚠ (geen staafdata). */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1" data-ops-occupancy-legend>
        {row.docs.map(doc => (
          <span key={doc.docId} className="inline-flex items-center gap-1.5 min-w-0">
            <span className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: docColors.get(doc.docId) }} aria-hidden />
            <span className="truncate text-[10px] text-text-secondary">{doc.title || untitledLabel}</span>
            {!doc.counted && (
              <AlertTriangle size={11} style={{ color: 'var(--theme-warning-text)' }} aria-label={t('resource.occupancy.staleDoc')} />
            )}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <svg width={18} height={8} aria-hidden><line x1={0} y1={4} x2={18} y2={4} stroke="var(--theme-text-dim)" strokeWidth={1.5} strokeDasharray="5 3" /></svg>
          <span className="text-[10px] text-text-secondary">{t('resource.occupancy.capacity')}</span>
        </span>
      </div>
    </div>
  );
}

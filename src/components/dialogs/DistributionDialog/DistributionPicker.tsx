// De KIEZER-STAND van de verdeeldialoog (bedieningsreparatie, 2026-09-11).
//
// WAAROM DIT BESTAAT. De lintknop "Verdelen…" opende de dialoog ook zonder eerder gekozen poolitem,
// en die stand toonde niets dan de hint `selectHint` plus drie uitgeschakelde knoppen. Dat is een
// doodlopende dialoog: er is geen handeling die vanaf daar vooruit leidt. Nu toont dezelfde lege
// stand de LIJST van bibliotheekitems die op dit moment een conflict hebben — één klik is de start.
//
// ÉÉN DEFINITIE VAN "CONFLICT". De cijfers komen uit `computeLibraryOccupancy` op dezelfde invoer
// als het bezettingsoverzicht: dezelfde bibliotheek (de koppeling van het actieve project),
// dezelfde `skipEphemeralSolve` voor het actieve document, dezelfde weergavefilters
// (`conflictDays > 0` én minstens één GETELDE booking) en dezelfde sortering. Er is hier bewust
// geen tweede, eigen conflictbegrip — die zou stilzwijgend van het overzicht kunnen afwijken.
//
// ÉÉN REKENMOMENT, GEEN ABONNEMENT. De invoerbouw hergebruikt `buildDistributionInputs`, en die
// kan per stale document een efemere CPM-solve kosten. De kiezer rekent daarom exact één keer: bij
// het MONTEREN, via een lazy `useState`-initialisator (synchroon, dus zonder lege flits). Hij is
// alleen gemount zolang er geen poolitem gekozen is, dus "Ander item kiezen…" levert vanzelf een
// verse meting op — dat is dezelfde discrete-rekenmomenten-keuze als de rest van deze dialoog.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore, type AppState } from '@/state/appStore';
import { computeLibraryOccupancy, type OccupancyDocInput } from '@/services/library/occupancy';
import { buildDistributionInputs, freshDistributionUi } from './useDistributionProposal';

/** Eén regel van de kiezer: een poolitem met een actueel conflict over de geopende documenten. */
export interface DistributionPickRow {
  libraryItemId: string;
  name: string;
  /** Aantal documenten dat op dit poolitem boekt — `resource.occupancy.docCount`. */
  docCount: number;
  /** Aantal conflictdagen — `resource.occupancy.conflictDays`. */
  conflictDays: number;
}

/**
 * De conflicterende poolitems van de bibliotheek waaraan het ACTIEVE document gekoppeld is.
 * Zonder koppeling (of zonder pool) is er niets te kiezen: dan is de lijst leeg en toont de dialoog
 * de "geen conflicten"-regel.
 */
export function collectDistributionPicks(
  s: AppState,
  untitledLabel: string,
  language: string,
): { companyId: string | null; rows: DistributionPickRow[] } {
  const companyId = s.project.companyId ?? null;
  const pool = companyId === null ? undefined : s.pools[companyId];
  if (companyId === null || pool === undefined) return { companyId, rows: [] };

  const inputs = buildDistributionInputs(s, untitledLabel, { order: [], pinned: {}, ceilings: {} });
  // `skipEphemeralSolve` voor het actieve document: exact de perf-poort van `ResourceOccupancyView`,
  // zodat de cijfers hier niet uit een ándere (hybride) planning komen dan daar.
  const docs: OccupancyDocInput[] = inputs.map(doc => ({
    ...doc,
    skipEphemeralSolve: doc.docId === s.activeDocumentId,
  }));
  const { rows } = computeLibraryOccupancy(companyId, pool, docs);

  return {
    companyId,
    rows: rows
      // Zelfde weergave-eis als de conflictbadge in het overzicht: uitsluitend ongetelde boekingen
      // leveren nooit een conflict om te verdelen.
      .filter(row => row.conflictDays.length > 0 && row.docs.some(doc => doc.counted))
      .sort((a, b) =>
        (b.conflictDays.length - a.conflictDays.length) || a.name.localeCompare(b.name, language))
      .map(row => ({
        libraryItemId: row.libraryItemId,
        name: row.name,
        docCount: row.docs.length,
        conflictDays: row.conflictDays.length,
      })),
  };
}

/** De kiezerlijst zoals de dialoog hem toont wanneer er nog geen poolitem gekozen is. */
export function DistributionPicker() {
  const { t, i18n } = useTranslation('common');
  const setUI = useAppStore(s => s.setUI);
  const untitledLabel = t('project.untitled');

  // Zie het moduleblok: één meting bij het monteren.
  const [picks] = useState(() => collectDistributionPicks(useAppStore.getState(), untitledLabel, i18n.language));

  if (picks.companyId === null || picks.rows.length === 0) {
    return (
      <div className="text-text-secondary" data-ops-distribution-no-conflicts>
        {t('resource.distribution.noConflicts')}
      </div>
    );
  }

  const companyId = picks.companyId;
  return (
    <div className="flex flex-col gap-1" data-ops-distribution-picker>
      <span className="text-text-secondary" data-ops-distribution-select-hint>
        {t('resource.distribution.selectHint')}
      </span>
      {picks.rows.map(row => (
        <button
          key={row.libraryItemId}
          type="button"
          data-ops-distribution-pick={row.libraryItemId}
          className="flex items-center gap-2 text-left px-2 py-1.5 rounded-[8px] border border-border hover:bg-surface-hover"
          onClick={() => {
            // Dezelfde start als de conflictregel in het bezettingsoverzicht: float-volgorde, niets
            // gepind, geen plafonds, niets toegepast — één definitie van "openen op dit item".
            setUI({
              levelingDistribution: freshDistributionUi(
                useAppStore.getState(), untitledLabel, companyId, row.libraryItemId),
            });
          }}
        >
          <span className="truncate font-medium flex-1 min-w-0">{row.name}</span>
          <span className="text-text-secondary shrink-0">
            {t('resource.occupancy.docCount', { count: row.docCount })}
          </span>
          <span className="badge badge--red shrink-0">
            {t('resource.occupancy.conflictDays', { count: row.conflictDays })}
          </span>
        </button>
      ))}
    </div>
  );
}

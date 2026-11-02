import type { IconId, IconMaster, IconPart } from './b2/icons.generated';

/**
 * TIJDELIJK voorstel, alleen op de dev-server: hoe krijgen de acht statusiconen zonder oranje deel er een?
 * Elk icoon heeft een oranje element (besluit Ethan, 2 november 2026), maar bij deze acht botst oranje met de
 * statuskleur: een waarschuwing is zelf al oranje. Ethan kiest; daarna komt de keuze in de Blueprint-tekening
 * (`ORANJE_OPEN` in `scripts/b2_richtlijn.py`) en gaat deze module eruit.
 *
 * `?statusVoorstel=a`: het teken (uitroepteken en stip) oranje, het kader in de statuskleur.
 * `?statusVoorstel=b`: het kader oranje, het teken in de statuskleur.
 * Zonder parameter (of `c`): zoals de Blueprint nu tekent, zonder oranje.
 * Een icoon dat alleen een kader is (`status.bridge-off`, een ring) wordt bij a en b helemaal oranje.
 */
export const STATUS_PROPOSAL_IDS: ReadonlySet<IconId> = new Set<IconId>([
  'status.warning', 'status.resource-overallocated', 'status.schedule-preview', 'status.schedule-last-result',
  'status.error', 'status.library-item-missing', 'status.library-item-deviated', 'status.bridge-off',
]);

export type StatusProposal = 'a' | 'b';

function readProposal(): StatusProposal | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;
  const value = new URLSearchParams(window.location.search).get('statusVoorstel');
  return value === 'a' || value === 'b' ? value : null;
}

export const statusProposal: StatusProposal | null = readProposal();

/** Het kader is de gesloten omtreklijn (driehoek, achthoek of cirkel); de rest is het teken. */
const isFrame = ([kind, , d]: IconPart): boolean => kind === 0 && d.trim().endsWith('Z');

export function applyStatusProposal(id: IconId, master: IconMaster): IconMaster {
  if (!statusProposal || !STATUS_PROPOSAL_IDS.has(id)) return master;
  const single = master.parts.length === 1;
  return {
    w: master.w,
    parts: master.parts.map((part): IconPart => {
      const orange = single || (statusProposal === 'a' ? !isFrame(part) : isFrame(part));
      return [part[0], orange ? 1 : 0, part[2]];
    }),
  };
}

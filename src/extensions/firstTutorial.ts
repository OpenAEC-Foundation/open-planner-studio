/**
 * "Ja" op de tutorialvraag: de tutorials-extensie zorgen dat ze er is en haar eerste tutorial laten
 * starten (eigenaarsbesluit 2026-09-28: installeren en meteen starten).
 *
 * PUUR, MET INGESPOTEN AFHANKELIJKHEDEN. Store, loader, catalogus, installatie, Help-register,
 * event-bus en begeleidingslooptijd komen binnen als {@link FirstTutorialDeps}; de app-binding staat
 * in `TutorialOfferDialog.tsx`. Zo loopt `tests/planning/check-first-start.ts` elke tak af zonder
 * netwerk of IndexedDB.
 *
 * DE ROUTE.
 *  1. Is de extensie nog aan het laden (opstart), wacht dan tot haar activatie klaar is.
 *  2. Staat ze uit, dan aanzetten: ze is al geïnstalleerd (en was dus al vertrouwd), en "Ja" is een
 *     expliciete keuze voor de tutorials.
 *  3. Is ze er niet (of in een foutstand), dan uit de catalogus: `fetchCatalog` → entry op id →
 *     `installFromCatalog`. De toestemmingsvraag hoort bij die installatie en wordt NIET omzeild;
 *     een weigering is `declined`, geen fout.
 *  4. Pas als de extensie ACTIEF is (status `enabled` = haar `onLoad` is afgerond, dus ook haar
 *     `api.events.on`-listener staat) gaat `host:tutorial-requested` de bus op, met haar eerste
 *     geregistreerde tutorial. Geen race met een net geïnstalleerde extensie.
 *  5. Daarna telt alleen wat er gebeurde: loopt er een begeleiding van die extensie, dan `started`;
 *     anders (oudere versie zonder listener, of er liep al een andere begeleiding) `unavailable`, en
 *     valt de aanroeper terug op Help › Tutorials.
 */
import type { CatalogEntry, ExtensionStatus } from './types';
import type { InstallOutcome } from './extensionService';
import { HOST_EVENTS, type HostTutorialRequest } from '@/services/extensionEvents';

/** Het id van de tutorials-extensie in de catalogus (`open-planner-studio-extensions`). */
export const TUTORIALS_EXTENSION_ID = 'tutorials';

export type FirstTutorialOutcome =
  | { kind: 'started' }
  /** De gebruiker weigerde de installatie in de toestemmingsvraag. */
  | { kind: 'declined' }
  | { kind: 'unavailable'; reason: FirstTutorialUnavailableReason };

export type FirstTutorialUnavailableReason =
  /** De catalogus kon niet worden opgehaald (offline, HTTP-fout, ongeldige JSON). */
  | 'catalog-error'
  /** De catalogus kwam binnen maar kent de extensie niet. */
  | 'no-entry'
  /** Download, controle of installatie mislukte. */
  | 'install-failed'
  /** Geïnstalleerd of aangezet, maar niet actief geworden (`onLoad` faalde, verkeerde API-versie). */
  | 'not-active'
  /** Actief, maar zonder geregistreerde tutorial. */
  | 'no-tutorial'
  /** Het verzoek ging uit, maar er startte geen begeleiding van deze extensie. */
  | 'not-started';

export interface FirstTutorialDeps {
  /** Status van een geïnstalleerde extensie, of `null` als ze er niet is (of in quarantaine). */
  extensionStatus(id: string): ExtensionStatus | null;
  /** Wacht tot een lopende activatie klaar is (`whenExtensionSettled`). */
  whenSettled(id: string): Promise<void>;
  /** Zet een geïnstalleerde, uitgeschakelde extensie aan (`enableExtension`). */
  enable(id: string): Promise<void>;
  /** `fetchCatalog()`: schrijft entries of een fout naar de store, gooit niet. */
  fetchCatalog(): Promise<void>;
  catalog(): { entries: readonly CatalogEntry[]; error: string | null };
  /** `installFromCatalog(entry)`, mét toestemmingsvraag. */
  install(entry: CatalogEntry): Promise<InstallOutcome>;
  /** Id van de eerste tutorial (leerroute-volgorde) die deze extensie registreerde, of `null`. */
  firstTutorialId(extensionId: string): string | null;
  /** Zet een host-event op de bus (`emitExtensionEvent`). */
  emit(event: string, data: HostTutorialRequest): void;
  /** Loopt er nu een begeleiding van deze extensie? */
  guideRunningFor(extensionId: string): boolean;
}

export async function startFirstTutorial(
  deps: FirstTutorialDeps,
  extensionId: string = TUTORIALS_EXTENSION_ID,
): Promise<FirstTutorialOutcome> {
  let status = deps.extensionStatus(extensionId);

  if (status === 'loading') {
    await deps.whenSettled(extensionId);
    status = deps.extensionStatus(extensionId);
  }

  if (status === 'disabled') {
    await deps.enable(extensionId);
    status = deps.extensionStatus(extensionId);
    if (status !== 'enabled') return { kind: 'unavailable', reason: 'not-active' };
  }

  if (status !== 'enabled') {
    await deps.fetchCatalog();
    const { entries, error } = deps.catalog();
    const entry = entries.find(e => e.id === extensionId);
    if (!entry) return { kind: 'unavailable', reason: error ? 'catalog-error' : 'no-entry' };

    const installed = await deps.install(entry);
    if (installed === 'declined') return { kind: 'declined' };
    if (installed === 'failed') return { kind: 'unavailable', reason: 'install-failed' };
    // `installed` zegt alleen dat de bytes er staan; of `onLoad` slaagde, staat in de status.
    if (deps.extensionStatus(extensionId) !== 'enabled') return { kind: 'unavailable', reason: 'not-active' };
  }

  const tutorialId = deps.firstTutorialId(extensionId);
  if (!tutorialId) return { kind: 'unavailable', reason: 'no-tutorial' };

  deps.emit(HOST_EVENTS.tutorialRequested, { extensionId, tutorialId });
  return deps.guideRunningFor(extensionId) ? { kind: 'started' } : { kind: 'unavailable', reason: 'not-started' };
}

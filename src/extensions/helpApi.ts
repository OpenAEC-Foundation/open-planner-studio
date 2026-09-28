/**
 * `api.help.*` (permissie `help`, contract 1.4.0): Help-artikelen registreren, een meegeleverd
 * projectbestand openen als nieuw document en het begeleidingspaneel aansturen.
 *
 * Een dunne laag: artikelen gaan naar het bestaande register (`utils/helpArticleRegistry.ts`, bron =
 * extensie-id), de begeleiding naar `guideRuntime.ts`. Wat hier wél woont is wat per extensie is:
 *  - de afbeeldingsresolver: een pad uit de tekst (`img/{lang}/x.webp`, `{lang}` al ingevuld) wordt
 *    een blob-URL over de eigen asset-bytes. Eén URL per pad, lui aangemaakt, en bij het opruimen
 *    (uitschakelen/verwijderen) allemaal ingetrokken. Een ontbrekende asset ⇒ `''` ⇒ de viewer toont
 *    de alt-tekst in een placeholder;
 *  - het openen van een meegeleverd `.ifc`: dezelfde route als een voorbeeld (`openExampleFromString`):
 *    nieuw document zonder opslagdoel of bestandshandle, en alleen een leeg, ongewijzigd tabblad wordt
 *    hergebruikt — het actieve document wordt nooit overschreven;
 *  - het opruimen: artikelen uit het register, blob-URL's ingetrokken, eigen begeleiding gestopt. Daarna
 *    is deze groep DOOD (`disposed`): een achtergebleven timer of async-vervolg van een uitgeschakelde
 *    extensie kan geen artikelen of begeleiding meer neerzetten die niemand nog opruimt — elke methode
 *    gooit, en de afbeeldingsresolver geeft `''`.
 *
 * De permissiecontrole zit niet hier maar centraal in `permissions.ts` (`help.*` → `help`, hard).
 */
import type { AppStoreContext } from '@/state/appStore';
import { registerHelpArticles, type RegisteredHelpArticleInput } from '@/utils/helpArticleRegistry';
import type { ExtensionApi, ExtGuide, ExtHelpArticle } from './types';
import type { ExtensionHostBinding } from './extensionApi';
import { validateGuide } from './guideModel';
import { startGuideSession, stopGuideSession } from './guideRuntime';

/** Een fout die de app al zelf gemeld heeft (bv. "Bestand openen mislukt"): niet nog eens melden. */
export interface AlreadyNotifiedError extends Error {
  alreadyNotified: true;
}

export function isAlreadyNotified(error: unknown): boolean {
  return typeof error === 'object' && error !== null
    && (error as Partial<AlreadyNotifiedError>).alreadyNotified === true;
}

const IMAGE_TYPES: Record<string, string> = {
  webp: 'image/webp',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  avif: 'image/avif',
};

function imageType(path: string): string {
  const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  return IMAGE_TYPES[ext] ?? 'application/octet-stream';
}

export interface HelpApiContext {
  extensionId: string;
  assets: Record<string, Uint8Array> | undefined;
  document: AppStoreContext;
  host: ExtensionHostBinding;
  /** De volledige API van deze extensie (voor `check(api)`/`prepare(api)`); lui, want hij wordt
   *  pas ná deze groep afgemaakt. */
  getApi: () => ExtensionApi;
  /** Opruimacties die `_cleanup` uitvoert. */
  cleanupFns: (() => void)[];
}

export function createHelpApi(ctx: HelpApiContext): ExtensionApi['help'] {
  const { extensionId, assets, document, host, getApi, cleanupFns } = ctx;

  let disposed = false;
  const assertAlive = (method: string): void => {
    if (disposed) {
      throw new Error(`Extensie "${extensionId}": help.${method} na uitschakelen of verwijderen van de extensie`);
    }
  };

  const assetBytes = (name: string): Uint8Array | undefined =>
    assets && Object.prototype.hasOwnProperty.call(assets, name) ? assets[name] : undefined;

  const blobUrls = new Map<string, string>();
  const resolveImage = (path: string): string => {
    if (disposed) return '';
    const cached = blobUrls.get(path);
    if (cached) return cached;
    const bytes = assetBytes(path);
    if (!bytes || typeof URL.createObjectURL !== 'function') return '';
    const url = URL.createObjectURL(new Blob([bytes.slice()], { type: imageType(path) }));
    blobUrls.set(path, url);
    return url;
  };

  const openBundledProject = async (assetName: string): Promise<void> => {
    assertAlive('openBundledProject');
    if (typeof assetName !== 'string' || !/\.ifc$/i.test(assetName)) {
      throw new Error(`Extensie "${extensionId}": openBundledProject verwacht de naam van een .ifc-asset`);
    }
    const bytes = assetBytes(assetName);
    if (!bytes) throw new Error(`Extensie "${extensionId}": asset "${assetName}" bestaat niet`);
    let content: string;
    try {
      content = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      throw new Error(`Extensie "${extensionId}": asset "${assetName}" is geen UTF-8-tekst`);
    }
    const app = host.app.store.getState();
    const ok = await app.openExampleFromString(content, assetName, host.importLabels?.());
    if (!ok) {
      const error = new Error(`Extensie "${extensionId}": "${assetName}" kon niet geopend worden`) as AlreadyNotifiedError;
      error.alreadyNotified = true;
      throw error;
    }
    // Zoals een voorbeeld uit Backstage: vanuit Backstage (Help) naar het project zelf.
    if (host.app.store.getState().ui.activeRibbonTab === 'file') {
      host.app.store.getState().setUI({ activeRibbonTab: 'start' });
    }
  };

  const extensionName = (): string =>
    host.app.store.getState().installedExtensions[extensionId]?.manifest.name ?? extensionId;

  // Een `project://`-link in een Help-artikel. Eigen melding (er loopt dan niet per se een
  // begeleiding), en een dubbelklik opent niet twee documenten.
  let linkOpening = false;
  const openProjectFromLink = (assetName: string): void => {
    if (linkOpening) return;
    linkOpening = true;
    openBundledProject(assetName)
      .catch((error: unknown) => {
        if (isAlreadyNotified(error)) return;
        host.app.store.getState().notify({
          severity: 'error',
          messageKey: 'notifications.extHelpProjectOpenFailed',
          params: { name: extensionName(), file: String(assetName) },
          detail: error instanceof Error ? error.message : String(error),
        });
      })
      .finally(() => { linkOpening = false; });
  };

  function reportError(stepId: string, error: unknown): void {
    if (isAlreadyNotified(error)) return;
    const message = error instanceof Error ? error.message : String(error);
    host.app.store.getState().notify({
      severity: 'error',
      messageKey: 'notifications.extGuideCallbackFailed',
      params: { name: extensionName() },
      detail: stepId ? `${stepId}: ${message}` : message,
      // Een `check` die bij elke wijziging opnieuw gooit, wordt één regel met een teller.
      dedupeKey: `ext-help:${extensionId}:${stepId}`,
    });
  }

  let unregisterArticles: (() => void) | null = null;
  const dropArticles = () => {
    unregisterArticles?.();
    unregisterArticles = null;
  };

  cleanupFns.push(() => {
    disposed = true;
    dropArticles();
    stopGuideSession(extensionId);
    for (const url of blobUrls.values()) URL.revokeObjectURL(url);
    blobUrls.clear();
  });

  return {
    registerArticles(articles: ExtHelpArticle[]) {
      assertAlive('registerArticles');
      if (!Array.isArray(articles)) {
        throw new Error(`Extensie "${extensionId}": registerArticles verwacht een lijst artikelen`);
      }
      // Alleen de bekende velden, als kopie: een extensie die haar objecten later muteert, verandert
      // Help niet.
      const input: RegisteredHelpArticleInput[] = articles.map(a => ({
        id: a?.id,
        kind: a?.kind,
        order: a?.order,
        title: { nl: a?.title?.nl, en: a?.title?.en },
        body: { nl: a?.body?.nl, en: a?.body?.en },
      } as RegisteredHelpArticleInput));
      const result = registerHelpArticles(extensionId, input, {
        resolveImage,
        openProject: openProjectFromLink,
      });
      if (!result.ok) {
        throw new Error(`Extensie "${extensionId}": ongeldige Help-artikelen — ${result.errors.join('; ')}`);
      }
      unregisterArticles = result.unregister;
    },

    unregisterArticles() {
      assertAlive('unregisterArticles');
      dropArticles();
    },

    openBundledProject,

    startGuide(guide: ExtGuide) {
      assertAlive('startGuide');
      const errors = validateGuide(guide, name => assetBytes(name) !== undefined);
      if (errors.length > 0) {
        throw new Error(`Extensie "${extensionId}": ongeldige begeleiding — ${errors.join('; ')}`);
      }
      startGuideSession({
        extensionId,
        api: getApi(),
        subscribe: listener => document.store.subscribe(listener),
        openBundledProject,
        resolveImage,
        reportError,
      }, guide);
    },

    stopGuide() {
      assertAlive('stopGuide');
      stopGuideSession(extensionId);
    },
  };
}

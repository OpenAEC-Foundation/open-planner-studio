// Dev-link voor handmatige controle, alleen op de dev-server: `?open=<pad>` opent een bestand uit de
// repo (pad vanaf de root, bijv. `examples/03-kantoorgebouw-zuidas.ifc`) via dezelfde route als
// Bestand › Openen (formaatherkenning, bestandsnaam, meldingen). `?theme=light|dark` zet het thema
// voor die sessie (zie `devSessionTheme` in settingsStore.ts). `?tab=planning` opent die tab van het
// lint. `?progressSheet=<pad>` opent daarna de voortgangsimport met dat blad al ingelezen. `?help=<artikel-id>`
// (eventueel `%23<anker>`) opent Help op dat artikel. `?mcp=connect` opent de tab MCP met het venster
// Verbindingsgegevens. `?flag=<id>[,<id>]` zet die feature flags aan voor deze paginalading (niet bewaard).
// `?source=<pad>` (ook meer dan één keer) maakt een bronbestand van een externe relatie
// leesbaar in de browser: een koppeling waarvan het bronpad dezelfde bestandsnaam heeft, leest dat repobestand,
// met de `Last-Modified` van de dev-server als versie. Valt uit elke productiebouw: App.tsx, ProgressImportDialog.tsx en AiConnectionGroup.tsx
// importeren deze module alleen dynamisch achter `import.meta.env.DEV`.
// Uitleg: `docs/dev-link.md`.
import i18n from '@/i18n/config';
import { buildImportLabels } from '@/i18n/importLabels';
import { useAppStore } from '@/state/appStore';
import { openedFromFile } from '@/services/fileAccess/webBackend';
import type { OpenedFile } from '@/services/fileAccess';
import { binaryExtensions } from '@/services/formatRegistry';
import { ifcForeignContentEnabled } from '@/utils/featureFlags';
import type { RibbonTab } from '@/state/slices/types';
import { FEATURE_FLAGS } from '@/utils/featureFlags';
import { readExternalSource } from '@/state/externalSource';

const RIBBON_TABS: readonly RibbonTab[] = ['file', 'start', 'planning', 'resources', 'beeld', 'instellingen', 'table', 'ifc', 'report', 'ai'];

/** `?open=` → pad vanaf de repo-root, of `null` bij een leeg of ongeldig pad (geen `..`, geen
 *  absoluut pad, geen backslash). De Vite-dev-server serveert elk bestand onder de root. */
export function devFilePath(raw: string | null): string | null {
  if (!raw) return null;
  const parts = raw.split('/');
  if (raw.includes('\\') || parts.some(p => p === '' || p === '.' || p === '..')) return null;
  return parts.map(encodeURIComponent).join('/');
}

async function fetchDevFile(param: string, raw: string, extensions: readonly string[]): Promise<OpenedFile> {
  const path = devFilePath(raw);
  if (!path) throw new Error(`?${param}=${raw}: alleen een pad vanaf de repo-root, zonder ..`);
  const res = await fetch(`${import.meta.env.BASE_URL}${path}`);
  // Een onbekend pad geeft bij Vite de SPA-terugval (index.html, status 200): dat is geen bestand.
  if (!res.ok || (res.headers.get('content-type') ?? '').includes('text/html')) {
    throw new Error(`?${param}=${raw}: niet gevonden`);
  }
  const name = raw.split('/').pop()!;
  const file = new File([await res.blob()], name);
  // Zoals de bestandskiezer zonder handle (Firefox/Safari): tekst of bytes per formaat, geen ref.
  return openedFromFile(file, null, { binaryExtensions: [...extensions] });
}

async function openDevFile(raw: string): Promise<void> {
  // #804 fase 1a: met de flag `ifcForeignContent` leest IFC als bytes, zoals Bestand → Openen.
  const ifcBytes = ifcForeignContentEnabled(useAppStore.getState().ui.featureFlags);
  const opened = await fetchDevFile('open', raw, binaryExtensions({ ifcBytes }));
  await useAppStore.getState().openOpenedFile(opened, buildImportLabels((key) => i18n.t(key, { ns: 'common' })));
}

/**
 * `?source=`: bronbestanden voor externe relaties uit de repo. De browser kan een bronpad als
 * `/projecten/Installateur.ifc` niet lezen; deze link vervangt daarom `parseExternalSource` en
 * `externalSourceVersion` in de store (zoals de tests dat doen). Een koppeling naar een bestand met dezelfde
 * bestandsnaam leest het repobestand; elk ander pad gaat naar de gewone actie. De versie is de
 * `Last-Modified` van de dev-server, dus een nieuwe versie maak je door het repobestand op te slaan.
 */
function installDevSources(raws: string[]): void {
  const sources = raws.map(raw => {
    const path = devFilePath(raw);
    if (!path) throw new Error(`?source=${raw}: alleen een pad vanaf de repo-root, zonder ..`);
    return { raw, url: `${import.meta.env.BASE_URL}${path}`, name: raw.split('/').pop()! };
  });
  const pick = (filePath: string) => {
    const name = filePath.split(/[\\/]/).pop();
    return sources.find(source => source.name === name);
  };
  const modified = (res: Response): string | undefined => {
    const header = res.headers.get('last-modified');
    const date = header ? new Date(header) : null;
    return date && !isNaN(date.getTime()) ? date.toISOString() : undefined;
  };
  const { parseExternalSource, externalSourceVersion } = useAppStore.getState();
  useAppStore.setState({
    externalSourceVersion: async (filePath) => {
      const source = pick(filePath);
      if (!source) return externalSourceVersion(filePath);
      const res = await fetch(source.url, { method: 'HEAD', cache: 'no-store' });
      return res.ok ? modified(res) : undefined;
    },
    parseExternalSource: async (filePath, labels) => {
      const source = pick(filePath);
      if (!source) return parseExternalSource(filePath, labels);
      try {
        const res = await fetch(source.url, { cache: 'no-store' });
        if (!res.ok || (res.headers.get('content-type') ?? '').includes('text/html')) throw new Error(`?source=${source.raw}: niet gevonden`);
        const bytes = new Uint8Array(await res.arrayBuffer());
        const text = new TextDecoder().decode(bytes);
        const read = await readExternalSource(filePath, { readTextFile: async () => text, readFile: async () => bytes }, labels);
        const version = modified(res);
        return { ...read, ...(version ? { version } : {}), readAt: new Date().toISOString() };
      } catch (err) {
        console.error('[dev-link] source', err);
        return null;
      }
    },
  });
}

let pendingProgressSheet: OpenedFile | null = null;

/** Het blad van `?progressSheet=`, één keer: de dialoog haalt het op zodra hij opent. */
export function takeDevProgressSheet(): OpenedFile | null {
  const opened = pendingProgressSheet;
  pendingProgressSheet = null;
  return opened;
}

let pendingConnectionDetails = false;

/** `?mcp=connect`, één keer: de groep Verbinding opent dan zijn venster Verbindingsgegevens. */
export function takeDevConnectionDetails(): boolean {
  const open = pendingConnectionDetails;
  pendingConnectionDetails = false;
  return open;
}

/** `?flag=` → de bekende flag-id's uit die lijst; onbekende vallen stil weg. */
export function devFeatureFlags(raw: string | null): string[] {
  if (!raw) return [];
  const known = new Set(FEATURE_FLAGS.map(flag => flag.id));
  return raw.split(',').map(id => id.trim()).filter(id => known.has(id));
}

let started = false;

/** Eén keer per paginalading (StrictMode draait effecten dubbel). Een fout komt als gewone melding. */
export async function openDevLinkOnce(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('open');
  const tab = RIBBON_TABS.find(t => t === params.get('tab'));
  const help = params.get('help');
  const mcp = params.get('mcp');
  const flags = devFeatureFlags(params.get('flag'));
  const sources = params.getAll('source');
  if (started || (!raw && !tab && !help && mcp !== 'connect' && flags.length === 0 && sources.length === 0)) return;
  started = true;
  if (flags.length > 0) {
    // Alleen in de store, niet in `ops-featureFlags`: een gewone herlaad zonder `flag=` is weer de eigen keuze.
    const current = useAppStore.getState().ui.featureFlags;
    useAppStore.getState().setUI({ featureFlags: { ...current, ...Object.fromEntries(flags.map(id => [id, true])) } });
  }
  try {
    // Vóór het openen: de controle bij openen leest de bron dan al via de repo.
    if (sources.length > 0) installDevSources(sources);
    if (raw) {
      await openDevFile(raw);
      const sheet = params.get('progressSheet');
      if (sheet) {
        pendingProgressSheet = await fetchDevFile('progressSheet', sheet, ['xlsx']);
        useAppStore.getState().setUI({ showProgressImportDialog: true });
      }
    }
    if (help) {
      // De link wil Help laten zien: het welkomstvenster van een nieuwe browser gaat voor deze keer
      // dicht (niet bewaard als gezien, dus een gewone herlaad toont het weer).
      useAppStore.getState().setUI({ showWelcomeDialog: false });
      useAppStore.getState().openHelpArticle(help);
    }
    if (mcp === 'connect') {
      // Zoals `?help=`: het welkomstvenster gaat voor deze keer dicht. De MCP-koppeling staat alleen
      // voor deze paginalading aan (setUI bewaart `aiMode` niet); de groep Verbinding komt pas na deze
      // tabwissel in beeld en neemt dan het verzoek (`takeDevConnectionDetails`).
      pendingConnectionDetails = true;
      useAppStore.getState().setUI({ showWelcomeDialog: false, aiMode: true, activeRibbonTab: 'ai', ribbonCompact: false });
    }
  } catch (err) {
    console.error('[dev-link]', err);
    useAppStore.getState().notify({
      severity: 'error', messageKey: 'notifications.openFailed', detail: err instanceof Error ? err.message : String(err),
    });
  }
  // Na het openen: een bestand openen kan zelf de tab kiezen.
  if (tab) useAppStore.getState().setUI({ activeRibbonTab: tab });
}

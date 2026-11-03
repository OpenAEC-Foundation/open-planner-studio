// Dev-link voor handmatige controle, alleen op de dev-server: `?open=<pad>` opent een bestand uit de
// repo (pad vanaf de root, bijv. `examples/03-kantoorgebouw-zuidas.ifc`) via dezelfde route als
// Bestand › Openen (formaatherkenning, bestandsnaam, meldingen). `?theme=light|dark` zet het thema
// voor die sessie (zie `devSessionTheme` in settingsStore.ts). `?tab=planning` opent die tab van het
// lint. `?progressSheet=<pad>` opent daarna de voortgangsimport met dat blad al ingelezen. `?help=<artikel-id>`
// (eventueel `%23<anker>`) opent Help op dat artikel. `?mcp=connect` opent de tab MCP met het venster
// Verbindingsgegevens. Valt uit elke productiebouw: App.tsx, ProgressImportDialog.tsx en AiConnectionGroup.tsx
// importeren deze module alleen dynamisch achter `import.meta.env.DEV`.
// Uitleg: `docs/dev-link.md`.
import i18n from '@/i18n/config';
import { buildImportLabels } from '@/i18n/importLabels';
import { useAppStore } from '@/state/appStore';
import { openedFromFile } from '@/services/fileAccess/webBackend';
import type { OpenedFile } from '@/services/fileAccess';
import { binaryExtensions } from '@/services/formatRegistry';
import type { RibbonTab } from '@/state/slices/types';

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
  const opened = await fetchDevFile('open', raw, binaryExtensions());
  await useAppStore.getState().openOpenedFile(opened, buildImportLabels((key) => i18n.t(key, { ns: 'common' })));
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

let started = false;

/** Eén keer per paginalading (StrictMode draait effecten dubbel). Een fout komt als gewone melding. */
export async function openDevLinkOnce(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('open');
  const tab = RIBBON_TABS.find(t => t === params.get('tab'));
  const help = params.get('help');
  const mcp = params.get('mcp');
  if (started || (!raw && !tab && !help && mcp !== 'connect')) return;
  started = true;
  try {
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

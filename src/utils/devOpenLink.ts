// Dev-link voor handmatige controle, alleen op de dev-server: `?open=<bestand>` opent een testbestand
// uit `dev-files/` in de repo via dezelfde route als Bestand › Openen (formaatherkenning, bestandsnaam,
// meldingen). `?theme=light|dark` zet het thema voor die sessie (zie `devSessionTheme` in
// settingsStore.ts). Valt uit elke productiebouw: main.tsx importeert deze module alleen dynamisch
// achter `import.meta.env.DEV`. Uitleg: `docs/dev-link.md`.
import i18n from '@/i18n/config';
import { buildImportLabels } from '@/i18n/importLabels';
import { useAppStore } from '@/state/appStore';
import { openedFromFile } from '@/services/fileAccess/webBackend';
import { binaryExtensions } from '@/services/formatRegistry';

/** De vaste map in de repo; de dev-server serveert hem, een build neemt hem niet mee. */
const DEV_FILES_DIR = 'dev-files';

/** `?open=` → pad binnen `dev-files/`, of `null` bij een leeg of ongeldig pad (geen `..`, geen
 *  absoluut pad, geen backslash). Submappen mogen. */
export function devFilePath(raw: string | null): string | null {
  if (!raw) return null;
  const parts = raw.split('/');
  if (raw.includes('\\') || parts.some(p => p === '' || p === '.' || p === '..')) return null;
  return parts.map(encodeURIComponent).join('/');
}

async function openDevFile(raw: string): Promise<void> {
  const path = devFilePath(raw);
  if (!path) throw new Error(`?open=${raw}: alleen een pad binnen ${DEV_FILES_DIR}/, zonder ..`);
  const res = await fetch(`${import.meta.env.BASE_URL}${DEV_FILES_DIR}/${path}`);
  // Een onbekend pad geeft bij Vite de SPA-terugval (index.html, status 200): dat is geen bestand.
  if (!res.ok || (res.headers.get('content-type') ?? '').includes('text/html')) {
    throw new Error(`?open=${raw}: ${DEV_FILES_DIR}/${raw} niet gevonden`);
  }
  const name = raw.split('/').pop()!;
  const file = new File([await res.blob()], name);
  // Zoals de bestandskiezer zonder handle (Firefox/Safari): tekst of bytes per formaat, geen ref.
  const opened = await openedFromFile(file, null, { binaryExtensions: binaryExtensions() });
  await useAppStore.getState().openOpenedFile(opened, buildImportLabels((key) => i18n.t(key, { ns: 'common' })));
}

let started = false;

/** Eén keer per paginalading (StrictMode draait effecten dubbel). Een fout komt als gewone melding. */
export async function openDevLinkOnce(): Promise<void> {
  const raw = new URLSearchParams(window.location.search).get('open');
  if (started || !raw) return;
  started = true;
  try {
    await openDevFile(raw);
  } catch (err) {
    console.error('[dev-link]', err);
    useAppStore.getState().notify({
      severity: 'error', messageKey: 'notifications.openFailed', detail: err instanceof Error ? err.message : String(err),
    });
  }
}

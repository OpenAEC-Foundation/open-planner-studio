import i18n from '@/i18n/config';
import { buildImportLabels } from '@/i18n/importLabels';
import { useAppStore } from '@/state/appStore';
import { openedFromFile } from '@/services/fileAccess/webBackend';
import type { OpenedFile } from '@/services/fileAccess';
import { binaryExtensions, readOptionsFor } from '@/services/formatRegistry';
import type { RibbonTab } from '@/state/slices/types';
import { FEATURE_FLAGS } from '@/utils/featureFlags';
import { readExternalSource } from '@/state/externalSource';

const RIBBON_TABS: readonly RibbonTab[] = ['file', 'start', 'planning', 'resources', 'beeld', 'instellingen', 'table', 'ifc', 'report', 'ai'];

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
  if (!res.ok || (res.headers.get('content-type') ?? '').includes('text/html')) {
    throw new Error(`?${param}=${raw}: niet gevonden`);
  }
  const name = raw.split('/').pop()!;
  const file = new File([await res.blob()], name);
  return openedFromFile(file, null, { binaryExtensions: [...extensions] });
}

async function openDevFile(raw: string): Promise<void> {
  const opened = await fetchDevFile('open', raw, binaryExtensions(readOptionsFor(useAppStore.getState().ui.featureFlags)));
  await useAppStore.getState().openOpenedFile(opened, buildImportLabels((key) => i18n.t(key, { ns: 'common' })));
}

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

export function takeDevProgressSheet(): OpenedFile | null {
  const opened = pendingProgressSheet;
  pendingProgressSheet = null;
  return opened;
}

let pendingConnectionDetails = false;

export function takeDevConnectionDetails(): boolean {
  const open = pendingConnectionDetails;
  pendingConnectionDetails = false;
  return open;
}

export function devFeatureFlags(raw: string | null): string[] {
  if (!raw) return [];
  const known = new Set(FEATURE_FLAGS.map(flag => flag.id));
  return raw.split(',').map(id => id.trim()).filter(id => known.has(id));
}

let started = false;

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
    const current = useAppStore.getState().ui.featureFlags;
    useAppStore.getState().setUI({ featureFlags: { ...current, ...Object.fromEntries(flags.map(id => [id, true])) } });
  }
  try {
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
      useAppStore.getState().setUI({ showWelcomeDialog: false });
      useAppStore.getState().openHelpArticle(help);
    }
    if (mcp === 'connect') {
      pendingConnectionDetails = true;
      useAppStore.getState().setUI({ showWelcomeDialog: false, aiMode: true, activeRibbonTab: 'ai', ribbonCompact: false });
    }
  } catch (err) {
    console.error('[dev-link]', err);
    useAppStore.getState().notify({
      severity: 'error', messageKey: 'notifications.openFailed', detail: err instanceof Error ? err.message : String(err),
    });
  }
  if (tab) useAppStore.getState().setUI({ activeRibbonTab: tab });
}

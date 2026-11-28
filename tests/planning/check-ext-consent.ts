import './domStub';
import {
  askExtensionConsent, setConsentAsker, resetConsentAsker,
  type ExtensionConsentRequest,
} from '@/extensions/consent';
import { buildConsentRequest } from '@/extensions/extensionService';
import type { ExtensionManifest } from '@/extensions/types';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};

const vraag: ExtensionConsentRequest = {
  id: 'demo', name: 'Demo', version: '1.0.0', author: 'Iemand',
  description: 'doet iets', declared: ['ribbon', 'events'],
  repository: 'https://example.invalid/demo',
  source: 'catalog', verification: 'checksum', isDesktop: true,
};

resetConsentAsker();
eq('1 zonder vrager wordt er geweigerd', await askExtensionConsent(vraag), false);

setConsentAsker(() => { throw new Error('dialoog kapot'); });
eq('2 een vrager die synchroon gooit ⇒ weigeren', await askExtensionConsent(vraag), false);

setConsentAsker(() => Promise.reject(new Error('component ontkoppeld')));
eq('3 een vrager die rejecteert ⇒ weigeren', await askExtensionConsent(vraag), false);

setConsentAsker(() => Promise.resolve(true));
eq('4 toestaan komt door', await askExtensionConsent(vraag), true);
setConsentAsker(() => Promise.resolve(false));
eq('5 weigeren komt door', await askExtensionConsent(vraag), false);

{
  let gezien: ExtensionConsentRequest | null = null;
  setConsentAsker((r) => { gezien = r; return Promise.resolve(true); });
  await askExtensionConsent(vraag);
  const g = gezien as unknown as ExtensionConsentRequest;
  for (const veld of ['id', 'name', 'version', 'author', 'description', 'source', 'verification', 'isDesktop'] as const) {
    eq(`6 de vraag draagt "${veld}"`, g[veld], vraag[veld]);
  }
  eq('6a en de declaratie', g.declared, vraag.declared);
  eq('6b en de repository', g.repository, vraag.repository);
}

{
  const manifest: ExtensionManifest = {
    id: 'uit-manifest', name: 'Naam uit manifest', version: '2.3.4',
    apiVersion: '1.0', minAppVersion: '2026.1.0', author: 'De Maker',
    description: 'wat het doet', category: 'Utility', main: 'main.js',
    permissions: ['ribbon', 'pdf-fonts'], repository: 'https://example.invalid/x',
  };
  const r = buildConsentRequest(manifest, 'override-id', { source: 'catalog', verification: 'checksum' }, true);
  eq('6c de id komt van de aanroeper, niet uit het manifest', r.id, 'override-id');
  eq('6d naam', r.name, 'Naam uit manifest');
  eq('6e versie', r.version, '2.3.4');
  eq('6f auteur', r.author, 'De Maker');
  eq('6g omschrijving', r.description, 'wat het doet');
  eq('6h declaratie', r.declared, ['ribbon', 'pdf-fonts']);
  eq('6i repository', r.repository, 'https://example.invalid/x');
  eq('6j bron', r.source, 'catalog');
  eq('6k verificatie', r.verification, 'checksum');
  eq('6l platform', r.isDesktop, true);

  const kaal = buildConsentRequest({ ...manifest, permissions: [] }, 'x', {}, false);
  eq('6m default bron is zip', kaal.source, 'zip');
  eq('6n default verificatie is local', kaal.verification, 'local');
  eq('6o lege declaratie blijft leeg', kaal.declared, []);
  eq('6p platform komt door', kaal.isDesktop, false);

  const zonder = buildConsentRequest(
    { ...manifest, permissions: undefined as unknown as ExtensionManifest['permissions'] }, 'x', {}, false);
  eq('6q ontbrekende permissions wordt een lege lijst', zonder.declared, []);
}

setConsentAsker(() => Promise.resolve(true));
eq('7 opzet: staat op toestaan', await askExtensionConsent(vraag), true);
resetConsentAsker();
eq('7a na reset wordt er weer geweigerd', await askExtensionConsent(vraag), false);

{
  const { readFileSync, existsSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { join, dirname } = await import('node:path');
  let root = dirname(fileURLToPath(import.meta.url));
  while (!existsSync(join(root, 'package.json')) && dirname(root) !== root) root = dirname(root);

  const strip = (src: string): string => {
    let out = ''; let mode: 'code' | 'line' | 'block' | '"' | "'" | '`' = 'code';
    for (let i = 0; i < src.length; i++) {
      const c = src[i], n = src[i + 1];
      if (mode === 'code') {
        if (c === '/' && n === '/') { mode = 'line'; i++; continue; }
        if (c === '/' && n === '*') { mode = 'block'; i++; continue; }
        if (c === '"' || c === "'" || c === '`') mode = c;
        out += c;
      } else if (mode === 'line') { if (c === '\n') { mode = 'code'; out += c; } }
      else if (mode === 'block') { if (c === '*' && n === '/') { mode = 'code'; i++; } }
      else { if (c === '\\') { out += c + (n ?? ''); i++; continue; } if (c === mode) mode = 'code'; out += c; }
    }
    return out;
  };

  const paden = {
    service: 'src/extensions/extensionService.ts',
    bridge: 'src/extensions/consentBridge.ts',
    app: 'src/App.tsx',
    devBridge: 'src/utils/devBridge.ts',
    panel: 'src/components/backstage/ExtensionManagerPanel.tsx',
  };
  const ontbreekt = Object.values(paden).filter((p) => !existsSync(join(root, p)));
  checks++;
  if (ontbreekt.length) {
    diffs.push(`8 bron-assert overgeslagen: niet gevonden (${ontbreekt.join(', ')})`);
  } else {
    const src = Object.fromEntries(
      Object.entries(paden).map(([k, p]) => [k, strip(readFileSync(join(root, p), 'utf8'))]),
    ) as Record<keyof typeof paden, string>;

    eq('8a de stripper haalt commentaar weg', src.service.includes('vertrouwensvraag'), false);
    eq('8b de stripper laat code staan', src.service.includes('installFromZipBlob'), true);

    const gates = (src.service.match(/gateConsent\(/g) ?? []).length;
    eq('9 er zijn precies drie gateConsent-plekken (definitie + zip-pad + js-pad)', gates, 3);
    eq('9c en de poort bouwt de vraag via buildConsentRequest', /askExtensionConsent\(buildConsentRequest\(/.test(src.service), true);
    eq('9a het zip-pad gaat langs de poort',
      /if \(!await gateConsent\(manifest, manifest\.id, opts\)\) return 'declined';/.test(src.service), true);
    eq('9b het js-pad ook', /if \(!await gateConsent\(manifest, manifest\.id, \{ source: 'js'/.test(src.service), true);

    const zip = src.service.slice(src.service.indexOf('export async function installFromZipBlob'));
    const gateIdx = zip.indexOf('gateConsent');
    const parseIdx = zip.indexOf('parseZipEntries');
    const identityIdx = zip.indexOf('manifest.id !== expected.id');
    const saveIdx = zip.indexOf('saveExtensionToDb');
    const disableIdx = zip.indexOf('disableExtension');
    eq('10 de ZIP-parser staat vóór consent', parseIdx > -1 && parseIdx < gateIdx, true);
    eq('10b de verwachte catalogusidentiteit wordt vóór consent gecontroleerd',
      identityIdx > -1 && identityIdx < gateIdx, true);
    eq('10 de poort staat vóór het opslaan', gateIdx > -1 && gateIdx < saveIdx, true);
    eq('10a en vóór het deactiveren van een vorige versie', gateIdx > -1 && gateIdx < disableIdx, true);

    eq('10c overrideId bestaat niet meer in het installatiepad', /overrideId/.test(src.service), false);
    const catalogInstall = src.service.slice(
      src.service.indexOf('export async function installFromCatalog'),
      src.service.indexOf('export interface DownloadVerdict'),
    );
    eq('10d catalogusinstallatie bindt id én versie als verwachte identiteit',
      /installFromZipBlob\([\s\S]*?\{ id: entry\.id, version: entry\.version \}/.test(catalogInstall), true);

    const jsInstall = src.service.slice(
      src.service.indexOf('export async function installFromJsFile'),
      src.service.indexOf('// ── ZIP-afhandeling'),
    );
    eq('10e losse JavaScript wordt vóór consent gevalideerd',
      jsInstall.indexOf('manifestFromJavaScript') > -1
        && jsInstall.indexOf('manifestFromJavaScript') < jsInstall.indexOf('gateConsent'), true);
    eq('10f ook de directe dev-bridge codefixture valideert haar manifest',
      /parseExtensionManifest\(manifest, 'fresh'\)/.test(src.devBridge), true);

    eq('11 alleen devBridge zet assumeConsent', /assumeConsent: true/.test(src.devBridge), true);
    eq('11a de service zet hem nergens zelf', /assumeConsent: true/.test(src.service), false);
    eq('11b het paneel ook niet', /assumeConsent/.test(src.panel), false);

    eq('12 App.tsx registreert de vrager', /installConsentDialogAsker\(\)/.test(src.app), true);
    eq('12a en importeert hem eager (niet via lazy())', /lazy\([^)]*consentBridge/.test(src.app), false);

    eq('13 het paneel onderscheidt geweigerd van mislukt', /=== 'failed'/.test(src.panel), true);

    eq('14 de bridge laat geen promise hangen bij een tweede vraag', /vorige\(false\)/.test(src.bridge), true);
  }
}

resetConsentAsker();

if (diffs.length === 0) {
  console.log(`OK: extensie-toestemming — ${checks} checks groen`);
} else {
  console.log(`XX extensie-toestemming — ${diffs.length} van ${checks} checks rood:`);
  for (const d of diffs) console.log(`   XX ${d}`);
  process.exit(1);
}

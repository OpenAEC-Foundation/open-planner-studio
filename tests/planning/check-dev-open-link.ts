// Dev-link `?open=` / `?theme=` (docs/dev-link.md): de padregel voor `?open=<pad>` (vanaf de repo-root), en het bewijs dat
// de dev-code uit een productiebouw valt. Vite minificeert een productiebouw met esbuild, met
// `import.meta.env.DEV` vervangen door false. Deze check doet dat per bronbestand en kijkt of de
// dode takken weg zijn. Daarnaast: `devOpenLink` wordt alleen dynamisch geladen, vanuit App.tsx.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// De store en i18n zetten bij import de documenttaal; dit is de kleinste DOM-vorm daarvoor.
(globalThis as unknown as { document: { documentElement: { dir: string; lang: string } } }).document = {
  documentElement: { dir: 'ltr', lang: 'en' },
};
const { devFilePath } = await import('@/utils/devOpenLink');

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
let failures = 0;
const check = (ok: boolean, label: string) => {
  console.log(`${ok ? 'OK ' : 'XX '} dev-open-link: ${label}`);
  if (!ok) failures++;
};

// 1. Padregel: pad vanaf de repo-root, submappen mogen, tekens gecodeerd.
check(devFilePath('examples/03-kantoorgebouw-zuidas.ifc') === 'examples/03-kantoorgebouw-zuidas.ifc', 'voorbeeld uit examples/');
check(devFilePath('ronde 2/plan #1.xer') === 'ronde%202/plan%20%231.xer', 'submap en tekens gecodeerd');
for (const bad of [null, '', '../package.json', 'a/../../x', '/etc/passwd', 'a//b', './a', 'a\\b']) {
  check(devFilePath(bad) === null, `geweigerd: ${JSON.stringify(bad)}`);
}

// 2. Productiebouw: zoals Vite (esbuild-minify, DEV=false), per bestand.
const esbuild = join(root, 'node_modules/.bin/esbuild');
function prodTransform(file: string): string {
  return execFileSync(esbuild, [
    join(root, file), '--minify', '--format=esm', '--log-level=error',
    '--define:import.meta.env.DEV=false', '--define:import.meta.env.PROD=true',
  ], { encoding: 'utf8' });
}
const app = prodTransform('src/App.tsx');
check(!app.includes('devOpenLink'), 'App.tsx: de import van devOpenLink valt weg');
const settings = prodTransform('src/utils/settingsStore.ts');
check(!/["']theme["']\)/.test(settings) && !settings.includes('location.search'), 'settingsStore.ts: ?theme valt weg');
// Tegenproef: met DEV=true blijft alles staan, dus de check meet echt.
const devTransform = (file: string) => execFileSync(esbuild, [join(root, file), '--minify', '--format=esm',
  '--log-level=error', '--define:import.meta.env.DEV=true', '--define:import.meta.env.PROD=false'], { encoding: 'utf8' });
check(devTransform('src/App.tsx').includes('devOpenLink'), 'tegenproef: App.tsx in dev houdt de import');
check(devTransform('src/utils/settingsStore.ts').includes('location.search'), 'tegenproef: settingsStore.ts in dev leest ?theme');

// 3. Niet in Tauri-dev (dezelfde Vite-server): met DEV=true, het linkthema alleen in de browser,
//    nooit met de Tauri-marker. App.tsx: de `isTauri()`-guard staat in dezelfde voorwaarde.
const probe = join(dirname(fileURLToPath(import.meta.url)), '.dev-open-link-theme-probe.mjs');
execFileSync(esbuild, [join(root, 'src/utils/settingsStore.ts'), '--bundle', '--platform=node', '--format=esm',
  '--log-level=error', `--alias:@=${join(root, 'src')}`, '--define:import.meta.env.DEV=true',
  '--define:import.meta.env.PROD=false', `--outfile=${probe}`]);
const probeTheme = (tauri: boolean) => execFileSync(process.execPath, ['--input-type=module', '-e', `
  globalThis.localStorage = { getItem: () => 'light', setItem() {}, removeItem() {} };
  globalThis.window = { location: { search: '?theme=dark' } ${tauri ? ', __TAURI_INTERNALS__: {}' : ''} };
  const { peekTheme, initTheme } = await import(${JSON.stringify(pathToFileURL(probe).href)});
  console.log(peekTheme() + ',' + await initTheme());`], { encoding: 'utf8' }).trim();
check(probeTheme(false) === 'dark,dark', `browser-dev: ?theme=dark geeft dark (${probeTheme(false)})`);
check(probeTheme(true) === 'light,light', `Tauri-dev: ?theme=dark negeert de link, bewaard light blijft (${probeTheme(true)})`);
rmSync(probe, { force: true });
check(/import\.meta\.env\.DEV && !isTauri\(\) &&[^\n]*\n\s*void import\(['"]@\/utils\/devOpenLink['"]\)/
  .test(readFileSync(join(root, 'src/App.tsx'), 'utf8')), 'App.tsx: ?open alleen met DEV en zonder Tauri');

// 4. Geen andere ingang naar devOpenLink dan de dynamische import in App.tsx.
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}
const importers = walk(join(root, 'src'))
  .filter(p => /(from\s+|import\()['"][^'"]*devOpenLink['"]/.test(readFileSync(p, 'utf8')))
  .map(p => relative(root, p));
check(importers.length === 1 && importers[0] === 'src/App.tsx', `alleen App.tsx importeert devOpenLink (${importers.join(', ')})`);
check(/import\(['"]@\/utils\/devOpenLink['"]\)/.test(readFileSync(join(root, 'src/App.tsx'), 'utf8')), 'App.tsx laadt devOpenLink dynamisch');

if (failures > 0) process.exit(1);

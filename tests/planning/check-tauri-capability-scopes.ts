// Na PR #946 (eigen rapportlettertype): elk scopepad in een Tauri-capability moet op elk platform een geldig globpatroon zijn.
//
// tauri-plugin-fs bouwt bij elke aanroep van een commando met een eigen scope (bijv. `fs:allow-open`
// met `allow`) de scope opnieuw op (`tauri::scope::fs::Scope::new`). Eén ongeldig patroon laat die
// aanroep dan falen, voor ELK pad, ook binnen `$HOME` of `$APPDATA`. `C:\\Windows\\Fonts\\**` was op
// Linux en macOS zo'n patroon: daar is `\` geen padscheiding, dus `**` vormde geen eigen padstuk
// (glob: "recursive wildcards must form a single path component"). Gevolg: `open`, `readDir` en
// `readFile` weigerden alles, en daarmee Opslaan, het openen van .xer/.mpp en de MCP-ontdekkingsbestanden.
//
// De regel hieronder volgt `glob::Pattern::new` na `push_pattern` (componenten opnieuw samengevoegd):
// `**` mag alleen als heel padstuk staan, met als scheiding `/` op Unix en `/` of `\` op Windows.
// Een backslash weigeren we overal: op Unix is hij een letterlijk teken in een naam, dus nooit bedoeld.
//
// Mutatiebewijs: zet in `src-tauri/capabilities/default.json` één pad terug op `C:\\Windows\\Fonts\\**` ⇒ 1 rood.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

let failures = 0;
function check(name: string, cond: boolean, detail = ''): void {
  if (cond) console.log(`ok ${name}`);
  else { failures++; console.log(`XX ${name}${detail ? `: ${detail}` : ''}`); }
}

/** Is `pattern` geldig als `**` alleen als heel padstuk staat, met `separators` als scheiding? */
function recursiveWildcardsValid(pattern: string, separators: RegExp): boolean {
  return pattern.split(separators).every((part) => !part.includes('**') || part === '**');
}

type ScopeEntry = { path?: string } | string;
type PermissionEntry = string | { identifier: string; allow?: ScopeEntry[]; deny?: ScopeEntry[] };

const dir = 'src-tauri/capabilities';
const files = readdirSync(dir).filter((name) => name.endsWith('.json'));
check('0 er is minstens één capability-bestand', files.length > 0);

const paths: Array<{ where: string; path: string }> = [];
for (const file of files) {
  const capability = JSON.parse(readFileSync(join(dir, file), 'utf8')) as { permissions: PermissionEntry[] };
  for (const entry of capability.permissions) {
    if (typeof entry === 'string') continue;
    for (const scoped of [...(entry.allow ?? []), ...(entry.deny ?? [])]) {
      if (typeof scoped === 'object' && typeof scoped.path === 'string') paths.push({ where: `${file} ${entry.identifier}`, path: scoped.path });
    }
  }
}
check('0b de lettertypemappen staan als scopepad in de capability (anders toetst dit niets)', paths.some((p) => p.path.includes('Fonts')));

const unix = paths.filter((p) => !recursiveWildcardsValid(p.path, /\//));
check('1 elk scopepad is op Linux en macOS een geldig globpatroon', unix.length === 0, unix.map((p) => `${p.where} ${p.path}`).join(', '));
const windows = paths.filter((p) => !recursiveWildcardsValid(p.path, /[\\/]/));
check('2 elk scopepad is op Windows een geldig globpatroon', windows.length === 0, windows.map((p) => `${p.where} ${p.path}`).join(', '));
const backslash = paths.filter((p) => p.path.includes('\\'));
check('3 geen backslash in een scopepad (op Unix een letterteken, geen scheiding)', backslash.length === 0, backslash.map((p) => `${p.where} ${p.path}`).join(', '));

if (failures === 0) console.log('OK: scopepaden in de Tauri-capabilities (#946) — alles groen');
else console.log(`XX scopepaden in de Tauri-capabilities (#946) — ${failures} rood`);
process.exit(failures === 0 ? 0 : 1);

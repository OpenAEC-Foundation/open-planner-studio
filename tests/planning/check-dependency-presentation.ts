/**
 * Presentatiecontract van de dependency-rij in het eigenschappenpaneel (issue #65, polishronde).
 *
 * De echte hover-/klikinteractie en de zichtbare uitlijning worden in de browser gecontroleerd.
 * Deze bronpoort bewaakt juist de bedrading die daar makkelijk stil kan afdrijven: alle rijen delen
 * één gridschema (inclusief een altijd aanwezige driving-kolom), de WBS-knop gebruikt de standaard
 * Gantt-tracekleur voor zijn rol, en er staat geen native `title` meer op die knop naast de rijke
 * taaktooltip.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const component = readFileSync(
  join(ROOT, 'src/components/task-sections/TaskDependenciesSection.tsx'),
  'utf8',
);
const palette = readFileSync(join(ROOT, 'src/engine/renderer/themePalette.ts'), 'utf8');
const css = readFileSync(join(ROOT, 'src/styles/globals.css'), 'utf8');

let checks = 0;
const diffs: string[] = [];
function expectSource(label: string, source: string, pattern: RegExp): void {
  checks++;
  if (!pattern.test(source)) diffs.push(label);
}
function rejectSource(label: string, source: string, pattern: RegExp): void {
  checks++;
  if (pattern.test(source)) diffs.push(label);
}

// Eén expliciete griddefinitie voorkomt dat de type-/lag-/verwijderkolommen per rij verspringen.
expectSource(
  'dependency-rij gebruikt het gedeelde vaste kolommenschema',
  css,
  /\.dependency-row\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) 0\.75rem 4rem 3\.5rem 1rem;/,
);
expectSource(
  'relatietype houdt naast twee letters ook ruimte voor de native keuzepijl',
  css,
  /grid-template-columns:\s*minmax\(0, 1fr\) 0\.75rem 4rem 3\.5rem 1rem;/,
);
expectSource(
  'driving-kolom bestaat altijd; alleen de inhoud is conditioneel',
  component,
  /className="dependency-driving-slot"[\s\S]*?\{isDriving\s*&&/,
);
expectSource(
  'smalle dependencylijst schakelt via een eigen container om naar twee regels',
  css,
  /\.dependency-list\s*\{[\s\S]*?container-type:\s*inline-size;[\s\S]*?@container\s*\(max-width:\s*14rem\)[\s\S]*?"wbs wbs wbs wbs wbs"[\s\S]*?"\. driving type lag remove"/,
);

// Vanuit de geselecteerde taak gezien is `predecessorId === taskId` de ANDERE taak een opvolger.
expectSource(
  'relatiekant wordt vanuit de geselecteerde taak correct afgeleid',
  component,
  /seq\.predecessorId\s*===\s*taskId\s*\?\s*'successor'\s*:\s*'predecessor'/,
);
expectSource(
  'WBS-knop leest zijn kleur uit het gedeelde Gantt-tracepalet',
  component,
  /--dependency-role-color['"]?:\s*GANTT_TRACE_COLORS\[role\]/,
);
expectSource(
  'het Gantt-palet exporteert de semantische voorganger-/opvolgerkleuren',
  palette,
  /export const GANTT_TRACE_COLORS\s*=\s*\{[\s\S]*?predecessor:[\s\S]*?successor:/,
);

// Lange externe WBS-codes moeten de rij niet oprekken; de rijke portal-tooltip blijft de uitleg.
expectSource(
  'WBS-knop kan binnen zijn gridkolom krimpen en kapt lange codes af',
  component,
  /className="dependency-wbs-link min-w-0 truncate"/,
);
expectSource(
  'toegankelijke knopnaam noemt naast de taak ook voorganger of opvolger',
  component,
  /aria-label=\{`\$\{t\(`relations\.\$\{role\}`\)\}: \$\{t\('properties\.jumpToTask'/,
);
rejectSource(
  'WBS-knop heeft geen kleine native title-tooltip meer',
  component,
  /title=\{other\.name\}/,
);
expectSource(
  'WBS-knop geeft met een handcursor zichtbare klikbaarheid',
  css,
  /\.dependency-wbs-link\s*\{[\s\S]*?cursor:\s*pointer;/,
);
expectSource(
  'WBS-knop heeft een zichtbare hoverbehandeling',
  css,
  /\.dependency-wbs-link:hover[\s\S]*?background:/,
);
expectSource(
  'WBS-knop heeft een zichtbare toetsenbordfocus',
  css,
  /\.dependency-wbs-link:focus-visible[\s\S]*?outline:/,
);
expectSource(
  'WBS-tekst gebruikt de leesbare themakleur',
  css,
  /\.dependency-wbs-link\s*\{[\s\S]*?color:\s*var\(--theme-text\);/,
);
expectSource(
  'rolmarkering behoudt de tracekleur met een contrastrijke buitenlijn',
  css,
  /\.dependency-wbs-link::before\s*\{[\s\S]*?background:\s*var\(--dependency-role-color\);[\s\S]*?border:\s*1px solid var\(--theme-text\);/,
);
expectSource(
  'voorganger en opvolger verschillen zichtbaar in vorm, niet alleen in kleur',
  css,
  /\[data-dependency-role="predecessor"\]::before\s*\{[\s\S]*?border-radius:\s*999px;[\s\S]*?\[data-dependency-role="successor"\]::before\s*\{[\s\S]*?border-radius:\s*1px;/,
);

if (diffs.length === 0) {
  console.log(`OK  dependency-presentatie: alle checks groen (${checks})`);
  process.exit(0);
}

console.log(`XX  dependency-presentatie: ${diffs.length} afwijking(en) van ${checks}`);
for (const diff of diffs) console.log(`   - ${diff}`);
process.exit(1);

// Hint rekenprofiel bij een exportkeuze (eigenaar, 2026-10-31): `exportProfileAdvice` plus de tekst in
// alle talen. XER en P6 XML wijzen naar P6, MS Project XML naar MS Project, de rest krijgt geen hint.
// Geen hint als het profiel al past. De browserroute staat in `tests/browser/xer-export.spec.ts`.
//
// Draait via run.sh. Exit 0 = alles groen.
import { readFileSync, readdirSync } from 'node:fs';
import { builtInProfile } from '@/engine/scheduler/conventions/registry';
import { EXPORT_FORMATS, type ExportFormat } from '@/services/formatRegistry';
import { exportProfileAdvice } from '@/state/exportProfileAdvice';
import type { SchedulingProfile } from '@/types/project';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};

const ops = builtInProfile('ops');
const p6 = builtInProfile('p6');
const msp = builtInProfile('msproject');
const targetOf = (format: ExportFormat, profile: SchedulingProfile | undefined) => exportProfileAdvice(format, profile)?.target ?? null;

// De drie gevallen uit het besluit.
eq('XER met ops → P6', targetOf('xer', ops), 'p6');
eq('MS Project XML met p6 → MS Project', targetOf('mspdi', p6), 'msproject');
eq('IFC met ops: geen hint', targetOf('ifc', ops), null);

// Geen hint als het profiel al past.
eq('XER met p6: geen hint', targetOf('xer', p6), null);
eq('P6 XML met p6: geen hint', targetOf('p6', p6), null);
eq('MS Project XML met msproject: geen hint', targetOf('mspdi', msp), null);

// Elk formaat tegen elk profiel: alleen de drie formaten met een bijpassend profiel krijgen ooit een hint.
const WANT: Record<ExportFormat, string | null> = {
  'progress-xlsx': null, 'progress-csv': null, csv: null, mspdi: 'msproject', p6: 'p6', xer: 'p6', ifc: null,
};
for (const { format } of EXPORT_FORMATS) {
  for (const profile of [ops, p6, msp]) {
    const want = WANT[format] === profile.id ? null : WANT[format];
    eq(`${format} met ${profile.id}`, targetOf(format, profile), want);
  }
}

// Geen profiel = OPS; dat telt als ander profiel, en het huidige profiel gaat mee naar de tekst.
eq('XER zonder profiel → huidig profiel ops', exportProfileAdvice('xer', undefined), {
  current: { kind: 'builtIn', baseId: 'ops', modified: false }, target: 'p6',
});
// Aangepast P6 rekent niet als P6; een eigen profiel ook niet.
const key = Object.keys(p6.overrides).length === 0 ? 'p6UseRemainingStartForProgress' : Object.keys(p6.overrides)[0];
const modified: SchedulingProfile = { ...p6, overrides: { ...p6.overrides, [key]: false } };
eq('XER met aangepast P6: wel een hint', targetOf('xer', modified), 'p6');
const custom: SchedulingProfile = { ...p6, id: 'eigen', name: 'Eigen', overrides: {} };
eq('XER met eigen profiel: wel een hint', targetOf('xer', custom), 'p6');

// Alleen XER draagt het label Experimenteel.
eq('label Experimenteel alleen bij XER', EXPORT_FORMATS.filter(f => 'experimental' in f && f.experimental).map(f => f.format), ['xer']);

// De tekst: elke taal heeft de sleutel, met beide invulplekken, en de oude sleutel is weg.
const root = 'src/i18n/locales';
const locales = readdirSync(root);
eq('28 talen', locales.length, 28);
for (const locale of locales) {
  const menu = JSON.parse(readFileSync(`${root}/${locale}/menu.json`, 'utf8')) as { export: Record<string, string> };
  const text = menu.export.profileHint ?? '';
  eq(`${locale}: invulplekken`, [text.includes('{{name}}'), text.includes('{{target}}')], [true, true]);
  eq(`${locale}: oude sleutel weg`, 'xerProfileHint' in menu.export, false);
}

if (diffs.length === 0) {
  console.log(`OK  export-profile-hint: ${checks} checks groen`);
  process.exit(0);
}
console.log(`XX  export-profile-hint: ${diffs.length} afwijking(en) van ${checks}`);
for (const d of diffs) console.log(`   - ${d}`);
process.exit(1);

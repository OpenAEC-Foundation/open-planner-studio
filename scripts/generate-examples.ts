// Voorbeeld-generator (schrijfkant). De opbouw-logica staat in gen-core.ts; hier regenereren we
// examples/, kopiëren we een publieke selectie naar public/examples/ en schrijven we het manifest.
//
//   npm run gen:examples
//
// Drift met de app is structureel onmogelijk: gen-core bouwt via de ECHTE store en serialiseert
// met de ECHTE writeIFC. Zie ook verify-examples.ts (npm run verify:examples).
import { writeFileSync, mkdirSync, existsSync, copyFileSync, statSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { allSpecs, build } from './gen-core';
import { SHOWCASES } from './showcases';

const ROOT = process.cwd();
const EX_DIR = join(ROOT, 'examples');
const PUB_DIR = join(ROOT, 'public', 'examples');

// Publieke selectie: 3 showcases + representatieve basis-selectie, samen < ~600 kB.
const PUBLIC = new Set<string>([
  ...SHOWCASES.map(s => s.slug),
  '03-kantoorgebouw-zuidas', '05-brugvervanging-n279', '08-zorgcentrum-de-linde',
  '10-villa-wassenaar', '15-datacentrum-agriport',
]);

function main() {
  if (!existsSync(EX_DIR)) mkdirSync(EX_DIR, { recursive: true });
  if (!existsSync(PUB_DIR)) mkdirSync(PUB_DIR, { recursive: true });

  const specs = allSpecs();
  const built = specs.map(spec => ({ spec, res: build(spec) }));

  // Verouderde bronbestanden opruimen (fase 2.10, onderdeel 4: verving 3 showcases door 2 —
  // zonder deze stap bleven de oude showcase-.ifc's als wees achter in examples/, want deze loop
  // hieronder schrijft alleen bij, hij verwijdert nooit). Alleen top-level .ifc's; `extensions/`
  // (bv. het .tasklist-referentiebestand) blijft ongemoeid.
  const currentSlugs = new Set(specs.map(s => s.slug));
  for (const f of readdirSync(EX_DIR)) {
    if (f.endsWith('.ifc') && !currentSlugs.has(f.replace(/\.ifc$/, ''))) rmSync(join(EX_DIR, f));
  }

  for (const { spec, res } of built) {
    writeFileSync(join(EX_DIR, `${spec.slug}.ifc`), res.ifc, 'utf8');
    const s = res.stats;
    const critPct = s.leaves ? Math.round((s.critical / s.leaves) * 100) : 0;
    console.log(
      `✓ ${spec.slug.padEnd(40)} ${String(s.tasks).padStart(3)}t ${String(s.sequences).padStart(3)}rel ` +
      `${String(s.resources).padStart(2)}res ${String(s.assignments).padStart(2)}toe crit ${String(s.critical).padStart(3)}/${String(s.leaves).padStart(3)} (${critPct}%)`,
    );
  }

  // Verouderde publieke bestanden opruimen (alleen de huidige selectie mag blijven staan).
  for (const f of readdirSync(PUB_DIR)) {
    if (f.endsWith('.ifc') && !PUBLIC.has(f.replace(/\.ifc$/, ''))) rmSync(join(PUB_DIR, f));
  }

  // Publieke bestanden kopiëren.
  let pubBytes = 0;
  for (const { spec } of built) {
    if (!PUBLIC.has(spec.slug)) continue;
    const dst = join(PUB_DIR, `${spec.slug}.ifc`);
    copyFileSync(join(EX_DIR, `${spec.slug}.ifc`), dst);
    pubBytes += statSync(dst).size;
  }

  // Manifest: showcases eerst (category 'showcase'), daarna de basis-selectie ('basic').
  const manifest = {
    version: 2,
    examples: built
      .filter(r => PUBLIC.has(r.spec.slug))
      .sort((a, b) => (a.spec.category === 'showcase' ? 0 : 1) - (b.spec.category === 'showcase' ? 0 : 1))
      .map(r => ({
        file: `${r.spec.slug}.ifc`,
        name: r.spec.name,
        description: r.spec.publicDescription ?? r.spec.description ?? '',
        category: r.spec.category ?? 'basic',
        tags: r.spec.tags ?? [],
      })),
  };
  writeFileSync(join(PUB_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  console.log(`\n${built.length} voorbeelden → examples/`);
  console.log(`Publiek: ${manifest.examples.length} bestanden, ${(pubBytes / 1024).toFixed(0)} kB (limiet ~600 kB)`);
  if (pubBytes > 600 * 1024) { console.error('✗ Publieke selectie > 600 kB'); process.exit(1); }
}

main();

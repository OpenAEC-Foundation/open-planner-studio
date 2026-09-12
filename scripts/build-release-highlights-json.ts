// Genereert `public/release-highlights.json` uit de getypeerde catalogus in
// `src/services/updater/releaseHighlights.ts`.
//
// Waarom: de releasetijdlijn op open-aec.com haalt de hoogtepunten op bij de
// gedeployde webbuild (`https://open-planner-studio.open-aec.com/release-highlights.json`).
// De catalogus blijft de ENIGE bron — dit script is een afgeleide, en
// `npm run verify:release-highlights-json` bewaakt dat het bestand nooit achterloopt.
//
//   node scripts/run-ts.mjs scripts/build-release-highlights-json.ts            # schrijven
//   node scripts/run-ts.mjs scripts/build-release-highlights-json.ts --check    # poort (exit 1)
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  RELEASE_HIGHLIGHT_CATALOG,
  RELEASE_HIGHLIGHT_LOCALES,
  type ReleaseHighlightLocale,
} from '@/services/updater/releaseHighlights';

// `run-ts.mjs` bundelt naar /tmp maar draait met de repo-root als cwd (net als verify-docs.ts).
const OUTPUT = join(process.cwd(), 'public', 'release-highlights.json');

/** CalVer `YYYY.M.patch`: numeriek segment-voor-segment, nieuwste eerst. */
function compareVersionsDescending(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const diff = (pb[i] ?? 0) - (pa[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

interface JsonHighlight {
  category: string;
  title: string;
  description: string;
  icon: string;
  docsId?: string;
}

function buildDocument(generated: string): unknown {
  const releases = Object.keys(RELEASE_HIGHLIGHT_CATALOG)
    .sort(compareVersionsDescending)
    .map(version => {
      const block = RELEASE_HIGHLIGHT_CATALOG[version]!;
      const highlights: Record<string, { primary: JsonHighlight; secondary: JsonHighlight[] }> = {};
      for (const locale of RELEASE_HIGHLIGHT_LOCALES as readonly ReleaseHighlightLocale[]) {
        const copy = block.copy[locale];
        const [primaryCopy, ...secondaryCopy] = copy;
        const primary: JsonHighlight = {
          category: primaryCopy.category,
          title: primaryCopy.title,
          description: primaryCopy.description,
          icon: block.primary.icon,
        };
        // Alleen de prominente kaart kent een gidslink; laat de sleutel anders weg.
        if (block.primary.docsId !== undefined) primary.docsId = block.primary.docsId;
        highlights[locale] = {
          primary,
          secondary: secondaryCopy.map((item, index) => ({
            category: item.category,
            title: item.title,
            description: item.description,
            icon: block.secondary[index]!.icon,
          })),
        };
      }
      return {
        version,
        tag: `v${version}`,
        stats: {
          daysSincePrevious: block.stats.daysSincePrevious,
          commitsSincePrevious: block.stats.commitsSincePrevious,
          addedCodeLines: block.stats.addedCodeLines,
        },
        highlights,
      };
    });

  return { schema: 1, product: 'open-planner-studio', generated, releases };
}

const serialize = (generated: string): string => `${JSON.stringify(buildDocument(generated), null, 2)}\n`;

const check = process.argv.includes('--check');

if (check) {
  let actual: string;
  try {
    actual = readFileSync(OUTPUT, 'utf8');
  } catch {
    console.error('XX public/release-highlights.json ontbreekt — draai `npm run gen:release-highlights-json`');
    process.exit(1);
  }
  let generated = '';
  try {
    const parsed = JSON.parse(actual) as { generated?: unknown };
    if (typeof parsed.generated === 'string') generated = parsed.generated;
  } catch {
    console.error('XX public/release-highlights.json is geen geldige JSON');
    process.exit(1);
  }
  // `generated` is het enige veld dat per run mag wisselen; neem het over en vergelijk de rest byte-voor-byte.
  const expected = serialize(generated);
  if (expected !== actual) {
    console.error('XX public/release-highlights.json loopt achter op de catalogus — draai `npm run gen:release-highlights-json` en commit het resultaat');
    process.exit(1);
  }
  console.log('OK public/release-highlights.json is gelijk aan de catalogus');
} else {
  writeFileSync(OUTPUT, serialize(new Date().toISOString()));
  console.log(`OK geschreven: public/release-highlights.json (${Object.keys(RELEASE_HIGHLIGHT_CATALOG).length} releases)`);
}

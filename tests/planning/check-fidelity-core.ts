import {
  addFidelityCounts,
  classify,
  classifyExact,
  compareFidelityRow,
  countFidelityAxis,
  emptyFidelityCounts,
} from './fidelityCore';

const diffs: string[] = [];
let checks = 0;

function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

// Breuk die dit vangt: minuutvergelijking terugbrengen tot alleen de kalenderdag.
eq('1 minuut-exact', classify('2026-01-05T08:00', '2026-01-05T08:00'), 'exact');
eq('1a zelfde dag maar andere minuut', classify('2026-01-05T08:01', '2026-01-05T08:00'), 'sameday');
eq('1b andere dag', classify('2026-01-06T08:00', '2026-01-05T08:00'), 'diff');
eq('1c ontbrekend orakel', classify('2026-01-05T08:00', null), 'missing');
eq('1d scalaire gelijkheid gebruikt geen datumdagvergelijking', classifyExact('75', '75'), 'exact');
eq('1e scalaire afwijking is direct diff', classifyExact('76', '75'), 'diff');

const rows = [
  compareFidelityRow('A', {
    es: { ours: '2026-01-05T08:00', truth: '2026-01-05T08:00' },
    ef: { ours: '2026-01-05T17:00', truth: '2026-01-05T17:00' },
  }),
  compareFidelityRow('B', {
    es: { ours: undefined, truth: '2026-01-06T08:00' },
    ef: { ours: '2026-01-06T17:00', truth: null },
  }),
];

// Breuk die dit vangt: een ontbrekende lezerswaarde verlaagt stil het meetbaar-aantal of telt niet
// als afwijking, terwijl het orakelveld wel degelijk aanwezig is.
eq('2 rijvorm bewaart identiteit en asuitspraak', rows[1], {
  identity: 'B',
  axes: {
    es: { ours: undefined, truth: '2026-01-06T08:00', verdict: 'missing' },
    ef: { ours: '2026-01-06T17:00', truth: null, verdict: 'missing' },
  },
});
eq('2a asadministratie telt orakelcellen onafhankelijk van onze dekking', countFidelityAxis(rows, 'es'), {
  exact: 1,
  sameday: 0,
  diff: 0,
  missing: 1,
  measurable: 2,
  deviations: 1,
});
eq('2b ontbrekend orakel is niet meetbaar en niet afwijkend', countFidelityAxis(rows, 'ef'), {
  exact: 1,
  sameday: 0,
  diff: 0,
  missing: 1,
  measurable: 1,
  deviations: 0,
});

// Breuk die dit vangt: de per-project-lus overschrijft de vorige projecttelling in plaats van de
// bestandssom te maken.
const total = emptyFidelityCounts();
addFidelityCounts(total, countFidelityAxis(rows.slice(0, 1), 'es'));
addFidelityCounts(total, countFidelityAxis(rows.slice(1), 'es'));
eq('3 per-projecttellers tellen op tot één bestandssom', total, {
  exact: 1,
  sameday: 0,
  diff: 0,
  missing: 1,
  measurable: 2,
  deviations: 1,
});

if (diffs.length === 0) {
  console.log(`OK  fidelity-core: ${checks} checks groen`);
} else {
  console.log(`XX  fidelity-core: ${diffs.length} afwijking(en) van ${checks}`);
  for (const diff of diffs) console.log(`   XX ${diff}`);
  process.exit(1);
}

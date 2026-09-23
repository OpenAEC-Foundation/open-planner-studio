import {
  addFidelityCounts,
  classify,
  classifyExact,
  classifyFloatMinutes,
  FLOAT_EXACT_TOLERANCE_MIN,
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
// §1d-9 (eigenaarsbesluit in afwachting): float-ruis onder de celafronding is exact, 0,002 niet.
eq('1f float-tolerantie is de celafronding', FLOAT_EXACT_TOLERANCE_MIN, 0.001);
eq('1g EC1600-ruis 396640.00002 vs 396640 is exact', classifyFloatMinutes('396640.00002000004', '396640'), 'exact');
eq('1h 396640.002 vs 396640 blijft diff', classifyFloatMinutes('396640.002', '396640'), 'diff');
eq('1i 0,0006 rondt af op 0,001 ⇒ diff', classifyFloatMinutes('10.0006', '10'), 'diff');
eq('1j niet-getal is diff', classifyFloatMinutes('x', '10'), 'diff');
eq('1k ontbrekend orakel', classifyFloatMinutes('10', null), 'missing');
eq('1l classifyExact zelf blijft tekst-exact', classifyExact('396640.00002000004', '396640'), 'diff');

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

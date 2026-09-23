// Pure oordeelsfuncties van `measure-profiles.mjs`, los zodat `tests/dev-server/measure-profiles.test.mjs`
// ze zonder corpus kan toetsen. Geen I/O.

/** De drie X12-nuldoelregels die by design rood staan zolang het nuldoel niet gehaald is. */
export const KNOWN_GOAL_PREFIXES = [
  'XX X12 nuldoel is baseline-onafhankelijk: ieder bestand haalt de zesassige poort: ',
  'XX X12 nuldoel is baseline-onafhankelijk: alle zes assen zijn nul: ',
  'XX X12 nuldoel is baseline-onafhankelijk: totaal zesassige afwijkingen is nul: ',
];
/** De v2-tellingenbaseline wijkt af van de meting — bij een zuivere verbetering: herpinnen. */
export const V2_EQUALITY_PREFIX = 'XX X12 productbaseline is de verse volledige productmeting: ';
export const CELL_OK_PREFIX = 'OK  X12 cel-baseline (regel A):';
export const VERBETERD_STATUS = 'VERBETERD — exit 0, maar commit alleen mét herpin v2 + cellen';
/** Alleen kleinere cellen binnen dezelfde emmer (grootte-ratchet): v2 telt emmers en blijft gelijk. */
export const VERBETERD_GROOTTE_STATUS = 'VERBETERD (grootte) — exit 0, maar commit alleen mét herpin van de cellen';

/** Env-sleutels die een kindproces in schrijf- of rapportmodus zouden zetten. */
export const CHILD_ENV_STRIP = [
  'OPS_XER_CELLS_WRITE', 'OPS_XER_V2_WRITE', 'OPS_XER_GATE_PINS', 'OPS_XER_FIDELITY_REPORT', 'OPS_MPP_FIDELITY_REPORT',
];

export function childEnv(env, { dropXerCorpus = false } = {}) {
  const out = { ...env };
  for (const key of CHILD_ENV_STRIP) delete out[key];
  if (dropXerCorpus) delete out.OPS_XER_CORPUS;
  return out;
}

/** Alle faalregels: XX (ook ingesprongen, zie CLAUDE.md) plus stacktraces/esbuild-fouten. */
export function failureLines(lines) {
  return lines.filter((line) => /^\s*XX\s/.test(line) || /^\s*XX$/.test(line)
    || /^\s+at \S.*:\d+:\d+\)?$/.test(line) || /^✘ \[ERROR\]/.test(line));
}

/** `CELLDELTA p6 nieuw=… verslechterd=… groter=… verbeterd=… kleiner=… onmeetbaar=…` → getallen;
 *  ontbreekt iets (ook een oude regel zonder groter=/kleiner=) ⇒ undefined, dus fail-closed rood. */
export function parseCellDelta(lines, profile = 'p6') {
  const line = lines.find((candidate) => candidate.startsWith(`CELLDELTA ${profile} `));
  if (!line) return undefined;
  const value = (name) => {
    const match = line.match(new RegExp(`(?:^| )${name}=(\\d+)(?: |$)`));
    return match ? Number(match[1]) : undefined;
  };
  const delta = {
    line: line.slice(`CELLDELTA ${profile} `.length),
    nieuw: value('nieuw'), verslechterd: value('verslechterd'), groter: value('groter'), verbeterd: value('verbeterd'),
    kleiner: value('kleiner'), onmeetbaar: value('onmeetbaar'),
  };
  return [delta.nieuw, delta.verslechterd, delta.groter, delta.verbeterd, delta.kleiner, delta.onmeetbaar]
    .some((number) => number === undefined) ? undefined : delta;
}

/**
 * Oordeel over de X12-run mét corpus. Rood is de standaard; alleen deze combinaties zijn niet rood:
 *  - exit 0 met groene cel-poort                                         ⇒ GROEN;
 *  - uitsluitend (een deel van) de drie nuldoelregels rood, cel-poort groen, geen nieuwe of
 *    verslechterde cel                                                    ⇒ NULDOEL (regel A gehouden);
 *  - daarnaast alleen de v2-gelijkheidsregel rood, cel-delta nieuw=0 verslechterd=0 groter=0
 *    onmeetbaar=0 verbeterd>0                                             ⇒ VERBETERD: exit 0, maar
 *    committen alleen mét herpin van v2 én cellen in dezelfde commit;
 *  - geen v2-afwijking, groter=0 en kleiner>0 (alleen de grootte-ratchet verbeterd)
 *                                                                         ⇒ VERBETERD (grootte): exit 0,
 *    maar committen alleen mét herpin van de cellen (v2 telt emmers en verandert niet).
 * `groter>0` (een cel binnen dezelfde emmer sameday/diff groter afgeweken) is altijd ROOD.
 * Een meetbaarheids-/dekkingsafwijking t.o.v. v2 ("X12 meetbaarheid/dekking wijkt af van v2") heeft
 * een eigen prefix en is dus altijd een overige faalregel ⇒ ROOD: een blinder orakel is geen verbetering.
 * `strict` maakt elke nog rode nuldoelregel rood.
 */
export function classifyP6({ exit, lines, strict = false }) {
  const failures = failureLines(lines);
  const cellOk = lines.some((line) => line.startsWith(CELL_OK_PREFIX));
  const delta = parseCellDelta(lines);
  const goal = failures.filter((line) => KNOWN_GOAL_PREFIXES.some((prefix) => line.startsWith(prefix)));
  const v2 = failures.filter((line) => line.startsWith(V2_EQUALITY_PREFIX));
  const other = failures.filter((line) => !goal.includes(line) && !v2.includes(line));
  const red = (reason) => ({ status: `ROOD (${reason})`, pass: false, failures });
  if (!cellOk || !delta) return red('cel-poort niet groen of cel-delta ontbreekt');
  if (other.length > 0) return red(`${other.length} faalregel(s)`);
  if (delta.nieuw !== 0 || delta.verslechterd !== 0 || delta.onmeetbaar !== 0) return red('nieuwe, verslechterde of onmeetbaar geworden cel');
  if (delta.groter !== 0) return red('grotere cel (grootte-ratchet)');
  const sizeOnly = { status: VERBETERD_GROOTTE_STATUS, pass: true, failures };
  if (exit === 0) {
    if (failures.length > 0) return red('exit 0 met faalregels');
    return delta.verbeterd > 0 ? { status: VERBETERD_STATUS, pass: true, failures } : delta.kleiner > 0 ? sizeOnly : { status: 'GROEN', pass: true, failures };
  }
  if (goal.length > 0 && strict) return red('nuldoel, --strict');
  if (v2.length > 0) {
    return delta.verbeterd > 0
      ? { status: VERBETERD_STATUS, pass: true, failures }
      : red('v2-telling wijkt af zonder verbeterde cel');
  }
  if (goal.length > 0) return delta.kleiner > 0 ? sizeOnly : { status: 'NULDOEL (regel A gehouden)', pass: true, failures };
  return red(`exit ${exit} zonder herkende faalregel`);
}

/** Aantal gescande `.mpp`-bestanden uit de `. [corpus|crawl] N bestand(en) gescand`-regels. */
export function mppScannedFiles(lines) {
  let total = 0;
  for (const line of lines) {
    const match = line.match(/^\s+\. \[(?:corpus|crawl)\] (\d+) bestand\(en\) gescand$/);
    if (match) total += Number(match[1]);
  }
  return total;
}

/** MS Project-oordeel: fail-closed — nul gescande bestanden is "niet gemeten", dus rood. */
export function classifyMsp({ exit, lines }) {
  const failures = failureLines(lines);
  const scanned = mppScannedFiles(lines);
  const ok = lines.some((line) => line.startsWith('OK  mpp-fidelity: alle checks groen'));
  if (scanned === 0) return { status: 'ROOD (niet gemeten)', pass: false, failures, scanned };
  if (exit === 0 && ok) return { status: 'GROEN', pass: true, failures, scanned };
  return { status: `ROOD (${failures.length} faalregel(s))`, pass: false, failures, scanned };
}

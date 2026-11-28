export const KNOWN_GOAL_PREFIXES = [
  'XX X12 nuldoel is baseline-onafhankelijk: ieder bestand haalt de zesassige poort: ',
  'XX X12 nuldoel is baseline-onafhankelijk: alle zes assen zijn nul: ',
  'XX X12 nuldoel is baseline-onafhankelijk: totaal zesassige afwijkingen is nul: ',
];
export const V2_EQUALITY_PREFIX = 'XX X12 productbaseline is de verse volledige productmeting: ';
export const CELL_OK_PREFIX = 'OK  X12 cel-baseline (regel A):';
export const VERBETERD_STATUS = 'ROOD (VERBETERD zonder herpin — herpin v2 + cellen in dezelfde commit en meet opnieuw)';
export const VERBETERD_GROOTTE_STATUS = 'ROOD (VERBETERD (grootte) zonder herpin — herpin de cellen en meet opnieuw)';

export const CHILD_ENV_STRIP = [
  'OPS_XER_CELLS_WRITE', 'OPS_XER_V2_WRITE', 'OPS_XER_GATE_PINS', 'OPS_XER_FIDELITY_REPORT', 'OPS_MPP_FIDELITY_REPORT',
  'OPS_XER_CELLS_DEBT_INIT', 'OPS_XER_CELLS_V1_UPGRADE',
];

export function childEnv(env, { dropXerCorpus = false } = {}) {
  const out = { ...env };
  for (const key of CHILD_ENV_STRIP) delete out[key];
  if (dropXerCorpus) delete out.OPS_XER_CORPUS;
  return out;
}

export function failureLines(lines) {
  return lines.filter((line) => /^\s*XX\s/.test(line) || /^\s*XX$/.test(line)
    || /^\s+at \S.*:\d+:\d+\)?$/.test(line) || /^✘ \[ERROR\]/.test(line));
}

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
    kleiner: value('kleiner'), onmeetbaar: value('onmeetbaar'), schuld: value('schuld'),
  };
  return [delta.nieuw, delta.verslechterd, delta.groter, delta.verbeterd, delta.kleiner, delta.onmeetbaar, delta.schuld]
    .some((number) => number === undefined) ? undefined : delta;
}

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
  const sizeOnly = { status: VERBETERD_GROOTTE_STATUS, pass: false, failures };
  const improved = { status: VERBETERD_STATUS, pass: false, failures };
  if (exit === 0) {
    if (failures.length > 0) return red('exit 0 met faalregels');
    return delta.verbeterd > 0 ? improved : delta.kleiner > 0 ? sizeOnly : { status: 'GROEN', pass: true, failures };
  }
  if (goal.length > 0 && strict) return red('nuldoel, --strict');
  if (v2.length > 0) {
    return delta.verbeterd > 0 ? improved : red('v2-telling wijkt af zonder verbeterde cel');
  }
  if (goal.length > 0) return delta.kleiner > 0 ? sizeOnly : { status: 'NULDOEL (regel A gehouden)', pass: true, failures };
  return red(`exit ${exit} zonder herkende faalregel`);
}

function mppScannedRoots(lines) {
  const roots = { corpus: 0, crawl: 0 };
  for (const line of lines) {
    const match = line.match(/^\s+\. \[(corpus|crawl)\] (\d+) bestand\(en\) gescand$/);
    if (match) roots[match[1]] += Number(match[2]);
  }
  return roots;
}

export function mppScannedFiles(lines) {
  return Object.values(mppScannedRoots(lines)).reduce((sum, count) => sum + count, 0);
}

export function classifyMsp({ exit, lines }) {
  const failures = failureLines(lines);
  const roots = mppScannedRoots(lines);
  const scanned = roots.corpus + roots.crawl;
  const ok = lines.some((line) => line.startsWith('OK  mpp-fidelity: alle checks groen'));
  if (scanned === 0) return { status: 'ROOD (niet gemeten)', pass: false, failures, scanned };
  if (exit !== 0 || !ok || failures.length > 0) {
    return { status: `ROOD (${failures.length} faalregel(s))`, pass: false, failures, scanned };
  }
  const skipped = Object.keys(roots).filter(root => roots[root] === 0);
  if (skipped.length > 0) {
    return { status: `ROOD (gedeeltelijk gemeten: ${skipped.join(', ')} overgeslagen)`, pass: false, failures, scanned };
  }
  return { status: 'GROEN', pass: true, failures, scanned };
}

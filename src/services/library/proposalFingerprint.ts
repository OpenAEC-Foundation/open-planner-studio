export interface FingerprintInput {
  tasks: unknown;
  sequences: unknown;
  resources: unknown;
  assignments: unknown;
  calendar: unknown;
  calendars: unknown;
  project: unknown;
  cpmResult: unknown;
  scheduleStale: unknown;
  datesAsRecorded: unknown;
}

const FINGERPRINT_KEYS: readonly (keyof FingerprintInput)[] = [
  'tasks', 'sequences', 'resources', 'assignments', 'calendar', 'calendars',
  'project', 'cpmResult', 'scheduleStale', 'datesAsRecorded',
];

const refIds = new WeakMap<object, number>();
let nextRefId = 1;

function idFor(value: unknown): string {
  if (value !== null && (typeof value === 'object' || typeof value === 'function')) {
    let id = refIds.get(value as object);
    if (id === undefined) {
      id = nextRefId++;
      refIds.set(value as object, id);
    }
    return `r${id}`;
  }
  return `p${String(value)}`;
}

export function documentFingerprint(d: FingerprintInput, mutationSeq: number): string {
  const parts = FINGERPRINT_KEYS.map((k) => idFor(d[k]));
  parts.push(`m${mutationSeq}`);
  return parts.join('|');
}

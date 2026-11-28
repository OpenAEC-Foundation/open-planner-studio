import type { Sequence, SequenceType } from '@/types/sequence';

export const SEQ_TYPES: SequenceType[] = ['FINISH_START', 'FINISH_FINISH', 'START_START', 'START_FINISH'];

const SEQ_TYPE_ALIASES: Record<string, SequenceType> = {
  FS: 'FINISH_START',
  FF: 'FINISH_FINISH',
  SS: 'START_START',
  SF: 'START_FINISH',
};

export const SEQ_TYPE_SHORT = Object.keys(SEQ_TYPE_ALIASES);

export function normalizeSeqType(v: unknown): SequenceType | null {
  if (typeof v !== 'string') return null;
  const up = v.trim().toUpperCase();
  if ((SEQ_TYPES as string[]).includes(up)) return up as SequenceType;
  return SEQ_TYPE_ALIASES[up] ?? null;
}

export function unknownTypeReason(raw: unknown): string {
  return `unknown relationship type '${String(raw)}'; allowed: ${SEQ_TYPES.join(' | ')} (or short ${SEQ_TYPE_SHORT.join('/')})`;
}

export const ANCESTOR_RELATION_REJECTION =
  'a relationship between a task and its own ancestor summary task (direct parent or higher) is not allowed (in either direction)';

export function selfRelationReason(taskId: string): string {
  return `a relationship cannot connect task '${taskId}' to itself`;
}

export function seqAbbrev(type: SequenceType): string {
  switch (type) {
    case 'FINISH_START': return 'FS';
    case 'START_START': return 'SS';
    case 'FINISH_FINISH': return 'FF';
    case 'START_FINISH': return 'SF';
  }
}

export function lagLabel(seq: Pick<Sequence, 'lagDays' | 'lagPercent'>): string {
  if (typeof seq.lagPercent === 'number' && Number.isFinite(seq.lagPercent) && seq.lagPercent !== 0) {
    return `${seq.lagPercent > 0 ? '+' : ''}${seq.lagPercent}%`;
  }
  const d = Number.isFinite(seq.lagDays) ? seq.lagDays : 0;
  if (d === 0) return '';
  return `${d > 0 ? '+' : ''}${d}d`;
}

export function lagReport(seq: Pick<Sequence, 'lagDays' | 'lagPercent'>): string {
  return lagLabel(seq) || '0';
}

const LAG_STRING_RE = /^([+-]?\d+(?:[.,]\d+)?)\s*(?:d|dag|dagen|day|days|wd)?$/i;
const LAG_PERCENT_RE = /^([+-]?\d+(?:[.,]\d+)?)\s*%$/;

export interface ParsedLag {
  days: number;
  percent?: number;
}

export function lagPatchOf(lag: ParsedLag): Pick<Sequence, 'lagDays' | 'lagPercent'> {
  return {
    lagDays: lag.percent !== undefined ? 0 : lag.days,
    lagPercent: lag.percent,
  };
}

export function parseLag(raw: unknown): { ok: true; value: ParsedLag } | { ok: false; reason: string } {
  if (raw === undefined || raw === null) return { ok: true, value: { days: 0 } };
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return { ok: false, reason: '`lag` must be a finite number of days (day measure)' };
    return { ok: true, value: { days: raw } };
  }
  if (typeof raw === 'string') {
    const s = raw.trim();
    const p = LAG_PERCENT_RE.exec(s);
    if (p) {
      const n = Number(p[1].replace(',', '.'));
      if (!Number.isFinite(n)) return { ok: false, reason: `\`lag\` '${s}' is not a valid percentage lag` };
      return { ok: true, value: n === 0 ? { days: 0 } : { days: 0, percent: n } };
    }
    const m = LAG_STRING_RE.exec(s);
    if (m) {
      const n = Number(m[1].replace(',', '.'));
      if (Number.isFinite(n)) return { ok: true, value: { days: n } };
    }
    return {
      ok: false,
      reason:
        `\`lag\` '${s}' is not a valid lag; give days in the day measure (a fraction such as 0.5 is allowed) as a ` +
        'number (2, -1), as a string ("+2d", "-1d", "2") or a percentage lag of the predecessor duration ' +
        '("+50%")',
    };
  }
  return { ok: false, reason: `\`lag\` must be a number of days in the day measure (or a string such as "+2d"/"+50%"), got ${typeof raw}` };
}

export const SEQ_TYPE_SCHEMA = {
  type: 'string',
  enum: [...SEQ_TYPES, ...SEQ_TYPE_SHORT],
};

export const LAG_SCHEMA = {
  type: ['number', 'string'],
  description:
    'Days (2, -1, "+2d"; a fraction such as 0.5 is kept; negative = lead) or "+50%" of the predecessor ' +
    'duration.',
};

import { relationRoles } from '../ifcSlotTables';
import { splitStepArgs } from './stepScanner';

export const NESTS = 'IFCRELNESTS';
export const AGGREGATES = 'IFCRELAGGREGATES';
export const DECLARES = 'IFCRELDECLARES';
export const CONTROL = 'IFCRELASSIGNSTOCONTROL';
export const PROCESS = 'IFCRELASSIGNSTOPROCESS';
export const DEFINES = 'IFCRELDEFINESBYPROPERTIES';

export const MIXED_RELATIONS: ReadonlySet<string> = new Set([NESTS, AGGREGATES, DECLARES, CONTROL, PROCESS]);
export const relArgs = (type: string) => (MIXED_RELATIONS.has(type) ? relationRoles(type) : undefined);
export const CARRIED_RELATIONS: ReadonlySet<string> = new Set([NESTS, AGGREGATES, CONTROL, PROCESS]);
export const SINGLE_MEMBERSHIP: ReadonlySet<string> = new Set([NESTS, AGGREGATES, DECLARES]);

export interface OwnLine {
  readonly id: number;
  type: string;
  args: string[];
  text: string;
  drop: boolean;
}

const LINE = /^#(\d+)=([A-Z0-9_]+)\(([\s\S]*)\);$/;

export function parseLine(text: string): OwnLine {
  const m = LINE.exec(text);
  if (!m) throw new Error(`mergeWriter: onverwachte regel van de writer: ${text.slice(0, 80)}`);
  return { id: Number(m[1]), type: m[2], args: splitStepArgs(m[3]), text, drop: false };
}

export function setArgs(line: OwnLine, args: string[]): void {
  line.args = args;
  line.text = `#${line.id}=${line.type}(${args.join(',')});`;
}

export function refOf(token: string | undefined): number {
  const m = /^#(\d+)$/.exec((token ?? '').trim());
  return m ? Number(m[1]) : -1;
}

export function refList(token: string | undefined): number[] {
  const t = (token ?? '').trim();
  if (!t.startsWith('(') || !t.endsWith(')')) return [];
  return splitStepArgs(t.slice(1, -1)).map(refOf).filter(id => id >= 0);
}

export const formatRefs = (ids: readonly number[]) => `(${ids.map(id => `#${id}`).join(',')})`;

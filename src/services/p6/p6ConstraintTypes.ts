// Bron: MPXJ, © Jon Iles e.a., constraintlabels en -tokens volgens `ConstraintTypeHelper` (LGPL-2.1, github.com/joniles/mpxj).
import type { ConstraintType, TaskConstraint } from '@/types/task';

export const P6_CONSTRAINT_KINDS: readonly {
  readonly label: string;
  readonly token: string;
  readonly type: Exclude<ConstraintType, 'ASAP'>;
  readonly hard: boolean;
}[] = [
  { label: 'Start On', token: 'CS_MSO', type: 'MSO', hard: false },
  { label: 'Start On or After', token: 'CS_MSOA', type: 'SNET', hard: false },
  { label: 'Start On or Before', token: 'CS_MSOB', type: 'SNLT', hard: false },
  { label: 'Finish On', token: 'CS_MEO', type: 'MFO', hard: false },
  { label: 'Finish On or After', token: 'CS_MEOA', type: 'FNET', hard: false },
  { label: 'Finish On or Before', token: 'CS_MEOB', type: 'FNLT', hard: false },
  { label: 'As Late As Possible', token: 'CS_ALAP', type: 'ALAP', hard: false },
  { label: 'Mandatory Start', token: 'CS_MANDSTART', type: 'MSO', hard: true },
  { label: 'Mandatory Finish', token: 'CS_MANDFIN', type: 'MFO', hard: true },
];

const P6_CONSTRAINT_BY_CODE_OR_LABEL: Readonly<Record<string, { type: ConstraintType; hard?: boolean }>> =
  Object.fromEntries(P6_CONSTRAINT_KINDS.flatMap(k => {
    const value = { type: k.type, ...(k.hard ? { hard: true } : {}) };
    return [[k.label, value], [k.token, value]];
  }));

export function p6ConstraintFromCodeOrLabel(value: string): { type: ConstraintType; hard?: boolean } | undefined {
  return Object.prototype.hasOwnProperty.call(P6_CONSTRAINT_BY_CODE_OR_LABEL, value)
    ? P6_CONSTRAINT_BY_CODE_OR_LABEL[value]
    : undefined;
}

export function p6ConstraintLabel(c: TaskConstraint): string | undefined {
  if (c.type === 'ASAP') return undefined;
  const hard = (c.type === 'MSO' || c.type === 'MFO') && c.hard === true;
  return P6_CONSTRAINT_KINDS.find(k => k.type === c.type && k.hard === hard)?.label;
}

export function p6ConstraintToken(c: TaskConstraint): string | undefined {
  if (c.type === 'ASAP') return undefined;
  const hard = (c.type === 'MSO' || c.type === 'MFO') && c.hard === true;
  return P6_CONSTRAINT_KINDS.find(k => k.type === c.type && k.hard === hard)?.token;
}

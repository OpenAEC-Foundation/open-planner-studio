import type { ConstraintType, TaskConstraint } from '@/types/task';

export type ConstraintPairIssue =
  | 'secondary-hard-forbidden'
  | 'no-secondary-with-mandatory-or-on'
  | 'no-secondary-with-asap-alap'
  | 'secondary-type-invalid'
  | 'secondary-same-side';

export interface ConstraintPairValidation {
  ok: boolean;
  issues: ConstraintPairIssue[];
}

type BoundSide = 'forward' | 'backward' | 'both' | 'none';

export function constraintSide(type: ConstraintType): BoundSide {
  switch (type) {
    case 'SNET':
    case 'FNET':
      return 'forward';
    case 'SNLT':
    case 'FNLT':
      return 'backward';
    case 'MSO':
    case 'MFO':
      return 'both';
    default:
      return 'none';
  }
}

export function withPrimaryConstraint(
  next: TaskConstraint | undefined,
  secondary: TaskConstraint | undefined,
): { constraint: TaskConstraint | undefined; constraint2: TaskConstraint | undefined } {
  if (!next || next.type === 'ASAP') return { constraint: undefined, constraint2: undefined };
  if (next.type === 'ALAP') return { constraint: { type: 'ALAP' }, constraint2: undefined };
  return { constraint: next, constraint2: secondary };
}

export function validateConstraintPair(
  primary: TaskConstraint | undefined,
  secondary: TaskConstraint | undefined,
): ConstraintPairValidation {
  const issues: ConstraintPairIssue[] = [];
  if (!secondary) return { ok: true, issues };

  if (secondary.hard) issues.push('secondary-hard-forbidden');

  const primarySide = primary ? constraintSide(primary.type) : 'none';
  if (primary && (primarySide === 'both' || primary.hard)) {
    issues.push('no-secondary-with-mandatory-or-on');
  } else if (primarySide === 'none') {
    issues.push('no-secondary-with-asap-alap');
  }

  const secondarySide = constraintSide(secondary.type);
  if (secondarySide === 'both' || secondarySide === 'none') {
    issues.push('secondary-type-invalid');
  } else if (
    (primarySide === 'forward' || primarySide === 'backward') &&
    primarySide === secondarySide
  ) {
    issues.push('secondary-same-side');
  }

  return { ok: issues.length === 0, issues };
}

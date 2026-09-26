import type { ConstraintType, TaskConstraint } from '@/types/task';

/**
 * Pure validatie van een PRIMAIR + SECUNDAIR constraint-paar (P6-regels).
 *
 * BELANGRIJK: de SOLVER rekent gewoon met wat er staat (twee bounds stapelen als max/min, een
 * verboden `constraint2.hard` wordt genegeerd/altijd-soft behandeld). Deze helper is puur voor de
 * AUTHORING-laag (eigenschappenpaneel, taakraster, MCP) om nonsensicale paren te weigeren — hij muteert niets en
 * heeft geen effect op de berekening.
 *
 * P6-regels:
 *  - een secundaire constraint mag NOOIT hard zijn (altijd soft);
 *  - géén secundaire constraint als de primaire een "Start On"/"Finish On"/Mandatory is (MSO/MFO of
 *    een harde pin) — die legt zelf al start én finish vast;
 *  - géén secundaire constraint bij ASAP/ALAP (die dragen geen datum-grens);
 *  - het secundaire type moet een pure grens zijn (SNET/FNET/SNLT/FNLT), geen MSO/MFO/ASAP/ALAP;
 *  - het paar moet één FORWARD-grens (SNET/FNET, onder­grens) en één BACKWARD-grens (SNLT/FNLT,
 *    bovengrens) zijn — twee gelijksoortige grenzen zijn niet toegestaan (bv. SNET+FNLT mag wel).
 */
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

/** Grens-categorie van een constraint-type: forward = start/finish-ONDERgrens (max),
 *  backward = start/finish-BOVENgrens (min), both = MSO/MFO (onder- én bovengrens), none = ASAP/ALAP. */
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
      return 'none'; // ASAP / ALAP
  }
}

/**
 * Het constraint-PAAR nadat de gebruiker (of een agent) een nieuw PRIMAIR constraint kiest — één
 * canonicalisatie voor eigenschappenpaneel, taakraster en MCP (`taskFields.ts`):
 *  - geen primair of ASAP ⇒ beide weg (ASAP is de afwezigheid van een constraint);
 *  - ALAP ⇒ `{ type: 'ALAP' }` zonder datum, en de secundaire vervalt (ALAP draagt geen grens);
 *  - een datumconstraint ⇒ precies `next`, de bestaande secundaire blijft staan. Of dat paar mag,
 *    beslist daarna `validateConstraintPair` — de aanroeper weigert een ongeldig paar.
 * Puur: bouwt geen datum of harde pin (dat blijft bij de aanroeper), muteert niets.
 */
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

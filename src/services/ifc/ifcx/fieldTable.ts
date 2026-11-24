export type IfcxValue =
  | { readonly dataType: 'String'; readonly form?: IfcxForm }
  | { readonly dataType: 'DateTime'; readonly form: IfcxForm }
  | { readonly dataType: 'Integer'; readonly min?: number; readonly max?: number }
  | { readonly dataType: 'Real' }
  | { readonly dataType: 'Boolean' }
  | { readonly dataType: 'Enum'; readonly options: readonly string[] }
  | { readonly dataType: 'Reference' }
  | { readonly dataType: 'Array'; readonly item: IfcxValue }
  | { readonly dataType: 'Object'; readonly members: Readonly<Record<string, IfcxMember>> };

export interface IfcxForm {
  readonly name: string;
  readonly pattern: RegExp;
}

export interface IfcxMember {
  readonly value: IfcxValue;
  readonly optional?: boolean;
}

export interface IfcxField<W, R> extends IfcxMember {
  readonly key: string;
  readonly write: (source: W) => unknown;
  readonly read: (value: unknown, target: R) => void;
}

export const TEXT: IfcxValue = { dataType: 'String' };
export const REAL: IfcxValue = { dataType: 'Real' };
export const BOOLEAN: IfcxValue = { dataType: 'Boolean' };
export const REFERENCE: IfcxValue = { dataType: 'Reference' };
export const CALENDAR_DATE: IfcxValue = {
  dataType: 'DateTime', form: { name: 'YYYY-MM-DD', pattern: /^\d{4}-\d{2}-\d{2}$/ },
};
export const LOCAL_MOMENT_OR_EMPTY: IfcxValue = {
  dataType: 'String',
  form: { name: 'YYYY-MM-DD[THH:MM[:SS[.sss]]] of leeg', pattern: /^(\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?)?)?$/ },
};
export const VERSION_TEXT: IfcxValue = { dataType: 'String', form: { name: 'MAJOR.MINOR.PATCH', pattern: /^\d+\.\d+\.\d+$/ } };

export function integer(min?: number, max?: number): IfcxValue {
  return { dataType: 'Integer', ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}) };
}

export function enumOf(options: readonly string[]): IfcxValue {
  return { dataType: 'Enum', options };
}

export function arrayOf(item: IfcxValue): IfcxValue {
  return { dataType: 'Array', item };
}

export function objectOf(members: Readonly<Record<string, IfcxMember>>): IfcxValue {
  return { dataType: 'Object', members };
}

export function membersOf(fields: readonly (IfcxMember & { readonly key: string })[]): Record<string, IfcxMember> {
  const members: Record<string, IfcxMember> = {};
  for (const field of fields) {
    if (field.key in members) throw new Error(`Dubbel IFCX-veld: ${field.key}`);
    members[field.key] = field.optional ? { value: field.value, optional: true } : { value: field.value };
  }
  return members;
}

export function writeFields<W, R>(fields: readonly IfcxField<W, R>[], source: W): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    const value = field.write(source);
    if (value !== undefined) out[field.key] = value;
  }
  return out;
}

export function readFields<W, R>(fields: readonly IfcxField<W, R>[], value: Readonly<Record<string, unknown>>, target: R): void {
  for (const field of fields) field.read(value[field.key], target);
}

export function ifc5ValueDescription(value: IfcxValue, optional = false): Record<string, unknown> {
  const base: Record<string, unknown> = { dataType: value.dataType };
  if (optional) base.optional = true;
  if (value.dataType === 'Enum') base.enumRestrictions = { options: [...value.options] };
  if (value.dataType === 'Array') base.arrayRestrictions = { value: ifc5ValueDescription(value.item) };
  if (value.dataType === 'Object') {
    const values: Record<string, unknown> = {};
    for (const [key, member] of Object.entries(value.members)) values[key] = ifc5ValueDescription(member.value, member.optional);
    base.objectRestrictions = { values };
  }
  return base;
}

export type IfcxValueProblem =
  | { readonly kind: 'unknown-field'; readonly field: string }
  | { readonly kind: 'invalid'; readonly field: string; readonly detail: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

type Problem = { kind: 'unknown-field' | 'invalid'; path: string[]; detail: string };

function invalidValue(detail: string): Problem {
  return { kind: 'invalid', path: [], detail };
}

function within(problem: Problem | undefined, step: string): Problem | undefined {
  if (problem) problem.path.unshift(step);
  return problem;
}

function problemOf(spec: IfcxValue, value: unknown): Problem | undefined {
  const found = () => JSON.stringify(value);
  switch (spec.dataType) {
    case 'String':
    case 'DateTime':
      if (typeof value !== 'string') return invalidValue(`verwacht tekst, gevonden ${found()}`);
      if (spec.form && !spec.form.pattern.test(value)) return invalidValue(`verwacht de vorm ${spec.form.name}, gevonden ${found()}`);
      return;
    case 'Reference':
      return typeof value === 'string' ? undefined : invalidValue(`verwacht een pad, gevonden ${found()}`);
    case 'Boolean':
      return typeof value === 'boolean' ? undefined : invalidValue(`verwacht waar of onwaar, gevonden ${found()}`);
    case 'Real':
      return typeof value === 'number' && Number.isFinite(value) ? undefined : invalidValue(`verwacht een getal, gevonden ${found()}`);
    case 'Integer':
      if (typeof value !== 'number' || !Number.isSafeInteger(value)) return invalidValue(`verwacht een geheel getal, gevonden ${found()}`);
      if (spec.min !== undefined && value < spec.min) return invalidValue(`kleiner dan ${spec.min}`);
      if (spec.max !== undefined && value > spec.max) return invalidValue(`groter dan ${spec.max}`);
      return;
    case 'Enum':
      return typeof value === 'string' && spec.options.includes(value) ? undefined
        : invalidValue(`verwacht een van ${spec.options.join(', ')}, gevonden ${found()}`);
    case 'Array': {
      if (!Array.isArray(value)) return invalidValue(`verwacht een lijst, gevonden ${found()}`);
      for (let i = 0; i < value.length; i++) {
        const problem = within(problemOf(spec.item, value[i]), `[${i}]`);
        if (problem) return problem;
      }
      return;
    }
    case 'Object': {
      if (!isPlainObject(value)) return invalidValue(`verwacht een object, gevonden ${found()}`);
      for (const key in value) {
        if (!Object.hasOwn(spec.members, key)) return { kind: 'unknown-field', path: [key], detail: 'onbekend veld' };
      }
      for (const key in spec.members) {
        const member = spec.members[key];
        if (!Object.hasOwn(value, key)) {
          if (member.optional) continue;
          return { kind: 'invalid', path: [key], detail: 'ontbreekt' };
        }
        const problem = within(problemOf(member.value, value[key]), key);
        if (problem) return problem;
      }
      return;
    }
  }
}

export function checkValue(spec: IfcxValue, value: unknown): IfcxValueProblem | undefined {
  const problem = problemOf(spec, value);
  if (!problem) return undefined;
  const field = problem.path.map((step, index) => (index === 0 || step.startsWith('[') ? step : `.${step}`)).join('');
  return problem.kind === 'invalid' ? { kind: 'invalid', field, detail: problem.detail } : { kind: 'unknown-field', field };
}

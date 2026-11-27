import type { ElementLink, TaskElementLinks } from '../foreign/elementLinks';
import { arrayOf, checkValue, objectOf, type IfcxValue } from './fieldTable';
import { IfcxWriteRefusedError } from './ifcxErrors';
import { ATTRIBUTE } from './profile';

export type IfcxModelSource = { readonly fileName: string; readonly sha256: string };

export interface IfcxModelReferences {
  readonly modelSource?: IfcxModelSource;
  readonly elementLinks?: TaskElementLinks;
}

export type IfcxSchedulesLink = { readonly relation: 'schedules'; readonly target: string };

const localFileName = { name: 'een lokale IFCX-bestandsnaam', pattern: /^[^\\/:\p{Cc}]+\.ifcx$/iu };
const sha256 = { name: '64 kleine hextekens', pattern: /^[0-9a-f]{64}$/ };
const schedules = { name: 'schedules', pattern: /^schedules$/ };

export const MODEL_SOURCE_VALUE = objectOf({
  fileName: { value: { dataType: 'String', form: localFileName } },
  sha256: { value: { dataType: 'String', form: sha256 } },
});

function isModelPath(path: string): boolean {
  const segments = (path.startsWith('/') ? path.slice(1) : path).split('/');
  return !/[\\\p{Cc}]/u.test(path) && !/^[a-z][a-z0-9+.-]*:/i.test(path)
    && segments.every(segment => segment.trim() !== '' && segment !== '.' && segment !== '..');
}

export const LINKS_VALUE: IfcxValue = arrayOf(objectOf({
  relation: { value: { dataType: 'String', form: schedules } },
  target: { value: { dataType: 'Reference', accepts: isModelPath } },
}));

export function savedModelReferences(input: IfcxModelReferences, tasks: readonly { id: string }[]): IfcxModelReferences {
  const { modelSource } = input;
  if (modelSource !== undefined) {
    const problem = checkValue(MODEL_SOURCE_VALUE, modelSource);
    if (problem) {
      const field = problem.field;
      throw new IfcxWriteRefusedError('invalid', 'Ongeldige bronverwijzing', [`${ATTRIBUTE.modelSource}.${field}`], { attribute: ATTRIBUTE.modelSource, field });
    }
  }
  const elementLinks = new Map<string, ElementLink[]>();
  if (input.elementLinks?.size) {
    for (const { id } of tasks) {
      const links = input.elementLinks.get(id);
      if (!links?.length) continue;
      elementLinks.set(id, links.map(({ direction, target }) => {
        if (direction !== 'output') throw new IfcxWriteRefusedError('unsupported', `Taak ${id} heeft een koppeling die geen uitvoerkoppeling is`, [ATTRIBUTE.links]);
        return { direction, target, found: false };
      }));
    }
  }
  return {
    ...(modelSource !== undefined ? { modelSource } : {}),
    ...(elementLinks.size ? { elementLinks } : {}),
  };
}

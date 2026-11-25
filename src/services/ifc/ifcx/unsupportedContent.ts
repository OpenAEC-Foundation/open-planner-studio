import type { WriteIFCInput } from '../ifcWriter';
import { carriesValue } from './fieldTable';
import { carriesModelContent, NODES, STEP_WRITER_INPUT_NOT_CARRIED } from './nodes';

export interface UnsupportedContent {
  readonly field: string;
  readonly objects: readonly string[];
}

export function unsupportedContent(model: WriteIFCInput): UnsupportedContent[] {
  const found = new Map<string, string[]>();
  for (const key of STEP_WRITER_INPUT_NOT_CARRIED) if (carriesModelContent(model, key)) found.set(key, []);
  for (const node of NODES) {
    for (const carried of node.objectKeys) {
      const keys = new Set(carried.keys);
      for (const [label, instance] of carried.instances(model)) {
        for (const [key, value] of Object.entries(instance)) {
          if (keys.has(key) || !carriesValue(value)) continue;
          const field = `${carried.object}.${key}`;
          const objects = found.get(field) ?? [];
          if (!objects.includes(label)) objects.push(label);
          found.set(field, objects);
        }
      }
    }
  }
  return [...found].map(([field, objects]) => ({ field, objects }));
}

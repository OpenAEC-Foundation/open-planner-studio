import type { WriteIFCInput } from '../ifcWriter';
import { carriesValue } from './fieldTable';
import { carriesModelContent, NODES, STEP_WRITER_INPUT_NOT_CARRIED } from './nodes';

export function unsupportedContent(model: WriteIFCInput): string[] {
  const found = new Set<string>();
  for (const key of STEP_WRITER_INPUT_NOT_CARRIED) if (carriesModelContent(model, key)) found.add(key);
  for (const node of NODES) {
    for (const carried of node.objectKeys) {
      const keys = new Set(carried.keys);
      for (const instance of carried.instances(model)) {
        for (const [key, value] of Object.entries(instance)) if (!keys.has(key) && carriesValue(value)) found.add(`${carried.object}.${key}`);
      }
    }
  }
  return [...found];
}

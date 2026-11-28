import { join } from 'node:path';
import { CfbFile } from '@/services/mpp/cfb';
import { detectMppVariant, type MppVariant } from '@/services/mpp/mppContainer';
import { MppUnsupportedError } from '@/services/mpp/errors';

const DEFAULT_CRAWL_ROOT = '/home/nozzit/open-aec/voor claude/testdata-crawl';

export function resolveMppCrawlScopes(env: Readonly<Record<string, string | undefined>>): {
  root: string;
  smoke: string;
} {
  const root = env.OPS_MPP_CRAWL ?? DEFAULT_CRAWL_ROOT;
  return { root, smoke: env.OPS_MPP_CRAWL_SMOKE ?? join(root, 'crawl-mpp') };
}

export type MppCorpusEntry<T> =
  | { kind: 'supported'; value: T }
  | { kind: 'legacy'; variant: Exclude<MppVariant, 'MPP14'> };

export function readMppCorpusEntry<T>(bytes: Uint8Array, read: (bytes: Uint8Array) => T): MppCorpusEntry<T> {
  const variant = detectMppVariant(new CfbFile(bytes));
  let value: T;
  try {
    value = read(bytes);
  } catch (err) {
    if (variant !== 'MPP14' && err instanceof MppUnsupportedError && err.mppCode === 'MPP_LEGACY') {
      return { kind: 'legacy', variant };
    }
    throw err;
  }
  if (variant !== 'MPP14') {
    throw new Error(`MPP-corpus: ${variant} werd gelezen in plaats van bewust geweigerd`);
  }
  return { kind: 'supported', value };
}

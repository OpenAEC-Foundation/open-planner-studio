export class FetchTimeoutError extends Error {
  constructor(readonly url: string, readonly timeoutMs: number) {
    super(`geen antwoord binnen ${Math.ceil(timeoutMs / 1000)} s: ${url}`);
    this.name = 'FetchTimeoutError';
  }
}

export type FetchInit = Omit<RequestInit, 'signal'>;

export function fetchWithTimeout<T>(
  url: string,
  init: FetchInit,
  timeoutMs: number,
  read: (res: Response) => Promise<T>,
  fetchImpl: typeof fetch = fetch,
): Promise<T> {
  return run(url, init, timeoutMs, false, read, fetchImpl);
}

export function fetchWithIdleTimeout<T>(
  url: string,
  init: FetchInit,
  idleMs: number,
  read: (res: Response, progress: () => void) => Promise<T>,
  fetchImpl: typeof fetch = fetch,
): Promise<T> {
  return run(url, init, idleMs, true, read, fetchImpl);
}

export async function readBodyBytes(res: Response, progress: () => void): Promise<Uint8Array> {
  if (!res.body) return new Uint8Array(await res.arrayBuffer());
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    progress();
    chunks.push(value);
    total += value.byteLength;
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

async function run<T>(
  url: string,
  init: FetchInit,
  ms: number,
  idle: boolean,
  read: (res: Response, progress: () => void) => Promise<T>,
  fetchImpl: typeof fetch,
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  let timer = setTimeout(abort, ms);
  const progress = idle
    ? () => { clearTimeout(timer); timer = setTimeout(abort, ms); }
    : () => {};
  const stopped = new Promise<never>((_, reject) => {
    controller.signal.addEventListener('abort', () => reject(new Error('afgebroken')), { once: true });
  });
  try {
    const work = (async () => {
      const res = await fetchImpl(url, { ...init, signal: controller.signal });
      progress();
      return read(res, progress);
    })();
    return await Promise.race([work, stopped]);
  } catch (err) {
    if (controller.signal.aborted) throw new FetchTimeoutError(url, ms);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * `fetch` met een tijdslimiet, in twee smaken.
 *
 * Een kale `fetch` heeft geen timeout: een server die de verbinding openhoudt zonder te antwoorden
 * (of halverwege de body stilvalt) laat de belofte eeuwig hangen, en daarmee elke UI die erop wacht
 * (de bezig-stand van de tutorialvraag, de installeerknop in de catalogus). Een `AbortController`
 * breekt het verzoek af zodra de limiet verloopt; de limiet dekt ook het lezen van de body.
 *
 *  - {@link fetchWithTimeout}: een TOTALE limiet, van verzoek tot en met de gelezen body. Voor kleine
 *    antwoorden (de catalogus), waar "te lang" altijd "hangt" betekent.
 *  - {@link fetchWithIdleTimeout}: een STILTE-limiet. De timer begint opnieuw bij de kop en bij elk
 *    binnengekomen stuk body ({@link readBodyBytes}), zodat een grote download over een trage maar
 *    gestage lijn gewoon afloopt, en alleen een verbinding die stilvalt eindigt.
 *
 * Het signaal is van deze module: `init` neemt daarom geen eigen `signal` aan (geen stil overschrijven;
 * `AbortSignal.any` om twee signalen te combineren ontbreekt in oudere WebKit-versies).
 *
 * Bladmodule zonder store of i18n: de aanroeper vertaalt een {@link FetchTimeoutError} naar zijn eigen
 * melding, en `tests/planning/check-first-start.ts` test hem met een ingespoten `fetch`.
 */

/** Het verzoek is afgebroken omdat het niet binnen de tijdslimiet klaar was (of te lang stilviel). */
export class FetchTimeoutError extends Error {
  constructor(readonly url: string, readonly timeoutMs: number) {
    super(`geen antwoord binnen ${Math.ceil(timeoutMs / 1000)} s: ${url}`);
    this.name = 'FetchTimeoutError';
  }
}

export type FetchInit = Omit<RequestInit, 'signal'>;

/** Totale limiet: verzoek plus `read` samen binnen `timeoutMs`. */
export function fetchWithTimeout<T>(
  url: string,
  init: FetchInit,
  timeoutMs: number,
  read: (res: Response) => Promise<T>,
  fetchImpl: typeof fetch = fetch,
): Promise<T> {
  return run(url, init, timeoutMs, false, read, fetchImpl);
}

/**
 * Stilte-limiet: nooit langer dan `idleMs` zonder voortgang. De kop telt als voortgang; tijdens `read`
 * meldt de aanroeper voortgang via `progress` (doe dat met {@link readBodyBytes}).
 */
export function fetchWithIdleTimeout<T>(
  url: string,
  init: FetchInit,
  idleMs: number,
  read: (res: Response, progress: () => void) => Promise<T>,
  fetchImpl: typeof fetch = fetch,
): Promise<T> {
  return run(url, init, idleMs, true, read, fetchImpl);
}

/** Lees de body als bytes en meld elk binnengekomen stuk als voortgang. Zonder stream: in één keer. */
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
  // De race maakt de limiet hard, ook als `fetchImpl` of `read` het signaal zou negeren; een fetch
  // die het wél volgt, wordt erdoor echt afgebroken (geen verbinding of stream die blijft openstaan).
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
    // Welke afwijzing de race won (onze of de AbortError van fetch/stream), hangt af van de
    // microtaakvolgorde; het signaal zegt ondubbelzinnig of de limiet verliep.
    if (controller.signal.aborted) throw new FetchTimeoutError(url, ms);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

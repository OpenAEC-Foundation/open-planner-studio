/**
 * `fetch` met een tijdslimiet die ook het lezen van de body dekt.
 *
 * Een kale `fetch` heeft geen timeout: een server die de verbinding openhoudt zonder te antwoorden
 * (of halverwege de body stilvalt) laat de belofte eeuwig hangen, en daarmee elke UI die erop wacht
 * (de bezig-stand van de tutorialvraag, de installeerknop in de catalogus). Hier breekt een
 * `AbortController` het verzoek na `timeoutMs` af; de timer loopt door tot `read` klaar is, zodat een
 * stilgevallen download net zo goed eindigt als een verzoek dat nooit een kop kreeg.
 *
 * Bladmodule zonder store of i18n: de aanroeper vertaalt een {@link FetchTimeoutError} naar zijn eigen
 * melding, en `tests/planning/check-first-start.ts` test hem met een ingespoten `fetch`.
 */

/** Het verzoek is afgebroken omdat het niet binnen de tijdslimiet klaar was. */
export class FetchTimeoutError extends Error {
  constructor(readonly url: string, readonly timeoutMs: number) {
    super(`geen antwoord binnen ${Math.ceil(timeoutMs / 1000)} s: ${url}`);
    this.name = 'FetchTimeoutError';
  }
}

export async function fetchWithTimeout<T>(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  read: (res: Response) => Promise<T>,
  fetchImpl: typeof fetch = fetch,
): Promise<T> {
  const controller = new AbortController();
  // De race maakt de limiet hard, ook als `fetchImpl` of `read` het signaal zou negeren; een
  // fetch die het wél volgt, wordt erdoor echt afgebroken (geen verbinding die blijft openstaan).
  const timeout = new Promise<never>((_, reject) => {
    controller.signal.addEventListener('abort', () => reject(new FetchTimeoutError(url, timeoutMs)), { once: true });
  });
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const work = (async () => read(await fetchImpl(url, { ...init, signal: controller.signal })))();
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

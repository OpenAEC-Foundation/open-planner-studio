/** SIGTERM vraagt herstelopslag, zonder een sluitvraag of het wissen van bestaande snapshots. */
export function createManagedShutdown(deps: {
  finishInput: () => void | Promise<void>;
  freeze: () => void;
  flush: () => Promise<void>;
  confirm: () => Promise<void>;
}): () => Promise<void> {
  let running: Promise<void> | null = null;
  return () => {
    if (running) return running;
    running = (async () => {
      deps.freeze();
      await deps.finishInput();
      await deps.flush();
      await deps.confirm();
    })();
    // Een schrijffout blijft zichtbaar; een volgend native verzoek mag de opslag opnieuw proberen.
    void running.catch(() => { running = null; });
    return running;
  };
}

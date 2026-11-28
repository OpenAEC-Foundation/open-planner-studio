export function createRecoveryTickQueue(round: () => Promise<void>, enabled: () => boolean): () => Promise<void> {
  let inFlight: Promise<void> | null = null;
  let pending = false;
  return () => {
    if (!enabled()) return Promise.resolve();
    if (inFlight) { pending = true; return inFlight; }
    inFlight = Promise.resolve().then(async () => {
      try {
        while (enabled()) {
          pending = false;
          await round();
          if (!pending) break;
        }
      } finally { inFlight = null; }
    });
    return inFlight;
  };
}

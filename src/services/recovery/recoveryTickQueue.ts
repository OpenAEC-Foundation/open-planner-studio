/**
 * Voeg overlappende timer-/flushverzoeken samen. De gedeelde belofte omvat ook de opnieuw gelezen
 * documentversie: de updater mag pas herstarten wanneer de volledige ronde klaar is.
 */
export function createRecoveryTickQueue(round: () => Promise<void>, enabled: () => boolean): () => Promise<void> {
  let inFlight: Promise<void> | null = null;
  let pending = false;
  return () => {
    if (!enabled()) return Promise.resolve();
    if (inFlight) { pending = true; return inFlight; }
    // Eerst de belofte publiceren, ook als `round` synchroon gooit. De rij binnen dezelfde
    // microtask vrijgeven als de laatste pending-controle: geen verloren verzoek in een losse finally.
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

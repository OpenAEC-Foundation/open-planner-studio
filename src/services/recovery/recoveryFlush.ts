// Eén directe crashherstel-ronde op verzoek, los van de 10 s-throttle van `useAutoSave`.
//
// De updater herstart de app direct na de installatie (`relaunch()`), zonder sluitvraag: zo'n
// herstart is bewust geen normale afsluiting. Bewerkingen van de laatste (tot 10) seconden zaten dan
// nog niet in een herstelsnapshot en waren weg (audit 2026-09-26). `useAutoSave` registreert hier
// zijn ronde; `flushRecoveryNow()` schrijft vóór de herstart nog één snapshot, zodat het
// herstel-venster na de update alles aanbiedt. Geen hook geregistreerd (web-test, vóór mount) ⇒
// no-op.

type RecoveryFlush = () => Promise<void>;
let registered: RecoveryFlush | null = null;

export function registerRecoveryFlush(flush: RecoveryFlush): () => void {
  registered = flush;
  return () => { if (registered === flush) registered = null; };
}

export async function flushRecoveryNow(): Promise<void> {
  if (registered) await registered();
}

// Eén directe crashherstel-ronde op verzoek, los van de 10 s-throttle van `useAutoSave`.
//
// De updater herstart de app direct na de installatie (`relaunch()`), zonder sluitvraag: zo'n
// herstart is bewust geen normale afsluiting. Bewerkingen van de laatste (tot 10) seconden zaten dan
// nog niet in een herstelsnapshot en waren weg (audit 2026-09-26). `useAutoSave` registreert hier
// zijn ronde; `flushRecoveryNow()` schrijft vóór de herstart nog één snapshot, zodat het
// herstel-venster na de update alles aanbiedt. Geen hook geregistreerd (web-test, vóór mount) ⇒
// no-op.
import { whenProjectFileWritesIdle } from '@/services/fileAccess/writeCoordinator';

type RecoveryFlush = () => Promise<void>;
let registered: RecoveryFlush | null = null;

export function registerRecoveryFlush(flush: RecoveryFlush): () => void {
  registered = flush;
  return () => { if (registered === flush) registered = null; };
}

export async function flushRecoveryNow(): Promise<void> {
  if (registered) await registered();
}

/**
 * Vóór de herstart van de updater (#804 stap 3): eerst wachten tot er geen projectopslag meer loopt of wacht (een
 * vervanging mag niet halverwege afgebroken worden), dan één herstelronde met wat die opslag vastlegde. Niet binnen
 * `runProjectFileWrite` aanroepen; `replaceWithRecoveryPending` gebruikt daar `flushRecoveryNow`.
 */
export async function flushRecoveryAfterWrites(): Promise<void> {
  for (let idle = whenProjectFileWritesIdle(); idle; idle = whenProjectFileWritesIdle()) await idle;
  await flushRecoveryNow();
}

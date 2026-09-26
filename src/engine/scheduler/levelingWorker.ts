// Web Worker-ingang voor de nivelleer-dialoog (audit 2026-09-26). Rekent `levelResources` buiten de
// UI-thread, zodat de app bruikbaar blijft en de berekening te annuleren is (worker.terminate()).
// Pure engine-code: geen store, geen DOM — de invoer is plain data (`LevelingInput`), het resultaat
// gaat via structured clone terug. De synchrone route (MCP, `planner_batch`) gebruikt dezelfde
// functie rechtstreeks.
import { levelResources, type LevelingInput } from './ResourceLeveler';

interface WorkerScope {
  onmessage: ((event: MessageEvent<{ input: LevelingInput }>) => void) | null;
  postMessage(message: unknown): void;
}
const scope = self as unknown as WorkerScope;

scope.onmessage = (event) => {
  try {
    scope.postMessage({ ok: true, result: levelResources(...event.data.input) });
  } catch (error) {
    scope.postMessage({ ok: false, message: error instanceof Error ? error.message : String(error) });
  }
};

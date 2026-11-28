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

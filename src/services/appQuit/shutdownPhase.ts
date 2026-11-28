export type ShutdownOwner = 'quit' | 'update';

let owner: ShutdownOwner | null = null;
let waiting: Array<() => void> = [];

export function claimShutdown(who: ShutdownOwner): (() => void) | null {
  if (owner !== null) return null;
  owner = who;
  let held = true;
  return () => {
    if (!held) return;
    held = false;
    owner = null;
    const next = waiting;
    waiting = [];
    for (const wake of next) wake();
  };
}

export async function claimShutdownWhenFree(who: ShutdownOwner): Promise<() => void> {
  for (;;) {
    const release = claimShutdown(who);
    if (release) return release;
    await new Promise<void>((resolve) => { waiting.push(resolve); });
  }
}

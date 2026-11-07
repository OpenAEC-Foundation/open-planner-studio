// Eén app-instantie mag nooit twee schrijfroutes tegelijk naar projectbestanden sturen. De lock
// omvat ook de handmatige opslaan-dialoog: tijdens die blokkerende keuze mag een timer niet nog
// een tweede write voorbereiden. Het is app-runtime, geen document- of IFC-data.
let busy = false;
let tail: Promise<void> = Promise.resolve();

// Los van de wachtrij met dialoogkeuzes: SIGTERM wacht alleen de daadwerkelijk begonnen I/O af.
// De poort blijft daarna dicht, zodat een late native dialoogkeuze geen nieuw doel kan afkappen.
let userWritesStopped = false;
const activeUserWrites = new Set<Promise<void>>();

function assertUserWritesAllowed(): void {
  if (userWritesStopped) throw new Error('User file writes are stopped while the application is shutting down.');
}

export async function trackUserFileWrite<T>(write: () => Promise<T>): Promise<T> {
  assertUserWritesAllowed();
  let finish!: () => void;
  const done = new Promise<void>(resolve => { finish = resolve; });
  activeUserWrites.add(done);
  try {
    return await write();
  } finally {
    activeUserWrites.delete(done);
    finish();
  }
}

/** Sluit nieuwe schrijfacties af en wacht alle al begonnen gebruikersbestand-I/O af, ook bij fouten. */
export async function stopUserFileWrites(): Promise<void> {
  userWritesStopped = true;
  while (activeUserWrites.size > 0) await Promise.all([...activeUserWrites]);
}

export function isProjectFileWriteBusy(): boolean {
  return busy;
}

export async function runProjectFileWrite<T>(work: () => Promise<T>): Promise<T> {
  assertUserWritesAllowed();
  busy = true;
  let release: (() => void) | undefined;
  const turn = new Promise<void>((resolve) => { release = resolve; });
  const previous = tail;
  const queued = previous.then(() => turn);
  tail = queued;
  await previous;
  try {
    assertUserWritesAllowed(); // Ook een al wachtende poging mag na SIGTERM niet meer beginnen.
    return await work();
  } finally {
    release!();
    // Een volgende wachtrijhouder houdt de vlag terecht hoog; pas als dit de staart was is de
    // volgende timer-run weer toegestaan.
    if (tail === queued) busy = false;
  }
}

/**
 * Schrijf-en-vervang voor bestanden die de app zelf in `appDataDir` beheert (bevinding K4).
 * `writeTextFile` truncate't het doelbestand vóórdat het schrijft, dus een crash midden in de
 * schrijfactie laat een AFGEKAPT bestand achter. Daarom eerst naar `<naam><tmpSuffix>`, dan
 * `rename` over het doel.
 *
 * Een atomaire schrijf-primitief kent `plugin-fs` niet; `rename` is het beste wat er is. Die mapt
 * op `std::fs::rename`, en binnen dezelfde map (dus gegarandeerd hetzelfde volume) is dat een
 * atomaire vervanging op zowel POSIX als Windows. Na een crash staat er dus óf het complete oude,
 * óf het complete nieuwe bestand — nooit een halve.
 *
 * Wat dit NIET afdekt: er is geen `fsync`/flush in `plugin-fs`, dus bij stroomuitval of een
 * kernel-panic kan de rename op sommige bestandssystemen vóór de data landen. Tegen een app-crash
 * dekt het wel volledig.
 */

/** De drie bestandsoperaties die de schrijf-en-vervang nodig heeft — injecteerbaar voor tests. */
export interface AtomicWriteFs {
  writeTextFile(path: string, text: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  remove(path: string): Promise<void>;
}

/** Schrijf `text` naar `tmp` en vervang daarmee `target`. Mislukt de rename, dan wordt het
 *  halffabricaat opgeruimd en de fout doorgegeven; `target` blijft dan onaangeroerd. */
export async function writeViaTemp(fs: AtomicWriteFs, target: string, tmp: string, text: string): Promise<void> {
  await fs.writeTextFile(tmp, text);
  try {
    await fs.rename(tmp, target);
  } catch (err) {
    try { await fs.remove(tmp); } catch { /* al weg */ }
    throw err;
  }
}

/** Tauri-variant: `name` in `dir`, halffabricaat `name + tmpSuffix` in dezelfde map. */
export async function writeTextFileAtomic(dir: string, name: string, text: string, tmpSuffix = '.tmp'): Promise<void> {
  const fs = await import('@tauri-apps/plugin-fs');
  const { join } = await import('@tauri-apps/api/path');
  await writeViaTemp(
    { writeTextFile: (p, t) => fs.writeTextFile(p, t), rename: (a, b) => fs.rename(a, b), remove: p => fs.remove(p) },
    await join(dir, name),
    await join(dir, `${name}${tmpSuffix}`),
    text,
  );
}

/**
 * Zorg dat een bestandspad op de gewenste extensie eindigt.
 *
 * De native opslaan-dialoog (Tauri/rfd) plakt op Linux/GTK de filter-extensie
 * níet automatisch aan een door de gebruiker getypte naam. Zonder deze normalisatie
 * wordt "test" als `test` (zonder extensie) weggeschreven — onherkenbaar in de
 * bestandsbeheerder én onzichtbaar in de openen-dialoog, die op `*.ext` filtert.
 * Reeds aanwezige (hoofdletter-ongevoelige) extensie blijft ongemoeid, dus geen
 * dubbele `test.ifc.ifc`.
 *
 * @param path het pad zoals de dialoog het teruggeeft
 * @param ext  de extensie zónder punt, bv. 'ifc'
 */
export function ensureExtension(path: string, ext: string): string {
  const suffix = `.${ext.toLowerCase()}`;
  return path.toLowerCase().endsWith(suffix) ? path : `${path}.${ext}`;
}

/**
 * Lowercase bestandsextensie zónder punt — de vier plekken die deze extractie deden
 * (`formatRegistry.readFormatForFile`, `fileTools.formatOf`, `webBackend.isBinaryName`,
 * `tauriBackend`'s binair-beslissing) hadden allemaal letterlijk dezelfde
 * `path.split('.').pop()?.toLowerCase() ?? ''` (T11, T2-kwaliteitsreview-agenda stap 0 c). Werkt
 * op een volledig pad EN een kale bestandsnaam (alleen het laatste segment na de laatste punt
 * telt, `split('.')` kijkt niet naar `/`).
 *
 * KORRECTIE (T11-eindreview): een PUNTLOZE naam (bv. `'Makefile'` of `'test'`) geeft NIET `''`
 * terug, ondanks de `?? ''`-fallback — `'test'.split('.')` is `['test']`, en `.pop()` op een
 * niet-lege array levert nooit `undefined` (de fallback vangt uitsluitend het theoretische
 * lege-array-geval, dat `split` in de praktijk nooit oplevert). Een puntloze naam geeft dus de
 * HELE naam terug (lowercased). Dat is hier onschadelijk: de enige productie-afnemer
 * (`readFormatForFile`) zoekt het resultaat op in `READ_FORMATS`' extensielijsten (`ifc`/`csv`/
 * `xml`/`mpp`) en valt bij géén match terug op `IFC_FORMAT` — een volledige bestandsnaam als
 * `'test'` matcht daar toch nooit iets, dus de terugval-uitkomst is identiek aan wat `''` zou
 * geven.
 */
export function extensionOf(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

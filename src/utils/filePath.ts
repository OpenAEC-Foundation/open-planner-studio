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

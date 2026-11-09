// #804 fase 1a: een document met een vreemd deel (gebouwmodel of gegevens van andere programma's) mag nog niet naar IFC
// geschreven worden. De writer bewaart dat deel pas in fase 1b; opslaan gaat er in fase 1c weer aan. Tot dan weigeren
// Opslaan, Opslaan als, de IFC-export, de AutoSave naar het bestand, MCP-opslaan en `devBridge.saveToPath`, met één
// melding via het meldingenkanaal. Crashherstel naar de herstelopslag gaat wel door, zonder bronbytes.
import { hasForeignContent, type IfcSource } from '@/services/ifc/foreign/ifcSource';
import { refusalNotice } from './refusalNotice';
import type { NotifyInput } from './slices/types';

/** De melding bij een geweigerde opslag: een weigering (eigenaarsbesluit 2026-10-17: rood, blijft staan tot het
 *  kruisje). Een herhaling telt op in dezelfde melding. */
export const IFC_FOREIGN_SAVE_BLOCKED_NOTICE: NotifyInput = refusalNotice({
  messageKey: 'notifications.ifcForeignSaveBlocked',
  dedupeKey: 'ifc-foreign-save-blocked',
});

/** Weigert de app IFC-uitvoer van dit document (fase 1a)? Alleen met een `ifcSource` met een vreemd deel. */
export function ifcSaveBlocked(s: { readonly ifcSource: IfcSource | null }): boolean {
  return hasForeignContent(s.ifcSource);
}

/** Het opslagdoel dat het herstelmanifest bewaart (§4.14). De herstelsnapshot heeft geen bronbytes; met een vreemd deel
 *  zou Ctrl+S na herstel het modelbestand overschrijven met alleen planning. Dan geen doel: opslaan wordt opslaan als.
 *  Zonder vreemd deel precies zoals vóór #804. */
export function recoverySaveTarget(p: {
  readonly ifcSource: IfcSource | null;
  readonly filePath: string | null;
  readonly siteFileId: string | null;
  readonly siteFileVersion: string | null;
}): { filePath: string | null; siteFileId: string | null; siteFileVersion: string | null } {
  if (ifcSaveBlocked(p)) return { filePath: null, siteFileId: null, siteFileVersion: null };
  return { filePath: p.filePath, siteFileId: p.siteFileId, siteFileVersion: p.siteFileId ? p.siteFileVersion : null };
}

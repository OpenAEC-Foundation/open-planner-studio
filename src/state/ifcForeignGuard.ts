// #804 fase 1a: een document met een vreemd deel (gebouwmodel of gegevens van andere programma's) mag nog niet naar IFC
// geschreven worden. De writer bewaart dat deel pas in fase 1b; opslaan gaat er in fase 1c weer aan. Tot dan weigeren
// Opslaan, Opslaan als, de IFC-export, de AutoSave naar het bestand, MCP-opslaan en `devBridge.saveToPath`, met één
// melding via het meldingenkanaal. Crashherstel naar de herstelopslag gaat wel door, zonder bronbytes.
import { hasForeignContent, type IfcSource } from '@/services/ifc/foreign/ifcSource';
import type { ForeignSourceMark } from '@/services/ifc/foreign/foreignSourceMark';
import { isForeignSourceTarget, targetRefusal, type TargetReaders } from '@/services/fileAccess/foreignSourceTarget';
import { ifcForeignContentEnabled, type FeatureFlagValues } from '@/utils/featureFlags';
import type { FileIdentityFs } from '@/services/fileAccess/fileIdentity';
import type { FileRef } from '@/services/fileAccess';
import type { DocumentPayload } from './documentContract';
import { refusalNotice } from './refusalNotice';
import type { NotifyInput } from './slices/types';

/** De melding bij een geweigerde opslag: een weigering (eigenaarsbesluit 2026-10-17: rood, blijft staan tot het
 *  kruisje). Een herhaling telt op in dezelfde melding. */
export const IFC_FOREIGN_SAVE_BLOCKED_NOTICE: NotifyInput = refusalNotice({
  messageKey: 'notifications.ifcForeignSaveBlocked',
  dedupeKey: 'ifc-foreign-save-blocked',
});

/** Weigert de app IFC-uitvoer van dit document (fase 1a)? Met een `ifcSource` met een vreemd deel, en na crashherstel
 *  van zo'n document zolang de bronbytes ontbreken (#886 fixronde 2, besluit Trias 11 november 2026; ook met de flag
 *  uit: de veilige kant). */
export function ifcSaveBlocked(s: {
  readonly ifcSource: IfcSource | null;
  readonly foreignSourceMark: ForeignSourceMark | null;
}): boolean {
  return hasForeignContent(s.ifcSource) || s.foreignSourceMark?.sourceMissing === true;
}

/** Het opslagdoel dat het herstelmanifest bewaart (§4.14). De herstelsnapshot heeft geen bronbytes; met een vreemd deel
 *  zou Ctrl+S na herstel het modelbestand overschrijven met alleen planning. Dan geen doel: opslaan wordt opslaan als.
 *  Zonder vreemd deel precies zoals vóór #804. */
export function recoverySaveTarget(p: {
  readonly ifcSource: IfcSource | null;
  readonly foreignSourceMark: ForeignSourceMark | null;
  readonly filePath: string | null;
  readonly siteFileId: string | null;
  readonly siteFileVersion: string | null;
}): { filePath: string | null; siteFileId: string | null; siteFileVersion: string | null } {
  if (ifcSaveBlocked(p)) return { filePath: null, siteFileId: null, siteFileVersion: null };
  return { filePath: p.filePath, siteFileId: p.siteFileId, siteFileVersion: p.siteFileId ? p.siteFileVersion : null };
}

// Fixronde 1 (BLOKKEERT 2 en 3): het gekozen doel van Opslaan als, Opslaan of een export is het bronbestand van een open
// document met een vreemd deel. Dan schreef de app alleen planning (of CSV, XML, ...) over het modelbestand. Deze
// weigering blijft ook na fase 1c bestaan: dan bewaart Opslaan het vreemde deel wel, maar alleen in het eigen document.

/** De weigering bij Opslaan en Opslaan als: "Kies een ander bestand om op te slaan." */
export const IFC_FOREIGN_TARGET_SAVE_NOTICE: NotifyInput = refusalNotice({
  messageKey: 'notifications.ifcForeignTargetSave',
  dedupeKey: 'ifc-foreign-target-save',
});

/** De weigering bij een export: "Kies een ander bestand om naar te exporteren." */
export const IFC_FOREIGN_TARGET_EXPORT_NOTICE: NotifyInput = refusalNotice({
  messageKey: 'notifications.ifcForeignTargetExport',
  dedupeKey: 'ifc-foreign-target-export',
});

/** De weigering van AutoSave (fixronde 2): "Automatisch opslaan is gestopt: … Kies een ander bestand om op te slaan."
 *  AutoSave toont hem één keer per document per sessie (`fileAutoSave.ts`). */
export const IFC_FOREIGN_TARGET_AUTOSAVE_NOTICE: NotifyInput = refusalNotice({
  messageKey: 'notifications.ifcForeignTargetAutoSave',
  dedupeKey: 'ifc-foreign-target-autosave',
});

// Review van #870 (besluit Trias, wrakko 10 november 2026): een bestaand STEP-doel waarin de grammatica van ISO 10303-21
// geen datasectie vindt (`targetRefusal` 'unreadable'). De app kan niet zien of er een model in staat, dus schrijft hij
// er niet over. Dezelfde drie routes als hierboven.
export const IFC_UNREADABLE_TARGET_SAVE_NOTICE: NotifyInput = refusalNotice({
  messageKey: 'notifications.ifcUnreadableTargetSave',
  dedupeKey: 'ifc-unreadable-target-save',
});
export const IFC_UNREADABLE_TARGET_EXPORT_NOTICE: NotifyInput = refusalNotice({
  messageKey: 'notifications.ifcUnreadableTargetExport',
  dedupeKey: 'ifc-unreadable-target-export',
});
export const IFC_UNREADABLE_TARGET_AUTOSAVE_NOTICE: NotifyInput = refusalNotice({
  messageKey: 'notifications.ifcUnreadableTargetAutoSave',
  dedupeKey: 'ifc-unreadable-target-autosave',
});

/** De kenmerken van alle open documenten die uit een bestand met een vreemd deel kwamen (ook na crashherstel). */
export function openForeignSourceMarks(s: {
  getOpenDocumentPayloads(): readonly { readonly payload: Pick<DocumentPayload, 'foreignSourceMark'> }[];
}): ForeignSourceMark[] {
  const out: ForeignSourceMark[] = [];
  for (const { payload } of s.getOpenDocumentPayloads()) if (payload.foreignSourceMark) out.push(payload.foreignSourceMark);
  return out;
}

/**
 * Is `target` het bronbestand van een open document met een vreemd deel? Zonder zo'n document (het gewone geval) geen
 * werk: geen bestandsidentiteit, geen lezen van het doel.
 */
export async function isOpenForeignSourceTarget(
  s: Parameters<typeof openForeignSourceMarks>[0],
  target: FileRef,
  identityFs: () => Promise<FileIdentityFs | undefined>,
): Promise<boolean> {
  const marks = openForeignSourceMarks(s);
  if (marks.length === 0) return false;
  let fs: FileIdentityFs | undefined;
  try {
    fs = target.kind === 'path' ? await identityFs() : undefined;
  } catch {
    fs = undefined;
  }
  return isForeignSourceTarget(target, marks, fs ? { identityFs: fs } : {});
}

/** Wat de doelcontrole nodig heeft: de open documenten en de flag. */
export interface WriteTargetState {
  getOpenDocumentPayloads(): readonly { readonly payload: Pick<DocumentPayload, 'foreignSourceMark'> }[];
  readonly ui: { readonly featureFlags: Readonly<FeatureFlagValues> };
}

/** De naden van de doelcontrole: bestandsidentiteit en de lezers van een bestaand doel, per platform. */
export interface WriteTargetDeps {
  /** Headless heeft geen UI-flag: bescherm bestaande doelen daar altijd (besluit T3). */
  protectExistingTargets?: boolean;
  identityFs: () => Promise<FileIdentityFs | undefined>;
  readers: () => TargetReaders;
}

/**
 * De doelcontrole van elke schrijfroute (Opslaan, Opslaan als, export, AutoSave, dev-bridge, MCP-export), vlak vóór het
 * schrijven. Weigert:
 *  1. het bronbestand van een open document met een vreemd deel (fixronde 1: handle, pad of bestandsidentiteit,
 *     site-id; na herstel of uit een MCP-backup ook dezelfde lengte en SHA-256 als die bron);
 *  2. met de flag `ifcForeignContent` aan: een bestaand doel dat zelf een gebouwmodel bevat (fixronde 2, besluit Trias,
 *     wrakko 9 november 2026; `targetRefusal`), of een STEP-doel waarin de grammatica geen datasectie vindt
 *     ('unreadable-target', review van #870). Een doel dat de app niet kan openen of lezen (download, nieuw pad) mag. Met
 *     de flag uit blijft dit weg, zodat de app byte-gelijk aan main blijft.
 * Meldt niets: de aanroeper kiest de melding. Geeft de reden van de weigering, of `null` als het schrijven mag.
 */
export async function refusedWriteTarget(
  s: WriteTargetState,
  target: FileRef,
  deps: WriteTargetDeps,
): Promise<'open-source' | 'building-model' | 'foreign-content' | 'unreadable-target' | null> {
  if (await isOpenForeignSourceTarget(s, target, deps.identityFs)) return 'open-source';
  if (!deps.protectExistingTargets && !ifcForeignContentEnabled(s.ui.featureFlags)) return null;
  const refusal = await targetRefusal(target, deps.readers());
  return refusal === 'model' ? 'building-model' : refusal === 'foreign' ? 'foreign-content'
    : refusal === 'unreadable' ? 'unreadable-target' : null;
}

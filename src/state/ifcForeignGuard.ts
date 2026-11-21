// #804 fase 1c: de documentroutes schrijven een voorbereide merge naar nieuwe lokale doelen,
// browserdownloads en siteversies met een verplichte basisversie. Ook IFC-export en app-MCP schrijven volledig
// naar nieuwe doelen, zonder documentcommit. Automatisch opslaan schrijft met de flag aan een document met een
// gebouwmodel naar zijn eigen bestand, via de vervanging van Ctrl+S (#804 stap 8, `fileAutoSave.ts`). De andere
// IFC-routes houden de strikte opslagblokkade, en Automatisch opslaan ook met de flag uit. Ontbrekende bronbytes
// blokkeren IFC-opslag, ook met de flag uit. Met de flag aan schrijven alleen na de vraag "alleen de planning"
// planning zonder model naar een ander doel: Opslaan als bij een ontbrekende bron (PR 9e), en Exporteren → IFC
// zonder gebouwmodel en de export met bibliotheek (PR 13).
// Crashherstel naar de herstelopslag gaat wel door, zonder bronbytes.
import { hasForeignContent, type IfcSource } from '@/services/ifc/foreign/ifcSource';
import type { ForeignSourceMark } from '@/services/ifc/foreign/foreignSourceMark';
import { isForeignSourceTarget, sameEntry, sameLocalFile, samePath, targetRefusal, type TargetReaders } from '@/services/fileAccess/foreignSourceTarget';
import { ifcForeignContentEnabled, type FeatureFlagValues } from '@/utils/featureFlags';
import { missingTarget, type FileIdentityFs } from '@/services/fileAccess/fileIdentity';
import type { FileRef, PickedSaveTarget } from '@/services/fileAccess';
import { ByteWriteError } from '@/services/fileAccess/byteWrite';
import type { DocumentPayload } from './documentContract';
import { refusalNotice } from './refusalNotice';
import type { NotifyInput } from './slices/types';

/** De melding bij een geweigerde opslag: een weigering (eigenaarsbesluit 2026-10-17: rood, blijft staan tot het
 *  kruisje). Een herhaling telt op in dezelfde melding. */
export const IFC_FOREIGN_SAVE_BLOCKED_NOTICE: NotifyInput = refusalNotice({
  messageKey: 'notifications.ifcForeignSaveBlocked',
  dedupeKey: 'ifc-foreign-save-blocked',
});

/** De bron ontbreekt na crashherstel; het kenmerk kan ook uit een planningsbackup komen. */
export function ifcWriteBlockedNotice(s: Parameters<typeof ifcSaveBlocked>[0]): NotifyInput {
  return s.foreignSourceMark?.sourceMissing
    ? refusalNotice({ messageKey: 'notifications.ifcForeignSourceMissing', dedupeKey: 'ifc-foreign-source-missing' })
    : IFC_FOREIGN_SAVE_BLOCKED_NOTICE;
}

/** Weigert de app IFC-uitvoer van dit document (fase 1a)? Met een `ifcSource` met een vreemd deel, en na crashherstel
 *  van zo'n document zolang de bronbytes ontbreken (#886 fixronde 2, besluit Trias 11 november 2026; ook met de flag
 *  uit: de veilige kant). */
export function ifcSaveBlocked(s: {
  readonly ifcSource: IfcSource | null;
  readonly foreignSourceMark: ForeignSourceMark | null;
}): boolean {
  return hasForeignContent(s.ifcSource) || s.foreignSourceMark?.sourceMissing === true;
}

/** Documentopslag en IFC-export (ook de export met bibliotheek) gaan met de flag aan door de bewaakte voorbereiding.
 * Automatisch opslaan gebruikt deze toets sinds #804 stap 8 ook (`fileAutoSave.ts`). Paneel, hersteldoel en de
 * dev-bridge houden de strikte `ifcSaveBlocked` hierboven. */
export function ifcFullWriteBlocked(s: Parameters<typeof ifcSaveBlocked>[0] & {
  readonly ui: { readonly featureFlags: Readonly<FeatureFlagValues> };
}): boolean {
  return s.foreignSourceMark?.sourceMissing === true
    || (hasForeignContent(s.ifcSource) && !ifcForeignContentEnabled(s.ui.featureFlags));
}

/** Was knownbug 1897 (fixronde 1 van #1071): *Opslaan als* van een document met een vreemd deel koos zijn eigen bronbestand.
 *  "Gebruik Opslaan om het bij te werken, of Opslaan als met een nieuwe naam voor een kopie." */
export const IFC_FOREIGN_REPLACE_BLOCKED_NOTICE: NotifyInput = refusalNotice({
  messageKey: 'notifications.ifcForeignReplaceBlocked', dedupeKey: 'ifc-foreign-replace-blocked',
});
// Knownbug 1131 stap 2: Ctrl+S op het eigen bestand achter een handle. Staat daar niet meer precies de bron, of kan het
// crashherstel de komende versie niet vastleggen, dan schrijft de app niet.
export const IFC_FOREIGN_TARGET_CHANGED_NOTICE: NotifyInput = refusalNotice({
  messageKey: 'notifications.ifcForeignTargetChanged', dedupeKey: 'ifc-foreign-target-changed',
});
export const IFC_FOREIGN_TARGET_GONE_NOTICE: NotifyInput = refusalNotice({
  messageKey: 'notifications.ifcForeignTargetGone', dedupeKey: 'ifc-foreign-target-gone',
});
export const IFC_FOREIGN_REPLACE_NOT_RECORDED_NOTICE: NotifyInput = refusalNotice({
  messageKey: 'notifications.ifcForeignReplaceNotRecorded', dedupeKey: 'ifc-foreign-replace-not-recorded',
});
export const IFC_FOREIGN_MERGE_REFUSED_NOTICE: NotifyInput = refusalNotice({
  messageKey: 'notifications.ifcForeignMergeRefused', dedupeKey: 'ifc-foreign-merge-refused',
});
/** #804 stap 5: de opslagworker stierf, antwoordde niet op tijd of onleesbaar (`IfcSaveWorkerError`). Een mislukte opslag
 *  of export, geen weigering: er is niets geschreven en de hoofdthread rekent niet opnieuw. */
export const IFC_SAVE_WORKER_FAILED_NOTICE: NotifyInput = {
  severity: 'error', messageKey: 'notifications.ifcSaveWorkerFailed', dedupeKey: 'ifc-save-worker-failed', replaceOnDedupe: true,
};

/** Knownbug 1768 (besluit van de eigenaar, 16 november 2026): weigert de browser de schrijftoestemming op het geopende
 *  bestand met een gebouwmodel, dan wordt Ctrl+S een download. Het document blijft gewijzigd tot het geopende bestand is
 *  bijgewerkt; dat is de bescherming. Deze melding noemt de kopie en is een gewone informatiemelding, zoals
 *  `savedViaDownload` op main: ze verdwijnt vanzelf en wijkt in de stapel voor elke nieuwe melding (review van #1002
 *  ronde 3; of ze moet blijven staan tot het kruisje is een vraag aan de eigenaar, knownbug 1843). Er is er één voor de
 *  hele app; een nieuwe kopie ververst haar en noemt dan de laatste kopie. */
export function downloadCopyNotice(file: string): NotifyInput {
  return {
    severity: 'info', messageKey: 'notifications.ifcForeignDownloadCopy', params: { file },
    dedupeKey: 'ifc-foreign-download-copy', replaceOnDedupe: true,
  };
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

/** Knownbug 1131 stap 4 (en 1760): een nieuwe naam voor een bestand met een gebouwmodel (Opslaan als, Exporteren →
 *  IFC) kon niet exclusief ontstaan, meestal omdat er al een bestand met die naam staat. Eén zin voor beide routes.
 *  Sinds stap 8 vervangt Opslaan als een bestaand gewoon bestand; daar geldt de zin nog waar die vervanging niet kan
 *  (`save-as-only`: buiten de thuismap, een link, een bestandssysteem zonder exclusieve stap). */
export const IFC_FOREIGN_NEW_TARGET_ONLY_NOTICE: NotifyInput = refusalNotice({
  messageKey: 'notifications.ifcForeignNewTargetOnly',
  dedupeKey: 'ifc-foreign-new-target-only',
});

/** Knownbug 1131 stap 4: `place_file_exclusive` meldde `source-changed`. De stand op schijf is onbekend; de app zette
 *  niets terug en ruimde niets op. Een echte fout, geen weigering: hij blijft ook na een documentwissel staan. */
export const IFC_FOREIGN_PLACE_UNKNOWN_NOTICE: NotifyInput = {
  severity: 'error',
  messageKey: 'notifications.ifcForeignPlaceUnknown',
  dedupeKey: 'ifc-foreign-place-unknown',
};

/** De melding bij een fout van de exclusieve byte-ingang naar een nieuwe naam; `null` voor een gewone schrijffout. */
export function newTargetWriteNotice(error: unknown): NotifyInput | null {
  if (!(error instanceof ByteWriteError)) return null;
  if (error.reason === 'create-new') return IFC_FOREIGN_NEW_TARGET_ONLY_NOTICE;
  if (error.reason === 'source-changed') return IFC_FOREIGN_PLACE_UNKNOWN_NOTICE;
  return null;
}

/** De weigering bij Opslaan en Opslaan als: "Kies een ander bestand om op te slaan." */
export const IFC_FOREIGN_TARGET_SAVE_NOTICE: NotifyInput = refusalNotice({
  messageKey: 'notifications.ifcForeignTargetSave',
  dedupeKey: 'ifc-foreign-target-save',
});

/** Fixronde 1 van #1019: Opslaan als over een bestaande naam koos een bestand dat in een ander tabblad open staat. */
export const IFC_FOREIGN_TARGET_OPEN_IN_TAB_NOTICE: NotifyInput = refusalNotice({
  messageKey: 'notifications.ifcForeignTargetOpenInTab',
  dedupeKey: 'ifc-foreign-target-open-in-tab',
});

/** Knownbug 1907: Exporteren koos een bestand dat in een ander tabblad open staat. */
export const EXPORT_TARGET_OPEN_IN_TAB_NOTICE: NotifyInput = refusalNotice({
  messageKey: 'notifications.exportTargetOpenInTab',
  dedupeKey: 'export-target-open-in-tab',
});

/** Review van #1064: een uitvoer zonder de planning (bibliotheek, rapport) koos een bestand dat in een tabblad open
 *  staat, ook het actieve. */
export const EXPORT_TARGET_OPEN_DOCUMENT_NOTICE: NotifyInput = refusalNotice({
  messageKey: 'notifications.exportTargetOpenDocument',
  dedupeKey: 'export-target-open-document',
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

/** Is het bestaande bestand op `path` het bestand van een open document (niet `exceptDocumentId`), ook een gewone
 *  planning zonder vreemd deel (die heeft geen bronkenmerk)? Dezelfde padvergelijking als de bronkenmerken
 *  (`sameLocalFile`: hetzelfde pad of dezelfde bestandsidentiteit, dus ook via een link). Staat er op `path` geen bestand
 *  meer (buiten de app verwijderd), dan is de naam vrij, ook als een ander tabblad hem nog onthoudt (fixronde 2 van
 *  #1019). */
async function isOpenDocumentPath(
  s: Pick<WriteTargetState, 'getOpenDocumentPayloads'>, path: string, identityFs: () => Promise<FileIdentityFs | undefined>,
  exceptDocumentId: string | null,
): Promise<boolean> {
  return (await openDocumentIdForPath(s, path, identityFs, exceptDocumentId)) !== null;
}

/** Het id van het open document (niet `exceptDocumentId`) dat het bestaande bestand op `path` als bestand heeft, of
 *  `null`. De vergelijking van `isOpenDocumentPath`; ook voor een bestand dat bij het starten is meegegeven (#1091):
 *  staat het al open, dan wisselt de app naar dat tabblad. */
export async function openDocumentIdForPath(
  s: Pick<WriteTargetState, 'getOpenDocumentPayloads'>, path: string, identityFs: () => Promise<FileIdentityFs | undefined>,
  exceptDocumentId: string | null = null,
): Promise<string | null> {
  const docs = openFileDocuments(s, exceptDocumentId);
  if (docs.length === 0) return null;
  let fs: FileIdentityFs | undefined;
  try { fs = await identityFs(); } catch { fs = undefined; }
  if (fs && await missingFile(fs, path)) return null;
  for (const doc of docs) if (await sameLocalFile(path, doc.path, fs ? { identityFs: fs } : {})) return doc.id;
  return null;
}

/** Synchroon, alleen op de padtekst (`samePath`): het open document met dit pad, of `null`. Voor een controle in
 *  dezelfde stap als het activeren, waar geen `stat` tussen past (#1091). */
export function openDocumentIdForPathText(s: Pick<WriteTargetState, 'getOpenDocumentPayloads'>, path: string): string | null {
  return openFileDocuments(s, null).find((doc) => samePath(path, doc.path))?.id ?? null;
}

/** De open documenten met een lokaal pad als bestand (geen handle, geen site). */
function openFileDocuments(s: Pick<WriteTargetState, 'getOpenDocumentPayloads'>, exceptDocumentId: string | null): { id: string; path: string }[] {
  return s.getOpenDocumentPayloads().flatMap(({ id, payload }) => (
    id !== exceptDocumentId && payload.filePath && !payload.fileHandle && !payload.siteFileId ? [{ id, path: payload.filePath }] : []));
}

/** Staat er aantoonbaar niets op `path`? Een andere fout van `stat` telt als nee: de veilige kant. */
async function missingFile(fs: FileIdentityFs, path: string): Promise<boolean> {
  try { await fs.stat(path); return false; } catch (error) { return missingTarget(error); }
}

/** De open documenten zonder het document met deze id (`null`: alle). */
function allBut(s: Pick<WriteTargetState, 'getOpenDocumentPayloads'>, documentId: string | null): Pick<WriteTargetState, 'getOpenDocumentPayloads'> {
  return documentId === null ? s : { getOpenDocumentPayloads: () => s.getOpenDocumentPayloads().filter(d => d.id !== documentId) };
}

/** Het eigen lokale bestand van een document (zie de uitzondering "eigen doel" bij `refusedWriteTarget`). */
async function isOwnLocalFile(
  own: Pick<DocumentPayload, 'foreignSourceMark' | 'fileHandle' | 'filePath'>, target: FileRef,
): Promise<boolean> {
  const mark = own.foreignSourceMark!;
  if (target.kind === 'handle') {
    return !!own.fileHandle && !!mark.handle && await sameEntry(own.fileHandle, target.handle)
      && await sameEntry(mark.handle, target.handle);
  }
  return target.kind === 'path' && !own.fileHandle && own.filePath === target.path && mark.filePath === target.path;
}

/** Wat de doelcontrole nodig heeft: de open documenten en de flag. */
export interface WriteTargetState {
  getOpenDocumentPayloads(): readonly { readonly id: string; readonly payload: Pick<DocumentPayload,
    'foreignSourceMark' | 'ifcSource' | 'siteFileId' | 'siteFileVersion' | 'fileHandle' | 'filePath'> }[];
  readonly ui: { readonly featureFlags: Readonly<FeatureFlagValues> };
}

/** De naden van de doelcontrole: bestandsidentiteit en de lezers van een bestaand doel, per platform. */
export interface WriteTargetDeps {
  /** Headless heeft geen UI-flag: bescherm bestaande doelen daar altijd (besluit T3). */
  protectExistingTargets?: boolean;
  identityFs: () => Promise<FileIdentityFs | undefined>;
  readers: () => TargetReaders;
  /** Weiger ook een bestaand pad dat een open document als bestand heeft, ook zonder vreemd deel (`'open-document'`),
   *  behalve het document met deze id: het document dat opslaat of waarvan de planning in de uitvoer staat. `null`: geen
   *  uitzondering, voor uitvoer zonder de planning (bibliotheek, rapport; review van #1064). Voor de bestandskiezer van
   *  een document (Opslaan als, #1022), de vervanging bij Opslaan als over een bestaande naam (#804 keuze 4, fixronde 1
   *  van #1019), elke export en `planner_export_ifc` (knownbug 1907). */
  openDocumentsExcept?: string | null;
  /** #804 keuze 4 (besluit van de eigenaar, 19 november 2026): de doelwaarneming van de bestandskiezer van *Opslaan als*
   *  op de desktop (ook die van Ctrl+S bij een document zonder opslagdoel, fixronde 1 van #1071): het gekozen pad en wat
   *  de kiezer daar direct na zijn terugkeer las (`pickSaveTarget`). De planner bevestigde in de kiezer het vervangen;
   *  staat er op dit pad een gewoon bestand dat de kiezer las, dan weigert regel 2 daar geen gebouwmodel en geen
   *  gegevens van een ander programma. De schrijfroute vervangt daarna alleen die gelezen versie (`replaceOwnFileBytes`,
   *  fixronde 2 van #1071). Elke andere route (Ctrl+S met een opslagdoel, export, AutoSave, MCP, dev-bridge) geeft dit
   *  niet. Regel 1 en 3 en een onleesbaar doel blijven weigeren. */
  chosenTarget?: PickedSaveTarget;
}

/**
 * De doelcontrole van elke schrijfroute (Opslaan, Opslaan als, export, AutoSave, dev-bridge, MCP-export), vlak vóór het
 * schrijven. Weigert:
 *  1. het bronbestand van een open document met een vreemd deel (fixronde 1: handle, pad of bestandsidentiteit,
 *     site-id; na herstel of uit een MCP-backup ook dezelfde lengte en SHA-256 als die bron);
 *  2. met de flag `ifcForeignContent` aan: een bestaand doel dat zelf een gebouwmodel of C/A/V-inhoud bevat (besluit Trias,
 *     wrakko 9 november 2026; `targetRefusal`), of een STEP-doel waarin de grammatica geen datasectie vindt
 *     ('unreadable-target', review van #870). Onleesbare bestaande doelen weigeren; bewezen nieuwe doelen mogen. Met
 *     de flag uit blijft dit weg, zodat de app byte-gelijk aan main blijft.
 *  3. alleen met `deps.openDocumentsExcept` (Opslaan als, Exporteren): een bestaand pad dat een ander open document als
 *     bestand heeft, ook zonder vreemd deel en ook met de flag uit ('open-document'; #1022, knownbug 1907). Na regel 1,
 *     dus de bron van een document met een vreemd deel houdt haar eigen reden.
 * Met `deps.chosenTarget` (alleen de bestandskiezer van Opslaan als op de desktop, #804 keuze 4) vervalt van regel 2
 * voor het gekozen pad met een gelezen gewoon bestand alleen de weigering op inhoud ('building-model',
 * 'foreign-content'); 'unreadable-target' blijft.
 * Met de flag aan en `deps.openDocumentsExcept` gaat regel 3 vóór regel 1 en geldt ze ook voor de bron van een ander
 * open document (fixronde 1 van #1071): 'open-document' noemt het open tabblad; 'open-source' is dan de bron van het
 * document zelf. Met de flag uit blijft de volgorde van main (fixronde 2 van #1071).
 * Uitzondering "eigen doel" (`ownVersion`): alleen een volledige documentmerge naar het eigen bestand van het eigen
 * document, met de flag aan, zonder "bron ontbreekt" en met een kenmerk dat bij de bron hoort.
 *  - site: de eigen siteversie met de basisversie van het document; de host bewaakt die basis;
 *  - handle (knownbug 1131 stap 2): dezelfde handle als het document en zijn kenmerk (`isSameEntry`). Of op dat bestand
 *    nog de bron staat, toetst de aanroeper (`sourceTargetContent`, vóór de merge en vlak vóór `close()`);
 *  - pad (desktop, knownbug 1131 stap 5b): precies het pad van het document en van zijn kenmerk, zonder handle. Of op dat
 *    bestand nog de bron staat, toetst de vervanging zelf (`replaceOwnPathWithRecovery`, stap 2 en 5).
 * Een ander open document met hetzelfde bestand als bron blijft in beide gevallen geweigerd.
 * Meldt niets: de aanroeper kiest de melding. Geeft de reden van de weigering, of `null` als het schrijven mag.
 */
export async function refusedWriteTarget(
  s: WriteTargetState,
  target: FileRef,
  deps: WriteTargetDeps,
  ownVersion?: { readonly documentId: string; readonly baseVersion?: string | null; readonly source: IfcSource },
): Promise<'open-source' | 'open-document' | 'building-model' | 'foreign-content' | 'unreadable-target' | null> {
  const own = ownVersion && s.getOpenDocumentPayloads().find(d => d.id === ownVersion.documentId)?.payload;
  const ownSource = !!own && own.ifcSource === ownVersion.source && hasForeignContent(own.ifcSource)
    && ifcForeignContentEnabled(s.ui.featureFlags)
    && !!own.foreignSourceMark && !own.foreignSourceMark.sourceMissing
    && own.foreignSourceMark.sha256 === ownVersion.source.sha256;
  const isOwnVersion = ownSource && target.kind === 'site' && own.siteFileId === target.id
    && !!ownVersion.baseVersion && own.siteFileVersion === ownVersion.baseVersion
    && own.foreignSourceMark!.siteFileId === target.id;
  if (ownSource && !own.siteFileId && await isOwnLocalFile(own, target)) {
    return await isOpenForeignSourceTarget(allBut(s, ownVersion.documentId), target, deps.identityFs) ? 'open-document' : null;
  }
  // Fixronde 1 van #1071, alleen met de flag aan (fixronde 2): het open tabblad gaat voor. Is het doel het bestand of de
  // bron van een ANDER open document, dan is de reden 'open-document', ook als dat document een gebouwmodel heeft;
  // 'open-source' blijft over voor de bron van het document zelf (en voor routes die niet zeggen welk document schrijft).
  const flagOn = ifcForeignContentEnabled(s.ui.featureFlags);
  if (flagOn && deps.openDocumentsExcept !== undefined && target.kind !== 'site') {
    if (target.kind === 'path' && await isOpenDocumentPath(s, target.path, deps.identityFs, deps.openDocumentsExcept)) {
      return 'open-document';
    }
    if (await isOpenForeignSourceTarget(allBut(s, deps.openDocumentsExcept), target, deps.identityFs)) return 'open-document';
  }
  const openSource = await isOpenForeignSourceTarget(s, target, deps.identityFs);
  if (openSource && !isOwnVersion) return 'open-source';
  if (isOwnVersion) return null;
  // Met de flag uit regel 3 hier, na regel 1, zoals main.
  if (!flagOn && deps.openDocumentsExcept !== undefined && target.kind === 'path'
    && await isOpenDocumentPath(s, target.path, deps.identityFs, deps.openDocumentsExcept)) {
    return 'open-document';
  }
  if (!deps.protectExistingTargets && !flagOn) return null;
  const refusal = await targetRefusal(target, deps.readers());
  if (refusal === 'unreadable') return 'unreadable-target';
  if (refusal === null) return null;
  const chosen = deps.chosenTarget;
  if (target.kind === 'path' && chosen?.path === target.path && chosen.current instanceof Uint8Array) return null;
  return refusal === 'model' ? 'building-model' : 'foreign-content';
}

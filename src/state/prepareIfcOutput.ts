// Eén bewaakte voorbereiding voor documentopslag en IFC-export (#804 fase 1c).
// Geen bestandsactie of documentcommit: alleen de documentroute legt een geslaagde opslag vast.
import { plainWriteLiteralCalendarIds, writeIFCWithChoices, type WriteIFCInput } from '@/services/ifc/ifcWriter';
import { prepareIfcWrite } from '@/services/ifc/foreign/mergeWriter';
import { hasForeignContent, type IfcSource, type PreparedIfcWrite } from '@/services/ifc/foreign/ifcSource';
import { spendPlanOnlyConfirmation, type PlanOnlyConfirmation, type PlanOnlyReason } from '@/services/ifc/planOnlyQuestion';
import { ifcForeignContentEnabled } from '@/utils/featureFlags';
import { IfcSaveWorkerError } from '@/services/ifc/saveWorker/ifcSaveWorkerError';
import type { DocumentFileFormat } from './documentContract';
import { versionGuarded } from './versionGuard';
import { precomputeSha256 } from '@/services/xerSourceArchive';
import { utf8BomLength } from '@/services/ifc/foreign/stepScanner';
import type { FileData } from '@/services/fileAccess';
import type { TargetFingerprint } from './documentContract';
import { ifcFullWriteBlocked } from './ifcForeignGuard';
import type { IFCSaveSource, IFCWriteInput } from './ifcSaveInput';

export type IfcOutput =
  /** `bytes`: de UTF-8 van `content`, als het rekenen die al maakte (de opslagworker, #804 stap 4). Dezelfde tekst. */
  | { readonly content: string; readonly bytes?: Uint8Array; readonly sha256?: string; readonly literalCalendarIds: readonly string[]; readonly prepared?: never }
  | { readonly content?: never; readonly bytes?: never; readonly sha256?: never; readonly literalCalendarIds: readonly string[]; readonly prepared: PreparedIfcWrite };

/** De twee gevallen van `prepareIfcOutput` die rekenen, nadat de bewaking hieronder besliste welk. */
export type IfcSaveJob =
  | { readonly kind: 'writer'; readonly input: IFCWriteInput; readonly hashBytes?: true; readonly format?: 'ifcx' }
  | { readonly kind: 'merge'; readonly input: IFCWriteInput; readonly source: IfcSource };

/** Rekent één beslist geval. Standaard op deze thread (`computeIfcOutputHere`); de opslagworker
 *  (`services/ifc/saveWorker/ifcSaveWorker.ts`) geeft dezelfde uitkomst uit de achtergrond. `stop` (#804 stap 8, alleen
 *  Automatisch opslaan): gaat het af, dan breekt de worker dit ene verzoek af en faalt de belofte met `stop.reason`;
 *  op deze thread valt er niets af te breken en controleert de aanroeper het signaal na afloop. */
export type IfcOutputCompute = (job: IfcSaveJob, stop?: AbortSignal) => Promise<IfcOutput>;

async function writeIfcxOutput(input: WriteIFCInput): Promise<IfcOutput> {
  const { writeIfcx } = await import('@/services/ifc/ifcx');
  return { content: writeIfcx(input), literalCalendarIds: plainWriteLiteralCalendarIds(input) };
}

export async function computeIfcOutputHere(job: IfcSaveJob): Promise<IfcOutput> {
  if (job.kind === 'writer') return job.format === 'ifcx' ? writeIfcxOutput(job.input) : writeIFCWithChoices(job.input);
  const prepared = await prepareIfcWrite(job.input, job.source);
  return { prepared, literalCalendarIds: prepared.literalCalendarIds };
}

export type WrittenFingerprint = TargetFingerprint | Promise<TargetFingerprint> | null;
type FeatureFlags = Parameters<typeof ifcForeignContentEnabled>[0];

export function documentSaveCompute(
  featureFlags: FeatureFlags, worker: IfcOutputCompute | undefined, format: DocumentFileFormat,
): IfcOutputCompute {
  if (format === 'ifcx') {
    if (!worker) return () => Promise.reject(new IfcSaveWorkerError('not-started', 'IFCX rekent alleen in de opslagworker.'));
    return (job, stop) => worker(job.kind === 'writer' ? { ...job, hashBytes: true, format } : job, stop);
  }
  const compute = worker ?? computeIfcOutputHere;
  if (!ifcForeignContentEnabled(featureFlags)) return compute;
  return (job, stop) => compute(job.kind === 'writer' ? { ...job, hashBytes: true } : job, stop);
}

export function writtenFingerprint(
  featureFlags: FeatureFlags, format: DocumentFileFormat, output: IfcOutput, written?: FileData,
): WrittenFingerprint {
  if (output.prepared || !versionGuarded(featureFlags, format)) return null;
  const data = written ?? output.bytes ?? output.content;
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const byteLength = bytes.byteLength, bom = bomMark(bytes);
  const known = written === undefined || written === output.bytes ? output.sha256 : undefined;
  return known !== undefined ? { sha256: known, byteLength, origin: 'written', ...bom }
    : precomputeSha256(bytes).then((sha256): TargetFingerprint => ({ sha256, byteLength, origin: 'written', ...bom }));
}

export function bomMark(bytes: Uint8Array): { readonly utf8Bom?: true } {
  return utf8BomLength(bytes) > 0 ? { utf8Bom: true } : {};
}

const UTF8_BOM = Uint8Array.of(0xef, 0xbb, 0xbf);

export function withUtf8Bom(data: FileData): FileData {
  if (typeof data === 'string') return `\uFEFF${data}`;
  const bytes = new Uint8Array(UTF8_BOM.length + data.byteLength);
  bytes.set(UTF8_BOM);
  bytes.set(data, UTF8_BOM.length);
  return bytes;
}

export class IfcWriteBlockedError extends Error {
  readonly code = 'IFC_WRITE_BLOCKED';
  constructor() {
    super('IFC-uitvoer is geblokkeerd: bron ontbreekt, flag staat uit of alleen planning is gevraagd.');
    this.name = 'IfcWriteBlockedError';
  }
}

type GuardState = IFCSaveSource & Parameters<typeof ifcFullWriteBlocked>[0];

/** Moet deze route eerst "alleen de planning" vragen? Alleen met de flag aan. Bij een ontbrekend gebouwmodel alleen
 *  Opslaan als (besluit eigenaar, 14 november 2026); de twee exports alleen met een aanwezig gebouwmodel. */
export function planOnlyQuestionApplies(state: Parameters<typeof ifcFullWriteBlocked>[0], reason: PlanOnlyReason): boolean {
  if (!ifcForeignContentEnabled(state.ui.featureFlags)) return false;
  const missing = state.foreignSourceMark?.sourceMissing === true;
  return reason === 'missingSourceSaveAs'
    ? missing && !hasForeignContent(state.ifcSource)
    : !missing && hasForeignContent(state.ifcSource);
}

/** De modus beslist hier, vóór I/O. planOnly met een vreemd deel of een ontbrekende bron gaat alleen door met een
 *  ongebruikt ja op de vraag voor precies deze toestand; zonder dat ja blijft hij geweigerd. `compute` rekent alleen:
 *  de beslissing blijft hier, ook als de opslagworker rekent. */
export async function prepareIfcOutput(
  state: GuardState, input: IFCWriteInput, planOnly?: PlanOnlyConfirmation, compute: IfcOutputCompute = computeIfcOutputHere,
): Promise<IfcOutput> {
  if (planOnly) {
    if (!spendPlanOnlyConfirmation(planOnly) || input.writeMode !== 'planOnly'
      || !planOnlyQuestionApplies(state, planOnly.reason)) throw new IfcWriteBlockedError();
    return compute({ kind: 'writer', input });
  }
  if (ifcFullWriteBlocked(state)) throw new IfcWriteBlockedError();
  if (!hasForeignContent(state.ifcSource)) return compute({ kind: 'writer', input });
  if (input.writeMode !== 'merge') throw new IfcWriteBlockedError();
  return compute({ kind: 'merge', input, source: state.ifcSource! });
}

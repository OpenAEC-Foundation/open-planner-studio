// Eén bewaakte voorbereiding voor documentopslag en IFC-export (#804 fase 1c).
// Geen bestandsactie of documentcommit: alleen de documentroute legt een geslaagde opslag vast.
import { writeIFCWithChoices } from '@/services/ifc/ifcWriter';
import { prepareIfcWrite } from '@/services/ifc/foreign/mergeWriter';
import { hasForeignContent, type IfcSource, type PreparedIfcWrite } from '@/services/ifc/foreign/ifcSource';
import { spendPlanOnlyConfirmation, type PlanOnlyConfirmation, type PlanOnlyReason } from '@/services/ifc/planOnlyQuestion';
import { ifcForeignContentEnabled } from '@/utils/featureFlags';
import { precomputeSha256 } from '@/services/xerSourceArchive';
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
  | { readonly kind: 'writer'; readonly input: IFCWriteInput; readonly hashBytes?: true }
  | { readonly kind: 'merge'; readonly input: IFCWriteInput; readonly source: IfcSource };

/** Rekent één beslist geval. Standaard op deze thread (`computeIfcOutputHere`); de opslagworker
 *  (`services/ifc/saveWorker/ifcSaveWorker.ts`) geeft dezelfde uitkomst uit de achtergrond. `stop` (#804 stap 8, alleen
 *  Automatisch opslaan): gaat het af, dan breekt de worker dit ene verzoek af en faalt de belofte met `stop.reason`;
 *  op deze thread valt er niets af te breken en controleert de aanroeper het signaal na afloop. */
export type IfcOutputCompute = (job: IfcSaveJob, stop?: AbortSignal) => Promise<IfcOutput>;

export async function computeIfcOutputHere(job: IfcSaveJob): Promise<IfcOutput> {
  if (job.kind === 'writer') return writeIFCWithChoices(job.input);
  const prepared = await prepareIfcWrite(job.input, job.source);
  return { prepared, literalCalendarIds: prepared.literalCalendarIds };
}

export type WrittenFingerprint = TargetFingerprint | Promise<TargetFingerprint> | null;
type FeatureFlags = Parameters<typeof ifcForeignContentEnabled>[0];

export function documentSaveCompute(featureFlags: FeatureFlags, compute: IfcOutputCompute = computeIfcOutputHere): IfcOutputCompute {
  if (!ifcForeignContentEnabled(featureFlags)) return compute;
  return (job, stop) => compute(job.kind === 'writer' ? { ...job, hashBytes: true } : job, stop);
}

export function writtenFingerprint(featureFlags: FeatureFlags, output: IfcOutput, bytes: Uint8Array): WrittenFingerprint {
  if (output.prepared || !ifcForeignContentEnabled(featureFlags)) return null;
  const byteLength = bytes.byteLength;
  return output.sha256 !== undefined ? { sha256: output.sha256, byteLength }
    : precomputeSha256(bytes).then(sha256 => ({ sha256, byteLength }));
}

export function writtenData(
  featureFlags: FeatureFlags, output: Extract<IfcOutput, { readonly content: string }>,
): { readonly data: FileData; readonly fingerprint: WrittenFingerprint } {
  if (!ifcForeignContentEnabled(featureFlags)) return { data: output.bytes ?? output.content, fingerprint: null };
  const bytes = output.bytes ?? new TextEncoder().encode(output.content);
  return { data: bytes, fingerprint: writtenFingerprint(featureFlags, output, bytes) };
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

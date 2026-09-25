// Gedeelde assert voor het archief-terugvalcontract (eigenaarsbesluit 2026-09-24, "openen met
// melding"). Vroeger pinden de archieftests "readIFC GOOIT IfcParseError('xer-source-archive')";
// sinds het besluit opent het project gewoon en valt alléén het archief weg. Deze helper toetst
// dat contract in zijn geheel, zodat geen enkele case een half contract kan pinnen:
//   1. readIFC gooit NIET (het project opent);
//   2. alle archiefafgeleiden zijn weg: xerSourceArchive, xerSourceProjectId, xer, recordedTimes,
//      en de herkomst is niet meer 'xer-archive' (een eigen IFC: 'ifc-own', PR #167);
//   3. het signaal is er WEL (nooit stil): xerArchiveIssue met de verwachte code en een detail dat
//      het validatorfragment noemt.
import type { ImportResult, XerArchiveIssueCode } from '@/services/importTypes';

export interface DroppedArchiveVerdict {
  readonly ok: boolean;
  readonly why: string;
  readonly result?: ImportResult;
}

export function archiveDropped(
  read: () => ImportResult,
  expected: { code?: XerArchiveIssueCode; fragment?: string } = {},
): DroppedArchiveVerdict {
  let result: ImportResult;
  try { result = read(); } catch (error) {
    return { ok: false, why: `readIFC gooide nog: ${error instanceof Error ? error.message : String(error)}` };
  }
  // `recordedTimesOrigin` is sinds PR #167 op elk IFC gezet ('ifc-own'/'ifc'); alléén de
  // archiefherkomst 'xer-archive' is een archiefrest. Na de terugval is het een eigen IFC.
  const leftovers = [
    ...(['xerSourceArchive', 'xerSourceProjectId', 'xer', 'recordedTimes'] as const)
      .filter(key => result[key] !== undefined),
    ...(result.recordedTimesOrigin === 'xer-archive' ? ['recordedTimesOrigin'] : []),
  ];
  if (leftovers.length > 0) return { ok: false, why: `archiefresten bleven staan: ${leftovers.join(', ')}`, result };
  const issue = result.xerArchiveIssue;
  if (!issue) return { ok: false, why: 'stille terugval: geen xerArchiveIssue', result };
  if (expected.code && issue.code !== expected.code) {
    return { ok: false, why: `code ${issue.code} i.p.v. ${expected.code} (${issue.detail})`, result };
  }
  if (expected.fragment && !issue.detail.includes(expected.fragment)) {
    return { ok: false, why: `detail mist '${expected.fragment}': ${issue.detail}`, result };
  }
  return { ok: true, why: '', result };
}

// Eigenaarsbesluit 2026-09-24 ("openen met melding") — de keten ná de lezer. `check-ifc-xer-archive-
// container`/`-readmodel`/`-compact` pinnen per foutcode dat `readIFC` het archief laat vallen mét
// `xerArchiveIssue`; deze check bewijst wat de gebruiker daarvan merkt, op een ECHT beschadigd
// bestand (`fixtures/xer-archief-herschreven.ifc`: een OPS-IFC met XER-archief waarvan een
// herschrijvend IFC-programma de bronchunks liet vallen — manifest en selector bleven staan):
//   A. de productie-ingang (`readIFCWithXerReconstruction`) opent het, zonder archief, mét signaal;
//   B. `applyOpenedImport` publiceert het project volledig en geeft precies ÉÉN melding (K8a-kanaal)
//      met reden + gevolg + "Lees meer"-link naar de XER-gids;
//   C. het signaal overleeft een documentwissel (DOCUMENT_FIELDS) en een documentkopie;
//   D. het signaal round-tript NIET door IFC (sessie-only) en een opgeslagen bestand draagt geen
//      archiefsporen meer — heropenen is dus stil én correct;
//   E. crashherstel (`restoreDocuments`) meldt het ook, één keer per batch;
//   F. een bestaande bestandsmelding krijgt de archiefregels als detail in plaats van een tweede toast.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readIFCWithXerReconstruction } from '@/services/formatRegistry';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { useAppStore } from '@/state/appStore';
import { recoveryInputFromParsed } from '@/state/documentContract';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import {
  XER_ARCHIVE_REASON_KEYS, XER_IMPORT_HELP_ARTICLE_ID, withXerArchiveIssueNotice,
} from '@/state/xerArchiveIssueNotice';
import { XER_ARCHIVE_ISSUE_CODES } from '@/services/importTypes';
import type { AppNotification } from '@/state/slices/types';
import { archiveDropped } from './xerArchiveFallbackAssert';

declare const process: { exit(code: number): never };
const failures: string[] = [];
let checks = 0;
const expect = (label: string, condition: boolean, extra = '') => {
  checks += 1;
  if (!condition) failures.push(extra ? `${label} — ${extra}` : label);
};
const store = () => useAppStore.getState();
/** Meldingenstapel leeg (max 3 zichtbaar + dedupe zouden een "voor/na"-telling vertekenen). */
const clearNotes = () => useAppStore.setState((s) => { s.ui.notifications = []; });
const HERE = dirname(fileURLToPath(import.meta.url));
const damaged = readFileSync(join(HERE, 'fixtures', 'xer-archief-herschreven.ifc'), 'utf8');

// ── A. productie-ingang ────────────────────────────────────────────────────────────────────────
const parsed = await readIFCWithXerReconstruction(damaged);
const verdict = archiveDropped(() => parsed, { code: 'bytes-missing', fragment: 'geen enkele' });
expect('A1 echt herschreven bestand opent via de productie-ingang: archief weg, signaal bytes-missing',
  verdict.ok, verdict.why);
expect('A2 het project zelf is volledig: beide taken en de relatie uit het IFC',
  parsed.tasks.map(task => task.name).sort().join('|') === 'Fundering|Ruwbouw' && parsed.sequences.length === 1,
  `${parsed.tasks.length} taken, ${parsed.sequences.length} relaties`);

// ── B. openen via de store: één melding ─────────────────────────────────────────────────────────
store().newProject();
clearNotes();
store().applyOpenedImport(parsed, {
  filePath: '/tmp/xer-archief-herschreven.ifc', recompute: true, fit: false, hourDataNotice: false, linkedOpen: true,
});
const openedDocId = store().activeDocumentId;
const newNotes: AppNotification[] = store().ui.notifications;
const archiveNotes = newNotes.filter(note => note.messageKey === 'notifications.xerArchiveUnusable');
expect('B1 precies één archiefmelding na openen', archiveNotes.length === 1,
  newNotes.map(note => note.messageKey).join(', '));
const note = archiveNotes[0];
expect('B2 melding noemt reden (bytes-missing) én gevolg, en linkt naar de XER-gids',
  !!note
  && note.detailLines?.some(line => line.messageKey === XER_ARCHIVE_REASON_KEYS['bytes-missing']) === true
  && note.detailLines?.some(line => line.messageKey === 'notifications.xerArchiveUnusableConsequence') === true
  && note.helpArticleId === XER_IMPORT_HELP_ARTICLE_ID
  && note.severity === 'info');
expect('B3 store: project geladen, archiefvelden leeg, issue gezet',
  store().tasks.length === 2 && store().xerSourceArchive === null && store().xerSourceProjectId === null
  && store().xerImportMetadata === null && store().xerArchiveIssue?.code === 'bytes-missing');
expect('B4 geen "datums zoals opgeslagen" uit een weggelaten archief (geen xer-archive-herkomst, modus uit)',
  store().recordedDates?.origin !== 'xer-archive' && !store().datesAsRecorded);

// ── C. documentwissel en kopie ──────────────────────────────────────────────────────────────────
store().newDocument();
expect('C1 een nieuw document erft het signaal niet', store().xerArchiveIssue === null);
store().switchDocument(openedDocId);
expect('C2 signaal overleeft een documentwissel heen en terug', store().xerArchiveIssue?.code === 'bytes-missing');
store().duplicateDocument();
expect('C3 een kopie draagt het signaal mee (ook zij mist het archief)', store().xerArchiveIssue?.code === 'bytes-missing');
store().switchDocument(openedDocId);

// ── D. opslaan: geen IFC-round-trip van het signaal, geen archiefsporen meer ────────────────────
const saved = writeIFC(buildWriteIFCInput(store()));
expect('D1 opgeslagen IFC draagt geen archief-psets meer (sporen weg)',
  !saved.includes('OPS_XerSourceArchive') && !saved.includes('OPS_XerDocument'));
const reopened = readIFC(saved);
expect('D2 heropenen van het opgeslagen bestand: geen archief, geen issue (geen sporen ⇒ geen signaal)',
  reopened.xerSourceArchive === undefined && reopened.xerArchiveIssue === undefined && reopened.tasks.length === 2);

// ── E. crashherstel ─────────────────────────────────────────────────────────────────────────────
{
  const recoveryParsed = await readIFCWithXerReconstruction(damaged);
  clearNotes();
  const { skippedIds } = store().restoreDocuments([
    recoveryInputFromParsed(recoveryParsed, { id: 'herstel-1', filePath: null, isDirty: true, datesAsRecorded: false }),
    recoveryInputFromParsed(recoveryParsed, { id: 'herstel-2', filePath: null, isDirty: true, datesAsRecorded: false }),
  ], 'herstel-1');
  const restoredNotes = store().ui.notifications
    .filter(item => item.messageKey === 'notifications.xerArchiveUnusable');
  expect('E1 crashherstel: beide documenten terug, precies één archiefmelding voor de batch',
    skippedIds.length === 0 && store().documents.length === 2 && restoredNotes.length === 1,
    `skipped=${skippedIds.length} docs=${store().documents.length} notes=${restoredNotes.length}`);
  expect('E2 hersteld actief document draagt het signaal', store().xerArchiveIssue?.code === 'bytes-missing');
}

// ── F. inbedden in een bestaande bestandsmelding ────────────────────────────────────────────────
{
  const base = { severity: 'info' as const, messageKey: 'notifications.xerImportOpened' as const, detailLines: [
    { messageKey: 'notifications.xerImportProjectsSeen' as const, params: { count: 1 } },
  ] };
  const merged = withXerArchiveIssueNotice(base, [{ code: 'hash-mismatch', detail: 'Ongeldig OPS_XerSourceArchive: x' }]);
  expect('F1 bestaande melding blijft de ene melding; archiefregels komen als detail erachter',
    merged?.messageKey === 'notifications.xerImportOpened'
    && merged.detailLines?.[0]?.messageKey === 'notifications.xerImportProjectsSeen'
    && merged.detailLines?.[1]?.messageKey === 'notifications.xerArchiveUnusableLine'
    && merged.detailLines?.[2]?.messageKey === XER_ARCHIVE_REASON_KEYS['hash-mismatch']
    && merged.helpArticleId === XER_IMPORT_HELP_ARTICLE_ID);
  expect('F2 zonder issues blijft de melding byte-identiek (zelfde referentie)',
    withXerArchiveIssueNotice(base, [undefined, null]) === base);
  expect('F3 elke foutcode heeft een eigen vertaalde reden', XER_ARCHIVE_ISSUE_CODES.every(code =>
    typeof XER_ARCHIVE_REASON_KEYS[code] === 'string')
    && new Set(Object.values(XER_ARCHIVE_REASON_KEYS)).size === XER_ARCHIVE_ISSUE_CODES.length);
}

if (failures.length === 0) {
  console.log(`OK  xer-archive-fallback: alle checks groen (${checks})`);
  process.exit(0);
}
console.log(`XX  xer-archive-fallback: ${failures.length} afwijking(en) van ${checks}`);
for (const failure of failures) console.log(`   - ${failure}`);
process.exit(1);

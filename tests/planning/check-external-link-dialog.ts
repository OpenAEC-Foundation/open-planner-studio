import './domStub';
import { readFileSync } from 'node:fs';
import {
  buildManualExternalLinkSubmission,
  externalLinkDialogDocumentIsCurrent,
  externalAnchorInputValue,
} from '@/components/dialogs/ExternalLinkDialog';
import type { ExternalLink } from '@/types/task';

const failures: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failures.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

eq('Daganker blijft date-only in dagmodus', externalAnchorInputValue('2026-07-01', false), '2026-07-01');
eq('Daganker wordt zichtbare minuutwaarde in uurmodus', externalAnchorInputValue('2026-07-01', true), '2026-07-01T00:00');
eq('Bestaande minuutwaarde blijft gelijk', externalAnchorInputValue('2026-07-01T08:30', true), '2026-07-01T08:30');
eq('Canonieke seconden/tijdzone worden voor datetime-local begrensd',
  externalAnchorInputValue('2026-07-01T08:30:45.123Z', true), '2026-07-01T08:30');
eq('Wissen blijft leeg', externalAnchorInputValue('', true), '');
eq('Bestaande datetime wordt in actuele dagmodus als datum geprojecteerd',
  externalAnchorInputValue('2026-07-01T08:30', false), '2026-07-01');
eq('Dialoog mag alleen schrijven naar het document waarin hij is geopend',
  externalLinkDialogDocumentIsCurrent('doc-a', 'doc-a'), true);
eq('Dialoog weigert een document met dezelfde taak-id maar een andere document-id',
  externalLinkDialogDocumentIsCurrent('doc-a', 'doc-b'), false);

const existing: ExternalLink = {
  id: 'ext-1', direction: 'predecessor', relType: 'FS', lagDays: 2,
  anchorDate: '2026-07-01T08:30', sourceMissing: false,
  sourceRef: {
    projectId: 'west', projectName: 'Project West', taskId: 'bron-1',
    taskName: 'Fundering', filePath: '/projecten/west.ops',
  },
};
const unchanged = buildManualExternalLinkSubmission({
  existing, direction: 'predecessor', relType: 'FS', lag: { lagDays: 2 },
  projectId: 'west', taskId: 'bron-1', taskName: 'Fundering',
  anchor: '2026-07-01', anchorTouched: false,
});
eq('Onaangeraakte bestandsbron bewaart bronstatus, identiteit en canoniek anker', unchanged, {
  direction: 'predecessor', relType: 'FS', lagDays: 2,
  anchorDate: '2026-07-01T08:30',
  sourceRef: existing.sourceRef, sourceMissing: false,
});
const clearedName = buildManualExternalLinkSubmission({
  existing, direction: 'predecessor', relType: 'FS', lag: { lagDays: 2 },
  projectId: 'west', taskId: 'bron-1', taskName: '',
  anchor: '2026-07-01', anchorTouched: false,
});
eq('Optionele taaknaam kan echt worden gewist zonder gezonde bron kwijt te raken', clearedName.sourceRef, {
  projectId: 'west', projectName: 'Project West', taskId: 'bron-1', filePath: '/projecten/west.ops',
});
eq('Alleen label wissen maakt bron niet ontbrekend', clearedName.sourceMissing, false);
const changedIdentity = buildManualExternalLinkSubmission({
  existing, direction: 'predecessor', relType: 'FS', lag: { lagDays: 2 },
  projectId: 'oost', taskId: 'bron-2', taskName: 'Dak',
  anchor: '2026-07-02', anchorTouched: true,
});
eq('Nieuwe handmatige identiteit erft geen oude projectnaam of filePath', changedIdentity, {
  direction: 'predecessor', relType: 'FS', lagDays: 2, anchorDate: '2026-07-02',
  sourceRef: { projectId: 'oost', taskId: 'bron-2', taskName: 'Dak' }, sourceMissing: true,
});
const changedIdentityWithoutAnchor = buildManualExternalLinkSubmission({
  existing, direction: 'predecessor', relType: 'FS', lag: { lagDays: 2 },
  projectId: 'oost', taskId: 'bron-2', taskName: 'Dak',
  anchor: '2026-07-01', anchorTouched: false,
});
eq('Nieuwe identiteit kan nooit stil het anker van de oude bron erven',
  changedIdentityWithoutAnchor.anchorDate, '');

const dialogSource = readFileSync('src/components/dialogs/ExternalLinkDialog.tsx', 'utf8');
eq('Externe-linkdialoog verbindt Escape met annuleren', dialogSource.includes('onCancel={onClose}'), true);
eq('Externe-linkdialoog verbindt Enter met dezelfde submitpoort', dialogSource.includes('onConfirm={submit}'), true);
eq('Externe-linkdialoog controleert de actuele document-id opnieuw bij submit',
  dialogSource.includes('useAppStore.getState().activeDocumentId'), true);

if (failures.length > 0) {
  console.error(`FAIL external-link-dialog: ${failures.length}/${checks}`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log(`OK external-link-dialog: ${checks}/${checks}`);

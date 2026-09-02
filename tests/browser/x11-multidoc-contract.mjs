import {
  assertMultiDocumentEvidence,
  MULTI_DOCUMENT_EXPECTED_REPORT,
} from './helpers/ops-state.mjs';

const routes = new Map([
  [1, 'shortcut:Control+1'],
  [5, 'shortcut:Control+5'],
  [9, 'shortcut:Control+9'],
  [10, 'click'],
  [11, 'keyboard:ArrowRight'],
  [12, 'keyboard:ArrowRight'],
]);

const evidence = {
  report: { ...MULTI_DOCUMENT_EXPECTED_REPORT },
  openLatencyMs: 1,
  documents: Array.from({ length: 12 }, (_, index) => ({
    ordinal: index + 1,
    documentHash: `document-hash-${index + 1}`,
    projectIdentityHash: `project-hash-${index + 1}`,
    taskCount: 1,
    sourceArchivePresent: true,
    cpmPresent: true,
  })),
  switches: Array.from({ length: 12 }, (_, index) => ({
    requestedOrdinal: index + 1,
    observedOrdinal: index + 1,
    route: routes.get(index + 1) ?? 'click',
    outsideInput: true,
    tabVisible: true,
    tabpanelCorrelated: true,
    activeDocumentHashCorrelated: true,
    latencyMs: 1,
  })),
  help: {
    notificationHelpArticleId: 'gids-xer-import',
    activeTocTitle: 'Opening Primavera P6 (.xer)',
    articleHeading: 'Opening Primavera P6 (.xer)',
    activeRibbonTab: 'file',
    backstageSection: 'help',
    pendingHelpArticleConsumed: true,
    hasMultiDocumentExplanation: true,
    hasEmptyProjectExplanation: true,
    hasBaselineExplanation: true,
  },
};

const mutation = process.env.OPS_X11_MULTIDOC_MUTATION;
if (mutation === 'report-projects') evidence.report.projectsSeen = 14;
if (mutation === 'report-documents') evidence.report.documentsOpened = 11;
if (mutation === 'report-empty') evidence.report.emptyProjectsSkipped = 2;
if (mutation === 'report-dangling') evidence.report.danglingBaselineReferences = 8;
if (mutation === 'duplicate-project-id') evidence.documents[1].projectIdentityHash = evidence.documents[0].projectIdentityHash;
if (mutation === 'empty-document') evidence.documents[6].taskCount = 0;
if (mutation === 'shortcut') evidence.switches[4].observedOrdinal = 4;
if (mutation === 'help-route') evidence.help.notificationHelpArticleId = 'verkeerd-artikel';

assertMultiDocumentEvidence(evidence);
console.log('OK x11-multidoc-contract: report, 12 documenten, navigatie, latenties en Help-route gepind');

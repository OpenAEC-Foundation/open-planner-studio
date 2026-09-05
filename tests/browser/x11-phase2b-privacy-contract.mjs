import { assertPhase2BEvidencePrivacy } from './helpers/ops-state.mjs';

const evidenceId = 'x11-123e4567-e89b-12d3-a456-426614174000';
const envelope = {
  evidenceId,
  stdout: evidenceId,
  metadata: {
    runId: evidenceId,
    git: {
      worktreeFingerprint: `sha256-${'a'.repeat(64)}`,
      branchFingerprint: `sha256-${'b'.repeat(64)}`,
      head: 'c'.repeat(40),
      base: 'd'.repeat(40),
      commitParent: 'e'.repeat(40),
      statusFingerprint: `sha256-${'f'.repeat(64)}`,
      statusClean: true,
    },
    server: { httpStatus: 200, cwdMatched: true, assignedPort: 3017 },
    browser: { headless: false, visible: true, executableVerified: true, wayland: true },
    privacyAudit: { pathlikeDetected: false },
  },
  serverSummary: { httpStatus: 200, cwdMatched: true, outputDigest: `sha256-${'1'.repeat(64)}` },
  stateArtifact: { counts: { tasks: 6977 }, sourceArchiveDigest: '2'.repeat(64) },
};

const mutation = process.env.OPS_X11_PHASE2B_PRIVACY_MUTATION;
if (mutation === 'stdout-path') envelope.stdout = `${evidenceId} /tmp/secret`;
if (mutation === 'metadata-path') envelope.metadata.leak = '/home/user/private';
if (mutation === 'server-url') envelope.serverSummary.leak = 'http://localhost:3017/';
if (mutation === 'artifact-file') envelope.stateArtifact.leak = 'rehab-2.xer';
if (mutation === 'metadata-private-label') envelope.metadata.privateLabel = 'Secret Alpha';
if (mutation === 'state-private-label') envelope.stateArtifact.privateLabel = 'Customer Apollo';
if (mutation === 'server-private-label') envelope.serverSummary.privateLabel = 'Internal Blue';
if (mutation === 'stdout-private-label') envelope.stdout = 'Confidential Delta';

assertPhase2BEvidencePrivacy(envelope);
console.log('OK x11-phase2b-privacy-contract: stdout, metadata, server- en stateartefact zijn gesloten');

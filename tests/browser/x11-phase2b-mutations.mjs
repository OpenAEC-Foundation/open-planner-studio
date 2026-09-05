import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const phaseContract = fileURLToPath(new URL('./x11-phase2b-contract.mjs', import.meta.url));
const privacyContract = fileURLToPath(new URL('./x11-phase2b-privacy-contract.mjs', import.meta.url));

const existingPhaseMutations = Object.freeze([
  'recovery-count', 'archive', 'digest', 'selector', 'active-document', 'order',
  'missing-document', 'beforeunload-99', 'beforeunload-0', 'dialog-alert',
  'dialog-confirm', 'dialog-prompt', 'large-tasks', 'large-assignments',
  'large-calendars', 'large-resources', 'large-source-rows',
  'large-activity-catalogs', 'large-udf-defs', 'wrong-gantt-canvas',
  'empty-gantt', 'resources-route', 'histogram-route', 'privacy',
]);
const existingPrivacyMutations = Object.freeze([
  'stdout-path', 'metadata-path', 'server-url', 'artifact-file',
]);
const positiveSchemaMutations = Object.freeze([
  'metadata-private-label', 'state-private-label', 'server-private-label',
  'stdout-private-label',
]);

const existingMutationCount = existingPhaseMutations.length + existingPrivacyMutations.length;
const totalMutationCount = existingMutationCount + positiveSchemaMutations.length;
if (existingMutationCount !== 28 || totalMutationCount !== 32) {
  throw new Error(
    `fase-2B-mutantentelling rood: bestaand=${existingMutationCount}, totaal=${totalMutationCount}`,
  );
}

function expectSemanticFailure(script, envName, mutation, expectedError) {
  const env = { ...process.env };
  delete env.OPS_X11_PHASE2B_MUTATION;
  delete env.OPS_X11_PHASE2B_PRIVACY_MUTATION;
  env[envName] = mutation;
  const result = spawnSync(process.execPath, [script], {
    env,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  });
  if (result.status !== 1) {
    throw new Error(`mutant ${mutation} gaf exitcode ${result.status}, verwacht 1`);
  }
  if (!expectedError.test(result.stderr)) {
    throw new Error(`mutant ${mutation} faalde niet via het bedoelde contract`);
  }
}

for (const mutation of existingPhaseMutations) {
  expectSemanticFailure(
    phaseContract,
    'OPS_X11_PHASE2B_MUTATION',
    mutation,
    /(?:X11 (?:recoverycontract|grootbestandcontract)|grootbestand-privacyallowlist) rood:/,
  );
}
for (const mutation of [...existingPrivacyMutations, ...positiveSchemaMutations]) {
  expectSemanticFailure(
    privacyContract,
    'OPS_X11_PHASE2B_PRIVACY_MUTATION',
    mutation,
    /X11 fase-2B-privacycontract rood:/,
  );
}

console.log(
  `OK x11-phase2b-mutations: ${existingMutationCount} bestaande en ` +
    `${positiveSchemaMutations.length} nieuwe mutanten semantisch rood`,
);

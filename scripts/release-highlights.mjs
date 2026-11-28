#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const result = spawnSync(process.execPath, ['scripts/run-ts.mjs', 'scripts/verify-release-highlights.ts', ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(result.status ?? 1);

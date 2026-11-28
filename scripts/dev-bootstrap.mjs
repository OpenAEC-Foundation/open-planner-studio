#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

try {
  const root = process.cwd();
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  if (pkg.name !== 'open-planner-studio') process.exit(0);
  const { worktreeRoot, allocatePort } = await import(join(root, 'scripts', 'dev-port.mjs'));
  const wt = worktreeRoot(root);
  if (!wt) process.exit(0);
  const port = await allocatePort(wt);
  console.error(`[ops dev-bootstrap] worktree "${wt.split('/').pop()}" → poort ${port}`);
} catch (e) {
  console.error(`[ops dev-bootstrap] overgeslagen: ${e.message}`);
  process.exit(0);
}

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const result = spawnSync(process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3'), [fileURLToPath(new URL('./generate-approved-icons.py', import.meta.url))], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;

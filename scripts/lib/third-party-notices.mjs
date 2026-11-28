import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * @param {string[]} inputs
 * @returns {{ packages: string[], sections: string }}
 * @throws {Error}
 */
export function thirdPartyNotices(inputs) {
  const bundledPackages = new Map();
  for (const input of inputs) {
    const m = /(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)\//.exec(input);
    if (!m) continue;
    const dir = resolve(process.cwd(), input.slice(0, m.index + m[0].length - 1));
    if (!bundledPackages.has(m[1])) bundledPackages.set(m[1], dir);
  }
  const parts = [];
  for (const [name, dir] of [...bundledPackages].sort(([a], [b]) => a.localeCompare(b))) {
    const meta = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    const licenseFile = readdirSync(dir).find((f) => /^(licen[cs]e|copying)(\.(md|txt))?$/i.test(f));
    if (!licenseFile || !existsSync(join(dir, licenseFile))) {
      throw new Error(`gebundeld pakket ${name} heeft geen licentiebestand in ${dir}`);
    }
    parts.push(`## ${name} ${meta.version}\n\nLicense: ${meta.license ?? 'see below'}\n\n\`\`\`text\n${readFileSync(join(dir, licenseFile), 'utf8').trim()}\n\`\`\`\n`);
  }
  return { packages: [...bundledPackages.keys()].sort(), sections: parts.join('\n') };
}

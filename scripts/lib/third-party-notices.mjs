// Licenties van MEEGEBUNDELDE dependencies, afgeleid uit een esbuild-metafile (niet uit een vaste
// lijst): per pakket naam, versie, licentie en de volledige licentietekst uit node_modules. Gedeeld
// door `build-core.mjs` (headless kern) en `build-mcpb.mjs` (Claude Desktop-bundel).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * @param {string[]} inputs  de inputpaden uit `metafile.inputs` (met `/` als scheiding)
 * @returns {{ packages: string[], sections: string }}  pakketnamen (gesorteerd) en de Markdown-secties
 * @throws {Error} als een gebundeld pakket geen licentiebestand heeft
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

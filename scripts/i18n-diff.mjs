#!/usr/bin/env node
// Diff script: for each namespace file, collect all nested key paths from nl,
// then report missing paths per other locale.
import fs from 'node:fs';
import path from 'node:path';

const localesDir = path.resolve(process.cwd(), 'src/i18n/locales');
const base = 'nl';
const locales = fs.readdirSync(localesDir).filter((d) =>
  fs.statSync(path.join(localesDir, d)).isDirectory()
);
const others = locales.filter((l) => l !== base);

function collectPaths(obj, prefix = '') {
  let paths = [];
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    const p = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      paths = paths.concat(collectPaths(value, p));
    } else {
      paths.push(p);
    }
  }
  return paths;
}

function getAtPath(obj, p) {
  const parts = p.split('.');
  let cur = obj;
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object' || !(part in cur)) return undefined;
    cur = cur[part];
  }
  return cur;
}

const baseFiles = fs.readdirSync(path.join(localesDir, base)).filter((f) => f.endsWith('.json'));

let totalMissing = 0;
const report = {};

for (const file of baseFiles) {
  const baseData = JSON.parse(fs.readFileSync(path.join(localesDir, base, file), 'utf8'));
  const basePaths = collectPaths(baseData);

  for (const locale of others) {
    const filePath = path.join(localesDir, locale, file);
    if (!fs.existsSync(filePath)) {
      report[locale] = report[locale] || {};
      report[locale][file] = basePaths.slice();
      totalMissing += basePaths.length;
      continue;
    }
    const localeData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const missing = basePaths.filter((p) => getAtPath(localeData, p) === undefined);
    if (missing.length) {
      report[locale] = report[locale] || {};
      report[locale][file] = missing;
      totalMissing += missing.length;
    }
  }
}

const jsonMode = process.argv.includes('--json');
if (jsonMode) {
  console.log(JSON.stringify(report, null, 2));
} else {
  for (const locale of others) {
    const files = report[locale];
    const count = files ? Object.values(files).reduce((a, b) => a + b.length, 0) : 0;
    console.log(`\n=== ${locale}: ${count} missing keys ===`);
    if (files) {
      for (const [file, paths] of Object.entries(files)) {
        console.log(`  ${file}:`);
        for (const p of paths) console.log(`    - ${p}`);
      }
    }
  }
  console.log(`\nTOTAL missing across all locales: ${totalMissing}`);
}

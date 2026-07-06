#!/usr/bin/env node
// Applies the golf-6 translations into each locale's JSON, inserting missing
// keys at the position matching the `nl` reference key order (per nesting level).
import fs from 'node:fs';
import path from 'node:path';
import { translations } from './i18n-translations-wave6.mjs';

const localesDir = path.resolve(process.cwd(), 'src/i18n/locales');
const base = 'nl';

function setAtPath(obj, p, value) {
  const parts = p.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in cur) || typeof cur[part] !== 'object') cur[part] = {};
    cur = cur[part];
  }
  cur[parts[parts.length - 1]] = value;
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

// Reorder `target` object's keys (recursively) to match `refOrder`'s key order,
// for keys that exist in `refOrder`. Any target-only keys keep their relative
// position appended at the end of their level.
function reorderLike(target, ref) {
  if (typeof ref !== 'object' || ref === null || Array.isArray(ref)) return target;
  if (typeof target !== 'object' || target === null || Array.isArray(target)) return target;

  const result = {};
  for (const key of Object.keys(ref)) {
    if (key in target) {
      result[key] = reorderLike(target[key], ref[key]);
    }
  }
  for (const key of Object.keys(target)) {
    if (!(key in result)) result[key] = target[key];
  }
  return result;
}

let totalApplied = 0;
const summary = {};

for (const [locale, files] of Object.entries(translations)) {
  const localeDir = path.join(localesDir, locale);
  let count = 0;
  for (const [file, keyMap] of Object.entries(files)) {
    const filePath = path.join(localeDir, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    for (const [p, value] of Object.entries(keyMap)) {
      if (getAtPath(data, p) === undefined) {
        setAtPath(data, p, value);
        count++;
      }
    }
    // Reorder to match nl's key order for readability / minimal diff surprise.
    const refPath = path.join(localesDir, base, file);
    const refData = JSON.parse(fs.readFileSync(refPath, 'utf8'));
    const reordered = reorderLike(data, refData);
    fs.writeFileSync(filePath, JSON.stringify(reordered, null, 2) + '\n', 'utf8');
  }
  summary[locale] = count;
  totalApplied += count;
}

console.log(JSON.stringify(summary, null, 2));
console.log(`TOTAL applied: ${totalApplied}`);

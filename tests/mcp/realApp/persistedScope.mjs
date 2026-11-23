export const APP_IDENTIFIER = 'org.openaec.planner';
export const OUTSIDE_FILE_NAME = 'model.ifc';

export function scopeFile(allowed) {
  const u64 = n => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b; };
  const str = s => { const b = Buffer.from(s, 'utf8'); return Buffer.concat([u64(b.length), b]); };
  return Buffer.concat([u64(allowed.length), ...allowed.map(str), u64(0)]);
}

export function readScope(bytes) {
  let at = 0;
  const u64 = () => { const n = Number(bytes.readBigUInt64LE(at)); at += 8; return n; };
  const list = () => Array.from({ length: u64() }, () => {
    const n = u64(), text = bytes.toString('utf8', at, at + n);
    at += n;
    return text;
  });
  const allowed = list(), forbidden = list();
  if (at !== bytes.length) throw new Error('.persisted-scope: bytes na de twee lijsten');
  return { allowed, forbidden };
}

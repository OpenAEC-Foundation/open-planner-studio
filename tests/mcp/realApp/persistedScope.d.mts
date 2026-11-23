export const APP_IDENTIFIER: string;
export const OUTSIDE_FILE_NAME: string;
export function scopeFile(allowed: string[]): Buffer;
export function readScope(bytes: Buffer): { allowed: string[]; forbidden: string[] };

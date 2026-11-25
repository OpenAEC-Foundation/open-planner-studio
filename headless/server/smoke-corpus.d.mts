export const FORMS: ReadonlyArray<readonly [string, (bytes: Buffer) => Buffer]>;
export function answerDigest(text: string, kind: string, status: number, source: Buffer): string;

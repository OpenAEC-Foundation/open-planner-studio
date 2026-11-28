export function addedCodeLinesFromNumstat(numstat: string): number {
  return numstat.split('\n').filter(Boolean).reduce((sum, line) => {
    const added = line.split('\t')[0];
    return sum + (added === '-' ? 0 : Number(added || 0));
  }, 0);
}

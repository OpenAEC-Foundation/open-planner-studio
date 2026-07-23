// Byte-grootte mensvriendelijk formatteren (binaire eenheden, "MB" als label). Bewust kaal en
// dependency-vrij zodat lichte importeurs (bv. JustUpdatedDialog) er niet de halve engine bij
// inslepen. De benchmark-runner re-exporteert deze functie voor back-compat.
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Signaleert herkenbare beweringen over een vaste release-eindtijd.
 * Dit is een tekstuele vangrail, geen natuurlijke-taalparser: anders geformuleerde
 * instructies vereisen nog steeds review. Beperk de ontkenning tot expliciete
 * uitspraken over de release zelf; de browserreparatie heeft wél een eigen stoptijd.
 */
export function hasReleaseEndClaim(line: string): boolean {
  const sentences = line.split(/[.!?;]+/);
  return sentences.some(sentence => {
    const release = /\brelease\b/i;
    const end = /14:00|\bdeadline\b/i;
    if (!release.test(sentence) || !end.test(sentence)) return false;
    // Alleen expliciete ontkenningen van een release-deadline, niet elke zin met "niet".
    const remaining = sentence
      .replace(/\brelease(?:\s+zelf)?\s+(?:heeft|kent)\s+geen\s+(?:vaste\s+)?deadline\b/gi, '')
      .replace(/\brelease\s+has\s+no\s+(?:fixed\s+)?deadline\b/gi, '');
    // Een bijzin kan hetzelfde onderwerp gebruiken: "release heeft geen deadline,
    // maar stopt om 14:00". Detecteer dit beperkte patroon ook na de ontkenning.
    const implicitStop = /\bmaar\s+(?:(?:hij|zij|die)\s+)?(?:stopt|eindigt|moet\s+(?:stoppen|eindigen))\b[^.!?;]*14:00/i;
    return (release.test(remaining) && end.test(remaining))
      || (release.test(sentence) && implicitStop.test(remaining));
  });
}

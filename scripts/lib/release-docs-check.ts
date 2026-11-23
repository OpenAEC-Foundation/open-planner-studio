export const REPAIR_SKILL = ".claude/skills/browsertests-repareren/SKILL.md";

const repairStopLines = new Set([
  "door tot uiterlijk **14:00**. Controleer de tijd vóór elke rerun, delegatie, merge en dispatch. Om 14:00 stop je: volg",
  "*Stoppen om 14:00*. Het issue blijft dan open en de release wacht erop; de release zelf heeft geen eindtijd",
  "## Stoppen om 14:00",
  "stoppen om 14:00 begint daar niet mee.",
  "- **Ochtendreparatie, 08:00.** Is er een open issue, dan repareert deze taak volgens deze skill, tot uiterlijk 14:00",
  "Wees klaar vóór maandag 07:00, de start van de release. Lukt dat niet, ga dan door tot uiterlijk 14:00 Europe/Amsterdam.",
]);

const safeStandalone = /^(?:de release(?: zelf)? (?:heeft|kent) geen (?:vaste )?deadline|the release has no (?:fixed )?deadline|de browserreparatie stopt om 14:00|browser repair stops at 14:00)\.$/i;
const staleReleaseDay = /zaterdagjob|zaterdagmandaat|volgende zaterdag|draait op zaterdag|Saturday job|next Saturday|(?:alongside|for) (?:that|the next) Saturday/i;
const staleReleaseEnd = /14:00|\bdeadline\b/i;

export function staleReleaseDocLine(path: string, text: string): number | undefined {
  const index = text.split(/\r?\n/).findIndex(line =>
    staleReleaseDay.test(line) || (staleReleaseEnd.test(line)
      && !safeStandalone.test(line.trim())
      && !(path === REPAIR_SKILL && repairStopLines.has(line))));
  return index < 0 ? undefined : index + 1;
}

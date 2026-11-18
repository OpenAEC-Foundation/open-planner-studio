import i18next from 'i18next';
import type { ReplaceCopyKind, ReplaceCopyLabel } from '@/services/fileAccess/ownFileReplace';

/** De tijd in de naam van een kopie: `2026-11-17 14.32`, lokale tijd, met een punt (een dubbele punt mag niet in een
 *  bestandsnaam op Windows). Gelijk in elke taal; alleen de woorden ervoor vertalen. */
export function replaceCopyTime(when: Date): string {
  const two = (n: number) => String(n).padStart(2, '0');
  return `${when.getFullYear()}-${two(when.getMonth() + 1)}-${two(when.getDate())} ${two(when.getHours())}.${two(when.getMinutes())}`;
}

// Geen locale-JSON importeren (zoals `exportFileSuffix`): de Engelse tekst is de terugval zonder UI-config.
const KEYS: Record<ReplaceCopyKind, { key: string; fallback: string }> = {
  'other-program': { key: 'replaceCopy.otherProgram', fallback: 'version from another program {{when}}' },
  'unsaved-schedule': { key: 'replaceCopy.unsavedSchedule', fallback: 'unsaved schedule {{when}}' },
};

/** Het deel tussen haakjes in de naam van een kopie (ontwerp §4.10, "Namen van de kopieën"), voor één moment. */
export function replaceCopyLabel(when: Date = new Date()): ReplaceCopyLabel {
  const time = replaceCopyTime(when);
  return kind => {
    const { key, fallback } = KEYS[kind];
    return i18next.isInitialized
      ? i18next.t(key, { ns: 'common', when: time, defaultValue: fallback, interpolation: { escapeValue: false } })
      : fallback.replace('{{when}}', time);
  };
}

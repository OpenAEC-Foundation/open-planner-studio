import i18next from 'i18next';
import type { ReplaceCopyKind, ReplaceCopyLabel } from '@/services/fileAccess/ownFileReplace';

export function replaceCopyTime(when: Date): string {
  const two = (n: number) => String(n).padStart(2, '0');
  return `${when.getFullYear()}-${two(when.getMonth() + 1)}-${two(when.getDate())} ${two(when.getHours())}.${two(when.getMinutes())}`;
}

const KEYS: Record<ReplaceCopyKind, { key: string; fallback: string }> = {
  'other-program': { key: 'replaceCopy.otherProgram', fallback: 'version from another program {{when}}' },
  'unsaved-schedule': { key: 'replaceCopy.unsavedSchedule', fallback: 'unsaved schedule {{when}}' },
};

export function replaceCopyLabel(when: Date = new Date()): ReplaceCopyLabel {
  const time = replaceCopyTime(when);
  return kind => {
    const { key, fallback } = KEYS[kind];
    return i18next.isInitialized
      ? i18next.t(key, { ns: 'common', when: time, defaultValue: fallback, interpolation: { escapeValue: false } })
      : fallback.replace('{{when}}', time);
  };
}

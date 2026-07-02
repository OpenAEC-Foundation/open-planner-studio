import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
import { SequenceType } from '@/types/sequence';

// Conventionele PM-volgorde (zoals MS Project / P6): FS, SS, FF, SF.
const SEQUENCE_TYPE_KEYS: SequenceType[] = [
  'FINISH_START',
  'START_START',
  'FINISH_FINISH',
  'START_FINISH',
];

export function getSequenceTypeLabel(t: TFunction, type: SequenceType): string {
  return t(`sequenceType.${type}`, { ns: 'task' });
}

export function useSequenceTypeLabels() {
  const { t } = useTranslation('task');

  const labels = {} as Record<SequenceType, string>;
  for (const key of SEQUENCE_TYPE_KEYS) {
    labels[key] = t(`sequenceType.${key}`);
  }

  const options = SEQUENCE_TYPE_KEYS.map((value) => ({ value, label: labels[value] }));

  return { labels, options };
}

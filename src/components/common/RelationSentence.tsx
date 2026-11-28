import { useTranslation } from 'react-i18next';
import type { SequenceType } from '@/types/sequence';

export type RelationTypeCode = 'FS' | 'SS' | 'FF' | 'SF';

const CODE_BY_SEQUENCE_TYPE: Record<SequenceType, RelationTypeCode> = {
  FINISH_START: 'FS',
  START_START: 'SS',
  FINISH_FINISH: 'FF',
  START_FINISH: 'SF',
};

const SENTENCE_KEY = {
  FS: 'relations.sentenceFS',
  SS: 'relations.sentenceSS',
  FF: 'relations.sentenceFF',
  SF: 'relations.sentenceSF',
} as const satisfies Record<RelationTypeCode, string>;

const MAX_NAME_LENGTH = 32;

function shortName(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > MAX_NAME_LENGTH ? `${trimmed.slice(0, MAX_NAME_LENGTH - 1).trimEnd()}…` : trimmed;
}

export function relationSentenceName(task: { name?: string; wbsCode?: string } | undefined): string {
  return task?.name?.trim() || task?.wbsCode?.trim() || '?';
}

export interface RelationSentenceProps {
  type: SequenceType | RelationTypeCode;
  predecessorName: string;
  successorName: string;
}

export function RelationSentence({ type, predecessorName, successorName }: RelationSentenceProps) {
  const { t } = useTranslation('task');
  const code = type in CODE_BY_SEQUENCE_TYPE ? CODE_BY_SEQUENCE_TYPE[type as SequenceType] : type as RelationTypeCode;
  const key = SENTENCE_KEY[code];
  const full = t(key, { pred: predecessorName, succ: successorName });
  const short = t(key, { pred: shortName(predecessorName), succ: shortName(successorName) });
  return (
    <span
      className="relation-sentence !text-small leading-4 text-text-secondary"
      title={short === full ? undefined : full}
      data-ops-relation-sentence={code}
    >
      {short}
    </span>
  );
}

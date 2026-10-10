import { useTranslation } from 'react-i18next';
import type { SequenceType } from '@/types/sequence';

/** Korte code van een relatietype; de relatiecel in de tabel werkt al met deze vorm. */
export type RelationTypeCode = 'FS' | 'SS' | 'FF' | 'SF';

const CODE_BY_SEQUENCE_TYPE: Record<SequenceType, RelationTypeCode> = {
  FINISH_START: 'FS',
  START_START: 'SS',
  FINISH_FINISH: 'FF',
  START_FINISH: 'SF',
};

/** Vaste sleutels per type (geen samengestelde sleutel: `verify:i18n` moet ze kunnen zien). */
const SENTENCE_KEY = {
  FS: 'relations.sentenceFS',
  SS: 'relations.sentenceSS',
  FF: 'relations.sentenceFF',
  SF: 'relations.sentenceSF',
} as const satisfies Record<RelationTypeCode, string>;

/** Langere namen breken de zin; de volledige zin staat dan in de `title`. */
const MAX_NAME_LENGTH = 32;

function shortName(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > MAX_NAME_LENGTH ? `${trimmed.slice(0, MAX_NAME_LENGTH - 1).trimEnd()}…` : trimmed;
}

/** Weergavenaam van een taak in de zin: de naam, anders de WBS-code, anders een vraagteken. */
export function relationSentenceName(task: { name?: string; wbsCode?: string } | undefined): string {
  return task?.name?.trim() || task?.wbsCode?.trim() || '?';
}

export interface RelationSentenceProps {
  type: SequenceType | RelationTypeCode;
  predecessorName: string;
  successorName: string;
}

/**
 * Eén regel uitleg onder de keuze van het relatietype, met de echte taaknamen:
 * "Metselwerk begint pas als Fundering klaar is." Bewust zonder lag — de regel legt het type uit,
 * niet de hele relatie. Gedeeld door de relatie-popover in de Gantt, het blok Relaties in het
 * eigenschappenpaneel en de relatiecel in de tabel, zodat de drie plekken dezelfde zin tonen.
 */
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

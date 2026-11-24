export type SlotSoort = 'domein' | 'afgeleid' | 'constant' | 'verwijzing';

export const SLOT_SOORTEN = ['domein', 'afgeleid', 'constant', 'verwijzing'] as const satisfies readonly SlotSoort[];

export interface SlotSoorten {
  readonly soort: SlotSoort;
  readonly soortVreemd?: SlotSoort;
  readonly bronverwijzing?: true;
}

export interface SlotSpec<K extends string = string> extends SlotSoorten {
  readonly key: K;
  readonly volgt?: K;
}

export interface WriteSlot<C, K extends string = string> extends SlotSpec<K> {
  write(w: C): string;
}

export type SlotPositions<K extends string> = Readonly<Record<K, number>>;

export const ABSENT_SLOT = -1;

export const OWNER_HISTORY_SOORTEN = {
  soort: 'verwijzing', soortVreemd: 'constant', bronverwijzing: true,
} as const satisfies SlotSoorten;

export function slotIndex<K extends string>(slots: readonly { readonly key: K }[]): SlotPositions<K> {
  const positions = {} as Record<K, number>;
  slots.forEach((slot, index) => { positions[slot.key] = index; });
  return positions;
}

export function writeSlots<C>(slots: readonly { write(w: C): string }[], ctx: NoInfer<C>): string {
  return slots.map(slot => slot.write(ctx)).join(',');
}

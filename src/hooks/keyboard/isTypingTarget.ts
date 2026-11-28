import { isInDatePicker } from '@/utils/datePickerFocus';

export function isTypingTarget(
  target: EventTarget | null,
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey'>,
): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (target.dataset.opsAppKeys === 'true' && target.closest('[aria-modal="true"]') === null) {
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if ((mod && (key === 'z' || key === 'y')) || (!mod && event.key === 'Escape')) return false;
  }
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return true;
  if (isInDatePicker(target)) return true;
  const trigger = target.closest('[aria-haspopup="listbox"]');
  if (!trigger) return false;
  const closed = trigger.getAttribute('aria-expanded') !== 'true';
  const inModal = trigger.closest('[aria-modal="true"]') !== null;
  if (closed && !inModal && (event.ctrlKey || event.metaKey)
    && event.key !== 'Delete' && event.key !== 'Backspace') return false;
  return true;
}

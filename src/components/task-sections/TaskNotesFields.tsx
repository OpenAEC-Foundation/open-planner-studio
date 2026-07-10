import { useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Task } from '@/types/task';
import { generateId } from '@/utils/id';
import { Plus, Trash2 } from 'lucide-react';

/**
 * Aantekeningen/checklist per taak (fase 2.10, item 1) — nieuwe gedeelde sectie, direct na de
 * omschrijving/basisvelden. `CalendarForm`-patroon (`{ task, onChange }`): geen dedicated
 * store-actie nodig, mutaties zijn gewoon `notes`-array-patches (zie spec-voorstel). Instant-apply
 * in het paneel, draft in de dialoog (onChange bepaalt wanneer er gecommit wordt) — identiek gedrag,
 * de sectie zelf weet niet welke van de twee het is.
 *
 * Tekstveld is een auto-groeiende `<textarea>` (fase 2.10, bugfix): groeit verticaal mee met de
 * inhoud i.p.v. horizontaal te overflowen zoals een `<input>` deed. `useDialogKeys` negeert Enter
 * al op een `TEXTAREA` (regeleinde blijft regeleinde, geen dialoog-submit) — zie de doc-comment
 * daar.
 */
function NoteTextarea({ value, onChange, textareaRef, placeholder, className, ...rest }: {
  value: string;
  onChange: (v: string) => void;
  textareaRef?: React.Ref<HTMLTextAreaElement>;
  placeholder?: string;
  className?: string;
} & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange' | 'ref' | 'placeholder' | 'className'>) {
  const innerRef = useRef<HTMLTextAreaElement | null>(null);
  const resize = () => {
    const el = innerRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };
  // Herbereken bij elke waardewijziging (incl. initieel: bestaande lange aantekeningen na
  // taakwissel/IFC-load moeten meteen op de juiste hoogte staan, niet pas na de eerste toets).
  useLayoutEffect(resize, [value]);
  return (
    <textarea
      ref={el => {
        innerRef.current = el;
        if (typeof textareaRef === 'function') textareaRef(el);
        else if (textareaRef && 'current' in textareaRef) (textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
      }}
      value={value}
      onChange={e => { onChange(e.target.value); }}
      onInput={resize}
      rows={1}
      placeholder={placeholder}
      className={`${className ?? ''} resize-none overflow-hidden min-w-0 break-words`}
      {...rest}
    />
  );
}

export function TaskNotesFields({ task, onChange }: {
  task: Task;
  onChange: (patch: Partial<Task>) => void;
}) {
  const { t } = useTranslation('task');
  const notes = task.notes ?? [];
  const lastAddedRef = useRef<HTMLTextAreaElement | null>(null);

  const addNote = () => {
    const id = generateId('note');
    onChange({ notes: [...notes, { id, text: '', done: false }] });
    // Focus het nieuwe tekstveld zodra het gerenderd is (spec: "aantekening toevoegen" ⇒ focus).
    setTimeout(() => lastAddedRef.current?.focus(), 0);
  };
  const updateNote = (id: string, patch: Partial<{ text: string; done: boolean }>) => {
    onChange({ notes: notes.map(n => (n.id === id ? { ...n, ...patch } : n)) });
  };
  const removeNote = (id: string) => {
    onChange({ notes: notes.filter(n => n.id !== id) });
  };

  return (
    <>
      <div className="h-px" style={{ background: 'var(--theme-border-light)' }} />
      <span className="ui-card-header !text-xs">{t('properties.notes.title')}</span>
      {notes.length === 0 && (
        <span className="text-[10px] text-text-secondary">{t('properties.notes.empty')}</span>
      )}
      {notes.map((note, i) => (
        <div key={note.id} className="flex items-start gap-1.5 text-[10px]" data-ops-note-row>
          <input
            type="checkbox"
            checked={note.done}
            onChange={e => updateNote(note.id, { done: e.target.checked })}
            className="accent-accent mt-1"
            aria-label={t('properties.notes.done')}
            data-ops-note-done
          />
          <NoteTextarea
            textareaRef={i === notes.length - 1 ? lastAddedRef : undefined}
            value={note.text}
            onChange={v => updateNote(note.id, { text: v })}
            placeholder={t('properties.notes.placeholder')}
            className={`input !text-[10px] !px-1.5 !py-1 flex-1 ${note.done ? 'line-through opacity-60' : ''}`}
            data-ops-note-text
          />
          <button
            onClick={() => removeNote(note.id)}
            style={{ color: 'var(--error)' }}
            title={t('properties.notes.remove')}
            className="mt-1"
            data-ops-note-remove
          >
            <Trash2 size={10} />
          </button>
        </div>
      ))}
      <button
        onClick={addNote}
        className="flex items-center gap-1 text-[10px] self-start"
        style={{ color: 'var(--theme-accent)' }}
        data-ops-note-add
      >
        <Plus size={10} />
        {t('properties.notes.add')}
      </button>
    </>
  );
}

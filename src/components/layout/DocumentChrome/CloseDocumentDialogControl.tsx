import type { MouseEvent, Ref } from 'react';

interface CloseDocumentDialogControlProps {
  title: string;
  body: string;
  cancelLabel: string;
  discardLabel: string;
  saveLabel: string;
  busy: boolean;
  cancelButtonRef: Ref<HTMLButtonElement>;
  onCancel: () => void;
  onDiscard: () => void;
  onSave: () => void;
}

/** Prop-gedreven dialooglaag, zodat de echte backdrop- en knopwiring gericht uitvoerbaar is. */
export function CloseDocumentDialogControl({
  title,
  body,
  cancelLabel,
  discardLabel,
  saveLabel,
  busy,
  cancelButtonRef,
  onCancel,
  onDiscard,
  onSave,
}: CloseDocumentDialogControlProps) {
  return (
    <div
      onClick={busy ? undefined : onCancel}
      data-ops-close-dialog
      aria-busy={busy}
      style={{
        position: 'absolute', inset: 0, zIndex: 80,
        background: 'rgba(15,16,20,0.55)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', animation: 'ops-fade 0.1s ease-out',
      }}
    >
      <div
        onClick={(event: MouseEvent<HTMLDivElement>) => event.stopPropagation()}
        style={{
          width: 420, maxWidth: '90%', background: 'var(--theme-surface-elevated)',
          border: '1px solid var(--theme-border)', borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-pop)', padding: 20,
        }}
      >
        <h3 style={{
          margin: '0 0 8px', fontFamily: "'Space Grotesk', sans-serif", fontSize: 'calc(15px * var(--ui-font-scale, 1))',
          fontWeight: 700, color: 'var(--theme-text)',
        }}>
          {title}
        </h3>
        <p style={{ margin: '0 0 18px', fontSize: 'calc(13px * var(--ui-font-scale, 1))', lineHeight: 1.5, color: 'var(--theme-text-dim)' }}>
          {body}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            ref={cancelButtonRef}
            className="btn btn--secondary btn--sm"
            data-ops-close-choice="cancel"
            disabled={busy}
            onClick={busy ? undefined : onCancel}
          >
            {cancelLabel}
          </button>
          <button
            className="btn btn--danger btn--sm"
            data-ops-close-choice="discard"
            disabled={busy}
            onClick={busy ? undefined : onDiscard}
          >
            {discardLabel}
          </button>
          <button
            className="btn btn--primary btn--sm"
            data-ops-close-choice="save"
            disabled={busy}
            onClick={busy ? undefined : onSave}
          >
            {saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

import type { CSSProperties, ReactNode } from 'react';

export function formatClockTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function createSnapshotStore<T>(
  initial: T,
  subscribeSource: (listener: (value: T) => void) => () => void,
): { subscribe: (onChange: () => void) => () => void; getSnapshot: () => T } {
  let cached = initial;
  subscribeSource(value => { cached = value; });
  return {
    subscribe: onChange => subscribeSource(() => onChange()),
    getSnapshot: () => cached,
  };
}

const ICON_BUTTON_STYLE: CSSProperties = {
  display: 'inline-flex',
  background: 'transparent',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--dashboard-text-muted)',
  cursor: 'pointer',
  padding: 2,
  transition: 'background 0.12s ease, color 0.12s ease',
};

export function DashboardIconButton({ onClick, title, children }: {
  onClick: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={ICON_BUTTON_STYLE}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'var(--dashboard-surface-hover)';
        e.currentTarget.style.color = 'var(--dashboard-text)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.color = 'var(--dashboard-text-muted)';
      }}
    >
      {children}
    </button>
  );
}

export function DashboardPanel({ height, toolbar, children }: {
  height: number;
  toolbar: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className="flex-shrink-0 flex flex-col border-t border-border !text-body"
      style={{
        height,
        background: 'var(--dashboard-bg)',
        color: 'var(--dashboard-text)',
        fontFamily: 'var(--font-code)',
      }}
    >
      <div
        className="flex items-center gap-1 px-2 h-6 border-b"
        style={{ borderColor: 'var(--dashboard-border-light)', background: 'var(--dashboard-surface)' }}
      >
        {toolbar}
      </div>
      {children}
    </div>
  );
}

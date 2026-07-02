import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Task } from '@/types/task';

export interface ContextMenuProps {
  x: number;
  y: number;
  task: Task | null;
  traceActive: boolean;
  onClose: () => void;
  onEdit: () => void;
  onAddSubtask: () => void;
  onAddMilestone: () => void;
  onAddRelation: () => void;
  onTracePath: () => void;
  onToggleCollapse: () => void;
  onDelete: () => void;
  onAddTask: () => void;
}

export function ContextMenu({
  x, y, task, traceActive, onClose,
  onEdit, onAddSubtask, onAddMilestone, onAddRelation, onTracePath,
  onToggleCollapse, onDelete, onAddTask,
}: ContextMenuProps) {
  const { t } = useTranslation('common');
  const menuRef = useRef<HTMLDivElement>(null);

  // onClose is in de parent een nieuwe arrow per render; via een ref blijft het
  // actueel zónder dat het effect (en z'n timer) bij elke parent-render reset.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Sluit bij klik-buiten, rechtsklik-buiten of Escape.
  // KRITIEK: lege deps → het effect draait één keer (mount), zodat de
  // setTimeout daadwerkelijk afloopt en de mousedown-listener aangehangen
  // blijft. Met [onClose] werd de timer bij elke GanttCanvas-render (o.a. bij
  // muisbeweging/hover) gereset, waardoor klik-buiten nooit werkte — alleen
  // Escape (die buiten de timer wordt toegevoegd) deed het.
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onCloseRef.current();
      }
    };
    const handleContext = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onCloseRef.current();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    // Kleine defer zodat de openende rechtsklik-event-reeks niet meteen sluit.
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
      document.addEventListener('contextmenu', handleContext);
    }, 0);
    document.addEventListener('keydown', handleKey);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('contextmenu', handleContext);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  // Adjust position to stay within viewport
  const adjustedX = Math.min(x, window.innerWidth - 200);
  const adjustedY = Math.min(y, window.innerHeight - 300);

  const isSummary = task ? task.childIds.length > 0 : false;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-surface border border-border rounded-[8px] shadow-[var(--shadow-pop)] py-1 min-w-[180px]"
      style={{ left: adjustedX, top: adjustedY }}
    >
      {task ? (
        <>
          <MenuItem label={t('context.edit')} onClick={() => { onEdit(); onClose(); }} />
          <Separator />
          <MenuItem label={t('context.addSubtask')} onClick={() => { onAddSubtask(); onClose(); }} />
          <MenuItem label={t('context.addMilestone')} onClick={() => { onAddMilestone(); onClose(); }} />
          <MenuItem label={t('context.addRelation')} onClick={() => { onAddRelation(); onClose(); }} />
          <MenuItem
            label={traceActive ? t('context.traceOff') : t('context.tracePath')}
            onClick={() => { onTracePath(); onClose(); }}
          />
          {isSummary && (
            <>
              <Separator />
              <MenuItem label={t('context.toggleCollapse')} onClick={() => { onToggleCollapse(); onClose(); }} />
            </>
          )}
          <Separator />
          <MenuItem label={t('context.delete')} danger onClick={() => { onDelete(); onClose(); }} />
        </>
      ) : (
        <>
          <MenuItem label={t('context.newTask')} onClick={() => { onAddTask(); onClose(); }} />
          <MenuItem label={t('context.addMilestone')} onClick={() => { onAddMilestone(); onClose(); }} />
        </>
      )}
    </div>
  );
}

function MenuItem({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-surface-hover transition-colors ${
        danger ? 'text-red-400 hover:text-red-300' : 'text-text-primary'
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function Separator() {
  return <div className="border-t border-border my-1" />;
}

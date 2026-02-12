import { useEffect, useRef } from 'react';
import { useI18n } from '@/i18n/i18n';
import { Task } from '@/types/task';

export interface ContextMenuProps {
  x: number;
  y: number;
  task: Task | null;
  onClose: () => void;
  onEdit: () => void;
  onAddSubtask: () => void;
  onAddMilestone: () => void;
  onAddRelation: () => void;
  onToggleCollapse: () => void;
  onDelete: () => void;
  onAddTask: () => void;
}

export function ContextMenu({
  x, y, task, onClose,
  onEdit, onAddSubtask, onAddMilestone, onAddRelation,
  onToggleCollapse, onDelete, onAddTask,
}: ContextMenuProps) {
  const { t } = useI18n();
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside or Escape (delay to avoid immediate close from the triggering right-click)
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleContext = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // Delay attaching mousedown to skip the event that opened the menu
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
      document.addEventListener('contextmenu', handleContext);
    }, 50);
    document.addEventListener('keydown', handleKey);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('contextmenu', handleContext);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  // Adjust position to stay within viewport
  const adjustedX = Math.min(x, window.innerWidth - 200);
  const adjustedY = Math.min(y, window.innerHeight - 300);

  const isSummary = task ? task.childIds.length > 0 : false;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-surface-alt border border-border rounded-lg shadow-lg py-1 min-w-[180px]"
      style={{ left: adjustedX, top: adjustedY }}
    >
      {task ? (
        <>
          <MenuItem label={t('ctx.edit')} onClick={() => { onEdit(); onClose(); }} />
          <Separator />
          <MenuItem label={t('ctx.addSubtask')} onClick={() => { onAddSubtask(); onClose(); }} />
          <MenuItem label={t('ctx.addMilestone')} onClick={() => { onAddMilestone(); onClose(); }} />
          <MenuItem label={t('ctx.addRelation')} onClick={() => { onAddRelation(); onClose(); }} />
          {isSummary && (
            <>
              <Separator />
              <MenuItem label={t('ctx.toggleCollapse')} onClick={() => { onToggleCollapse(); onClose(); }} />
            </>
          )}
          <Separator />
          <MenuItem label={t('ctx.delete')} danger onClick={() => { onDelete(); onClose(); }} />
        </>
      ) : (
        <>
          <MenuItem label={t('ctx.newTask')} onClick={() => { onAddTask(); onClose(); }} />
          <MenuItem label={t('ctx.addMilestone')} onClick={() => { onAddMilestone(); onClose(); }} />
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

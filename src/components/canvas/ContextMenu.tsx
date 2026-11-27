import { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useClickOutside } from '@/hooks/useClickOutside';
import { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import type { RelationAssignDirection } from '@/state/slices/types';
import { isSummaryTask } from '@/utils/taskHierarchy';
import { Icon } from '@/components/icons';

export interface ContextMenuGroupInfo {
  key: string;
  collapsed: boolean;
}

export interface ContextMenuProps {
  x: number;
  y: number;
  task: Task | null;
  barHit: boolean;
  group: ContextMenuGroupInfo | null;
  traceActive: boolean;
  isTreeMode: boolean;
  calendars: WorkCalendar[];
  canPaste: boolean;
  onClose: () => void;
  onEdit: () => void;
  onAddSubtask: () => void;
  onAddMilestone: () => void;
  onAddRelation: () => void;
  addRelationDisabledReason?: string;
  onAssignRelation: (direction: RelationAssignDirection) => void;
  onTracePath: () => void;
  onSaveTemplate: () => void;
  onCollapse: () => void;
  onExpand: () => void;
  onDelete: () => void;
  onDissolve: () => void;
  onAddTask: () => void;
  onInsertAbove: () => void;
  onInsertBelow: () => void;
  onIndent: () => void;
  onOutdent: () => void;
  onToggleMilestone: () => void;
  onSetCalendar: (calendarId: string | undefined) => void;
  onSetProgress: (completion: number) => void;
  onSetPriority: (priority: number) => void;
  onStartRelationFromBar: () => void;
  splitGapIndex?: number | null;
  onRemoveSplitGap?: (gapIndex: number) => void;
  onRemoveAllSplitGaps?: () => void;
  onPaste: () => void;
  onZoomReset: () => void;
  onFitToProject: () => void;
  onToggleGroupCollapse: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  showViewItems?: boolean;
}

const PRIORITY_LOW = 100;
const PRIORITY_NORMAL = 500;
const PRIORITY_HIGH = 900;

export const CONTEXT_MENU_CONTAINER_CLASS =
  'fixed z-[var(--z-contextmenu)] bg-surface border border-border rounded-[8px] shadow-[var(--shadow-pop)] py-1 min-w-[180px]';
export const CONTEXT_MENU_ITEM_CLASS =
  'w-full text-left px-3 py-1.5 text-small leading-4 hover:bg-surface-hover transition-colors flex items-center gap-1.5';

export function ContextMenu({
  x, y, task, barHit, group, traceActive, isTreeMode, calendars, canPaste, onClose,
  onEdit, onAddSubtask, onAddMilestone, onAddRelation, addRelationDisabledReason, onAssignRelation, onTracePath, onSaveTemplate,
  onCollapse, onExpand, onDelete, onDissolve, onAddTask,
  onInsertAbove, onInsertBelow, onIndent, onOutdent, onToggleMilestone,
  onSetCalendar, onSetProgress, onSetPriority,
  onStartRelationFromBar, splitGapIndex = null, onRemoveSplitGap, onRemoveAllSplitGaps,
  onPaste, onZoomReset, onFitToProject,
  onToggleGroupCollapse, onExpandAll, onCollapseAll,
  showViewItems = true,
}: ContextMenuProps) {
  const { t } = useTranslation(['common', 'menu']);
  const menuRef = useRef<HTMLDivElement>(null);
  const [openSub, setOpenSub] = useState<string | null>(null);

  useClickOutside(menuRef, onClose, true, { escape: true, contextmenu: true, defer: true });

  const [pos, setPos] = useState({ left: x, top: y });
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const { offsetWidth: w, offsetHeight: h } = el;
    setPos({
      left: Math.max(0, Math.min(x, window.innerWidth - w)),
      top: Math.max(0, Math.min(y, window.innerHeight - h)),
    });
  }, [x, y]);
  const flipSub = pos.left > window.innerWidth - 380;

  const isSummary = isSummaryTask(task ?? undefined);
  const closeAll = () => { setOpenSub(null); onClose(); };

  return (
    <div
      ref={menuRef}
      className={CONTEXT_MENU_CONTAINER_CLASS}
      style={{ left: pos.left, top: pos.top }}
      onMouseLeave={() => setOpenSub(null)}
    >
      {group ? (
        <>
          <MenuItem
            label={group.collapsed ? t('context.expandGroup') : t('context.collapseGroup')}
            onClick={() => { onToggleGroupCollapse(); closeAll(); }}
            onEnter={() => setOpenSub(null)}
          />
          <Separator />
          <MenuItem label={t('context.expandAll')} onClick={() => { onExpandAll(); closeAll(); }} onEnter={() => setOpenSub(null)} />
          <MenuItem label={t('context.collapseAll')} onClick={() => { onCollapseAll(); closeAll(); }} onEnter={() => setOpenSub(null)} />
        </>
      ) : task ? (
        <>
          {barHit && (
            <>
              <MenuItem label={t('context.startRelationHere')} onClick={() => { onStartRelationFromBar(); closeAll(); }} onEnter={() => setOpenSub(null)} />
              {(task.splitGaps?.length ?? 0) > 0 && (
                <>
                  {splitGapIndex !== null && onRemoveSplitGap && (
                    <MenuItem label={t('context.removeSplitGap')} onClick={() => { onRemoveSplitGap(splitGapIndex); closeAll(); }} onEnter={() => setOpenSub(null)} />
                  )}
                  {onRemoveAllSplitGaps && (
                    <MenuItem label={t('context.removeAllSplitGaps')} onClick={() => { onRemoveAllSplitGaps(); closeAll(); }} onEnter={() => setOpenSub(null)} />
                  )}
                </>
              )}
              <Separator />
            </>
          )}

          <MenuItem label={t('context.edit')} onClick={() => { onEdit(); closeAll(); }} onEnter={() => setOpenSub(null)} />
          <Separator />

          <MenuItem label={t('context.insertAbove')} onClick={() => { onInsertAbove(); closeAll(); }} onEnter={() => setOpenSub(null)} />
          <MenuItem label={t('context.insertBelow')} onClick={() => { onInsertBelow(); closeAll(); }} onEnter={() => setOpenSub(null)} />
          <Separator />

          <MenuItem label={t('context.addSubtask')} onClick={() => { onAddSubtask(); closeAll(); }} onEnter={() => setOpenSub(null)} />
          <MenuItem label={t('context.addMilestone')} onClick={() => { onAddMilestone(); closeAll(); }} onEnter={() => setOpenSub(null)} />
          <MenuItem label={t('context.addRelation')} disabled={addRelationDisabledReason !== undefined} title={addRelationDisabledReason} onClick={() => { onAddRelation(); closeAll(); }} onEnter={() => setOpenSub(null)} />
          <MenuItem label={t('context.assignPredecessors')} onClick={() => { onAssignRelation('predecessor'); closeAll(); }} onEnter={() => setOpenSub(null)} />
          <MenuItem label={t('context.assignSuccessors')} onClick={() => { onAssignRelation('successor'); closeAll(); }} onEnter={() => setOpenSub(null)} />
          <Separator />

          {isTreeMode && (
            <>
              <MenuItem label={t('context.indent')} onClick={() => { onIndent(); closeAll(); }} onEnter={() => setOpenSub(null)} />
              <MenuItem label={t('context.outdent')} onClick={() => { onOutdent(); closeAll(); }} onEnter={() => setOpenSub(null)} />
            </>
          )}
          <MenuItem label={t('context.toggleMilestone')} onClick={() => { onToggleMilestone(); closeAll(); }} onEnter={() => setOpenSub(null)} />
          <Separator />

          <SubMenuTrigger
            label={t('context.calendarMenu')}
            open={openSub === 'calendar'}
            flip={flipSub}
            onEnter={() => setOpenSub('calendar')}
          >
            <MenuItem
              label={t('context.calendarProjectDefault')}
              checked={!task.calendarId}
              onClick={() => { onSetCalendar(undefined); closeAll(); }}
            />
            {calendars.map((cal) => (
              <MenuItem
                key={cal.id}
                label={cal.name}
                checked={task.calendarId === cal.id}
                onClick={() => { onSetCalendar(cal.id); closeAll(); }}
              />
            ))}
          </SubMenuTrigger>

          <SubMenuTrigger
            label={t('context.progressMenu')}
            open={openSub === 'progress'}
            flip={flipSub}
            onEnter={() => setOpenSub('progress')}
          >
            {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
              <MenuItem
                key={pct}
                label={`${Math.round(pct * 100)}%`}
                checked={Math.abs(task.time.completion - pct) < 1e-9}
                onClick={() => { onSetProgress(pct); closeAll(); }}
              />
            ))}
          </SubMenuTrigger>

          <SubMenuTrigger
            label={t('context.priorityMenu')}
            open={openSub === 'priority'}
            flip={flipSub}
            onEnter={() => setOpenSub('priority')}
          >
            <MenuItem label={t('context.priorityLow')} checked={task.priority === PRIORITY_LOW} onClick={() => { onSetPriority(PRIORITY_LOW); closeAll(); }} />
            <MenuItem label={t('context.priorityNormal')} checked={task.priority === PRIORITY_NORMAL} onClick={() => { onSetPriority(PRIORITY_NORMAL); closeAll(); }} />
            <MenuItem label={t('context.priorityHigh')} checked={task.priority === PRIORITY_HIGH} onClick={() => { onSetPriority(PRIORITY_HIGH); closeAll(); }} />
          </SubMenuTrigger>
          <Separator />

          <MenuItem
            label={traceActive ? t('context.traceOff') : t('context.tracePath')}
            onClick={() => { onTracePath(); closeAll(); }}
            onEnter={() => setOpenSub(null)}
          />
          {isSummary && (
            <>
              <Separator />
              <MenuItem label={t('menu:ribbon.collapseTasks')} onClick={() => { onCollapse(); closeAll(); }} onEnter={() => setOpenSub(null)} />
              <MenuItem label={t('menu:ribbon.expandTasks')} onClick={() => { onExpand(); closeAll(); }} onEnter={() => setOpenSub(null)} />
              <MenuItem label={t('context.saveTemplate')} onClick={() => { onSaveTemplate(); closeAll(); }} onEnter={() => setOpenSub(null)} />
            </>
          )}
          <Separator />
          <MenuItem label={t('context.dissolve')} onClick={() => { onDissolve(); closeAll(); }} onEnter={() => setOpenSub(null)} />
          <MenuItem label={t('context.delete')} danger onClick={() => { onDelete(); closeAll(); }} onEnter={() => setOpenSub(null)} />
        </>
      ) : (
        <>
          <MenuItem label={t('context.newTask')} onClick={() => { onAddTask(); closeAll(); }} onEnter={() => setOpenSub(null)} />
          <MenuItem label={t('context.addMilestone')} onClick={() => { onAddMilestone(); closeAll(); }} onEnter={() => setOpenSub(null)} />
          <Separator />
          <MenuItem
            label={t('context.paste')}
            disabled={!canPaste}
            onClick={() => { if (canPaste) { onPaste(); closeAll(); } }}
            onEnter={() => setOpenSub(null)}
          />
          {showViewItems && (
            <>
              <Separator />
              <MenuItem label={t('context.zoomReset')} onClick={() => { onZoomReset(); closeAll(); }} onEnter={() => setOpenSub(null)} />
              <MenuItem label={t('context.fitToProject')} onClick={() => { onFitToProject(); closeAll(); }} onEnter={() => setOpenSub(null)} />
            </>
          )}
        </>
      )}
    </div>
  );
}

function MenuItem({
  label, onClick, danger, checked, disabled, onEnter, title,
}: {
  label: string;
  title?: string;
  onClick: () => void;
  danger?: boolean;
  checked?: boolean;
  disabled?: boolean;
  onEnter?: () => void;
}) {
  return (
    <button
      className={`${CONTEXT_MENU_ITEM_CLASS} ${
        disabled ? 'text-text-primary opacity-40 cursor-not-allowed' : danger ? 'text-red-400 hover:text-red-300' : 'text-text-primary'
      }`}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={onEnter}
      disabled={disabled}
      title={title}
      data-ops-context-disabled={disabled || undefined}
    >
      {checked !== undefined && (
        <span className="inline-flex w-4 shrink-0">{checked ? <Icon id="menu.item-checked" size={16} /> : null}</span>
      )}
      {label}
    </button>
  );
}

function SubMenuTrigger({
  label, open, flip, onEnter, children,
}: {
  label: string;
  open: boolean;
  flip: boolean;
  onEnter: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative" onMouseEnter={onEnter}>
      <div className="w-full flex items-center justify-between gap-3 px-3 py-1.5 text-small leading-4 text-text-primary hover:bg-surface-hover transition-colors cursor-default select-none">
        <span>{label}</span>
        <Icon id="menu.submenu" size={16} className={flip ? '-scale-x-100' : undefined} />
      </div>
      {open && (
        <div
          className={`absolute top-0 bg-surface border border-border rounded-[8px] shadow-[var(--shadow-pop)] py-1 min-w-[160px] z-[var(--z-contextmenu)] ${
            flip ? 'right-full' : 'left-full'
          }`}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function Separator() {
  return <div className="border-t border-border my-1" />;
}

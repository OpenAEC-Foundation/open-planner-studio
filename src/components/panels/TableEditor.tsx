import { useState, useCallback, useMemo, useEffect } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { Task } from '@/types/task';
import { CustomFieldDef, CustomFieldValue } from '@/types/structure';
import { defaultColumns } from '@/engine/view/visibleRows';
import { resourceCellValue, type ViewContext } from '@/engine/view/filterEval';
import type { ColumnConfig, FieldRef, BuiltinFieldKey } from '@/state/slices/types';
import { useTaskTypeLabels } from '@/i18n/taskTypes';
import { DateTextInput } from '@/components/common/DateTextInput';
import { useDisplayDate } from '@/hooks/displayDate';
import { effectiveCalendarOf, effHoursPerDay, formatTaskDurationDisplay, detectMixedCalendars, durationSuffixesFrom } from '@/utils/taskDuration';
import { isHourCalendar } from '@/services/subdayIo';
import { parseDuration, formatDuration } from '@/utils/durationFormat';
import { AlertTriangle } from 'lucide-react';

const MIN_COLUMN_WIDTH = 40;

/** Compacte, altijd-bewerkbare celvariant voor een custom field (tabelrij). */
function FieldCell({ def, value, onCommit }: {
  def: CustomFieldDef;
  value: CustomFieldValue | undefined;
  onCommit: (value: CustomFieldValue | null) => void;
}) {
  const cls = 'input !text-[10px] !px-1 !py-0.5 w-full';
  if (def.type === 'boolean') {
    return (
      <input type="checkbox" checked={value === true}
        onChange={e => onCommit(e.target.checked ? true : null)}
        onClick={e => e.stopPropagation()}
        className="w-3.5 h-3.5 accent-[var(--theme-accent)]" />
    );
  }
  if (def.type === 'date') {
    return (
      <span onClick={e => e.stopPropagation()} className="block w-full">
        <DateTextInput value={typeof value === 'string' ? value : ''}
          onCommit={v => onCommit(v || null)} className={cls} />
      </span>
    );
  }
  if (def.type === 'text') {
    return (
      <input value={typeof value === 'string' ? value : ''}
        onChange={e => onCommit(e.target.value || null)}
        onClick={e => e.stopPropagation()} className={cls} />
    );
  }
  return (
    <input type="number" step={def.type === 'integer' ? 1 : 'any'}
      value={typeof value === 'number' ? value : ''}
      onChange={e => {
        const raw = e.target.value;
        if (raw === '') { onCommit(null); return; }
        const n = def.type === 'integer' ? parseInt(raw, 10) : parseFloat(raw);
        if (Number.isFinite(n)) onCommit(n);
      }}
      onClick={e => e.stopPropagation()} className={cls + ' text-right'} />
  );
}

/** Uitlijning per builtin-veld (reproduceert de oude vaste kolommen). */
const BUILTIN_ALIGN: Partial<Record<BuiltinFieldKey, 'right' | 'center'>> = {
  duration: 'right',
  totalFloat: 'right',
  completion: 'right',
  isCritical: 'center',
  // Fase 2.9 (§3.5): additieve analyse-velden.
  freeFloat: 'right',
  interferingFloat: 'right',
  floatPath: 'right',
  isNearCritical: 'center',
};

const BUILTIN_LABEL_KEY = {
  wbsCode: 'table.wbs',
  name: 'table.name',
  duration: 'table.duration',
  start: 'table.start',
  finish: 'table.finish',
  taskType: 'table.type',
  isCritical: 'table.critical',
  totalFloat: 'table.totalFloat',
  completion: 'table.completion',
  isMilestone: 'table.milestone',
  // Fase 2.9 (§3.5): additieve analyse-velden.
  freeFloat: 'table.freeFloat',
  interferingFloat: 'table.interferingFloat',
  isNearCritical: 'table.isNearCritical',
  floatPath: 'table.floatPath',
} as const satisfies Record<BuiltinFieldKey, string>;

export function TableEditor() {
  const { t } = useTranslation('task');
  const { t: tCommon } = useTranslation('common');
  const dd = useDisplayDate();
  const { labels: taskTypeLabels } = useTaskTypeLabels();
  const tasks = useAppStore(s => s.tasks);
  const updateTask = useAppStore(s => s.updateTask);
  const selectTask = useAppStore(s => s.selectTask);
  const selectedTaskIds = useAppStore(s => s.selectedTaskIds);
  const collapsedTaskIds = useAppStore(s => s.ui.collapsedTaskIds);
  const toggleCollapse = useAppStore(s => s.toggleCollapse);
  const activityCodeTypes = useAppStore(s => s.activityCodeTypes);
  const customFieldDefs = useAppStore(s => s.customFieldDefs);
  const wbsAutoNumber = useAppStore(s => !!s.project.wbsAutoNumber);
  const setTaskActivityCode = useAppStore(s => s.setTaskActivityCode);
  const setTaskCustomField = useAppStore(s => s.setTaskCustomField);
  // Fase 2.7 (§4/§5): DE gedeelde zichtbare-rijenlijst + kolom-config.
  const viewRows = useAppStore(s => s.viewRows);
  const viewColumns = useAppStore(s => s.view.columns);
  const setCollapsedGroupKey = useAppStore(s => s.setCollapsedGroupKey);
  const resources = useAppStore(s => s.resources);
  const assignments = useAppStore(s => s.assignments);
  // Duurweergave (§6.5): effectieve kalender per taak → geformatteerde duur + mixed-detectie.
  const projectCal = useAppStore(s => s.calendar);
  const calendars = useAppStore(s => s.calendars);
  const enableHourPlanning = useAppStore(s => s.ui.enableHourPlanning);
  const durationDisplay = useAppStore(s => s.ui.durationDisplay);

  const [editCell, setEditCell] = useState<{ taskId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [resizing, setResizing] = useState<{ index: number; startX: number; startWidth: number } | null>(null);

  // Mixed-kalender-detectie (§6.5): alleen relevant als Urenplanning aan staat (anders byte-identiek).
  const mixed = useMemo(
    () => detectMixedCalendars(tasks, projectCal, calendars),
    [tasks, projectCal, calendars],
  );
  const showMixedWarning = enableHourPlanning && mixed.mixed;
  // Vertaalde eenheid-suffixen voor de WEERGAVE (§6.4/§11); edit-seeds houden bewust de parsebare vorm.
  const durationSuffixes = durationSuffixesFrom(tCommon);
  // Per-kalender-hoursPerDay-tooltip (§6.5): "Naam: 8 u/dag, …" — toont waaróm de eenheden mengen.
  const mixedTooltipList = mixed.calendars
    .map(c => `${c.name}: ${c.hpd} ${t('table.hoursPerDayTip')}`)
    .join(', ');

  // Geformatteerde duurweergave (§6.5) + parseerbare edit-seed (uur-taak ⇒ uur-vorm via parseDuration).
  const durationDisplayValue = (task: Task): string =>
    formatTaskDurationDisplay(task, effectiveCalendarOf(task, projectCal, calendars), durationDisplay, enableHourPlanning, durationSuffixes);
  const durationEditSeed = (task: Task): string => {
    const cal = effectiveCalendarOf(task, projectCal, calendars);
    if (enableHourPlanning && isHourCalendar(cal) && !task.isMilestone) {
      const hpd = effHoursPerDay(cal);
      const min = task.time.durationMinutes ?? task.time.scheduleDuration * hpd * 60;
      return formatDuration(min, hpd, 'hours');
    }
    return `${task.isMilestone ? 0 : task.time.scheduleDuration}`;
  };
  const durationCellTitle = (task: Task): string | undefined => {
    if (!enableHourPlanning) return undefined;
    return `${effHoursPerDay(effectiveCalendarOf(task, projectCal, calendars))} ${t('table.hoursPerDayTip')}`;
  };

  // Kolom-config (§5.2): view.columns of de defaults; onbekende refs worden overgeslagen bij
  // render maar blijven in de config bewaard (§8.4 — geldig in een ander document).
  const columns = useMemo<ColumnConfig[]>(
    () => viewColumns ?? defaultColumns(activityCodeTypes, customFieldDefs),
    [viewColumns, activityCodeTypes, customFieldDefs],
  );
  const knownRef = useCallback((f: FieldRef): boolean => {
    if (f.src === 'activityCode') return activityCodeTypes.some(ct => ct.id === f.typeId);
    if (f.src === 'customField') return customFieldDefs.some(d => d.id === f.defId);
    return true;
  }, [activityCodeTypes, customFieldDefs]);
  const visibleColumns = useMemo(
    () => columns
      .map((col, index) => ({ col, index }))
      .filter(({ col }) => col.visible && knownRef(col.field)),
    [columns, knownRef],
  );
  const totalWidth = visibleColumns.reduce((acc, { col }) => acc + col.width, 0);

  // Resolver-context voor de read-only resource-kolom (§5.3, één join-implementatie).
  const viewCtx = useMemo<ViewContext>(() => ({
    activityCodeTypes, customFieldDefs, resources, assignments,
    noneLabel: t('structure.none'),
  }), [activityCodeTypes, customFieldDefs, resources, assignments, t]);

  // Kolombreedte sleepbaar in de header (§5.5): schrijft width terug via setColumns.
  const startColumnResize = useCallback((e: React.MouseEvent, index: number, width: number) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing({ index, startX: e.clientX, startWidth: width });
  }, []);
  useEffect(() => {
    if (!resizing) return;
    const handleMove = (e: MouseEvent) => {
      const s = useAppStore.getState();
      const all = s.view.columns ?? defaultColumns(s.activityCodeTypes, s.customFieldDefs);
      const w = Math.max(MIN_COLUMN_WIDTH, Math.round(resizing.startWidth + e.clientX - resizing.startX));
      if (all[resizing.index]?.width === w) return;
      s.setColumns(all.map((c, i) => (i === resizing.index ? { ...c, width: w } : c)));
    };
    const handleUp = () => setResizing(null);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [resizing]);

  // Alleen taakrijen (voor celnavigatie); de gedeelde lijst zelf blijft leidend voor de render.
  const taskRows = useMemo(
    () => viewRows.filter((r): r is Extract<typeof r, { kind: 'task' }> => r.kind === 'task'),
    [viewRows],
  );

  const startEdit = useCallback((taskId: string, field: string, value: string) => {
    setEditCell({ taskId, field });
    setEditValue(value);
  }, []);

  const commitEdit = useCallback(() => {
    if (!editCell) return;
    const { taskId, field } = editCell;
    const task = tasks.find(t2 => t2.id === taskId);
    if (!task) { setEditCell(null); return; }

    if (field === 'name') {
      updateTask(taskId, { name: editValue });
    } else if (field === 'wbsCode') {
      updateTask(taskId, { wbsCode: editValue });
    } else if (field === 'duration') {
      // Mijlpalen hebben per definitie duur 0 — een ingevoerde duur zou stil
      // divergeren van wat CPM en de canvas-tabel tonen.
      if (!task.isMilestone) {
        const cal = effectiveCalendarOf(task, projectCal, calendars);
        if (enableHourPlanning && isHourCalendar(cal)) {
          // Uur-taak (§6.4): accepteert "20u"/"2d 4u"/"90m" via parseDuration (hele eenheden).
          // Een parse-fout (o.a. decimalen) laat de duur onveranderd.
          const hpd = effHoursPerDay(cal);
          const min = parseDuration(editValue, hpd);
          if (min != null) {
            updateTask(taskId, { time: { ...task.time, durationMinutes: min, scheduleDuration: hpd > 0 ? min / (hpd * 60) : task.time.scheduleDuration } });
          }
        } else {
          updateTask(taskId, { time: { ...task.time, scheduleDuration: parseInt(editValue) || 0 } });
        }
      }
    } else if (field === 'start') {
      updateTask(taskId, { time: { ...task.time, scheduleStart: editValue } });
    } else if (field === 'finish') {
      updateTask(taskId, { time: { ...task.time, scheduleFinish: editValue } });
    } else if (field === 'completion') {
      updateTask(taskId, { time: { ...task.time, completion: (parseInt(editValue) || 0) / 100 } });
    }
    setEditCell(null);
  }, [editCell, editValue, tasks, updateTask, projectCal, calendars, enableHourPlanning]);

  // Navigeerbare (bewerkbare) velden, in de volgorde van de zichtbare kolommen.
  const editableFields = useMemo(() => {
    const editable = new Set(['wbsCode', 'name', 'duration', 'start', 'finish', 'completion']);
    if (wbsAutoNumber) editable.delete('wbsCode');
    const keys: string[] = [];
    for (const { col } of visibleColumns) {
      if (col.field.src === 'builtin' && editable.has(col.field.key)) keys.push(col.field.key);
    }
    return keys;
  }, [visibleColumns, wbsAutoNumber]);

  const getCellValue = (task: Task, field: string): string => {
    if (field === 'name') return task.name;
    if (field === 'wbsCode') return task.wbsCode;
    if (field === 'duration') return durationEditSeed(task);
    if (field === 'start') return task.time.earlyStart || task.time.scheduleStart;
    if (field === 'finish') return task.time.earlyFinish || task.time.scheduleFinish;
    if (field === 'completion') return `${Math.round(task.time.completion * 100)}`;
    return '';
  };

  const navigateCell = useCallback((taskId: string, field: string, direction: 'up' | 'down' | 'left' | 'right') => {
    commitEdit();
    const rowIndex = taskRows.findIndex(r => r.task.id === taskId);
    const colIndex = editableFields.indexOf(field);
    if (rowIndex === -1 || colIndex === -1) return;

    let newRow = rowIndex;
    let newCol = colIndex;

    if (direction === 'up') newRow = Math.max(0, rowIndex - 1);
    else if (direction === 'down') newRow = Math.min(taskRows.length - 1, rowIndex + 1);
    else if (direction === 'left') newCol = Math.max(0, colIndex - 1);
    else if (direction === 'right') newCol = Math.min(editableFields.length - 1, colIndex + 1);

    if (newRow === rowIndex && newCol === colIndex) return;

    const nextTask = taskRows[newRow].task;
    const nextField = editableFields[newCol];
    const nextValue = getCellValue(nextTask, nextField);
    selectTask(nextTask.id);
    startEdit(nextTask.id, nextField, nextValue);
  }, [taskRows, editableFields, commitEdit, selectTask, startEdit]);

  const handleCellKeyDown = useCallback((e: React.KeyboardEvent, taskId: string, field: string) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      navigateCell(taskId, field, 'down');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      navigateCell(taskId, field, 'up');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      navigateCell(taskId, field, e.shiftKey ? 'left' : 'right');
    } else if (e.key === 'Escape') {
      setEditCell(null);
    }
  }, [navigateCell]);

  // `displayValue` (optioneel): wat de cel TOONT wanneer hij niet in bewerking is — voor datumcellen
  // de notatie-geformatteerde datum. De bewerk-/navigatiewaarde blijft `value` (ISO), dus dubbelklik
  // en commit gedragen zich onveranderd; alleen de weergave volgt de datumnotatie-instelling.
  const renderCell = (taskId: string, field: string, value: string, align = 'left', displayValue?: string) => {
    const isEditing = editCell?.taskId === taskId && editCell?.field === field;
    if (isEditing) {
      return (
        <input
          autoFocus
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={e => handleCellKeyDown(e, taskId, field)}
          className="w-full px-1 py-0.5 text-xs outline-none"
          style={{
            textAlign: align as 'left' | 'right' | 'center',
            background: 'var(--theme-input-bg)',
            color: 'var(--theme-text)',
            border: '1px solid var(--theme-accent)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: '0 0 0 3px rgba(217, 119, 6, 0.20)',
          }}
        />
      );
    }
    return (
      <span
        className="block truncate cursor-text px-1"
        style={{ textAlign: align as 'left' | 'right' | 'center' }}
        onDoubleClick={() => startEdit(taskId, field, value)}
      >
        {displayValue ?? value}
      </span>
    );
  };

  const columnLabel = (field: FieldRef): string => {
    if (field.src === 'builtin') return t(BUILTIN_LABEL_KEY[field.key]);
    if (field.src === 'activityCode') return activityCodeTypes.find(ct => ct.id === field.typeId)?.name ?? '';
    if (field.src === 'customField') return customFieldDefs.find(d => d.id === field.defId)?.name ?? '';
    return t('column.resource');
  };

  /** Cel-inhoud voor één kolom van één taakrij (naamkolom heeft een eigen tak in de rij-render). */
  const renderColumnCell = (col: ColumnConfig, task: Task, isSummary: boolean) => {
    const f = col.field;
    if (f.src === 'builtin') {
      switch (f.key) {
        case 'wbsCode':
          return wbsAutoNumber
            ? <span className="px-1 truncate">{task.wbsCode}</span>
            : renderCell(task.id, 'wbsCode', task.wbsCode);
        case 'duration':
          return (
            <span title={durationCellTitle(task)} className="block" data-ops-dur-cell={task.id}>
              {renderCell(task.id, 'duration', durationEditSeed(task), 'right', durationDisplayValue(task))}
            </span>
          );
        case 'start': {
          const startIso = task.time.earlyStart || task.time.scheduleStart;
          return (
            <>
              {renderCell(task.id, 'start', startIso, 'left', dd.date(startIso))}
              {task.constraint && ['SNET', 'SNLT', 'MSO'].includes(task.constraint.type) && (
                <span title={t('properties.hasConstraint')} style={{ color: 'var(--theme-accent)' }}>*</span>
              )}
            </>
          );
        }
        case 'finish': {
          const finishIso = task.time.earlyFinish || task.time.scheduleFinish;
          return (
            <>
              {renderCell(task.id, 'finish', finishIso, 'left', dd.date(finishIso))}
              {task.constraint && ['FNET', 'FNLT', 'MFO'].includes(task.constraint.type) && (
                <span title={t('properties.hasConstraint')} style={{ color: 'var(--theme-accent)' }}>*</span>
              )}
            </>
          );
        }
        case 'taskType':
          return <span className="text-[10px]">{taskTypeLabels[task.taskType] || task.taskType}</span>;
        case 'isCritical':
          return task.time.isCritical
            ? <span className="text-critical font-bold">{tCommon('yes')}</span>
            : <span className="text-text-secondary">{tCommon('no')}</span>;
        case 'totalFloat':
          return (
            <span
              className={task.time.totalFloat < 0 ? '' : 'text-text-secondary'}
              style={task.time.totalFloat < 0 ? { color: 'var(--error)', fontWeight: 600 } : undefined}
            >
              {task.time.totalFloat}{tCommon('days')}
            </span>
          );
        case 'completion':
          return (
            <>
              {renderCell(task.id, 'completion', `${Math.round(task.time.completion * 100)}`, 'right')}
              <span className="text-text-secondary ml-0.5">%</span>
            </>
          );
        case 'isMilestone':
          return <span>{task.isMilestone ? tCommon('yes') : tCommon('no')}</span>;
        // Fase 2.9 (§3.5): additieve, read-only analyse-velden. freeFloat is altijd aanwezig; de
        // andere drie zijn optioneel en tonen leeg tot de bijbehorende analyse-golf ze schrijft.
        case 'freeFloat':
          return <span className="text-text-secondary">{task.time.freeFloat}{tCommon('days')}</span>;
        case 'interferingFloat':
          return task.time.interferingFloat === undefined
            ? null
            : <span className="text-text-secondary">{task.time.interferingFloat}{tCommon('days')}</span>;
        case 'isNearCritical':
          return <span>{task.time.isNearCritical ? tCommon('yes') : tCommon('no')}</span>;
        case 'floatPath':
          return task.time.floatPath === undefined
            ? null
            : <span className="text-text-secondary">{task.time.floatPath}</span>;
        default:
          return null;
      }
    }
    if (f.src === 'activityCode') {
      const ct = activityCodeTypes.find(x => x.id === f.typeId);
      if (!ct || isSummary) return null;
      return (
        <select
          value={task.activityCodes?.[ct.id] ?? ''}
          onChange={e => setTaskActivityCode(task.id, ct.id, e.target.value || null)}
          onClick={e => e.stopPropagation()}
          className="input !text-[10px] !px-1 !py-0.5 w-full"
        >
          <option value=""></option>
          {ct.values.map(v => (
            <option key={v.id} value={v.id}>{v.code}</option>
          ))}
        </select>
      );
    }
    if (f.src === 'customField') {
      const def = customFieldDefs.find(d => d.id === f.defId);
      if (!def || isSummary) return null;
      return (
        <FieldCell
          def={def}
          value={task.customFields?.[def.id]}
          onCommit={value => setTaskCustomField(task.id, def.id, value)}
        />
      );
    }
    // Resource-kolom (§5.3): read-only join via de gedeelde resolver.
    return <span className="truncate text-text-secondary">{resourceCellValue(task, viewCtx)}</span>;
  };

  const cellAlign = (f: FieldRef): 'left' | 'right' | 'center' =>
    (f.src === 'builtin' && BUILTIN_ALIGN[f.key]) || 'left';

  return (
    <div className="flex-1 flex flex-col overflow-auto bg-surface">
      {/* Header — sticky thead per LAYOUTS.md §3.2; kolombreedtes sleepbaar (§5.5) */}
      <div
        className="sticky top-0 z-10 flex bg-surface-alt text-[10px] font-bold uppercase tracking-wider select-none"
        style={{
          minHeight: 28,
          minWidth: totalWidth,
          fontFamily: 'var(--font-heading)',
          letterSpacing: '0.08em',
          color: 'var(--theme-text-muted)',
          borderBottom: '1px solid var(--theme-border)',
        }}
      >
        {visibleColumns.map(({ col, index }) => {
          const isName = col.field.src === 'builtin' && col.field.key === 'name';
          const align = cellAlign(col.field);
          return (
            <div
              key={index}
              className="relative flex items-center px-2"
              style={{
                width: col.width,
                flex: isName ? `1 0 ${col.width}px` : `0 0 ${col.width}px`,
                justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
              }}
            >
              <span className="truncate">{columnLabel(col.field)}</span>
              {/* Mixed-kalender-waarschuwing (§6.5): discrete indicatie + hoursPerDay-hint bij de
                  duurkolomkop wanneer het project duur-eenheden mengt. Geen blokkerende dialoog. */}
              {showMixedWarning && col.field.src === 'builtin' && col.field.key === 'duration' && (
                <span
                  className="ml-1 shrink-0 inline-flex text-amber-500"
                  data-ops-mixed-warning
                  title={t('table.mixedWarning', { list: mixedTooltipList })}
                >
                  <AlertTriangle size={12} />
                </span>
              )}
              {/* Sleep-handle op de rechterrand (schrijft width terug via setColumns) */}
              <div
                onMouseDown={e => startColumnResize(e, index, col.width)}
                className="absolute top-0 right-0 h-full"
                style={{ width: 5, cursor: 'col-resize' }}
              />
            </div>
          );
        })}
      </div>

      {/* Rows — exact dezelfde gedeelde viewRows als de Gantt (§4) */}
      <div className="flex-1" style={{ minWidth: totalWidth }}>
        {viewRows.map((row, rowIdx) => {
          if (row.kind === 'group') {
            // Bandkop-rij (§4.4/§7.3): label + count, inklapbaar op de pad-gecodeerde sleutel.
            return (
              <div
                key={`band-${row.key}-${rowIdx}`}
                className="flex items-center gap-1.5 text-xs font-semibold px-2 cursor-pointer select-none"
                style={{
                  minHeight: 26,
                  paddingLeft: 8 + row.levelIndex * 14,
                  background: 'var(--theme-border)' + '1A',
                  borderBottom: '1px solid var(--theme-border-light)',
                }}
                onClick={() => setCollapsedGroupKey(row.key, !row.collapsed)}
              >
                <span className="w-4 flex items-center justify-center text-text-secondary flex-shrink-0">
                  {row.collapsed ? '▶' : '▼'}
                </span>
                <span className="truncate">{row.label}</span>
                <span className="text-text-secondary font-normal">({row.count})</span>
              </div>
            );
          }
          const { task, depth, dimmed } = row;
          const isSummary = task.childIds.length > 0;
          const isCollapsed = collapsedTaskIds.includes(task.id);
          const isSelected = selectedTaskIds.includes(task.id);

          return (
            <div
              key={`${task.id}-${rowIdx}`}
              className={`flex text-xs hover:bg-surface-hover cursor-default ${isSummary ? 'font-semibold' : ''}`}
              style={{
                minHeight: 26,
                borderBottom: '1px solid var(--theme-border-light)',
                // Gedimde rij (filter-ouderketen, §4.2): visueel dimmen.
                ...(dimmed ? { opacity: 0.5 } : {}),
                ...(isSelected
                  ? {
                      background: 'var(--theme-accent-soft, rgba(217,119,6,.10))',
                      boxShadow: 'inset 2px 0 0 var(--theme-accent)',
                    }
                  : {}),
              }}
              onClick={() => selectTask(task.id)}
            >
              {visibleColumns.map(({ col, index }) => {
                const isName = col.field.src === 'builtin' && col.field.key === 'name';
                if (isName) {
                  return (
                    <div
                      key={index}
                      className="px-2 flex items-center gap-1 min-w-0"
                      style={{ flex: `1 0 ${col.width}px`, width: col.width, paddingLeft: 8 + depth * 16 }}
                    >
                      {isSummary && (
                        <button
                          onClick={e => { e.stopPropagation(); toggleCollapse(task.id); }}
                          className="w-4 h-4 flex items-center justify-center text-text-secondary hover:text-text-primary flex-shrink-0"
                        >
                          {isCollapsed ? '▶' : '▼'}
                        </button>
                      )}
                      {!isSummary && <span className="w-4" />}
                      <span className="flex-1 min-w-0">
                        {renderCell(task.id, 'name', task.name)}
                      </span>
                    </div>
                  );
                }
                const align = cellAlign(col.field);
                return (
                  <div
                    key={index}
                    className="px-1 flex items-center min-w-0"
                    style={{
                      flex: `0 0 ${col.width}px`,
                      width: col.width,
                      justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
                      ...(col.field.src === 'builtin' && ['wbsCode', 'start', 'finish', 'taskType'].includes(col.field.key)
                        ? { color: 'var(--theme-text-dim)' }
                        : {}),
                    }}
                  >
                    {renderColumnCell(col, task, isSummary)}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

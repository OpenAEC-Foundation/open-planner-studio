import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { Task } from '@/types/task';
import { CustomFieldDef, CustomFieldValue } from '@/types/structure';
import { defaultColumns, isTreeMode } from '@/engine/view/visibleRows';
import { insertTaskRelativeToScope } from '@/state/taskInsertActions';
import { resourceCellValue, type ViewContext } from '@/engine/view/filterEval';
import type { ColumnConfig, FieldRef, BuiltinFieldKey } from '@/state/slices/types';
import { useTaskTypeLabels } from '@/i18n/taskTypes';
import { DateTextInput, parseFlexibleDate } from '@/components/common/DateTextInput';
import { useDisplayDate } from '@/hooks/displayDate';
import { effectiveCalendarOf, effHoursPerDay, formatTaskDurationDisplay, detectMixedCalendars, durationSuffixesFrom } from '@/utils/taskDuration';
import { parseDuration, formatDuration } from '@/utils/durationFormat';
import { AlertTriangle } from 'lucide-react';
import { useTableRowDrag } from './hooks/useTableRowDrag';
import { neighbourGridCell, type GridDirection } from '@/utils/gridNavigation';

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
  // Filter-only synthetisch veld (issue-discussie #32) — nooit een kolom, maar de Record moet
  // exhaustief blijven t.o.v. BuiltinFieldKey.
  activeDuring: 'table.activeDuring',
} as const satisfies Record<BuiltinFieldKey, string>;

export function TableEditor() {
  const { t } = useTranslation('task');
  const { t: tCommon } = useTranslation('common');
  const dd = useDisplayDate();
  const { labels: taskTypeLabels } = useTaskTypeLabels();
  const tasks = useAppStore(s => s.tasks);
  const updateTask = useAppStore(s => s.updateTask);
  const selectTask = useAppStore(s => s.selectTask);
  // issue #26: voortgang loopt via de bewaakte route (statusdatum-invarianten, auto actualStart).
  const setTaskProgress = useAppStore(s => s.setTaskProgress);
  const view = useAppStore(s => s.view);
  const selectedTaskIds = useAppStore(s => s.selectedTaskIds);
  // issue #26: Tab/Shift+Tab springt rijen in/uit; buiten pure boommodus legt de melding uit waarom niet.
  const indentTasks = useAppStore(s => s.indentTasks);
  const outdentTasks = useAppStore(s => s.outdentTasks);
  const notifyStructureLocked = useAppStore(s => s.notifyStructureLocked);
  // issue #26 punt 6: rijen verticaal slepen in de tabel (zelfde doelberekening als het canvas).
  const moveTaskTo = useAppStore(s => s.moveTaskTo);
  // issue #26 (vervolgmelding): sleep je een rij uit een meervoudige selectie, dan gaat de hele
  // groep mee — in één undo-stap, met behoud van hun onderlinge volgorde.
  const moveTasksTo = useAppStore(s => s.moveTasksTo);
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
  // issue #26 (spreadsheet-gevoel): de cel waar de cursor "staat" zonder dat er getypt wordt —
  // één klik zet hem, typen/F2/Enter start pas de bewerking.
  const [activeCell, setActiveCell] = useState<{ taskId: string; field: string } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Spiegel van `editCell` voor de focus-herstelcheck ná de render (zie restoreGridFocus).
  const editCellRef = useRef<{ taskId: string; field: string } | null>(null);
  useEffect(() => { editCellRef.current = editCell; }, [editCell]);

  // Punt D (issue #26): na een commit hoort de focus terug op het raster, anders werkt
  // "typen om te bewerken" niet meer zodra je één keer een cel bewerkt hebt. We plannen het
  // herstel ná de render en slaan het over wanneer (a) er intussen een nieuwe bewerking loopt
  // — een navigatiesprong, waar de autoFocus-input de focus hoort te houden — of (b) de focus
  // bewust naar iets anders is geklikt (ribbon, select in een rij): dan staat er een echt
  // element scherp en kapen we hem niet terug.
  const restoreGridFocus = useCallback(() => {
    requestAnimationFrame(() => {
      if (editCellRef.current) return;
      const active = document.activeElement;
      if (active && active !== document.body) return;
      containerRef.current?.focus({ preventScroll: true });
    });
  }, []);

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
  // useCallback met de ECHTE dependencies: deze seed wordt niet alleen in de render gebruikt maar
  // ook door `getCellValue`, en die hangt weer in de dependency-arrays van de toetsenbord-handlers.
  // Zonder dit leest een handler-closure verouderde kalender-/urenplanning-state (er is geen lint
  // die dat hier vangt).
  const durationEditSeed = useCallback((task: Task): string => {
    const cal = effectiveCalendarOf(task, projectCal, calendars);
    if (enableHourPlanning && task.time.durationUnit === 'hours' && !task.isMilestone) {
      const hpd = effHoursPerDay(cal);
      const min = task.time.durationMinutes ?? task.time.scheduleDuration * hpd * 60;
      return formatDuration(min, hpd, 'hours');
    }
    return `${task.isMilestone ? 0 : task.time.scheduleDuration}`;
  }, [projectCal, calendars, enableHourPlanning]);
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

  // issue #26 punt 6: verticaal rijen slepen. `rows` is bewust de VOLLEDIGE viewRows (inclusief
  // groepsrijen) — `data-ops-row-index` en `resolveDropTarget` indexeren daarin, niet in taskRows.
  const tasksById = useMemo(() => new Map(tasks.map(t2 => [t2.id, t2])), [tasks]);
  const justDraggedRef = useRef(false);
  const { startRowDrag, dragState: rowDragState, active: rowDragActive } = useTableRowDrag({
    rows: viewRows,
    tasksById,
    moveTaskTo,
    selectedTaskIds,
    moveTasksTo,
    enabled: isTreeMode(view),
    onBlocked: notifyStructureLocked,
    justDraggedRef,
  });

  // "Selecteer alles bij het openen" (issue #26): opent de bewerking met de BESTAANDE waarde, dan
  // hoort de eerstvolgende toets die waarde te vervangen — het hernoem-gedrag uit de
  // bestandsverkenner. Alleen op de klik- en F2-route. Bewust NIET op de typ-route
  // (`startEdit(..., e.key)`), de Backspace/Delete-route en de nieuwe-rij-route: daar is de seed het
  // getypte teken of een lege string, en zou een select-all elke volgende toets de vorige laten
  // wissen — dan kun je nog maar één letter typen. Een ref (geen state) omdat de vlag alleen tussen
  // startEdit en het mounten van de input hoeft te leven en geen extra render mag veroorzaken.
  const selectAllOnOpenRef = useRef(false);
  const editInputRef = useRef<HTMLInputElement | null>(null);

  const startEdit = useCallback((taskId: string, field: string, value: string, opts?: { selectAll?: boolean }) => {
    selectAllOnOpenRef.current = opts?.selectAll === true;
    setEditCell({ taskId, field });
    setEditValue(value);
    // De cursor blijft ná de bewerking op dezelfde cel staan (issue #26).
    setActiveCell({ taskId, field });
  }, []);

  // Loopt ná het mounten van de bewerk-input (refs zijn dan gezet), dus `select()` treft het echte
  // veld. De vlag wordt meteen gewist zodat een volgende bewerking hem niet erft.
  useEffect(() => {
    if (!editCell || !selectAllOnOpenRef.current) return;
    selectAllOnOpenRef.current = false;
    editInputRef.current?.select();
  }, [editCell]);

  const commitEdit = useCallback(() => {
    if (!editCell) return;
    const { taskId, field } = editCell;
    const task = tasks.find(t2 => t2.id === taskId);
    if (!task) { setEditCell(null); return; }

    if (field === 'name') {
      // Een lege naam is nooit een bedoelde invoer: de nieuwe-rij-seed is bewust leeg (zodat typen
      // direct overschrijft) en een blur zonder typen zou anders een naamloze taak achterlaten.
      // Leeg ⇒ niets schrijven, net als bij de duur- en datumcellen.
      if (editValue.trim() !== '') updateTask(taskId, { name: editValue });
    } else if (field === 'wbsCode') {
      updateTask(taskId, { wbsCode: editValue });
    } else if (field === 'duration') {
      // Mijlpalen hebben per definitie duur 0 — een ingevoerde duur zou stil
      // divergeren van wat CPM en de canvas-tabel tonen.
      if (!task.isMilestone) {
        const cal = effectiveCalendarOf(task, projectCal, calendars);
        if (enableHourPlanning && task.time.durationUnit === 'hours') {
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
    } else if (field === 'start' || field === 'finish') {
      // Datumcel: parse-of-weiger, hetzelfde contract als de duurcel. Rauwe invoer wegschrijven zou
      // rommel ("x") de CPM-invoer en het IFC-opslaan in duwen — en met "typen overschrijft" is één
      // toets genoeg om daar te komen. Leeg of onparseerbaar ⇒ niets schrijven, waarde blijft staan;
      // geen dialoog, geen toast (net als bij de duur).
      const iso = parseFlexibleDate(editValue);
      if (iso) {
        updateTask(taskId, {
          time: field === 'start'
            ? { ...task.time, scheduleStart: iso }
            : { ...task.time, scheduleFinish: iso },
        });
      }
    } else if (field === 'completion') {
      // Via de bewaakte route (issue #26): setTaskProgress klemt zelf op 0..1, zet auto een
      // actualStart bij >0, laat actualFinish vallen onder 100% en past de statusdatum-
      // invarianten toe — een rechtstreekse updateTask omzeilde dat allemaal.
      setTaskProgress(taskId, (parseInt(editValue) || 0) / 100);
    }
    setEditCell(null);
  }, [editCell, editValue, tasks, updateTask, setTaskProgress, projectCal, calendars, enableHourPlanning]);

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

  const getCellValue = useCallback((task: Task, field: string): string => {
    if (field === 'name') return task.name;
    if (field === 'wbsCode') return task.wbsCode;
    if (field === 'duration') return durationEditSeed(task);
    if (field === 'start') return task.time.earlyStart || task.time.scheduleStart;
    if (field === 'finish') return task.time.earlyFinish || task.time.scheduleFinish;
    if (field === 'completion') return `${Math.round(task.time.completion * 100)}`;
    return '';
  }, [durationEditSeed]);

  const taskRowIds = useMemo(() => taskRows.map(r => r.task.id), [taskRows]);

  /** Buurcel over (taakrijen × bewerkbare kolommen). `null` = geen buur (rand, onbekende rij/kolom,
   *  of geen bewerkbare kolommen zichtbaar). Gedeeld door de bewerk-navigatie en de rasternavigatie
   *  met de pijltjestoetsen (issue #26). De rekensom zelf staat sinds issue #48 in
   *  `@/utils/gridNavigation`, zodat de resourcetabel er letterlijk dezelfde definitie voor gebruikt
   *  (zie de kop van dat bestand voor waarom alleen de REKENSOM gedeeld kan worden en niet de
   *  cursor-mechaniek). */
  const neighbourCell = useCallback(
    (taskId: string, field: string, direction: GridDirection): { taskId: string; field: string } | null => {
      const next = neighbourGridCell(taskRowIds, editableFields, { rowId: taskId, field }, direction);
      return next && { taskId: next.rowId, field: next.field };
    },
    [taskRowIds, editableFields],
  );

  // Een cel die niet meer BESTAAT mag niet actief of in bewerking blijven: de rij kan verdwenen zijn
  // (verwijderd, weggefilterd, ingeklapt) of de kolom verborgen. Bleef `editCell` staan op een cel
  // die nergens meer gerenderd wordt, dan was er geen input én slikte de guard bovenin
  // `handleGridKeyDown` élke toets op — het raster stond dan stil dood. De bewerking wordt in dat
  // geval afgebroken ZONDER commit (de cel is immers weg). Alleen zetten wanneer de waarde echt
  // verandert, anders is dit een render-lus.
  useEffect(() => {
    const bestaat = (cell: { taskId: string; field: string } | null): boolean =>
      !cell || (taskRows.some(r => r.task.id === cell.taskId) && editableFields.includes(cell.field));
    if (!bestaat(activeCell)) setActiveCell(null);
    if (!bestaat(editCell)) setEditCell(null);
  }, [taskRows, editableFields, activeCell, editCell]);

  const navigateCell = useCallback((taskId: string, field: string, direction: 'up' | 'down' | 'left' | 'right') => {
    commitEdit();
    const next = neighbourCell(taskId, field, direction);
    if (next) {
      const nextTask = taskRows.find(r => r.task.id === next.taskId)?.task;
      if (!nextTask) return;
      selectTask(nextTask.id);
      startEdit(nextTask.id, next.field, getCellValue(nextTask, next.field));
      return;
    }
    // issue #26: Enter/↓ op de LAATSTE rij maakt een nieuwe zustertaak en zet de cursor meteen in
    // de naamcel — doorlopend invoeren zoals in een spreadsheet. Alleen in boommodus: met een
    // filter/groepering/sortering actief kan de nieuwe taak zó weer uit beeld vallen. Dat weigeren
    // gebeurt niet meer stil — de melding vertelt waarom (en biedt aan de standen te wissen).
    if (direction !== 'down') return;
    const rowIndex = taskRows.findIndex(r => r.task.id === taskId);
    if (rowIndex === -1 || rowIndex !== taskRows.length - 1) return;
    // Issue #49: de boommodus-poort én de structuurmelding zitten sinds die fix in de gedeelde
    // invoegroute, zodat élke route (lint, contextmenu, sneltoets, tabel) dezelfde regel volgt.
    // `null` = de weergave hield hem tegen; de melding is dan al getoond.
    const newId = insertTaskRelativeToScope([taskId], 'below', { name: t('defaultTask') });
    if (!newId) return;
    selectTask(newId);
    // Lege startwaarde (niet de standaardnaam) zodat wat de gebruiker typt direct overschrijft.
    startEdit(newId, 'name', '');
  }, [taskRows, neighbourCell, commitEdit, selectTask, startEdit, getCellValue, t]);

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
      // Focus terug op het raster, anders is "typen om te bewerken" na één Escape stuk.
      restoreGridFocus();
    } else if (e.key === 'Insert' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i')) {
      // Issue #49: de melder wil de invoeg-sneltoetsen "consistent across all Task views", dus óók
      // in de Tabel. De globale sneltoetsafhandeling laat een invoerveld met opzet met rust
      // (`isTypingTarget` in `useKeyboardShortcuts`), zodat tekstbewerking nooit gekaapt wordt —
      // hier vangen we ze daarom in de cel-input zelf op. Zonder dit werkten Insert/Ctrl+I in de
      // Tabel alleen ná Escape, precies in de flow (naam typen, volgende taak) waar je ze wilt.
      e.preventDefault();
      e.stopPropagation();
      const where = e.key === 'Insert' ? 'above' : 'below';
      // Anker is de rij waarin de cursor staat — in een raster is dat ondubbelzinnig, en één klik
      // op een cel zet de selectie toch al op die ene taak. De weergave-poort (boommodus) en de
      // structuurmelding zitten in de gedeelde route.
      commitEdit();
      const newId = insertTaskRelativeToScope([taskId], where, { name: t('defaultTask') });
      if (!newId) { restoreGridFocus(); return; }
      selectTask(newId);
      // Lege startwaarde, zodat wat je typt de standaardnaam direct overschrijft — zelfde gedrag
      // als de doorlopende invoer met Enter/↓ op de laatste rij.
      startEdit(newId, 'name', '');
    }
  }, [navigateCell, restoreGridFocus, commitEdit, selectTask, startEdit, t]);

  /** Toetsenbord op rasterniveau (issue #26): geldt alleen wanneer er NIET bewerkt wordt — tijdens
   *  een bewerking is `handleCellKeyDown` in de input de baas. */
  const handleGridKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Alleen toetsen die naar de CONTAINER ZELF gaan zijn van het raster. Alles wat uit een kind
    // omhoogborrelt — de inklap-chevron (<button>), de activity-code-<select>, de custom-field- en
    // celinputs — blijft van dat kind: daar is Enter/spatie/Tab gewoon Enter/spatie/Tab. Dit
    // vervangt de oude tagName-check, die knoppen niet dekte.
    if (e.target !== e.currentTarget) return;

    // Escape is de NOODREM en staat daarom vóór de editCell-guard: raakt de bewerking ooit los van
    // een gerenderde input (verborgen kolom, verdwenen rij), dan is dit de enige uitweg — anders
    // slikt de guard hieronder élke toets op. stopPropagation alleen wanneer er echt iets te wissen
    // viel; stond er niets, dan hoort Escape door te gaan naar de globale deselectie-sneltoets.
    if (e.key === 'Escape') {
      const teWissen = !!editCell || !!activeCell;
      if (editCell) setEditCell(null);
      if (activeCell) setActiveCell(null);
      if (teWissen) e.stopPropagation();
      return;
    }

    if (editCell) return;

    // Tab/Shift+Tab = in-/uitspringen op RIJniveau (issue #26). Bewust VÓÓR de activeCell-guard:
    // je kunt rijen selecteren door op een rij te klikken zonder ooit een cel actief te maken, en
    // dan hoort Tab óók te werken. Zónder selectie valt er niets in of uit te springen — dan Tab
    // NIET onderscheppen, want dat maakt van het raster een focusval waar je alleen met de muis uit
    // komt. Mét selectie is preventDefault altijd nodig — ook bij een geweigerde poging — anders
    // verspringt de browserfocus en is het raster de toets kwijt. stopPropagation houdt de globale
    // sneltoetsen (window) erbuiten.
    if (e.key === 'Tab') {
      if (selectedTaskIds.length === 0) return;
      e.preventDefault();
      e.stopPropagation();
      if (!isTreeMode(view)) { notifyStructureLocked(); return; }
      if (e.shiftKey) outdentTasks(selectedTaskIds);
      else indentTasks(selectedTaskIds);
      return;
    }

    if (!activeCell) return;
    const task = tasks.find(t2 => t2.id === activeCell.taskId);
    if (!task) return;

    // Backspace/Delete zijn globaal gebonden aan taak-verwijderen. Met een actieve cel is dat een
    // valstrik: je denkt een letter te wissen en raakt de hele taak kwijt. Mét actieve cel doen ze
    // daarom wat een spreadsheet doet — de cel leegmaken en meteen in bewerkmodus staan. Bewust ná
    // de activeCell-guard, zodat Delete zónder actieve cel gewoon de selectie blijft verwijderen.
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      e.stopPropagation();
      startEdit(activeCell.taskId, activeCell.field, '');
      return;
    }

    if (e.key === 'F2' || e.key === 'Enter') {
      // Bestaande waarde verder bewerken.
      e.preventDefault();
      // Niet doorlaten naar de globale sneltoetsen: F2 opent daar het taakdialoog.
      e.stopPropagation();
      startEdit(activeCell.taskId, activeCell.field, getCellValue(task, activeCell.field), { selectAll: true });
      return;
    }
    // KALE pijltjes verplaatsen de cursorcel. Met een modifier erbij houden we onze handen thuis:
    // Alt(+Shift)+→/← zijn de bestaande globale in-/uitspring-sneltoetsen, en die moeten de
    // window-handler kunnen bereiken — anders slokt de tabel ze op zodra er een cel actief is.
    if (
      (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight')
      && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey
    ) {
      e.preventDefault();
      e.stopPropagation();
      const direction = e.key === 'ArrowUp' ? 'up' : e.key === 'ArrowDown' ? 'down' : e.key === 'ArrowLeft' ? 'left' : 'right';
      const next = neighbourCell(activeCell.taskId, activeCell.field, direction);
      if (!next) return;
      setActiveCell(next);
      if (next.taskId !== activeCell.taskId) selectTask(next.taskId);
      return;
    }
    // Spatie is bewust UITGEZONDERD: die hoort zijn normale gedrag te houden (scrollen/activeren)
    // en is geen zinnige eerste letter van een celwaarde.
    if (e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Typen OVERSCHRIJFT de cel: de bewerking begint met alleen het getypte teken.
      e.preventDefault();
      // Niet doorlaten: '0'/'-'/'=' zijn globale zoom-sneltoetsen (useZoomShortcuts).
      e.stopPropagation();
      startEdit(activeCell.taskId, activeCell.field, e.key);
    }
  }, [editCell, activeCell, tasks, startEdit, getCellValue, neighbourCell, selectTask, selectedTaskIds, view, indentTasks, outdentTasks, notifyStructureLocked]);

  // `displayValue` (optioneel): wat de cel TOONT wanneer hij niet in bewerking is — voor datumcellen
  // de notatie-geformatteerde datum. De bewerk-/navigatiewaarde blijft `value` (ISO), dus dubbelklik
  // en commit gedragen zich onveranderd; alleen de weergave volgt de datumnotatie-instelling.
  const renderCell = (taskId: string, field: string, value: string, align = 'left', displayValue?: string) => {
    const isEditing = editCell?.taskId === taskId && editCell?.field === field;
    const isActive = activeCell?.taskId === taskId && activeCell?.field === field;
    if (isEditing) {
      return (
        <input
          autoFocus
          ref={editInputRef}
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={() => { commitEdit(); restoreGridFocus(); }}
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
        // Cel met de toetsenbordcursor (issue #26): een ONOPVALLENDE markering — een stippellijntje
        // onder de tekst, geen vlak en geen rand. Het gevulde vlak van hiervoor was lelijk en
        // bovendien overbodig: sinds één klik meteen bewerkt komt "cursor op de cel maar niet in
        // bewerking" alleen nog voor na Escape of pijltjesnavigatie. De regel staat in globals.css
        // (`.table-cell-cursor`).
        className={`block truncate cursor-text px-1${isActive ? ' table-cell-cursor' : ''}`}
        style={{ textAlign: align as 'left' | 'right' | 'center' }}
        // ÉÉN klik bewerkt meteen (issue #26) — een takenlijst is geen spreadsheet, je klikt op een
        // naam om hem te wijzigen. BEWUST geen stopPropagation: de klik moet doorbubbelen naar de
        // rij, anders breekt de (ctrl/shift-)rijselectie en daarmee Tab-inspringen.
        onClick={(e: React.MouseEvent) => {
          // De klik die het staartje van een rijsleep is mag niets activeren of openen — dezelfde
          // guard die de rij-onClick al had.
          if (justDraggedRef.current) return;
          // Ctrl/⌘/Shift+klik zijn multi-selectklikken: die horen alleen te selecteren. Zou hier een
          // editor opengaan, dan was multi-select (en dus Tab-inspringen op meerdere taken) stuk.
          if (e.ctrlKey || e.metaKey || e.shiftKey) { setActiveCell({ taskId, field }); return; }
          startEdit(taskId, field, value, { selectAll: true });
        }}
        onDoubleClick={() => startEdit(taskId, field, value, { selectAll: true })}
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

  const testFieldKey = (field: FieldRef): string => {
    if (field.src === 'builtin') return field.key;
    if (field.src === 'activityCode') return `activityCode:${field.typeId}`;
    if (field.src === 'customField') return `customField:${field.defId}`;
    return 'resource';
  };

  const isEditableColumn = (field: FieldRef, isSummary: boolean): boolean => {
    if (field.src === 'builtin') return editableFields.includes(field.key);
    return !isSummary && (field.src === 'activityCode' || field.src === 'customField');
  };

  return (
    // tabIndex maakt het raster focusbaar zodat de toetsen hierboven aankomen (issue #26);
    // `outline-none` onderdrukt alleen de focusring die dat oplevert — de actieve CEL is de
    // zichtbare cursor, niet de hele tabel.
    <div
      ref={containerRef}
      data-testid="task-table-editor"
      tabIndex={0}
      onKeyDown={handleGridKeyDown}
      className="flex-1 flex flex-col overflow-auto bg-surface outline-none"
    >
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
              // min-w-0: defensief gelijkgetrokken met de body-cellen, die het al hadden. Zonder
              // dit houdt een flex-item `min-width: auto` en kan het niet krimpen onder zijn
              // min-content-breedte — hier in de praktijk al afgevangen doordat de label-span
              // `truncate` (overflow:hidden) heeft, maar dat is een indirecte afhankelijkheid.
              className="relative flex items-center px-2 min-w-0"
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
          // issue #26 punt 6: is DEZE rij het actuele drop-doel, en zo ja in welke zone?
          const dropZone = rowDragState?.hoverRowIndex === rowIdx && rowDragState.dropTarget
            ? rowDragState.hoverZone
            : null;
          // De selectie-indicator (linkerbalkje) mag NIET verdwijnen zodra dezelfde rij ook
          // drop-doel is — daarom combineren we de boxShadows in plaats van te vervangen.
          const boxShadow = [
            isSelected ? 'inset 2px 0 0 var(--theme-accent)' : null,
            dropZone === 'before' ? 'inset 0 2px 0 0 var(--theme-accent)' : null,
            dropZone === 'after' ? 'inset 0 -2px 0 0 var(--theme-accent)' : null,
            dropZone === 'nest' ? 'inset 0 0 0 2px var(--theme-accent)' : null,
          ].filter(Boolean).join(', ');

          return (
            <div
              key={`${task.id}-${rowIdx}`}
              // De rijindex in de VOLLEDIGE viewRows; de rijsleep-hook meet hierop met
              // elementFromPoint. Groepsrijen dragen dit attribuut bewust niet.
              data-ops-row-index={rowIdx}
              className={`flex text-xs hover:bg-surface-hover cursor-default ${isSummary ? 'font-semibold' : ''}`}
              style={{
                minHeight: 26,
                borderBottom: '1px solid var(--theme-border-light)',
                // Gedimde rij (filter-ouderketen, §4.2): visueel dimmen.
                ...(dimmed ? { opacity: 0.5 } : {}),
                ...(isSelected
                  ? { background: 'var(--theme-accent-soft, rgba(217,119,6,.10))' }
                  : {}),
                // Nest-doel krijgt een lichte tint bovenop de rand.
                ...(dropZone === 'nest' ? { background: 'rgba(217,119,6,.16)' } : {}),
                ...(boxShadow ? { boxShadow } : {}),
                // Zolang er gesleept wordt (al vanaf de kandidaatfase, dus vanaf de mousedown) mag
                // de browser geen tekstselectie over de rijen verven — het canvas heeft dat probleem
                // niet omdat daar geen tekst staat, de DOM-tabel wel. Bewust GEEN preventDefault op
                // de mousedown: dat zou ook het focussen van het raster blokkeren en daarmee het
                // hele toetsenbord.
                ...(rowDragActive ? { cursor: 'grabbing', userSelect: 'none', WebkitUserSelect: 'none' } : {}),
              }}
              // issue #26 punt 6: kandidaat voor een rijsleep. Géén preventDefault en niet meteen
              // slepen — pas boven de drempel (4 px) wordt het een sleep, zodat klikken,
              // dubbelklikken en cel-activatie onaangetast blijven. Uitgezonderd: niet-linkse
              // knoppen, de multi-select-modifiers, een lopende celbewerking en events uit een
              // bedieningselement (inklap-chevron, custom-field-input, activity-code-select).
              onMouseDown={e => {
                if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;
                if (editCell) return;
                if ((e.target as HTMLElement).closest('input, select, textarea, button')) return;
                startRowDrag({ taskId: task.id, startClientX: e.clientX, startClientY: e.clientY });
              }}
              // issue #21 punt 3: ctrl/cmd toggelt, shift range-selecteert —zelfde selectiegedrag
              // als in het Gantt-canvas (was hiervoor altijd harde single-select).
              onClick={e => {
                // Ná een rijsleep hoort de afsluitende klik de selectie niet te verzetten.
                if (justDraggedRef.current) return;
                selectTask(task.id, e.ctrlKey || e.metaKey, e.shiftKey);
              }}
            >
              {visibleColumns.map(({ col, index }) => {
                const isName = col.field.src === 'builtin' && col.field.key === 'name';
                if (isName) {
                  return (
                    <div
                      key={index}
                      data-testid="task-cell"
                      data-task-id={task.id}
                      data-field-key="name"
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
                const isEditable = isEditableColumn(col.field, isSummary);
                return (
                  <div
                    key={index}
                    data-testid={isEditable ? 'task-cell' : undefined}
                    data-task-id={isEditable ? task.id : undefined}
                    data-field-key={isEditable ? testFieldKey(col.field) : undefined}
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

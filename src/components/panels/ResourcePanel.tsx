import { useState, useMemo, useEffect, useCallback, type KeyboardEvent } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { resourceCostTotals } from '@/utils/resourceCostTotals';
import { Icon } from '@/components/icons';
import { RESOURCE_TYPES as ALL_RESOURCE_TYPES, isCostResource, type Resource, type ResourceType, type AvailabilityStep } from '@/types/resource';
import { localTodayIso } from '@/utils/dateUtils';
import { ResourceCalendarDialog } from '@/components/dialogs/ResourceCalendarDialog';
import { UnitsInput } from '@/components/common/UnitsInput';
import { DateTextInput } from '@/components/common/DateTextInput';
import { isResourceFieldLocked, matchByName, computeResourceHash, normalizeName } from '@/services/library/libraryOps';
import { ResourceOccupancyView } from './ResourceOccupancyView';
import { resourceDisplayColor, nextFreePaletteColor } from '@/engine/renderer/resourcePalette';
import { useLiveGridNav } from './hooks/useLiveGridNav';
import { controlKindOf, liveGridNavDirection } from '@/utils/gridNavigation';
import { StatusBanner } from './StatusBanner';
import { CommitColorInput } from '@/components/common/CommitInput';

const RESOURCE_TYPES = ALL_RESOURCE_TYPES;

const GRID_FIELDS = ['name', 'type', 'maxUnits', 'calendar', 'cost', 'unit', 'parent'] as const;
type GridField = typeof GRID_FIELDS[number];
const DRAFT_ROW_ID = '__draft';

type ResourceDraft = {
  name: string;
  type: ResourceType;
  maxUnits: number;
  calendarId?: string;
  costPerHour?: number;
  unitOfMeasure?: string;
  parentId?: string;
  color?: string;
};
const freshDraft = (): ResourceDraft => ({ name: '', type: 'LABOR', maxUnits: 1 });

const TYPE_KEY = {
  LABOR: 'resource.type.labor',
  EQUIPMENT: 'resource.type.equipment',
  MATERIAL: 'resource.type.material',
  SUBCONTRACTOR: 'resource.type.subcontractor',
  CREW: 'resource.type.crew',
  COST: 'resource.type.cost',
} as const satisfies Record<ResourceType, string>;

const NEW_CAL = '__new';

type ResourceView = 'company' | 'project' | 'occupancy';
type PendingResourceDraft = { variant: 'project' | 'pool'; draft: ResourceDraft };
type SetUI = ReturnType<typeof useAppStore.getState>['setUI'];

function useResourceViewReset(companyId: string | undefined, linked: boolean, setUI: SetUI): void {
  useEffect(() => {
    if (useAppStore.getState().ui.resourcesView !== 'project') {
      setUI({ resourcesView: 'project' });
    }
  }, [companyId, linked, setUI]);
}

function usePendingResourceDraft({
  pendingNewResource,
  openDraft,
  requestFocus,
  setUI,
}: {
  pendingNewResource: boolean;
  openDraft: (view: ResourceView) => void;
  requestFocus: (rowId: string, field: GridField) => void;
  setUI: SetUI;
}): void {
  useEffect(() => {
    if (!pendingNewResource) return;
    let view = useAppStore.getState().ui.resourcesView;
    if (view === 'occupancy') {
      view = 'project';
      setUI({ resourcesView: 'project' });
    }
    openDraft(view);
    requestFocus(DRAFT_ROW_ID, 'name');
    setUI({ pendingNewResource: false });
  }, [pendingNewResource, openDraft, requestFocus, setUI]);
}

const cellInput = 'input !text-body !px-1.5 !py-1 w-full';
const cellStatic = 'block !text-body !px-1.5 !py-1 w-full truncate text-text-secondary';

const TH = 'text-left px-2 py-1.5 font-semibold border-b border-border';
const TH_RIGHT = 'text-right px-2 py-1.5 font-semibold border-b border-border';

type ResourceColumn = 'color' | 'name' | 'type' | 'maxUnits' | 'calendar' | 'costPerHour' | 'total' | 'unit' | 'parent' | 'actions';
function resourceColumns(showTotal: boolean, showParent: boolean): ResourceColumn[] {
  return [
    'color', 'name', 'type', 'maxUnits', 'calendar', 'costPerHour',
    ...(showTotal ? ['total' as const] : []),
    'unit',
    ...(showParent ? ['parent' as const] : []),
    'actions',
  ];
}

const PROJECT_COLUMNS = resourceColumns(true, true);
const TOTAL_INDEX = PROJECT_COLUMNS.indexOf('total');

function ResourceTableHead({ columns }: { columns: ResourceColumn[] }) {
  const { t } = useTranslation('common');
  const cell = (col: ResourceColumn) => {
    switch (col) {
      case 'color':
        return (
          <th key={col} className="border-b border-border px-1 py-1.5" style={{ width: 44 }} title={t('resource.color')} aria-label={t('resource.color')}>
            <span className="block h-2.5 w-full rounded-sm" style={{ background: 'var(--theme-border)' }} />
          </th>
        );
      case 'name': return <th key={col} className={TH} style={{ minWidth: 160 }}>{t('resource.name')}</th>;
      case 'type': return <th key={col} className={TH} style={{ width: 130 }}>{t('resource.typeLabel')}</th>;
      case 'maxUnits': return <th key={col} className={TH_RIGHT} style={{ width: 110 }}>{t('resource.maxUnits')}</th>;
      case 'calendar': return <th key={col} className={TH} style={{ width: 160 }}>{t('resource.calendarId')}</th>;
      case 'costPerHour': return <th key={col} className={TH_RIGHT} style={{ width: 90 }}>{t('resource.costPerHour')}</th>;
      case 'total': return <th key={col} className={TH_RIGHT} style={{ width: 100 }} title={t('resource.totalHint')} data-ops-resource-total-head>{t('resource.total')}</th>;
      case 'unit': return <th key={col} className={TH} style={{ width: 90 }}>{t('resource.unitOfMeasure')}</th>;
      case 'parent': return <th key={col} className={TH} style={{ width: 120 }}>{t('resource.parent')}</th>;
      case 'actions': return <th key={col} className="border-b border-border" style={{ width: 190 }} />;
    }
  };
  return (
    <thead>
      <tr className="sticky top-0 z-10" style={{ background: 'var(--theme-surface-alt)' }}>
        {columns.map(cell)}
      </tr>
    </thead>
  );
}

export function ResourcePanel() {
  const { t, i18n } = useTranslation('common');
  const resources = useAppStore(s => s.resources);
  const resourceCalendars = useAppStore(s => s.calendars);
  const assignments = useAppStore(s => s.assignments);
  const resourceLoadResult = useAppStore(s => s.resourceLoadResult);
  const addResource = useAppStore(s => s.addResource);
  const updateResource = useAppStore(s => s.updateResource);
  const removeResource = useAppStore(s => s.removeResource);
  const unlinkResourceFromLibrary = useAppStore(s => s.unlinkResourceFromLibrary);
  const setUI = useAppStore(s => s.setUI);
  const project = useAppStore(s => s.project);
  const companies = useAppStore(s => s.companies);
  const pools = useAppStore(s => s.pools);
  const resourcesView = useAppStore(s => s.ui.resourcesView);
  const pendingNewResource = useAppStore(s => s.ui.pendingNewResource);
  const addPoolResource = useAppStore(s => s.addPoolResource);
  const removePoolResource = useAppStore(s => s.removePoolResource);
  const updatePoolResource = useAppStore(s => s.updatePoolResource);
  const addLibraryResourceToProject = useAppStore(s => s.addLibraryResourceToProject);
  const promoteResourceToPool = useAppStore(s => s.promoteResourceToPool);
  const linked = !!project.companyId && companies.some(c => c.id === project.companyId);
  const pool = project.companyId ? pools[project.companyId] : undefined;
  const inPoolView = linked && resourcesView === 'company' && !!pool;
  const inOccupancyView = linked && resourcesView === 'occupancy' && !!pool;

  const [calDialog, setCalDialog] = useState<{ id?: string; poolCompanyId?: string; linkResourceId?: string } | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmPoolDelete, setConfirmPoolDelete] = useState<string | null>(null);
  const [poolNotice, setPoolNotice] = useState<string | null>(null);
  const [projectNotice, setProjectNotice] = useState<string | null>(null);
  const [pendingNew, setPendingNew] = useState<PendingResourceDraft | null>(null);
  const hasLinkedPool = linked && !!pool;
  const variantForView = useCallback((view: ResourceView): 'project' | 'pool' => (
    hasLinkedPool && view === 'company' ? 'pool' : 'project'
  ), [hasLinkedPool]);
  const openDraft = useCallback((view: ResourceView) => {
    setPendingNew({ variant: variantForView(view), draft: freshDraft() });
  }, [variantForView]);

  const commitPendingNew = (): string | null => {
    if (!pendingNew) return null;
    const { variant, draft } = pendingNew;
    const trimmed = draft.name.trim();
    if (trimmed === '') { setPendingNew(null); return null; }
    const cost = draft.type === 'COST';
    const base = {
      name: trimmed,
      description: '',
      type: draft.type,
      maxUnits: cost ? 1 : draft.maxUnits,
      calendarId: cost ? undefined : draft.calendarId,
      costPerHour: cost ? undefined : draft.costPerHour,
      unitOfMeasure: draft.type === 'MATERIAL' ? draft.unitOfMeasure : undefined,
      parentId: cost ? undefined : draft.parentId,
      color: draft.color,
    };
    let newId: string | null = null;
    if (variant === 'pool' && project.companyId) {
      newId = addPoolResource(project.companyId, base);
      if (newId && !cost && (draft.calendarId || draft.parentId)) {
        updatePoolResource(project.companyId, newId, { calendarId: draft.calendarId, parentId: draft.parentId });
      }
    } else if (variant === 'project') {
      newId = addResource(base);
    }
    setPendingNew(null);
    return newId;
  };

  const gridRowIds = useMemo(() => {
    const base = (inPoolView && pool ? pool.resources : resources).map(r => r.id);
    return pendingNew ? [...base, DRAFT_ROW_ID] : base;
  }, [inPoolView, pool, resources, pendingNew]);

  const appendRow = useCallback((): boolean => {
    if (pendingNew) return false;
    openDraft(useAppStore.getState().ui.resourcesView);
    return true;
  }, [pendingNew, openDraft]);

  const grid = useLiveGridNav<GridField>({ rowIds: gridRowIds, fields: GRID_FIELDS, onAppendRow: appendRow });
  const { requestFocus, flushPendingFocus } = grid;
  useEffect(() => { flushPendingFocus(); });

  const commitDraftAndMove = (mode: 'nextRow' | 'prevRow') => {
    const newId = commitPendingNew();
    if (mode === 'nextRow') {
      if (newId) {
        openDraft(useAppStore.getState().ui.resourcesView);
        requestFocus(DRAFT_ROW_ID, 'name');
      }
      return;
    }
    const rows = inPoolView && pool ? pool.resources : resources;
    const target = newId ?? rows[rows.length - 1]?.id;
    if (target) requestFocus(target, 'name');
  };

  useEffect(() => {
    if (resourcesView !== 'company') { setConfirmPoolDelete(null); setPoolNotice(null); }
    if (resourcesView !== 'project') { setConfirmDelete(null); setProjectNotice(null); }
    setPendingNew(p => (p && resourcesView !== 'occupancy' && p.variant === variantForView(resourcesView) ? p : null));
  }, [resourcesView, variantForView]);

  const onAssignFromCompany = (resourceId: string) => {
    const result = addLibraryResourceToProject(project.companyId!, resourceId);
    setPoolNotice(result.added ? t('companyLibrary.added') : t('companyLibrary.alreadyInProject'));
  };

  const onPromoteResource = (resource: Resource) => {
    if (!project.companyId) return;
    const existingMatch = matchByName(resource.name, pool?.resources ?? []);
    const identical = existingMatch ? computeResourceHash(resource) === computeResourceHash(existingMatch) : false;
    promoteResourceToPool(project.companyId, resource, { dedupByName: true });
    setProjectNotice(
      !existingMatch ? t('companyLibrary.added')
        : identical ? t('companyLibrary.linkedToExisting')
          : t('companyLibrary.linkedToExistingDiffers'),
    );
  };

  useResourceViewReset(project.companyId, linked, setUI);

  usePendingResourceDraft({ pendingNewResource, openDraft, requestFocus, setUI });

  const crews = resources.filter(r => r.type === 'CREW');
  const poolCrews = pool ? pool.resources.filter(r => r.type === 'CREW') : [];
  const poolShowParentColumn = (pool?.resources.length ?? 0) > 0;
  const poolColumns = resourceColumns(false, poolShowParentColumn);

  const numberFmt = useMemo(
    () => new Intl.NumberFormat(i18n.language, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    [i18n.language],
  );

  const costByResource = useMemo(
    () => resourceCostTotals(resources, assignments, resourceLoadResult?.hours),
    [resources, assignments, resourceLoadResult],
  );

  const grandTotal = useMemo(() => {
    const vals = Object.values(costByResource).filter((v): v is number => v !== undefined);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) : undefined;
  }, [costByResource]);

  const assignmentCount = (resourceId: string) =>
    assignments.filter(a => a.resourceId === resourceId).length;

  const requestRemove = (resourceId: string) => {
    if (assignmentCount(resourceId) > 0) {
      setConfirmDelete(resourceId);
    } else {
      removeResource(resourceId);
    }
  };

  const onAddClick = () => {
    openDraft(resourcesView);
    requestFocus(DRAFT_ROW_ID, 'name');
  };

  const patch = (id: string, updates: Partial<Resource>) => updateResource(id, updates);
  const poolPatch = (id: string, updates: Partial<Resource>) => {
    if (project.companyId) updatePoolResource(project.companyId, id, updates);
  };

  const linkNewCalendar = (dialog: { poolCompanyId?: string; linkResourceId?: string }, calendarId: string) => {
    if (!dialog.linkResourceId) return;
    if (dialog.poolCompanyId) updatePoolResource(dialog.poolCompanyId, dialog.linkResourceId, { calendarId });
    else updateResource(dialog.linkResourceId, { calendarId });
  };

  const onCalendarChange = (resource: Resource, value: string) => {
    if (value === NEW_CAL) {
      setCalDialog({ linkResourceId: resource.id });
      return;
    }
    updateResource(resource.id, { calendarId: value || undefined });
  };

  const onPoolCalendarChange = (resource: Resource, value: string) => {
    if (value === NEW_CAL) {
      if (project.companyId) setCalDialog({ poolCompanyId: project.companyId, linkResourceId: resource.id });
      return;
    }
    poolPatch(resource.id, { calendarId: value || undefined });
  };

  const draftRow = (
    variant: 'project' | 'pool',
    showTotalColumn: boolean,
    showParentColumn: boolean,
    calendarOptions: { id: string; name: string }[],
    crewOptions: Resource[],
    autoColor: string,
  ) => (
    <PendingNewRow
      autoColor={autoColor}
      draft={pendingNew?.draft ?? freshDraft()}
      isPool={variant === 'pool'}
      showTotalColumn={showTotalColumn}
      showParentColumn={showParentColumn}
      calendarOptions={calendarOptions}
      crews={crewOptions}
      onChange={patch => setPendingNew(p => (p ? { variant: p.variant, draft: { ...p.draft, ...patch } } : p))}
      onCommit={() => { commitPendingNew(); }}
      onMove={commitDraftAndMove}
      onCancel={() => setPendingNew(null)}
      onReveal={() => grid.revealCell(DRAFT_ROW_ID, 'name')}
    />
  );

  return (
    <div className="flex flex-col flex-1 overflow-hidden text-small leading-4">
      <div className="flex items-center justify-between h-9 px-3 border-b border-border flex-shrink-0">
        <span className="ui-card-header !text-small !leading-4">{t('resource.panel.title')}</span>
        <div className="flex items-center gap-2">
          {linked && (
            <div className="flex items-center rounded-[8px] border border-border overflow-hidden" data-ops-resources-view-toggle>
              {([
                ['company', t('companyLibrary.companyView')],
                ['project', t('companyLibrary.projectView')],
                ['occupancy', t('resource.occupancyView')],
              ] as const).map(([view, label]) => (
                <button
                  key={view}
                  className={`px-2 py-1 ${resourcesView === view ? 'bg-surface-hover font-semibold' : ''}`}
                  onClick={() => setUI({ resourcesView: view })}
                  data-ops-occupancy-view-button={view === 'occupancy' ? true : undefined}
                >{label}</button>
              ))}
            </div>
          )}
          {!inOccupancyView && (
            <button onClick={onAddClick} className="btn btn--sm btn--primary flex items-center gap-1" data-ops-resource-add>
              <Icon id="resource.new" size={13} /> {inPoolView ? t('resource.panel.addRowLibrary') : t('resource.panel.addRow')}
            </button>
          )}
          <button
            onClick={() => setUI({ showResourcePanel: false })}
            className="p-1 hover:bg-surface-hover rounded"
            title={t('close')}
          >
            <Icon id="ui.close" size={15} />
          </button>
        </div>
      </div>

      {inOccupancyView && pool && project.companyId ? (
        <ResourceOccupancyView companyId={project.companyId} pool={pool} />
      ) : inPoolView && pool ? (
        <div className="flex-1 overflow-auto" ref={grid.gridRef}>
          <StatusBanner tone="warning" bannerProps={{ 'data-ops-company-view-hint': true }}>
            {t('companyLibrary.companyViewHint')}
          </StatusBanner>
          {poolNotice && (
            <p className="flex items-center gap-1.5 px-2" style={{ color: 'var(--success)' }} data-ops-pool-assign-notice>
              <Icon id="status.success" size={13} /> {poolNotice}
            </p>
          )}
          {pool.resources.length === 0 && pendingNew?.variant !== 'pool' ? (
            <div className="p-4 text-text-secondary">{t('companyLibrary.noResources')}</div>
          ) : (
            <table className="w-full border-collapse">
              <ResourceTableHead columns={poolColumns} />
              <tbody>
                {pool.resources.map(r => {
                  const stepsOpen = expandedSteps === r.id;
                  const stepCount = r.availabilitySteps?.length ?? 0;
                  return (
                    <ResourceRow
                      key={r.id}
                      resource={r}
                      variant="pool"
                      colCount={poolColumns.length}
                      crews={poolCrews}
                      calendarOptions={pool.calendars}
                      stepsOpen={stepsOpen}
                      stepCount={stepCount}
                      showParentColumn={poolShowParentColumn}
                      confirmingDelete={confirmPoolDelete === r.id}
                      confirmMessage={t('companyLibrary.confirmRemoveResource', { name: r.name || r.id })}
                      onToggleSteps={() => setExpandedSteps(stepsOpen ? null : r.id)}
                      onPatch={updates => poolPatch(r.id, updates)}
                      onRequestRemove={() => setConfirmPoolDelete(r.id)}
                      onConfirmRemove={() => { removePoolResource(project.companyId!, r.id); setConfirmPoolDelete(null); }}
                      onCancelRemove={() => setConfirmPoolDelete(null)}
                      onCalendarChange={value => onPoolCalendarChange(r, value)}
                      onEditCalendar={() => r.calendarId && setCalDialog({ id: r.calendarId, poolCompanyId: project.companyId! })}
                      onAssignToProject={() => onAssignFromCompany(r.id)}
                      cellProps={grid.cellProps}
                      rowProps={grid.rowProps}
                    />
                  );
                })}
                {pendingNew?.variant === 'pool' && draftRow('pool', false, poolShowParentColumn, pool.calendars, poolCrews, nextFreePaletteColor(pool.resources))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
      <div className="flex-1 overflow-auto" ref={grid.gridRef}>
        {projectNotice && (
          <p className="flex items-center gap-1.5 px-2 pt-2" style={{ color: 'var(--success)' }} data-ops-project-promote-notice>
            <Icon id="status.success" size={13} /> {projectNotice}
          </p>
        )}
        {resources.length === 0 && pendingNew?.variant !== 'project' ? (
          linked ? (
            <div className="p-4 text-text-secondary" data-ops-resource-empty-linked>
              <p>{t('resource.panel.emptyLinkedTitle')}</p>
              <p className="mt-1">{t('resource.panel.emptyLinkedHint')}</p>
            </div>
          ) : (
            <div className="p-4 text-text-secondary">{t('resource.panel.empty')}</div>
          )
        ) : (
          <table className="w-full border-collapse">
            <ResourceTableHead columns={PROJECT_COLUMNS} />
            <tbody>
              {resources.map(r => {
                const stepsOpen = expandedSteps === r.id;
                const stepCount = r.availabilitySteps?.length ?? 0;
                const cost = costByResource[r.id];
                return (
                  <ResourceRow
                    key={r.id}
                    resource={r}
                    variant="project"
                    colCount={PROJECT_COLUMNS.length}
                    crews={crews}
                    calendarOptions={resourceCalendars}
                    stepsOpen={stepsOpen}
                    stepCount={stepCount}
                    showParentColumn
                    hasAssignments={assignmentCount(r.id) > 0}
                    costLabel={cost === undefined ? '—' : numberFmt.format(cost)}
                    confirmingDelete={confirmDelete === r.id}
                    confirmMessage={confirmDelete === r.id ? t('resource.panel.confirmDelete', { name: r.name || r.id, count: assignmentCount(r.id) }) : ''}
                    onToggleSteps={() => setExpandedSteps(stepsOpen ? null : r.id)}
                    onPatch={updates => patch(r.id, updates)}
                    onRequestRemove={() => requestRemove(r.id)}
                    onConfirmRemove={() => { removeResource(r.id); setConfirmDelete(null); }}
                    onCancelRemove={() => setConfirmDelete(null)}
                    onCalendarChange={value => onCalendarChange(r, value)}
                    onEditCalendar={() => r.calendarId && setCalDialog({ id: r.calendarId })}
                    onUnlink={() => unlinkResourceFromLibrary(r.id)}
                    onPromoteToLibrary={linked ? () => onPromoteResource(r) : undefined}
                    cellProps={grid.cellProps}
                    rowProps={grid.rowProps}
                  />
                );
              })}
              {pendingNew?.variant === 'project' && draftRow('project', true, true, resourceCalendars, crews, nextFreePaletteColor(resources))}
            </tbody>
            {grandTotal !== undefined && (
              <tfoot>
                <tr className="border-t border-border font-semibold">
                  <td className="px-2 py-1.5 text-text-secondary" colSpan={TOTAL_INDEX}>{t('resource.total')}</td>
                  <td className="px-2 py-1.5 text-right" data-ops-resource-grand-total>{numberFmt.format(grandTotal)}</td>
                  <td colSpan={PROJECT_COLUMNS.length - TOTAL_INDEX - 1} />
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>
      )}

      {calDialog !== null && (
        <ResourceCalendarDialog
          calendarId={calDialog.id}
          poolCompanyId={calDialog.poolCompanyId}
          onCreated={calDialog.linkResourceId ? (calendarId) => linkNewCalendar(calDialog, calendarId) : undefined}
          onClose={() => setCalDialog(null)}
        />
      )}
    </div>
  );
}

function ResourceRow({
  resource, variant, colCount, crews, calendarOptions, stepsOpen, stepCount, costLabel,
  showParentColumn = true, hasAssignments = false,
  confirmingDelete, confirmMessage,
  onToggleSteps, onPatch, onRequestRemove, onConfirmRemove, onCancelRemove,
  onCalendarChange, onEditCalendar, onAssignToProject, onUnlink, onPromoteToLibrary,
  cellProps, rowProps,
}: {
  resource: Resource;
  variant: 'project' | 'pool';
  colCount: number;
  crews: Resource[];
  calendarOptions: { id: string; name: string }[];
  stepsOpen: boolean;
  stepCount: number;
  costLabel?: string;
  showParentColumn?: boolean;
  hasAssignments?: boolean;
  confirmingDelete: boolean;
  confirmMessage: string;
  onToggleSteps: () => void;
  onPatch: (updates: Partial<Resource>) => void;
  onRequestRemove: () => void;
  onConfirmRemove: () => void;
  onCancelRemove: () => void;
  onCalendarChange: (value: string) => void;
  onEditCalendar: () => void;
  onAssignToProject?: () => void;
  onUnlink?: () => void;
  onPromoteToLibrary?: () => void;
  cellProps: (rowId: string, field: GridField) => { 'data-ops-grid-cell': string; onKeyDown: (e: KeyboardEvent) => void };
  rowProps: (rowId: string) => { 'data-ops-grid-row': string };
}) {
  const { t, i18n } = useTranslation('common');
  const numberFmt = useMemo(
    () => new Intl.NumberFormat(i18n.language, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    [i18n.language],
  );
  const isMaterial = resource.type === 'MATERIAL';
  const isCost = isCostResource(resource);
  const notForCost = <span className={cellStatic} title={t('resource.notForCost')} data-ops-resource-not-for-cost>—</span>;
  const isPool = variant === 'pool';
  const onOpenStatusForResource = useAppStore(s => s.onOpenStatusForResource);
  const setUI = useAppStore(s => s.setUI);
  const openStatus = isPool ? null : onOpenStatusForResource(resource.id);

  const locked = !isPool && isResourceFieldLocked(openStatus);

  const [nameDraft, setNameDraft] = useState(resource.name);
  useEffect(() => { setNameDraft(resource.name); }, [resource.id, resource.name]);
  const commitNameDraft = () => {
    if (nameDraft.trim() === '') { setNameDraft(resource.name); return; }
    if (nameDraft !== resource.name) onPatch({ name: nameDraft });
  };

  const [unitDraft, setUnitDraft] = useState(resource.unitOfMeasure ?? '');
  useEffect(() => { setUnitDraft(resource.unitOfMeasure ?? ''); }, [resource.id, resource.unitOfMeasure]);
  const commitUnitDraft = () => {
    const v = unitDraft || undefined;
    if (v !== resource.unitOfMeasure) onPatch({ unitOfMeasure: v });
  };

  const rateText = resource.costPerHour == null ? '' : String(resource.costPerHour);
  const [rateDraft, setRateDraft] = useState(rateText);
  useEffect(() => { setRateDraft(rateText); }, [resource.id, rateText]);
  const commitRateDraft = () => {
    const raw = rateDraft.trim();
    const next = raw === '' ? undefined : parseFloat(raw);
    if (next !== undefined && !Number.isFinite(next)) { setRateDraft(rateText); return; }
    if (next !== resource.costPerHour) onPatch({ costPerHour: next });
  };

  return (
    <>
      <tr
        className="border-b border-border-light hover:bg-surface-hover"
        data-ops-pool-resource-row={isPool ? true : undefined}
        {...rowProps(resource.id)}
      >
        <td className="px-1 py-1">
          <CommitColorInput
            label={t('resource.color')}
            value={resourceDisplayColor(resource)}
            onCommit={color => onPatch({ color })}
            className="block h-6 w-8 cursor-pointer rounded border border-border bg-transparent p-0"
          />
        </td>
        <td className="px-2 py-1">
          <div className="flex items-center gap-1 min-w-0">
            {locked ? (
              <span className={cellStatic} title={t('resource.inheritedFieldHint')}>
                {resource.name || '—'}
              </span>
            ) : (
              <input
                value={nameDraft}
                onChange={e => setNameDraft(e.target.value)}
                onBlur={commitNameDraft}
                {...cellProps(resource.id, 'name')}
                className={cellInput}
                placeholder={t('resource.name')}
              />
            )}
            {locked && (
              <span
                className="shrink-0 inline-flex items-center text-text-secondary"
                title={t('resource.fromLibraryBadge')}
                data-ops-resource-inherited
              >
                <Icon id="status.library-linked" size={12} />
              </span>
            )}
            {openStatus === 'deviated' && (
              <button
                type="button"
                className="badge badge--red shrink-0"
                onClick={() => setUI({ showLibraryLinkDialog: true })}
                title={t('companyLibrary.deviates')}
                data-ops-resource-deviates
              >
                {t('companyLibrary.deviates')}
              </button>
            )}
            {openStatus === 'removed' && (
              <>
                <span className="badge badge--red shrink-0" title={t('companyLibrary.notInCompany')} data-ops-resource-removed>
                  {t('companyLibrary.notInCompany')}
                </span>
                <button
                  type="button"
                  onClick={onRequestRemove}
                  className="btn btn--sm btn--secondary shrink-0 !py-0.5 !px-1.5 !text-small"
                  title={t('companyLibrary.removeFromProject')}
                  data-ops-resource-remove-orphan
                >
                  {t('companyLibrary.removeFromProject')}
                </button>
              </>
            )}
          </div>
        </td>
        <td className="px-2 py-1">
          {locked ? (
            <span className={cellStatic} title={t('resource.inheritedFieldHint')}>
              {t(TYPE_KEY[resource.type])}
            </span>
          ) : (
            <select
              value={resource.type}
              onChange={e => onPatch({ type: e.target.value as ResourceType })}
              {...cellProps(resource.id, 'type')}
              className={cellInput}
            >
              {RESOURCE_TYPES.map(rt => (
                <option
                  key={rt}
                  value={rt}
                  disabled={hasAssignments && rt !== resource.type && (rt === 'COST' || isCost)}
                  title={hasAssignments && rt !== resource.type && (rt === 'COST' || isCost) ? t('resource.costTypeLocked') : undefined}
                >
                  {t(TYPE_KEY[rt])}
                </option>
              ))}
            </select>
          )}
        </td>
        <td className="px-2 py-1">
          {isCost ? notForCost : (
          <div className="flex items-center gap-1 justify-end">
            <UnitsInput
              value={resource.maxUnits}
              ariaLabel={t('resource.maxUnits')}
              onCommit={n => onPatch({ maxUnits: n })}
              gridCell={cellProps(resource.id, 'maxUnits')['data-ops-grid-cell']}
              onKeyDown={cellProps(resource.id, 'maxUnits').onKeyDown}
              className={cellInput + ' text-right'}
            />
            <button
              onClick={onToggleSteps}
              title={t('resource.availabilityStepsEditor.title')}
              className="p-0.5 rounded hover:bg-surface-hover text-text-secondary flex-shrink-0"
            >
              {stepsOpen ? <Icon id="tree.collapse" size={13} /> : <Icon id="tree.expand" size={13} className="ops-icon-inline-flip" />}
              {stepCount > 0 && <span className="!text-caption ml-0.5">{stepCount}</span>}
            </button>
          </div>
          )}
        </td>
        <td className="px-2 py-1">
          {isCost ? notForCost : (
          <div className="flex items-center gap-1 min-w-0">
            <select
              value={resource.calendarId ?? ''}
              onChange={e => onCalendarChange(e.target.value)}
              {...cellProps(resource.id, 'calendar')}
              className={cellInput}
            >
              <option value="">{isPool ? t('resource.noCalendar') : t('resource.projectCalendar')}</option>
              {calendarOptions.map(c => (
                <option key={c.id} value={c.id}>{c.name || c.id}</option>
              ))}
              <option value={NEW_CAL}>+ {t('resource.calendarDialog.title')}</option>
            </select>
            <button
              onClick={onEditCalendar}
              disabled={!resource.calendarId}
              title={t('resource.editCalendar')}
              className="p-0.5 rounded hover:bg-surface-hover text-text-secondary disabled:opacity-30 flex-shrink-0"
            >
              <Icon id="calendar.edit" size={12} />
            </button>
          </div>
          )}
        </td>
        <td className="px-2 py-1">
          {isCost ? notForCost : locked ? (
            <span className={cellStatic + ' text-right'} title={t('resource.inheritedFieldHint')}>
              {resource.costPerHour != null ? numberFmt.format(resource.costPerHour) : '—'}
            </span>
          ) : (
            <input
              type="number"
              min={0}
              step="any"
              value={rateDraft}
              onChange={e => setRateDraft(e.target.value)}
              onBlur={commitRateDraft}
              {...cellProps(resource.id, 'cost')}
              className={cellInput + ' text-right'}
            />
          )}
        </td>
        {costLabel !== undefined && (
          <td className="px-2 py-1 text-right tabular-nums" title={t(isCost ? 'resource.costTotalHint' : 'resource.totalHint')} data-ops-resource-total={resource.id}>
            {costLabel}
          </td>
        )}
        <td className="px-2 py-1">
          {isCost ? notForCost : locked ? (
            <span className={cellStatic} title={t('resource.inheritedFieldHint')}>
              {isMaterial ? (resource.unitOfMeasure || '—') : '—'}
            </span>
          ) : (
            <input
              value={unitDraft}
              disabled={!isMaterial}
              onChange={e => setUnitDraft(e.target.value)}
              onBlur={commitUnitDraft}
              {...cellProps(resource.id, 'unit')}
              className={cellInput + ' disabled:opacity-30'}
              title={isMaterial ? undefined : t('resource.unitOnlyMaterial')}
            />
          )}
        </td>
        {showParentColumn && (
          <td className="px-2 py-1">
            {isCost ? notForCost : (
            <select
              value={resource.parentId ?? ''}
              onChange={e => onPatch({ parentId: e.target.value || undefined })}
              {...cellProps(resource.id, 'parent')}
              className={cellInput}
            >
              <option value="">{t('resource.noParent')}</option>
              {crews.filter(c => c.id !== resource.id).map(c => (
                <option key={c.id} value={c.id}>{c.name || c.id}</option>
              ))}
            </select>
            )}
          </td>
        )}
        <td className="px-1 py-1 text-center">
          <div className="flex items-center gap-0.5 justify-center">
            {isPool && onAssignToProject && !confirmingDelete && (
              <button
                onClick={onAssignToProject}
                className="btn btn--sm btn--secondary !py-0.5 !px-1.5 !text-small"
              >
                {t('companyLibrary.assignFromCompany')}
              </button>
            )}
            {!isPool && !resource.libraryOrigin && normalizeName(resource.name) !== '' && onPromoteToLibrary && !confirmingDelete && (
              <button
                onClick={onPromoteToLibrary}
                title={t('resource.promoteToLibrary')}
                className="btn btn--sm btn--secondary !py-0.5 !px-1.5 !text-small"
                data-ops-resource-promote
              >
                {t('resource.promoteToLibrary')}
              </button>
            )}
            {!isPool && !!resource.libraryOrigin && onUnlink && !confirmingDelete && (
              <button
                onClick={onUnlink}
                title={t('resource.unlinkFromLibrary')}
                className="p-1 rounded hover:bg-surface-hover text-text-secondary"
                data-ops-resource-unlink
              >
                <Icon id="resource.unlink-library" size={13} />
              </button>
            )}
            {confirmingDelete ? (
              <>
                <button
                  onClick={onConfirmRemove}
                  title={t('resource.panel.confirmDeleteYes')}
                  className="p-1 rounded hover:bg-surface-hover"
                  style={{ color: 'var(--error)' }}
                >
                  <Icon id="input.confirm-draft" size={13} />
                </button>
                <button
                  onClick={onCancelRemove}
                  title={t('resource.panel.confirmDeleteNo')}
                  className="p-1 rounded hover:bg-surface-hover text-text-secondary"
                >
                  <Icon id="ui.close" size={13} />
                </button>
              </>
            ) : (
              <button
                onClick={onRequestRemove}
                title={t('resource.panel.deleteRow')}
                className="p-1 rounded hover:bg-surface-hover"
                style={{ color: 'var(--error)' }}
              >
                <Icon id="edit.delete" size={13} />
              </button>
            )}
          </div>
        </td>
      </tr>
      {confirmingDelete && (
        <tr style={{ background: 'var(--theme-surface-alt)' }} data-ops-pool-delete-confirm={isPool ? true : undefined}>
          <td colSpan={colCount} className="px-3 py-1.5 !text-body" style={{ color: 'var(--error)' }}>
            {confirmMessage}
          </td>
        </tr>
      )}
      {stepsOpen && (
        <tr style={{ background: 'var(--theme-surface-alt)' }}>
          <td colSpan={colCount} className="px-3 py-2">
            <AvailabilityStepsEditor
              steps={resource.availabilitySteps ?? []}
              onChange={steps => onPatch({ availabilitySteps: steps.length > 0 ? steps : undefined })}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function PendingNewRow({
  draft, isPool, showTotalColumn, showParentColumn, calendarOptions, crews, autoColor,
  onChange, onCommit, onCancel, onMove, onReveal,
}: {
  autoColor: string;
  draft: ResourceDraft;
  isPool: boolean;
  showTotalColumn: boolean;
  showParentColumn: boolean;
  calendarOptions: { id: string; name: string }[];
  crews: Resource[];
  onChange: (patch: Partial<ResourceDraft>) => void;
  onCommit: () => void;
  onCancel: () => void;
  onMove: (mode: 'nextRow' | 'prevRow') => void;
  onReveal: () => void;
}) {
  const { t } = useTranslation('common');
  const isMaterial = draft.type === 'MATERIAL';
  const isCost = draft.type === 'COST';
  const costTitle = isCost ? t('resource.notForCost') : undefined;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); onCancel(); return; }
    const direction = liveGridNavDirection(e, controlKindOf(e.target as HTMLElement & { type?: string }));
    if (!direction) return;
    e.preventDefault();
    e.stopPropagation();
    onMove(direction === 'down' ? 'nextRow' : 'prevRow');
  };

  const onBlur = (e: React.FocusEvent<HTMLElement>) => {
    const next = e.relatedTarget as Node | null;
    if (next && e.currentTarget.contains(next)) return;
    onCommit();
  };

  const cell = (field: GridField) => ({
    'data-ops-grid-cell': `${DRAFT_ROW_ID}:${field}`,
    onKeyDown,
  });

  return (
    <tr
      className="border-b border-border-light"
      style={{ background: 'var(--theme-surface-alt)' }}
      data-ops-pending-new-row
      data-ops-grid-row={DRAFT_ROW_ID}
      onBlur={onBlur}
      onFocus={onReveal}
    >
      <td className="px-1 py-1">
        <input
          type="color"
          aria-label={t('resource.color')}
          title={t('resource.color')}
          value={draft.color ?? autoColor}
          onChange={e => onChange({ color: e.target.value })}
          className="block h-6 w-8 cursor-pointer rounded border border-border bg-transparent p-0"
        />
      </td>
      <td className="px-2 py-1">
        <input
          value={draft.name}
          onChange={e => onChange({ name: e.target.value })}
          {...cell('name')}
          className={cellInput}
          placeholder={t('resource.name')}
          autoFocus
        />
      </td>
      <td className="px-2 py-1">
        <select
          value={draft.type}
          onChange={e => onChange({ type: e.target.value as ResourceType })}
          {...cell('type')}
          className={cellInput}
        >
          {RESOURCE_TYPES.map(rt => (
            <option key={rt} value={rt}>{t(TYPE_KEY[rt])}</option>
          ))}
        </select>
      </td>
      <td className="px-2 py-1">
        <div className="flex items-center gap-1 justify-end">
          {isCost ? (
            <span className={cellStatic} title={costTitle} data-ops-resource-not-for-cost>—</span>
          ) : (
            <UnitsInput
              value={draft.maxUnits}
              ariaLabel={t('resource.maxUnits')}
              onCommit={n => onChange({ maxUnits: n })}
              gridCell={cell('maxUnits')['data-ops-grid-cell']}
              onKeyDown={onKeyDown}
              className={cellInput + ' text-right'}
            />
          )}
        </div>
      </td>
      <td className="px-2 py-1">
        <select
          value={draft.calendarId ?? ''}
          onChange={e => onChange({ calendarId: e.target.value || undefined })}
          {...cell('calendar')}
          disabled={isCost}
          title={costTitle}
          className={cellInput + ' disabled:opacity-30'}
        >
          <option value="">{isPool ? t('resource.noCalendar') : t('resource.projectCalendar')}</option>
          {calendarOptions.map(c => (
            <option key={c.id} value={c.id}>{c.name || c.id}</option>
          ))}
        </select>
      </td>
      <td className="px-2 py-1">
        <input
          type="number"
          min={0}
          step="any"
          value={draft.costPerHour ?? ''}
          onChange={e => {
            const raw = e.target.value;
            if (raw === '') { onChange({ costPerHour: undefined }); return; }
            const n = parseFloat(raw);
            if (Number.isFinite(n)) onChange({ costPerHour: n });
          }}
          {...cell('cost')}
          disabled={isCost}
          title={costTitle}
          className={cellInput + ' text-right disabled:opacity-30'}
        />
      </td>
      {showTotalColumn && <td className="px-2 py-1 text-right tabular-nums text-text-secondary">—</td>}
      <td className="px-2 py-1">
        <input
          value={draft.unitOfMeasure ?? ''}
          disabled={!isMaterial}
          onChange={e => onChange({ unitOfMeasure: e.target.value || undefined })}
          {...cell('unit')}
          className={cellInput + ' disabled:opacity-30'}
          title={isMaterial ? undefined : t('resource.unitOnlyMaterial')}
        />
      </td>
      {showParentColumn && (
        <td className="px-2 py-1">
          <select
            value={draft.parentId ?? ''}
            onChange={e => onChange({ parentId: e.target.value || undefined })}
            {...cell('parent')}
            disabled={isCost}
            title={costTitle}
            className={cellInput + ' disabled:opacity-30'}
          >
            <option value="">{t('resource.noParent')}</option>
            {crews.map(c => (
              <option key={c.id} value={c.id}>{c.name || c.id}</option>
            ))}
          </select>
        </td>
      )}
      <td className="px-1 py-1" />
    </tr>
  );
}

function AvailabilityStepsEditor({ steps, onChange }: {
  steps: AvailabilityStep[];
  onChange: (steps: AvailabilityStep[]) => void;
}) {
  const { t } = useTranslation('common');

  const update = (idx: number, patch: Partial<AvailabilityStep>) => {
    onChange(steps.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };
  const remove = (idx: number) => onChange(steps.filter((_, i) => i !== idx));
  const add = () => onChange([...steps, { from: localTodayIso(), maxUnits: 1 }]);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="!text-small uppercase tracking-wide" style={{ color: 'var(--theme-text-muted)' }}>
        {t('resource.availabilityStepsEditor.title')}
      </span>
      {steps.length === 0 && (
        <span className="!text-small text-text-secondary">{t('resource.availabilityStepsEditor.empty')}</span>
      )}
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-2">
          <label className="!text-small text-text-secondary">{t('resource.availabilityStepsEditor.from')}</label>
          <DateTextInput
            value={s.from}
            onCommit={v => update(i, { from: v })}
            className="input !text-body !px-1.5 !py-1"
            ariaLabel={t('resource.availabilityStepsEditor.from')}
          />
          <label className="!text-small text-text-secondary">{t('resource.availabilityStepsEditor.maxUnits')}</label>
          <UnitsInput
            value={s.maxUnits}
            ariaLabel={t('resource.availabilityStepsEditor.maxUnits')}
            onCommit={n => update(i, { maxUnits: n })}
            className="input !text-body !px-1.5 !py-1 !w-20 text-right"
          />
          <button onClick={() => remove(i)} className="p-0.5 rounded hover:bg-surface-hover" style={{ color: 'var(--error)' }}>
            <Icon id="edit.delete" size={12} />
          </button>
        </div>
      ))}
      <button onClick={add} className="btn btn--sm btn--secondary self-start flex items-center gap-1 mt-1">
        <Icon id="resource.availability-step-add" size={12} /> {t('resource.availabilityStepsEditor.addStep')}
      </button>
    </div>
  );
}

import { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useClickOutside } from '@/hooks/useClickOutside';
import { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';

export interface ContextMenuGroupInfo {
  key: string;
  collapsed: boolean;
}

export interface ContextMenuProps {
  x: number;
  y: number;
  /** Taak-rij-context (ook gezet bij een balk-klik — zie `barHit`). Uitsluitend `null` als de
   *  rechtsklik een bandkop (`group`) of leeg canvas raakte. */
  task: Task | null;
  /** Fase 2.10 golf 2: rechtsklik landde op de Gantt-BALK zelf (niet alleen de rij) — toont het
   *  balk-specifieke item (relatie leggen vanaf hier) bovenaan het taakmenu. */
  barHit: boolean;
  /** Fase 2.10 golf 2: rechtsklik op een bandkop-rij (gegroepeerde weergave) — apart, klein menu. */
  group: ContextMenuGroupInfo | null;
  traceActive: boolean;
  /** Pure boommodus (zelfde conditie als de indent/outdent-sneltoets) — bepaalt of indent/outdent
   *  in het taakmenu getoond wordt. */
  isTreeMode: boolean;
  /** Kalenderbibliotheek voor het "Kalender toewijzen"-submenu. */
  calendars: WorkCalendar[];
  /** Klembord leeg? (bepaalt of "Plakken" in het lege-canvas-menu enabled is). */
  canPaste: boolean;
  onClose: () => void;
  onEdit: () => void;
  onAddSubtask: () => void;
  onAddMilestone: () => void;
  onAddRelation: () => void;
  onTracePath: () => void;
  onSaveTemplate: () => void;
  /** Issue #42: APARTE in-/uitklap-acties (geen toggle) — zie het commentaar bij het menu-item. */
  onCollapse: () => void;
  onExpand: () => void;
  onDelete: () => void;
  onAddTask: () => void;
  // Golf 2 — taakrij
  onInsertAbove: () => void;
  onInsertBelow: () => void;
  onIndent: () => void;
  onOutdent: () => void;
  onToggleMilestone: () => void;
  onSetCalendar: (calendarId: string | undefined) => void;
  onSetProgress: (completion: number) => void;
  onSetPriority: (priority: number) => void;
  // Golf 2 — balk
  onStartRelationFromBar: () => void;
  // Golf 2 — leeg canvas
  onPaste: () => void;
  onZoomReset: () => void;
  onFitToProject: () => void;
  // Golf 2 — bandkop
  onToggleGroupCollapse: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

const PRIORITY_LOW = 100;
const PRIORITY_NORMAL = 500;
const PRIORITY_HIGH = 900;

// Browserreview, observatie 6: de kolomkop-contextmenu (DataGridHeader.tsx) had zijn EIGEN, losse
// maatvoering (globals.css .task-grid-header-context-menu) — `font: inherit` op de knoppen, in een
// createPortal(..., document.body), erft daardoor `html/body`'s `calc(13px * --ui-font-scale)`
// (issue #25.4) i.p.v. de `text-xs` (0.75rem) van dít menu. Op elke schaal is dat zichtbaar te groot
// t.o.v. het taakmenu — bij een verhoogde --ui-font-scale precies zo groot als de gebruiker meldde
// ("wat je bij 150% zou zien"). Eén bron voor beide menu's i.p.v. twee losse maatvoeringen die
// opnieuw uit elkaar kunnen groeien: exporteer de klassen hier, laat DataGridHeader ze hergebruiken
// op zijn EIGEN role="menu"/role="menuitem"-opbouw (dat menu is al toegankelijker dan dít — dit
// exporteert dus alleen het VISUELE token, niet de semantiek).
export const CONTEXT_MENU_CONTAINER_CLASS =
  'fixed z-[var(--z-contextmenu)] bg-surface border border-border rounded-[8px] shadow-[var(--shadow-pop)] py-1 min-w-[180px]';
// Bewust GEEN tekstkleur hierin: de "danger"-variant (zie MenuItem hieronder) zet `text-red-400`
// i.p.v. `text-text-primary`, en twee kleurklassen van gelijke specificiteit op één element laten
// de uitkomst afhangen van Tailwinds GEGENEREERDE bronvolgorde, niet van de volgorde in de
// className-string — elke aanroeper kiest daarom zijn eigen kleur bovenop deze basis.
export const CONTEXT_MENU_ITEM_CLASS =
  'w-full text-left px-3 py-1.5 text-xs hover:bg-surface-hover transition-colors flex items-center gap-1.5';

export function ContextMenu({
  x, y, task, barHit, group, traceActive, isTreeMode, calendars, canPaste, onClose,
  onEdit, onAddSubtask, onAddMilestone, onAddRelation, onTracePath, onSaveTemplate,
  onCollapse, onExpand, onDelete, onAddTask,
  onInsertAbove, onInsertBelow, onIndent, onOutdent, onToggleMilestone,
  onSetCalendar, onSetProgress, onSetPriority,
  onStartRelationFromBar,
  onPaste, onZoomReset, onFitToProject,
  onToggleGroupCollapse, onExpandAll, onCollapseAll,
}: ContextMenuProps) {
  // `common` blijft de standaard-namespace; `menu` staat erbij zodat het in-/uitklap-item exact
  // dezelfde labels draagt als de Beeld-tab (issue #42) in plaats van een tweede, eigen vertaling
  // die daar stilletjes van weg kan lopen.
  const { t } = useTranslation(['common', 'menu']);
  const menuRef = useRef<HTMLDivElement>(null);
  // Welk submenu (bv. "calendar"/"progress"/"priority") momenteel opengeklapt is. Eén op een
  // moment — hoveren over een ander item/submenu-trigger sluit het vorige (zie SubMenuTrigger).
  const [openSub, setOpenSub] = useState<string | null>(null);

  // Sluit bij klik-buiten, rechtsklik-buiten of Escape. `defer` zorgt dat de openende
  // rechtsklik-event-reeks het menu niet meteen weer sluit; de hook houdt `onClose` via een
  // interne ref actueel zodat parent-renders (muisbeweging/hover op het canvas) de defer-timer
  // niet resetten — precies het gedrag dat hier voorheen handmatig stond.
  // Escape sluit ALTIJD het hele menu (incl. een eventueel open submenu) — geen aparte
  // "sluit alleen het submenu"-stap, consistent met de rest van de app (zie shortcutRegistry).
  useClickOutside(menuRef, onClose, true, { escape: true, contextmenu: true, defer: true });

  // Positie binnen het venster houden. Het menu's hoogte varieert sterk met de context (rij-menu
  // met indent/outdent/samenvatting-items kan 400+ px worden) — een vaste aanname (bv. "-300")
  // klopt dan niet meer en laat het menu (vooral bij een klik onderin lange taaklijsten, zoals een
  // afsluitende mijlpaal) voorbij de vensterrand vallen. Meet daarom de ECHTE afmeting na mount en
  // klem daarop; `useLayoutEffect` draait vóór de browser schildert, dus geen zichtbare sprong.
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
  // Submenu's flippen naar links als de trigger te dicht bij de rechterrand van het venster staat
  // (anders valt de flyout goeddeels buiten beeld).
  const flipSub = pos.left > window.innerWidth - 380;

  const isSummary = task ? task.childIds.length > 0 : false;
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
          <MenuItem label={t('context.addRelation')} onClick={() => { onAddRelation(); closeAll(); }} onEnter={() => setOpenSub(null)} />
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
              {/* Issue #42: TWEE aparte items i.p.v. één "In-/uitklappen"-toggle, gelijk aan de
                  Beeld-tab (zie `outlineGroup` in ribbonConfig.tsx). Reden om apart te zijn: de
                  actie werkt op de hele selectie zodra de aangeklikte taak daarin zit, en een
                  toggle kan een gemengde selectie nooit in één keer dezelfde kant op zetten.
                  BEIDE items zijn ALTIJD zichtbaar en nooit uitgeschakeld — ook "Uitklappen" op een
                  al-uitgeklapte tak. Een contextmenu waarvan de itemlijst per rij verspringt kost
                  meer dan het oplevert (spiermemorie, en bij een selectie is "al ingeklapt?" per
                  taak verschillend, dus er is geen eerlijk enkelvoudig antwoord). Idempotent
                  klikken is hier onschadelijk. */}
              <MenuItem label={t('menu:ribbon.collapseTasks')} onClick={() => { onCollapse(); closeAll(); }} onEnter={() => setOpenSub(null)} />
              <MenuItem label={t('menu:ribbon.expandTasks')} onClick={() => { onExpand(); closeAll(); }} onEnter={() => setOpenSub(null)} />
              <MenuItem label={t('context.saveTemplate')} onClick={() => { onSaveTemplate(); closeAll(); }} onEnter={() => setOpenSub(null)} />
            </>
          )}
          <Separator />
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
          <Separator />
          <MenuItem label={t('context.zoomReset')} onClick={() => { onZoomReset(); closeAll(); }} onEnter={() => setOpenSub(null)} />
          <MenuItem label={t('context.fitToProject')} onClick={() => { onFitToProject(); closeAll(); }} onEnter={() => setOpenSub(null)} />
        </>
      )}
    </div>
  );
}

function MenuItem({
  label, onClick, danger, checked, disabled, onEnter,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  /** Toont een vinkje vóór het label — voor submenu-presets (huidige kalender/voortgang/prioriteit). */
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
    >
      {checked !== undefined && (
        <span className="inline-block w-3 text-[10px]">{checked ? '✓' : ''}</span>
      )}
      {label}
    </button>
  );
}

/** Klein, generiek submenu-mechanisme (fase 2.10 golf 2): hover opent een flyout naast het item.
 *  Blijft binnen dezelfde buitenste menu-container (geen eigen mousedown/Escape-afhandeling nodig —
 *  die van het bovenliggende menu dekt ook de flyout, want de flyout is een kind-element ervan). */
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
      <div className="w-full flex items-center justify-between gap-3 px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover transition-colors cursor-default select-none">
        <span>{label}</span>
        <span className="text-text-secondary">{flip ? '◂' : '▸'}</span>
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

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/icons';
import { ColumnChooser, type ColumnChooserLabels } from '@/components/task-grid/ColumnChooser';
import type { TaskGridAdapterColumn } from '@/engine/taskGrid/taskGridAdapter';
import type { TaskColumnId } from '@/types/taskGrid';
import { REPORT_MAX_COLUMNS, REPORT_REQUIRED_COLUMN } from '@/utils/reportSettings';
import { addReportColumn, isDefaultReportColumns, moveReportColumn, placeReportColumn, removeReportColumn } from './reportColumns';

/** Waar "Kolommen overnemen" de kolommen vandaan haalt: het tabblad Tabel of de tabel naast de Gantt. */
export type ReportColumnsSource = 'table' | 'gantt';

/**
 * De kolommen van de afdruk (stap Kolommen): de lijst in papiervolgorde, met slepen of Alt+↑/↓ om te
 * verplaatsen en Delete om weg te halen. Toevoegen gaat met het kolomvenster van de tabel (`ColumnChooser`,
 * check Ethan 9-11-2026: "dezelfde dialog als in het tabel tab"); twee knoppen nemen de kolommen van het
 * tabblad Tabel of van de tabel naast de Gantt over. De taaknaam is verplicht: zijn kruisje staat uit.
 */
export function ColumnsEditor({
  ids, onChange, available, recentIds, chooserLabels, onCopy, onReset, focusId, labelFor, readOnlyHint,
}: {
  ids: readonly string[];
  /** Alleen tonen, met deze uitleg (*Zoals de weergave*: de kolommen volgen de tabel naast de Gantt). De rijen
   *  staan grijs en tonen de uitleg meteen als tooltip, bij de muis en bij focus (check Ethan 10-11-2026: "mag
   *  uitgegrijsd", de melding erboven "kan in een instant tooltip"). Geen toevoegen, overnemen, slepen,
   *  verplaatsen of weghalen; met de pijltjes door de lijst lopen kan wel. */
  readOnlyHint?: string;
  onChange: (ids: string[], input: string) => void;
  available: readonly TaskGridAdapterColumn[];
  /** De laatst gebruikte kolommen van de tabel: de kiezer toont ze bovenaan, zoals in de tabel. */
  recentIds: readonly TaskColumnId[];
  /** De teksten van de kiezer: dezelfde als in de tabel. */
  chooserLabels: ColumnChooserLabels;
  /** Kolommen overnemen van het tabblad Tabel of van de tabel naast de Gantt (elk met Ongedaan maken). */
  onCopy: (source: ReportColumnsSource) => void;
  /** "Herstel standaard" onderaan de kiezer: de standaardkolommen, met Ongedaan maken. */
  onReset: () => void;
  /** Een kolom die op het papier is aangeklikt: die rij licht op en krijgt focus. */
  focusId: string | null;
  labelFor: (id: string) => string;
}) {
  const { t } = useTranslation('report');
  const readOnly = readOnlyHint !== undefined;
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; over: number } | null>(null);

  useEffect(() => {
    if (!focusId || !ids.includes(focusId)) return;
    setActiveId(focusId);
    setFlashId(focusId);
    const node = rowRefs.current.get(focusId);
    node?.scrollIntoView({ block: 'nearest' });
    node?.focus({ preventScroll: true });
    const timer = window.setTimeout(() => setFlashId(null), 1300);
    return () => window.clearTimeout(timer);
  }, [focusId, ids]);

  const focusRow = (id: string | undefined) => {
    if (!id) return;
    setActiveId(id);
    requestAnimationFrame(() => rowRefs.current.get(id)?.focus());
  };

  const onRowKeyDown = (e: KeyboardEvent<HTMLDivElement>, id: string, index: number) => {
    if (e.target !== e.currentTarget) return;
    const move = !readOnly && (e.altKey || e.ctrlKey || e.metaKey);
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const delta = e.key === 'ArrowUp' ? -1 : 1;
      if (move) {
        onChange(moveReportColumn(ids, id, delta), 'column-move');
        focusRow(id);
      } else {
        focusRow(ids[index + delta]);
      }
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      focusRow(e.key === 'Home' ? ids[0] : ids[ids.length - 1]);
    } else if (!readOnly && (e.key === 'Delete' || e.key === 'Backspace') && id !== REPORT_REQUIRED_COLUMN) {
      e.preventDefault();
      onChange(removeReportColumn(ids, id), 'column-remove');
      focusRow(ids[index + 1] ?? ids[index - 1]);
    }
  };

  // Slepen met de muis of pen: de greep vangt de aanwijzer; de rij onder de aanwijzer bepaalt de plek.
  const onGripDown = (e: ReactPointerEvent<HTMLElement>, id: string) => {
    if (e.button !== 0) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ id, over: ids.indexOf(id) });
  };
  const dropIndexAt = (clientY: number): number => {
    let index = 0;
    for (const id of ids) {
      const node = rowRefs.current.get(id);
      if (!node) continue;
      const rect = node.getBoundingClientRect();
      if (clientY > rect.top + rect.height / 2) index++;
    }
    return index;
  };
  const onGripMove = (e: ReactPointerEvent<HTMLElement>) => {
    if (!drag) return;
    const over = dropIndexAt(e.clientY);
    if (over !== drag.over) setDrag({ ...drag, over });
  };
  const onGripUp = () => {
    if (!drag) return;
    const from = ids.indexOf(drag.id);
    // `over` telt rijen boven de aanwijzer, inclusief de gesleepte zelf; na het weghalen schuift alles één op.
    const to = drag.over > from ? drag.over - 1 : drag.over;
    if (to !== from) onChange(placeReportColumn(ids, drag.id, to), 'column-drag');
    setDrag(null);
  };

  const full = ids.length >= REPORT_MAX_COLUMNS;
  const visibleIds = new Set(ids as readonly TaskColumnId[]);
  const isDefault = isDefaultReportColumns(ids);
  const dropLineAt = drag ? drag.over : -1;
  const dragFrom = drag ? ids.indexOf(drag.id) : -1;
  const showDropLine = (i: number) => drag !== null && dropLineAt === i && i !== dragFrom && i !== dragFrom + 1;

  return (
    <div className="rs-cols-editor">
      {!readOnly && (<>
      {/* Toevoegen boven de lijst: op een laag scherm blijft de knop in beeld, ook bij veel kolommen. Na een
          keuze sluit de kiezer en staat de focus weer op "Kolom toevoegen", zoals in de tabel. */}
      <ColumnChooser
        options={available}
        recentIds={recentIds}
        visibleIds={visibleIds}
        labels={chooserLabels}
        resetDisabled={isDefault}
        onReset={() => { onReset(); return true; }}
        onChoose={option => {
          const id = String(option.id);
          if (full || ids.includes(id)) return false;
          onChange(addReportColumn(ids, id), 'column-add');
          setFlashId(id);
          return true;
        }}
        trigger={{
          anchorClassName: 'rs-add-anchor',
          className: 'btn btn--secondary btn--sm rs-add',
          disabled: full,
          content: (
            <>
              <Icon id="table.column-add-menu" size={14} />
              {full ? t('studio.columns.full', { count: REPORT_MAX_COLUMNS }) : chooserLabels.addColumn}
            </>
          ),
          data: { 'data-rs-add-column': true },
        }}
      />
      <div className="rs-cols-copy" role="group" aria-labelledby="rs-cols-copy-label">
        <span className="rs-field-label" id="rs-cols-copy-label">{t('studio.columns.copyLabel')}</span>
        <div className="rs-cols-tools">
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => onCopy('table')}
            title={t('studio.columns.fromTableHint')} data-rs-like-grid="table">
            <Icon id="table.columns" size={14} />
            {t('studio.columns.fromTable')}
          </button>
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => onCopy('gantt')}
            title={t('studio.columns.fromGanttHint')} data-rs-like-grid="gantt">
            <Icon id="planning.gantt" size={14} />
            {t('studio.columns.fromGantt')}
          </button>
        </div>
      </div>
      </>)}

      <div className="rs-cols" role="listbox" aria-label={t('studio.columns.listLabel')}
        aria-describedby={readOnly ? undefined : 'rs-cols-hint'} aria-readonly={readOnly || undefined}
        data-rs-columns data-readonly={readOnly ? 'true' : undefined}>
        {ids.map((id, i) => {
          const required = id === REPORT_REQUIRED_COLUMN;
          const tabbable = (activeId ?? ids[0]) === id;
          return (
            <div key={id} className="contents">
              {showDropLine(i) && <div className="rs-drop-line" aria-hidden="true" />}
              <div
                ref={el => { if (el) rowRefs.current.set(id, el); else rowRefs.current.delete(id); }}
                className="rs-col"
                role="option"
                aria-selected={activeId === id}
                tabIndex={tabbable ? 0 : -1}
                data-rs-column={id}
                data-dragging={drag?.id === id ? 'true' : undefined}
                data-flash={flashId === id ? 'true' : undefined}
                onFocus={() => setActiveId(id)}
                onKeyDown={e => onRowKeyDown(e, id, i)}
                title={readOnlyHint}
                data-tooltip-instant={readOnly || undefined}
                data-tooltip-lead={readOnly || undefined}
              >
                {!readOnly && (
                <span
                  className="rs-grip"
                  onPointerDown={e => onGripDown(e, id)}
                  onPointerMove={onGripMove}
                  onPointerUp={onGripUp}
                  onPointerCancel={() => setDrag(null)}
                  title={t('studio.columns.drag')}
                  aria-hidden="true"
                  data-rs-grip={id}
                >
                  <span className="rs-grip-dots" />
                </span>
                )}
                <span className="rs-col-name">
                  {labelFor(id)}
                  {required && <small>{t('studio.columns.required')}</small>}
                </span>
                {!readOnly && (
                <span className="rs-col-actions">
                  <button type="button" className="rs-icon-btn" tabIndex={-1} data-reveal
                    disabled={i === 0} onClick={() => { onChange(moveReportColumn(ids, id, -1), 'column-move'); focusRow(id); }}
                    title={t('studio.columns.moveUp')} aria-label={t('studio.columns.moveUp')}>
                    <span aria-hidden="true">↑</span>
                  </button>
                  <button type="button" className="rs-icon-btn" tabIndex={-1} data-reveal
                    disabled={i === ids.length - 1} onClick={() => { onChange(moveReportColumn(ids, id, 1), 'column-move'); focusRow(id); }}
                    title={t('studio.columns.moveDown')} aria-label={t('studio.columns.moveDown')}>
                    <span aria-hidden="true">↓</span>
                  </button>
                  {required ? (
                    // Het kruisje van de andere rijen, uitgeschakeld (check Ethan 9-11-2026). `aria-disabled` in
                    // plaats van `disabled`: zo toont de muis de uitleg nog als tooltip.
                    <button type="button" className="rs-icon-btn" tabIndex={-1} aria-disabled="true"
                      title={t('studio.columns.requiredHint')} aria-label={t('studio.columns.requiredHint')} data-rs-required-slot>
                      <Icon id="list.item-remove" size={14} />
                    </button>
                  ) : (
                    <button type="button" className="rs-icon-btn" tabIndex={-1}
                      onClick={() => onChange(removeReportColumn(ids, id), 'column-remove')}
                      title={t('studio.columns.remove')} aria-label={t('studio.columns.remove')} data-rs-remove={id}>
                      <Icon id="list.item-remove" size={14} />
                    </button>
                  )}
                </span>
                )}
              </div>
            </div>
          );
        })}
        {showDropLine(ids.length) && <div className="rs-drop-line" aria-hidden="true" />}
      </div>
      {/* De toetsen als vaste regel onder de lijst: hij dekt niets af en niets verspringt als de focus de
          lijst verlaat. */}
      {!readOnly && <p className="rs-hint rs-cols-hint" id="rs-cols-hint" data-rs-cols-hint>{t('studio.columns.keysHint')}</p>}
    </div>
  );
}

import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { Dialog, DialogHeader } from '@/components/common/Dialog';
import { formatReportNumber } from '@/utils/reportNumber';
import type { PhaseAssignmentQuestion, PhaseAssignmentQuestionItem } from '@/state/slices/types';

/**
 * De vraag "Taak wordt een samenvattingstaak" (eigenaarsbesluit 2026-10-17, "altijd vragen"). Een taak met
 * toewijzingen krijgt door een structuurhandeling haar eerste subtaak; een samenvattingstaak draagt zelf geen
 * toewijzingen. De planner kiest:
 *  - Annuleren (knop, kruisje, Escape): er verandert niets, ook de structuurhandeling niet;
 *  - Toewijzing verwijderen: de taak krijgt haar subtaken, haar toewijzingen verdwijnen;
 *  - Verplaatsen naar '<subtaak>': de toewijzingen gaan naar de eerste nieuwe subtaak die ze mag
 *    dragen. Kan dat niet (die subtaak heeft dezelfde resource al, of er is geen geschikte subtaak),
 *    dan is de knop uit, zegt een infoblok waarom, en is Verwijderen de primaire knop.
 * Eén vraag voor de hele handeling; de keuze geldt voor elke nieuwe samenvattingstaak.
 *
 * Verricht werk (eigenaarsbesluit 2026-10-17): draagt een toewijzing al verricht werk, dan noemt het
 * infoblok per resource hoeveel uur Verwijderen weggooit, en ligt de focus en de primaire stijl op
 * Annuleren. Enter gooit zo nooit verricht werk weg; Verwijderen blijft een bewuste klik.
 *
 * Rendert alleen bij `ui.pendingPhaseAssignmentQuestion`; het antwoord gaat naar
 * `answerPhaseAssignmentQuestion`, die de handeling met de keuze uitvoert. Stapelt boven "Taak
 * bewerken" (`z-[60]`); de toetsen lopen via de dialoogstapel van `Dialog` (alleen de bovenste
 * reageert): Escape = Annuleren, Enter = de knop met focus, anders de primaire keuze. Alle globale
 * sneltoetsen staan dicht zolang de vraag open is (`isGlobalShortcutFrozen`). Geen backdrop-klik:
 * kiezen gaat alleen met een knop. Geen ?-knop: die zou Help áchter "Taak bewerken" openen
 * (zelfde keuze als `ActualStartDialog`).
 */
/** "Jan, Piet en Klaas" in de taal van de app. Een onbekende taalcode ⇒ een kale kommalijst. */
function formatNameList(locale: string, names: readonly string[]): string {
  try {
    return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(names);
  } catch {
    return names.join(', ');
  }
}

/** Onzichtbaar scheidingsteken rond een naam in een vertaalde zin; komt in geen vertaling voor. */
const NAME_MARK = '\u2063';

/**
 * Zet elke taak- en resourcenaam in een `<bdi>`: in een RTL-taal (of de Engelse terugvaltekst daarin)
 * blijven de aanhalingstekens en leestekens rond een Latijnse naam dan op hun plek. `build` krijgt
 * `name()`, dat een naam markeert; de zichtbare tekst blijft precies gelijk.
 */
function withIsolatedNames(build: (name: (value: string) => string) => string): ReactNode[] {
  const names: string[] = [];
  const text = build(value => `${NAME_MARK}${names.push(value) - 1}${NAME_MARK}`);
  return text.split(NAME_MARK).map((part, index) => (index % 2 === 1 ? <bdi key={index}>{names[Number(part)]}</bdi> : part));
}

export function PhaseAssignmentDialog() {
  const pending = useAppStore(s => s.ui.pendingPhaseAssignmentQuestion);
  if (!pending) return null;
  return <PhaseAssignmentDialogBody key={pending.items.map(item => item.phaseId).join('|')} question={pending} />;
}

function PhaseAssignmentDialogBody({ question }: { question: PhaseAssignmentQuestion }) {
  const { t, i18n } = useTranslation('common');
  const answer = useAppStore(s => s.answerPhaseAssignmentQuestion);
  const primaryRef = useRef<HTMLButtonElement>(null);

  const list = (names: readonly string[], name: (value: string) => string) =>
    formatNameList(i18n.language, names.map(name));
  const items = question.items;
  const single = items.length === 1 ? items[0] : null;
  const blocked = items.filter(item => item.blocked !== null);
  const canMove = blocked.length === 0;
  const assignmentCount = items.reduce((sum, item) => sum + item.resourceNames.length, 0);

  const actualWork = items.flatMap(item => item.actualWork);
  // Welke knop is primair (stijl, beginfocus, Enter zonder knopfocus)?
  const primaryKind: 'cancel' | 'remove' | 'move' = actualWork.length > 0 ? 'cancel' : canMove ? 'move' : 'remove';

  const cancel = () => answer(null);
  const primary = () => answer(primaryKind === 'cancel' ? null : primaryKind);
  const primaryClass = 'btn btn--sm btn--primary shadow-[var(--shadow-glow)]';
  const secondaryClass = 'btn btn--sm btn--secondary';

  useEffect(() => { primaryRef.current?.focus(); }, []);

  const blockedLine = (item: PhaseAssignmentQuestionItem) => withIsolatedNames(name => (item.blocked?.kind === 'duplicateResource'
    ? t('phaseAssignmentQuestion.blockedDuplicate', {
      child: name(item.targetName ?? '?'), resources: list(item.blocked.resourceNames, name),
    })
    : t('phaseAssignmentQuestion.blockedNoChild', { phase: name(item.phaseName) })));

  // Eén nieuwe samenvattingstaak met een geschikte subtaak: die naam op de knop; anders algemeen.
  const targetName = single?.targetName;
  const moveLabel = targetName
    ? withIsolatedNames(name => t('phaseAssignmentQuestion.moveTo', { child: name(targetName) }))
    : t('phaseAssignmentQuestion.moveToSubtasks');

  return (
    <Dialog
      onCancel={cancel}
      onConfirm={primary}
      focusedButtonOwnsEnter
      overlayClassName="bg-black/60 z-[60]"
      stopBackdropPropagation
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[500px] max-h-[85vh] flex flex-col overflow-hidden"
      panelProps={{ 'data-ops-phase-dialog': true }}
    >
        <DialogHeader
          title={t('phaseAssignmentQuestion.title')}
          onClose={cancel}
        />
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 text-small leading-5 text-text-primary">
          {single ? (
            <p data-ops-phase-dialog-text>
              {withIsolatedNames(name => t('phaseAssignmentQuestion.intro', {
                count: single.childCount, phase: name(single.phaseName), child: name(single.firstChildName),
              }))}
              {' '}
              {t('phaseAssignmentQuestion.noOwnAssignments')}
              {' '}
              {withIsolatedNames(name => t('phaseAssignmentQuestion.question', {
                count: single.resourceNames.length, resources: list(single.resourceNames, name),
              }))}
            </p>
          ) : (
            <>
              <p data-ops-phase-dialog-text>
                {t('phaseAssignmentQuestion.introMany', { count: items.length })}
                {' '}
                {t('phaseAssignmentQuestion.noOwnAssignments')}
                {' '}
                {t('phaseAssignmentQuestion.questionMany')}
              </p>
              <ul className="flex flex-col gap-1 pl-4 list-disc">
                {items.map(item => (
                  <li key={item.phaseId} data-ops-phase-dialog-row={item.phaseId}>
                    {withIsolatedNames(name => t('phaseAssignmentQuestion.row', {
                      phase: name(item.phaseName), resources: list(item.resourceNames, name),
                    }))}
                  </li>
                ))}
              </ul>
            </>
          )}
          {(!canMove || actualWork.length > 0) && (
            <div className="alert alert--info flex flex-col gap-1" data-ops-phase-notice>
              {blocked.map(item => <span key={item.phaseId} data-ops-phase-move-blocked>{blockedLine(item)}</span>)}
              {actualWork.map((work, index) => {
                const hours = Math.round(work.minutes / 60 * 100) / 100;
                return (
                  <span key={index} data-ops-phase-actual-work>
                    {withIsolatedNames(name => t('phaseAssignmentQuestion.actualWorkLost', {
                      count: hours, hours: formatReportNumber(hours, i18n.language), resource: name(work.resourceName),
                    }))}
                  </span>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 px-4 py-3 border-t border-border">
          <button
            ref={primaryKind === 'cancel' ? primaryRef : undefined}
            onClick={cancel}
            className={primaryKind === 'cancel' ? primaryClass : secondaryClass}
            data-ops-phase-cancel
          >
            {t('cancel')}
          </button>
          <button
            ref={primaryKind === 'remove' ? primaryRef : undefined}
            onClick={() => answer('remove')}
            className={primaryKind === 'remove' ? primaryClass : secondaryClass}
            data-ops-phase-remove
          >
            {t('phaseAssignmentQuestion.remove', { count: assignmentCount })}
          </button>
          <button
            ref={primaryKind === 'move' ? primaryRef : undefined}
            onClick={() => answer('move')}
            disabled={!canMove}
            className={primaryKind === 'move' ? primaryClass : secondaryClass}
            data-ops-phase-move
          >
            {/* Eén flex-item: de knop heeft `gap`, anders komt er ruimte rond de <bdi>. */}
            <span>{moveLabel}</span>
          </button>
        </div>
    </Dialog>
  );
}

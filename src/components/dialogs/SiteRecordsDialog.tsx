import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { Dialog, DialogHeader } from '@/components/common/Dialog';
import { ifcGuid128, ifcObjectSeed } from '@/services/ifc/ifcWriter';
import {
  siteHostRecords, tasksToRecords, TASK_RECORD_KIND, type SiteRecordProject,
} from '@/services/fileAccess/siteHostRecords';

/** De tekst van een fout van de site (een `Error` of een object met `message`). */
function messageOf(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error !== null && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  return String(error);
}

/**
 * "Taken naar de site": bewaar de taken van de planning bij een project in ERPNext, via `records` op
 * de host (`siteHostRecords.ts`). Elke taak wordt een object op de site én een taak in ERPNext;
 * opnieuw bewaren werkt ze bij. Samenvattingstaken gaan niet mee.
 *
 * Geen backdrop-klik: de dialoog heeft een keuzeveld (regel uit `Dialog.tsx`, issue #158).
 */
export function SiteRecordsDialog() {
  const { t } = useTranslation('common');
  const tasks = useAppStore(s => s.tasks);
  const ifcGlobalIds = useAppStore(s => s.ifcGlobalIds);
  const setUI = useAppStore(s => s.setUI);
  const close = () => setUI({ showSiteRecordsDialog: false });

  const [projects, setProjects] = useState<SiteRecordProject[] | null>(null);
  const [project, setProject] = useState('');
  const [kept, setKept] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // De sleutel van een taak is zijn GlobalId in het IFC-bestand: dat uit het ingelezen bestand, anders
  // het GlobalId dat de schrijver hem bij het opslaan geeft.
  const records = useMemo(() => tasksToRecords(tasks, (id) => {
    const seed = ifcObjectSeed('task', id);
    return ifcGlobalIds?.[seed] ?? ifcGuid128(seed);
  }), [tasks, ifcGlobalIds]);

  useEffect(() => {
    let current = true;
    const host = siteHostRecords();
    if (!host) { setProjects([]); return; }
    host.projects().then((found) => {
      if (!current) return;
      setProjects(found);
      setProject((chosen) => chosen || found[0]?.id || '');
    }).catch((e: unknown) => {
      if (!current) return;
      setProjects([]);
      setError(messageOf(e));
    });
    return () => { current = false; };
  }, []);

  const countKept = useCallback(async (projectId: string) => {
    const host = siteHostRecords();
    if (!host || !projectId) { setKept(null); return; }
    try {
      setKept((await host.list({ project: projectId, kind: TASK_RECORD_KIND })).length);
    } catch (e) {
      setKept(null);
      setError(messageOf(e));
    }
  }, []);

  useEffect(() => { void countKept(project); }, [project, countKept]);

  const save = async () => {
    const host = siteHostRecords();
    if (!host || !project || records.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const saved = await host.save(records, { project });
      setDone(t('siteRecords.saved', { count: saved.length }));
      await countKept(project);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };

  const canSave = !!project && records.length > 0 && !busy;

  return (
    <Dialog
      onCancel={close}
      onConfirm={() => { void save(); }}
      focusedButtonOwnsEnter
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[460px] flex flex-col overflow-hidden"
      panelProps={{ 'data-ops-site-records-dialog': true }}
    >
      <DialogHeader title={t('siteRecords.title')} onClose={close} />

      <div className="p-4 flex flex-col gap-2 text-small leading-4">
        <p className="text-text-secondary">{t('siteRecords.intro')}</p>
        {projects === null ? (
          <p className="text-text-secondary">{t('siteRecords.loading')}</p>
        ) : projects.length === 0 ? (
          !error && <p className="text-text-secondary" data-ops-site-records-empty>{t('siteRecords.noProjects')}</p>
        ) : (
          <>
            <label className="font-semibold" htmlFor="ops-site-records-project">{t('siteRecords.projectLabel')}</label>
            <select
              id="ops-site-records-project"
              className="input !text-small !leading-4 !px-2.5 !py-1.5"
              value={project}
              onChange={(e) => { setProject(e.target.value); setDone(null); setError(null); }}
              data-ops-site-records-project
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.title === p.id ? p.id : `${p.title} (${p.id})`}</option>
              ))}
            </select>
            <p data-ops-site-records-count>{t('siteRecords.taskCount', { count: records.length })}</p>
            {kept !== null && <p className="text-text-secondary" data-ops-site-records-kept>{t('siteRecords.keptCount', { count: kept })}</p>}
          </>
        )}
        {done && <p role="status" data-ops-site-records-done>{done}</p>}
        {error && <p role="alert" className="text-danger" data-ops-site-records-error>{error}</p>}
      </div>

      <div className="flex justify-end gap-2 px-4 py-3 border-t border-border">
        <button className="btn btn--sm btn--secondary" onClick={close}>{t('close')}</button>
        <button
          className="btn btn--sm btn--primary shadow-[var(--shadow-glow)]"
          disabled={!canSave}
          onClick={() => { void save(); }}
          data-ops-site-records-save
        >
          {t('siteRecords.save')}
        </button>
      </div>
    </Dialog>
  );
}

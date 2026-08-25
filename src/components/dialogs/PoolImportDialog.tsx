import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, X } from 'lucide-react';
import { useAppStore } from '@/state/appStore';
import { readPoolIFC, resolveUniqueCompanyName, resolvePoolImportPreselection, classifyPoolImportIdentityHint } from '@/services/library';
import { openFileDialog } from '@/services/fileAccess';
import { Dialog } from '@/components/common/Dialog';
import type { CompanyPool } from '@/types/library';

const TARGET_COMPANY_SELECT_ID = 'pool-import-target-company';

/**
 * Pool-import (spec §4, issue #19-fix): kies bestand → kies expliciet een actie → bevestig.
 *
 * "Een bibliotheek importeren" voelde aan als "een bibliotheek openen" maar was in werkelijkheid de
 * gekozen bibliotheek onvoorwaardelijk overschrijven (`replacePool`) — met als extra gevolg dat de
 * herkomst uit het bestand (companyId/companyName) werd weggegooid en vervangen door het DOEL-bedrijf,
 * wat het deel-scenario brak (een meegestuurd project met stempels naar het BRON-companyId herkende
 * zijn bibliotheek dan niet meer na import). Twee expliciete opties lossen dat op:
 *
 * 1. "Toevoegen als nieuwe resourcebibliotheek" (`importPoolAsNewCompany`) — maakt een NIEUW bedrijf
 *    van het bestand; behoudt het companyId uit het bestand als dat lokaal nog vrij is (zodat een
 *    meegestuurd project zijn bibliotheek herkent), met naams-/id-botsing afgehandeld door de actie
 *    zelf. Bindt het actieve project NIET automatisch.
 * 2. "Een bestaande resourcebibliotheek vervangen" (`replacePool`) — het oude gedrag, inclusief de
 *    demping-waarschuwing (`isLocalPoolNewer`) — nu ALLEEN zichtbaar bij deze optie.
 *
 * Voorselectie (de kern van de fix): bevat het bestand een companyId dat lokaal NIET bestaat, dan
 * staat "toevoegen" voorgeselecteerd (de standaardklik kan dan nooit onherstelbaar iets overschrijven).
 * Bestaat het id wél lokaal, dan staat "vervangen" voorgeselecteerd met precies díe bibliotheek gekozen
 * — dat is aantoonbaar dezelfde bibliotheek in een andere versie.
 *
 * Uitzondering (critreview F1): `DEFAULT_COMPANY_ID`/`DEMO_COMPANY_ID` (`isReservedCompanyId`) zijn
 * GEEN identiteitsbewijs — vrijwel elke installatie heeft er hooguit één, dus vrijwel elk geëxporteerd
 * bestand draagt zo'n reserved id. Zulke ids selecteren ALTIJD "toevoegen" voor, ongeacht of ze lokaal
 * bestaan (anders zou de dialoog voor bijna elke gebruiker "vervangen" op de EIGEN bibliotheek
 * voorstellen). Een vijandig/onveilig bestand-id (critreview F2, `isSafeFileCompanyId`) telt hier ook
 * nooit als match.
 *
 * `syncNote` (uitleg over het ontbreken van synchronisatie) blijft altijd zichtbaar — bindend
 * user-besluit, niet gekoppeld aan een van beide opties.
 */
export function PoolImportDialog() {
  const { t } = useTranslation();
  const open = useAppStore(s => s.ui.showPoolImportDialog);
  const setUI = useAppStore(s => s.setUI);
  const companies = useAppStore(s => s.companies);
  const defaultCompanyId = useAppStore(s => s.defaultCompanyId);
  const poolImportCompanyId = useAppStore(s => s.ui.poolImportCompanyId);
  const isLocalPoolNewer = useAppStore(s => s.isLocalPoolNewer);
  const replacePool = useAppStore(s => s.replacePool);
  const importPoolAsNewCompany = useAppStore(s => s.importPoolAsNewCompany);

  const [companyId, setCompanyId] = useState(defaultCompanyId);
  const [action, setAction] = useState<'add' | 'replace'>('replace');
  const [imported, setImported] = useState<CompanyPool | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Clamp bij openen naar het GEOPENDE bedrijf (fix B1: `poolImportCompanyId`, gezet door de opener
  // in Backstage) — anders het standaardbedrijf, anders het eerste geldige bedrijf. Voorkomt zowel
  // een stille no-op-import als de voorselectie een verwijderd bedrijf betrof (critreview taak 11)
  // ALS het stil overschrijven van het verkeerde bedrijf wanneer je vanuit een ander bedrijf dan het
  // standaardbedrijf importeert (bewezen V1). Dit is slechts een BASIS-default voor de "vervangen"-
  // select — `pick()` hieronder herberekent de echte voorselectie (actie + bedrijf) zodra een bestand
  // gekozen is (issue #19).
  useEffect(() => {
    if (!open) return;
    const preferred = (poolImportCompanyId && companies.some(c => c.id === poolImportCompanyId))
      ? poolImportCompanyId
      : defaultCompanyId;
    const valid = companies.some(c => c.id === preferred) ? preferred : companies[0]?.id;
    if (valid) setCompanyId(valid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;
  const close = () => {
    setImported(null);
    setError(null);
    setAction('replace');
    setUI({ showPoolImportDialog: false, poolImportCompanyId: null });
  };

  const pick = async () => {
    setError(null);
    const res = await openFileDialog([{ name: 'IFC', extensions: ['ifc'] }]);
    if (!res) return;
    try {
      const pool = readPoolIFC(res.content);
      setImported(pool);
      // Voorselectie (issue #19, kern van de fix): gedelegeerd aan de PURE `resolvePoolImportPreselection`
      // (critreview F1 — direct headless testbaar, spiegelt de reviewer zijn eigen
      // writePoolIFC→readPoolIFC→pick()-reproductie, i.p.v. de logica inline in de component te houden).
      const preselection = resolvePoolImportPreselection(pool.companyId, companies);
      if (preselection.action === 'replace') {
        setAction('replace');
        setCompanyId(preselection.companyId);
      } else {
        setAction('add');
      }
    } catch {
      setError(t('companyLibrary.importNotAPool'));
      setImported(null);
    }
  };

  // Demping-waarschuwing hoort UITSLUITEND bij "vervangen" — "toevoegen" overschrijft nooit iets.
  const newer = imported && action === 'replace' ? isLocalPoolNewer(companyId, imported) : false;
  const newCompanyName = imported ? resolveUniqueCompanyName(imported.companyName, companies.map(c => c.name)) : '';
  // Twee verschillende redenen waarom "toevoegen" een VERS id mint — met elk hun EIGEN, feitelijk
  // kloppende hint (critreview-herkeuring, issue #19: de vorige, ene `idCollision` overkoepelde beide
  // gevallen en beweerde dan bij het tweede geval iets dat niet klopt). Gedelegeerd aan de PURE,
  // headless-testbare `classifyPoolImportIdentityHint` (spiegelt `resolvePoolImportPreselection`):
  // 'collision' = een ECHTE botsing (gewoon, niet-reserved/veilig id, lokaal al bekend) ⇒ "deze
  // bibliotheek is al lokaal bekend, wordt een aparte kopie"; 'fresh-identity' = een RESERVED of
  // onveilig id (DEFAULT_COMPANY_ID/DEMO_COMPANY_ID/"__proto__" e.d.) ⇒ geen garantie dat de
  // bibliotheek al lokaal bekend is (bijv. de demo-bibliotheek kan hier nog nooit geseed zijn) — een
  // neutrale hint die niets beweert over lokale bekendheid.
  const identityHint = imported ? classifyPoolImportIdentityHint(imported.companyId, companies) : 'none';

  const confirm = () => {
    if (imported) {
      if (action === 'add') {
        importPoolAsNewCompany(imported);
      } else {
        replacePool(companyId, imported);
      }
    }
    close();
  };

  return (
    <Dialog
      onBackdropClick={close}
      onCancel={close}
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[560px] max-h-[88vh] flex flex-col overflow-hidden"
      panelProps={{ 'data-ops-pool-import-dialog': true }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
        <span className="text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
          {t('companyLibrary.importTitle')}
        </span>
        <button onClick={close} className="p-1 hover:bg-surface-hover rounded-[8px]">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 text-xs">
        <button onClick={() => { void pick(); }} className="btn btn--sm btn--secondary self-start">
          {t('companyLibrary.chooseFile')}
        </button>

        {error && <p style={{ color: 'var(--error)' }}>{error}</p>}

        {imported && (
          <div className="flex flex-col gap-2">
            <p>{t('companyLibrary.importPreview', { calendars: imported.calendars.length, resources: imported.resources.length, version: imported.poolVersion })}</p>

            <div className="flex flex-col gap-3 border border-border rounded-[10px] p-2.5">
              {/* Optie 1: toevoegen als nieuwe bibliotheek (issue #19: de veilige standaard). */}
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="poolImportAction"
                  className="accent-accent mt-0.5"
                  checked={action === 'add'}
                  onChange={() => setAction('add')}
                />
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium">{t('companyLibrary.importActionAdd')}</span>
                  <span className="text-text-secondary">{t('companyLibrary.importAsNewPreview', { name: newCompanyName })}</span>
                  {identityHint === 'collision' && <span className="text-text-secondary">{t('companyLibrary.importAsNewCopyHint')}</span>}
                  {identityHint === 'fresh-identity' && <span className="text-text-secondary">{t('companyLibrary.importAsNewFreshIdentityHint')}</span>}
                </span>
              </label>

              {/* Optie 2: bestaande bibliotheek vervangen (oud gedrag, ongewijzigd). */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="poolImportAction"
                  className="accent-accent"
                  checked={action === 'replace'}
                  onChange={() => setAction('replace')}
                />
                <span className="font-medium">{t('companyLibrary.importActionReplace')}</span>
              </label>
              {/* Critreview F5: de select stond eerder GENEST in het radio-<label> hierboven — ongeldig
                  contentmodel (een <select> is zelf labelbaar) en zonder toegankelijke naam sinds
                  `importInto` niet meer gerenderd werd. Nu een sibling met een eigen <label htmlFor>. */}
              <div className="flex flex-col gap-1.5 pl-6">
                {/* Bedrijfsselector alleen bij ≥2 bedrijven (spec §2) — eenpitters zien het
                    bedrijvenconcept niet; met 1 bedrijf vervangt de dialoog stilzwijgend dat ene bedrijf. */}
                {companies.length >= 2 && (
                  <div className="flex flex-col gap-1">
                    <label htmlFor={TARGET_COMPANY_SELECT_ID} className="text-text-secondary">{t('companyLibrary.importInto')}</label>
                    <select
                      id={TARGET_COMPANY_SELECT_ID}
                      value={companyId}
                      onChange={e => setCompanyId(e.target.value)}
                      disabled={action !== 'replace'}
                      className="input !text-xs !px-2.5 !py-1.5"
                    >
                      {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
                <span className="text-text-secondary">{t('companyLibrary.importReplaces')}</span>
                {action === 'replace' && newer && (
                  <span className="alert alert--warning flex items-center gap-2">
                    <AlertTriangle size={16} /> {t('companyLibrary.dempingWarning')}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        <p className="text-text-secondary border-t border-border pt-3">{t('companyLibrary.syncNote')}</p>
      </div>

      <div className="flex justify-end gap-3 px-4 py-3 border-t border-border">
        <button onClick={close} className="btn btn--sm btn--secondary">{t('cancel')}</button>
        <button onClick={confirm} disabled={!imported} className="btn btn--sm btn--primary">
          {action === 'add' ? t('companyLibrary.importConfirmAdd') : t('companyLibrary.importConfirm')}
        </button>
      </div>
    </Dialog>
  );
}

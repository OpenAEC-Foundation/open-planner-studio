import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Parse een datum-string soepel naar het ISO-formaat (`YYYY-MM-DD`).
 *
 * Geaccepteerde invoer (dag-maand-jaar is de dominante volgorde voor de NL-doelgroep):
 *  - `6-7-2026`, `06-07-2026`, `6/7/2026`, `6.7.2026`  → dag-maand-jaar
 *  - `2026-07-06`, `2026/07/06`                        → ISO (jaar-eerst, alleen bij 4-cijferig
 *    eerste groep — zo blijft `06-07-...` ondubbelzinnig dag-eerst)
 *  - 2-cijferig jaar in de dag-eerst-vorm wordt als 20xx gelezen (`6-7-26` → 2026).
 *
 * Retourneert `null` bij onparseerbare of niet-bestaande datums (bv. `32-13-2026`, `31-02-2026`,
 * `abc`). Lege invoer valt buiten deze functie (die geeft ook `null`); de component behandelt
 * "leeg" apart als "geen datum".
 *
 * Bewust pure functie zonder tijd-component. Fase 2.8b introduceert straks tijd-van-de-dag; die
 * uitbreiding kan hierlangs (bv. een aparte `parseFlexibleDateTime`) zonder deze parser te breken.
 */
export function parseFlexibleDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  let year: number, month: number, day: number;
  // ISO / jaar-eerst: alleen wanneer de eerste groep 4 cijfers heeft.
  const iso = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (iso) {
    year = +iso[1]; month = +iso[2]; day = +iso[3];
  } else {
    // Dag-maand-jaar (dominante NL-volgorde).
    const dmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
    if (!dmy) return null;
    day = +dmy[1]; month = +dmy[2]; year = +dmy[3];
    if (dmy[3].length === 2) year += 2000;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1 || year > 9999) return null;
  // Verwerp niet-bestaande datums (31 feb, 30 feb, …) via een UTC-round-trip.
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return null;
  }
  const yyyy = String(year).padStart(4, '0');
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Zet een interne ISO-datum (`YYYY-MM-DD`) om naar het weergaveformaat `dd-mm-jjjj`.
 * `''` blijft `''` (geen datum). Onverwachte/niet-ISO invoer wordt ongewijzigd teruggegeven
 * (defensief — dit pad hoort in de praktijk alleen geldige ISO-strings of `''` te zien).
 */
function isoToDisplay(iso: string): string {
  if (!iso) return '';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

interface DateTextInputProps {
  /** Huidige waarde als ISO-datum (`YYYY-MM-DD`) of `''` voor "geen datum". */
  value: string;
  /** Commit-callback met de genormaliseerde ISO-datum, of `''` bij een leeggemaakt veld. */
  onCommit: (iso: string) => void;
  className?: string;
  style?: React.CSSProperties;
  ariaLabel?: string;
  title?: string;
  disabled?: boolean;
  /** Placeholder-override; standaard de i18n-hint (`dd-mm-jjjj`). */
  placeholder?: string;
  id?: string;
}

/**
 * Gedeeld datum-invoerveld (fase 2.8b) — vervangt overal de native datumprikker (`input[type=date]`).
 * De gebruiker heeft expliciet géén eigen kalender-widget gevraagd: dit is een gewoon tekstveld
 * dat datums soepel parst (zie {@link parseFlexibleDate}).
 *
 * WEERGAVEFORMAAT — `dd-mm-jjjj` (bv. `06-07-2026`), consistent met de placeholder-hint. De
 * opgeslagen/gecommitte waarde (`value`/`onCommit`) blijft intern altijd ISO `YYYY-MM-DD` — dit
 * is puur de weergave in het invoerveld zelf. De gebruiker mag ook ISO typen (`2026-07-06`); bij
 * blur normaliseert het veld naar `dd-mm-jjjj`.
 *
 * GEDRAG:
 *  - Tijdens typen wordt élke geldige datum meteen gecommit (zoals `UnitsInput`).
 *  - Onparseerbare invoer: rode rand + inline hint, waarde wordt NIET doorgezet.
 *  - Bij blur op onzin valt het veld terug op de laatst geldige waarde; bij geldige invoer
 *    (dag-eerst of ISO) normaliseert het veld naar `dd-mm-jjjj`.
 *  - Leeg veld = "geen datum" (commit `''`) — voor optionele datums (deadline, werkelijke datums).
 *
 * ENTER (samenwerking met `useDialogKeys`): het veld roept bij Enter GEEN `preventDefault`/
 * `stopPropagation` aan zolang de invoer geldig (of leeg) is — de dialoog-Enter (primaire actie)
 * gaat gewoon door, en omdat een geldige datum al live gecommit is, bevestigt de dialoog met de
 * juiste waarde. Alleen bij een ONgeldige invoer blokkeert het veld de dialoog-Enter
 * (`preventDefault` + `stopPropagation`) zodat de dialoog niet met een verkeerde/verouderde datum
 * sluit; de focus blijft en de foutindicatie blijft zichtbaar.
 *
 * TOEKOMST (fase 2.8b — uren-scheduling): er komt tijd-van-de-dag. Deze component blokkeert die
 * uitbreiding niet; de parser is puur en tijd-loos, en een tijd-variant kan ernaast leven zonder
 * dit veld te breken. Bouw die tijd-invoer hier NU niet.
 */
export function DateTextInput({
  value, onCommit, className = '', style, ariaLabel, title, disabled, placeholder, id,
}: DateTextInputProps) {
  const { t } = useTranslation('common');
  const [draft, setDraft] = useState<string>(() => isoToDisplay(value));
  const [focused, setFocused] = useState(false);

  // Zolang het veld niet in bewerking is, toont de draft de opgeslagen (ISO-)waarde als dd-mm-jjjj.
  useEffect(() => {
    if (!focused) setDraft(isoToDisplay(value));
  }, [value, focused]);

  const trimmed = draft.trim();
  const parsed = trimmed === '' ? '' : parseFlexibleDate(trimmed);
  const invalid = parsed === null; // leeg is niet ongeldig

  return (
    <span style={{ position: 'relative', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={draft}
        title={title}
        aria-label={ariaLabel}
        aria-invalid={invalid}
        disabled={disabled}
        placeholder={placeholder ?? t('dateInput.placeholder')}
        autoComplete="off"
        spellCheck={false}
        onFocus={() => setFocused(true)}
        onChange={e => {
          const next = e.target.value;
          setDraft(next);
          const p = next.trim() === '' ? '' : parseFlexibleDate(next);
          if (p !== null) onCommit(p); // '' = leeggemaakt, of een geldige ISO-datum
        }}
        onBlur={() => {
          setFocused(false);
          if (trimmed === '') { onCommit(''); return; }
          const p = parseFlexibleDate(trimmed);
          if (p === null) {
            setDraft(isoToDisplay(value)); // terug naar laatst geldige waarde
          } else {
            setDraft(isoToDisplay(p));      // normaliseer naar dd-mm-jjjj
            if (p !== value) onCommit(p);
          }
        }}
        onKeyDown={e => {
          if (e.key === 'Enter' && invalid) {
            // Ongeldige datum mag de dialoog-Enter niet doorlaten (zie JSDoc).
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        className={className}
        // Bij ongeldig: één volledige `border`-shorthand (rode rand). Bewust GEEN losse
        // `borderColor`-longhand ernaast — dat zou botsen met een `border`-shorthand die een
        // aanroeper via `style` meegeeft (bv. de statusdatum in de Ribbon) en React laten waarschuwen
        // over gemengde shorthand/longhand. Zo blijft het object altijd puur shorthand.
        style={invalid
          ? { ...style, border: '1.5px solid var(--error)', boxShadow: '0 0 0 1px var(--error)' }
          : style}
      />
      {invalid && (
        <span
          role="alert"
          style={{
            position: 'absolute', left: 0, top: '100%', marginTop: 2, zIndex: 30,
            fontSize: 10, lineHeight: 1.2, color: 'var(--error)', whiteSpace: 'nowrap',
            background: 'var(--theme-surface, var(--surface, #fff))',
            border: '1px solid var(--error)', borderRadius: 4, padding: '1px 5px',
            pointerEvents: 'none', boxShadow: 'var(--shadow-pop)',
          }}
        >
          {t('dateInput.invalid')}
        </span>
      )}
    </span>
  );
}

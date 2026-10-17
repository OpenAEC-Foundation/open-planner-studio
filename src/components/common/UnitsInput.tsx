import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { formatDecimalInput, parsePositiveDecimal } from '@/utils/decimalInput';

/**
 * Strikt-positief eenheden-invoerveld. Houdt een lokale draft-string bij zodat de gebruiker vrij
 * kan typen, wijst 0/negatieve/lege/onleesbare invoer visueel af (rode rand, `aria-invalid`) en
 * commit ALLEEN geldige (> 0, eindig, `accepts`) waarden naar de store — nooit een clamp naar 0.
 * De rode rand staat alleen op wat de gebruiker zelf typt, niet op een opgeslagen waarde. Bij blur
 * op een ongeldige waarde valt het veld terug op de opgeslagen waarde. Invoer leest
 * `parsePositiveDecimal` (strikt: "2x" of "1.234,5" is ongeldig).
 *
 * Twee losse keuzes, elk met een eigen prop:
 *
 * - `locale` gaat alleen over de WEERGAVE: een tekstveld met `inputMode="decimal"` in de
 *   getalnotatie van de app (`formatDecimalInput`: hooguit twee decimalen, decimaalteken van de
 *   taal, een kleine waarde met drie significante cijfers). Komma en punt zijn allebei geldig.
 *   Zonder `locale`: een `type="number"`-veld met de ruwe waarde.
 * - `commitOnBlur` gaat over het COMMITMOMENT. Zonder: elke geldige toetsaanslag commit, en Enter/
 *   Escape gaan ongemoeid naar `onKeyDown` (rasternavigatie, `useLiveGridNav`). Met: het veld commit
 *   op Enter, blur of unmount, en alleen als de gebruiker echt iets anders typte dan er stond. Een
 *   half getypt getal ("1.234" op weg naar "1.234,5") komt dus nooit in de store, en focussen en
 *   verlaten laat een geïmporteerde 1.77777777777778 exact staan. Enter commit en verlaat het veld;
 *   een omringende dialoog slaat dan niet op (zoals het duurveld). Escape met een draft
 *   zet alleen dit veld terug (de toets stopt hier); Escape zonder draft gaat door (sluit de
 *   dialoog).
 */
export function UnitsInput({
  value, onCommit, className = '', title, ariaLabel, onKeyDown, gridCell, locale, commitOnBlur = false, accepts,
}: {
  value: number;
  onCommit: (n: number) => void;
  className?: string;
  title?: string;
  ariaLabel?: string;
  /** Rasternavigatie (Enter/Shift+Enter) — het veld is een cel in een live tabel. */
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  /** `data-ops-grid-cell`-adres van deze cel; `useLiveGridNav` focust hierop. */
  gridCell?: string;
  /** App-taal voor de weergave. Zonder: de ruwe waarde in een `type="number"`-veld. */
  locale?: string;
  /** Commit op Enter/blur/unmount in plaats van per toetsaanslag (zie boven). */
  commitOnBlur?: boolean;
  /** Extra eis bovenop "> 0"; `false` ⇒ ongeldig (rode rand, geen commit). */
  accepts?: (n: number) => boolean;
}) {
  // `null` = de gebruiker typt niet; het veld toont dan de opgeslagen waarde.
  const [draft, setDraftState] = useState<string | null>(null);
  const shownValue = locale ? formatDecimalInput(value, locale) : String(value);
  const text = draft ?? shownValue;
  const parseValid = (s: string) => {
    const n = parsePositiveDecimal(s);
    return n !== null && (!accepts || accepts(n)) ? n : null;
  };
  const invalid = draft !== null && parseValid(draft) === null;

  // De laatste draft en de laatste props, synchroon bijgewerkt: de unmount-cleanup en een blur die
  // direct na Enter volgt lezen ze zonder op een render te wachten.
  const draftRef = useRef<string | null>(null);
  const latest = useRef({ value, shownValue, onCommit, parseValid });
  latest.current = { value, shownValue, onCommit, parseValid };
  const setDraft = (d: string | null) => { draftRef.current = d; setDraftState(d); };

  /** Commit de openstaande draft als die geldig is en echt iets anders zegt dan er stond. */
  const flush = () => {
    const d = draftRef.current;
    draftRef.current = null;
    if (d === null) return;
    const { value: v, shownValue: shown, onCommit: commit, parseValid: parse } = latest.current;
    if (d.trim() === shown) return; // één teken wissen en terugtypen is geen wijziging
    const n = parse(d);
    if (n !== null && n !== v) commit(n);
  };

  // Een taakwissel verwijdert de rij (`key={a.id}`) vóór de browser een blur stuurt: commit de
  // openstaande draft dan bij unmount, anders gaat getypte invoer stil verloren.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- alleen bij unmount; leest via refs
  useEffect(() => () => { if (commitOnBlur) flush(); }, []);

  return (
    <input
      {...(locale
        ? { type: 'text', inputMode: 'decimal' as const }
        : { type: 'number', min: '0', step: 'any' })}
      value={text}
      title={title}
      aria-label={ariaLabel}
      aria-invalid={invalid}
      data-ops-grid-cell={gridCell}
      onKeyDown={e => {
        if (commitOnBlur && e.key === 'Enter') {
          // Enter is van dit veld: commit en verlaat het veld (Ctrl+Z is daarna de app-undo). De
          // taakdialoog slaat op Enter bewust NIET op (`preventDefault` ⇒ `useDialogKeys` slaat
          // over), gelijk aan het duurveld en het werkveld op main.
          e.preventDefault();
          flush();
          e.currentTarget.blur();
        } else if (commitOnBlur && e.key === 'Escape' && draftRef.current !== null) {
          // Lokale betekenis: alleen dit veld terugzetten, niet de dialoog sluiten.
          e.stopPropagation();
          draftRef.current = null;
          e.currentTarget.blur();
          return;
        }
        onKeyDown?.(e);
      }}
      onChange={e => {
        setDraft(e.target.value);
        if (!commitOnBlur) {
          const n = parseValid(e.target.value);
          if (n !== null) onCommit(n);
        }
      }}
      onBlur={() => {
        if (commitOnBlur) flush();
        setDraft(null);
      }}
      className={className}
      style={invalid ? { borderColor: 'var(--error)', boxShadow: '0 0 0 1px var(--error)' } : undefined}
    />
  );
}

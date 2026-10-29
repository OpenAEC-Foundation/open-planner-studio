import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { formatDecimalInput, isAmbiguousThousands, parsePositiveDecimal } from '@/utils/decimalInput';
import { mountedPendingTextEdits } from '@/state/pendingTextEdits';

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
 *   Zonder draft toont het veld de opgeslagen waarde en zijn Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z en
 *   Escape van de app (`data-ops-app-keys`, zie `isTypingTarget`): ook als de focus na Ctrl+S of
 *   F5 in het veld terugkwam, maakt Ctrl+Z dan de app-stap ongedaan, geen veld-undo.
 *
 * Met `locale` is een getal met een punt of komma en precies drie cijfers erachter dubbelzinnig als
 * dat teken niet het decimaalteken van de taal is: "1,500" in en, "1.500" in nl/de/pt/tr (1500 of
 * 1,5?). Ongeldig, geen commit, en bij het afronden een melding via `onAmbiguous`
 * (`isAmbiguousThousands`).
 */
export function UnitsInput({
  value, onCommit, className = '', title, ariaLabel, onKeyDown, gridCell, locale, commitOnBlur = false, accepts,
  onAmbiguous,
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
  /** Afronden met een dubbelzinnige invoer ("1,500" in en): de waarde blijft, de aanroeper meldt. */
  onAmbiguous?: (text: string) => void;
}) {
  // `null` = de gebruiker typt niet; het veld toont dan de opgeslagen waarde.
  const [draft, setDraftState] = useState<string | null>(null);
  const shownValue = locale ? formatDecimalInput(value, locale) : String(value);
  const text = draft ?? shownValue;
  const ambiguous = (s: string) => !!locale && isAmbiguousThousands(s, locale);
  const parseValid = (s: string) => {
    if (ambiguous(s)) return null;
    const n = parsePositiveDecimal(s);
    return n !== null && (!accepts || accepts(n)) ? n : null;
  };
  const invalid = draft !== null && parseValid(draft) === null;

  // De laatste draft en de laatste props, synchroon bijgewerkt: de unmount-cleanup en een blur die
  // direct na Enter volgt lezen ze zonder op een render te wachten.
  const draftRef = useRef<string | null>(null);
  const latest = useRef({ value, shownValue, onCommit, parseValid, ambiguous, onAmbiguous });
  latest.current = { value, shownValue, onCommit, parseValid, ambiguous, onAmbiguous };
  const setDraft = (d: string | null) => { draftRef.current = d; setDraftState(d); };

  /** Commit de openstaande draft als die geldig is en echt iets anders zegt dan er stond. */
  const flush = () => {
    const d = draftRef.current;
    draftRef.current = null;
    if (d === null) return;
    const { value: v, shownValue: shown, onCommit: commit, parseValid: parse } = latest.current;
    if (d.trim() === shown) return; // één teken wissen en terugtypen is geen wijziging
    if (latest.current.ambiguous(d)) { latest.current.onAmbiguous?.(d.trim()); return; }
    const n = parse(d);
    if (n !== null && n !== v) commit(n);
  };

  // Een taakwissel verwijdert de rij (`key={a.id}`) vóór de browser een blur stuurt: commit de
  // openstaande draft dan bij unmount, anders gaat getypte invoer stil verloren.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- alleen bij unmount; leest via refs
  useEffect(() => () => { if (commitOnBlur) flush(); }, []);

  // Een route zonder blur (MCP-documentwissel, herladen, desktopafsluiten) rondt de draft eerst af
  // via het register (`pendingTextEdits.ts`). Anders schreef de unmount-commit hierboven in het
  // nieuwe actieve document, of ging de invoer bij afsluiten stil verloren (review #401).
  useEffect(() => {
    if (!commitOnBlur) return;
    return mountedPendingTextEdits.register({
      commit: () => {
        if (draftRef.current === null) return;
        flush();
        setDraftState(null);
      },
    });
  }, [commitOnBlur]);

  return (
    <input
      {...(locale
        ? { type: 'text', inputMode: 'decimal' as const }
        : { type: 'number', min: '0', step: 'any' })}
      value={text}
      onFocus={event => {
        // Ctrl+S/F5 herstelt de bestaande invoerfocus, niet een nieuwe veldbewerking.
        if (event.currentTarget.dataset.opsRefocus !== 'true') event.currentTarget.select();
      }}
      title={title}
      aria-label={ariaLabel}
      aria-invalid={invalid}
      data-ops-grid-cell={gridCell}
      data-ops-app-keys={commitOnBlur && draft === null ? 'true' : undefined}
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
      // `--ops-num-chars`: het aantal tekens dat het veld nu toont. Een raster dat het veld laat
      // meegroeien (`.assignment-number` in globals.css) rekent er zijn breedte mee uit.
      style={{
        ['--ops-num-chars' as string]: text.length,
        ...(invalid ? { borderColor: 'var(--error)', boxShadow: '0 0 0 1px var(--error)' } : {}),
      }}
    />
  );
}

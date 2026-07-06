import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import type { DateNotation } from '@/state/slices/types';

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

// ── Segment-model ────────────────────────────────────────────────────────────
// Het veld bestaat visueel uit drie sub-vakjes. De VOLGORDE is bewust data (een array), niet
// hard bedraad: taak #53 (Datumnotatie-instelling) gaat mm-dd-jjjj / jjjj-mm-dd toestaan door
// alleen deze `order` te wisselen. De PARSE blijft semantisch (dag/maand/jaar per soort, niet per
// positie), zodat een andere weergavevolgorde de parser niet raakt.

type SegKind = 'day' | 'month' | 'year';

interface SegmentDef {
  kind: SegKind;
  maxLen: number;
  /** i18n-sleutel voor het aria-label van dit segment. */
  labelKey: 'dateInput.day' | 'dateInput.month' | 'dateInput.year';
}

const DAY_SEG: SegmentDef = { kind: 'day', maxLen: 2, labelKey: 'dateInput.day' };
const MONTH_SEG: SegmentDef = { kind: 'month', maxLen: 2, labelKey: 'dateInput.month' };
const YEAR_SEG: SegmentDef = { kind: 'year', maxLen: 4, labelKey: 'dateInput.year' };

interface DateFormat {
  order: SegmentDef[];
  separator: string;
}

const SEG_BY_KIND: Record<SegKind, SegmentDef> = { day: DAY_SEG, month: MONTH_SEG, year: YEAR_SEG };

// Segmentvolgorde per notatie-instelling (taak #53). De PARSE blijft semantisch (dag/maand/jaar per
// soort, niet per positie), dus alleen de weergave-/invoervolgorde draait mee met de instelling.
const ORDER_BY_NOTATION: Record<DateNotation, SegKind[]> = {
  dmy: ['day', 'month', 'year'],
  mdy: ['month', 'day', 'year'],
  ymd: ['year', 'month', 'day'],
};

type SegState = Record<SegKind, string>;

const EMPTY_SEG: SegState = { day: '', month: '', year: '' };

/** Splits een interne ISO-datum in segment-strings (padded). `''`/niet-ISO → alle segmenten leeg. */
function isoToSegments(iso: string): SegState {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return { ...EMPTY_SEG };
  return { day: m[3], month: m[2], year: m[1] };
}

type SegStatus = 'empty' | 'incomplete' | 'valid' | 'invalid';

/**
 * Bepaal de toestand van de drie segmenten:
 *  - `empty`      → álle segmenten leeg (= "geen datum").
 *  - `incomplete` → sommige (maar niet alle) segmenten leeg (gebruiker is nog niet klaar).
 *  - `valid`      → alle segmenten gevuld én parsebaar naar een bestaande datum (`iso` gezet).
 *  - `invalid`    → alle segmenten gevuld maar géén bestaande datum (bv. 31-02-2026).
 * De parse is semantisch dag-maand-jaar (los van de weergavevolgorde), en volgt de bestaande
 * conventie (2-cijferig jaar → 20xx) via {@link parseFlexibleDate}.
 */
function computeSeg(seg: SegState): { status: SegStatus; iso: string | null } {
  const filled = [seg.day, seg.month, seg.year].filter(v => v !== '').length;
  if (filled === 0) return { status: 'empty', iso: '' };
  if (filled < 3) return { status: 'incomplete', iso: null };
  const iso = parseFlexibleDate(`${seg.day}-${seg.month}-${seg.year}`);
  return iso ? { status: 'valid', iso } : { status: 'invalid', iso: null };
}

// Focus-/foutrand identiek aan het design-system (`.input:focus` en `.input--error:focus`), zodat
// de gesegmenteerde groep exact als de oude enkele `.input` oogt. Bewust puur `border`-shorthand
// (geen losse `borderColor`-longhand) zodat het niet botst met een `border`-shorthand die een
// aanroeper via `style` meegeeft (React zou anders waarschuwen over gemengde shorthand/longhand).
const FOCUS_STYLE: React.CSSProperties = {
  border: '1.5px solid var(--theme-accent)',
  boxShadow: '0 0 0 3px rgba(217, 119, 6, 0.20)',
};
const ERROR_STYLE: React.CSSProperties = {
  border: '1.5px solid var(--error)',
  boxShadow: '0 0 0 3px rgba(220, 38, 38, 0.20)',
};

const SEG_STYLE: React.CSSProperties = {
  border: 'none', outline: 'none', background: 'transparent',
  padding: 0, margin: 0,
  font: 'inherit', color: 'inherit', letterSpacing: 'inherit',
  textAlign: 'center', minWidth: 0,
  fontVariantNumeric: 'tabular-nums',
};

const SEP_STYLE: React.CSSProperties = {
  opacity: 0.55, padding: '0 1px', userSelect: 'none', flexShrink: 0,
};

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
  /** Placeholder-override; standaard de i18n-hint (`dd-mm-jjjj`), per segment gesplitst. */
  placeholder?: string;
  id?: string;
}

/**
 * Gedeeld datum-invoerveld (fase 2.8b) — vervangt overal de native datumprikker (`input[type=date]`).
 * De gebruiker heeft expliciet géén eigen kalender-widget gevraagd.
 *
 * GESEGMENTEERDE INVOER — het veld is één omrande groep (`role=group`) met drie sub-vakjes
 * `dd | mm | jjjj`, gescheiden door streepjes. De opgeslagen/gecommitte waarde (`value`/`onCommit`)
 * blijft intern altijd ISO `YYYY-MM-DD`; de segmenten zijn puur weergave/invoer. De groep gedraagt
 * zich qua layout als het oude enkele veld: `className`/`style` worden op de groep toegepast (die
 * de rand/achtergrond/breedte levert), dus alle 9 gebruiksplekken houden hun breedte-gedrag.
 *
 * NAVIGATIE:
 *  - 2 cijfers in dag/maand → focus springt naar het volgende segment; jaar accepteert 4 cijfers.
 *  - Een cijfer + separator (`-`, `/`, `.`) → ook doorspringen.
 *  - Backspace in een leeg segment → terug naar het vorige (cursor aan het eind).
 *  - Pijl-links/rechts op de rand van een segment → naar het buursegment.
 *  - Plakken van een volledige datum (elk formaat dat {@link parseFlexibleDate} kent, incl. ISO),
 *    waar dan ook in de groep, vult alle drie de segmenten.
 *  - Eén tab-stop voor het geheel (roving `tabindex`): Tab/Shift-Tab verlaat de hele groep; tussen
 *    segmenten beweeg je met typen/pijltjes, niet met Tab.
 *  - 2-cijferig jaar wordt bij afronden 20xx (bestaande parse-conventie).
 *
 * VALIDATIE PAS BIJ AFRONDEN — tijdens typen (of bij incomplete/lege segmenten terwijl de focus in
 * de groep staat) is er GEEN foutindicatie. Er wordt alleen gevalideerd bij (a) blur van de HELE
 * groep of (b) Enter:
 *  - Blur, leeg          → commit `''` (geen datum).
 *  - Blur, geldig        → normaliseer segmenten + commit ISO.
 *  - Blur, incompleet    → stille terugval op de laatst geldige waarde (bestaand gedrag).
 *  - Blur, compleet-maar-ongeldig (bv. 31-02-2026) → foutindicatie (`aria-invalid` + `role=alert`);
 *    de gecommitte waarde valt terug op de laatst geldige (de foute datum wordt NIET gecommit),
 *    de invoer blijft zichtbaar zodat de gebruiker hem kan corrigeren.
 *
 * ENTER (samenwerking met `useDialogKeys`): bij een geldige (of lege) invoer roept het veld GEEN
 * `preventDefault`/`stopPropagation` aan — de dialoog-Enter (primaire actie) gaat door, en omdat een
 * geldige datum al live gecommit is, bevestigt de dialoog met de juiste waarde. Bij een ongeldige of
 * incomplete invoer blokkeert het veld de dialoog-Enter (`preventDefault` + `stopPropagation`) en
 * toont het de foutindicatie; de focus blijft in de groep.
 *
 * TOEKOMST (fase 2.8b — uren-scheduling): er komt tijd-van-de-dag. Deze component blokkeert die
 * uitbreiding niet; de parser is puur en tijd-loos. Bouw die tijd-invoer hier NU niet.
 */
export function DateTextInput({
  value, onCommit, className = '', style, ariaLabel, title, disabled, placeholder, id,
}: DateTextInputProps) {
  const { t } = useTranslation('common');
  // Weergave-/segmentvolgorde volgt de instelling (reactief: hertekent bij wijziging).
  const notation = useAppStore(s => s.ui.dateNotation);
  const format = useMemo<DateFormat>(
    () => ({ order: ORDER_BY_NOTATION[notation].map(k => SEG_BY_KIND[k]), separator: '-' }),
    [notation],
  );
  const { order } = format;

  const [seg, setSeg] = useState<SegState>(() => isoToSegments(value));
  const [groupFocused, setGroupFocused] = useState(false);
  const [showError, setShowError] = useState(false);
  // Roving tabindex: alleen het actieve segment zit in de tab-volgorde, zodat Tab/Shift-Tab de héle
  // groep verlaat in plaats van per segment te stoppen.
  const [activeKind, setActiveKind] = useState<SegKind>(order[0].kind);

  const refs = useRef<Partial<Record<SegKind, HTMLInputElement | null>>>({});

  // Zolang de groep niet in bewerking is (en er geen fout getoond wordt), volgen de segmenten de
  // opgeslagen (ISO-)waarde. `showError` in de guard voorkomt dat een compleet-maar-ongeldige invoer
  // bij blur meteen door de externe waarde wordt overschreven (de gebruiker moet de fout kunnen zien).
  useEffect(() => {
    if (!groupFocused && !showError) setSeg(isoToSegments(value));
  }, [value, groupFocused, showError]);

  // Per-segment placeholder: de (gelokaliseerde) hint `dd-mm-jjjj` is canoniek dag-maand-jaar; splits
  // hem op de separators en map per SOORT, zodat de placeholders correct meedraaien met de gekozen
  // notatie (bv. jjjj-mm-dd toont het jaar-segment eerst). Zo blijven ze vertaald zonder extra keys.
  const placeholders = useMemo(() => {
    const hint = placeholder ?? t('dateInput.placeholder');
    const parts = hint.split(/[-/.\s]+/).filter(Boolean);
    const byKind: Record<SegKind, string> = parts.length === 3
      ? { day: parts[0], month: parts[1], year: parts[2] }
      : { day: '', month: '', year: '' };
    return order.map(d => byKind[d.kind]);
  }, [placeholder, t, order]);

  const focusSeg = (i: number, pos: 'start' | 'end' | 'all') => {
    const el = refs.current[order[i].kind];
    if (!el) return;
    el.focus();
    try {
      // `'all'` selecteert de volledige inhoud (zodat typen VERVANGT i.p.v. door `maxLength` geblokkeerd
      // te worden op een reeds-gevuld segment); `'start'`/`'end'` plaatsen een lege cursor.
      if (pos === 'all') el.select();
      else { const p = pos === 'end' ? el.value.length : 0; el.setSelectionRange(p, p); }
    } catch { /* niet-tekst-selecteerbaar */ }
  };

  const focusEntry = () => {
    const idx = order.findIndex(d => !seg[d.kind]);
    if (idx === -1) focusSeg(order.length - 1, 'end');
    else focusSeg(idx, 'start');
  };

  // Live-commit: exact als het oude veld committeert alleen een lege ('') of een geldige ISO-datum;
  // bij incomplete/ongeldige invoer blijft de store op de laatst geldige waarde staan.
  const commitFrom = (s: SegState) => {
    const st = computeSeg(s);
    if (st.status === 'empty') { if (value !== '') onCommit(''); }
    else if (st.status === 'valid' && st.iso !== value) onCommit(st.iso!);
  };

  const handleChange = (i: number, raw: string) => {
    const def = order[i];
    const digits = raw.replace(/\D/g, '').slice(0, def.maxLen);
    const next = { ...seg, [def.kind]: digits };
    setSeg(next);
    setShowError(false); // typen wist elke eerder getoonde fout
    commitFrom(next);
    // Auto-doorspringen: land op het volgende segment. Is dat al GEVULD, selecteer dan de inhoud (typen
    // vervangt) i.p.v. een lege cursor die door `maxLength` niets meer accepteert (QA-fix).
    if (digits.length >= def.maxLen && i < order.length - 1) {
      focusSeg(i + 1, next[order[i + 1].kind] ? 'all' : 'start');
    }
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    const val = el.value;
    const atStart = el.selectionStart === 0 && el.selectionEnd === 0;
    const atEnd = el.selectionStart === val.length && el.selectionEnd === val.length;

    if (e.key === 'Enter') {
      const st = computeSeg(seg);
      if (st.status === 'invalid' || st.status === 'incomplete') {
        // Ongeldig/incompleet mag de dialoog-Enter niet doorlaten (zie JSDoc).
        e.preventDefault();
        e.stopPropagation();
        setShowError(true);
      }
      return; // geldig/leeg: laat bubbelen naar useDialogKeys
    }
    if (e.key === '-' || e.key === '/' || e.key === '.') {
      e.preventDefault();
      if (val.length > 0 && i < order.length - 1) focusSeg(i + 1, 'start');
      return;
    }
    if (e.key === 'Backspace') {
      if (val === '' && i > 0) { e.preventDefault(); focusSeg(i - 1, 'end'); }
      return;
    }
    if (e.key === 'ArrowLeft') {
      if (atStart && i > 0) { e.preventDefault(); focusSeg(i - 1, 'end'); }
      return;
    }
    if (e.key === 'ArrowRight') {
      if (atEnd && i < order.length - 1) { e.preventDefault(); focusSeg(i + 1, 'start'); }
      return;
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    const iso = parseFlexibleDate(text.trim());
    if (!iso) return; // geen volledige datum → laat de standaard-plak in dit ene segment (gesanitized)
    e.preventDefault();
    const segs = isoToSegments(iso);
    setSeg(segs);
    setShowError(false);
    if (iso !== value) onCommit(iso);
  };

  const handleGroupFocus = () => setGroupFocused(true);

  const handleGroupBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    // Verlaat de focus de héle groep, of springt hij alleen tussen segmenten?
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setGroupFocused(false);
    const st = computeSeg(seg);
    if (st.status === 'empty') {
      setShowError(false);
      if (value !== '') onCommit('');
      return;
    }
    if (st.status === 'valid') {
      setShowError(false);
      setSeg(isoToSegments(st.iso!)); // normaliseer (bv. 6→06, 26→2026)
      if (st.iso !== value) onCommit(st.iso!);
      return;
    }
    if (st.status === 'incomplete') {
      setShowError(false);
      setSeg(isoToSegments(value)); // stille terugval op laatst geldige waarde
      return;
    }
    // compleet-maar-ongeldig: toon fout, commit NIET (store valt terug op laatst geldig).
    setShowError(true);
  };

  const groupBorder = disabled ? null : showError ? ERROR_STYLE : groupFocused ? FOCUS_STYLE : null;

  return (
    <span style={{ position: 'relative', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div
        id={id}
        role="group"
        aria-label={ariaLabel ?? t('dateInput.group')}
        aria-disabled={disabled || undefined}
        title={title}
        className={className}
        onFocus={handleGroupFocus}
        onBlur={handleGroupBlur}
        onMouseDown={e => {
          if (disabled) return;
          if ((e.target as HTMLElement).tagName !== 'INPUT') { e.preventDefault(); focusEntry(); }
        }}
        style={{
          display: 'flex', alignItems: 'center', minWidth: 0,
          cursor: disabled ? 'not-allowed' : 'text',
          ...style,
          ...groupBorder,
          ...(disabled ? { opacity: 0.6 } : null),
        }}
      >
        {order.map((def, i) => (
          <Fragment key={def.kind}>
            {i > 0 && <span aria-hidden="true" style={SEP_STYLE}>{format.separator}</span>}
            <input
              ref={el => { refs.current[def.kind] = el; }}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
              disabled={disabled}
              tabIndex={def.kind === activeKind ? 0 : -1}
              aria-label={t(def.labelKey)}
              aria-invalid={showError || undefined}
              value={seg[def.kind]}
              placeholder={placeholders[i]}
              maxLength={def.maxLen}
              // Iets ruimer dan strikt nodig voor 2 cijfers, zodat de letter-placeholders
              // (`dd`/`mm`/`jjjj` — bredere glyphs dan cijfers) volledig passen.
              style={{ ...SEG_STYLE, width: `${def.maxLen === 4 ? 4.9 : 2.9}ch` }}
              onFocus={() => setActiveKind(def.kind)}
              onMouseUp={e => {
                // Klik in een GEVULD segment (geen sleep-selectie) ⇒ selecteer de volledige inhoud, zodat
                // typen vervangt i.p.v. door `maxLength` geblokkeerd te worden (QA-fix). Leeg segment: laat
                // de cursor met rust (aan het begin). Een echte sleep-selectie (start≠end) blijft behouden.
                const el = e.currentTarget;
                if (el.value.length > 0 && el.selectionStart === el.selectionEnd) el.select();
              }}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              onPaste={handlePaste}
            />
          </Fragment>
        ))}
      </div>
      {showError && (
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

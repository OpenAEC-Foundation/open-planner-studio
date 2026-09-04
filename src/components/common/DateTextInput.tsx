import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { parsePersonalDate } from '@/utils/displayDate';
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
  return parsePersonalDate(raw, 'dmy');
}

// ── Segment-model ────────────────────────────────────────────────────────────
// Het veld bestaat visueel uit drie sub-vakjes. De VOLGORDE is bewust data (een array), niet
// hard bedraad: taak #53 (Datumnotatie-instelling) gaat mm-dd-jjjj / jjjj-mm-dd toestaan door
// alleen deze `order` te wisselen. De PARSE blijft semantisch (dag/maand/jaar per soort, niet per
// positie), zodat een andere weergavevolgorde de parser niet raakt.

export type SegKind = 'day' | 'month' | 'year';

export interface SegmentDef {
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

export type SegState = Record<SegKind, string>;

const EMPTY_SEG: SegState = { day: '', month: '', year: '' };

/** Splits een interne ISO-datum in segment-strings (padded). `''`/niet-ISO → alle segmenten leeg. */
function isoToSegments(iso: string): SegState {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return { ...EMPTY_SEG };
  return { day: m[3], month: m[2], year: m[1] };
}

export type SegStatus = 'empty' | 'incomplete' | 'valid' | 'invalid';

/**
 * Bepaal de toestand van de drie segmenten:
 *  - `empty`      → álle segmenten leeg (= "geen datum").
 *  - `incomplete` → sommige (maar niet alle) segmenten leeg (gebruiker is nog niet klaar).
 *  - `valid`      → alle segmenten gevuld én parsebaar naar een bestaande datum (`iso` gezet).
 *  - `invalid`    → alle segmenten gevuld maar géén bestaande datum (bv. 31-02-2026).
 * De parse is semantisch dag-maand-jaar (los van de weergavevolgorde), en volgt de bestaande
 * conventie (2-cijferig jaar → 20xx) via {@link parseFlexibleDate}.
 */
export function computeSeg(seg: SegState): { status: SegStatus; iso: string | null } {
  const filled = [seg.day, seg.month, seg.year].filter(v => v !== '').length;
  if (filled === 0) return { status: 'empty', iso: '' };
  if (filled < 3) return { status: 'incomplete', iso: null };
  const iso = parseFlexibleDate(`${seg.day}-${seg.month}-${seg.year}`);
  return iso ? { status: 'valid', iso } : { status: 'invalid', iso: null };
}

// ── Commitmodel ──────────────────────────────────────────────────────────────
// Wanneer een toetsaanslag de buitenwereld bereikt, is bewust DATA en geen impliciet gedrag: het
// veld is gesegmenteerd en `parseFlexibleDate` accepteert een jaar al bij 2 cijfers, dus "01062030"
// doorloopt de geldige tussenwaarden 2020-06-01 en 0203-06-01 vóór 2030-06-01. Committeert het veld
// live, dan schrijft één ingetypte datum drie keer naar de store — bij een undo-plichtige actie
// (`updateTask`, deadline, constraint, …) dus drie undo-stappen met onzin-tussenwaarden.
// `'blur'` (de standaard) commit daarom pas bij het AFRONDEN (blur/Enter/plakken); `'live'` blijft
// beschikbaar voor plekken die puur lokale draftstate voeden én daar live feedback op tonen.

/** Wanneer een bewerking naar buiten wordt gecommit. Zie {@link resolveDateCommit}. */
export type DateCommitMode = 'live' | 'blur';

/** Fase waarin de commit wordt afgewogen: tijdens typen, of bij het afronden (blur/Enter/plak). */
export type DateCommitPhase = 'typing' | 'finish';

export type DateCommitResolution =
  /** Niets naar buiten schrijven (en de zichtbare invoer met rust laten). */
  | { kind: 'idle' }
  /** Schrijf deze waarde (`''` = geen datum). De aanroeper slaat een no-op zelf over. */
  | { kind: 'write'; iso: string }
  /** Incompleet bij afronden: stille terugval op de laatst gecommitte waarde. */
  | { kind: 'revert' }
  /** Compleet maar onbestaand (bv. 31-02-2026): foutindicatie, niets committen. */
  | { kind: 'error' };

/**
 * Pure kern van het commitgedrag — bewust zonder React/DOM, zodat de regressietest de exacte
 * toetsaanslagreeks kan naspelen (`tests/planning/check-date-input-commit.ts`).
 */
export function resolveDateCommit(
  phase: DateCommitPhase, mode: DateCommitMode, seg: SegState,
): DateCommitResolution {
  const st = computeSeg(seg);
  if (phase === 'typing') {
    if (mode === 'blur') return { kind: 'idle' };
    if (st.status === 'empty') return { kind: 'write', iso: '' };
    if (st.status === 'valid') return { kind: 'write', iso: st.iso! };
    return { kind: 'idle' };
  }
  if (st.status === 'empty') return { kind: 'write', iso: '' };
  if (st.status === 'valid') return { kind: 'write', iso: st.iso! };
  if (st.status === 'incomplete') return { kind: 'revert' };
  return { kind: 'error' };
}

/**
 * Pure toetsaanslag-reducer: sanitiseert de invoer van segment `i` en zegt of de focus naar het
 * volgende segment doorspringt. De component gebruikt 'm voor het echte veld, de test om een
 * ingetypte datum toetsaanslag voor toetsaanslag na te spelen.
 */
export function nextSegmentState(
  seg: SegState, order: SegmentDef[], i: number, raw: string,
): { seg: SegState; advanceTo: number | null } {
  const def = order[i];
  const digits = raw.replace(/\D/g, '').slice(0, def.maxLen);
  const next = { ...seg, [def.kind]: digits };
  const advanceTo = digits.length >= def.maxLen && i < order.length - 1 ? i + 1 : null;
  return { seg: next, advanceTo };
}

/** De canonieke dag-maand-jaar-volgorde; de test heeft 'm nodig om toetsaanslagen na te spelen. */
export const DMY_ORDER: SegmentDef[] = [DAY_SEG, MONTH_SEG, YEAR_SEG];

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
  /**
   * Wanneer een bewerking naar buiten gecommit wordt (zie {@link resolveDateCommit}):
   *  - `'blur'` (standaard) → pas bij afronden: blur van de héle groep, Enter of plakken. Verplicht
   *    voor elke plek die naar de store schrijft (undo-plichtig), want live committen levert per
   *    ingetypte datum meerdere snapshots op.
   *  - `'live'` → per toetsaanslag, zoals vroeger. Alleen voor puur lokale draftstate mét live
   *    afgeleide feedback.
   */
  commitMode?: DateCommitMode;
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
 * COMMITMOMENT (`commitMode`, standaard `'blur'`): de gecommitte waarde gaat pas naar buiten bij het
 * afronden — blur van de héle groep, Enter, of het plakken van een volledige datum. Dat is geen
 * cosmetiek: het veld is gesegmenteerd en een jaar is al bij 2 cijfers parsebaar, dus live committen
 * maakt van "01062030" drie geldige commits (2020-06-01 → 0203-06-01 → 2030-06-01) en dus drie
 * undo-stappen bij elke store-schrijvende aanroeper. `'live'` is er nog voor plekken met puur lokale
 * draftstate die daar live afgeleide feedback op tonen.
 *
 * ESCAPE: herstelt de laatst gecommitte waarde (en wist de foutindicatie). Stond er niets open, dan
 * loopt Escape gewoon door naar de dialoog.
 *
 * ENTER (samenwerking met `useDialogKeys`): het veld rondt eerst zichzelf af (commit) en laat de
 * toets dan gewoon doorbubbelen — ÉÉN Enter commit én bevestigt de dialoog, met de zojuist
 * gecommitte waarde. Dat werkt omdat keydown een discrete event is: React flusht de setState uit
 * deze handler nog synchroon af (render + commit + layout-effects) vóór het native event
 * `document` bereikt, en `useDialogKeys` leest zijn `onConfirm` sinds die fix via een ref — dus
 * geen stale draft-closure meer. Zie de uitgebreide toelichting in `useDialogKeys.ts`.
 * Alleen bij ONGELDIGE of INCOMPLETE invoer eet het veld de toets op (`preventDefault` +
 * `stopPropagation`) en toont het de foutindicatie; de focus blijft in de groep.
 *
 * TOEKOMST (fase 2.8b — uren-scheduling): er komt tijd-van-de-dag. Deze component blokkeert die
 * uitbreiding niet; de parser is puur en tijd-loos. Bouw die tijd-invoer hier NU niet.
 */
export function DateTextInput({
  value, onCommit, className = '', style, ariaLabel, title, disabled, placeholder, id,
  commitMode = 'blur',
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

  // Committeert alleen een lege ('') of een geldige ISO-datum; bij incomplete/ongeldige invoer blijft
  // de store op de laatst geldige waarde staan. De fase bepaalt (samen met `commitMode`) óf er
  // überhaupt geschreven wordt — zie `resolveDateCommit`.
  const commitFrom = (s: SegState, phase: DateCommitPhase): DateCommitResolution => {
    const res = resolveDateCommit(phase, commitMode, s);
    if (res.kind === 'write' && res.iso !== value) onCommit(res.iso);
    return res;
  };

  /**
   * Afronden (blur/Enter): normaliseer, commit of val stil terug, en toon de fout bij een
   * compleet-maar-onbestaande datum. Retourneert `blocked` — of de invoer de dialoog-Enter moet
   * tegenhouden (ongeldig/incompleet). Een geslaagde commit blokkeert NIET: die mag in dezelfde
   * toetsaanslag de dialoog bevestigen (zie de JSDoc bovenaan).
   */
  const finish = (s: SegState): { blocked: boolean } => {
    const res = commitFrom(s, 'finish');
    if (res.kind === 'write') {
      setShowError(false);
      if (res.iso !== '') setSeg(isoToSegments(res.iso)); // normaliseer (bv. 6→06, 26→2026)
      return { blocked: false };
    }
    if (res.kind === 'revert') {
      setShowError(false);
      setSeg(isoToSegments(value)); // stille terugval op laatst geldige waarde
      return { blocked: true };
    }
    setShowError(true); // compleet-maar-ongeldig: commit NIET
    return { blocked: true };
  };

  const handleChange = (i: number, raw: string) => {
    const { seg: next, advanceTo } = nextSegmentState(seg, order, i, raw);
    setSeg(next);
    setShowError(false); // typen wist elke eerder getoonde fout
    commitFrom(next, 'typing');
    // Auto-doorspringen: land op het volgende segment. Is dat al GEVULD, selecteer dan de inhoud (typen
    // vervangt) i.p.v. een lege cursor die door `maxLength` niets meer accepteert (QA-fix).
    if (advanceTo !== null) focusSeg(advanceTo, next[order[advanceTo].kind] ? 'all' : 'start');
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    const val = el.value;
    const atStart = el.selectionStart === 0 && el.selectionEnd === 0;
    const atEnd = el.selectionStart === val.length && el.selectionEnd === val.length;

    if (e.key === 'Enter') {
      const { blocked } = finish(seg);
      // Ongeldig/incompleet mag de dialoog-Enter niet doorlaten (zie JSDoc). Een GESLAAGDE commit
      // laat de toets bewust doorbubbelen: `useDialogKeys` leest `onConfirm` via een ref en React
      // heeft de setState van `finish()` op dat moment al synchroon afgeflusht (discrete event), dus
      // de dialoog bevestigt met de zojuist gecommitte waarde. Eén Enter volstaat.
      if (blocked) { e.preventDefault(); e.stopPropagation(); }
      return; // geldig/leeg: laat bubbelen naar useDialogKeys
    }
    if (e.key === 'Escape') {
      // Herstel de laatst gecommitte waarde. Stond er niets open, dan is dit geen bewerking en mag
      // Escape gewoon doorlopen naar de dialoog (sluiten).
      const restored = isoToSegments(value);
      const dirty = showError || JSON.stringify(restored) !== JSON.stringify(seg);
      if (!dirty) return;
      e.preventDefault();
      e.stopPropagation();
      setSeg(restored);
      setShowError(false);
      return;
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
    // Een volledige datum plakken is ÉÉN bewuste handeling (het equivalent van een datumprikker):
    // die committeert meteen, ook in `'blur'`-modus.
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
    finish(seg);
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
            fontSize: 'calc(10px * var(--ui-font-scale, 1))', lineHeight: 1.2, color: 'var(--error)', whiteSpace: 'nowrap',
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

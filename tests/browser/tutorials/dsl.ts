// Stapscripts van de tutorials (extensie `tutorials` in OpenAEC-Foundation/open-planner-studio-extensions):
// de taal waarin een script zegt wát de lezer doet, wat er daarna moet kloppen en welk beeld er van komt.
//
// Eén script per tutorial (`tut-1.ts` … `tut-7.ts`), met dezelfde stappen en dezelfde knopnamen als de
// tutorialtekst. `runner.ts` voert ze uit met ECHTE browser-events (klikken, typen, slepen); de dev-brug
// `window.__OPS__` zet alleen het startproject klaar (dezelfde route als een `project://`-link in de
// tutorial) en leest de toestand voor de controles. Twee afnemers:
//   - `tests/browser/tutorial-steps.spec.ts` draait ze in CI ZONDER beelden vast te leggen (ontwerp
//     §7.4): een hernoemde knop of een ander dialoogvenster maakt de tutorial rood;
//   - `npm run gen:docs-screenshots -- --out <map>` draait dezelfde spec MET vastleggen en schrijft de
//     uitsneden als WebP naar `<map>/img/<taal>/<naam>.webp` (alleen licht thema, ontwerp §7.2, §10.1).
//
// Knopnamen staan hier letterlijk in nl en en, zoals de tutorial ze noemt: `ribbon` controleert dat het
// lintitem (op zijn vaste anker) die tekst draagt. Zo wordt een hernoeming in de app rood, en niet pas
// zichtbaar als een lezer vastloopt.
import type { StageId } from '../../../scripts/tutorial-project';

export type Lang = 'nl' | 'en';
export const LANGS: readonly Lang[] = ['nl', 'en'];

/** Tekst in beide talen (een knopnaam, een taaknaam, een invoer). */
export interface L { nl: string; en: string }
export const l = (nl: string, en: string): L => ({ nl, en });
/** Zelfde tekst in beide talen (een getal, een datum, een code). */
export const same = (s: string): L => ({ nl: s, en: s });
export type Txt = L | string;
export const pick = (t: Txt, lang: Lang): string => (typeof t === 'string' ? t : t[lang]);

/** Waar een handeling of controle op werkt. */
export type Target =
  /** Element met `data-tour-anchor` (hetzelfde anker dat de tutorial aanwijst). */
  | { anchor: string }
  /** Element met een ARIA-rol en zichtbare/toegankelijke naam. */
  | { role: 'button' | 'option' | 'tab' | 'checkbox' | 'textbox' | 'combobox' | 'menuitem' | 'menuitemcheckbox' | 'link' | 'dialog' | 'row' | 'radio' | 'spinbutton'; name: Txt; exact?: boolean; within?: Target }
  /** Het invoerveld (input/select/textarea/knop) direct ná het label (of kopje) met deze tekst. */
  | { field: Txt; within?: Target }
  /** Een knop, menu-item of optie op zijn ZICHTBARE tekst (zoals de tutorial hem noemt; de toegankelijke
   *  naam kan een sneltoets bevatten). */
  | { button: Txt; within?: Target }
  /** Element met precies deze tekst. */
  | { text: Txt; within?: Target; exact?: boolean }
  /** CSS-selector (alleen voor structuur zonder tekst, zoals een paneel). */
  | { css: string; within?: Target }
  /** De naamcel van een taak in het takenraster (takenlijst of Tabel), op naam. */
  | { taskName: Txt }
  /** Een cel in de Tabel-weergave: rij op taaknaam, kolom op koptekst. */
  | { cell: { task: Txt; column: Txt } }
  /** Het geopende dialoogvenster (het bovenste). */
  | { dialog: true };

export type Action =
  /** Een lintitem op zijn anker `ribbon:<tab>:<item>`; eerst het tabblad als dat niet actief is. `label`:
   *  de tekst die de tutorial noemt; die moet op het item staan. */
  | { ribbon: `${string}:${string}`; label?: Txt }
  /** Een linttabblad (`ribbon-tab:<tab>`), met de tekst die de tutorial noemt. */
  | { tab: string; label?: Txt }
  | { click: Target; modifiers?: ('Control' | 'Shift' | 'Alt')[]; double?: boolean; force?: boolean }
  /** Toetsenbordinvoer in het element met focus. */
  | { type: Txt }
  | { press: string }
  /** Een veld leegmaken en invullen (zoals selecteren en overtypen). */
  | { fill: Target; value: Txt }
  /** Een keuzelijst (native, of de eigen lijst van de app met `aria-haspopup="listbox"`). `option` is de
   *  zichtbare optietekst. */
  | { select: Target; option: Txt }
  /** Datumsegmenten (dag-maand-jaar, of met tijd): klik het eerste segment en typ de cijfers. */
  | { date: Target; value: Txt }
  /** Relatiemodus: sleep in de Gantt van de balk van `from` naar die van `to`. */
  | { dragBar: { from: Txt; to: Txt } }
  /** Sleep de rechterrand van een kolomkop in de Tabel-weergave `dx` pixels op. */
  | { dragColumnEdge: { column: Txt; dx: number } }
  /** Een in-/uitklapkop (`aria-expanded`) die met deze tekst begint openklappen; staat hij al open, dan niets. */
  | { expand: Txt; within?: Target }
  /** De resourcekiezer links in het histogram (Canvas): klik de rij van deze resource. */
  | { histogramPick: Txt }
  /** Wacht tot het element zichtbaar is (een venster dat opent, een melding). */
  | { waitFor: Target; state?: 'visible' | 'hidden' }
  /** Een handeling die een download geeft (de browserbuild bewaart exports als download); de voorgestelde
   *  bestandsnaam moet `filename` zijn. */
  | { download: Action; filename: Txt }
  /** Een controle midden in de stap (bv. vóór een beeld van een venster dat de stap daarna sluit). */
  | { check: Check }
  /** Een beeld midden in de stap. */
  | { shot: Shot };

/** Compacte toestand van het actieve document, voor de controles (gelezen via de dev-brug). */
export interface SnapTask {
  name: string;
  wbs: string;
  parent: string | null;
  summary: boolean;
  milestone: boolean;
  milestoneKind: string | null;
  mandatory: boolean;
  unit: string;
  /** Duur in werkdagen (dagtaak) of `null` bij een urentaak. */
  days: number | null;
  /** Duur in werkminuten bij een urentaak, anders `null`. */
  minutes: number | null;
  earlyStart: string;
  earlyFinish: string;
  totalFloat: number;
  critical: boolean;
  constraint: string | null;
  deadline: string | null;
  completion: number;
  actualStart: string | null;
  actualFinish: string | null;
  workRule: string | null;
  levelingDelay: number;
}

export interface Snap {
  documents: number;
  projectName: string;
  startDate: string;
  statusDate: string | null;
  stale: boolean;
  calcError: string | null;
  tasks: SnapTask[];
  /** `voorganger → opvolger TYPE lag` met namen; gesorteerd. */
  links: string[];
  /** Vrije periodes in de projectkalender: `naam start..einde`; gesorteerd. */
  holidays: string[];
  workDays: number[];
  resources: { name: string; type: string; maxUnits: number; unit: string | null }[];
  /** `taak ← resource × eenheden`; gesorteerd. */
  assignments: string[];
  baselines: string[];
  activeBaseline: string | null;
  /** Namen van overbezette resources. */
  overallocated: string[];
  ui: {
    tab: string;
    enableHourPlanning: boolean;
    showTaskTypes: boolean;
    showHistogram: boolean;
    histogramResource: string | null;
    selected: string[];
    dialogs: number;
  };
}

/** Een controle op de toestand: lege lijst = in orde, anders de afwijkingen (voor de foutmelding). */
export type StateCheck = (s: Snap, lang: Lang) => string[];

export type Check =
  | { state: StateCheck }
  /** Het element bevat deze tekst (de tekst die de tutorial belooft, bv. in de statusbalk). */
  | { see: Target; text: Txt }
  /** Het element bevat deze tekst NIET (bv. geen overschreden deadline in de statusbalk). */
  | { notSee: Target; text: Txt }
  /** Het element is zichtbaar. */
  | { visible: Target }
  /** Het element is er niet (meer). */
  | { gone: Target };

/** Een uitsnede: de omhullende van `of` (één of meer elementen), met marge, eventueel ingekort. */
export interface Shot {
  /** Bestandsnaam zonder extensie: `tut-<n>-<onderwerp>`, gelijk in nl en en. */
  name: string;
  of: Target | Target[];
  /** Marge rondom in px (standaard 8). */
  pad?: number;
  /** Inkorten vanaf linksboven tot deze maten (px), voor een leesbare uitsnede uit een groot paneel. */
  maxWidth?: number;
  maxHeight?: number;
  /** Tijdelijk een ander venster (bv. breder voor een tabel met veel kolommen); daarna terug. */
  viewport?: { width: number; height: number };
  /** Meldingen (toasts) in beeld laten; standaard klikt de generator ze eerst weg. */
  keepToasts?: boolean;
}

export interface Step {
  /** Gelijk aan het stap-id in de extensie (`STEP_ORDER_<n>` in main.js). */
  id: string;
  /** Wat de lezer doet, in volgorde. */
  do: Action[];
  /** Wat er daarna moet kloppen (de runner wacht tot het klopt, met een ruime time-out). */
  expect: Check[];
  /** Handelingen alleen om het beeld goed in beeld te krijgen (scrollen, een paneel openklappen);
   *  ook echte events, maar los van de opdracht. Lopen vóór `shots`, ook als er niet wordt vastgelegd. */
  frame?: Action[];
  shots?: Shot[];
}

export interface TutorialScript {
  /** Id van de tutorial in de extensie. */
  id: string;
  /** Startstand van de generator (`npm run gen:tutorial-project`), of `null`: een verse app. */
  start: StageId | null;
  /** De stand waarop het project na de laatste stap exact moet uitkomen. */
  end: StageId;
  steps: Step[];
}

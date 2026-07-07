/** Voortgangs-scheduling-modus (P6, fase 2.6). undefined ⇒ RETAINED_LOGIC (de default). */
export type ProgressMode = 'RETAINED_LOGIC' | 'PROGRESS_OVERRIDE';

/**
 * Project-scoped reken-opties (fase 2.9, §3.4/§7). ELKE default = het huidige gedrag ⇒ een afwezig
 * (of leeg) blok is byte-identiek aan vóór 2.9. Deze opties horen bij het BESTAND (net als
 * statusDate/progressMode), niet bij de app-settings — anders zou hetzelfde bestand op twee machines
 * een ander schema geven (§7). De solver leest ze via `CPMOptions.schedulingOptions`.
 */
export interface SchedulingOptions {
  /** Kalender voor relatie-lag (P6 4-way, Rapport B §7.1). Default 'predecessor' = de huidige
   *  LAG_CALENDAR-constante (lagCalendar.ts) ⇒ byte-identiek. */
  lagCalendar?: 'predecessor' | 'successor' | '24hour' | 'projectDefault';
  /** Kritiek-definitie. Default { mode:'totalFloat', threshold:0 } = het huidige tf≤0. */
  criticalDefinition?: { mode: 'totalFloat' | 'longestPath'; threshold?: number };  // threshold mag negatief (P6)
  /** TF-berekeningswijze. Default 'smallest' = de huidige min(finish,start)-float. */
  totalFloatMode?: 'start' | 'finish' | 'smallest';
  /** Open-ended taken kritiek? Default = huidig gedrag (een eindtaak krijgt tf via LF−EF). */
  makeOpenEndedCritical?: boolean;
  /** Near-critical-drempel in werkdagen (fractioneel in uur-modus). Default undefined ⇒ feature uit. */
  nearCriticalThreshold?: number;
  /** Multiple float paths. Default undefined ⇒ uit (byte-identiek). */
  floatPaths?: { enabled: boolean; method: 'FREE_FLOAT' | 'TOTAL_FLOAT'; maxPaths: number };
}

export interface Project {
  id: string;
  name: string;
  description: string;
  startDate: string; // ISO 8601
  endDate: string;
  calendarId: string;
  createdAt: string;
  modifiedAt: string;
  author: string;
  company: string;
  /**
   * WBS-codes automatisch nummeren (1.2.3.4, afgeleid uit de boompositie): aan ⇒ live
   * hernummeren bij elke structuurmutatie; uit/ontbreekt ⇒ vrije tekst (bestaand gedrag),
   * met een expliciete "Hernummer WBS"-actie. Nieuwe projecten krijgen true; geladen
   * bestanden zonder vlag blijven op vrije tekst (MSP-stabiliteitsmodel: codes in
   * omloop worden niet stilzwijgend herschreven).
   */
  wbsAutoNumber?: boolean;
  /** P6 "data date" (fase 2.6): de grens verleden/toekomst. undefined = geen statusdatum ⇒ gedrag
   *  exact als vóór 2.6. Gezet ⇒ remaining werk kan niet vóór deze dag starten. */
  statusDate?: string;    // ISO — date-only in dag-modus; mag datetime zijn in uur-modus (fase 2.8b, §3.4)
  /** Voortgangs-scheduling-modus (fase 2.6). undefined ⇒ RETAINED_LOGIC. Documentinstelling. */
  progressMode?: ProgressMode;
  /** OPTIONEEL — project-scoped reken-opties (fase 2.9, §3.4/§7). Afwezig ⇒ elke default ⇒
   *  byte-identiek gedrag. */
  schedulingOptions?: SchedulingOptions;
}

export interface ProjectStats {
  totalTasks: number;
  totalMilestones: number;
  criticalPathLength: number; // in work days
  totalFloat: number; // in work days
  percentComplete: number; // 0-100
}

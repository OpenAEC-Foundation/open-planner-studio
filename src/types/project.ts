/** Voortgangs-scheduling-modus (P6, fase 2.6). undefined ⇒ RETAINED_LOGIC (de default). */
export type ProgressMode = 'RETAINED_LOGIC' | 'PROGRESS_OVERRIDE';

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
  /** P6 "data date" (fase 2.6): de grens verleden/toekomst (dag-granulair). undefined = geen
   *  statusdatum ⇒ gedrag exact als vóór 2.6. Gezet ⇒ remaining werk kan niet vóór deze dag starten. */
  statusDate?: string;    // ISO date (dag-granulair)
  /** Voortgangs-scheduling-modus (fase 2.6). undefined ⇒ RETAINED_LOGIC. Documentinstelling. */
  progressMode?: ProgressMode;
}

export interface ProjectStats {
  totalTasks: number;
  totalMilestones: number;
  criticalPathLength: number; // in work days
  totalFloat: number; // in work days
  percentComplete: number; // 0-100
}

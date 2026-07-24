import { useEffect, useState } from 'react';
import { useAppStore } from '@/state/appStore';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { parseDate, parseInstant, formatDate, formatInstant } from '@/utils/dateUtils';
import { pickTiers, TIER_CONFIG } from '@/engine/renderer/timelineTiers';
import { MS_PER_DAY } from '@/engine/renderer/timeAxis';
import { isCompressedEffective } from '@/engine/renderer/workdayAxis';
import { shiftByDisplayedColumns } from '@/engine/renderer/barDragMath';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';

// Monotone teller: geeft élk sleep-gebaar een UNIEKE coalesce-key (`bardrag:<taskId>:<n>`). Zo vloeit
// een reeks per-mousemove `updateTask`-commits samen tot ÉÉN undo-stap, terwijl twee opeenvolgende
// sleeps nooit samenvloeien — ook niet binnen dezelfde milliseconde (de teller loopt altijd door).
let dragSeq = 0;

export interface DragState {
  taskId: string;
  edge: 'left' | 'right' | 'body';
  startX: number;
  originalStart: string;
  originalFinish: string;
  originalDuration: number;
  /** Fase 2.8b (§6.3): originele `durationMinutes` bij drag-start (uur-taken); undefined = dag-taak. */
  originalDurationMinutes?: number;
}

interface UseBarDragOptions {
  zoom: number;
  enableQuarterHourZoom: boolean;
  enableHourPlanning: boolean;
  calendar: WorkCalendar;
  effectiveCalById: Map<string, WorkCalendar>;
  /** Issue #21 punt 5 (review §10.3): dezelfde vlag als `GanttCanvas`/`resolveGanttAxis` — bepaalt
   *  of een getoonde kolom een KALENDERdag (uit) of een WERKDAG (aan) voorstelt tijdens het slepen.
   *  Effectieve compressie wordt, net als de as zelf, ook gegate op `hasWorkingDays()` van de
   *  PROJECTkalender (`calendar`, niet de per-taak-kalender) — zie `isCompressedEffective`. */
  compressNonWorkdays: boolean;
  updateTask: (id: string, updates: Partial<Task>, opts?: { coalesceKey?: string }) => void;
}

// Balk-sleep (resize links/rechts + verplaatsen), dag- én uur-taken. Bezit zijn eigen `dragState`
// en window-listeners; het centrale mousedown-hittest roept `startBarDrag(...)` aan. Bevat de drie
// verse resize-fixes (commits fa0c73d + 5c9f178) ONGEWIJZIGD:
//   1. duur = INCLUSIEVE werkdagen-telling via de taakkalender (workDaysBetween), zoals CPMSolver;
//   2. de mousemove-guard skipt alleen als `daysDelta` ONgewijzigd is sinds de vorige commit
//      (lastAppliedDelta, init 0) — niet zodra 'ie 0 is — zodat terug-naar-Δ0 de begin-duur herstelt;
//   3. het balk-anker wordt gecanonaliseerd naar een werkdag (addWorkDays/subtractWorkDays) zodat
//      earlyStart/earlyFinish nooit op een weekend landen en niet verschuiven bij de volgende runCPM.
// Issue #21 punt 5 (review §10.3): onder werkdagen-as-compressie (`compressNonWorkdays`) stelt een
// GETOONDE kolom een WERKDAG voor i.p.v. een kalenderdag — de dag-modus-branches (body/left/right,
// hieronder) vertalen `daysDelta` daarom via `shiftByDisplayedColumns` (`addWorkingDaysSigned` i.p.v.
// `addCalendarDays`). Toggle uit ⇒ ongewijzigd. De UUR-tak (`handleHourDrag`) blijft BEWUST op het
// oude lineaire ms-pad (§6 van het ontwerp: een uur-balk die een naad kruist tekent bij compressie
// "over de naad heen" — bekende, gedocumenteerde v1-beperking, geen regressie t.o.v. vandaag).
export function useBarDrag({ zoom, enableQuarterHourZoom, enableHourPlanning, calendar, effectiveCalById, compressNonWorkdays, updateTask }: UseBarDragOptions) {
  const [dragState, setDragState] = useState<DragState | null>(null);

  // Drag and drop: mousemove (via native event for performance)
  useEffect(() => {
    if (!dragState) return;

    // Eén UNIEKE undo-key voor dít hele sleep-gebaar: alle per-mousemove `updateTask`-commits
    // hieronder coalescen tot ÉÉN undo-stap (pakket UNDO-DRAG). `++dragSeq` garandeert dat een
    // volgende sleep een verse key krijgt en dus nooit samenvloeit met deze.
    const undoKey = `bardrag:${dragState.taskId}:${++dragSeq}`;

    // Fase 2.8b (§6.3): een UUR-taak (datumstring met tijdcomponent) sleept/rekt op HELE UREN — het
    // snap-quantum is nooit fijner dan 60 min (kwartier-snap bestaat niet). Slepen muteert
    // `durationMinutes` (hele minuten); de engine snapt bij de volgende runCPM naar de eerstvolgende
    // werk-instant (snap op het uur-raster, niet op de banden). Dag-taken houden exact het dag-pad.
    const isHourDrag = dragState.originalStart.includes('T');

    // Dag-resize: de nieuwe duur is de INCLUSIEVE werkdagen-telling via de taakkalender — exact
    // zoals CPM zelf rekent (CPMSolver: `scheduleDuration = cal.workDaysBetween(es, ef)`). Zo blijft
    // een resize-sleep staan ná de eerstvolgende runCPM en tellen weekend/feestdagen niet als duur
    // mee. (De vorige `diffCalendarDays` was exclusief én kalender-gebaseerd → één werkdag te weinig,
    // en bij slepen over een weekend werden za/zo ten onrechte meegeteld.)
    const resizeCalEngine = new CalendarEngine(effectiveCalById.get(dragState.taskId) ?? calendar);
    // Issue #21 punt 5 (review §10.3): de kolom→datum-vertaling voor het SLEEP-gebaar zelf moet de
    // PROJECTkalender volgen — dat is dezelfde kalender waarmee `GanttCanvas` de gedeelde
    // (mogelijk gecomprimeerde) as bouwt (`resolveGanttAxis({ calendar, ... })`), dus 1 getoonde
    // kolom = 1 werkdag van DIE kalender, ongeacht of deze taak een eigen kalender heeft. Duur-
    // berekening (workDaysBetween/addWorkDays/subtractWorkDays hieronder) blijft op de
    // taak-specifieke `resizeCalEngine` leunen — dat is een apart vraagstuk (hoeveel werkdagen
    // past de taak-kalender in het gesleepte bereik) en verandert hier niet.
    const axisCalEngine = new CalendarEngine(calendar);
    const compressed = isCompressedEffective(axisCalEngine, compressNonWorkdays);
    // Laatst toegepaste dag-verschuiving. Init op 0 = de begintoestand (geen no-op-update bij het
    // grijpen), maar terugkeren naar Δ0 ná een beweging herstelt de originele duur weer (zie fix
    // bij de guard hieronder).
    let lastAppliedDelta = 0;

    // Snap-quantum (§6.3): de actieve minor-tier, maar NOOIT fijner dan 60 min (kwartier-snap
    // bestaat niet). Zo is het quantum bij uur-zoom 1 uur en bij lagere zoom grover (dag/week);
    // altijd een veelvoud van 60 min ⇒ slepen muteert de duur in HELE uren (§6.4).
    // issue #21 punt 2 (vervolg): zonder urenplanning snapt een sleep bij hoge zoom op DAGEN
    // (minor='day'), want pickTiers geeft dan geen uur-tier. Met urenplanning aan blijft de
    // uur-snapping exact als voorheen. Derde arg stemt overeen met renderer/scaleFromZoom.
    const minorTier = pickTiers(zoom, enableQuarterHourZoom, enableHourPlanning).minor;
    const quantumMin = Math.max(60, Math.round(TIER_CONFIG[minorTier].stepDays * 1440));
    const quantumMs = quantumMin * 60000;

    const handleHourDrag = (pixelDelta: number) => {
      // 1 kolom = zoom px = MS_PER_DAY ms (issue #21 punt 5, fase 0-consolidatie: dezelfde
      // constante als `timeAxis.dateToX`, i.p.v. een eigen `86400000`-kopie). `daysDelta` blijft
      // een RELATIEVE pixel→tijd-verhouding — geen absolute canvas-x, dus geen `xToDate`-aanroep
      // hier (zie tests/planning/check-axis-consolidation.ts en het rapport voor de afweging).
      const rawMs = (pixelDelta / zoom) * MS_PER_DAY;
      const snappedMs = Math.round(rawMs / quantumMs) * quantumMs;
      if (snappedMs === 0) return;
      const deltaMin = Math.round(snappedMs / 60000);
      const origStart = parseInstant(dragState.originalStart);
      const origFinish = parseInstant(dragState.originalFinish);
      const baseTime = useAppStore.getState().tasks.find(t => t.id === dragState.taskId)!.time;
      // Originele werk-duur bij drag-start; val terug op de klok-span als het veld ontbrak.
      const origMinutes = dragState.originalDurationMinutes
        ?? Math.max(60, Math.round((origFinish.getTime() - origStart.getTime()) / 60000));

      if (dragState.edge === 'body') {
        // Verplaatsen: duur ongewijzigd, start+finish schuiven mee (op het quantum).
        const newStart = new Date(origStart.getTime() + snappedMs);
        const newFinish = new Date(origFinish.getTime() + snappedMs);
        updateTask(dragState.taskId, {
          time: {
            ...baseTime,
            scheduleStart: formatInstant(newStart, 'hour'),
            scheduleFinish: formatInstant(newFinish, 'hour'),
            earlyStart: formatInstant(newStart, 'hour'),
            earlyFinish: formatInstant(newFinish, 'hour'),
          },
        }, { coalesceKey: undoKey });
      } else if (dragState.edge === 'right') {
        // Rekken vanaf rechts: duur ± deltaMin HELE werk-uren. De provisionele klok-finish geeft
        // directe feedback; runCPM snapt daarna op het uur-raster naar de werk-instant.
        const newMinutes = Math.max(60, origMinutes + deltaMin);
        const newFinish = new Date(origFinish.getTime() + snappedMs);
        updateTask(dragState.taskId, {
          time: {
            ...baseTime,
            scheduleFinish: formatInstant(newFinish, 'hour'),
            earlyFinish: formatInstant(newFinish, 'hour'),
            durationMinutes: newMinutes,
          },
        }, { coalesceKey: undoKey });
      } else if (dragState.edge === 'left') {
        // Rekken vanaf links: start schuift, duur ∓ deltaMin HELE werk-uren (start eerder ⇒ langer).
        const newMinutes = Math.max(60, origMinutes - deltaMin);
        const newStart = new Date(origStart.getTime() + snappedMs);
        updateTask(dragState.taskId, {
          time: {
            ...baseTime,
            scheduleStart: formatInstant(newStart, 'hour'),
            earlyStart: formatInstant(newStart, 'hour'),
            durationMinutes: newMinutes,
          },
        }, { coalesceKey: undoKey });
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const pixelDelta = e.clientX - dragState.startX;
      if (isHourDrag) {
        handleHourDrag(pixelDelta);
        return;
      }
      const daysDelta = Math.round(pixelDelta / zoom);
      // Skip alleen als de dag-verschuiving NIET veranderd is sinds de vorige commit — niet zodra ze
      // toevallig 0 is. De oude `=== 0`-guard maakte de START-duur onbereikbaar: na een beweging
      // terug naar Δ0 werd niets gecommit, dus de balk bleef op de buur-waarde hangen en "flipte"
      // tussen de duren links/rechts van de begin-duur (bug: "ik kan 'm niet op 4 krijgen, hij
      // springt tussen 3 en 5"). Nu herstelt Δ0 netjes de originele duur.
      if (daysDelta === lastAppliedDelta) return;
      lastAppliedDelta = daysDelta;

      const origStart = parseDate(dragState.originalStart);
      const origFinish = parseDate(dragState.originalFinish);

      if (dragState.edge === 'body') {
        // Move entire task. Issue #21 punt 5 (review §10.3): onder compressie stelt `daysDelta`
        // GETOONDE kolommen = WERKdagen voor, niet kalenderdagen — `shiftByDisplayedColumns` schuift
        // dan via `addWorkingDaysSigned` (dezelfde werkdag-telling voor start én finish behoudt de
        // duur exact). Toggle uit ⇒ ONGEWIJZIGD `addCalendarDays`-pad (byte-identiek).
        const newStart = shiftByDisplayedColumns(axisCalEngine, origStart, daysDelta, compressed);
        const newFinish = shiftByDisplayedColumns(axisCalEngine, origFinish, daysDelta, compressed);
        updateTask(dragState.taskId, {
          time: {
            ...useAppStore.getState().tasks.find(t => t.id === dragState.taskId)!.time,
            scheduleStart: formatDate(newStart),
            scheduleFinish: formatDate(newFinish),
            earlyStart: formatDate(newStart),
            earlyFinish: formatDate(newFinish),
          },
        }, { coalesceKey: undoKey });
      } else if (dragState.edge === 'right') {
        // Resize from right (change duration/finish). Bereken de duur uit de rauwe sleep-datum,
        // maar schrijf een WERKDAG-anker weg (addWorkDays) i.p.v. de rauwe kalenderdag. Zo is de
        // balk tijdens het slepen al identiek aan wat runCPM produceert; earlyFinish belandt nooit
        // op een weekend/feestdag (een niet-canoniek anker verschuift bij de eerstvolgende runCPM —
        // o.a. bij bestand openen — waardoor dezelfde sleep vóór/ná een ander resultaat gaf, plus
        // een "plateau" rond een weekend-anker). Het weekend-DUURgedrag verandert niet: newDuration
        // komt nog steeds uit workDaysBetween. Issue #21 punt 5 (review §10.3): onder compressie is
        // `daysDelta` een WERKDAG-aantal getoonde kolommen — `shiftByDisplayedColumns` schuift dan
        // via `addWorkingDaysSigned` i.p.v. de rauwe kalenderdag-optelling (toggle uit: ongewijzigd).
        const newFinish = shiftByDisplayedColumns(axisCalEngine, origFinish, daysDelta, compressed);
        const newDuration = Math.max(1, resizeCalEngine.workDaysBetween(origStart, newFinish));
        const canonFinish = resizeCalEngine.addWorkDays(origStart, newDuration);
        updateTask(dragState.taskId, {
          time: {
            ...useAppStore.getState().tasks.find(t => t.id === dragState.taskId)!.time,
            scheduleFinish: formatDate(canonFinish),
            earlyFinish: formatDate(canonFinish),
            scheduleDuration: newDuration,
          },
        }, { coalesceKey: undoKey });
      } else if (dragState.edge === 'left') {
        // Resize from left (change start/duration). Idem als de rechterrand: schrijf een WERKDAG-
        // start weg (subtractWorkDays vanaf de vaste finish) i.p.v. de rauwe kalenderdag, zodat het
        // anker canoniek blijft (geen weekend-start, geen verschuiving bij runCPM). Issue #21 punt 5
        // (review §10.3): onder compressie is `daysDelta` een WERKDAG-aantal getoonde kolommen —
        // `shiftByDisplayedColumns` schuift dan via `addWorkingDaysSigned` (toggle uit: ongewijzigd).
        const newStart = shiftByDisplayedColumns(axisCalEngine, origStart, daysDelta, compressed);
        const newDuration = Math.max(1, resizeCalEngine.workDaysBetween(newStart, origFinish));
        const canonStart = resizeCalEngine.subtractWorkDays(origFinish, newDuration);
        updateTask(dragState.taskId, {
          time: {
            ...useAppStore.getState().tasks.find(t => t.id === dragState.taskId)!.time,
            scheduleStart: formatDate(canonStart),
            earlyStart: formatDate(canonStart),
            scheduleDuration: newDuration,
          },
        }, { coalesceKey: undoKey });
      }
    };

    const handleMouseUp = () => {
      setDragState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, zoom, compressNonWorkdays, updateTask]);

  return { dragState, startBarDrag: setDragState, active: !!dragState };
}

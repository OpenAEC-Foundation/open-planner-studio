// moveAssignment-checks (fase 2.10, golf D, item 4) — headless tegen de ECHTE Zustand-store
// (zelfde `useAppStore.getState()`-patroon als `harness.ts`), omdat er in deze omgeving geen
// Playwright/browser-tooling beschikbaar is om de UI-select ("verplaats naar…") interactief te
// bedienen. Dit bewijst de STORE-ACTIE (guards, unitsPerDay/curve-behoud, resourceIds-boekhouding
// op beide taken) met echte code — geen visuele bevestiging van de dropdown zelf.
//
// Draait via run.sh. Exit 0 = alles groen.
import { useAppStore } from '@/state/appStore';

const S = () => useAppStore.getState();
const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};

// ── Opzet: twee leaf-taken (A, B), een mijlpaal (M), een samenvattingstaak (S) met kind (Sc),
// een extra leaf-taak (C) die de resource al draagt, en één resource + toewijzing op A. ──
const idA = S().addTask({ name: 'A' });
const idB = S().addTask({ name: 'B' });
const idM = S().addTask({ name: 'M', isMilestone: true });
const idS = S().addTask({ name: 'S' });
const idSc = S().addTask({ name: 'Sc', parentId: idS });
const idC = S().addTask({ name: 'C' });

const resId = S().addResource({ name: 'Timmerman', type: 'LABOR', description: '', maxUnits: 1 });
S().assignResource(idA, resId, 4, 'BELL');
const asgn = () => S().assignments.find(a => a.taskId === idA && a.resourceId === resId);
eq('01 setup: toewijzing bestaat op A', !!asgn(), true);
const assignmentId = asgn()!.id;

// C draagt de resource al ook (tweede toewijzing, andere taak) — kandidaat voor de
// "resource al op doeltaak"-weigering hieronder.
S().assignResource(idC, resId, 2, 'UNIFORM');

// ── 1) Succesvolle verplaatsing A → B: eenheden/curve ongewijzigd, resourceIds bijgewerkt. ──
const moved = S().moveAssignment(assignmentId, idB);
eq('02 moveAssignment retourneert true', moved, true);
const afterMove = S().assignments.find(a => a.id === assignmentId);
eq('03 assignment.taskId == B', afterMove?.taskId, idB);
eq('04 unitsPerDay ongewijzigd (4)', afterMove?.unitsPerDay, 4);
eq('05 curve ongewijzigd (BELL)', afterMove?.curve, 'BELL');
eq('06 A.resourceIds bevat de resource niet meer', S().tasks.find(t => t.id === idA)?.resourceIds.includes(resId), false);
eq('07 B.resourceIds bevat de resource nu wel', S().tasks.find(t => t.id === idB)?.resourceIds.includes(resId), true);

// ── 2) Weiger: doeltaak is een mijlpaal. ──
const rejM = S().moveAssignment(assignmentId, idM);
eq('08 weiger mijlpaal-doeltaak: retourneert false', rejM, false);
eq('09 weiger mijlpaal: assignment blijft op B', S().assignments.find(a => a.id === assignmentId)?.taskId, idB);

// ── 3) Weiger: doeltaak is een samenvattingstaak (heeft childIds). ──
const rejS = S().moveAssignment(assignmentId, idS);
eq('10 weiger summary-doeltaak: retourneert false', rejS, false);
eq('11 weiger summary: assignment blijft op B', S().assignments.find(a => a.id === assignmentId)?.taskId, idB);

// ── 4) Weiger: resource is al toegewezen op de doeltaak (C draagt de resource al). ──
const rejDup = S().moveAssignment(assignmentId, idC);
eq('12 weiger dubbele resource-op-taak: retourneert false', rejDup, false);
eq('13 weiger dubbel: assignment blijft op B', S().assignments.find(a => a.id === assignmentId)?.taskId, idB);
eq('14 weiger dubbel: C behoudt zijn EIGEN (ongemoeide) toewijzing', S().assignments.filter(a => a.taskId === idC && a.resourceId === resId).length, 1);

// ── 5) Onbekend assignmentId ⇒ false, geen crash. ──
eq('15 onbekend assignmentId ⇒ false', S().moveAssignment('nope', idA), false);

// ── 6) Verplaats terug naar A (leeg leaf) — bewijst dat een tweede geslaagde move blijft werken. ──
const movedBack = S().moveAssignment(assignmentId, idA);
eq('16 verplaats terug naar A: retourneert true', movedBack, true);
eq('17 terug op A: taskId == A', S().assignments.find(a => a.id === assignmentId)?.taskId, idA);
eq('18 terug op A: B.resourceIds leeg (geen andere toewijzing meer)', S().tasks.find(t => t.id === idB)?.resourceIds.includes(resId), false);
eq('19 terug op A: A.resourceIds bevat de resource weer', S().tasks.find(t => t.id === idA)?.resourceIds.includes(resId), true);

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  move-assignment-check: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  move-assignment-check: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}

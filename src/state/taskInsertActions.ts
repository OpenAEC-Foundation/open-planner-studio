import { useAppStore } from '@/state/appStore';
import { firstRowIndexByTask, isTreeMode } from '@/engine/view/visibleRows';
import type { Task } from '@/types/task';

/**
 * Waar landt een NIEUWE taak? (issue #45-nasleep en issue #49)
 *
 * Eén module voor álle invoegroutes — lintknop "+ Taak", de Mijlpaal-dropdown, het contextmenu
 * ("Taak toevoegen" én "Invoegen boven/onder"), de Insert- en Ctrl+I-sneltoets. Ze deelden eerder
 * niets: de knoppen riepen kaal `addTask({name})` aan (dus altijd achteraan, de klacht uit issue
 * #49), het contextmenu ankerde op de aangeklikte taak en de sneltoets op `selectedTaskIds[0]`.
 * Drie routes, drie uitkomsten voor dezelfde handeling.
 *
 * Bewust in `src/state/` en niet in de component-boom (naar het model van `relationActions.ts`):
 * lint, canvas, tabel én de headless regressiebatterij draaien zo letterlijk dezelfde functies.
 * DOM- en JSX-vrij, dus headless testbaar — zie `tests/planning/check-context-menu-scope.ts`.
 */

export type InsertWhere = 'above' | 'below';

/** Wat een nieuwe taak minimaal nodig heeft; verder alles wat `addTask` accepteert. */
export type NewTaskInput = Partial<Task> & { name: string };

/**
 * Rond elke gewone taak-toevoegactie identiek af: de nieuwe taak is de enige selectie, de
 * bestaande Gantt-focusroute toont rij en datum zonder de zoomkeuze te wijzigen, en het
 * eigenschappenpaneel zet de naam klaar om meteen te overschrijven.
 */
function finishNewTask(id: string): string {
  const store = useAppStore.getState();
  store.focusOnTask(id, { preserveZoom: true });
  store.setUI({ showPropertiesPanel: true, pendingTaskNameFocusId: id });
  return id;
}

/**
 * Het ANKER voor "Invoegen boven/onder" over een reikwijdte (issue #45, nasleep): de BOVENSTE
 * (`above`) respectievelijk ONDERSTE (`below`) taak van de reikwijdte, in de volgorde ZOALS DE
 * GEBRUIKER ZE OP HET SCHERM ZIET (`viewRows`).
 *
 * Waarom de zichtbare volgorde en niets anders. Bij een meervoudige selectie zijn er drie
 * kandidaat-volgordes, en twee daarvan zijn onvoorspelbaar voor de gebruiker:
 *  - de KLIKVOLGORDE (`selectedTaskIds`) — Ctrl+klik duwt achteraan aan (`selectTask`), dus wie
 *    van onder naar boven selecteert krijgt een ander anker dan wie van boven naar beneden
 *    selecteert. Precies het gedrag dat de eigenaar als "werkt niet zoals je zou verwachten"
 *    meldde: de nieuwe taak landde midden IN de selectie.
 *  - de RAUWE `tasks`-array — dat is de documentvolgorde, die na indent/outdent en boomopbouw niet
 *    één-op-één met het scherm loopt.
 * Alleen "bovenste/onderste zoals getoond" is voorspelbaar, en het is dezelfde volgorde die de
 * Gantt en de tabel renderen (§4.1 van de weergave-pijplijn).
 *
 * Randgevallen, bewust zo:
 *  - NIET-AANEENGESLOTEN selectie (taak 1, 3 en 5): dezelfde regel, geen uitzondering — `above`
 *    landt boven 1, `below` onder 5. De nieuwe taak omsluit de hele selectie; dat is de enige
 *    uitkomst die niet van een willekeurig "gat" afhangt.
 *  - Selectie over MEERDERE OUDERS: het anker is altijd een taak die de gebruiker écht selecteerde,
 *    dus de nieuwe taak erft de ouder en het inspringniveau van die uiterste taak (`addTask` doet
 *    dat al). `above` en `below` kunnen dan in verschillende takken landen — dat is correct: dat is
 *    letterlijk waar de bovenste en de onderste selectieregel staan. We raden geen
 *    gemeenschappelijke ouder; dat zou de taak op een plek zetten die niemand aanwees.
 *  - Een geselecteerde taak die NIET zichtbaar is (ingeklapte ouder, actief filter) heeft geen
 *    schermpositie. Zijn er zichtbare taken in de reikwijdte, dan tellen alleen die mee; is er
 *    geen enkele zichtbaar, dan valt de rangschikking terug op de documentvolgorde van `tasks`.
 *  - Gegroepeerde weergave kan één taak in meerdere banden tonen; dan telt de EERSTE rij, net als
 *    bij de relatiepijlen (`firstRowIndexByTask`). In die weergave wordt positioneel invoegen
 *    overigens sowieso geweigerd — zie `canInsertRelative` hieronder.
 *
 * Geeft `undefined` bij een lege reikwijdte — de aanroeper voegt dan achteraan toe (`addTask`
 * zonder `position`), exact het bestaande "geen selectie"-gedrag van de Insert-sneltoets.
 */
export function insertAnchorForScope(ids: string[], where: InsertWhere): string | undefined {
  if (ids.length === 0) return undefined;
  if (ids.length === 1) return ids[0];

  const { viewRows, tasks } = useAppStore.getState();
  const rowIndex = firstRowIndexByTask(viewRows);
  const zichtbaar = ids.filter((id) => rowIndex.has(id));

  let rank: (id: string) => number;
  let pool: string[];
  if (zichtbaar.length > 0) {
    pool = zichtbaar;
    rank = (id) => rowIndex.get(id)!;
  } else {
    const docIndex = new Map(tasks.map((t, i) => [t.id, i]));
    pool = ids;
    rank = (id) => docIndex.get(id) ?? Number.MAX_SAFE_INTEGER;
  }

  let best = pool[0];
  for (const id of pool) {
    if (where === 'above' ? rank(id) < rank(best) : rank(id) > rank(best)) best = id;
  }
  return best;
}

/**
 * Mag er, gegeven de HUIDIGE weergave, ten opzichte van een anker ingevoegd worden? (issue #49)
 *
 * Alleen in pure boommodus (geen filter, geen groepering, geen sortering) is de getoonde volgorde
 * ook de documentvolgorde. Wordt er gegroepeerd of gesorteerd, dan verschuift een structureel
 * "boven taak X" ingevoegde taak naar de band/positie die de weergave hem toewijst — de gebruiker
 * ziet hem dus ergens ánders verschijnen dan waar hij hem neerzette. Gemeten vóór deze fix: met
 * groepering op taaktype en een selectie in de band LOGISTIC landde Insert de nieuwe taak zichtbaar
 * in de band CONSTRUCTION.
 *
 * Dit is exact dezelfde poort die in-/uitspringen (`shortcutRegistry`, ribbon) en het doorlopend
 * invoeren in de tabel (`TableEditor.navigateCell`) al hanteren — één regel voor alle
 * structuurmutaties, zodat er geen route overblijft die het stiekem tóch doet.
 */
export function canInsertRelative(): boolean {
  return isTreeMode(useAppStore.getState().view);
}

/**
 * Meld dat de weergave positioneel invoegen tegenhoudt.
 *
 * BEWUST `notifyStructureLocked()` en niet het generieke `notify()`: dit is precies de melding die
 * issue #26 voor geweigerde structuurmutaties introduceerde (`StructureLockedNotice`), inclusief de
 * knop die filter/groepering/sortering in één klik wist. Een tweede kanaal ernaast zou dezelfde
 * situatie op twee manieren verwoorden.
 */
function meldGeblokkeerd(): void {
  useAppStore.getState().notifyStructureLocked();
}

/**
 * Route 1 — "voeg een taak toe" (lintknop **+ Taak**, de **Mijlpaal**-dropdown, contextmenu-item
 * "Taak toevoegen"). Issue #49, letterlijk de door de melder gevraagde regel:
 *
 *   1. is er een taak geselecteerd ⇒ de nieuwe taak komt direct ONDER de selectie;
 *   2. is er niets geselecteerd ⇒ achteraan, zoals altijd.
 *
 * Bij een meervoudige selectie is "onder de selectie" de ONDERSTE taak in schermvolgorde (zie
 * `insertAnchorForScope`) — niet de laatst aangeklikte, en niet ergens midden in de selectie.
 *
 * Buiten pure boommodus valt hij terug op regel 2 (achteraan) plus de structuurmelding. Bewust géén
 * volledige weigering zoals bij route 2 hieronder: "+ Taak" is een TOEVOEG-actie met een
 * positie-voorkeur, niet een positie-commando. Weigeren zou betekenen dat je in een gegroepeerde
 * weergave helemaal geen taak meer kunt aanmaken — een regressie t.o.v. vandaag, en het tegendeel
 * van wat issue #49 vraagt. Wat er wegvalt is alleen de plaatsing, en dát is wat de melding uitlegt.
 */
export function addTaskNearSelection(partial: NewTaskInput): string {
  const store = useAppStore.getState();
  const scope = store.selectedTaskIds;
  if (scope.length === 0) return finishNewTask(store.addTask(partial));
  if (!canInsertRelative()) {
    meldGeblokkeerd();
    return finishNewTask(store.addTask(partial));
  }
  const anchorId = insertAnchorForScope(scope, 'below');
  return finishNewTask(store.addTask(anchorId ? { ...partial, position: { anchorId, where: 'below' } } : partial));
}

/**
 * Route 2 — expliciet "Invoegen boven/onder" (contextmenu-items + de Insert- en Ctrl+I-sneltoets).
 * Deze acties bestaan uitsluitend uit hun positie, dus buiten pure boommodus worden ze GEWEIGERD
 * met de structuurmelding — dezelfde poort als in-/uitspringen. Een terugval op "achteraan" zou
 * hier ronduit misleidend zijn: "Invoegen boven" die onderaan uitkomt.
 *
 * Zonder anker (lege selectie) is er niets positioneels aan en voegt hij gewoon achteraan toe; dat
 * is het bestaande gedrag van de Insert-sneltoets zonder selectie en werkt in elke weergave.
 *
 * Geeft de id van de nieuwe taak, of `null` als de weergave hem tegenhield.
 */
export function insertTaskRelativeToScope(
  scope: string[],
  where: InsertWhere,
  partial: NewTaskInput,
): string | null {
  const store = useAppStore.getState();
  const anchorId = insertAnchorForScope(scope, where);
  if (!anchorId) return finishNewTask(store.addTask(partial));
  if (!canInsertRelative()) {
    meldGeblokkeerd();
    return null;
  }
  return finishNewTask(store.addTask({ ...partial, position: { anchorId, where } }));
}

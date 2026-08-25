// Meldingenkanaal-checks (bevinding K8) — headless tegen de ECHTE Zustand-store.
//
// Waarom deze batterij bestaat: de app had GEEN gebruikerszichtbaar foutkanaal. Mislukte opslag,
// mislukte auto-save, corrupte invoer en een kapotte updateketen hadden voor de gebruiker exact
// hetzelfde symptoom — niets. Het kanaal dat dat oplost heeft drie eigenschappen die stil kunnen
// afdrijven en die geen enkele CPM-case raakt:
//
//   1. SAMENVOUWEN. De auto-save probeert het elke 10 s opnieuw. Zonder `dedupeKey` levert één
//      aanhoudende schrijffout zes meldingen per minuut op en verdringt hij alles wat de
//      gebruiker echt moet lezen. De teller moet dus omhoog ZONDER dat de melding van plek
//      springt (een stapel die herordent is onleesbaar).
//   2. FOUTEN ZIJN PLAKKERIG. Bij het aftoppen op MAX_NOTIFICATIONS mag een fout nooit door een
//      info verdrongen worden — dan is de bevinding terug, alleen subtieler.
//   3. APP-GLOBAAL. Zou `notifications` in het documentcontract belanden, dan swapt de lijst bij
//      een tabwissel en landt hij in de undo-snapshot: een opslaanfout die verdwijnt zodra je van
//      tabblad wisselt of Ctrl+Z drukt. De laatste twee blokken bewaken exact dat.
//
// Draait via run.sh. Exit 0 = alles groen.
import { useAppStore } from '@/state/appStore';
import { MAX_NOTIFICATIONS } from '@/state/slices/uiSlice';
import { sameIFCSource } from '@/state/ifcSaveInput';
import { createRelationWithFeedback } from '@/state/relationActions';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { MPP_TIMEPHASED_HELP_ARTICLE_ID } from '@/state/timephasedLossNotice';
import { commitPreparedGridMutation, prepareGridMutation } from '@/state/gridTransaction';
import type { CellEditIntent } from '@/types/taskGrid';
import type { PreparedGridMutation } from '@/state/gridTransaction';
import type { Sequence } from '@/types/sequence';

const S = () => useAppStore.getState();
const N = () => S().ui.notifications;
const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};
const truthy = (label: string, got: boolean) => {
  checks++;
  if (!got) diffs.push(`${label}: verwacht waar, kreeg onwaar`);
};

/** Leeg de lijst zonder aan te nemen hóé dat elders gebeurt (er is bewust geen clear-actie). */
const clearAll = () => { for (const n of [...N()]) S().dismissNotification(n.id); };

// ── 1. Basis: pushen, tellen, wegklikken ─────────────────────────────────────
S().newProject();
clearAll();
eq('1 verse start: geen meldingen', N().length, 0);

S().notify({ severity: 'error', messageKey: 'notifications.saveFailed', detail: 'EACCES' });
eq('2 één melding na één notify', N().length, 1);
eq('3 severity komt door', N()[0]?.severity, 'error');
eq('4 messageKey komt door', N()[0]?.messageKey, 'notifications.saveFailed');
eq('5 detail blijft rauw (bewust onvertaald)', N()[0]?.detail, 'EACCES');
eq('6 eerste voorkomen telt als 1', N()[0]?.count, 1);
truthy('7 melding krijgt een id', typeof N()[0]?.id === 'string' && N()[0]?.id.length > 0);

S().notify({ severity: 'info', messageKey: 'notifications.openFailed' });
eq('8 zonder dedupeKey stapelen meldingen', N().length, 2);
truthy('9 ids zijn uniek', N()[0]?.id !== N()[1].id);

const eersteId = N()[0]?.id;
S().dismissNotification(eersteId);
eq('10 wegklikken verwijdert er precies één', N().length, 1);
eq('11 de JUISTE is weg', N().some(n => n.id === eersteId), false);

S().dismissNotification('bestaat-niet');
eq('12 wegklikken van een onbekende id is een no-op', N().length, 1);

// ── 2. Samenvouwen op dedupeKey ──────────────────────────────────────────────
// Dit is de auto-save-storm: elke 10 s dezelfde fout. Eén regel, teller omhoog.
clearAll();
S().notify({ severity: 'error', messageKey: 'notifications.autoSaveFailed', detail: 'poging 1', dedupeKey: 'autosave' });
S().notify({ severity: 'error', messageKey: 'notifications.autoSaveFailed', detail: 'poging 2', dedupeKey: 'autosave' });
S().notify({ severity: 'error', messageKey: 'notifications.autoSaveFailed', detail: 'poging 3', dedupeKey: 'autosave' });
eq('13 drie identieke meldingen vouwen samen tot één regel', N().length, 1);
eq('14 de teller staat op 3', N()[0]?.count, 3);
eq('15 het detail is dat van de LAATSTE poging', N()[0]?.detail, 'poging 3');

// Een andere dedupeKey is een andere melding.
S().notify({ severity: 'error', messageKey: 'notifications.saveFailed', dedupeKey: 'save' });
eq('16 een andere dedupeKey stapelt wél', N().length, 2);
eq('17 de samengevouwen teller blijft staan', N()[0]?.count, 3);

// Positie moet stabiel blijven: een herhaling mag de stapel niet herordenen.
// De meldingen worden hier uit elkaar gehouden op `detail` — `messageKey` is een GESLOTEN unie
// (`NotificationMessageKey`), dus verzonnen etiketten als 'a'/'b' zijn geen geldige sleutels meer.
clearAll();
S().notify({ severity: 'error', messageKey: 'notifications.saveFailed', detail: 'A', dedupeKey: 'k-a' });
S().notify({ severity: 'error', messageKey: 'notifications.openFailed', detail: 'B' });
S().notify({ severity: 'error', messageKey: 'notifications.saveFailed', detail: 'A', dedupeKey: 'k-a' });
eq('18 herhaling voegt geen regel toe', N().length, 2);
eq('19 de herhaalde melding blijft op zijn plek (geen sprong naar onder)', N().map(n => n.detail), ['A', 'B']);
eq('20 en heeft geteld', N()[0]?.count, 2);

// Zonder dedupeKey NOOIT samenvouwen, ook niet bij identieke inhoud — twee losse
// opslaanpogingen die allebei falen zijn twee gebeurtenissen.
clearAll();
S().notify({ severity: 'error', messageKey: 'notifications.saveFailed', detail: 'zelfde' });
S().notify({ severity: 'error', messageKey: 'notifications.saveFailed', detail: 'zelfde' });
eq('21 zonder dedupeKey blijven identieke meldingen los', N().length, 2);

// ── 3. Aftoppen: een fout mag nooit door een info verdrongen worden ──────────
clearAll();
truthy('22 opzet: het plafond is minstens 2', MAX_NOTIFICATIONS >= 2);
for (let i = 0; i < MAX_NOTIFICATIONS + 2; i++) {
  S().notify({ severity: 'info', messageKey: 'notifications.templateSaved', detail: `i${i}` });
}
eq('23 de lijst wordt afgetopt op MAX_NOTIFICATIONS', N().length, MAX_NOTIFICATIONS);
eq('24 de OUDSTE infos vallen eruit, de nieuwste blijven',
  N().map(n => n.detail), Array.from({ length: MAX_NOTIFICATIONS }, (_, k) => `i${k + 2}`));

// De kern van het blok: één fout onderaan een stroom infos moet blijven staan.
clearAll();
S().notify({ severity: 'error', messageKey: 'notifications.saveFailed', detail: 'DE-FOUT' });
for (let i = 0; i < MAX_NOTIFICATIONS + 3; i++) {
  S().notify({ severity: 'info', messageKey: 'notifications.templateSaved', detail: `spam${i}` });
}
eq('25 de lijst is afgetopt', N().length, MAX_NOTIFICATIONS);
truthy('26 de FOUT staat er nog — infos worden er eerder uitgegooid',
  N().some(n => n.detail === 'DE-FOUT'));
eq('27 en hij staat nog vooraan', N()[0]?.detail, 'DE-FOUT');

// Zijn het allemaal fouten, dan valt (noodgedwongen) de oudste eruit.
clearAll();
for (let i = 0; i < MAX_NOTIFICATIONS + 1; i++) {
  S().notify({ severity: 'error', messageKey: 'notifications.saveFailed', detail: `e${i}` });
}
eq('28 alleen fouten: afgetopt', N().length, MAX_NOTIFICATIONS);
eq('29 alleen fouten: de oudste valt eruit', N().some(n => n.detail === 'e0'), false);
eq('30 alleen fouten: de nieuwste staat erin', N().some(n => n.detail === `e${MAX_NOTIFICATIONS}`), true);

// ── 4. Het echte pad: runCPM meldt een onberekenbare planning ────────────────
// Vandaag hing dit aan een lokale useState in GanttCanvas, dus de cyclusfout was ONZICHTBAAR
// vanuit Backstage, de tabel en het rapport — juist de plekken waar je een export start.
clearAll();
S().newProject();
const c1 = S().addTask({ name: 'C1' });
const c2 = S().addTask({ name: 'C2' });
S().addSequence({ predecessorId: c1, successorId: c2, type: 'FINISH_START', lagDays: 0 });
S().addSequence({ predecessorId: c2, successorId: c1, type: 'FINISH_START', lagDays: 0 });
S().runCPM();
truthy('31 opzet: de solver meldt een cyclus', !!S().cpmResult?.error);
eq('32 runCPM heeft precies één melding gepusht', N().length, 1);
eq('33 de melding is een fout', N()[0]?.severity, 'error');
eq('34 het rauwe solver-bericht zit in detail', N()[0]?.detail, S().cpmResult?.error);
truthy('35 de melding is vertaalbaar (draagt een sleutel, geen kant-en-klare zin)',
  N()[0]?.messageKey.startsWith('notifications.'));

// Nog eens rekenen op dezelfde kapotte planning mag geen tweede regel opleveren.
S().runCPM();
eq('36 herhaald rekenen vouwt samen', N().length, 1);
eq('37 en telt', N()[0]?.count, 2);

// Een gezonde planning meldt niets.
clearAll();
S().newProject();
const g1 = S().addTask({ name: 'G1' });
const g2 = S().addTask({ name: 'G2' });
S().addSequence({ predecessorId: g1, successorId: g2, type: 'FINISH_START', lagDays: 0 });
S().runCPM();
truthy('38 opzet: gezonde planning, geen solver-fout', !S().cpmResult?.error);
eq('39 een geslaagde berekening meldt niets', N().length, 0);

// ── 5. App-globaal: meldingen zijn GEEN documentdata ─────────────────────────
// Zouden ze in `DocumentPayload` zitten, dan verdwijnt een opslaanfout zodra je van tabblad
// wisselt. Dit blok faalt zodra iemand `notifications` aan het documentcontract toevoegt.
clearAll();
S().notify({ severity: 'error', messageKey: 'notifications.saveFailed', dedupeKey: 'blijf' });
const docA = S().activeDocumentId;
S().newDocument();
const docB = S().activeDocumentId;
truthy('40 opzet: er is een tweede document', docA !== docB);
eq('41 de melding overleeft het openen van een nieuw document', N().length, 1);
S().switchDocument(docA);
eq('42 de melding overleeft een documentwissel terug', N().length, 1);
eq('43 en is nog dezelfde melding', N()[0]?.dedupeKey, 'blijf');
S().switchDocument(docB);
S().closeDocument(docB);
eq('44 de melding overleeft het sluiten van een document', N().length, 1);

// ── 6. Meldingen zitten niet in de undo-snapshot ─────────────────────────────
clearAll();
S().newProject();
const u = S().addTask({ name: 'undo-mij' });
S().notify({ severity: 'error', messageKey: 'notifications.saveFailed' });
S().updateTask(u, { name: 'gewijzigd' });
eq('45 opzet: melding staat er vóór de undo', N().length, 1);
S().undo();
eq('46 undo draait de taak terug', S().tasks.find(t => t.id === u)?.name, 'undo-mij');
eq('47 maar laat de melding staan (niet in de snapshot)', N().length, 1);
S().redo();
eq('48 redo laat de melding óók staan', N().length, 1);

// `newProject` is een reset van de PROJECTdata, niet van de app-state.
S().newProject();
eq('49 newProject wist de meldingen niet', N().length, 1);

// ── 7. De I/O-paden melden nu écht (K8b) ────────────────────────────────────
// Deze twee paden zijn headless te draaien omdat ze afbreken vóór/op een browser-API die in Node
// niet bestaat — precies de faalmodus waar de gebruiker vandaag niets van zag.

// Een onleesbaar voorbeeldbestand: `readIFC` gooit sinds K4 een IfcParseError. Vroeger ging dat
// naar `console.error` en zag de gebruiker een leeg scherm zonder uitleg.
clearAll();
S().openExampleFromString('dit is geen IFC', 'kapot.ifc');
eq('50 een onleesbaar bestand meldt zich', N().length, 1);
eq('51 als fout', N()[0]?.severity, 'error');
eq('52 met de open-sleutel', N()[0]?.messageKey, 'notifications.openFailed');
truthy('53 en met de rauwe parserfout als detail', (N()[0]?.detail ?? '').length > 0);

// `saveFile` had helemaal GEEN try/catch, en de Tauri-backend vangt ook niets: een schijf vol of
// een geweigerde permissie leverde een afgewezen promise op die nergens landde. Headless klapt
// het pad al op `isTauri()` (geen `window`) — een andere oorzaak dan in productie, maar wél
// precies de vraag die hier telt: komt een gooiende opslagpoging bij de gebruiker aan in plaats
// van bij niemand. Wat deze batterij NIET kan halen is het geslaagde-opslag-pad; dat vereist een
// echte bestandsdialoog. De `sameIFCSource`-guard op dát pad wordt hieronder los getest.
clearAll();
S().newProject();
const sv = S().addTask({ name: 'niet-opgeslagen' });
truthy('54 opzet: het document is gewijzigd', S().isDirty === true);
let saveThrew = false;
await S().saveFile().catch(() => { saveThrew = true; });
eq('55 saveFile gooit niet meer naar de aanroeper', saveThrew, false);
eq('56 de mislukte opslag meldt zich', N().length, 1);
eq('57 met de opslaan-sleutel', N()[0]?.messageKey, 'notifications.saveFailed');
eq('58 en het document blijft gewijzigd (geen valse "opgeslagen")', S().isDirty, true);
truthy('59 de taak staat er nog', !!S().tasks.find(t => t.id === sv));

// ── 8. `sameIFCSource`: de wacht op verouderde inhoud ───────────────────────
// `saveFile` serialiseert, wacht dán op een native dialoog die minuten open kan staan, en wist
// dán `isDirty`. Alles wat de gebruiker ondertussen typt gold als opgeslagen maar stond nergens.
// De vergelijking hieronder is wat dat tegenhoudt; hij moet dus zowel gelijk als ONgelijk kunnen
// zeggen. Referentievergelijking volstaat omdat Immer elk gemuteerd veld vervangt.
S().newProject();
const voor = S();
truthy('60 dezelfde state is aan zichzelf gelijk', sameIFCSource(voor, S()));
const bewerkt = S().addTask({ name: 'tijdens de dialoog getypt' });
truthy('61 opzet: de taak is toegevoegd', !!S().tasks.find(t => t.id === bewerkt));
truthy('62 een taakmutatie tijdens de await wordt gezien', !sameIFCSource(voor, S()));
// Een puur UI-wijziging is GEEN inhoudswijziging — anders zou `isDirty` nooit meer gewist worden
// zodra de gebruiker tijdens de dialoog ook maar een paneel opent.
const naTaak = S();
S().setUI({ rightPanelCollapsed: !S().ui.rightPanelCollapsed });
truthy('63 een UI-wijziging telt niet als inhoudswijziging', sameIFCSource(naTaak, S()));

// ── 9. Relatie leggen meldt zich (issue #40) ────────────────────────────────
// De Relatie-knop legde bij 2 selecties wél een relatie aan, maar volstrekt geluidloos — en een
// geweigerd duplicaat was helemaal niet van "de knop doet niets" te onderscheiden. Alle drie de
// callsites (lint-knop, Relaties-paneel, slepen in de Gantt) lopen nu door deze ene wrapper.
clearAll();
S().newProject();
const rA = S().addTask({ name: 'Fundering' });
const rB = S().addTask({ name: 'Wanden' });
const rel1 = createRelationWithFeedback(rA, rB);
truthy('64 de relatie is aangemaakt', !!rel1 && S().sequences.some(q => q.id === rel1));
eq('65 en meldt zich', N().length, 1);
eq('66 met de aanmaak-sleutel', N()[0]?.messageKey, 'notifications.relationCreated');
eq('67 en de namen als parameters', N()[0]?.params, { predecessor: 'Fundering', successor: 'Wanden' });

// Exact hetzelfde nog eens: `addSequence` weigert het duplicaat stil — de wrapper doet dat niet.
const rel2 = createRelationWithFeedback(rA, rB);
eq('68 een duplicaat levert geen id op', rel2, null);
eq('69 en geen tweede relatie', S().sequences.length, 1);
eq('70 maar wél een melding', N().length, 2);
eq('71 met de duplicaat-sleutel', N()[1]?.messageKey, 'notifications.relationDuplicate');

// Herhalen vouwt samen (dedupeKey) i.p.v. de stapel vol te rammen.
createRelationWithFeedback(rA, rB);
eq('72 herhaald duplicaat vouwt samen', N().length, 2);
eq('73 en telt', N()[1]?.count, 2);

// Verzameltaak-eindpunt (eigenaarsbesluit 2026-08-15): dit is het OMGEKEERDE regressie-anker van
// vóór het besluit — toen weigerde `addSequence` dit stil (spec 2026-08-14). Sinds
// `expandSummaryRelations` zulke relaties naar bladtaken doorrekent (MS Project-semantiek), MOET
// dit gewoon slagen: de aanmaak-melding komt terug, geen weigering.
// Mutatiebewijs (uitgevoerd): met de oude `relationVerdict` (die `summary-endpoint` nog weigerde)
// gaf dit `rel3 === null` en `messageKey === 'notifications.relationSummaryEndpoint'` — precies het
// omgekeerde van wat hieronder gepind staat. Zie ook `check-relation-rules.ts` voor de bladmodule-kant.
clearAll();
S().newProject();
const rFase = S().addTask({ name: 'Fase' });
const rKind = S().addTask({ name: 'Kind', parentId: rFase });
const rLos = S().addTask({ name: 'Los' });
const rel3 = createRelationWithFeedback(rFase, rLos);
truthy('74 een verzameltaak-eindpunt levert nu WEL een id op (2026-08-15 eigenaarsbesluit)',
  !!rel3 && S().sequences.some(q => q.id === rel3));
eq('75 en meldt zich als gewone aanmaak, geen weigering', N().length, 1);
eq('76 met de aanmaak-sleutel', N()[0]?.messageKey, 'notifications.relationCreated');

// Alleen een relatie tussen een taak en zijn EIGEN (voor)ouder-samenvatting blijft geweigerd — dat
// zou `expandSummaryRelations` een directe cyclus laten genereren (A→B én B→A).
clearAll();
const rel4 = createRelationWithFeedback(rKind, rFase);
eq('77 een voorouder-relatie levert geen id op', rel4, null);
eq('78 en geen extra relatie erbij (nog steeds precies de ene van hierboven)', S().sequences.length, 1);
eq('79 maar wél een melding', N().length, 1);
eq('80 met de voorouder-sleutel', N()[0]?.messageKey, 'notifications.relationAncestorEndpoint');

// ── 10. Laadmelding voor relaties die de solver écht moet droppen (eigenaarsbesluit 2026-08-15) ──
// `applyLoadedProject` (fileSlice.ts) filtert een geladen bestand NIET op relaties die
// `expandSummaryRelations` niet naar bladtaken kan doorrekenen (dat zou logica uit het bronbestand
// vernietigen), maar meldt ze wél één keer. Een gewone verzameltaak-relatie hoort HIER niet meer in
// mee te tellen (die rekent gewoon door) — alleen een ECHTE drop (hier: de voorouder-guard) telt.
// Mutatiebewijs (uitgevoerd): met de oude `hasSummaryEndpoint`-scan telde `seq-summary-ok` hieronder
// óók mee (total: 2 i.p.v. 1) — precies het verschil dat dit blok bewaakt.
clearAll();
S().newProject();
const lFase = S().addTask({ name: 'Fase' });
const lKind = S().addTask({ name: 'Kind', parentId: lFase });
const lOther = S().addTask({ name: 'Los A' });
const lLos = S().addTask({ name: 'Los B' });
const lProject = S().project;
const lTasks = S().tasks;
clearAll();
// `loadState` is de in-place-load-route (geen open-pad) en loopt, net als de drie open-paden,
// door `applyLoadedProject` — de gedeelde implementatie die de melding pusht (fileSlice.ts).
// De melding mag niet op een later live `runCPM`-moment leunen: `loadState` bereidt de solve nu op
// de geïsoleerde payload voor en publiceert alles samen. De pure expansie blijft de bron voor deze
// importwaarschuwing.
S().loadState({
  project: lProject,
  calendar: createDefaultCalendar(),
  tasks: lTasks,
  sequences: [
    // Écht gedropt: Kind is de EIGEN bladafstammeling van zijn ouder Fase — de voorouder-guard.
    { id: 'seq-ancestor', predecessorId: lKind, successorId: lFase, type: 'FINISH_START', lagDays: 0 } as Sequence,
    // NIET gedropt: een gewone verzameltaak-relatie (Fase als voorganger) rekent door naar Kind.
    { id: 'seq-summary-ok', predecessorId: lFase, successorId: lLos, type: 'FINISH_START', lagDays: 0 } as Sequence,
    // NIET gedropt: een doodgewone blad-naar-blad relatie.
    { id: 'seq-normal', predecessorId: lOther, successorId: lLos, type: 'FINISH_START', lagDays: 0 } as Sequence,
  ],
  resources: [],
  assignments: [],
});
eq('81 loadState met precies één écht gedropte relatie meldt zich precies één keer', N().length, 1);
eq('82 als info (geen fout — het bestand blijft geldig)', N()[0]?.severity, 'info');
eq('83 met de drop-laadsleutel', N()[0]?.messageKey, 'notifications.summaryRelationsDropped');
eq('84 met het aantal ECHT gedropte relaties (niet de gewone verzameltaak-relatie)', N()[0]?.params, { total: 1 });

// Geen enkele écht gedropte relatie in het bestand ⇒ geen melding (geen ruis bij een gezond
// bestand) — óók niet als het bestand wél een (nu legale) verzameltaak-relatie bevat.
clearAll();
S().loadState({
  project: lProject,
  calendar: createDefaultCalendar(),
  tasks: lTasks,
  sequences: [
    { id: 'seq-summary-ok-2', predecessorId: lFase, successorId: lLos, type: 'FINISH_START', lagDays: 0 } as Sequence,
  ],
  resources: [],
  assignments: [],
});
eq('85 loadState zonder écht gedropte relaties meldt niets', N().length, 0);

// ── 11. T12/Z16: MS Project-bestand met een onderbroken, genivelleerde of resource-gedreven
// planning (§9/O1, herzien door Z16, etappe "nul afwijkingen") — melding bij openen. `applyLoadedProject`
// (fileSlice.ts, niet `loadState` — dat laatste heeft een eigen, smaller parametertype zonder
// `sourceScheduleNotes`) is de gedeelde implementatie die zowel de open-paden als `loadState` voedt;
// hier direct aangeroepen zodat het `ImportResult`-veld `sourceScheduleNotes` (alleen door `readMPP`
// gevuld, sinds Z16 met drie ECHTE tellingen — `leveled`/`split`/`timephased`, zie
// `mppReader.ts`'s `countScheduleNotes` — in plaats van de vroegere `spanGt`-proxy) rechtstreeks
// getest kan worden zonder een echt `.mpp`-bestand.
clearAll();
S().newProject();
const t12Project = S().project;
S().addTask({ name: 'Taak' });
const t12Tasks = S().tasks;
clearAll();
S().applyLoadedProject({
  project: t12Project,
  calendar: createDefaultCalendar(),
  tasks: t12Tasks,
  sequences: [],
  resources: [],
  assignments: [],
  sourceScheduleNotes: { total: 3, leveled: 1, split: 1, timephased: 1 },
}, {});
eq('86 sourceScheduleNotes.total > 0 meldt zich precies één keer', N().length, 1);
eq('87 als info (geen fout — het bestand blijft geldig)', N()[0]?.severity, 'info');
eq('88 met de mpp-detectie-sleutel', N()[0]?.messageKey, 'notifications.mppSourceScheduleNotes');
eq('89 met het VERENIGDE aantal (total, niet leveled/split/timephased los)', N()[0]?.params, { count: 3 });
eq('90 met de dedupe-sleutel mpp-split-leveled', N()[0]?.dedupeKey, 'mpp-split-leveled');

// Geen `sourceScheduleNotes` (ander bronformaat dan `.mpp`, of een schoon `.mpp`-bestand —
// `readMPP` laat het veld dan bewust weg, zie mppReader.ts) ⇒ geen melding.
clearAll();
S().applyLoadedProject({
  project: t12Project,
  calendar: createDefaultCalendar(),
  tasks: t12Tasks,
  sequences: [],
  resources: [],
  assignments: [],
}, {});
eq('91 zonder sourceScheduleNotes meldt niets', N().length, 0);

// ── 12. mpp-nul-data-etappe, DEEL 1: bewerkmelding op MSP-timephased-sturing-verlies ─────────────
// Wanneer een gebruikersbewerking daadwerkelijk `timephasedFinishFloor`/`timephasedStartAnchor`/
// `timephasedDurationWalks` wist (`clearTimephasedWindow`/`clearTimephasedDurationWalks` in
// `taskDefaults.ts`, gebruikt door `taskSlice.ts`/`resourceSlice.ts`/`mcpTransaction.ts`), hoort
// daar één keer per document per sessie een informatieve melding over te komen — nooit bij een F5,
// documentwissel, undo/redo, of een no-op-bewerking op een taak zonder sturing. Eigen document
// (`newDocument`) zodat deze cases niet worden beïnvloed door eerdere `dedupeKey`-registraties in
// dit bestand, en zodat de "eenmalig per document"-claim (`timephasedLossNotice.ts`) een schone lei
// heeft voor de docId die deze cases gebruiken.
clearAll();
S().newDocument();
const tphDocId = S().activeDocumentId;

const tphA = S().addTask({ name: 'MSP-taak A', time: createDefaultTaskTime('2026-08-03', 5) });
// Venster zetten via een NIET-trigger-update (spiegelt `check-task-slice.ts`'s `seedWindow`) —
// zet het venster zonder het meteen weer te laten wissen.
S().updateTask(tphA, {
  timephasedFinishFloor: '2026-08-10T17:00',
  timephasedStartAnchor: '2026-08-03T08:00',
  timephasedContours: [{ resourceUid: 42, periods: [{ afterMinutes: 0, minutes: 240, workMinutes: 240, kind: 'actual' }] }],
});
eq('92 opzet: taak draagt een venster vóór de bewerking', S().tasks.find(t => t.id === tphA)?.timephasedFinishFloor, '2026-08-10T17:00');

// De ECHTE bewerking: een duur-trigger (zie taskDefaults.ts's triggerset) — wist het venster.
const beforeTphA = S().tasks.find(t => t.id === tphA)!;
S().updateTask(tphA, { time: { ...beforeTphA.time, scheduleDuration: 7 } });
eq('93 na de bewerking: venster is gewist', S().tasks.find(t => t.id === tphA)?.timephasedFinishFloor, undefined);
eq('94 de melding verschijnt precies één keer', N().length, 1);
eq('95 als info (geen fout — het bestand is niet beschadigd)', N()[0]?.severity, 'info');
eq('96 met de mpp-timephased-sleutel', N()[0]?.messageKey, 'notifications.mppTimephasedSteeringLost');
eq('97 met count 1 (één taak verloor sturing)', N()[0]?.params, { count: 1 });
eq('98 met de per-document-dedupeKey', N()[0]?.dedupeKey, `mpp-timephased-lost-${tphDocId}`);
eq('99 met een link naar de MS Project-gids', N()[0]?.helpArticleId, MPP_TIMEPHASED_HELP_ARTICLE_ID);

// Tweede bewerking die OPNIEUW sturing loslaat (andere taak, zelfde document) ⇒ GEEN tweede
// melding — "eenmalig per document per sessie" is de eis, niet "eenmalig per burst".
clearAll();
const tphB = S().addTask({ name: 'MSP-taak B', time: createDefaultTaskTime('2026-08-03', 5) });
S().updateTask(tphB, {
  timephasedFinishFloor: '2026-08-11T17:00',
  timephasedStartAnchor: '2026-08-04T08:00',
});
const beforeTphB = S().tasks.find(t => t.id === tphB)!;
S().updateTask(tphB, { time: { ...beforeTphB.time, scheduleDuration: 9 } });
eq('100 opzet: ook taak B verloor zijn venster', S().tasks.find(t => t.id === tphB)?.timephasedFinishFloor, undefined);
eq('101 maar GEEN tweede melding deze sessie (al gemeld voor dit document)', N().length, 0);

// F5 (runCPM) meldt zichzelf niet — een gezonde herberekening raakt geen timephased-velden via
// updateTask/setTaskCalendar (de solver muteert de Immer-draft rechtstreeks, zie taskDefaults.ts's
// hoofddocblok "GEEN trigger"-paragraaf).
clearAll();
S().runCPM();
eq('102 F5/runCPM meldt geen timephased-verlies', N().length, 0);

// Documentwissel meldt zichzelf niet (geen updateTask/clearTimephasedWindow-aanroep).
clearAll();
const tphDocOther = S().newDocument();
S().switchDocument(tphDocId);
eq('103 documentwissel meldt geen timephased-verlies', N().length, 0);
void tphDocOther;

// Undo meldt zichzelf niet: het herstelt de vorige snapshot rechtstreeks (`restoreSnapshot`), zonder
// via updateTask/clearTimephasedWindow te lopen.
clearAll();
S().undo();
eq('104 undo meldt geen timephased-verlies', N().length, 0);
S().redo();
eq('105 redo meldt geen timephased-verlies', N().length, 0);

// No-op-bewerking (duur-trigger) op een taak die NOOIT timephased-sturing droeg ⇒ geen melding —
// `clearTimephasedWindow`/`clearTimephasedDurationWalks` geven dan `false` terug (niets gewist),
// en de aanroepers melden uitsluitend bij een ECHT verlies.
clearAll();
S().newDocument();
const tphNoop = S().addTask({ name: 'Geen MSP-herkomst', time: createDefaultTaskTime('2026-08-03', 5) });
const beforeNoop = S().tasks.find(t => t.id === tphNoop)!;
S().updateTask(tphNoop, { time: { ...beforeNoop.time, scheduleDuration: 3 } });
eq('106 no-op-bewerking (geen sturing aanwezig) meldt niets', N().length, 0);

// ── P1 (spec-review op 3fba671b, reviewer-probe): newProject()-lek in de meldings-gate ──────────
// `newProject()` hergebruikt het ACTIEVE docId (geen `newDocument()`-aanroep eronder) — zonder
// `clearTimephasedLossNoticeForDoc` (P1-fix, timephasedLossNotice.ts) zou een heel NIEUW project op
// datzelfde tabblad de "al gemeld"-registratie van het VORIGE project overerven en dus NOOIT meer
// melden, ook al verliest een taak in het NIEUWE project aantoonbaar sturing. `tphDocId` is al
// gemeld (case 94-99 hierboven) — precies de voorwaarde voor het lek dat de reviewer bewees.
clearAll();
S().switchDocument(tphDocId);
eq('107 opzet: terug op het al-gemelde document', S().activeDocumentId, tphDocId);
const tphDocBeforeReset = S().activeDocumentId;
S().newProject();
eq('108 opzet: newProject() blijft op HETZELFDE docId (de voorwaarde voor het lek)',
  S().activeDocumentId, tphDocBeforeReset);
const tphC = S().addTask({ name: 'MSP-taak C (na newProject)', time: createDefaultTaskTime('2026-08-03', 5) });
S().updateTask(tphC, {
  timephasedFinishFloor: '2026-08-12T17:00',
  timephasedStartAnchor: '2026-08-05T08:00',
});
const beforeTphC = S().tasks.find(t => t.id === tphC)!;
S().updateTask(tphC, { time: { ...beforeTphC.time, scheduleDuration: 4 } });
eq('109 na newProject() meldt een NIEUW sturingsverlies WÉÉR (P1-fix, was: stil dood)', N().length, 1);
eq('110 met de mpp-timephased-sleutel', N()[0]?.messageKey, 'notifications.mppTimephasedSteeringLost');

// ── 11. Een voorbereide gridmelding wordt pas na de atomaire datacommit getoond ───────────────
clearAll();
S().newProject();
const gridTask = S().addTask({ name: 'Grid voor' });
useAppStore.setState(state => { state.historyEvents = []; state.nextHistorySequence = 1; state.ui.notifications = []; });
const gridIntent: CellEditIntent = {
  kind: 'cell-edit', taskId: gridTask, columnId: 'task.name' as CellEditIntent['columnId'],
  route: 'task-field', value: 'Grid na',
};
const gridPrepared = prepareGridMutation(S(), [gridIntent]);
const gridStates: Array<{ name: string | undefined; history: number; notifications: number }> = [];
const unsubscribeGrid = useAppStore.subscribe(state => gridStates.push({
  name: state.tasks[0]?.name,
  history: state.historyEvents.length,
  notifications: state.ui.notifications.length,
}));
const gridWithNotification: PreparedGridMutation | null = gridPrepared.ok ? {
  ...gridPrepared.value,
  notifications: [{ severity: 'info', messageKey: 'notifications.relationCreated' }],
} : null;
const gridCommit = gridWithNotification ? commitPreparedGridMutation(gridWithNotification) : null;
unsubscribeGrid();
eq('111 voorbereide gridcommit met melding slaagt', gridCommit?.ok, true);
eq('112 eerste gridpublicatie bevat data en history zonder melding', gridStates[0], {
  name: 'Grid na', history: 1, notifications: 0,
});
eq('113 gridmelding volgt in een aparte publicatie', gridStates.map(state => state.notifications), [0, 1]);
eq('114 uitgestelde gridmelding gebruikt het normale app-globale kanaal', N()[0]?.messageKey, 'notifications.relationCreated');

// ── Uitkomst ────────────────────────────────────────────────────────────────
if (diffs.length) {
  console.log(`XX  notifications: ${diffs.length} van de ${checks} checks FOUT`);
  for (const d of diffs) console.log(`    - ${d}`);
  process.exit(1);
}
console.log(`OK  notifications: alle checks groen (${checks})`);

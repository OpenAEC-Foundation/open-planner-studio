import type { NotifyInput } from './slices/types';

/**
 * mpp-nul-data-etappe, DEEL 1 — de eenmalige K8a-melding wanneer een gebruikersbewerking aantoonbaar
 * de MSP-timephased-sturing van een taak loslaat (`clearTimephasedWindow`/
 * `clearTimephasedDurationWalks` in `taskDefaults.ts` gaven `true` terug op minstens één taak).
 *
 * SESSIE-ONLY "AL GEMELD"-REGISTRATIE PER DOCUMENT — de eigenaarseis is "eenmalig per document per
 * sessie". `notify`'s eigen `dedupeKey`-samenvouwing (uiSlice.ts) volstaat daar NIET voor: die vouwt
 * alleen samen zolang de eerdere melding nog in de actieve lijst staat, en een `info`-toast
 * verdwijnt na 5 s vanzelf (`NotificationHost.tsx`). Zonder aparte registratie zou een tweede
 * bewerking een halve minuut later gewoon een NIEUWE toast opleveren — precies wat de eis uitsluit.
 * Deze module is die aparte, voor de sessie PERMANENTE gate; `dedupeKey` blijft daarnaast nuttig
 * voor het samenvouwen BINNEN ÉÉN BURST (bv. meerdere taken die in één bewerking tegelijk sturing
 * verliezen — de aanroepers tellen dat zelf en geven één `count` mee, zie `notifyTimephasedLoss`).
 *
 * Module-state, geen store-veld: dit is sessie-UI-gedrag, geen projectdata (hoort dus niet in
 * `DOCUMENT_FIELDS`) — en overleeft bewust WEL een documentwissel-en-terug, wat een documentcontract-
 * veld (dat mee zou swappen naar de `DocumentPayload`) niet zou doen.
 */
const notifiedDocIds = new Set<string>();

/** `true` de EERSTE keer voor dit document-id deze sessie — en markeert 'm meteen als gebruikt.
 *  Elke volgende aanroep met hetzelfde document-id geeft `false`, ongeacht of de eerdere toast
 *  intussen is weggeklikt of vanzelf verlopen. */
export function claimTimephasedLossNotice(docId: string): boolean {
  if (notifiedDocIds.has(docId)) return false;
  notifiedDocIds.add(docId);
  return true;
}

/** Test-only: wist de registratie. Headless tests draaien allemaal in hetzelfde Node-proces
 *  (esbuild-bundel, zie tests/planning/run.sh) — zonder reset zou de eerste case die deze melding
 *  triggert 'm voor alle latere cases "al gemeld" maken. */
export function __resetTimephasedLossNoticeForTests(): void {
  notifiedDocIds.clear();
  notifiedLevelingDelayDocIds.clear();
}

/**
 * Wis de registratie voor ÉÉN document-id (P1-fix, spec-review op 3fba671b). `newProject()` en
 * `createNewProject()`'s pristine-hergebruikpad (`projectSlice.ts`) HERGEBRUIKEN het actieve docId
 * voor een compleet vers document via `hydratePayload(s, freshPayload())` — zonder deze reset zou
 * een tweede, geheel ander project op datzelfde tabblad de "al gemeld"-registratie van het VORIGE
 * project overerven en dus NOOIT meer melden, ook al verliest een taak in het NIEUWE project
 * aantoonbaar sturing. De reviewer bewees dit met een probe; het is niet UI-bereikbaar zonder de
 * wizard/"Nieuw project" te gebruiken, maar wél het patroon dat `tests/mcp/*.ts` breed gebruikt
 * tussen cases (`newProject()` als reset tussen tests op hetzelfde tabblad) — zonder deze fix zou
 * elke suite die de melding test na de EERSTE case stil dood liggen.
 *
 * BEWUST NIET aangeroepen vanuit `newDocument()`/`closeDocument()` (die geven sowieso een VERS
 * docId — er is dan niets te wissen) en NIET vanuit een echte bestandsopen-route (`openFile`/
 * `loadState`/`applyLoadedProject`, ook niet op het pristine-hergebruikpad daar): die dragen hun
 * EIGEN, mogelijk al gemelde MSP-herkomst mee (een `.mpp`-heropening op hetzelfde tabblad hoort de
 * sessie-gate niet kwijt te raken — "IFC-heropening mag NOOIT een melding geven" uit de opzet slaat
 * hier andersom door: het zou een STILLE melding kunnen SUPPRESSEN die er wél hoort te zijn als het
 * heropende bestand een ANDERE taak met verloren sturing bevat). Alleen de twee "leeg, vers begin"-
 * paden (`newProject`/`createNewProject`) horen bij deze reset, want alleen daar is de nieuwe inhoud
 * per definitie NIET van een `.mpp`-import afkomstig op het moment van de reset zelf.
 */
export function clearTimephasedLossNoticeForDoc(docId: string): void {
  notifiedDocIds.delete(docId);
  notifiedLevelingDelayDocIds.delete(docId);
}

/** Het artikel-id waar de melding + de paneelmarkering (DEEL 2) naar doorlinken (mpp-nul-data-
 *  etappe, "lees meer"-eigenaarseis) — sectie "Gecontoureerde toewijzingen" in de gids. */
export const MPP_TIMEPHASED_HELP_ARTICLE_ID = 'gids-msproject-import';

/**
 * Gedeelde notify-aanroep voor alle aanroepplekken (taskSlice.ts, resourceSlice.ts,
 * mcpTransaction.ts): claimt de eenmalige-per-document-gate en pusht de melding als de claim slaagt.
 * `count` is het aantal taken dat in DEZE bewerking/transactie aantoonbaar sturing verloor — `<= 0`
 * is een no-op (nooit aanroepen zonder een echt verlies).
 */
export function notifyTimephasedLoss(
  notify: (n: NotifyInput) => void,
  docId: string,
  count: number,
): void {
  if (count <= 0) return;
  if (!claimTimephasedLossNotice(docId)) return;
  notify({
    severity: 'info',
    messageKey: 'notifications.mppTimephasedSteeringLost',
    params: { count },
    dedupeKey: `mpp-timephased-lost-${docId}`,
    helpArticleId: MPP_TIMEPHASED_HELP_ARTICLE_ID,
  });
}

/**
 * B1c-plan-2 taak 1 (M10, eigenaarsbesluit 2026-08-31) — een EIGEN `Set`, apart van
 * `notifiedDocIds` hierboven: een document kan onafhankelijk zowel urensturing (DEEL 1/2) als
 * nivelleervertraging-precisie (M10) verliezen, dus de ene gate mag de andere niet onderdrukken.
 * Zelfde sessie-only, permanent-per-document contract als `notifiedDocIds`.
 */
const notifiedLevelingDelayDocIds = new Set<string>();

/** Zelfde contract als `claimTimephasedLossNotice` hierboven, maar voor de sub-dag-nivelleer-
 *  vertraging (M10, eigenaarsbesluit 2026-08-31) — apart geregistreerd, want de twee soorten
 *  MSP-precisieverlies zijn onafhankelijk van elkaar en horen elk hun eigen eenmalige melding te
 *  krijgen. */
export function claimLevelingDelayRoundedNotice(docId: string): boolean {
  if (notifiedLevelingDelayDocIds.has(docId)) return false;
  notifiedLevelingDelayDocIds.add(docId);
  return true;
}

/**
 * Gedeelde notify-aanroep voor `applyLeveling`/`clearLeveling` (`scheduleSlice.ts`,
 * `createMcpTransactions.ts`): claimt de eenmalige-per-document-gate en pusht de melding als de
 * claim slaagt. `count` is het aantal taken dat in DEZE bewerking aantoonbaar sub-dag-precisie
 * verloor (`levelingDelayMinutes`/`levelingDelayElapsed` gewist terwijl minstens één van beide
 * gezet was) — `<= 0` is een no-op (nooit aanroepen zonder een echt verlies).
 */
export function notifyLevelingDelayRounded(
  notify: (n: NotifyInput) => void,
  docId: string,
  count: number,
): void {
  if (count <= 0) return;
  if (!claimLevelingDelayRoundedNotice(docId)) return;
  notify({
    severity: 'info',
    messageKey: 'notifications.levelingDelayRoundedToWorkdays',
    params: { count },
    dedupeKey: `leveling-delay-rounded-${docId}`,
    helpArticleId: MPP_TIMEPHASED_HELP_ARTICLE_ID, // zelfde gids, sectie "Nivellering"
  });
}

import type { NotifyInput } from './slices/types';

/**
 * De eenmalige melding (via het meldingenkanaal) wanneer een gebruikersbewerking aantoonbaar
 * de MSP-timephased-sturing van een taak loslaat (`clearTimephasedWindow`/
 * `clearTimephasedDurationWalks` in `taskDefaults.ts` gaven `true` terug op minstens één taak).
 *
 * SESSIE-ONLY "AL GEMELD"-REGISTRATIE PER DOCUMENT — de eis is "eenmalig per document per
 * sessie". `notify`'s eigen `dedupeKey`-samenvouwing (uiSlice.ts) volstaat daar NIET voor: die vouwt
 * alleen samen zolang de eerdere melding nog in de actieve lijst staat, en een `info`-toast
 * verdwijnt na 5 s vanzelf (`NotificationHost.tsx`). Zonder aparte registratie zou een tweede
 * bewerking een halve minuut later gewoon een NIEUWE toast opleveren.
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
  return claimOnce(notifiedDocIds, docId);
}

/** De gedeelde gate achter beide `claim…Notice`-functies: `true` de eerste keer per document-id. */
function claimOnce(registry: Set<string>, docId: string): boolean {
  if (registry.has(docId)) return false;
  registry.add(docId);
  return true;
}

/** De gedeelde vorm van beide `notify…`-functies: niets bij `count <= 0` of een al gebruikte gate,
 *  anders één info-melding met een doorlink naar de gids. */
function notifyOncePerDocument(
  claim: (docId: string) => boolean,
  notify: (n: NotifyInput) => void,
  docId: string,
  count: number,
  messageKey: NotifyInput['messageKey'],
  dedupeKey: string,
): void {
  if (count <= 0) return;
  if (!claim(docId)) return;
  notify({ severity: 'info', messageKey, params: { count }, dedupeKey, helpArticleId: MPP_TIMEPHASED_HELP_ARTICLE_ID });
}

/** Test-only: wist de registratie. Headless tests draaien allemaal in hetzelfde Node-proces
 *  (esbuild-bundel, zie tests/planning/run.sh) — zonder reset zou de eerste case die deze melding
 *  triggert 'm voor alle latere cases "al gemeld" maken. */
export function __resetTimephasedLossNoticeForTests(): void {
  notifiedDocIds.clear();
  notifiedLevelingDelayDocIds.clear();
}

/**
 * Wis de registratie voor ÉÉN document-id. `newProject()` en `createNewProject()`'s
 * pristine-hergebruikpad (`projectSlice.ts`) HERGEBRUIKEN het actieve docId voor een compleet vers
 * document via `hydratePayload(s, freshPayload())` — zonder deze reset zou een ander project op
 * datzelfde tabblad de "al gemeld"-registratie van het VORIGE project overerven en nooit meer
 * melden. Dat geldt ook voor tests die `newProject()` als reset tussen cases gebruiken
 * (`tests/mcp/*.ts`).
 *
 * BEWUST NIET aangeroepen vanuit `newDocument()`/`closeDocument()` (die geven sowieso een VERS
 * docId) en NIET vanuit een bestandsopen-route (`openFile`/`loadState`/`applyLoadedProject`, ook
 * niet op het pristine-hergebruikpad daar): een heropening op hetzelfde tabblad hoort de
 * sessie-gate niet kwijt te raken. Alleen de twee "leeg, vers begin"-paden horen bij deze reset,
 * want alleen daar komt de nieuwe inhoud per definitie niet uit een `.mpp`-import.
 */
export function clearTimephasedLossNoticeForDoc(docId: string): void {
  notifiedDocIds.delete(docId);
  notifiedLevelingDelayDocIds.delete(docId);
}

/** Het artikel-id waar de melding en de paneelmarkering naar doorlinken ("lees meer") — sectie
 *  "Gecontoureerde toewijzingen" in de gids. */
export const MPP_TIMEPHASED_HELP_ARTICLE_ID = 'gids-msproject-import';

/**
 * Gedeelde notify-aanroep voor alle aanroepplekken (de slices, `calendarTasks.ts`,
 * `createMcpTransactions.ts`, `workRuleApply.ts`): claimt de eenmalige-per-document-gate en pusht
 * de melding als de claim slaagt. `count` is het aantal taken dat in DEZE bewerking/transactie
 * aantoonbaar sturing verloor — `<= 0` is een no-op (nooit aanroepen zonder een echt verlies).
 */
export function notifyTimephasedLoss(
  notify: (n: NotifyInput) => void,
  docId: string,
  count: number,
): void {
  notifyOncePerDocument(
    claimTimephasedLossNotice, notify, docId, count,
    'notifications.mppTimephasedSteeringLost', `mpp-timephased-lost-${docId}`,
  );
}

/**
 * Een EIGEN `Set`, apart van `notifiedDocIds` hierboven: een document kan onafhankelijk zowel
 * urensturing als sub-dag-precisie van de nivelleervertraging verliezen, dus de ene gate mag de
 * andere niet onderdrukken. Zelfde sessie-only, permanent-per-document contract als
 * `notifiedDocIds`.
 */
const notifiedLevelingDelayDocIds = new Set<string>();

/** Zelfde contract als `claimTimephasedLossNotice` hierboven, maar voor de sub-dag-nivelleer-
 *  vertraging — apart geregistreerd, want elk soort MSP-precisieverlies krijgt een eigen eenmalige
 *  melding. */
export function claimLevelingDelayRoundedNotice(docId: string): boolean {
  return claimOnce(notifiedLevelingDelayDocIds, docId);
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
  // Zelfde gids als de urensturing, sectie "Nivellering".
  notifyOncePerDocument(
    claimLevelingDelayRoundedNotice, notify, docId, count,
    'notifications.levelingDelayRoundedToWorkdays', `leveling-delay-rounded-${docId}`,
  );
}

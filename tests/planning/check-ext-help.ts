// Extensie-API 1.4.0 — `api.help.*`: permissie `help`, het artikel- en begeleidingsmodel, en de
// looptijd van het begeleidingspaneel.
//
// WAT HIER VASTLIGT.
//  - `help` is een bekende, HARD afgedwongen permissie: zonder haar gooit elke `help.*`-methode
//    vóórdat er iets gebeurt (niets in het Help-register, geen begeleiding, geen document).
//  - `registerArticles` is een dunne laag op het register (bron = extensie-id): ongeldige invoer
//    registreert niets en gooit met alle problemen; opnieuw registreren vervangt; `_cleanup` ruimt op.
//  - Afbeeldingen komen uit de eigen assets als blob-URL; bij het opruimen worden die ingetrokken.
//  - `openBundledProject` opent alleen een bestaande `.ifc`-asset, als NIEUW document naast het
//    actieve (dat blijft onaangeroerd).
//  - Een begeleiding wordt vóór het starten volledig gevalideerd; de looptijd roept `check` aan bij
//    het openen van een stap en na wijzigingen in de app, telt alleen `true`, negeert uitkomsten van
//    een verlaten stap, en vangt een gooiende `check` op (melding + terugval op "Klaar, volgende").
//
// Draait via run.sh. Exit 0 = alles groen.
import './domStub';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveObjectURL } from 'node:buffer';
import { createAppStoreContext, type AppStoreContext } from '@/state/appStore';
import { createExtensionApi, type ExtensionHostBinding } from '@/extensions/extensionApi';
import { API_PERMISSIONS, KNOWN_PERMISSIONS, sanitizeManifestPermissions } from '@/extensions/permissions';
import { parseExtensionManifest } from '@/extensions/validation';
import { EXTENSION_API_VERSION } from '@/extensions/apiVersion';
import { splitGuideBody, validateGuide } from '@/extensions/guideModel';
import {
  GUIDE_CHECK_DEBOUNCE_MS, getGuideView, guideNext, guideOpenProject, guidePrevious, guideReset, guideShowMe,
  stopGuideSession,
} from '@/extensions/guideRuntime';
import { getRegisteredHelpArticles, resetRegisteredHelpArticles } from '@/utils/helpArticleRegistry';
import type { ExtGuide, ExtHelpArticle, ExtensionApi, ExtensionPermission } from '@/extensions/types';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};
const throwsWith = (label: string, fn: () => unknown, pattern: RegExp) => {
  checks++;
  try {
    fn();
    diffs.push(`${label}: gooide niet`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!pattern.test(message)) diffs.push(`${label}: onverwachte fout "${message}"`);
  }
};
const rejectsWith = async (label: string, fn: () => Promise<unknown>, pattern: RegExp) => {
  checks++;
  try {
    await fn();
    diffs.push(`${label}: werd niet afgewezen`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!pattern.test(message)) diffs.push(`${label}: onverwachte fout "${message}"`);
  }
};
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

const bytes = (s: string) => new TextEncoder().encode(s);
const IFC = readFileSync(join(process.cwd(), 'public/examples/showcase-verbouwing-eengezinswoning.ifc'), 'utf8');
const ASSETS: Record<string, Uint8Array> = {
  'img/nl/stap.webp': bytes('RIFF-nl'),
  'img/en/stap.webp': bytes('RIFF-en'),
  'start.ifc': bytes(IFC),
  'notities.txt': bytes('geen project'),
};

function setup(id: string, permissions: ExtensionPermission[], assets: Record<string, Uint8Array> | undefined = ASSETS): {
  ctx: AppStoreContext; api: ExtensionApi;
} {
  const ctx = createAppStoreContext();
  const host: ExtensionHostBinding = { app: ctx, showNotification: () => {} };
  return { ctx, api: createExtensionApi(id, permissions, assets, ctx, host) };
}

const article = (id: string, order: number, extra = ''): ExtHelpArticle => ({
  id, kind: 'tutorial', order,
  title: { nl: `Titel ${id}`, en: `Title ${id}` },
  body: { nl: `# ${id}\n\n![Stap](img/{lang}/stap.webp)${extra}`, en: `# ${id}\n\nText.` },
});

const step = (id: string, extra: Partial<ExtGuide['steps'][number]> = {}): ExtGuide['steps'][number] => ({
  id, body: { nl: `Doe ${id}.\n\n---\n\nUitleg ${id}.`, en: `Do ${id}.\n\n---\n\nExplanation ${id}.` }, ...extra,
});

const guide = (steps: ExtGuide['steps']): ExtGuide => ({ id: 'tut-1', title: { nl: 'Eerste planning', en: 'First schedule' }, steps });

// ── 1. Contract en permissie ────────────────────────────────────────────────────
eq('1 contractversie 1.4.0', EXTENSION_API_VERSION, '1.4.0');
eq('2 help is een bekende permissie', KNOWN_PERMISSIONS.includes('help'), true);
eq('3 sanitize laat help staan', sanitizeManifestPermissions(['help', 'onzin'], 'x'), ['help']);
{
  const parsed = parseExtensionManifest({
    id: 'tutorials', name: 'Tutorials', version: '1.0.0', apiVersion: '1.4', minAppVersion: '0.0.0',
    author: 'OpenAEC', description: '', category: 'Other', main: 'main.js', permissions: ['help'],
  }, 'fresh');
  eq('4 een vers manifest met help is geldig', parsed.ok && parsed.value.permissions, ['help']);
}
const HELP_METHODS = ['registerArticles', 'unregisterArticles', 'openBundledProject', 'startGuide', 'stopGuide'];
for (const method of HELP_METHODS) {
  eq(`5 help.${method} staat hard op help`, API_PERMISSIONS[`help.${method}`], { perm: 'help', mode: 'throw' });
}
{
  resetRegisteredHelpArticles();
  const { ctx, api } = setup('zonder-help', ['ribbon', 'events']);
  const docsBefore = ctx.store.getState().documents.length;
  throwsWith('6a registerArticles zonder help gooit', () => api.help.registerArticles([article('tut-a', 1)]), /mist permissie: help/);
  throwsWith('6b unregisterArticles zonder help gooit', () => api.help.unregisterArticles(), /mist permissie: help/);
  throwsWith('6c openBundledProject zonder help gooit (synchroon)', () => api.help.openBundledProject('start.ifc'), /mist permissie: help/);
  throwsWith('6d startGuide zonder help gooit', () => api.help.startGuide(guide([step('a')])), /mist permissie: help/);
  throwsWith('6e stopGuide zonder help gooit', () => api.help.stopGuide(), /mist permissie: help/);
  eq('6f niets geregistreerd', getRegisteredHelpArticles().length, 0);
  eq('6g geen begeleiding gestart', getGuideView(), null);
  eq('6h geen document geopend', ctx.store.getState().documents.length, docsBefore);
}

// ── 2. Artikelen ────────────────────────────────────────────────────────────────
{
  resetRegisteredHelpArticles();
  const { api } = setup('tutorials', ['help']);
  throwsWith('7a ongeldig artikel gooit met de reden', () => api.help.registerArticles([
    { ...article('tut-a', 1), kind: 'howto' as 'tutorial' },
  ]), /alleen kind "tutorial"/);
  throwsWith('7b ontbrekende en-tekst gooit', () => api.help.registerArticles([
    { ...article('tut-a', 1), body: { nl: 'x', en: '' } },
  ]), /body\.en ontbreekt/);
  throwsWith('7c order 0 gooit', () => api.help.registerArticles([article('tut-a', 0)]), /order moet een positief geheel getal/);
  throwsWith('7d geen lijst gooit', () => api.help.registerArticles('x' as unknown as ExtHelpArticle[]), /verwacht een lijst/);
  eq('7e na fouten staat er niets in Help', getRegisteredHelpArticles().length, 0);

  const input = [article('tut-b', 2), article('tut-a', 1)];
  api.help.registerArticles(input);
  input[0].title.nl = 'GEMUTEERD';
  const reg = getRegisteredHelpArticles();
  eq('8a twee artikelen geregistreerd', reg.map(a => a.id).sort(), ['tut-a', 'tut-b']);
  eq('8b bron = extensie-id', [...new Set(reg.map(a => a.source))], ['tutorials']);
  eq('8c kopie: later muteren verandert Help niet', reg.find(a => a.id === 'tut-b')?.title.nl, 'Titel tut-b');

  const resolve = reg[0].resolveImage!;
  const urlNl = resolve('img/nl/stap.webp');
  eq('9a afbeelding uit de eigen assets wordt een blob-URL', urlNl.startsWith('blob:'), true);
  eq('9b dezelfde asset ⇒ dezelfde URL (geen lek per render)', resolve('img/nl/stap.webp'), urlNl);
  eq('9c ontbrekende asset ⇒ lege URL (viewer toont placeholder)', resolve('img/nl/bestaat-niet.webp'), '');
  eq('9d blob bevat de asset-bytes', resolveObjectURL(urlNl)?.size, ASSETS['img/nl/stap.webp'].byteLength);
  eq('9e blob heeft het afbeeldingstype', resolveObjectURL(urlNl)?.type, 'image/webp');
  eq('9f het register kent een project-opener', typeof reg[0].openProject, 'function');

  api.help.registerArticles([article('tut-c', 1)]);
  eq('10 opnieuw registreren vervangt de set', getRegisteredHelpArticles().map(a => a.id), ['tut-c']);

  const other = setup('andere-bron', ['help']).api;
  throwsWith('11 id van een andere bron wordt geweigerd', () => other.help.registerArticles([article('tut-c', 1)]), /al geregistreerd door een andere bron/);

  api.help.unregisterArticles();
  eq('12 unregisterArticles haalt ze weg', getRegisteredHelpArticles().length, 0);

  api.help.registerArticles([article('tut-d', 1)]);
  const urlBefore = getRegisteredHelpArticles()[0].resolveImage!('img/en/stap.webp');
  api._cleanup();
  eq('13a _cleanup (uitschakelen/verwijderen) haalt de artikelen weg', getRegisteredHelpArticles().length, 0);
  eq('13b _cleanup trekt de blob-URL\'s in', resolveObjectURL(urlBefore), undefined);
}

// ── 3. Meegeleverd project openen ─────────────────────────────────────────────────
{
  const { ctx, api } = setup('tutorials-open', ['help']);
  const S = ctx.store.getState;
  S().addTask({ name: 'Mijn eigen werk' });
  const originalId = S().activeDocumentId;
  const docsBefore = S().documents.length;
  await rejectsWith('14a onbekende asset wordt afgewezen', () => api.help.openBundledProject('weg.ifc'), /bestaat niet/);
  await rejectsWith('14b geen .ifc wordt afgewezen', () => api.help.openBundledProject('notities.txt'), /verwacht de naam van een \.ifc-asset/);
  eq('14c na weigeringen geen nieuw document', S().documents.length, docsBefore);
  await api.help.openBundledProject('start.ifc');
  eq('15a een nieuw document erbij', S().documents.length, docsBefore + 1);
  eq('15b het nieuwe document is actief', S().activeDocumentId !== originalId, true);
  eq('15c het project is geladen', S().tasks.length > 0, true);
  eq('15d geen opslagdoel (zoals een voorbeeld)', S().filePath, null);
  S().switchDocument(originalId);
  eq('15e het oorspronkelijke document is onaangeroerd', S().tasks.map(t => t.name), ['Mijn eigen werk']);
}

// ── 4. Het begeleidingsmodel ───────────────────────────────────────────────────────
{
  const has = (name: string) => name === 'start.ifc';
  eq('16 een geldige begeleiding', validateGuide(guide([step('a', { anchor: 'ribbon:start:addTask', resetAsset: 'start.ifc', check: () => true, prepare: () => {} })]), has), []);
  const errs = (g: unknown) => validateGuide(g, has).join(' | ');
  const bad: Array<[string, unknown, RegExp]> = [
    ['17a geen object', null, /moet een object zijn/],
    ['17b ongeldig id', { ...guide([step('a')]), id: 'Tut 1' }, /ongeldig id/],
    ['17c titel zonder en', { ...guide([step('a')]), title: { nl: 'x' } }, /title\.nl en title\.en/],
    ['17d geen stappen', guide([]), /niet-lege lijst/],
    ['17e dubbel stap-id', guide([step('a'), step('a')]), /dubbel id/],
    ['17f lege body', guide([{ id: 'a', body: { nl: '', en: 'x' } }]), /body\.nl en body\.en/],
    ['17g twee scheidingen', guide([{ id: 'a', body: { nl: 'a\n---\nb\n---\nc', en: 'x' } }]), /meer dan één scheidingsregel/],
    ['17h alleen uitleg, geen opdracht', guide([{ id: 'a', body: { nl: '---\nuitleg', en: 'x' } }]), /geen opdracht/],
    ['17i anker met aanhalingsteken', guide([step('a', { anchor: 'x"]' })]), /anchor moet een ankernaam/],
    ['17j check is geen functie', guide([step('a', { check: true as unknown as () => boolean })]), /check moet een functie/],
    ['17k prepare is geen functie', guide([step('a', { prepare: 'x' as unknown as () => void })]), /prepare moet een functie/],
    ['17l resetAsset geen .ifc', guide([step('a', { resetAsset: 'notities.txt' })]), /\.ifc-asset/],
    ['17m resetAsset bestaat niet', guide([step('a', { resetAsset: 'weg.ifc' })]), /zit niet in de assets/],
  ];
  for (const [label, g, pattern] of bad) {
    checks++;
    const got = errs(g);
    if (!pattern.test(got)) diffs.push(`${label}: fouten "${got}" matchen ${pattern} niet`);
  }
  eq('18a splitsen: opdracht', splitGuideBody('Doe dit.\n\n---\n\nWaarom.').task, 'Doe dit.\n');
  eq('18b splitsen: uitleg', splitGuideBody('Doe dit.\n\n---\n\nWaarom.').explanation, '\nWaarom.');
  eq('18c zonder scheiding geen uitleg', splitGuideBody('Alleen dit.'), { task: 'Alleen dit.', explanation: '' });
}

// ── 5. De looptijd ──────────────────────────────────────────────────────────────────
{
  const { ctx, api } = setup('tutorials-guide', ['help']);
  const S = ctx.store.getState;
  throwsWith('19a ongeldige begeleiding gooit met alle redenen', () => api.help.startGuide(guide([step('a', { resetAsset: 'weg.ifc' })])), /ongeldige begeleiding — .*zit niet in de assets/);
  eq('19b en start niets', getGuideView(), null);

  let checkCalls = 0;
  let prepared = 0;
  const g = guide([
    step('taak-toevoegen', {
      anchor: 'ribbon:start:addTask',
      check: (a) => { checkCalls++; return a.data.getTasks().length > 0; },
      prepare: (a) => { prepared++; a.data.addTask({ name: 'Door Toon mij' }); },
      resetAsset: 'start.ifc',
    }),
    step('lezen'),
    step('kapot', { check: () => { throw new Error('boem'); } }),
  ]);
  api.help.startGuide(g);
  g.steps[0].id = 'gemuteerd';
  let view = getGuideView();
  eq('20a begeleiding loopt', view?.guideId, 'tut-1');
  eq('20b stap 1 van 3', [view?.stepIndex, view?.stepCount], [0, 3]);
  eq('20c kopie: later muteren verandert de lopende begeleiding niet', view?.step.id, 'taak-toevoegen');
  eq('20d stap-vlaggen', [view?.step.hasCheck, view?.step.hasPrepare, view?.step.hasReset, view?.step.anchor], [true, true, true, 'ribbon:start:addTask']);
  await flush();
  eq('20e check draait direct bij het openen van de stap', checkCalls, 1);
  eq('20f nog niet gedaan (leeg project)', getGuideView()?.done, false);

  // Wijzigingen die de controle niet halen: niet gedaan.
  S().setUI({ activeRibbonTab: 'planning' });
  await sleep(GUIDE_CHECK_DEBOUNCE_MS + 30);
  eq('21a na een wijziging opnieuw gecontroleerd', checkCalls, 2);
  eq('21b nog steeds niet gedaan', getGuideView()?.done, false);

  // Een reeks wijzigingen binnen het venster ⇒ één controle.
  S().setUI({ activeRibbonTab: 'start' });
  S().addTask({ name: 'Echte taak' });
  S().setUI({ activeRibbonTab: 'beeld' });
  await sleep(GUIDE_CHECK_DEBOUNCE_MS + 30);
  eq('22a gebundeld: één controle voor drie wijzigingen', checkCalls, 3);
  eq('22b nu gedaan', getGuideView()?.done, true);

  // Gedaan blijft gedaan: geen nieuwe controles meer in deze stap.
  S().setUI({ activeRibbonTab: 'start' });
  await sleep(GUIDE_CHECK_DEBOUNCE_MS + 30);
  eq('23 gedaan ⇒ geen verdere controles', checkCalls, 3);

  // Opnieuw: nieuw document met de beginstand, stap weer open.
  const docs = S().documents.length;
  await guideReset();
  await flush();
  eq('24a Opnieuw opent de beginstand als nieuw document', S().documents.length, docs + 1);
  eq('24b de stap begint opnieuw en wordt meteen gecontroleerd', checkCalls, 4);
  eq('24c het voorbeeldproject heeft taken ⇒ gedaan', getGuideView()?.done, true);

  // Toon mij in een leeg document.
  S().newDocument();
  guidePrevious(); // op stap 1 is Terug een no-op
  eq('25a Terug op de eerste stap doet niets', getGuideView()?.stepIndex, 0);
  guideNext();
  guidePrevious();
  await flush();
  eq('25b terug naar stap 1: niet gedaan in het lege document', getGuideView()?.done, false);
  await guideShowMe();
  await flush();
  eq('25c Toon mij roept prepare aan', prepared, 1);
  eq('25d en controleert daarna: gedaan', getGuideView()?.done, true);

  // Stap zonder check: meteen door (het paneel toont "Klaar, volgende").
  guideNext();
  view = getGuideView();
  eq('26a stap 2 zonder check', [view?.stepIndex, view?.step.hasCheck, view?.done], [1, false, false]);

  // Een gooiende check: melding via het meldingenkanaal, stap valt terug op "Klaar, volgende".
  const before = S().ui.notifications.length;
  guideNext();
  await flush();
  view = getGuideView();
  eq('27a gooiende check ⇒ checkFailed', view?.checkFailed, true);
  const note = S().ui.notifications.at(-1);
  eq('27b gemeld via het meldingenkanaal', [S().ui.notifications.length, note?.messageKey, note?.severity], [before + 1, 'notifications.extGuideCallbackFailed', 'error']);
  eq('27c met stap en reden als detail', note?.detail, 'kapot: boem');
  S().setUI({ activeRibbonTab: 'planning' });
  await sleep(GUIDE_CHECK_DEBOUNCE_MS + 30);
  eq('27d daarna niet eindeloos opnieuw', S().ui.notifications.length, before + 1);

  // Laatste stap: Volgende = Klaar ⇒ sluiten.
  guideNext();
  eq('28 Klaar op de laatste stap sluit de begeleiding', getGuideView(), null);
}

// ── 6. Oude uitkomsten, eigenaarschap en opruimen ─────────────────────────────────────
{
  const { api } = setup('tutorials-async', ['help']);
  let release: (v: boolean) => void = () => {};
  api.help.startGuide(guide([
    step('traag', { check: () => new Promise<boolean>(resolve => { release = resolve; }) }),
    step('tweede'),
  ]));
  guideNext(); // verlaat de stap vóórdat de trage controle antwoordt
  release(true);
  await flush();
  eq('29 een uitkomst van een verlaten stap telt niet', [getGuideView()?.stepIndex, getGuideView()?.done], [1, false]);

  const other = setup('iemand-anders', ['help']).api;
  other.help.stopGuide();
  eq('30a een andere extensie kan deze begeleiding niet sluiten', getGuideView()?.extensionId, 'tutorials-async');
  other._cleanup();
  eq('30b ook niet door haar eigen opruiming', getGuideView() !== null, true);

  api.help.stopGuide();
  eq('31a stopGuide sluit de eigen begeleiding', getGuideView(), null);

  api.help.startGuide(guide([step('a', { check: () => false })]));
  const { api: second } = setup('tweede-bron', ['help']);
  throwsWith('31b een andere extensie kan een lopende begeleiding niet vervangen',
    () => second.help.startGuide({ ...guide([step('b')]), id: 'tut-2' }), /er loopt al een begeleiding van extensie "tutorials-async"/);
  eq('31c de lopende begeleiding blijft staan', [getGuideView()?.extensionId, getGuideView()?.guideId], ['tutorials-async', 'tut-1']);
  api.help.startGuide({ ...guide([step('c')]), id: 'tut-eigen' });
  eq('31d de eigenaar mag zijn begeleiding wel vervangen', getGuideView()?.guideId, 'tut-eigen');
  stopGuideSession(); // de gebruiker klikt Sluiten
  second.help.startGuide({ ...guide([step('b')]), id: 'tut-2' });
  eq('31e na Sluiten kan de andere extensie starten', getGuideView()?.guideId, 'tut-2');
  second._cleanup();
  eq('31f _cleanup (uitschakelen/verwijderen) stopt de eigen begeleiding', getGuideView(), null);
  stopGuideSession();
}

// ── 7. Late uitkomsten van dezelfde stap (Opnieuw, Terug→Volgende) en busy ─────────────────
{
  const { api } = setup('tutorials-epoch', ['help']);
  const releases: Array<(v: boolean) => void> = [];
  api.help.startGuide(guide([
    step('eerste'),
    step('traag', {
      check: () => new Promise<boolean>(resolve => { releases.push(resolve); }),
      resetAsset: 'start.ifc',
    }),
  ]));
  guideNext();
  eq('32a stap 2 controleert (traag)', releases.length, 1);
  guidePrevious();
  guideNext(); // zelfde index, nieuwe stapsessie ⇒ nieuwe controle
  eq('32b opnieuw binnen: nieuwe controle', releases.length, 2);
  releases[0](true); // uitkomst van de VORIGE sessie van deze stap
  await flush();
  eq('32c een late uitkomst van een eerdere sessie van dezelfde stap telt niet', getGuideView()?.done, false);
  await guideReset();
  await flush();
  releases[1](true); // uitkomst van vóór Opnieuw
  await flush();
  eq('32d ook niet na Opnieuw', getGuideView()?.done, false);
  releases[releases.length - 1](true);
  await flush();
  eq('32e de uitkomst van de huidige sessie telt wel', getGuideView()?.done, true);
  stopGuideSession();

  // Toon mij loopt ⇒ Terug/Volgende/nog een Toon mij doen niets (geen tweede prepare).
  let finishPrepare: () => void = () => {};
  let prepares = 0;
  api.help.startGuide(guide([
    step('a'),
    step('b', { prepare: () => { prepares++; return new Promise<void>(resolve => { finishPrepare = resolve; }); } }),
  ]));
  guideNext();
  const running = guideShowMe();
  eq('33a busy tijdens Toon mij', getGuideView()?.busy, true);
  guidePrevious();
  guideNext();
  void guideShowMe();
  eq('33b Terug/Volgende/Toon mij doen niets zolang Toon mij loopt', [getGuideView()?.stepIndex, prepares], [1, 1]);
  finishPrepare();
  await running;
  eq('33c daarna weer vrij', getGuideView()?.busy, false);
  stopGuideSession();
}

// ── 8. Na uitschakelen is de help-groep dood; project://-links ──────────────────────────
{
  resetRegisteredHelpArticles();
  const { ctx, api } = setup('tutorials-dispose', ['help']);
  api.help.registerArticles([article('tut-x', 1)]);
  const reg = getRegisteredHelpArticles()[0];
  const S = ctx.store.getState;

  // Een project://-link in een artikel: eigen melding bij een fout (geen begeleidingstekst).
  const before = S().ui.notifications.length;
  reg.openProject!('weg.ifc');
  await flush();
  const note = S().ui.notifications.at(-1);
  eq('34a mislukte project://-link ⇒ eigen melding', [S().ui.notifications.length, note?.messageKey, note?.params], [
    before + 1, 'notifications.extHelpProjectOpenFailed', { name: 'tutorials-dispose', file: 'weg.ifc' },
  ]);
  // Dubbelklik op de link: één document.
  const docs = S().documents.length;
  S().addTask({ name: 'eigen werk' });
  reg.openProject!('start.ifc');
  reg.openProject!('start.ifc');
  await sleep(50);
  await flush();
  eq('34b dubbelklik op een project://-link opent één document', S().documents.length, docs + 1);

  // Een project://-link in een begeleidingsstap: zelfde bescherming.
  api.help.startGuide(guide([step('a')]));
  S().addTask({ name: 'nog meer eigen werk' });
  const docs2 = S().documents.length;
  const first = guideOpenProject('start.ifc');
  void guideOpenProject('start.ifc');
  await first;
  eq('34c dubbelklik in het paneel opent één document', S().documents.length, docs2 + 1);

  const img = reg.resolveImage!('img/nl/stap.webp');
  api._cleanup();
  eq('35a opruimen stopt de begeleiding', getGuideView(), null);
  throwsWith('35b registerArticles na uitschakelen gooit', () => api.help.registerArticles([article('tut-y', 1)]), /na uitschakelen/);
  throwsWith('35c startGuide na uitschakelen gooit', () => api.help.startGuide(guide([step('a')])), /na uitschakelen/);
  throwsWith('35d stopGuide na uitschakelen gooit', () => api.help.stopGuide(), /na uitschakelen/);
  throwsWith('35e unregisterArticles na uitschakelen gooit', () => api.help.unregisterArticles(), /na uitschakelen/);
  await rejectsWith('35f openBundledProject na uitschakelen wordt afgewezen', () => api.help.openBundledProject('start.ifc'), /na uitschakelen/);
  eq('35g niets achtergebleven in Help of het paneel', [getRegisteredHelpArticles().length, getGuideView()], [0, null]);
  eq('35h de afbeeldingsresolver geeft niets meer', reg.resolveImage!('img/nl/stap.webp'), '');
  eq('35i de eerder uitgegeven blob-URL is ingetrokken', resolveObjectURL(img), undefined);
}

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK: extensie-help (1.4.0) — ${checks} checks groen`);
} else {
  console.log(`XX extensie-help (1.4.0) — ${diffs.length} van ${checks} checks rood:`);
  for (const d of diffs) console.log(`   XX ${d}`);
  process.exit(1);
}

// B1c-plan3 taak 8 — de verdeeldialoog (spec §7 "plek in de UI", §3.4 "discrete rekenmomenten").
//
// LOSSE DIALOOG, GEEN DRILL-DOWN (besluit eigenaar 2026-08-31). Het patroon is letterlijk dat van
// `LevelingDialog`: een `ui.show*`-vlag, gemount vanuit `App.tsx`, de gedeelde `Dialog` (focus-trap,
// Escape, backdrop) en opgenomen in `hasBlockingDialogOpen()`. Het bezettingsoverzicht blijft
// gewoon zichtbaar ONDER de dialoog — de verdeling is een handeling óp dat overzicht, geen
// vervanging ervan.
//
// TWEE STANDEN (bedieningsreparatie 2026-09-11). Zonder gekozen poolitem (`ui.levelingDistribution
// === null`) is dit een KIEZER: de lijst met bibliotheekitems die nú een conflict hebben over de
// geopende documenten (`DistributionPicker`), plus alleen een sluitknop. Pas met een gekozen item
// verschijnen het voorstel en de knoppenbalk. De weg terug is "Ander item kiezen…" onderin, die de
// tune-state op `null` zet — inclusief het `applied`-record, want dat hoort bij dít item.
//
// TOEPASSEN EN DE TERUGWEG (taak 12, spec §5). De knop is nooit "gewoon uit": hij is
// UITGESCHAKELD MET REDEN, in `applyGate` hieronder — een knop die er niet is (of er grijs staat
// zonder uitleg) laat de gebruiker raden. Na een geslaagd Toepassen woont de terugweg HIER, in een
// permanente strook met "Alles terugdraaien", en niet in het meldingenkanaal: dat kent geen
// actieknoppen en ruimt een `info` na 5 s op. De melding die er daarnaast uit gaat is puur
// informatief.
//
// DE RANGORDELIJST IS WEG (eigenaarsbesluit 2026-09-12, spec §2.1). Hij trok in de gebruikstest alle
// aandacht weg van de balken, terwijl de balk zelf de bediening hoort te zijn. De rijvolgorde is
// sindsdien puur de plaatsingsvolgorde van de rekenaar — de spelingsvolgorde die
// `freshDistributionUi` bij het openen in `tune.order` zet — en sturen doe je uitsluitend met de
// handle en de pin. `order` blijft in de tune-state bestaan zodat de kern en het schrijfpad
// ONGEWIJZIGD blijven; er is alleen geen bediening meer die hem verandert. Een tweede
// afleidingsmoment (order herberekenen en terugschrijven) zou via `diffReason('rank')` een
// oneindige herberekening geven — zie het plan bij taak 3.
//
// DE HOOGTE LIGT VAST (B1c-plan4 taak 4, spec §7). Geen enkele REKENtoestand — bezig, stale,
// gedegradeerd, tekort — mag de dialoog van maat laten veranderen; anders verspringt de balk onder
// de muis precies tijdens het slepen. Daarom: de validatiestrook is ALTIJD gerenderd met een vaste
// hoogte (leeg = onzichtbare tekst, geen weggehaald blok), de degradatiemelding heeft een
// gereserveerde regel, het prijsvak een vaste breedte, en de dialoog hangt via `alignTop` aan de
// BOVENkant — bij verticaal centreren zou elke hoogtewijziging het hele paneel verschuiven.
//
// ÉÉN HORIZONTALE SCROLL-CONTAINER (spec §3.4). Balken, legenda, einddatum-badges en het histogram
// staan samen in één `overflow-x-auto`. Had elk zijn eigen scroller — zoals vóór deze taak — dan
// stonden de kolommen scheef zodra je er één van verschoof. De badgerij en het histogram krijgen
// links `STRIP.labelWidth + STRIP.gap` en rechts `STRIP.endWidth + STRIP.gap` marge, zodat hun
// plotgebied exact samenvalt met de tracks; de `AXIS.padLeft` van 34 px zit ín de as en geldt dus
// voor beide.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useAppStore } from '@/state/appStore';
import { Switch } from '@/components/common/Switch';
import { Dialog } from '@/components/common/Dialog';
import { DISTRIBUTION_BLOCK_KEY } from '@/utils/levelingReasonKey';
import { planDistributionWrites } from '@/services/library/applyDistribution';
import { scopeTaskIdsFor } from '@/services/library/distribute';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { buildOccupancyAxis, expandDays } from '@/components/panels/occupancyAxis';
import { parseDate, formatDate, addCalendarDays } from '@/utils/dateUtils';
import { documentFloatOn, useDistributionProposal } from './useDistributionProposal';
import { assignDocColors } from './chartGeometry';
import { STRIP } from './stripGeometry';
import { PhaseStrip } from './PhaseStrip';
import { DistributionPicker } from './DistributionPicker';
import { BeforeAfterChart } from './BeforeAfterChart';

/** De inhoudsbreedte van het dialoogpaneel: `w-[960px]` min de `p-4`-padding aan weerszijden.
 *  Alleen de terugval vóór de eerste ResizeObserver-meting; daarna telt de gemeten breedte. */
const DIALOG_CONTENT_WIDTH = 960 - 32;

/** Het plafond op de dagbreedte IN DE DIALOOG. Het bezettingshistogram houdt zijn eigen, smallere
 *  plafond (`AXIS.maxDayWidth` = 16) omdat het een heel project moet tonen; hier gaat het vaak om
 *  een handvol dagen die je moet kunnen aanwijzen en tellen. Boven ~28 px worden het luiken. */
const DIALOG_MAX_DAY_WIDTH = 28;

export function DistributionDialog() {
  const { t, i18n } = useTranslation('common');
  const tune = useAppStore(s => s.ui.levelingDistribution);
  const pools = useAppStore(s => s.pools);
  const setUI = useAppStore(s => s.setUI);
  const notify = useAppStore(s => s.notify);
  const applyDistribution = useAppStore(s => s.applyDistribution);
  const undoDistribution = useAppStore(s => s.undoDistribution);

  const {
    proposal, busy, labelsBusy, staleReason, lastStaleReason, staleDocs, degraded, recompute, inputs,
    savings,
  } = useDistributionProposal(tune);

  const close = () => setUI({ showDistributionDialog: false });

  // --- DE BREEDTE VAN DE TRACK (polishronde 2026-09-14, bevinding 2) ------------------------------
  //
  // De as werd met een vaste `targetWidth: 560` gebouwd terwijl de dialoog 960 px breed is, en dat
  // getal deed er bovendien niets toe: met een handvol dagen liep de dagbreedte tegen zijn plafond
  // van 16 px aan en was de hele track 74 px — twee blokjes tegen de linkerrand met driekwart
  // dialoog leeg ernaast. De track hoort de volle ruimte TUSSEN het label en het uitkomstlabel te
  // beslaan; we meten die ruimte dus echt, in plaats van 960 aan te nemen (de dialoog is
  // `max-w-[95vw]` en wordt op een smal scherm smaller).
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const hasTune = tune !== null;
  const [scrollerWidth, setScrollerWidth] = useState(0);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setScrollerWidth(el.clientWidth));
    observer.observe(el);
    setScrollerWidth(el.clientWidth);
    return () => observer.disconnect();
  }, [hasTune]);
  /** De ruimte die er voor de track zelf overblijft; vóór de eerste meting de 960-px-rekensom. */
  const trackSpace = Math.max(
    240,
    (scrollerWidth > 0 ? scrollerWidth : DIALOG_CONTENT_WIDTH) - STRIP.labelWidth - STRIP.endWidth - 2 * STRIP.gap,
  );

  // DE DAGBREEDTE LIGT VAST ZOLANG DE DIALOOG OPEN STAAT (bevinding 3). De dagenset groeit mee met
  // het plafond, dus een as die zich elke herberekening opnieuw op de beschikbare breedte fit
  // kreeg bij élke commit een andere dagbreedte: de tijdas kromp onder de muis tijdens het slepen
  // en de x van de ándere rij sprong mee. Nu bepaalt de eerste as van een dialoogsessie de
  // dagbreedte en houden alle volgende die vast; groeit de dagenset, dan wordt de as breder naar
  // RECHTS, in de horizontale scroll-container die er toch al omheen zit.
  const dayWidthRef = useRef<{ key: string; dayWidth: number } | null>(null);
  const sessionKey = tune ? `${tune.companyId}/${tune.libraryItemId}` : '';
  if (dayWidthRef.current !== null && dayWidthRef.current.key !== sessionKey) dayWidthRef.current = null;

  const poolItem = tune ? pools[tune.companyId]?.resources.find(r => r.id === tune.libraryItemId) : undefined;
  const itemName = poolItem?.name || tune?.libraryItemId || '';

  // B1c-plan4 taak 2 — ÉÉN datumnotatie voor alle balken (de plafonddatum in het uitkomstlabel en
  // de einddatum-badges): per rij een eigen `Intl.DateTimeFormat` bouwen is duur en zou per rij
  // anders kunnen uitpakken.
  const dayFmt = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short' }),
    [i18n.language],
  );
  const formatDay = useCallback((iso: string) => dayFmt.format(parseDate(iso)), [dayFmt]);

  // B1c-plan4 taak 2 — de WERKDAGVRAAG per document, uit de PROJECTkalender van dat document
  // (`CalendarEngine.isWorkDay`): dezelfde eenheid als `endShiftWorkdays` in `distribute.ts`, dus
  // een balk arceert alleen dagen die voor de verdeler ook echt werkdagen zijn. KANTTEKENING (taak
  // 1): een individuele taak kan een afwijkende taakkalender hebben — de balk leest die bewust niet,
  // want hij toont de fase van een PROJECT, niet van één taak. Eén `CalendarEngine` per document,
  // gememoïseerd en met een eigen dagcache: die constructor materialiseert feestdagen en
  // uitzonderingen, en de balken vragen per kalenderdag opnieuw — bij elke sleepstap.
  const isWorkingDayByDoc = useMemo(() => {
    const byDoc = new Map<string, (iso: string) => boolean>();
    for (const doc of inputs) {
      const engine = new CalendarEngine(doc.calendar);
      const cache = new Map<string, boolean>();
      byDoc.set(doc.docId, (iso: string) => {
        const hit = cache.get(iso);
        if (hit !== undefined) return hit;
        const value = engine.isWorkDay(parseDate(iso));
        cache.set(iso, value);
        return value;
      });
    }
    return byDoc;
  }, [inputs]);

  /** Terugval voor een document dat de laatste run niet gezien heeft: ma t/m vr. */
  const isWorkingDayFallback = useCallback(
    (iso: string) => { const day = parseDate(iso).getDay(); return day >= 1 && day <= 5; },
    [],
  );

  // B1c-plan4 taak 2 — de vaste last ZOALS ÉÉN BALK HEM ZIET. Een gepind document zit ZELF in de
  // vaste last (dat is wat pinnen betekent); zonder deze aftrek zou zijn eigen boeking twee keer in
  // dezelfde rij staan — één keer als achtergrondband, één keer als dagblokje. De oude `PhaseStrip`
  // deed die aftrek binnenin; nu de component alleen nog tekent, hoort hij hier.
  const fixedLoadFor = useCallback((docId: string, pinned: boolean): Record<string, number> => {
    const fixed = proposal?.fixedLoadByDay ?? {};
    if (!pinned) return fixed;
    const own = proposal?.bookingByDay[docId] ?? {};
    const out: Record<string, number> = {};
    for (const [iso, units] of Object.entries(fixed)) {
      out[iso] = Math.max(0, units - (own[iso] ?? 0));
    }
    return out;
  }, [proposal]);

  // De eigen speling per document (`documentFloatOn`) — het ankerpunt van de grijze meetlat. Naar
  // beneden geklemd en afgerond op hele werkdagen: de meetlat rekent in werkdagen, en een negatieve
  // float (een al te krappe planning) zou daar een meetlat mét negatieve breedte van maken.
  const slackByDoc = useMemo(() => {
    const byDoc = new Map<string, number | null>();
    if (!tune) return byDoc;
    for (const doc of inputs) {
      const slack = documentFloatOn(doc, tune.companyId, tune.libraryItemId);
      byDoc.set(doc.docId, slack === null ? null : Math.max(0, Math.floor(slack)));
    }
    return byDoc;
  }, [inputs, tune]);

  // De VOLLEDIGE rangorde, inclusief docId's die de LAATSTE run niet gezien heeft (fixronde-2
  // bevinding B10). Sinds de rangordelijst weg is, is dit uitsluitend nog de RIJVOLGORDE van de
  // balken — de plaatsingsvolgorde waarin de rekenaar de documenten zag. `tune.order` is de basis,
  // en alleen nieuw gezien docId's sluiten achteraan aan.
  const orderBase = useMemo(() => {
    if (!tune) return [];
    const known = new Set(tune.order);
    return [...tune.order, ...inputs.map(doc => doc.docId).filter(id => !known.has(id))];
  }, [tune, inputs]);

  const toggleSplits = () => {
    if (!tune) return;
    setUI({ levelingDistribution: { ...tune, allowSplits: !tune.allowSplits } });
  };

  const setPinned = (docId: string, value: boolean) => {
    if (!tune) return;
    setUI({ levelingDistribution: { ...tune, pinned: { ...tune.pinned, [docId]: value } } });
  };
  const setCeiling = (docId: string, value: number | null) => {
    if (!tune) return;
    setUI({ levelingDistribution: { ...tune, ceilings: { ...tune.ceilings, [docId]: value } } });
  };

  // Reset (§3.6): alle plafonds en pins terug naar neutraal, de schakelaar ONGEMOEID — die is een
  // gereedschapskeuze en geen per-project-bijstelling.
  const onReset = () => {
    if (!tune) return;
    setUI({ levelingDistribution: { ...tune, pinned: {}, ceilings: {} } });
  };

  // De BOEKING per document per dag (§6, het ankerpunt van de meetlat + taak 11b de VOOR-stand van
  // de voor/na-grafiek). `computeDistribution` levert dat zelf terug als `proposal.bookingByDay`
  // (letterlijk het grootboek dat de kern al opbouwt) — een tweede aanroep van
  // `computeLibraryOccupancy` hier zou stilzwijgend van diezelfde bron kunnen afwijken.
  const bookingByDoc = useMemo(() => {
    const empty = new Map<string, Record<string, number>>();
    if (!proposal || proposal.blocked) return empty;
    return new Map(Object.entries(proposal.bookingByDay));
  }, [proposal]);

  // De boeking NA de verdeling per document — de stand die de balken als dagblokjes tekenen (§4).
  // Dít moet de NA-stand zijn en niet de VOOR-stand: anders beweegt de balk niet mee tijdens het
  // slepen en is de hele bediening zinloos.
  const afterByDoc = useMemo(() => {
    const empty = new Map<string, Record<string, number>>();
    if (!proposal || proposal.blocked) return empty;
    return new Map(Object.entries(proposal.afterLoadByDay));
  }, [proposal]);

  // De GEDEELDE tijdas van balken én histogram. De as loopt door tot voorbij de laatste geboekte
  // dag, zodat een gestippelde rest (toegestaan-maar-niet-benut) er nog binnen past. De VERTICALE
  // schaal van de stroken is hier geen onderwerp meer: sinds de balk per werkdag een blokje van
  // vaste hoogte tekent (taak 2) bestaat er geen strookschaal — `stripGeometry.ts` rekent alleen
  // nog in x. De grafiek houdt zijn eigen `chartScaleMax` (fixronde-2 bevinding B1).
  const stripView = useMemo(() => {
    if (!tune || !proposal || proposal.blocked || !poolItem) return null;
    const rankIndex = new Map(orderBase.map((docId, index) => [docId, index]));
    const docs = [...proposal.docs].sort((a, b) =>
      (rankIndex.get(a.docId) ?? orderBase.length) - (rankIndex.get(b.docId) ?? orderBase.length));

    const days = new Set<string>(Object.keys(proposal.fixedLoadByDay));
    for (const doc of docs) {
      for (const iso of Object.keys(bookingByDoc.get(doc.docId) ?? {})) days.add(iso);
      for (const iso of Object.keys(afterByDoc.get(doc.docId) ?? {})) days.add(iso);
    }
    if (days.size === 0) return { axis: null, docs };

    // De STAART van de as. Hij hoeft alleen nog de PLAFOND-ruimte te dekken: de dagen waarop de
    // gestippelde rest en de handle terechtkomen wanneer je meer uitloop toestaat dan er benut is.
    // `endShiftWorkdays` stond hier eerder óók in en dat was fout (probe 2026-09-14, case 18 in
    // `check-distribute.ts`): bij HANDMATIG GEPLANDE taken blijft `endShiftWorkdays` 0 terwijl de
    // boeking wél tien werkdagen opschuift. De as stopte dan vóór de nieuwe boeking en het document
    // kreeg een LEGE balk én een lege "Na"-kolom — een weergavefout die als een rekenfout las. De
    // echte dekking van de verschoven boeking komt sinds deze ronde uit `afterLoadByDay` hierboven,
    // dat volwaardig in de dagenset zit; de staart gaat dus alleen nog over wat er nog NIET geboekt
    // is.
    const outlook = docs.reduce(
      (n, doc) => Math.max(n, tune.ceilings[doc.docId] ?? 0), 0);
    if (outlook > 0) {
      const last = [...days].sort()[days.size - 1];
      // Werkdagen → kalenderdagen (5/7) plus een marge, en hoe dan ook begrensd: de rest mag de
      // as verbreden, niet laten ontsporen.
      const extra = Math.min(90, Math.ceil(outlook * 7 / 5) + 2);
      for (const iso of expandDays(
        formatDate(addCalendarDays(parseDate(last), 1)),
        formatDate(addCalendarDays(parseDate(last), extra)),
      )) days.add(iso);
    }

    // De as vult de GEMETEN ruimte tussen label en uitkomstlabel (`minWidth`), met een dagbreedte
    // die de eerste as van deze dialoogsessie vastlegde (`fixedDayWidth`). Zijn er weinig dagen,
    // dan blijft de rest lege track met week- en maandlijnen — dat is precies de bedoeling: je
    // ziet dan waar de ruimte is die je met de greep kunt pakken.
    const axis = buildOccupancyAxis([...days], {
      targetWidth: trackSpace,
      maxDayWidth: DIALOG_MAX_DAY_WIDTH,
      minWidth: trackSpace,
      ...(dayWidthRef.current ? { fixedDayWidth: dayWidthRef.current.dayWidth } : {}),
    });
    if (axis && !dayWidthRef.current) dayWidthRef.current = { key: sessionKey, dayWidth: axis.dayWidth };
    return { axis, docs };
    // `dayWidthRef`/`sessionKey` horen bewust NIET in de deps: de ref is een sessiecache, geen
    // invoer — hem hier opnemen zou de as juist opnieuw laten fitten, wat deze hele constructie
    // moet voorkomen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tune, proposal, poolItem, orderBase, bookingByDoc, afterByDoc, trackSpace]);

  // Eén kleurtoewijzing voor de hele dialoog (fixronde-2 bevinding B9): de balken EN de
  // legenda/staven van de voor/na-grafiek lezen dezelfde map, zodat "project B" boven en onder
  // dezelfde kleur heeft. Stond dit in de grafiek, dan tekende de balk zijn boeking in het
  // accentkleur en klopte de belofte "balk en grafiek matchen" alleen op de x-as.
  const docColors = useMemo(
    () => assignDocColors((stripView?.docs ?? []).map(doc => doc.docId)),
    [stripView],
  );

  const blockedDocTitles = useMemo(() => {
    if (!proposal?.blocked) return '';
    const byId = new Map(inputs.map(doc => [doc.docId, doc.title]));
    return proposal.blocked.docIds.map(id => byId.get(id) ?? id).join(', ');
  }, [proposal, inputs]);

  // De taken die dit poolitem daadwerkelijk boeken, per document — de scope waarbinnen
  // `applyLeveling` mag schrijven (§5, scope-behoudend toepassen). Bewust dezelfde `scopeTaskIdsFor`
  // op dezelfde `inputs` als `computeDistribution` intern gebruikt: `DistributionDocResult` draagt de
  // lijst niet, en een tweede afleiding zou stilzwijgend van de gerekende snit kunnen afwijken.
  const scopeTaskIdsByDoc = useMemo(() => {
    const out: Record<string, string[]> = {};
    if (!tune) return out;
    for (const doc of inputs) out[doc.docId] = scopeTaskIdsFor(doc, tune.companyId, tune.libraryItemId);
    return out;
  }, [inputs, tune]);

  // Het VERSCHIL-prijskaartje (§2.2). De schakelaar-stand bepaalt de ZIN, niet het getal: uit ⇒
  // "zou N besparen" (een belofte), aan ⇒ "bespaart N" (een constatering). De labelpas loopt in
  // eigen macrotasks ná het hoofdvoorstel (fixronde-2 bevinding B6), dus er is een echt venster
  // waarin het voorstel al staat en het getal nog niet; dat venster hoort ZICHTBAAR te zijn als
  // "Bezig…" en niet als "druk op Herbereken".
  const savingsLabel = (): string => {
    if (busy || labelsBusy) return t('resource.distribution.compute.busy');
    if (staleReason !== null || degraded || savings === null) {
      return t('resource.distribution.tool.priceUnknown');
    }
    if (savings.workdays === 0) {
      return tune?.allowSplits
        ? t('resource.distribution.tool.savesNoneOn')
        : t('resource.distribution.tool.savesNoneOff');
    }
    return tune?.allowSplits
      ? t('resource.distribution.tool.savesOn', { count: savings.workdays })
      : t('resource.distribution.tool.savesOff', { count: savings.workdays });
  };

  // Welke documenten een tekort houden, met hun teller — dezelfde `DistributionDocResult.shortfalls`
  // die de voor/na-grafiek gebruikt om de NA-onvolledigheid te melden, en die de validatiestrook
  // gebruikt om het tekort BIJ NAAM te noemen.
  const shortfallDocs = useMemo(() => {
    if (!proposal || proposal.blocked) return [];
    return proposal.docs
      .filter(doc => doc.shortfalls.length > 0)
      .map(doc => ({ docId: doc.docId, title: doc.title, count: doc.shortfalls.length }));
  }, [proposal]);

  // De UNIEKE tekortdagen over alle documenten. Uniek en niet het aantal (taak, dag)-paren: dat zou
  // hetzelfde tekort dubbel tellen zodra twee taken op dezelfde dag vastlopen, terwijl de gebruiker
  // op de tijdas juist die dagen terugziet.
  const shortfallDays = useMemo(() => {
    if (!proposal || proposal.blocked) return [] as string[];
    const days = new Set<string>();
    for (const doc of proposal.docs) for (const s of doc.shortfalls) for (const iso of s.days) days.add(iso);
    return [...days].sort();
  }, [proposal]);

  // Alle deelnemers vast ⇒ er valt niets te herverdelen (§6).
  const allPinned = useMemo(() => {
    if (!proposal || proposal.blocked || proposal.docs.length === 0) return false;
    return proposal.docs.every(doc => !doc.participated || doc.cannotMove);
  }, [proposal]);

  // Waarom Toepassen wel of niet mag — en zo niet, met welke tekst (spec §4 stap 3: validatie wijst
  // altijd een uitweg aan). De volgorde is die van de taakomschrijving: eerst "er is nog niets",
  // dan de blokkade, dan het tekort, dan een vervallen voorstel, en pas daarna het triviale
  // "er valt niets te schrijven".
  const applyGate = useMemo<{ ok: boolean; reason: string }>(() => {
    if (busy) return { ok: false, reason: t('resource.distribution.compute.busy') };
    if (!proposal) return { ok: false, reason: t('resource.distribution.compute.pressRecompute') };
    if (proposal.blocked) {
      return { ok: false, reason: t(DISTRIBUTION_BLOCK_KEY[proposal.blocked.reason], { docs: blockedDocTitles }) };
    }
    if (proposal.hasShortfall) return { ok: false, reason: t('resource.distribution.applyBlockedShortfall') };
    if (staleReason !== null) {
      return { ok: false, reason: t(`resource.distribution.stale.${staleReason}`, { docs: staleDocs }) };
    }
    const plan = planDistributionWrites(proposal, scopeTaskIdsByDoc);
    if (!plan.ok) {
      return {
        ok: false,
        reason: plan.reason === 'shortfall'
          ? t('resource.distribution.applyBlockedShortfall')
          : t('resource.distribution.applyBlockedNothing'),
      };
    }
    return { ok: true, reason: '' };
  }, [busy, proposal, staleReason, staleDocs, blockedDocTitles, scopeTaskIdsByDoc, t]);

  /**
   * De VALIDATIESTROOK (spec §3.5/§7). Altijd gerenderd, altijd één regel hoog — ook wanneer er
   * niets te melden valt: een strook die verschijnt en verdwijnt verschuift alles eronder, en dat
   * is precies het flitsen dat §7 verbiedt. De volgorde is die van dringendheid: een voorstel dat
   * niet meer bij de documenten hoort gaat vóór alles, dan "alles staat vast", dan het tekort, en
   * pas als niets daarvan speelt de groene uitkomst.
   *
   * IN DE GEDEGRADEERDE STAND IS DIT DE ENIGE PLEK DIE HET ZEGT. De uitkomstpil van een balk toont
   * daar sinds taak 2 geen "druk op Herbereken" meer — hij toont het effect van de LAATSTE
   * berekening, terwijl de handle al ergens anders staat. Zonder deze zin leest dat als "mijn
   * sleep deed niets". Daarom plakt `compute.pressRecompute` hier achter elke stale-reden zodra er
   * gedegradeerd gerekend wordt.
   */
  const statusLine = useMemo<{ tone: 'ok' | 'bad' | 'neutral'; text: string; stale: boolean }>(() => {
    if (busy) return { tone: 'neutral', text: t('resource.distribution.compute.busy'), stale: false };
    if (staleReason !== null) {
      return {
        tone: 'neutral',
        text: t(`resource.distribution.stale.${staleReason}`, { docs: staleDocs })
          + (degraded || staleReason === 'edited' ? ` ${t('resource.distribution.compute.pressRecompute')}` : ''),
        stale: true,
      };
    }
    if (!proposal || proposal.blocked) return { tone: 'neutral', text: '', stale: false };
    if (allPinned) return { tone: 'bad', text: t('resource.distribution.status.allPinned'), stale: false };
    if (proposal.hasShortfall) {
      // Het tekort MET PROJECTNAAM. Een document waarvan geen enkele taak geplaatst kon worden
      // heeft een LEGE na-boeking en dus een lege balk; zonder de naam erbij is er niets op het
      // scherm dat uitlegt waaróm die rij leeg is. `shortfall.doc` is de bestaande zin die het
      // tekortblok hiervóór per document toonde — die inhoud verhuist hiernaartoe.
      const named = shortfallDocs
        .map(doc => t('resource.distribution.shortfall.doc', { doc: doc.title, count: doc.count }))
        .join(' · ');
      const head = t('resource.distribution.status.shortfall', {
        count: shortfallDays.length,
        days: shortfallDays.slice(0, 3).map(formatDay).join(', '),
      });
      return { tone: 'bad', text: named ? `${head} ${named}` : head, stale: false };
    }
    const worst = proposal.docs.reduce(
      (best, doc) => (doc.endShiftWorkdays > best.endShiftWorkdays ? doc : best),
      proposal.docs[0] ?? { endShiftWorkdays: 0, title: '' },
    );
    return {
      tone: 'ok',
      text: t('resource.distribution.status.resolved', {
        // Hergebruikt de BESTAANDE `strip.endShift`-meervoudfamilie, die al in alle veertien
        // locales met de juiste CLDR-categorieën staat — zo hoeft er voor deze zin geen vijftiende
        // meervoudfamilie bij.
        shift: worst.endShiftWorkdays === 0
          ? t('resource.distribution.strip.endUnchanged')
          : t('resource.distribution.strip.endShift', { count: worst.endShiftWorkdays }),
        doc: worst.title,
      }),
      stale: false,
    };
  }, [busy, staleReason, staleDocs, degraded, proposal, allPinned, shortfallDocs, shortfallDays, formatDay, t]);

  /** Het laatst toegepaste record — leeft in de tune-state en overleeft dus een sluiting van de
   *  dialoog (§7) én een documentwissel (fixronde B1c-etappe-3, bevinding B3), zodat opnieuw openen
   *  op hetzelfde poolitem de terugweg nog toont. Dat laatste is essentieel: een verdeling schrijft
   *  in MEERDERE documenten, en die beoordeel je door ernaartoe te wisselen — de dialoog gaat daarbij
   *  dicht (`resetDocumentScopedUI`), maar "Alles terugdraaien" moet daarna nog bestaan. */
  const applied = tune?.applied ?? null;

  const onApply = () => {
    if (!proposal || !applyGate.ok) return;
    const outcome = applyDistribution(proposal, scopeTaskIdsByDoc);
    // Mislukt = ZICHTBAAR mislukt (fixronde B1c-etappe-3, bevinding B5). Dit pad is bereikbaar
    // ondanks `applyGate`: de poort kijkt naar de render, de store naar het moment van de klik — een
    // document dat er tussendoor uitvalt, of een slaper waarvan de doorrekening vastloopt, komt hier
    // uit. Vóór deze ronde deed de knop dan geruisloos niets. `detail` draagt de rauwe reden; de
    // vertaalde tekst blijft één zin (het meldingenkanaal kent geen actieknoppen).
    if (!outcome.ok) {
      notify({
        severity: 'error',
        messageKey: 'notifications.distributionApplyFailed',
        detail: outcome.error ?? outcome.reason,
      });
      return;
    }
    const record = outcome.record;
    const current = useAppStore.getState().ui.levelingDistribution;
    if (current) setUI({ levelingDistribution: { ...current, applied: record } });
    // Puur informatief (spec §5) — de terugweg is de strook hieronder, niet deze melding.
    notify({
      severity: 'info',
      messageKey: 'resource.distribution.applied',
      params: { count: record.docs.length },
    });
    // Er is nu in élk beschreven document gemuteerd; de vingerafdruk-bewaking in
    // `useDistributionProposal` ziet dat vanzelf en zet `staleReason = 'edited'`. Dat is exact wat
    // §6a voorschrijft en vraagt hier dus geen eigen tak: het voorstel op het scherm hóórt niet
    // meer bij de documenten, en Toepassen gaat daarmee op slot tot "Herbereken".
  };

  const onUndoAll = () => {
    if (!applied) return;
    const report = undoDistribution(applied);
    const current = useAppStore.getState().ui.levelingDistribution;
    if (current) setUI({ levelingDistribution: { ...current, applied: null } });
    if (report.skippedDocIds.length > 0) {
      const byId = new Map(applied.docs.map(doc => [doc.docId, doc.title]));
      notify({
        // Het meldingenkanaal kent alleen `error` en `info` (K8a). Een gedeeltelijke terugdraaiing
        // is geen fout, maar mág niet na 5 s verdwijnen: de gebruiker denkt anders dat álles terug
        // is terwijl één project zijn vertraging houdt. `error` is de enige plakkende severity.
        severity: 'error',
        messageKey: 'resource.distribution.undonePartial',
        params: { docs: report.skippedDocIds.map(id => byId.get(id) ?? id).join(', ') },
      });
    } else {
      notify({ severity: 'info', messageKey: 'resource.distribution.undoneAll' });
    }
  };

  const shortfallTitleByDoc = new Map(shortfallDocs.map(doc => [doc.docId, doc]));

  return (
    <Dialog
      alignTop
      onBackdropClick={close}
      onCancel={close}
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[960px] max-w-[95vw] max-h-[90vh] flex flex-col overflow-hidden"
      panelProps={{
        'data-ops-distribution-dialog': '',
        ...(lastStaleReason ? { 'data-ops-distribution-last-stale-reason': lastStaleReason } : {}),
      }}
    >
      {/* (1) Kop */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate" style={{ fontFamily: 'var(--font-heading)' }}>
            {tune ? itemName : t('resource.distribution.title')}
          </div>
          {/* De kiezer-stand zet zijn eigen uitleg boven de lijst (en zijn eigen zin wanneer er
              niets te kiezen valt); die hier herhalen gaf een kop die "kies een conflict" zei boven
              een paneel dat meldt dat er geen conflict is. */}
          {tune && (
            <div className="text-[11px] text-text-secondary truncate">
              {t('resource.distribution.subtitle', { item: itemName })}
            </div>
          )}
          {/* Eén regel die de hele handeling uitlegt (gebruikstest 2026-09-12, gebrek 4). Bewust
              NIET afgekapt (`truncate`) zoals de ondertitel erboven: een uitleg die halverwege
              ophoudt met "…" legt niets uit. */}
          {tune && (
            <div className="text-[11px] text-text-secondary mt-0.5" data-ops-distribution-intro>
              {t('resource.distribution.intro')}
            </div>
          )}
        </div>
        <button onClick={close} className="p-1 hover:bg-surface-hover rounded-[8px] shrink-0" title={t('resource.distribution.back')}>
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-xs">
        {!tune ? (
          /* (1b) KIEZER-STAND (bedieningsreparatie 2026-09-11). Zonder gekozen poolitem stond hier
             alleen `selectHint` plus drie uitgeschakelde knoppen — een dialoog waarin niets kon.
             Nu is de lege stand de keuzelijst zelf; zie `DistributionPicker`. */
          <DistributionPicker />
        ) : proposal?.blocked ? (
          /* (2) Blokkade — één vorm voor alle drie de redenen (§3.1: nooit een stille uitsluiting). */
          <div
            className="px-3 py-2 rounded-[8px] border"
            style={{ borderColor: 'var(--error)', color: 'var(--error)' }}
            role="status"
            data-ops-distribution-blocked
          >
            {t(DISTRIBUTION_BLOCK_KEY[proposal.blocked.reason], { docs: blockedDocTitles })}
          </div>
        ) : (
          <>
            {/* (2) GEREEDSCHAP — de schakelaar met het VERSCHIL-prijskaartje (§2.2/§3.2). Het
                prijsvak heeft een VASTE breedte: "Bezig…" mag de schakelaar er niet naast
                wegduwen (§7). */}
            <section className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <Switch
                  checked={tune.allowSplits}
                  onChange={toggleSplits}
                  ariaLabel={t('resource.distribution.tool.allowSplits')}
                  title={t('resource.distribution.help.allowSplits')}
                  className="inline-flex items-center shrink-0"
                  data-ops-distribution-allow-splits
                />
                <span className="font-medium" title={t('resource.distribution.help.allowSplits')}>
                  {t('resource.distribution.tool.allowSplits')}
                </span>
                <span
                  className="text-text-secondary shrink-0 truncate"
                  style={{ width: 210 }}
                  title={t('resource.distribution.help.price')}
                  data-ops-distribution-tool-price
                >
                  {savingsLabel()}
                </span>
              </div>
              <span className="text-[10px] text-text-secondary">{t('resource.distribution.tool.allowSplitsHint')}</span>
            </section>

            {/* (3)(4) DE BALKEN EN DE UITKOMST, in ÉÉN horizontale scroll-container zodat ze
                kolom-op-kolom uitgelijnd blijven — ook tijdens het scrollen (spec §3.4). */}
            <div ref={scrollerRef} className="overflow-x-auto" dir="ltr" style={{ direction: 'ltr' }}>
              <div className="inline-flex flex-col gap-1 min-w-full" data-ops-distribution-strips>
                {(stripView?.docs ?? []).map(doc => {
                  const recorded = doc.pinnedReason === 'dates-as-recorded';
                  const pinnedNow = recorded || tune.pinned[doc.docId] === true;
                  // Een tekort kleurt de uitkomstpil rood — dezelfde bron als de badge hieronder.
                  const short = shortfallTitleByDoc.get(doc.docId);
                  return (
                    <PhaseStrip
                      key={doc.docId}
                      docId={doc.docId}
                      title={doc.title}
                      axis={stripView?.axis ?? null}
                      beforeLoadByDay={bookingByDoc.get(doc.docId) ?? {}}
                      afterLoadByDay={afterByDoc.get(doc.docId) ?? {}}
                      fixedLoadByDay={fixedLoadFor(doc.docId, pinnedNow)}
                      isWorkingDay={isWorkingDayByDoc.get(doc.docId) ?? isWorkingDayFallback}
                      color={docColors.get(doc.docId) ?? 'var(--theme-accent)'}
                      slackWorkdays={slackByDoc.get(doc.docId) ?? null}
                      endShiftWorkdays={doc.endShiftWorkdays}
                      ceiling={tune.ceilings[doc.docId] ?? null}
                      pinned={pinnedNow}
                      recorded={recorded}
                      cannotMove={doc.cannotMove}
                      liveCommit={!degraded}
                      busy={busy}
                      shortfallCount={short?.count ?? 0}
                      {...(short
                        ? { shortfallTitle: t('resource.distribution.shortfall.doc', { doc: short.title, count: short.count }) }
                        : {})}
                      formatDay={formatDay}
                      onTogglePin={() => setPinned(doc.docId, tune.pinned[doc.docId] !== true)}
                      onCeilingChange={next => setCeiling(doc.docId, next)}
                    />
                  );
                })}

                {/* De legenda-regel (§4), ingesprongen tot waar de tracks beginnen. */}
                <div
                  className="text-[10px] text-text-secondary"
                  style={{ marginLeft: STRIP.labelWidth + STRIP.gap }}
                  data-ops-distribution-legend
                >
                  {t('resource.distribution.strip.legend')}
                </div>

                {/* De einddatum-badges per project, boven het histogram (§3.4). Een project met een
                    tekort krijgt hier zijn markering: zijn balk is dan (deels) LEEG omdat de motor
                    zijn werk nergens kwijt kon, en dat moet bij die kleur staan en niet alleen
                    onderin de validatiestrook. */}
                <div
                  className="flex flex-wrap gap-x-3 gap-y-1 mt-1"
                  style={{ marginLeft: STRIP.labelWidth + STRIP.gap, marginRight: STRIP.endWidth + STRIP.gap }}
                  data-ops-distribution-end-badges
                >
                  {(stripView?.docs ?? []).map(doc => {
                    const short = shortfallTitleByDoc.get(doc.docId);
                    const shortText = short
                      ? t('resource.distribution.shortfall.doc', { doc: short.title, count: short.count })
                      : undefined;
                    return (
                      <span
                        key={doc.docId}
                        className="inline-flex items-center gap-1.5 min-w-0"
                        data-ops-doc-id={doc.docId}
                        {...(short ? { 'data-ops-distribution-badge-shortfall': 'true', title: shortText } : {})}
                      >
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                          style={{ background: docColors.get(doc.docId) }}
                          aria-hidden
                        />
                        <span
                          className="text-[10px] truncate"
                          style={{ color: short ? 'var(--error)' : 'var(--theme-text-dim)' }}
                        >
                          {`${doc.title}: ${doc.projectEndAfter ? formatDay(doc.projectEndAfter) : '—'}`}
                        </span>
                      </span>
                    );
                  })}
                </div>

                {/* Het histogram Nu/Na op DEZELFDE as-instantie, met dezelfde marges als de tracks —
                    daardoor staan de kolommen per constructie onder de dagblokjes. */}
                {/* GEEN horizontale padding, en de marge compenseert de 1 px rand: het plotgebied
                    van het histogram moet exact op de tracks vallen. Met `px-2` stond elke
                    histogramkolom 8 px rechts van zijn dagblokje — gemeten 2026-09-14, blokje op
                    x=428 tegen staaf op x=436. */}
                <section
                  className="rounded-[8px] border border-border py-3 mt-1"
                  style={{
                    marginLeft: STRIP.labelWidth + STRIP.gap - 1,
                    marginRight: STRIP.endWidth + STRIP.gap - 1,
                  }}
                  title={t('resource.distribution.help.chart')}
                  data-ops-distribution-histogram
                >
                  {poolItem ? (
                    <BeforeAfterChart
                      poolItem={poolItem}
                      axis={stripView?.axis ?? null}
                      docs={(stripView?.docs ?? []).map(doc => ({ docId: doc.docId, title: doc.title }))}
                      docColors={docColors}
                      bookingByDay={proposal?.bookingByDay ?? {}}
                      afterLoadByDay={proposal?.afterLoadByDay ?? {}}
                      afterIncomplete={proposal?.afterIncomplete ?? false}
                      shortfallDocs={shortfallDocs}
                    />
                  ) : (
                    <span className="text-text-secondary">
                      {t('resource.distribution.preview.before')} / {t('resource.distribution.preview.after')} / {t('resource.distribution.preview.capacity')}
                    </span>
                  )}
                </section>
              </div>
            </div>
          </>
        )}
      </div>

      {/* (5) Validatiestrook + knoppenbalk.

          IN DE KIEZER-STAND STAAT HIER NIETS BEHALVE "SLUITEN" (bedieningsreparatie 2026-09-11).
          "Verdeel automatisch", "Toepassen" en "Verwerpen" slaan zonder gekozen poolitem nergens
          op; ze stonden er grijs, en drie grijze knoppen lezen als "deze functie is stuk" in plaats
          van "kies eerst iets". De handeling die hier wél bestaat — een item kiezen — staat in het
          paneel erboven. */}
      <div className="border-t border-border px-4 py-3 flex flex-col gap-2 text-xs bg-surface">
        {!tune ? (
          <div className="flex items-center justify-end">
            <button
              type="button"
              className="px-3 py-1.5 rounded-[8px] border border-border hover:bg-surface-hover"
              onClick={close}
            >
              {t('close')}
            </button>
          </div>
        ) : (
        <>
        {/* De degradatiemelding blijft bestaan (§5), maar op een GERESERVEERDE regel: aan- en
            uitgaan mag de knoppenbalk niet verschuiven. */}
        <div className="text-[10px] text-text-secondary" style={{ minHeight: 14 }} data-ops-distribution-degraded-slot>
          {degraded ? (
            <span data-ops-distribution-degraded>{t('resource.distribution.compute.degraded')}</span>
          ) : null}
        </div>

        {/* VALIDATIESTROOK — `role="status"`, ALTIJD gerenderd, VASTE hoogte (§3.5/§7). Leeg =
            onzichtbare tekst, geen weggehaald blok: alleen zó verschuift er nooit iets. Het anker
            `data-ops-distribution-stale` blijft bestaan, maar als een SPAN bínnen deze strook —
            zo blijven de bestaande asserties ("geen stale ⇒ count 0") geldig zonder dat de strook
            zelf van hoogte wisselt. */}
        <div
          className="flex items-center gap-2 px-2.5 rounded-[8px] border"
          style={{
            height: 30,
            background: statusLine.tone === 'ok'
              ? 'color-mix(in srgb, var(--success) 10%, transparent)'
              : statusLine.tone === 'bad'
                ? 'color-mix(in srgb, var(--error) 10%, transparent)'
                : 'color-mix(in srgb, var(--theme-text-dim) 10%, transparent)',
            borderColor: statusLine.tone === 'ok'
              ? 'var(--success)'
              : statusLine.tone === 'bad' ? 'var(--error)' : 'var(--theme-text-dim)',
            color: statusLine.tone === 'ok'
              ? 'var(--success)'
              : statusLine.tone === 'bad' ? 'var(--error)' : 'var(--theme-text-dim)',
          }}
          role="status"
          aria-live="polite"
          data-ops-distribution-status
        >
          {statusLine.stale ? (
            <span
              className="flex-1 min-w-0 truncate"
              title={statusLine.text}
              data-ops-distribution-stale
              data-ops-distribution-stale-reason={staleReason ?? ''}
            >
              {statusLine.text}
            </span>
          ) : (
            <span className="flex-1 min-w-0 truncate" title={statusLine.text}>{statusLine.text}</span>
          )}
          {/* De reden waarom Toepassen uit staat, rechts in dezelfde strook. Bij een VERVALLEN
              voorstel is die reden woordelijk de stale-zin die links al staat; dan blijft dit vak
              leeg in plaats van dezelfde zin twee keer op één regel te zetten (gezien in de
              gebruiksfoto van 2026-09-14). Het anker blijft altijd bestaan, zodat een test op
              "welke reden staat er" niet van de toestand afhangt. */}
          <span
            className="text-text-secondary shrink-0 truncate"
            style={{ maxWidth: 320 }}
            title={statusLine.stale ? undefined : applyGate.reason}
            data-ops-distribution-apply-reason
          >
            {statusLine.stale ? '' : applyGate.reason}
          </span>
        </div>

        {/* Spec §5: de terugweg woont HIER, niet in het meldingenkanaal (dat kent geen actieknoppen
            en ruimt info na 5 s op). Permanent zolang het record geldig is — hij verdwijnt alleen
            door "Alles terugdraaien" of doordat een NIEUW Toepassen hem vervangt. Dit blok mág van
            hoogte wisselen: het verschijnt door een expliciete HANDELING van de gebruiker, niet
            door een rekentoestand — en dat is precies het onderscheid dat §7 maakt. */}
        {applied && (
          <div
            className="px-2.5 py-1.5 rounded-[8px] border flex items-center gap-2"
            style={{
              background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
              borderColor: 'var(--accent)',
            }}
            role="status"
            data-ops-distribution-applied
          >
            <span className="flex-1 min-w-0">
              {t('resource.distribution.applied', { count: applied.docs.length })}
            </span>
            <button
              type="button"
              className="px-2 py-1 rounded-[8px] border border-border bg-surface hover:bg-surface-hover shrink-0"
              onClick={onUndoAll}
            >
              {t('resource.distribution.undoAll')}
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* Terug naar de kiezer. Geen bevestigingsdialoog (die zou over een dialoog heen moeten,
              en `hasBlockingDialogOpen` weert dat terecht) — in plaats daarvan ZEGT de knop wat er
              verdwijnt zodra er een `applied`-record staat: twee losse sleutels, want de waarschuwende
              variant is een andere zin en geen ingevulde parameter. `levelingDistribution: null` is
              de bestaande regel "ander poolitem = verse tune-state": het `applied`-record hoort bij
              dít item en vervalt dus mee. De terugdraai-strook is daarmee weg, de schrijfactie in de
              documenten blijft staan (die draai je terug met de gewone undo per document). */}
          <button
            type="button"
            className="px-3 py-1.5 rounded-[8px] border border-border hover:bg-surface-hover"
            data-ops-distribution-pick-another
            title={t('resource.distribution.help.pickAnother')}
            onClick={() => setUI({ levelingDistribution: null })}
          >
            {applied
              ? t('resource.distribution.pickAnotherApplied')
              : t('resource.distribution.pickAnother')}
          </button>
          {/* Reset (§3.6): alle plafonds en pins terug naar neutraal, de schakelaar ONGEMOEID —
              die is een gereedschapskeuze, geen per-project-bijstelling. */}
          <button
            type="button"
            className="px-3 py-1.5 rounded-[8px] border border-border hover:bg-surface-hover"
            data-ops-distribution-reset
            title={t('resource.distribution.help.reset')}
            onClick={onReset}
          >
            {t('resource.distribution.reset')}
          </button>
          <span className="flex-1" />
          <button
            type="button"
            className="px-3 py-1.5 rounded-[8px] border border-border hover:bg-surface-hover disabled:opacity-40"
            onClick={recompute}
            disabled={busy}
            title={t('resource.distribution.help.recompute')}
          >
            {proposal === null
              ? t('resource.distribution.compute.auto')
              : t('resource.distribution.compute.recalculate')}
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded-[8px] bg-accent text-white disabled:opacity-40"
            disabled={!applyGate.ok}
            title={applyGate.reason || t('resource.distribution.help.apply')}
            onClick={onApply}
          >
            {t('resource.distribution.apply')}
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded-[8px] border border-border hover:bg-surface-hover"
            title={t('resource.distribution.help.discard')}
            onClick={close}
          >
            {t('resource.distribution.discard')}
          </button>
        </div>
        </>
        )}
      </div>
    </Dialog>
  );
}

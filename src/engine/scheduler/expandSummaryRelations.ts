import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { CPMResult } from './CPMSolver';

/**
 * Volledige samenvattingsrelatie-propagatie (vervolg op 489a9ef2). `CPMSolver` kent alleen
 * bladtaken (`childIds.length === 0`) als knopen; een relatie die een WBS-samenvattingstaak raakt
 * kan de solver dus niet zelf verwerken. 489a9ef2 loste de crash op door zulke relaties te droppen
 * (`CPMResult.droppedSequenceIds`) — een bewuste tussenoplossing die op een echt corpusbestand
 * (870d339f60603f71, hash-only §8) 28 van de 105 relaties liet vallen: een kwart van de logica.
 *
 * MS Project-semantiek (referentie: de MSPDI-export van datzelfde bestand, die MS Project's eigen
 * berekende datums bevat) past een relatie op een samenvattingstaak toe op ELK onderliggend
 * bladkind:
 *   - samenvatting als VOORGANGER: elke bladafstammeling wordt zelf voorganger van de opvolger.
 *     Met FS betekent dat "wacht tot de hele tak klaar is" — dat volgt vanzelf uit de bestaande
 *     forward-pass, die per opvolger de MAX neemt over alle inkomende relatie-constraints. Er is
 *     dus geen aparte "laatste kind"-berekening nodig: één relatie per bladkind is voldoende, de
 *     solver doet de rest.
 *   - samenvatting als OPVOLGER: elke bladafstammeling wordt zelf opvolger van de voorganger — elk
 *     kind wacht op diezelfde voorganger, onafhankelijk van de andere kinderen.
 *   - beide kanten samenvatting: het kruisproduct van de twee (herschreven) kanten.
 *   - geneste samenvattingen: `leafDescendantsOf` daalt recursief af tot bladtaken, cyclusvast (een
 *     `visited`-set voorkomt oneindige recursie als `childIds` ooit corrupt een cyclus vormt).
 *   - voorouder-/zelfrelatie (een taak gekoppeld aan zijn eigen (voor)ouder-samenvatting, of P->P):
 *     ATOMAIR gedropt, zie de guard verderop in de functie — dit zou anders letterlijk A->B én B->A
 *     genereren en de hele solve laten crashen (`error: "Circular dependency"`, projectbreed geen
 *     datums meer). MS Project staat zo'n koppeling zelf ook niet toe.
 *
 * NAUWKEURIGHEID PER RELATIETYPE (CPM-review, eerlijke claim i.p.v. impliciet "altijd correct" —
 * de MAX-over-bladkinderen-truc uit de vorige alinea is niet voor elk type evenwaardig aan MS
 * Project's eigen "de samenvatting als geheel"-semantiek):
 *   - FS/FF, samenvatting als VOORGANGER: EXACT. De opvolger moet wachten tot de bladtaak die het
 *     LAATST klaar is (MAX van de kind-finishes) — dat is precies wat "wacht op de hele tak" met FS/
 *     FF betekent, en precies wat de MAX-over-relaties-truc oplevert.
 *   - FS/SS, samenvatting als OPVOLGER: EXACT. Elk kind moet onafhankelijk wachten op dezelfde
 *     voorganger (AND-semantiek over de kinderen) — dat is letterlijk "één relatie per kind".
 *   - SS/SF, samenvatting als VOORGANGER: CONSERVATIEF TE LAAT. MS Project's ware "samenvatting-
 *     start" is de VROEGSTE kind-start (MIN), maar één relatie per kind + de MAX-over-relaties-
 *     forward-pass dwingt de opvolger te wachten op de LAATSTE kind-start (MAX i.p.v. MIN). De
 *     opvolger kan dus later gepland worden dan MS Project zou doen — nooit vroeger. In bouwplanning
 *     is dat de veilige kant (nooit te vroeg beginnen); echte MIN-semantiek vergt de samenvatting
 *     als eigen solver-knoop (zie docs/TODO.md, buiten deze etappe).
 *   - FF/SF, samenvatting als OPVOLGER: CONSERVATIEF, en een vorm die MS Project op een samenvatting
 *     zelf al ontmoedigt/verbiedt. Het dwingt ELK kind (ook een kind dat allang klaar zou zijn) om
 *     te voldoen aan een constraint die eigenlijk alleen voor de SAMENVATTING als geheel (het LAATST
 *     afgeronde kind) zou moeten gelden — een vroeg kind kan hierdoor onnodig later worden gepland.
 * Corpusincidentie (870d339f60603f71, T8/deze etappe): 0 — geen van de 28 samenvatting-relaties in dat
 * bestand is SS/SF-voorganger of FF/SF-opvolger, dus dit is een gedocumenteerde grens, geen gemeten
 * regressie. Vier regressiecases pinnen het huidige (conservatieve) gedrag, zie
 * `cases-edge.json` ("wbs-summary-relation-conservative-*").
 *
 * BEKENDE BEPERKING (M5): procentuele lag (`lagPercent`) op een relatie met een samenvattingstaak
 * wordt ná expansie opgelost tegen de duur van het INDIVIDUELE BLADKIND (`resolveEffectiveLagDays`
 * leest `predTask.time.scheduleDuration` van de synthetische voorganger, en dat IS het bladkind na
 * expansie) — niet tegen de duur/omvang van de samenvatting als geheel. Bij kinderen met sterk
 * uiteenlopende duren geeft dat per gegenereerde bladrelatie een andere absolute lag, terwijl MS
 * Project vermoedelijk één samenvattings-brede duur als basis neemt. Corpusincidentie: 0 (geen van
 * de samenvatting-relaties in 870d339f60603f71 heeft `lagPercent`).
 *
 * Lag/type van de oorspronkelijke relatie blijft op elke gegenereerde bladrelatie staan (spread);
 * alleen `id`/`predecessorId`/`successorId` wijzigen. Synthetische ids zijn afleidbaar van het
 * origineel (`${seq.id}::exp-<n>`), met een botsingsklem (M9, zie `usedIds` verderop) tegen een
 * ECHTE relatie-id die toevallig al op datzelfde patroon eindigt — deze functie is PUUR en schrijft
 * niets naar de store; de synthetische relaties bestaan alleen als solver-invoer. De vier relatie-
 * gekeyde `CPMResult`-velden (`drivingSequenceIds`, `sequenceFreeFloat`, `truncatedLeadSequenceIds`,
 * `outOfSequenceSequenceIds`) bevatten ná een solve dus ook zulke synthetische ids — zie
 * `foldSyntheticSequenceIds` onderaan dit bestand om die terug te vouwen op de originele relatie-id.
 */

/**
 * Kwadratische-explosie-klem, analoog aan `CalendarEngine.MAX_SCAN`/`MAX_DAYS`: het kruisproduct
 * van twee samenvattingstakken met N resp. M bladkinderen genereert N×M relaties. Eén relatie
 * tussen twee samenvattingen van elk 500 bladkinderen is al 250.000 combinaties — precies het soort
 * gat dat hier eerder is gevonden (K-items). Harde bovengrens op het TOTAAL aantal synthetische
 * relaties dat deze functie over ALLE input-relaties samen mag produceren.
 *
 * Gedrag bij overschrijding: een relatie waarvan het eigen kruisproduct niet meer past wordt
 * ATOMAIR gedropt (nooit een gedeeltelijke — dus semantisch onjuiste — subset van bladrelaties) en
 * ELKE volgende relatie die zelf óók expansie nodig heeft, wordt daarna eveneens gedropt (geen
 * her-proberen op een kleiner kruisproduct verderop in de lijst — voorspelbaar "op is op"-gedrag
 * i.p.v. afhankelijk van invoervolgorde toch soms slagen). Relaties die al bladtaak-naar-bladtaak
 * waren (geen expansie nodig) blijven ONGEMOEID doorlopen — zij tellen niet mee tegen de klem, want
 * die groeien nooit kwadratisch (hooguit lineair met het aantal relaties, zoals vóór deze wijziging).
 */
export const MAX_EXPANDED_RELATIONS = 50_000;

export interface ExpandSummaryRelationsResult {
  /** Bladtaak-naar-bladtaak relaties, geschikt om direct aan `CPMSolver` te voeren. */
  sequences: Sequence[];
  /** Ids van ORIGINELE relaties die niet konden worden gerepresenteerd: een samenvatting zonder
   *  bladafstammelingen (lege/kapotte tak), of de MAX_EXPANDED_RELATIONS-klem. Bedoeld om door de
   *  aanroeper samengevoegd te worden met `CPMResult.droppedSequenceIds` (de 489a9ef2-guard in de
   *  solver zelf blijft het vangnet voor écht verweesde/ongeldige taak-ids). */
  droppedSequenceIds: string[];
}

/** Lege, cache-gedeelde constante voor "geen bladafstammelingen" (kapotte/lege tak). */
const NONE: string[] = [];

export function expandSummaryRelations(tasks: Task[], sequences: Sequence[]): ExpandSummaryRelationsResult {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const leafDescCache = new Map<string, string[]>();

  // Recursief (geneste samenvattingen) tot bladtaken, cyclusvast via een visited-set per aanroep
  // (corrupte `childIds` mag nooit een oneindige lus geven) en gecached over relaties heen (een
  // groot bestand kan dezelfde samenvatting als kant van meerdere relaties hebben).
  function leafDescendantsOf(rootId: string): string[] {
    const cached = leafDescCache.get(rootId);
    if (cached) return cached;
    const root = byId.get(rootId);
    if (!root) return NONE;
    if (root.childIds.length === 0) {
      const self = [rootId];
      leafDescCache.set(rootId, self);
      return self;
    }
    const out: string[] = [];
    const visited = new Set<string>([rootId]);
    const stack: string[] = [...root.childIds];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (visited.has(id)) continue; // cyclus of dubbele boomverwijzing — stil negeren, niet crashen
      visited.add(id);
      const t = byId.get(id);
      if (!t) continue; // verweesd kind-id — geen bladtaak om te representeren
      if (t.childIds.length === 0) {
        out.push(id);
      } else {
        stack.push(...t.childIds);
      }
    }
    leafDescCache.set(rootId, out);
    return out;
  }

  // M9: bescherming tegen id-botsing. Een synthetische id is `${seq.id}::exp-<n>` — zeldzaam maar
  // niet uitgesloten dat een ECHTE (niet-gegenereerde) relatie-id toevallig al op dat patroon
  // eindigt (bv. een importer die zijn eigen id's met een vergelijkbare suffix samenstelt). Een
  // botsing zou twee verschillende relaties op dezelfde id laten landen in de output-array — en
  // daarmee stil laten samenvallen in elke id-geïndexeerde bookhouding verderop (successors-/
  // predecessors-adjacency in de solver, `sequenceFreeFloat`, `drivingSequenceIds`-lookups).
  // `usedIds` wordt hier ALVAST gevuld met ALLE originele relatie-ids (die overleven immers
  // ongewijzigd in de output als ze niet hoeven te expanderen, ongeacht hun positie in `sequences`)
  // zodat een botsing altijd wordt gezien, ook als de botsende originele relatie pas later in de
  // lijst staat dan de relatie die aan het expanderen is.
  const usedIds = new Set(sequences.map((s) => s.id));
  let idCollisionWarned = false;

  const outSeqs: Sequence[] = [];
  const dropped: string[] = [];
  let budget = MAX_EXPANDED_RELATIONS;
  let budgetExhausted = false;

  for (const seq of sequences) {
    const predTask = byId.get(seq.predecessorId);
    const succTask = byId.get(seq.successorId);
    if (!predTask || !succTask) {
      // Geen samenvattingsgeval — een echt verweesd/ongeldig taak-id. Ongewijzigd doorgeven; de
      // bestaande CPMSolver-constructor-guard (489a9ef2) droppt 'm met zijn eigen waarschuwing.
      outSeqs.push(seq);
      continue;
    }
    const predIsLeaf = predTask.childIds.length === 0;
    const succIsLeaf = succTask.childIds.length === 0;
    if (predIsLeaf && succIsLeaf) {
      outSeqs.push(seq); // geen samenvatting aan weerskant — niets te expanderen
      continue;
    }

    const predIds = predIsLeaf ? [predTask.id] : leafDescendantsOf(predTask.id);
    const succIds = succIsLeaf ? [succTask.id] : leafDescendantsOf(succTask.id);
    if (predIds.length === 0 || succIds.length === 0) {
      // Samenvatting zonder bladafstammelingen (lege of kapotte tak) — niets om te representeren.
      dropped.push(seq.id);
      continue;
    }

    // VOOROUDER-/ZELFRELATIE-GUARD (CPM-review, blokkerend): een relatie waarvan de voorganger een
    // (voor)ouder of afstammeling van de opvolger is — inclusief P->P, dezelfde samenvatting aan
    // beide kanten — deelt bladafstammelingen tussen predIds/succIds. In een boom betekent élke
    // niet-lege doorsnede tussen predIds en succIds dat minstens één bladtaak zowel voorganger als
    // opvolger van zichzelf zou worden (bij doorsnede-grootte 1) of dat twee gedeelde bladtaken
    // elkaars voorganger ÉN opvolger worden (bij doorsnede-grootte ≥2 — het kruisproduct genereert
    // dan letterlijk K1->K2 én K2->K1). Dat laatste is een directe 2-cyclus: CPMSolver.solve() geeft
    // dan `error: "Circular dependency"` en LEVERT PROJECTBREED GEEN DATUMS MEER — niet alleen voor
    // deze relatie, voor het HELE document. MS Project staat een relatie tussen een taak en zijn
    // eigen (voor)ouder-samenvatting principieel niet toe (een taak kan niet vóór/ná zijn eigen tak
    // liggen); wij droppen 'm daarom hier ATOMAIR — vóór de budget-check, dus ongeacht klemstatus —
    // i.p.v. de solver te laten crashen. Vóór de propagatie werd zo'n relatie stilzwijgend gedropt
    // door de "pred/succ niet in de bladtakenset"-guard in de CPMSolver-constructor (489a9ef2); deze
    // guard behoudt dat eindresultaat (droppen, geen crash) nu de propagatie zulke relaties zelf zou
    // proberen te expanderen.
    const predSet = new Set(predIds);
    if (succIds.some((id) => predSet.has(id))) {
      dropped.push(seq.id);
      continue;
    }

    if (budgetExhausted) {
      dropped.push(seq.id);
      continue;
    }

    // Exact aantal — de voorouder-/zelfrelatie-guard hierboven garandeert dat predIds/succIds nu
    // DISJUNCT zijn, dus elk (p,s)-paar hieronder is een écht andere bladtaak aan beide kanten.
    const size = predIds.length * succIds.length;
    if (size > budget) {
      // M6: welke relatie hier precies sneuvelt is AFHANKELIJK VAN DE INVOERVOLGORDE (de eerste
      // die het resterende budget niet meer past) — geen her-proberen verderop in de lijst op een
      // kleiner kruisproduct, zie de moduleheader-klembeschrijving hierboven voor het volledige
      // "op is op"-gedrag.
      budgetExhausted = true;
      dropped.push(seq.id);
      console.warn(
        `expandSummaryRelations: MAX_EXPANDED_RELATIONS (${MAX_EXPANDED_RELATIONS}) bereikt bij ` +
        `relatie "${seq.id}" (${predIds.length}×${succIds.length}=${size} combinaties). Deze en alle ` +
        'volgende relaties die zelf óók expansie nodig hebben, worden genegeerd i.p.v. de solver ' +
        'te laten vastlopen/OOM\'en.',
      );
      continue;
    }

    // Monotone teller per relatie (n stijgt door over alle (p,s)-paren van DEZE relatie — nooit
    // terug naar 0 per paar): het `usedIds.has`-controle-lusje hieronder is de zeldzame, trage tak
    // (alleen bij een echte botsing, zie de `usedIds`-toelichting hierboven); de gewone weg is één
    // O(1) Set-lookup per gegenereerde relatie, dus dit blijft lineair in het aantal paren — geen
    // O(n²) bij een groot kruisproduct.
    let n = 0;
    for (const p of predIds) {
      for (const s of succIds) {
        let id = `${seq.id}::exp-${n}`;
        while (usedIds.has(id)) {
          if (!idCollisionWarned) {
            idCollisionWarned = true;
            console.warn(
              `expandSummaryRelations: id-botsing opgelost — een bestaande relatie-id viel samen met ` +
              `een gegenereerde synthetische id voor relatie "${seq.id}" (patroon "::exp-N"). Het ` +
              'tellersuffix is opgehoogd tot een vrije id; controleer desgewenst de bron-relatie-ids.',
            );
          }
          n++;
          id = `${seq.id}::exp-${n}`;
        }
        usedIds.add(id);
        n++;
        outSeqs.push({ ...seq, id, predecessorId: p, successorId: s });
      }
    }
    budget -= size;
  }

  return { sequences: outSeqs, droppedSequenceIds: dropped };
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
//  I2 (CPM-review) — synthetische ids terugvouwen in de solver-UITVOER
// ═══════════════════════════════════════════════════════════════════════════════════════════

/** Herkent het synthetische suffix `::exp-<n>` aan het EINDE van een id (niet een toevallige
 *  "::exp-" ergens in het midden van een echte, niet-gegenereerde id — vgl. de M9-botsingsklem
 *  hierboven, die er juist voor zorgt dat zo'n echte id nooit een gegenereerd suffix draagt). */
const SYNTHETIC_SUFFIX = /::exp-\d+$/;

/** Vouw een (mogelijk synthetische) relatie-id terug naar zijn origineel. Idempotent op een
 *  al-originele id: geen suffix ⇒ ongewijzigd teruggegeven, dus dubbel toepassen is veilig. */
export function originalSequenceId(id: string): string {
  return id.replace(SYNTHETIC_SUFFIX, '');
}

function dedupOriginal(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    const orig = originalSequenceId(id);
    if (!seen.has(orig)) {
      seen.add(orig);
      out.push(orig);
    }
  }
  return out;
}

/**
 * Vouw de synthetische `::exp-<n>`-ids in een `CPMResult` terug op hun ORIGINELE relatie-id. Nodig
 * omdat `CPMSolver` niets van de expansie afweet: draai je 'm op de output van
 * `expandSummaryRelations`, dan bevatten de vier relatie-gekeyde velden synthetische ids die geen
 * van de consumenten (RelationsPanel, StatusBar, ReportPanel, TaskDependenciesSection, GanttCanvas,
 * de MCP-leestools) herkent — die kennen alleen `s.sequences`, met de originele ids. Gemeten op
 * 870d339f60603f71 vóór deze fold: 114 van de 167 `drivingSequenceIds` synthetisch (dus onvindbaar in
 * `s.sequences` ⇒ stil uit elke driving-weergave gevallen), 261 van de 338 `sequenceFreeFloat`-
 * sleutels synthetisch (dus `sequenceFreeFloat[seq.id]` gaf `undefined` voor die relaties). Op dit
 * corpusbestand raakt `outOfSequenceSequenceIds`/`truncatedLeadSequenceIds` toevallig leeg (geen
 * progress/leads in dit bestand), maar het principe geldt daar identiek: zodra een van die twee wél
 * gevuld raakt op een geëxpandeerde relatie, telt een N-voudig kruisproduct als N in plaats van 1
 * (bv. de StatusBar-teller voor out-of-sequence-relaties) zonder deze fold.
 *
 * Muteert `result` IN PLACE (past bij hoe de aanroepers dit object al behandelen, zie
 * `droppedSequenceIds`-merge in `scheduleSlice.runCPM`):
 *   - `drivingSequenceIds` — OR: zodra minstens één synthetische instantie van een relatie driving
 *     is, geldt de originele relatie als driving (verzameling, dus meteen gededupliceerd).
 *   - `sequenceFreeFloat` — MIN: de striktste (kleinste) vrije speling over alle synthetische
 *     instanties van dezelfde originele relatie representeert de relatie als geheel (0 ⇒ minstens
 *     één instantie is driving, consistent met `drivingSequenceIds`).
 *   - `truncatedLeadSequenceIds` / `outOfSequenceSequenceIds` — dedup: een VERZAMELING van originele
 *     ids, geen optelling — dat optellen was precies de N×-tellerbug in de StatusBar.
 *   - `droppedSequenceIds` — dedup, defensief: de solver-eigen 489a9ef2-guard opereert op de
 *     GEËXPANDEERDE set; een synthetische id zou daar in theorie nooit in mogen voorkomen (elke
 *     synthetische relatie wijst naar een echte bladtaak-id), maar folden is hier goedkoop en
 *     ontneemt elke twijfel.
 *
 * Idempotent: `originalSequenceId` is een no-op op een id zonder `::exp-N`-suffix, dus een resultaat
 * dat al gevouwen is (of nooit geëxpandeerde invoer had) verandert niet bij een herhaalde aanroep.
 */
export function foldSyntheticSequenceIds(result: CPMResult): void {
  result.drivingSequenceIds = dedupOriginal(result.drivingSequenceIds);
  result.truncatedLeadSequenceIds = dedupOriginal(result.truncatedLeadSequenceIds);
  result.outOfSequenceSequenceIds = dedupOriginal(result.outOfSequenceSequenceIds);
  if (result.droppedSequenceIds) {
    result.droppedSequenceIds = dedupOriginal(result.droppedSequenceIds);
  }

  const foldedFreeFloat: Record<string, number> = {};
  for (const [id, freeFloat] of Object.entries(result.sequenceFreeFloat)) {
    const orig = originalSequenceId(id);
    foldedFreeFloat[orig] = orig in foldedFreeFloat
      ? Math.min(foldedFreeFloat[orig], freeFloat)
      : freeFloat;
  }
  result.sequenceFreeFloat = foldedFreeFloat;
}

// Triple-verificatie-workflow voor Open Planner Studio (zie docs/TODO.md,
// "Kwaliteit & verificatie"). Vóór gebruik: ROOT en TMP hieronder aanpassen aan
// de sessie (repo-checkout resp. een eigen tmp-map), de release-verwijzing in
// meta/GUARD actualiseren, en de AREAS-prompts bijwerken naar de dan geldende
// featureset. Aanroepen via de Workflow-tool met dit bestand als scriptPath.
export const meta = {
  name: 'triple-verify',
  description: 'Uiterst grondige triple-verificatie (1 Opus + 2 Sonnet per onderdeel + Opus-rechter)',
  phases: [
    { title: 'Verify', detail: '8 onderdelen x 3 onafhankelijke controleurs (opus+sonnet+sonnet), identieke opdracht' },
    { title: 'Judge', detail: 'per onderdeel een Opus-rechter die de 3 rapporten adversarieel weegt' },
  ],
}

const ROOT = '/home/nozzit/Impertio/open-aec/OPS/open-planner-studio' // <-- aanpassen aan de sessie-checkout
const TMP = '/tmp/ops-triple-verify' // <-- aanpassen: eigen tmp-map van de sessie

const GUARD = `Je bent een onafhankelijke VERIFICATIE-agent voor Open Planner Studio (release v2026.7.3, net gepubliceerd).
HARDE REGELS: (1) Werk in ${ROOT} — verifieer met \`git rev-parse --show-toplevel\`. (2) STRIKT READ-ONLY in de repo: geen Write/Edit/rm op enig repo-bestand, geen commits, geen git-statuswijzigingen. (3) Eigen probe-scripts/outputs UITSLUITEND in je eigen map: ${TMP}/verify/<jouw-tag>/ (maak die aan; andere agents draaien parallel — blijf uit hun mappen). (4) Geen dev-servers starten/stoppen; er draait al een browser-dev-server op poort 3007 (alleen de UI-opdracht gebruikt die). (5) \`bash tests/planning/run.sh\` en \`npx tsc --noEmit\` draaien mag. (6) Headless probes tegen de echte store/engine: bouw ze naar het esbuild-patroon van tests/planning/run.sh (echte store, echte solver — kijk in tests/planning/harness.ts hoe dat werkt).
HOUDING: je bent een skeptische auditor. Zoek actief naar wat er MIS is; "alles OK" mag alleen na aantoonbare, uitgevoerde checks. Reken verwachtingen MET DE HAND uit vóór je een probe draait — een verwachting overgenomen uit de implementatie-output is waardeloos. Referentiedocs: CLAUDE.md (architectuurregels) en docs/superpowers/specs/2026-07-03-resources-design.md (vastgesteld ontwerp fase 2.5). Elke bevinding: concreet faalscenario + bestand:regel of repro-stappen.`

const AREAS = [
  {
    key: 'cpm',
    title: 'CPM-kern & kalenders',
    prompt: `ONDERDEEL: de CPM-kern — src/engine/scheduler/CPMSolver.ts + CalendarEngine.ts, incl. constraints (fase 2.3), mijlpaal-soorten (2.4, boundary-model) en de levelingDelay-hook (2.5).
CHECK ALLES rond dit onderdeel: (a) forward/backward pass-correctheid: reken minstens 4 eigen scenario's met de hand door (mix van FS/SS/FF/SF, lags incl. ELAPSEDTIME en %-lag, kalender met feestdagen, start-/eindmijlpalen, een FNLT-constraint met negatieve float, een levelingDelay) en toets ze met eigen headless probes tegen de echte solver; (b) float/kritiek pad/driving-logica; (c) randgevallen: duur 0 niet-mijlpaal, taak eindigend exact voor een feestdagenblok (bouwvak!), constraint op een mijlpaal, levelingDelay op een taak met constraint, cycli in relaties (nette fout?); (d) CalendarEngine-API-consistentie (addWorkDays inclusief-regels vs addWorkingDaysSigned); (e) dekken de bestaande cases in tests/planning/ dit onderdeel representatief — noem concrete gaten; (f) draai de hele suite en tsc ter bevestiging.`,
  },
  {
    key: 'load',
    title: 'Resource-belasting & curves',
    prompt: `ONDERDEEL: de belasting-engine — src/engine/scheduler/ResourceLoad.ts (distributeUnits, computeResourceLoad) + de recomputeResourceLoad/scheduleStale-verversing in de slices.
CHECK ALLES: (a) distributeUnits: som-exactheid (grootste-rest) voor gekke inputs — fractionele units (1.333), lange duren (60d), D=1, D=2 (gedocumenteerde vervlakking), alle 6 curves; reken 3 verdelingen met de hand na; (b) computeResourceLoad: leaf-only-filter, mapping buckets op projectkalender-werkdagen, capaciteit uit resource-kalender + availabilitySteps (stap die middenin een taak wisselt!), materiaal-overallocatie, CREW zonder rollup; (c) verversingsmatrix: welke mutaties verversen de load direct, welke zetten scheduleStale — verifieer minstens 6 paden headless (assign/updateResource/removeResourceCalendar/taakduur/undo/document-switch); (d) prestatie-sanity: 200 taken x 10 resources — geen kwadratische explosie die seconden kost? (e) suite + tsc.`,
  },
  {
    key: 'leveler',
    title: 'Nivellering & smoothing',
    prompt: `ONDERDEEL: de nivelleerder — src/engine/scheduler/ResourceLeveler.ts + applyLeveling/clearLeveling/levelResources in scheduleSlice + LevelingDialog-preview-data.
CHECK ALLES: (a) serieel SGS: prioriteit(1000=pin)/float/ES/aanmaakvolgorde-sortering, eligibility-lus, leeg grootboek met vooraf geboekte pins, PF-semantiek (delay t.o.v. precedence-feasible start — GEEN dubbeltelling in kettingen: reken een A-schuift→B-volgt-ketting met de hand door); (b) preview-eerlijkheid: projectEndBefore/After en shifts uit de proef-solve, incl. niet-geresourcete opvolgers; preview is puur (geen store-mutatie); (c) smoothing (constrainToFloat): einddatum heilig, onoplosbaar → unresolved met juiste reden (CALENDAR_MISMATCH/INSUFFICIENT_CAPACITY/INTRINSIC_OVERRUN — test alle drie); (d) curve-bewust nivelleren (front vs back-loaded overlap); (e) apply idempotent, één undo-snapshot herstelt alles incl. cpmResult/resourceLoadResult; her-nivelleren na duurwijziging zonder F5 gebruikt verse floats; (f) materiaal nooit genivelleerd; multi-resource-taak schuift als geheel; (g) verzin 2 eigen gemene scenario's die de 240 cases NIET dekken en toets ze headless met hand-berekende verwachtingen; (h) suite + tsc.`,
  },
  {
    key: 'state',
    title: 'State-management & documenten',
    prompt: `ONDERDEEL: de Zustand/Immer-store — src/state/ (alle slices, snapshot.ts, appStore), multi-document, undo/redo, recovery/auto-save-flow (App.tsx), dirty-tracking.
CHECK ALLES: (a) undo/redo: elke mutatie-actie pusht exact één snapshot (loop de slices na — ook de nieuwe resource/kalender/leveling-acties); undo herstelt ALLES consistent (taken+resources+resourceCalendars+cpmResult+resourceLoadResult+scheduleStale) — verifieer headless met een mutatie-reeks + undo-alles + diepe vergelijking met de beginstate; (b) multi-document: capture/hydrate-payload volledig (geen veld dat achterblijft — vergelijk DocumentPayload-velden met de top-level state die geswapt hoort te worden), switch/new/close, taskClipboard app-globaal; (c) recovery: nieuwe RecoveryDialog-flow in App.tsx — auto-save-poort dicht tot keuze, uitstel laat bestanden staan, isTauri-gating (geen top-level Tauri-imports — grep); (d) isDirty-dekking: welke acties vergeten hem? (e) leaf-only-invariant: kan een assignment op een parent ontstaan via indent van een taak ONDER een taak met assignments? — test dat scenario expliciet headless; (f) suite + tsc.`,
  },
  {
    key: 'ifc',
    title: 'IFC round-trip',
    prompt: `ONDERDEEL: het native bestandsformaat — src/services/ifc/ifcWriter.ts + ifcReader.ts, alle OPS_-psets (Constraints/Milestone/Resource/Assignments/Leveling), 13-args IfcTask + legacy-12-args-lezer, resource-kalenders via IfcRelAssignsToControl, IfcRelNests-ploegen.
CHECK ALLES: (a) volledige round-trip: bouw headless een maximale projectstate (alle taakvelden, alle 5 resourcetypes, ploeg-leden, resource-kalender, availabilitySteps, dubbele assignment van dezelfde resource met verschillende curves, prioriteit 0 én 1000, levelingDelay, constraints+deadline, mijlpaal-soorten+mandatory, activity codes, custom fields) → write→read→diep vergelijken op ELK veld; daarna write→read→write byte-stabiel; (b) gouden regel: kaal project → geen enkele nieuwe pset/entiteit; (c) legacy: construeer met de hand een oud-formaat-fragment (12-args IFCTASK, kale-GUID-assignments, availability-veld) en bewijs correcte inlezing; (d) vijandige inputs: resourcenaam met apostrof/puntkomma/unicode, lege strings, availabilitySteps-encoding met rare datums — round-trippen ze of corrumperen ze stil; (e) laad de 3 showcase-examples (examples/) door de reader en check feature-behoud; (f) suite + tsc.`,
  },
  {
    key: 'adapters',
    title: 'P6/MSPDI/CSV-adapters',
    prompt: `ONDERDEEL: de uitwisselformaten — src/services/p6/ (p6xmlWriter/Reader), src/services/msproject/ (mspdiWriter/Reader), src/services/csv/.
CHECK ALLES: (a) P6: Resource/ResourceAssignment/ResourceRate/Calendar-elementen, units als FRACTIE (1.0=100% — verifieer beide richtingen en dat maxUnits/unitsPerDay NIET meer met hoursPerDay vermenigvuldigd worden), curve-naam-mapping, ParentObjectId-ploegen, CalendarObjectId-verwijzingen kloppen (geen hardcoded 1); (b) MSPDI: Type 0/1, MaxUnits/Units als float, WorkContour-enum, MaterialLabel, CalendarUID + Calendars-sectie, StandardRate, Work in PT-formaat, priority-0-behoud (geen ||-valkuil — grep alle adapters op dat patroon); (c) round-trip write→read per formaat headless met diepe vergelijking BINNEN de gedocumenteerde verliesmatrix (ontwerpdoc §8.4) — en flag alles wat buiten de matrix om verloren gaat; (d) CSV: bewust resource-loos — klopt dat nog en breekt hij niet op taken met nieuwe velden; (e) XML-veiligheid: taak/resourcenamen met <, &, aanhalingstekens — escaped in writer én reader? (f) tsc.`,
  },
  {
    key: 'ui',
    title: 'UI in de browser',
    prompt: `ONDERDEEL: de complete UI, live in de browser op http://localhost:3007 (draait al — NIET herstarten).
SETUP: eigen map ${TMP}/verify/<jouw-tag>/, \`npm init -y && npm i playwright-core\`, chromium uit ~/.cache/ms-playwright (nieuwste map, chrome-linux/chrome), eigen headless browser-instantie. Scenario's bouwen via window.__OPS__ (store) + ECHTE muis-events; screenshots in je eigen map en ZELF bekijken (Read).
CHECK ALLES: (a) Resources-flow end-to-end: resource aanmaken (paneel), toewijzen (popover mét units/curve), histogram aan → direct zichtbaar zonder F5, overallocatie rood, drill-down-klik; (b) nivelleer-dialoog: berekenen→preview (einddatum-regel, verschoven taken)→toepassen→undo (Ctrl+Z: alles terug incl. histogram)→nivellering wissen; (c) staleness-hint: duurwijziging→hint zichtbaar, F5→weg; (d) Voorbeelden: backstage→showcases bovenaan met badge, basics gelabeld, "Woonblok De Hoven" opent en toont overallocatie; (e) validatie: negatieve/0 units geweigerd met rode rand, resource-verwijderen met assignments vraagt bevestiging; (f) mijlpalen/constraints-UI (2.3/2.4-regressie): mijlpaal-dropdown, constraint+deadline zetten, indicator; (g) thema donker + licht op histogram/paneel, locale de/ar spot-check (past alles, RTL spiegelt), compacte ribbon-pijltje; (h) console-errors verzamelen over ALLES. Elke check: screenshot als bewijs + eigen visueel oordeel.`,
  },
  {
    key: 'examples',
    title: 'Voorbeelden & generator',
    prompt: `ONDERDEEL: de voorbeeldprojecten en hun generator — scripts/gen-core.ts, scripts/showcases.ts, scripts/example-topologies.json, scripts/run-ts.mjs, examples/*.ifc (20), public/examples/ (8 + manifest.json v2), npm run gen:examples / verify:examples.
CHECK ALLES: (a) draai \`npm run verify:examples\` en beoordeel wat het ECHT bewijst (lees het verificatiescript kritisch — toetst het features of alleen tellingen?); (b) laad alle 23 bestanden headless door readIFC: parse, tellingen, en per showcase de geclaimde features aantoonbaar aanwezig (constraints, negatieve float na runCPM, mijlpaal-soorten, alle 5 resourcetypes, curves, oplosbare overallocatie — draai runCPM en check dat de overallocatie er is én dat levelResources hem kan oplossen); (c) inhoudelijke bouwlogica-steekproef op 3 basisvoorbeelden: kloppen volgordes en is het kritieke pad realistisch (55-86% geclaimd — verifieer op die 3); (d) jaar-onafhankelijkheid: wat gebeurt er bij regenereren volgend jaar — is het anker echt relatief en de feestdagenset per jaar correct (Pasen-algoritme steekproef 2027/2028 tegen bekende data); (e) manifest consistent met bestanden (elk genoemd bestand bestaat, categorieën kloppen, geen wezen in public/); (f) is de oude drift-generator overal echt weg (grep) en staat gen:examples in package.json; (g) REGENEREER NIETS (read-only).`,
  },
]

const FINDINGS_SCHEMA = {
  type: 'object',
  required: ['verdict', 'checksPerformed', 'findings'],
  properties: {
    verdict: { type: 'string', enum: ['OK', 'ISSUES_FOUND'] },
    checksPerformed: { type: 'array', items: { type: 'string' }, description: 'Elke daadwerkelijk uitgevoerde check, kort' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['severity', 'title', 'detail'],
        properties: {
          severity: { type: 'string', enum: ['BLOKKEREND', 'HOOG', 'MIDDEL', 'LAAG'] },
          title: { type: 'string' },
          detail: { type: 'string', description: 'faalscenario + bestand:regel of repro' },
          evidence: { type: 'string', description: 'hoe aangetoond (probe-uitkomst, handberekening, screenshot-pad)' },
        },
      },
    },
    notes: { type: 'string' },
  },
}

const JUDGE_SCHEMA = {
  type: 'object',
  required: ['area', 'confirmed', 'rejected', 'verdictLine'],
  properties: {
    area: { type: 'string' },
    confirmed: {
      type: 'array',
      items: {
        type: 'object',
        required: ['severity', 'title', 'detail', 'agreement'],
        properties: {
          severity: { type: 'string', enum: ['BLOKKEREND', 'HOOG', 'MIDDEL', 'LAAG'] },
          title: { type: 'string' },
          detail: { type: 'string' },
          agreement: { type: 'string', description: 'welke controleurs het vonden/bevestigden (bv. opus+sonnetB) en jouw eigen verificatie' },
        },
      },
    },
    rejected: { type: 'array', items: { type: 'object', required: ['title', 'reason'], properties: { title: { type: 'string' }, reason: { type: 'string' } } } },
    coverageGaps: { type: 'array', items: { type: 'string' }, description: 'checks die geen van de drie deed maar wel hadden gemoeten' },
    verdictLine: { type: 'string', description: 'een zin: eindoordeel voor dit onderdeel' },
  },
}

function finderPrompt(area, tag) {
  return `${GUARD}\n\nJOUW TAG: ${area.key}-${tag} (gebruik ${TMP}/verify/${area.key}-${tag}/ voor al je bestanden).\n\n${area.prompt}\n\nLever je eindresultaat via het gestructureerde outputformaat: verdict, de volledige lijst uitgevoerde checks, en alle bevindingen met ernst/detail/bewijs. Wees eerlijk over wat je NIET hebt kunnen checken (zet dat in notes).`
}

phase('Verify')
log('Triple-verificatie gestart: 8 onderdelen x (1 opus + 2 sonnet) + 8 opus-rechters')

const results = await pipeline(
  AREAS,
  (area, _orig, i) =>
    parallel([
      () => agent(finderPrompt(area, 'opus'), { label: `verify:${area.key}:opus`, phase: 'Verify', model: 'opus', schema: FINDINGS_SCHEMA }),
      () => agent(finderPrompt(area, 'sonnetB'), { label: `verify:${area.key}:sonnetB`, phase: 'Verify', model: 'sonnet', schema: FINDINGS_SCHEMA }),
      () => agent(finderPrompt(area, 'sonnetC'), { label: `verify:${area.key}:sonnetC`, phase: 'Verify', model: 'sonnet', schema: FINDINGS_SCHEMA }),
    ]),
  (three, area) => {
    const reports = (three || []).filter(Boolean)
    if (reports.length === 0) throw new Error(`geen rapporten voor ${area.key}`)
    return agent(
      `${GUARD}\n\nJij bent de RECHTER voor onderdeel "${area.title}" (${area.key}). Drie onafhankelijke controleurs (1 opus, 2 sonnet) kregen exact dezelfde opdracht:\n---OPDRACHT---\n${area.prompt}\n---EINDE OPDRACHT---\n\nHun drie rapporten (volgorde: opus, sonnetB, sonnetC; ontbrekende = uitgevallen):\n${JSON.stringify(reports, null, 1)}\n\nWEEG ADVERSARIEEL: (1) elke bevinding die minstens een controleur meldt — verifieer hem ZELF in de code/met een eigen probe voordat je hem bevestigt (jouw tag: ${area.key}-judge, eigen map ${TMP}/verify/${area.key}-judge/); een bevinding die maar een van de drie zag is verdacht maar kan juist de echte zijn; (2) bevindingen die elkaar tegenspreken: zoek zelf uit wie gelijk heeft; (3) 'OK'-verdicts: toets of de checksPerformed-lijst de opdracht echt dekt — benoem dekkingsgaten die alle drie lieten liggen (en doe de belangrijkste ontbrekende check ZELF); (4) wees streng op bewijs: een bevinding zonder repro/handberekening die jij niet kunt reproduceren gaat naar rejected. Lever via het gestructureerde formaat.`,
      { label: `judge:${area.key}`, phase: 'Judge', model: 'opus', schema: JUDGE_SCHEMA }
    )
  }
)

const judged = results.filter(Boolean)
const allConfirmed = judged.flatMap(j => (j.confirmed || []).map(f => ({ area: j.area, ...f })))
const bySev = {}
for (const f of allConfirmed) bySev[f.severity] = (bySev[f.severity] || 0) + 1
log(`Klaar: ${judged.length}/8 onderdelen beoordeeld; bevestigde bevindingen: ${JSON.stringify(bySev)}`)

return {
  areas: judged.map(j => ({ area: j.area, verdict: j.verdictLine, confirmed: j.confirmed, rejected: j.rejected, coverageGaps: j.coverageGaps })),
  totals: bySev,
  confirmedFindings: allConfirmed,
}
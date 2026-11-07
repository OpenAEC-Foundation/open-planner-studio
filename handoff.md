# Handoff — gebouwmodel behouden + IFCX (#804)

Bijgewerkt: 2026-11-07 18:18 CET. Dit bestand is de bron bij compactie en voor Trias. Houd het actueel bij elke stap.
Gaat vóór de merge van de laatste PR naar `docs/archive/handoffs/`.

## Waar het staat (gewone taal)

Het voorlopig ontwerp is klaar en staat in draft PR #839. In ronde 1 gaf Fable een 7 en Opus een 6.
Sol is nog bezig. Daarna verwerk ik alle punten in het ontwerp, volgen nieuwe rondes tot elk lid een 9 geeft,
en dan begint de bouw.

## Doel van de sessie (Ethan, 2026-11-07)

- **IFCX volledig inbouwen** in deze sessie: openen en opslaan, alles uit de checklist van #804. Niet alleen ontwerpen
  (correctie door Ethan, 2026-11-07, na mijn verkeerde samenvatting).
- **Alles wat geen planning is, blijft bewaard** in het bestand: het gebouwmodel en gegevens van andere programma's.
  In het huidige IFC (IFC4/IFC4X3, STEP) én in IFCX.
- Eerst een ontwerp door de council (Opus, Sol, Fable), doelcijfer 9. **Fable op high, niet xhigh** (Ethan).
- "IFC CA" in het voicetranscript = de repo `OpenAEC-Foundation/ifccad` (Ethan, bevestigd).
- Ethan is zelf geen fan van IFCX, maar het moet: de aanvrager (DutchSailor, #804) wil het.

## Besluiten

| Besluit | Wie, wanneer | Bron |
|---|---|---|
| #804 wordt gebouwd, IFC + IFCX, model behouden | Ethan, 2026-11-07 | voicetranscript in deze sessie |
| Council mag; Fable high | Ethan, 2026-11-07 | idem |
| Doel = volledig bouwen in deze sessie | Ethan, 2026-11-07 | correctie in deze sessie |
| Handoff.md constant bijhouden | Ethan, 2026-11-07 | deze sessie |

Open besluiten voor Ethan staan in §10 van de spec. Leg ze één voor één voor, met voorbeeld en aanbeveling.

## Werk

- Branch: `t3/ifc-building-model-support`, worktree `/home/aia09/.t3/worktrees/open-planner-studio/t3-ee8453c4`.
- Draft PR: https://github.com/OpenAEC-Foundation/open-planner-studio/pull/839 (gelinkt aan de thread).
- Spec: `docs/superpowers/specs/2026-11-07-gebouwmodel-behouden-ifc-ifcx-design.md` (commit `07968697d`),
  ook in `docs/superpowers/README.md`.

## Council

| Ronde | Opus 5.5 (xhigh) | GPT-6.1-Sol (xhigh) | Fable 5.1 (high) |
|---|---|---|---|
| 1 | 6 | loopt | 7 |

Hoe ze draaien: Sol en Fable via T3 `delegate_task`. Opus via T3 faalde twee keer ("timed out while registering its
MCP tools"); nu via de native `Agent`-tool (subagent `reviewer`, model opus, effort xhigh). Doe dat ook in latere rondes.
Elke ronde: nieuwe taak per lid, met de samenvatting van de vorige ronde. Wijzig de spec niet terwijl een ronde loopt.

### Ronde 1 — Fable (7/10), te verwerken

1. Projectcontext (IfcProject, OwnerHistory-keten, units) moet wél geparsed worden maar vreemd blijven: een derde klasse
   "context, alleen lezen". Anders verliest de lezer projectnaam en project-id (`ifcReader.ts:1377-1405`).
2. Aanhangsels: elke vreemde entiteit die naar een eigen entiteit verwijst (ook werkplan, kalender, resource), per
   verwijzing herschrijven of uit de lijst halen; gemengde lijsten (wanden + taken). Voorbeeld `IfcRelDeclares` naar
   `IfcWorkPlan` van IfcOpenShell. Regel voor dubbelen (writer schrijft zelf `IfcRelDeclares`, `ifcWriter.ts:825`).
3. Byte-gelijk vereist lezen als bytes (`readFile`, `Uint8Array`), niet `readTextFile`/`file.text()`
   (`tauriBackend.ts:22`, `webBackend.ts:124`). Hash op bytes.
4. "Regel" definiëren: entiteit-instantie van `#` tot `;`; STEP-commentaar vervalt (`ifcReader.ts:1063-1079`).
5. `dataVersion` is de datasetversie (IFC5); niet misbruiken. Compatibiliteit op `ops::document.formatVersion`.
6. IFCX: indelen per attribuut, niet per entry; vreemde attributen op een eigen pad bewaren.
7. Grootte-grens: Tauri op Linux/macOS = WebKit (JSC), niet V8. Grens pas na meting; op bytes; uitvoer in blokken.
8. Scanner moet ook synchroon draaien (crashherstel, headless MCP op Node zonder Worker).
9. Scanner moet de Name van psets wel lezen (OPS_-psets herkennen).
10. Bron fout: commit van de weigering is `5b2812f94` (niet `5dfabb38b`, dat is een merge). Knownbug 110 staat niet
    meer in `knownbugs.md`; verwijs naar PR #547.
11. Inschatting fase 1–2 te laag; `ops::`-schema's uit de typen genereren; diepte van de schema's kiezen.
12. `openaec::activity`/`openaec::links` (ifcx-explorer) als afgeleide kopie eerder, in fase 3.

### Ronde 1 — Opus (6/10, "nog niet bouwen"), te verwerken (overlap met Fable niet herhaald)

1. §4.2 spreekt §4.3 tegen (regel 3 vs aanhangsels) en is kip-en-ei (regel 2 vereist de lezer). Maak een sluitende
   regeltabel: wortels, gesloten lijst typen voor de afsluiting, rel is eigen alleen als al zijn objecten eigen zijn,
   gemengde rel = aanhangsel; regel 3 alleen voor niet-wortels. Zelfcontrole: uitvoer opnieuw inlezen en vergelijken
   (planning = geheugen, vreemd = bron). De telcontrole "vervallen = gemeld" schrappen (altijd waar).
2. Projectnaam/auteur/bedrijf in modelmodus in `OPS_ProjectSettings` vastleggen en daar eerst lezen
   (lezer leest naam alleen uit IfcProject, `ifcReader.ts:1377/1409-1423`; id is zout voor hulp-GlobalIds, `ifcWriter.ts:343`).
3. Herstel zonder model: Opslaan en AutoSave naar het bestand blokkeren, alleen Opslaan als; model eerst opnieuw
   laden uit het bronbestand als sha256 klopt.
4. Per aanroeper van `writeIFC` vastleggen wat er gebeurt: MCP-backup (`backupService.ts:312`, model tientallen keren
   op schijf), IFC-werkruimte (`IFCPanel.tsx:39-58` → `applyLoadedProject`/`payloadFromImport`, `fileSlice.ts:898`,
   model waarschijnlijk stil weg), echte AutoSave (`useAutoSave.ts:148`, hoofdthread).
5. `IfcRelAssignsToProduct` (§4.3 vs §4.4) botst; Bonsai: ToProduct = output, ToProcess = input. Voorstel: product-rels
   vreemd laten met omgezette verwijzingen; `elementLinks` = afgeleide, alleen-lezen `{richting, ref}`.
6. Planning van Bonsai/Synchro wordt verliesgevend herschreven: bronregel bewaren als object ongewijzigd, of eerlijk melden.
7. IFCX: paden niet met `/` laten beginnen (buildingSMART-composer knipt op `/`, `path.ts:2-11`); in modelmodus
   `imports` en `schemas` van de bron behouden (validator: "Missing schema"); IFCX-entries ook als bytes knippen,
   alleen entries met `"ops::` parsen → byte-gelijk gratis, open besluit 2 vervalt; risico fase 4 = middel.
8. Grens: begin lager (150 MB), meten in fase 1; besluit 4 eruit (meting, geen besluit).
9. Scanner: complexe instanties `#n=(A(..)B(..));` (huidige `readEntity` slaat ze stil over, `ifcReader.ts:982-985`);
   tussenruimte (CRLF, commentaar) van vreemde stukken meenemen (writer plakt met `'\n'`, `ifcWriter.ts:287`).
10. De weigering pas in de laatste PR van fase 2 weghalen (main gaat wekelijks uit). Bij falen zelfcontrole: uitweg
    "Exporteren zonder gebouwmodel".
11. IFC2X3 eerlijk noemen (vaak standaard bij Revit/ArchiCAD in NL); kopnamen `IFC4X3_ADD1`/`IFC4X3_TC1`
    (`readFileSchema`, `ifcReader.ts:1105-1107`, geeft `undefined`). IFCCAD `preservation.md` gaat over CAD, niet IFC.
12. Eén regel i.p.v. twee modi: "schrijf een eigen IfcProject alleen als het vreemde deel er geen heeft". Dan vervalt ook
    het huidige stille verlies van vreemde niet-productdata in planningsbestanden.
13. Niet nagelopen door Opus: geld/tijd-eenheden in modelmodus (`IFCMONETARYMEASURE` zonder eigen unit assignment).

## Vastgestelde feiten (voor na compactie)

- Weigering gebouwmodel: `src/services/ifc/ifcReader.ts:178-185`, lijst `ifcBuildingModelTypes.ts`
  (gegenereerd door `scripts/ifc-product-types.py`). PR #547, commit `5b2812f94`.
- Writer schrijft alles van nul: `ifcWriter.ts:317` e.v.; vaste entiteiten (units, context, IfcProject) `:395-410`;
  ids via teller `ctx.nextId`. Lezer gebruikt `IFCRELASSIGNSTOPROCESS` voor resources (`ifcReader.ts:3473`) en gooit
  producten daarin stil weg (`:3487-3490`).
- Voorbeeld voor groot bronblok buiten undo: `xerSourceArchive` (`documentContract.ts:298`, `snapshot: 'none'`),
  herstel met verwijzing `xerSourceArchiveStorage: 'recovery-reference'` (`recoverySnapshotInput.ts`).
- Formaatregister: `src/services/formatRegistry.ts:142` (`id: 'ifc'`).
- IFC5 (buildingSMART, commit `1a63082`, 2026-09-08): `ifcx_alpha`; header id/ifcxVersion/dataVersion/author/timestamp;
  imports = lagen (`layer-stack.ts`), later wins per attribuut (`compose.ts`); geen planningsschema's.
- Ecosysteem: allen `ifcx_alpha`; eigen namespace per programma (`ocss::`, `oses::`, `openbim::`, `openaec::`);
  ifcx-explorer heeft `openaec::activity` + `openaec::links` (`relation: schedules`); UUID v5 = GlobalId (128 bits).
- IFCCAD: alleen IFCX/CBOR; bewaart bronbytes; projectie nooit als verliesvrij tonen; geen STEP.
- Gerelateerd: #748 (4D-workflow, criterium 3 "geen stil verlies"), `docs/TODO.md` fase 4.1.

## Omgeving en valkuilen

- aia09-mp50 is zwaar belast door andere sessies (load ~45 op 8 cores, 2 GB vrij om 18:14). Eenvoudige commando's
  lopen soms over 120 s. Gebruik korte, gerichte commando's.
- Deze worktree heeft geen `node_modules`: `verify:docs` draait hier niet. CI op de PR controleert.
- Clones van ecosysteem-repo's (alleen lezen):
  `/tmp/claude-1000/-home-aia09--t3-worktrees-open-planner-studio-t3-ee8453c4/ed17101e-1f1f-42d8-8b7b-bb2a1d7b5750/scratchpad/repos/`
- `gh issue view` faalt (Projects classic); gebruik `gh api repos/OpenAEC-Foundation/open-planner-studio/issues/<n>`.

## Volgende stappen

1. Wachten op Sol en Opus (ronde 1). Cijfers in PR #839 en hierboven.
2. Alle punten verwerken in de spec; doel "volledig bouwen" erin; bouwvolgorde fase 1–4; flag eraf bij oplevering.
3. Ronde 2, enz., tot elk lid ≥ 9.
4. Bouwen in kleine PR's naar `main`: worker (Opus medium) voor gewoon werk, expert (Opus xhigh) voor indeling
   eigen/vreemd, verliesbewaking en herstel. Review per PR door Sol (BLOKKEERT/VERVOLG). Machine: geen zware runs lokaal.

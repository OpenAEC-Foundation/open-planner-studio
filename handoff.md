# Handoff — gebouwmodel behouden + IFCX (#804)

Bijgewerkt: zie git log van dit bestand. Dit bestand is de bron bij compactie en voor Trias. Houd het actueel bij elke stap.
Gaat vóór de merge van de laatste PR naar `docs/archive/handoffs/`.

## Waar het staat (gewone taal)

Het ontwerp is herschreven na council-ronde 1 (Opus 6, Sol 6, Fable 7) en staat als versie 2 in draft PR #839.
Ronde 2 van de council beoordeelt nu versie 2. Daarna volgen rondes tot elk lid een 9 geeft. Dan begint de bouw,
met fase 0: een proef op echte bestanden.

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

Open besluiten voor Ethan: §11 van de spec (namespace `ops::`; `openaec::activity` meeschrijven). Eén voor één
voorleggen, met voorbeeld en aanbeveling, pas als de council klaar is.

## Werk

- Branch: `t3/ifc-building-model-support`, worktree `/home/aia09/.t3/worktrees/open-planner-studio/t3-ee8453c4`.
- Draft PR: https://github.com/OpenAEC-Foundation/open-planner-studio/pull/839 (gelinkt aan de thread).
- Spec: `docs/superpowers/specs/2026-11-07-gebouwmodel-behouden-ifc-ifcx-design.md`. v1 = `07968697d`, v2 = `270af9b96`.

## Kern van ontwerp v2 (voor na compactie)

- Eén route voor elk IFC-bestand. Lezen als **bytes**. Elk stuk (entiteit + tekst ervoor) in klasse
  **P** planning (opnieuw geschreven), **C** context (IfcProject, owner history, units: lezen, byte-gelijk),
  **A** aanhangsel (vreemd, verwijst naar P: byte-gelijk, behalve als een P-doel verwijderd is), **V** vreemd (byte-gelijk).
- Bestaande P-ids blijven staan; nieuwe ids boven het maximum van de bron. Daardoor blijven aanhangsels byte-gelijk.
- Zonder vreemd deel: de huidige writer, ongewijzigd.
- Ongewijzigd Bonsai/Synchro-object = bronstuk; gewijzigd = slot-samenvoeging (`ifcTaskSlots.ts`).
- Koppelingen taak↔bouwdeel blijven A; afgeleide alleen-lezen `elementLinks {direction, ref}`.
- Projectnaam e.d. met vreemde context in `OPS_ProjectSettings`.
- Controles vóór schrijven: bytes per stuk + opnieuw lezen. In CI ook IfcOpenShell.
- Herstel: bron per sha256; "bron ontbreekt" blokkeert Opslaan/AutoSave/MCP-export naar het oude doel.
- Tabel van alle tien `writeIFC`-aanroepers in spec §4.13.
- IFCX: `ifcx_alpha`; kop/imports/schemas van een ander blijven; profielversie alleen in `ops::document.formatVersion`;
  paden = kale UUID (= GlobalId-bits), geen voorloop-`/`; entries als bytes, alleen entries met `"ops::` parsen
  (getallen als tekst); eigendom per attribuut, volgorde behouden; compositiecontrole volgens IFC5 `compose.ts`.
- Flags `ifcForeignContent` en `ifcx` tijdens de bouw; weigering PR #547 blijft actief tot de flag eraf gaat.
- Fasen: 0 proef (corpus, meting, IfcOpenShell) → 1–2 STEP → 3 IFCX planning → 4 IFCX met vreemde inhoud.

## Council

| Ronde | Opus 5.5 (xhigh) | GPT-6.1-Sol (xhigh) | Fable 5.1 (high) |
|---|---|---|---|
| 1 (v1) | 6 | 6 | 7 |
| 2 (v2) | 6 | loopt | loopt |

### Ronde 2 — Opus (6/10), te verwerken in v3

Blokkeert: (1) klasse-regels maken van elk eigen bestand een bestand met vreemd deel (writer schrijft OwnerHistory-keten,
units, context, IfcProject, `IFCRELAGGREGATES` plan→schema, templates; die staan niet in de P-lijst) → afsluiting =
bereikbaarheid vanuit P-wortels, beperkt tot writer-typen, C alleen als ook niet-P ernaar verwijst; rel met alleen
P-leden = P; test "elk voorbeeld en elke writer-uitvoer = 100 % P". (2) Meerdere werkschema's: `:445` is
`collectIfcGlobalIds`, niet de taakkeuze; taken komen uit alle IFCTASK behalve baselinebomen (`:1749`, `3570-3612`) →
één gedeelde functie "welke taken neemt de app over" voor indeling én lezer; baselinebomen van Bonsai V. (3) Controle 2
faalt bij gewoon werk (nieuwe ids `seq-ifc-<GlobalId>`, `res-ifc-…` na herlezen) → canonieke vergelijking op GlobalId;
bij refs/GlobalIds alleen "geen nieuwe" t.o.v. bron. (4) `ifcSource` onveranderlijk → melding elke keer opnieuw, herstel
zegt "bron ontbreekt" na opslaan → na geslaagd opslaan wordt de uitvoer de nieuwe bron. (5) Slot-samenvoeging te smal:
criterium = writer schrijft alleen slots die de lezer naar een domeinveld vertaalt én die gewijzigd zijn; ook voor
IfcWorkPlan/IfcWorkSchedule (`ifcWorkControlSlots.ts`), resources (type PRODUCT→EQUIPMENT, `ifcConstants.ts:52-56`),
kalenders, sequences. (6) Leesbasis + stukken per object ontbreken in `ifcSource`; ids alleen behouden voor P met
GlobalId gekoppeld aan domeinobject (+ IfcTaskTime); test wordt "niet-P byte-gelijk + tweede opslaan byte-gelijk aan
eerste" (writer schrijft altijd plan, schema, kalender, `OPS_ProjectSettings`).
Verder: (7) A-stukken van `IfcRelAssignsToProcess/Product` wél parsen (richting, GlobalId); gemengde rel alleen splitsen
als toewijzingen van die taak gewijzigd zijn. (8) Bezit van de bytes: in `ifcSource` op de hoofdthread, kopie naar
scanner; samenvoeging met `subarray` op de hoofdthread. (9) Headless contracten bytes in/uit (`core/index.ts:53`,
`api.ts:120`, `nodeFs.ts:358`, `backupFs.ts:35`). (10) Controle 1 kan niet falen → per niet-P-stuk id+bytes+volgorde op
de scan van de uitvoer, directe bytevergelijking. (11) §4.5 richting omgedraaid; algemene regel lid/lege lijst/enkele
ref. (12) IFCX: compositiecontrole alle eigen bijdragen eruit; `openaec::activity` vereist `status`, schema meeschrijven;
`openaec::links` lezen voor koppelingen; "eigen pad" definiëren; kop van een ander niet aanraken (ook geen timestamp).
(13) Ontbrekende routes: `exportAs('ifc')` (`fileSlice.ts:1396-1399`), `exportProjectWithPool` (`:1474`), Recent
(`tauriBackend.ts:87-90`, `fileSlice.ts:1658`), `parseExternalSource` (`:1500`). (14) `OPS_ProjectSettings` blijft op
IfcProject (nieuwe P-rel naar C-project); naam/beschrijving al in IfcWorkPlan; alleen auteur/bedrijf nieuw. (15) Herstel-
manifest versie 6 (`recoveryManifest.ts:4`), opruimen kijkt alleen naar `xerArchive` (`recoveryStore.ts:378`).
Eruit: lezen van een bestand met alleen `openaec::activity`; schema-generator (handmatig + validatortest); JSON-parser
met getallen als tekst (eigen leden met tokenizer eruit knippen); sha256 per stuk.

Hoe ze draaien: Sol en Fable via T3 `delegate_task`. Opus via T3 faalde twee keer ("timed out while registering its
MCP tools"); daarom via de native `Agent`-tool (subagent `reviewer`, model opus, effort xhigh). Elke ronde: nieuwe taak
per lid, met de samenvatting van de vorige ronde. Wijzig de spec niet terwijl een ronde loopt. Ronde 1 duurde ~50 min
(machine zwaar belast).

Ronde 1, in het kort (alles verwerkt in v2, zie spec §12): tegenstrijdige indeling eigen/vreemd; projectcontext; lezen
als bytes; herstel zonder model kon het modelbestand overschrijven; niet alle `writeIFC`-routes; `IfcRelAssignsToProduct`
dubbel; Bonsai-attributen; IFCX `dataVersion`, paden met `/`, imports/schemas, eigendom per entry, volgorde,
getalprecisie; grens zonder meting; inschatting te optimistisch; foute commit in de bronnen.

## Vastgestelde feiten

- Weigering gebouwmodel: `src/services/ifc/ifcReader.ts:178-185`, lijst `ifcBuildingModelTypes.ts`
  (gegenereerd door `scripts/ifc-product-types.py`). PR #547, commit `5b2812f94`.
- Writer: `ifcWriter.ts:317` e.v.; vaste entiteiten `:395-410`; ids via teller `ctx.nextId`; regels met `'\n'` (`:287`).
  Schrijft alleen `OPS_*`-psets.
- Lezer: projectnaam/id/auteur uit IFCPROJECT + eerste owner history (`:1377-1423`); eerste live-werkschema (`:445`);
  producten in `IFCRELASSIGNSTOPROCESS` stil weg (`:3487-3490`); complexe instanties overgeslagen (`:982-985`);
  `readFileSchema` kent `ADD1`/`TC1` niet (`:1105-1107`).
- `writeIFC`-aanroepers: fileSlice, useAutoSave, recoverySnapshotInput, mcp/backupService, mcp/tools/fileTools,
  IFCPanel, core/index, library/libraryIfc, benchmark/runner, devBridge.
- Voorbeeld voor bronblok buiten undo: `xerSourceArchive` (`documentContract.ts:298`) + `'recovery-reference'`.
- IFC5 (buildingSMART `1a63082`): `ifcx_alpha`; imports = lagen; later wins per attribuut; geen planningsschema's.
- Ecosysteem: `ifcx_alpha`; namespace per programma (`ocss::`, `oses::`, `openbim::`, `openaec::`); ifcx-explorer
  `openaec::activity` + `openaec::links`; UUID v5 = GlobalId (128 bits). IFCCAD: alleen IFCX/CBOR, bewaart bronbytes.

## Omgeving en valkuilen

- aia09-mp50 is zwaar belast door andere sessies (load ~45 op 8 cores, 2 GB vrij om 18:14). Korte, gerichte commando's.
- Deze worktree heeft geen `node_modules`: `verify:docs` draait hier niet. CI op de PR controleert.
- Clones van ecosysteem-repo's (alleen lezen):
  `/tmp/claude-1000/-home-aia09--t3-worktrees-open-planner-studio-t3-ee8453c4/ed17101e-1f1f-42d8-8b7b-bb2a1d7b5750/scratchpad/repos/`
- `gh issue view` faalt (Projects classic); gebruik `gh api repos/OpenAEC-Foundation/open-planner-studio/issues/<n>`.
- Trias (wrakko) is op de hoogte van dit bestand (bericht 2026-11-07 ~18:20).

## Volgende stappen

1. Ronde 2 afwachten; cijfers hier en in PR #839.
2. Verwerken, ronde 3, enz., tot elk lid ≥ 9.
3. Open besluiten §11 één voor één aan Ethan.
4. Bouwen: fase 0 eerst. Kleine PR's naar `main`; worker (Opus medium) voor gewoon werk, expert (Opus xhigh) voor
   scanner/indeling, verliesbewaking en herstel. Review per PR door Sol (BLOKKEERT/VERVOLG). Geen zware runs lokaal.

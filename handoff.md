# Handoff — #804 fase 0: haalbaarheidsproef

Dit bestand is de bron bij compactie en voor Trias. Houd het actueel bij elke stap. Gaat vóór de merge naar
`docs/archive/handoffs/`.

## Waar het staat (gewone taal)

Het ontwerp voor #804 is gemerged in main via #839 en staat nu op versie 20. Fase 0 is gebouwd: een proef op echte
bestanden die bewijst dat de app bij een eigen bestand precies het eigen deel herkent (de 100 %-P-poort), en die de
vragen van §11 beantwoordt. Wrakko besliste over drie afwijkingen; die staan in de spec en in de poort. De PR (#863) is
nog draft. Eerst moet de nieuwe workflow `ifc-foreign` een keer groen draaien; daarna start wrakko de review van Sol.

## Bronnen

- Ontwerp: `docs/superpowers/specs/2026-11-07-gebouwmodel-behouden-ifc-ifcx-design.md` (gemerged in main, `b51e6eaa1`).
  Fase 0: §8, §10 (corpus en poort), §11 (vragen).
- Uitkomsten van fase 0: `docs/superpowers/evidence/2026-11-ifc-fase0.md` (poort, antwoorden op §11, afwijkingen).
- Draaiboek van de ontwerpsessie: `docs/archive/handoffs/HANDOFF-2026-11-07-gebouwmodel-ifcx.md`.
- Voorproef in Python: `scripts/proef/classify-v9.py`.

## Afspraken

| Afspraak | Wie, wanneer |
|---|---|
| Fase 0 op een eigen branch vanaf `main`; review pas na de merge van #839 | Trias (wrakko), 2026-11-07 |
| Geen Fable, ook niet als subagent of in een council, tot Fable 5.5 uit is; een council draait met Opus en Sol | Ethan, 2026-11-09 |
| `place_file_exclusive(from, to)` mag in fase 2, met de voorwaarden in §11; in fase 0 geen Rust-commando | wrakko, 2026-11-09 |
| Na fase 0: (a) oud eigen bestand met los `IfcProject` als model zonder planning; (b) `Creators` constant `#`-slot; (c) alleen het eerste live-schema is D. Technisch, volgt uit Ethans besluit; geen council-ronde | wrakko, 2026-11-09 |
| Review per PR door Sol (BLOKKEERT/VERVOLG); VERVOLG naar `knownbugs.md` | werkwijze |
| Geen zware runs lokaal (volledige suite, Rust, veel Playwright, metingen van grote bestanden): CI | AGENTS.md |

## Werk

- Branch `feat/804-fase0-proef`, worktree `/home/aia09/.t3/worktrees/open-planner-studio/feat-804-fase0-proef`.
  `node_modules` is een link naar `kb-tests/node_modules` (zelfde package-lock).
- 2026-11-09 17:35: worktree gemaakt; bouwer (expert, Opus xhigh) gestart.
- 2026-11-09: #839 gemerged in main (`b51e6eaa1`); main gemerged in deze branch (`80412090e`).
- 2026-11-09: bouwer klaar. PR #863 (draft), head `4983003e6`, CI groen (browserdeel en builds voor macOS/Windows bewust
  overgeslagen). Poort lokaal: 2607 checks, exit 0. `ifcOrigin` en `idExceptions` niet gebouwd: §8 zet ze in fase 2.
- 2026-11-09 19:49: spec §10 rechtgezet (testeis "manifeststap faalt" alleen waar het manifest vrijblijvend is);
  vervolgpunt 1 van ronde 5 in de fase-2-rij van §8 gezet.
- 2026-11-09 20:01: besluiten van wrakko (a)–(c) verwerkt als spec v20. Code: `selectPlanning` maakt alleen het eerste
  live-schema D (plus live-schema's van eigen herkomst), `Creators` (arg 7 van werkplan/werkschema) is een startpunt van
  Ext; `classify-v9.py` hetzelfde. Poort lokaal met Python: 2607 checks, exit 0; typecheck en `verify:docs` groen.
  Verwijzingen naar het oude pad van de workflow bijgewerkt.

## Vervolgpunten uit ronde 5 van #839 (comment op de PR)

1. Fase 2, eerste PR van de schrijfroute: herstel bewaart elke volledige kandidaat met `pendingSha256` zolang die niet
   op het doel staat, ook bij een crash vóór stap 3 (§4.10, restbestanden na een crash), met een test voor een crash
   tijdens het herstel zelf. Terra zag dit als blokkerend. Staat in §8, rij fase 2.
2. §10: de testeis "de manifeststap faalt: opslaan lukt toch" botste met §4.10 stap 0 en test (i). Rechtgezet op deze
   branch.

## Open

- **Workflow.** Wrakko zette hem op `.github/workflows/ifc-foreign.yml` (`15d5828be`). Het token op aia09-mp50 heeft
  geen `workflow`-scope, dus een wijziging daarin kan alleen wrakko pushen. Klaar voor hem: de patch
  `…/scratchpad/ifc-foreign-env.patch` (de regels "VOORSTEL" eruit, `inputs.mb` en `inputs.browsers` via `env:`).
- De meting bij 150 en 300 MB en in WebKit draait alleen via `workflow_dispatch`; nog niet gestart.
- Afwijkingen 2 en 3: rechtgezet in spec v20. Afwijkingen 6, 7, 8 en 9: werk voor fase 1.
- Knownbug 1006 (IfcOpenShell 0.9 en `FILE_SCHEMA(('IFC4X3'))`) staat op deze branch.

## Volgende stappen

1. Wrakko past de workflow aan met de patch; de workflow draait groen op de laatste commit.
2. Melden aan wrakko; hij start de review van Sol op #863 (code van fase 0 en spec-diff samen).
3. Na de review: PR op ready, melden aan wrakko.

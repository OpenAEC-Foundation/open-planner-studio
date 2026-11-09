# Handoff — #804 fase 0: haalbaarheidsproef

Dit bestand is de bron bij compactie en voor Trias. Houd het actueel bij elke stap. Gaat vóór de merge naar
`docs/archive/handoffs/`.

## Waar het staat (gewone taal)

Het ontwerp voor #804 (versie 19) is gemerged in main via #839. Fase 0 is gebouwd: een proef op echte bestanden die
bewijst dat de app bij een eigen bestand precies het eigen deel herkent (de 100 %-P-poort), en die de vragen van §11
beantwoordt. De PR (#863) is nog draft. Er ontbreken twee dingen: de workflow `ifc-foreign` moet naar
`.github/workflows/` (daarvoor is een token met `workflow`-scope nodig), en er moet een besluit komen over drie
afwijkingen die het ontwerp raken. Daarna volgt de review door Sol.

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

## Vervolgpunten uit ronde 5 van #839 (comment op de PR)

1. Fase 2, eerste PR van de schrijfroute: herstel bewaart elke volledige kandidaat met `pendingSha256` zolang die niet
   op het doel staat, ook bij een crash vóór stap 3 (§4.10, restbestanden na een crash), met een test voor een crash
   tijdens het herstel zelf. Terra zag dit als blokkerend. Staat in §8, rij fase 2.
2. §10: de testeis "de manifeststap faalt: opslaan lukt toch" botste met §4.10 stap 0 en test (i). Rechtgezet op deze
   branch.

## Open

- **Workflow.** `scripts/proef/ifc-foreign.yml` moet naar `.github/workflows/`. Het token op aia09-mp50 heeft geen
  `workflow`-scope. Zonder de workflow draaien in CI niet: validatie met IfcOpenShell, reproduceerbaarheid, vergelijking
  met Python, meting bij 150/300 MB en in WebKit. Gevraagd aan wrakko.
- **Afwijkingen die het ontwerp raken** (bewijsdocument, afwijkingen 1, 4 en 5): oude bestanden van vóór 3 juli 2026
  zijn niet 100 % P (`IfcProject` los); `Creators` is geen verwijzingsslot; de writer voegt twee live-schema's samen.
  Gevraagd aan wrakko, met voorstel.
- Afwijkingen 2, 3, 6, 7, 8 en 9: tekst in de spec of werk voor fase 1.
- Knownbug 1006 (IfcOpenShell 0.9 en `FILE_SCHEMA(('IFC4X3'))`) staat op deze branch.

## Volgende stappen

1. Antwoord van wrakko op de workflow en de drie afwijkingen; de afwijkingen verwerken in de spec op deze branch.
2. Workflow verplaatst, CI groen, PR op ready, melden aan wrakko.
3. Review door Sol (BLOKKEERT/VERVOLG).

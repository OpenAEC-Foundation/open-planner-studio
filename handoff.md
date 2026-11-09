# Handoff — #804 fase 0: haalbaarheidsproef

Dit bestand is de bron bij compactie en voor Trias. Houd het actueel bij elke stap. Gaat vóór de merge naar
`docs/archive/handoffs/`.

## Waar het staat (gewone taal)

Het ontwerp voor #804 is klaar (versie 15, PR #839: Opus en Sol gaven een 9). Fase 0 is de eerste bouwstap: een proef op
echte bestanden. Hij bewijst dat de app bij een eigen bestand precies het eigen deel herkent (de 100 %-P-poort), en hij
beantwoordt de vragen van §11 met metingen en IfcOpenShell. Er verandert nog niets aan wat de planner ziet.

## Bronnen

- Ontwerp: `docs/superpowers/specs/2026-11-07-gebouwmodel-behouden-ifc-ifcx-design.md` (op branch
  `t3/ifc-building-model-support`, PR #839; komt na de merge op `main`). Fase 0: §8, §10 (corpus en poort), §11 (vragen).
- Draaiboek van de ontwerpsessie: `docs/archive/handoffs/HANDOFF-2026-11-07-gebouwmodel-ifcx.md` (PR #839).
- Voorproef in Python: `scripts/proef/classify-v9.py` (PR #839).

## Afspraken

| Afspraak | Wie, wanneer |
|---|---|
| Fase 0 op een eigen branch vanaf `main`; PR mag vóór de merge van #839 klaar zijn, review pas daarna | Trias (wrakko), 2026-11-07 |
| Council voorlopig alleen Opus en Sol; Fable alleen op echt belangrijke momenten | Ethan, 2026-11-09 |
| Review per PR door Sol (BLOKKEERT/VERVOLG); VERVOLG naar `knownbugs.md` | werkwijze |
| Geen zware runs lokaal (volledige suite, Rust, veel Playwright, metingen van grote bestanden): CI | AGENTS.md |

## Werk

- Branch `feat/804-fase0-proef`, worktree `/home/aia09/.t3/worktrees/open-planner-studio/feat-804-fase0-proef`, vanaf
  `main` `ed2f919c5`. `node_modules` is een link naar `kb-tests/node_modules` (zelfde package-lock).
- 2026-11-09 17:35: worktree gemaakt; bouwer (expert, Opus xhigh) gestart.

## Volgende stappen

1. Bouwer levert fase 0 (zie de opdracht in de sessie-scratchpad, `fase0/brief.md`).
2. Draft PR, CI groen, review door Sol.
3. Na de merge van #839: `main` erin mergen, PR op ready, melden aan wrakko.

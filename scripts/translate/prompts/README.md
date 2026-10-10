# Opdrachten voor de vertaalagents

Vaste opdrachten (Engels, kort en strikt) voor de Haiku-agents van de vertaalstraat; ontwerp
`docs/superpowers/specs/2026-10-09-vertaalstraat-design.md` (§4, §6, §8). De orkestrator vult de
plekhouders in vóór hij een agent start:

| plekhouder | waarde |
|---|---|
| `{{PACKAGE}}` | absoluut pad van het pakket, bv. `<repo>/build/translate/cs/ui-task-03.json` |
| `{{PACKAGE_DIR}}`, `{{ID}}` | map en id van dat pakket |
| `{{PACKAGES}}` | één of twee pakketpaden (nalezen) |
| `{{REVIEW_FILE}}` | bv. `<repo>/build/translate/cs/review-01.json` |
| `{{NODE}}` | `/home/agent/.nvm/versions/node/v22.23.2/bin/node` (agent-shells laden nvm niet) |
| `{{CHECK}}` | absoluut pad van `build/translate/check.mjs` (zelfstandig, geen node_modules nodig) |

| bestand | station |
|---|---|
| `concepts.md` | kandidaten → concepten (`concepts-candidates` → `concepts-merge`) |
| `terms.md` | term kiezen per concept (`terms-lookup` → `apply-terms`) |
| `terms-check.md` | blinde controle van `model`-termen (`apply-terms` maakt het pakket) |
| `ui.md` | UI vertalen en zelf keuren (`prepare ui` → `apply ui`) |
| `ui-review.md` | nalezen, gestructureerde lijst |
| `ui-fix.md` | bevindingen toepassen |
| `ui-termfix.md` | alleen de `avoidHits` vervangen door de term (`prepare ui <taal> --avoid` → `apply ui`) |

Na elke run controleert de orkestrator `git status`: alleen `build/translate/` mag veranderd zijn (§12).

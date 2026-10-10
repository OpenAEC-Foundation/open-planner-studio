# Opdrachten voor de vertaalagents

Vaste opdrachten (Engels, kort en strikt) voor de Haiku-agents van de vertaalstraat; ontwerp
`docs/superpowers/specs/2026-10-09-vertaalstraat-design.md` (§4, §6, §8). De orkestrator vult de
plekhouders in vóór hij een agent start:

| plekhouder | waarde |
|---|---|
| `{{PACKAGE}}` | absoluut pad van het pakket, bv. `<repo>/build/translate/cs/ui-task-03.json`; een docs-pakket is `<id>[-NN].json` met `<id>[-NN].src.md` ernaast (uitvoer `.out.md`) |
| `{{PACKAGE_DIR}}`, `{{ID}}` | map en id van dat pakket |
| `{{PACKAGES}}` | één of twee pakketpaden (nalezen, UI); docs worden per pakket nagelezen |
| `{{REVIEW_FILE}}` | bv. `<repo>/build/translate/cs/review-01.json` (docs: `review-<id>.json`) |
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
| `docs.md` | één gidspakket vertalen en zelf keuren (`prepare docs` → `.out.md` → `apply docs`) |
| `docs-review.md` | één gidspakket nalezen; lijst met `quote` + `proposal` per probleem |
| `docs-fix.md` | bevindingen in `.out.md` toepassen (alleen de geciteerde tekst) |

Na elke run controleert de orkestrator `git status`: alleen `build/translate/` mag veranderd zijn (§12).

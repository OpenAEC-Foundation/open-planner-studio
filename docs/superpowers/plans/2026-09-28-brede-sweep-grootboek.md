# Brede sweep — grootboek

Werkregister van de orkestrator, zie `2026-09-28-brede-sweep-draaiboek.md` §7.1. Bijgewerkt bij elke
statuswissel; de wachtkamer-check (§4.1) leest hieruit.

## Sporen

| spoor | status | branch | PR | klare SHA | zones (paden) |
|---|---|---|---|---|---|
| — | nog niet gestart | | | | |

## Bevindingen

| id | tijdstip (UTC) | spoor | ernst | label | `pad:regel` | status |
|---|---|---|---|---|---|---|
| V1 | 2026-09-28 16:40 | A | onbekend | onbekend (gemeld door een reviewer van #241, niet nagemeten) | nog te bepalen | open — eerst reproduceren: FF-relatie van een dagtaak naar een uurtaak lijkt de relatie te schenden |
| V2 | 2026-09-28 16:40 | A | onbekend | onbekend (idem) | nog te bepalen | open — eerst reproduceren: FS met een lag in kalendertijd (ELAPSEDTIME) naar een uurtaak start op dezelfde dag |
| V3 | 2026-09-28 16:40 | A/O | laag | zeker (staat als bekende beperking in het solvercommentaar) | `CPMSolver.ts` (grep ALAP/C14) | open — ALAP-C14 met uur→dag kan één dag te kort uitvallen; onderzoeken of het met bron op te lossen is |
| V4 | 2026-09-28 16:40 | O | onbekend | afgeleid (#241 kon het niet meten) | ALAP-ketenfix `d82c95ab`, dag→uur-lagfix `b8db26aa` | open — eerste meting na de start: beide fixes tegen het nu volledige P6-corpus en de `.mpp`-crawl (regel A) |

## Merge-batches

| tijdstip (UTC) | PR's | kruiscontrole | advisor | aangekondigd aan eigenaar |
|---|---|---|---|---|

## Voor de releasenotes

Punten die bij de eerstvolgende release in `docs/release-notes/v<versie>.md` moeten (via de
`release`-skill; deze sweep schrijft zelf geen releasenotes):

- **Oudere app-versies en de IFC-tekstcodering uit #241:** een notitie of baseline met een `"` of `\`
  gaat verloren als een bestand dat door de nieuwe versie is opgeslagen, in een oudere versie wordt
  geopend (gemeld vanuit de #241-sessie, 2026-09-28).


## Modelbenchmark Sonnet 5.5 tegen Opus 5.5 (2026-09-28, vóór de sweep)

Doel: de modelkeuze van draaiboek §5.1. Beide modellen draaien als subagent in deze sessie (alias
`sonnet` = `claude-sonnet-5-5`, `opus` = `claude-opus-5-5`, gemeten met een identiteitsprobe om 19:45 UTC).
Elk onderdeel krijgt voor beide modellen een woordelijk identieke opdracht, en ze starten tegelijk.

1. **Meetlat: import/export-audit op `8e3bcf4c`** (`main` vlak vóór #241). De werkmap is een momentopname
   zonder git-geschiedenis. Verboden: web, GitHub-tools, subagents, en paden buiten de eigen werkmap.
   De nakijksleutel bevat 23 import/export-bugs die #241 heeft opgelost (9 correctheid, 4 dataverlies,
   7 compatibiliteit, 3 performance). Hij staat bewust niet in de repo. Een bug telt alleen als gevonden
   met locatie, mechanisme en een reproductie die echt draait. Overige bevindingen worden met de hand
   nagekeken; echte bugs daaruit komen in spoor E. De eerdere opzet met 3 teruggezette bugs op `main`
   (`/home/user/bench/*-b3`) is verlaten: twee van die drie bugs bestonden vóór #241 niet.
2. **Echt onderzoek: spoor O, audit-stap (§2.5.1)**, op de toenmalige `main` (`91da0168`). Het corpus
   mag gebruikt worden, het web ook (voor bronnen). Geen fixes, commits of pushes. Beide rapporten gaan
   naar een verificatie-agent die niet weet welk model welk rapport schreef.

Beoordeling per model: gevonden sleutelbugs, aandeel bevindingen dat de verificatie overleeft, valse
meldingen, bronkwaliteit, tokens en looptijd. Zelfrapportage over verboden tools is aangevuld met een
grep door de transcripties.

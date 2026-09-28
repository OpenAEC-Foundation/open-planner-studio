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


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
| V4 | 2026-09-28 16:40 | O | — | zeker (twee audits spoor O onafhankelijk, blind geverifieerd) | ALAP-ketenfix `d82c95ab`, dag→uur-lagfix `b8db26aa` | **gesloten 21:15** — op `main` tegen alle 9 orakels: 221 gepinde cellen exact terug, CELLDELTA 0; `.mpp`-crawl 213/213. Zie `2026-09-28-modelbenchmark/spoor-o-verificatie.md` |
| V5 | 2026-09-28 21:15 | E | hoog | zeker (Sonnet spoor O O-03 en Opus meetlat #1, blind bevestigd) | `src/services/p6/p6xmlReader.ts:192` | open — `readP6XML` zoekt Activity/WBS/Relationship alleen onder de root; echte P6-exports nesten ze in `<Project>`, dus 0 taken zonder melding (9/9 corpusbestanden). Stond al in `docs/superpowers/specs/2026-08-14-rapport-critreview-f0.md` |
| V6 | 2026-09-28 21:15 | E/F/D | per item | zeker op `8e3bcf4c` | `2026-09-28-modelbenchmark/meetlat-nakijken.md` §5 | open — de bevestigde import/export-bevindingen uit de meetlat die #241 niet raakte (Sonnet 37, Opus 24, deels overlappend); in golf 1 per item op `main` opnieuw aantonen vóór ze bevinding worden |
| V7 | 2026-09-28 21:15 | T/O | hoog (blokkeert poort 3) | zeker (beide spoor-O-audits, bevestigd) | `scripts/measure-profiles*.mjs` | open — P6-deel van `measure:profiles` stopt op de cloudclone (41 niet-orakelbestanden ontbreken); golf 1 spoor T: modus alleen-orakels. Draaiboek §4 poort 3 bijgewerkt |
| V8 | 2026-09-28 21:15 | O/E/F/J/T | per item | bevestigd | `2026-09-28-modelbenchmark/spoor-o-verificatie.md` §6 | open — 17 actiepunten uit spoor O (docblokken, kleine fixes, zes eigenaarsvragen); golf 2 |

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

### Uitslag (2026-09-28, 21:50 UTC)

Nakijkers: Fable 5.1, blind (rapporten als A/B, koppeling pas na het oordeel). Beide auditors riepen zelf
1–2 keer de advisor aan. Een grep door de transcripties vond geen web-, GitHub- of subagentgebruik in de
meetlat en geen leesactie buiten de eigen werkmap.

| | Sonnet 5.5 | Opus 5.5 |
|---|---|---|
| Meetlat: sleutelbugs gevonden (van 23) | 12 (strikt 10) | 8 (7 met repro) |
| Meetlat: overige bevindingen bevestigd | 37 van 38 (1 deels) | 24 van 24 |
| Meetlat: onterecht "zeker" | 0 | 0 |
| Meetlat: tijd / tokens / toolaanroepen | 51 min / 760k / 207 | 35 min / 441k / 120 |
| Spoor O: bevindingen bevestigd / deels / weerlegd | 14 / 2 / 0 (van 16) | 18 / 4 / 0 (van 22) |
| Spoor O: overige claims weerlegd | 1 (rekenfout Sample-afronding) | 0 |
| Spoor O: onterecht "zeker" / onjuiste bronclaim | 2 / 1 | 1 / 1 |
| Spoor O: tijd / tokens / toolaanroepen | 34 min / 556k / 177 | 31 min / 424k / 145 |

Samen vonden ze 14 van de 23 sleutelbugs. Door beide gemist: G3, G4, G8, G9, G15, G17, G18, G19, G23.
De twee vullen elkaar aan: van de sleutelbugs vond Sonnet er 6 die Opus miste, Opus 2 die Sonnet miste.
In spoor O vond alleen Sonnet de oorzaak van de P6-XML-lezer die 0 taken leest (hoog, spoor E); alleen
Opus vond de onjuiste A17-registertekst, de Standaardopties-inconsistentie, het manifestduplicaat en de
A19-achterdeur. n = 1 per model per onderdeel: een aanwijzing, geen statistiek.

Alle rapporten, de sleutel en de twee verificatieverslagen staan in `2026-09-28-modelbenchmark/`.
Beperkingen van de meting: n = 1; de vier agents deelden 4 cores, dus de looptijden zijn geen zuivere
snelheidsvergelijking; beide riepen de advisor (Fable 5.1) aan, dus geen van beide cijfers is "het model
alleen".

Gevolgen: V4 gesloten, V5–V8 geopend (tabel *Bevindingen*). Draaiboek §4 poort 3 en §5 punt 4
bijgewerkt. De fout rond `OPS_MPP_CRAWL` zat in de benchmarkopdracht (`…/crawl-mpp`), niet in het
draaiboek: dat noemde al de corpuswortel.

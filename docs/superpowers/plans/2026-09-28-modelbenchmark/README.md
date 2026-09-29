# Modelbenchmark Sonnet 5.5 tegen Opus 5.5 (2026-09-28)

Opzet en uitslag: `../2026-09-28-brede-sweep-grootboek.md`, sectie *Modelbenchmark*. Hier staan de
volledige rapporten, zodat ze het opruimen van de cloudcontainer overleven. De reproductiescripts en
logs zijn niet meegenomen; paden als `/home/user/audit/...` in de rapporten bestaan dus niet meer.

| bestand | wat | auditor |
|---|---|---|
| `meetlat-sleutel-241.md` | nakijksleutel: 23 import/export-bugs op `8e3bcf4c` die #241 oploste | Opus 5.5 (uit de diffs van #241) |
| `meetlat-sonnet.md` | import/export-audit op `8e3bcf4c` | Sonnet 5.5 |
| `meetlat-opus.md` | idem | Opus 5.5 |
| `meetlat-nakijken.md` | blind nakijkverslag; **rapport A = Opus, rapport B = Sonnet** | Fable 5.1 |
| `spoor-o-sonnet.md` | audit spoor O (rekenprofielen) op `main` `91da0168` | Sonnet 5.5 |
| `spoor-o-opus.md` | idem | Opus 5.5 |
| `spoor-o-verificatie.md` | blinde verificatie; **rapport A = Sonnet, rapport B = Opus** | Fable 5.1 |

Status: de meetlat-rapporten beschrijven `8e3bcf4c`, niet `main`. Een bevinding daaruit is pas een
sweep-bevinding als hij op `main` opnieuw is aangetoond (grootboek V6). De spoor-O-rapporten zijn de
audit-stap (§2.5.1) van spoor O en zijn blind geverifieerd; `spoor-o-verificatie.md` §6 is de
actielijst. Het advies uit `spoor-o-sonnet.md` om een tolerantie van 0,001 min in te voeren, rust op
een weerlegde rekenfout en vervalt.

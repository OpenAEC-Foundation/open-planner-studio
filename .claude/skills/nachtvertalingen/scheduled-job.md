# Voorstel nachttaak

Dit bestand is configuratie-invoer en prompttekst. Het maakt geen schedule aan; dat doet wrakko.
Besluit Ethan, 2026-11-16 (vertalingen elke nacht, alleen werk dat af is).

- Host: **aia09-mp50**, T3 Code scheduled job.
- Agent: keuze van wrakko bij het instellen. De stations draaien op Haiku 5.5 (`claude-haiku-5-5`).
- Tijdzone: **Europe/Amsterdam**. Controleer dat de scheduler deze lokale tijdzone gebruikt.
- Schedule: `{"type":"fixed_time","timeOfDay":"01:00","weekdays":[1,2,3,4,5,6]}`.
  Maandag 01:00 is het einde van de weekendstop; die nacht neemt het weekend vanzelf mee, want elke
  nacht vertaalt alles wat open en af is.
- Geen eindtijd. Loopt een nacht door tot de volgende, dan slaat de volgende over (markering in de skill).
  De release van maandag wacht tot de nacht van maandag klaar is (release-skill, stap vertalen).
- Werkplek: repo `OpenAEC-Foundation/open-planner-studio`; elke nacht een nieuwe losgekoppelde worktree
  vanaf `origin/main`.
- Besluit 9: alleen de lichte Node-stappen uit
  [referentie.md](../release/referentie.md#node-uitzondering-voor-de-nachttaak), in die worktree.
- Merge zonder Sol-review, na groene CI, met `--match-head-commit` en alleen als main niet verder is.

## Letterlijke prompt

```text
Voer op aia09-mp50 de nachtvertaling van Open Planner Studio uit.
Lees AGENTS.md en .claude/skills/nachtvertalingen/SKILL.md en volg de skill volledig.
Vertaal alleen de UI-teksten die af zijn, zoals npm run translate -- settled ze bepaalt.
Gebruik alleen de Node-uitzondering voor de nachttaak in .claude/skills/release/referentie.md:
eenmaal npm ci in de nachtworktree, geen tests, builds, volledige verify of dev-servers.
Geef elk Haiku-station het nachtmandaat, de nachtworktree en toestemming voor zijn eigen
pakketcheck mee. De stations installeren niets. Behoud alle vertaalpoorten.
Vervalt de nacht (night-guard, main verder vóór de merge, padcontrole), stop dan zonder merge.
Merge alleen na groene CI, met --match-head-commit, als origin/main nog gelijk is aan de basis.
Rapporteer de uitkomst, de aantallen per taal, rode pakketten en het aantal Haiku-runs.
Meld twee mislukte of vervallen nachten op rij aan wrakko.
```

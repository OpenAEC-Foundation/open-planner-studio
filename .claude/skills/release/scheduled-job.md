# Maandagjob

Dit bestand legt de dag vast; het maakt geen schedule aan. Wrakko beheert de geplande taak op aia09-mp50.
Besluit: eigenaar, gesprek 2026-10-22. De dag is verplaatst van zaterdag naar maandag: besluit Ethan, 2026-11-07.

- Host: **aia09-mp50**, geplande T3-taak met `freshSession`, in de vaste thread **Trias · release OPS** (Sol, xhigh).
- Tijdzone: **Europe/Amsterdam**.
- Schedule: `{"type":"fixed_time","timeOfDay":"07:00","weekdays":[1]}`.
- De thread volgt de [release-skill](SKILL.md): hij start `scripts/release/run.mjs` en geeft elke `RELEASE-STOP`
  letterlijk door aan wrakko. Geen eindtijd; de weekendstop (zaterdag 23:00 tot maandag 01:00) en zondag blijven.

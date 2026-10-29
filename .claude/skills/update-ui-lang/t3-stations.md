# De bestaande Haiku-stations vanuit T3

Gebruik dit als de uitvoerder geen Workflow-tool heeft, zoals Sol/Codex. De pakket- en
uitvoerformaten, prompts en `build/translate/check.mjs` blijven die van `stations.js`.
Dit document start geen vertaling bij onderhoud aan de skill.

## Voorbereiden

- Lees `orchestrator_capabilities`. Provider `claudeAgent` moet delegatie ondersteunen en model
  `claude-haiku-5-5` aanbieden. Ontbreekt dat: stop met die precieze fout; geen ander model gokken.
- Gebruik de bestaande release-worktree. Bepaal `repo` en het absolute Node-pad (`process.execPath`).
  Neem `[lang, id]` letterlijk uit `npm run translate -- packages ui <talen>`.
  `prepare ui` uit stap 2 bouwt ook `build/translate/check.mjs`; controleer dat het bestaat.
- Maak een unieke ronde-ID voor de stationsrun. Retry van dezelfde delegatie houdt dezelfde
  `clientRequestId`; een nieuwe vertaal-/herstelronde krijgt een nieuwe ID.

## Eén delegatie per station

Vul alle waarden concreet in. Voor de vertaler zijn de argumenten van T3 `delegate_task`:

```json
{
  "target": {"providerInstanceId":"claudeAgent","model":"claude-haiku-5-5","options":{}},
  "isolation": "shared",
  "mode": "wait",
  "timeoutMs": 60000,
  "clientRequestId": "<ronde>:<lang>:<id>:vertalen",
  "task": "Read <repo>/scripts/translate/prompts/ui.md first and follow it exactly. Placeholders for the instructions: {{PACKAGE}} = <repo>/build/translate/<lang>/<id>.json ; {{PACKAGES}} = <repo>/build/translate/<lang>/<id>.json ; {{PACKAGE_DIR}} = <repo>/build/translate/<lang> ; {{ID}} = <id> ; {{REVIEW_FILE}} = <repo>/build/translate/<lang>/review-<id>.json ; {{NODE}} = <absoluut-nodepad> ; {{CHECK}} = <repo>/build/translate/check.mjs\nYou may read that instruction file in addition to the files it names. Work in <repo>. Do not commit, push or publish anything."
}
```

De placeholders zijn instructiewaarden, geen vervanging in bronbestanden of vertaalde UI-tokens.
Bij termherstel verandert alleen `ui.md` in `ui-termfix.md`.
Controleer in het resultaat de provider en het model. Bewaar `taskId`; `childThreadId` is geen
vervolgopdrachtadres. Een wacht-timeout stopt de child niet: lees `task_status(taskId)` of verwerk
zijn gereedmelding. Start geen tweede child zolang dezelfde delegatie nog loopt of op input wacht.
Bij ontbrekende rechten, mislukte child of ontbrekende uitvoer: markeer het pakket onafgerond;
volgende stations voor dat pakket starten niet en **`apply ui` is voor de hele ronde geblokkeerd**.
Hervat eerst het onafgeronde station met de bestaande pakketten/taak-ID's; geen `prepare` of apply
zolang een vereist station onafgerond of onbekend is, ook als `<id>.out.json` groen keurt.

1. **Vertalen.** De opdracht hierboven gebruikt `ui.md` (of `ui-termfix.md`). Die schrijft alleen
   `<repo>/build/translate/<lang>/<id>.out.json` en draait zijn eigen check, maximaal drie keer.
2. **Nalezen.** Na afronding van de vertaler: een **nieuwe** `delegate_task` met dezelfde target,
   isolatie en instructiewaarden. Gebruik `ui-review.md` en request-ID `...:nalezen`.
   Zet een oud `review-<id>.json` vóór deze delegatie opzij in `build/translate/`.
   De nalezer schrijft alleen een nieuw reviewbestand en verandert geen vertaling.
   Lees dat bestand zelf: het moet een JSON-array voor dit pakket zijn. Het aantal problemen is
   de arraylengte; ontbrekende/ongeldige JSON is een fout, nooit nul. T3 heeft hier geen
   Workflow-`schema` nodig en een getal in de eindtekst vervangt het reviewbestand niet.
3. **Herstellen.** Alleen bij een niet-lege review-array: een **nieuwe** `delegate_task` met
   `ui-fix.md`, dezelfde target/instructiewaarden en request-ID `...:herstellen`.
   Die wijzigt alleen genoemde sleutels in `<id>.out.json` en draait dezelfde check.
   Bij een lege review-array sla je alleen dit station over.
4. **Poort.** Draai als ouder `<absoluut-nodepad> <repo>/build/translate/check.mjs
   <repo>/build/translate/<lang>/<id>.json`. Beoordeel de exitcode. Rood blijft open voor de
   herstelroute van stap 4 in SKILL.md; pas een rood pakket niet met de hand toe.

Gebruik voor elk pakket eigen taak-ID's en bestanden. Deel de gitignored pakketten via
`isolation:"shared"`; een nieuwe worktree zou de pakketten en ongeschreven wijzigingen missen.
Pas met alle vereiste stations afgerond (`OPEN_STATIONS=0`) mag de ouder `apply ui` uitvoeren.
Daarna volgen `--stale` en de bestaande eindpoorten.
Alleen de ouder past de locale-/hashbestanden toe en maakt de vertaalcommit.

# Bewijs van de regressie

De gerichte test is `tests/planning/check-default-work-rule-switch.ts`.
Hij bevat 82 controles, waaronder 16 uur metselwerk bij inzet 1 → 2,
een taak met een eigen type, ongedaan maken, tegelijk een rekenprofiel
wijzigen en alle vier keuzes via IFC opslaan, inlezen en opnieuw opslaan.

De aanvullende proef is uitgevoerd op 7 november 2026, vanuit de eigen
worktree op branch `fix/769-standaard-taaktype`, commit
`745d119be1e5be5fbc6bec8e6ba25b0fb30a4c63`. Node was v24.22.0.
De proef draaide onder `flock /tmp/ops-zwaar.lock nice -n 19`.

## Rood met de code uit main

Basis: `6a13bd158c94a3cdb01ca7e2b3e666a6aba5310e`.
De drie gewijzigde kernbestanden zijn eerst naar `/tmp` gekopieerd en
tijdelijk vervangen door hun versie uit die main:

- `src/state/projectInfoPatch.ts`
- `src/state/projectPatch.ts`
- `src/state/slices/schedulingProfileSlice.ts`

De rest van de door deze test gebruikte kerncode was al met die main
samengevoegd. De uitgebreide test bleef staan. De aanroep was:

```bash
bash tests/planning/run.sh check-default-work-rule-switch.ts
```

De zeven falende controles betroffen:

- het zichtbaar worden van taaktypes na een projectkeuze;
- het zichtbaar blijven van die velden na ongedaan maken;
- de formulierpatch zonder profielwijziging;
- de formulierpatch met profielwijziging;
- het vastleggen van 16 uur werk bij de gecombineerde wijziging;
- het verkorten naar 8 uur bij inzet 2 in datzelfde geval;
- het terugzetten van die inzetwijziging.

```text
projectstandaard vast werk (knownbug 251): 75/82 groen
EXIT:1
```

## Groen na herstel van de fix

Alle drie bronbestanden zijn met `cp` teruggezet uit hun vooraf gemaakte
kopie. Hun SHA-256-hashes waren vóór en na de proef gelijk. Dezelfde
test is daarna opnieuw gedraaid:

```text
Bronbestanden teruggezet met cp; alle drie SHA-256-hashes gelijk.
projectstandaard vast werk (knownbug 251): 82/82 groen
EXIT:0
```

De werkboom was daarna schoon. De extra controle van de bestaande
rekenprofielacties slaagde eerder met 37 controles en exitcode 0.

## Bediening in de browser

Op main `38915fa7c` faalde de uitgebreide gebruikersroute op de ontbrekende
keuzelijst: één test rood, de bestaande taakdialoogtest groen, exitcode 1.
Na de fix slaagden alle vier delen van
[browserrun 42405498277](https://github.com/OpenAEC-Foundation/open-planner-studio/actions/runs/42405498277)
op commit `66c5dccb715a67ffd28b6e52d902dde0a049efa8`.
De route gebruikt echte klikken en invoer voor Annuleren, Toepassen,
inzet 1 → 2 en Ctrl+Z. Opslaan en heropenen loopt in de gerichte
kerntest door de echte IFC-schrijver, IFC-lezer en documentlaadactie.

## Browserpoort na release v2026.45.0

Op 9 november faalde in
[CI-run 42698303687, browserdeel 3](https://github.com/OpenAEC-Foundation/open-planner-studio/actions/runs/42698303687/job/129436213967)
de bestaande welkomsttest: 178 tests geslaagd, één mislukt. Die test
verwachtte nog Engelse terugvalteksten voor de popup over vertraagde
hostinstellingen. De Franse vertalingen zijn sinds de release aanwezig;
de app toonde correct Frans bij de Franse hosttaal.

Dezelfde fout is eerst gereproduceerd in een afzonderlijke, tijdelijke
worktree op main `2a66df33c8854e296b638a3f0d39379280d1afb6`, met Node
v24.22.0 en Playwright 1.62.1. De SHA-256 van de ongewijzigde test was op
main en de featurebranch gelijk:
`808701a81d6314529db158169a84a7bab246b04f36e0867808ae97303516a835`.

Beide gerichte runs gebruikten afzonderlijk
`flock /tmp/ops-zwaar.lock nice -n 19` en dezelfde selectie:

```bash
node scripts/run-browser-tests.mjs tests/browser/welcome-dialog.spec.ts --grep 'welkomstdialoog past taal'
```

```text
Main: verwacht "Settings not loaded", ontvangt "Paramètres non chargés…"
1 failed
EXIT:1

Na correctie van de testverwachtingen:
1 passed (48.6s)
EXIT:0
```

De bestaande route controleert nu de popup en de melding na het late
hostantwoord tegen de Franse vertalingen. Er is geen nieuwe test of
productgedrag toegevoegd. De app-tekst en instellingen zijn niet gewijzigd.
De testrunner heeft de tijdelijke testservers na beide runs beëindigd.

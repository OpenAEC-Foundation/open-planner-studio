# Nivelleren via MCP rekent eerst bij en voorspelt zonder transactie

`planner_level_resources` heeft een verse planning nodig: op een verouderde planning zeggen de verschillen vóór en na
nivelleren niets. De tool draait daarom eerst `ensureFreshSchedule`, buiten elke transactie. Is de planning
verouderd of nooit berekend, dan wordt ze daarbij echt bijgewerkt in de store (`recomputed: true`). Dat kost geen
undo-stap, want `runCPM` maakt er alleen een bij het verlaten van "datums zoals opgeslagen", en in die modus is de
planning nooit verouderd (zie `state.md`). Een `dryRun` past daarna geen nivellering toe en gaat niet door een
transactie: `levelResources` is een voorspelling op de store, er valt niets te backuppen of terug te rollen.

## Gevolgen

- De guards (pauze, alleen lezen) draaien vóór de herberekening, en `runMutateTool` draait ze daarna nog eens met de
  backup. Een gepauzeerde bridge mag ook geen herberekening uitlokken.
- De kern (`levelResourcesCore`) draait `ensureFreshSchedule` zelf ook. Dat overlapt met de herberekening die
  `planner_batch` vóór een nivelleerstap doet, maar de kern moet ook kloppen als nivelleren de eerste stap is en de
  store al verouderd de batch inging. Binnen een batch past een stap met `dryRun` geen nivellering toe.
- Er zijn twee antwoordvormen. De losse aanroep (met en zonder `dryRun`) geeft een selectie uit het
  `LevelingResult` (`levelingData`): `delays`, `unresolved`, `unresolvedReasons`, `shifts`, `projectEndBefore`,
  `projectEndAfter` en `projectEndDelta`, plus `projectEnd` (wat na de herberekening in de store staat; bij `dryRun`
  de ongewijzigde planning), `recomputed`, `cappedTaskIds` en de waarschuwingen. `delayMinutes`, `gaps` en
  `intrinsicOverruns` zitten er niet in. Een batchstap geeft het hele `LevelingResult` van de kern, met `gaps` en
  `delayMinutes`, maar zonder `projectEnd` en zonder waarschuwingen.
- `dryRun` wordt streng als boolean getoetst, want juist die parameter is de veilige manier om eerst te kijken. Een
  lege `resourceIds`, een onbekend id en een kostenresource worden geweigerd: de nivelleerder laat onbekende id's weg,
  en een leeg resultaat zou dan lezen als "er viel niets te nivelleren".
- `planner_clear_leveling` draagt geen `destructiveHint`: nivelleervertragingen zijn afgeleide, opnieuw te berekenen
  waarden, en wissen vernietigt geen ingevoerde gegevens. Hij telt de nivelleeruitvoer met dezelfde
  `hasLevelingOutput` als de store-actie `clearLeveling` en de lintknop.

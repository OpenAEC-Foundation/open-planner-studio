# Een rekenprofiel bewaart zijn keuzes letterlijk en hoort op id bij zijn sjabloon

Het tweelagenmodel (conventies in `Project.schedulingProfile`, projectopties in `Project.schedulingOptions`) en de
eis dat de solver alleen `EffectiveSchedulingOptions` krijgt, staan in de regel `rekenprofielen`. De typen in
`src/types/project.ts` dwingen dat af: `ProjectOptionKey` is het complement van `ConventionKey`, en een kale
`SchedulingOptions` past niet op `EffectiveSchedulingOptions`, omdat daar elke conventie verplicht is. Daarnaast
gelden de keuzes hieronder, die een lezer zonder uitleg zou terugdraaien.

## Gevolgen

- Een `SchedulingProfile` bewaart een ingebouwde basis plus de letterlijke keuzes (`overrides`); de opgeloste set
  van negenentwintig waarden rekent `resolveConventions` uit. Een keuze in `overrides` blijft staan, ook als ze gelijk
  is aan de basis van het profiel waar het project nu op staat: bij een wissel van P6 met A13 uit naar OPS is
  `clampNegativeFreeFloat: false` gelijk aan de OPS-basis, en die keuze moet bij de terugkeer naar P6 weer gelden
  (besluit 2026-09-22, regel `rekenprofielen` bij `switchProfile`). Ze reist daarom letterlijk mee in het IFC-bestand
  (`check-scheduling-profile-roundtrip.ts`, gevallen C2b-01 tot en met C2b-03). Ruim zulke keuzes dus niet op omdat ze
  gelijk zijn aan de basis.
- Een eigen profiel hoort op `id` bij zijn sjabloon, niet op naam: de keuze in de lijst (`choiceOf`) en de
  verhouding tot het sjabloon (`templateRelation`, beide in `state/schedulingProfileDraft.ts`) en het opslaan van een
  sjabloon (`upsertCustomProfileResult` in `services/schedulingProfiles/profileStore.ts`) zoeken op `id`. Een andere
  naam is bij `templateRelation` een afwijking van hetzelfde sjabloon. Een project draagt zijn eigen kopie van het
  profiel (regel `rekenprofielen`).
- Een ingebouwd profiel heeft een lege `name` (`builtInProfile` in `conventions/registry.ts`). De weergavenaam komt
  uit i18n (`displayNameKey`, `profiles.builtIn.<id>`), zodat er geen vertaalde naam in het bestand komt.
- `LegacySchedulingOptions` (een oud `OPS_SchedulingOptions`-blok met de markering `p6Source`) komt alleen voor in
  de IFC-lezer (`services/ifc/schedulingOptionsRead.ts`) en in `legacyOptionsToProfile`
  (`services/ifc/schedulingProfileMigration.ts`), die het naar een profiel omzet.
- Of een duur, rest of lag in de dagenmaat telt (conventie `workdayDurationMeasure`), vraag je aan
  `taskCountsInWorkdays` en `lagCountsInWorkdays` in `conventions/durationMeasure.ts`, niet zelf aan `durationUnit`.

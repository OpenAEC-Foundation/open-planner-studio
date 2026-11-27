# Relatielijnen en balkdatums op Beeld

De groep Balken op Beeld heeft twee knoppen die op het eerste gezicht hetzelfde soort schakelaar zijn, maar hun stand
op een andere plek bewaren. Relatielijnen (`toggleRelations`) is de schermtegenhanger van de rapportoptie
Afhankelijkheden en hoort bij het document: `view.showRelations` (via `setShowRelations`), zonder waarde aan. Het is
een deel van een layout: het staat in `LAYOUT_PARTS` (`src/types/view.ts`) en `applyLayoutParts` neemt het mee, en de meegeleverde layout Resourcediagram zet de lijnen
uit (`builtinLayouts.ts`). Balkdatums (`toggleBarDates`, #868: de begindatum links en de einddatum rechts van elke
balk) is een instelling van de planner (`ops-showBarDates`, via `applySetting` en `saveShowBarDates`), standaard uit
zodat de Gantt voor niemand ongevraagd verandert, en geen deel van een layout.

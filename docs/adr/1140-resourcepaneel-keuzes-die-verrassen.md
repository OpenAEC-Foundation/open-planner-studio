# Keuzes in het resourcepaneel die verrassen

Het gedrag van `src/components/panels/ResourcePanel.tsx` staat voor de gebruiker in de gids
`public/docs/{nl,en}/ref-resourcepaneel.md` en voor de bibliotheek in `docs/library.md`: het paneel opent in de
Projectweergave, de conceptrij maakt pas iets aan met een naam, geërfde velden zijn platte tekst en de kalenderkeuze
is projectinzet. Vier keuzes in de code zou een lezer zonder uitleg terugdraaien.

## Gevolgen

- **Tekstvelden schrijven bij het verlaten van het veld** (`ResourceRow`: `commitNameDraft`, `commitUnitDraft`,
  `commitRateDraft`), in beide weergaven. In de Bibliotheekweergave gaat elke wijziging naar `updatePoolResource`, die
  per aanroep de poolversie ophoogt (`bumpPool`), de bibliotheek opslaat en `refreshAllDocumentsFromPool` aanroept,
  wat de redo van elk gekoppeld document wist (ADR 0172). Per toetsaanslag schrijven zou dat per letter doen; in de
  Projectweergave gaf het een undo-stap per letter.
- **"Losmaken van de bibliotheek" hangt aan `libraryOrigin`, niet aan `locked`.** Een wees (`removed`) en een stempel
  van een andere bibliotheek dan die van het project (`onOpenStatusForResource` geeft dan `null`) zijn niet
  vergrendeld. Met `locked` als voorwaarde zou geen knop zo'n stempel nog kunnen weghalen.
- **De kolom Ploeg in de Bibliotheekweergave staat er zodra de pool resources heeft** (`poolShowParentColumn`), niet
  pas als er een resource van het type `CREW` is; anders verschijnt en verdwijnt de kolom met de eerste en de
  laatste ploeg. De keuzelijst biedt alleen de ploegen (`poolCrews`).
- **Een conceptrij blijft bij een weergavewissel alleen staan als ze bij de nieuwe weergave hoort**, en vervalt in de
  Bezettingsweergave altijd (het effect op `resourcesView` in `ResourcePanel`); een wissel door de gebruiker gooit de
  rij dus weg. De lintknop *Nieuwe resource* opent het paneel en vraagt tegelijk een conceptrij. Bij die verse mount
  zet `useResourceViewReset` de weergave in dezelfde ronde naar Project; `usePendingResourceDraft` draait daarna en
  leest de weergave daarom uit de store in plaats van uit de render. Zo hoort de rij bij de weergave die de gebruiker
  te zien krijgt en blijft ze staan. Toets voor het opruimen bij een wissel: de tweede test in
  `tests/browser/resource-panel-effects.spec.ts`.

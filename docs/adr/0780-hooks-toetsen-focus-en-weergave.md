# Hooks voor toetsen, focus en weergave: keuzes die verrassen

De hooks in `src/hooks/` die toetsen, focus en klikken afhandelen, hebben een paar keuzes waarvan de gewone vorm
hetzelfde lijkt te doen maar een fout gaf. Die staan hier; de rest staat in de code en in de regel `ui-shell`.

## Gevolgen

- `isTypingTarget` (`keyboard/isTypingTarget.ts`) is de ene definitie van "de focus zit in een veld" voor alle
  toetsenbordhooks. De eigen keuzelijst `Select` is een knop met `aria-haspopup="listbox"` en telt als veld; anders
  wissen Delete en Backspace de geselecteerde taak, zoomen − en 0 de Gantt en heft Escape de selectie op terwijl de
  gebruiker in de keuzelijst zit. Twee uitzonderingen, allebei niet in een modale dialoog (`aria-modal="true"`), omdat
  de keuze daar in het concept van de dialoog staat en Ctrl+Z of Ctrl+V iets achter de dialoog zou veranderen:
  - Op een dichte trigger gaan combinaties met Ctrl of Meta door, behalve Delete en Backspace (besluit orkestrator
    2026-10-15). Na een muiskeuze staat de focus weer op de trigger, en een planner die verkeerd koos drukt meteen
    Ctrl+Z; dat mag geen extra klik vragen.
  - Een veld met `data-ops-app-keys="true"` (een `UnitsInput` zonder draft, PR #369) laat Ctrl+Z, Ctrl+Y en
    Ctrl+Shift+Z en een kale Escape door. Na Ctrl+S of F5 komt de focus terug in het veld; Ctrl+Z moet dan de undo
    van de app zijn, niet die van het veld.
- `useFocusTrap` filtert zichtbare elementen op `getClientRects().length > 0`, niet op `offsetParent`: dat is `null`
  voor een element dat zelf `position: fixed` heeft, ook als het zichtbaar is. De
  keydown-listener hangt op het paneel en niet op `document`, zodat bij gestapelde dialogen alleen het paneel met de
  focus Tab vangt.
- `useClickOutside` hangt met `defer` de listeners pas na de huidige gebeurtenis aan, zodat de klik of rechtsklik die
  het paneel opent (het contextmenu van de Gantt) het niet meteen weer sluit. De callback blijft actueel via een ref
  en niet via de afhankelijkheden van het effect: een aanroeper geeft bij elke render een nieuwe closure mee, en die
  zou de `defer`-timer bij elke render opnieuw starten.
- `useZoomShortcuts` herkent Ctrl+0 ook aan `e.code` (`Digit0`, `Numpad0`).
- `useSystemColorSchemeSync` (`useResolvedUITheme.ts`) volgt het kleurschema van het systeem altijd, ook als de
  gebruiker een vast thema koos. Zo staat de stand van het systeem al in de store als hij naar "Systeem" schakelt.

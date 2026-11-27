# De rand van het datumveld volgt `.input`

Het datumveld (`DateTextInput`, ADR 0460) is een groep van drie vakjes die eruit moet zien als één `.input`.
`className` en `style` van de aanroeper komen op de groep, zodat de klasse van de plek (zoals `.input`) de rand, de
achtergrond en de breedte geeft; elke plek kiest zelf de breedte. De focusrand en de foutrand (`FOCUS_STYLE`, `ERROR_STYLE`) nemen de rand en de schaduw van
`.input:focus` en `.input--error:focus` over (`src/styles/globals.css`). We zetten ze als `border`-shorthand en niet als
losse `borderColor`, omdat een aanroeper via `style` een `border`-shorthand kan meegeven en React bij gemengde
shorthand en longhand waarschuwt; die reden komt uit het weggehaalde commentaar en is niet nagegaan.

## Gevolgen

- De rand van het veld (`groupBorder`) staat in de stijl ná `style`, dus bij focus of fout vervangt hij een rand uit
  `style`. Keurt een aanroeper een bestaande datum af, bijvoorbeeld een omgekeerd bereik, dan geeft hij `invalid` mee:
  dezelfde rode rand en `aria-invalid` als bij een onbestaande datum, zonder melding van het veld zelf; de aanroeper
  toont die. Een uitgeschakeld veld krijgt geen focus- of foutrand.
- De vakjes zijn iets breder dan de cijfers (`2.9ch` en `4.9ch`), zodat de hints in letters (`dd`, `mm`, `jjjj`)
  passen; letters zijn breder dan cijfers.

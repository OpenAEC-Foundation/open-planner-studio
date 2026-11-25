# Het datumveld is voor toetsenbord en focus één veld

Het datumveld (`DateTextInput`, ADR 0460) bestaat uit drie vakjes, maar gedraagt zich als één veld. Het heeft één
tabstop: alleen het actieve vakje (`activeKind`, bij de start het eerste) heeft `tabIndex` 0, dus Tab en Shift+Tab verlaten de hele
groep in plaats van per vakje te stoppen. Tussen de vakjes beweeg je met typen en pijltjes. De focus mag wisselen
tussen de vakjes, de kalenderknop en het kalenderpaneel zonder dat het veld afrondt: `handleGroupBlur` rondt pas af
als `relatedTarget` buiten de groep en buiten het paneel ligt, want het paneel hangt via een portal aan `body`
(ADR 0464). Anders zou elke stap tussen de vakjes een halve datum aanbieden. Blok *f* van
`tests/planning/check-date-input-commit.ts` leest de brontekst op die voorwaarde en op de aanroep van `finish`.

## Gevolgen

- Doorspringen (`nextSegmentState`): een vol vakje (dag en maand twee cijfers, jaar vier) springt naar het volgende;
  andere tekens dan cijfers vallen weg. Is het volgende vakje al gevuld, dan selecteert `handleChange` de inhoud,
  zodat typen vervangt in plaats van op `maxLength` te stuiten. Een klik in een gevuld vakje zonder sleepselectie
  selecteert om dezelfde reden de inhoud (`onMouseUp`); voor een tweede klik zie knownbug 997.
- `-`, `/` en `.` worden niet getypt; in een vakje dat niet leeg is en niet het laatste, springen ze naar het
  volgende. Backspace in een
  leeg vakje gaat naar het vorige, met de cursor aan het eind. Pijl links aan het begin en pijl rechts aan het eind van
  een vakje gaan naar het buurvakje.
- Een muisklik in de groep naast de vakjes en naast de kalenderknop zet de focus op het eerste lege vakje, of aan het
  eind van het laatste als alles gevuld is (`focusEntry`).
- Enter rondt af via `finish`. Is het afronden niet tegengehouden, dan laat het veld de toets door naar
  `useDialogKeys`, zodat één Enter vastlegt en de dialoog bevestigt. Tegengehouden (onvolledig, onbestaand, leeg met
  `required`, of geweigerd door `onCommit`, ADR 0461) houdt het veld de toets tegen met `preventDefault` en
  `stopPropagation`. Dat de dialoog met de nieuwe waarde bevestigt, steunt op de ref in `useDialogKeys` waarmee de
  listener de laatste `onConfirm` leest, en op de aanname uit het weggehaalde commentaar dat React de state uit een
  keydown afrondt voordat het event `document` bereikt; die aanname is niet in een browsertest nagegaan. Blok *f*
  leest de brontekst op `if (blocked)` en op die ref.
- Escape zet de vakjes terug op `value` en wist de fout, alleen als er iets openstond: vakjes die van `value`
  afwijken, of een getoonde fout. Anders loopt de toets door naar de dialoog.

# Het datumveld legt vast bij het afronden, niet per toets

Het datumveld (`DateTextInput`, ADR 0460) leest een jaar al bij twee cijfers. Wie "01062030" intypt, komt daardoor
langs de geldige tussenwaarden 2020-06-01 en 0203-06-01 voordat 2030-06-01 er staat. Legde het veld per toets vast,
dan schreef één ingetypte datum drie keer naar de store, en bij een aanroeper met een undo-stap (taakdatums,
deadline, constraint) werden dat drie undo-stappen met onzinwaarden. We kozen ervoor dat een getypte datum pas naar
buiten gaat bij het afronden: de groep verlaten, Enter, of één bewuste handeling (een volledige datum plakken, een
dag kiezen in de kalender). De standaard is `commitMode = 'blur'`; de beslissing per fase en toestand staat in
`resolveDateCommit`, een functie zonder React of DOM zodat `tests/planning/check-date-input-commit.ts` de
toetsaanslagen met dezelfde functies (`nextSegmentState`, `resolveDateCommit`) naspeelt (blokken *a* en *b*). Bron:
het advies van 2026-07-20 in `docs/superpowers/HANDOFF-2026-08-14-roadmap.md`, om dit bij de bron op te lossen met
een `commitMode`-prop en niet met samenvoegsleutels per actie.

## Gevolgen

- `'live'` legt per toets vast en is alleen voor een plek met een lokale conceptwaarde en directe terugkoppeling, die
  pas later naar de store schrijft. Blok *e* van de check leest de bronnen en eist dat alleen
  `ProjectInfoPanelContent.tsx`, `ActualStartDialog.tsx` en `MoveProjectDialog.tsx` `commitMode="live"` zetten, en
  dat de standaard `'blur'` is.
- Afronden per toestand (`resolveDateCommit` in de fase `finish`, gebruikt door `finish`): leeg schrijft `''` (geen
  datum); een bestaande datum schrijft die datum en `finish` zet de vakjes daarna op de gelezen waarde (6 wordt 06, 26
  wordt 2026); onvolledig valt zonder melding terug op `value`; compleet maar onbestaand (31-02-2026) schrijft niets,
  toont de fout (`showError`: `aria-invalid` en de melding `dateInput.invalid` met `role="alert"`) en laat de invoer
  staan zodat de planner hem kan verbeteren. Typen wist een getoonde fout.
- Met `required` valt leeg afronden ook zonder melding terug, zoals onvolledige invoer. Het raster weigert een lege
  waarde op deze velden met de fout `required` (`taskEditPlan.ts`). Blok *h* van de check eist `required` op de
  startdatum in het paneel en in Taak bewerken en op beide beperkingsdatums.
- Of een write echt iets naar buiten brengt, beslist `dateCommitValue` (ADR 0462): een ongewijzigde datum geeft niets.
- Plakken (`handlePaste`): een tekst die `parseFlexibleDate` als volledige datum leest, vult de drie vakjes en legt
  meteen vast, ook bij `'blur'`, want het is één bewuste handeling zoals een kalenderkeuze. Een andere tekst gaat als
  gewoon plakken in het vakje met de focus, waar `nextSegmentState` alleen de cijfers houdt (knownbug 2501).
- `onCommit` mag `false` teruggeven: de aanroeper past de waarde dan bewust niet toe en meldt zelf waarom. Bij het
  afronden (`commitFrom`), bij plakken (`handlePaste`) en bij een kalenderkeuze (`pickDate`) zet het veld de vakjes
  dan terug op `value`, zodat de geweigerde invoer niet blijft staan en bij het verlaten niet opnieuw wordt
  aangeboden. Bij het afronden telt de weigering als terugval en houdt ze Enter tegen (ADR 0463). In de fase typen
  (`'live'`) gebruikt `handleChange` de uitkomst niet.
- Zolang de groep geen focus heeft en er geen fout staat, volgen de vakjes `value` (het effect op `groupFocused` en
  `showError`). `showError` staat in die voorwaarde zodat de opgeslagen waarde een onbestaande datum na het verlaten
  niet meteen overschrijft.
- `onDraftValidChange` meldt of de getoonde invoer geldig is: status `valid`, of leeg zonder `required`. Een dialoog
  die zelf een knop vrijgeeft, heeft dat nodig, want een halve of onbestaande datum komt niet in `value`.

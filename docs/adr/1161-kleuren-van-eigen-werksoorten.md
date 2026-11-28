# Kleuren van eigen werksoorten

Een eigen werksoort krijgt één keer een kleur die nog niet in gebruik is en houdt die, in *Mijn werksoorten* en in het
IFC-bestand (#856). Twee keuzes in `src/services/taskTypes/` verrassen zonder uitleg.

## Gevolgen

- De berekende reeks na de vaste kleuren (`generatedColor` in `customTaskTypeColors.ts`) slaat de tinten rond rood
  over: die lijken op de balk van een kritieke taak (`critical` in `themePalette.ts`).
- `load` in `personalTaskTypes.ts` vult ontbrekende kleuren aan maar schrijft ze niet terug; pas de eerste wijziging
  (`save`) bewaart ze. Een schrijfactie bij het lezen zou via `noteSiteHostSettingChanged` (standaard `'user'`) de
  sleutel ingebed als door de gebruiker gewijzigd melden, ook als de host nog niet heeft geantwoord (`noteChanged` in
  `siteHostSettings.ts`). Dat terugschrijven is niet nodig: ontbrekende kleuren gaan op volgorde van id
  (`withTaskTypeColors`), dus elk lezen van dezelfde lijst geeft dezelfde kleuren.

# XER lezen: status en voortgang

`status_code` is leidend: `TK_NotStart`, `TK_Active` en `TK_Complete` (zonder hoofdlettergevoeligheid) geven niet
gestart, lopend en voltooid, ook als de werkelijke datums of het percentage iets anders zeggen (wat dat na een
rondgang door IFC doet, staat in knownbug 115). Een andere niet-lege waarde wordt niet gestart, met een terugval in
het verslag (`statusOf`; knownbug 118). Alleen zonder status (de kolom ontbreekt, of de cel is leeg of alleen
spaties) leidt `statusFromProgress` hem af: een werkelijk einde of 100 % is voltooid, een werkelijke start of
voortgang boven 0 lopend, anders niet gestart. Dat is de regel van `normalizeImportedProgress` voor een taak buiten
`runningAtFullIds` (`check-xer-status-afleiden.ts`).

## Gevolgen

- Welke kolom het percentage geeft (`readXerProject`): bij `TK_NotStart` en `TK_Complete` leest de lezer geen
  percentagekolom en is de voortgang 0 of 1. Anders lezen `CP_Drtn` en `CP_Units` `complete_pct`, en `CP_Phys` of
  een lege `complete_pct_type` `phys_complete_pct`; een onbekende soort wordt `CP_Drtn` met een terugval. Geen soort
  valt terug op de kolom van een andere soort, zodat een onleesbare kolom die niet bij de soort hoort het openen niet
  laat mislukken (`check-xer-progress-families.ts` a tot en met e). Zonder `complete_pct` rekent `CP_Drtn`
  `1 − rest / duur` als er een rest is en de duur boven 0 ligt, anders 0 (`check-xer-reader.ts` 3j); `CP_Units` is
  dan 0, en `CP_Phys` zonder `phys_complete_pct` ook. De uitkomst is begrensd op 0 tot 100 %.
- `p6CompletePctType` gaat alleen mee als `complete_pct_type` gevuld is (ADR 0303).
- Zonder status maakt een werkelijk einde de voortgang 100 %. Bij een taak die zo voltooid is afgeleid, vult de
  lezer de werkelijke datums aan na `resolveMissingScheduleDates`, zodat geen plaatshouderdatum meetelt (ADR 0393):
  met alleen een einde wordt de start dat einde; zonder einde wordt de start `defaultActualStart` en het einde
  `defaultImportedActualFinish` (de statusdatum, anders het vroege of het geplande einde), in de volgorde van
  `orderActualsAfterDerivedFinish`. Dat zijn de standaarden van `normalizeImportedProgress`;
  `check-xer-status-afleiden.ts` 117-3, 117-4, 117-25 en 117-26 toetsen de datums en 117-24 status, percentage en
  datums na een rondgang door IFC. Met een status vult de lezer niets aan (117-18: `TK_Complete` met alleen een
  start houdt geen einde).
- De terugvallen in `xer.enumFallbacks` staan in de volgorde waarin de lezer de velden van een activiteit leest:
  soort, duursoort, status, voortgangssoort, prioriteit, constraint. `check-xer-reader.ts` 8 pint die volgorde.

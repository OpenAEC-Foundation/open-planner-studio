# Een verzameltaak rolt op uit haar bladen, in de projectkalender, zonder haar invoer aan te raken

Een verzameltaak komt nooit in de CPM-graaf: `solveProject` geeft de solver alleen bladtaken. Haar datums, speling,
duur, voortgang en status komen dus alleen uit de rollup (`rollupSummaryTasks` in `applyCpmResult.ts`, voortgang via
`summaryProgressOf` in `summaryProgress.ts`). De afgeleide duur rekent in de projectkalender, niet in
`task.calendarId`: een verzameltaak heeft geen eigen werk, en MS Project biedt dat veld op een samenvattingstaak niet
aan. In de eigen kalender kreeg een fase met een 7-daagse kalender "14d" te zien terwijl haar enige kind over
hetzelfde datumbereik "10d" is.

## Gevolgen

- De rollup schrijft `scheduleStart` en `scheduleFinish` van een verzameltaak niet. Die twee zijn invoer: de laag
  "Datums zoals opgeslagen" leest ze als wat het bestand zei. Overschrijven gaf daar twee tegenstrijdige kolommen op
  een fase en schreef bij opslaan in die modus een herberekening in het IFC.
- Een handmatig geplande verzameltaak rolt niet op, zoals in MS Project: ze houdt haar opgeslagen start, einde, duur
  en voortgang (`isSummaryProgressDerived`). Haar late datums zijn haar vroege, met speling 0, want speling uit de
  kinderen zegt niets over losgekoppelde eigen datums. `isCritical` komt wel uit de kinderen: of een fase kritiek werk
  bevat, spreekt haar eigen datums niet tegen. Alleen start en einde zijn op het corpus gemeten, de late kant niet.
- Een verzameltaak die als mijlpaal met duur 0 gemarkeerd is, krijgt geen afgeleide duur: de ruit in de Gantt hangt
  aan `isZeroDurationMilestone`, en een duur zou haar stil een balk maken.
- Starts worden als tekst vergeleken, einden als moment (`latestFinish`): een einde zonder tijd loopt tot het einde
  van die dag, dus "…-05" eindigt ná "…-05T13:00", terwijl het als tekst ervóór sorteert.
- De voortgangsstaat van een blad (`progressState`) neemt de meest afgeronde lezing: een blad met een werkelijk
  einde en voortgang 0,9 telt als voltooid. Het gezondheidsrapport meldt zo'n inconsistentie apart. Een fase krijgt
  pas een werkelijk einde als al haar bladen voltooid zijn, zodat 100% en een werkelijk einde ook op de fase samengaan.

# 1107: stop wegens precisieverlies na echte voortgangsinvoer

**Werkelijk verlies: de merge schrijft na echte app-invoer een duur met 17 cijfers terug met 6 decimalen.** De
verplichte naad weigert dit niet. Volgens de opdracht is de bouw gestopt, zonder de productcode te repareren en zonder
de eindtelling of de overige controles na main te draaien.

De branch bevat main met #898 (`20b9af79a74e7d886c2a38f93bba1adbcbb2ba5c`) via merge-commit `a1f6dba4a`.
Gemeten productcode: `f9a0daa48`. De gewone writer, lezer, verliesbewaking en openroute zijn die van main; de branch
voegt de verplichte naad toe. De merge-route is in deze meting op de branch uitgevoerd; dezelfde verliesproef is niet
nog eens apart op main gedraaid.

## De echte route en de vier gevallen

De proef opent `tests/planning/fixtures/oude-tags/v2026.9.0-17-cijfers-10-villa-wassenaar.ifc` met een gegenereerd
modeldeel in een eigen app-store. Zij voert op Set up site de echte `setTaskProgress(id, 0.5)` of
`setActualStart(id, scheduleStart)` uit. Beide acties accepteren de invoer. Daarna komen de verse writerinvoer, de
open-stappen op het domein zonder writer/lezer, de merge met naad en de volledige heropening van de uitvoer.

De oorspronkelijke bronrest is 2.3333333333333335. De tweede variant verandert alleen haar bronwaarde naar
1.2345678901234567; die variant is gemaakt, niet uit een plannerbestand afkomstig.

| Bronrest | Echte actie | Duur na invoer én na open-stappen domein | Duur na merge en volledige heropening | Rest na invoer én na open-stappen domein | Rest na merge en volledige heropening |
|---:|---|---:|---:|---:|---:|
| 2.3333333333333335 | 50 % voortgang | 2.3333333333333335 | 2.333333 | 1.16666666666667 | 1.166667 |
| 2.3333333333333335 | werkelijke start | 2.3333333333333335 | 2.333333 | 2.33333333333333 | 2.333333 |
| 1.2345678901234567 | 50 % voortgang | 2.3333333333333335 | 2.333333 | 1.16666666666667 | 1.166667 |
| 1.2345678901234567 | werkelijke start | 2.3333333333333335 | 2.333333 | 2.33333333333333 | 2.333333 |

Alle vier merges schrijven. Het opnieuw bepalen van de rest door de echte actie is op zichzelf verwacht. De
precisievermindering tussen die nieuwe invoer en de volledig heropende merge is het verlies. Ook openen van het domein
zelf houdt de precieze duur en de nieuwe precieze rest; dit wordt dus niet verklaard door de definitie van #886.

De aanvullende exacte vergelijking van `resourceCalendars` helpt hier niet: de gedeelde canon vergelijkt de
taakvelden via `writeIFC`, die beide kanten op dezelfde manier afrondt. De nieuwe naad ziet het verschil daardoor niet.
De eerder groene proeven met kale `updateTask` behielden de bronrest en oefenden deze echte invoer niet uit.

Bewijs en bron:

- [onderzoek-precisie.ts](1107-heropenkosten/v5/onderzoek-precisie.ts), de gerichte proef;
- [onderzoek-precisie.json](1107-heropenkosten/v5/onderzoek-precisie.json), volledige tijdvelden vóór en na elke stap;
- [onderzoek-precisie.log](1107-heropenkosten/v5/onderzoek-precisie.log), samengevatte waarden, exit 0 voor de meting;
- [oude-eigen.log](1107-heropenkosten/v5/definitief/oude-eigen.log), rode check, exit 1: 20 afwijkingen op 553 controles.

De oude checkverwachting dat de rest na de echte invoer ongewijzigd moet blijven is achterhaald. De aanvullende meting
vergelijkt daarom uitdrukkelijk met de **nieuwe** rest na de actie en na de open-stappen. Zij bewijst het verlies los
van die achterhaalde verwachting. De overige precisieasserties laten de afronding eveneens zien. Er is geen rode proef
weggelaten of groen gemaakt.

## Wat in deze ronde wel af is

`resourceCalendars` telt in de gedeelde vergelijking op id, met exacte inhoud. Een array blijft een array en dubbele
ids vallen niet samen. Alleen deze lijst wordt geordend; alle andere planningslijsten behouden hun volgorde.
Objectvelden tellen op sleutel, geneste arrays op plek. Een aanvullende exacte objectvergelijking bewaakt details die
de writer normaliseert, zoals een optioneel standaardveld en kloktijden onder de schrijfprecisie.

De herleestoets is vóór de wijziging rood op kalenderlijstvolgorde en erna groen. Alleen een andere volgorde wordt
doorgelaten. Kalender weg, kalender erbij, werktijd met 1e-9 uur gewijzigd, werkende uitzondering gewijzigd, een
standaardveld toegevoegd of een extra kalender met hetzelfde id: alle getypeerd geweigerd. De zes echte wisacties
schrijven en geven na de naad én volledige heropening dezelfde kalenders met dezelfde inhoud. Ook na de main-merge is
deze check groen.

Vier tijdelijke mutaties zijn elk rood met exit 1: weer op plek vergelijken, exacte inhoud overslaan, dubbele ids met
Map laten samenvallen en alle bibliotheekkalenders weglaten. Na elke mutatie is de bron met `cp` hersteld; `cmp` gaf 0
en SHA-256 is gelijk. Logs, herstelbewijzen en scripts staan in [v5](1107-heropenkosten/v5/).

Knownbug 1116 staat als BLOKKEERT vóór 1c geregistreerd, voor de PR van 1109. Die PR begint met opnieuw meten via echte
acties; b5 schrijft via `enterTaskProgress`. Vóór 1c moeten alle bewerkingen van de telling via app-acties lopen; nu doet
alleen voortgang dat. De kalenderlijstvolgorde is volgens Trias geen knownbug. 1107 blijft wegens de nieuwe bevinding
open.

## Main, pariteit, controles en telling

De pariteitsreferentie is opnieuw gegenereerd uit main `20b9af79a74e7d886c2a38f93bba1adbcbb2ba5c`; script en testkop
verwijzen naar die commit. Alleen de basiscommit in de fixture veranderde, geen verwachte uitkomst. Knownbug 1115 is
verwijderd. De pariteitscheck van de branch is na deze generatie wegens de stop nog niet uitgevoerd.

De controlelijst neemt elke check onder een **eigen** flock; het script zelf houdt geen rekenslot vast. De eerste reeks
is tijdens strikt onderbroken om de inmiddels gemergede #898 te integreren, vóór een eindtelling. De afgeronde checks
van die oude stand staan herkenbaar in `v5/voor-main/`. Op de samengevoegde code zijn typecheck, lint en herleestoets
exit 0. Oude-eigen is exit 1. De precisieproef is een geslaagde meting van verlies, geen groene behoudsproef.

Nog niet uitgevoerd na main: strikt, preserve, pariteit, open, target, duurvormen, i18n-verificatie, storegrenzen,
cycli, documentatie en eindtelling. `i18n:resolve` is na de merge uitgevoerd. Geen volledige suite, build, browser-,
Tauri- of 300 MiB-run lokaal. De 10 MiB-proef en de kostenmetingen van de naad zijn uit de eerdere ronde, niet herhaald.

De begintelling na #898 is **2578 geschreven / 685 geweigerd / 0 anders**, 3263 bewerkingen en 660 rijen. Het oorspronkelijke
laatste log van #898 is met herkomst en hash vastgelegd als [telling-main-na-898.log](1107-heropenkosten/v5/telling-main-na-898.log).
Er is **geen eindtelling van deze branch na main**; dus ook geen volledige vergelijking van die 660 rijen. De eerder
gemeten importweigering van 1116 blijft apart vermeld in [nieuwe-weigeringen.md](1107-heropenkosten/v5/nieuwe-weigeringen.md).

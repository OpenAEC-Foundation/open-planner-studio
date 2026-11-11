# 1107: ongewijzigd getal exact, stop op één bestand van de toets van Trias

**De toets van Trias schrijft 9 van de 10 bestanden.** De 17-cijfers-villa weigert getypeerd op een ongewijzigde rest.
Volgens de opdracht is het werk hier gestopt, zonder een uitzondering toe te voegen of het bronbehoud te repareren.
Er is nog geen eindtelling, mutatieproef of pariteitscheck van deze versie.

| Bestand | Bewerking | Uitkomst |
|---|---|---|
| oude-tags/v2026.9.0-17-cijfers-10-villa-wassenaar.ifc met model | bestaande duurwijziging en F5 van de toets van Trias | ongewijzigd-getal: taak task-ifc-_j2rFB79P78NtLEnkTKJwV (Set up site).time.remainingTime: 2.3333333333333335 → 2.333333 |

De andere negen schrijven en geven dezelfde planning als gewone opslag op main zonder model. De oude-eigen-check
is rood met **1 afwijking op 531 controles**, exit 1. De weigering geeft geen uitvoerbytes; er is in dit geval dus geen
stil verlies. Alle tien rijen staan in [oude-eigen.log](1107-heropenkosten/v6/oude-eigen.log).

## Wat is toegevoegd

Na de bestaande volledige vergelijking komt één extra eis in `writeIfcMerge`: ieder numeriek blad binnen een bestaande
taak dat gelijk bleef aan `opened`, en dat ook bij de open-stappen op het domein gelijk blijft, moet in de geopende
uitvoer exact gelijk zijn. Anders volgt `MergeNeedsPhase2Error` met kind `ongewijzigd-getal`, taak-id, taaknaam, veldpad
en beide waarden. Dezelfde verplichte callback blijft op beide kanten lopen.

De vergelijking loopt generiek door taakobjecten en arrays, zonder handmatige veldlijst. Daarmee omvat zij de duur,
rest, voortgang en alle numerieke spelingvelden in `task.time`, prioriteit en nivelleervertragingen op de taak, en
getallen in custom fields, onderbrekingen, contouren en andere geneste taakvelden. Werk en inzet in afzonderlijke
resource-/toewijzingsobjecten horen niet bij deze taak-eis; hun bestaande vergelijking blijft staan.

De definitie van gewijzigd blijft afwijkend van `opened`. Voor numerieke domeinwaarden gebruikt de extra eis exacte
getalgelijkheid, dezelfde waarde-eenheid als de JSON-vergelijking van `changedScopes` in de verliesbewaking. Zonder
`opened` gebruikt zij de al gelezen `pristine`, net als die bewaking; er is geen derde open-callback of modelscan.

Er is geen lijst met uitgezonderde afgeleide velden. Als de normale open-stappen op het domein een getal zelf veranderen,
valt dat getal onder de bestaande vergelijking na openen. Een invoergetal dat zij ongewijzigd laten, moet exact terug.
De weigering op de rest in de toets van Trias volgt juist omdat ook die open-stappen haar niet veranderen.

`planningCanon`, lezer, gewone writer en verliesbewaking zijn ongewijzigd. Gewijzigde taakgetallen blijven uitsluitend
onder de bestaande canon vallen en mogen zoals gewone opslag afronden. De vier gevallen weer laten schrijven met
exacte duur blijft werk voor de PR van 1109.

## Vier echte invoerroutes en rood bewijs

De blijvende herleestoets is uitgebreid met `setTaskProgress(id, 0.5)` en `setActualStart(id, scheduleStart)` op de
17-cijfers-villa met model en op de gemaakte variant met bronrest 1.2345678901234567. De proeven eisen een getypeerde
weigering met de ongewijzigde `time.scheduleDuration` in de melding.

Vóór de extra eis schrijven alle vier weer stil met duur 2.333333: [eerste-rood.log](1107-heropenkosten/v6/eerste-rood.log),
exit 1. De proef verzamelt alle vier uitkomsten vóór zij rood wordt. Na toevoeging van de eis bevestigt de
oude-eigen-check voor alle vier een getypeerde weigering op de duur. Hun rest is door de echte actie gewijzigd;
de oude verwachting dat die gelijk blijft aan de bronrest is verwijderd. Bij een toekomstige schrijvende oplossing
moet de ongewijzigde duur exact zijn; de gewijzigde rest valt onder de gewone opslagvergelijking.

De complete herleestoets is na de wijziging nog niet gedraaid. Ook de geëiste mutatie, waarbij de eis wordt weggenomen
en de vier weer stil schrijven, is wegens de expliciete stop op de toets van Trias **nog niet uitgevoerd**. Het rode
bewijs van vóór de implementatie vervangt die mutatievoorwaarde niet.

## Overdracht en nog uit te voeren

1109 is aangevuld met de vier echte invoergevallen en de eis om de ongewijzigde duur per slot te behouden. b5 schrijft
via de echte invoer. 1116 blijft voor die PR. 1107 blijft open vanwege de niet-gehaalde toets van Trias.

De telling drukt voortaan per getypeerde weigering één JSON-regel af met bestand, soort bewerking, bewerking en alle
meldingen. Dat maakt de latere vergelijking per geval mogelijk, ook voor een weigering vóór de nieuwe naad zoals 1116.
De telling is nog niet uitgevoerd. Referentie blijft main na #898: **2578 geschreven / 685 geweigerd / 0 anders**,
3263 bewerkingen en 660 rijen; er is geen totaalscore van deze versie.

De pariteitsreferentie staat nog op main `20b9af79a74e7d886c2a38f93bba1adbcbb2ba5c`. De check is in deze ronde niet
gedraaid. Typecheck, lint en de overige gevraagde eindchecks zijn evenmin uitgevoerd. Geen volledige suite, build,
browser-, Tauri- of 300 MiB-run. Elke uitgevoerde gerichte check had een eigen flock; geen run wacht nog.

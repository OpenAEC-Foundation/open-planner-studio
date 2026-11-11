# Kostenvoorwaarde vóór de verplichte herleestoets (1107)

**Gestopt wegens de kosten**, volgens de expliciete opdracht van Trias. De verplichte naad is nog niet gebouwd.
Geen verlies vastgesteld in deze proef; de kostenproef vergelijkt alleen aantallen taken en bewijst geen planningbehoud.
Geen nieuwe weigeringen: de merge-writer en de tests zijn ongewijzigd. Knownbug 1107 blijft open.

## Meting

11 november 2026, aia09-mp50, Linux x86_64, AMD Ryzen 7 3700U (8 logische CPU's), Node v24.22.0.
Broncode van main: `d456e6e7b800d876713641b73ca18e7dbfc87044`, de vereiste voorouder.
Meetscript: `scripts/proef/meet-merge-heropenen.mjs`.

Commando, exit 0:

```bash
export PATH="$HOME/.local/bin:$PATH"
flock /tmp/ops-zwaar.lock node scripts/proef/meet-merge-heropenen.mjs
```

De grootste opgeslagen IFC in de repo is 481752 bytes. De proef maakt eenvoudig grotere bestanden van 5 en 10 MiB met
de bestaande modelgenerator uit `meet-scanner.mjs` (dezelfde generator als #867), met de gezette showcase-planning en
wanden met geometrie en psets. Beide hebben 260 taken. Elk bestand draait in een nieuw Node-proces. Eerst openen via
`openForeign`, dan één ongewijzigde merge via de huidige `writeIfcMerge`, daarna aaneenvoegen en één volledige
`openForeign` op de merge-uitvoer. Er is geen naad of vergelijkingsalgoritme nagebootst: dit meet alleen de noodzakelijke
extra heropening, vóór de bouw. Geen productiebuild, geen 300 MB-run.

| Bytes | Merge zoals main | Extra heropening | Samen |
|---|---:|---:|---:|
| 5246344 | 1397 ms | 441 ms | 1838 ms |
| 10489230 | 1752 ms | 621 ms | 2373 ms |

Ruwe resultaten met alle geheugenmomenten: [kosten.jsonl](1107-heropenkosten/kosten.jsonl).
De piek-RSS tot na de merge was respectievelijk 238,8 en 275,4 MiB; tot na heropenen 248,6 en 287,4 MiB.
Dit zijn procespieken, geen geïsoleerde allocatiekosten. Garbage collection tijdens de extra open-route vertekent de
verschillen tussen momentopnamen; daaruit volgt geen betrouwbare extra geheugenpiek bij 300 MiB.

## Groei en stopbesluit

De planning blijft gelijk in omvang; alleen het model groeit. De extra route loopt via `ifcBytesRoute.ts` →
`runForeignScan` → `scanForeign` → `scanStep` en `classify`: zij scant en deelt het volledige model opnieuw in.
Daarnaast maakt `concat(parts)` één volledige nieuwe uitvoerbuffer. De extra kosten groeien dus met de modelbytes,
naast de kosten voor de planning.

De gemeten helling is (620,667 − 440,938) / (10489230 − 5246344) ms/byte. Met de vaste kosten van het kleine bestand erbij
geeft dat circa **11,0 s extra bij 300 MiB**, of circa 10,5 s bij 300 miljoen bytes. Dit is een ruwe extrapolatie van twee
kleine eenmalige metingen, geen gemeten 300 MB-resultaat. Wel ondersteunt de bestaande CI-meting in
`2026-11-ifc-fase0.md` de richting: scanner plus indeling bij 300 MB kostten al 5,4–6,5 s. Een Worker houdt de UI vrij,
maar neemt deze extra berekening niet weg. Alleen het aaneenvoegen vraagt bij 300 MiB al een nieuwe buffer van 300 MiB;
de scan vraagt daarnaast geheugen. De precieze extra piek is niet gemeten.

Dit overschrijdt voldoende duidelijk de grens "meer dan enkele seconden" uit de opdracht. Daarom is vóór de bouw
gestopt. Advies aan Trias: optie 1, de open-stappen delen en de bestaande scan benutten. Alleen het planningsdeel toetsen
kan goedkoper zijn, maar vraagt eerst een expliciet contract over context en selectie om dezelfde planning als de echte
open-route te bewijzen. Geen van beide alternatieven is hier gebouwd.

## Telling en open werk

De begintelling op de ongewijzigde main-code: **3263 bewerkingen over 67 bestanden; 2562 gelukt, 701 getypeerd geweigerd,
0 anders**, exit 0, 338,5 s. Twee bestanden weigeren bij openen; zie de volledige
[telling-voor.log](1107-heropenkosten/telling-voor.log), met uitkomst per bestand en bewerking.
Geen eindtelling: de stopvoorwaarde trad vóór de implementatie in; de writer en alle merge-checks blijven byte-gelijk.

Nog niet gedaan: verplichte signatuur en getypeerde weigering zonder callback; gedeelde canon; vergelijking van de hele
planning met veldmeldingen; herberekenproef; beide mutaties; eindtelling en regressiechecks van de nieuwe naad.
De bedoelde parameter zou de uitvoer als bytes ontvangen en na de echte open-route `WriteIFCInput` teruggeven; dat is
slechts het voorstel uit de opdracht. Er is nog geen signatuurwijziging. `sourceFormProblems` blijft volledig staan;
overlap is niet bewezen. Fase 1c moet na een keuze en implementatie de echte open-route meegeven met een test met de flag
aan. Ook de volledige suite, browser, Tauri en een productiebuild zijn niet lokaal gedraaid.

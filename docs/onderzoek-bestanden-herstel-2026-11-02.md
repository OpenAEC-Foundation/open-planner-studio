# Bestanden en herstel, 2 november 2026

Onderzocht op branch `kb/bestanden`, vanaf schone basis
`6386f95e6ca28b47c1ded7c085b74a1e15c2d87b`. De opdracht omvat de 46 punten onder
*Bestanden en herstel* in `knownbugs.md`. Wijzigingen aan ontwerp, appteksten of wat
bestanden lezen en schrijven vragen een keuze van Ethan. Bestanden uit PR's
#765, #721, #779, #780, #781 en #783 blijven buiten deze reparatie.

De onderstaande afbakening is gebaseerd op de bestaande meldingen en de huidige
broncode. Alleen punt 329 is in deze opdracht opnieuw met een test gereproduceerd;
de overige B- en S-aanduidingen zijn overgenomen uit `knownbugs.md`. Een S-punt is
hier dus niet alsnog als bewezen fout aangemerkt.

## Gerepareerd

**329 — Een mislukte herstelopslag houdt een update niet tegen.** De herstelhook
ving de fout af en meldde hem, waarna de expliciete herstelronde toch als geslaagd
terugkwam. De updater riep vervolgens `install` en `relaunch` aan. De hook geeft
de fout nu na de bestaande melding door. De periodieke aanroep handelt de
afwijzing af; de expliciete aanroep krijgt haar terug en blokkeert installatie.
Het punt is uit `knownbugs.md` verwijderd.

De uitbreiding van `check-recovery-worker.ts` voert de echte `useAutoSave`-hook en
`downloadAndInstall`-functie uit. De effectregistratie, klok, IndexedDB en
Tauri-plugins zijn testdubbels. Store, IFC-serialisatie, deltabepaling,
herstelbackend, foutmeldingen, flushregistratie en wachtrij zijn productiecode.
De test controleert:

- Een opslagfout voorkomt installeren en herstarten en geeft de bestaande foutmelding.
- Opnieuw proberen bewaart de laatste documentstand en laat daarna installatie toe.
- Een periodieke fout veroorzaakt geen onbehandelde afwijzing of stapel identieke meldingen.
- Een gewone volgende timerpoging schrijft de wijziging alsnog.
- Een manifestfout blokkeert installatie, ook wanneer de melding eerder is afgehandeld.
- Een serialisatiefout voorkomt installatie.
- Een update tijdens een lopende timeropslag wacht, krijgt dezelfde opslagfout en
  kan bij een volgende poging de nieuwste bewerking bewaren.

De regressie is daadwerkelijk tegen de oude hook uitgevoerd: de gerepareerde
`src/hooks/useAutoSave.ts` is naar `/tmp` gekopieerd, met de inhoud uit
`origin/main` vervangen, getest en met `cp` hersteld. De test met de oude hook
eindigde met exitcode **1** op deze vergelijking:

```text
329: een mislukte herstelschrijf mag niet installeren of herstarten
verwacht: [download]
gekregen: [download, install, relaunch]
```

De gerichte controles zijn ook na de merge van `main` uitgevoerd:

| Controle | Uitkomst |
| --- | --- |
| `bash tests/planning/run.sh check-recovery-worker.ts check-recovery-content.ts check-app-quit.ts` | Exit 0; de herstelregressie slaagt, documentinhoud 59 controles en schoon afsluiten 18 controles. |
| Dezelfde herstelregressie met `origin/main:src/hooks/useAutoSave.ts` | Exit 1 op de installatieblokkade; daarna de gerepareerde bron met `cp` teruggezet en bytegelijkheid gecontroleerd. |
| `npm run typecheck` | Exit 0 voor app, scripts en tests. |
| `node_modules/.bin/eslint src/hooks/useAutoSave.ts` | Exit 0. |
| `npm run i18n:resolve` na de merge | Exit 0; de sleutelinhoud was al juist, niets gewijzigd. |
| Vergelijking van de PR-bestandslijsten met de eigen diff | Alleen `knownbugs.md` overlapt: uitsluitend de verplichte verwijdering van 329. |
| Vergelijking van alle oorspronkelijke meldingsnummers met dit document | Alle 46 aanwezig, zonder dubbelen en met de oorspronkelijke B/S-aanduiding. |

## Voor Ethan

| Punt | Keuze en advies |
| --- | --- |
| 36 (S) | Bepaal of een schoon herladen browserdocument als sessieherstel aangeboden hoort te worden; reproduceer eerst de gewone herlaadroute en maak daarna onderscheid tussen tabbladen herstellen en onbewaarde bewerkingen herstellen. |
| 98 (S) | Bepaal hoe de host een gebruikersidentiteit en gebruikerswissel levert; isoleer daarna herstel en recente bestanden per hostgebruiker, inclusief migratie van bestaande opslag. |
| 115 (B) | Kies welke voortgang wint wanneer P6-status en actuals elkaar tegenspreken; bewaar expliciete broninformatie en hanteer in XER en IFC dezelfde afgesproken regel. |
| 118 (B) | Kies hoe een onbekende XER-status wordt geïnterpreteerd; leid de status net als bij een lege waarde uit voortgang af en behoud de melding. |
| 128 (S) | Kies hoe een onleesbare CSV-datum zichtbaar wordt afgehandeld; bevestig eerst de route en weiger de betreffende invoer in plaats van stil vandaag te gebruiken. |
| 150 (B) | Kies de waarschuwing over verlies bij openen in OPS v2026.9.0; vermeld ook de lege werkblokken en nulduur, naast het eerder aanvaarde kalenderverlies. |
| 162 (B) | Kies hoe Opslaan met een alleen-lezen POSIX-doel omgaat; respecteer de ontbrekende schrijfbit vóór atomair vervangen en gebruik de bestaande opslagfoutroute. |
| 261 (S) | Kies tussen een tijdelijke lijst en het verbergen van Recent in een sandbox; reproduceer eerst de iframe-route en behoud bij voorkeur een lijst in het geheugen voor de lopende sessie. |
| 256 (B) | Kies het invoercontract van de ruwe IFC-writer; normaliseer een kale planningsstart met zijn veldregel voordat deze als letterlijk moment wordt geschreven. |
| 290 (S) | Kies wat een te lang MSPDI-maatrecord mag verliezen; bewijs eerst het gedrag in MS Project en maak overschrijding van 255 tekens zichtbaar vóór export. |
| 295 (B) | Kies wanneer een IFC-dagenrecord na externe kalenderwijziging nog geldig is; controleer kalender en duurtype en val bij een mismatch terug op de geschreven urenmaat. |
| 300 (S) | Kies hoe conservatief de herkenning van gewijzigde oude OPS-XML moet zijn; verbreed de vingerafdruk pas met echte oude en extern opgeslagen fixtures. |
| 301 (S) | Kies ondersteuning van OPS-tekstvelden in MPP; voeg die pas toe met een echte door MS Project opgeslagen fixture en dezelfde geldigheidscontroles als MSPDI. |
| 304 (S) | Kies de afhandeling van een te lange kalenderlijst in MSPDI; maak de 255-tekengrens zichtbaar en bewijs de uitvoer met MS Project vóór een andere schrijfvorm. |
| 308 (S) | Kies de leesregels voor oude OPS-XML zonder kalenderlijst; bevestig beide gevallen eerst met echte oude writers en behoud tot die tijd de conservatieve herkenning. |
| 337 (B) | Kies de correctie van de uurtaakvoorbeelden in De Vaart; zet bij `durMinutes` de ureneenheid en werk de veranderende planning en gidsgetallen samen bij. |
| 382 (S) | Kies hoe 100 procent zonder werkelijk einde maar met positieve rest wordt gelezen; verander dit alleen met een echte bronfixture en behoud echte rest bij afgeronde percentages. |
| 372 (B) | Kies waar de afgesproken minuutgrens wordt toegepast op een kalendertijdduur in dagen; herstel de omzetting met een expliciete grensproef voor 5/6 dag zonder een echte fractie voortijdig af te ronden. |
| 375 (B) | Kies of een volledig Excel-datumgetal onder alleen een tijdopmaak wordt geweigerd of gemeld; weiger het zichtbaar wanneer de verborgen datum tot een ander werkelijk einde kan leiden. |
| 468 (B) | Geef akkoord op een wijziging van de geschreven MSPDI-XML-volgorde; verplaats `MaterialLabel` en `StandardRate` naar hun schemapositie en toets tegen het schema. |
| 469 (S) | Kies de exportregel voor een urentaak in kalendertijd met alleen rest in dagen; bevestig de afwijking en laat writer en motor daarna dezelfde effectieve rest gebruiken. |
| 471 (B) | Kies de behandeling van overlappende beschikbaarheidsperioden; weiger overlap en vergelijk voor het open einde de volledige NA-tijdstempel. |
| 472 (B) | Geef akkoord op de gewijzigde interpretatie van ongeldige MSPDI-perioden; bereken `lastFrom` uitsluitend over geaccepteerde rijen zodat een ongeldige rij geen geldig open einde sluit. |
| 476 (B) | Kies wanneer een eigen kopie van P6 een profieladvies krijgt; toon het advies alleen bij een relevant rekenverschil met het ingebouwde P6-profiel. |
| 509 (B) | Geef akkoord op veranderende voorbeeldbestanden en hun geschreven ids; deel één bronopbouw tussen externe koppeling en bronbestand en laat de controle de echte ids vergelijken. |

## Overgeslagen wegens botsing met een uitgesloten PR

De bestandslijsten van de zes uitgesloten PR's zijn via GitHub opgehaald. De
benodigde aanpassing raakt de onderstaande bestanden of routes. Ook waar een
andere plek voor de fix denkbaar is, wordt het gedeelde punt hier niet tegelijk
aangepakt. De verplichte verwijdering van het gerepareerde punt 329 uit
`knownbugs.md` is de enige wijziging in dat gedeelde inventarisbestand.
Tijdens dit werk is #781 gemerged in `main` (`dd9d7b46c`). Die main is zonder
conflicten in deze branch gemerged; de afgesproken uitsluiting van die bestanden
is voor de eigen reparatie aangehouden.

| Punt | Botsing en reden |
| --- | --- |
| 97 (B) | #765 wijzigt `Dialog.tsx`, `SiteOpenDialog.tsx` en `SiteSaveDialog.tsx`; de dialoogstapeling vraagt daarnaast een ontwerpkeuze. |
| 127 (B) | #781 wijzigt `fileSlice.ts`; dit punt gaat over de koppeling tussen IFC Toepassen en de laadactie in die slice. |
| 330 (B) | #783 (`fix/recovery-dirty-fallback`) behandelt dit punt al en wijzigt `src/services/recovery/recoveryStore.ts` en `tests/planning/check-recovery-web-hold.ts`; die bestanden zijn hier niet aangepast. |
| 291 (B) | #781 bezit `src/services/p6/p6xmlReader.ts`. |
| 296 (B) | #781 bezit `p6xmlWriter.ts` en exportmeldingen; de voorgestelde fix wijzigt ook apptekst. |
| 302 (S) | De gedeelde MSPDI/P6-exportregel raakt `p6xmlWriter.ts` in #781 en verandert geschreven projectdatums. |
| 303 (S) | De gedeelde MSPDI/P6-uitzonderingsregel raakt `p6xmlWriter.ts` in #781 en verandert geschreven kalenderdatums. |
| 305 (S) | De gedeelde MSPDI/P6-kalenderpromotie raakt de adapterroute en `check-uren-f5a2-adapters.ts` uit #781. |
| 306 (B) | De promotieregel omvat de P6-lezer en `check-adapters-hours.ts` uit #781 en verandert importsemantiek. |
| 335 (B) | De MSPDI/P6-rondgang en zijn bestaande adaptertest raken `p6xmlReader.ts` en `check-adapters-hours.ts` uit #781. |
| 336 (B) | #781 wijzigt `fileSlice.ts`; `parseExternalSource` en de actie voor externe ankers zitten in die slice. |
| 470 (B) | #765 wijzigt `ResourcePanel.tsx`, waar het betrokken capaciteitsveld staat. |
| 480 (S) | #781 wijzigt `xerExportLoss.ts`, `xerWriter.ts`, `p6xmlWriter.ts` en de bijbehorende verliesenvelopetests. |
| 482 (B) | #781 wijzigt precies de betrokken `check-xer-export-loss.ts`. |
| 483 (B) | #781 wijzigt `fileSlice.ts`; de voorgestelde bundeling verandert bovendien appmeldingen. |
| 463 (S) | #781 wijzigt `xerWriter.ts`; het unieke Project-ID zou ook andere waarden in exportbestanden schrijven. |
| 464 (S) | #781 wijzigt `xerWriter.ts`; de fix zou bovendien nieuwe XER-velden schrijven. |
| 465 (S) | #781 wijzigt `xerWriter.ts`; bevestiging van de encoding vraagt een echte P6-import. |
| 467 (B) | #781 bezit `p6xmlWriter.ts`; de fix verandert het geschreven duurtype. |
| 475 (B) | #781 wijzigt `xerWriter.ts` en de verliesregels; de oplossing vraagt tevens ander profieladvies in apptekst. |

## Nieuwe punten en grenzen van het bewijs

Er zijn geen nieuwe knownbugs geregistreerd; de gereserveerde reeks 740–759 is
ongebruikt. Er is geen ander team gestart of benaderd en er is niets gemerged.
Er zijn geen appteksten, vertalingen, Help-artikelen, import- of exportvelden
gewijzigd.

Lokaal is uitsluitend gericht gecontroleerd, onder `flock /tmp/ops-zwaar.lock`.
Er is geen volledige testsuite, productiebuild, Tauri-build of dev-server gestart.
De native desktopinstallatie en herstart zijn nagebootst; er is geen echte update
geïnstalleerd. De volledige suite en builds moeten uit CI op de uiteindelijke
PR-head blijken. De gewone PR-CI bevat geen browsersuite.

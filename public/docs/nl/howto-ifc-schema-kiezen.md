# Het IFC-schema kiezen

Doel: je planning opslaan in het IFC-schema van het bouwmodel waarmee je haar wilt samenvoegen.

## Wanneer je dit nodig hebt

De app slaat een project standaard op als IFC 4.3 ADD2. Zo heet IFC 4.3 in de bestanden die IfcOpenShell en Bonsai maken. Wil je de planning samenvoegen met een bouwmodel tot één 4D-bestand, bijvoorbeeld met het recept *MergeProjects* van IfcOpenShell (ifcpatch), dan moeten beide bestanden hetzelfde schema hebben. Is het bouwmodel een IFC4-bestand, dan weigert IfcOpenShell het samenvoegen met een IFC 4.3-planning. Kies dan hier het schema van het model.

## Stappen

1. Open *Projectinstellingen*: *Instellingen › Project › Projectinstellingen*, of *Bestand › Projectinstellingen*.
2. Kies bij *IFC-schema bij opslaan* het schema van je bouwmodel.
3. Klik op *Toepassen*. Het project staat nu op *Niet opgeslagen*.
4. Sla op met *Opslaan* (Ctrl+S) of *Opslaan als*.

De drie keuzes:

- *IFC 4.3 ADD2 (standaard)* schrijft `IFC4X3_ADD2` in de kop van het bestand.
- *IFC 4.3* schrijft `IFC4X3`. Zo schreven oudere versies van de app IFC 4.3.
- *IFC4* schrijft `IFC4`, voor een bouwmodel in IFC4.

## Valkuilen en wat de app dan doet

**Voeg samen als laatste stap.** De app weigert voorlopig IFC-bestanden met bouwmodelobjecten te openen: de planningsschrijver kan die objecten niet bewaren. Dat geldt ook als het bestand taken bevat en als je het IFC-schema houdt. Bewerk het losse planningsbestand en voeg het daarna opnieuw samen met het bouwmodel. Een geweigerd bestand wordt niet gewijzigd.

**De app vraagt eerst als een geopend bestand een ander schema heeft.** Open je bijvoorbeeld een IFC4-bestand, of een IFC 4.3-bestand van een oudere versie van de app, dan verandert de app het bestandstype niet zomaar. Bij de eerste keer *Opslaan* of *Opslaan als* vraagt ze eerst of je het schema van het bestand houdt of naar IFC 4.3 ADD2 gaat. *IFC4 houden* (of *IFC 4.3 houden*) is de knop die Enter kiest. Sluit je de vraag met Esc of het kruisje, dan slaat de app niets op.

**De app vraagt het maar één keer per bestand.** Je keuze staat in het bestand zelf. Open je het later weer, dan vraagt de app het niet opnieuw. Kies je zelf een schema in *Projectinstellingen* en klik je op *Toepassen*, dan vraagt de app ook niets meer.

**Een schema dat de app niet kan schrijven**, zoals IFC2X3, opent de app wel. Bij de eerste keer opslaan zegt de vraag dat, en kies je een van de drie schema's hierboven.

**Automatisch opslaan en crashherstel vragen niets.** Ze schrijven het schema van het bestand en bewaren de vraag voor de eerste keer dat je zelf opslaat. Bij een schema dat de app niet kan schrijven, schrijft *AutoSave* niet naar het bestand tot je de vraag hebt beantwoord.

**Een nieuw project vraagt niets.** Een nieuw project, en een project uit een ander formaat zoals XER, MPP of CSV, begint op *IFC 4.3 ADD2 (standaard)*.

**De inhoud van het bestand verandert niet.** De drie schema's kennen de planningsgegevens die de app schrijft op dezelfde manier. Alleen de regel `FILE_SCHEMA` in de kop verschilt. Je verliest dus niets als je een ander schema kiest.

**Een IFC 4.3-model uit IfcOpenShell of Bonsai** heeft meestal `IFC4X3_ADD2` in de kop, net als de standaard van de app. IfcOpenShell voegt een planning met `IFC4X3` daar niet mee samen. Kijk bij twijfel in de regel `FILE_SCHEMA` bovenaan het bestand van het model.

**Ongedaan maken verandert het schema niet.** Het schema hoort bij het bestand, net als de plek waar het staat. Een keuze in *Projectinstellingen* en het antwoord op de vraag bij opslaan zijn daarom geen stap in *Ongedaan*. Wil je terug, kies dan het andere schema in *Projectinstellingen*. Zo schrijft *AutoSave* na een ongedaan gemaakte bewerking nooit stil een ander schema.

## Zie ook

- [Nieuw project en Projectinstellingen](docs://ref-projectinfo): alle velden van het formulier.
- [Bestanden en formaten](docs://uitleg-bestanden): waarom IFC het eigen formaat van de app is.
- [Een bestand openen en opslaan](docs://howto-bestand-openen-en-opslaan): opslaan en opslaan als.

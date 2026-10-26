# Een MS Project-bestand (.mpp) openen

Doel: een planning uit Microsoft Project rechtstreeks in de app openen, zonder hem eerst te exporteren.

## Wanneer je dit nodig hebt

Een aannemer, adviseur of opdrachtgever stuurt je zijn planning als `.mpp`-bestand. Je wilt hem bekijken, doorrekenen of verder uitwerken. De app leest `.mpp`-bestanden van MS Project 2010 tot en met 2021. Ze leest alleen: ze schrijft geen `.mpp` en verandert je bestand nooit. Uit het bestand haalt ze de planning zelf: taken met structuur, duur en constraints, relaties met lag, kalenders, resources, toewijzingen en voortgang. Ook de datums en speling die MS Project zelf uitrekende leest ze, maar die gebruikt ze alleen voor de weergave *Datums zoals opgeslagen*, nooit als invoer.

## Stappen

1. Kies *Start › Bestand › Openen* of druk op Ctrl+O. Kies het `.mpp`-bestand.
2. Het project opent in een nieuw tabblad, of in het huidige tabblad als dat nog leeg en ongewijzigd was. Het project heeft geen bestand: *Opslaan* schrijft later een nieuw IFC-bestand. Daarna legt een venster kort uit wat de app uit het bestand overnam en hoe opslaan werkt; zie [Een bestand openen en opslaan](docs://howto-bestand-openen-en-opslaan).
3. Lees de melding onderaan: *Dit project rekent als Microsoft Project. Aanpassen via Bestand → Projectinstellingen → Rekenprofiel en reken-opties.* De app rekent dit project door met de rekenregels van MS Project: het rekenprofiel *Microsoft Project*. Met *Rekenprofiel openen* ga je naar de instelling, *Lees meer* opent de Help over rekenprofielen.
4. Kijk of er een strook onder het lint staat: *Je ziet de datums zoals ze in het bestand staan; bij herberekenen wijken 4 taken af.* Dan wijkt de uitkomst van de app op die taken af van de datums die MS Project opsloeg. Onder de melding uit stap 3 staat dan ook een regel: *4 taken tonen de datums zoals ze in het bestand staan (niet herberekend).* Wat dat betekent en hoe je terugschakelt naar de eigen berekening, staat in [Datums zoals opgeslagen](docs://uitleg-datums-zoals-opgeslagen).
5. Staat er *Dit bestand bevat urenplanning.* met de knop *Urenplanning aanzetten*, dan bevat het bestand gegevens in uren. Zie [Urenplanning aanzetten](docs://howto-urenplanning-aanzetten).

Bevat het bestand taken met onderbrekingen, nivellering of een resource-gedreven planning, dan komt er nog een melding bij, zoals *Dit MS Project-bestand bevat 3 taken met een onderbroken, genivelleerde of resource-gedreven planning. Die worden als zodanig ingelezen en getoond.* Bij één taak staat de melding in het enkelvoud.

## Valkuilen en wat de app dan doet

**Niet alles komt mee.** Na het openen zegt de app in één melding wat ze niet heeft overgenomen: *Niet alles uit dit MS Project-bestand is overgenomen.* Daaronder staat per onderdeel een regel met het aantal, bijvoorbeeld *2 baselines zijn niet overgenomen.* Bij een `.mpp` staat de zin over het rekenprofiel uit stap 3 dan als eerste regel in deze melding. De melding blijft staan tot je op het kruisje klikt. Gaat er niets verloren, dan krijg je deze melding niet. Een regel kan gaan over:

- ingevoegde projecten (subprojecten): de app leest ze als gewone taak, zonder de koppeling naar het andere bestand;
- externe taken uit een ander project: de app leest ze als gewone taak;
- baselines: uit een `.mpp` neemt de app geen baseline over, uit MS Project XML alleen Baseline 0 van taken, en daarvan alleen de datums en de duur (bij een taak in uren ook het tijdstip; werk en kosten niet, en ook geen baselines van resources en toewijzingen);
- bij MS Project XML: een toewijzing waarvan de baseline andere datums heeft dan haar taak. De app bewaart alleen de baseline van de taak; is die gelijk, dan gaat er niets verloren en meldt de app niets. Ook een afwijkend tijdstip op dezelfde dag telt als afwijking;
- eigen velden met waarden, zoals aangepaste velden, waarden uit een opzoektabel en overzichtscodes (ja/nee-velden in een `.mpp` telt de app niet);
- aantekeningen (ook een aantekening met alleen een afbeelding) bij resources en toewijzingen, en uit een `.mpp` ook bij taken (uit MS Project XML komt de aantekening van een taak mee als beschrijving);
- hyperlinks;
- de vaste kosten van taken;
- de tarieven van resources: uit een `.mpp` geen enkel tarief, uit MS Project XML alleen het standaardtarief;
- alleen bij MS Project XML: handmatig geplande taken (de app plant ze automatisch), inactieve taken (ze tellen mee in de berekening) en de nivelleringsvertraging.

De drempel voor kritiek uit MS Project wordt als projectinstelling overgenomen, zowel uit `.mpp` als XML. Hij blijft gelden na herberekenen en opslaan als IFC.

Een WBS-code die je zelf in MS Project invulde, neemt de app wel over; anders nummert ze de taken volgens de structuur.

**Een bestand van MS Project 2007 of ouder.** De app weigert het en meldt: *Dit .mpp-bestand gebruikt een oud formaat (Project 2007 of ouder). Exporteer het in MS Project als XML (Bestand → Opslaan als → XML) en open dat bestand.* Achter de melding staat een technische reden in het Engels.

**Een bestand met wachtwoord.** De app meldt: *Dit .mpp-bestand is met een wachtwoord beveiligd. Exporteer het in MS Project als XML (Bestand → Opslaan als → XML) en open dat bestand.* Ook hier staat achter de melding een technische reden in het Engels.

**Een bestand dat geen `.mpp` blijkt.** Je krijgt *Bestand openen mislukt*, met een technische reden erbij.

**De XML-route rekent anders.** Open je de MS Project XML-export in plaats van het `.mpp`, dan rekent de app met het rekenprofiel *Open Planner Studio* en zie je de melding over *Microsoft Project* niet. De datums kunnen dan anders uitkomen dan bij het `.mpp`-bestand. Ook bij de XML-export zegt de app wat ze niet overneemt; zie *Niet alles komt mee*.

**Een bewerking laat MS Project's sturing los.** Bewerk je een taak waarvan het datumvenster uit MS Project de planning stuurde, dan meldt de app eenmalig per project: *Het datumvenster uit MS Project stuurt 2 taken niet meer na deze bewerking; de urenverdeling zelf blijft gelden en in het bestand bewaard.* Bij één taak staat de melding in het enkelvoud.

**Opslaan overschrijft je `.mpp` nooit.** Het project heeft geen bestand. *Opslaan* vraagt waar het nieuwe IFC-bestand moet komen.

## Zie ook

- [Bestanden en formaten](docs://uitleg-bestanden): waarom een `.mpp` alleen gelezen wordt en wat opslaan schrijft.
- [Datums zoals opgeslagen](docs://uitleg-datums-zoals-opgeslagen): de weergave van MS Project's eigen datums.
- [Urenplanning aanzetten](docs://howto-urenplanning-aanzetten): als het bestand gegevens in uren bevat.
- [Een Primavera P6-bestand (.xer) openen](docs://howto-xer-openen): hetzelfde voor Primavera.
- [Import- en exportformaten](docs://ref-import-exportformaten): per formaat wat meegaat en wat niet.
- [Rekenprofielen en conventies](docs://uitleg-rekenprofielen): waarom een MS Project-bestand met een eigen rekenprofiel opent.

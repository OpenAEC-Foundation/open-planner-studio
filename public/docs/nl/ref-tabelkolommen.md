# Tabelkolommen

De takentabel heeft 86 vaste kolommen, plus een kolom per activity code en eigen veld van het project en acht kolommen per baseline. In dit artikel staat per kolom wat hij toont, of je hem kunt bewerken en in welke vorm de waarde staat. Hoe je kolommen kiest en ordent, staat in [Tabelkolommen aanpassen](docs://howto-tabelkolommen-aanpassen).

## Waar je kolommen kiest

De takentabel naast de Gantt en de tabel op het tabblad *Tabel* hebben elk hun eigen kolomkeuze. Het plusje rechts in de kop opent de kolomkiezer; op *Tabel* kan het ook met *Tabel › Kolommen › Kolommen…*. In de kiezer staan de kolommen per categorie: *Taak*, *Planning*, *Beperkingen*, *Relaties*, *Resources*, *Voortgang*, *Berekend*, *Baseline*, *Aangepast* en *Technisch*. Je zoekt op naam, en bovenaan staat *Laatst gebruikt*. *Herstel standaard* zet de standaardkolommen terug.

Standaard toont de tabel naast de Gantt *WBS*, *Taaknaam* en *Duur*. De tabel op het tabblad *Tabel* toont *WBS*, *Taaknaam*, *Duur*, *Start*, *Einde*, *Taaktype*, *Kritiek*, *Totale speling* en *Voortgang*, plus een kolom per activity code en eigen veld van het project.

## Hoe je waarden leest en bewerkt

- **Berekende kolommen** — de kolommen in de categorie *Berekend* en een aantal andere zijn alleen-lezen: ze komen uit de berekening. Probeer je er een te bewerken, dan zegt de app *Deze berekende kolom kan niet worden bewerkt.* Zijn ze verouderd omdat je iets wijzigde, dan staat er *verouderd* bij tot je *Bereken* drukt.
- **Datums** — staan in de notatie die je koos onder *Instellingen*, tabblad *Weergave*, kop *Datumnotatie*.
- **Duren en speling** — een duur staat in de eenheid van de taak (`5d`, `12h`), of volgens *Duurweergave* op hetzelfde tabblad (*Automatisch (eigen eenheid per taak)*, *Altijd dagen* of *Altijd uren*). Speling staat in werkdagen met twee decimalen en het decimaalteken van je taal.
- **Ja/Nee** — een ja/nee-waarde staat als *Ja* of *Nee*; een lege waarde als een streepje (—).
- **Bewerken** — typ of kies een waarde. Een ongeldige waarde wordt geweigerd met een reden onder de cel, bijvoorbeeld *Voer een geldige duur in, zoals 5d of 8u.* of *Voer een percentage tussen 0 en 100 in.* Plakken van een blok cellen werkt cel voor cel; alleen-lezen cellen worden overgeslagen en de app meldt hoeveel.

## Taak

- **Taaknaam** — de naam van de taak. Bewerkbaar; verplicht.
- **Beschrijving** — de beschrijving. Bewerkbaar; vrije tekst.
- **WBS** — de WBS-code. Bewerkbaar en verplicht, maar alleen-lezen zolang *WBS auto* aan staat.
- **Taaktype** — het taaktype (*Bouw*, *Installatie*, *Sloop*, *Logistiek*, *Keuring/Inspectie*, *Verplaatsing*, *Renovatie*, *Onderhoud* of *Overig*). Bewerkbaar met een keuzelijst.
- **Eigen taaktype** — het eigen taaktype uit het project, of een streepje. Bewerkbaar met een keuzelijst van de eigen typen van het project.
- **Kleur** — de bewaarde kleur van de taak, als kleurcode zoals `#1a73e8`. Bewerkbaar met een kleurkiezer. De Gantt-balken gebruiken hem niet; balkkleuren stel je in bij *Beeld › Baselines & voortgang › Balkkleuren*.
- **Aantekeningen** — de aantekeningen als `✓ tekst; ○ tekst`. Bewerkbaar zolang er hoogstens één aantekening is (je bewerkt dan de tekst ervan); bij meer aantekeningen alleen-lezen.

## Planning

- **Mijlpaal** — of de taak een mijlpaal is. Bewerkbaar. Aanzetten maakt de duur 0; de app weigert het bij een samenvattingstaak en bij een taak met toewijzingen.
- **Soort mijlpaal** — *Startmijlpaal* of *Eindmijlpaal*, of een streepje voor automatisch. Alleen bij een mijlpaal te bewerken.
- **Verplichte mijlpaal** — de vlag *Verplicht (contractueel)*. Alleen bij een mijlpaal te bewerken.
- **Nivelleerprioriteit** — een geheel getal van 0 tot 1000, standaard 500. Bewerkbaar. 1000 zet de taak vast voor nivelleren.
- **Onderbrekingen** — het aantal onderbrekingen, als `Onderbrekingen: 2`, of een streepje. Alleen-lezen; bewerken doe je in het paneel *Eigenschappen*.
- **Werkregel** — de werkregel van de taak; leeg is de projectstandaard. Bewerkbaar met een keuzelijst, maar leeg en alleen-lezen bij een mijlpaal, samenvattingstaak of hammock. Alleen zichtbaar in de kiezer als de werkregels zichtbaar zijn (*Toon werkregels en werk*, of het bestand draagt werkregels).
- **Hammock (afgeleide duur)** — of de taak een hammock is. Bewerkbaar, behalve bij een mijlpaal of samenvattingstaak.
- **Kalender** — de kalender van de taak; leeg is de projectkalender. Bewerkbaar met een keuzelijst van de kalenders van het project. De cel toont de interne id van de kalender, niet zijn naam.
- **Duurtype** — *Werktijd* (de duur telt in werkdagen of werkuren van de kalender) of *Verstreken tijd* (de duur telt in doorlopende kloktijd, zonder kalender). Bewerkbaar.
- **Duureenheid** — *Dagen* of *Uren*. Bewerkbaar behalve bij een samenvattingstaak, hammock of mijlpaal; wisselen kan alleen als de omrekening exact klopt en *Urenplanning inschakelen* aan staat.
- **Duur** — de duur van de taak, in de eenheid van de taak of volgens *Duurweergave*. Bewerkbaar: typ `5d`, `12h` of `1h 30m`; ook een getal in de eenheid van de taak. Alleen-lezen bij een samenvattingstaak, hammock en mijlpaal met duur 0.
- **Start** — de getoonde start, dezelfde datum als de Gantt-balk. Bewerkbaar. Een taak met voorganger die je een nieuwe start geeft, krijgt de constraint *Start niet eerder dan (SNET)* op die datum. Alleen-lezen bij een samenvattingstaak of hammock, tenzij handmatig gepland.
- **Einde** — het getoonde einde. Bewerkbaar: een nieuw einde wordt een nieuwe duur. De app weigert het bij een voltooide taak, een mijlpaal, een taak in verstreken tijd en een taak met onderbrekingen. Alleen-lezen bij een samenvattingstaak of hammock, tenzij handmatig gepland.
- **Geplande start** — het planningsanker waar de berekening van uitgaat (niet noodzakelijk de getoonde start). Bewerkbaar; hetzelfde effect als typen in *Start*.
- **Gepland einde** — het ingevoerde einde. Alleen bewerkbaar bij een handmatig geplande taak; anders zegt de app *Gepland einde telt alleen bij een handmatig geplande taak. Wijzig het einde via de kolom Einde of via de duur.*

## Beperkingen

- **Constrainttype** — het type van de constraint, van *Zo vroeg mogelijk (ASAP)* tot *Moet eindigen op (MFO)*. Bewerkbaar; een taak zonder constraint toont *ASAP*.
- **Constraintdatum** — de datum bij de constraint. Bewerkbaar.
- **Harde constraint** — de vlag *Verplicht (pin logica)*. Alleen bij *MSO* en *MFO* te bewerken.
- **Type secundaire constraint** — het type van de tweede grens (*SNET*, *FNET*, *SNLT* of *FNLT*), of een streepje. Bewerkbaar.
- **Datum secundaire constraint** — de datum bij de tweede grens. Bewerkbaar.
- **Deadline** — de streefdatum voor het einde. Bewerkbaar.

## Relaties

- **Voorgangers** — de voorgangers, als `WBS type±lag`, gescheiden door `; `, bijvoorbeeld `1.2 FS+2d`. Bewerkbaar door dezelfde vorm te typen. Een externe relatie voeg je niet hier toe maar met *Relatie › Externe relatie toevoegen…*.
- **Opvolgers** — de opvolgers, in dezelfde vorm. Bewerkbaar.
- **Bepalend** — de relaties die de datum van deze taak bepalen, als `← 1.2` (voorganger) of `→ 1.4` (opvolger). Alleen-lezen; verouderd tot *Bereken*.
- **Vrije speling** (in de categorie *Relaties*) — de vrije speling per relatie, als `← 1.2: 3d`. Niet dezelfde kolom als *Vrije speling* onder *Berekend*, die de speling van de taak zelf toont. Alleen-lezen.
- **Meldingen** — waarschuwingen per relatie, bijvoorbeeld *Buiten volgorde* of *Niet meegerekend bij de berekening*. Alleen-lezen. Zie [Meldingen en waarschuwingen](docs://ref-meldingen).

## Resources

- **Toegewezen resources** — de namen van de toegewezen resources, gescheiden door komma's. Bewerkbaar: een naam erbij wijst de resource toe met 1 eenheid per dag, een naam weghalen haalt de toewijzing weg. Alleen-lezen bij een mijlpaal of samenvattingstaak.
- **Toewijzingseenheden per dag** — de eenheden per resource, als `Naam: 1; Naam: 0.5`. Bewerkbaar bij een taak met toewijzingen.
- **Toewijzingscurve** — de curve per resource, als `Naam: Uniform`. Bewerkbaar bij een taak met toewijzingen.
- **Start werkvenster** en **Einde werkvenster** — het werkvenster per resource, uit een geïmporteerd bestand, als `Naam: datum`. Alleen-lezen.
- **Begroot werk (uren)** en **Verricht werk (uren)** — het begrote en verrichte werk per resource in uren, als `Naam: 12`, uit een geïmporteerd bestand. Alleen-lezen.
- **Resterend werk (uren)** — het resterende werk per resource in uren, als `Naam: 6`: het opgeslagen werk, anders restduur × inzet. Bewerkbaar bij een taak met toewijzingen waarop een werkregel werkt. Alleen zichtbaar in de kiezer als de werkregels zichtbaar zijn.

## Voortgang

- **Status** — *Niet gestart*, *Bezig* of *Voltooid*. Bewerkbaar, behalve bij een samenvattingstaak.
- **Voortgang** — het percentage, als `40%`. Bewerkbaar met een getal van 0 tot 100, behalve bij een samenvattingstaak.
- **Werkelijke start** — de datum waarop de taak begon. Bewerkbaar, behalve bij een samenvattingstaak.
- **Werkelijke einde** — de datum waarop de taak klaar was. Bewerkbaar, behalve bij een samenvattingstaak.
- **Werkelijke duur** — de werkelijke duur, als getal. Bewerkbaar, behalve bij een samenvattingstaak.
- **Resterend** — de restduur, in de eenheid van de taak. Bewerkbaar, behalve bij een samenvattingstaak.
- **Hervattingsdatum** en **Stopdatum** — de hervatting en de stop van een lopende taak uit een MS Project- of Primavera-bestand. Alleen-lezen.

De voortgangskolommen volgen de voortgangsregels van de app: een werkelijke datum na de statusdatum wordt geweigerd. Op een samenvattingstaak zegt de app *De voortgang van een samenvattende taak wordt afgeleid uit de onderliggende taken en kan hier niet worden gewijzigd.*

## Berekend

Alle kolommen in deze categorie zijn alleen-lezen.

- **Nivelleervertraging** — hoeveel werkdagen nivelleren de taak vertraagde; een streepje als er geen nivellering is toegepast.
- **Vroegste start** en **Vroegste einde** — de vroegste datums uit de berekening.
- **Laatste start** en **Laatste einde** — de laatste datums waarop de taak nog mag beginnen of eindigen zonder het project te vertragen.
- **Vrije speling** — de werkdagen die de taak kan schuiven zonder een opvolger te vertragen.
- **Totale speling** — de werkdagen die de taak kan schuiven zonder het projecteinde te vertragen. Negatief als een constraint of deadline niet haalbaar is.
- **Kritiek** — *Ja* als de taak op het kritieke pad ligt.
- **Interfererende speling** — totale speling min vrije speling.
- **Bijna kritiek** — *Ja* voor een bijna-kritieke taak. Alleen gevuld als *Bijna-kritiek markeren* aan staat (*Projectinfo*, blok *Rekenprofiel en reken-opties*); anders een streepje.
- **Spelingpad** — het nummer van het spelingpad, 1 voor het meest kritieke. Alleen gevuld als *Meerdere speling-paden* aan staat; anders een streepje.
- **Herkomst (opgeslagen datums)** — bij een bestand met vastgelegde datums: *Wijkt af* of *Deels niet vastgelegd*. Alleen zichtbaar in de kiezer bij zo'n bestand. Bij een niet vastgelegde as staat *Niet vastgelegd* in de late-datum- en spelingkolommen.

Zie [Kritiek pad en speling](docs://uitleg-kritiek-pad).

## Baseline

Per baseline van het project komen er kolommen bij, met de naam van de baseline voor de kolomnaam (`<baseline> — Geplande start`). Ze zijn alleen-lezen. Een taak die niet in de baseline staat, toont een streepje met de tooltip *Niet aanwezig in deze baseline*.

- **Geplande start**, **Gepland einde** en **Duur** — de start, het einde en de duur zoals de baseline ze vastlegde.
- **Startafwijking** en **Eindafwijking** — het aantal werkdagen tussen de baseline en de getoonde start of het getoonde einde, in de kalender van het project; positief als de taak later staat.
- **Duurafwijking** — de huidige duur min de duur in de baseline, in werkdagen.

## Aangepast

- **Activity code** — een kolom per activity code, met de naam van de code. Toont de code van de gekozen waarde. Bewerkbaar met een keuzelijst; een onbekende waarde wordt geweigerd.
- **Eigen veld** — een kolom per eigen veld, met zijn naam. De invoer past bij het type: tekst, getal, geheel getal, kosten, datum of ja/nee. Bewerkbaar.

Deze kolommen horen bij het project waar de code of het veld in staat. Zie [Codes en eigen velden](docs://howto-codes-en-velden).

## Technisch

Alle kolommen in deze categorie zijn alleen-lezen. Ze tonen gegevens die de app bewaart maar niet in een gewone kolom laat zien, bijvoorbeeld voor controle van een import.

- **Taak-id** — de interne id van de taak.
- **Bovenliggende taak-id** en **Onderliggende taak-id’s** — de id's van de bovenliggende en onderliggende taken.
- **Resource-id’s** — de id's van de resources op de taak.
- **Toewijzings-id**, **Taak-id van toewijzing** en **Resource-id van toewijzing** — de id's van de toewijzingen, taken en resources van deze taak.
- **Duur (minuten)** en **Resterend (minuten)** — de duur en restduur in minuten; alleen gevuld bij een taak in uren.
- **Nivelleervertraging (minuten)** en **Nivelleervertraging in verstreken tijd** — de nivelleervertraging uit MS Project in minuten, en of die in kloktijd telt.
- **Handmatig gepland** — of de taak handmatig gepland is.
- **MS Project-taaktype (import)** en **Inspanningsgestuurd** — het taaktype en de effort-driven-vlag zoals MS Project ze had.
- **Primavera P6-herkomst** — de bronvelden uit een Primavera-bestand, als `sleutel: waarde`.
- **Expliciete verzameltaak** — of de taak een expliciete samenvatting zonder subtaken is (uit een Primavera-bestand).
- **Ondergrens tijdgefaseerd einde**, **Anker tijdgefaseerde start**, **Tijdgefaseerde duursegmenten** en **Tijdgefaseerde contouren** — de urenverdeling uit een MS Project-bestand, als datums en aantallen.
- **Activiteitscodedata**, **Gebruikersvelddata** en **Aantekeningendata** — het aantal codetoewijzingen, eigen velden en aantekeningen.
- **Interne-relatiedata** en **Externe-relatiedata** — het aantal interne en externe relaties.
- Van elke baseline staan hier ook **Mijlpaal** en **Soort mijlpaal** zoals de baseline ze vastlegde.

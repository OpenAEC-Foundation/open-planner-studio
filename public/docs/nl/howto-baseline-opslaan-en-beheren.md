# Een baseline opslaan en beheren

Doel: de planning vastleggen als afspraak (een baseline), zodat je later kunt zien hoeveel de uitvoering afwijkt, en meerdere baselines bewaren, hernoemen, kiezen en verwijderen.

## Wanneer je dit nodig hebt

Je legt een baseline vast als de planning is goedgekeurd en het werk nog moet beginnen. Wordt de planning later formeel herzien, bijvoorbeeld na een meerwerkopdracht, dan sla je een tweede baseline op en houd je de eerste erbij. Zo meet je de uitvoering aan de eerste afspraak en aan de herziene. Wat een baseline precies vastlegt en hoe de app de afwijking rekent, lees je in [Voortgang, statusdatum en baseline](docs://uitleg-voortgang).

## Stappen

### Een baseline opslaan

1. Druk op **Bereken** (F5), bijvoorbeeld via *Planning › Planning › Bereken*. De baseline legt de datums vast die op dat moment berekend zijn.
2. Kies *Planning › Baselines & voortgang › Baselines beheren…*. Het venster *Baselines* opent.
3. Onder *Nieuwe baseline opslaan* staat een voorstel voor de naam, zoals *Baseline 1 — (datum van vandaag)*. Typ een eigen naam die je later herkent, bijvoorbeeld *Basisplanning*.
4. Klik op *Opslaan*. De baseline staat nu in de lijst en is meteen de actieve baseline.
5. Klik op *Sluiten*.

Onder elke taakbalk in de Gantt staat nu een dunne balk met de baseline-datums; een mijlpaal krijgt een klein ruitje. Die overlay gaat aan of uit met *Beeld › Baselines & voortgang › Baseline-overlay*.

### De actieve baseline kiezen

Open *Baselines beheren…* en kies in de kolom *Actief* de baseline waar je mee wilt vergelijken. Zolang er baselines zijn, is er precies één actief. De Gantt-overlay, het rapporttype *Variance* en het *Voortgangsrapport* gebruiken die.

### Een baseline hernoemen

Pas in de lijst de naam aan. De wijziging geldt meteen; je hoeft niet op *Opslaan* te klikken.

### Een baseline verwijderen

Klik in de lijst op het prullenbakje bij de baseline. Verwijder je de actieve baseline, dan vraagt de app *De actieve baseline verwijderen?*. Daarna wordt de nieuwste baseline die overblijft de actieve. Is er geen andere, dan is er geen actieve baseline meer en verdwijnt de overlay. Met Ctrl+Z haal je een verwijderde baseline terug.

### Afwijkingen in de takentabel

Elke baseline heeft zes kolommen in de takentabel. Klik op de **+** rechts in de kop van de takenlijst (*Kolom toevoegen*) en open de categorie *Baseline*. Per baseline staan er *Geplande start*, *Gepland einde*, *Duur*, *Startafwijking*, *Eindafwijking* en *Duurafwijking*, met de naam van de baseline ervoor, bijvoorbeeld *Basisplanning — Eindafwijking*. De afwijkingen staan in werkdagen: een plus is later, een min is eerder. Een taak die niet in de baseline zit, toont een streepje (—) in die kolommen.

## Valkuilen en wat de app dan doet

**Een verouderde planning.** Is de planning verouderd, dan staat in het venster *Planning is verouderd — herbereken eerst (F5)*. Dat is een waarschuwing; opslaan blijft mogelijk. Je slaat dan wel de oude datums op. Sluit het venster, druk op **Bereken** en sla dan pas op.

**Een baseline met voortgang erin.** Sla je een baseline op nadat je voortgang hebt ingevuld, dan legt hij de stand met die werkelijke datums vast. De afwijking is dan nul en zegt niets meer over de uitvoering. Leg de baseline vast voordat het werk begint.

**Een baseline bijwerken kan niet.** Wil je de afspraak herzien, sla dan een nieuwe baseline op en verwijder zo nodig de oude.

**Alleen taken zonder onderliggende taken.** Een fase staat niet in de baseline: ze heeft geen baseline-balk en geen afwijking. De fase volgt uit de taken eronder.

**Nieuwe en verwijderde taken.** Een taak die je na het opslaan toevoegt, heeft geen baseline-balk. In het Variance-rapport staat hij als *Nieuw*. Een taak die je verwijdert, staat er als *Vervallen*.

**Project verplaatsen.** In het venster *Project verplaatsen…* staat, zodra er baselines zijn, het vinkje *Baselines mee verschuiven*. Het staat standaard uit: de baselines blijven staan, zodat de verschuiving als afwijking zichtbaar blijft. Zie [Project verplaatsen](docs://howto-project-verplaatsen).

**Bewaard in het projectbestand.** Baselines en de actieve keuze worden met het project opgeslagen en komen terug als je het bestand opent.

## Zie ook

- [Voortgang, statusdatum en baseline](docs://uitleg-voortgang): wat een baseline vastlegt en hoe de afwijking wordt berekend.
- [Project verplaatsen](docs://howto-project-verplaatsen): het vakje *Baselines mee verschuiven*.
- [Voortgang bijwerken](docs://howto-voortgang-bijwerken): de werkelijke stand invullen die je met de baseline vergelijkt.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): één baseline (*Baseline at start*) vóór de start, met voortgang en een statusdatum op 20 mei 2027.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): twee baselines, *Contract* en *Re-baseline (variation order)*, met voortgang en een statusdatum op 5 juli 2027.

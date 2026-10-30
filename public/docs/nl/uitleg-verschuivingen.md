# Waarom een taak verschuift

Je past de duur van het metselwerk aan en drukt op F5. De planning rekent meteen door, en rechtsonder staat: *4 taken verschoven*, met daaronder *Oplevering 3 werkdagen later*. In dit artikel lees je wat die melding telt, hoe de lijst *Verschuivingen* de reden per taak vaststelt, en wat *Ongedaan maken* terugzet.

## Het begrip

Een taak is **verschoven** als ze na de berekening een ander einde heeft dan ervoor. De app telt alleen gewone taken en mijlpalen. Een samenvattingstaak telt niet mee, want haar datums volgen uit de taken eronder.

De **reden** zegt wat het einde nu bepaalt. Die reden komt uit de berekening zelf: de app onthoudt per taak wat haar datums vastlegde. Is de reden niet zeker, dan staat er *Reden niet vastgesteld*. Een gok tonen we niet als feit.

## Hoe de app rekent

F5 en de knop *Bereken* rekenen meteen door. Daarna zie je de melding, met de knoppen *Waarom?* en *Ongedaan maken*. Verschoof er niets, dan komt er geen melding. Met *Automatisch berekenen* aan komt er ook geen melding, want dan rekent de app na elke bewerking.

*Waarom?* opent het paneel *Verschuivingen* in de rechterkolom. Het paneel staat ook onder *Beeld* → *Panelen*, zodat je de lijst nog kunt lezen als de melding weg is. Een klik op een regel toont de taak in de Gantt.

De lijst kent deze redenen:

- *Voorganger*: een relatie bepaalt de start. Je ziet de naam van de voorganger. Bepalen er meer voorgangers tegelijk de start, dan staat het aantal erbij.
- *Kalender*: de start bleef gelijk of schoof door de kalender, en de kalender van de taak is sinds de vorige berekening veranderd.
- *Vaste datum*: een constraint bepaalt de datum (zie [Constraints en deadlines](docs://uitleg-constraints)).
- *Statusdatum*: de taak kan niet eerder lopen dan de statusdatum.
- *Resource*: een nivelleringsvertraging bepaalt de start, of de duur veranderde door een andere toewijzing.
- *Eigen duur gewijzigd*: de start bleef gelijk en de duur veranderde.
- *Eigen startdatum* en *Projectstart*: de taak heeft geen bepalende voorganger.
- *Voortgang*: werkelijke datums of de restduur bepalen het einde.

Bij *Kalender* en *Eigen duur gewijzigd* vergelijkt de app met de stand bij de vorige berekening. Die stand komt uit de lijst met bewerkingen. Is daar niets te vinden, bijvoorbeeld na het openen van een bestand, dan is de reden niet vast te stellen.

## Voorbeeld

Taak A duurt 5 werkdagen en taak B volgt met een eind-start-relatie. B eindigt op vrijdag 19 juni. Je maakt A 3 werkdagen langer en drukt op F5. De melding telt B als verschoven. In de lijst staat bij B: *Einde 19-06-2026 → 24-06-2026* en *Voorganger: A*.

## Gevolgen en misverstanden

- *Ongedaan maken* in de melding zet de datums van vóór de berekening terug, in één stap. Je bewerking blijft staan, en de planning geldt weer als verouderd. De knop verdwijnt zodra je iets anders aan de planning wijzigt.
- Ctrl+Z na F5 werkt anders: dat neemt je laatste bewerking terug, samen met de berekening erna.
- De lijst is een momentopname van de laatste berekening. Latere bewerkingen veranderen hem niet.
- Bij nivelleren zie je het voorbeeld vooraf. Daarvoor is deze melding niet nodig (zie [Hoe nivelleren werkt](docs://uitleg-nivelleren)).
- De reden noemt wat de datum nu bepaalt. Dat is niet altijd de eerste aanleiding: in een keten noemt elke taak haar eigen voorganger. Klik door de lijst om de keten te volgen.

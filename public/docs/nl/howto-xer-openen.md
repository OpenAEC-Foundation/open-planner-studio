# Een Primavera P6-bestand (.xer) openen

Doel: een planning uit Primavera P6 rechtstreeks in de app openen, zonder hem eerst te exporteren naar XML.

## Wanneer je dit nodig hebt

Een opdrachtgever of hoofdaannemer werkt in Primavera en levert zijn planning als `.xer`-bestand. Je wilt hem bekijken, doorrekenen of aanvullen. De app leest `.xer`-bestanden alleen: ze schrijft geen `.xer` en verandert je bestand nooit. Uit het bestand haalt ze de WBS-structuur en de activiteiten met duur, datums, constraints en voortgang, de relaties met lag, de kalenders en de resources met toewijzingen, plus activiteitcodes, eigen velden (UDF's), aantekeningen en de planningsinstellingen van P6. Een activiteit van het type *Level of Effort* wordt een hammock.

## Stappen

1. Kies *Start › Bestand › Openen* of druk op Ctrl+O. Kies het `.xer`-bestand.
2. De app opent één tabblad per project met taken. Het project met de meeste taken is het actieve tabblad. Een tabblad heet *Projectnaam (Project-ID)* als het P6-project-ID afwijkt van de naam. In *Projectinstellingen* staat alleen de naam. Hernoem je het project, dan blijft het project-ID erachter staan. Daarna legt een venster kort uit wat de app uit het bestand overnam en hoe opslaan werkt; zie [Een bestand openen en opslaan](docs://howto-bestand-openen-en-opslaan).
3. Lees de melding onderaan. Bij een bestand met drie projecten kan die er zo uitzien: *XER-bestand geopend: 3 projectdocumenten.* Daaronder staan regels die uitleggen wat de app deed. Zie het kopje hieronder.
4. Kijk of er een strook onder het lint staat: *Je ziet de planning zoals Primavera hem opsloeg; bij herberekenen wijkt 1 taak af.* Primavera legt zijn eigen berekende datums in het bestand vast. Wijkt de berekening van de app daarvan af, dan toont de app die datums van Primavera zolang je niets wijzigt. Een taak die gestart of klaar is, staat altijd op zijn werkelijke datums, net als in Primavera. Wat dat betekent en hoe je terugschakelt naar de eigen berekening, staat in [Datums zoals opgeslagen](docs://uitleg-datums-zoals-opgeslagen). Ook de melding *Dit bestand bevat urenplanning.* kan verschijnen, met de knop *Urenplanning aanzetten*. Zie [Urenplanning aanzetten](docs://howto-urenplanning-aanzetten).
5. Sla je project op met Ctrl+S. Omdat een `.xer` nooit wordt overschreven, vraagt de app waar het nieuwe IFC-bestand moet komen. Ze stelt *Projectnaam (Project-ID)* voor als bestandsnaam.

### De regels onder de melding

De eerste regel van de melding noemt het aantal geopende tabbladen. Daaronder staan alleen de regels die van toepassing zijn. Deze verdienen je aandacht:

- *Dit project rekent als Primavera P6. Aanpassen via Bestand → Projectinstellingen → Rekenprofiel en reken-opties.* De app rekent dit project met de rekenregels van Primavera. Met *Rekenprofiel openen* ga je naar de instelling.
- *1 baselineproject uitgesloten.* en *1 baseline gematerialiseerd.* Wijst een project in P6 een ander project aan als zijn baseline, dan opent dat andere project niet als eigen tabblad. Het wordt de actieve baseline van het project dat ernaar verwijst.
- *Beschermende baseline-terugval gebruikt.* Zou het aanwijzen van baselines ertoe leiden dat geen enkel project meer opent, verwijst een project naar zichzelf of verwijzen projecten in een kring naar elkaar, dan opent de app alle projecten gewoon en maakt ze geen baselines.
- *1 externe koppeling bewaard.* Een relatie tussen twee projecten. De app bewaart hem als brongegeven, maar maakt er geen relatie van in je planning.
- *12 taken tonen de datums zoals Primavera ze opsloeg (niet herberekend).* Het aantal taken waarvan je in de weergave *Datums zoals opgeslagen* de datums van Primavera ziet: alle taken waarvan het bestand datums vastlegde, niet alleen de afwijkende.

De overige regels zijn diagnose van het lezen zelf. Ze vragen niets van je:

- het aantal geziene projecten;
- een overgeslagen leeg project;
- een genegeerde losse baselineverwijzing;
- een andere tekencodering dan gewone UTF-8 (de melding noemt welke: bij Arabische, Cyrillische of Griekse tekst kiest de app de passende Windows-codetabel, anders Windows-1252);
- activiteiten zonder geplande start (die beginnen op de statusdatum of de projectstart uit het bestand);
- tellers voor bevindingen in de tabellen, de kalenders en de getallen, voor onbekende veldwaarden en voor P6-planningsinstellingen die de app door een veilige keuze verving.

*Lees meer* opent de Help over het openen van Primavera-bestanden.

## Valkuilen en wat de app dan doet

**Niet alles wordt een tabblad of een relatie.** Een project zonder activiteiten opent niet, een baselineproject opent niet als eigen tabblad en een relatie tussen twee projecten wordt geen relatie in je planning. De app meldt dat in de regels onder de melding.

**Elk tabblad is een eigen project.** Sla je er een op, dan bewaart het IFC-bestand het volledige oorspronkelijke `.xer` mee. Heropen je dat IFC-bestand later, dan kent de app de datums van Primavera nog. Is dat bronarchief beschadigd, of heeft een ander IFC-programma het bestand herschreven, dan meldt de app: *Het XER-bronarchief in dit bestand is onbruikbaar en weggelaten; het project zelf is volledig geopend.* De planning, het rekenprofiel en alle projectgegevens zijn compleet. Wat ontbreekt: de datums zoals Primavera ze opsloeg en de bronherkomst voor MCP-clients en extensies. Open het oorspronkelijke `.xer` opnieuw om het archief terug te krijgen.

**Het IFC-bestand wordt groter.** Omdat het IFC-bestand het hele oorspronkelijke `.xer` meedraagt, is het groter dan een IFC-bestand zonder archief. Bij een groot `.xer` merk je dat aan de bestandsgrootte en aan de tijd die opslaan kost. Opent een `.xer` meer projecten, dan draagt elk tabblad dat je opslaat het hele `.xer` mee, niet alleen zijn eigen project.

**Een export naar CSV, MS Project XML of P6 XML verliest gegevens.** De app waarschuwt: *Bij export naar CSV gaat XER-broninformatie verloren.* IFC verliest niets.

**Een vrije zaterdag of zondag die niet in het bestand staat.** De app kan zo'n weekenddag zelf vrij maken. De dag heet dan *Calendar exception (weekend reconstruction)* in de kalender. Het patroon staat in [Import- en exportformaten](docs://ref-import-exportformaten).

**Speling tot het projecteinde, zonder einddatum.** Mist het bestand een einddatum, dan zet de app de optie *Speling rekenen tot de einddatum van het project* uit. Dat staat in de regel *N P6-planningsinstellingen met veilige terugval.* Details staan in [Import- en exportformaten](docs://ref-import-exportformaten).

**Voltooide activiteiten op de statusdatum.** Een voltooide activiteit kan in de weergave *Datums zoals opgeslagen* als smalle balk op de statusdatum staan. Dat is geen fout van je bestand. De uitleg en de bijbehorende conventie staan in [Import- en exportformaten](docs://ref-import-exportformaten).

**Getallen met een komma als decimaalteken.** Kan de app het decimaalteken niet betrouwbaar vaststellen, dan opent ze het bestand niet. Zo opent er nooit een planning met verkeerd gelezen getallen. Vraag de afzender dan een nieuwe export.

**Een bestand dat de app niet kan lezen.** Je krijgt een foutmelding, met de reden erbij. Enkele voorbeelden:

- *Dit bestand is geen geldig of ondersteund XER-bestand.*
- *Een XER-tabel mist verplichte kolommen.*
- *Het P6-project in dit XER-bestand bevat geen activiteiten.*
- *De decimaalnotatie van dit XER-bestand is niet betrouwbaar vast te stellen.*

Er opent dan niets. Controleer het bestand in P6, of vraag de afzender een nieuwe export.

## Zie ook

- [Bestanden en formaten](docs://uitleg-bestanden): waarom een `.xer` alleen gelezen wordt en wat een export verliest.
- [Datums zoals opgeslagen](docs://uitleg-datums-zoals-opgeslagen): de weergave van Primavera's eigen datums.
- [Een MS Project-bestand (.mpp) openen](docs://howto-mpp-openen): hetzelfde voor MS Project.
- [Urenplanning aanzetten](docs://howto-urenplanning-aanzetten): als het bestand gegevens in uren bevat.
- [Import- en exportformaten](docs://ref-import-exportformaten): per formaat wat meegaat en wat niet.
- [Rekenprofielen en conventies](docs://uitleg-rekenprofielen): waarom een P6-bestand met een eigen rekenprofiel opent.

# Een Primavera P6-bestand (.xer) openen

Doel: een planning uit Primavera P6 rechtstreeks in de app openen, zonder hem eerst te exporteren naar XML.

## Wanneer je dit nodig hebt

Een opdrachtgever of hoofdaannemer werkt in Primavera en levert zijn planning als `.xer`-bestand. Je wilt hem bekijken, doorrekenen of aanvullen. De app leest `.xer`-bestanden alleen: ze schrijft geen `.xer` en verandert je bestand nooit.

## Stappen

1. Kies *Start › Bestand › Openen* of druk op Ctrl+O. Kies het `.xer`-bestand.
2. De app opent één tabblad per project met taken. Het project met de meeste taken is het actieve tabblad. Een tabblad heet *Projectnaam (Project-ID)* als het P6-project-ID afwijkt van de naam.
3. Lees de melding onderaan. Bij een bestand met drie projecten kan die er zo uitzien: *XER-bestand geopend: 3 projectdocumenten.* Daaronder staan regels die uitleggen wat de app deed. Zie het kopje hieronder.
4. Kijk of er een strook onder het lint staat: *Je ziet de planning zoals Primavera hem opsloeg; bij herberekenen wijkt 1 taak af.* Primavera legt zijn eigen berekende datums in het bestand vast. Wijkt de berekening van de app daarvan af, dan toont de app die datums van Primavera zolang je niets wijzigt. Wat dat betekent en hoe je terugschakelt naar de eigen berekening, staat in [Datums zoals opgeslagen](docs://uitleg-datums-zoals-opgeslagen). Ook de melding *Dit bestand bevat urenplanning.* kan verschijnen, met de knop *Urenplanning aanzetten*. Zie [Urenplanning aanzetten](docs://howto-urenplanning-aanzetten).
5. Sla je project op met Ctrl+S. Omdat een `.xer` nooit wordt overschreven, vraagt de app waar het nieuwe IFC-bestand moet komen. Ze stelt *Projectnaam (Project-ID)* voor als bestandsnaam.

## Wat de meldingen zeggen

De eerste regel van de melding noemt het aantal geopende tabbladen. Daaronder staan alleen de regels die van toepassing zijn:

- *Dit project rekent als Primavera P6. Aanpassen via Bestand → Projectinfo → Rekenprofiel en reken-opties.* De app rekent dit project met de rekenregels van Primavera. Met *Rekenprofiel openen* ga je naar de instelling.
- *5 projecten gezien.* Het aantal projecten in het bestand.
- *1 leeg project overgeslagen.* Een project zonder activiteiten opent niet.
- *1 baselineproject uitgesloten.* en *1 baseline gematerialiseerd.* Wijst een project in P6 een ander project aan als zijn baseline, dan opent dat andere project niet als eigen tabblad. Het wordt de actieve baseline van het project dat ernaar verwijst.
- *1 losse baselineverwijzing genegeerd.* Een project verwijst naar een baselineproject dat niet in het bestand zit.
- *Beschermende baseline-terugval gebruikt.* Zou het aanwijzen van baselines ertoe leiden dat geen enkel project meer opent, verwijst een project naar zichzelf of verwijzen projecten in een kring naar elkaar, dan opent de app alle projecten gewoon en maakt ze geen baselines.
- *1 externe koppeling bewaard.* Een relatie tussen twee projecten. De app bewaart hem als brongegeven, maar maakt er geen relatie van in je planning.
- Een regel over de tekencodering, als de app een andere codering dan gewone UTF-8 vaststelde.
- Regels als *1 parserbevinding.*, *1 kalenderbevinding.* en *1 getalnotatieprobleem.*: opmerkingen die de app maakte bij het lezen van de tabellen, de kalenders en de getallen in het bestand.
- *1 enum-terugval.* Een P6-veld had een waarde die de app niet kent; ze koos een standaardwaarde.
- *1 P6-planningsinstelling met veilige terugval.* Een instelling van P6 die de app niet kent, is vervangen door een veilige keuze.
- *1 taak toont de datums zoals Primavera ze opsloeg (niet herberekend).* Het aantal taken dat je in de weergave *Datums zoals opgeslagen* ziet.
- *Lees meer* opent deze uitleg.

## Wat de app inleest

De app haalt uit een `.xer`-bestand de WBS-structuur en de activiteiten met duur, datums, constraints en voortgang, de relaties met lag, de kalenders en de resources met hun toewijzingen. Ook activiteitcodes, eigen velden (UDF's), aantekeningen en de planningsinstellingen van P6 gaan mee. Een activiteit van het type *Level of Effort* wordt een hammock.

## Valkuilen en wat de app dan doet

**Elk tabblad is een eigen project.** Sla je er een op, dan bewaart het IFC-bestand het volledige oorspronkelijke `.xer` mee. Heropen je dat IFC-bestand later, dan kent de app de datums van Primavera nog. Is dat bronarchief beschadigd, of heeft een ander IFC-programma het bestand herschreven, dan meldt de app: *Het XER-bronarchief in dit bestand is onbruikbaar en weggelaten; het project zelf is volledig geopend.* De planning, het rekenprofiel en alle projectgegevens zijn compleet. Wat ontbreekt: de datums zoals Primavera ze opsloeg en de bronherkomst voor AI en extensies. Open het oorspronkelijke `.xer` opnieuw om het archief terug te krijgen.

**Een export naar CSV, MS Project XML of P6 XML verliest gegevens.** De app waarschuwt: *Bij export naar CSV gaat XER-broninformatie verloren.* IFC verliest niets.

**Een bestand dat de app niet kan lezen.** Je krijgt een foutmelding, met de reden erbij. Enkele voorbeelden:

- *Dit bestand is geen geldig of ondersteund XER-bestand.*
- *Een XER-tabel mist verplichte kolommen.*
- *Het P6-project in dit XER-bestand bevat geen activiteiten.*
- *Het XER-bestand bevat een dubbele tabel.*
- *De decimaalnotatie van dit XER-bestand is niet betrouwbaar vast te stellen.*
- *Het XER-bestand bevat een dubbele WBS-, activiteit- of relatie-id.*

Er opent dan niets. Controleer het bestand in P6, of vraag de afzender een nieuwe export.

## Zie ook

- [Bestanden en formaten](docs://uitleg-bestanden): waarom een `.xer` alleen gelezen wordt en wat een export verliest.
- [Datums zoals opgeslagen](docs://uitleg-datums-zoals-opgeslagen): de weergave van Primavera's eigen datums.
- [Een MS Project-bestand (.mpp) openen](docs://howto-mpp-openen): hetzelfde voor MS Project.
- [Urenplanning aanzetten](docs://howto-urenplanning-aanzetten): als het bestand gegevens in uren bevat.

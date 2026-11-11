# Gemaakte invoer en combinatieverwachtingen in strikt

Na de nieuwe getalleneis en de echte gedeelde duuractie waren negen oude verwachtingen rood. De productcode is
hiervoor niet gewijzigd. Het eerste log staat in strikt-oude-verwachtingen.log.

Vier gemaakte proeven op de gezette showcase met wand laten de minuten en het afgeleide dagengetal uiteenlopen:
alleen durationMinutes wordt 720 en de naam wordt Hernoemd; scheduleDuration blijft 3.5. De app zet bij echte invoer
beide duurvelden. De volgende gemaakte bronvormen weigeren nu ieder getypeerd:

| Bronvorm in IfcTaskTime #55 | Melding |
|---|---|
| P2DT12H | ongewijzigd-getal: taak task-mvzf5vqrnrs0365 (Hernoemd).time.scheduleDuration: 3.5 → 1.5 |
| P2\X2\0044\X0\T12H | dezelfde taak, hetzelfde veld, 3.5 → 1.5 |
| P2\X\44T12H | dezelfde taak, hetzelfde veld, 3.5 → 1.5 |
| P2\X4\00000044\X0\T12H | dezelfde taak, hetzelfde veld, 3.5 → 1.5 |

De vier verwachtingen eisen nu deze exacte veilige weigering. De ongewijzigde bronnen en hernoemproeven blijven
schrijven en hun precieze duurvorm behouden. Geen proef is teruggezet naar kale invoer om de nieuwe eis te ontwijken;
de bestaande kale proeven blijven juist als gemaakte, niet-realistische invoer herkenbaar.

De oude algemene combinatieverwachting "schrijft alleen als elk deel los schrijft" geldt niet zonder meer als de echte
duuractie haar werkregels toepast. De volgende vijf combinaties schrijven, terwijl één los kaal deel weigert:

| Basis | Combinatie |
|---|---|
| council/fix3-twee-data.ifc | een dag langer + kalenderkeuze |
| eigen-plus-model.ifc | een dag langer + kalenderkeuze |
| showcase-appartementencomplex.ifc + wand | een dag langer + kalenderkeuze |
| council/r6sol-twee-werkplannen.ifc | een dag langer + kalenderkeuze |
| council/r6sol-twee-werkplannen.ifc | een dag langer + de bewerkte taak wissen |

Voor zulke schrijvende combinaties met een echte duuractie vergelijkt de check nu de volledige heropening van de
bytes met de planning van de naad. Andere combinaties behouden de oude onafhankelijkheidsverwachting. De writer,
verliesbewaking en getalleneis krijgen geen uitzondering. Dit zijn vijf schrijvende combinaties, geen nieuwe
weigeringen in de eindtelling. De telling bevat de afzonderlijke bewerkingen en wordt apart vergeleken met main.

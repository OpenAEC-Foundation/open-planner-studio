# Kalenders, werkdagen en werkuren

Open Planner Studio bewaart bij iedere gewone taak niet alleen een getal, maar ook de betekenis ervan: **Dagen** of **Uren**. Die keuze hoort bij de taak. De kalender bepaalt vervolgens waar die duur in de tijd past. Hij verandert nooit uit zichzelf de gekozen eenheid of het ingevoerde aantal.

Deze gids legt het volledige model uit. Hij is bedoeld voor planners die dagtaken en urentaken in één project willen gebruiken zonder verborgen omrekening.

## Het mentale model

Een **dagtaak** telt gehele werkbare kalenderdagen. `2d` betekent twee beschikbare werkdagen. Een werkdag met tien werkuren telt nog steeds als één dag; een werkdag met acht uur ook. Weekenden, feestdagen en andere niet-werkdagen tellen niet mee.

Een **urentaak** telt exacte werkminuten binnen de effectieve werktijdblokken van de taakkalender. `12h` gebruikt dus werkelijk twaalf werkuren. Op een kalender van acht uur per dag is dat één volledige dag plus vier uur. Op een kalender van tien uur per dag is het één volledige dag plus twee uur.

Hieruit volgt de hoofdregel:

- De taak bewaart **wat** je hebt ingevoerd: dagen of uren, en hoeveel.
- De kalender bepaalt **wanneer** die dagen of uren kunnen worden uitgevoerd.
- Een kalenderwissel mag de eenheid en hoeveelheid niet veranderen. Alleen begin- en eindverdeling kunnen verschuiven.

## De projectkalender instellen

Open **Planning → Kalender**. Links staat de kalenderbibliotheek en een ster markeert de huidige projectkalender. Selecteer een kalender om de werkdagen, werktijden en feestdagen te bewerken. Met **Als projectdefault** maak je een andere kalender de projectkalender.

De kalender bevat:

- **Werkdagen** — de weekdagen waarop werk mogelijk is.
- **Werktijden** — concrete tijdblokken, bijvoorbeeld 08:00–12:00 en 12:30–16:30.
- **Feestdagen** — vrije datums of periodes met een omschrijving.

Een gat tussen twee werktijdblokken is een pauze. Een dag met bijvoorbeeld alleen 08:00–12:00 is een gedeeltelijke werkdag. Voor een dagtaak telt zo'n beschikbare dag als één werkdag. Voor een urentaak levert hij slechts vier werkuren.

Gebruik [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) om een project met vorstverlet en een afwijkende resourcekalender te bekijken. Het voorbeeld [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc) bevat werkzaamheden die baat hebben bij urenplanning.

### Feestdagen en eenmalige stremmingen

Via **Feestdagen genereren…** kun je feestdagen voor een land, regio en jaar laten toevoegen. Voor Nederland kun je ook adviesdatums voor de bouwvak genereren; controleer die altijd bij Bouwend Nederland.

Een vorstperiode of lokale sluiting voeg je handmatig toe met **Feestdag toevoegen**. Zo'n datum werkt voor beide soorten taken hetzelfde als blokkade:

- een dagtaak slaat de feestdag volledig over;
- een urentaak kan op die dag geen werkminuten verbruiken en gaat verder in het eerstvolgende werkblok.

Opnieuw genereren voegt ontbrekende jaren toe en laat handmatig ingevoerde stremmingen staan.

### Urenplanning inschakelen

Open **Instellingen → Tijdlijn / Zoomen** en zet **Urenplanning inschakelen** aan. Deze hoofdschakelaar maakt uurinvoer, uurprecieze planning en de uur-tijdschaal beschikbaar. Zet daaronder ook **Gemengde dag/uur-planning toestaan** aan als je de eenheid per taak wilt kunnen kiezen; zonder die tweede voorkeur blijft de compacte duurinvoer zichtbaar, maar niet de Dagen/Uren-keuze.

Staat urenplanning uit, dan krijgen nieuwe taken de eenheid **Dagen**. Bestaande of geïmporteerde urentaken worden niet geconverteerd en niet afgerond. Hun uurwaarde blijft bewaard. Voor je zo'n duur kunt bewerken, vraagt Open Planner Studio om urenplanning in te schakelen.

Kies in **Projectinformatie** ook **Standaardeenheid voor nieuwe taken: Dagen/Uren**. Dit is een projectinstelling en geldt voor alle handmatig aangemaakte nieuwe taken. De instelling verandert bestaande taken niet. Als urenplanning uit staat, beginnen nieuwe taken altijd veilig in dagen.

## Werktijdblokken en ploegen

Iedere geldige kalender ondersteunt dag- én urentaken. Heeft een kalender nog geen handmatige blokken per weekdag, dan leidt Open Planner Studio ze af uit het eenvoudige patroon. Stel **Begin**, **Einde** en **Pauze begint** in als 24-uurs HH:MM (standaard 07:00, 16:00 en 12:00); elk heeft pijltjes voor kwartierstappen. Geef vervolgens de **Pauzeduur** in minuten op: die heeft dezelfde niet-native kwartierstappen en Pijl omhoog/omlaag, maar blijft een minutenwaarde van 0 tot 1440. Zo wordt 07:00–16:00 met een pauze vanaf 12:00 van 60 minuten automatisch 07:00–12:00 en 13:00–16:00. 09:00–17:00 met 30 minuten pauze vanaf 12:00 wordt 09:00–12:00 en 12:30–17:00. Een duur van 0 betekent één doorlopende band; 08:00–16:00 zonder pauze blijft dus 08:00–16:00. **Netto-uren per dag** volgen dit patroon en zijn altijd een niet-bewerkbare waarde met twee decimalen en `h`.

Begin moet vóór Einde liggen; de pauze moet volledig binnen die werkdag vallen en mag de dag niet volledig opslokken. De dialoog blokkeert toepassen en legt ongeldige of onvolledige tijd uit, zonder de kalender te wijzigen. Oude kalenders zonder deze twee pauzevelden houden hun bestaande gedrag: het verschil tussen de klokspanne en de historisch opgeslagen uren wordt eerst als middaggat geïnterpreteerd en pas expliciet zodra je een scalaire tijd wijzigt. De per-weekdag-editor en ploegpresets, zoals **Dagdienst**, **2 ploegen**, **3 ploegen**, **Nachtploeg** en **24/7**, hebben altijd voorrang: zodra je daarin bands instelt, zijn die de bron van waarheid. Een nachtblok kan over middernacht lopen.

De afgeleide waarde **Netto-uren per dag** helpt bij presentatie, maar bepaalt niet de eenheid van een taak. Dagtaken blijven werkdagen tellen; een urentaak gebruikt uitsluitend de effectieve bands. Alleen een lege of ongeldige kalender kan uren niet plannen. Er is geen stille taak-, eenheid- of kalenderconversie en geen afronding.

## Duur per taak invoeren

De dubbelklikdialoog en het vaste eigenschappenpaneel gebruiken dezelfde bediening:

**Duur [waarde] [Dagen | Uren]**

Je kunt de selector gebruiken of een suffix typen:

- `2d` kiest **Dagen** en bewaart twee werkdagen.
- `12h` kiest **Uren** en bewaart exact 720 werkminuten.
- `12u` blijft geldig als Nederlandse invoeralias en wordt daarna universeel als `12h` getoond.
- Zonder suffix volgt een geheel getal de eenheid die in de selector staat.

Een expliciet suffix wint dus altijd van de selector en synchroniseert die selector. Normale handmatige invoer gebruikt gehele dagen of gehele uren. Minuutprecisie die al uit een import of bestand komt, blijft echter exact bewaard en wordt nooit stil afgerond.

Bij import bewaart Open Planner Studio een expliciete taakeenheid wanneer het bronformaat die kan leveren. IFC onderscheidt dag- en uurduur in zijn ISO-duur. Door Open Planner Studio geëxporteerde MSPDI- en P6 XML-bestanden dragen de expliciete keuze per taak mee; externe of oudere bestanden zonder die markering behouden de compatibele kalenderprecisieregel. CSV-duur wordt als dagen gelezen. Een toevallig geheel aantal daguren verandert een expliciete keuze nooit.

Een echte nulduur-mijlpaal heeft geen bewerkbare eenheid. Ook samenvattingstaken en hammocktaken tonen een afgeleide duur; daar voeg je geen tweede handmatige duurbron aan toe.

Het informatie-icoon naast de selector vat het contract samen. Het is bereikbaar met de muis én met het toetsenbord.

## Plannings- en omzetvoorbeelden

**Voorbeelden met 8 en 10 uur**

Neem een taak die op maandag begint:

- `2d` op een 8-uurskalender gebruikt maandag en dinsdag: feitelijk 16 uur.
- Dezelfde `2d` op een 10-uurskalender gebruikt nog steeds maandag en dinsdag: feitelijk 20 uur.
- `12h` op een 8-uurskalender gebruikt maandag volledig en dinsdag nog vier uur.
- Dezelfde `12h` op een 10-uurskalender gebruikt maandag volledig en dinsdag nog twee uur.

Een pauze verbruikt voor een urentaak geen duur. Bij blokken 08:00–12:00 en 13:00–17:00 eindigt een taak van zes uur om 15:00, niet om 14:00. Een dagtaak telt die dag ondanks de pauze als één beschikbare werkdag.

**Een kalender wijzigen**

Als je een taak naar een andere kalender verplaatst, blijft `2d` precies `2d` en blijft `12h` precies `12h`. Open Planner Studio herberekent alleen waar die vaste hoeveelheid werk past. Daardoor kan de einddatum of eindtijd veranderen.

Dit is belangrijk bij een overgang van acht naar tien uur per dag. Een urentaak van twaalf uur wordt op de langere werkdagen eerder klaar. Een dagtaak van twee dagen blijft twee dagen en omvat op die kalender juist meer feitelijke uren. Geen van beide gevallen verandert de taakidentiteit.

**Relaties, lag en constraints in een gemengde planning**

Een relatie bepaalt eerst de grens waar de opvolger mag beginnen of eindigen. Daarna verbruikt de opvolger zijn eigen duur op zijn eigen kalender. Zo kan een dagtaak zonder omzetting voorganger zijn van een urentaak, en andersom. Een FS-relatie van een `2d`-taak naar een `6h`-taak laat de opvolger dus na de finishgrens zes concrete werkuren opnemen; de twee werkdagen van de voorganger worden niet in zes of zestien uur herschreven.

Werk-tijdlag en -lead worden kalenderbewust toegepast volgens het relatietype. Een datumconstraint, deadline of vastgelegde werkelijke datum begrenst de plaatsing, maar verandert evenmin de gekozen duur. Voer na een kalender-, relatie- of constraintwijziging **Berekenen** uit: planning wordt bewust handmatig herberekend en niet reactief. Controleer bij een onverwachte finish daarom achtereenvolgens de relatie, lag/lead, constraint en effectieve taakkalender; de getoonde `d` of `h` hoort onveranderd te blijven.

**Expliciet omzetten zonder stil afronden**

De selector mag hetzelfde getal niet herinterpreteren: `2d` wordt nooit zomaar `2h`. Wanneer je de eenheid wisselt, berekent Open Planner Studio vanaf de taakstart en op de huidige taakkalender een exact voorstel.

Is de omzetting exact in de toegestane hele eenheid, dan zie je het voorstel voordat je het toepast. Twee werkdagen van acht uur kunnen bijvoorbeeld worden voorgesteld als `16h`.

Is de omzetting niet exact, dan wordt niets afgerond. `12h` is op een 8-uurskalender anderhalve werkdag en kan dus niet als gehele dagtaak worden toegepast. De oude eenheid en waarde blijven staan totdat je zelf een nieuwe geldige waarde invoert, bijvoorbeeld `1d` of `2d`.

**Duurweergave lezen**

Onder **Instellingen → Duurweergave** kies je **Automatisch**, **Dagen** of **Uren**. Dit is alleen presentatie; de instelling wijzigt geen taakgegevens.

In **Automatisch** zie je altijd de gekozen taakeenheid: een dagtaak van twee dagen als `2d` en een urentaak van twaalf uur als `12h`. Ook zestien uur op een 8-uurskalender blijft dus `16h`; de kalender mag de expliciete keuze niet laten lijken op een dagtaak.

Bij een geforceerde andere weergave blijft de oorspronkelijke waarde tussen haakjes herkenbaar. Zo kun je vergelijken zonder dat Open Planner Studio de opgeslagen eenheid converteert.

## Resourcekalenders

Een resource kan een eigen kalender krijgen, bijvoorbeeld voor een onderaannemer met een vierdaagse werkweek. Die kalender beïnvloedt resourcebelasting en nivellering, maar vervangt niet automatisch de taakkalender en verandert nooit de taakeenheid. Bekijk dit in [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc).

## Problemen oplossen

**Uren kan niet worden gekozen**

Controleer eerst of **Urenplanning inschakelen** aan staat. Controleer daarna of de effectieve taakkalender geldige werkdagen, tijden en uren per dag heeft. Handmatige weekblokken zijn optioneel: zonder die blokken leidt de planner de effectieve werktijden automatisch af.

**Een kalenderwissel verandert de einddatum**

Dat is normaal als de nieuwe werkdagen, feestdagen of werktijdblokken anders zijn. Controleer de taakwaarde: `2d` of `12h` hoort onveranderd te zijn. Voer **Berekenen** uit om de nieuwe verdeling te zien.

**Omzetten naar dagen wordt geweigerd**

De uurwaarde past niet exact in een geheel aantal beschikbare werkdagen vanaf de taakstart. Open Planner Studio rondt niet. Behoud uren of voer bewust een nieuw geheel aantal dagen in.

**Een geïmporteerde urentaak is zichtbaar terwijl urenplanning uit staat**

Dat beschermt de brongegevens. De precieze minuten blijven opgeslagen en worden niet in dagen veranderd. Schakel urenplanning in voordat je de duur bewerkt.

**`2d(16h)` of `16h(2d)` lijkt dubbel**

Je hebt **Dagen** of **Uren** als vaste duurweergave gekozen. Het eerste deel volgt die presentatievoorkeur; de waarde tussen haakjes toont de blijvende taakeenheid. Kies **Automatisch** om alleen de native waarde te zien. De instelling verandert de taak zelf niet.

## Verder lezen

- Lees [Relaties & constraints](docs://gids-relaties-constraints) voor kalenderbewuste relaties en lag/lead.
- Bekijk de kalender en het vorstverlet opnieuw in [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc).
- Onderzoek de vierdaagse resourcekalender in [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc).
- Open [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc) voor uurwerk in een groot project.
- Vergelijk het stort- en vlechtwerk in [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc).

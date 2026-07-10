# Kalenders & uren-planning

Een taak van "5 dagen" betekent alleen iets in combinatie met een kalender: welke dagen zijn werkdagen, welke uren wordt er gewerkt, en welke dagen vallen sowieso af door een feestdag of een tijdelijke stremming? Deze gids behandelt de projectkalender, resource-kalenders, en de optionele uren-planning voor wie tot op het uur nauwkeurig wil plannen.

## Wat je hier leert

- De projectkalender instellen: werkdagen, werktijden, feestdagen.
- Feestdagen automatisch per jaar genereren, inclusief de bouwvak.
- Een tijdelijke, ad-hoc stremming toevoegen (bijvoorbeeld vorstverlet).
- Een resource een eigen kalender geven, bijvoorbeeld voor een 4-daagse werkweek.
- De hoofdschakelaar **Urenplanning** aanzetten en werktijd-banden/ploegen instellen.
- Hoe dag- en uurtaken naast elkaar in dezelfde planning bestaan.

Volg mee met [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) (vorstverlet, 4-daagse resourcekalender) en met [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc) (uren-planning voor stort- en vlechtwerk), beide ook te openen via **Bestand → Voorbeelden**.

## De projectkalender

Kalenders beheer je in het venster **Kalenders**, te openen via de lintgroep **Kalender** op het tabblad **Planning** (de knoppen **Kalender** en **Vrije dagen** openen hetzelfde venster). Dit venster toont links een bibliotheek van alle kalenders in het project — niet alleen de projectkalender, maar ook eventuele resource-kalenders (zie verderop) — met een sterretje bij de kalender die momenteel **Projectkalender** is. Selecteer een kalender links en bewerk hem rechts; met **Als projectdefault** maak je een andere kalender uit de lijst de nieuwe projectkalender. Voor de geselecteerde kalender stel je in:

- **Werkdagen** — welke van de zeven weekdagen (Ma t/m Zo) als werkdag tellen. Standaard maandag t/m vrijdag.
- **Werktijden** — **Begin (uur)**, **Einde (uur)** en de daaruit afgeleide **Uren per dag**.
- **Feestdagen** — een lijst met vrije dagen, elk met een **Omschrijving**, een datum **Van** en **Tot**.

Wijzigingen aan de projectkalender werken direct door in de berekening: taken die op een nu-vrije dag zouden vallen, schuiven door naar de eerstvolgende werkdag.

### Feestdagen automatisch genereren

In plaats van feestdagen één voor één in te typen, kun je ze automatisch laten genereren via **Feestdagen genereren…** in het kalendervenster. Kies een **Land** (Nederland, Duitsland, België, Frankrijk, Verenigd Koninkrijk, Oostenrijk, Zwitserland) en optioneel een **Regio**. Voor Nederland is er bovendien een specifieke bouwoptie: **Bouwvak**, met de keuze **Noord**, **Midden** of **Zuid** (of **Geen**). De gegenereerde bouwvak-datums zijn adviesdatums — de app waarschuwt hier zelf voor: controleer de exacte datums bij Bouwend Nederland voor het lopende jaar. Na het kiezen van land/regio toont het venster een voorbeeld — bijvoorbeeld "12 feestdagen, 1-1-2026–31-12-2026" — voordat je op **Genereren** klikt.

Genereer je feestdagen voor een project dat over de jaargrens loopt of later wordt verlengd, dan herkent Open Planner Studio dat de al gegenereerde feestdagen niet meer de volledige projectperiode dekken en biedt het venster **Opnieuw genereren** aan om de ontbrekende jaren toe te voegen — zonder de eerder handmatig toegevoegde feestdagen te verliezen.

### Ad-hoc stremmingen (bijvoorbeeld vorstverlet)

Niet elke onderbreking van het werk is een jaarlijks terugkerende feestdag. Voor eenmalige, projectspecifieke stremmingen — een week vorstverlet, een lokale evenementenstremming — voeg je gewoon handmatig een extra regel toe via **Feestdag toevoegen** in dezelfde lijst: geef een **Omschrijving** (bijvoorbeeld "Vorstverlet") en een periode **Van**/**Tot** op. Zo'n ad-hoc stremming werkt technisch identiek aan een gegenereerde feestdag — de CPM-berekening houdt er evengoed rekening mee — maar staat los van de automatische jaarlijkse generatie, dus een volgende **Opnieuw genereren** overschrijft hem niet.

Zie een vorstverlet-periode in de praktijk in de showcase [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): de gedeelde fundering van de zes woningen bevat een periode vorstverlet die als losse feestdag-achtige entry aan de kalender is toegevoegd, los van de automatisch gegenereerde Nederlandse feestdagen.

## Resource-kalenders

Naast de ene projectkalender kan elke resource een eigen kalender krijgen — bijvoorbeeld voor een onderaannemer die maar vier dagen per week beschikbaar is, terwijl de rest van het project vijf dagen draait. Resource-kalenders beheer je via het veld **Kalender** op de resource (met de knop **Bewerken…** ernaast) of de titel **Resourcekalender** van het bewerkvenster; standaard staat een resource op **Projectkalender**.

Een resource-kalender gebruikt hetzelfde formulier als de projectkalender (**Werkdagen**, **Werktijden**, **Feestdagen**), maar is puur informatief voor de resource: hij verandert niets aan de CPM-datums van de taak zelf. Wat hij wél beïnvloedt, is de **belasting** (histogram) en de **nivellering**: staat een resource op een 4-daagse week terwijl de taak waarop hij is toegewezen 5 werkdagen loopt, dan toont de resource-belasting een tekort op de vijfde dag, en waarschuwt het nivelleringsvenster (**Resources nivelleren**) dat de resource niet op alle dagen werkt die de taak nodig heeft — verschuiven binnen de speling lost dat kalendermismatch dan niet vanzelf op.

Bekijk een 4-daagse resourcekalender in de praktijk: de installateurs in [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) draaien op een eigen kalender met een verkorte werkweek, terwijl de rest van het project op de normale projectkalender doorloopt.

## Uren-planning: de hoofdschakelaar

Standaard werkt Open Planner Studio volledig **dag-granulair** — elke taak heeft een duur in hele (werk)dagen. Voor taken die je liever op het uur plant (denk aan een stortwerk dat om 7:00 begint en om 14:00 klaar moet zijn, ruim vóór het weer omslaat), is er de optionele **Urenplanning**.

Zet de hoofdschakelaar aan via **Instellingen → Tijdlijn / Zoomen → Urenplanning inschakelen**. Dit voegt een uur-tijdschaal, ploegen met werktijd-banden en uur-precieze taakbalken toe; staat de schakelaar uit, dan werkt de app volledig zoals voorheen, dag-granulair. Er is ook een optie **Gemengde dag/uur-planning toestaan**, die je aanzet als je in hetzelfde project zowel dag-taken als uur-taken wilt combineren (zie hieronder).

## Werktijd-banden en ploegen

Met urenplanning aan krijgt de kalender een extra niveau: in plaats van alleen "werkdag ja/nee" stel je per dag **werktijd-banden** in (sectie **Werktijden** in het kalendervenster) — de exacte tijdvakken waarin gewerkt wordt. Een gat tussen twee banden is automatisch een pauze; wil je een pauze inplannen, pas dan gewoon de tijden van de aangrenzende banden aan zodat er een gat ontstaat.

Om niet elke keer handmatig banden te hoeven intekenen, zijn er kant-en-klare **ploeg-presets**:

- **Dagdienst** — reguliere kantoortijden, één band per dag.
- **2 ploegen** — twee opeenvolgende diensten.
- **3 ploegen** — drie opeenvolgende diensten, dekt bijna de volledige dag.
- **Nachtploeg** — een dienst die doorloopt over middernacht.
- **24/7** — continubedrijf, geen onderbreking.

Naast deze presets kun je de banden ook volledig **Per weekdag instellen…**, bijvoorbeeld als de vrijdag korter is dan de rest van de week. Heb je een eigen combinatie samengesteld die je vaker wilt hergebruiken, bewaar die dan met **Bewaar als preset…** — de preset wordt lokaal op dit apparaat bewaard en is daarna in elk project weer te kiezen. De sectie toont ook de **Afgeleide uren/dag**: het aantal effectieve werkuren dat uit de ingestelde banden volgt.

## Taken op uurbasis

Met urenplanning aan en een taak op een **uur-kalender** (een kalender met werktijd-banden in plaats van alleen hele dagen) toont het taakbewerkvenster extra velden: **Duur (uren)** naast **Duur (dagen)**, en een totaal in **Totaal uren**. Een uur-kalender is vereist voor uren-invoer — probeer je uren in te vullen op een gewone dag-kalender, dan wijst de hint daarop.

Dit is precies hoe stort-taken in de praktijk worden gepland: een taak "Vloer storten toren A" met een duur van bijvoorbeeld 6 uur, gekoppeld aan een ploeg-kalender die die dag een ochtenddienst heeft. Bekijk dit patroon in de grote showcase [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc), die uren-planning gebruikt voor het vlechtwerk en de stortwerkzaamheden.

## Dag- en uurtaken mixen

Een project hoeft niet volledig op uren te draaien om van urenplanning te profiteren: met **Gemengde dag/uur-planning toestaan** aangevinkt, kunnen dag-taken (op de gewone projectkalender) en uur-taken (op een uur-kalender) naast elkaar in dezelfde planning bestaan en met elkaar in relatie staan. De taaktabel toont in dat geval per taak de duur in zijn eigen eenheid — een dag-taak in dagen, een uur-taak in uren — en waarschuwt onderaan de tabel als taken met verschillende uren-per-dag door elkaar heen lopen, zodat het duidelijk blijft welke vergelijking wel en niet één-op-één is.

## Verder lezen

- Zie vorstverlet en een 4-daagse resourcekalender in de praktijk: [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc).
- Zie uren-planning voor stort- en vlechtwerk in de praktijk: [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc).
- Relaties en lag/lead werken op dezelfde kalender-eenheden — lees de gids [Relaties & constraints](docs://gids-relaties-constraints) voor het verschil tussen werkdagen- en doorlooptijd-lag.

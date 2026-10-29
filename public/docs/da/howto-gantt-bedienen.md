# Træk, panorering og zoom i Gantt-diagrammet

Mål: betjen tidslinjen med musen: ryk en bjælke eller justér dens varighed, forskyd tidslinjen, markér opgaver med en boks og zoom ind og ud.

## Hvornår du har brug for det

Du ser i Gantt-diagrammet, at murværket skal starte to dage senere, eller at støbningen tager en dag længere, og du vil ændre det direkte på bjælken. Eller du har et projekt på flere måneder og vil hurtigt scrolle hen til byggeferien. Musen har et par bevægelser til det. Hvilken bevægelse der gør hvad, afhænger af, hvor du begynder at trække, og af din scrollindstilling.

## Trin

### Rykke en bjælke

1. Tryk midt på en opgavebjælke, og træk vandret. Start og slutdato flyttes lige langt, i hele dage; varigheden bliver den samme.
2. Slip museknappen. Bjælken bliver på sit nye sted. Tidsplanen er da forældet: tryk på *Beregn* (F5), eller lad appen gøre det selv, hvis *Beregn automatisk* er slået til.

Hvis opgaven har en foregående opgave, registrerer appen den nye start som begrænsningen *Start ikke tidligere end (SNET)*, og den meddeler det, når du slipper. Hvorfor det er sådan, og hvad der sker med en anden begrænsning, står i [Begrænsninger og deadlines](docs://uitleg-constraints). Trækker du tilbage til den oprindelige start, kommer den oprindelige begrænsning også tilbage.

Trækker du mest op eller ned i stedet for til siden, rykker du opgaven til en anden række, og datoerne bliver de samme. Retningen, du vælger i de første få pixels, gælder for hele træk, så et træk aldrig ændrer datoer og struktur på samme tid. Se [Justering af strukturen](docs://howto-structuur-aanpassen).

### Justere varigheden

1. Ryk musen til højre kant af bjælken. Markøren bliver til en pil, der peger til venstre og til højre.
2. Træk i kanten. Mens du trækker, viser en lille pille i temaets accentfarve (som standard orange) den varighed, opgaven ville få nu, fx *4d*. Pillen følger med, så du ser den nye varighed, før du slipper. Ved højre kant står pillen inde i bjælken, ved venstre kant lige til venstre for den. Pillen viser varigheden, sådan som varighedskolonnen viser den.
3. Slip museknappen. Varigheden er den, pillen viste.

Venstre kant rykker starten og lader slutdatoen være, så opgaven bliver kortere eller længere foran. Den samme SNET-regel gælder som ved rykning. Trækker du i midten af bjælken, vises pillen ikke: varigheden ændrer sig ikke.

Varigheden tæller arbejdsdage i opgavens kalender. Weekender og fridage tæller ikke, og en opgave i dage kan ikke blive kortere end én arbejdsdag. For en opgave i timer runder appen af til trinnet på tidslinjen under musen: mindst en time, eller et kvarter, hvis du zoomer tilstrækkeligt ind og *Vis kvarterer ved stor zoom* er slået til.

Ét træk er ét trin i *Fortryd*, uanset hvor langt du trækker. På en opdelt bjælke fungerer kanterne anderledes; se [Opdeling af en opgave](docs://howto-taak-splitsen).

### Forskyde tidslinjen

Hvad et træk på den tomme baggrund gør, afhænger af din scrolltilstand. Du vælger den i *App-indstillinger*, på fanen *Udseende*, under *Gantt › Scroll og zoom* ved *Tilstand*:

- *Zoom + træk* (standard): hvis du trækker på den tomme baggrund med venstre museknap, bevæger tidslinjen sig med musen, som på et kort. Markøren er en hånd. På en bjælke starter et træk blot en bjælkebevægelse.
- *Position* og *Taster*: det samme træk laver en markeringsboks. Du forskyder tidslinjen med hjulet (se [App-indstillinger](docs://ref-instellingen)) eller med midterknappen.

**Midterknappen** (hjulet trykket ned) forskyder tidslinjen i alle tilstande, også hvis du starter på en bjælke. Den virker ikke, mens en anden bevægelse er i gang, fx når du trækker en bjælke.

### Markere opgaver med en boks

En boks markerer alle opgaver i de rækker, den rører. Kun boksens højde tæller, ikke tidsaksen.

1. Start på den tomme baggrund. Med *Zoom + træk* holder du Ctrl (⌘ på en Mac) nede, mens du gør det. Med *Position* og *Taster* er det ikke nødvendigt.
2. Træk over de rækker, du vil markere. Markeringen får en ramme.
3. Slip museknappen. Med Esc under trækket annullerer du boksen, og markeringen bliver, som den var.

Mere om markering findes i [Markere, slette og fortryde opgaver](docs://howto-taken-selecteren-verwijderen). På et tomt område i selve opgavetabellen gør træk ingenting.

### Zoome ind og ud

1. Brug *Zoom +* og *Zoom -* (*Start › Zoom*), eller tasterne + og -. Hjulet zoomer også; hvornår det sker, afhænger af din scrolltilstand (se [App-indstillinger](docs://ref-instellingen)).
2. Vil du have hele projektet i billedet, vælg *Visning › Tidsskala › Tilpas til projekt*, eller tryk på Ctrl+0. *Nulstil* (på fanen *Visning*) eller tasten 0 sætter zoomen tilbage til standard.
3. Nederst til højre i statuslinjen står zoomen i pixels pr. dag, fx *Zoom: 15px/dag*.

Jo længere du zoomer ud, jo færre gitterlinjer er der. Ved 8 pixels pr. dag eller mere er der en linje for hver dag, med en tykkere linje ved skellet mellem ugerne. Mellem 2 og 8 pixels pr. dag er kun ugeskellet tilbage. Under 2 pixels pr. dag, på årsniveau, er kun månedsskellene tilbage. Ellers ville tegnefladen blive et jævnt stribemønster, hvor bjælkerne forsvinder. De grå weekender og fridage og de ugebånd, der skiftevis har en farvetone, bliver på alle niveauer; de bærer ugestrukturen, når linjerne forsvinder. I tidslinjens hoved vises ugenumre og dagnumre kun, når der er plads til dem, og fra 40 pixels pr. dag vises ugedagen også før dagnummeret.

Opgavens navn vises i bjælken, hvis det passer helt. Passer det ikke, fx når du zoomer ud, vises det fulde navn til højre for bjælken.

### Se detaljerne for en opgave

Hold musen stille over en bjælke. Et lille kort vises med opgavens navn, *WBS*, *Varighed*, *Start*, *Slutdato*, *Fremdrift*, *Kritisk* og *Samlet slæk*. Under træk, forskydning, en markeringsboks eller et højreklikmenu forsvinder kortet.

## Faldgruber og hvad appen gør da

**Starten rykker sig ikke.** Hvis opgaven har en foregående opgave og en anden begrænsning end SNET, fx *Så sent som muligt (ALAP)*, bruger appen ikke den trukne start. Når du slipper, siger appen, hvilken begrænsning der holder starten tilbage. Ændr den begrænsning for at rykke starten. Højre kant virker, fordi den kun ændrer varigheden.

**Bevægelsen gør noget andet.** I afhængighedstilstand og i opdelingstilstand gør bjælkebevægelser noget andet; Esc stopper de tilstande. Holder du Skift nede, mens du trækker fra en bjælke, opretter du en afhængighed i stedet for at rykke bjælken. Se [Tilføj afhængigheder](docs://howto-relaties-leggen).

**I tilstanden *Position* eller *Taster* panorerer venstre museknap ikke.** Du ser da en normal markør i stedet for en hånd. Brug hjulet eller midterknappen, eller sæt tilstanden til *Zoom + træk*.

**Et klik i afbrydelsen i en opdelt bjælke** markerer opgaven og starter hverken et træk eller en boks.

## Se også

- [Højreklikmenuer](docs://ref-contextmenus): menuerne på en bjælke, en række og en gruppeoverskrift.
- [Tastaturgenveje](docs://ref-sneltoetsen): tasterne til zoom og til at annullere en bevægelse.
- [App-indstillinger](docs://ref-instellingen): scrolltilstanden og tidsaksen.
- [Begrænsninger og deadlines](docs://uitleg-constraints): hvorfor en rykket start bliver til en begrænsning.

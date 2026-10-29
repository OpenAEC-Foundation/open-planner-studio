# Rapporttyper

Hver rapport på fanen *Rapport*, med de indstillinger der hører til den: hvad de gør, startværdien, hvad der ændres i rapporten og hvor du finder dem. Sådan laver du en rapport og gemmer den som PDF, står i [Lav og udskriv en rapport](docs://howto-rapport-maken-en-afdrukken).

## Sådan fungerer rapportvinduet

Åbn fanen *Rapport* (eller tryk på Ctrl+P). Til venstre står panelet *Rapport* med rullelisten *Rapporttype*, blokken *Sammendrag* med tællinger, blokken *Indstillinger* eller *Rapportindstillinger* og nederst knappen *Eksporter PDF*. Til højre ser du forhåndsvisningen. Det du ser i forhåndsvisningen, kommer med i PDF'en.

**Rapporttype** — hvilken rapport du ser. Vælg mellem elleve rapporter. Standard: *Gantt-udskrift*. Hvor: *Rapport*, øverst i panelet *Rapport*.

**Eksporter PDF** — laver PDF'en. Effekt: resultatet er kun en PDF; appen sender intet til en printer. Er tidsplanen ikke længere opdateret, beregner appen først. Giver beregningen en fejl, for eksempel på grund af en løkke i afhængighederne, så laver knappen ingen fil og viser fejlen. Hvor: *Rapport*, nederst i panelet *Rapport*.

**Husket.** Appen gemmer alle rapportindstillinger på denne enhed, for alle dine projekter. De hører ikke til projektfilen. Kun feltet *Virksomhed:* i Gantt-udskriften gemmes ikke.

**Aktuel tidsplan.** Rapporterne bruger den seneste beregning. Er tidsplanen ændret siden da, viser tabelrapporterne øverst *Tidsplanen er ændret siden sidste beregning — tryk på Beregn (F5) for aktuelle værdier.* Er der aldrig beregnet noget, står der *Endnu ikke beregnet — tryk på Beregn (F5) for datoer og slæk.* Er projektet i visningen *Datoer som registreret*, viser rapporterne datoerne fra kildefilen, og en linje siger det.

**Forkortelser.** *arb.d.* er arbejdsdage. *TF* er samlet slæk, *FF* er tilladt slæk.

## Papirformat og retning

**Papir:** — papirformatet for PDF'en. Vælg mellem A4, A3, A2 og A1. Standard: A3. Effekt: sidene er indrettet til det format. Der er ét valg for alle rapporter: det du vælger for én rapport, gælder også for de andre. På stående A4 bliver en bred tabel lille, fordi tabellen skaleres til sidens bredde. Hvor: *Indstillinger* (Gantt-udskrift og Ressourcediagram) eller *Rapportindstillinger* (de syv tabelrapporter). Milepæloversigten og Afvigelse har ingen valg.

**Retning:** — liggende eller stående. Vælg mellem *Liggende* og *Stående*. Standard: *Liggende*. Effekt: som *Papir:*. Hvor: samme sted som *Papir:*.

## Gantt-udskrift

Tidsplanen vist som bjælkediagram, med en tabel til venstre og en tidslinje til højre, over flere sider hvis nødvendigt. Forhåndsvisningen viser papiret med sidehoved, tabel, tidslinje og forklaring. Blokken *Sammendrag* tæller *Opgaver:*, *Bladopgaver:*, *Kritisk:* og *Afhængigheder:*. Alle indstillinger står under *Indstillinger*.

**Virksomhed:** — virksomheden i sidehovedet. Standard: virksomheden fra projektindstillingerne. Effekt: kun sidehovedet i rapporten; det du skriver her, gemmes ikke. Ændr virksomheden i *Indstillinger › Projekt › Projektindstillinger*, i feltet *Opdragsgiver/organisation*, og bekræft med *Anvend*.

**Forfatter:** — forfatteren i sidehovedet. Skrivebeskyttet: appen henter den fra projektindstillingerne.

**Skriftstørrelse:** — størrelsen på tekst og tabel i rapporten. Vælg mellem 90%, 100%, 110% og 125%. Standard: 100%. Effekt: ved en større skrift bliver tekst, rækker og tabel større, og tidslinjen bliver smallere. Uafhængig af *Tekststørrelse* i indstillingerne.

**Bjælkefarver:** — hvad farven på en bjælke afhænger af. Vælg mellem *Kritisk vej*, *Pr. opgave — automatisk* og *Efter kategori*, med rullelisten *Kategorifelt* for *Efter kategori*. Standard: *Kritisk vej*. Effekt: det er samme valg som *Bjælkefarver* på fanen *Visning*: ændrer du det her, ændrer Gantt-diagrammet på skærmen sig også. Findes det valgte felt ikke i dette projekt, står der *Dette felt findes ikke i dette projekt. Arbejdskategori bruges midlertidigt.*

**Statuslinje:** — en linje ved statusdatoen. Vælg mellem *Ingen*, *Statusdatolinje* og *Fremdriftslinje*. Standard: *Ingen*. Effekt: *Statusdatolinje* tegner en linje ved statusdatoen; *Fremdriftslinje* tegner den zigzagende linje, der buler ud til fremdriften for hver opgave. Har projektet ingen statusdato, står der *Angiv først en statusdato*, og rapporten tegner ingenting.

**Følg visning (filter, gruppering, sortering)** — kun for Gantt-udskriften. Standard: fra. Effekt: fra sætter hele opgavetræet på papiret. Til tegner præcis de rækker, der er på skærmen: med dit filter, din gruppering, din sortering og de sammenklappede faser.

**Tilpas automatisk til papir** — skalér tidslinjen til sidens bredde. Standard: til. Effekt: til skalerer tidslinjen til sidens bredde; antallet sider følger af højden. Fra bruger en fast skala (*Zoom:*) og fordeler også over bredden, og det giver hurtigt mange sider.

**Zoom:** — den faste skala for tidslinjen. Kun synlig når *Tilpas automatisk til papir* er fra. Skydeknap fra 1 til 40. Standard: 22. Effekt: en større værdi gør tidslinjen bredere, så der bliver flere sider i bredden.

**Tidslinje over:** — fordeler tidslinjen over flere sidebredder. Valg fra 1 til 8 sider. Standard: 1 side. Effekt: kun med *Tilpas automatisk til papir*; ellers er valget slået fra, og der står *Kun ved automatisk tilpasning*. Nyttigt ved en lang tidsplan, som du vil udskrive i en læsbar størrelse.

**Gentag sidehoved på hver side** — Standard: til. Effekt: til sætter sidehovedet på hver side; fra kun på den første.

**Gentag sidefod på hver side** — Standard: til. Effekt: til sætter sidefoden (projektnavn, udskrivningsdato og forklaring) på hver side; fra kun på den sidste. Et uddelt ark uden forklaring er ulæseligt, derfor er den til.

**Opgavenavne på bjælker** — Standard: til. Effekt: navnet på opgaven på bjælken, hvor der er plads.

**Vis færdiggørelsesgrad** — Standard: til. Effekt: den udfyldte del af bjælken bliver grå, som i Gantt-diagrammet, op til opgavens fremdrift, og kolonnen *Færd* vises i tabellen. En færdig opgave viser ingen slæk.

**Forkort opgavenavne** — Standard: til. Effekt: til skærer navnene i tabellen af ved bredden af *Navnekolonne:*. Fra lader kolonnen vokse med det længste navn; der står så *Navnekolonnen tilpasses det længste opgavenavn*.

**Navnekolonne:** — bredden på navnekolonnen. Kun synlig når *Forkort opgavenavne* er til. Skydeknap fra 60 til 400. Standard: 130.

**Vis overlejring af oprindelig plan** — den aktive oprindelige plan ved siden af bjælkerne. Standard: fra. Effekt: en tynd bjælke i farven for den oprindelige plan under opgavens bjælke, kun for opgaver der står i den oprindelige plan.

**Kritisk vej** — Standard: til. Effekt: styrer kun de røde afhængighedslinjer mellem to kritiske opgaver og linjen i forklaringen. Bjælkerne selv følger *Bjælkefarver:*, uanset dette afkrydsningsfelt.

**Vis slæk** — Standard: til. Effekt: slækken som et bånd bag ikke-kritiske bjælker.

**Afhængigheder** — afhængighedslinjerne. Standard: til. Effekt: tegner pile mellem bjælkerne.

**Vis kun arbejdsdage** — komprimerer tidslinjens akse i denne rapport. Standard: fra. Effekt: weekender og helligdage springes over, og ugebånd erstatter så weekendskraveringen. Uafhængig af den samme indstilling for Gantt-diagrammet på skærmen.

**Weekender** — Standard: til. Effekt: skraverer weekender og helligdage på tidslinjen, så længe skalaen gør det muligt at skelne dagene. På den komprimerede akse (*Vis kun arbejdsdage*) har dette afkrydsningsfelt ingen effekt.

**Forklaring** — Standard: til. Effekt: forklaringen i sidefoden.

**Forhåndsvisningskvalitet** — hvor skarp forhåndsvisningen er. Vælg mellem *Standard*, *Høj* og *Maksimal*. Standard: *Høj*. Effekt: kun skarpheden af forhåndsvisningen på skærmen; PDF'en ændres ikke. Hvor: *Rapport*, over forhåndsvisningen.

## Ressourcediagram

De samme bjælker som i Gantt-udskriften, grupperet pr. ressource: hvem der gør hvad, og hvornår. Blokken *Sammendrag* tæller *Ressourcer:*, *Tildelinger:* og *Uden ressource:* (ved en periode også *Uden for perioden:*). Diagrammet deler alle indstillinger med Gantt-udskriften, undtagen *Følg visning (filter, gruppering, sortering)*, *Kritisk vej* og *Afhængigheder*: rækkerne kommer ikke fra skærmen, en opgave kan stå under flere ressourcer, og afhængighederne tegnes ikke der. Afkrydsningsfeltet *Kritisk vej* er skjult og til. Det hører med til indstillingerne for Gantt-udskriften under *Indstillinger*, med disse fire afkrydsningsfelter og perioden:

**Hver ressource på en ny side** — Standard: fra. Effekt: hver ressource begynder på en ny side, så du kan uddele et ark pr. hold eller medarbejder. Fra giver ét sammenhængende dokument.

**Medtag opgaver uden ressource** — Standard: fra. Effekt: opgaverne uden ressource kommer som det sidste bånd i diagrammet, så du kan se hvad ingen har endnu.

**Gruppér efter ressourcetype** — Standard: fra. Effekt: et lag ovenpå: først et bånd pr. ressourcetype (arbejdskraft, hold, underleverandør, udstyr, materiale), og inden i det pr. ressource.

**Vis tildelingsenheder pr. dag og kurve** — Standard: til. Effekt: to kolonner efter opgavenavnet med tildelingsenhederne pr. dag og fordelingskurven for ressourcen i det bånd. Er der for lidt plads til tidslinjen, udelader rapporten kolonnerne og siger *Kolonnerne Enh./d og Kurve blev udeladt: …*; mere plads får du med et større papirformat eller liggende retning, en mindre skriftstørrelse eller en smallere tabel.

**Rapportperiode:** — kun de opgaver der rører perioden. Standard: *Projektets varighed*. Effekt: tidsaksen løber præcis over perioden. Er der intet i perioden, står der *Ingen opgaver i rapporteringsperioden — vælg en anden periode eller Hele projektet.* Se *Rapportperiode* nedenfor.

## Milepæloversigt

Alle milepæle i projektet i en tabel. Den har ingen egne indstillinger. Blokken *Sammendrag* tæller *Milepæle*, *Obligatorisk* og *For sent*. Kolonnerne er *WBS*, *Navn*, *Type* (*Automatisk*, *Start* eller *Slutdato*), *Dato*, *Begrænsning/deadline*, *Slæk*, *Obligatorisk* og *Fremdrift*. Status er *For sent*, hvis begrænsningen er overtrådt, deadlinen er overskredet, eller den samlede slæk er negativ; ellers *Kritisk*, hvis milepælen er kritisk efter projektets definition af kritisk; ellers *Efter tidsplanen*. Er der ingen milepæle, står der *Ingen milepæle i dette projekt.* PDF'en bruger det papirformat og den retning du sidst valgte for en anden rapport.

## Afvigelse

Den aktuelle tidsplan ved siden af den aktive oprindelige plan, for bladopgaver. Den har ingen egne indstillinger. Blokken *Sammendrag* tæller *Opgaver*, *Forsinket* og *Tidligere* og viser *Projektslutdato: +3 arbejdsdage* (forskellen i arbejdsdage mellem den oprindelige slutdato og den aktuelle slutdato). Kolonnerne er *WBS*, *Navn*, *Oprindelig startdato*, *Oprindelig slutdato*, *Aktuel start*, *Aktuel slutdato*, *Δ start (arb.d.)*, *Δ slutdato (arb.d.)* og *Fremdrift*. Status følger slutdatoen: *Forsinket*, hvis slutdatoen er senere end i den oprindelige plan, *Tidligere*, hvis den er tidligere, ellers *Efter tidsplanen*. *Ny* er en opgave der ikke står i den oprindelige plan. *Udgået* er en opgave der står i den oprindelige plan, men ikke længere står i tidsplanen. Uden en aktiv oprindelig plan står der *Ingen aktiv oprindelig plan — gem en oprindelig plan, eller vælg en som aktiv.* PDF'en bruger det papirformat og den retning du sidst valgte for en anden rapport.

## Forudblik

Hvad der kører eller starter i perioden: listen til det ugentlige møde. Indstillinger står under *Rapportindstillinger*.

**Rapportperiode:** — rapportens vindue. Standard: *Næste måned*. Effekt: rapporten indeholder de uafsluttede opgaver der rører perioden, også hvis de spænder over hele perioden, samt forsinkede opgaver fra før referencedagen, så længe slutningen af perioden ikke ligger før referencedagen.

**Næsten kritisk ≤ (arb.d.):** — grænseværdien for *Næsten kritisk*. Tal fra 0 til 60. Standard: 5. Effekt: en opgave med mere end 0 og højst så mange arbejdsdage samlet slæk tæller som næsten kritisk. Ved 0 tæller kun det som projektets beregningsindstilling *Markér næsten kritisk* markerer.

Blokken *Sammendrag* tæller *Opgaver*, *Forsinket*, *I gang*, *Skulle være startet*, *Starter*, *Kritisk* og *Næsten kritisk*. Status pr. række, altid i forhold til referencedagen: *Forsinket* (ikke afsluttet, og slutdatoen ligger før referencedagen), *Skulle være startet* (ikke startet, mens startdatoen lå før referencedagen), *I gang*, *Starter* (ikke startet endnu, starter i vinduet). Kolonnerne er *WBS*, *Navn*, *Start*, *Slutdato*, *Rest (arb.d.)*, *Færd*, *TF (wd)*, *Kritisk*, *Ressourcer* og *Fremdrift*.

## Kritisk og næsten kritisk

Opgaverne der bestemmer projektets slutdato, og dem der er tæt på. Indstilling under *Rapportindstillinger*.

**Næsten kritisk ≤ (arb.d.):** — Standard: 5. Tal fra 0 til 60. Effekt og betydning som ved Forudblik. Undertitlen viser den valgte grænseværdi.

Rapporten indeholder de uafsluttede opgaver der er kritiske (efter løseren og projektets definition af kritisk) eller næsten kritiske, sorteret efter slækstien, dernæst efter samlet slæk og dernæst efter start. Blokken *Sammendrag* tæller *Kritisk*, *Næsten kritisk*, *Kritiske kæder* og *Bladopgaver*. Kolonnerne er *WBS*, *Navn*, *Start*, *Slutdato*, *Rest (arb.d.)*, *TF (wd)*, *FF (wd)*, *Vej* og *Fremdrift*. Kolonnen *Vej* viser slækstien, hvis beregningsindstillingen *Flere slækstier* er til; ellers en streg.

## Fremdriftsrapport

Hvor projektet står på statusdatoen. Indstillinger står under *Rapportindstillinger*.

**Rapportperiode:** — Standard: *Forrige måned*. Effekt: *Fuldført i den forrige periode* tæller inden for perioden. *Starter i den kommende periode* kigger frem fra statusdatoen, op til *Look-ahead til*; ved en *Forrige* periode så langt frem, som perioden kigger tilbage.

**Næsten kritisk ≤ (arb.d.):** — Standard: 5. Som ved Look-ahead.

Blokken *Sammendrag* viser *Statusdato*, *Periode*, *Look-ahead til*, *Oprindelig slutdato*, *Forventet slutdato*, *Δ slutdato (arb.d.)*, *Planlagt* (med *(oprindelig plan)* eller *(nuværende tidsplan)*), *Faktisk* og tællingerne *Fuldført*, *I gang*, *Ikke startet*, *Forsinket* og *Kritisk*. Planlagt og faktisk vægtes efter varigheden af opgaverne. Planlagt måler mod den oprindelige plan, hvis der er en aktiv oprindelig plan, ellers mod den nuværende tidsplan. Afsnittene er *Fuldført i den forrige periode*, *I gang*, *Starter i den kommende periode*, *Forsinket* og *Åbne kritiske opgaver*; en opgave kan stå i mere end ét afsnit. Alle afsnit har de samme kolonner: *WBS*, *Navn*, *Oprindelig slutdato*, *Forventet slutdato*, *Færd*, *Rest (arb.d.)*, *TF (wd)*, *Kritisk* og *Fremdrift*. Fremdriften pr. række er *Fuldført*, *I gang*, *Ikke startet*, *Skulle være startet* eller *Skulle være færdig*.

## Tidsplanens tilstand

En kontrol af selve tidsplanen for fejl og usædvanlige værdier, med DCMA 14-punktsvurderingen øverst. Indstillinger under *Rapportindstillinger*.

**Høj slæk > (arb.d.):** — Tal fra 1 til 365. Standard: 44. Virkning: en ufærdig opgave med mere samlet slæk end dette falder under *Høj slæk*.

**Lang varighed > (arb.d.):** — Tal fra 1 til 365. Standard: 44. Virkning: en ufærdig opgave, som ikke er en milepæl, med længere varighed falder under *Lang varighed*.

**Forsinkelse > (arb.d.):** — Tal fra 0 til 365. Standard: 10. Virkning: en afhængighed med mere forsinkelse falder under *Lang forsinkelse*. Et forskud rapporteres altid.

**Næsten kritisk ≤ (arb.d.):** — Tal fra 0 til 60. Standard: 5. Virkning: bestemmer kontrollen *Næsten kritisk*.

Afsnittet *DCMA 14-punktsvurdering* står først. Det følger de fjorten kontroller fra det amerikanske Defense Contract Management Agency, med formlerne og grænseværdierne fra deres *EVMS Program Analysis Pamphlet* (DCMA-EA PAM 200.1, oktober 2012). Pr. punkt ser du *Antal*, *Af* (det samlede antal, der blev talt ud fra), *Værdi*, *Grænseværdi*, *Resultat* og *Detaljer*. Resultatet er *Opfylder*, *Markering* eller *n.a*; ved n.a står årsagen i detaljerne. En markering er ikke en fejl: pjecen ser den som en grund til at undersøge nærmere. Grænseværdierne under *Rapportindstillinger* gælder ikke for dette afsnit; det bruger altid grænseværdierne fra pjecen.

Det tæller ufærdige bladopgaver, uden milepæle og hængekøjer, og afhængighederne til sådanne opgaver. Noten over rapporten viser begge tal. De fjorten punkter:

- *Logik*: opgaver uden foregående eller efterfølgende opgave. Grænseværdi: højst 5%.
- *Forskud*: afhængigheder, hvor forsinkelsen er under nul. Grænseværdi: ingen.
- *Forsinkelser*: afhængigheder med positiv forsinkelse, uanset hvor kort. Grænseværdi: højst 5%.
- *Afhængighedstyper*: andelen af FS-afhængigheder. Grænseværdi: mindst 90%.
- *Hårde begrænsninger*: opgaver med en obligatorisk begrænsning eller en MSO, MFO, SNLT eller FNLT. Grænseværdi: højst 5%.
- *Høj slæk*: opgaver med mere end 44 arbejdsdage samlet slæk. Grænseværdi: højst 5%. Kræver en beregning.
- *Negativ slæk*: opgaver med en samlet slæk under 0. Grænseværdi: ingen. Kræver en beregning.
- *Høj varighed*: opgaver længere end 44 arbejdsdage. Tæller varigheden i den oprindelige plan, hvis opgaven står i den aktive oprindelige plan; ellers tæller den aktuelle varighed. Grænseværdi: højst 5%.
- *Ugyldige datoer*: en faktisk startdato eller faktisk slutdato efter statusdatoen, eller en forventet startdato eller forventet slutdato før statusdatoen. Grænseværdi: ingen. Kræver en statusdato.
- *Ressourcer*: opgaver uden ressource. Grænseværdi: ingen. Kun hvis projektet bruger ressourcer; ellers n.a.
- *Forsinkede opgaver*: af de opgaver, den oprindelige plan siger skal være færdige på eller før statusdatoen, andelen der slutter senere eller forventes at slutte senere. Grænseværdi: højst 5%. Kræver en statusdato og en aktiv oprindelig plan.
- *Test af kritisk vej*: appen forlænger en kritisk opgave med 100 arbejdsdage og genberegner på en kopi, uden at ændre projektet. Testen opfylder kravet, hvis projektets sidste opgave så ikke slutter før den opgave. Den tester den kritiske, ufærdige opgave med den tidligste startdato; detaljerne nævner opgaven og hvor mange arbejdsdage slutdatoen flyttede. I visningen *Datoer som registreret* er testen *n.a* (*Ikke beregnet*): testen beregner, og rapporten viser så datoerne fra kildefilen. Tryk på *Beregn* (F5), og testen kører igen.
- *CPLI*: (længde af kritisk vej + slæk) / længde af kritisk vej. Længden tæller arbejdsdagene fra statusdatoen til slutdatoen for den sidste opgave; slæk er forskellen med den oprindelige slutdato for den opgave, eller den beregnede slæk, hvis opgaven ikke står i den oprindelige plan. Grænseværdi: mindst 0,95. Kræver en statusdato.
- *BEI*: antallet af opgaver færdige på statusdatoen, divideret med antallet den oprindelige plan siger skal være færdige på det tidspunkt, plus opgaverne uden oprindelig plan. Grænseværdi: mindst 0,95. Kræver en statusdato og en aktiv oprindelig plan.

To punkter afviger fra pjecen, fordi appen ikke kender begrebet: *Høj varighed* tæller alle ufærdige opgaver, mens pjecen begrænser det til detailperioden (rolling wave), og *Ressourcer* kigger kun på tildelte ressourcer, ikke på omkostninger. Pjecen giver ikke et tal for testen af kritisk vej; de 100 arbejdsdage er appens valg.

Kontrollerne står i denne rækkefølge, med hver sin alvorlighedsgrad. Fejl: *Negativ slæk*, *Overskredet deadline*, *Overtrådt begrænsning* og *Inkonsistent fremdrift* (faktisk startdato eller faktisk slutdato efter statusdatoen, forventet startdato eller forventet slutdato før statusdatoen, 100% uden faktisk slutdato, faktisk slutdato men ikke 100%, fremdrift uden faktisk startdato). Advarsel: *Uden foregående opgave (åben start)* og *Uden efterfølgende opgave (åben slutning)* (ikke milepæle), *Lang varighed*, *Forskud (under nul)*, *Hård begrænsning* (en obligatorisk begrænsning eller en MSO, MFO, SNLT eller FNLT), *Fremdrift uden for rækkefølge* og *Forsinket opgave (i forhold til oprindelig plan)*. Information: *Næsten kritisk*, *Høj slæk*, *Lang forsinkelse*, *Afhængighed anden end FS* og *Uden ressource* (kun hvis projektet bruger ressourcer). Rapporten kigger kun på bladopgaver, som ikke er hængekøjer. Blokken *Sammendrag* tæller *DCMA-markeringer*, *Fejl*, *Advarsler*, *Information*, *Bladopgaver* og *Afhængigheder*. Under DCMA-afsnittet står et afsnit *Overblik* (pr. kontrol alvorlighedsgraden og antallet) og et afsnit *Fund* (hver opgave eller afhængighed). Uden en beregning mangler de kontroller, der kræver slæk.

## Ressourcebelastning

For hver ressource og pr. uge eller måned: hvad der kræves, mod hvad der er tilgængeligt. Indstillinger under *Rapportindstillinger*.

**Rapportperiode:** — Standard: *Projektets varighed*. Virkning: hver uge eller måned, der overlapper perioden, er med i sin helhed. Så viser en række det samme tal som histogrammet.

**Aggregering:** — Vælg mellem *Pr. uge* og *Pr. måned*. Standard: *Pr. uge*. Virkning: en række pr. kalenderuge (kolonne *Uge fra*, med mandagen) eller pr. kalendermåned (kolonne *Måned*).

**Kun overallokerede perioder** — Standard: fra. Virkning: til viser kun de uger eller måneder med mindst én overallokeret dag.

Kolonnerne er *Ressource*, *Type*, *Uge fra* eller *Måned*, *Krævet*, *Tilgængelig*, *Afvigelse* (tilgængelig minus krævet; et negativt tal betyder mangel), *Top/dag* og *Overallokeret*. *Krævet* er summen af tildelingsenhedsdage. Kun uger eller måneder med behov er med. Blokken *Sammendrag* tæller *Ressourcer*, *Uger* eller *Måneder*, *Overallokerede uger* eller *Overallokerede måneder* og *Overallokerede ressourcer*.

## Ressourcetildelinger

Pr. ressource de opgaver, den er tilknyttet: hvad laver dette hold eller denne kran? Indstillinger under *Rapportindstillinger*.

**Rapportperiode:** — Standard: *Projektets varighed*. Virkning: med en periode medtages kun tildelinger af opgaver, der overlapper perioden, plus forfalden arbejde fra før referencedagen. *Projektets varighed* filtrerer ikke på dato.

**Medtag færdige opgaver** — Standard: fra. Virkning: til medtager også tildelingerne af færdige opgaver.

Rækkerne er pr. ressource, og inden for en ressource efter start. Blokken *Sammendrag* tæller *Ressourcer*, *Tildelinger* og *Opgaver uden ressource*. Kolonnerne er *Ressource*, *Type*, *WBS*, *Navn*, *Start*, *Slutdato*, *Rest (arb.d.)*, *Enh./dag*, *Færd*, *Kritisk* og *Fremdrift*. *Ressource* og *Type* vises kun på den første række for en ressource. Statussen pr. række er den samme som i fremdriftsrapporten: *Fuldført*, *I gang*, *Ikke startet*, *Skulle være startet* eller *Skulle være færdig*.

## WBS-sammendrag

Tidsplanen samlet op pr. WBS-element: det ledelsesmæssige overblik. Indstillinger under *Rapportindstillinger*.

**Niveau:** — op til hvilket niveau WBS'en vises. Vælg mellem *Fuld WBS* og niveau 1 til 8. Standard: niveau 2. Virkning: undertitlen siger *Til og med niveau 2*.

**Vis opgaver** — Standard: fra. Virkning: til viser også selve bladopgaverne under hvert element.

Kolonnerne omfatter *WBS*, *Navn*, *Start*, *Slutdato*, *Oprindelig startdato*, *Oprindelig slutdato*, *Varighed (wd)*, *Færd*, *Δ slutdato (arb.d.)*, *Min. TF*, *Opg* (antal opgaver), *Krit*, *Aktiv* og *Færdig*. Start og slutdato for en hovedopgave kommer fra den sidste beregning. Fremdriften er vægtet efter varighed over bladopgaverne. *Min. TF* og antallene gælder for de bladopgaver nedenfor. Blokken *Sammendrag* tæller *WBS-elementer* og *Opgaver*.

## Rapportperiode

Fire tabelrapporter og Ressourcediagrammet arbejder med en *Rapportperiode:*: *Look-ahead*, *Fremdriftsrapport*, *Ressourcebelastning*, *Ressourcetildelinger* og *Ressourcediagram*. Hver rapport husker sin egen periode. Under rullemenuen står *Fra* og *Til* med de datoer, som dit valg giver.

**Referencedag.** En periode med *Næste* eller *Forrige* tæller fra statusdatoen for projektet, eller fra i dag, hvis der ingen statusdato er. Så siger tabelrapporterne *Ingen statusdato angivet — rapporten bruger i dag (…).* Flytter du statusdatoen, flytter perioden med. Begge dage tæller med.

**Næste uge, Næste 2 uger, Næste 4 uger, Næste 6 uger, Næste 8 uger, Næste 12 uger** — fra referencedagen, 7 dage pr. uge. Med statusdato torsdag den 20. maj løber *Næste uge* fra 20. til 26. maj, og *Næste 4 uger* fra 20. maj til 16. juni.

**Forrige uge, Forrige 2 uger, Forrige 4 uger, Forrige 6 uger, Forrige 8 uger, Forrige 12 uger** — de samme seks, men tilbage i tid: 7 dage pr. uge, til og med referencedagen. Med referencedag 20. maj løber *Forrige 2 uger* fra 7. til 20. maj.

**Næste måned, Forrige måned** — en kalendermåned frem eller tilbage, til én dag før samme dato i den anden måned. Med referencedag 20. maj løber *Næste måned* til og med 19. juni; *Forrige måned* løber fra 21. april til og med 20. maj.

**Projektets varighed** — fra den første startdato til den sidste slutdato i tidsplanen.

**Tilpasset** — din egen periode. Virkning: *Fra* og *Til* bliver to datofelter. De starter med datoerne fra det valg, du lige havde. Slutdatoen må ikke ligge før startdatoen (*Slutdatoen ligger før startdatoen*), og begge felter skal udfyldes (*Udfyld begge datoer*). Hvis indtastningen ikke er korrekt, bliver rapporten på den sidste gyldige periode.

## Se også

- [Sådan laver du og udskriver en rapport](docs://howto-rapport-maken-en-afdrukken): hele vejen fra rapporttype til PDF.
- [Sådan vælger du rapportperioden](docs://howto-rapportageperiode-kiezen): trin og eksempler.
- [Kritisk vej og slæk](docs://uitleg-kritiek-pad): hvad kritisk og næsten kritisk betyder.
- [Fremdrift, statusdato og oprindelig plan](docs://uitleg-voortgang): statusdatoen og den oprindelige plan, rapporterne arbejder med.
- [Sådan løser du overallokering](docs://howto-overbezetting-oplossen): hvad du gør med de overallokerede uger fra Ressourcebelastning.
- [Import- og eksportformater](docs://ref-import-exportformaten): PDF ved siden af de andre formater.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): to oprindelige planer med fremdrift og en statusdato, til at se på afvigelsesrapporten.

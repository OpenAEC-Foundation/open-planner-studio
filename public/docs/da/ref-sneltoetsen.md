# Tastaturgenveje

Alle tastekombinationer i appen, grupperet som i vinduet *Tastaturgenveje*. Tasterne er faste: du kan ikke ændre dem. Hvordan du arbejder med musen og menuerne, står i vejledningerne. Her slår du en tast op.

## Sådan læser du listen

**Mac.** Overalt hvor denne artikel siger Ctrl, bruger du Cmd (⌘) på en Mac. Alt er Option (⌥). På en Mac viser vinduet *Tastaturgenveje* symbolerne ⌥, ⇧ og ⌘ i stedet for Alt, Skift og Ctrl. Ctrl virker også i appen på en Mac.

**Præcis kombination.** Appen kontrollerer Ctrl, Skift og Alt præcist. Ctrl+Alt+S gør derfor ingenting. Tasterne skal præcis svare til listen.

**Åbn vinduet.** Tryk på Ctrl+/ eller vælg *Indstillinger › Tastaturgenveje › Tastaturgenveje*. Ctrl+/ lukker vinduet igen. Du kan ikke ændre noget i vinduet. Det viser ikke alle taster på denne liste: af tabeltasterne kun de første seks poster, og ikke dialogtasterne nederst i denne artikel.

**Når en tast ikke virker.** Hver post nævner sine begrænsninger. Tre regler gælder næsten overalt:

- I et inputfelt, en rullemenu eller et tekstfelt fanger appen ikke tasterne, så du kan bare skrive. Undtagelser: F5, Ctrl+S, F11 og Esc under præsentationen virker også i et felt. Hvis fokus står på en lukket rullemenu, virker tasterne med Ctrl også, for eksempel Ctrl+Z efter et valg (ikke Ctrl+Delete og Ctrl+Backspace). Det gælder ikke i en åben liste eller i en dialog. I den udgivne app (desktop og webversionen på siden) gælder det også for Ctrl+Skift+S, Ctrl+O og Ctrl+N.
- Så længe en dialog eller et andet vindue er åbent, virker de taster, der nedenfor er markeret *Ikke i en dialog*, ikke. Det gælder også rundvisningen, velkomstdialogen og spørgsmål, der venter på svar, for eksempel spørgsmålet om at gemme dine ændringer og samtykket ved installation af en udvidelse. De fleste af disse taster virker heller ikke i præsentationstilstand. Undtagelse: redigeringstasterne Ctrl+C, Ctrl+V, Ctrl+Z, Ctrl+Y og Delete/Backspace virker under præsentationen.
- Skift af dokument (Ctrl+1 til 9, Ctrl+N, Ctrl+O) virker heller ikke, så længe *Fil › Projektindstillinger* har ændringer, som du endnu ikke har bekræftet med *Anvend*. Forkast eller anvend dem først.

## Fil

**F5** — *Beregn*: genberegner tidsplanen, ligesom knappen *Beregn* (*Start › Tidsplan › Beregn*). Virker også i et inputfelt.

**Ctrl+S** — *Gem*: gemmer projektet. Virker også i et inputfelt.

**Ctrl+Skift+S** — *Gem som*: spørger, hvor filen skal gemmes. I en udviklingsversion virker den ikke i et inputfelt.

**Ctrl+O** — *Åbn*: åbner en fil, normalt i en ny fane. Ikke i en dialog og ikke med projektindstillinger, som du ikke har anvendt.

**Ctrl+N** — *Nyt projekt*: åbner vinduet *Nyt projekt*. Ikke i en dialog og ikke med projektindstillinger, som du ikke har anvendt.

Den udgivne app (desktop og webversionen på siden) blokerer også en række browsertaster, så de ikke er i vejen: Ctrl+R og Ctrl+Skift+R (genindlæs), F12, Ctrl+Skift+I og Ctrl+Skift+J (udviklerværktøjer), Ctrl+U (vis kilde) og Ctrl+G, Ctrl+F og Ctrl+L (søg og adresselinje). Ctrl+S, Ctrl+Skift+S, Ctrl+O, Ctrl+N og F5 går til appen selv.

## Redigér

**Ctrl+C** — *Kopiér*: kopierer de valgte opgaver. Kun med en markering. Ikke i en dialog. Ikke i *Fil*, ikke på fanerne *Rapport* og *IFC* og ikke mens det fulde ressourcepanel er åbent. I opgavetabellen kopierer Ctrl+C de valgte celler. Tabellen klarer det selv.

**Ctrl+V** — *Indsæt*: indsætter kopierede opgaver. Ikke i en dialog. Ikke i *Fil*, ikke på fanerne *Rapport* og *IFC* og ikke mens det fulde ressourcepanel er åbent, fordi opgavetabellen ikke er synlig der. I opgavetabellen indsætter den cellerne.

**Ctrl+Z** — *Fortryd*. Ikke i en dialog: luk vinduet først.

**Ctrl+Y** eller **Ctrl+Skift+Z** — *Gentag*: gentager det, du fortrød. Ikke i en dialog.

**Delete** eller **Backspace** — *Slet*: sletter de valgte opgaver. Kun med en markering. Ikke i en dialog. Ikke i *Fil*, ikke på fanerne *Rapport* og *IFC* og ikke mens det fulde ressourcepanel er åbent, fordi opgavetabellen ikke er synlig der. I en celle i opgavetabellen rydder Delete og Backspace kun cellens indhold (se *Tabel*).

**F2** — *Redigér...*: åbner opgavedialogen for den første valgte opgave. Kun med en markering. Ikke i en dialog. I en celle i opgavetabellen starter F2 redigering af cellen.

**Ctrl+A** — *Vælg alt*: vælger alle opgaver. Ikke i en dialog.

**Esc** — *Fjern markering*: fjerner markeringen. Samtidig slår den afhængighedstilstand, tilstand for opdelt opgave og spor sti fra, og den lukker opgavedialogen og projektoversigten. Under præsentationen lukker Esc kun præsentationen (se *Visning*). I et inputfelt gør Esc ingen af disse ting.

## Struktur

**Alt+Skift+→** eller **Alt+→** — *Indryk*: gør de valgte opgaver ét niveau dybere i WBS. Kun med en markering, ikke i en dialog.

**Alt+Skift+←** eller **Alt+←** — *Udryk*: flytter de valgte opgaver ét niveau op. Kun med en markering, ikke i en dialog.

Indryk, udryk og indsættelse over eller under en valgt opgave virker kun i den enkle trævisning: uden filter, gruppering eller sortering. I enhver anden visning afviser appen dem med en meddelelse, fordi den viste rækkefølge så ikke er projektets rækkefølge. Indsættelse uden markering virker i alle visninger.

**Insert** — *Indsæt over*: indsætter en ny opgave over den øverste valgte opgave, på samme niveau. Uden markering kommer opgaven nederst, i alle visninger. Ikke i en dialog.

**Ctrl+I** — *Indsæt under*: indsætter en ny opgave under den nederste valgte opgave, på samme niveau. Uden markering kommer opgaven nederst. Ikke i en dialog.

**Ctrl+M** — *Tilføj milepæl*: tilføjer en ny milepæl nederst på listen, også når du har en opgave valgt. Ikke i en dialog.

**Alt+↑** — *Flyt opgave op*: flytter den første valgte opgave ét sted op inden for sit niveau. Kun med en markering, ikke i en dialog.

**Alt+↓** — *Flyt opgave ned*: det samme, ét sted ned.

## Visning

**F11** — *Præsentation*: slår præsentationstilstand til eller fra. Appen beder også browseren eller vinduet om fuld skærm. Virker også i et inputfelt. I browseren starter F11 ikke præsentationen: browseren sætter selv vinduet i fuld skærm, og appen forbliver, som den er. F11 stopper en kørende præsentation i browseren.

**Esc** (under præsentationen) — *Afslut præsentation*. Virker også i et inputfelt. Dette går foran *Fjern markering*.

**Ctrl+=** — *Zoom ind*: zoomer tidslinjen ind med et fast trin. Ikke i et inputfelt.

**Ctrl+-** — *Zoom ud*: zoomer ud med et fast trin.

**+** eller **=** — *Zoom ind*: zoomer ind med 10% om midten af Gantt-området. Ikke i et inputfelt, og kun når Gantt-tidslinjen er synlig, altså ikke på fanerne *Tabel*, *IFC* og *Rapport*.

**-** — *Zoom ud*: zoomer ud med 10%. Samme begrænsninger.

**0** — *Nulstil zoom*: sætter zoomen tilbage til standard og ruller til starten. Samme begrænsninger.

**Ctrl+0** — *Tilpas til projekt*: zoomer, så hele projektet er synligt. Samme begrænsninger.

**Ctrl+/** — *Vis genveje*: åbner og lukker vinduet *Tastaturgenveje*. Virker også når en anden dialog er åben, men ikke under rundvisningen og velkomstdialogen.

**Ctrl+Skift+H** — *Histogram*: slår histogrammet til eller fra, ligesom knappen *Histogram* (*Ressourcer › Histogram › Histogram* eller *Visning › Paneler › Histogram*). Appen husker dit valg.

**Ctrl+Skift+L** — *Advarsler*: slår advarselspanelet til eller fra, ligesom knappen *Advarsler* (*Visning › Paneler › Advarsler* eller *Tidsplan › Tidsplan › Advarsler*).

## Navigation

**Ctrl+P** — *Gå til fanen Rapport*: sender dig til fanen *Rapport*. Det er derfor ikke en udskriftskommando. Ikke i en dialog.

**F1** — *Åbn hjælp*: åbner *Fil › Hjælp*. Ikke i et inputfelt og ikke i en dialog. I et vindue bruger du spørgsmålstegnet øverst til højre: det åbner hjælp til artiklen om det vindue (se [Båndet, fane for fane](docs://ref-lint), under *Hjælp*).

**Ctrl+1** til **Ctrl+9** — *Skift dokument*: går til det første til niende åbne dokument. Findes dokumentet ikke, sker der ingenting. Ikke i en dialog og ikke med projektindstillinger, som du ikke har anvendt.

**Ctrl+Home** — *Hop til i dag*: ruller tidslinjen, så en dato står til venstre i visningen. Det er statusdatoen, hvis du har sat en, ellers i dag. Derfor siger etiketten „i dag“, selv når tidslinjen springer til statusdatoen. Zoom og tidslinjens start bliver, som de var. Har en celle i opgavetabellen fokus, går Ctrl+Home i stedet til første celle i opgavetabellen (se *Tabel*).

## Tabel

Disse taster virker i opgavetabellen (på fanen *Tabel* og i tabellen til venstre for Gantt) når en celle har fokus. Vinduet *Tastaturgenveje* viser de første seks poster. De øvrige står der ikke.

**Tab** og **Skift+Tab** — *Næste/forrige celle*: går til den næste eller forrige celle, og i slutningen af en række til næste række. På den allersidste celle (Tab) eller den allerførste (Skift+Tab) forlader fokus opgavetabellen.

**Enter** eller **F2** — *Redigér celle*: åbner editoren for cellen. Er cellen skrivebeskyttet, viser opgavetabellen en meddelelse.

**Et bogstav, et ciffer eller et andet tegn** — *Indtastning erstatter cellens indhold*: starter redigering og erstatter indholdet med det, du skriver.

**Insert** — *Indsæt over*: indsætter en opgave over den aktive række.

**Delete** eller **Backspace** — *Ryd cellens indhold*: rydder indholdet af de valgte celler, ikke selve opgaven. Vinduet *Tastaturgenveje* viser kun Delete.

**Esc** — *Fjern markering*: flytter fokus til opgavetabellen som helhed, så næste Tab forlader tabellen. Esc fjerner også markeringen, som beskrevet ovenfor.

**Piletaster** — går til cellen over, under, til venstre eller til højre. Tilføj Skift for at udvide markeringen.

**Home** og **End** — til den første eller sidste kolonne i rækken. Med Ctrl til første celle i første række og sidste celle i sidste række. Tilføj Skift for at udvide markeringen.

**Page Up** og **Page Down** — én skærmhøjde op eller ned. Tilføj Skift for at udvide markeringen.

**Enter** (under redigering) — bekræfter indtastningen og går til samme kolonne i næste række. Skift+Enter går til forrige række.

**Esc** (under redigering) — annullerer redigeringen uden at beholde indtastningen.

Ressourcetabellen har sin egen tasthåndtering mellem inputfelterne. Det står ikke på denne liste.

## Dialoger og andre vinduer

Disse taster står ikke i vinduet *Tastaturgenveje*.

**Esc** — lukker den øverste dialog (annullerer). Også i *Fil* (Backstage) lukker Esc skærmbilledet, medmindre en dialog eller en åben rullemenu ligger øverst.

**Enter** — bekræfter den øverste dialog, ligesom hovedknappen, i dialoger der understøtter det. Enter gør ikke det i et tekstfelt med flere linjer, i en åben rullemenu eller under IME-input.

**Esc** under en gestus i Gantt — annullerer et markeringsfelt (markeringen forbliver som den var) og en gestus til at opdele en opgave (en allerede lavet opdeling fortrydes).

**Enter** og **Esc** i vælgeren for afhængighedstype — Enter bekræfter, Esc annullerer.

**Venstre pil og højre pil** på skillelinjen mellem opgavetabellen og tidslinjen — flytter skillelinjen 10 pixels ad gangen, 40 med Skift. Skillelinjen skal have tastaturfokus.

**Op pil og ned pil** i histogrammets ressourceliste — vælger forrige eller næste ressource. Histogramfeltet skal have fokus.

## Se også

- [Lav og udskriv en rapport](docs://howto-rapport-maken-en-afdrukken): hvorfor Ctrl+P ikke åbner et udskriftsvindue.
- [Opdele en opgave](docs://howto-taak-splitsen): gestussen til at opdele en opgave, som Esc annullerer.
- [Præsentere på en stor skærm](docs://howto-presentatie): F11 og Esc i praksis.
- [Slå AutoSave til](docs://howto-automatisch-opslaan): gemme med Ctrl+S ved siden af AutoSave.
- [Trække, panorere og zoome i Gantt](docs://howto-gantt-bedienen): musegestusserne ved siden af tasterne.

# Højreklikmenuer

Hvilke menuer den højre museknap åbner i Gantt og i opgavetabellen, hvad hvert punkt gør, og hvilke opgaver det gælder for. Punkter, der også findes som knap eller genvej, står i [Båndet, fane for fane](docs://ref-lint) og [Tastaturgenveje](docs://ref-sneltoetsen).

## Hvilken menu hvor

Der er fire menuer. Hvilken du får, afhænger af, hvor du klikker:

- **På en opgavebjælke i Gantt** — opgavemenuen, med *Start afhængighed herfra* øverst.
- **På en opgave i opgavetabellen** — den samme opgavemenu, uden det ene punkt øverst. Det gælder for opgavetabellen til venstre for Gantt og for fanen *Tabel*.
- **På en gruppeoverskrift i opgavetabellen** — en lille menu til at folde grupper ud og sammen. Gruppeoverskrifter vises kun, når du grupperer, for eksempel med layoutet *Ressourcediagram*.
- **På tom plads** — i Gantt ved siden af eller under bjælkerne, og i opgavetabellen under den sidste opgave eller på den grå række *Ny opgave*. Menuen har *Opret opgave*, *Tilføj milepæl* og *Indsæt*; i Gantt også *Nulstil zoom* og *Tilpas til projekt*. En ny opgave eller milepæl kommer nederst på listen. I Gantt starter den på den dato, hvor du klikkede; i opgavetabellen åbnes navnecellen med det samme, så du kan skrive.

På gruppeoverskriftens række i Gantt åbner den højre museknap menuen for tom plads. Selve gruppeoverskriften har kun en menu i opgavetabellen. Et højreklik i tidslinjens overskrift gør ikke noget. Kolonneoverskrifterne i opgavetabellen har en egen menu, som beskrives i [Tilpasning af tabelkolonner](docs://howto-tabelkolommen-aanpassen).

**Hvilke opgaver gælder et punkt for?** Du klikker på én opgave, men markeringen bestemmer omfanget. Hvis opgaven, du klikker på, er en del af markeringen, gælder punktet for hele markeringen. Hvis ikke, gælder det kun for den ene opgave. Med et højreklik på en bjælke i Gantt eller på en række i opgavetabellen erstatter den markeringen, hvis opgaven ikke var en del af den. Hvert punkt, der ændrer noget, er ét trin i *Fortryd*, også for hele markeringen.

## Opgavemenuen

Punkterne står i denne rækkefølge. En linje mellem grupper er en skillelinje i menuen.

**Start afhængighed herfra** — kun i Gantt, på en bjælke. Slår afhængighedstilstand til med denne opgave markeret; du trækker derefter til den efterfølgende opgave. Se [Tilføjelse af afhængigheder](docs://howto-relaties-leggen).

**Fjern afbrydelse** og **Fjern alle afbrydelser** — kun i Gantt, på en bjælke med afbrydelser. *Fjern afbrydelse* er kun der, hvis du klikker på en afbrydelse eller på stykket efter den, og afbrydelsen kan redigeres; den fjerner den ene afbrydelse. *Fjern alle afbrydelser* fjerner dem alle, også afbrydelser fra en kildefil, som du ikke kan redigere. Se [Opdele en opgave](docs://howto-taak-splitsen).

**Rediger...** — åbner vinduet *Rediger opgave* for denne opgave. Se [Opgavedialog og egenskabspanel](docs://ref-taak-eigenschappen).

**Indsæt over** og **Indsæt under** — indsætter én ny opgave over den øverste opgave eller under den nederste opgave i omfanget, på samme niveau. Det virker kun i den rene trævisning, uden filter, gruppering eller sortering. Ellers afviser appen det med en besked. Se [Tilføjelse af opgaver og milepæle](docs://howto-taken-en-mijlpalen-toevoegen).

**Tilføj underopgave** — tilføjer en ny opgave som underopgave til den opgave, du klikkede på, nederst blandt dens underopgaver. Kun for den ene opgave, ikke for hele markeringen.

**Tilføj milepæl** — tilføjer en milepæl som underopgave til den opgave, du klikkede på. Kun for den ene opgave.

**Tilføj afhængighed** — gør det samme som *Start afhængighed herfra*: slår afhængighedstilstand til med denne opgave markeret. I opgavetabellen er punktet deaktiveret, hvis Gantt ikke er synlig, med værktøjstippet *Kun tilgængelig, når Gantt-diagrammet er synligt*.

**Indrykke** og **Udrykke** — flytter opgaverne i omfanget et niveau dybere eller et niveau højere i WBS. Disse to er kun i den rene trævisning. Se [Tilpas strukturen](docs://howto-structuur-aanpassen).

**Skift milepæl** — gør opgaven til en milepæl, eller tilbage igen. Den nye tilstand følger af den opgave, du klikkede på, og gælder for hele omfanget. Hvis det er en opgave, bliver alle opgaver i omfanget til milepæle. En hovedopgave og en opgave med tildelinger bliver ikke til milepæl. Resten af omfanget bliver det, og du får en besked for hver årsag.

**Tildel kalender ▸** — en undermenu med *Projektkalender* (opgaven har så ingen egen kalender) og under den de tilgængelige kalendere. Det aktuelle valg har et flueben. En opgave, der allerede står på den kalender, tæller ikke med og giver ikke et ekstra trin i *Fortryd*. Se [Oprette og tildele en kalender](docs://howto-kalender-maken-en-toewijzen).

**Fremdrift ▸** — en undermenu med 0%, 25%, 50%, 75% og 100%. Den aktuelle værdi har et flueben. En hovedopgave har ingen fremdrift af sig selv: har den en i omfanget, får de opgaver i omfanget, der ikke har underopgaver, procentdelen. Uden statusdato sætter appen den til i dag, med en besked. En opgave, der er planlagt til at starte først efter statusdatoen og endnu ingen faktisk start har, fører først til et spørgsmål om den faktiske startdato. Annullerer du det, sker der intet. Se [Opdatere fremdrift](docs://howto-voortgang-bijwerken).

**Prioritet ▸** — en undermenu med *Lav* (100), *Normal* (500) og *Høj* (900), udjævningsprioriteten for opgaven. Den aktuelle værdi har et flueben. Se [Udjævning af ressourcer](docs://uitleg-nivelleren).

**Spor sti** — viser de foregående opgaver og de efterfølgende opgaver for denne opgave. Er sporing allerede slået til, hedder punktet *Stop sporing af sti*. Se [Spore en sti](docs://howto-pad-traceren).

**Fold sammen**, **Fold ud** og **Gem gren som skabelon** — kun for en hovedopgave. *Fold sammen* og *Fold ud* er altid begge der, også hvis opgaven allerede er foldet sammen eller ud, og de gælder for hele omfanget. *Gem gren som skabelon* gemmer opgaven med dens underopgaver og afhængighederne mellem dem som WBS-skabelon. Se [Gemme og indsætte WBS-skabeloner](docs://howto-wbs-sjablonen).

**Slet** — sletter opgaverne i omfanget med deres underopgaver. Der er ingen bekræftelse. Du får dem tilbage med Ctrl+Z, ét trin for hele omfanget. Se [Markere, slette og fortryde opgaver](docs://howto-taken-selecteren-verwijderen).

## Menuen for en gruppeoverskrift

Denne menu findes kun i opgavetabellen, på en gruppeoverskrift:

**Fold gruppe sammen** eller **Fold gruppe ud** — folder kun denne gruppe sammen eller ud. Punktet viser, hvad du kan gøre.

**Fold alle ud** og **Fold alle sammen** — folder alle grupper ud eller sammen på én gang.

Du opsætter grupperingen med et layout. Se [Oprette og bruge et layout](docs://howto-layouts-gebruiken).

## Se også

- [Trække, panorere og zoome i Gantt](docs://howto-gantt-bedienen): hvad træk med venstre og midterste museknap gør.
- [Båndet, fane for fane](docs://ref-lint): de knapper, der har de samme handlinger.
- [Tastaturgenveje](docs://ref-sneltoetsen): de taster, der hører til dem.

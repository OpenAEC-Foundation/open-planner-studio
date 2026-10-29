# Oprette og bruge et layout

Mål: skift med ét klik mellem visninger af din tidsplan, for eksempel kun de kritiske opgaver, opgaverne pr. mandskab eller en anden sorteringsrækkefølge.

## Hvornår du har brug for dette

På byggepladsmødet vil kunden kun se de kritiske opgaver. Derefter vil byggelederen se pr. mandskab, hvem der er nødvendig hvornår. Så vil du have hele tidsplanen igen. Det er besværligt at indstille filtre, grupper og sorteringer igen og igen. Et **layout** gemmer en sådan visning som en knap i båndet.

Et layout kan gemme seks ting: filteret, grupperingen, sorteringen, kolonnerne i opgavetabellen ved siden af Gantt-diagrammet, tidsskalaen og afhængighedslinjerne og overlejringerne (oprindelig plan, fremdriftslinje, linje for statusdato, ressourcefremhævning, slækbånd og farver på bjælkerne). Kun det, du sætter kryds ved, ændres, når du klikker på knappen. Resten af visningen bliver, som den er.

Du filtrerer, grupperer og sorterer med et layout. De aparte knapper *Filtrér…*, *Gruppér…* og *Sortér…* findes nu kun bag en skjult indstilling (se faldgruberne).

## Trin

### Brug af et eksisterende layout

1. Vælg fanen *Visning*. I gruppen *Layout* er der en knap pr. layout. Som standard er det *Ressourcediagram*.
2. Klik på den. *Ressourcediagram* grupperer opgaverne pr. ressource, sorterer inden for hver gruppe efter start og slår afhængighedslinjerne fra. En opgave med to ressourcer vises under begge.
3. Klik igen for at slå layoutet fra. Visningen går tilbage til, hvordan den var før dit klik.

Hvert klik er ét trin for *Fortryd* (Ctrl+Z), både når du slår layoutet til og når du slår det fra.

### Lav dit eget layout

1. Klik på *Opret layout* i gruppen *Layout*. Vinduet *Nyt layout* åbner sig.
2. Skriv et *Navn*, og vælg et *Ikon*.
3. Under *Hvad gemmer dette layout?* står de seks dele, hver med et afkrydsningsfelt. Et nyt vindue starter med alle dele afkrydset og udfyldt med det, der er på din skærm nu. Fjern krydset ved alt, som layoutet ikke må ændre. Vil du kun have et filter, lad så kun *Filtrér* være afkrydset. *Overtag aktuel visning* udfylder alle dele igen med det, der er på din skærm.
4. Stil delene op.
5. Klik på *Gem*.

Layoutet er nu en knap i båndet, men det er ikke anvendt endnu. Klik på knappen for at slå det til.

### Opsætning af filteret

Under *Filtrér* bygger du regler. Klik på *+ regel*, og vælg et *Felt*, en *Operator* og en værdi. Vil du kun have de kritiske opgaver, så vælg feltet *Kritisk*, operatoren *er lig med* og værdien *Ja*. Felterne omfatter *Opgavenavn*, *Start*, *Slutdato*, *Samlet slæk*, *Fremdrift* og *Milepæl*, samt dine egne opgavekoder og felter og *Ressourcer*. Hvilke operatorer du får, afhænger af feltets type: for tekst kan du vælge *indeholder*, for tal og datoer *mellem*.

Hvilke operatorer du får, afhænger af feltets type:

- Tekst (*Opgavenavn*, *WBS*): *er lig med*, *er forskellig fra*, *indeholder*, *begynder med* og *er tom*.
- Tal og dato (*Samlet slæk*, *Start*, *Fremdrift*): *er lig med*, *er forskellig fra*, *mindre end*, *mindre end eller lig med*, *større end*, *større end eller lig med*, *mellem* og *er tom*. Ved *mellem* er der to felter. For et tal står *Fra* og *Til* som hjælpetekst. For en dato er der ingen hjælpetekst: den første dato er start, den anden er slut.
- Ja/nej (*Kritisk*, *Milepæl*, *Næsten kritisk*): *er lig med* og *er forskellig fra*, med værdien *Ja* eller *Nej*.
- Valg (*Arbejdskategori*, en opgavekode): *er lig med*, *er forskellig fra*, *er en af* (med afkrydsningsfelter som værdier) og *er tom*.
- *Ressourcer*: *er en af* og *er tom*.
- *I gang*: kun *mellem*, med to datoer (fra og til).

Med feltet *I gang*, operatoren *mellem* og to datoer får du alle opgaver, der kører på et hvilket som helst tidspunkt i den periode, fx alt, der er aktivt i juni.

Du kombinerer flere regler med listen øverst: *Alle nedenstående (OG)* viser opgaver, der opfylder alle regler, *Et af nedenstående (ELLER)* opgaver, der opfylder mindst én regel. Med *+ gruppe* tilføjer du en undergruppe med sine egne regler.

Filteret ser på selve opgaverne. De faser (hovedopgaver), som en sådan opgave hører under, forbliver synlige i gråt, så du ser, hvor opgaven hører til. Grupperer du også, forsvinder de grå faser.

### Gruppering og sortering

Under *Gruppér* tilføjer du et felt med *+ niveau*. Der er højst to grupperingsniveauer. Uden gruppering ser du WBS-træet. Under *Sortér* tilføjer du et felt med *+ niveau* og vælger *Stigende* eller *Faldende*. Med to niveauer afgør det andet niveau, når værdierne på det første er ens.

### Prøv noget hurtigt uden knap

Klik i vinduet på *Anvend uden at gemme*. De afkrydsede dele bliver vist på skærmen, men der oprettes ingen knap. Det er praktisk til et filter, du kun har brug for én gang. Ctrl+Z fortryder det.

### Ændre, kopiere eller fjerne et layout

Højreklik på knappen for layoutet. Du vælger *Redigér…*, *Dupliker* eller *Slet*. *Slet* spørger først om bekræftelse. En kopi kaldes *navn (kopi)*. Et indbygget layout, fx *Ressourcediagram*, kan du ikke redigere eller slette. Du duplikerer det for at lave din egen version.

### Mere end ét layout ad gangen

Layouts, der ikke gemmer de samme dele, kan være aktive samtidig. Har du et layout, der kun gemmer filteret *Kritisk er lig med Ja* (kald det fx *Kun kritiske*), og slår du det til sammen med *Ressourcediagram* (gruppering, sortering, afhængighedslinjer), får du de kritiske opgaver pr. ressource. Gemmer to layouts den samme del, fx begge et filter, så overtager det andet layout, og det første slås fra. Slår du det andet layout fra igen, går du tilbage til visningen fra før dit første klik, ikke til det første layout.

## Faldgruber, og hvad appen gør

**Du glemmer at fjerne kryds ved dele.** Et layout, der også gemmer kolonnerne, tidsskalaen og overlejringerne, sætter dem tilbage til den gemte stand ved hvert klik. Din zoom springer så væk, selv om du kun ville have et filter. Kontroller i vinduet, at kun de dele, du vil have, er afkrydset.

**En ufuldstændig regel viser intet.** Vælger du ingen værdi for et ja/nej-felt (der står stadig *—*), eller lader du datoerne for *I gang* være tomme, matcher ingen opgave, og listen forbliver tom. Udfyld reglen.

**En manuel ændring slår layoutet fra.** Ændrer du selv en del, som layoutet gemmer, fx *Afhængighedslinjer* mens *Ressourcediagram* er til, så falder layoutet fra, og de andre dele går tilbage til visningen fra før layoutet. Zoomer du, slås et layout fra, der gemmer tidsskalaen. Gør du en kolonne bredere, slås et layout fra, der gemmer kolonnerne. Resten af visningen bliver så, som den er. Ressourcediagram gemmer ikke tidsskalaen, så zoom påvirker det ikke.

**Kolonner gælder for opgavetabellen ved siden af Gantt-diagrammet.** Delen *Kolonner* gemmer kolonnerne i tabellen til venstre for tidslinjen. Tabellen på fanen *Tabel* har sine egne kolonner. Hvordan du vælger kolonner, står i [Tilpasning af tabelkolonner](docs://howto-tabelkolommen-aanpassen).

**Indryk og udryk er slået fra.** Så længe et filter, en gruppering eller en sortering er til, er den viste rækkefølge ikke rækkefølgen i tidsplanen. *Indryk* og *Udryk* er så deaktiveret med hjælpeteksten *Ikke tilgængelig under filtrering/gruppering/sortering*. Slå layoutet fra for at ændre strukturen igen, som beskrevet i [Tilpasning af strukturen](docs://howto-structuur-aanpassen).

**Statuslinjen følger ikke med.** *Opgaver:* i statuslinjen viser antallet af opgaver i hele projektet, også selv om et filter kun viser en del af dem.

**Layouts står på din enhed, ikke i projektet.** Appen gemmer dine layouts og kolonnerne for alle dine projekter på denne enhed. Overlejringerne fra et layout (oprindelig plan, fremdriftslinje og resten) gælder for alle dine projekter. Filteret, grupperingen og sorteringen, der er aktive nu, hører til det åbne projekt, men de gemmes ikke i projektfilen: efter at du har gemt og åbnet projektet igen, er visningen igen uden filter, gruppering og sortering. De gør heller ikke projektet "ændret".

**De aparte knapper er skjult.** *Kolonner…*, *Filtrér…*, *Gruppér…* og *Sortér…* som aparte knapper på fanen *Visning* er en ældre opsætning. Du henter dem frem igen med *Vis klassiske visningsknapper* under *Ældre funktioner* på fanen *Avanceret* i vinduet *App-indstillinger* (⚙ i titellinjen). Brug hellere layouts.

## Se også

- [Tilpasning af tabelkolonner](docs://howto-tabelkolommen-aanpassen): vælge, flytte og fastgøre selve kolonnerne.
- [Oprettelse og udskrivning af en rapport](docs://howto-rapport-maken-en-afdrukken): visningen på papir med *Følg visning*.
- [Tilpasning af strukturen](docs://howto-structuur-aanpassen): hvorfor du ikke kan indrykke under filtrering.

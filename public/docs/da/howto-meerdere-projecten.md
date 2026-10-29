# Arbejd med flere projekter samtidig

Mål: Have mere end én tidsplan åben, skift mellem dem og luk dem hver for sig.

## Hvornår du har brug for det

Du arbejder på boligudviklingen i kvarteret, men byggemødet handler også om renoveringen af klubhuset. Eller du vil beholde en variant ved siden af originalen. Hvert projekt står på sin egen fane, med sine egne opgaver, beregning og tidsvindue. Skift tager ét klik, og du mister intet.

## Trin

### Åbn et andet projekt

1. Klik på plusset til højre for fanerne (*Start et projekt*). Vinduet *Start et projekt* åbner.
2. Vælg *Nyt projekt* for en tom tidsplan, eller *Åbn eksisterende projekt* for at vælge en fil. *Annuller* lukker vinduet.
3. Med *Nyt projekt* udfylder du vinduet *Opret nyt projekt* og klikker på *Opret*.

Projektet vises på sin egen fane og er straks aktivt. *Ny* og *Åbn* i båndet, Ctrl+O og eksemplerne under *Fil › Eksempler* åbner også et projekt på en ny fane. Kun en ny, tom tidsplan, som du endnu ikke har rørt, genbruges i stedet for at tilføje en fane.

### Skift mellem projekter

- Klik på fanen for projektet.
- Tryk på Ctrl+1 til Ctrl+9 (⌘ i stedet for Ctrl på macOS) for projektet på den plads i rækken, talt fra venstre mod højre.
- Klik på menuikonet til venstre for fanerne (*Alle projekter*). Oversigten *Åbne projekter* viser et felt per projekt med navn, filnavn (hvis projektet har en fil), miniature af tidsplanen, antal opgaver, antal kritiske opgaver og slutdato. Klik på et felt for at gå derhen. Esc lukker oversigten.

Hver fane har en farvet prik, som hører til projektet. En fane med en lille prik bagved har ikke-gemte ændringer.

Hvis fanerne ikke alle har plads i bredden, vises to pile mellem fanerne og plusset (*Rul fanerne til starten* og *Rul fanerne til slutningen*). Hvert klik flytter fanerne to. En pil er grå, når du allerede er ved starten eller slutningen. Du kan også rulle med musehjulet over fanerne. Den fane, du vælger, flyttes altid automatisk ind i billedet.

### Luk et projekt

Klik på krydset ved navnet på fanen (*Luk*), eller på krydset på et felt i oversigten. Et projekt uden ændringer lukkes straks. Har det ikke-gemte ændringer, spørger appen *Ikke-gemte ændringer* og tilbyder tre valg:

- *Gem* gemmer projektet og lukker det derefter.
- *Gem ikke* lukker projektet og smider ændringerne væk.
- *Annuller* lader projektet stå åbent.

Annullerer du at gemme, fx ved at lukke dialogen til at gemme, forbliver projektet åbent.

Lukker du det sidste projekt, bliver en tom tidsplan med navnet *Ny tidsplan* tilbage.

### Vælg skiftestil

Fanerne er et valg. Åbn vinduet *App-indstillinger* med tandhjulet i titellinjen, gå til fanen *Udseende* og vælg en stil under *Stil for dokumentskift*:

- *Vandrette faner*: standard. En række faner under båndet.
- *Lodrette faner*: en smal søjle til venstre med en knap per projekt (de første bogstaver af navnet) og et plus. Holder du musen over en knap, ser du navn, filnavn, antal opgaver, antal kritiske opgaver og slutdato. Knappen øverst åbner oversigten.
- *Pille*: én pille i titellinjen med navnet på det aktive projekt og en tæller, fx *2 åbne*. Klik på den for at åbne oversigten og skifte dér.

Alle tre stilarter åbner den samme oversigt, og Ctrl+1 til Ctrl+9 virker i alle stilarter.

## Faldgruber og hvad appen gør

**Hvad hører til projektet, og hvad deles.** Hvert projekt har sin egen visning: zoom og position, et aktivt layout med filter, gruppering eller sortering, opdelt visning, afhængighedslinjerne og de sammenfoldede faser. Skifter du til et andet projekt, ser du dets egen visning dér. Delt mellem alle projekter er den valgte fane i båndet, minikortet, overlejringerne (den oprindelige plan, fremdriftslinjen og resten), dit valg af kolonner, dine layouts og valgene for rapporter.

**Du kan ikke skifte, mens en dialog er åben.** Så længe en dialog er åben, fx vinduet *App-indstillinger* eller et opgavevindue, gør Ctrl+1 til Ctrl+9 intet i appen. I browseren skifter de i stedet browserfaner. Luk dialogen først. En ændring i *Projektindstillinger* i Backstage, som ikke er anvendt, blokerer også skift.

**Ctrl+1 til Ctrl+9 tæller efter rækkefølge.** Genvejen går til projektet på den plads i rækken. Lukker du et projekt, rykker de andre pladser op. Har du mere end ni projekter åbne, kommer du kun til de øvrige via fanerne eller oversigten.

**Beregn og rapporter virker på det aktive projekt.** Beregn (F5), *Eksporter PDF* og rapporterne gælder for det projekt, der er aktivt nu.

## Se også

- [Oprettelse og brug af et layout](docs://howto-layouts-gebruiken): opsætning af en visning for hvert projekt.
- [Lav og udskriv en rapport](docs://howto-rapport-maken-en-afdrukken): rapporten for det aktive projekt.

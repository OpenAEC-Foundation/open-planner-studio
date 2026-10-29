# Tilpas tabelkolonner

Mål: vælg, hvilke kolonner du ser i opgavetabellen, i hvilken rækkefølge og hvor brede de er.

## Hvornår har du brug for dette

På mødet vil du se deadline og samlet slæk ved siden af hver opgave. Pladslederen vil kun have start og slutdato ved siden af navnet. Eller en kolonne er så smal, at overskriften er skåret af. Opgavetabellen består af kolonner, som du selv vælger. Der er dusinvis, fra *Opgavenavn* og *Varighed* til *Deadline*, *Tilladt slæk* og *Tildelte ressourcer*.

Der er to opgavetabeller. Hver har sine egne kolonner:

- **Opgavetabellen ved siden af Gantt-diagrammet** står til venstre for tidslinjen på bl.a. fanerne *Start*, *Tidsplan* og *Visning*. Som standard viser den *WBS*, *Opgavenavn* og *Varighed*, så der er plads tilbage til tidslinjen.
- **Tabellen på fanen Tabel** har hele arbejdsområdet. Som standard har den *WBS*, *Opgavenavn*, *Varighed*, *Start*, *Slutdato*, *Arbejdskategori*, *Kritisk*, *Samlet slæk* og *Fremdrift*, plus en kolonne for hver opgavekode og hvert brugerdefineret felt i projektet.

En ændring i den ene tabel ændrer ikke den anden.

## Trin

### Tilføj en kolonne

1. Klik på plustegnet (**+**) til højre for tabeloverskriften. På fanen *Tabel* kan du også bruge *Tabel › Kolonner › Vælg kolonner…*. Vinduet *Vælg kolonne* åbner.
2. Find kolonnen. Øverst står *Senest brugt*, hvis du har valgt kolonner før. Skriv en del af navnet i *Søg*, for eksempel *dead* for *Deadline*. Eller åbn en kategori: *Opgave*, *Tidsplan*, *Begrænsninger*, *Afhængigheder*, *Ressourcer*, *Fremdrift*, *Beregnet*, *Oprindelig plan*, *Brugerdefineret* eller *Teknisk*.
3. Klik på kolonnen. Den kommer til sidst i tabellen, og vinduet lukkes.

En kolonne, der allerede er i tabellen, er grå, og du kan ikke vælge den.

### Fjern en kolonne

Klik på minustegnet i kolonneoverskriften (*Fjern: Deadline*). Eller højreklik på overskriften og vælg *Fjern: Deadline*. Med Ctrl+Z får du kolonnen tilbage. Eller du vælger den igen med plustegnet.

### Justér bredden

Træk kanten til højre i kolonneoverskriften mod venstre eller højre. Dobbeltklik på kanten, eller vælg *Tilpas automatisk* i menuen for overskriften (højre museknap). Kolonnen bliver så bred nok til indholdet, op til højst 480 pixels. Har kanten fokus, gør piletasterne kolonnen bredere eller smallere trin for trin.

### Fastgør kolonner

Højreklik på overskriften og vælg *Fastgør*. Fastgjorte kolonner springer til forsiden og bliver stående til venstre, når du scroller vandret. Det virker, så længe de samlet ikke er bredere end vinduet. *Løsn* sætter dem tilbage i rækken.

### Ændr rækkefølgen

Træk en kolonneoverskrift til et andet sted. En fastgjort kolonne flytter du blandt de fastgjorte kolonner. En almindelig kolonne flytter du blandt de almindelige kolonner.

### Tilbage til standard

Åbn vinduet *Vælg kolonne* og klik på *Nulstil til standard* nederst. Knappen er grå, hvis kolonnerne allerede er standard. For tabellen på fanen *Tabel* tilføjes desuden en kolonne for hver opgavekode og hvert brugerdefineret felt i projektet, også hvis du har fjernet dem tidligere. Disse kolonner hører til det projekt, hvor koden eller feltet findes. Du kan læse om disse koder og felter i [Opgavekoder og brugerdefinerede felter](docs://howto-codes-en-velden).

## Faldgruber, og hvad appen gør

**Overskriften er skåret af.** En smal kolonne skærer navnet af, for eksempel *Samlet slæk* til *Sam…*. Dobbeltklik på kanten af overskriften for at tilpasse kolonnen.

**Du justerer den forkerte tabel.** Kolonnerne i opgavetabellen ved siden af Gantt-diagrammet og dem på fanen *Tabel* er adskilt. Er du på fanen *Visning* eller *Start*, justerer du tabellen ved siden af Gantt-diagrammet. Plustegnet på fanen *Tabel* justerer den store tabel.

**Et layout sætter kolonner tilbage.** Har et layout delen *Kolonner* afkrydset, sætter et klik på layoutknappen kolonnerne i opgavetabellen ved siden af Gantt-diagrammet tilbage til den gemte stand. Tabellen på fanen *Tabel* bliver ikke ændret. Se [Sådan opretter og bruger du et layout](docs://howto-layouts-gebruiken).

**Kolonnevalget ligger på din enhed, ikke i projektet.** Appen bevarer dit kolonnevalg for alle dine projekter på denne enhed. Det gemmes ikke i projektfilen. Projektet bliver heller ikke markeret som „ændret“. Du kan fortryde hver kolonneændring med *Fortryd* (Ctrl+Z). De trin hedder for eksempel *Tilføj kolonne Deadline* og *Ændr bredde på kolonne Opgavenavn*.

## Se også

- [Sådan opretter og bruger du et layout](docs://howto-layouts-gebruiken): sætter kolonner på en knap sammen med et filter eller sortering.
- [Opgavekoder og brugerdefinerede felter](docs://howto-codes-en-velden): opretter dine egne kolonner, som du kan vælge her.
- [Tabelkolonner](docs://ref-tabelkolommen): alle kolonner og hvad de viser.

# Tilpasse kolonner i tabellen

Mål: velg hvilke kolonner du ser i aktivitetstabellen, i hvilken rekkefølge og hvor brede de skal være.

## Når du trenger dette

I møtet vil du se tidsfristen og totalslakken ved siden av hver aktivitet. Byggelederen vil bare ha start og slutt ved siden av navnet. Eller så er en kolonne så smal at overskriften er avkortet. Aktivitetstabellen består av kolonner du velger selv. Det finnes titalls, fra *Aktivitetsnavn* og *Varighet* til *Tidsfrist*, *Fri slakk* og *Tilordnede ressurser*.

Det finnes to aktivitetstabeller. Hver har sine egne kolonner:

- **Aktivitetstabellen ved siden av Gantt** ligger til venstre for tidslinjen, på blant andre fanene *Hjem*, *Tidsplan* og *Visning*. Som standard har den *WBS*, *Aktivitetsnavn* og *Varighet*, slik at det blir plass igjen til tidslinjen.
- **Tabellen på fanen** *Tabell* tar hele arbeidsområdet. Som standard har den *WBS*, *Aktivitetsnavn*, *Varighet*, *Start*, *Slutt*, *Arbeidskategori*, *Kritisk*, *Totalslakk* og *Fremdrift*, pluss en kolonne per aktivitetskode og egendefinert felt i prosjektet.

En endring i den ene tabellen endrer ikke den andre.

## Steg

### Legge til en kolonne

1. Klikk på plusstegnet (**+**) helt til høyre i tabelloverskriften. På fanen *Tabell* kan du også bruke *Tabell › Kolonner › Velg kolonner…*. Vinduet *Velg kolonne* åpnes.
2. Finn kolonnen. Øverst står *Sist brukt*, hvis du har valgt kolonner før. Skriv en del av navnet i *Søk*, for eksempel *tids* for *Tidsfrist*, eller åpne en kategori: *Aktivitet*, *Tidsplan*, *Begrensninger*, *Avhengigheter*, *Ressurser*, *Fremdrift*, *Beregnet*, *Grunnlinje*, *Egendefinert* eller *Teknisk*.
3. Klikk på kolonnen. Den legges til sist i tabellen, og vinduet lukkes.

En kolonne som allerede er i tabellen, er grå, og du kan ikke velge den.

### Fjerne en kolonne

Klikk på minustegnet i kolonneoverskriften (*Fjern: Tidsfrist*). Eller høyreklikk overskriften og velg *Fjern: Tidsfrist*. Med Ctrl+Z får du kolonnen tilbake. Du kan også velge den igjen med plusset.

### Endre bredden

Dra kanten til høyre i kolonneoverskriften mot venstre eller høyre. Dobbeltklikk på kanten, eller velg *Autotilpass* i menyen til overskriften (høyre museknapp). Kolonnen blir da bred nok for innholdet, opp til maksimalt 480 piksler. Hvis kanten har fokus, gjør piltastene kolonnen bredere eller smalere, trinn for trinn.

### Feste kolonner

Høyreklikk overskriften og velg *Fest*. Festede kolonner flytter først og blir stående til venstre når du blar horisontalt. Det fungerer så lenge de til sammen ikke er bredere enn vinduet. *Løsne* setter dem tilbake i raden.

### Endre rekkefølgen

Dra en kolonneoverskrift til et annet sted. En festet kolonne flytter du blant de festede kolonnene, og en vanlig kolonne blant de vanlige kolonnene.

### Tilbake til standarden

Åpne vinduet *Velg kolonne* og klikk på *Gjenopprett standard* nederst. Knappen er grå hvis kolonnene allerede er standard. For tabellen på fanen *Tabell* legges det i tillegg til en kolonne for hver aktivitetskode og egendefinert felt i prosjektet, også hvis du tidligere har fjernet dem. Disse kolonnene hører til prosjektet der koden eller feltet ligger. Du kan lese om disse kodene og feltene i [Aktivitetskoder og egendefinerte felt](docs://howto-codes-en-velden).

## Fallgruver og hva appen gjør

**Overskriften er avkortet.** En smal kolonne kutter av navnet, for eksempel *Totalslakk* til *Totals…*. Dobbeltklikk på kanten av overskriften for å tilpasse kolonnen.

**Du endrer feil tabell.** Kolonnene i aktivitetstabellen ved siden av Gantt og kolonnene på fanen *Tabell* er adskilt. Er du på fanene *Visning* eller *Hjem*, endrer du tabellen ved siden av Gantt. Plusset på fanen *Tabell* endrer den store tabellen.

**Et oppsett setter kolonnene tilbake.** Hvis et oppsett har delen *Kolonner* avkrysset, setter et klikk på oppsettknappen kolonnene i aktivitetstabellen ved siden av Gantt tilbake til den lagrede tilstanden. Tabellen på fanen *Tabell* blir ikke berørt. Se [Lage og bruke et oppsett](docs://howto-layouts-gebruiken).

**Kolonner ligger på enheten din, ikke i prosjektet.** Appen husker kolonnevalget ditt for alle prosjektene dine på denne enheten. Det lagres ikke i prosjektfilen. Det gjør heller ikke prosjektet «endret». Du kan angre hver kolonneendring med *Angre* (Ctrl+Z). Stegene heter for eksempel *Legg til kolonne Deadline* og *Endre bredde på kolonne Task name*.

## Se også

- [Lage og bruke et oppsett](docs://howto-layouts-gebruiken): kolonner på en knapp sammen med et filter eller sortering.
- [Aktivitetskoder og egendefinerte felt](docs://howto-codes-en-velden): lage egne kolonner som du kan velge her.
- [Tabellkolonner](docs://ref-tabelkolommen): alle kolonner og hva de viser.

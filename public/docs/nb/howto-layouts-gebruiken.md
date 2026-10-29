# Lage og bruke et oppsett

Mål: bytt mellom visninger av tidsplanen med ett klikk, for eksempel bare de kritiske aktivitetene, aktivitetene per mannskap eller en annen sorteringsrekkefølge.

## Når du trenger dette

På byggemøtet vil byggherren bare se de kritiske aktivitetene. Så vil byggelederen se per mannskap hvem som trengs når. Så vil du se hele tidsplanen igjen. Å sette filtre, grupper og sorteringsrekkefølger om og om igjen er tungvint. Et **oppsett** lagrer en slik visning som en knapp i båndet.

Et oppsett kan lagre seks ting: filteret, grupperingen, sorteringen, kolonnene i aktivitetstabellen ved siden av Gantt-diagrammet, tidsskalaen, og avhengighetslinjene og overleggene (grunnlinje, fremdriftslinje, statusdatolinje, ressursuthevning, slakkbånd og stolpefarger). Bare det du har krysset av, endres når du klikker på knappen. Resten av visningen forblir slik den er.

Du filtrerer, grupperer og sorterer med et oppsett. De separate knappene *Filter…*, *Grupper…* og *Sorter…* finnes nå bare bak en skjult innstilling (se fallgruvene).

## Trinn

### Bruke et eksisterende oppsett

1. Velg fanen *Visning*. I gruppen *Oppsett* finnes det én knapp per oppsett. Som standard er det *Ressursdiagram*.
2. Klikk på knappen. *Ressursdiagram* grupperer aktivitetene per ressurs, sorterer innenfor hver gruppe på startdato og slår av avhengighetslinjene. En aktivitet med to ressurser vises under begge.
3. Klikk igjen for å slå av oppsettet. Visningen går tilbake til slik den var før klikket ditt.

Hvert klikk er ett steg for *Angre* (Ctrl+Z), både når du slår på og når du slår av.

### Lage ditt eget oppsett

1. Klikk på *Nytt oppsett* i gruppen *Oppsett*. Vinduet *Nytt oppsett* åpnes.
2. Skriv inn et *Navn* og velg et *Ikon*.
3. Under *Hva lagrer dette oppsettet?* finner du de seks delene, hver med en avkrysningsboks. Et nytt vindu starter med alle delene avkrysset og fylt med det du ser på skjermen nå. Fjern avkrysningen for alt oppsettet ikke skal endre. Vil du bare ha et filter, la bare *Filter* stå avkrysset. *Ta over gjeldende visning* fyller alle delene på nytt med det som vises på skjermen.
4. Still inn delene.
5. Klikk på *Lagre*.

Oppsettet er nå en knapp i båndet, men det er ikke tatt i bruk ennå. Klikk på knappen for å slå oppsettet på.

### Sette opp filteret

Under *Filter* lager du regler. Klikk på *+ regel*, velg et *Felt*, en *Operator* og en verdi. Hvis du bare vil ha de kritiske aktivitetene: felt *Kritisk*, operator *er lik*, verdi *Ja*. Feltene omfatter *Aktivitetsnavn*, *Start*, *Slutt*, *Totalslakk*, *Fremdrift* og *Milepæl*, pluss dine egne aktivitetskoder og felt, og *Ressurser*. Operatorene avhenger av feltets type: for tekst kan du velge *inneholder*, for tall og datoer *mellom*.

Hvilke operatorer du får, avhenger av feltets type:

- Tekst (*Aktivitetsnavn*, *WBS*): *er lik*, *er ikke lik*, *inneholder*, *begynner med* og *er tom*.
- Tall og dato (*Totalslakk*, *Start*, *Fremdrift*): *er lik*, *er ikke lik*, *mindre enn*, *mindre enn eller lik*, *større enn*, *større enn eller lik*, *mellom* og *er tom*. Med *mellom* er det to felt: for et tall med *Fra* og *Til* som hjelpetekst, for en dato uten hjelpetekst (den første datoen er start, den andre er slutt).
- Ja/nei (*Kritisk*, *Milepæl*, *Nesten kritisk*): *er lik* og *er ikke lik*, med verdien *Ja* eller *Nei*.
- Valg (*Arbeidskategori*, en aktivitetskode): *er lik*, *er ikke lik*, *er en av* (med avkrysningsbare verdier) og *er tom*.
- *Ressurser*: *er en av* og *er tom*.
- *Pågår*: bare *mellom*, med to datoer (fra og til).

Med feltet *Pågår*, operatoren *mellom* og to datoer får du alle aktiviteter som pågår på et hvilket som helst tidspunkt i perioden, for eksempel alt som er aktivt i juni.

Du kombinerer flere regler med listen øverst. *Alt nedenfor (OG)* viser aktiviteter som oppfyller alle reglene. *Noe nedenfor (ELLER)* viser aktiviteter som oppfyller minst én regel. Med *+ gruppe* legger du til en undergruppe med egne regler.

Filteret ser på aktivitetene selv. Fasene (hovedaktivitetene) som en slik aktivitet hører under, forblir synlige i grått, så du ser hvor aktiviteten hører hjemme. Grupperer du også, forsvinner de grå fasene.

### Gruppering og sortering

Under *Grupper* legger du til et felt med *+ nivå*. Det finnes høyst to grupperingsnivåer. Uten gruppering ser du WBS-treet. Under *Sorter* legger du til et felt med *+ nivå* og velger *Stigende* eller *Synkende*. Med to nivåer avgjør det andre nivået når verdiene på det første er like.

### Prøve noe raskt uten knapp

Klikk på *Bruk uten å lagre* i vinduet. De avkryssede delene går over på skjermen, men det legges ikke til noen knapp. Det er nyttig for et filter du bare trenger én gang. Ctrl+Z angrer det.

### Endre, kopiere eller fjerne et oppsett

Høyreklikk på oppsettknappen. Du velger *Rediger…*, *Dupliser* eller *Slett*. *Slett* ber først om bekreftelse. En kopi heter *navn (kopi)*. Et innebygd oppsett, for eksempel *Ressursdiagram*, kan du ikke redigere eller slette. Du dupliserer det i stedet, for å lage din egen versjon.

### Mer enn ett oppsett om gangen

Oppsett som ikke lagrer de samme delene, kan være på samtidig. Har du et oppsett som bare lagrer filteret *Kritisk er lik Ja* (kall det for eksempel *Bare kritiske*), og slår det på sammen med *Ressursdiagram* (gruppering, sortering, avhengighetslinjer), får du de kritiske aktivitetene per ressurs. Har to oppsett samme del, for eksempel begge et filter, tar det andre over, og det første slås av. Slår du det andre av igjen, går du tilbake til visningen fra før det første klikket ditt, ikke til det første oppsettet.

## Fallgruver og hva appen gjør

**Du glemmer å fjerne avkrysningen for deler.** Et oppsett som også lagrer kolonnene, tidsskalaen og overleggene, setter dem tilbake til den lagrede tilstanden ved hvert klikk. Zoomen hopper da bort når du bare ville ha et filter. Kontroller i vinduet at bare de tiltenkte delene er avkrysset.

**En ufullstendig regel viser ingenting.** Velger du ingen verdi for et ja/nei-felt (det står fortsatt *—*), eller lar du datoene for *Pågår* stå tomme, passer ingen aktivitet. Da forblir listen tom. Fullfør regelen.

**En manuell endring slår av oppsettet.** Endrer du selv en del som oppsettet lagrer, for eksempel *Avhengighetslinjer* mens *Ressursdiagram* er på, faller det oppsettet ut. De andre delene går da tilbake til visningen fra før oppsettet. Zoom slår av et oppsett som lagrer tidsskalaen. Å gjøre en kolonne bredere slår av et oppsett som lagrer kolonnene. Resten av visningen forblir slik den er. Oppsettet *Ressursdiagram* lagrer ikke tidsskalaen, så zoom påvirker det ikke.

**Kolonner gjelder for aktivitetstabellen ved siden av Gantt.** Delen *Kolonner* lagrer kolonnene i tabellen til venstre for tidslinjen. Tabellen på fanen *Tabell* beholder sine egne kolonner. Hvordan du velger kolonner, står i [Tilpasse tabellkolonner](docs://howto-tabelkolommen-aanpassen).

**Rykke inn og redusere innrykk er av.** Så lenge et filter, en gruppering eller en sortering er på, er visningsrekkefølgen ikke rekkefølgen i tidsplanen. *Rykk inn* og *Reduser innrykk* er da deaktivert, med verktipset *Ikke tilgjengelig under filtrering/gruppering/sortering*. Slå av oppsettet for å endre strukturen igjen, slik som beskrevet i [Tilpasse strukturen](docs://howto-structuur-aanpassen).

**Statuslinjen følger ikke med.** *Aktiviteter:* i statuslinjen viser antallet aktiviteter i hele prosjektet, selv om et filter bare viser en del av dem.

**Oppsett ligger på enheten din, ikke i prosjektet.** Appen lagrer oppsettene og kolonnene dine for alle prosjektene dine på denne enheten. Overleggene fra et oppsett (grunnlinje, fremdriftslinje og resten) gjelder for alle prosjektene dine. Filteret, grupperingen og sorteringen som er på nå, hører til det åpne prosjektet. Men de havner ikke i prosjektfilen: etter lagring og ny åpning er visningen ren igjen. De gjør heller ikke prosjektet «endret».

**De separate knappene er skjult.** *Kolonner…*, *Filter…*, *Grupper…* og *Sorter…* som egne knapper på fanen *Visning* hører til en eldre visning. Du viser dem igjen med *Vis klassiske visningsknapper* under *Eldre funksjoner* på fanen *Avansert* i vinduet *Appinnstillinger* (⚙ i tittellinjen). Bruk helst oppsett.

## Se også

- [Tilpasse tabellkolonner](docs://howto-tabelkolommen-aanpassen): velge, flytte og feste kolonnene selv.
- [Lage og skrive ut en rapport](docs://howto-rapport-maken-en-afdrukken): sette visningen på papir med *Følg visning*.
- [Tilpasse strukturen](docs://howto-structuur-aanpassen): hvorfor du ikke kan rykke inn under filtrering.

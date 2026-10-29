# Flytte et prosjekt

Mål: flytt hele tidsplanen til en ny startdato, og se på forhånd hva det gjør med slutten.

## Når du trenger dette

Starten på arbeidet flytter seg: tillatelsen kommer senere, eller du gjenbruker tidsplanen fra et tidligere hus for det neste. Det er mye arbeid å flytte alle aktiviteter én for én. Med **Flytt prosjekt** skriver du inn én ny startdato, og appen flytter alt med.

Prosjektslutten flytter ikke alltid med like mange dager som starten. Kalenderen flytter ikke med: helligdager, byggferie og vinterstopp ligger på faste datoer. Et eksempel: med *Hjem › Fil › Ny* oppretter du et prosjekt med *Startdato* 29-09-2026, *Land* på *Nederland* og *Byggferie* på *Ingen*. Der legger du inn en tidsplan på 30 arbeidsdager som slutter 9. november 2026. Flytter du den til 14. desember 2026, 76 kalenderdager senere, slutter den 26. januar 2027. Det er 78 dager senere, fordi 25. desember og 1. januar nå er fridager i tidsplanen din. Varigheten er fortsatt 30 arbeidsdager. Forhåndsvisningen i vinduet viser dette før du endrer noe.

## Steg

1. Velg *Tidsplan › Tidsplan › Flytt prosjekt…*. Knappen er inaktiv så lenge prosjektet ikke har en startdato.
2. Under *Gjeldende prosjektstart* ser du hvor prosjektet starter nå. Under *Ny prosjektstart* velger du den nye datoen.
3. Har prosjektet grunnlinjer, vises boksen *Flytt grunnlinjer med*. La den stå av hvis du vil se forskyvningen som avvik (se fallgruvene).
4. Klikk på *Beregn forhåndsvisning*. Appen beregner den forskjøvede tidsplanen helt, uten å endre noe i prosjektet ditt.
5. Se på forhåndsvisningen (se nedenfor). Er den riktig, klikker du på *Flytt*.

I forhåndsvisningen ser du:

- forskyvningen i kalenderdager (*Forskyvning: 76 kalenderdager senere*);
- *Prosjektstart* og *Prosjektslutt*, fra før til etter;
- en rød advarsel hvis kalenderen virker inn, eller meldingen om at prosjektets varighet ikke endrer seg;
- antall flyttede aktiviteter og hva ellers som flytter seg med;
- advarsler du bør lese (se fallgruvene).

Appen beregner den nye tidsplanen med en gang, så du trenger ikke å bruke **Beregn** (F5). Den tilpasser visningen til hele prosjektet. Hele handlingen er ett steg for *Angre* (Ctrl+Z).

Knappen *Flytt* virker bare etter en forhåndsvisning uten feil, og hvis den nye datoen er en annen enn den nåværende. Endrer du datoen eller boksen, forsvinner forhåndsvisningen, og du beregner på nytt.

### Hva som flytter seg med, og hva som ikke gjør det

Dette flytter seg med: start og slutt for hver aktivitet, faktisk start og faktisk slutt, datoene for begrensninger (også for en hard Mandatory-festing, se [Begrensninger og tidsfrister](docs://uitleg-constraints)), tidsfrister, statusdatoen, ankrene for koblinger mellom prosjekter og tilgjengelighetstrinnene til ressursene. Prosjektstarten flytter seg. Det samme gjelder prosjektslutten, hvis du har fylt den ut.

Dette flytter seg ikke:

- kalenderne, altså helligdager, byggferie og vinterstopp;
- grunnlinjer, med mindre du slår på *Flytt grunnlinjer med*;
- et utfylt egendefinert felt av typen *Dato*.

## Fallgruver og hva appen gjør

**Slutten flytter seg et annet antall dager.** Ser forhåndsvisningen at slutten flytter seg med flere eller færre kalenderdager enn starten, eller at prosjektets varighet i arbeidsdager endrer seg, viser den en rød advarsel med tallene. Du kan da fortsatt avbryte.

**Grunnlinjene blir stående.** En grunnlinje finnes for å måle avvik. Flytter du prosjektet med boksen av, ser du forskyvningen som avvik fra grunnlinjen. Slår du boksen på, flytter grunnlinjene seg med tidsplanen. Bare datoene deres flytter seg; datoen da grunnlinjen ble lagret, gjør ikke det.

**Et prosjekt som pågår.** Faktiske datoer flytter seg med. I et prosjekt der du allerede har lagt inn fremdrift, er det ikke alltid det du vil. Appen gir en advarsel: *Kontroller om dette er riktig for et prosjekt som pågår.*

**Koblinger mellom prosjekter.** Ankeret i ditt eget prosjekt flytter seg med, kildeprosjektet gjør det ikke. Oppdater koblingene etter flyttingen med *Hjem › Aktiviteter › Koble ▾ › Oppdater alle koblinger mellom prosjekter*. Se [Koblinger til et annet prosjekt](docs://howto-externe-relaties).

**Helligdager som ikke rekker langt nok.** En kalender med genererte helligdager dekker et antall år. Går den forskjøvede tidsplanen forbi det, beregner appen det året uten helligdager. Forhåndsvisningen advarer om det, for eksempel: *De genererte helligdagene i kalenderen «Bouwkalender NL» dekker 2025–2029; den forskjøvede tidsplanen går til 2030. Generer helligdagene på nytt.* Flytt prosjektet først. Åpne så *Tidsplan › Kalender › Kalender*: ved siden av helligdagene står det nå *Generer på nytt*. Bekreft med *Bruk*, og appen omberegner. Intervallet for de nye helligdagene følger prosjektdatoene, så å generere på nytt før flyttingen hjelper ikke.

**Datoen er i fortiden.** Det er tillatt, men forhåndsvisningen nevner det: *Den nye startdatoen ligger i fortiden.*

**Å endre prosjektstarten i Prosjektinnstillinger er noe annet.** Endrer du startdatoen i *Innstillinger › Prosjekt › Prosjektinnstillinger* og velger *Bruk*, flytter ikke tidsplanen seg. Bare aktiviteter uten forgjenger eller begrensning som da ville ligge før den nye starten, flytter seg til den datoen, og appen sier hvor mange det er. Vil du flytte alt, bruk *Flytt prosjekt…*.

## Se også

- [Kritisk linje og slakk](docs://uitleg-kritiek-pad): hvordan tidsplanen beregnes, og hvorfor slutten flytter seg.
- [Legge til avhengigheter](docs://howto-relaties-leggen): avhengigheter blir bare stående når du flytter.
- [Nytt prosjekt og Prosjektinnstillinger](docs://ref-projectinfo): hva startdatoen i Prosjektinnstillinger gjør.

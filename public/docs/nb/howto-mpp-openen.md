# Åpne en MS Project-fil (.mpp)

Mål: åpne en tidsplan fra Microsoft Project direkte i appen, uten å eksportere den først.

## Når du trenger dette

En entreprenør, konsulent eller kunde sender deg tidsplanen sin som en `.mpp`-fil. Du vil se den, beregne den eller videreutvikle den. Appen leser `.mpp`-filer fra MS Project 2010 til og med 2021. Den leser bare: den skriver ikke `.mpp` og endrer aldri filen din. Fra filen henter den selve tidsplanen: aktiviteter med struktur, varighet og begrensninger, avhengigheter med forsinkelse, kalendere, ressurser, tilordninger og fremdrift. Den leser også datoene og slakken som MS Project selv har beregnet, men den bruker dem bare for visningen *Datoer slik de står i filen*, aldri som input.

## Steg

1. Velg *Hjem › Fil › Åpne* eller trykk Ctrl+O. Velg `.mpp`-filen.
2. Prosjektet åpnes i en ny fane, eller i den gjeldende fanen hvis den fortsatt er tom og uendret. Prosjektet har ingen fil: *Lagre* skriver senere en ny IFC-fil. Et vindu forklarer så kort hva appen har overtatt fra filen, og hvordan lagring fungerer. Se [Åpne og lagre en fil](docs://howto-bestand-openen-en-opslaan).
3. Les meldingen nederst: *Dette prosjektet beregner som Microsoft Project. Endre det via Fil → «Prosjektinfo» → «Beregningsprofil og beregningsalternativer».* Appen beregner dette prosjektet med beregningsreglene til MS Project: beregningsprofilen *Microsoft Project*. Med *Åpne beregningsprofil* går du til innstillingen. *Les mer* åpner hjelpen om beregningsprofiler.
4. Kontroller om det vises en meldingslinje under båndet: *Du ser datoene slik de står i filen. Ved omberegning avviker 4 aktiviteter.* Da avviker resultatet i appen for disse aktivitetene fra datoene som MS Project lagret. Under meldingen fra steg 3 står det da også en linje: *4 aktiviteter viser datoene slik de står i filen (ikke omberegnet).* Hva det betyr, og hvordan du bytter til appens egen beregning, står i [Datoer slik de står i filen](docs://uitleg-datums-zoals-opgeslagen).
5. Hvis det står *Denne filen inneholder timeplanlegging.* med knappen *Slå på timeplanlegging*, inneholder filen data i timer. Se [Slik slår du på timeplanlegging](docs://howto-urenplanning-aanzetten).

Hvis filen inneholder aktiviteter med delt, utjevnet eller ressursdrevet tidsplan, vises en annen melding, for eksempel *Denne MS Project-filen inneholder 3 aktiviteter med en delt, utjevnet eller ressursdrevet tidsplan. De leses inn og vises slik.* Gjelder det én aktivitet, står meldingen i entall.

## Fallgruver og hva appen gjør da

**Ikke alt følger med.** Etter åpningen forteller appen deg i én melding hva den ikke har overtatt: *Ikke alt fra denne MS Project-filen er overtatt.* Under den står det én linje per post, med antallet, for eksempel *2 grunnlinjer er ikke overtatt.* For en `.mpp` er setningen om beregningsprofilen fra steg 3 da den første linjen i denne meldingen. Meldingen blir stående til du klikker på krysset. Hvis ingenting går tapt, får du ikke denne meldingen. En linje kan gjelde:

- innsatte prosjekter (delprosjekter): appen leser dem som en vanlig aktivitet, uten koblingen til den andre filen;
- eksterne aktiviteter fra et annet prosjekt: appen leser dem som en vanlig aktivitet;
- grunnlinjer: fra en `.mpp` overtar appen ingen grunnlinje. Fra MS Project-XML overtar appen bare grunnlinje 0 for aktiviteter, og av den bare datoene og varigheten (for en aktivitet i timer også tidspunktet). Ikke arbeid og kostnad, og ingen grunnlinjer for ressurser og tilordninger;
- med MS Project-XML: en tilordning der grunnlinjen har andre datoer enn aktiviteten. Appen beholder bare grunnlinjen for aktiviteten. Er datoene like, går ingenting tapt, og appen melder ingenting. Et annet tidspunkt samme dag regnes også som en forskjell;
- egendefinerte felt med verdier, for eksempel selve feltene, verdier fra en oppslagstabell og gliederkoder (appen teller ikke ja/nei-felt i en `.mpp`);
- notater (også et notat med bare et bilde) på ressurser og tilordninger, og fra en `.mpp` også på aktiviteter. Fra MS Project-XML følger notatet på en aktivitet med som beskrivelsen;
- hyperkoblinger;
- de faste kostnadene for aktiviteter;
- standardsatsene for ressurser: fra en `.mpp` overtas ingen sats i det hele tatt, fra MS Project-XML bare standardsatsen;
- bare med MS Project-XML: manuelt planlagte aktiviteter (appen planlegger dem automatisk), inaktive aktiviteter (de tas med i beregningen) og utjevningsforsinkelsen;
- bare med en `.mpp`: den kritiske terskelverdien fra MS Project. Appen bruker terskelverdi 0.

En WBS-kode som du selv har fylt ut i MS Project, overtas. Ellers nummererer appen aktivitetene etter strukturen.

**En fil fra MS Project 2007 eller eldre.** Appen avviser filen og melder: *Denne .mpp-filen bruker et eldre format (Project 2007 eller eldre). Eksporter den fra MS Project som XML (Fil → Lagre som → XML), og åpne den filen.* Under meldingen legger appen til en teknisk årsak på engelsk.

**En fil med passord.** Appen melder: *Denne .mpp-filen er beskyttet med et passord. Eksporter den fra MS Project som XML (Fil → Lagre som → XML), og åpne den filen.* Også her følger meldingen med en teknisk årsak på engelsk.

**En fil som viser seg ikke å være en `.mpp`.** Du ser *Kunne ikke åpne fil*, med en teknisk årsak.

**XML-veien beregner annerledes.** Hvis du åpner XML-eksporten fra MS Project i stedet for `.mpp`, beregner appen med beregningsprofilen *Open Planner Studio*, og du ser ikke meldingen om *Microsoft Project*. Datoene kan da bli annerledes enn med `.mpp`-filen. Også med XML-eksporten forteller appen deg hva den ikke har overtatt. Se *Ikke alt følger med*.

**En redigering gir slipp på styringen fra MS Project.** Hvis du redigerer en aktivitet der tidsplanen var styrt av datovinduet i MS Project, melder appen én gang per prosjekt: *Datovinduet fra MS Project styrer ikke lenger 2 aktiviteter etter denne redigeringen; timefordelingen gjelder fortsatt og er bevart i filen.* Gjelder det én aktivitet, står meldingen i entall.

**Å lagre overskriver aldri `.mpp`-filen din.** Prosjektet har ingen fil. *Lagre* spør hvor den nye IFC-filen skal lagres.

## Se også

- [Filer og formater](docs://uitleg-bestanden): hvorfor en `.mpp` bare leses, og hva lagring skriver.
- [Datoer slik de står i filen](docs://uitleg-datums-zoals-opgeslagen): visningen av datoene som MS Project selv har.
- [Slik slår du på timeplanlegging](docs://howto-urenplanning-aanzetten): hvis filen inneholder data i timer.
- [Åpne en Primavera P6-fil (.xer)](docs://howto-xer-openen): det samme gjelder for Primavera.
- [Formater for import og eksport](docs://ref-import-exportformaten): per format hva som følger med, og hva som ikke gjør det.
- [Beregningsprofiler og beregningsregler](docs://uitleg-rekenprofielen): hvorfor en MS Project-fil åpnes med sin egen beregningsprofil.

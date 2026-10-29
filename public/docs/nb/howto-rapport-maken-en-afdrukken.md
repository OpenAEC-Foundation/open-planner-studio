# Lage og skrive ut en rapport

Mål: velg en rapport av tidsplanen din, kontroller den i forhåndsvisningen og lagre den som PDF, slik at du kan dele den ut eller skrive den ut selv.

## Når du trenger dette

Fredag er byggemøtet. Oppdragsgiveren vil ha tidsplanen på papir, byggelederen vil vite hva som starter de kommende ukene, og formannen vil ha et ark med bare hans egne aktiviteter. Du lager oversikter som disse på fanen *Rapport*. Appen beregner dem fra tidsplanen din og viser dem først som en forhåndsvisning. Deretter eksporterer du dem til PDF.

Appen sender ikke selv en rapport til en skriver. Sluttresultatet er alltid en PDF. Den skriver du ut med PDF-leseren din, eller sender den som e-post.

## Trinn

### 1. Åpne fanen Rapport

Velg *Rapport* i båndet, eller trykk Ctrl+P. Ctrl+P tar deg til denne fanen. Skriver du i et felt, er en dialog åpen, eller presentasjonsmodus er på, fungerer ikke Ctrl+P. I nettleseren åpnes da utskriftsdialogen til nettleseren, og den skriver ut skjermen, ikke rapporten.

Til venstre er kolonnen *Rapport* med listen *Rapporttype*, en oppsummering og innstillingene. Til høyre er forhåndsvisningen.

### 2. Velg rapporttype

Listen *Rapporttype* har elleve rapporter. Velg den som passer til spørsmålet ditt.

- *Gantt-utskrift*: tidsplanen som et stolpediagram, for den vanlige tidsplanen du deler ut.
- *Ressursdiagram*: de samme stolpene, men med en rad per ressurs. For spørsmålet «hva gjør mannskap X?», eventuelt med ett ark per mannskap.
- *Milepælsoversikt*: alle milepæler med dato og status.
- *Avvik*: den nåværende tidsplanen ved siden av den aktive grunnlinjen. For spørsmålet «hvor mye er vi forsinket?».
- *Look-ahead*: det som pågår eller starter i den kommende perioden. Listen for ukemøtet.
- *Kritisk & nesten kritisk*: aktivitetene uten eller nesten uten slakk.
- *Fremdriftsrapport*: hvor prosjektet står på statusdatoen, dagen du måler fremdriften på.
- *Tidsplanhelse*: en kontroll av tidsplanen selv for feil og uvanlige verdier.
- *Ressursbelastning*: per ressurs per uke eller måned, hva som kreves mot hva som er tilgjengelig.
- *Ressurstilordninger*: per ressurs, aktivitetene den er tilordnet.
- *WBS-oppsummering*: tidsplanen samlet per WBS-nivå, for ledelsen.

### 3. Kontroller at tidsplanen er oppdatert

Appen beregner ikke av seg selv. Hvis du har endret aktiviteter, avhengigheter eller kalendere siden forrige beregning, trykk **Beregn** (F5). Tabellrapportene varsler deg selv, øverst i rapporten: *Tidsplanen er endret siden den sist ble beregnet. Trykk Beregn (F5) for oppdaterte verdier*. Eller, hvis den aldri er beregnet: *Ikke beregnet ennå — trykk Beregn (F5) for datoer og slakk*.

Båndet på fanen Rapport har ingen Beregn-knapp, men F5 fungerer like fint her. *Eksporter PDF* beregner også selv først hvis tidsplanen er utdatert, slik at PDF-filen aldri henger etter tidsplanen din.

### 4. Juster rapporten

Under *Innstillinger* finner du valgene for Gantt-diagrammet og ressursdiagrammet. *Look-ahead*, *Kritisk & nesten kritisk*, *Fremdriftsrapport*, *Tidsplanhelse*, *Ressursbelastning*, *Ressurstilordninger* og *WBS-oppsummering* har bare *Papir:* og *Retning:*, pluss en blokk *Rapportalternativer* med valgene for den rapporten. *Milepælsoversikt* og *Avvik* har ingen egne valg. Om perioden for en rapport, se [Velge rapporteringsperiode](docs://howto-rapportageperiode-kiezen).

- *Papir:* og *Retning:* bestemmer arket. Som standard er dette A3 liggende, som er nyttig for en byggetidsplan, men ikke alle skrivere skriver ut A3. Har du en A4-skriver, velg A4 nå: appen legger da sidene ut for A4, i stedet for at du må forminske dem etterpå.
- Med ressursdiagrammet gir avkrysningsboksen *Hver ressurs på en ny side* ett ark per mannskap.
- *Skriftstørrelse:* (90 % til 125 %) gjør tekst og tabell større eller mindre. En større skrift gir mindre plass til tidslinjen.
- *Følg visning (filter, gruppering, sortering)* vises bare for Gantt-diagrammet. Som standard går hele aktivitetstreet på papir. Med denne avkrysningsboksen tegner rapporten nøyaktig de radene du ser på skjermen, også sammenklappede faser, for eksempel bare de kritiske aktivitetene fra et oppsett. Hvordan du lager en slik visning, står i [Lage og bruke et oppsett](docs://howto-layouts-gebruiken).
- *Vis grunnlinjeoverlegg* viser den aktive grunnlinjen ved siden av de gjeldende stolpene. Med *Statuslinje:* velger du en *Statusdatolinje* eller en *Fremdriftslinje*.
- *Autotilpass på papir* er som standard på: tidslinjen skaleres da til sidebredden, og antall sider følger av høyden. Slår du den av, bruker rapporten en fast zoom og fliser også over bredden, noe som raskt gir mange sider. Med *Tidslinje over:* fordeler du tidslinjen over 2 til 8 sider i bredden, med autotilpassing, for en lang tidsplan du vil skrive ut i en lesbar størrelse.

### 5. Kontroller forhåndsvisningen

For Gantt-diagrammet og ressursdiagrammet ser du papiret med sidehodet, tabellen, tidslinjen og forklaringen. Bla gjennom sidene for å se på dem. *Forhåndsvisningskvalitet* bestemmer bare hvor skarp forhåndsvisningen er på skjermen. PDF-filen endres ikke av den. Står det under sidene *… og 1 side til — eksporter for hele dokumentet* (med flere sider *… og 2 sider til — eksporter for hele dokumentet*), er ikke alle sidene klare i forhåndsvisningen. PDF-filen inneholder dem alle.

De andre rapportene vises på skjermen som tabell. Det du ser, er det som havner i PDF-filen.

### 6. Eksporter til PDF

Klikk nederst i venstre kolonne på **Eksporter PDF**. Det foreslåtte filnavnet er prosjektnavnet etterfulgt av rapporttypen, for Gantt-diagrammet for eksempel *Extension house-planning.pdf*.

- I skrivebordsappen, og i en nettleser som har en lagre-dialog for filer, velger du hvor PDF-filen skal lagres. Lukker du den dialogen uten å lagre, skjer det ingenting.
- I en nettleser uten en slik dialog legger nettleseren PDF-filen i nedlastingsmappen din.

### 7. Skriv ut PDF-filen

Åpne PDF-filen i PDF-leseren din, og skriv den ut der. Skriver du ut en A3-PDF på en A4-skriver, må utskriftsdialogen forminske sidene. Angi derfor papirstørrelsen først i trinn 4.

## Fallgruver og hva appen gjør

**Knappen Skriv ut og Ctrl+P skriver ikke ut.** Knappen *Skriv ut* i gruppen *Rapport* ligger på selve fanen Rapport, og gjør ikke noe mer. Ctrl+P tar deg til denne fanen. Appen har ingen egen utskriftskommando: veien til papir går via PDF-filen. Fungerer Ctrl+P ikke (se trinn 1), åpnes utskriftsdialogen i nettleseren, og den skriver ut skjermen, ikke rapporten.

**Selskap: overskriving blir ikke lagret.** Feltet *Selskap:* i Gantt-diagrammet begynner med selskapet fra prosjektinnstillingene. Det du skriver over det, blir ikke lagret. Du kan ikke skrive i *Forfatter:* her. Du endrer begge med *Innstillinger › Prosjekt › Prosjektinnstillinger*, i feltene *Oppdragsgiver/organisasjon* og *Forfatter*, og bekrefter med *Bruk*.

**Stolpefarger: gjelder også skjermen din.** Valget *Stolpefarger:* i rapporten er samme valg som *Stolpefarger* på fanen Vis. Endrer du det i rapporten, endrer Gantt-diagrammet på skjermen seg med det.

**Avvik uten grunnlinje.** En grunnlinje er et lagret øyeblikksbilde av tidsplanen din, som du senere måler mot. Hvordan du lagrer en, står i [Lagre og administrere en grunnlinje](docs://howto-baseline-opslaan-en-beheren). Har du ingen aktiv grunnlinje, står det i stedet for en sammenligning *Ingen aktiv grunnlinje — lagre en grunnlinje, eller velg en som aktiv*.

**Statuslinje uten statusdato.** Velger du en *Statuslinje:* mens prosjektet ikke har en statusdato, varsler rapporten med *Angi først en statusdato*, og den tegner ingenting. Du angir statusdatoen under *Tidsplan › Grunnlinjer og fremdrift › Statusdato*.

**Tidsplanen inneholder en løkke.** Inneholder tidsplanen en løkke, lager *Eksporter PDF* ingen fil og viser feilen.

**Papir gjelder for øyeblikket for alle rapporter.** Det finnes ett valg for *Papir:* og *Retning:*, som deles av alle rapporter. *Milepælsoversikt* og *Avvik* har ikke et eget papirvalg: de bruker det du har angitt i en annen rapport, og som standard er det A3 liggende. Velg derfor papiret først i en rapport som har det, for eksempel Gantt-diagrammet, og gå så tilbake.

**Innstillingene gjelder for alle prosjekter.** Papir, skriftstørrelse, periode og de andre valgene huskes av appen på denne enheten, for alle prosjektene dine. De hører ikke til prosjektfilen.

## Se også

- [Velge rapporteringsperiode](docs://howto-rapportageperiode-kiezen): en look-ahead- eller fremdriftsrapport over en bestemt periode.
- [Lage og bruke et oppsett](docs://howto-layouts-gebruiken): filtrer eller grupper først, og skriv så ut med *Følg visning*.
- [Lagre og administrere en grunnlinje](docs://howto-baseline-opslaan-en-beheren): øyeblikksbildet som *Avvik* sammenligner med.
- [Løse overallokering](docs://howto-overbezetting-oplossen): hva du gjør når *Ressursbelastning* viser overbelastede uker.
- [Kritisk linje og slakk](docs://uitleg-kritiek-pad): hvorfor en aktivitet er kritisk eller nesten kritisk.
- [Rapporttyper](docs://ref-rapporttypes): alle rapporttyper og deres valg.

# Lav og udskriv en rapport

Formål: vælg en rapport over din tidsplan, kontroller den i forhåndsvisningen og gem den som PDF, så du kan uddele den eller selv udskrive den.

## Hvornår du har brug for dette

Fredag er byggemødet. Bygherren vil have tidsplanen på papir, byggelederen vil vide, hvad der starter de næste uger, og formanden vil have et ark med kun sine egne opgaver. Du laver oversigter som disse på fanen *Rapport*. Appen beregner dem ud fra din tidsplan og viser dem først som forhåndsvisning. Derefter eksporterer du dem til en PDF-fil.

Appen sender ikke selv en rapport til en printer. Slutpunktet er altid en PDF-fil. Du udskriver den med din PDF-læser, eller du sender den som e-mail.

## Trin

### 1. Åbn fanen Rapport

Vælg *Rapport* i båndet, eller tryk på Ctrl+P. Ctrl+P åbner denne fane. Hvis du skriver i et felt, et dialogvindue er åbent, eller præsentationstilstand er slået til, virker Ctrl+P ikke. I browseren åbnes så browserens udskriftsdialog, og den udskriver skærmen, ikke rapporten.

Til venstre står kolonnen *Rapport* med listen *Rapporttype*, en opsummering og indstillingerne. Til højre står forhåndsvisningen.

### 2. Vælg rapporttypen

Listen *Rapporttype* har elleve rapporter. Vælg den, der passer til dit spørgsmål.

- *Gantt-udskrift*: tidsplanen som bjælkediagram, til den almindelige tidsplan til udlevering.
- *Ressourcediagram*: de samme bjælker, men med en række pr. ressource. Til spørgsmålet "Hvad laver mandskab X?" kan du, hvis du vil, få et ark pr. mandskab.
- *Milepælsoversigt*: alle milepæle med dato og status.
- *Afvigelse*: den aktuelle tidsplan ved siden af den aktive oprindelige plan. Til spørgsmålet om, hvor langt vi er kommet bagud.
- *Look-ahead*: hvad der kører eller starter i den kommende periode. Listen til ugemødet.
- *Kritisk & næsten kritisk*: opgaverne uden eller med næsten ingen slæk.
- *Fremdriftsrapport*: hvor projektet står på statusdatoen, den dag du måler fremdriften.
- *Tidsplansundhed*: en kontrol af selve tidsplanen for fejl og usædvanlige værdier.
- *Ressourcebelastning*: pr. ressource pr. uge eller måned, hvad der kræves mod hvad der er til rådighed.
- *Ressourcetildelinger*: pr. ressource, de opgaver den er tildelt.
- *WBS-hovedopgaver*: tidsplanen opsummeret pr. WBS-niveau, til ledelsen.

### 3. Kontroller at tidsplanen er opdateret

Appen beregner ikke af sig selv. Hvis du har ændret opgaver, afhængigheder eller kalendere siden sidste beregning, tryk på **Beregn** (F5). Tabelrapporterne advarer dig selv, øverst i rapporten: *Tidsplanen er ændret siden sidste beregning — tryk på Beregn (F5) for aktuelle værdier.* Eller, hvis den aldrig er beregnet: *Endnu ikke beregnet — tryk på Beregn (F5) for datoer og slæk.*

Båndet på fanen Rapport har ingen knap Beregn, men F5 virker fint her. *Eksporter PDF* beregner også selv først, hvis tidsplanen er forældet, så PDF-filen aldrig halter bagefter din tidsplan.

### 4. Tilpas rapporten

Under *Indstillinger* står valgmulighederne for Gantt-udskrift og Ressourcediagram. Look-ahead, Kritisk & næsten kritisk, Fremdriftsrapport, Tidsplansundhed, Ressourcebelastning, Ressourcetildelinger og WBS-hovedopgaver har kun *Papir:* og *Retning:*, plus en blok *Rapportindstillinger* med valgmulighederne for den rapport. Milepælsoversigt og Afvigelse har ingen egne valgmuligheder. Om perioden for en rapport, se [Valg af rapporteringsperiode](docs://howto-rapportageperiode-kiezen).

- *Papir:* og *Retning:* bepaler arket. Som standard er det A3 liggende, hvilket er praktisk til en byggetidsplan, men ikke alle printere udskriver A3. Har du en A4-printer, så vælg A4 nu. Appen indretter så siderne til A4, i stedet for at du senere skal formindske dem.
- Med Ressourcediagram giver afkrydsningsfeltet *Hver ressource på en ny side* et ark pr. mandskab.
- *Skriftstørrelse:* (90% til 125%) gør tekst og tabel større eller mindre. En større skrift giver mindre plads til tidslinjen.
- *Følg visning (filter, gruppering, sortering)* vises kun for Gantt-udskrift. Som standard går hele opgavetræet på papir. Med dette afkrydsningsfelt tegner rapporten præcis de rækker, du ser på skærmen, inklusive sammenklappede faser, for eksempel kun de kritiske opgaver fra et layout. Sådan laver du en sådan visning, står i [Opret og brug et layout](docs://howto-layouts-gebruiken).
- *Vis overlay for oprindelig plan* viser den aktive oprindelige plan ved siden af de aktuelle bjælker. Med *Statuslinje:* vælger du en *Statusdatolinje* eller en *Fremdriftslinje*.
- *Tilpas automatisk til papir* er som standard slået til. Tidslinjen skaleres så til sidens bredde, og antallet sider følger af højden. Slår du det fra, bruger rapporten en fast zoom og fordeler sig også over bredden. Det giver hurtigt mange sider. Med *Tidslinje over:* fordeler du tidslinjen over 2 til 8 sider i bredden, med automatisk tilpasning, til en lang tidsplan, som du vil udskrive i en læsbar størrelse.

### 5. Kontroller forhåndsvisningen

For Gantt-udskrift og Ressourcediagram ser du papiret med sidehoved, tabel, tidslinje og forklaring. Rul for at se siderne. *Forhåndsvisningskvalitet* bestemmer kun, hvor skarp forhåndsvisningen er på din skærm. PDF-filen ændrer sig ikke med den. Står der under siderne *… og 1 side mere — eksporter for at få det fulde dokument* (ved flere sider *… og 2 sider mere — eksporter for at få det fulde dokument*), har forhåndsvisningen ikke alle sider klar. PDF-filen indeholder dem alle.

De andre rapporter vises på skærmen som tabel. Det du ser, er det, der kommer i PDF-filen.

### 6. Eksporter til PDF

Klik på **Eksporter PDF** nederst i den venstre kolonne. Det foreslåede filnavn er projektnavnet, efterfulgt af rapporttypen. For Gantt-udskrift er det for eksempel *Extension house-planning.pdf*.

- I desktop-appen, og i en browser, der har en gemmedialog for filer, vælger du, hvor PDF-filen gemmes. Lukker du den dialog uden at gemme, sker der ikke noget.
- I en browser uden en sådan dialog lægger browseren PDF-filen i download-mappen.

### 7. Udskriv PDF-filen

Åbn PDF-filen i din PDF-læser, og udskriv den der. Udskriver du en A3-PDF på en A4-printer, skal din udskriftsdialog formindske siderne. Vælg derfor papirstørrelsen først i trin 4.

## Faldgruber og hvad appen gør

**Knappen Udskriv og Ctrl+P udskriver ikke.** Knappen *Udskriv* i gruppen *Rapport* ligger på selve fanen Rapport og gør ikke mere. Ctrl+P åbner denne fane. Der er ingen særskilt udskriftskommando i appen: du får papir via PDF-filen. Virker Ctrl+P ikke (se trin 1), åbner browserens egen udskriftsdialog, og den udskriver skærmen, ikke rapporten.

**Virksomhed: overskrivning bevares ikke.** Feltet *Virksomhed:* i Gantt-udskrift begynder med virksomheden fra projektinfo. Det du skriver over det, bevares ikke. Du kan ikke skrive i *Forfatter:* her. Du ændrer begge via *Indstillinger › Projekt › Projektindstillinger*, i felterne *Opdragsgiver/organisation* og *Forfatter*, og bekræfter med *Anvend*.

**Bjælkefarver: gælder også for din skærm.** Valget *Bjælkefarver:* i rapporten er det samme valg som *Bjælkefarver* på fanen Beeld. Ændrer du det i rapporten, ændrer Gantt-visningen på skærmen sig også.

**Afvigelse uden oprindelig plan.** En oprindelig plan er et gemt øjebliksbillede af din tidsplan, som du senere måler mod. Hvordan du gemmer en, står i [Gem og administrer en oprindelig plan](docs://howto-baseline-opslaan-en-beheren). Har du ingen aktiv oprindelig plan, står der i stedet for en sammenligning *Ingen aktiv oprindelig plan — gem en oprindelig plan, eller vælg en som aktiv.*

**Statuslinje uden statusdato.** Vælger du *Statuslinje:*, mens projektet ingen statusdato har, advarer rapporten med *Angiv først en statusdato* og tegner intet. Du angiver statusdatoen under *Tidsplan › Oprindelige planer & fremdrift › Statusdato*.

**Tidsplanen indeholder en løkke.** Indeholder tidsplanen en løkke, laver *Eksporter PDF* ingen fil og viser fejlen.

**Papir gælder for øjeblikket for alle rapporter.** Der er ét valg for *Papir:* og *Retning:*, som alle rapporter deler. Milepælsoversigt og Afvigelse har ikke et eget papirvalg: de bruger det du har valgt i en anden rapport, som standard A3 liggende. Vælg derfor papiret først i en rapport, der tilbyder det, for eksempel Gantt-udskrift, og gå derefter tilbage.

**Indstillingerne gælder for alle projekter.** Papir, skriftstørrelse, periode og de andre valg huskes af appen på denne enhed, for alle dine projekter. De hører ikke til projektfilen.

## Se også

- [Valg af rapporteringsperiode](docs://howto-rapportageperiode-kiezen): en look-ahead- eller fremdriftsrapport over et bestemt tidsrum.
- [Opret og brug et layout](docs://howto-layouts-gebruiken): filtrer eller grupper først, og udskriv derefter med *Følg visning*.
- [Gem og administrer en oprindelig plan](docs://howto-baseline-opslaan-en-beheren): øjebliksbilledet som Afvigelse sammenligner med.
- [Løsning af overallokering](docs://howto-overbezetting-oplossen): hvad du gør, når Ressourcebelastning viser overallokerede uger.
- [Kritisk vej og slæk](docs://uitleg-kritiek-pad): hvorfor en opgave er kritisk eller næsten kritisk.
- [Rapporttyper](docs://ref-rapporttypes): alle rapporttyper og deres valgmuligheder.

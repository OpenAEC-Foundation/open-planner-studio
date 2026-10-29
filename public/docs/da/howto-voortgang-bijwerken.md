# Opdatering af fremdrift

Mål: Før den faktiske tilstand for arbejdet ind i tidsplanen, og genberegn tidsplanen: hvilke opgaver er færdige, hvilke er i gang, og hvor meget der stadig mangler.

## Hvornår du har brug for dette

Du opdaterer fremdriften på faste tidspunkter, for eksempel hver fredag, når byggelederen melder den aktuelle tilstand. Så ser tidsplanen, hvad der faktisk er sket, og den beregner det resterende arbejde ud fra statusdatoen. Hvorfor appen gør det på denne måde, står i [Fremdrift, statusdato og oprindelig plan](docs://uitleg-voortgang).

## Trin

### 1. Angiv statusdatoen

Statusdatoen er den dag, hvor du gør status op. Angiv den, før du angiver fremdrift.

1. Gå til *Tidsplan › Oprindelige planer & fremdrift › Statusdato*.
2. Skriv datoen i de tre felter for dag, måned og år (i den rækkefølge, du bruger til datoer), for eksempel 28, 06 og 2027, og tryk på Enter. Appen springer selv til næste felt.
3. Har projektets kalender tidsbånd (blokken *Arbejdstimer* i vinduet *Kalendere*)? Så regner appen i timer, og et tidsfelt vises til højre, for eksempel 17:00. Skriv et andet klokkeslæt, for eksempel 12:00, og tryk på Enter. Tømmer du tidsfeltet, forbliver kun datoen. Ændrer du kun datoen, forbliver klokkeslættet det samme. Klokkeslættet følger din tidsnotation (24 eller 12 timer). Uden tidsbånd regner appen i hele dage. Så er der intet tidsfelt, og linjen for statusdatoen står ved dagens begyndelse.
4. Med det lille kryds ved feltet tømmer du statusdatoen igen.

Gør du status op fredag efter arbejdstid, så sæt statusdatoen til næste arbejdsdag, mandag. Appen planlægger det resterende arbejde fra starten af statusdatoen.

Angiver du fremdrift, mens der endnu ikke er en statusdato, sætter appen den til i dag og viser en meddelelse: *Statusdato sat til i dag (…).* Gør det derfor hellere selv først.

### 2. Angiv fremdriften

Vælg den metode, der passer til din situation. De giver det samme resultat.

**Én opgave i egenskabspanelet.** Nyttig, når du opdaterer én opgave.

1. Klik på opgaven. Ser du ikke panelet *Egenskaber*, så slå det til med *Visning › Paneler › Egenskaber*.
2. Træk skyderen *Fremdrift (%)* til den procentdel, der er udført.
3. Udfyld om nødvendigt *Faktisk startdato* og *Faktisk slutdato* på samme måde som statusdatoen. Appen beregner feltet *Resterende* selv; det kan du ikke ændre her.

En milepæl har ét felt, *Faktisk dato*.

**Vælg en procentdel i menuen.** Nyttig til en hurtig opdatering.

1. Højreklik på opgavebjælken i Gantt-diagrammet.
2. Vælg *Fremdrift* og derefter 0%, 25%, 50%, 75% eller 100%.

**Flere opgaver i opgavetabellen.** Nyttig, når du opdaterer en hel liste.

1. Klik på **+** til højre for overskriften i opgavetabellen (*Tilføj kolonne*), og åbn kategorien *Fremdrift*. Tilføj kolonnerne *Faktisk startdato*, *Faktisk slutdato*, *Resterende* og *Fremdrift*. Kolonnen *Fremdrift* findes allerede på fanen *Tabel*.
2. Dobbeltklik på en celle, skriv værdien, og tryk på Enter. Du skriver en procentdel som `50` eller `50%`, en dato som `25-06-2027` og en resterende varighed som `1`.
3. For *Fremdrift* tryk på Enter efter et dobbeltklik, og vælg *Ikke startet*, *I gang* eller *Fuldført*.

Skriver du en resterende varighed, regner appen procentdelen tilbage: for en opgave på 2 arbejdsdage giver en rest på 1 en procentdel på 50. En rest på 0 gør opgaven fuldført. Kolonnen *Faktisk varighed* (også i kategorien *Fremdrift*) virker den anden vej: skriv, hvor meget arbejde der allerede er udført, og appen beregner procentdelen. For en opgave på 4 arbejdsdage giver en faktisk varighed på 1 en procentdel på 25. Vælger du *Ikke startet* ved *Fremdrift*, går procentdelen til 0, og de faktiske datoer forsvinder.

**Alt for én opgave i vinduet Redigér opgave.** Højreklik på opgaven, og vælg *Redigér...*. Felterne for fremdrift findes der også. De gælder først, når du klikker på *Gem*.

**Mange opgaver på én gang fra et regneark.** Se [Import af fremdrift fra et regneark](docs://howto-voortgang-importeren).

### 3. Genberegn tidsplanen

Hver ændring af fremdrift eller statusdatoen gør tidsplanen forældet: statuslinjen viser *Forældet — genberegn (F5)*. Tryk på **Beregn** (F5), for eksempel via *Tidsplan › Tidsplan › Beregn*. Er *Beregn automatisk* slået til (under *Indstillinger › Projekt › App-indstillinger*, fanen *Tidsplan*), gør appen det selv.

## Kontrol af resultatet

- På statusdatoen viser Gantt en stiplet linje med datoen i overskriften. Ved opgaver, der er i gang, buler linjen ud til procentdelen i bjælken. Du slår dem til eller fra med *Visning › Oprindelige planer & fremdrift › Fremdriftslinje* og *Statusdatolinje*.
- Den fuldførte del af en bjælke bliver grå; resten beholder sin farve. En opgave, der er fuldt færdig, er helt grå, med et flueben foran navnet og uden slækbjælke. Bjælken for en fase bliver også grå op til dens afledte procentdel, så du ser pr. fase, hvor langt arbejdet er. Hvis du viser de foregående opgaver eller de efterfølgende opgaver for en opgave, beholder disse bjælker deres fremhævningsfarve, også når de er fuldført.
- Fuldførte opgaver er aldrig røde: med en statusdato er en fuldført opgave ikke kritisk.
- Faser viser en afledt procentdel, og slutdatoen for tidsplanen kan være flyttet.
- Hvis du har gemt en oprindelig plan, står den oprindelige tidsplan under hver bjælke, og rapporttypen *Afvigelse* viser afvigelsen.

## Faldgruber og hvad appen gør

**En dato efter statusdatoen.** Appen afviser en faktisk startdato eller faktisk slutdato efter statusdatoen. I egenskabspanelet står der under felterne *Faktiske datoer kan ikke ligge efter statusdatoen*. I opgavetabellen viser cellen *Den faktiske dato ligger efter statusdatoen.* Flyt først statusdatoen senere, eller ret datoen.

**En opgave, der først starter efter statusdatoen.** Angiver du fremdrift for en opgave, som ifølge tidsplanen endnu ikke ville være startet, åbner vinduet *Angiv faktisk startdato*. Det spørger, hvornår opgaven faktisk startede; forslaget er statusdatoen. Med *Anvend fremdrift* gemmer du det, med *Annuller* ændres der ikke noget.

**100% uden datoer.** Sætter du en opgave til 100% uden en faktisk slutdato, bliver den faktiske slutdato statusdatoen, også selv om opgaven blev færdig tidligere. Udfyld så selv den faktiske slutdato.

**En procentdel under 100%.** Sætter du en fuldført opgave tilbage under 100%, fjernes den faktiske slutdato. Fjerner du kun den faktiske slutdato, går procentdelen til 0, og opgaven bliver stående som *I gang*. Vil du have, at opgaven igen tæller som ikke startet, så fjern også den faktiske startdato, eller vælg *Ikke startet* ved *Fremdrift* i opgavetabellen.

**Ændring af varigheden for en opgave, der er i gang.** Det udførte arbejde forbliver udført, og procentdelen tilpasses. En opgave på 5 arbejdsdage med 60%, som du sætter til 10 arbejdsdage, ender på 30%. Appen afviser en varighed, der er kortere end det gennemførte arbejde: *‘Build inner cavity leaf’ er allerede 60% gennemført. En varighed, der er kortere end det gennemførte arbejde, er ikke mulig. Varigheden er ikke ændret.* I opgavetabellen viser cellen *Denne varighed er kortere end det arbejde, der allerede er udført.*

**Den resterende varighed afrundes.** Appen runder den resterende varighed af til hele arbejdsdage. For en opgave på 2 arbejdsdage giver både 50% og 75% en rest på 1 arbejdsdag.

**En fase.** En fase har ingen egen fremdrift. I egenskabspanelet står der *Afledt af underopgaverne: ændr fremdriften dér. Hovedopgaven følger efter beregning (F5).* I opgavetabellen viser cellen *Fremdriften for en hovedopgave afledes af dens underopgaver og kan ikke ændres her.*

**Statusdatoen flyttes senere.** Det resterende arbejde for opgaver, der er i gang, starter på den nye statusdato, og arbejde, der endnu ikke er startet, kan ikke ligge før den dato. Flyt den derfor kun sammen med en opdatering af fremdriften. Sætter du en statusdato uden også at angive fremdrift, flytter alt arbejde, der endnu ikke er startet, til den dato (undtagen i profilen Microsoft Project).

**En fejl.** Hver ændring af fremdrift kan fortrydes med ét Ctrl+Z.

## Se også

- [Fremdrift, statusdato og oprindelig plan](docs://uitleg-voortgang): hvordan appen beregner det resterende arbejde og statusdatoen, med et regneeksempel.
- [Import af fremdrift fra et regneark](docs://howto-voortgang-importeren): indlæsning af fremdrift for mange opgaver på én gang.
- [Valg af fremdriftsmetode](docs://howto-voortgangsmodus-kiezen): hvad appen gør med en opgave, der er startet, mens dens foregående opgave stadig kører.
- [Gem og administrer den oprindelige plan](docs://howto-baseline-opslaan-en-beheren): gem den oprindelige tidsplan, så du kan sammenligne fremdriften med den.

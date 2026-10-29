# Valg af rapportperiode

Mål: beslut hvilket tidsrum en rapport dækker, for eksempel de kommende fire uger eller måneden juni.

## Hvornår du har brug for dette

Det ugentlige møde vil vide, hvad der sker i de kommende fire uger. Den månedlige rapport dækker juni. Uden en periode får du hele tidsplanen på papir. Fem rapporter arbejder derfor med en *Rapportperiode:*: *Look-ahead*, *Fremdriftsrapport*, *Ressourcebelastning*, *Ressourcetildelinger* og *Ressourcediagram*. De andre rapporter har ingen periode.

Perioden er ikke knyttet til en kalendermåned, men til en **referencedag**: statusdatoen for dit projekt (den dag, hvor du måler fremdriften, se [Fremdrift, statusdato og oprindelig plan](docs://uitleg-voortgang)), eller i dag, hvis projektet ingen statusdato har. *Næste 4 uger* tæller fra den dag. Hvis du flytter statusdatoen, flytter perioden med.

## Trin

### 1. Angiv statusdatoen

Hvis du arbejder med et relativt valg, for eksempel *Næste 4 uger* eller *Forrige måned*, skal du angive statusdatoen først. Vælg *Tidsplan › Oprindelige planer & fremdrift* og udfyld feltet *Statusdato*. Med krydset ved siden af (*Ryd statusdato*) fjerner du datoen igen. Hvis du arbejder med en fast periode (trin 4), har du ikke brug for dette.

### 2. Vælg en rapport med en periode

Åbn fanen *Rapport* og vælg en af de fem rapporter under *Rapporttype*. Listen *Rapportperiode:* står under *Rapportindstillinger*. For Ressourcediagram står den under *Indstillinger*, under de fire afkrydsningsfelter for den rapport.

Hver rapport husker sin egen periode. Disse er startværdierne:

- *Look-ahead*: *Næste måned*.
- *Fremdriftsrapport*: *Forrige måned*.
- *Ressourcebelastning*, *Ressourcetildelinger* og *Ressourcediagram*: *Projektets varighed*.

### 3. Vælg en periode på listen

Listen har *Næste uge*, *Næste 2 uger*, *Næste 4 uger*, *Næste 6 uger*, *Næste 8 uger*, *Næste 12 uger*, *Næste måned*, de samme syv med *Forrige*, *Projektets varighed* og *Brugerdefineret*. Under listen står *Fra* og *Til* med de datoer, som valget giver. Her kan du kun læse dem.

Begge dage tæller med. Hvis statusdatoen er torsdag den 20. maj, løber *Næste uge* fra 20. til 26. maj inklusive, og *Næste 4 uger* fra 20. maj til 16. juni inklusive (28 dage). *Næste måned* løber til én dag før den samme dato i den næste måned, her op til og med 19. juni. *Forrige 2 uger* løber fra 7. til 20. maj inklusive.

*Projektets varighed* tager tidsplanen fra den første start til den sidste slutdato.

### 4. Eller vælg Brugerdefineret

Med *Brugerdefineret* bliver *Fra* og *Til* til to datofelter. De starter med datoerne fra det valg, du lige havde. Udfyld begge, for eksempel 1. og 14. juni. Hvis indtastningen ikke er rigtig, bliver rapporten ved den sidste gyldige periode, og der vises en rød besked:

- *Slutdatoen ligger før startdatoen.* hvis *Til* ligger før *Fra*.
- *Udfyld begge datoer.* hvis en af de to er tom.

### 5. Læs perioden i rapporten

For Look-ahead, Ressourcebelastning og Ressourcetildelinger står perioden under titlen, for eksempel *Periode: 20-05-2027 – 19-06-2027*. Hvis du vælger *Projektets varighed*, tilføjes *Projektets varighed* efter datoerne. Fremdriftsrapport viser perioden i oversigten under *Periode*. Ressourcediagram lader sin tidsakse løbe præcis over perioden.

### Hvad perioden gør i hver rapport

Perioden virker ikke ens i alle rapporter.

- **Look-ahead** tager de ufærdige opgaver med, der berører perioden, også hvis de dækker hele perioden. Forsinkede opgaver fra før referencedagen er også med, så længe slutningen af perioden ikke ligger før referencedagen. En brugerdefineret periode helt i fortiden er et tilbageblik: den viser kun det, der kørte dengang og endnu ikke er færdigt, uden dagens efterslæb.
- **Fremdriftsrapport** bruger perioden til *Fuldført i den forrige periode*. Afsnittet *Starter i den kommende periode* kigger frem fra statusdatoen, op til datoen ved *Look-ahead til* i oversigten. Hvis du vælger en *Forrige*-periode, kigger rapporten lige så langt frem, som den kigger tilbage: med *Forrige 2 uger* og statusdato 20. maj står der *Look-ahead til* 3. juni. En brugerdefineret periode eller *Projektets varighed*, der helt ligger i fortiden, spejles ikke.
- **Ressourcebelastning** viser hver uge eller måned, der berører perioden, helt. Hvis din periode løber fra onsdag til onsdag, ser du derfor hele uger, så en række altid viser det samme tal som histogrammet.
- **Ressourcetildelinger** viser tildelingerne for opgaver, der berører perioden. Med *Projektets varighed* filtreres der ikke på dato.
- **Ressourcediagram** viser kun de opgaver, der berører perioden. I oversigten tæller *Uden for perioden:* hvor mange opgaver der er udeladt.

## Faldgruber, og hvad appen gør

**Der er ingen statusdato.** Appen bruger så i dag. For de fire tabelrapporter med en periode (*Look-ahead*, *Fremdriftsrapport*, *Ressourcebelastning* og *Ressourcetildelinger*) står der øverst, med en relativ periode, *Ingen statusdato angivet — rapporten bruger i dag (29-09-2026).* med din egen dato for i dag. Ressourcediagram melder ikke dette. Kig derfor på *Fra* og *Til*: de ligger så omkring i dag og ikke omkring din tidsplan.

**Perioden ligger uden for din tidsplan.** Så er rapporten tom. Ressourcediagram siger det med *Ingen opgaver i rapporteringsperioden — vælg en anden periode eller Hele projektet.* (i listen hedder det valg *Projektets varighed*). I de andre rapporter ser du nul opgaver eller ingen rækker.

**Datoerne vises i dit eget format.** *Fra* og *Til* følger datonotationen fra dine indstillinger, behalve i datofelterne under *Brugerdefineret*: de viser i stedet formatet fra din browser.

**Perioden flytter med.** Et relativt valg, for eksempel *Næste måned*, fastsættes igen hver gang: når statusdatoen ændres, eller uden statusdato en dag senere, flytter perioden straks med. Vil du have en fast periode, vælg *Brugerdefineret*.

**Valget gælder for alle dine projekter.** En brugerdefineret periode gælder også for alle dine projekter på denne enhed, ikke kun for det åbne projekt.

## Se også

- [Oprettelse og udskrivning af en rapport](docs://howto-rapport-maken-en-afdrukken): hele vejen fra rapporttype til pdf.
- [Fremdrift, statusdato og oprindelig plan](docs://uitleg-voortgang): hvad statusdatoen er, og hvorfor appen regner med den.
- [Løsning af overallokering](docs://howto-overbezetting-oplossen): hvad du gør med ugerne med overallokering fra Ressourcebelastning.
- [Rapporttyper](docs://ref-rapporttypes): alle rapporttyper og deres indstillinger.

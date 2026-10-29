# Slik fungerer KI-koblingen

Hva skjer egentlig når en KI-assistent jobber i tidsplanen din? I denne artikkelen leser du hva koblingen er, hvorfor den er annerledes enn å utveksle en fil, hvilke grenser appen selv bevokter, og hvordan assistenten finner ut hvordan en tidsplan skal bygges. Eksemplet til slutt viser med tall hva en assistent kan gjøre i én omgang, og hva du får igjen av det.

## Begrepet

En KI-assistent, for eksempel et chatprogram eller en programmeringsassistent, kan styre et annet program via **Model Context Protocol** (MCP). Open Planner Studio er serveren i denne utvekslingen. Skrivebordsappen kjører en liten server på din egen datamaskin, **broen**. Assistenten kobler seg til den og får en liste over **verktøy**: funksjoner med et navn som begynner med `planner_`, for eksempel lese aktiviteter, legge til en avhengighet eller lagre en grunnlinje. Hvilke de er, står i [AI-verktøy](docs://ref-ai-tools).

Det som er mest spesielt, er at assistenten jobber i prosjektet du har åpent på dette øyeblikket, ikke i en kopi. Du eksporterer ingenting, du importerer ingenting, og det finnes ingen øyeblikk der du og assistenten ser på to ulike versjoner. En aktivitet som assistenten legger til, vises med en gang i Gantt-diagrammet. Appen er ikke naiv om dette: assistenten bruker den samme beregningen, den samme angrehistorikken og de samme reglene som du.

Hvordan du slår på koblingen, står i [Koble til en KI-assistent (MCP)](docs://howto-ai-assistent-koppelen). Nedenfor leser du hvordan den fungerer.

## Slik håndterer appen det

### En server som bare din egen datamaskin kan nå

Broen lytter bare på din egen datamaskin (`127.0.0.1`), på én port, som standard 3877. Den tar bare imot forespørsler på adressen `/mcp`, og bare med ditt **token** i headeren `Authorization: Bearer`. Den avviser en forespørsel uten riktig token. En forespørsel fra en nettleser som broen gjenkjenner på en `Origin`-header, avvises også, slik at en nettside du har åpen, ikke kan snakke med tidsplanen din. Den behandler forespørsler strengt én om gangen.

Forbindelsen er vanlig HTTP på din egen datamaskin; appen selv sender ingenting ut. Hva en assistent gjør med tidsplanen den leser, for eksempel hva leverandøren gjør med den, avgjøres av assistenten og ligger utenfor appen.

### Assistenten jobber i ett dokument

Ved den første endringen binder broen forbindelsen til dokumentet som er aktivt på det tidspunktet. Bytter du selv fane etterpå, avviser appen assistentens neste endring (kode `DOC_DRIFT`), til assistenten bekrefter med `planner_switch_document` hvilket dokument den vil jobbe i. Slik havner ingenting i feil prosjekt. En assistent som selv åpner eller dupliserer et dokument, jobber etterpå i det nye dokumentet.

### Hver endring omberegner tidsplanen

I appen planlegger du for hånd: du endrer noe, og trykker deretter på *Beregn* (F5), med mindre *Beregne automatisk* er på. Dette gjelder ikke for en endring av assistenten. Hver skrivehandling av assistenten går via én transaksjon. Endrer den prosjektdata, omberegner appen til slutt av seg selv, én gang per skript. Et leseverktøy gir alltid oppdaterte datoer: er tidsplanen utdatert, for eksempel fordi du selv har endret noe og ennå ikke har trykket på *Beregn*, da omberegner leseverktøyet først. Det finnes ett unntak: står prosjektet i visningen *Datoer slik de ble registrert* (etter en import), omberegner ikke et leseverktøy stille, for da ville det erstatte disse datoene. Assistenten får da de registrerte datoene, med et varsel om at de ikke er omberegnet. En endring av assistenten selv omberegner alltid, også da. Du trenger ikke trykke på *Beregn* etter en endring av assistenten. Den leser deretter resultatet, for eksempel prosjektslutten og den kritiske linjen, tilbake med leseverktøyene. Se også [Datoer slik de ble registrert](docs://uitleg-datums-zoals-opgeslagen).

### Et skript er ett trinn

En assistent kan sende en reeks trinn som én helhet med `planner_batch`, et skript med høyst 100 trinn. Det gir deg ett angretrinn, én omberegning og én sikkerhetskopi. Feiler ett trinn strukturelt, for eksempel et ukjent verktøy eller en sirkulær referanse, ruller appen hele skriptet tilbake. Du sitter aldri igjen med en halvferdig tidsplan. En avvisning av ett element i et massetrinn, for eksempel én ugyldig fremdriftsregistrering av tjue, er mildere: det elementet holdes utenfor, og resten utføres. Avvisningene står øverst i svaret.

### Dine grenser

Du stiller selv fire ting inn, i fanen *AI*:

- *Avbrudd* og *Skrivebeskyttet* holder assistenten tilkoblet, men avviser alle endringer. Lesing kan fortsatt, inkludert omberegning av en utdatert tidsplan under lesing: dette er beregnede felt, ikke prosjektdata, så det legges ikke til et angretrinn, og prosjektet telles ikke som endret. Midt i en redigering selv, for eksempel når du drar en stolpe eller skriver i et felt, omberegnes ikke tidsplanen av et leseverktøy: assistenten får da datoene fra før redigeringen din, med et varsel om at de er utdatert.
- En åpen dialogboks blokkerer alt. Har du for eksempel dialogen for aktivitet, innstillingene, presentasjonsmodus eller velkomstvinduet åpent, avviser appen også lesing, fordi du er midt i en manuell handling. Assistenten får feilkoden `DIALOG_OPEN`. Meldingen nevner det interne navnet på det som er åpent, for eksempel `showTaskDialog` for dialogen for aktivitet.
- *Automatisk sikkerhetskopi* skriver en IFC-kopi før den første endringen per dokument. Mislykkes sikkerhetskopieringen, utfører appen ikke endringen.
- Panelet *Aktivitetspanel* viser alle kall, med argumenter og svar.

Dertil kommer den vanlige *Angre* (Ctrl+Z). Assistenten deler den historikken med deg og har selv `planner_undo` og `planner_redo`.

### Det assistenten ikke kan gjøre

Broen er med vilje smalere enn appen. Det assistenten ikke kan gjøre, har vanligvis én av tre grunner.

**Den går lenger enn prosjektet.** Assistenten kan ikke endre biblioteket med ressurser. Et bibliotek deles av alle prosjektene dine og ligger utenfor angrehistorikken; én endring av standardsats ville da virke i prosjekter som ikke engang er åpne. For en ressurs fra et bibliotek er navn, type, beskrivelse, standardsats og enhet låst, akkurat som i ressurspanelet. Det prosjektet avgjør, kan assistenten stille inn: maksimalt antall, tilgjengelighet over tid, kalender og mannskap. Den kan heller ikke velge hvilken kalender som er prosjektets kalender. Den kan lese beregningsprofilen og beregningsalternativene, men ikke endre dem; den kan bare sette fremdriftsmodusen og prosjektets standard for aktivitetstypen. Det finnes ingen verktøy for innstillinger, tema, språk, utvidelser eller oppdateringer.

**Den egner seg ikke til pålitelig kontroll.** Assistenten kan ikke sette en hengekøye, planlegge en aktivitet manuelt, sette en andre begrensning eller fylle inn notater, farger, aktivitetskoder, egendefinerte felt eller koblinger mellom prosjekter. Den kan heller ikke sette en utjevningsforsinkelse for hånd. Den velger heller ikke en WBS-kode; appen utleder den selv.

**Den rører ved noe du selv må bestemme.** Den registrerer bare fremdrift når det finnes en statusdato. Den velger ikke statusdatoen selv: den er din referansedato. Hvis en aktivitet som ikke er startet, har en planlagt start etter statusdatoen, må den oppgi den faktiske starten. Den leser og skriver bare filer i brukermappen din, og den overskriver en eksisterende fil bare hvis den uttrykkelig ber om det. Eksport er ikke det samme som *Lagre*: prosjektet forblir ulagret i appen.

### Hvordan assistenten vet hvordan den skal planlegge

En assistent som kjenner verktøyene, kan likevel lage en tidsplan ingen planlegger har nytte av: aktiviteter uten avhengigheter, en fast dato på hver aktivitet, eller en oppdeling som er altfor fin. Derfor gir appen den tre ting.

**Kjerneregler i håndtrykket.** Når en assistent kobler seg til, sender broen en kort tekst i feltet `instructions` i MCP-håndtrykket. Mange klienter legger den teksten i systemprompten; om din gjør det, avhenger av klienten. Reglene: start ved milepælene og leveringsdatoen, lag aktiviteter på omtrent én dag til to uker, styr tidsplanen med avhengigheter i stedet for faste datoer, bruk begrensninger bare for harde eksterne datoer, løs først en mislykket beregning, bruk `planner_batch` for en sammenhengende serie, registrer fremdrift bare med din statusdato og de faktiske datoene du oppgir, og si til slutt hva du antok og hva du bevisst ikke gjorde.

**Gidsen for assistenter.** Verktøyet `planner_get_planning_guide` returnerer en gids som er skrevet spesielt for assistenter. Den følger de samme prinsippene som [Planlegg godt](docs://gids-goed-plannen), men en assistent arbeider annerledes enn deg: den trykker ikke på F5 og klikker ikke i båndet, den kaller verktøy, og appen omberegner for den. Gidsen nevner derfor for hvert prinsipp hvilke verktøy assistenten bruker til det, og forklarer hva assistenten gjør med *Datoer slik de ble registrert* eller en mislykket beregning. Gidsen er på engelsk, slik alt assistenten leser via koblingen er; verktøyet godtar fortsatt et språkvalg for eldre assistenter, men det endrer ikke teksten. Du kan lese den selv på `https://open-planner-studio.open-aec.com/agent/planning-guide.md`. Tilkoblingsteksten i vinduet *Tilkoblingsdetaljer* ber assistenten lese gidsen først. Verktøyet virker også mens en dialogboks er åpen, mens assistenten er satt på avbrudd, og i skrivebeskyttet modus, fordi det ikke leser tidsplanen din.

**To ferdigheter.** En ferdighet er en liten fil med instruksjoner som en assistent leser med i hver økt. Det er to, fordi det er to slags arbeid. Å sette opp en tidsplan handler om logikk; å oppdatere fremdrift handler om fakta som bare du kjenner. Ferdigheten *goed-plannen* er for å sette opp eller omstrukturere en tidsplan: rekkefølgen verktøyene brukes i, omberegningsregelen, `planner_batch` og plikten til å melde antakelser. Ferdigheten *progress-update* er for den ukentlige fremdriftsoppdateringen: først statusdatoen din, deretter de faktiske start- og sluttdatoene og prosent fullført, og til slutt en rapport over avviket mot grunnlinjen, den kritiske linjen og den nye sluttdatoen. Planleggingsprinsippene står i gidsen. Begge ferdighetene er på engelsk. Verktøyet returnerer begge, med stedet der de hører hjemme. Hvordan du installerer dem, står i [Koble til en KI-assistent (MCP)](docs://howto-ai-assistent-koppelen).

## Et eksempel

Du ber en assistent om dette: bygg et tilbygg med fundament, murverk og tak, i den rekkefølgen. Prosjektet ditt starter mandag 2. mars 2026. Assistenten leser gidsen først, og sender deretter ett skript:

1. prosjektstart 2. mars 2026;
2. tre aktiviteter: Foundation på 5 arbeidsdager, Brickwork på 10 og Roof på 4;
3. to avhengigheter av typen slutt-til-start: Foundation til Brickwork, Brickwork til Roof.

Appen utfører de tre trinnene og omberegner. Leser assistenten etterpå tilbake, finner den: prosjektslutt torsdag 26. mars 2026, prosjektets varighet 19 arbeidsdager, og alle tre aktivitetene kritiske. Det stemmer med summen: 5 + 10 + 4 er 19 arbeidsdager, og 19 arbeidsdager etter mandag 2. mars slutter på torsdag 26. mars. Hele skriptet er ett trinn i historikken din. Ett *Angre* fjerner de tre aktivitetene, de to avhengighetene og den nye prosjektstarten.

Nå kommer hva-hvis-scenarioet. Du ber deretter assistenten oppdatere fremdriften, og da setter den statusdatoen til mandag 16. mars. En statusdato er ikke bare en etikett: arbeid som ikke er startet, kan ikke ligge før den datoen og flyttes opp til den. Uten én eneste fremdriftsregistrering flytter hele tidsplanen seg derfor: Foundation går fra 16. til 20. mars, Brickwork fra 23. mars til 7. april og Roof fra 8. til 13. april. Prosjektslutten hopper fra 26. mars til 13. april. Tidsplanen forskyves to arbeidsuker, og kalenderen i dette eksemplet, *Bouwkalender NL*, har langfredag (3. april) og påske (5. og 6. april). Disse to fridagene på ukedager skyver slutten to dager til. Derfor setter assistenten bare statusdatoen når du ber om det, og bare når det er reell fremdrift å registrere.

## Konsekvenser for tidsplanen din og vanlige misforståelser

**Assistenten har ingen egen kopi.** Det den endrer, endrer prosjektet ditt. Med *Automatisk sikkerhetskopi* på har du en IFC-sikkerhetskopi før den første endringen. Med *Skrivebeskyttet* kan den analysere uten å endre noe.

**Et nytt token bryter alle forbindelser.** Tokenet er passordet til broen. Et nytt token ugyldiggjør det gamle, også på en kjørende bro, og assistenten må få det nye.

**Når assistenten sier at det virket, er det ikke bevis.** Panelet *Aktivitetspanel* viser hvilket verktøy den faktisk kalte, og hva som kom tilbake. En avvisning nevner nesten alltid feltet som var feil, og veien som faktisk fungerer.

**Assistenten kan ikke gjøre et hva-hvis-scenario med angre.** Den deler angrehistorikken med deg, så for varianter dupliserer den dokumentet med `planner_duplicate_document`. Kopien er frakoblet, har ingen filsti og vises som ulagret. Assistenten lukker ikke varianter; det bestemmer du.

**En eksport av assistenten er ikke det samme som å lagre.** Den skriver en IFC-fil til en sti den selv velger, inne i brukermappen din, og den overskriver en eksisterende fil bare hvis den uttrykkelig ber om det. Prosjektet ditt forblir ulagret i appen og beholder sitt eget lagringsmål. Importerer den en fil, åpnes den i en ny fane eller i en tom, uendret fane.

## Se også

- [Koble til en KI-assistent (MCP)](docs://howto-ai-assistent-koppelen): stegene for å starte broen, koble til en assistent og installere ferdigheten.
- [AI-verktøy](docs://ref-ai-tools): alle verktøy etter gruppe, hva de avviser, og hvor lenge sikkerhetskopier beholdes.
- [Planlegg godt](docs://gids-goed-plannen): planleggingsprinsippene; assistenten får dem i en engelsk versjon med verktøyene lagt til.
- [Fremdrift, statusdato og grunnlinje](docs://uitleg-voortgang): hva statusdatoen gjør med tidsplanen din.

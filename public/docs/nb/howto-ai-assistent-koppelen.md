# Koble til en MCP-klient

Mål: la en MCP-klient lese med og jobbe i tidsplanen din, med innsikt i hva den gjør, og med grenser du setter selv.

## Raskt: la Claude gjøre det

Arbeider du med Claude Desktop eller Claude Code? Da kan Claude installere forbindelsen selv:

1. Klikk på *Kopier prompt* nedenfor.
2. Lim inn prompten i en ny chat med Claude, og send den.

Claude installerer deretter utvidelsen for Open Planner Studio og forklarer underveis hva den gjør. Hvis du selv må gjøre noe, for eksempel klikke på *Installer* i Claude Desktop, sier Claude nøyaktig hvilket klikk du må gjøre. Du trenger ingen token til det.

```prompt
Installer utvidelsen Open Planner Studio for meg, så du kan lese og endre byggetidsplanene mine i Open Planner Studio. Gjør så mye du kan selv. Før hvert steg sier du i én enkel setning hva du skal gjøre og hvorfor. Hvis du trenger meg, spør du om én ting om gangen, og venter på svaret mitt. Hvis jeg selv må gjøre noe, sier du nøyaktig hvilket ene klikk eller hvilken handling det gjelder, og hvor.

Dette må du vite:
- Utvidelsen er én fil, open-planner-studio-<version>.mcpb, i den nyeste utgivelsen: https://github.com/OpenAEC-Foundation/open-planner-studio/releases/latest. Den direkte lenken står i https://api.github.com/repos/OpenAEC-Foundation/open-planner-studio/releases/latest (filen der navnet slutter på .mcpb). Filen er en ZIP-fil.
- Utvidelsen fungerer sammen med skrivebordsappen Open Planner Studio, og uten appen. Når appen er åpen og MCP-broen kjører, jobber du i planen som er åpen i appen. Når appen er lukket, jobber du med tidsplanfiler i en arbeidsmappe som jeg velger.
- Installasjonen trenger ingen token og ingen passord. Ikke spør meg om en, og ikke les eller vis en.

Hvis du kjører i Claude Desktop:
1. Hvis du kan laste ned en fil og åpne den på datamaskinen min, gjør du det med .mcpb-filen. Hvis ikke, gir du meg den direkte nedlastingslenken, og sier at jeg skal dobbeltklikke på filen når nedlastingen er ferdig.
2. Claude Desktop viser deretter utvidelsen Open Planner Studio. Si at jeg skal klikke på Installer. Si så at jeg skal velge mappen med tidsplanfilene mine under Working folder.
3. Si at jeg skal starte en ny chat, og der spørre deg hvilke Open Planner Studio-verktøy du ser.

Hvis du kjører i Claude Code:
1. Kontroller at Node.js 22 eller nyere er installert. Hvis ikke, si meg hvordan jeg installerer det, og stopp.
2. Spør meg hvilken mappe som har tidsplanfilene mine. Det er arbeidsmappen.
3. Last ned .mcpb-filen, og pakk den ut i en ny egen mappe i brukermappen min. Les manifest.json der: server.mcp_config forteller hvordan serveren starter. Erstatt ${__dirname} med den utpakkede mappen, og ${user_config.workdir} med arbeidsmappen.
4. Kjør claude mcp list. Hvis det allerede finnes en server med navnet open-planner-studio, spør meg om du får erstatte den. Ikke vis innstillingene, fordi de kan inneholde en token.
5. Legg til serveren for brukerkontoen min, for eksempel: claude mcp add open-planner-studio --scope user -e OPS_MCP_ROOT=<arbeidsmappe> -- node <utpakket mappe>/server/index.mjs
6. Si at jeg skal starte en ny Claude Code-økt, og at /mcp der viser om open-planner-studio er koblet til.

Hvis du kjører et annet sted, for eksempel claude.ai i nettleseren, sier du til meg at dette krever Claude Desktop eller Claude Code. Hvis du ikke vet hvor du kjører, spør du meg.

Når installasjonen er ferdig, forklarer du med noen få setninger:
- hvordan jeg lar deg jobbe i den åpne appen: i Open Planner Studio velger jeg Innstillinger › Prosjekt › Appinnstillinger, fanen Avansert, og slår på Tillat MCP-forbindelse. Deretter klikker jeg på Start bro på fanen MCP.
- at uten appen er en endring først i filen når du har lagret den, og at du ikke overskriver en eksisterende fil mens appen er åpen.
Hvis et steg mislykkes, sier du til meg i én setning hva som gikk galt, og hva jeg kan gjøre. Ikke gjett.
```

Foretrekker du å gjøre det selv, eller bruker du en annen MCP-klient? Da følger du stegene nedenfor.

## Når du trenger dette

Du vil at en MCP-klient skal lese, analysere eller endre tidsplanen din. For eksempel å la den lage et første utkast av en WBS, rette aktiviteter eller forklare den kritiske linjen. Det fungerer via **Model Context Protocol** (MCP): en standard som lar et AI-program, **MCP-klienten**, bruke verktøy fra et annet program. For dette kjører Open Planner Studio en liten server på din egen datamaskin, **broen**. Den tilbyr et sett med verktøy, alle med et navn som begynner med `planner_`: lese og endre aktiviteter, avhengigheter, ressurser, kalendere, grunnlinjer, dokumenter og filer. Hvilke som finnes, og hva de avviser, står i [MCP-verktøy](docs://ref-ai-tools). MCP-klienten jobber i prosjektet du har åpent, ikke i en kopi: en aktivitet den legger til, vises i Gantt med en gang. Den bruker samme beregning og samme historikk for *Angre* som du.

Broen fungerer bare i skrivebordsappen. Hvis du tillater MCP-forbindelsen i nettleseren, ser du fanen *MCP*, men knappen *Start bro* er grå, med teksten *Broen fungerer bare i skrivebordsappen.* Resten av denne artikkelen handler om skrivebordsappen. I nettleseren er også *Ta backup nå* og *Åpne backup-mappen* grå.

## Steg

### 1. Tillat MCP-tilkobling

1. Velg *Innstillinger › Prosjekt › Appinnstillinger*. Du kan også velge *Fil › Appinnstillinger*, eller tannhjulet øverst.
2. Velg fanen *Avansert* og slå på *Tillat MCP-tilkobling*. Fanen *MCP* vises i båndet.
3. Hvis du vil at broen skal være aktiv så snart appen starter, slår du også på *Start broen automatisk*. Det slår bare på når MCP-tilkoblingen er på, og det fungerer bare i skrivebordsappen. Den er av som standard, fordi det å åpne en port er et bevisst valg.

Hvis du slår av MCP-tilkoblingen, stopper broen, og fanen *MCP* forsvinner.

### 2. Start broen

1. Gå til fanen *MCP* og klikk på *Start bro* under *Server*.
2. Se på statusen ved siden av knappen. Det står *Av*, *Aktiv på port 3877*, *Port 3877 i bruk* eller *Feil*. Hvis oppstarten lykkes, står det *Aktiv på port 3877*, og knappen heter *Stopp bro*. Ved *Port 3877 i bruk* eller *Feil* står knappen fortsatt på *Start bro*; se fallgruvene.

Broen lytter bare på din egen datamaskin, på én port. Som standard er det 3877. I gruppen *Tilkobling* kan du velge en annen under *Port*, men bare mens broen er stoppet. Tilkoblingen er ukryptert HTTP på din egen datamaskin. Appen selv sender ingenting ut. Hva MCP-klienten gjør med tidsplanen din, for eksempel hva leverandøren gjør med den, ligger utenfor appen.

### 3. Koble til MCP-klienten

1. Klikk på *Koble til* under *Tilkobling*. Vinduet *Tilkoblingsdetaljer* åpnes.
2. Velg det klienten din trenger, se under.
3. Tokenet er skjult. Med øyeikonet viser du det. Kopieringsknappene kopierer alltid den faktiske verdien, selv om skjermen skjuler tokenet.
4. La MCP-klienten be om listen med verktøy. Denne kontrollen står også i koblingsprompten: den skal se verktøyene med prefikset `planner_`; det forventede antallet står i koblingsprompten.

Vinduet tilbyr fire måter å koble til på:

- *La Claude ordne det*: den samme prompten som øverst i denne artikkelen, med knappen *Kopier prompt*. Den er for Claude Desktop og Claude Code. Du trenger ikke et token til den.
- *Konfigurasjonsutdrag*: en bit konfigurasjon som du limer inn i MCP-innstillingene til klienten din.
- *Koblingsprompt*: en tekst som du limer inn i MCP-klienten din, hvoretter den kobler seg til selv.
- *Endepunkt* og *Autentisering*: de separate detaljene. Endepunktet er `http://localhost:3877/mcp` med transport *streamable HTTP*. Hver forespørsel må ha feltet `Authorization: Bearer` etterfulgt av tokenet ditt. Klienten din må også støtte MCP-økter: når den kobler til, gir broen en øktkode i feltet `Mcp-Session-Id`, og den avviser hver senere forespørsel uten den koden. Claude Code og `mcp-remote` gjør dette selv.

**Koble til igjen etter en oppdatering av appen.** Hvis MCP-klienten din allerede var koblet til en eldre versjon av appen, sender den ennå ikke en øktkode, og broen avviser hver forespørsel. Koble derfor til igjen etter oppdateringen: start en ny økt i Claude Code, og avslutt Claude Desktop helt og start den på nytt.

**Claude Code.** Konfigurasjonsutdraget passer direkte til Claude Code. Kjør denne kommandoen i en terminal, med ditt eget token i stedet for `<token>`:

```
claude mcp add --transport http open-planner-studio http://localhost:3877/mcp --header "Authorization: Bearer <token>"
```

Du kan også legge konfigurasjonsutdraget i filen `.mcp.json` i prosjektmappen din. Legg da ikke den filen i git, fordi tokenet gir tilgang til tidsplanen din. En server fra `.mcp.json` må godkjennes første gang i Claude Code.

**Claude Desktop.** For Claude Desktop finnes det en utvidelse: filen `open-planner-studio-<version>.mcpb`. Claude Desktop installerer den med et dobbeltklikk. Du trenger ikke Node.js til den. Utvidelsen fungerer med appen og uten appen. Det går raskere med prompten øverst i denne artikkelen; under står stegene for hånd.

1. Last ned `.mcpb`-filen fra den nyeste utgivelsen: `https://github.com/OpenAEC-Foundation/open-planner-studio/releases/latest`.
2. Dobbeltklikk på filen. Claude Desktop åpnes og viser utvidelsen *Open Planner Studio*. Installer den. Hvis et dobbeltklikk ikke virker, åpner du *Innstillinger › Utvidelser* i Claude Desktop og installerer filen der.
3. Ved *Working folder* velger du mappen med tidsplanfilene dine. Claude bruker denne mappen bare når appen er lukket. Claude leser og skriver deretter bare i den mappen.
4. Slå på utvidelsen og start en ny samtale. Spør Claude hvilke verktøy i Open Planner Studio den ser.

Du skriver ikke inn et token eller en port: mens broen kjører, finner utvidelsen appen selv. For hver forespørsel fra Claude velger utvidelsen på nytt:

- *Appen er åpen og broen kjører*: Claude arbeider i tidsplanen som er åpen i appen. Du ser hver endring i appen med én gang.
- *Appen er lukket, eller broen er av*: Claude arbeider på en tidsplanfil i arbeidsmappen. En endring står bare i filen når Claude lagrer filen. Det finnes ingen automatisk lagring. Mens appen er åpen, overskriver Claude ikke en eksisterende fil, men lagrer den under et nytt navn.

Hvis appen åpnes eller lukkes mens Claude arbeider, bytter utvidelsen og sier fra til Claude. Claude velger eller åpner deretter tidsplanen på nytt, og endrer først da noe. Hvis Claude fortsatt har endringer uten appen som ikke er lagret, fortsetter utvidelsen å arbeide uten appen til Claude har lagret dem. Slik går ingen arbeid tapt. Hvis utvidelsen ikke kan nå appen, og det ikke finnes en brukbar arbeidsmappe, ser Claude bare verktøyet `open_planner_studio_status`, med en melding som sier deg hva du må gjøre.

**Claude Desktop uten utvidelsen.** Hvis du ikke kan bruke utvidelsen, kobler du Claude Desktop til med det eksterne verktøyet `mcp-remote`. Konfigurasjonsutdraget passer ikke direkte til Claude Desktop: i filen `claude_desktop_config.json` oppgir du et program som Claude Desktop starter selv, ikke en adresse. `mcp-remote` trenger Node.js. I Claude Desktop velger du *Innstillinger › Developer › Edit Config*, legger dette inn i filen (med ditt eget token) og starter Claude Desktop på nytt:

```
{
  "mcpServers": {
    "open-planner-studio": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:3877/mcp", "--header", "Authorization:${AUTH_HEADER}"],
      "env": { "AUTH_HEADER": "Bearer <token>" }
    }
  }
}
```

Tokenet står i `env` og ikke i `args` med vilje: på Windows ødelegger Claude Desktop et argument som inneholder et mellomrom. En *custom connector* i Claude (*Customize › Connectors*) fungerer ikke med broen. Claude kobler seg da til fra Anthropic-skyen, og den kan ikke nå broen på din egen datamaskin.

I gruppen *Tilkobling* finnes også feltet *Token*. Det er en lang, tilfeldig kode som appen lager for deg og lagrer på denne datamaskinen. I vinduet står det *Dette tokenet gir tilgang til den åpne tidsplanen. Ikke del det med andre.* Med ikonet *Opprett nytt token* lager du et nytt token. Appen spør først *Et nytt token avbryter alle eksisterende koblinger. Vil du fortsette?* Hvis broen kjører, starter den på nytt med det nye tokenet, og det gamle virker ikke lenger.

**Slik finner utvidelsen appen.** Mens broen kjører, skriver skrivebordsappen porten og tokenet til filen `mcp/runtime.json` i datamappen til appen. Utvidelsen for Claude Desktop leser den filen for hver forespørsel. På Linux og macOS kan bare brukerkontoen din lese filen. På Windows beskytter standard ACL-innstillingen for profilmappen din filen; appen sjekker ikke dette separat. Når du stopper broen eller slår av MCP-tilkoblingen, fjerner appen filen. Appen holder også en liste over åpne filer i `mcp/open-files.json`, også når MCP-tilkoblingen er av. Så lenge den filen finnes, overskriver ikke utvidelsen og MCP-serveren uten grensesnitt noen eksisterende fil, heller ikke en fil du nettopp har åpnet og som ikke står på listen ennå. En ny fil er tillatt. Lesing er også tillatt: Claude ser da versjonen på disken, uten endringene dine som ikke er lagret ennå.

### 4. Se hva MCP-klienten gjør

1. Klikk på *Aktivitetspanel* under *Aktivitet*. I sidekolonnen åpnes panelet *MCP-aktivitet*.
2. Hvert kall til broen står på en linje, det nyeste øverst: tidspunkt, hva som skjedde, hvor lang tid det tok, og om det lyktes eller ikke. Klikk på en linje for å vise *Argumenter* og *Svar*.
3. Med *Tøm* tømmer du listen. Panelet beholder de siste 500 kallene. Så lenge ingenting har skjedd, står det *Ingen MCP-aktivitet ennå. Kall til broen vises her.*

Når MCP-tilkoblingen er på, er det en prikk med *MCP* nederst til høyre i statuslinjen. Fargen viser statusen til broen, og et klikk på den tar deg til fanen *MCP*.

### 5. Sett grenser

Under *Sikkerhet* finner du knappene du bruker for å begrense MCP-klienten:

- *Avbrudd*: MCP-klienten får midlertidig ikke endre noe, men lesing er fortsatt tillatt. Broen forblir aktiv. Knappen blir *Fortsett*.
- *Skrivebeskyttet*: alle verktøy som endrer noe, blir avvist så lenge dette er på.
- *Auto-backup: på*: før den første endringen fra MCP-klienten i et dokument, skriver appen en IFC-backup. Dette er på som standard. Med knappen slår du den av, og da står det *Auto-backup: av*. Dette skjer én gang per dokument hver gang du starter broen.
- *Ta backup nå*: lager en backup av det aktive dokumentet med en gang. Etterpå står det *Backup opprettet:* med filnavnet.
- *Åpne backup-mappen*: åpner mappen med backupene.

Backupene ligger i mappen `ai-backups` i datamappen til appen. Appen beholder de nyeste backupene og tynner ut de eldre; nøyaktig hvordan det er, står i [MCP-verktøy](docs://ref-ai-tools).

### 6. La MCP-klienten planlegge godt

En MCP-klient planlegger bare godt hvis den kjenner planleggingsreglene. Dette gjør du selv:

1. **Gjør ingenting for kjernereglene.** De kommer med når du kobler til: broen sender dem i feltet `instructions` i MCP-håndtrykket. Om klienten din legger dem inn i systemprompten, avhenger av klienten.
2. **La MCP-klienten lese veiledningen.** Koblingsprompten fra vinduet *Tilkoblingsdetaljer* ber MCP-klienten lese veiledningen med verktøyet `planner_get_planning_guide`. Hvis du ikke bruker prompten, skriv da dette til klienten: *Les planleggingsveiledningen med planner_get_planning_guide først, før du endrer noe.* Du kan selv lese veiledningen på `https://open-planner-studio.open-aec.com/agent/planning-guide.md`.
3. **Valgfritt: installer ferdighetene.** Dette fungerer bare med en MCP-klient som støtter ferdigheter. Legg `SKILL.md` for *goed-plannen* og *progress-update* i `.claude/skills/goed-plannen/SKILL.md` og `.claude/skills/progress-update/SKILL.md` i prosjektmappen MCP-klienten arbeider i, eller under `~/.claude/skills/` for alle prosjekter.

Du får filene på to måter. Be MCP-klienten om å kalle verktøyet `planner_get_planning_guide` med `part` satt til `skill`: svaret inneholder begge tekstene og, for hver ferdighet, stedene der den hører hjemme. Eller last dem ned fra `https://open-planner-studio.open-aec.com/skills/goed-plannen/SKILL.md` og `https://open-planner-studio.open-aec.com/skills/progress-update/SKILL.md`. Hvis *goed-plannen* fortsatt ligger der fra en eldre versjon av appen, erstatt den: den gamle teksten er på nederlandsk og viser til hjelpeartikkelen i stedet for veiledningen for MCP-klienter.

Om MCP-klienten virkelig har lest veiledningen, ser du i *Aktivitetspanel*: da står det et kall til `planner_get_planning_guide`. Svaret til slutt skal inneholde en liste med antagelser: estimerte varigheter, den valgte oppdelingen, avhengigheter den selv har laget, og hver begrensning den har satt. Mangler den listen, spør du etter den. Etter en fremdriftsoppdatering etter *progress-update* skal svaret nevne statusdatoen, den nye sluttdatoen og avviket fra grunnlinjen.

## Fallgruver og hva appen gjør da

**MCP-klienten endrer noe som du vil angre.** Hver endring fra MCP-klienten er ett steg som du angrer med *Angre* (Ctrl+Z). En serie endringer som MCP-klienten sender inn samlet, er ett steg. Deretter vises prosjektet som ikke lagret. Etter en endring omberegnes tidsplanen, så du trenger ikke å trykke på F5 selv.

**Appen avviser et kall fra MCP-klienten.** Med *Avbrudd* og *Skrivebeskyttet* avviser appen alle endringer, men lesing er fortsatt mulig, også omberegning av en utdatert tidsplan. Hvis du selv er midt i en redigering, for eksempel når du drar en stolpe eller skriver i et felt, får MCP-klienten datoene fra før redigeringen din, med et varsel om at de er utdatert. Hvis du har en dialog åpen, for eksempel innstillingene, en aktivitetsdialog eller velkomstvinduet, eller presentasjonsmodus er på, avviser appen alle kall, også lesing, til du lukker dialogen. MCP-klienten får da en feilmelding med det interne navnet på det som er åpent, for eksempel `showTaskDialog`. Bare `planner_get_planning_guide` fungerer fortsatt, fordi den ikke leser tidsplanen din.

**Du bytter fane mens MCP-klienten arbeider.** MCP-klienten arbeider i dokumentet der den første endringen ble gjort. Hvis du bytter fane i mellomtiden, avviser appen neste endring til MCP-klienten har bekreftet at den vil arbeide i den andre fanen. Slik havner ingenting i feil prosjekt. Hvis MCP-klienten selv åpner eller dupliserer et dokument, arbeider den etterpå i det nye dokumentet.

**MCP-klienten skriver eller åpner en fil.** MCP-klienten kan skrive en tidsplan som IFC-fil og åpne en tidsplanfil som en ny fane. Den kan bare gjøre det i brukermappen din. Den overskriver bare en eksisterende fil hvis den uttrykkelig ber om det.

**Statusen er *Port 3877 i bruk*.** Et annet program bruker porten. Meldingen fra appen vises under den. Portfeltet blir da låst (*Kan bare endres mens serveren er stoppet.*), selv om broen ikke kjører, og det finnes ingen stoppknapp. Dette er en kjent svakhet. Inntil det er rettet, slår du *Tillat MCP-tilkobling* av og på igjen. Statusen står da tilbake på *Av*, og du kan velge en annen port. Kopier deretter tilkoblingsdetaljene på nytt, fordi endepunktet inneholder porten.

**Klienten kan ikke koble til etter et nytt token.** Et nytt token avbryter alle eksisterende koblinger. Gi klienten det nye tokenet, eller lim inn konfigurasjonsutdraget på nytt. Utvidelsen i Claude Desktop leser det nye tokenet selv; du trenger ikke å gjøre noe der.

**Du stoppet broen selv, og den starter ikke av seg selv.** *Start broen automatisk* virker én gang hver gang appen starter. Hvis du stopper broen selv, slår appen den ikke stille på igjen.

**Fanen *MCP* er borte.** MCP-tilkoblingen er av. Slå den på i steg 1.

**En nettside i nettleseren din kan ikke snakke med broen.** Broen avviser hver forespørsel som kommer fra en nettleser, og hver forespørsel uten riktig token.

## Uten appen

Det finnes også en MCP-server som fungerer uten skrivebordsappen: den **MCP-serveren uten grensesnitt**. Den tilbyr de samme `planner_*`-verktøyene, men den arbeider med en tidsplanfil på disken i stedet for med det åpne prosjektet ditt. Du ser derfor ikke endringene i Gantt-diagrammet, og *Angre* i appen gjelder ikke for dem. Bruk den når du ikke vil ha appen åpen, eller på en datamaskin uten skjerm.

Utvidelsen for Claude Desktop starter denne serveren av seg selv når appen er lukket (se trinn 3). Trinnene nedenfor gjelder for en annen MCP-klient, for eksempel Claude Code.

Utgivelsen inneholder ikke en ferdig server til nedlasting. Du bygger den fra kildekoden med `npm run build:mcp-server`; til det trenger du Node.js 22 eller nyere. Resultatet er én fil, `server.mjs`.

1. Velg en arbeidsmappe med tidsplanfilene dine. Serveren leser og skriver bare i den mappen.
2. Koble til MCP-klienten din. For Claude Code står kommandoen under disse trinnene.
3. Be MCP-klienten om å åpne en tidsplan, for eksempel `~/plan.ifc`. I denne serveren betyr `~` arbeidsmappen.
4. Be MCP-klienten om å lagre resultatet. Det finnes ingen automatisk lagring: MCP-klienten skriver filen med `planner_export_ifc`. Det som ikke lagres, går tapt når serveren stopper.

For trinn 2 i Claude Code gir du denne kommandoen i en terminal, med dine egne stier:

```
claude mcp add open-planner -- node /path/to/server.mjs --root /path/to/working-folder
```

Før den første endringen per dokument lager serveren en MCP-sikkerhetskopi, slik appen gjør. En MCP-klient som velger en sti utenfor arbeidsmappen, også via en snarvei (symbolsk lenke), får en avvisning. Mens appen er åpen, overskriver serveren ikke en eksisterende fil.

## Se også

- [Gi tilbakemelding](docs://howto-feedback-geven): hvis forbindelsen fungerer annerledes enn beskrevet her, meld det.
- [MCP-verktøy](docs://ref-ai-tools): alle `planner_*`-verktøy per gruppe, feilkodene og hvor lenge sikkerhetskopiene beholdes.
- [Appinnstillinger](docs://ref-instellingen): innstillingene for MCP.

# Forbind en MCP-klient

Mål: lad en MCP-klient læse med og arbejde på din tidsplan, med indsigt i, hvad den gør, og med grænser, som du selv sætter.

## Hurtigt: lad Claude gøre det

Arbejder du med Claude Desktop eller Claude Code? Så kan Claude selv installere forbindelsen:

1. Klik på *Kopiér prompt* nedenfor.
2. Indsæt prompten i en ny chat med Claude, og send den.

Claude installerer derefter udvidelsen til Open Planner Studio og forklarer undervejs, hvad den gør. Hvis du selv skal gøre noget, for eksempel at klikke på *Installér* i Claude Desktop, fortæller Claude dig præcis, hvilket klik du skal bruge. Du har ikke brug for et token til det.

```prompt
Installér udvidelsen til Open Planner Studio for mig, så du kan læse og ændre mine tidsplaner for byggeri i Open Planner Studio. Gør så meget, du selv kan. Før hvert trin skal du i én enkel sætning sige, hvad du gør, og hvorfor. Hvis du har brug for mig, så spørg om én ting ad gangen, og vent på mit svar. Hvis jeg selv skal gøre noget, så fortæl mig præcis, hvilket ene klik eller hvilken handling det er, og hvor.

Det skal du vide:
- Udvidelsen er én fil, open-planner-studio-<version>.mcpb, i den nyeste udgivelse: https://github.com/OpenAEC-Foundation/open-planner-studio/releases/latest. Den direkte adresse står i https://api.github.com/repos/OpenAEC-Foundation/open-planner-studio/releases/latest (den fil, hvis navn slutter på .mcpb). Filen er en ZIP-fil.
- Udvidelsen virker sammen med Open Planner Studio-desktopappen og uden appen. Når appen er åben, og dens MCP-bro kører, arbejder du i den plan, der er åben i appen. Når appen er lukket, arbejder du på tidsplanfiler i en arbejdsmappe, som jeg vælger.
- Installationen kræver ikke et token og ikke en adgangskode. Bed mig ikke om nogen af dem, og læs eller vis dem ikke.

Hvis du kører i Claude Desktop:
1. Hvis du kan downloade en fil og åbne den på min computer, så gør det med .mcpb-filen. Hvis du ikke kan, så giv mig den direkte downloadadresse, og bed mig om at dobbeltklikke på filen, når downloaden er færdig.
2. Claude Desktop viser derefter udvidelsen Open Planner Studio. Bed mig om at klikke på Installér. Bed mig derefter om at vælge den mappe med mine tidsplanfiler ved Working folder.
3. Bed mig om at starte en ny chat og at spørge dig der, hvilke Open Planner Studio-værktøjer du ser.

Hvis du kører i Claude Code:
1. Kontrollér, at Node.js 22 eller nyere er installeret. Hvis ikke, så fortæl mig, hvordan jeg installerer det, og stop.
2. Spørg mig, hvilken mappe der indeholder mine tidsplanfiler. Det er arbejdsmappen.
3. Download .mcpb-filen, og pak den ud i en ny mappe i min brugermappe, som kun er til den. Læs manifest.json der: server.mcp_config fortæller, hvordan serveren starter. Erstat ${__dirname} med den udpakkede mappe og ${user_config.workdir} med arbejdsmappen.
4. Kør claude mcp list. Hvis der allerede findes en server med navnet open-planner-studio, så spørg mig, om du må erstatte den. Vis ikke dens indstillinger, for de kan indeholde et token.
5. Tilføj serveren til min brugerkonto, for eksempel: claude mcp add open-planner-studio --scope user -e OPS_MCP_ROOT=<arbejdsmappe> -- node <udpakket mappe>/server/index.mjs
6. Bed mig om at starte en ny Claude Code-session, og om at /mcp dér viser, om open-planner-studio er forbundet.

Hvis du kører et andet sted, for eksempel claude.ai i browseren, så fortæl mig, at det kræver Claude Desktop eller Claude Code. Hvis du ikke ved, hvor du kører, så spørg mig.

Når installationen er færdig, forklar i nogle få sætninger:
- hvordan jeg lader dig arbejde i den åbne app: vælg i Open Planner Studio Indstillinger › Projekt › Appindstillinger, fanen Avanceret, og slå Tillad MCP-forbindelse til. Klik derefter på Start bro på fanen MCP.
- at en ændring uden appen først er i filen, når du har gemt den, og at du ikke overskriver en eksisterende fil, mens appen er åben.
Hvis et trin mislykkes, så fortæl mig i én sætning, hvad der gik galt, og hvad jeg kan gøre. Gæt ikke.
```

Foretrækker du at gøre det selv, eller bruger du en anden MCP-klient? Så følg trinene nedenfor.

## Når du har brug for dette

Du vil have en MCP-klient til at læse, analysere eller ændre din tidsplan. For eksempel for at få den til at lave et første udkast til en WBS, rette opgaver eller forklare den kritiske vej. Det sker via **Model Context Protocol** (MCP): en standard, der gør det muligt for et AI-program, **MCP-klienten**, at bruge værktøjer fra et andet program. Til det kører Open Planner Studio en lille server på din egen computer, **broen**. Den tilbyder et sæt værktøjer, som alle har et navn, der begynder med `planner_`: læse og ændre opgaver, afhængigheder, ressourcer, kalendere, oprindelige planer, dokumenter og filer. Hvilke der findes, og hvad de nægter at gøre, står i [MCP-værktøjer](docs://ref-ai-tools). MCP-klienten arbejder i det projekt, du har åbent, ikke i en kopi: en opgave, som den tilføjer, vises i Gantt med det samme. Den bruger den samme beregning og den samme historik for *Fortryd* som du.

Broen virker kun i desktopappen. Hvis du tillader MCP-forbindelsen i browseren, ser du fanen *MCP*, men knappen *Start bro* er grå med teksten *Broen virker kun i desktopappen.* Resten af denne artikel handler om desktopappen. I browseren er *Lav backup nu* og *Åbn backupmappe* også grå.

## Trin

### 1. Tillad MCP-forbindelsen

1. Vælg *Indstillinger › Projekt › App-indstillinger*. Du kan også vælge *Fil › App-indstillinger*, eller tandhjulet øverst.
2. Vælg fanen *Avanceret*, og slå *Tillad MCP-forbindelse* til. Fanen *MCP* vises i båndet.
3. Hvis broen skal være aktiv, så snart appen starter, slår du også *Start bro automatisk* til. Det virker kun, når MCP-forbindelsen er slået til, og kun i desktopappen. Det er som standard slået fra, fordi det at åbne en port er et bevidst valg.

Hvis du slår MCP-forbindelsen fra, stopper broen, og fanen *MCP* forsvinder.

### 2. Start broen

1. Gå til fanen *MCP*, og klik på *Start bro* under *Server*.
2. Kig på statussen ved siden af knappen. Der står *Fra*, *Aktiv på port 3877*, *Port 3877 er optaget* eller *Fejl*. Hvis starten lykkes, står der *Aktiv på port 3877*, og knappen hedder *Stop bro*. Med *Port 3877 er optaget* eller *Fejl* står knappen stadig på *Start bro*; se faldgruberne.

Broen lytter kun på din egen computer, på én port. Som standard er porten 3877. I gruppen *Forbindelse* kan du vælge en anden under *Port*, men kun mens broen er stoppet. Forbindelsen er almindelig HTTP på din egen computer. Appen selv sender intet ud. Hvad MCP-klienten gør med din tidsplan, for eksempel hvad dens udbyder gør med den, ligger uden for appen.

### 3. Forbind MCP-klienten

1. Klik på *Forbind* under *Forbindelse*. Vinduet *Forbindelsesoplysninger* åbnes.
2. Vælg det, din klient har brug for, se nedenfor.
3. Tokenet er skjult. Med øjeikonet viser du det. Kopiér-knapperne kopierer altid den rigtige værdi, også hvis skærmen skjuler tokenet.
4. Lad MCP-klienten bede om listen over værktøjer. Den kontrol står også i forbindelsesprompten: klienten skal se værktøjerne med præfikset `planner_`. Det forventede antal står i forbindelsesprompten.

Vinduet tilbyder fire måder at forbinde på:

- *Lad Claude klare det*: den samme prompt som øverst i denne artikel, med knappen *Kopiér prompt*. Den er til Claude Desktop og Claude Code. Du behøver ikke et token til den.
- *Konfigurationsuddrag*: et stykke konfiguration, som du indsætter i MCP-indstillingerne for din klient.
- *Forbindelsesprompt*: en tekst, som du indsætter i din MCP-klient, hvorefter den forbinder sig selv.
- *Endpoint* og *Godkendelse*: de separate oplysninger. Endpointet er `http://localhost:3877/mcp` med transporttypen *streamable HTTP*. Hver anmodning skal sende headeren `Authorization: Bearer`, efterfulgt af dit token. Din klient skal også understøtte MCP-sessioner: når den forbinder, giver broen en sessionkode i headeren `Mcp-Session-Id`, og broen afviser hver senere anmodning uden den kode. Claude Code og `mcp-remote` gør det selv.

**Forbind igen efter en opdatering af appen.** Hvis din MCP-klient allerede var forbundet til en ældre version af appen, sender den endnu ingen sessionkode, og broen afviser hver anmodning. Forbind derfor igen efter opdateringen: start en ny session i Claude Code, og afslut Claude Desktop helt, og start programmet igen.

**Claude Code.** Konfigurationsuddraget passer direkte til Claude Code. Skriv denne kommando i en terminal, med dit eget token i stedet for `<token>`:

```
claude mcp add --transport http open-planner-studio http://localhost:3877/mcp --header "Authorization: Bearer <token>"
```

Du kan også lægge uddraget i filen `.mcp.json` i din projektmappe. Læg så ikke den fil i git, for tokenet giver adgang til din tidsplan. En server fra `.mcp.json` skal godkendes første gang i Claude Code.

**Claude Desktop.** Til Claude Desktop findes en udvidelse: filen `open-planner-studio-<version>.mcpb`. Claude Desktop installerer den med et dobbeltklik. Du behøver ikke Node.js til den. Udvidelsen virker med appen og uden appen. Det går hurtigere med prompten øverst i denne artikel. Nedenfor står trinnene manuelt.

1. Hent filen `.mcpb` fra den seneste udgivelse: `https://github.com/OpenAEC-Foundation/open-planner-studio/releases/latest`.
2. Dobbeltklik på filen. Claude Desktop åbnes og viser udvidelsen *Open Planner Studio*. Installér den. Virker et dobbeltklik ikke, så åbn *Indstillinger › Udvidelser* i Claude Desktop, og installér filen dér.
3. Ved *Working folder* vælger du mappen med dine tidsplanfiler. Claude bruger kun denne mappe, når appen er lukket. Claude læser og skriver så kun i den mappe.
4. Slå udvidelsen til, og start en ny chat. Spørg Claude, hvilke værktøjer fra Open Planner Studio den ser.

Du skal hverken angive et token eller en port: mens broen kører, finder udvidelsen appen selv. For hvert spørgsmål fra Claude vælger udvidelsen igen:

- *Appen er åben, og broen kører*: Claude arbejder i den tidsplan, der er åben i appen. Du ser hver ændring i appen med det samme.
- *Appen er lukket, eller broen er slået fra*: Claude arbejder på en tidsplanfil i arbejdsmappen. En ændring står kun i filen, når Claude gemmer filen. Der sker ingen automatisk lagring. Mens appen er åben, overskriver Claude ikke en eksisterende fil, men gemmer den under et nyt navn.

Hvis appen åbnes eller lukkes, mens Claude arbejder, skifter udvidelsen og fortæller det til Claude. Claude vælger eller åbner så tidsplanen igen og ændrer først derefter noget. Har Claude stadig ændringer uden appen, som ikke er gemt, så arbejder udvidelsen videre uden appen, indtil Claude har gemt dem. Så går ingen ændringer tabt. Kan udvidelsen ikke nå appen, og der er ingen brugbar arbejdsmappe, ser Claude kun værktøjet `open_planner_studio_status`, med en besked om, hvad du skal gøre.

**Claude Desktop uden udvidelsen.** Kan du ikke bruge udvidelsen, så forbind Claude Desktop med det eksterne værktøj `mcp-remote`. Konfigurationsuddraget passer ikke direkte til Claude Desktop: i filen `claude_desktop_config.json` angiver du et program, som Claude Desktop selv starter, ikke en adresse. `mcp-remote` kræver Node.js. Vælg i Claude Desktop *Indstillinger › Developer › Edit Config*, indsæt dette i filen (med dit eget token), og start Claude Desktop igen:

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

Tokenet står i `env` og ikke i `args` med vilje: på Windows ødelægger Claude Desktop et argument, der indeholder et mellemrum. En *custom connector* i Claude (*Customize › Connectors*) virker ikke med broen. Claude forbinder så fra Anthropics sky, og den kan ikke nå broen på din egen computer.

I gruppen *Forbindelse* findes også feltet *Token*. Det er en lang, tilfældig kode, som appen laver til dig og gemmer på denne computer. I vinduet står der *Dette token giver adgang til den åbne tidsplan. Del det ikke med andre.* Med ikonet *Opret nyt token* laver du et nyt token. Appen spørger først *Oprettelse af et nyt token gør alle eksisterende forbindelser ugyldige. Fortsæt?* Kører broen, genstarter den med det nye token, og det gamle virker ikke længere.

**Sådan finder udvidelsen appen.** Mens broen kører, skriver desktopappen porten og tokenet til filen `mcp/runtime.json` i appens datamappe. Udvidelsen til Claude Desktop læser den fil ved hvert spørgsmål. På Linux og macOS kan kun din brugerkonto læse filen. På Windows beskytter standard-ACL'en i din profilmappe filen; appen kontrollerer det ikke apart. Når du stopper broen, eller slår MCP-forbindelsen fra, fjerner appen filen. Appen holder også en liste over åbne filer i `mcp/open-files.json`, også når MCP-forbindelsen er slået fra. Så længe den fil findes, overskriver udvidelsen og MCP-serveren uden app ikke nogen eksisterende fil, heller ikke en fil, du lige har åbnet, og som ikke står på listen endnu. En ny fil er tilladt. Læsning er også tilladt: Claude ser da versionen på disken, uden dine ugemte ændringer.

### 4. Se, hvad MCP-klienten gør

1. Klik på *Handlingspanel* under *Opgave*. I sidekolonnen åbnes panelet *MCP-aktivitet*.
2. Hvert kald til broen står på en linje, det nyeste øverst: tidspunkt, hvad der skete, hvor lang tid det tog, og om det lykkedes eller ikke. Klik på en linje for at udvide *Argumenter* og *Svar*.
3. Med *Ryd* tømmer du listen. Panelet gemmer de sidste 500 kald. Så længe der ikke er sket noget, står der *Endnu ingen MCP-aktivitet. Kald til broen vises her.*

Når MCP-forbindelsen er slået til, står der en prik med *MCP* nederst til højre i statuslinjen. Prikkens farve viser broens status, og et klik på den bringer dig til fanen *MCP*.

### 5. Sæt grænser

Under *Sikkerhed* står de knapper, som du begrænser MCP-klienten med:

- *Pausér*: MCP-klienten må midlertidigt ikke ændre noget, men læsning er stadig tilladt. Broen forbliver aktiv. Knappen skifter til *Genoptag*.
- *Skrivebeskyttet*: alle værktøjer, der ændrer noget, afvises, så længe det er slået til.
- *Automatisk backup: til*: før MCP-klientens første ændring i et dokument skriver appen en IFC-backup. Det er som standard slået til. Med knappen slår du det fra, og så står der *Automatisk backup: fra*. Dette sker én gang pr. dokument, hver gang du starter broen.
- *Lav backup nu*: laver straks en backup af det aktive dokument. Bagefter står der *Backup oprettet:* med filnavnet.
- *Åbn backupmappe*: åbner mappen med backupperne.

Backupperne ligger i mappen `ai-backups` i appens datamappe. Appen beholder de nyeste backups og rydder en del af de ældre op. Hvordan det præcis foregår, står i [MCP-værktøjer](docs://ref-ai-tools).

### 6. Lad MCP-klienten lave gode tidsplaner

En MCP-klient laver kun gode tidsplaner, hvis den kender tidsplanreglerne. Det gør du selv:

1. **Du behøver ikke gøre noget for kernereglerne.** De følger med, når du forbinder: broen sender dem i feltet `instructions` i MCP-håndtrykket. Om din klient lægger dem i sin systemprompt, afhænger af klienten.
2. **Lad MCP-klienten læse vejledningen.** Forbindelsesprompten fra vinduet *Forbindelsesoplysninger* beder MCP-klienten om at læse vejledningen med værktøjet `planner_get_planning_guide`. Bruger du ikke prompten, så skriv selv til klienten: *Læs tidsplanvejledningen med planner_get_planning_guide først, før du ændrer noget.* Du kan selv læse vejledningen på `https://open-planner-studio.open-aec.com/agent/planning-guide.md`.
3. **Valgfrit: installér skills.** Det virker kun med en MCP-klient, der understøtter skills. Læg `SKILL.md` for *goed-plannen* og *progress-update* i `.claude/skills/goed-plannen/SKILL.md` og `.claude/skills/progress-update/SKILL.md` i projektmappen, som MCP-klienten arbejder i, eller under `~/.claude/skills/` for alle projekter.

Du kan få filerne på to måder. Bed MCP-klienten kalde værktøjet `planner_get_planning_guide` med `part` sat til `skill`: svaret indeholder begge tekster og, for hver skill, de steder, hvor den hører hjemme. Eller download dem fra `https://open-planner-studio.open-aec.com/skills/goed-plannen/SKILL.md` og `https://open-planner-studio.open-aec.com/skills/progress-update/SKILL.md`. Står *goed-plannen* der stadig fra en ældre version af appen, så erstat den. Den gamle tekst er på nederlandsk og henviser til hjælpeartiklen i stedet for vejledningen for MCP-klienter.

Om MCP-klienten virkelig har læst vejledningen, kan du se i *Handlingspanel*: der står så et kald til `planner_get_planning_guide`. Svaret til sidst skal indeholde en liste over antagelser: anslåede varigheder, den valgte opdeling, afhængigheder, den selv har oprettet, og hver begrænsning, den har sat. Mangler listen, så bed om den. Efter en fremdriftsopdatering efter *progress-update* skal svaret nævne statusdatoen, den nye slutdato og afvigelsen i forhold til den oprindelige plan.

## Faldgruber og hvad appen gør så

**MCP-klienten ændrer noget, som du vil tage tilbage.** Hver ændring fra MCP-klienten er ét trin, som du fortryder med *Fortryd* (Ctrl+Z). En række ændringer, som MCP-klienten sender samlet, er ét trin. Bagefter vises projektet som ikke gemt. Efter en ændring beregnes tidsplanen igen, så du ikke behøver selv at trykke på F5.

**Appen afviser et kald fra MCP-klienten.** Med *Pausér* og *Skrivebeskyttet* afviser appen alle ændringer. Læsning er stadig mulig, og appen genberegner stadig en forældet tidsplan. Hvis du selv er midt i en redigering, for eksempel når du trækker i en bjælke eller skriver i et felt, får MCP-klienten datoerne fra før din redigering, med besked om at de er forældede. Har du en dialog åben, for eksempel indstillingerne, en opgavedialog eller velkomstvinduet, eller er præsentationstilstand slået til, så afviser appen alle kald, også læsning, til du lukker dialogen. MCP-klienten får så en fejlbesked med det interne navn på det, der er åbent, for eksempel `showTaskDialog`. Kun `planner_get_planning_guide` virker stadig, fordi den ikke læser din tidsplan.

**Du skifter fane, mens MCP-klienten arbejder.** MCP-klienten arbejder i det dokument, hvor dens første ændring blev lavet. Skifter du fane i mellemtiden, afviser appen dens næste ændring, indtil MCP-klienten bekræfter, at den vil arbejde i den anden fane. Så havner intet i det forkerte projekt. Åbner eller kopierer MCP-klienten selv et dokument, arbejder den bagefter i det nye dokument.

**MCP-klienten skriver eller åbner en fil.** MCP-klienten kan skrive en tidsplan som IFC-fil og åbne en tidsplanfil som en ny fane. Det kan den kun gøre i din brugermappe. Den overskriver kun en eksisterende fil, hvis den udtrykkeligt beder om det.

**Statussen er *Port 3877 er optaget*.** Et andet program bruger porten. Appens besked vises under statussen. Portfeltet forbliver så låst (*Kan kun redigeres, mens serveren er stoppet.*), selv om broen ikke kører, og der er ingen stopknap. Det er en kendt mangel. Indtil den er rettet: slå *Tillad MCP-forbindelse* fra og til igen. Så står statussen igen på *Fra*, og du kan vælge en anden port. Kopiér forbindelsesoplysningerne igen bagefter, for endpointet indeholder porten.

**Klienten kan ikke forbinde efter et nyt token.** Et nyt token gør alle eksisterende forbindelser ugyldige. Giv klienten det nye token, eller indsæt konfigurationsuddraget igen. Udvidelsen i Claude Desktop læser det nye token selv. Du behøver ikke gøre noget der.

**Du stoppede broen selv, og den starter ikke af sig selv.** *Start bro automatisk* virker én gang, hver gang appen starter. Stopper du broen selv, slår appen den ikke stille til igen.

**Fanen *MCP* er væk.** MCP-forbindelsen er slået fra. Slå den til i trin 1.

**En webside i din browser kan ikke tale med broen.** Broen afviser alle anmodninger, der kommer fra en browser, og alle anmodninger uden det rigtige token.

## Uden appen

Der findes også en MCP-server, der virker uden desktopappen: **MCP-serveren uden grafisk brugerflade**. Den tilbyder de samme `planner_*`-værktøjer, men den arbejder på en tidsplanfil på disken i stedet for på dit åbne projekt. Du ser derfor ikke ændringerne i Gantt-diagrammet, og *Fortryd* i appen gælder ikke for dem. Brug den, når du ikke vil have appen åben, eller på en computer uden skærm.

Udvidelsen til Claude Desktop starter denne server selv, når appen er lukket (se trin 3). Trinnene nedenfor er til en anden MCP-klient, såsom Claude Code.

Udgivelsen indeholder ingen færdig serverdownload. Du bygger den fra kildekoden med `npm run build:mcp-server`. Dertil skal du bruge Node.js 22 eller nyere. Resultatet er én fil, `server.mjs`.

1. Vælg en arbejdsmappe med dine tidsplanfiler. Serveren læser og skriver kun i den mappe.
2. Forbind din MCP-klient. For Claude Code står kommandoen under disse trin.
3. Bed MCP-klienten om at åbne en tidsplan, for eksempel `~/plan.ifc`. I denne server betyder `~` arbejdsmappen.
4. Bed MCP-klienten om at gemme resultatet. Der sker ingen automatisk lagring: MCP-klienten skriver filen med `planner_export_ifc`. Det, der ikke er gemt, går tabt, når serveren stopper.

For trin 2 i Claude Code skal du give denne kommando i en terminal, med dine egne stier:

```
claude mcp add open-planner -- node /path/to/server.mjs --root /path/to/working-folder
```

Før den første ændring i hvert dokument laver serveren en MCP-sikkerhedskopi, ligesom appen. En MCP-klient, der vælger en sti uden for arbejdsmappen, også via en genvej (symbolsk henvisning), får en afvisning. Mens appen er åben, overskriver serveren ikke en eksisterende fil.

## Se også

- [At give feedback](docs://howto-feedback-geven): hvis forbindelsen virker anderledes end beskrevet her, så meld det.
- [MCP-værktøjer](docs://ref-ai-tools): alle `planner_*`-værktøjer pr. gruppe, fejlkoderne og hvor længe sikkerhedskopierne gemmes.
- [Appindstillinger](docs://ref-instellingen): indstillingerne for MCP.

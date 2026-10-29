# Å planlegge godt

Hva gjør en tidsplan god? Ikke hvor pent den ser ut, men om den svarer på spørsmålet som betyr noe når arbeidet er i gang: hvis dette glipper, hva skjer da med overleveringen? Denne artikkelen forklarer prinsippene bak en pålitelig tidsplan, og hvorfor de betyr så mye i Open Planner Studio: appen beregner med det du legger inn, og ikke med noe annet.

Eksemplene kommer fra bygg og anlegg — konstruksjonsarbeid, ferdigstillingsarbeid, leveringstider, værforsinkelse, underentreprenører, en avtalt overleveringsdato — men prinsippene i seg selv er ikke knyttet til bygg og anlegg.

## Konseptet

En god tidsplan er ikke et bilde av det du håper på, men en **beregningsmodell**: aktiviteter med en varighet, koblet med avhengigheter, i en kalender. Appen beregner datoene ut fra den modellen. Når noe endres, omberegner modellen, og du ser med én gang hva det betyr for resten.

En planlegger arbeider i en fast rekkefølge:

1. Målet: milepæler og overleveringsdato.
2. Oppdelingen: faser, arbeidspakker, aktiviteter.
3. Varigheten til hver aktivitet.
4. Avhengighetene.
5. Begrensninger og faste datoer.
6. Kalendere.
7. Ressurser.
8. Kritisk linje og slakk.
9. Grunnlinje og fremdrift.
10. Gjennomgang.

Rekkefølgen er ikke bare god form. Hopper du over et trinn, kommer det tilbake som en overraskelse: aktiviteter uten avhengigheter flytter seg ikke med, varigheter uten kalender er feil, og en grunnlinje du bare lagrer i etterkant, fryser forsinkelsen i stedet for avtalen.

## Slik regner appen med den

Hvert prinsipp nedenfor er knyttet til noe appen gjør. Derfor følger denne delen samme rekkefølge.

### Start fra målet, ikke fra aktivitetene

Først setter du ned de tidspunktene som er faste, og deretter arbeidet som må passe mellom dem: start på klargjøring av byggeplassen, endelig tillatelse, værtett, start på ferdigstilling, overlevering. Dette er **milepæler**: punkter uten varighet. Du legger dem inn som milepæl (*Hjem › Aktiviteter › Milepæl ▾*), og ikke som en aktivitet på null dager med et navn som ligner på en milepæl.

Hvorfor denne rekkefølgen: en tidsplan som starter fra en liste med aktiviteter, blir en sum, og en sum treffer sjelden datoen i kontrakten. Start fra milepælene, så stiller du straks det riktige spørsmålet: ikke «hvor lang tid tar alt dette sammen», men «passer arbeidet mellom disse to tidspunktene, og hvis ikke, hva må endres». Regn baklengs fra den påkrevde overleveringsdatoen til det tidspunktet bygget senest må være værtett, og derfra til starten.

En overlevering som er fastsatt i kontrakt, får avmerkingsboksen *Obligatorisk (kontraktuelt)*, slik at alle som åpner filen, ser at dette tidspunktet verken kan forhandles eller flyttes. Avmerkingsboksen er et merke for Gantt-diagrammet og rapportene; den beskytter ikke en dato. Det gjør du med en tidsfrist eller en begrensning (se nedenfor).

### Nedbrytingen: faser, arbeidspakker, aktiviteter

Under milepælene bygger du strukturen: faser, under dem arbeidspakker, og under dem igjen aktiviteter. Det gjør du ved å rykke inn. En aktivitet med delaktiviteter blir automatisk en **hovedaktivitet**: appen utleder stolpen og varigheten fra aktivitetene under den. Angi derfor aldri selv en varighet for en hovedaktivitet.

Tommelfingerregelen for detaljeringsgraden: **en aktivitet varer mellom omtrent én dag og to uker**. Kortere enn en dag betyr at du planlegger selve byggeplassen i stedet for prosjektet. Det hører hjemme i byggelederens ukeplan, ikke i en beregningsmodell som skal vare i månedsvis. Lengre enn to uker betyr en aktivitet du ikke kan anslå godt og ikke kan følge opp under utførelsen: «finishing ground floor, 40 days, 45% complete» forteller ingen om det går bra. Ved tidsplangjennomganger telles derfor ofte hvor mange aktiviteter som varer lengre enn omtrent to måneder; over noen få prosent regnes det som mangel på detaljering.

For fin er like skadelig som for grov. Hver aktivitet koster vedlikehold: avhengigheter som må tegnes, fremdrift som må registreres, en ny vurdering etter hver endring. En tidsplan med to tusen aktiviteter for et prosjekt på seks måneder blir ikke mer nøyaktig, den blir uvedlikeholdt, og en tidsplan som ingen oppdaterer, er fiksjon etter tre uker. Velg det nivået der du kan rapportere fremdrift ærlig, hver uke.

I praksis: «3. Finishing» er en fase, «Finishing house 4» en arbeidspakke, og «Plastering house 4 ground floor» en aktivitet på fem dager. Du kan bevisst overskride den øvre grensen for leveringstider og løpende oppfølging: levering av vindusrammer på ti uker er virkelig én udelelig blokk med venting, og løpende oppfølging hører hjemme i en hengekøye, i stedet for i en rekke kunstige biter.

### Å anslå varighet

En varighet er et anslag for hvor lang tid arbeidet tar, ikke for hvor fort det kunne gått. Anslå for en vanlig dag med mannskapet du faktisk får, ikke for den beste dagen med det beste mannskapet. Optimisme vokser langs kjeden: en tidsplan der hver aktivitet forutsetter den beste dagen, treffer nesten aldri overleveringsdatoen.

Dager eller timer er et reelt valg, ikke formatering. Velg **dager** for arbeid som bestemmer tempoet på byggeplassen, som murarbeid, pussing og flislegging: det tar fem dager, selv om en dag tilfeldigvis har åtte eller ni timer. Velg **timer** når timene selv er enheten og resten av dagen har betydning: en inspeksjon på tre timer, en betongstøp på fjorten timer fordelt på to dager, skiftarbeid. Appen lagrer valget per aktivitet. Du finner valget først når du har slått på *Slå på timeplanlegging*; se [Dager og timer](docs://uitleg-dagen-en-uren).

Skjul ikke risiko inne i enkeltvarigheter. Hvis du legger til en dag overalt, gjemmes margen bort, slik at ingen kan se eller styre den lenger, og der margen virkelig trengtes, viser det seg å være for liten. Gjør reserven synlig: en eksplisitt bufferaktivitet før overleveringsdatoen, eller en egen værreserve. Pass på dobbelttelling: de rundt 180 arbeidbare arbeidsdagene i året som nederlandsk byggebransje regner med, er et kontraktfestet tall per år (UAV) der helligdager, byggferien *og* tapte dager allerede er trukket fra. Hvis helligdagene og byggferien allerede står i prosjektkalenderen, gjenstår bare tapte dager på grunn av vær som eget punkt. Frost og storm følger egne regler i tariffavtalen Onwerkbaar weer Bouw & Infra. Legg de forventede tapte dagene i kalenderen eller i et eget punkt, ikke gjemt inne i varigheten av murarbeidet.

### Avhengigheter: uten et nettverk er det ikke en tidsplan

Appen regner ut datoene langs **avhengighetene**: en aktivitet starter først når forgjengerne tillater det. En aktivitet uten avhengigheter er ikke knyttet til noe. Hvis konstruksjonsarbeidet glipper med to uker, følger ikke en frakoblet ferdigstillingsaktivitet med, og tidsplanen gir feil bilde uten at noe blir rødt.

Derfor får hver aktivitet minst én forgjenger og minst én etterfølger. Bare den første aktiviteten i prosjektet og den siste milepælen er unntatt. I en tidsplangjennomgang er dette den første kontrollen: høyst noen få prosent av aktivitetene kan mangle logikk.

**Slutt-til-start er standard**, og slik skal det være: fundamentet er ferdig, deretter konstruksjonsarbeidet. I en sunn byggetidsplan er omtrent ni av ti avhengigheter slutt-til-start. Det er et krav til lesbarhet: slutt-til-start er den eneste typen som alle på byggeplassen forstår uten forklaring, og den oppfører seg forutsigbart under utførelsen.

**Start-til-start med forsinkelse** er for arbeid som virkelig går parallelt i stedet for å vente. Det klassiske eksempelet er en rekke rekkehus eller et tårn med etasjer: installatøren følger tre dager etter murarbeidet. Det er en start-til-start med tre dagers forsinkelse, ikke en slutt-til-start på en kunstig oppstykket aktivitet. Sett en slutt-til-slutt ved siden av den, ellers kan etterfølgeren i teorien bli ferdig før forgjengeren. I bygg bruker du nesten aldri start-til-slutt.

Tegn helst den start-til-start mellom aktiviteter, ikke mellom faser. Hvis forgjengeren til en start-til-start eller start-til-slutt er en fase, lar appen etterfølgeren vente på aktiviteten i den fasen som starter **sist**, ikke på den første. Dermed planlegges det aldri for tidlig, men noen ganger senere enn du mente. Slutt-til-start og slutt-til-slutt med en fase som forgjenger venter på at den siste aktiviteten i fasen blir ferdig, og det er vanligvis akkurat det du mener.

Vær sparsom med forsinkelser, og særlig med negative. En forsinkelse er ventetid uten synlig årsak: ingen kan senere se hvorfor det er sju dager mellom. Er det betongherding, gjør det til en forsinkelse i kalenderdager (betong herder også i helgen), eller helst en egen aktivitet «curing» som alle kan se og følge. En negativ forsinkelse — en ledetid, en overlapping — skal egentlig ikke finnes i det hele tatt; ved gjennomgang av tidsplanen er normen null. Vil du ha overlapping, del forgjengeren opp, eller bruk en start-til-start.

### Begrensninger og faste datoer: så få som mulig

Hver aktivitet starter som «så tidlig som mulig», og i det overveldende flertallet av tilfellene skal den bli der. En **begrensning** er en datogrense ved siden av avhengighetene. Jo flere du legger til, desto mindre regner tidsplanen, og desto mer blir den en tegning. En plan full av faste datoer ser stabil ut og skjuler risikoen nettopp derfor: den beveger seg ikke lenger, så den advarer heller ikke.

Bruk bare en begrensning for en hard ekstern dato som tidsplanen selv ikke kan påvirke: tillatelsen som ikke blir endelig før 1. mars (*Start ikke tidligere enn (SNET)*), stengingsvinduet kommunen har innvilget, tilkoblingsdatoen hos netselskapet. «Jeg vil ha denne aktiviteten i mai» er ikke et eksternt faktum; det løser du med logikk eller en annen varighet. Som tommelfingerregel har høyst noen få prosent av de gjenstående aktivitetene en hard datogrense.

Skriv aldri inn en startdato for å få en aktivitet på plass. Har en aktivitet en forgjenger, gjør appen en innskrevet (eller dratt) start om til en begrensning *Start ikke tidligere enn (SNET)*. Aktiviteten står da der du vil ha den, og blir stående der selv når hele kjeden før den blir forsinket.

Vil du følge en dato uten å styre beregningen, bruk en **tidsfrist**. Den flytter ingenting, men gir negativ slakk og en advarsel så snart aktiviteten ikke lenger oppfyller den. Det er nettopp signalet du vil se. Behold en hard fastlåsing (*Obligatorisk (fastlåsing)*) for ekstremtilfellet, og vit da at den gir negativ slakk i kjeden foran den: tidsplanen sier at det ikke passer, ikke at noe er ødelagt.

### Kalendere: først prosjektet, deretter unntakene

Alle varigheter telles i arbeidsdager eller arbeidstimer i en kalender. Sett derfor opp prosjektkalenderen riktig før du legger inn varigheter: arbeidsdager, arbeidstider, helligdager og byggferien. En kalender du retter halvveis, flytter hele tidsplanen. Legg straks inn de forutsigbare stengingene: frosttiden da du ikke støper betong, bedriftens nedstengning mellom jul og nyttår.

Gi bare en ressurs en egen kalender hvis den virkelig avviker: fasademontøren som kommer fire dager i uken, mannskapet som tar en annen sommerferie. En ressurskalender endrer ikke én eneste dato for en aktivitet. Aktiviteten fortsetter å gå etter aktivitets- eller prosjektkalenderen. Den viser bare at ressursen ikke jobber en av aktivitetens arbeidsdager, og det vises som overallokering i histogrammet. Den forskjellen er vanskelig å få øye på hvis du ikke vet at du selv laget den.

### Ressurser: hvem gjør det, og er det mulig

En tidsplan uten ressurser svarer bare på halvparten av spørsmålet. Så snart du tildeler mannskapene og utstyret, viser histogrammet det en tidslinje alene ikke kan vise: at du den 14. juni trenger tre pussemannskaper, mens du bare har to.

Start med ressursene som er knappe. Ikke alle skruer trenger å være med; tårnkranen, egne mannskaper, underleverandørene med et kapasitetstak og de lange leveringstidene må. Gi hver ressurs en ærlig kapasitet: to pussere betyr to, ikke «to, men tre i nødstilfelle».

Les histogrammet som et spørsmål, ikke som en feil. Rødt over linjen betyr at tidsplanen krever mer enn du har den dagen. Noen ganger er svaret: flytt. Ofte er svaret: dette går ikke, og det var det jeg ville vite. **Utjevning** flytter aktiviteter til etterspørselen passer innenfor kapasiteten. Hvis sluttdatoen kan tøye seg, tillat det; er overleveringsdatoen fast, utjevn bare innen slakken (avmerkingsboksen *Kun utjevning innen slakk (smoothing) — prosjektets sluttdato forblir fast*). Sluttdatoen blir da stående, og du får en rapportert restkonflikt. Det er et ærligere resultat enn en tidsplan som bare ser løst ut.

*Ikke* utjevn når etterspørselen strukturelt er større enn kapasiteten. Utjevning ordner eksisterende arbeid på nytt i tid; den leier ikke inn flere pussere og bygger ikke en kran til. Tre tårn som trenger samme mannskap samtidig, er fortsatt tre tårn som trenger samme mannskap etter utjevningen; det eneste som endrer seg, er at overleveringen flyttes. Det som hjelper da, er fasing, mer kapasitet eller annet arbeid. Utjevn heller ikke før logikken og varighetene er på plass: du ville utjevnet en tidsplan som er annerledes i morgen.

### Kritisk linje og slakk: der tidsplanen er sårbar

Appen regner ikke om ved hver endring. Kjør beregningen med **Beregn** (F5) og les først etterpå. Hvis statuslinjen viser *Utdatert — omberegn (F5)*, ser du på forrige beregning, ikke den nye. Med innstillingen *Beregne automatisk* gjør appen det selv.

Den **kritiske linjen** er kjeden uten slakk: hver dag som går tapt der, er en dag senere overlevering. Dit går oppfølgingen og de beste folkene dine. Se ikke bare på rødt. **Totalslakk** sier hvor langt en aktivitet kan bli forsinket uten å påvirke overleveringen; **fri slakk** sier hvor langt den kan bli forsinket uten å flytte etterfølgeren. Forskjellen påvirker ingens sluttdato, men den står i veien for noen — nyttig når du jobber med underleverandører du ikke kan planlegge om to ganger.

Hold øye med tre signaler. En aktivitet med noen få dagers slakk er ikke en trygg aktivitet, men en nesten kritisk. Med *Marker nesten kritisk* får slike aktiviteter sin egen farge. En aktivitet med ekstremt mye slakk — i tidsplangjennomganger mer enn 44 arbeidsdager, omtrent to måneder — mangler nesten alltid en etterfølger; det peker deg rett mot hullene i nettverket ditt. Og negativ slakk er aldri en beregningsfeil: det er tidsplanen som sier at en tidsfrist eller en fast dato ikke passer.

### Grunnlinje før start, og hold den deretter oppdatert

Lagre en **grunnlinje** så snart tidsplanen er godkjent, og før det første spadestikket (*Tidsplan › Grunnlinjer og fremdrift › Administrer grunnlinjer…*). Beregn først: grunnlinjen lagrer datoene fra den siste beregningen. Uten den referansen kan du senere bare si *at* ting går annerledes, ikke hvor mye eller siden når, og det er nettopp det du trenger på byggemøtet, ved ekstra arbeid og når det blir drøftet at arbeidet er blitt forsinket.

En grunnlinje lagrer datoene, men ikke forutsetningene bak dem, og nettopp de blir spurt etter så snart det blir drøftet at arbeidet er blitt forsinket. Når du lagrer den, skriv derfor kort ned hva denne tidsplanen bygger på (i planleggingspraksis: *tidsplangrunnlaget*): hvilke produktivitetstall du har brukt, hvilken kalender og hvorfor den er satt slik, hva du bevisst har holdt utenfor tidsplanen, hvem som ga leveringstidene du har lagt til grunn, og hvem som godkjente tidsplanen. En halv side er nok.

Etterpå er det å holde den oppdatert en rytme, ikke et prosjekt. Oppdater ukentlig, i samme rekkefølge: sett **statusdatoen** til rapporteringsdatoen, registrer faktisk start og faktisk slutt for det som har startet og blitt ferdig, korriger den gjenstående varigheten for det som pågår, og beregn. En prosentandel alene er ikke nok: faktiske datoer er de konkrete opptegnelsene som senere blir sjekket.

Vit hva statusdatoen gjør: arbeid som ennå ikke er startet, flyttes av appen til statusdatoen, og aktivitetene etter det flytter med (unntatt i beregningsprofilen Microsoft Project). Hvis du glemmer å melde av en ferdig aktivitet eller milepæl, flytter den seg altså selv til høyre. Det er ikke en feil, men modellen som nekter å late som om noe i fortiden fortsatt kan skje. Får du advarselen *Utenfor rekkefølge*, er arbeidet utført i en annen rekkefølge enn logikken foreskriver; da er det vanligvis en grunn til å revidere rekkefølgen, ikke til å klikke advarselen bort. Opprett bare en ny grunnlinje ved en reell endring av omfanget, og da ved siden av den første, ikke over den.

Til slutt: en tidsplan er bare pålitelig hvis de som gjør arbeidet, tror på den. La byggelederen og underleverandørene holde ukeplanen opp mot denne modellen. Hvis du uke etter uke bare oppnår halvparten av det som er avtalt, ligger problemet oftere i tidsplanen enn i utførelsen.

## Gjennomgått eksempel: tre valg som gjør at tidsplanen stille blir feil

Tallene kommer fra to eksempler som er gjennomregnet andre steder i Hjelp: praksisprosjektet *House extension* fra opplæringene, og et lite nettverk for et tilbygg. Her er poenget hva hvert valg gjør med tidsplanen din. Du prøver det selv i opplæring 2 (avhengigheter og kritisk linje) og opplæring 3 (en begrensning og en tidsfrist).

### En glemt avhengighet

I tilbygget starter byggearbeidet mandag 7. juni 2027, og overleveringen er fredag 6. august. *Build outer cavity leaf* (6 arbeidsdager) har *Install window frames* som etterfølger, fordi vinduskarmene sitter i fasaden. Med den avhengigheten har den ytre skalmuren 2 arbeidsdager slakk.

Glemmer du den avhengigheten, får den ytre skalmuren plutselig 23 arbeidsdager slakk, frem til overlevering. På papiret kan det bli flere uker forsinket uten at noen venter. Ingenting blir rødt, og ingen advarsel vises. Bare med beregningsalternativet *Åpne-ende aktiviteter er kritiske* blir en slik aktivitet uten etterfølger kritisk, slik at hullet blir synlig.

### En innskrevet dato i stedet for en avhengighet

Det lille nettverket: *Groundwork* (3 arbeidsdager), *Pour foundation* (2), *Brickwork* (5) og *Roofing* (3), etter hverandre fra mandag 7. juni 2027. Prosjektet er ferdig onsdag 23. juni.

Skriver du inn en start på mandag 21. juni for *Brickwork*, fordi murstein først kommer da, blir det en begrensning av typen *start ikke tidligere enn*. *Brickwork* flytter en uke, og prosjektet er ferdig onsdag 30. juni. *Groundwork* og *Pour foundation* får 5 arbeidsdager slakk og er ikke lenger kritiske. Kommer murstein likevel tidligere, blir *Brickwork* stående på 21. juni: nå styrer datoen, ikke logikken.

Skriver du i stedet inn onsdag 9. juni, før fundamentet er ferdig, skjer det ingenting: avhengighetene lar *Brickwork* uansett starte tidligst mandag 14. juni.

### En tidsfrist i stedet for en begrensning

Vil du at *Roofing* er ferdig fredag 18. juni, legg inn en tidsfrist der. Ingenting flytter seg: *Roofing* blir stående fra mandag 21. til onsdag 23. juni. Men kjeden får −3 arbeidsdager slakk, og appen melder *Tidsfrist 18-06-2027 oversittet — tidligste slutt 23-06-2027*. Da ser du med en gang at avtalen ikke passer, i stedet for en stolpe på riktig plass med en kjede bak som ikke klarer det.

## Konsekvenser og misforståelser

- **Aktiviteter uten forgjenger eller etterfølger.** Den vanligste og mest skadelige: slike aktiviteter flytter seg ikke med, og får falsk slakk.
- **Å skrive inn datoer eller dra stolper i stedet for å tegne logikken.** Da settes en begrensning stille.
- **For mange begrensninger, og en hard låsing brukt som bokmerke.** Tidsplanen regnes da ikke lenger ut, den bare tegnes.
- **Aktiviteter på tre måneder, eller på en halv dag.** Mellom omtrent én dag og to uker er det brukbare området.
- **Optimistiske varigheter, og reserve skjult i hver enkelt aktivitet** i stedet for synlig som buffer.
- **Værforsinkelse og byggferie som ikke står i kalenderen.** De havner der likevel i januar.
- **Forsinkelser i stedet for aktiviteter.** Sju dager med ventetid uten navn er uforklarlig tre måneder senere.
- **Utjevning før logikken er på plass**, eller fortsette å utjevne mot en strukturell mangel på kapasitet.
- **Å glemme å beregne.** *Utdatert* i statuslinjen betyr at du ser på forrige beregning.
- **Ingen grunnlinje, eller en grunnlinje som bare er lagret etter start.**
- **Fremdrift registrert bare som prosent**, uten faktiske datoer og uten statusdato.
- **Å lukke panelet *Advarsler* uten å lese det.** Der samles de oversittede tidsfristene, brutte begrensningene, avhengighetene utenfor rekkefølge og de overallokerte ressursene (*Planlegging › Tidsplan › Advarsler*).

## Se også

- [Kritisk linje og slakk](docs://uitleg-kritiek-pad): hvordan appen regner ut tidligste og seneste datoer og slakk.
- [Avhengigheter og forsinkelse](docs://uitleg-relaties): de fire typene avhengighet, forsinkelse og avhengigheter på en fase.
- [Begrensninger og tidsfrister](docs://uitleg-constraints): hva hver begrensning og en tidsfrist gjør med beregningen.
- [Kalendere og arbeidsdager](docs://uitleg-kalenders): hvordan appen teller arbeidsdager, og hvilken kalender som går foran.
- [Dager og timer](docs://uitleg-dagen-en-uren): planlegging i dager, i timer eller i en blanding.
- [Ressursutjevning](docs://uitleg-nivelleren): hva utjevning flytter, og hva den ikke flytter.
- [Fremdrift, statusdato og grunnlinje](docs://uitleg-voortgang): hva statusdatoen gjør, og hvordan du leser avvik.
- [Legge til aktiviteter og milepæler](docs://howto-taken-en-mijlpalen-toevoegen): hvordan du legger inn milepæler og aktiviteter.
- [Legge til avhengigheter](docs://howto-relaties-leggen): hvordan du kobler aktiviteter sammen.
- [Koble til en KI-assistent (MCP)](docs://howto-ai-assistent-koppelen): en assistent som planlegger etter disse prinsippene.
- [Meldinger og advarsler](docs://ref-meldingen): alle advarsler på ett sted.

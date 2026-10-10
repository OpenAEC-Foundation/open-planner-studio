# Planera bra

Vad gör en tidsplan bra? Inte hur snyggt den ser ut, utan om den svarar på den fråga som räknas när arbetet är igång: om det här glider, vad händer då med överlämningen? Den här artikeln förklarar principerna bakom en tillförlitlig tidsplan, och varför de väger så tungt i Open Planner Studio. Appen räknar med det du matar in, och med ingenting annat.

Exemplen kommer från byggbranschen: konstruktionsarbeten, ytskiktsarbeten, ledtider, väderförseningar, underentreprenörer och ett avtalat överlämningsdatum. Principerna i sig är inte specifika för byggbranschen.

## Begreppet

En bra tidsplan är inte en bild av vad du hoppas på. Den är en **beräkningsmodell**: uppgifter med en varaktighet, kopplade med samband, i en kalender. Appen räknar ut datumen utifrån den modellen. När något ändras beräknar modellen om. Du ser direkt vad det betyder för resten.

En planerare arbetar i en fast ordning:

1. Målet: milstolpar och överlämningsdatum.
2. Nedbrytningen: faser, arbetspaket, uppgifter.
3. Varaktigheten för varje uppgift.
4. Sambanden.
5. Restriktioner och fasta datum.
6. Kalendrar.
7. Resurser.
8. Kritisk linje och slack.
9. Baslinje och framdrift.
10. Granskning.

Ordningen är inte en etikett. Hoppar du över ett steg blir det en överraskning senare. Uppgifter utan samband flyttas inte när något annat ändras. Varaktigheter utan kalender blir fel. En baslinje som du sparar först i efterhand fryser förseningen i stället för överenskommelsen.

## Så räknar appen med tidsplanen

Varje princip nedan hör ihop med något som appen gör. Därför följer det här avsnittet samma ordning.

### Börja från målet, inte från uppgifterna

Lägg först de tidpunkter som ligger fast. Lägg sedan in arbetet som ska passa mellan dem: start av platsförberedelse, slutgiltigt bygglov, vattentätt, start av ytskikt, överlämning. Det är **milstolpar**: punkter utan varaktighet. Du lägger in dem som milstolpe (*Start › Uppgifter › Milstolpe ▾*). Lägg dem inte in som en uppgift med noll dagars varaktighet och ett namn som liknar en milstolpe.

Varför i den här ordningen: en tidsplan som börjar från en lista med uppgifter blir en summa. En summa hamnar sällan på det datum som står i kontraktet. Börja från milstolparna, då ställs rätt fråga direkt. Frågan är inte ”hur lång tid tar allt det här tillsammans”. Frågan är ”ryms arbetet mellan dessa två tidpunkter, och om inte, vad måste ändras”. Räkna bakåt från det datum då överlämningen krävs, till när byggnaden senast måste vara vattentät. Räkna sedan vidare bakåt till starten.

En överlämning som är fast enligt kontraktet får kryssrutan *Obligatorisk (avtalsenlig)*. Då ser alla som öppnar filen att tidpunkten varken går att förhandla om eller flytta. Kryssrutan är en markering för Gantt-vyn och rapporterna. Den skyddar inte ett datum. Det gör du med ett måldatum eller en restriktion (se nedan).

### Uppdelningen: faser, arbetspaket, uppgifter

Under milstolparna bygger du strukturen: faser, under dem arbetspaket och under dem uppgifter. Du gör det med indrag. En uppgift med underuppgifter blir automatiskt en **sammanfattningsuppgift**. Appen räknar fram dess balk och varaktighet från uppgifterna under den. Ange därför aldrig själv en varaktighet för en sammanfattningsuppgift.

Tumregeln för detaljnivån: **en uppgift varar ungefär en dag till två veckor**. Kortare än en dag betyder att du planerar byggplatsen i stället för projektet. Det hör hemma i platschefens veckoplan, inte i en beräkningsmodell som ska hålla i månader. Längre än två veckor betyder en uppgift som du inte kan uppskatta ordentligt och inte kan följa upp under utförandet. ”Finishing ground floor, 40 days, 45% complete” säger ingen om det går bra. Granskningar av tidsplanen räknar därför ofta hur många uppgifter som varar längre än ungefär två månader. Ligger det över några procent, räknas det som brist på detalj.

För fin detaljnivå skadar lika mycket som för grov. Varje uppgift kostar underhåll: samband att rita, framdrift att registrera, en ny bedömning efter varje ändring. En tidsplan med tvåtusen uppgifter för ett projekt på sex månader blir inte mer exakt. Den blir ouppdaterad. Och en tidsplan som ingen uppdaterar är fiktion inom tre veckor. Välj den nivå där du kan rapportera framdriften ärligt, varje vecka.

I praktiken: ”3. Finishing” är en fas, ”Finishing house 4” ett arbetspaket och ”Plastering house 4 ground floor” en uppgift på fem dagar. Du får medvetet överskrida den övre gränsen för ledtider och tillsyn. En leverans av fönsterramar som tar tio veckor är verkligen ett oavbrutet block av väntetid. Och kontinuerlig tillsyn hör hemma i en hängmatta, inte i en serie konstgjorda bitar.

### Att uppskatta varaktighet

En varaktighet är en uppskattning av hur lång tid arbetet tar. Den är inte en uppskattning av hur snabbt det skulle kunna gå. Uppskatta för en normal dag med den arbetsgrupp du faktiskt får. Uppskatta inte för den bästa dagen med den bästa gruppen. Optimism adderas längs kedjan. En tidsplan där varje uppgift utgår från den bästa dagen klarar nästan aldrig överlämningsdatumet.

Dagar eller timmar är ett verkligt val, inte en formatering. Välj **dagar** för arbete som styr takten på byggplatsen, till exempel murning, putsning och kakling. Det tar fem dagar, oavsett om en dag råkar bli åtta eller nio timmar. Välj **timmar** när timmarna i sig är enheten och resten av dagen spelar roll: en inspektion på tre timmar, en betonggjutning på fjorton timmar uppdelad på två dagar, skiftarbete. Appen sparar det valet per uppgift.

Dölj inte risk i enskilda varaktigheter. Om du lägger till en dag överallt, döljs marginalen. Då kan ingen längre se den eller styra den. Och där marginalen verkligen behövdes visar det sig vara för liten. Gör reserven synlig: en tydlig buffertuppgift före överlämningsdatumet, eller en separat tilläggstid för väder. Se upp för dubbelräkning. De cirka 180 arbetsbara dagarna per år som den nederländska byggsektorn räknar med är en avtalad årssiffra (UAV). Från den siffran är allmänna helgdagar, byggsemestern *och* förlorade dagar redan avdragna. Om helgdagarna och byggsemestern redan finns i projektets kalender återstår bara väderförlust som ett separat moment. Tjäle- och stormförlust följer egna regler i kollektivavtalet Onwerkbaar weer Bouw & Infra. Lägg de väntade förlorade dagarna i kalendern eller i ett eget moment. Göm dem inte i varaktigheten för murningen.

### Samband: utan ett nätverk är det ingen tidsplan

Appen räknar ut datumen längs **sambanden**. En uppgift börjar först när de föregående uppgifterna tillåter det. En uppgift utan samband är inte kopplad till något. Om stomkonstruktionen blir två veckor försenad följer en frikopplad uppgift för ytskikt inte med. Då ljuger tidsplanen, utan att något blir rött.

Därför får varje uppgift minst en föregående och minst en efterföljande uppgift. Enbart projektets första uppgift och sista milstolpe är undantagna. Vid en granskning av tidsplanen är detta den första kontrollen: högst några procent av uppgifterna får sakna logik.

**Slut-till-start är standard**, och det ska det fortsätta att vara. Grunden blir klar, sedan börjar stomkonstruktionen. I en sund byggtidsplan är ungefär nio av tio samband slut-till-start. Det är ett krav på läsbarheten. Slut-till-start är den enda typen som alla på byggplatsen förstår utan förklaring. Och den beter sig förutsägbart under utförandet.

**Start-till-start med fördröjning** är till för arbete som verkligen går parallellt i stället för att vänta. Det klassiska fallet är en radhuslänga eller ett torn med våningar: installatören följer tre dagar efter murningen. Det är en start-till-start med tre dagars fördröjning. Det är inte en slut-till-start på en konstgjord uppdelad uppgift. Lägg en slut-till-slut bredvid den. Annars kan den efterföljande uppgiften i teorin bli klar före den föregående. I byggbranschen använder man nästan aldrig start-till-slut.

Dra helst start-till-start-sambandet mellan uppgifter, inte mellan faser. Om den föregående i en start-till-start eller start-till-slut är en fas, låter appen den efterföljande uppgiften vänta på den uppgift i fasen som startar **sist**, inte på den första. Så planeras det aldrig för tidigt, men ibland senare än du menade. Slut-till-start och slut-till-slut med en fas som föregående väntar på att den sista uppgiften i fasen blir klar. Det är oftast precis vad du menar.

Var sparsam med fördröjningar, och framför allt med dem under noll. En fördröjning är väntetid utan synlig orsak. Ingen kan senare se varför det finns sju dagar mellan. Handlar det om betongens härdning, gör det till en fördröjning i kalenderdagar. Betong härdar även i helgen. Ännu bättre är en verklig uppgift ”curing” som alla kan se och följa. En fördröjning under noll, alltså ett överlapp, borde egentligen inte finnas alls. Vid en granskning av tidsplanen är normen noll. Vill du ha ett överlapp, dela upp den föregående uppgiften eller använd en start-till-start.

### Restriktioner och fasta datum: så få som möjligt

Varje uppgift har från början restriktionen ”så tidigt som möjligt”, och i de allra flesta fall ska det förbli så. En **restriktion** är en datumgräns vid sidan av sambanden. Ju fler du lägger till, desto mindre räknar tidsplanen ut. Och desto mer blir den en teckning. En plan full med fasta datum ser stabil ut och döljer just därför risken. Den rör sig inte längre, så den varnar inte längre.

Använd en restriktion enbart för ett hårt externt datum som tidsplanen inte kan påverka. Till exempel bygglovet som inte blir slutgiltigt före 1 mars (*Starta tidigast*), det avstängningsfönster som kommunen har beviljat eller datumet för anslutningen hos nätbolaget. ”Jag vill ha den här uppgiften i maj” är inte ett externt faktum. Det löser du med logik eller med en annan varaktighet. Tumregeln är att högst några procent av de återstående uppgifterna har en hård datumgräns.

Skriv aldrig in ett startdatum för att placera en uppgift där du vill ha den. För en uppgift med en föregående uppgift gör appen en inskriven eller dragen start till restriktionen *Starta tidigast (SNET)*. Uppgiften står då där du vill ha den. Och den står kvar där även när hela kedjan före den blir försenad.

Vill du följa ett datum utan att styra beräkningen, använd ett **måldatum**. Det flyttar ingenting. Men det ger negativt slack och en varning så snart uppgiften inte längre klarar datumet. Precis den signalen vill du se. Använd en hård fästpunkt (*Obligatorisk (pinlogik)*) för extrema fall, och var då medveten om att den ger negativt slack i kedjan före den. Det betyder att tidsplanen säger att det inte passar. Det betyder inte att något är trasigt.

### Kalendrar: först projektet, sedan undantagen

Alla varaktigheter räknas i arbetsdagar eller arbetstider i en kalender. Ställ därför in projektets kalender ordentligt innan du anger varaktigheter: arbetsdagar, arbetstider, allmänna helgdagar och byggsemestern. En kalender som du rättar halvvägs förskjuter hela tidsplanen. Lägg direkt in de avstängningar du kan förutse: frostperioden då du inte gjuter betong, företagets nedstängning mellan jul och nyår.

Ge en resurs bara en egen kalender om den verkligen skiljer sig. Det gäller till exempel fasadmontören som kommer fyra dagar i veckan eller arbetsgruppen som tar en annan sommarledighet. En kalender för en resurs ändrar inte ett enda datum för en uppgift. Datumen följer fortfarande uppgiftens eller projektets kalender. Kalendern visar bara att resursen inte arbetar en av uppgiftens arbetsdagar. Det syns som överbeläggning i histogrammet. Den skillnaden är svår att se om du inte vet att du själv har skapat den.

### Resurser: vem gör arbetet, och är det möjligt

En tidsplan utan resurser besvarar bara halva frågan. Så snart du tilldelar arbetsgrupper och utrustning visar histogrammet det som en tidslinje ensam inte visar. Till exempel att du den 14 juni behöver tre putsgrupper men bara har två.

Börja med de resurser som begränsar. Inte alla skruvar behöver med. Men tornkranen, de egna arbetsgrupperna, underentreprenörerna med en kapacitetsgräns och de långa ledtiderna behöver det. Ge varje resurs en ärlig kapacitet. Två putsare betyder två, inte ”två, men tre vid nödläge”.

Läs histogrammet som en fråga, inte som ett fel. Rött över linjen betyder att tidsplanen kräver mer än du har den dagen. Ibland är svaret: flytta. Ofta är svaret: det här fungerar inte, och det var precis det jag ville veta. **Utjämning** flyttar uppgifter tills efterfrågan ryms inom kapaciteten. Om slutdatumet kan röra sig, tillåt det. Om överlämningsdatumet ligger fast, jämna bara ut inom slacket (kryssrutan *Jämna ut endast inom slack (utjämning) — projektets slutdatum ligger fast*). Slutdatumet ligger då kvar. Du får en kvarstående konflikt som du kan rapportera. Det är ett mer ärligt resultat än en tidsplan som bara ser löst ut.

Jämna *inte* ut när efterfrågan strukturellt är större än kapaciteten. Utjämning ordnar om befintligt arbete i tiden. Den anställer inga extra putsare och bygger ingen andra kran. Tre torn som behöver samma arbetsgrupp samtidigt är fortfarande tre torn som behöver samma grupp efter utjämningen. Det enda som ändras är att överlämningen flyttas ut. Då hjälper i stället etappindelning, extra kapacitet eller annat arbete. Jämna inte heller ut innan logiken och varaktigheterna är klara. Då jämnar du ut en tidsplan som blir annorlunda i morgon.

### Kritisk linje och slack: var tidsplanen är sårbar

Appen beräknar inte om vid varje ändring. Använd **Beräkna** (F5) och läs först därefter. Om statusfältet säger *Inaktuell — beräkna om (F5)* tittar du på den föregående beräkningen, inte på den här. Med inställningen *Beräkna automatiskt* gör appen det själv.

Den **kritiska linjen** är kedjan utan slack. Varje dag som går förlorad där skjuter upp överlämningen en dag. Dit hör din tillsyn och dina bästa personer. Titta inte bara på rött. **Totalt slack** säger hur mycket en uppgift kan bli försenad utan att överlämningen påverkas. **Fritt slack** säger hur mycket den kan bli försenad utan att flytta sin efterföljande uppgift. Skillnaden påverkar ingens slutdatum, men den kan vara i vägen för någon. Det är användbart när du arbetar med underentreprenörer som du inte kan planera om två gånger.

Var uppmärksam på tre signaler. En uppgift med några dagars slack är inte en säker uppgift utan en nära kritisk uppgift. Med *Markera nära kritisk* får sådana uppgifter en egen färg. En uppgift med extremt mycket slack, i granskningar mer än 44 arbetsdagar, ungefär två månader, saknar nästan alltid en efterföljande uppgift. Då pekar det direkt på luckorna i nätverket. Och negativt slack är aldrig ett beräkningsfel. Det är tidsplanen som säger att ett måldatum eller ett fast datum inte passar.

### Baslinje före start, och håll den uppdaterad

Spara en **baslinje** så snart tidsplanen är godkänd, och innan marken bryts (*Tidsplan › Baslinjer & framdrift › Hantera baslinjer…*). Beräkna först. Baslinjen sparar datumen från den senaste beräkningen. Utan den referensen kan du senare bara säga *att* saker går annorlunda, inte hur mycket eller sedan när. Och just det behöver du på ett byggmöte, vid extra arbete och när förseningen diskuteras.

En baslinje sparar datumen, men inte de antaganden som ligger bakom dem. Och det är precis det som frågas så snart förseningen diskuteras. Så när du sparar baslinjen, skriv kort ner vad tidsplanen bygger på (i planeringspraktiken: *underlaget för tidsplanen*). Ange vilka produktivitetssiffror du använde. Ange vilken kalender du valde och varför den är inställd så. Skriv vad du medvetet lämnade utanför tidsplanen. Skriv vem som gav de ledtider du antog. Och skriv vem som godkände tidsplanen. En halv sida räcker.

Därefter är det en rytm att hålla den uppdaterad, inte ett projekt. Uppdatera varje vecka, i samma ordning. Ange **rapportdatumet** som datum för din rapport. Ange de verkliga start- och slutdatumen för det som har startat och blivit klart. Korrigera den återstående varaktigheten för det som pågår. Och beräkna. Slutförandegraden räcker inte ensam. De verkliga datumen är det faktiska underlaget som granskas senare.

Var medveten om vad rapportdatumet gör. Arbete som ännu inte har startat flyttas av appen till rapportdatumet. Uppgifterna efter det följer med. Det gäller inte i beräkningsprofilen Microsoft Project. Om du glömmer att registrera att en uppgift eller milstolpe är klar, flyttas den alltså åt höger av sig själv. Det är inget fel. Modellen vägrar låtsas att något i det förflutna fortfarande kan hända. Får du en varning *Utanför ordning*, har arbetet gjorts i en annan ordning än logiken föreskriver. Det är oftast en anledning att se över ordningen, inte att klicka bort varningen. Gör bara en ny baslinje vid en verklig ändring av omfattningen, och då bredvid den första, inte över den.

Slutligen: en tidsplan är bara tillförlitlig om de som utför arbetet tror på den. Låt platschefen och underentreprenörerna jämföra veckoplanen med den här modellen. Om du vecka efter vecka bara klarar hälften av det som avtalats, ligger problemet oftare i tidsplanen än i utförandet.

## Genomgånget exempel: tre val som tyst gör tidsplanen missvisande

Siffrorna kommer från två exempel som beskrivs på andra ställen i hjälpen: övningsprojektet *House extension* från självstudierna, och ett litet nätverk för en tillbyggnad. Här handlar det om vad varje val gör med din tidsplan. Du provar det själv i självstudie 2 (samband och kritisk linje) och självstudie 3 (en restriktion och ett måldatum).

### Ett glömt samband

I tillbyggnaden startar projektet måndag 7 juni 2027 och överlämningen är fredag 6 augusti. *Build outer cavity leaf* (6 arbetsdagar) har *Install window frames* som efterföljande uppgift, eftersom fönsterramarna sitter i fasaden. Med det sambandet har den yttre skalmuren 2 arbetsdagar slack.

Glömmer du det sambandet får den yttre skalmuren plötsligt 23 arbetsdagar slack, fram till överlämningen. På papperet kan den dröja flera veckor utan att någon väntar. Inget blir rött och ingen varning visas. Endast med beräkningsalternativet *Uppgifter med öppet slut är kritiska* blir en sådan uppgift utan efterföljande uppgift kritisk, så att gapet syns.

### Ett inskrivet datum i stället för ett samband

Det lilla nätverket: *Groundwork* (3 arbetsdagar), *Pour foundation* (2), *Brickwork* (5) och *Roofing* (3), en efter en, från måndag 7 juni 2027. Projektet är klart onsdag 23 juni.

Om du skriver in måndag 21 juni som start för *Brickwork*, eftersom tegelet först kommer då, blir det en restriktion av typen *starta tidigast*. Brickwork flyttas en vecka och projektet är klart onsdag 30 juni. *Groundwork* och *Pour foundation* får 5 arbetsdagar slack och är inte längre kritiska. Om tegelet ändå kommer tidigare ligger Brickwork kvar på 21 juni: nu är det datumet som styr, inte logiken.

Om du skriver in onsdag 9 juni i stället, innan grunden är klar, händer inget: sambanden låter Brickwork ändå bara börja måndag 14 juni.

### Ett måldatum i stället för en restriktion

Om du vill att *Roofing* är klart fredag 18 juni, lägg ett måldatum där. Ingenting flyttas: *Roofing* ligger kvar från måndag 21 till onsdag 23 juni. Men kedjan får −3 arbetsdagar slack och appen visar *Måldatum 18-06-2027 passerades. Tidigaste slut 23-06-2027*. Då ser du direkt att överenskommelsen inte stämmer, i stället för en balk på rätt plats med en kedja bakom som inte klarar datumet.

## Konsekvenser och missförstånd

- **Uppgifter utan föregående eller efterföljande uppgift.** Det vanligaste och det mest skadliga: de följer inte med och får falskt slack.
- **Att skriva in datum eller dra balkar i stället för att skapa samband.** Det sätter tyst en restriktion.
- **För många restriktioner, och en hård fastlåsning som används som bokmärke.** Tidsplanen beräknar då inte längre, den ritar bara.
- **Uppgifter på tre månader, eller uppgifter på en halv dag.** Mellan ungefär en dag och två veckor är det användbara området.
- **Optimistiska varaktigheter, och marginal gömd i varje enskild uppgift** i stället för att synas som en buffert.
- **Väderförseningar och byggsemester som inte finns i kalendern.** De hamnar ändå i kalendern i januari.
- **Fördröjningar i stället för uppgifter.** Sju dagar namnlös väntetid går inte att förklara tre månader senare.
- **Utjämning innan logiken är inlagd**, eller att fortsätta med utjämning trots en strukturell brist på kapacitet.
- **Att glömma att beräkna.** *Inaktuell* i statusfältet betyder att du ser den föregående beräkningen.
- **Ingen baslinje, eller en baslinje som sparas först efter starten.**
- **Framdrift som bara registreras i procent**, utan verkliga datum och utan rapportdatum.
- **Att avfärda panelen *Varningar* utan att läsa den.** Där samlas de missade måldatumen, överträdda restriktioner, samband i fel ordning och resurser med överbeläggning (*Planering › Tidsplan › Varningar*).

## Se även

- [Kritisk linje och slack](docs://uitleg-kritiek-pad): hur appen beräknar tidigaste och senaste datum och slack.
- [Samband och fördröjning](docs://uitleg-relaties): de fyra typerna av samband, fördröjning och samband på en fas.
- [Restriktioner och måldatum](docs://uitleg-constraints): vad varje restriktion och ett måldatum gör med beräkningen.
- [Kalendrar och arbetsdagar](docs://uitleg-kalenders): hur appen räknar arbetsdagar och vilken kalender som har företräde.
- [Dagar och timmar](docs://uitleg-dagen-en-uren): planering i dagar, i timmar eller blandat.
- [Utjämning av resurser](docs://uitleg-nivelleren): vad utjämning flyttar och vad den inte flyttar.
- [Framdrift, rapportdatum och baslinje](docs://uitleg-voortgang): vad rapportdatumet gör och hur du läser avvikelser.
- [Lägga till uppgifter och milstolpar](docs://howto-taken-en-mijlpalen-toevoegen): att ange milstolpar och uppgifter.
- [Lägga till samband](docs://howto-relaties-leggen): att länka uppgifter till varandra.
- [Koppla en AI-assistent (MCP)](docs://howto-ai-assistent-koppelen): en assistent som planerar efter dessa principer.
- [Meddelanden och varningar](docs://ref-meldingen): alla varningar på ett ställe.

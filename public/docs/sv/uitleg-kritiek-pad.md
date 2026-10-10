# Kritisk linje och slack

Varför ligger ditt projektslut där det gör? Och vilken uppgift kan bli en dag försenad utan att överlämningen flyttas? Det är frågorna bakom den kritiska linjen. Den här artikeln förklarar exakt vad appen beräknar, med ett räkneexempel.

## Begreppet

En tidsplan är ett nät av uppgifter som är kopplade med **samband**: överenskommelser, till exempel ”fönsterbågarna sätts in först när taket är stängt”. Sambanden binder uppgifterna till varandra. Vissa kedjor av uppgifter är längre än andra. Den längsta kedjan avgör hur lång tid hela projektet tar.

Den längsta kedjan är den **kritiska linjen**. Om en uppgift på den blir en dag försenad flyttas överlämningen en dag. Där finns inget utrymme.

Uppgifter utanför den kritiska linjen har utrymme. Det utrymmet kallas **slack**. Murarn som bygger det yttre skalet kan starta två dagar senare utan att någon märker det. De två dagarna är den uppgiftens slack.

Kritisk säger alltså ingenting om hur viktig en uppgift är. Det säger bara att det inte finns någon tid över.

Beräkningsmetoden heter **CPM** (Critical Path Method). Därför kallas blocket med resultaten i panelen *Egenskaper* för *CPM-resultat*.

## Så räknar appen

Appen beräknar inte tidsplanen av sig själv. Beräkningen startar med **Beräkna** (F5), till exempel via *Start › Tidsplan › Beräkna*. Om något har ändrats sedan den senaste beräkningen visar statusfältet *Inaktuell — beräkna om (F5)*. Om *Beräkna automatiskt* är på (under *Inställningar › Projekt › Inställningar*, fliken *Tidsplan*, rubriken *Beräkning*) gör appen det själv.

En beräkning gör två genomgångar av nätet.

### Framåtpass

Appen börjar vid projektstarten och följer sambanden från **föregående** till **efterföljande**. För varje uppgift hittar appen den tidigaste dag uppgiften kan starta. Om en uppgift har flera föregående uppgifter väntar den på att den sista ska bli klar. Det ger varje uppgift dess **tidigaste start** och **tidigaste slut**. Det senaste tidigaste slutet av alla uppgifter är projektslutet.

### Bakåtpass

Sedan går appen bakåt, från projektslutet tillbaka till starten. Nu hittar appen för varje uppgift den sista dag uppgiften måste vara klar utan att projektslutet flyttas. Om en uppgift har flera efterföljande uppgifter räknas den som måste starta först. Det ger **senaste start** och **senaste slut**.

### Totalt och fritt slack

Skillnaden mellan en uppgifts senaste och tidigaste datum är dess **totalt slack**: antalet arbetsdagar som uppgiften kan bli försenad eller starta senare innan projektslutet flyttas. Appen räknar i arbetsdagar i uppgiftens kalender. Helger och helgdagar räknas inte.

**Fritt slack** är strängare. Det är utrymmet en uppgift har innan någon av dess efterföljande uppgifter måste starta senare. Du kan använda det utrymmet utan att någon annan uppgift märker det.

Totalt slack kan delas. Om två icke-kritiska uppgifter följer på varandra delar de samma marginal. Om den första uppgiften använder upp den har den andra inget kvar. Den första uppgiften har då totalt slack, men inget fritt slack. Den delen av det totala slacket som inte är fritt kallas **störande slack**: om du använder det flyttas också de efterföljande uppgifterna. Exemplet nedan visar det med siffror.

### Negativt slack

Slack kan också bli negativt. Det händer när en uppgift har ett måldatum, eller en restriktion som sätter ett senaste datum, som ligger före det datum appen beräknar för uppgiften. På papperet är uppgiften redan försenad. Då blir uppgiften och kedjan före den kritisk.

### När är en uppgift kritisk?

Som standard är en uppgift kritisk när dess totala slack är 0 eller mindre. Det kan du ändra under *Inställningar › Projekt › Projektinfo*, i blocket *Beräkningsprofil och beräkningsalternativ*, vid *Beräkningsalternativ för det här projektet*. När du klickar på *Tillämpa* beräknar appen tidsplanen direkt om. Alternativen hör till projektfilen, inte till appen.

- **Kritisk definition** med *Totalt slack ≤ tröskelvärde* och fältet *Tröskelvärde (arbetsdagar)*. Tröskelvärdet är 0 som standard. Om du vill skydda en buffert sätter du det till 2, till exempel. Då räknas varje uppgift med 2 arbetsdagar slack eller mindre som kritisk, och den blir röd.
- **Markera nära kritisk** med ett eget *Tröskelvärde*, 2 arbetsdagar som standard. En uppgift med mer än 0 men högst så mycket slack får en gul balk. Så ser du vilka uppgifter som nästan inte har någon marginal kvar, utan att kalla dem kritiska.
- **Uppgifter med öppet slut är kritiska**: en uppgift utan efterföljande uppgift som ännu inte är klar räknas som kritisk. Användbart som skyddsnät mot glömda samband (se missförstånden nedan).
- **Slackberäkning** avgör om totalt slack mäts vid start av uppgiften, vid dess slut, eller som det minsta av de två. Nya projekt står på *Automatiskt (standard)*. Om du följer Primavera P6:s sätt att räkna sätter *Använd standardalternativen för den här profilen* detta val till *Slutslack*. För MS Project ställer samma knapp tillbaka det till *Automatiskt (standard)*: med ett rapportdatum räknar MS Project själv på det sättet.

### Så ser du det

Kritiska uppgifter har en röd balk i Gantt. Bakom en icke-kritisk balk finns ett grönt band fram till uppgiftens senaste slut: det är slacket. Bandet slås på eller av under *Visa › Baslinjer & framdrift › Slackband*.

För en vald uppgift visar panelen *Egenskaper* allt under *CPM-resultat*: tidigaste och senaste start och slut, totalt, fritt och störande slack, och om uppgiften ligger på den kritiska linjen. Slacket för alla uppgifter bredvid varandra finns i kolumnerna under *Beräknat* (**+**-knappen till höger i tabellhuvudet), till exempel *Totalt slack*, *Fritt slack*, *Kritisk* och *Nära kritisk*.

Statusfältet längst ner räknar de kritiska uppgifterna, till exempel *Kritisk linje: 21 uppgifter, 45 arbetsdagar*.

## Genomgånget exempel: House extension

Exemplet är övningsprojektet *House extension* i självstudierna, sådant det ser ut när alla samband är inlagda. I självstudie 2, ”Samband och kritisk linje”, bygger du det själv och kontrollerar siffrorna. Här läser du varför siffrorna är som de är.

Tillbygget startar måndag 7 juni 2027. Efter beräkningen är överlämningen fredag 6 augusti 2027, och statusfältet visar *Kritisk linje: 21 uppgifter, 45 arbetsdagar*. Två uppgifter är inte kritiska: *Build outer cavity leaf* och *Painting*.

### Två kedjor som möts

Efter det bärande bjälklaget (*Lay hollow-core floor*, klart måndag 28 juni) delas bygget upp i två kedjor. Båda slutar vid *Install window frames*:

- Insidan: *Build inner cavity leaf* (5 arbetsdagar), sedan *Place roof elements* (1), sedan *Apply roofing* (2). Fönsterbågarna kan bara sättas in när taket är stängt.
- Utsidan: *Build outer cavity leaf* (6 arbetsdagar). Bågarna sitter i fasaden, så även det måste vara klart.

**Framåt.** Båda skalen kan starta tisdag 29 juni. Det inre skalet är klart måndag 5 juli. Takelementen läggs tisdag 6 juli, och takläggningen följer onsdag 7 och torsdag 8 juli. Det yttre skalet är klart tisdag 6 juli. *Install window frames* väntar på den senaste av de två kedjorna, takläggningen, och startar därför fredag 9 juli.

**Bakåt.** Bågarna måste starta senast fredag 9 juli, annars flyttas överlämningen. Det yttre skalet måste alltså vara klart senast torsdag 8 juli. Sex arbetsdagar tillbaka ger en senaste start torsdag 1 juli.

**Slack.** Det yttre skalet kan starta tidigast 29 juni och måste starta senast 1 juli. Däremellan ligger 2 arbetsdagar: onsdag 30 juni och torsdag 1 juli. Det är dess totala slack. Panelen visar *Totalt slack: 2 dagar* och *Kritisk linje: nej*. Fritt slack är också 2 dagar, eftersom dess enda efterföljande uppgift, *Install window frames*, ligger på den kritiska linjen.

Den inre kedjan har inget slack. Varje dag försening där flyttar bågarna och allt efter dem.

### Painting

*Painting* (3 arbetsdagar) startar efter pussningen, måndag 26 juli, och är klar onsdag 28 juli. Nästa uppgift, *Snagging and cleaning*, väntar också på kakelsättningen. Den är först klar torsdag 5 augusti, eftersom golvavjämningen måste torka i fem arbetsdagar först. *Painting* får alltså hålla på till torsdag 5 augusti. Det ger 6 arbetsdagar slack: 29 och 30 juli, och 2 till 5 augusti. Även här är fritt slack lika med totalt slack, eftersom den efterföljande uppgiften är kritisk.

### När det yttre skalet blir försenat

Om det yttre skalet tar 8 arbetsdagar i stället för 6, är det klart torsdag 8 juli: exakt dess senaste slut. Slacket är borta och uppgiften blir röd. Då är båda kedjorna kritiska, och statusfältet räknar 22 kritiska uppgifter. Överlämningen ligger kvar på fredag 6 augusti.

Om det tar 9 arbetsdagar är det yttre skalet först klart fredag 9 juli. Bågarna flyttas till måndag 12 juli, och överlämningen till måndag 9 augusti: en arbetsdag senare. Den yttre kedjan är nu den kritiska linjen. Statusfältet visar *Kritisk linje: 19 uppgifter, 46 arbetsdagar*.

Den inre kedjan har då 1 arbetsdag totalt slack, men den dagen delas:

- *Build inner cavity leaf*: totalt slack 1, fritt slack 0, störande slack 1. Om det inre skalet blir en dag försenat flyttas takelementen med det.
- *Place roof elements*: totalt slack 1, fritt slack 0, störande slack 1.
- *Apply roofing*: totalt slack 1, fritt slack 1. Bara här kostar en dags försening ingen något.

Det är samma enda dag, delad av hela kedjan. Om det inre skalet använder den, är den borta för takelementen och takläggningen.

### Nära kritisk och negativt slack

Med *Markera nära kritisk* på, vid standardtröskelvärdet 2 arbetsdagar, får det yttre skalet med exakt 2 dagars slack en gul balk. *Painting*, med 6 dagar, förblir blå.

Om överlämningen får ett måldatum på onsdag 4 augusti, två arbetsdagar före den beräknade överlämningen, blir slacket negativt. Alla 21 uppgifter på den kritiska linjen får ett totalt slack på −2 arbetsdagar. Det yttre skalet har inget slack kvar och blir också kritiskt. *Painting* behåller 4 arbetsdagar.

## Konsekvenser och missförstånd

**”Kritisk betyder viktig.”** Nej. En besiktning kan vara avgörande och ändå ha slack. Omvänt kan ett enkelt jobb vara kritiskt: i exemplet ligger *Snagging and cleaning* på den kritiska linjen. Kritisk handlar bara om tid: det finns ingen marginal kvar.

**”Den här uppgiften har slack, så den kan vänta.”** Kolla först det fria slacket. Om en uppgift har totalt slack men inget fritt slack tar varje dag försening marginal från uppgifterna efter den, precis som med det inre skalet i fallet med 9 arbetsdagar.

**Ett glömt samband ger falskt slack.** En uppgift utan efterföljande uppgift får slack tills projektet är slut. Om exemplet saknade sambandet från det yttre skalet till bågarna, skulle det yttre skalet plötsligt ha 23 arbetsdagars slack, fram till överlämningen 6 augusti. På papperet kunde det då bli flera veckor försenat utan att bågarna väntar. Med *Uppgifter med öppet slut är kritiska* på blir det yttre skalet i så fall kritiskt, och luckan syns.

**Den kritiska linjen är inte fast.** Om en icke-kritisk uppgift blir försenad mer än sitt slack, blir en annan kedja den längsta. Du såg det ovan med 9 dagars murarbete. Tidsplanen måste därför beräknas om efter varje ändring. Så länge statusfältet visar *Inaktuell — beräkna om (F5)*, hör de röda balkarna fortfarande till den förra beräkningen.

**Slack räknas i arbetsdagar.** *Painting* har 6 arbetsdagar slack, från torsdag 29 juli till torsdag 5 augusti: åtta dagar i almanackan, eftersom helgen inte räknas. En helgdag eller byggsemester i kalendern räknas inte heller.

## Se även

- [Lägga till samband](docs://howto-relaties-leggen): stegen för att länka uppgifter och ställa in en fördröjning.
- [Samband och fördröjning](docs://uitleg-relaties): hur samband och fördröjning avgör de tidigaste datumen.
- [Restriktioner och måldatum](docs://uitleg-constraints): hur en restriktion eller ett måldatum ger negativt slack.
- [Spåra en kedja](docs://howto-pad-traceren): följa kedjan bakom en uppgift.
- [Beräkningsalternativ och beräkningsregler](docs://ref-rekenopties-en-conventies): den kritiska definitionen, nära kritisk och slackberäkningen, alternativ för alternativ.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): ett stort projekt med flera slackvägar, nära kritiska uppgifter (tröskelvärde 3 arbetsdagar), en hängmatta, en hård fastlåsning och ett externt samband.

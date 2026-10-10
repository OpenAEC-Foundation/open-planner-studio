# Arbetsregler: varaktighet, enheter och arbete

Du sätter en putsare på putsningen och uppgiften tar fyra dagar. Lägger du till en andra putsare kan arbetet bli klart på två dagar. Det kan också vara kvar på fyra dagar, med dubbelt så mycket arbete i. Båda är logiska. Vilken av de två appen väljer beror på uppgiftens **arbetsregel**. I den här artikeln läser du hur appen binder ihop varaktighet, tilldelningsenheter och arbete och vad varje arbetsregel håller konstant.

## Begreppet

Tre storheter hänger ihop:

- **Varaktighet**: hur lång tid uppgiften tar, i arbetsdagar eller i timmar.
- **Tilldelningsenheter**: hur mycket av en resurs som arbetar på uppgiften per arbetsdag. I appen heter det *Enh./dag*. 1 tilldelningsenhet är en putsare hela dagen, 2 är två av dem och 0,5 är en halv dag.
- **Arbete**: det totala antal timmar som resursen lägger ner på uppgiften.

Summan är: arbete = varaktighet × tilldelningsenheter × timmar per arbetsdag. Timmarna per arbetsdag kommer från uppgiftens kalender. Putsning i fyra arbetsdagar med en putsare är, med en arbetsdag på 8 timmar, 4 × 1 × 8 = 32 timmar arbete.

Ändrar du en av de tre, måste minst en av de andra två följa med. Annars stämmer summan inte längre. Arbetsregeln bestämmer vilken. Du ställer in den per uppgift, i panelen *Egenskaper*. Appen visar arbetsregeln och arbetet först när du slår på dem. Hur det fungerar står i [Välj en arbetsregel](docs://howto-werkregel-kiezen).

En arbetsregel fungerar bara på vanliga uppgifter. Milstolpar, faser (sammanfattningsuppgifter), hängmattor och uppgifter vars *Varaktighetstyp* är *Förfluten tid* har ingen. Då finns fältet *Arbetsregel* inte. Material, till exempel betong eller bruk, räknas inte heller. Materialmängden styr aldrig varaktigheten, och appen justerar den aldrig på grund av en arbetsregel.

## Så räknar appen

### Regeln verkar på det du ändrar

Appen räknar om varaktighet, tilldelningsenheter och arbete bara när du ändrar en av dem: uppgiftens varaktighet, tilldelningsenheterna, arbetet, en resurs som läggs till eller tas bort, eller timmarna per dag i en kalender. **Beräkna** (F5) ändrar ingen av dem: F5 beräknar bara datum. Att välja en regel ändrar inte heller ett enda tal. Regeln gäller vid din nästa ändring.

Ändrar en arbetsregel uppgiftens varaktighet, då blir tidsplanen inaktuell. Statusfältet visar då *Inaktuell — beräkna om (F5)*, om inte *Beräkna automatiskt* är på.

### Fyra regler

I panelen *Egenskaper*, under rullgardinsmenyn, visar appen vad den valda regeln skyddar. De fyra reglerna, med appens egen text:

- **Fast varaktighet och fasta enheter** (*Skyddat: varaktighet och enheter (arbetet följer)*). Det här är standard. Appen ändrar aldrig varaktigheten själv, och arbetet följer av varaktighet och tilldelningsenheter. Skriver du arbetet själv, justerar appen tilldelningsenheterna, eftersom varaktigheten är fast.
- **Fast varaktighet och fast arbete** (*Skyddat: varaktighet och arbete (enheterna följer)*). Appen ändrar aldrig varaktigheten själv. Ändrar du varaktigheten, blir arbetet kvar och tilldelningsenheterna justeras.
- **Fast arbete** (*Skyddat: arbete (varaktigheten följer enheterna)*). Arbetet är fast och varaktigheten följer av arbete och tilldelningsenheter.
- **Fasta enheter** (*Skyddat: enheter (varaktigheten följer arbetet)*). Tilldelningsenheterna är fasta och varaktigheten följer av arbetet.

Två regler lämnar alltså varaktigheten ifred. Med de två andra följer varaktigheten med när du ändrar tilldelningsenheterna, arbetet eller antalet resurser. Med en resurs gör *Fast arbete* och *Fasta enheter* exakt samma sak. De skiljer sig när du ändrar varaktigheten själv: med *Fast arbete* blir arbetet kvar och tilldelningsenheterna justeras, med *Fasta enheter* blir tilldelningsenheterna kvar och arbetet växer. De skiljer sig också när det finns fler resurser på uppgiften (se nedan).

De genomgångna exemplen nedan visar vad varje regel gör.

### Avrundning

Varaktigheten som följer av summan avrundas uppåt av appen. För en uppgift i dagar blir det hela arbetsdagar, för en uppgift i timmar hela minuter. Arbete och tilldelningsenheter blir kvar som du angav dem, eller som appen tog från summan. Därför stämmer summan ibland inte exakt. Exemplet nedan visar vad som händer då.

### Flera resurser

Har en uppgift flera resurser gäller två överenskommelser. Med **Fast varaktighet och fast arbete**, **Fast arbete** och **Fasta enheter** blir det totala arbetet detsamma när du lägger till eller tar bort en resurs. Appen delar det då i proportion till tilldelningsenheterna. Med **Fast varaktighet och fasta enheter** tar en ny resurs med sig eget arbete i stället. Med **Fast arbete** och **Fasta enheter** bestämmer den långsammaste resursen varaktigheten: per resurs är det arbete delat med tilldelningsenheter, och det största resultatet räknas.

Ett exempel: två resurser har var och en 32 timmar arbete och tilldelningsenheter på 1, tillsammans 4 arbetsdagar. Du ställer tilldelningsenheterna för den första på 0,5. Varaktigheten blir då 8 arbetsdagar. Med Fast arbete behåller den andra resursen sina 32 timmar arbete och dess tilldelningsenheter sjunker till 0,5. Med Fasta enheter behåller den andra sina tilldelningsenheter på 1 och dess arbete växer till 64 timmar.

### Framdrift

Har uppgiften redan framdrift, verkar regeln på den återstående delen: den återstående varaktigheten och det återstående arbetet. I appen heter det arbetet *Arbete (kvar)*. Det som är klart blir kvar.

### Uppgifter i timmar

En uppgift som du planerar i timmar räknar likadant, men i minuter. Om bara kranen är med på en uppgift på 5 timmar är det 5 timmar arbete. Med Fast arbete blir varaktigheten för tilldelningsenheter på 2 då 2,5 timmar. Även bjälklaget med håldäck i övningsprojektet har snickarlaget med sig. Det behöver fortfarande 5 timmar arbete, är den långsammaste och därför blir varaktigheten kvar på 5 timmar. Hur timmar och dagar hänger ihop förklaras i [Dagar och timmar](docs://uitleg-dagen-en-uren).

## Genomgånget exempel: putsningen

Exemplet är övningsprojektet *House extension* i självstudierna. I självstudie 5 räknar du ut det själv och kontrollerar talen. Här läser du vad varje regel gör.

Putsningen tar 4 arbetsdagar. En putsare är kopplad till den, med tilldelningsenheter på 1, och arbetsdagen är 8 timmar. Arbetet är alltså 32 timmar.

### Fast varaktighet och fasta enheter

- Du gör varaktigheten 6 arbetsdagar: arbetet växer till 48 timmar, tilldelningsenheterna blir kvar på 1.
- Du sätter tilldelningsenheterna till 2: varaktigheten blir kvar på 4 arbetsdagar, arbetet blir 64 timmar.
- Du skriver 48 timmar i *Arbete (kvar)*: varaktigheten blir kvar på 4 arbetsdagar, tilldelningsenheterna blir 1,5.
- Du tilldelar en andra resurs, till exempel *Plasterer 2*, med tilldelningsenheter på 1: varaktigheten blir kvar på 4 arbetsdagar och den andra ger 32 timmar arbete, 64 timmar tillsammans.

### Fast varaktighet och fast arbete

- Du gör varaktigheten 6 arbetsdagar: arbetet blir kvar på 32 timmar, tilldelningsenheterna sjunker till 0,67.
- Du sätter tilldelningsenheterna till 2: varaktigheten blir kvar på 4 arbetsdagar. Eftersom varaktigheten är fast växer arbetet med till 64 timmar.
- Du skriver 16 timmar i *Arbete (kvar)*: varaktigheten blir kvar på 4 arbetsdagar, tilldelningsenheterna blir 0,5.
- Du tilldelar en andra resurs, till exempel *Plasterer 2*, med tilldelningsenheter på 1: de 32 timmarna delas, 16 timmar var, och tilldelningsenheterna blir 0,5 för båda. Varaktigheten blir kvar på 4 arbetsdagar.

### Fast arbete

- Du gör varaktigheten 6 arbetsdagar: arbetet blir kvar på 32 timmar, tilldelningsenheterna sjunker till 0,67.
- Du sätter tilldelningsenheterna till 2: arbetet blir kvar på 32 timmar och varaktigheten blir 2 arbetsdagar. Det här är steget du tar i självstudie 5.
- Du skriver 48 timmar i *Arbete (kvar)*: tilldelningsenheterna blir kvar på 1 och varaktigheten blir 6 arbetsdagar.
- Du tilldelar en andra resurs, till exempel *Plasterer 2*, med tilldelningsenheter på 1: de 32 timmarna delas, 16 timmar var, och varaktigheten blir 2 arbetsdagar. Tar du bort den andra resursen igen blir varaktigheten 4 arbetsdagar igen.

### Fasta enheter

- Du gör varaktigheten 6 arbetsdagar: tilldelningsenheterna blir kvar på 1, arbetet växer till 48 timmar.
- Du sätter tilldelningsenheterna till 2: arbetet blir kvar på 32 timmar och varaktigheten blir 2 arbetsdagar.
- Du skriver 48 timmar i *Arbete (kvar)*: tilldelningsenheterna blir kvar på 1 och varaktigheten blir 6 arbetsdagar.
- Du tilldelar en andra resurs, till exempel *Plasterer 2*, med tilldelningsenheter på 1: de 32 timmarna delas, 16 timmar var, och varaktigheten blir 2 arbetsdagar.

### När summan inte stämmer

Med Fast arbete sätter du tilldelningsenheterna till 3. Arbetet är 32 timmar, så varaktigheten blir 32 ÷ (3 × 8) = 1,33 arbetsdagar. Appen avrundar det uppåt till 2 arbetsdagar. Arbete (32 timmar) och tilldelningsenheter (3) blir kvar, men 2 × 3 × 8 är 48 timmar. Histogrammet sprider därför de 32 timmarna över de 2 arbetsdagarna: 2 tilldelningsenheter per dag, inte 3. Bredvid *Arbete (kvar)* visas en varning, *Avviker från tilldelningsenheter × varaktighet*, för att visa detta.

Med två resurser med olika tilldelningsenheter fungerar det på samma sätt. Med Fast arbete lägger du till en andra resurs, till exempel *Plasterer 2*, med tilldelningsenheter på 2 till putsaren med tilldelningsenheter på 1. Appen delar de 32 timmarna i förhållandet 1 : 2, alltså 10,7 och 21,3 timmar. Båda behöver då 1,33 arbetsdagar. Varaktigheten blir 2 arbetsdagar.

### En annan kalender

Med Fast arbete går kalenderns arbetsdag från 8 till 6 timmar. Arbetet blir kvar på 32 timmar, så varaktigheten blir 32 ÷ 6 = 5,33, avrundat uppåt till 6 arbetsdagar. Hur appen räknar arbetsdagar och arbetstider förklaras i [Kalendrar och arbetsdagar](docs://uitleg-kalenders). Appen meddelar: *Efter kalenderändringen justerade arbetsregeln varaktigheten för 1 uppgift (arbetet blir kvar, timmar per dag ändrades).*

### En uppgift med framdrift

Den inre skalmuren tar 5 arbetsdagar och är 40% klar: 2 arbetsdagar är gjorda och 3 arbetsdagar (24 timmar) återstår. Med Fast arbete sätter du tilldelningsenheterna från 1 till 2. Det återstående arbetet blir kvar på 24 timmar och den återstående varaktigheten blir 1,5, avrundat uppåt till 2 arbetsdagar. Uppgiften tar nu 2 + 2 = 4 arbetsdagar och framdriften är 50%. Procenten följer med, eftersom den delen som är klar blir kvar och resten blir kortare.

## Följder och missuppfattningar

**”Fast arbete betyder att varaktigheten är fast.”** Nej, tvärtom. Med *Fast varaktighet och fasta enheter* och *Fast varaktighet och fast arbete* är varaktigheten fast. Med *Fast arbete* och *Fasta enheter* följer varaktigheten av de två andra.

**”Om jag väljer en regel ändras min tidsplan.”** Nej. Att välja ändrar inget tal. Först vid din nästa ändring bestämmer regeln vad som följer med. Under en regel som skyddar arbetet låser appen arbetet när du väljer, så det finns ett tal att skydda. Uppgiften får då ett lagrat *Arbete (kvar)*.

**”Varaktigheten ändrades utan att jag rörde den.”** Det kan hända efter en ändring av tilldelningsenheterna, arbetet, antalet resurser eller timmarna per dag, med Fast arbete eller Fasta enheter. Statusfältet visar då att tidsplanen är inaktuell. Tryck på **Beräkna** (F5) för att se de nya datumen.

**Utan tilldelning gör en arbetsregel ingenting.** Då finns inga tilldelningsenheter och inget arbete att koppla till varaktigheten.

**Filer från MS Project eller Primavera P6 visar alltid arbetsregeln.** För en uppgift från MS Project visas ibland texten *Från MS Project: insatsberoende* eller *Från MS Project: inte insatsberoende* under regeln. Den lagrade inställningen ändrar två fall. Med *Fast varaktighet och fast arbete* och insatsberoende följer arbetet med när du ändrar varaktigheten, i stället för tilldelningsenheterna. Med *Fasta enheter* och inte insatsberoende följer arbetet med när du lägger till eller tar bort en resurs, och varaktigheten blir kvar. Uppgifter som du skapar i appen har inte den här inställningen.

## Se också

- [Välj en arbetsregel](docs://howto-werkregel-kiezen): stegen för att ställa in en uppgifts arbetsregel.
- [Tilldela resurser med en kurva](docs://howto-resource-toewijzen): sätta en resurs på en uppgift, med tilldelningsenheter och fördelning.
- [Dagar och timmar](docs://uitleg-dagen-en-uren): hur appen omvandlar dagar och timmar.
- [Kalendrar och arbetsdagar](docs://uitleg-kalenders): hur appen räknar arbetsdagar och arbetstider.

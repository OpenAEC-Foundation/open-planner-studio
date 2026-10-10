# Resursbiblioteket

Ditt murararlag arbetar inte bara i ett projekt. I dag är de på husen i norr, i morgon på garagen i söder. Ett bibliotek är platsen där du registrerar ett sådant lag en gång, så att varje projekt använder samma lag. Appen kan då också se när två projekt begär samma personer samma dag. Det kan inget enskilt projekt se. I den här artikeln läser du hur biblioteket och projektet hänger ihop och hur appen räknar beläggning över projekt.

## Begreppet

Det finns två lager.

**Biblioteket** är listan med resurser och kalendrar som hör till din organisation: en murare, en kran, en putsare, med deras typ, standardkostnad och antal. Listan, som appen också kallar *pool*, finns inte i dina projektfiler. Den finns i appen. I skrivbordsappen finns den i en fil på den här datorn. I webbläsaren finns den i webbläsarens eget lagringsutrymme. Rensar du webbplatsdata i webbläsaren försvinner biblioteket. Exportera det därför som säkerhetskopia. Det finns alltid minst ett bibliotek. Det första heter *Mijn resourcebibliotheek* (ett nederländskt namn). Du kan byta namn på det.

Ett **projekt** bestämmer hur mycket av en resurs det använder och när. Ett projekt är kopplat till ett bibliotek eller står ensamt. Ett fristående projekt fungerar bra, bara utan en delad lista.

Ett projekt pekar inte på biblioteket. Det behåller en **kopia**. När du tilldelar *Bricklayer* från biblioteket till ett projekt gör appen en kopia i projektet med en **ursprungsstämpel**. Stämpeln är noteringen att kopian kommer från bibliotek X och är post Y där. I resurstabellen känner du igen en sådan kopia på en liten bibliotekssymbol. Kopian är en vanlig resurs. Du kan tilldela uppgifter till den, och den lagras i projektfilen själv.

Kalendrarna i biblioteket är något annat än projektets lista över kalendrar, som du hanterar i kalenderdialogen. En kalender från biblioteket kommer in i projektet tillsammans med en resurs som använder den.

## Hur appen fungerar med det

### Vad biblioteket bestämmer och vad projektet bestämmer

Biblioteket bestämmer **vad en resurs är**: namnet, typen, standardkostnaden per timme, enheten och beskrivningen. I en projektkopia visas de fälten som vanlig text. Du ändrar dem i biblioteket, så att de stämmer i varje projekt. Vill du att en kopia ändå går sin egen väg kopplar du loss den från biblioteket.

Projektet bestämmer **hur mycket och när**: *Max enheter*, kapaciteten som ändras över tid (*Tidsfasad kapacitet*) och vilken kalender resursen har. Dessa fält förblir redigerbara i projektet. De räknas inte som en avvikelse från biblioteket. Samma lag kan ju köra en annan kalender vid ett brådskande jobb än vid ett vanligt projekt. Innehållet i en kalender som följde med en resurs följer däremot biblioteket.

### När en kopia följer med

Biblioteket uppdaterar inte kopiorna hela tiden. Det sker vid vissa fasta tillfällen:

- När du ändrar något i biblioteket följer de oredigerade kopiorna i alla öppna projekt direkt.
- När du öppnar ett projekt eller byter till en annan flik jämför appen kopiorna med biblioteket. Är en oredigerad kopia efter, uppdaterar appen den tyst. Appen rapporterar det kort: *1 del uppdaterad från biblioteket* eller *N delar uppdaterade från biblioteket*.

Appen kommer ihåg värdena från det ögonblick kopian gjordes eller uppdaterades. Om en kopia nu avviker från dem, avgör appen inte vem som har rätt. Kopian får då markeringen *avviker — bestäm*. När du öppnar en fil med en sådan kopia öppnas fönstret *Länka resursbibliotek* av sig självt. Där väljer du per post om bibliotekets värden gäller, eller om värdena från din fil ska in i biblioteket. När du byter flik visas aldrig något fönster.

En avvikelse uppstår till exempel när du länkar en egen resurs i projektet till en post i biblioteket med samma namn men andra värden, med *Till biblioteket*. Appen länkar dem. Den markerar kopian som avvikande direkt.

### När en resurs försvinner från biblioteket

Tar du bort en resurs från biblioteket, finns kopian kvar i dina projekt och fungerar vidare. Den får markeringen *inte längre i biblioteket*. Sedan kan du redigera den helt eller ta bort den från projektet.

### Beläggning över projekt

Histogrammet och överbeläggningen i ett projekt tittar bara på det projektet. Biblioteket vet mer: hur många av en resurs det finns totalt. Vyn *Beläggning* räknar per dag ihop belastningen från alla öppna projekt som är kopplade till samma bibliotek och använder en kopia av resursen. Är summan en dag större än bibliotekets kapacitet, räknas den dagen med överbeläggning.

Tre regler avgör vad som räknas:

- Kapaciteten kommer från biblioteket: *Max enheter* för posten i biblioteket, eller dess *Tidsfasad kapacitet* den dagen. Den kommer inte från *Max enheter* i projektkopian. Två projekt som var och ett håller sig inom sin egen tilldelning kan alltså ändå begära för mycket tillsammans.
- En summa som är exakt lika med kapaciteten är ingen konflikt. Det måste begäras mer än kapaciteten.
- Bara kopior med en ursprungsstämpel räknas, och bara i projekt som är öppna i den här appen just då. En egen resurs i ett enskilt projekt finns inte i biblioteket och räknas därför inte. Översikten ser inte dokument som inte är öppnade i den här appen. Det står också längst ned i översikten.

## Exempel: murararlaget i två projekt

Biblioteket innehåller resursen *Bricklayer* med *Max enheter* 3: tre murare på lönelistan. Två projekt använder den, båda med en kopia som har *Max enheter* 2.

- *Houses North* har uppgiften *Bricklaying facades* på 5 arbetsdagar från måndag 7 juni 2027, med 2 tilldelningsenheter per dag. Uppgiften pågår från 7 till 11 juni inklusive.
- *Garages South* har uppgiften *Bricklaying garages* på 4 arbetsdagar från onsdag 9 juni 2027, med 2 tilldelningsenheter per dag. Helgen räknas inte. Uppgiften omfattar 9, 10, 11 och 14 juni.

I varje projekt begär resursen 2 av sina 2 tilldelningsenheter. Inget av projekten rapporterar överbeläggning: under *Resurser › Överbeläggning* står båda *Ingen*. Ändå överstiger de tillsammans de 3 murarna. Per dag räknar appen så här:

- Måndag 7 och tisdag 8 juni: 2 (bara Houses North)
- Onsdag 9, torsdag 10 och fredag 11 juni: 2 + 2 = 4
- Måndag 14 juni: 2 (bara Garages South)

Toppen är 4 mot en kapacitet på 3. Översikten visar resursen med *2 dokument*, perioden *2027-06-07 – 2027-06-14*, *4.0 / 3.0* för topp och kapacitet, och *3 dagar med överbeläggning*: 9, 10 och 11 juni.

Vad händer om du ändrar något:

- Tar *Bricklaying facades* 6 arbetsdagar, pågår den till och med måndag 14 juni. Den dagen når också 2 + 2 = 4. Översikten rapporterar därför *4 dagar med överbeläggning*: 9, 10, 11 och 14 juni. Toppen förblir 4.
- Har biblioteket *Max enheter* 4, står det *4.0 / 4.0*. Där finns ingen konflikt, eftersom summan inte är större än kapaciteten.
- Arbetar *Garages South* med 1 tilldelningsenhet per dag i stället för 2, blir toppen 3. Det står *3.0 / 3.0*: ingen konflikt.
- Startar *Garages South* först måndag 14 juni, överlappar projekten inte. Perioden blir *2027-06-07 – 2027-06-17* och toppen är *2.0 / 3.0*.

De steg för att titta på detta i dina egna projekt finns i [Använda översikten över beläggning](docs://howto-bezettingsoverzicht-gebruiken).

## Konsekvenser och missuppfattningar

**”Biblioteket delas med mina kollegor.”** Nej. Biblioteket finns i appen (i skrivbordsappen i en fil på den här datorn, i webbläsaren i webbläsarens eget lagringsutrymme) och synkroniseras inte. Arbetar två planerare med samma resursbibliotek, kan deras bibliotek skilja sig åt. Du kan dela genom att exportera och importera, se [Hantera och dela bibliotek](docs://howto-bibliotheken-beheren). Delar din organisation murarlag mellan driftbolag, välj då medvetet ett gemensamt bibliotek. Översikten ser också bara de projekt som är öppna i den här appen.

**”Om jag ändrar biblioteket ändras allt i mina projekt.”** Nej. Det ändras bara resursens identitet: namn, typ, standardkostnad, enhet och beskrivning. *Max enheter*, kapaciteten över tid och projektets kalenderval förblir som de är.

**”Jag kan ångra en ändring i biblioteket.”** Nej. Biblioteket hör till appen och inte till ett projekt. Ändringar i det ligger därför utanför *Ångra* (Ctrl+Z). Vyn *Bibliotek* varnar för det själv: *Detta redigerar biblioteket och gäller alla projekt — kan inte ångras*. Borttagning från biblioteket frågar också efter bekräftelse och kan inte ångras.

**”Översikten över beläggning löser överbeläggningen.”** Nej. Översikten är bara ett skrivskyddat fönster. Den visar vilka dagar två projekt tillsammans begär för mycket. *Utjämning* (*Resurser › Utjämning › Utjämna…*, se [Resursutjämning](docs://uitleg-nivelleren)) tittar på resurserna i ett projekt. Den tar inte hänsyn till de andra projekten. Flytta själv en uppgift i ett av projekten, eller ändra kapaciteten i biblioteket om en ny person verkligen tillkommer.

**”Min egen resurs räknas i beläggningen.”** Bara om den finns i biblioteket. En resurs som du bara skapat i projektet, till exempel en inhyrd kran för ett enskilt jobb, har ingen ursprungsstämpel. Den finns därför inte i översikten. Med *Till biblioteket* lägger du till den.

## Se även

- [Använda biblioteket](docs://howto-resourcebibliotheek-gebruiken): länka, tilldela resurser och lösa avvikelser.
- [Hantera och dela bibliotek](docs://howto-bibliotheken-beheren): skapa, exportera och importera bibliotek.
- [Använda översikten över beläggning](docs://howto-bezettingsoverzicht-gebruiken): hitta överbeläggningar över projekt.
- [Hantera resurser](docs://howto-resources-beheren): resurserna i ett enskilt projekt.

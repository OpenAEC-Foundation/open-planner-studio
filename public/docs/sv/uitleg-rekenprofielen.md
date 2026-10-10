# Beräkningsprofiler och beräkningsregler

Samma tidsplan kan ge olika datum. Det beror på vilka beräkningsregler du använder. Den här artikeln förklarar varför Primavera P6 och Microsoft Project beräknar olika på några punkter. Den förklarar också hur appen sparar skillnaden i en **beräkningsprofil**, och hur en profil skiljer sig från de beräkningsalternativ som du själv ställer in per projekt. Ett praktiskt exempel med ett litet nätverk visar vad detta gör med datumen.

## Begreppet

Uppgifter, samband och en kalender avgör det mesta i en tidsplan, men inte allt. Vad händer med arbete som inte har startat när du anger ett rapportdatum? Var börjar återstående arbete för en uppgift som redan pågår? Vad är fritt slack för en uppgift när ett måldatum missas? Nätverket säger inget om det. Ett planeringsprogram måste välja en regel för det. Appen känner till flera punkter där regeln i Primavera P6 och regeln i Microsoft Project skiljer sig.

Appen kallar ett sådant val en **beräkningsregel**. En **beräkningsprofil** är den uppsättning beräkningsregler som hör till ett program. Appen har tre:

- *Open Planner Studio*: profilen som ett nytt projekt beräknas med. Ingen beräkningsregel är på.
- *Primavera P6*: de beräkningsregler som appen känner från P6.
- *Microsoft Project*: de beräkningsregler som appen känner från Microsoft Project.

Profilen anger alltså hur ett program beräknar. Vad du vill ha för ditt projekt ingår inte i den. Det är **beräkningsalternativen**: till exempel när en uppgift blir kritisk utifrån hur lite slack den har, eller i vilken kalender en fördröjning räknas. Du ställer in dem per projekt.

## Så beräknar appen

### Beräkningsregler och beräkningsalternativ

En beräkningsregel är en omkopplare: på eller av. Profilen bestämmer vilka omkopplare som är på. Ett beräkningsalternativ är ett val som du gör. Du ser skillnaden i appen i blocket *Beräkningsprofil och beräkningsalternativ*:

- **Beräkningsregler** finns under *Beräkningsregler i den här profilen*, grupperade per ämne, till exempel *Framdrift och slutfört arbete*, *Samband och fördröjning* och *Slack och senaste datum*. Varje rad är en kryssruta med värdet för profilen efter sig (*bas: på* eller *bas: av*). Om ditt val skiljer sig syns raden tydligare och *tillbaka till bas* visas. Pilen framför en rad öppnar förklaringen av den beräkningsregeln. Läs den först om du vill ändra en beräkningsregel.
- **Beräkningsalternativ** finns under *Beräkningsalternativ för det här projektet*: bland andra *Definition av kritisk*, *Slackberäkning*, *Uppgifter med öppet slut är kritiska*, *Markera nära kritisk* och *Fördröjningskalender*. De visar vad du vill ha för det här projektet, inte hur ett program beräknar. Vad de gör förklaras i [Kritisk linje och slack](docs://uitleg-kritiek-pad) och [Samband och fördröjning](docs://uitleg-relaties).

Här är ett exempel av varje. ”En uppgift är kritisk om dess totalt slack är 0 eller lägre” är ett beräkningsalternativ. Du kan ställa tröskelvärdet på 4. Då är allt med 4 arbetsdagar slack eller mindre kritiskt. ”Arbete som inte har startat flyttas till rapportdatumet” är en beräkningsregel. Open Planner Studio och Primavera P6 gör det. Microsoft Project gör det inte.

Profilen och beräkningsalternativen hör till projektfilen, inte till appen. Sparar du projektet, följer de med. Två projekt i samma app kan därför beräknas med olika profiler. Ett projekt utan profil beräknas som Open Planner Studio.

Finns det beräkningsalternativ som bara Primavera känner till, visar blocket dessutom *Inställningar från källfilen* längst ned. Det gäller för ett projekt från en .xer file. Det gäller även om du väljer *Primavera P6* i *Nytt projekt* eller tillämpar standardalternativen för Primavera P6. Du kan inte ändra dem här.

### Var du väljer profilen

För ett nytt projekt finns profilen i fönstret *Nytt projekt*, som du öppnar via *Start › Fil › Ny*. Där är *Beräkningsprofil* en rullgardinslista. Väljer du en profil där, ersätter appen de beräkningsalternativ som du redan hade ifyllt med standardvärdena för den profilen. Enda undantaget är inställningar från en källfil. Med *Primavera P6* är *Slackberäkning* då *Slutslack*. Med *Microsoft Project* och *Open Planner Studio* står varje beräkningsalternativ på standard. Då är *Slackberäkning* *Automatiskt (standard)*. Med ett rapportdatum beräknar även Microsoft Project på det sättet: en startad uppgift får slutslack, och varje annan uppgift får det minsta av start- och slutslack.

För ett befintligt projekt väljer du profilen under *Inställningar › Projekt › Projektinfo*, i blocket *Beräkningsprofil och beräkningsalternativ*, i rullgardinslistan *Beräkningsprofil*. Du kommer till samma plats via *Fil › Projektinfo*. Att byta profil här ändrar bara beräkningsreglerna. Dina beräkningsalternativ ligger kvar som de är. Vill du också ha standardalternativen för den nya profilen, välj *Använd standardalternativen för den här profilen*.

Tills du trycker på *Tillämpa* finns en ändring bara i formuläret. Med *Tillämpa* beräknar appen tidsplanen direkt, även om *Beräkna automatiskt* är av. Har uppgifter flyttats, säger appen hur många, till exempel *Efter tillämpning har 4 uppgifter flyttats.* Du ångrar hela bytet i ett steg med knappen *Ångra*.

Slår du på eller av en beräkningsregel i en profil, gör appen en egen profil av den. Den heter *Kopia av Open Planner Studio*, eller *Kopia av* den profil du började med. Du kan ge den ett annat namn och behålla den med *Spara som mall* för andra projekt i den här appen. Projektet har alltid en egen kopia. Ändrar du mallen senare, ändras inte projektet med den.

### När appen väljer en profil själv

När du öppnar en fil föreslår appen en profil utifrån formatet:

- En .mpp-fil (Microsoft Project) öppnas med profilen *Microsoft Project*.
- En .xer file (Primavera P6) öppnas med profilen *Primavera P6*.
- En fil i formatet *MS Project XML*, *Primavera P6 XML* eller *CSV (semikolonseparerad)* öppnas med *Open Planner Studio*, utan profilmeddelande.
- Ett eget projekt (.ifc) öppnas med den profil som är sparad i det.

För en .mpp- eller .xer-fil rapporterar appen profilen: *Det här projektet beräknas enligt Microsoft Project. Ändra det via Arkiv → Projektinfo → Beräkningsprofil och beräkningsalternativ.* Knappen *Öppna beräkningsprofil* i meddelandet tar dig direkt till Projektinfo. För en .xer file är den här raden den första detaljraden i filens öppningsmeddelande. Mer om meddelandet står i [Att öppna en Primavera P6-fil (.xer)](docs://howto-xer-openen) och [Att öppna en MS Project-fil (.mpp)](docs://howto-mpp-openen).

För en .mpp-fil ställer appen bara in profilen. Beräkningsalternativen förblir tomma, precis som i ett nytt projekt med profilen *Microsoft Project*: *Slackberäkning* är *Automatiskt (standard)*. En öppnad .mpp-fil och ett nytt projekt med *Microsoft Project* beräknar därför slack på samma sätt.

## Ett praktiskt exempel: ett nätverk, tre profiler

Exemplet är ett litet nätverk. Kalendern har en arbetsvecka från måndag till fredag och inga lediga dagar i de här veckorna. Framdriftsläget är *Retained Logic* (standard). Projektstarten är måndag 7 juni 2027. Alla uppgifter är i arbetsdagar.

- *Pour foundation*: 5 arbetsdagar, planerad från måndag 7 juni.
- *Lay walls*: 5 arbetsdagar, efter *Pour foundation* (slut-till-start).
- *Order window frames*: 3 arbetsdagar, ingen föregående uppgift, planerad från måndag 7 juni.
- *Fit roof*: 2 arbetsdagar, efter *Lay walls* och efter *Order window frames*. Slutet av den här uppgiften är överlämningen.

Siffrorna beräknades med appens beräkningsmotor. Du läser dem i panelen *Egenskaper* under *CPM-resultat*.

**Utan rapportdatum och utan framdrift beräknar de tre profilerna det här nätverket på samma sätt.** *Pour foundation* går från måndag 7 till fredag 11 juni, *Lay walls* från måndag 14 till fredag 18 juni och *Fit roof* måndag 21 och tisdag 22 juni. Överlämningen är tisdag 22 juni. *Order window frames* (måndag 7 till onsdag 9 juni) har 7 arbetsdagar totalt slack.

Nu registrerar du läget. Rapportdatumet är onsdag 9 juni. Grunden startade måndag 7 juni och står på 60 %. Återstående arbete är därför 2 arbetsdagar (5 × 40 %). *Order window frames* har inte startat. Hur [framdrift och rapportdatum](docs://uitleg-voortgang) fungerar, står i den artikeln. Här är frågan vad profilen gör med det.

### Open Planner Studio

Återstående arbete för grunden börjar på rapportdatumet: onsdag 9 och torsdag 10 juni. Den tidigaste starten förblir den verkliga starten, måndag 7 juni. Det tidigaste slutet är torsdag 10 juni. *Lay walls* går från fredag 11 till torsdag 17 juni och *Fit roof* fredag 18 och måndag 21 juni.

*Order window frames* var planerad till måndag 7 juni, men har inte startat. Arbete som inte har startat kan inte ligga i det förflutna. Därför flyttar appen den till rapportdatumet: onsdag 9 till fredag 11 juni, med 4 arbetsdagar totalt slack. Överlämningen är måndag 21 juni.

### Primavera P6

Allt är detsamma som i Open Planner Studio, med ett undantag: den tidigaste starten för *Pour foundation* är onsdag 9 juni. Det är början av återstående arbete, inte den verkliga starten. Det regleras av beräkningsregeln *Pågående uppgift: tidigaste start = början av återstående arbete*, i gruppen *Framdrift och slutfört arbete*. Slutet och slacket ändras inte av det. Överlämningen är måndag 21 juni.

### Microsoft Project

Här skiljer sig datumen. Två beräkningsregler i gruppen *Framdrift som i Microsoft Project* ger det.

*Ej påbörjade uppgifter flyttas inte till rapportdatumet*: *Order window frames* står kvar från måndag 7 till onsdag 9 juni, även om det delvis ligger före rapportdatumet. Det totala slacket är 7 arbetsdagar.

*Återstående arbete återupptas efter den förflutna tiden*: återstående arbete börjar tidigast på rapportdatumet, och tidigast på den verkliga starten plus den redan förflutna tiden. Vid 60 % av 5 arbetsdagar är 3 arbetsdagar gjorda. Måndag 7 juni plus 3 arbetsdagar är torsdag 10 juni. Det är efter rapportdatumet, så återstående arbete går torsdag 10 och fredag 11 juni. *Lay walls* går från måndag 14 till fredag 18 juni och *Fit roof* måndag 21 och tisdag 22 juni. Överlämningen är tisdag 22 juni: en arbetsdag senare än i de andra två profilerna.

### Vad händer om

**Grunden står på 20 % i stället för 60 %.** Återstående arbete är då 4 arbetsdagar. Med alla tre profilerna är grunden klar måndag 14 juni och överlämningen onsdag 23 juni. Beräkningsregeln i Microsoft Project för återstående arbete gör ingen skillnad här: måndag 7 juni plus 1 förfluten arbetsdag är tisdag 8 juni, och det ligger före rapportdatumet. En sådan beräkningsregel är en nedre gräns. Den kan bara göra att återstående arbete blir senare. *Order window frames* och den tidigaste starten under Primavera P6 skiljer sig fortfarande, som ovan. Under Microsoft Project har *Order window frames* då 8 arbetsdagar totalt slack.

**Du anger bara ett rapportdatum och registrerar ingen framdrift.** Med Open Planner Studio och Primavera P6 flyttas hela nätverket till onsdag 9 juni. Grunden går då från onsdag 9 till tisdag 15 juni och överlämningen blir torsdag 24 juni: två arbetsdagar senare än utan rapportdatum. Med Microsoft Project står allt kvar där det var och överlämningen är tisdag 22 juni.

**Du sätter ihop en profil själv.** Slår du bara på *Ej påbörjade uppgifter flyttas inte till rapportdatumet* under Open Planner Studio, blir det en egen profil: *Kopia av Open Planner Studio*. Med 60 % framdrift behåller grunden datumen från Open Planner Studio (slut torsdag 10 juni, överlämning måndag 21 juni). *Order window frames* står kvar från måndag 7 till onsdag 9 juni, med 6 arbetsdagar totalt slack. En profil är alltså en samling separata omkopplare, och du kan ändra dem en och en.

**Ett beräkningsalternativ i stället för en beräkningsregel.** Ställer du in *Definition av kritisk* (*Totalt slack ≤ tröskelvärde*) med *Tröskelvärde (arbetsdagar)* på 4 under Open Planner Studio, blir *Order window frames* kritisk, eftersom dess totala slack är exakt 4. Inget datum ändras. Ett beräkningsalternativ är ditt val för projektet och är oberoende av profilen.

**Ett måldatum som missas.** Ge *Fit roof* ett måldatum fredag 18 juni. Med Open Planner Studio är det totala slacket för *Fit roof* då −1 arbetsdag och det fria slacket också −1. Med Primavera P6 är det totala slacket kvar på −1, men det fria slacket blir 0. Det är vad beräkningsregeln *Fritt slack är aldrig negativt* gör, i gruppen *Slack och senaste datum*. Med Microsoft Project är båda −2, eftersom överlämningen där infaller en dag senare. Hur ett måldatum fungerar, står i [Restriktioner och måldatum](docs://uitleg-constraints).

## Konsekvenser och missförstånd

**”Beräkningsprofilen är en inställning i appen.”** Nej. Beräkningsprofilen och beräkningsalternativen hör till projektet och följer med i filen. Bara de mallar som du sparar hör till appen. Ett projekt har alltid sin egen kopia.

**”Om jag exporterar följer min beräkningsprofil med.”** Bara med ditt eget projektformat (.ifc). Om du exporterar till *MS Project XML*, *Primavera P6 XML* eller *CSV (semikolonseparerad)* ingår beräkningsprofilen inte i filen. Av beräkningsalternativen skriver exporten till MS Project XML högst det kritiska tröskelvärdet. Appen varnar bara för detta för ett projekt som kommer från en .xer file. För ett projekt som du har skapat själv får du inget meddelande. Filen öppnas då som Open Planner Studio, utan något meddelande om beräkningsprofilen. Ta exemplet med beräkningsprofilen Microsoft Project och 60 % framdrift. Om du exporterar den till *MS Project XML* och öppnar den igen visar appen först datumen från filen, med överlämningen på tisdag 22 juni. Om du låter appen beräkna om själv blir det måndag 21 juni. Vad mer en export förlorar står i [Filer och format](docs://uitleg-bestanden).

**”Beräkningsprofilen Primavera P6 ger samma resultat som P6.”** Det kan appen inte garantera. Beräkningsprofilen slår på de beräkningsregler som appen känner från P6, och det är inte alla inställningar i P6. Utöver Retained Logic och Progress Override har P6 ett tredje framdriftsläge, Actual Dates. Appen känner inte till det. En sådan .xer file räknas ut med Retained Logic, och meddelandet vid öppnandet rapporterar det, till exempel som *1 P6-tidsplaninställning med säker reservlösning.* Vissa beräkningsregler i beräkningsprofilen Primavera P6 fungerar också bara på uppgifter som kommer från en .xer file, till exempel *Ej påbörjad LOE använder målfönstret* och *Behåll verkliga datum exakt*. För några av dem säger förklaringen det: ”bara uppgifter med P6-ursprung”. På uppgifter som du skapar själv gör de beräkningsreglerna ingenting.

**”Framdriftsläget är en del av beräkningsprofilen.”** Nej. Retained Logic eller Progress Override är ett separat val för varje projekt. Du ställer in det separat från beräkningsprofilen, se [Välja framdriftsläge](docs://howto-voortgangsmodus-kiezen). En beräkningsregel i Primavera P6, *Progress Override negeras även för en påbörjad efterföljande uppgift bakåt*, gör bara något under Progress Override.

**”Jag byter bara beräkningsprofil för att se vad som händer.”** Det kan du, eftersom *Tillämpa* är ett steg som *Ångra* tar tillbaka: beräkningsprofilen och datumen går tillbaka tillsammans. Men datumen kan verkligen flyttas. I exemplet flyttar bytet från Open Planner Studio till Microsoft Project alla 4 uppgifter. Meddelandet räknar dem åt dig. Titta på tidsplanen efteråt innan du går vidare. Om appen fortfarande visar datumen från filen efter att du har öppnat en .xer file eller .mpp-fil, lämnar ett byte av beräkningsprofil den vyn och appen räknar ut datumen själv. Hur det fungerar står i [Datum som de har sparats](docs://uitleg-datums-zoals-opgeslagen).

**”Exemplet visar fyra beräkningsregler, och listan i appen är längre.”** Varje rad i blocket har en egen förklaring. Läs den först. Titta också på gruppen *Endast egna profiler*: de beräkningsreglerna är av i varje inbyggd beräkningsprofil, även i Primavera P6. Slår du på en av dem blir beräkningsprofilen en egen profil.

## Se även

- [Framdrift, rapportdatum och baslinje](docs://uitleg-voortgang): vad rapportdatumet och återstående arbete gör, med skillnaderna per beräkningsprofil.
- [Välja framdriftsläge](docs://howto-voortgangsmodus-kiezen): hur du väljer Retained Logic eller Progress Override.
- [Kritisk linje och slack](docs://uitleg-kritiek-pad): beräkningsalternativen för kritisk linje och slack.
- [Samband och fördröjning](docs://uitleg-relaties): beräkningsalternativet *Fördröjningskalender*.
- [Filer och format](docs://uitleg-bestanden): vad en export tar med och vad den inte tar med.
- [Exportera](docs://howto-exporteren): hur du exporterar ett projekt.
- [Uppdatera framdrift](docs://howto-voortgang-bijwerken): så anger du procent, verklig start och rapportdatum.
- [Datum som de har sparats](docs://uitleg-datums-zoals-opgeslagen): varför importerade datum kan skilja sig från vad appen räknar ut själv.
- [Beräkningsalternativ och beräkningsregler](docs://ref-rekenopties-en-conventies): alla beräkningsregler och beräkningsalternativ i en lista.

# Tilläggens behörigheter

Alla behörigheter som ett tillägg kan ange i sitt manifest: vad de tillåter, vad som händer när de saknas och vad du ser av dem när du installerar ett tillägg. Hur du installerar och hanterar tillägg står i [Installera och hantera ett tillägg](docs://howto-extensie-installeren).

## Vad en behörighet är och inte är

En behörighet är en **deklaration från utvecklaren**: vilka delar av appens gränssnitt tillägget vill använda. Den är inte en spärr. Koden i ett tillägg körs i samma miljö som appen själv och kan därför göra mer än behörigheterna säger: det finns ingen sandlåda. Appen säger det också i installationsfönstret. Installera bara tillägg från utvecklare som du litar på.

Appen tillämpar en behörighet på ett av tre sätt, och skillnaden spelar roll:

**Hårt tillämpad.** Om behörigheten saknas ger motsvarande metod ett fel (på nederländska, till exempel *Extensie ”…” mist permissie: ribbon*) innan något händer.

**Varning.** Om behörigheten saknas fungerar metoden ändå, men appen skriver en varning i loggen. I en framtida version blir det ett avslag.

**Endast informativ.** Behörigheten kopplas inte till någon del av gränssnittet. Appen visar den vid installationen och gör ingenting annat med den.

Det som inte kräver någon behörighet är grunden för tilläggets gränssnitt: läsa projektet, kalendern, uppgifterna, sambanden, resurserna och tilldelningarna; lägga till uppgifter och samband och ändra uppgifter; ladda ett projekt, beräkna om och samla flera ändringar i ett steg; spara egna inställningar, läsa egna medföljande filer och visa en avisering.

**Manifestet.** Behörigheterna står i manifestet som en lista. Ett tillägg som du installerar nu, med en behörighet som den här appversionen inte känner till, avvisas. För ett redan sparat äldre tillägg tar appen bort okända behörigheter och rapporterar det i loggen.

## Så frågar appen

Vid installation, från katalogen (*Fil › Tillägg › Bläddra › Installera*) eller från en fil (*ZIP* eller *JS*), visar appen fönstret *Installera tillägg?*. Frågan kommer en gång, vid installationen: inte varje gång du slår på tillägget.

Fönstret visar namn, version, beskrivning, utvecklare och, om det finns, förvaret. Under *Ursprung* står var tillägget kommer från (*Från den onlinebaserade tilläggskatalogen*, *Från en ZIP-fil på den här datorn* eller *Från en JavaScript-fil på den här datorn*) och om nedladdningen är verifierad: med kontrollsumman från katalogen, ej verifierad eftersom katalogen inte har någon kontrollsumma, eller en fil som du valde själv. Under *Vad du går med på* står att ett tillägg är programkod som körs med samma rättigheter som appen, och vad det innebär i praktiken: i skrivbordsappen bland annat läsa och skriva filer var som helst i din användarmapp, plus åtkomst till dina projekt, inställningar och urklipp; i webbläsaren åtkomst till dina sparade projekt och inställningar, till de filer som du gav åtkomst till och till nätverket.

Under *Vad det här tillägget säger att det använder* visas behörigheterna från manifestet, som korta etiketter med samma namn som nedan. Det står: *Detta är utvecklarens angivelse, ingen restriktion — koden kan ändå göra mer.* Om tillägget inte har några behörigheter står det *Inget angivet.* Två behörigheter får en förklaring: *importSource* och *help*. De övriga sex får bara sin etikett.

Med *Installera* godkänner du. *Installera inte*, Esc och ett klick utanför fönstret avvisar installationen.

## Behörigheterna

**ribbon** — placera en knapp i menyfliksområdet. Effekt: tillägget får lägga till en knapp i en grupp på en menyflik. Ett tillägg utan den här behörigheten får ett fel när det försöker. Knapparna visas i slutet av den valda menyfliken, under en grupprubrik för tillägget, och försvinner när du stänger av tillägget eller tar bort det. Standard: inte beviljad; bara det som finns i manifestet. Tillämpning: hård. Var: på menyfliken som tillägget valde.

**events** — följ appens händelser och skicka egna händelser. Effekt: tillägget får prenumerera på och avsluta prenumerationen på händelser och skicka egna händelser. Appen själv skickar tre: ett projekt läses in (efter import, öppning eller inläsning av ett tillägg), ett tomt projekt skapas och tidsplanen beräknas (om). Standard: inte beviljad; bara det som finns i manifestet. Tillämpning: hård. Var: ingenstans; tillägget reagerar på händelsen.

**backstage** — erbjud ett importformat. Effekt: tillägget får registrera en importör; den visas under *Fil › Importera*, där du klickar på ett format och väljer en fil. De inbyggda formaten är separata från detta (se [Import- och exportformat](docs://ref-import-exportformaten)). Standard: inte beviljad; bara det som finns i manifestet. Tillämpning: varning. Om behörigheten saknas fungerar registreringen ändå, med en varning i loggen. Det är en övergångsregel, eftersom befintliga tillägg inte alltid anger behörigheten. Var: *Fil › Importera*.

**pdf-fonts** — lägg till ett teckensnitt för PDF-exporten. Effekt: tillägget får registrera en teckensnittsleverantör. PDF-exporten använder den för tecken som de inbyggda teckensnitten inte täcker, till exempel kinesiska, japanska och koreanska tecken. Standard: inte beviljad; bara det som finns i manifestet. Tillämpning: hård. Var: i PDF-filen för en rapport; i installationsfönstret finns bara etiketten.

**importSource** — läs originalbytena i en importerad fil. Effekt: tillägget får begära hela innehållet i källfilen för ett importerat projekt (för närvarande: en Primavera-fil), inklusive fälten som appen medvetet inte tar med i ditt projekt, till exempel fält för revision och ursprung, kostnader, granskning och plats. Det är mycket bredare än resten av gränssnittet och är därför en separat behörighet. Utan behörigheten läser appen inte en enda byte av källfilen: varje metod ger då ett fel innan något hämtas. Standard: inte beviljad; bara det som finns i manifestet. Tillämpning: hård, nekas som standard. Var: i installationsfönstret visas också en förklaring: *importSource — de fullständiga ursprungliga källbytena för varje importerad fil (till exempel en rå Primavera-fil), även fält som aldrig hamnar i projektet.*

**help** — lägg till hjälpartiklar och vägledning. Effekt: tillägget får registrera och ta bort hjälpartiklar (självstudier), öppna en medföljande `.ifc`-fil som nytt dokument och starta och stoppa en guide som pekar på delar av appen. Ett medföljande projekt skriver aldrig över dokumentet som du arbetar i: det öppnas som ett nytt dokument, eller tar bara över en tom, oförändrad flik. Från och med kontraktsversion 1.4.0. Standard: inte beviljad; bara det som finns i manifestet. Tillämpning: hård. Var: i fönstret *Hjälp* (artiklarna), som en ny flik (projektet) och som en guide som pekar på knappar. I installationsfönstret visas också en förklaring: *help — får lägga till hjälpartiklar, öppna medföljande projekt som nytt dokument och visa en guide som pekar på delar av appen.*

**filesystem** — tillägget anger att det använder filer. Effekt: ingen; ingen del av gränssnittet kopplas till den, och appen kan inte tillämpa den. Standard: inte beviljad; bara det som finns i manifestet. Tillämpning: endast informativ. Var: som en etikett i installationsfönstret.

**network** — tillägget anger att det använder nätverket. Effekt: ingen; som *filesystem*. Standard: inte beviljad; bara det som finns i manifestet. Tillämpning: endast informativ. Var: som en etikett i installationsfönstret.

## Se även

- [Import- och exportformat](docs://ref-import-exportformaten): de format som appen känner till själv, bredvid det som tillägg lägger till under *Fil › Importera*.
- [Installera och hantera ett tillägg](docs://howto-extensie-installeren): installera, inaktivera och ta bort ett tillägg.

# Importera framdrift från ett kalkylblad

Mål: lägg in den framdrift som personalen på byggplatsen fyller i i ett kalkylblad i tidsplanen på en gång, utan att du klickar på varje uppgift själv.

## När du behöver det här

En underentreprenör eller arbetsledare har inte appen, men rapporterar läget varje vecka: hur många procent som är klara, när arbetet startade och när det slutade. Du skickar honom ett blad med dina uppgifter. Han fyller i tre kolumner och skickar tillbaka det. Appen läser då bara tre värden per uppgift: slutförandegrad, verklig start och verkligt slut. Resten av din tidsplan lämnas orörd. Vad appen gör med framdriften förklaras i [Framdrift, rapportdatum och baslinje](docs://uitleg-voortgang).

## Steg

### 1. Ange rapportdatumet och beräkna

Ange rapportdatumet så som beskrivs i [Uppdatera framdrift](docs://howto-voortgang-bijwerken). Arbetsledaren fyller i verkliga datum till och med den dagen. Om tidsplanen inte längre är aktuell beräknar appen om den innan bladet skapas.

### 2. Skapa bladet

Välj *Tidsplan › Framdrift › Exportera framdriftsblad*. Samma knapp finns på flikarna *Tabell* och *Rapport*. Appen skapar en Excel-fil och föreslår namnet *(projektnamn)-voortgang.xlsx*. I webbläsaren hamnar filen i dina nedladdningar. Föredrar du en CSV-fil? Välj *Fil › Exportera › Framdriftsblad (CSV)*. Excel-bladet finns där också, som *Framdriftsblad (Excel)*.

Bladet har åtta kolumner. Kolumnnamnen står kvar på engelska, med en kort instruktion efter dem på appens språk:

- `OPS Task ID`, `WBS` och `Name` finns bara för att känna igen uppgiften. Ändra dem inte.
- `Start` och `Finish` är de planerade datumen, bara som information. Appen skriver aldrig tillbaka dem.
- `Completion (%)`, `Actual Start` och `Actual Finish` är de kolumner du fyller i.

Excel-bladet är skyddat utan lösenord: bara de tre kolumner som ska fyllas i kan redigeras. Excel kontrollerar att en procentsats ligger mellan 0 och 100 och att ett verkligt datum är ett datum. En fas (sammanfattningsuppgift) markeras grå med *— sammanfattningsuppgift: fyll inte i*.

### 3. Låt bladet fyllas i

För varje uppgift fyller arbetsledaren i:

- `Completion (%)`: 0 till och med 100. I Excel-bladet får decimaler användas, till exempel 33,3. I CSV-filen ber instruktionen om hela tal.
- `Actual Start` och `Actual Finish`: i Excel som ett datum i din egen regionala inställning; i CSV-filen som dd-mm-yyyy.

Allt som lämnas tomt ändras inte. En tom cell tar alltså inte bort befintlig framdrift heller. Det kan bara göras i appen. En uppgift som inte har startat lämnar han helt tom.

### 4. Läs in bladet

1. Välj *Tidsplan › Framdrift › Uppdatera framdrift från ett kalkylblad* (även på flikarna *Tabell* och *Rapport*), eller *Fil › Importera › Uppdatera framdrift från ett kalkylblad*. Fönstret *Uppdatera framdrift från ett kalkylblad* öppnas.
2. Klicka på *Välj fil…* och välj den ifyllda filen `.xlsx` eller `.csv`.
3. Om datumen i en CSV-fil är tvetydiga frågar appen *Dag eller månad först?*. Appen visar datumet från din fil på två sätt. Klicka på det datum som är rätt.
4. Du ser nu en förhandsgranskning. Överst finns fyra räknare: *Tillämpade*, *Oförändrade*, *Väntar på länk* och *Avvisade*. Under det ser du per uppgift vad som ändras, till exempel *Slutförandegrad: 0% → 100%*.
5. Kontrollera förhandsgranskningen och klicka på *Tillämpa*. Fönstret visar *Resultat*, med räknarna och de rader som avvisades och varför. Avsluta med *Stäng*.

Du kan inte hoppa över förhandsgranskningen. Knappen *Tillämpa* är inaktiv så länge det inte finns något att tillämpa.

### 5. Beräkna tidsplanen om

Att läsa in bladet beräknar inte om tidsplanen av sig själv. Tryck på **Beräkna** (F5), till exempel via *Tidsplan › Tidsplan › Beräkna*, om inte *Beräkna automatiskt* är på.

## Rader som inte bara passar

Appen länkar varje rad till en uppgift, först med `OPS Task ID` och annars med WBS-numret.

**Länken är osäker.** Om appen bara hittade uppgiften via WBS-nummer, står raden under *Länken är osäker*, med *Bekräfta* och *Ändra*. Raden tillämpas också om du inte gör något. Kontrollera därför att uppgiften är rätt. *Bekräfta* tar bort raden från den här listan. Det ändrar inget i vad som tillämpas. Med *Ändra* väljer du en annan uppgift. Med *Ta bort länk* tar du bort en länk som du själv har gjort. Obs: ett blad från ett annat projekt med samma WBS-nummer länkas ändå, under *Länken är osäker*, och tillämpas när du klickar på *Tillämpa*.

**Väntar på länk.** Om appen inte hittar någon uppgift, eller flera med samma WBS-nummer, står raden under *Väntar på länk*. Vid *Välj en uppgift…* väljer du rätt uppgift. Du söker på WBS-nummer eller namn. Länkar du inte raden avvisas den.

## Fallgropar och vad appen gör

En rad som inte passar avvisas med en orsak. Resten av bladet fortsätter bara. Det här är de viktigaste meddelandena:

- *Det verkliga datumet ligger efter rapportdatumet.* Ange ett senare rapportdatum eller rätta bladet.
- *Enligt tidsplanen startar den här uppgiften först efter rapportdatumet: fyll först i dess verkliga start i kalkylbladet.* Appen hittar inte på en start. Lägg till den i bladet.
- *Procentsats utanför 0–100. Kontrollera decimaltecknet: 8,38 kan läsas som 838 av ett kalkylprogram med en annan språkinställning.*
- *Sammanfattningsuppgifter kan inte få framdrift från ett kalkylblad.* Framdriften för en fas följer av uppgifterna under den.
- *Verkligt slut ligger före verklig start.*
- *Oläsbart datum.* och *Oläsbar procentsats.*
- *De ifyllda värdena motsäger varandra.* Till exempel ett verkligt slut med en procentsats under 100.
- *Ingen uppgift hittades för den här raden.* Bladet nämner ett uppgifts-ID och ett WBS-nummer som inte finns i det här projektet.
- *Den här WBS-koden finns på flera uppgifter — koppla raden för hand.*
- *En annan rad har redan gjort anspråk på den här uppgiften.* Två rader pekar på samma uppgift.
- *Avvisat av planeraren.* En annan avvisning av tidsplanen själv, utan ett eget meddelande.

Om hela filen avvisas visas ett av dessa meddelanden i fönstret: *Den här filen har ingen kolumn “OPS Task ID” eller “WBS” för att koppla rader till uppgifter.*, *Den här filen har ingen av kolumnerna Slutförandegrad, Verklig start eller Verkligt slut.*, *Den här filen är för stor för att läsas som kalkylblad för framdrift.* (mer än 16 MB), *Den här filen har för många rader för att läsas som kalkylblad för framdrift.* (fler än 50 000 rader) eller *Den här filen är skyddad med ett lösenord och kan inte läsas.* eller *Den här filen kunde inte läsas som kalkylblad för framdrift.*

**Inget rapportdatum.** Finns det ännu inget rapportdatum och tillämpar importen framdrift, sätter appen det till idag och meddelar dig. Ange det därför själv först.

**Allt ångras på en gång.** Hela bladet är ett enda steg för Ctrl+Z.

**Bara det du fyller i.** En rad utan skillnad mot tidsplanen räknas till *Oförändrade*. En uppgift utan rad i bladet förblir som den var.

## Se också

- [Framdrift, rapportdatum och baslinje](docs://uitleg-voortgang): vad appen beräknar med verkliga datum och procentsatser.
- [Uppdatera framdrift](docs://howto-voortgang-bijwerken): att ange framdrift i appen själv.

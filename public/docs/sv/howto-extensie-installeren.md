# Installera och hantera ett tillägg

Mål: installera ett tillägg, läs behörighetsfrågan och inaktivera eller ta bort tillägget senare.

## När du behöver detta

Ett tillägg lägger till något i appen utan att du behöver vänta på en ny version. Ett tillägg kan till exempel lägga till ett importformat som visas under *Fil › Importera*, lägga en knapp i menyfliksområdet eller leverera ett typsnitt för PDF-exporten. Den officiella katalogen delar in tilläggen i kategorierna *Import/Export*, *Tidsplan*, *Rapportering*, *Verktyg*, *Typsnitt* och *Övrigt*.

Tänk efter noga innan du installerar ett tillägg. Ett tillägg är programkod som körs med samma rättigheter som appen själv, och appen kan inte begränsa det. Därför frågar appen om behörighet vid varje installation. Vad du ser i den frågan förklaras nedan.

## Steg

### Installera ett tillägg från katalogen

1. Välj *Fil › Tillägg*.
2. Välj fliken *Bläddra*. Appen hämtar katalogen medan den visar *Katalogen laddas...*. Vad som finns i katalogen bestäms av OpenAEC Foundation, som underhåller den. Det kan ändras.
3. Sök efter ett tillägg i fältet *Sök tillägg...*. Sökningen gäller namn, beskrivning, författare och taggar.
4. Varje kort visar namn, version, kategori, beskrivning och författare. Klicka på *Installera*.
5. Fönstret *Installera tillägg?* öppnas. Läs det och se nästa steg.
6. Klicka på *Installera* för att fortsätta. Med *Installera inte* händer ingenting. Esc eller ett klick bredvid fönstret räknas också som att du avböjer, och appen visar då inget felmeddelande.

Efter installationen är tillägget direkt aktiverat. På kortet under *Bläddra* står det nu *Installerad*. Vad tillägget lägger till ser du i appen: en ny knapp i menyfliksområdet, eller ett importformat under *Fil › Importera*. Vissa tillägg visar också ett meddelande. Du känner igen det på prefixet *Tillägg* följt av tilläggets namn.

### Installera ett tillägg från en fil

Om du fick ett tillägg som fil installerar du det så här.

1. Välj *Fil › Tillägg*.
2. Klicka längst upp till höger på *ZIP* för en ZIP-fil, eller på *JS* för en separat JavaScript-fil.
3. Välj filen. Fönstret *Installera tillägg?* öppnas, som ovan.

En ZIP-fil måste innehålla en `manifest.json` och tilläggets huvudfil. Om du installerar ett tillägg som redan är installerat ersätter den nya versionen den gamla. Om appen inte kan installera filen, till exempel för att en ZIP-fil är skadad, händer ingenting: appen visar inget felmeddelande för ZIP och JS, och tillägget syns inte i listan. Orsaken står dock i felsökningsterminalen. Slå på den under *Inställningar › Projekt › Inställningar*, fliken *Avancerat*, *Aktivera felsökningsterminal*, och öppna den med knappen *Visa felsökningsterminalen* i statusfältet. Där står till exempel *[Extensies] ZIP-installatie mislukt: Error: Geen manifest.json gevonden in ZIP* (appen skriver den här tekniska texten på nederländska).

### Läs behörighetsfrågan

Frågan visar vad du behöver besluta.

- *Författare* och *Repository* visar vem som har gjort tillägget och var källkoden finns.
- *Ursprung* visar varifrån filen kommer: *Från den onlinebaserade tilläggskatalogen*, *Från en ZIP-fil på den här datorn* eller *Från en JavaScript-fil på den här datorn*. Under det står om filen har kontrollerats. För katalogen står det *Nedladdningen är verifierad med kontrollsumman från katalogen.* Om katalogen inte har någon kontrollsumma står det i rött *Katalogen anger ingen kontrollsumma — den här nedladdningen är inte verifierad.* För en fil som du valt själv står det *Du valde den här filen själv; det finns ingen extern källa att verifiera den mot.*
- *Vad du går med på* säger: *Ett tillägg är programkod som körs med samma rättigheter som Open Planner Studio själv. Inget begränsar det. Installera bara tillägg vars utvecklare du litar på.* Under det står vad det betyder på din plattform. I skrivbordsappen står det *I skrivbordsappen betyder det bland annat: att läsa och skriva filer i hela din användarmapp, och åtkomst till dina projekt, inställningar och urklipp.* I webbläsaren står det *I webbläsaren betyder det: åtkomst till dina sparade projekt och inställningar, till de filer du gav åtkomst, och till nätverket.*
- *Vad det här tillägget säger att det använder* visar de behörigheter som författaren angett, som små etiketter. Det är en angivelse från författaren och ingen begränsning: *Detta är utvecklarens angivelse, ingen restriktion — koden kan ändå göra mer.* Om det inte finns någon etikett står det *Inget angivet.* Det betyder inte att tillägget inte kan göra något. Även utan etiketter kan ett tillägg läsa och ändra data i din tidsplan och visa meddelanden.

Etiketterna betyder följande:

- *menyfliksområdet*: tillägget lägger knappar i menyfliksområdet.
- *händelser*: tillägget lyssnar på händelser i appen.
- *backstage*: tillägget lägger till importformat under *Fil › Importera*.
- *pdf-fonts*: tillägget levererar ett typsnitt för PDF-exporten.
- *importSource*: tillägget får läsa alla ursprungliga byte i varje fil du importerar, till exempel en rå Primavera-fil, inklusive fält som inte hamnar i ditt projekt. Fönstret förklarar detta också.
- *hjälp*: tillägget får lägga till artiklar i hjälpen, öppna medföljande projekt som ett nytt dokument och visa en guide som pekar på delar av appen. Fönstret förklarar även detta.
- *filsystem* och *nätverk*: det här är bara angivelser av vad författaren avser. Appen har ingen funktion för dem.

### Inaktivera, aktivera igen eller ta bort ett tillägg

1. Välj *Fil › Tillägg* och fliken *Installerade*. Varje tillägg har ett kort med namn, version, kategori, beskrivning och författare.
2. Med reglaget på kortet inaktiverar du tillägget (*Inaktivera*) eller aktiverar det igen (*Aktivera*). När tillägget är inaktiverat försvinner knapparna och importformaten som tillägget lade till, men tillägget är kvar installerat. Det förblir avstängt även efter att du startat om appen. Ett aktiverat tillägg startar av sig självt när appen startar.
3. Klicka på *Ta bort*. Knappen ändras till *Bekräfta*, med förklaringen *Klicka igen för att ta bort permanent*. Klicka en gång till för att ta bort tillägget. Appen rensar också de inställningar som tillägget sparade.

## Problem och vad appen gör då

**Katalogen laddas inte.** Då visas *Kunde inte läsa in katalogen:* med den tekniska orsaken efter det, och knappen *Försök igen*. Det kan bero på att du inte har någon internetanslutning.

**Det står *Installationen misslyckades.* under ett kort i katalogen.** Hämtningen eller installationen misslyckades, till exempel för att kontrollsumman inte stämde. Då har ingenting installerats. Det är något annat än att avböja frågan: då visas inget felmeddelande.

**Det står *Hoppade över katalogposter: 1* ovanför listan.** Katalogen innehöll ett objekt som appen inte kan använda. Du kan installera de andra tilläggen som vanligt.

**Ett tillägg startar inte.** Kortet visar då ett felmeddelande, till exempel att tillägget kräver en nyare version av Open Planner Studio, med din nuvarande version visad, eller felet som tillägget självt gav. Tillägget är då inte aktivt. Uppdatera appen eller ta bort tillägget.

**Ett kort med *Karantän*.** Appen kunde inte använda det sparade tillägget. Under namnet står *Orsak:* med orsaken. Med *Ta bort från lagringen* rensar du det.

**Skriva ett tillägg själv.** Handboken för tilläggsutvecklare (manifest, API, behörigheter) finns i repositoryt `OpenAEC-Foundation/open-planner-studio` på GitHub, i filen `docs/extensions.md`.

**Ett tillägg tillhör inte ett projekt.** Tilläggen sparas i appen: i skrivbordsappen på den här datorn, och i webbläsaren i webbläsarens lagring. De gäller för alla dina projekt och ingår inte i din projektfil. Om du rensar webbplatsdata i webbläsaren är tilläggen borta.

## Se även

- [Uppdatera appen](docs://howto-app-bijwerken): ett tillägg kan kräva en nyare version av appen.
- [Tilläggsbehörigheter](docs://ref-extensiepermissies): vad varje behörighet i installationsfrågan betyder.

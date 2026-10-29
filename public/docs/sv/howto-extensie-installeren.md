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

Efter installationen är tillägget aktiverat direkt. På kortet under *Bläddra* står det nu *Installerad*. Vad tillägget lägger till ser du i appen: en ny knapp i menyfliksområdet, eller ett importformat under *Fil › Importera*. Vissa tillägg visar också ett meddelande. Du känner igen det på prefixet *Tillägg* följt av tilläggets namn.

**Självstudier.** Självstudierna är ett tillägg. Om du ser knappen *Installera självstudier* under *Självstudier* i *Hjälp* öppnas *Fil › Tillägg* på fliken *Bläddra*. Frågan efter den första rundturen installerar också det här tillägget. Båda vägarna visar samma fråga om behörigheter. Du kan avböja den.

### Installera ett tillägg från en fil

Om du fick ett tillägg som fil installerar du det så här.

1. Välj *Fil › Tillägg*.
2. Klicka längst upp till höger på *ZIP* för en ZIP-fil, eller på *JS* för en separat JavaScript-fil.
3. Välj filen. Fönstret *Installera tillägg?* öppnas, som ovan.

En ZIP-fil måste innehålla en `manifest.json` och tilläggets huvudfil. Om du installerar ett tillägg som redan är installerat ersätter den nya versionen den gamla. Om appen inte kan installera filen, till exempel för att en ZIP-fil är skadad, händer ingenting: appen visar inget felmeddelande för ZIP och JS, och tillägget syns inte i listan. Orsaken finns dock i felsökningsterminalen. Aktivera den under *Inställningar › Projekt › Appinställningar*, fliken *Avancerat*, *Aktivera felsökningsterminal*, och öppna den med knappen *Visa felsökningsterminalen* i statusfältet. Där står till exempel *[Extensies] ZIP-installatie mislukt: Error: Geen manifest.json gevonden in ZIP* (appen skriver den här tekniska texten på nederländska).

### Läs behörighetsfrågan

Frågan visar vad du behöver besluta.

- *Författare* och *Repository* visar vem som har gjort tillägget och var källkoden finns.
- *Ursprung* visar varifrån filen kommer och om den har kontrollerats. Om det i rött står att nedladdningen inte är verifierad, installera bara om du vet varifrån den kommer.
- *Vad du går med på* upprepar att ett tillägg är programkod som körs med samma rättigheter som appen själv, och vad det betyder på din plattform. Installera bara tillägg vars författare du litar på.
- *Vad det här tillägget säger att det använder* visar de behörigheter som författaren angett, som små etiketter. Det är en angivelse och ingen begränsning. Om det står *Inget angivet.* kan tillägget ändå läsa och ändra data i din tidsplan.

Vad varje etikett betyder och de exakta texterna i fönstret finns i [Tilläggsbehörigheter](docs://ref-extensiepermissies).

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

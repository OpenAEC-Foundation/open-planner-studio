# Uppdatera appen

Mål: ta reda på om du har den senaste versionen, uppdatera appen och läsa vad som är nytt i en version.

## När du behöver det här

En ny version av Open Planner Studio kommer regelbundet. Du vill veta om du redan har den, till exempel innan du rapporterar ett fel eller eftersom ett tillägg kräver en nyare version. Eller så har du precis uppdaterat och vill se vad som har ändrats.

Uppdatering fungerar bara i skrivbordsappen. Webbversionen har ingen uppdaterare.

## Steg

### Uppdatera när appen självt säger att det finns en ny version

1. Starta skrivbordsappen. Vid start kontrollerar appen i bakgrunden om det finns en ny version. Finns det ingen ny version, eller misslyckas kontrollen, till exempel utan internet, märker du ingenting.
2. Finns det en ny version öppnas fönstret *Programuppdatering*. Det visar *Aktuell version*, *Ny version*, meddelandet *En ny version finns tillgänglig* och under *Vad är nytt* texten som hör till uppdateringen.
3. Spara dina öppna projekt.
4. Klicka på *Ladda ner och installera*. En laddningsindikator visar *Laddar ner…*, och sedan följer installationen. Du kan inte stänga fönstret medan det laddas ner.
5. Vänta tills appen startar om sig själv. Då är det den nya versionen.

Precis innan uppdateringen installeras gör appen också en återställningskopia (för kraschskydd) av dina öppna projekt, se [Återställa efter en krasch](docs://howto-herstellen-na-een-crash).

### Kontrollera själv om det finns en ny version

1. Välj *Inställningar › Projekt › Inställningar*. Du kan också välja *Fil › Inställningar*, eller kugghjulet högst upp.
2. Välj fliken *Avancerat*. Under *Version* står numret på din aktuella version.
3. Klicka på *Sök efter uppdateringar*. Fönstret *Programuppdatering* öppnas och där står *Söker…*. Efteråt står det antingen *Du använder den senaste versionen* eller meddelandet att det finns en ny version, med samma knapp *Ladda ner och installera*.

I webbläsaren gör knappen inget särskilt: fönstret säger direkt *Du använder den senaste versionen*, utan att appen kontrollerar något.

### Läs vad som är nytt

1. Om du startar skrivbordsappen för första gången i en annan version än sist, eller efter en ny installation, öppnas ett fönster av sig självt. Det fönstret heter *Du är uppdaterad!*
2. Överst står övergången från den föregående till den nya versionen. Efter en ny installation visas bara den nya versionen.
3. Har appen en inbyggd sammanfattning för den här versionen, ser du en huvudpunkt och fyra mindre punkter. Huvudpunkten kan ha knappen *Läs guiden*. Annars ser du bara versionsövergången och det som står under den.
4. Med *Se hela versionsanteckningarna* öppnar du ändringsloggen på GitHub. Fungerar inte det, står det *Versionsanteckningarna kunde inte öppnas.*
5. Under *Den här uppdateringen i siffror* står antalet dagar sedan den föregående versionen, antalet commits och antalet tillagda rader kod. Om appen kan ta reda på skillnaden i storlek på installationspaketet visas den också. Varje siffra visas bara om den finns.
6. Klicka på *Förstått* för att stänga fönstret.

Vill du se fönstret igen senare, välj *Inställningar › Projekt › Inställningar*, fliken *Avancerat* och under *Version* knappen *Vad är nytt*. Fönstret öppnas då för din aktuella version, utan någon föregående version.

## Problem och vad appen gör då

**Uppdateringen misslyckas.** Fönstret visar *Något gick fel vid uppdateringen* med den tekniska orsaken under, och knappen *Försök igen*.

**Du installerade appen som ett .deb-paket och installationen misslyckas.** Fönstret förklarar: *Uppdatera manuellt genom att köra det här kommandot i en terminal, eller ladda ner det senaste paketet.* Under *Installationskommando* står kommandot, med knappen *Kopiera kommando* (sedan står det *Kopierat*). Med *Öppna nedladdningssidan* kommer du till nedladdningssidan för den senaste versionen.

**Du har appen via Snap Store.** Appen uppdaterar sig då inte själv och kontrollerar inte heller vid start. Det sköter Snap Store. I fönstret står det *Den här versionen uppdateras automatiskt via Snap Store. Du behöver inte göra något.*

**Inget visas vid start.** Det är normalt om du redan har den senaste versionen. Kontrollen vid start visar inga fel. Vill du vara säker på att du är uppdaterad, kontrollera själv, så som beskrivs ovan.

## Se också

- [Lämna feedback](docs://howto-feedback-geven): rapportera ett fel i den senaste versionen.

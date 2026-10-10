# Flytta ett projekt

Mål: förskjut hela tidsplanen till ett nytt startdatum och se i förväg vad det gör med slutet.

## När du behöver detta

Starten av arbetet flyttas: tillståndet kommer senare, eller så återanvänder du tidsplanen från ett tidigare hus för nästa hus. Att flytta varje uppgift en i taget är mycket arbete. Med **Flytta projekt** anger du ett nytt startdatum och appen förskjuter allt tillsammans med det.

Projektslutet flyttas inte alltid lika mycket som projektstarten. Kalendern flyttas inte med. Helgdagar, byggsemester och vinteruppehåll ligger på fasta datum. Ett exempel: med *Start › Fil › Ny* skapar du ett projekt med *Startdatum* 29-09-2026, *Land* på *Nederländerna* och *Byggsemester* på *Ingen*. Där lägger du en tidsplan med 30 arbetsdagar som slutar 9 november 2026. Flyttar du den till 14 december 2026, 76 kalenderdagar senare, slutar den 26 januari 2027. Det är 78 dagar senare, eftersom 25 december och 1 januari nu är lediga dagar i din tidsplan. Varaktigheten är kvar på 30 arbetsdagar. Förhandsvisningen i fönstret visar detta innan du ändrar något.

## Steg

1. Välj *Tidsplan › Tidsplan › Flytta projekt…*. Knappen är inaktiv så länge projektet saknar startdatum.
2. Under *Nuvarande projektstart* ser du var projektet börjar nu. Under *Ny projektstart* väljer du det nya datumet.
3. Om projektet har baslinjer visas kryssrutan *Flytta baslinjer också*. Lämna den avmarkerad om du vill se förskjutningen som avvikelse (se fallgroparna).
4. Klicka på *Beräkna förhandsvisning*. Appen beräknar den förskjutna tidsplanen helt, utan att ändra något i ditt projekt.
5. Kontrollera förhandsvisningen (se nedan). Om den är rätt, klicka på *Flytta*.

I förhandsvisningen ser du:

- förskjutningen i kalenderdagar (*Förskjutning: 76 kalenderdagar framåt*);
- *Projektstart* och *Projektslut*, från före till efter;
- en röd varning om kalendern stör, eller meddelandet att projektets varaktighet förblir densamma;
- antalet förskjutna uppgifter och vad mer som följer med;
- varningar som du bör läsa (se fallgroparna).

Appen beräknar den nya tidsplanen direkt, så du behöver inte använda **Beräkna** (F5). Den anpassar också vyn till hela projektet. Hela åtgärden är ett enda steg för *Ångra* (Ctrl+Z).

Knappen *Flytta* fungerar bara efter en förhandsvisning utan fel, och om det nya datumet skiljer sig från det nuvarande. Ändrar du datumet eller kryssrutan försvinner förhandsvisningen och du beräknar förhandsvisningen igen.

### Vad som förskjuts med, och vad som inte gör det

Förskjuts: start och slut för varje uppgift, verklig start och verkligt slut, datumen för restriktioner (också för en hård Mandatory-fastlåsning, se [Restriktioner och måldatum](docs://uitleg-constraints)), måldatum, rapportdatumet, ankarpunkterna för externa samband och tillgänglighetsstegen för resurser. Projektstarten och, om du har fyllt i det, projektslutet förskjuts också.

Förskjuts inte:

- kalendrarna, så helgdagar, byggsemester och vinteruppehåll;
- baslinjer, om du inte slår på *Flytta baslinjer också*;
- ett ifyllt eget fält av typen *Datum*.

## Fallgropar och vad appen gör

**Slutet flyttas med ett annat antal dagar.** Ser förhandsvisningen att slutet flyttas med fler eller färre kalenderdagar än starten, eller att projektets varaktighet i arbetsdagar ändras, visar den en röd varning med siffrorna. Du kan då fortfarande avbryta.

**Baslinjerna blir kvar på sin plats.** En baslinje finns för att mäta avvikelser. Flyttar du projektet med kryssrutan avmarkerad ser du förskjutningen som avvikelse från baslinjen. Markerar du kryssrutan förskjuts baslinjerna med tidsplanen. Bara deras datum förskjuts. Datumet då baslinjen sparades förskjuts inte.

**Ett pågående projekt.** Verkliga datum förskjuts med. I ett projekt där du redan har angett framdrift är det inte alltid det du vill. Appen varnar: *Kontrollera om det är rätt för ett pågående projekt.*

**Externa samband.** Ankaret i ditt eget projekt förskjuts med, källprojektet gör det inte. Uppdatera länkarna efter flytten med *Start › Uppgifter › Länka ▾ › Uppdatera alla externa samband*. Se [Externa samband till ett annat projekt](docs://howto-externe-relaties).

**Helgdagar som inte räcker tillräckligt långt.** En kalender med genererade helgdagar täcker ett antal år. Går den förskjutna tidsplanen längre än så, beräknar appen det året utan helgdagar. Förhandsvisningen varnar för det, till exempel: *De genererade helgdagarna i kalendern “Bouwkalender NL” täcker 2025–2029; den förskjutna tidsplanen sträcker sig till 2030. Generera helgdagarna igen.* Flytta projektet först. Öppna sedan *Tidsplan › Kalender › Kalender*: bredvid helgdagarna står nu *Generera om*. Bekräfta med *Tillämpa* och appen beräknar om. De nya helgdagarnas intervall följer projektdatumen, så det hjälper inte att generera om före flytten.

**Datumet ligger i det förflutna.** Det är tillåtet, men förhandsvisningen nämner det: *Det nya startdatumet ligger i det förflutna.*

**Att ändra projektstarten i Projektinfo är något annat.** Ändrar du startdatumet i *Inställningar › Projekt › Projektinfo* och väljer *Tillämpa*, flyttas inte tidsplanen. Bara uppgifter utan föregående uppgift eller restriktion som då skulle ligga före den nya starten flyttas till det datumet, och appen berättar hur många. Vill du förskjuta allt, använd *Flytta projekt…*.

## Se också

- [Kritisk linje och slack](docs://uitleg-kritiek-pad): hur tidsplanen beräknas och varför slutet flyttas.
- [Lägga till samband](docs://howto-relaties-leggen): samband blir helt enkelt kvar på sin plats när du flyttar.
- [Nytt projekt och Projektinfo](docs://ref-projectinfo): vad startdatumet i Projektinfo gör.

# Aktivera timplanering

Mål: planera uppgifter i arbetstimmar, tillsammans med uppgifter i dagar.

## När du behöver det

Du hyr en kran per timme, inte per dag. En gjutning på sex timmar får inte plats på en hel arbetsdag. Ett nattlag arbetar vid andra tider än dagslaget. För sådant arbete vill du ha en varaktighet i timmar, och en start och ett slut med ett klockslag. Du slår också på timplanering om du öppnar en fil och appen visar *Den här filen innehåller timplanering.* Varför appen räknar dagar och timmar på olika sätt kan du läsa i [Dagar och timmar](docs://uitleg-dagen-en-uren).

## Steg

### Slå på timplanering

1. Välj *Inställningar › Projekt › Inställningar* och öppna fliken *Tidsplan*.
2. Under *Timplanering*, markera *Aktivera timplanering*. Det fungerar direkt. I meddelandet *Den här filen innehåller timplanering.* gör knappen *Aktivera timplanering* samma sak.
3. Under den finns *Tillåt blandad dag/timplanering*, som är på som standard. Med den inställningen väljer du per uppgift om den räknas i dagar eller timmar. Om du stänger av den försvinner listan *Varaktighetsenhet*. Du kan då fortfarande skriva en varaktighet med enhet, till exempel `12h`.

Det ändrar mer än varaktigheten för en uppgift. Under *Visa › Tidsskala* kan du välja skalan *Timme*. Fönstret *Kalendrar* får avsnittet *Arbetstider*, och fönstret *Nytt projekt* får valen *Skift* och *Standardenhet för nya uppgifter*.

### Planera en uppgift i timmar

1. Markera uppgiften och titta i panelen *Egenskaper*, under *Tid*, på fältet *Varaktighet*.
2. Skriv varaktigheten med en enhet och tryck på Retur: `12h` (`12u`, den nederländska förkortningen, fungerar också) för tolv timmar, `1h 30m` för en och en halv timme. `1.5h` fungerar också. Ett tal utan enhet räknas i den enhet som uppgiften redan har.
3. Om du vill omvandla en befintlig uppgift väljer du enheten *Timmar* under *Varaktighetsenhet*. Appen räknar ut varaktigheten åt dig och föreslår den, till exempel *Exakt omvandlingsförslag: 16h. Tillämpa förslaget eller behåll den nuvarande enheten.* Välj *Tillämpa förslaget* eller *Behålla*.
4. Tillbaka till dagar går det med `2d` eller med enheten *Dagar*.
5. Tryck på **Beräkna** (F5), till exempel via *Start › Tidsplan › Beräkna*. Uppgiften har nu en start och ett slut med ett klockslag.
6. Om du vill se timmarna i Gantt väljer du skalan *Timme* i listan under *Visa › Tidsskala*.

### Nya uppgifter i timmar som standard

1. Välj *Inställningar › Projekt › Projektinfo*.
2. Under *Standardenhet för nya uppgifter* väljer du enheten *Timmar* och klickar på *Tillämpa*.

En ny uppgift börjar då med 5 timmar i stället för 5 dagar. Befintliga uppgifter ändras inte. Med ett nytt projekt finns samma val i fönstret *Nytt projekt*. Om du väljer *Dagskift* under *Skift* där är alternativet *Timmar* inaktiverat. Välj ett annat skift, eller ställ in standardenheten efter att du har skapat projektet, i *Projektinfo*.

## Fallgropar och vad appen gör då

**Inga giltiga arbetstider.** Om uppgiftens kalender inte har några användbara arbetstider visar appen *Kalendern har inga giltiga arbetstider. Kontrollera arbetsdagarna och arbetstiderna.* Vid beräkning kan meddelandet *Timuppgift 'name' har inga giltiga arbetstider i sin kalender* visas.

**Inga decimaler med dagar.** En varaktighet i dagar är ett heltal. `1.5d` ger meddelandet *Ange ett helt antal dagar eller timmar, till exempel 2d eller 12h.* Vill du ha en och en halv dag, beräkna i timmar.

**En omräkning som inte kan bli exakt.** Tolv timmar ryms inte i hela dagar på 8 timmar. Appen visar då *Den här varaktigheten kan inte exakt omräknas till hela dagar i den aktuella kalendern. Den befintliga enheten behålls. Ange själv ett nytt giltigt värde.* och lämnar enheten oförändrad.

**Fältet är inaktiverat.** För en fas, en hängmatta eller en milstolpe med varaktigheten noll följer varaktigheten av något annat, och du kan inte skriva in den.

**Timplanering stängs av igen.** Timuppgifter finns kvar och beräknas fortfarande. Deras varaktighet kan då inte redigeras. Fältet visar *Aktivera timplanering för att redigera den här timuppgiften.* med en knapp för att slå på den igen.

## Se även

- [Dagar och timmar](docs://uitleg-dagen-en-uren): hur appen räknar timmar, vad som händer när dagar och timmar möts och var den avrundar.
- [Ställa in arbetstider](docs://howto-werktijden-instellen): tiderna i en kalender per veckodag.
- [Lägga till samband](docs://howto-relaties-leggen): en fördröjning i timmar mellan två uppgifter.
- [Inställningar](docs://ref-instellingen): inställningen Aktivera timplanering och vad mer den ändrar.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): innehåller timuppgifter (armering och gjutning) med en egen timkalender, *Hourly calendar, rebar fixing & pouring*.

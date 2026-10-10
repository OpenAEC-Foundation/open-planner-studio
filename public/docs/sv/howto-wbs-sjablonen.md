# Spara och infoga WBS-mallar

Mål: spara en fas med dess underuppgifter och deras samband som en mall, och infoga den igen senare i samma projekt eller i ett annat projekt.

## När du behöver det

Du planerar ofta samma slags arbete: varje hus har en grundläggning med markarbete, armering, gjutning och härdning. I stället för att skapa och länka ihop de uppgifterna om och om igen sparar du fasen en gång som en **mall**. En mall är en gren av din WBS: en uppgift med allt som hänger under den.

## Steg

### Spara en gren som mall

1. Bygg grenen så som du vill återanvända den: en sammanfattningsuppgift med underuppgifter och samband mellan dem.
2. Högerklicka på sammanfattningsuppgiften och välj *Spara gren som mall*. Det här menyalternativet visas bara för uppgifter med underuppgifter.

Appen visar *Gren sparad som mall 'Foundation'*. Appen frågar inte efter ett namn. Mallen får namnet efter den översta uppgiften i grenen.

### Infoga en mall

1. Markera uppgiften som mallen ska ligga under, eller markera ingenting.
2. Välj *Tidsplan › Struktur › Mallar*. Listan visar namnet på varje mall och, till exempel, *4 uppgifter, 2 samband*.
3. Klicka på mallen.

Om en uppgift är markerad läggs mallen in som sista underuppgift under den uppgiften. Den uppgiften blir då en sammanfattningsuppgift. Om flera uppgifter är markerade gäller den uppgift du klickade på först. Om ingenting är markerat läggs grenen längst ner i listan, på översta nivån. Den infogade grenen är markerad efteråt.

Alla infogade uppgifter hamnar på projektstarten och tidsplanen är inte längre aktuell. Tryck på **Beräkna** (F5), till exempel via *Start › Tidsplan › Beräkna*. Då följer datumen av sambanden. Du kan ångra infogningen i ett steg med *Ångra*. Att spara eller ta bort en mall ingår inte i det steget.

### Ta bort en mall

Öppna *Tidsplan › Struktur › Mallar* och klicka på den lilla papperskorgen till höger om mallen (*Ta bort mall*). Appen frågar inte om bekräftelse.

### Vad som ingår i en mall

För varje uppgift sparar en mall namnet, beskrivningen, uppgiftstypen, om den är en milstolpe och varaktigheten i dagar. Av sambanden sparar den bara dem mellan två uppgifter inom grenen, med typ och fördröjning.

Allt annat sparas inte: datum, framdrift och verkliga datum, resurstilldelningar, koder och egna fält (se [Koder och egna fält](docs://howto-codes-en-velden)), kalendern, restriktioner och måldatum, prioritet, en egen uppgiftstyp, och för en milstolpe dess typ och bockmarkeringen *Obligatorisk (avtalsenlig)*. Samband med uppgifter utanför grenen sparas inte heller. Efter infogningen fyller du i dem igen: tilldelningar, koder, kalender och restriktioner är tomma, och alla uppgifter börjar på projektstarten.

En uppgift som var i timmar kommer tillbaka som en daguppgift. Dess varaktighet räknas om till en del av en arbetsdag. En uppgift på 5 timmar med en arbetsdag på 8 timmar blir 0,625 dagar.

## Fallgropar och vad appen gör

**Mallar hör inte till projektet.** Appen sparar dem i appens lagring på den här enheten, inte i projektfilen. En kollega som öppnar din fil ser inte dina mallar. I webbversionen hör en mall till den webbläsaren. Om dina mallar är viktiga, spara dem också på ett annat ställe. Lägg dem i ett projekt som du sparar som fil.

**Samma namn kan finnas mer än en gång.** Om du sparar grenen två gånger finns det två mallar med samma namn i listan. Appen skriver inte över något.

**Varaktigheten på den översta uppgiften räknas inte.** En sammanfattningsuppgift får sin varaktighet från sina underuppgifter, så snart du använder *Beräkna*.

**En uppgift med resurstilldelningar som mål.** Om du markerar en uppgift med tilldelningar som inte har några underuppgifter, och infogar en mall under den, vägrar appen. Uppgiften skulle bli en sammanfattningsuppgift, och en sammanfattningsuppgift har inga tilldelningar. Den översta uppgiften i en mall har redan underuppgifter, så tilldelningarna har ingenstans att ta vägen. Appen visar ett meddelande och ändrar inget. Välj då en annan uppgift, eller ingen, som plats. En milstolpe som får en mall förlorar sin milstolpsmarkering. Appen visar ett meddelande om det.

**Ett ogiltigt samband i mallen.** Om ett samband i mallen inte är tillåtet, till exempel en uppgift till sin egen fas, eller om det redan finns, hoppar appen över det. Appen säger hur många samband som hoppades över.

## Se även

- [Ändra strukturen](docs://howto-structuur-aanpassen): flytta den infogade grenen eller ändra dess indrag.
- [Lägga till samband](docs://howto-relaties-leggen): skapa själv samband inom en gren innan du sparar den.
- [Kritisk linje och slack](docs://uitleg-kritiek-pad): vad som händer med den infogade grenen efter *Beräkna*.

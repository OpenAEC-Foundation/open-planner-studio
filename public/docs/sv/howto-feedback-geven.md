# Ge feedback

Mål: rapportera ett fel eller lämna en idé, eventuellt med en skärmbild, direkt från appen.

## När du behöver detta

Tidsplanen beräknar något som du inte förstår, en knapp gör inte det den ska, eller du saknar något i appen. En bra felrapport hjälper utvecklarna att hitta problemet. Därför lägger appen själv in versionen, operativsystemet och språket i din felrapport. Det du beskriver själv avgör om de kan göra något med den: vad du gjorde, vad du väntade dig och vad som hände.

## Steg

1. Klicka på knappen *Ge feedback* överst i fönstret. Den knappen finns alltid i namnlisten. Texten på den ändras var tionde minut: *Ge feedback*, *Rapportera en bugg* och *Lägg till en ny funktion*. Det är alltid samma knapp. Fönstret *Ge feedback* öppnas.
2. Välj vilken typ av rapport du vill skicka. *Något fungerar inte* är för ett fel: något gör inte vad det ska. *Idé* är för något du saknar eller vill ha annorlunda. *Fråga eller kommentar* är för resten. *Något fungerar inte* är vald som standard.
3. Fyll i *Titel* och sedan *Beskrivning*. De tomma fälten visar ett exempel: en titel som *T.ex. Kritisk linje hoppar efter sparning*, och för beskrivningen frågan *Vad gjorde du, vad förväntade du dig och vad hände?* Så länge knappen *Skicka* är grå visar en grå rad bredvid den varför, till exempel *Fyll i en titel.* eller att du skriver minst 10 tecken i titel och beskrivning tillsammans.
4. Om du vill få svar fyller du i *E-postadress*. Det fältet är valfritt. Appen kommer ihåg adressen efter en lyckad rapport, så den finns redan där nästa gång.
5. Om du vill visa något slår du på *Bifoga skärmbild*. Appen gör då en bild av appen utan det här fönstret. En stund senare ser du en liten förhandsvisning med tre knappar bredvid: *Annotera*, *Ta om* och *Ta bort*.
6. *Annotera* öppnar en redigerare. I den lägger du pilar, rektanglar, frihandslinjer och text på bilden. Med *Dölj* ritar du en svart yta över något som inte ska följa med, till exempel ett namn eller ett belopp. Den delen är då helt borta från bilden som appen skickar. Du väljer färg, tar tillbaka din senaste åtgärd med *Ångra* eller börjar om med *Rensa allt*. Klicka på *Klar* för att behålla dina ändringar, eller på *Avbryt* (eller Esc) för att kasta dem.
7. *Ta om* gör en ny skärmbild och tar bort dina annoteringar. *Ta bort* tar bort skärmbilden och stänger av kryssrutan.
8. Titta på den grå raden *Medskickat* under formuläret. Den visar vad appen skickar med av sig själv: versionen, operativsystemet och språket, till exempel *Medskickat: v2026.10.1 · Windows · English*.
9. Klicka på *Skicka*. Medan anmälan skickas visar knappen *Skickar…*.
10. Du ser *Tack, din anmälan har skickats.* Om ett ärende på GitHub skapades för din anmälan finns också knappen *Visa på GitHub*. Klicka på *Stäng*.

## Var din anmälan hamnar

Appen skickar din rapport till Open Feedback Studio av OpenAEC. Du behöver inget konto för det, inte heller på GitHub. Utvecklarna ser din rapport i sin översikt. Om appen är kopplad till GitHub där gör Open Feedback Studio också ett offentligt ärende på GitHub av den. Med *Något fungerar inte* får ärendet etiketten *bug*, med *Idé* etiketten *enhancement*. Under din beskrivning finns då en rad med versionen av Open Planner Studio, ditt operativsystem och appens språk.

## Fallgropar och vad appen gör då

**Din rapport kan bli offentlig.** Lägg inte in något du inte vill dela. Det gäller även skärmbilden: bilden visar allt som syns i appen just då, till exempel namn på uppgifter och resurser i ditt projekt. Appen gör skärmbilden i det ögonblick du slår på *Bifoga skärmbild*. Om skärmen inte är rätt än stänger du fönstret, ställer in skärmen rätt, öppnar fönstret igen och klickar på *Ta om*. Använd *Dölj* för att gömma det du inte vill visa.

**Skärmbilden är för stor.** Appen gör skärmbilden mindre innan den skickas. Om den fortfarande är för stor efter det går rapporten utan bild. Tacksidan säger då *Skärmbilden var för stor och skickades inte med.*

**Skickandet fungerar inte.** Ett meddelande visas i fönstret och din text stannar kvar. Det finns fyra fall:

- *Anmälan godkändes inte.* Kontrollera texten och e-postadressen. En anmälan som mest består av länkar avvisas.
- *Du har skickat många anmälningar på kort tid.* Försök igen om en timme.
- *Skickandet misslyckades.* Det finns ingen anslutning eller servern svarar inte. Försök igen, eller klicka på *Öppna på GitHub*. Den knappen finns inte om ett tidigare försök var osäkert (se nedan).
- *Vi vet inte säkert om din anmälan har kommit fram. Vänta en minut och skicka den sedan igen; om den redan finns där ser vi det automatiskt.* Anslutningen bröts efter att appen hade skickat din rapport. Din text stannar kvar. Det finns ingen knapp *Öppna på GitHub*, eftersom din rapport fortfarande kan komma fram. Det gäller tills din rapport är skickad eller redan har kommit in, även om du stänger fönstret däremellan och öppnar det igen.

**Din anmälan har redan kommit in.** Om du skickar en rapport som redan finns hos oss står formuläret kvar med detta ovanför: *Den här anmälan har redan kommit in till oss. Vill du lägga till något? Ändra då texten och skicka igen.* Din text stannar kvar och din e-postadress sparas. Klicka på *Stäng* om du inte vill lägga till något; formuläret är då tomt nästa gång. Skriver du något mer försvinner meddelandet och du kan skicka igen. Knappen heter då åter *Spara och stäng* och din text behålls.

**Öppna på GitHub.** Det här är vägen utan Open Feedback Studio. För den behöver du däremot ett konto på GitHub. Utan skärmbild öppnas GitHub-sidan där du skapar ett nytt ärende direkt i din webbläsare, med din titel och beskrivning redan ifyllda. Med skärmbild ser du först *Nästan klart. Din skärmbild finns på urklippet.* med fyra steg. Klicka på *OK, gå till GitHub*, klicka i det stora textfältet på ärendesidan och tryck på Ctrl+V (Cmd+V på en Mac). Klicka sedan på *Skicka nytt ärende* längst ner. Först då skickas din rapport.

**Inklistring fungerar inte.** På GitHub-vägen sparas skärmbilden också som en fil på din dator. I skrivbordsappen nämner fönstret sökvägen: *Kan du inte klistra in? Vi sparade skärmbilden också till* sökvägen *— dra filen till textfältet.* I webbläsaren laddar appen ner bilden som `feedback-` med ett nummer och filändelsen `.png`. Du hittar den i din mapp för nedladdningar och drar den till textfältet.

**Skärmbilden misslyckas.** Det står *Det gick inte att skapa en skärmbild. Du kan fortfarande skicka feedbacken utan skärmbild.* Kryssrutan stängs av och du kan skicka din rapport utan bild.

**Du stänger fönstret innan du skickar.** Om det finns något i formuläret heter knappen längst ner *Spara och stäng*; med ett tomt formulär heter den *Stäng*. *Spara och stäng*, krysset och Esc stänger fönstret, och din rapport sparas som utkast tills du skickar den eller klickar på *Rensa*. När du öppnar fönstret igen finns typen, din text, e-postadressen och skärmbilden med annoteringar kvar. Utkastet finns kvar så länge appen är öppen; när du avslutar appen är det borta. Efter en lyckad rapport är formuläret tomt igen. Vill du börja om själv klickar du på *Rensa* längst ner till vänster. Ett klick bredvid fönstret stänger det inte. Medan anmälan skickas stänger Esc inte fönstret.

## Se också

- [Uppdatera appen](docs://howto-app-bijwerken): innan du skickar en felrapport kontrollerar du om du har den senaste versionen.

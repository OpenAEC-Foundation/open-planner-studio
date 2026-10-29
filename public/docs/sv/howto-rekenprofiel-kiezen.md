# Välja eller bygga en beräkningsprofil

Mål: bestäm vilka beräkningsregler ett projekt använder. Du väljer en inbyggd beräkningsprofil, eller så gör du en egen beräkningsprofil med egna beräkningsregler.

## När du behöver detta

Du öppnar ett projekt som måste beräknas som Primavera P6 eller Microsoft Project, eller så vill du ställa in en beräkningsregel annorlunda än vad profilen gör. Vad en beräkningsprofil är och varför datumen kan förskjutas står i [Beräkningsprofiler och beräkningsregler](docs://uitleg-rekenprofielen).

## Steg

### Välja en beräkningsprofil för ett nytt projekt

1. Välj *Start › Fil › Ny*. Fönstret *Nytt projekt* öppnas.
2. Välj profilen i listrutan *Beräkningsprofil*: *Open Planner Studio*, *Primavera P6* eller *Microsoft Project*.
3. Skapa projektet. Appen ersätter de beräkningsalternativ som du redan har fyllt i med profilens standard.

### Byta beräkningsprofil för ett befintligt projekt

1. Välj *Inställningar › Projekt › Projektinställningar*. Du kan också välja *Fil › Projektinställningar*.
2. Öppna listrutan *Beräkningsprofil* i blocket *Beräkningsprofil och beräkningsalternativ* och välj en annan profil.
3. Klicka på **Tillämpa**. Appen beräknar om tidsplanen direkt, även om *Beräkna automatiskt* är avstängt. Om uppgifter har flyttats säger appen hur många.

Tills du klickar på *Tillämpa* finns ändringen bara i formuläret. Hela bytet räknas som ett steg för *Ångra*. Ett byte ändrar bara beräkningsreglerna. Dina beräkningsalternativ blir kvar som de är.

### Bygga en egen beräkningsprofil

1. Klicka på *Ny beräkningsprofil* bredvid listrutan i blocket *Beräkningsprofil och beräkningsalternativ*.
2. Ange ett namn. Appen föreslår *Kopia av* den valda profilen, till exempel *Kopia av Open Planner Studio*.
3. Klicka på *Skapa*. Delen *Beräkningsregler i den här profilen* fälls ut.
4. Slå på eller av beräkningsreglerna med kryssrutorna. I-ikonen efter en rad visar förklaringen till den beräkningsregeln. En beräkningsregel som skiljer sig från basen får etiketten *tillbaka till bas*.
5. Klicka på **Tillämpa**. Först då beräknar projektet med den nya beräkningsprofilen.

De tre inbyggda beräkningsprofilerna kan inte ändras. Deras beräkningsregler visas bara som information.

### Spara en egen beräkningsprofil som mall

1. Ge vid behov den egna profilen ett annat namn i fältet *Namn på den här egna profilen*.
2. Klicka på *Spara som mall*. Appen meddelar att mallen har sparats, eller varför det inte lyckades.
3. I ett annat projekt i samma app finns mallen i listrutan *Beräkningsprofil*.

Om profilen senare skiljer sig från mallen visar ett gult block det. Välj då *Uppdatera mall från det här projektet* eller *Uppdatera från mall*.

Du tar bort en mall med *Ta bort mall*. Appen frågar först om bekräftelse.

## Kontrollera resultatet

- Blocket *Beräkningsprofil och beräkningsalternativ* visar den valda profilen.
- Efter *Tillämpa* meddelar appen hur många uppgifter som har flyttats, till exempel *Efter tillämpning har 4 uppgifter flyttats.*
- Ett orange block ovanför beräkningsalternativen säger att dina beräkningsalternativ skiljer sig från profilens standard. Det är ofta med avsikt. Om du ändå vill ha standarden klickar du på *Använd standardinställningarna för …*.

## Fallgropar och vad appen gör

**Datumen förskjuts.** En annan profil kan ändra de verkliga datumen. Kontrollera resultatet. Om du inte vill ha det väljer du *Ångra*: profilen och datumen går tillbaka tillsammans.

**Ett gult block efter Ångra.** Om du trycker på *Ångra* eller *Gör om* medan fönstret Projektinställningar är öppet följer blocket projektets tillstånd. Om du redan har ändrat något i blocket själv finns ditt val kvar. Ett gult block säger då att *Tillämpa* sätter tillbaka det valet.

**Det kan finnas högst 100 mallar.** Om det redan finns 100 sparar appen inte mallen och meddelar det. Ta bort en mall först. Om appens lagringsutrymme är fullt eller saknas visar appen också ett meddelande.

**Mallar hör till appen, profilen hör till projektet.** Projektet har alltid en egen kopia av profilen. Om du ändrar mallen senare ändras inte projektet med den.

**Inställningar från en källfil.** Om du väljer *Primavera P6* eller *Microsoft Project* för ett projekt som kommer från en annan fil behålls inställningarna från källfilen. Du kan inte ändra dem här.

## Se också

- [Beräkningsprofiler och beräkningsregler](docs://uitleg-rekenprofielen): vad en beräkningsprofil är och vad den gör med datumen.
- [Beräkningsalternativ och beräkningsregler](docs://ref-rekenopties-en-conventies): alla beräkningsregler och beräkningsalternativ på en plats.
- [Välja framdriftsläge](docs://howto-voortgangsmodus-kiezen): Retained Logic eller Progress Override, skilt från beräkningsprofilen.

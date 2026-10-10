# Arbeta med flera projekt samtidigt

Mål: ha mer än en tidsplan öppen, byta mellan dem och stänga dem var för sig.

## När du behöver detta

Du arbetar med bostadsprojektet i området, men mötet på platsen handlar också om renoveringen av klubbhuset. Eller så vill du behålla en variant bredvid originalet. Varje projekt har en egen flik, med egna uppgifter, egen beräkning och eget tidsfönster. Att byta tar ett klick och du förlorar ingenting.

## Steg

### Öppna ett andra projekt

1. Klicka på plusknappen till höger om flikarna (*Starta ett projekt*). Fönstret *Starta ett projekt* öppnas.
2. Välj *Nytt projekt* för en tom tidsplan, eller *Öppna befintligt projekt* för att välja en fil. *Avbryt* stänger fönstret.
3. Med *Nytt projekt* fyller du i fönstret *Nytt projekt* och klickar på *Skapa*.

Projektet visas i en egen flik och är aktivt direkt. *Nytt* och *Öppna* i menyfliksområdet, Ctrl+O och exemplen i *Fil › Exempel* öppnar också ett projekt i en ny flik. Endast en ny, tom tidsplan som du ännu inte har ändrat återanvänds i stället för att en flik läggs till.

### Byta mellan projekt

- Klicka på projektets flik.
- Tryck på Ctrl+1 till Ctrl+9 (⌘ i stället för Ctrl på macOS) för projektet på den platsen i raden, räknat från vänster till höger.
- Klicka på menyikonen till vänster om flikarna (*Alla projekt*). Översikten *Öppnade projekt* visar ett kort per projekt med namnet, filnamnet (om projektet har en fil), en miniatyr av tidsplanen, antalet uppgifter, antalet kritiska uppgifter och slutdatumet. Klicka på ett kort för att gå dit. Esc stänger översikten.

Varje flik har en färgad prick som hör till projektet. En flik med en liten prick efter namnet har osparade ändringar.

### Stänga ett projekt

Klicka på krysset bredvid namnet på fliken (*Stäng*) eller på krysset på ett kort i översikten. Ett projekt utan ändringar stängs direkt. Har det osparade ändringar visar appen dialogrutan *Osparade ändringar* med tre val:

- *Spara* sparar projektet och stänger det sedan.
- *Spara inte* stänger projektet och kastar bort ändringarna.
- *Avbryt* lämnar projektet öppet.

Om du avbryter sparandet, till exempel genom att stänga dialogrutan för sparande, förblir projektet öppet.

Stänger du det sista projektet finns en tom tidsplan kvar, med namnet *Ny tidsplan*.

### Välja stil för dokumentbyte

Flikarna är ett val. Öppna inställningsfönstret med kugghjulet i namnlisten, gå till fliken *Utseende* och välj i inställningen *Stil för dokumentbyte*:

- *Horisontella flikar*: standard. En rad med flikar under menyfliksområdet.
- *Vertikala flikar*: en smal remsa till vänster med en knapp per projekt (de första bokstäverna i namnet) och ett plustecken. Om du för muspekaren över en knapp ser du namn, filnamn, antal uppgifter, antal kritiska uppgifter och slutdatum. Knappen överst öppnar översikten.
- *Kapsel*: en kapsel i namnlisten med namnet på det aktiva projektet och en räknare, till exempel *2 öppna*. Klicka på den för att öppna översikten och byta där.

Alla tre stilarna öppnar samma översikt, och Ctrl+1 till Ctrl+9 fungerar i varje stil.

## Fallgropar och vad appen gör

**Vad som hör till projektet och vad som delas.** Varje projekt har en egen vy: zoom och position, en aktiv layout med filter, gruppering eller sortering, delad vy, sambandslinjerna och de ihopfällda faserna. Byter du till ett annat projekt ser du dess egen vy där. Delat mellan alla projekt är den valda fliken i menyfliksområdet, minikartan, överlagringarna (baslinjeöverlagring, framdriftslinje och resten), ditt val av kolumner, dina layouter och dina rapportval.

**Du kan inte byta när en dialogruta är öppen.** Så länge en dialogruta är öppen, till exempel inställningsfönstret eller ett uppgiftsfönster, gör Ctrl+1 till Ctrl+9 ingenting i appen. I webbläsaren byter de i stället webbläsarflikar. Stäng dialogrutan först. En ännu inte tillämpad ändring i *Projektinfo* i Backstage blockerar också byte.

**Ctrl+1 till Ctrl+9 räknar i ordning.** Genvägen går till projektet på den platsen i raden. Stänger du ett projekt flyttas de andra platserna upp. Har du fler än nio projekt öppna når du de övriga bara via flikarna eller översikten.

**Beräkna och rapporterna gäller det aktiva projektet.** Beräkna (F5), *Exportera PDF* och rapporterna gäller projektet som är aktivt just nu.

## Se även

- [Skapa och använda en layout](docs://howto-layouts-gebruiken): ställa in en vy per projekt.
- [Skapa och skriva ut en rapport](docs://howto-rapport-maken-en-afdrukken): rapporten för det aktiva projektet.

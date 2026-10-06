# Codes en eigen velden

Doel: eigen indelingen (activity codes, zoals *Locatie*) en eigen velden (zoals *Aannemer*) aan je taken hangen.

## Wanneer je dit nodig hebt

Naast de vaste gegevens van een taak (naam, duur, relaties, …) kun je zelf gegevens toevoegen. Wil je taken indelen naar de noordvleugel en de zuidvleugel, naar discipline, of bijhouden welke aannemer een taak uitvoert, dan leg je dat zelf vast. Dat kan op twee manieren, en het verschil is belangrijk.

Een **activity code** is een indeling met een vaste keuzelijst. Je maakt een **codetype** (bijvoorbeeld *Locatie*) met **waarden** (*N* voor de noordvleugel, *Z* voor de zuidvleugel). Een taak krijgt per codetype hooguit één waarde.

Een **eigen veld** (in het venster onder *Gebruikersvelden*) is een vrij invulveld met een type: *Tekst*, *Getal*, *Geheel getal*, *Kosten*, *Datum* of *Ja/nee*. Het veld kan een andere waarde hebben op elke taak.

## Stappen

### Codes en velden definiëren

1. Kies *Planning › Structuur › Codes & velden*.
2. **Een codetype maken.** Typ bij *Nieuw codetype (bv. Locatie)* de naam en druk op Enter, of klik op *Codetype toevoegen*.
3. **Waarden toevoegen.** Klik onder het codetype op *Waarde toevoegen*. De app zet er een voorlopige code neer, zoals *W1*. Pas die aan in het vak *Code* (kort, zoals je hem zou typen: *N*), vul zo nodig een *Omschrijving* in (*Noordvleugel*) en kies een *Kleur*. Een wijziging telt zodra je het vak verlaat of op Enter drukt.
4. **Een eigen veld maken.** Typ bij *Nieuw veld (bv. Aannemer)* de naam, kies het type en klik op *Veld toevoegen* (of druk op Enter).

Het venster heeft geen OK-knop: elke wijziging geldt meteen. Het type van een veld kun je achteraf niet meer veranderen, alleen de naam. Wil je een ander type, maak dan een nieuw veld.

### Een code of veld bij een taak invullen

Je hebt twee plekken.

- **In het paneel *Eigenschappen*** (of in het venster dat je met F2 opent). Onderaan staat het blok *Codes & velden*: per codetype een keuzelijst, per veld een invoer. Het blok verschijnt pas zodra er minstens één codetype of veld is.
- **Als kolom in de takenlijst.** Klik op de **+** rechts in de tabelkop (*Kolom toevoegen*) en kies onder *Aangepast* het codetype of veld. In de cel van een codetype typ je de code, bijvoorbeeld `N`, of kies je uit de lijst. Een code die niet bestaat, geeft *Kies een waarde uit deze activiteitencode.*

### Gebruiken

Een codetype of eigen veld kun je gebruiken om te filteren, te groeperen en te sorteren. Dat stel je in met een layout: *Beeld › Layout › Nieuwe layout*. Kies in het venster de onderdelen die je wilt vastleggen. Met *Opslaan* krijg je een knop in *Beeld › Layout* die je later weer aanklikt; met *Toepassen zonder opslaan* zet je het alleen nu op het scherm. Bij groeperen komen taken zonder waarde onder *(geen)*.

Voor de balkkleur kies je *Beeld › Baselines & voortgang › Balkkleuren*, dan *Op categorie* en het codetype. Elke balk krijgt dan de *Kleur* van zijn waarde.

## Valkuilen en wat de app dan doet

**Verwijderen haalt de waarden bij de taken weg.** Verwijder je een codetype, een waarde of een veld met het prullenbakje, dan vraagt de app niet om bevestiging, en de toewijzingen op alle taken verdwijnen mee. Een groepering of sortering op dat codetype of veld vervalt ook. *Ongedaan* (Ctrl+Z) brengt het codetype, de waarde of het veld en de ingevulde waarden terug, maar niet de groepering of sortering: die stel je opnieuw in.

**Twee waarden met dezelfde code.** *Waarde toevoegen* nummert door op het aantal waarden dat er is. Verwijder je er één en voeg je er een toe, dan kan er dus een code dubbel voorkomen. Typ je die code in een kolomcel, dan weigert de app dat met *Deze activiteitencodewaarde komt meerdere keren voor. Kies hem uit de lijst.* Geef elke waarde een eigen code.

**Sjablonen nemen codes en velden niet mee.** Zie [WBS-sjablonen bewaren en invoegen](docs://howto-wbs-sjablonen). Plak je taken in een ander document, dan maakt de app codes en velden leeg die daar niet bestaan en meldt dat.

**Een datumveld schuift niet mee.** Verplaats je het hele project, dan blijven ingevulde eigen velden van het type *Datum* op hun datum staan. De app waarschuwt daarvoor in het voorbeeld.

## Zie ook

- [Structuur aanpassen](docs://howto-structuur-aanpassen): de WBS-boom, de andere manier om taken in te delen.
- [Project verplaatsen](docs://howto-project-verplaatsen): wat er met datums gebeurt bij het verplaatsen van het project.
- [Een layout maken en gebruiken](docs://howto-layouts-gebruiken): groeperen en filteren op een code of eigen veld.
- [Tabelkolommen aanpassen](docs://howto-tabelkolommen-aanpassen): een code of eigen veld als kolom tonen.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): de activiteitcodes *House* en *Discipline*, het eigen veld *Cost estimate* en aantekeningen (open en afgevinkt).

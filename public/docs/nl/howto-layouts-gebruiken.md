# Een layout maken en gebruiken

Doel: met één klik wisselen tussen weergaven van je planning, bijvoorbeeld alleen de kritieke taken, de taken per ploeg of een andere sortering.

## Wanneer je dit nodig hebt

In het bouwoverleg wil de opdrachtgever alleen de kritieke taken zien. Daarna wil de uitvoerder per ploeg kijken wie wanneer nodig is. Daarna wil je weer de hele planning. Steeds opnieuw filters, groepen en sorteervolgordes instellen is omslachtig. Een **layout** legt zo'n weergave vast als knop in het lint.

Een layout kan zes dingen vastleggen: het filter, de groepering, de sortering, de kolommen van de taaktabel naast de Gantt, de tijdschaal en de relatielijnen en overlays (baseline, voortgangslijn, statusdatumlijn, resource-accent, spelingsband en balkkleuren). Alleen wat je aanvinkt verandert als je op de knop klikt. De rest van je beeld blijft staan.

Filteren, groeperen en sorteren doe je met een layout. De losse knoppen *Filteren…*, *Groeperen…* en *Sorteren…* bestaan alleen nog achter een verborgen instelling (zie de valkuilen).

## Stappen

### Een bestaande layout gebruiken

1. Kies het tabblad *Beeld*. In de groep *Layout* staat een knop per layout. Standaard is dat *Resourcediagram*.
2. Klik erop. *Resourcediagram* groepeert de taken per resource, sorteert binnen elke groep op start en zet de relatielijnen uit. Een taak met twee resources staat onder allebei.
3. Klik nogmaals om de layout uit te zetten. Dan komt het beeld terug zoals het was vóór je klik.

Elke klik is één stap voor *Ongedaan* (Ctrl+Z), zowel aanzetten als uitzetten.

### Een eigen layout maken

1. Klik in de groep *Layout* op *Nieuwe layout*. Het venster *Nieuwe layout* opent.
2. Typ een *Naam* en kies een *Icoon*.
3. Onder *Wat legt deze layout vast?* staan de zes onderdelen met een vinkje. Een nieuw venster begint met álle onderdelen aangevinkt en gevuld met wat er nu op je scherm staat. Haal de vinkjes weg van alles wat de layout niet mag veranderen. Wil je alleen een filter, laat dan alleen *Filteren* aan. *Huidige weergave overnemen* vult alle onderdelen opnieuw met je scherm.
4. Stel de onderdelen in.
5. Klik op *Opslaan*.

De layout staat nu als knop in het lint, maar is nog niet toegepast. Klik op de knop om hem aan te zetten.

### Het filter instellen

Onder *Filteren* bouw je regels. Klik op *+ regel*, kies een *Veld*, een *Operator* en een waarde. Wil je alleen de kritieke taken: veld *Kritiek*, operator *is gelijk aan*, waarde *Ja*. De velden zijn onder meer *Taaknaam*, *Start*, *Einde*, *Totale speling*, *Voortgang* en *Mijlpaal*, plus je eigen activiteitscodes en velden en *Resources*. De operatoren hangen af van het soort veld: bij tekst kun je bijvoorbeeld *bevat* kiezen, bij getallen en datums *tussen*.

Met het veld *In uitvoering* en de operator *tussen* en twee datums krijg je alle taken die op enig moment in die periode lopen, zoals alles wat in juni actief is.

Meerdere regels combineer je met de keuzelijst bovenaan: *Alles hieronder (AND)* toont taken die aan alle regels voldoen, *Iets hieronder (OR)* taken die aan minstens één regel voldoen. Met *+ groep* voeg je een subgroep met eigen regels toe.

Het filter kijkt naar de taken zelf. De fasen (samenvattingstaken) waar zo'n taak onder valt, blijven in grijs in beeld, zodat je ziet waar de taak hoort. Groepeer je ook, dan verdwijnen die grijze fasen.

### Groeperen en sorteren

Onder *Groeperen* voeg je met *+ niveau* een veld toe. Er zijn maximaal twee groepeerniveaus. Zonder groepering zie je de WBS-boom. Onder *Sorteren* voeg je met *+ niveau toevoegen* een veld toe en kies je *Oplopend* of *Aflopend*. Met twee niveaus beslist het tweede bij gelijke waarden op het eerste.

### Snel iets proberen zonder knop

Klik in het venster op *Toepassen zonder opslaan*. De aangevinkte onderdelen komen op het scherm, maar er komt geen knop bij. Dat is handig voor een filter dat je maar één keer nodig hebt. Ctrl+Z draait het terug.

### Een layout wijzigen, kopiëren of weghalen

Klik met de rechtermuisknop op de layoutknop. Je kiest *Bewerken…*, *Dupliceren* of *Verwijderen*. *Verwijderen* vraagt eerst om bevestiging. Een kopie heet *naam (kopie)*. Een meegeleverde layout, zoals *Resourcediagram*, kun je niet bewerken of verwijderen; die dupliceer je om een eigen versie te maken.

### Meer dan één layout tegelijk

Layouts die niet dezelfde onderdelen vastleggen kunnen samen aan staan. Heb je een layout die alleen het filter *Kritiek is gelijk aan Ja* vastlegt (noem hem bijvoorbeeld *Alleen kritiek*) en zet je die samen met *Resourcediagram* (groepering, sortering, relatielijnen) aan, dan krijg je de kritieke taken per resource. Leggen twee layouts hetzelfde onderdeel vast, bijvoorbeeld allebei een filter, dan neemt de tweede het over en gaat de eerste uit. Zet je die tweede weer uit, dan keer je terug naar het beeld van vóór je eerste klik, niet naar de eerste layout.

## Valkuilen en wat de app dan doet

**Je vergeet onderdelen uit te vinken.** Een layout die ook de kolommen, tijdschaal en overlays vastlegt, zet die bij elke klik terug naar de opgeslagen stand. Je zoom springt dan weg terwijl je alleen een filter wilde. Kijk in het venster of alleen de bedoelde onderdelen zijn aangevinkt.

**Een onvolledige regel toont niets.** Kies je bij een ja/nee-veld geen waarde (er staat nog *—*) of laat je de datums bij *In uitvoering* leeg, dan voldoet geen enkele taak en blijft de lijst leeg. Vul de regel af.

**Een handmatige wijziging zet de layout uit.** Verander je zelf een onderdeel dat de layout vastlegt, bijvoorbeeld *Relatielijnen* terwijl *Resourcediagram* aan staat, dan valt die layout af en gaan de andere delen terug naar het beeld van vóór de layout. Zoomen zet een layout uit die de tijdschaal vastlegt, en een kolom breder maken een layout die de kolommen vastlegt. De rest van het beeld blijft dan staan. Het Resourcediagram legt de tijdschaal niet vast, dus daar valt zoomen buiten.

**Kolommen gelden voor de taaktabel naast de Gantt.** Het onderdeel *Kolommen* legt de kolommen vast van de tabel links van de tijdlijn. De tabel op het tabblad *Tabel* houdt zijn eigen kolommen. Hoe je kolommen kiest, lees je in [Tabelkolommen aanpassen](docs://howto-tabelkolommen-aanpassen).

**Inspringen en uitspringen staan uit.** Zolang er een filter, groepering of sortering aan staat, is de getoonde volgorde niet de volgorde van de planning. *Inspringen* en *Uitspringen* zijn dan uitgeschakeld met de tooltip *Niet beschikbaar tijdens filteren/groeperen/sorteren*. Zet de layout uit om de structuur weer aan te passen, zoals beschreven in [Structuur aanpassen](docs://howto-structuur-aanpassen).

**De statusbalk telt niet mee.** Bij *Taken:* in de statusbalk staat het aantal taken van het hele project, ook als een filter er maar een deel van toont.

**Layouts staan op je apparaat, niet in het project.** Je layouts en de kolommen bewaart de app voor al je projecten op dit apparaat. De overlays uit een layout (baseline, voortgangslijn en de rest) gelden voor al je projecten. Het filter, de groepering en de sortering die op dit moment aan staan, horen bij het geopende project, maar komen niet in het projectbestand: na opslaan en heropenen is het beeld weer schoon. Ze maken het project ook niet "gewijzigd".

**De losse knoppen zijn verborgen.** *Kolommen…*, *Filteren…*, *Groeperen…* en *Sorteren…* als losse knoppen op het tabblad *Beeld* zijn een oude weergave. Je zet ze terug met *Klassieke weergaveknoppen tonen* onder *Legacy-functies* op het tabblad *Geavanceerd* van het instellingenvenster (⚙ in de titelbalk). Gebruik liever layouts.

## Zie ook

- [Tabelkolommen aanpassen](docs://howto-tabelkolommen-aanpassen): de kolommen zelf kiezen, verplaatsen en vastzetten.
- [Een rapport maken en afdrukken](docs://howto-rapport-maken-en-afdrukken): de weergave op papier zetten met *Volg weergave*.
- [Structuur aanpassen](docs://howto-structuur-aanpassen): waarom inspringen tijdens filteren niet kan.

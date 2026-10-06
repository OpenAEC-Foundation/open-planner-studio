# De resourcebibliotheek gebruiken

Doel: resources uit de resourcebibliotheek in je project gebruiken, en een resource die je in een project maakte in de bibliotheek zetten, zodat elk project dezelfde gegevens gebruikt.

## Wanneer je dit nodig hebt

Je hebt een vaste metselploeg, een kraan en een stukadoor die in meerdere projecten voorkomen. Zonder bibliotheek typ je ze in elk project opnieuw in, met kans op verschillende namen en tarieven, en ziet geen enkel project dat een ander dezelfde ploeg ook vraagt. In de bibliotheek leg je ze één keer vast.

Wat de bibliotheek is en wat een project ervan overneemt, lees je in [De resourcebibliotheek](docs://uitleg-resourcebibliotheek). Dit artikel gaat over de handelingen. Bibliotheken aanmaken, exporteren en verwijderen staat in [Resourcebibliotheken beheren en delen](docs://howto-bibliotheken-beheren).

## Stappen

### 1. Het project aan een bibliotheek koppelen

Je werkt alleen met de bibliotheek als het project eraan gekoppeld is. Zonder koppeling toont het paneel *Resources* de schakelaar *Bibliotheek*, *Project* en *Bezetting* niet.

Bij een nieuw project:

1. Kies *Bestand › Nieuw*. Het venster *Nieuw project* opent.
2. Kijk bij *Resourcebibliotheek*. Het veld staat op de standaardbibliotheek. Je kunt een andere kiezen, *geen bibliotheek (los project)* of *+ Nieuwe resourcebibliotheek…*.
3. Klik op *Aanmaken*.

Bij een bestaand project:

1. Kies *Bestand › Projectinfo*.
2. Kies bij *Resourcebibliotheek* de bibliotheek.
3. Klik op *Toepassen*. Tot dat moment staat onderaan *Wijzigingen niet toegepast — klik op Toepassen om ze te bewaren.*

Heeft het project al resources met dezelfde naam als een bibliotheekitem, dan opent het venster *Resourcebibliotheek koppelen* met de sectie *Herkennen*. Bij elke resource met een treffer staat *Voorstel: Metselaar*. Klik op *Koppelen* om die ene te koppelen, of op *Alle voorstellen koppelen* als er meer dan één voorstel is. De app vergelijkt namen zonder op hoofdletters of dubbele spaties te letten. Bij het koppelen neemt de resource naam, type, tarief, eenheid en omschrijving van het bibliotheekitem over. *Max. eenheden* blijft wat je in het project had. Het venster toont ook kalenders van het project die dezelfde naam hebben als een bibliotheekkalender. Met *Later beslissen* sluit je het venster zonder te koppelen.

### 2. Een resource in de bibliotheek zetten

1. Kies *Resources › Beheer › Resources*. Het resourcepaneel neemt de werkruimte over. Het opent altijd op *Project*, ook bij een gekoppeld project.
2. Kies rechtsboven *Bibliotheek*. Boven de tabel staat *Dit bewerkt de bibliotheek en geldt voor alle projecten — valt buiten ongedaan maken.*
3. Klik op *Nieuwe resource in de bibliotheek*. Onderaan de tabel komt een lege rij.
4. Typ de naam, bijvoorbeeld *Metselaar*, en druk op Enter. De resource staat nu in de bibliotheek en er opent meteen een lege rij voor de volgende. Druk op Esc als je klaar bent. Zonder naam maakt de app niets aan.
5. Vul de rest van de rij in. *Type* is standaard *Arbeid*. Bij *Max. eenheden* zet je hoeveel er van deze resource in totaal is, bijvoorbeeld 3 bij drie metselaars. Het bezettingsoverzicht gebruikt dit getal als capaciteit. *Tarief/uur* is optioneel. *Eenheid* kun je alleen invullen bij het type *Materiaal*. Bij *Kalender* kies je een kalender uit de bibliotheek, of *+ Resourcekalender* om er een te maken, zie [Een resourcekalender instellen](docs://howto-resourcekalender-instellen). Naam, tarief en eenheid bewaart de app als je het veld verlaat, de andere velden meteen.

Elke wijziging in de bibliotheek werkt direct door in de onbewerkte kopieën in je geopende projecten.

### 3. Een resource aan je project toewijzen

1. Kies in de weergave *Bibliotheek* bij de resource *Toewijzen aan project*. Boven de tabel staat *Toegevoegd.* Klik je nog een keer, dan staat er *Zit al in het project.* en komt er geen tweede kopie.
2. Kies *Project*. De kopie staat in de tabel met een klein bibliotheekpictogram bij de naam, dat *Uit de bibliotheek* heet. Naam, type, tarief en eenheid staan als platte tekst. Houd je de muis erboven, dan zie je *Bibliotheekwaarde — bewerk in de Bibliotheekweergave, of maak deze resource los van de bibliotheek.*
3. Stel *Max. eenheden* in voor dit project. Het veld begint met de waarde uit de bibliotheek en blijft in het project bewerkbaar.
4. Hang de resource nu aan taken zoals bij elke andere resource, zie [Resources toewijzen met een curve](docs://howto-resource-toewijzen). *Resources › Toewijzing › Toewijzen* toont alleen resources die al in het project staan, dus wijs een bibliotheekresource eerst op deze manier aan het project toe.

*Toewijzen aan project* bestaat alleen in de weergave *Bibliotheek* van een project dat aan die bibliotheek gekoppeld is.

### 4. Een resource van je project naar de bibliotheek brengen

Dit doe je bij een resource die je in het project maakte en die je vaker gebruikt, zoals een gehuurde kraan.

1. Kies in de weergave *Project* bij de resource *Naar de bibliotheek*. De knop staat alleen bij een resource met een naam die nog niet uit de bibliotheek komt, in een gekoppeld project.
2. Lees de melding boven de tabel.

De melding kan drie dingen zeggen:

- *Toegevoegd.* De bibliotheek had geen item met die naam. Er is een nieuw item gemaakt en je resource is eraan gekoppeld.
- *Bestond al in de bibliotheek — nu gekoppeld.* Er was een item met dezelfde naam en dezelfde gegevens. Je resource is eraan gekoppeld.
- *Gekoppeld aan het bestaande bibliotheekitem — de waarden verschillen, zie de markering.* Er was een item met dezelfde naam maar andere gegevens. Je resource is gekoppeld en staat meteen op *wijkt af — beslis*. Ga verder bij stap 6.

### 5. Een kopie loskoppelen

Wil je in één project afwijken van de bibliotheek, bijvoorbeeld met een ander tarief, dan maak je de kopie los.

1. Klik in de weergave *Project* aan het eind van de rij op het pictogram *Losmaken van de bibliotheek*.
2. De resource is nu een gewone projectresource. Alle velden zijn bewerkbaar en hij volgt de bibliotheek niet meer. De kalender die met de resource is meegekomen gaat mee los, tenzij een andere resource in dit project hem nog volgt.

Met *Ongedaan* (Ctrl+Z) haal je het losmaken terug.

### 6. Een afwijking oplossen

Een kopie die *wijkt af — beslis* meldt, verschilt van het bibliotheekitem. De app kiest niet zelf wie gelijk heeft.

1. Klik op de markering *wijkt af — beslis* bij de resource. Het venster *Resourcebibliotheek koppelen* opent. Het opent ook vanzelf als je een bestand opent met zo'n kopie.
2. Kies in de sectie *Afwijkingen* bij het onderdeel wat je wilt, zie hieronder.
3. Klik op *Later beslissen* als je nog niet wilt kiezen. Het venster sluit en de markering blijft staan.

Je hebt bij een afwijking twee keuzes:

- *Bibliotheekwaarden gebruiken*: de kopie krijgt de gegevens van de bibliotheek.
- *Bestandswaarden overnemen in de bibliotheek*: de bibliotheek krijgt de gegevens van jouw kopie. Daaronder staat *Let op: dit past de bibliotheek aan en geldt voor al je projecten.* De kopieën in andere geopende projecten lopen mee.

## Valkuilen en wat de app dan doet

**De voorbeeldprojecten hebben een eigen bibliotheek.** Open je een van de drie showcase-voorbeelden (*Bestand › Voorbeelden*, of via een link in de Help), dan maakt de app eenmalig de bibliotheek *Demo resource library* aan en koppelt het project eraan. Resources van het project met dezelfde naam als een bibliotheekitem worden meteen gekoppeld; kalenders niet. Je eigen bibliotheken blijven ongemoeid. Open je twee showcases naast elkaar, dan tonen ze samen conflicten in [Het bezettingsoverzicht gebruiken](docs://howto-bezettingsoverzicht-gebruiken), bijvoorbeeld op de metselploeg (*Masonry crew*) tussen *Refurbishment & Extension of a Family Home* en *6 New Terraced Houses, De Akkers*.

**Je ziet de schakelaar niet.** Het project is niet aan een bibliotheek gekoppeld. Doe stap 1.

**Je bewerkt de bibliotheek per ongeluk.** Het paneel opent altijd op *Project* om dat te voorkomen. Wijzigingen in de weergave *Bibliotheek* gelden voor alle projecten en vallen buiten *Ongedaan*.

**Je verwijdert een resource uit de bibliotheek.** De app vraagt eerst *'Metselaar' verwijderen uit de bibliotheek? Dit geldt voor alle projecten en is niet ongedaan te maken.* De kopieën in je projecten blijven bestaan en werken door. Ze krijgen de markering *niet meer in de bibliotheek* en zijn volledig bewerkbaar. Met *Verwijder uit project* haal je een kopie uit het project.

**Je kiest bij Resourcebibliotheek een andere bibliotheek of *geen bibliotheek (los project)*.** De herkomststempels van de vorige bibliotheek verdwijnen. De resources blijven in het project staan als gewone projectresources. Bij een andere bibliotheek zoekt de app opnieuw naar resources met dezelfde naam.

**Een resource heeft in *Herkennen* geen voorstel.** Er staat *Geen voorstel — kies handmatig*, maar dit venster heeft daarvoor geen knop. Dat lijkt een tekortkoming. Zet zo'n resource met *Naar de bibliotheek* (stap 4) in de bibliotheek.

## Zie ook

- [De resourcebibliotheek](docs://uitleg-resourcebibliotheek): wat de bibliotheek bepaalt, wat het project, en hoe kopieën meelopen.
- [Resourcebibliotheken beheren en delen](docs://howto-bibliotheken-beheren): bibliotheken aanmaken, exporteren en importeren.
- [Het bezettingsoverzicht gebruiken](docs://howto-bezettingsoverzicht-gebruiken): zien of twee projecten dezelfde resource tegelijk vragen.
- [Resources beheren](docs://howto-resources-beheren): de resources van één project.

# Rechtermuismenu's

Welke menu's de rechtermuisknop opent in de Gantt en in de takenlijst, wat elk item doet en voor welke taken het geldt. De items die ook als knop of sneltoets bestaan, staan in [Lint per tabblad](docs://ref-lint) en [Sneltoetsen](docs://ref-sneltoetsen).

## Welk menu waar

Er zijn vier menu's. Welke je krijgt, hangt af van waar je klikt:

- **Op een taakbalk in de Gantt** — het taakmenu, met bovenaan *Relatie leggen vanaf hier*.
- **Op een taak in de takenlijst** — hetzelfde taakmenu, zonder dat ene item bovenaan. Dit geldt voor de takenlijst links van de Gantt en voor het tabblad *Tabel*.
- **Op een groepskop in de takenlijst** — een klein menu om groepen in en uit te klappen. De groepskoppen verschijnen alleen als je groepeert, bijvoorbeeld met de layout *Resourcediagram*.
- **Op lege ruimte** — in de Gantt naast of onder de balken, en in de takenlijst onder de laatste taak of op de grijze regel *Nieuwe taak*. Het menu heeft *Nieuwe taak*, *Mijlpaal toevoegen* en *Plakken*; in de Gantt ook *Zoom herstellen* en *Passend maken op project*. Een nieuwe taak of mijlpaal komt onderaan de lijst. In de Gantt begint hij op de datum waar je klikte; in de takenlijst gaat de naamcel meteen open om te typen.

Op de band van een groepskop in de Gantt opent de rechtermuisknop geen menu. Ook een rechtsklik in de tijdlijnkop doet niets. De kolomkoppen van de takenlijst hebben een eigen menu, beschreven in [Tabelkolommen aanpassen](docs://howto-tabelkolommen-aanpassen).

**Voor welke taken geldt een item?** Je klikt op één taak, maar de selectie bepaalt het bereik. Zit de taak waarop je klikt in de selectie, dan geldt het item voor de hele selectie. Zit hij er niet in, dan geldt het alleen voor die ene taak. Bij een rechtsklik op een balk in de Gantt of op een rij in de takenlijst vervangt die taak de selectie als hij er nog niet in zat. Elk item dat iets wijzigt is één stap in *Ongedaan*, ook voor een hele selectie.

## Het taakmenu

De items staan in deze volgorde. Een lijn tussen groepen is een scheidingslijn in het menu.

**Relatie leggen vanaf hier** — alleen in de Gantt, op een balk. Zet de relatiemodus aan met deze taak geselecteerd; daarna sleep je naar de opvolger. Zie [Relaties leggen](docs://howto-relaties-leggen).

**Onderbreking opheffen** en **Alle onderbrekingen opheffen** — alleen in de Gantt, op een balk met onderbrekingen. *Onderbreking opheffen* staat er alleen als je op een pauze of het stuk erna klikt en de onderbreking bewerkbaar is; het haalt die ene pauze weg. *Alle onderbrekingen opheffen* haalt ze allemaal weg, ook onderbrekingen uit een bronbestand die je niet kunt bewerken. Zie [Een taak splitsen](docs://howto-taak-splitsen).

**Bewerken...** — opent het venster *Taak bewerken* voor deze taak. Zie [Taakdialoog en eigenschappenpaneel](docs://ref-taak-eigenschappen).

**Invoegen boven** en **Invoegen onder** — voegt één nieuwe taak in boven de bovenste of onder de onderste taak van het bereik, op hetzelfde niveau. Het werkt alleen in de pure boomweergave, zonder filter, groepering of sortering; anders weigert de app het met een melding. Zie [Taken en mijlpalen toevoegen](docs://howto-taken-en-mijlpalen-toevoegen).

**Subtaak toevoegen** — voegt een nieuwe taak toe als subtaak van de taak waarop je klikte, onderaan haar subtaken. Alleen voor die ene taak, niet voor de hele selectie.

**Mijlpaal toevoegen** — voegt een mijlpaal toe als subtaak van de taak waarop je klikte. Alleen voor die ene taak.

**Relatie toevoegen** — doet hetzelfde als *Relatie leggen vanaf hier*: zet de relatiemodus aan met deze taak geselecteerd. In de takenlijst is het item uitgeschakeld als de Gantt niet in beeld is, met de tooltip *Alleen beschikbaar als de Gantt in beeld is*.

**Inspringen** en **Uitspringen** — maakt de taken van het bereik een niveau dieper of een niveau hoger in de WBS. Deze twee staan er alleen in de pure boomweergave. Zie [Structuur aanpassen](docs://howto-structuur-aanpassen).

**Mijlpaal aan/uit** — zet de taak om naar een mijlpaal, of terug. De nieuwe stand volgt uit de taak waarop je klikte en geldt voor het hele bereik: is die een taak, dan worden alle taken van het bereik mijlpaal. Een samenvattingstaak en een taak met toewijzingen worden geen mijlpaal; de rest van het bereik wel, en je krijgt een melding per reden.

**Kalender toewijzen ▸** — een submenu met *Projectkalender* (de taak krijgt dan geen eigen kalender) en daaronder de beschikbare kalenders. De huidige keuze heeft een vinkje. Een taak die al op die kalender staat, telt niet mee en maakt geen extra *Ongedaan*-stap. Zie [Een kalender maken en toewijzen](docs://howto-kalender-maken-en-toewijzen).

**Voortgang ▸** — een submenu met 0%, 25%, 50%, 75% en 100%. De huidige waarde heeft een vinkje. Een samenvattingstaak heeft geen eigen voortgang: staat er een in het bereik, dan krijgen haar bladtaken het percentage. Zonder statusdatum zet de app die op vandaag, met een melding. Een taak die volgens de planning pas na de statusdatum begint en nog geen werkelijke start heeft, leidt eerst tot een vraag naar de werkelijke start; annuleer je die, dan verandert er niets. Zie [Voortgang bijwerken](docs://howto-voortgang-bijwerken).

**Prioriteit ▸** — een submenu met *Laag* (100), *Normaal* (500) en *Hoog* (900), de nivelleerprioriteit van de taak. De huidige waarde heeft een vinkje. Zie [Nivelleren](docs://uitleg-nivelleren).

**Pad traceren** — toont de voorgangers en opvolgers van deze taak. Is het traceren al aan, dan heet het item *Traceren stoppen*. Zie [Een pad traceren](docs://howto-pad-traceren).

**Inklappen**, **Uitklappen** en **Bewaar tak als sjabloon** — alleen bij een samenvattingstaak. *Inklappen* en *Uitklappen* staan er altijd allebei, ook als de taak al in- of uitgeklapt is, en gelden voor het hele bereik. *Bewaar tak als sjabloon* bewaart de taak met haar subtaken en de relaties daartussen als WBS-sjabloon. Zie [WBS-sjablonen](docs://howto-wbs-sjablonen).

**Verwijderen** — verwijdert de taken van het bereik, met hun subtaken. Er is geen bevestiging; je haalt het terug met Ctrl+Z, één stap voor het hele bereik. Zie [Taken selecteren, verwijderen en ongedaan maken](docs://howto-taken-selecteren-verwijderen).

## Het menu van een groepskop

Dit menu bestaat alleen in de takenlijst, op een groepskop:

**Groep inklappen** of **Groep uitklappen** — klapt alleen deze groep dicht of open. Het item toont wat je kunt doen.

**Alles uitklappen** en **Alles inklappen** — klapt alle groepen tegelijk open of dicht.

Groeperen stel je in met een layout, zie [Een layout maken en gebruiken](docs://howto-layouts-gebruiken).

## Zie ook

- [In de Gantt slepen, pannen en zoomen](docs://howto-gantt-bedienen): wat slepen met de linker- en middelste muisknop doet.
- [Lint per tabblad](docs://ref-lint): de knoppen die dezelfde acties hebben.
- [Sneltoetsen](docs://ref-sneltoetsen): de toetsen die erbij horen.

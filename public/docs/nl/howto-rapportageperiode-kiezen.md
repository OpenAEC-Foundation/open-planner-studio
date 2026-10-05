# De rapportageperiode kiezen

Doel: bepalen over welk stuk van de tijd een rapport gaat, bijvoorbeeld de komende vier weken of de maand juni.

## Wanneer je dit nodig hebt

Het weekoverleg wil weten wat er de komende vier weken gebeurt. De maandrapportage gaat over juni. Zonder periode krijg je de hele planning op papier. Vijf rapporten werken daarom met een *Rapportageperiode:*: *Look-ahead*, *Voortgangsrapport*, *Resourcebelasting*, *Resourcetoewijzingen* en het *Resourcediagram*. De andere rapporten hebben geen periode.

De periode hangt niet aan een kalendermaand, maar aan een **referentiedag**: de statusdatum van je project (de dag waarop je de voortgang peilt, zie [Voortgang, statusdatum en baseline](docs://uitleg-voortgang)), of vandaag als het project geen statusdatum heeft. *Volgende 4 weken* telt vanaf die dag. Schuif je de statusdatum op, dan schuift het venster mee.

## Stappen

### 1. Zet de statusdatum

Werk je met een relatieve keuze, zoals *Volgende 4 weken* of *Afgelopen maand*, zet dan eerst de statusdatum. Kies *Planning › Baselines & voortgang* en vul het veld *Statusdatum* in. Met het kruisje ernaast (*Statusdatum leegmaken*) haal je de datum weer weg. Werk je met een vaste periode (stap 4), dan hoeft dit niet.

### 2. Kies een rapport met een periode

Open het tabblad *Rapport* en kies bij *Rapporttype* een van de vijf rapporten. De keuzelijst *Rapportageperiode:* staat onder *Rapportopties*. Bij het Resourcediagram staat hij onder *Instellingen*, onder de vier vinkjes van dat rapport.

Elk rapport onthoudt zijn eigen periode. Dit zijn de beginwaarden:

- *Look-ahead*: *Volgende maand*.
- *Voortgangsrapport*: *Afgelopen maand*.
- *Resourcebelasting*, *Resourcetoewijzingen* en *Resourcediagram*: *Hele project*.

### 3. Kies een periode uit de lijst

De lijst heeft *Volgende week*, *Volgende 2 weken*, *Volgende 4 weken*, *Volgende 6 weken*, *Volgende 8 weken*, *Volgende 12 weken*, *Volgende maand*, dezelfde zeven met *Afgelopen*, *Hele project* en *Aangepast*. Onder de lijst staan *Van* en *Tot* met de datums die de keuze oplevert. Die kun je hier alleen lezen.

Beide dagen tellen mee. Is de statusdatum donderdag 20 mei, dan loopt *Volgende week* van 20 tot en met 26 mei en *Volgende 4 weken* van 20 mei tot en met 16 juni (28 dagen). *Volgende maand* loopt tot een dag voor dezelfde datum in de volgende maand, hier tot en met 19 juni. *Afgelopen 2 weken* loopt van 7 tot en met 20 mei.

*Hele project* neemt de planning van de eerste start tot het laatste einde.

### 4. Of kies Aangepast

Bij *Aangepast* worden *Van* en *Tot* twee datumvelden. Ze beginnen met de datums van de keuze die je net had. Vul beide in, bijvoorbeeld 1 en 14 juni. Klopt de invoer niet, dan blijft het rapport staan op de laatste geldige periode en staat er in het rood:

- *De einddatum ligt vóór de begindatum.* als *Tot* eerder is dan *Van*.
- *Vul beide datums in.* als een van de twee leeg is.

### 5. Lees de periode af in het rapport

Bij de Look-ahead, de Resourcebelasting en de Resourcetoewijzingen staat de periode onder de titel, bijvoorbeeld *Periode: 20-05-2027 – 19-06-2027*. Kies je *Hele project*, dan staat er ook *Hele project* achter. Het Voortgangsrapport toont de periode in het overzicht bij *Periode*. Het Resourcediagram laat de tijdas exact over de periode lopen.

### Wat de periode per rapport doet

De periode werkt niet in elk rapport hetzelfde.

- **Look-ahead** neemt de niet-voltooide activiteiten die de periode raken, ook als ze de periode helemaal overspannen. Achterstallige activiteiten van vóór de referentiedag staan er ook in, zolang het einde van de periode niet vóór de referentiedag ligt. Een aangepaste periode helemaal in het verleden is een terugblik: daar staat alleen wat toen liep en nog niet klaar is, zonder de achterstand van vandaag.
- **Voortgangsrapport** gebruikt de periode voor *Voltooid in de afgelopen periode*. De sectie *Start in de komende periode* kijkt vanaf de statusdatum vooruit, tot de datum bij *Vooruitblik t/m* in het overzicht. Kies je een *Afgelopen*-periode, dan kijkt het rapport even ver vooruit als het terugkijkt: bij *Afgelopen 2 weken* met statusdatum 20 mei staat er *Vooruitblik t/m* 3 juni. Een aangepaste periode of *Hele project* die helemaal in het verleden ligt, wordt niet gespiegeld.
- **Resourcebelasting** toont elke week of maand die de periode raakt, in zijn geheel. Loopt je periode van woensdag tot woensdag, dan zie je dus hele weken, zodat een rij altijd hetzelfde getal toont als het histogram.
- **Resourcetoewijzingen** toont de toewijzingen van activiteiten die de periode raken. Bij *Hele project* wordt er niet op datum gefilterd.
- **Resourcediagram** toont alleen de taken die de periode raken. In het overzicht telt *Buiten de periode:* hoeveel taken zijn weggelaten.

## Valkuilen en wat de app dan doet

**Er is geen statusdatum.** De app rekent dan met vandaag. Bij de vier tabelrapporten met een periode (*Look-ahead*, *Voortgangsrapport*, *Resourcebelasting* en *Resourcetoewijzingen*) staat bij een relatieve periode bovenaan *Geen statusdatum ingesteld — het rapport rekent met vandaag (29-09-2026).*, met je eigen datum van vandaag. Het Resourcediagram meldt dit niet. Kijk dus naar *Van* en *Tot*: die staan dan rond vandaag, niet rond je planning.

**De periode ligt buiten je planning.** Dan is het rapport leeg. Het Resourcediagram zegt dat met *Geen taken in de rapportageperiode — kies een andere periode of Hele project.* Bij de andere rapporten zie je nul activiteiten of geen regels.

**De datums staan in je eigen notatie.** *Van* en *Tot* volgen de datumnotatie uit je instellingen, behalve in de datumvelden van *Aangepast*: die tonen de notatie van je browser.

**De periode schuift mee.** Een relatieve keuze zoals *Volgende maand* wordt telkens opnieuw bepaald: verandert de statusdatum, of is het zonder statusdatum een dag later, dan schuift de periode direct mee. Wil je een vaste periode, kies dan *Aangepast*.

**De keuze geldt voor al je projecten.** Ook een aangepaste periode geldt voor al je projecten op dit apparaat, niet alleen voor het geopende project.

## Zie ook

- [Een rapport maken en afdrukken](docs://howto-rapport-maken-en-afdrukken): het hele traject van rapporttype tot PDF.
- [Voortgang, statusdatum en baseline](docs://uitleg-voortgang): wat de statusdatum is en waarom de app ermee rekent.
- [Overbezetting oplossen](docs://howto-overbezetting-oplossen): wat je doet met de overbelaste weken uit de Resourcebelasting.
- [Rapporttypes](docs://ref-rapporttypes): alle rapporttypes en hun opties.

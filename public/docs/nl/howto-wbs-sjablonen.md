# WBS-sjablonen bewaren en invoegen

Doel: een fase met haar subtaken en onderlinge relaties bewaren als sjabloon, en die later in hetzelfde of een ander project weer invoegen.

## Wanneer je dit nodig hebt

Je plant steeds dezelfde soort werk: elke woning heeft een fundering met grondwerk, wapening, storten en uitharden. In plaats van die taken telkens opnieuw aan te maken en aan elkaar te koppelen, bewaar je de fase één keer als **sjabloon**. Een sjabloon is een tak van je WBS: één taak met alles wat eronder hangt.

## Stappen

### Een tak als sjabloon bewaren

1. Bouw de tak zoals je hem wilt hergebruiken: een samenvattingstaak met subtaken en de relaties daartussen.
2. Klik met de rechtermuisknop op die samenvattingstaak en kies *Bewaar tak als sjabloon*. Dit menu-item staat alleen bij taken met subtaken.

De app meldt *Tak bewaard als sjabloon 'Fundering'*. De app vraagt niet om een naam: het sjabloon heet zoals de bovenste taak van de tak.

### Een sjabloon invoegen

1. Selecteer de taak waaronder het sjabloon moet komen, of selecteer niets.
2. Kies *Planning › Structuur › Sjablonen*. In de lijst staat per sjabloon de naam en bijvoorbeeld *4 taken, 2 relaties*.
3. Klik op het sjabloon.

Is er een taak geselecteerd, dan komt het sjabloon als laatste subtaak onder die taak. Die taak wordt daardoor een samenvattingstaak. Zijn er meer taken geselecteerd, dan telt de eerst aangeklikte. Is er niets geselecteerd, dan komt de tak onderaan de lijst, op het hoogste niveau. De ingevoegde tak is daarna geselecteerd.

Alle ingevoegde taken staan op de projectstart en de planning is verouderd. Druk op **Bereken** (F5), bijvoorbeeld via *Start › Planning › Bereken*, en de datums volgen uit de relaties. Het invoegen is één stap voor *Ongedaan*. Een sjabloon bewaren of verwijderen valt daar niet onder.

### Een sjabloon verwijderen

Open *Planning › Structuur › Sjablonen* en klik op het prullenbakje rechts naast het sjabloon (*Sjabloon verwijderen*). De app vraagt niet om bevestiging.

### Wat er in een sjabloon zit

Een sjabloon bewaart per taak de naam, de omschrijving, het taaktype, of het een mijlpaal is, en de duur in dagen. Van de relaties bewaart hij die tussen twee taken binnen de tak, met type en lag.

Al het andere gaat niet mee: datums, voortgang en werkelijke datums, resource-toewijzingen, codes en eigen velden (zie [Codes en eigen velden](docs://howto-codes-en-velden)), de kalender, constraints en deadlines, de prioriteit, een eigen taaktype, bij een mijlpaal het soort en het vinkje *Verplicht (contractueel)*, en relaties met taken buiten de tak. Na het invoegen vul je die opnieuw in: toewijzingen, codes, kalender en constraints staan leeg, en alle taken beginnen op de projectstart.

Een taak die in uren stond, komt als dagtaak terug, met haar duur omgerekend naar een breuk van een werkdag. Een taak van 5 uur bij een werkdag van 8 uur wordt 0,625 dag.

## Valkuilen en wat de app dan doet

**Sjablonen horen niet bij het project.** De app bewaart ze in de opslag van de app op dit apparaat, niet in het projectbestand. Een collega die jouw bestand opent, ziet je sjablonen niet. In de browserversie hoort een sjabloon bij die browser. Bewaar je sjablonen dus ook op een andere plek als ze belangrijk zijn: zet ze in een project dat je als bestand bewaart.

**Dezelfde naam kan vaker voorkomen.** Bewaar je de tak twee keer, dan staan er twee sjablonen met dezelfde naam in de lijst. De app overschrijft niets.

**De duur van de bovenste taak telt niet mee.** Een samenvattingstaak krijgt haar duur uit haar subtaken, zodra je Bereken gebruikt.

**Een taak met resource-toewijzingen als doel.** Selecteer je een taak met toewijzingen die nog geen subtaken heeft, en voeg je een sjabloon eronder in, dan weigert de app dat. De taak zou een samenvattingstaak worden en die draagt geen toewijzingen. De bovenste taak van een sjabloon heeft zelf subtaken, dus de toewijzingen kunnen nergens heen. De app meldt dat en verandert niets. Kies dan een andere taak, of niets, als plek. Een mijlpaal die een sjabloon krijgt, verliest haar mijlpaalmarkering, met een melding.

**Een ongeldige relatie in het sjabloon.** Is een relatie in het sjabloon niet toegestaan, bijvoorbeeld een taak aan zijn eigen fase, of bestaat hij al, dan slaat de app hem over en meldt hoeveel relaties zijn overgeslagen.

## Zie ook

- [Structuur aanpassen](docs://howto-structuur-aanpassen): de ingevoegde tak verplaatsen of laten inspringen.
- [Relaties leggen](docs://howto-relaties-leggen): relaties in een tak zelf aanmaken voordat je hem bewaart.
- [Kritiek pad en speling](docs://uitleg-kritiek-pad): wat er na Bereken met de ingevoegde tak gebeurt.

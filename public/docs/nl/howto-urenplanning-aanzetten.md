# Urenplanning aanzetten

Doel: taken plannen in werkuren, naast taken in dagen.

## Wanneer je dit nodig hebt

Een kraan huur je per uur, niet per dag. Een stort van zes uur past niet in een hele werkdag. Een nachtploeg werkt op andere tijden dan de dagploeg. Voor zulk werk wil je een duur in uren en een start en einde met een kloktijd. Ook als je een bestand opent en de app meldt *Dit bestand bevat urenplanning.*, zet je dit aan. Waarom de app dagen en uren anders telt, lees je in [Dagen en uren](docs://uitleg-dagen-en-uren).

## Stappen

### Urenplanning inschakelen

1. Kies *Instellingen › Project › Instellingen* en open het tabblad *Planning*.
2. Zet onder *Urenplanning* het vinkje bij *Urenplanning inschakelen* aan. Het werkt meteen. In de melding *Dit bestand bevat urenplanning.* doet de knop *Urenplanning aanzetten* hetzelfde.
3. Daaronder staat *Gemengde dag/uur-planning toestaan*, standaard aan. Met die instelling kies je per taak of hij in dagen of uren telt. Zet je hem uit, dan verdwijnt de keuzelijst *Duureenheid*. Je kunt dan nog wel een duur met een eenheid typen, zoals `12h`.

Daarmee verandert er meer dan alleen de duur van een taak: onder *Beeld › Tijdschaal* kun je de schaal *Uur* kiezen, het venster *Kalenders* krijgt het blok *Werktijden*, en het venster *Nieuw project* krijgt de keuzes *Ploeg* en *Standaardeenheid voor nieuwe taken*.

### Een taak in uren plannen

1. Selecteer de taak en kijk in het paneel *Eigenschappen* bij *Tijd* naar het veld *Duur*.
2. Typ de duur met een eenheid en druk op Enter: `12h` (of `12u`) voor twaalf uur, `1h 30m` voor anderhalf uur. Ook `1.5h` mag. Een getal zonder eenheid telt in de eenheid die de taak al heeft.
3. Wil je een bestaande taak omzetten, kies dan bij *Duureenheid* de eenheid *Uren*. De app rekent de duur voor je om en stelt die voor, bijvoorbeeld *Exact omzetvoorstel: 16h. Pas dit voorstel toe of behoud de huidige eenheid.* Kies *Voorstel toepassen* of *Behouden*.
4. Terug naar dagen kan met `2d` of met de eenheid *Dagen*.
5. Druk op **Bereken** (F5), bijvoorbeeld via *Start › Planning › Bereken*. De taak heeft nu een start en einde met een kloktijd.
6. Wil je de uren in de Gantt zien, kies dan in de keuzelijst bij *Beeld › Tijdschaal* de schaal *Uur*.

### Nieuwe taken standaard in uren

1. Kies *Instellingen › Project › Projectinfo*.
2. Kies bij *Standaardeenheid voor nieuwe taken* de eenheid *Uren* en klik op *Toepassen*.

Een nieuwe taak begint dan met 5 uur in plaats van 5 dagen. Bestaande taken veranderen niet. Bij een nieuw project staat dezelfde keuze in het venster *Nieuw project*. Kies je daar bij *Ploeg* voor *Dagdienst*, dan is *Uren* uitgeschakeld. Kies een andere ploeg, of zet de standaardeenheid na het aanmaken in *Projectinfo*.

## Valkuilen en wat de app dan doet

**Geen geldige werktijden.** Heeft de kalender van de taak geen bruikbare werktijden, dan meldt de app *Deze kalender heeft geen geldige werktijden. Controleer de werkdagen en werktijden.* Bij het doorrekenen kan de melding *Urentaak 'naam' heeft geen geldige werktijden in zijn kalender* komen.

**Geen decimalen bij dagen.** Een duur in dagen is een geheel getal. `1.5d` geeft de melding *Voer een geheel aantal dagen of uren in, bijvoorbeeld 2d of 12h.* Wil je anderhalve dag, reken dan in uren.

**Een omzetting die niet exact kan.** Twaalf uur past niet in hele dagen van 8 uur. De app meldt dan *Deze duur kan op de huidige kalender niet exact naar gehele dagen worden omgezet. De bestaande eenheid blijft behouden; voer zelf een nieuwe geldige waarde in.* en laat de eenheid staan.

**Het veld is uitgeschakeld.** Bij een fase, een hammock of een mijlpaal met nul duur volgt de duur uit iets anders, en kun je hem niet typen.

**Urenplanning weer uitzetten.** Taken in uren blijven bestaan en rekenen mee. Hun duur is dan niet te bewerken; het veld meldt *Schakel urenplanning in om deze urentaak te bewerken.*, met een knop om het weer aan te zetten.

## Zie ook

- [Dagen en uren](docs://uitleg-dagen-en-uren): hoe de app uren telt, wat er gebeurt als dagen en uren samenkomen en waar hij afrondt.
- [Werktijden instellen](docs://howto-werktijden-instellen): de tijden van een kalender per weekdag.
- [Relaties leggen](docs://howto-relaties-leggen): een lag in uren tussen twee taken.
- [Instellingen](docs://ref-instellingen): de instelling Urenplanning inschakelen en wat hij verder verandert.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): bevat taken in uren (vlechtwerk en storten) met een eigen urenkalender, *Hourly calendar, rebar fixing & pouring*.

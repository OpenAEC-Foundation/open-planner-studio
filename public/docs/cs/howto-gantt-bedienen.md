# Tažení, posouvání a přiblížení v Gantt

Cíl: ovládat časovou osu myší: přesunout pruh nebo upravit jeho dobu trvání, posunout časovou osu, vybrat úkoly rámečkem a přiblížit nebo oddálit.

## Kdy to potřebujete

V Gantt vidíte, že zdivo musí začít o dva dny později, nebo že betonáž trvá o den déle. Chcete to upravit přímo na pruhu. Nebo máte projekt na několik měsíců a chcete rychle přejet ke stavební dovolené. Myš na to má několik gest. Které gesto co dělá, závisí na tom, kde začnete tahat, a na vašem nastavení posouvání.

## Postup

### Přesun pruhu

1. Stiskněte střed pruhu úkolu a táhněte vodorovně. Začátek a dokončení se posunou společně, po celých dnech. Doba trvání zůstane stejná.
2. Pusťte tlačítko myši. Pruh zůstane na novém místě. Plán pak není aktuální: stiskněte *Přepočítat* (F5), nebo nechte aplikaci přepočítat sama, pokud je zapnuté *Automaticky přepočítat*.

Pokud úkol má předchůdce, aplikace uloží nový začátek jako omezení *Zahájit nejdříve (SNET)* a po uvolnění tlačítka myši to oznámí. Proč tomu tak je a co se stane s jiným omezením, je popsáno v [Omezení a konečné termíny](docs://uitleg-constraints). Když přetáhnete zpět na původní začátek, vrátí se i původní omezení.

Když táhnete hlavně nahoru nebo dolů místo do strany, přesunete úkol na jiný řádek a data zůstanou. Směr, který zvolíte v prvních pixelech, platí pro celé tažení. Jedno gesto tak nikdy nemění data a strukturu současně. Viz [Úprava struktury](docs://howto-structuur-aanpassen).

### Úprava doby trvání

1. Přesuňte myš na pravý okraj pruhu. Kurzor se změní na šipku ukazující doleva a doprava.
2. Táhněte okrajem. Během tažení ukazuje malý štítek ve zvýrazňovací barvě motivu (výchozí je oranžová) dobu trvání, kterou by úkol nyní dostal, například *4d*. Štítek se průběžně aktualizuje, takže novou dobu trvání vidíte ještě před uvolněním tlačítka myši. Na pravém okraji je štítek uvnitř pruhu, na levém okraji těsně vlevo od něj. Štítek ukazuje dobu trvání stejně, jako ji ukazuje sloupec doby trvání.
3. Pusťte tlačítko myši. Doba trvání je ta, kterou ukazoval štítek.

Levý okraj posouvá začátek a dokončení nechává, takže úkol se zkrátí nebo prodlouží na začátku. Pro něj platí stejné pravidlo SNET jako při přesunu. Když táhnete za střed pruhu, štítek se nezobrazí: doba trvání se nemění.

Doba trvání se počítá v pracovních dnech kalendáře úkolu. Víkendy a dny volna se nepočítají. Úkol v dnech nemůže být kratší než jeden pracovní den. U úkolu v hodinách aplikace zaokrouhluje na krok časové osy pod myší: nejméně na hodinu, nebo na čtvrthodinu, pokud přiblížíte dostatečně a je zapnuté *Zobrazit čtvrthodiny při větším přiblížení*.

V příkazu *Vrátit zpět* je jedno tažení jeden krok, bez ohledu na délku tažení. U rozděleného pruhu fungují okraje jinak; viz [Rozdělení úkolu](docs://howto-taak-splitsen).

### Posun časové osy

Co udělá tažení po prázdném pozadí, závisí na režimu posouvání. Zvolíte ho v *Nastavení*, na kartě *Zobrazení*, v nabídce *Gantt › Posouvání a zoom*, v poli *Režim*:

- **Zoom + tažení** (výchozí): když táhnete po prázdném pozadí levým tlačítkem myši, časová osa se pohybuje s myší jako mapa. Kurzor má podobu ruky. Na pruhu tažení jednoduše spustí gesto s pruhem.
- **Pozice** a **Klávesy**: stejné tažení vytvoří výběrový rámeček. Časovou osu posunete kolečkem (viz [Nastavení](docs://ref-instellingen)) nebo prostředním tlačítkem myši.

**Prostřední tlačítko myši** (stisknuté kolečko) posouvá časovou osu v každém režimu, a to i když začnete na pruhu. Nefunguje, když probíhá jiné gesto, například tažení pruhu.

### Výběr úkolů rámečkem

Rámeček vybere všechny úkoly v řádcích, kterých se dotýká. Počítá se jen výška rámečku, ne časová osa.

1. Začněte na prázdném pozadí. U *Zoom + tažení* při tom držte Ctrl (⌘ na Macu); u *Pozice* a *Klávesy* to není potřeba.
2. Táhněte přes řádky, které chcete vybrat. Výběr dostane rámeček.
3. Pusťte tlačítko myši. Klávesou Esc během tažení rámeček zrušíte a výběr zůstane, jaký byl.

Více o výběru je v [Výběr, odstranění a vrácení úkolů](docs://howto-taken-selecteren-verwijderen). Na prázdném místě v samotné tabulce úkolů tažení nic nedělá.

### Přiblížení a oddálení

1. Použijte *Zoom +* a *Zoom -* (*Zahájení › Zoom*), nebo klávesy + a -. Kolečko přibližuje také; kdy to dělá, závisí na režimu posouvání (viz [Nastavení](docs://ref-instellingen)).
2. Pokud chcete vidět celý projekt, zvolte *Zobrazení › Časová osa › Přizpůsobit projektu* nebo stiskněte Ctrl+0. *Obnovit* (na kartě *Zobrazení*) nebo klávesa 0 nastaví přiblížení zpět na výchozí hodnotu.
3. V pravém dolním rohu stavového řádku je přiblížení v pixelech na den, například *Přiblížení: 15 px/den*.

Čím dále oddalujete, tím méně mřížkových čar je vidět. Při 8 pixelech na den nebo více je čára pro každý den, s tlustší čarou na hranici týdne. Mezi 2 a 8 pixely na den zůstane jen hranice týdne. Pod 2 pixely na den, na úrovni roku, zůstanou jen hranice měsíců. Jinak by plátno bylo jen rovnoměrný pruhovaný vzor, ve kterém by pruhy úkolů zmizely. Šedé víkendy a dny volna a střídavě podbarvené pásy týdnů zůstávají na každé úrovni; nesou strukturu týdnů, když čáry vypadnou. V záhlaví časové osy se čísla týdnů a čísla dnů zobrazí jen tehdy, je-li pro ně místo, a od 40 pixelů na den se před číslo dne zobrazuje i den v týdnu.

## Časté problémy a co aplikace potom dělá

**Začátek se nepřesune.** Když úkol má předchůdce a omezení jiné než SNET, například *Co nejpozději (ALAP)*, aplikace přetažený začátek neuplatní. Po uvolnění tlačítka myši aplikace napíše, které omezení začátek zadržuje. Změňte to omezení, aby se začátek přesunul. Pravý okraj funguje, protože mění jen dobu trvání.

**Gesto dělá něco jiného.** V režimu závislostí a v režimu rozděleného úkolu dělají gesta s pruhem něco jiného. Klávesou Esc tyto režimy ukončíte. Když při tažení z pruhu podržíte Shift, vytvoříte závislost místo přesunu pruhu. Viz [Přidávání závislostí](docs://howto-relaties-leggen).

**V režimu *Pozice* nebo *Klávesy* levé tlačítko myši neposouvá.** Místo ruky uvidíte běžný kurzor. Použijte kolečko nebo prostřední tlačítko myši, nebo nastavte režim na *Zoom + tažení*.

**Klik v mezeře rozděleného pruhu** vybere úkol a nespustí tažení ani výběrový rámeček.

## Viz také

- [Nabídky pravého tlačítka](docs://ref-contextmenus): nabídky na pruhu, na řádku a na záhlaví skupiny.
- [Klávesové zkratky](docs://ref-sneltoetsen): klávesy pro přiblížení a pro zrušení gesta.
- [Nastavení](docs://ref-instellingen): režim posouvání a časová osa.
- [Omezení a konečné termíny](docs://uitleg-constraints): proč se přesunutý začátek stane omezením.

# Použitie rozdeleného zobrazenia a mini-mapy

Cieľ: vidieť dva úseky časovej osi vedľa seba a rýchlo sa pohybovať dlhým plánom.

## Kedy to potrebujete

Pracujete na začiatku základov a zároveň na odovzdaní o deväť mesiacov neskôr. Bez pomoci stále priblížite a oddialite a stratíte prehľad o tom, kde ste boli. Pri **rozdelenom zobrazení** vidíte ten istý plán dvakrát vedľa seba, každý s vlastným časovým oknom. Pri **mini-mape** vidíte celé obdobie projektu v jednom úzkom prúžku a kliknutím skočíte na časť, ktorú hľadáte.

## Postup

### Zapnutie rozdeleného zobrazenia

1. Vyberte kartu *Zobrazenie*. V skupine *Prezentácia* sú *Prezentácia*, *Rozdelené zobrazenie* a *Mini-mapa*.
2. Kliknite na *Rozdelené zobrazenie*. Gantt sa rozdelí na dve časti. Obe okná začnú s priblížením a polohou vášho aktuálneho zobrazenia.

Obe okná zdieľajú tabuľku úloh, riadky a vertikálne posúvanie. Každé okno má vlastnú časovú škálu: priblíženie a vodorovnú polohu.

### Každé okno s vlastným úsekom času

- Priblížte a posúvajte v okne, nad ktorým je myš. Pri predvolenom nastavení *Posúvanie a zoom* (*Zoom + ťahanie*) koliesko myši priblíži v tom okne, s centrom v mieste myši. Ak vaše nastavenie používa iný režim, koliesko urobí v oboch oknách to, čo hovorí tento režim.
- Pri predvolenom nastavení posúvate riadky klávesou Shift a kolieskom myši. Platí to pre obe okná naraz.
- Tlačidlá *Priblížiť +* a *Oddialiť -* a zoznam časovej škály (napríklad *Štvrťrok*) fungujú iba v ľavom okne. Preto pravé okno priblížte kolieskom myši.
- Potiahnite deliacu lištu medzi oboma oknami doľava alebo doprava, aby boli širšie alebo užšie. Na začiatku má každé okno polovicu šírky.

### Vypnutie rozdeleného zobrazenia

Znova kliknite na *Rozdelené zobrazenie*. Zostane jedno okno so zobrazením ľavého okna. Pri ďalšom zapnutí sa rozdelené zobrazenie spustí so zobrazením z toho okamihu.

### Zapnutie mini-mapy

1. V skupine *Prezentácia* kliknite na tlačidlo *Mini-mapa*.
2. Pod časovou osou sa objaví prúžok celého obdobia projektu. Úlohy vášho aktuálneho zobrazenia sú na ňom ako tenké čiarky (teda po filtri len úlohy, ktoré filter ukazuje). Okolo časti, ktorú teraz vidíte, je rámik.
3. Kliknite kdekoľvek na prúžok, aby sa rámik presunul tam. Okno sa vycentruje na toto miesto. Alebo uchopte rámik a potiahnite ho.

Mini-mapa iba posúva časové okno. Riadky ostanú, aké sú.

Ak je zapnuté rozdelené zobrazenie, každé okno dostane vlastný prúžok pod svojou časťou časovej osi. Každý prúžok ovláda iba okno nad sebou.

## Časté problémy a čo robí aplikácia

**Mini-mapa nerobí nič, ak je už vidieť celý projekt.** Ak oddialite tak ďaleko, že sa celý plán zmestí, nie je kam sa posunúť a kliknutie nemá žiadny účinok. Najprv priblížte.

**Mini-mapa je len v zobrazení Gantt.** Na kartách *Tabuľka*, *IFC* a *Zostava* a v úplnom paneli zdrojov (*Zdroje*, nie *Ukotvený panel zdrojov*) nie je časová os, takže nie je ani mini-mapa, ani rozdelené zobrazenie. Vrátia sa, hneď ako sa vrátite do zobrazenia Gantt.

**Rozdelené zobrazenie patrí k projektu, mini-mapa nie.** Rozdelené zobrazenie platí pre otvorený projekt. Ak prepnete na iný projekt a späť, je stále zapnuté. Mini-mapa je jedna voľba pre všetky projekty a po reštarte zostane zapnutá alebo vypnutá. Obe sú nastavenia obrazovky: nezapisujú sa do súboru projektu, neoznačia projekt ako „zmenený“ a nie sú súčasťou histórie príkazu *Vrátiť späť*.

**Rozdelené zobrazenie a prezentácia.** Obe zostanú zachované, keď zapnete režim prezentácie (pozri [Prezentovanie na veľkej obrazovke](docs://howto-presentatie)). Keďže pás s nástrojmi potom zmizne, v tomto režime ich už nemôžete zapnúť ani vypnúť. Preto ich nastavte správne skôr, ako začnete.

## Pozri aj

- [Prezentovanie na veľkej obrazovke](docs://howto-presentatie): zobrazenie Gantt na celú obrazovku, bez pásu s nástrojmi.
- [Vytváranie a používanie rozloženia](docs://howto-layouts-gebruiken): časovú škálu možno uložiť aj ako súčasť rozloženia.

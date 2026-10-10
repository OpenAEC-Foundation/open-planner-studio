# Ukladanie a vkladanie šablón WBS

Cieľ: uložiť fázu s jej čiastkovými úlohami a ich závislosťami ako šablónu a neskôr ju znova vložiť do rovnakého alebo iného projektu.

## Kedy to potrebujete

Stále plánujete rovnaký druh činností: každý dom má základy zo zemnými prácami, výstužou, betónovaním a vytvrdzovaním. Namiesto toho, aby ste tieto úlohy znova vytvárali a prepojili, uložte fázu raz ako **šablónu**. Šablóna je vetva vašej WBS: jedna úloha so všetkým, čo je pod ňou.

## Kroky

### Uloženie vetvy ako šablóny

1. Zostavte vetvu tak, ako ju chcete znova použiť: súhrnnú úlohu s čiastkovými úlohami a závislosťami medzi nimi.
2. Kliknite pravým tlačidlom na túto súhrnnú úlohu a vyberte *Uložiť vetvu ako šablónu*. Táto položka ponuky sa zobrazí len pri úlohách s čiastkovými úlohami.

Aplikácia zobrazí hlásenie *Vetva uložená ako šablóna „Foundation“*. Aplikácia nepýta názov: šablóna sa pomenuje podľa najvyššej úlohy vetvy.

### Vloženie šablóny

1. Vyberte úlohu, pod ktorú má šablóna patriť, alebo nevyberajte nič.
2. Vyberte *Plán › Štruktúra › Šablóny*. Zoznam zobrazuje názov každej šablóny a napríklad *Úlohy: 4, závislosti: 2*.
3. Kliknite na šablónu.

Ak je vybraná úloha, šablóna sa vloží ako posledná čiastková úloha pod túto úlohu. Táto úloha sa tým stane súhrnnou úlohou. Ak je vybraných viac úloh, rozhoduje prvá úloha, na ktorú ste klikli. Ak nie je vybraná žiadna úloha, vetva sa vloží na koniec zoznamu, na najvyššiu úroveň. Vložená vetva zostane potom vybratá.

Všetky vložené úlohy začínajú dňom začiatku projektu a plán je zastaraný. Stlačte **Prepočítať** (F5), napríklad cez *Domov › Plán › Prepočítať*, a dátumy sa podľa závislostí určia. Vloženie sa dá vrátiť jedným krokom pomocou *Vrátiť späť*. Uloženie alebo odstránenie šablóny k tomu nepatrí.

### Odstránenie šablóny

Otvorte *Plán › Štruktúra › Šablóny* a kliknite na malý kôš vpravo od šablóny (*Odstrániť šablónu*). Aplikácia nepýta potvrdenie.

### Čo je v šablóne

Šablóna si pre každú úlohu ponechá názov, popis, typ úlohy, to, či je medzníkom, a trvanie v dňoch. Zo závislostí si ponechá len tie medzi dvomi úlohami vo vetve, spolu s typom a oneskorením.

Všetko ostatné sa do šablóny neuloží: dátumy, postup a skutočné dátumy, priradenia zdrojov, kódy a vlastné polia (pozri [Kódy a vlastné polia](docs://howto-codes-en-velden)), kalendár, obmedzenia a termíny, priorita, vlastný typ úlohy, pri medzníku druh a zaškrtnutie *Povinný (zmluvný)*, a závislosti na úlohách mimo vetvy. Po vložení ich doplníte znova: priradenia, kódy, kalendár a obmedzenia sú prázdne a všetky úlohy začínajú dňom začiatku projektu.

Úloha, ktorá mala trvanie v hodinách, sa vráti ako úloha v dňoch a jej trvanie sa prevedie na zlomok pracovného dňa. Úloha s trvaním 5 hodín pri dĺžke pracovného dňa 8 hodín sa zmení na 0,625 dňa.

## Úskalia a čo aplikácia robí

**Šablóny nepatria k projektu.** Aplikácia ich ukladá do úložiska aplikácie na tomto zariadení, nie do súboru projektu. Kolega, ktorý otvorí váš súbor, vaše šablóny nevidí. V prehliadačovej verzii patrí šablóna k tomuto prehliadaču. Ak sú šablóny dôležité, uložte ich aj inde: vložte ich do projektu, ktorý uložíte ako súbor.

**Rovnaký názov sa môže vyskytnúť viackrát.** Ak vetvu uložíte dvakrát, zoznam obsahuje dve šablóny s rovnakým názvom. Aplikácia nič neprepíše.

**Trvanie najvyššej úlohy sa nepočíta.** Súhrnná úloha dostane trvanie zo svojich čiastkových úloh hneď, ako použijete Prepočítať.

**Úloha s priradeniami zdrojov ako cieľ.** Ak vyberiete úlohu s priradeniami zdrojov, ktorá ešte nemá čiastkové úlohy, a vložíte pod ňu šablónu, aplikácia to odmietne. Úloha by sa stala súhrnnou úlohou, a súhrnná úloha žiadne priradenia nenesie. Najvyššia úloha šablóny už má vlastné čiastkové úlohy, takže pre priradenia nie je miesto. Aplikácia vás na to upozorní a nič nezmení. Potom vyberte ako miesto inú úlohu alebo žiadnu. Medzník, pod ktorý sa šablóna vloží, stratí príznak medzníka a aplikácia o tom zobrazí správu.

**Neplatná závislosť v šablóne.** Ak závislosť v šablóne nie je povolená, napríklad závislosť medzi úlohou a jej vlastnou fázou, alebo už existuje, aplikácia ju preskočí a oznámi, koľko závislostí preskočila.

## Pozri aj

- [Úprava štruktúry](docs://howto-structuur-aanpassen): presunúť alebo znížiť úroveň vloženej vetvy.
- [Pridávanie závislostí](docs://howto-relaties-leggen): vytvoriť závislosti vo vetve sami ešte pred jej uložením.
- [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad): čo sa s vloženou vetvou stane po príkaze Prepočítať.

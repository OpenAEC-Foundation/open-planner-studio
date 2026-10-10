# Vytvorenie a priradenie kalendára

Cieľ: vytvorte vlastný kalendár, napríklad šesťdňový pracovný týždeň, a priraďte ho úlohám, ktoré sa v ňom musia počítať.

## Kedy to potrebujete

Subdodávateľ pracuje aj v sobotu. Pracovná skupina pracuje iba od pondelka do štvrtka. Úloha spadá do časového úseku, v ktorom iba táto úloha stojí. Projektový kalendár potom má nesprávne pracovné dni. S vlastným kalendárom aplikácia počíta tieto úlohy v správnych dňoch a zvyšok zostáva na projektovom kalendári. Presne to, čo aplikácia s kalendárom robí, nájdete v článku [Kalendáre a pracovné dni](docs://uitleg-kalenders).

## Postup

### Vytvorenie kalendára

1. Vyberte *Plán › Kalendár › Kalendár*. Rovnaké tlačidlo je na *Nastavenia › Kalendár › Kalendár*. Otvorí sa okno *Kalendáre*. Vľavo sú kalendáre projektu. Projektový kalendár má hviezdičku.
2. Pod zoznamom kliknite na tlačidlo so znamienkom plus (*Nový kalendár*). Nový kalendár je kópia štandardu: pondelok až piatok, od 07:00 do 16:00, s hodinovou prestávkou. Ak je *Stavebný režim* zapnutý, nový kalendár obsahuje aj holandské štátne sviatky. Ak chcete ako základ použiť existujúci kalendár, vyberte ho v zozname a potom kliknite na tlačidlo s dvoma listami pod zoznamom (*Duplikovať*).
3. V poli *Názov* zadajte názov, ktorý ukáže, kto kalendár používa, napríklad *Six-day week*.
4. V poli *Pracovné dni* kliknutím zapnite alebo vypnite jednotlivé dni. *Po–Pi* obnoví štandardný týždeň, od 07:00 do 16:00. *Nepretržite (24/7)* zapne všetkých sedem dní, od 00:00 do 24:00.
5. Ak je to potrebné, upravte pracovný čas: *Začiatok (hodina)*, *Dokončenie (hodina)*, *Začiatok prestávky* a *Trvanie prestávky (minúty)*. Časy zadávajte vo formáte HH:MM. Šípkami ich zvýšite alebo znížite o štvrť hodiny. Ak nastavíte trvanie prestávky na 0, kalendár pracuje bez prestávky. *Čisté hodiny za deň* vypočíta aplikácia sama. Ak je zapnuté plánovanie v hodinách a kalendár má bloky pracovného času pre jednotlivé dni v týždni, tieto polia neuvidíte. Pozrite si [Nastavenie pracovného času](docs://howto-werktijden-instellen).
6. Ak je to potrebné, upravte sviatky. Ako to funguje, opisuje článok [Generovanie sviatkov a stavebnej dovolenky](docs://howto-feestdagen-genereren).
7. Kliknite na *Použiť*. Aplikácia hneď prepočíta plán a zatvorí okno. Tlačidlom *Zrušiť* zahodíte zmeny. Ak v poli potvrdíte hodnotu klávesom Enter, zmena sa medzitým uloží a plán sa tiež prepočíta. Okno sa pritom nezatvorí. *Zrušiť* potom vráti iba zmeny, ktoré ste urobili po tomto kroku.

### Priradenie kalendára úlohám

Nový kalendár sa uplatní až vtedy, keď ho nejaká úloha použije. Existujú dva spôsoby.

**Cez panel vlastností**

1. Vyberte úlohu. Ak nevidíte panel *Vlastnosti*, zapnite ho cez *Zobrazenie › Panely › Vlastnosti*.
2. V časti *Úloha* vyberte kalendár v zozname *Kalendár*. Prvá voľba, *Projektový kalendár* s názvom za ním, znamená, že úloha nemá vlastný kalendár.

**Cez kontextovú ponuku**

1. Kliknite pravým tlačidlom na úlohu v tabuľke úloh alebo na pruh v diagrame Gantt.
2. Vyberte *Priradiť kalendár* a potom kalendár. Alebo vyberte *Projektový kalendár*, ak chcete úlohe znova odobrať vlastný kalendár. Aktuálne platný kalendár má značku.
3. Ak chcete jeden kalendár priradiť viacerým úlohám naraz, najprv ich vyberte klávesom Ctrl (⌘ na Macu). Potom kliknite pravým tlačidlom na jednu z vybraných úloh. Voľba platí pre všetky vybrané úlohy. Ak kliknete pravým tlačidlom na úlohu, ktorá nie je vybratá, platí iba pre túto úlohu.

Nová voľba kalendára zatiaľ neaktualizuje plán: stavový riadok hlási *Zastaralé — prepočítajte (F5)*. Stlačte **Prepočítať** (F5), napríklad cez *Domov › Plán › Prepočítať*. Ak je zapnutý *Automatický prepočet* (*Nastavenia › Projekt › Nastavenia*, karta *Plán*, nadpis *Prepočítanie*), aplikácia to urobí sama.

### Prepnutie projektového kalendára

1. Otvorte *Plán › Kalendár › Kalendár* a v zozname vyberte kalendár.
2. Nad formulárom kliknite na *Nastaviť ako predvolený pre projekt*. Hviezdička sa presunie na tento kalendár.
3. Kliknite na *Použiť*.

Presunú sa iba úlohy bez vlastného kalendára.

### Odstránenie kalendára

1. Otvorte okno *Kalendáre* a v zozname vyberte kalendár.
2. Pod zoznamom kliknite na tlačidlo s košom (*Odstrániť*). Toto tlačidlo je neaktívne, kým existuje iba jeden kalendár.
3. Kliknite na *Použiť*. Úlohy a zdroje, ktoré kalendár používali, sa vrátia na projektový kalendár. Ak odstránite samotný projektový kalendár, prvý kalendár v zozname sa stane projektovým kalendárom.

## Úskalia a čo vtedy robí aplikácia

**Žiadne pracovné dni.** Ak vypnete všetky dni v týždni, aplikácia nedokáže plán vypočítať. Pri výpočte hlási *Kalendár nemá nastavené žiadne pracovné dni*.

**Neplatné údaje.** Prestávka mimo pracovného dňa, začiatok po konci alebo sviatok s nesprávnym dátumom: pri poli sa zobrazí červené chybové hlásenie. Tlačidlo *Použiť* je neaktívne, kým chybu neopravíte. Pri neplatnej prestávke alebo sviatku je v zozname aj výstražný znak vedľa kalendára (*Tento kalendár obsahuje neplatné údaje*).

**Kalendár na fáze.** Fáza sa vždy počíta na projektovom kalendári, pretože jej trvanie vyplýva z jej úloh. Kalendár priraďte samotným úlohám.

**Rovnaký kalendár, dve voľby.** V zozname sa projektový kalendár zobrazí dvakrát: ako *Projektový kalendár: názov* a ako bežný kalendár s týmto názvom. Ak zvolíte druhú možnosť, je to vlastná voľba pre túto úlohu. Úloha sa potom nepresunie, keď neskôr zvolíte iný projektový kalendár.

**Iný počet hodín za deň.** Ak zmeníte pracovný čas alebo prestávku tak, že sa zmenia *Čisté hodiny za deň* kalendára, úloha v dňoch má stále rovnaký počet dní. Pri úlohe so zdrojmi a pravidlom práce *Pevná práca* alebo *Pevné jednotky priradenia* sa trvanie zmení s ním, lebo práca zostáva rovnaká. Štyridsať hodín práce je 5 dní po 8 hodinách za deň a 7 dní po 6 hodinách za deň. Aplikácia hlási, koľkým úlohám sa zmenilo trvanie.

## Pozrite aj

- [Kalendáre a pracovné dni](docs://uitleg-kalenders): ako aplikácia počíta pracovné dni a ktorý kalendár má prednosť.
- [Dni a hodiny](docs://uitleg-dagen-en-uren): čo robia čisté hodiny za deň.
- [Nastavenie kalendára zdroja](docs://howto-resourcekalender-instellen): kalendár pre zdroj namiesto úlohy.
- [Okná kalendárov](docs://ref-kalenders): všetky polia okien kalendárov.

# Priradenie zdrojov s krivkou

Cieľ: priradiť zdroj k úlohe s jednotkami priradenia za deň a s krivkou, ktorá určuje, ako sa tieto jednotky rozložia na dni úlohy.

## Kedy to potrebujete

Ihneď, keď chcete vidieť, kto kde a kedy pracuje: murár na vonkajšej vrstve dutinovej steny, žeriav na dutinových stropných doskách. Bez priradenia nie je žiadne zaťaženie, a teda ani histogram ani preťaženie.

Dva pojmy. **Jednotky priradenia** (v aplikácii *Jedn./deň*) určujú, koľko zo zdroja pracuje na úlohe za pracovný deň: 1 je jeden murár, 2 sú dvaja, 0,5 je pol dňa. **Krivka** určuje, ako sa celkový súčin, jednotky priradenia krát trvanie, rozloží na pracovné dni úlohy. Práca býva zriedka rovnomerná: pri stene je na začiatku pokojno, v strede rušno a na konci zase pokojno.

Vonkajšia vrstva dutinovej steny zaberie 6 pracovných dní. S jedným murárom a krivkou *Rovnomerný* je to 1 jednotka priradenia na každý zo 6 dní, spolu 6 jednotiek priradenia. S krivkou *Zvonový tvar* je to stále spolu 6 jednotiek priradenia, ale rozloženie práce je 0, 1, 2, 2, 1 a 0.

## Postup

Zdroj môžete priradiť dvoma spôsobmi. Zdroj musí už existovať (pozri [Správa zdrojov](docs://howto-resources-beheren)).

### Cez pás s nástrojmi

1. Vyberte jednu úlohu v tabuľke úloh. Musí ísť o bežnú úlohu, nie o medzník a nie o fázu.
2. Vyberte *Zdroje › Priradenie › Priradiť ▾*.
3. V okne vyplňte pole *Jedn./deň* (predvolená hodnota 1) a vyberte pole *Krivka* (predvolená hodnota *Rovnomerný*). Tieto hodnoty platia pre zdroj, ktorý teraz vyberiete.
4. Kliknite na zdroj. Okno sa zatvorí a priradenie je vytvorené.

Pre druhý zdroj otvorte okno znova. Zdroje, ktoré sú na úlohe už priradené, v zozname nie sú.

### Cez panel vlastností

1. Vyberte úlohu. Panel *Vlastnosti* je vpravo; ak ho nevidíte, zapnite ho cez *Zobrazenie › Panely › Vlastnosti*.
2. V časti *Priradenia* úplne dole vyberte zdroj v poli *Priradiť zdroj*. Priradenie začína s jednotkami priradenia 1 a krivkou *Rovnomerný*.
3. Pri každom priradení zmeňte pole *Jedn./deň* a v poli *Krivka* vyberte inú krivku.

Takto zmeníte aj existujúce priradenie. Ikonou koša (*Odstrániť*) vedľa názvu odstránite priradenie z úlohy. Samotný zdroj zostane. Pomocou *Presunúť na…* presuniete priradenie na inú úlohu.

### Krivky

- *Rovnomerný*: každý deň rovnaké. Toto je predvolená hodnota a hodí sa na prácu, ktorá je každý deň rovnako náročná.
- *Zaťaženie vpredu*: začiatok je ťažší ako koniec. Hodí sa na prácu, ktorá začína náročným úsilím, napríklad vytyčovaním.
- *Zaťaženie vzadu*: koniec je ťažší ako začiatok. Hodí sa na prácu, ktorá sa ku koncu zrýchľuje.
- *Zvonový tvar*: vrchol v strede, s pokojným začiatkom a koncom. Hodí sa na stenu, ktorá sa začína pokojne, v strede je v plnom prúde a potom postupne doznieva.
- *Skorý vrchol*: vrchol pred stredom. Hodí sa na prácu, ktorá rýchlo naberie tempo.
- *Neskorý vrchol*: vrchol za stredom. Hodí sa na prácu, ktorej najintenzívnejšia časť príde až neskôr.
- *Dvojitý vrchol*: dva vrcholy. Hodí sa na prácu s dvoma rušnými momentmi.
- *Korytnačka*: pokojný začiatok a koniec so širokým vrcholom v strede. Hodí sa na dlhú prácu, ktorá sa postupne rozbehne a postupne utíchne.

Krivka mení len rozloženie práce. Trvanie, dátumy a celkový súčet zostávajú rovnaké. Potom nie je potrebné plán prepočítať. Histogram sa prispôsobí hneď. Ak ho chcete zobraziť, vyberte *Zdroje › Histogram › Histogram*. Ak vyberiete úlohu, histogram zobrazí len zaťaženie tejto úlohy.

## Úskalia a čo vtedy aplikácia urobí

**Krivka môže vrchol posunúť nad vaše jednotky priradenia.** Ak sú jednotky priradenia celé čísla, aplikácia zaokrúhli hodnotu za deň na celé jednotky a celkový súčet ostane rovnaký. Murár s jednotkami 1 na vonkajšej vrstve dutinovej steny a krivkou *Zvonový tvar* dá 0, 1, 2, 2, 1, 0. V dvoch stredných dňoch je to 2 jednotky priradenia, pričom hodnota v poli *Maximálny počet jednotiek* je 1. Histogram tie dni zafarbí načerveno a zdroj má preťaženie. Vyberte inú krivku alebo rozložte hodiny sami (pozri [Úprava hodinového rozloženia práce](docs://howto-urenverdeling-aanpassen)). Pri jednotkách ako 0,5 aplikácia zaokrúhli na stotiny. Pri krátkej úlohe s celými jednotkami je tvar preto hrubší: pri 10 dňoch dá *Korytnačka* s jednotkami 1 rozloženie 0, 1, 1, 2, 2, 1, 1, 1, 1, 0, presne rovnaké ako *Skorý vrchol*.

**Žiadne priradenie na medzník ani fázu.** Tlačidlo *Priradiť* je potom neaktívne a panel *Vlastnosti* hlási *Priradenia nie sú možné pri medzníkoch.* alebo *Priradenia nie sú možné pri súhrnných úlohách.*

**Zdroj iba raz na úlohe.** Ak je zdroj už na úlohe, v zozname už nie je. Ak sú už na úlohe všetky zdroje, aplikácia zobrazí *Všetky zdroje sú už priradené.* Ak zatiaľ nie je žiadny zdroj, zobrazí *Najprv vytvorte zdroje (karta Zdroje).*

**Jednotky priradenia musia byť väčšie ako 0.** Aplikácia neprijme hodnotu 0 alebo menej.

**Materiál.** Pri materiálovom zdroji sú jednotky priradenia množstvo za deň, v mernej jednotke zdroja, napríklad m³. Materiál sa nezapočítava do trvania úlohy.

**Pravidlo práce môže upraviť trvanie.** Ak má úloha typ *Pevná práca* alebo *Pevné jednotky priradenia*, druhý zdroj zmení trvanie úlohy. Plán je potom neaktuálny; stlačte **Prepočítať** (F5). Pozri [Pravidlá práce: trvanie, jednotky priradenia a práca](docs://uitleg-werkregels).

**Vlastné rozloženie práce.** Ak má priradenie už vlastné hodinové rozloženie, krivka je neaktívna a zobrazí *Rozvrh práce*. Najprv toto rozloženie uvoľnite cez *Upraviť rozloženie práce…*.

**Vrátenie zmien.** Vytvorenie, zmenu alebo odstránenie priradenia môžete vrátiť pomocou *Vrátiť späť* (Ctrl+Z).

## Pozri tiež

- [Úprava hodinového rozloženia práce](docs://howto-urenverdeling-aanpassen): ručné nastavenie hodín za deň.
- [Riešenie preťaženia](docs://howto-overbezetting-oplossen): čo robiť, keď má zdroj v jeden deň príliš veľa práce.
- [Pravidlá práce: trvanie, jednotky priradenia a práca](docs://uitleg-werkregels): čo sa stane s trvaním, keď zmeníte jednotky priradenia.
- [Panel zdrojov](docs://ref-resourcepaneel): všetky polia a tlačidlá v paneli zdrojov.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): všetkých päť typov zdrojov, všetkých šesť kriviek a vežový žeriav s krokom kapacity od 30. augusta 2027.

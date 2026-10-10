# Výber, odstránenie a vrátenie úloh späť

Cieľ: vybrať úlohy, odstrániť ich a zrušiť chybný krok.

## Kedy to potrebujete

Takmer každý úkon v pláne sa týka úloh, ktoré ste vybrali: odstrániť, kopírovať, znížiť úroveň, zapnúť alebo vypnúť medzník. Úlohy odstraňujete, keď práca odpadne alebo zmeníte plán. A keďže aplikácia pri odstraňovaní nežiada potvrdenie, *Vrátiť späť* je vaša bezpečnostná sieť.

## Kroky

### Výber úloh

- **Jedna úloha.** Kliknite na riadok v tabuľke úloh alebo na pruh v zobrazení Gantt.
- **Viac úloh.** Ctrl+kliknutie (⌘+kliknutie na Macu) pridá úlohu do výberu alebo ju z výberu odstráni. V tabuľke úloh Shift+kliknutie vyberie všetky úlohy od aktívnej úlohy po tú, na ktorú ste klikli.
- **Všetky viditeľné úlohy.** Ctrl+A, keď je fokus v tabuľke úloh alebo v zobrazení Gantt. Úlohy, ktoré skryje filter, do výberu nepatria. Rovnako nepatria do výberu čiastkové úlohy v zbalenej fáze.
- **Obdĺžnik v zobrazení Gantt.** Podržte Ctrl a ťahajte po prázdnom pozadí: vyberú sa všetky úlohy v riadkoch, ktorých sa obdĺžnik dotýka, aj keď ich pruh leží vedľa. Rozhoduje iba výška obdĺžnika, nie časová os. Ak uvoľníte Ctrl až po tlačidle myši, úlohy sa pridajú k existujúcemu výberu; inak ho nahradia. Bez Ctrl toto ťahanie v predvolenom nastavení posúva časovú os.
- **Nič.** Stlačte Esc alebo kliknite na prázdne pozadie zobrazenia Gantt.

Ak vyberiete súhrnnú úlohu, jej čiastkové úlohy sa s ňou nevyberú. Odstránenie a kopírovanie ich však zahŕňajú.

### Odstránenie úloh

Vyberte úlohy a zvoľte jeden z týchto spôsobov:

- *Domov › Úpravy › Odstrániť*. Rovnaké tlačidlo je na karte *Tabuľka*.
- Delete alebo Backspace, ak fokus nie je v tabuľke úloh. Najprv preto kliknite na pruh v zobrazení Gantt.
- *Odstrániť* v kontextovej ponuke (kliknutie pravým tlačidlom myši). Ak je úloha, na ktorú ste klikli, súčasťou výberu, príkaz platí pre celý výber. Inak platí iba pre túto jednu úlohu.
- Malý kôš v hornej časti panela *Vlastnosti* (popis po najazdení myšou *Odstrániť úlohu*). Ten odstráni úlohu, ktorú panel zobrazuje.

Aplikácia nežiada potvrdenie. Ak naraz odstránite viac úloh, je to pre *Vrátiť späť* jeden krok.

Spolu s nimi zmiznú: všetky čiastkové úlohy odstránenej súhrnnej úlohy, všetky závislosti z odstránených úloh a do nich a ich priradenia zdrojov. Ak odstránite poslednú čiastkovú úlohu súhrnnej úlohy, zostane ako bežná úloha. Ak je zapnuté *WBS automaticky*, aplikácia prečísluje strom. Plán potom nie je aktuálny: stlačte **Prepočítať** (F5), pokiaľ nie je zapnutý *Automatický prepočet*.

### Zbalenie a rozbalenie

Súhrnná úloha má pred svojím názvom v tabuľke úloh trojuholník. Kliknutím na ňu skryjete alebo zobrazíte jej čiastkové úlohy. Pomocou *Zobrazenie › Prehľad › Zbaliť* a *Rozbaliť* to urobíte pre vybrané súhrnné úlohy, alebo pre všetky, ak nie je nič vybraté. Kontextová ponuka súhrnnej úlohy má tiež *Zbaliť* a *Rozbaliť*. V zoskupenom zobrazení tlačidlá pôsobia na skupiny.

Aplikácia uchováva zbalenie a rozbalenie zvlášť pre každý otvorený dokument. Nie je súčasťou *Vrátiť späť* a nie je ani v súbore projektu.

### Vrátenie späť a vykonanie znova

- *Domov › Úpravy › Vrátiť späť* a *Vykonať znova* (tiež na karte *Tabuľka*), šípky v záhlaví okna, alebo Ctrl+Z na vrátenie späť a Ctrl+Y alebo Ctrl+Shift+Z na vykonanie znova.
- Ak urobíte niečo nové po *Vrátiť späť*, *Vykonať znova* už nie je dostupné.

*Vrátiť späť* zahŕňa zmeny vašich údajov projektu (úlohy, závislosti, zdroje, kalendáre a podobne) a použitie rozloženia. Zmeny stĺpcov tabuľky úloh sú tiež krokmi: pridanie, odstránenie, presun, zmena veľkosti, automatické prispôsobenie, pripnutie a obnovenie rozloženia stĺpcov na predvolené. Tieto kroky patria samotnej tabuľke úloh a platia pre celú aplikáciu, nie pre jeden dokument. Aplikácia uchováva posledných sto krokov na dokument, pri veľmi veľkom projekte menej.

## Úskalia a čo aplikácia robí

**Delete v tabuľke úloh neodstráni úlohu.** Ak je fokus v tabuľke úloh, Delete (alebo Backspace) vymaže obsah vybraných buniek. Pri povinnej alebo vypočítanej bunke, napríklad pri názve alebo trvaní, aplikácia odmietne zmenu a pod tabuľkou úloh zobrazí hlásenie. Pri názve napríklad *Táto hodnota je povinná a nemôže zostať prázdna*. Potom sa nevymaže nič, ani nie v ostatných vybraných bunkách. Kliknite na pruh v zobrazení Gantt alebo použite *Odstrániť* (na karte *Tabuľka*, kde zobrazenie Gantt nie je: *Tabuľka › Úpravy › Odstrániť* alebo kontextová ponuka).

**Celá fáza zmizne naraz.** Ak odstránite súhrnnú úlohu, zmiznú s ňou aj jej čiastkové úlohy, ich závislosti a priradenia. *Vrátiť späť* (Ctrl+Z) vráti všetko späť, aj závislosti a priradenia.

**Čo sa nevráti.** Výber, zbalenie a rozbalenie a tlačidlo *Vymazať* v páse *Nedostupné počas filtrovania, zoskupovania a triedenia* nie sú súčasťou *Vrátiť späť*. Ak stlačíte Ctrl+Z po *Vymazať*, vrátite preto späť predchádzajúci krok, nie vymazanie.

**Odstránenie úlohy, na ktorej iné úlohy závisia.** Závislosti z tejto úlohy a do nej zmiznú tiež. Úlohy, ktoré boli k nej iba pripojené, sa uvoľnia a po **Prepočítať** začnú znova od svojho plánovaného začiatku. Ak je to potrebné, pridajte nové závislosti, pozrite [Pridanie závislostí](docs://howto-relaties-leggen).

## Pozri tiež

- [Pridanie úloh a medzníkov](docs://howto-taken-en-mijlpalen-toevoegen): opak tejto stránky, a kopírovanie úloh.
- [Úprava štruktúry](docs://howto-structuur-aanpassen): zaraďte úlohu pod inú fázu namiesto jej odstránenia.
- [Ťahanie, posúvanie a priblíženie v zobrazení Gantt](docs://howto-gantt-bedienen): obdĺžnik výberu a režimy posúvania.
- [Kontextové ponuky](docs://ref-contextmenus): čo *Odstrániť* a ostatné položky robia s výberom.

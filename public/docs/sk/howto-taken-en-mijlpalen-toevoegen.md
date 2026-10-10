# Pridávanie úloh a medzníkov

Cieľ: vložiť novú úlohu alebo medzník do plánu, na miesto, kam patrí.

## Kedy to potrebujete

Zostavujete plán, pridáva sa ďalšia práca, alebo chcete zaznamenať okamih, napríklad odovzdanie alebo kontrolu.

**Úloha** je práca, ktorá trvá určitý čas. Nová úloha trvá predvolene 5 pracovných dní. Pri plánovaní v hodinách môže byť predvolená hodnota projektu v hodinách. **Medzník** je okamih bez trvania: 0 dní. Úloha s čiastkovými úlohami sa nazýva **súhrnná úloha**; v stavbe je to často fáza. Jej trvanie a dátumy vyplynú z jej čiastkových úloh, len čo použijete **Prepočítať** (F5).

## Kroky

### Pridanie úlohy

1. Vyberte *Domov › Úlohy › Úloha*. Rovnaké tlačidlo je na karte *Tabuľka*.
2. Otvorí sa panel *Vlastnosti* a označí sa pole *Názov*. Napíšte názov a stlačte Enter.

Nová úloha sa najprv volá *Nová úloha* a začína v deň začiatku projektu.

Ak je vybraná úloha, nová úloha sa vloží priamo pod ňu, na rovnakú úroveň. Ak je vybraná súhrnná úloha, nová úloha sa vloží pod celú fázu, teda za jej čiastkové úlohy. Ak nie je nič vybraté, pridá sa dole v zozname. Popis tlačidla, ktorý sa zobrazí pri ukázaní myšou, hovorí, ktorá z dvoch možností nastane: *Nová úloha priamo pod výberom* alebo *Nová úloha na konci zoznamu*. Ak vyberiete viac úloh, vytvorí sa jedna nová úloha pod najnižšou úlohou výberu, tak ako ju vidíte na obrazovke.

### Rýchle pridávanie úloh jednu za druhou v tabuľke úloh

Pod poslednou úlohou v tabuľke úloh je vždy sivý riadok *Nová úloha*. Nie je to ešte úloha: nie je v diagrame Gantt ani v súbore.

1. Kliknite do bunky tohto sivého riadku, alebo sa na ňu dostanete šípkou nadol.
2. Napíšte názov a stlačte Enter. Teraz je to skutočná úloha na rovnakej úrovni ako úloha nad ňou. Kurzor je hneď na novom sivom riadku pod ňou.
3. Napíšte ďalší názov a tak ďalej.

Ak na sivom riadku vyplníte iba trvanie alebo dátum, úloha sa volá *Nová úloha*. Ak odídete bez vyplnenia čohokoľvek, nestane sa nič: žiadna úloha a žiadny krok v *Vrátiť späť*. Vytvorenie úlohy a jej prvá hodnota sú spolu jeden krok v *Vrátiť späť*. Sivý riadok je tu len vtedy, keď tabuľka úloh nie je filtrovaná, zoskupená ani zoradená.

### Pravým tlačidlom myši na prázdnom mieste

Pravým tlačidlom myši kliknite na prázdne miesto: v tabuľke úloh pod poslednou úlohou, alebo v diagrame Gantt vedľa pruhov alebo pod nimi. Vyberte *Vytvoriť úlohu* alebo *Pridať medzník*. Úloha sa pridá dole v zozname. V diagrame Gantt začína na dátume, na ktorý ste klikli. V tabuľke úloh sa bunka názvu hneď otvorí, aby ste mohli písať.

### Nad alebo pod konkrétnou úlohou

Pravým tlačidlom kliknite na úlohu a vyberte *Vložiť nad* alebo *Vložiť pod*. Funguje aj klávesnica: Insert pridá úlohu nad vybranú úlohu, Ctrl+I (⌘+I na Macu) pod ňu. V tabuľke úloh sa po Insert hneď otvorí bunka názvu, pripravená na písanie.

Ak je vybraných viac úloh, vytvorí sa jedna nová úloha: *Vložiť nad* ju vloží nad najvyššiu vybranú úlohu, *Vložiť pod* pod najnižšiu.

### Pridanie čiastkovej úlohy

Pravým tlačidlom kliknite na úlohu a vyberte *Pridať čiastkovú úlohu*. Nová úloha sa pridá dole medzi čiastkovými úlohami tejto úlohy. V tabuľke úloh vedľa diagramu Gantt má aj súhrnná úloha malé **+** za svojím názvom, ktoré robí to isté.

### Pridanie medzníka

1. Vyberte *Domov › Úlohy › Medzník ▾* a potom *Medzník začiatku*, *Medzník dokončenia* alebo *Kontrolný bod (povinný)*.
2. Napíšte názov a stlačte Enter. Umiestnenie sa riadi rovnakým pravidlom ako pri tlačidle *Úloha*.

Tri druhy medzníkov sa líšia takto:

- *Medzník začiatku* patrí na začiatok dňa, *Medzník dokončenia* na záver dňa. V diagrame Gantt je kosoštvorec na ľavej, respektíve pravej strane stĺpca dňa. Záleží na tom aj pre nasledujúcu úlohu. Predstavte si, že medzník je v utorok 29. septembra 2026 a za ním nasleduje úloha so závislosťou dokončenie-začiatok. Pri medzníku začiatku sa tá úloha začne v ten istý utorok. Pri medzníku dokončenia sa začne v stredu 30. septembra.
- *Kontrolný bod (povinný)* je medzník dokončenia s typom úlohy *Kontrola/inšpekcia* a zaškrtnutím *Povinný (zmluvný)*.

### Premena existujúcej úlohy na medzník

Pravým tlačidlom kliknite na úlohu a vyberte *Prepnúť medzník*, alebo zaškrtnite *Medzník* v paneli *Vlastnosti*. Táto položka ponuky platí pre celý výber. Trvanie sa zmení na 0.

Ak ho znova vypnete, zostane z neho bežná úloha s trvaním 0: trvanie zadajte sami.

### Ďalšie spôsoby

- Ctrl+M (⌘+M na Macu) pridá nový medzník dole v zozname, aj keď je vybraná úloha. Panel *Vlastnosti* sa neotvorí.
- Položka *Pridať medzník* v kontextovej ponuke úlohy urobí z medzníka čiastkovú úlohu tej úlohy, nie úlohu na rovnakej úrovni.

### Kopírovanie úlohy alebo celej vetvy

1. V diagrame Gantt kliknite na pruh úlohy. Ďalšie úlohy vyberte kliknutím so stlačeným Ctrl.
2. Stlačte Ctrl+C (⌘+C na Macu). Aplikácia skopíruje úlohu so všetkými jej čiastkovými úlohami, závislosti medzi skopírovanými úlohami a ich priradenia zdrojov.
3. Ak chcete, kliknite na pruh úlohy, vedľa ktorej sa má kópia vložiť, a stlačte Ctrl+V (⌘+V).

Kópia má rovnaký názov, rovnaké dátumy a rovnaký postup. Vloží sa na rovnakú úroveň ako vybraná úloha. Pri viacerých vybraných úlohách sa kópia vloží na rovnakú úroveň ako úloha, na ktorú ste klikli ako prvú. Vloží sa dole medzi úlohy na tejto úrovni. Ak nie je nič vybraté, pridá sa dole v zozname. Skopírované úlohy sa potom vyberú, kódy WBS (číslo každej úlohy v strome, napríklad 1.2; pozrite [Úprava štruktúry](docs://howto-structuur-aanpassen)) sa určia znova a plán je zastaralý.

Schránka je spoločná pre celú aplikáciu, takže môžete vložiť aj do iného dokumentu. Čo tam neexistuje, napríklad kalendár úlohy, vlastný typ úlohy, kód aktivity alebo vlastné pole, aplikácia vymaže a upozorní vás na to.

### Potom

Nová úloha ešte nemení ostatné dátumy. Stavový riadok hovorí *Zastaralé — prepočítajte (F5)*. Stlačte **Prepočítať** (F5), napríklad cez *Domov › Plán › Prepočítať*.

## Úskalia a čo aplikácia robí

**Každá nová úloha začína v deň začiatku projektu.** Bez závislostí úloha na nič nečaká. Pridajte závislosti, pozrite [Pridávanie závislostí](docs://howto-relaties-leggen).

**Filtrovanie, zoskupovanie alebo triedenie je zapnuté.** Poradie, ktoré vidíte, potom nezodpovedá poradiu plánu. Ak je vybraná úloha, *Úloha* a *Medzník ▾* pridajú novú úlohu dole a objaví sa lišta *Nedostupné počas filtrovania, zoskupovania a triedenia*. *Vložiť nad* a *Vložiť pod* sa odmietnu s rovnakou lištou. Tlačidlo *Vymazať* na lište odstráni naraz filter, zoskupovanie a triedenie. Toto nie je súčasťou *Vrátiť späť*: Ctrl+Z ich nevráti.

**Čiastková úloha pod úlohou s priradeniami zdrojov.** Úloha sa stane súhrnnou úlohou a súhrnná úloha nemá vlastné priradenia. Aplikácia presunie priradenia na novú čiastkovú úlohu a upozorní vás na to. Ak to nejde, napríklad preto, že ste vybrali *Pridať medzník* a medzník nemôže mať priradenia, aplikácia nič nepridá a povie, prečo.

**Čiastková úloha pod medzníkom.** Medzník sa stane súhrnnou úlohou a aplikácia odstráni príznak medzníka. Zobrazí hlásenie.

**Zapnutie medzníka pri súhrnnej úlohe alebo úlohe s priradeniami.** Aplikácia to odmietne a povie, prečo. Pri priradeniach najprv ich odstráňte.

**Kopírovanie v tabuľke úloh.** V tabuľke úloh (a na karte *Tabuľka*) Ctrl+C kopíruje len hodnoty vybraných buniek, ako v tabuľkovom procesore, a Ctrl+V vkladá do buniek. Kopírovanie úloh preto funguje len v diagrame Gantt: najprv kliknite na pruh.

## Pozri tiež

- [Úprava štruktúry](docs://howto-structuur-aanpassen): znížiť úroveň a presúvať úlohy a udržiavať čísla WBS aktuálne.
- [Pridávanie závislostí](docs://howto-relaties-leggen): prepojiť úlohy.
- [Výber, odstránenie a vrátenie úloh späť](docs://howto-taken-selecteren-verwijderen): ako úlohu znova odstrániť.
- [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad): čo aplikácia vypočíta, keď sú zadané závislosti.
- [Dialóg úlohy a panel vlastností](docs://ref-taak-eigenschappen): všetky polia úlohy.
- [Nový projekt a info o projekte](docs://ref-projectinfo): začať so šablónou fáz.
- [Kontextové ponuky](docs://ref-contextmenus): všetky položky ponuky úlohy.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): malý príklad projektu (*Súbor › Príklady*) so štyrmi fázami, medzníkom začiatku a povinným medzníkom odovzdania.

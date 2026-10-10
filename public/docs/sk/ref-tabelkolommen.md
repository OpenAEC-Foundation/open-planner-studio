# Stĺpce tabuľky

Tabuľka úloh má 86 pevných stĺpcov, plus jeden stĺpec pre každý kód aktivity a každé vlastné pole projektu, a osem stĺpcov pre každý pôvodný plán. Tento článok popisuje pre každý stĺpec, čo zobrazuje, či ho môžete upraviť a v akej podobe sa hodnota zapisuje. Ako stĺpce vyberať a usporiadať, je opísané v článku [Prispôsobenie stĺpcov tabuľky](docs://howto-tabelkolommen-aanpassen).

## Kde vyberiete stĺpce

Tabuľka úloh vedľa diagramu Gantt a tabuľka na karte *Tabuľka* majú každá vlastný výber stĺpcov. Znamienko plus vpravo v hlavičke otvorí výber stĺpcov (názov okna *Vybrať stĺpec*). Na karte *Tabuľka* môžete použiť aj *Tabuľka › Stĺpce › Stĺpce…*. Výber zobrazuje stĺpce podľa kategórií: *Úloha*, *Plánovanie*, *Obmedzenia*, *Závislosti*, *Zdroje*, *Postup*, *Vypočítané*, *Pôvodný plán*, *Vlastné* a *Technické*. Hľadáte podľa názvu. *Naposledy použité* je hore. *Obnoviť predvolené* obnoví predvolené stĺpce.

Podľa predvolenia tabuľka vedľa diagramu Gantt zobrazuje *WBS*, *Názov úlohy* a *Trvanie*. Tabuľka na karte *Tabuľka* zobrazuje *WBS*, *Názov úlohy*, *Trvanie*, *Začiatok*, *Dokončenie*, *Typ úlohy*, *Kritická*, *Celková časová rezerva* a *Postup*, plus stĺpec pre každý kód aktivity a vlastné pole projektu.

## Ako sa hodnoty čítajú a upravujú

- **Vypočítané stĺpce** — stĺpce v kategórii *Vypočítané* a niekoľko ďalších sú iba na čítanie. Pochádzajú z výpočtu. Ak sa pokúsite upraviť bunku iba na čítanie, aplikácia zobrazí: *Tento vypočítaný stĺpec sa nedá upraviť.* Tento text platí pre každú bunku iba na čítanie, aj keď stĺpec nie je vypočítaný. Ak sú údaje zastarané, lebo ste niečo zmenili, vedľa nich sa zobrazí *zastaralé*, kým nestlačíte *Prepočítať*.
- **Dátumy** — zobrazia sa vo formáte, ktorý ste zvolili v časti *Nastavenia*, na karte *Zobrazenie*, v časti *Formát dátumu*.
- **Trvanie a časová rezerva** — trvanie sa zobrazí v jednotke úlohy (`5d`, `12h`), alebo podľa nastavenia *Zobrazenie trvania* na tej istej karte (*Automaticky (vlastná jednotka každej úlohy)*, *Vždy dni* alebo *Vždy hodiny*). Časová rezerva sa zobrazí v pracovných dňoch, s dvoma desatinnými miestami a s desatinným oddeľovačom vášho jazyka.
- **Áno/Nie** — hodnota áno/nie sa zobrazí ako *Áno* alebo *Nie*. Prázdna hodnota sa zobrazí ako pomlčka (—).
- **Úprava** — hodnotu zadáte alebo vyberiete. Neplatná hodnota sa odmietne a pod bunkou sa zobrazí dôvod, napríklad *Zadajte platné trvanie, napríklad 5d alebo 8h.* alebo *Zadajte percento medzi 0 a 100.* Vloženie bloku buniek funguje bunka po bunke. Bunky iba na čítanie sa preskočia a aplikácia oznámi, koľko ich bolo.

## Úloha

- **Názov úlohy** — názov úlohy. Dá sa upraviť; pole je povinné. Súhrnná úloha sa zobrazuje tučne, s jemným svetlým pozadím v bunke názvu. Medzník sa zobrazuje tučne vo farbe medzníka, z rovnakej farebnej rodiny ako medzník v diagrame Gantt. Bežná úloha zostáva bez zmeny. Ide len o formátovanie. Výber, presúvanie a úprava fungujú rovnako.
- **Popis** — popis úlohy. Dá sa upraviť; voľný text.
- **WBS** — kód WBS. Dá sa upraviť a je povinný. Pri zapnutom *WBS automaticky* je iba na čítanie.
- **Typ úlohy** — typ úlohy (*Stavba*, *Inštalácia*, *Demolácia*, *Logistika*, *Kontrola/inšpekcia*, *Presun*, *Rekonštrukcia*, *Údržba* alebo *Iné*). Dá sa upraviť so zoznamom.
- **Vlastný typ úlohy** — vlastný typ úlohy z projektu, alebo pomlčka. Dá sa upraviť so zoznamom vlastných typov projektu.
- **Farba** — uložená farba úlohy ako kód farby, napríklad `#1a73e8`. Dá sa upraviť s výberom farby. Farba sa ukladá do súboru IFC, ale žiadny pruh ani zostava ju nepoužíva. Farby pruhov nastavíte v *Zobrazenie › Smerné plány a postup › Farby pruhov*.
- **Poznámky** — poznámky vo tvare `✓ text; ○ text`. Dajú sa upraviť, ak je najviac jedna poznámka. Upravíte potom jej text. Pri viacerých poznámkach sú iba na čítanie.

## Plánovanie

- **Medzník** — či je úloha medzník. Dá sa upraviť. Zapnutím sa trvanie nastaví na 0. Aplikácia to odmietne pri súhrnnej úlohe a pri úlohe s priradeniami.
- **Typ medzníka** — *Medzník začiatku* alebo *Medzník dokončenia*, alebo pomlčka pre automatický výber. Dá sa upraviť len pri medzníku.
- **Povinný medzník** — príznak *Povinný (zmluvný)*. Dá sa upraviť len pri medzníku.
- **Priorita vyvažovania** — celé číslo od 0 do 1000, predvolené 500. Dá sa upraviť. Hodnota 1000 zafixuje úlohu pre vyvažovanie.
- **Medzery rozdelenia** — počet prerušení, ako `Split gaps: 2`, alebo pomlčka. Iba na čítanie. Upravíte ich v paneli *Vlastnosti*.
- **Pravidlo práce** — pravidlo práce úlohy. Prázdne znamená predvolené pravidlo projektu. Dá sa upraviť so zoznamom, ale pri medzníku, súhrnnej úlohe alebo hamaku je prázdne a iba na čítanie. Vo výbere sa zobrazí len vtedy, keď sú pravidlá práce viditeľné (*Zobraziť pravidla práce a prácu*) alebo keď súbor pravidlá práce obsahuje.
- **Hamak (odvodené trvanie)** — či je úloha hamak. Dá sa upraviť, okrem medzníka alebo súhrnnej úlohy.
- **Kalendár** — identifikátor vlastného kalendára úlohy. Prázdne (—) znamená kalendár projektu. Identifikátor zadáte alebo vyberiete z návrhov. Neznámy identifikátor sa odmietne. Poznámka: bunka zatiaľ zobrazuje interný identifikátor namiesto názvu. Lepšie je vybrať kalendár v paneli *Vlastnosti*.
- **Typ trvania** — *Pracovný čas* (trvanie sa počíta v pracovných dňoch alebo pracovných hodinách kalendára) alebo *Uplynulé trvanie* (trvanie sa počíta v nepretržitom čase bez kalendára). Dá sa upraviť.
- **Jednotka trvania** — *Dni* alebo *Hodiny*. Dá sa upraviť, okrem súhrnnej úlohy, hamaka alebo medzníka. Prepnutie funguje len vtedy, keď je prepočet presný a je zapnuté *Zapnúť plánovanie v hodinách*.
- **Trvanie** — trvanie úlohy, v jednotke úlohy alebo podľa *Zobrazenie trvania*. Dá sa upraviť: napíšte `5d`, `12h` alebo `1h 30m`. Funguje aj číslo v jednotke úlohy. Iba na čítanie pri súhrnnej úlohe, hamaku a medzníku s trvaním 0.
- **Začiatok** — zobrazený začiatok, rovnaký dátum ako pruh v diagrame Gantt. Dá sa upraviť. Úloha s predchádzajúcou úlohou, ktorej dáte nový začiatok, dostane obmedzenie *Začiatok nie skôr ako (SNET)* na tento dátum. Iba na čítanie pri súhrnnej úlohe alebo hamaku, pokiaľ nie je manuálne plánovaná.
- **Dokončenie** — zobrazené dokončenie. Dá sa upraviť: nové dokončenie zmení trvanie. Aplikácia to odmietne pri dokončenej úlohe, medzníku, úlohe s uplynulým trvaním a úlohe s prestávkami. Odmietne aj dokončenie pred začiatkom (*Dokončenie je pred začiatkom.*). Iba na čítanie pri súhrnnej úlohe alebo hamaku, pokiaľ nie je manuálne plánovaná.
- **Plánovaný začiatok** — kotva plánovania, od ktorej výpočet začína. Nie je nutne rovnaká ako zobrazený začiatok. Dá sa upraviť. Účinok je rovnaký ako zápis do *Začiatok*.
- **Plánované dokončenie** — zadané dokončenie. Dá sa upraviť len pri manuálne plánovanej úlohe. Inak aplikácia zobrazí: *Plánované dokončenie platí len pre manuálne plánovanú úlohu. Zmeňte dokončenie v stĺpci Dokončenie alebo zmeňte trvanie.*

## Obmedzenia

- **Typ obmedzenia** — typ obmedzenia, od *Čo najskôr (ASAP)* po *Musí skončiť dňa (MFO)*. Dá sa upraviť. Úloha bez obmedzenia zobrazuje *ASAP*.
- **Dátum obmedzenia** — dátum obmedzenia. Dá sa upraviť.
- **Pevné obmedzenie** — príznak *Povinné (ukotvenie logiky)*. Dá sa upraviť len pri *MSO* a *MFO*.
- **Typ sekundárneho obmedzenia** — typ druhej hranice, alebo pomlčka. Dá sa upraviť. Zoznam ponúka všetky typy, ale nepovolená kombinácia sa odmietne. Musí byť *SNET*, *FNET*, *SNLT* alebo *FNLT*. Primárne obmedzenie musí byť hranica, nie *ASAP*, *ALAP*, *MSO*, *MFO* ani pevné obmedzenie. Obe hranice musia ležať na opačných stranách: dolná hranica *SNET* alebo *FNET* s hornou hranicou *SNLT* alebo *FNLT*, alebo naopak.
- **Dátum sekundárneho obmedzenia** — dátum druhej hranice. Dá sa upraviť.
- **Termín** — cieľový dátum dokončenia. Dá sa upraviť.

## Závislosti

- **Predchádzajúce úlohy** — predchádzajúce úlohy ako `WBS type±lag`, oddelené `; `, napríklad `1.2 FS+2d`. Dajú sa upraviť zápisom v rovnakej podobe. Prepojenie medzi projektmi nepridáte tu, ale cez *Plán › Závislosti › Prepojiť › Pridať prepojenie medzi projektmi…*.
- **Nasledujúce úlohy** — nasledujúce úlohy v rovnakej podobe. Dajú sa upraviť.
- **Určujúce závislosti** — závislosti, ktoré určujú dátum tejto úlohy, ako `← 1.2` (predchádzajúca úloha) alebo `→ 1.4` (nasledujúca úloha). Iba na čítanie. Zastaralé, kým nestlačíte *Prepočítať*.
- **Voľná časová rezerva** (v kategórii *Závislosti*) — voľná časová rezerva pre každú závislosť, ako `← 1.2: 3d`. Nie je to ten istý stĺpec ako *Voľná časová rezerva* v kategórii *Vypočítané*. Ten ukazuje rezervu samotnej úlohy. Iba na čítanie.
- **Upozornenia** — upozornenia pre každú závislosť, napríklad *Mimo poradia* alebo *Nezahrnuté do výpočtu*. Iba na čítanie. Pozri [Oznámenia a upozornenia](docs://ref-meldingen).

## Zdroje

- **Priradené zdroje** — názvy priradených zdrojov, oddelené čiarkami. Dá sa upraviť: pridanie názvu priradí zdroj s 1 jednotkou za deň, odstránenie názvu odstráni priradenie. Iba na čítanie pri medzníku alebo súhrnnej úlohe.
- **Jednotky priradenia na deň** — jednotky na zdroj, ako `Name: 1; Name: 0.5`. Dajú sa upraviť pri úlohe s priradeniami.
- **Krivka priradenia** — krivka na zdroj, ako `Name: Uniform`. Dá sa upraviť pri úlohe s priradeniami.
- **Začiatok okna práce** a **Dokončenie okna práce** — okno práce na zdroj z importovaného súboru, ako `Name: date`. Iba na čítanie.
- **Plánovaná práca (hodiny)** a **Skutočná práca (hodiny)** — plánovaná a skutočná práca na zdroj v hodinách, ako `Name: 12`, z importovaného súboru. Iba na čítanie.
- **Zostávajúca práca (hodiny)** — zostávajúca práca na zdroj v hodinách, ako `Name: 6`. Je to uložená práca. Inak je to zostávajúce trvanie krát jednotky. Dá sa upraviť pri úlohe s priradeniami, na ktoré platí pravidlo práce. Vo výbere sa zobrazí len vtedy, keď sú pravidlá práce viditeľné.

## Postup

- **Stav** — *Nezačaté*, *Prebieha* alebo *Dokončené*. Dá sa upraviť, okrem súhrnnej úlohy.
- **Postup** — percento, ako `40%`. Dá sa upraviť číslom od 0 do 100, okrem súhrnnej úlohy.
- **Skutočný začiatok** — dátum začiatku úlohy. Dá sa upraviť, okrem súhrnnej úlohy.
- **Skutočné dokončenie** — dátum dokončenia úlohy. Dá sa upraviť, okrem súhrnnej úlohy.
- **Skutočné trvanie** — skutočné trvanie ako číslo. Dá sa upraviť, okrem súhrnnej úlohy.
- **Zostáva** — zostávajúce trvanie v jednotke úlohy. Dá sa upraviť, okrem súhrnnej úlohy.
- **Dátum obnovenia** a **Dátum zastavenia** — dátum obnovenia a zastavenia bežiacej úlohy zo súboru MS Project alebo Primavera. Iba na čítanie.

Stĺpce postupu sa riadia pravidlami postupu v aplikácii. Skutočný dátum, ktorý je po dátume kontroly stavu, sa odmietne. Pri súhrnnej úlohe aplikácia zobrazí: *Postup súhrnnej úlohy sa odvodzuje z jej čiastkových úloh a tu sa nedá zmeniť.*

## Vypočítané

Všetky stĺpce v tejto kategórii sú iba na čítanie.

- **Oneskorenie pri vyvažovaní** — koľko pracovných dní vyvažovanie úlohu oneskorilo. Pomlčka, ak sa vyvažovanie neuplatnilo.
- **Skorý začiatok** a **Skoré dokončenie** — najskoršie dátumy z výpočtu.
- **Neskorý začiatok** a **Neskoré dokončenie** — najneskoršie dátumy, kedy sa úloha ešte môže začať alebo skončiť bez posunutia dokončenia projektu.
- **Voľná časová rezerva** — počet pracovných dní, o ktoré môže úloha skĺznuť bez toho, aby sa posunula nasledujúca úloha.
- **Celková časová rezerva** — počet pracovných dní, o ktoré môže úloha skĺznuť bez toho, aby sa posunulo dokončenie projektu. Je záporná, ak sa nedá splniť obmedzenie alebo termín.
- **Kritická** — *Áno*, ak je úloha na kritickej ceste.
- **Rušivá časová rezerva** — celková časová rezerva mínus voľná časová rezerva.
- **Takmer kritická** — *Áno* pri takmer kritickej úlohe. Vyplní sa, len ak je zapnuté *Označiť takmer kritické* (*Info o projekte*, blok *Profil výpočtu a možnosti výpočtu*). Inak pomlčka.
- **Cesta časovej rezervy** — číslo cesty časovej rezervy, 1 pre najkritickejšiu. Vyplní sa, len ak je zapnuté *Viacero ciest časovej rezervy*. Inak pomlčka.
- **Zdroj zaznamenaných dátumov** — pri súbore so zaznamenanými dátumami: *Odchyľuje sa* alebo *Čiastočne nezaznamenané*. Vo výbere je viditeľné len pri takom súbore. Na osi bez záznamu sa v stĺpcoch neskorých dátumov a časových rezerv zobrazí *Nezaznamenané*.

Pozri [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad).

## Pôvodný plán

Pre každý pôvodný plán projektu sa pridajú stĺpce. Pred názov stĺpca sa pridá názov pôvodného plánu (`<baseline> — Scheduled start`). Sú iba na čítanie. Úloha, ktorá nie je v pôvodnom pláne, zobrazuje pomlčku s popisom *Nie je v tomto pôvodnom pláne*.

- **Plánovaný začiatok**, **Plánované dokončenie** a **Trvanie** — začiatok, dokončenie a trvanie tak, ako ich pôvodný plán zaznamenal.
- **Odchýlka začiatku** a **Odchýlka dokončenia** — počet pracovných dní medzi pôvodným plánom a zobrazeným začiatkom alebo dokončením, v kalendári projektu. Kladná hodnota, ak je úloha neskoršia.
- **Odchýlka v trvaní** — súčasné trvanie mínus trvanie v pôvodnom pláne, v pracovných dňoch.

## Vlastné

- **Kód aktivity** — jeden stĺpec pre každý kód aktivity, s názvom kódu. Zobrazuje kód zvolenej hodnoty. Dá sa upraviť: kód napíšete alebo vyberiete z návrhov. Neznámy kód sa odmietne. Ak sa kód vyskytuje viackrát, aplikácia vás požiada, aby ste ho vybrali zo zoznamu.
- **Vlastné pole** — jeden stĺpec pre každé vlastné pole, s jeho názvom. Vstup zodpovedá typu: text, číslo, celé číslo, náklad, dátum alebo áno/nie. Dá sa upraviť.

Tieto stĺpce patria projektu, v ktorom je kód alebo pole. Pozri [Kódy a vlastné polia](docs://howto-codes-en-velden).

## Technické

Všetky stĺpce v tejto kategórii sú iba na čítanie. Zobrazujú údaje, ktoré aplikácia ukladá, ale bežný stĺpec ich nezobrazuje, napríklad na kontrolu importu.

- **ID úlohy** — interný identifikátor úlohy.
- **ID nadradenej úlohy** a **ID podradených úloh** — identifikátory nadradenej a podradených úloh.
- **ID zdrojov** — identifikátory zdrojov na úlohe.
- **ID priradenia**, **ID úlohy priradenia** a **ID zdroja priradenia** — identifikátory priradení, úloh a zdrojov tejto úlohy.
- **Trvanie (minúty)** a **Zostáva (minúty)** — trvanie a zostávajúce trvanie v minútach. Vyplní sa len pri úlohe v hodinách.
- **Oneskorenie pri vyvažovaní (minúty)** a **Uplynulé oneskorenie pri vyvažovaní** — oneskorenie vyvažovania z MS Project v minútach a či sa počíta v nepretržitom čase.
- **Manuálne plánovaná** — či je úloha manuálne plánovaná.
- **Typ úlohy v MS Project (import)** a **Riadené úsilím** — typ úlohy a príznak riadené úsilím tak, ako ich mal MS Project.
- **Údaje o pôvode Primavera P6** — zdrojové polia zo súboru Primavera P6 ako `key: value`.
- **Výslovne súhrnná úloha** — či je úloha výslovne súhrnná bez čiastkových úloh (zo súboru Primavera).
- **Časovo rozložené dolné ohraničenie dokončenia**, **Časovo rozložená kotva začiatku**, **Časovo rozložené segmenty trvania** a **Časovo rozložené rozvrhy práce** — rozdelenie hodín zo súboru MS Project, ako dátumy a počty.
- **Údaje o kódoch aktivít**, **Údaje o vlastných poliach** a **Údaje o poznámkach** — počet priradení kódov, vlastných polí a poznámok.
- **Údaje o interných závislostiach** a **Údaje o externých prepojeniach** — počet interných závislostí a prepojení medzi projektmi.
- Pri každom pôvodnom pláne sú tu aj **Medzník** a **Typ medzníka**, tak ako ich pôvodný plán zaznamenal.

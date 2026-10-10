# Otvorenie súboru Microsoft Project (.mpp)

Cieľ: otvoriť plán z programu MS Project priamo v aplikácii, bez exportu.

## Kedy to potrebujete

Dodávateľ, konzultant alebo klient vám pošle svoj plán ako súbor `.mpp`. Chcete ho zobraziť, prepočítať alebo ďalej upravovať. Aplikácia číta súbory `.mpp` z programu MS Project 2010 až vrátane verzie 2021. Iba číta: súbor `.mpp` nezapisuje a váš súbor nikdy nemení. Zo súboru preberá samotný plán: úlohy so štruktúrou, trvaním a obmedzeniami, závislosti s oneskorením, kalendáre, zdroje, priradenia a postup. Prečíta aj dátumy a časovú rezervu, ktoré MS Project vypočítal sám. Používa ich iba pre zobrazenie *Dátumy tak, ako sú uložené*, nikdy ako vstup.

## Kroky

1. Vyberte *Domov › Súbor › Otvoriť* alebo stlačte Ctrl+O. Vyberte súbor `.mpp`.
2. Projekt sa otvorí na novej karte, alebo na aktuálnej karte, ak bola ešte prázdna a nezmenená. Projekt nemá žiadny súbor: *Uložiť* neskôr zapíše nový súbor IFC.
3. Prečítajte si hlásenie dole: *Tento projekt sa počíta ako Microsoft Project. Zmeniť ho môžete v ponuke Súbor → Informácie o projekte → Profil výpočtu a možnosti výpočtu.* Aplikácia počíta tento projekt podľa pravidiel výpočtu programu MS Project: profil výpočtu *Microsoft Project*. Pomocou *Otvoriť profil výpočtu* sa dostanete k nastaveniu. *Čítať viac* otvorí pomoc o profiloch výpočtu.
4. Skontrolujte, či sa pod pásom s nástrojmi nachádza hlásenie: *Zobrazujete dátumy tak, ako sú uložené v súbore; pri prepočítaní sa posunú 4 úlohy.* Pri týchto úlohách sa výsledok aplikácie líši od dátumov, ktoré MS Project uložil. Pod hlásením z kroku 3 je potom ešte jeden riadok: *4 úlohy zobrazujú dátumy tak, ako sú uvedené v súbore (bez prepočítania).* Čo to znamená a ako prepnete na vlastný výpočet aplikácie, je v článku [Dátumy tak, ako sú uložené](docs://uitleg-datums-zoals-opgeslagen).
5. Ak sa zobrazí hlásenie *Tento súbor obsahuje plánovanie v hodinách.* s tlačidlom *Zapnúť plánovanie v hodinách*, súbor obsahuje údaje v hodinách. Pozrite [Zapnutie plánovania v hodinách](docs://howto-urenplanning-aanzetten).

Ak súbor obsahuje úlohy s prestávkami, vyvažovaním alebo plánom riadeným zdrojmi, pridá sa ďalšie hlásenie, napríklad *Tento súbor MS Project obsahuje 3 úlohy s prestávkami, vyvažovaním alebo plánom riadeným zdrojmi. Načítajú sa a zobrazia sa takto.* Pri jednej úlohe je text hlásenia v jednotnom čísle.

## Úskalia a čo vtedy robí aplikácia

**Nie všetko sa prenesie.** Aplikácia neprevezme pôvodné plány, náklady a štandardné sadzby, poznámky ani vlastné polia z programu MS Project. Kód WBS, ktorý ste sami vyplnili v programe MS Project, sa prevezme. Inak aplikácia očísluje úlohy podľa štruktúry.

**Súbor z programu MS Project 2007 alebo staršieho.** Aplikácia ho odmietne a zobrazí hlásenie: *Tento súbor .mpp používa starý formát (Project 2007 alebo starší). V programe MS Project ho exportujte ako XML (Súbor → Uložiť ako → XML) a otvorte tento súbor.* Pod hlásením sa aplikácia pridá technický dôvod v angličtine.

**Súbor s heslom.** Aplikácia zobrazí hlásenie: *Tento súbor .mpp je chránený heslom. V programe MS Project ho exportujte ako XML (Súbor → Uložiť ako → XML) a otvorte tento súbor.* Aj tu je k hláseniu pridaný technický dôvod v angličtine.

**Súbor, ktorý nie je `.mpp`.** Dostanete hlásenie *Otvorenie súboru zlyhalo* s technickým dôvodom.

**Cesta cez XML počíta inak.** Ak otvoríte export XML z programu MS Project namiesto súboru `.mpp`, aplikácia počíta s profilom výpočtu *Open Planner Studio* a hlásenie o *Microsoft Project* sa nezobrazí. Dátumy potom môžu vyjsť inak ako pri súbore `.mpp`.

**Úprava uvoľní riadenie z programu MS Project.** Ak upravíte úlohu, ktorej plán riadilo dátumové okno programu MS Project, aplikácia zobrazí hlásenie raz na projekt: *Dátumové okno z MS Project už po tejto úprave neriadi 2 úlohy; samotné rozloženie práce platí ďalej a zostáva uložené v súbore.* Pri jednej úlohe je text hlásenia v jednotnom čísle.

**Uložením sa váš súbor `.mpp` nikdy neprepíše.** Projekt nemá súbor. Pri *Uložiť* sa aplikácia opýta, kam sa má nový súbor IFC uložiť.

## Pozri tiež

- [Súbory a formáty](docs://uitleg-bestanden): prečo sa `.mpp` iba číta a čo zapíše ukladanie.
- [Dátumy tak, ako sú uložené](docs://uitleg-datums-zoals-opgeslagen): zobrazenie vlastných dátumov programu MS Project.
- [Zapnutie plánovania v hodinách](docs://howto-urenplanning-aanzetten): ak súbor obsahuje údaje v hodinách.
- [Otvorenie súboru Primavera P6 (.xer)](docs://howto-xer-openen): to isté pre Primaveru.
- [Formáty importu a exportu](docs://ref-import-exportformaten): pre každý formát, čo sa prenesie a čo nie.
- [Profily výpočtu a pravidlá výpočtu](docs://uitleg-rekenprofielen): prečo sa súbor MS Project otvorí so svojím profilom výpočtu.

# Otvorenie súboru Primavera P6 (.xer)

Cieľ: otvoriť plán z Primavera P6 priamo v aplikácii bez predchádzajúceho exportu do XML.

## Kedy to potrebujete

Klient alebo hlavný dodávateľ pracuje v Primavere a dodáva svoj plán ako súbor `.xer`. Chcete ho zobraziť, prepočítať alebo k nemu niečo pridať. Aplikácia číta iba súbory `.xer`: nezapisuje do `.xer` a váš súbor nikdy nemení. Zo súboru preberá štruktúru WBS a úlohy s trvaním, dátumami, obmedzeniami a postupom, závislosti s oneskorením, kalendáre a zdroje s ich priradeniami, plus kódy aktivít, vlastné polia (UDF), poznámky a nastavenia plánovania P6. Úloha typu *Úroveň úsilia* sa stane hamakom.

## Kroky

1. Vyberte *Domov › Súbor › Otvoriť* alebo stlačte Ctrl+O. Vyberte súbor `.xer`.
2. Aplikácia otvorí jednu kartu pre každý projekt, ktorý má úlohy. Projekt s najväčším počtom úloh je aktívna karta. Karta sa volá *Názov projektu (ID projektu)*, ak sa ID projektu v P6 líši od názvu. *Nastavenia projektu* zobrazuje iba názov. Ak projekt premenujete, ID projektu zostane za ním. V okne sa potom krátko vysvetlí, čo aplikácia prevzala zo súboru, a ako funguje ukladanie. Pozrite si [Otváranie a ukladanie súboru](docs://howto-bestand-openen-en-opslaan).
3. Prečítajte si správu v spodnej časti. Pri súbore s tromi projektmi môže vyzerať takto: *Súbor XER otvorený: 3 projektové dokumenty.* Pod ňou sú riadky, ktoré vysvetľujú, čo aplikácia urobila. Pozrite si nadpis nižšie.
4. Skontrolujte, či je pod pásom s nástrojmi lišta: *Zobrazujete plán tak, ako ho uložil Primavera; pri prepočítaní sa posunie 1 úloha.* Primavera ukladá do súboru svoje vypočítané dátumy. Ak sa výpočet aplikácie od nich líši, aplikácia zobrazuje dátumy Primavery, pokiaľ nič nezmeníte. Úloha, ktorá sa začala alebo je dokončená, vždy zostáva na svojich skutočných dátumoch, ako v Primavere. Čo to znamená a ako prejdete na vlastný výpočet aplikácie, je v článku [Dátumy tak, ako boli zaznamenané](docs://uitleg-datums-zoals-opgeslagen). Môže sa tiež zobraziť správa *Tento súbor obsahuje plánovanie v hodinách.* s tlačidlom *Zapnúť plánovanie v hodinách*. Pozrite si [Zapnutie plánovania v hodinách](docs://howto-urenplanning-aanzetten).
5. Uložte projekt pomocou Ctrl+S. Keďže sa súbor `.xer` nikdy neprepisuje, aplikácia sa opýta, kam uložiť nový súbor IFC. Ako názov súboru navrhne *Názov projektu (ID projektu)*.

### Riadky pod správou

Prvý riadok správy uvádza počet otvorených kariet. Pod ním sú iba riadky, ktoré sa vás týkajú. Tieto riadky si zaslúžia vašu pozornosť:

- *Tento projekt sa počíta ako „Primavera P6“. Zmeniť ho môžete v ponuke Súbor → Informácie o projekte → Profil výpočtu a možnosti výpočtu.* Aplikácia počíta tento projekt pravidlami výpočtu Primavery. Tlačidlom *Otvoriť profil výpočtu* sa dostanete k nastaveniu.
- *1 projekt pôvodného plánu vylúčený.* a *1 pôvodný plán vytvorený.* Ak projekt v P6 určí iný projekt ako svoj pôvodný plán, tento iný projekt sa neotvorí ako vlastná karta. Stane sa aktívnym pôvodným plánom projektu, ktorý naň odkazuje.
- *Použila sa ochranná záloha pôvodného plánu.* Ak by určenie pôvodných plánov znamenalo, že sa neotvorí žiadny projekt, ak projekt odkazuje sám na seba, alebo ak projekty odkazujú jeden na druhý v slučke, aplikácia jednoducho otvorí všetky projekty a žiadne pôvodné plány nevytvorí.
- *1 prepojenie medzi projektmi zachované.* Ide o prepojenie medzi projektmi. Aplikácia ju uchová ako zdrojový údaj, ale nepremení ju na závislosť vo vašom plánu.
- *12 úloh zobrazuje dátumy tak, ako ich uložil Primavera (bez prepočítania).* Počet úloh, ktoré v zobrazení *Dátumy tak, ako boli zaznamenané* ukazujú dátumy Primavery: každá úloha, pre ktorú súbor uložil dátumy, nielen tie, ktoré sa líšia.

Ostatné riadky sú diagnostika samotného čítania. Nič od vás nevyžadujú:

- počet nájdených projektov;
- preskočený prázdny projekt;
- ignorovaný visiaci odkaz na pôvodný plán;
- kódovanie textu iné ako čisté UTF-8 (oznámenie uvádza, ktoré: pri arabskom, cyrilickom alebo gréckom texte aplikácia zvolí zodpovedajúcu kódovú stránku Windows, inak Windows-1252);
- úlohy bez plánovaného začiatku (začnú sa na dátume kontroly stavu alebo na začiatku projektu zo súboru);
- počítadlá nálezov v tabuľkách, v kalendároch a v číslach, pre neznáme hodnoty polí a pre nastavenia plánovania P6, ktoré aplikácia nahradila bezpečnou voľbou.

*Čítať viac* otvorí Pomocníka o otváraní súborov Primavera.

## Úskalia a čo aplikácia vtedy urobí

**Nie všetko sa stane kartou alebo závislosťou.** Projekt bez úloh sa neotvorí, projekt pôvodného plánu sa neotvorí ako vlastná karta a prepojenie medzi projektmi sa nestane závislosťou vo vašom plánu. Aplikácia to uvedie v riadkoch pod správou.

**Každá karta je samostatný projekt.** Ak ho uložíte, súbor IFC si ponechá celý pôvodný `.xer`. Ak neskôr znovu otvoríte tento súbor IFC, aplikácia stále pozná dátumy Primavery. Ak je tento zdrojový archív poškodený alebo ho iný IFC program prepísal, aplikácia zobrazí: *Zdrojový archív XER v tomto súbore nie je použiteľný a bol vynechaný; samotný projekt bol otvorený úplne.* Plán, profil výpočtu a všetky údaje projektu sú úplné. Chýbajú: dátumy tak, ako ich uložila Primavera, a pôvod zdroja pre AI a rozšírenia. Ak chcete archív obnoviť, znovu otvorte pôvodný `.xer`.

**Súbor IFC sa zväčší.** Keďže súbor IFC nesie celý pôvodný `.xer`, je väčší ako súbor IFC bez archívu. Pri veľkom `.xer` to poznáte na veľkosti súboru a na čase, ktorý ukladanie trvá. Ak `.xer` otvorí viac projektov, každá karta, ktorú uložíte, nesie celý `.xer`, nielen svoj projekt.

**Export do CSV, MS Project XML alebo P6 XML stráca údaje.** Aplikácia upozorní: *Pri exporte do CSV sa stratia údaje o pôvode XER.* IFC nestráca nič.

**Voľná sobota alebo nedeľa, ktorá nie je v súbore.** Aplikácia môže takýto víkendový deň označiť ako voľný sama. Deň sa potom volá *Výnimka kalendára (rekonštrukcia víkendu)* v kalendári. Vzor nájdete v článku [Formáty importu a exportu](docs://ref-import-exportformaten).

**Časová rezerva do dokončenia projektu, bez dátumu dokončenia.** Ak súbor nemá dátum dokončenia, aplikácia vypne možnosť *Prepočítať časovú rezervu do dokončenia projektu*. To sa prejaví v riadku *N nastavení plánu P6 s bezpečnou záložnou hodnotou.* Podrobnosti sú v článku [Formáty importu a exportu](docs://ref-import-exportformaten).

**Dokončené úlohy na dátume kontroly stavu.** Dokončená úloha sa môže v zobrazení *Dátumy tak, ako boli zaznamenané* ukázať ako úzky pruh na dátume kontroly stavu. Nie je to chyba vo vašom súbore. Vysvetlenie a súvisiace pravidlo výpočtu sú v článku [Formáty importu a exportu](docs://ref-import-exportformaten).

**Čísla s čiarkou ako desatinným oddeľovačom.** Ak aplikácia nedokáže spoľahlivo určiť desatinný oddeľovač, súbor neotvorí. Tak sa nikdy neotvorí plán s nesprávne načítanými číslami. Požiadajte odosielateľa o nový export.

**Súbor, ktorý aplikácia nedokáže prečítať.** Dostanete chybové hlásenie s dôvodom. Niekoľko príkladov:

- *Tento súbor nie je platný alebo podporovaný súbor XER.*
- *Tabuľke XER chýbajú povinné stĺpce.*
- *Projekt P6 v tomto súbore XER neobsahuje žiadne úlohy.*
- *Desatinný zápis tohto súboru XER sa nedá spoľahlivo určiť.*

Potom sa nič neotvorí. Skontrolujte súbor v P6 alebo požiadajte odosielateľa o nový export.

## Pozri aj

- [Súbory a formáty](docs://uitleg-bestanden): prečo sa `.xer` iba číta a čo export stráca.
- [Dátumy tak, ako boli zaznamenané](docs://uitleg-datums-zoals-opgeslagen): zobrazenie vlastných dátumov Primavery.
- [Otvorenie súboru MS Project (.mpp)](docs://howto-mpp-openen): to isté pre MS Project.
- [Zapnutie plánovania v hodinách](docs://howto-urenplanning-aanzetten): ak súbor obsahuje údaje v hodinách.
- [Formáty importu a exportu](docs://ref-import-exportformaten): pre každý formát, čo sa prenesie a čo nie.
- [Profily výpočtu a pravidlá výpočtu](docs://uitleg-rekenprofielen): prečo sa súbor P6 otvorí s vlastným profilom výpočtu.

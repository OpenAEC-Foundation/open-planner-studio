# Použitie knižnice zdrojov

Cieľ: používať zdroje z knižnice zdrojov vo vašom projekte a uložiť zdroj, ktorý ste vytvorili v projekte, do knižnice, aby každý projekt používal rovnaké údaje.

## Kedy to potrebujete

Máte stálu partu murárov, žeriav a omietkára, ktorí sa objavujú vo viacerých projektoch. Bez knižnice ich zadávate znova v každom projekte. Hrozí, že budú mať rôzne názvy a štandardné sadzby. Žiadny projekt nevidí, že iný projekt žiada tiež tú istú partu. V knižnici ich zapíšete raz.

Čo je knižnica a čo od nej preberie projekt, prečítate si v [Knižnica zdrojov](docs://uitleg-resourcebibliotheek). Tento článok je o úkonoch. Vytváranie, exportovanie a odstraňovanie knižníc je v [Správa a zdieľanie knižníc zdrojov](docs://howto-bibliotheken-beheren).

## Kroky

### 1. Prepojte projekt s knižnicou

S knižnicou môžete pracovať, iba ak je projekt k nej prepojený. Bez prepojenia panel *Zdroje* nezobrazuje prepínač *Knižnica*, *Projekt* a *Obsadenosť*.

Pre nový projekt:

1. Vyberte *Súbor › Vytvoriť*. Otvorí sa okno *Nový projekt*.
2. Pozrite sa na pole *Knižnica zdrojov*. Pole je nastavené na predvolenú knižnicu. Môžete vybrať inú, *žiadna knižnica (samostatný projekt)* alebo *+ Nová knižnica zdrojov…*.
3. Kliknite na tlačidlo *Vytvoriť*.

Pre existujúci projekt:

1. Vyberte *Súbor › Info o projekte*.
2. V poli *Knižnica zdrojov* vyberte knižnicu.
3. Kliknite na tlačidlo *Použiť*. Dovtedy je dole text *Zmeny nie sú použité — kliknite na Použiť, aby ste ich uložili.*

Ak má projekt už zdroje s rovnakým názvom ako položka knižnice, otvorí sa okno *Prepojiť knižnicu zdrojov* s časťou *Rozpoznané*. Každý zdroj so zhodou má text *Návrh: Bricklayer*. Kliknite na tlačidlo *Prepojiť*, ak chcete prepojiť tento zdroj, alebo na tlačidlo *Prepojiť všetky návrhy*, ak je návrhov viac než jeden. Aplikácia porovnáva názvy bez ohľadu na veľké písmená a dvojité medzery. Pri prepojení prevezme zdroj z položky knižnice názov, typ, štandardnú sadzbu, jednotku a popis. *Maximálny počet jednotiek* zostane taký, aký ste mali v projekte. Okno tiež zobrazuje kalendáre projektu, ktoré majú rovnaký názov ako kalendár z knižnice. Tlačidlom *Rozhodnúť neskôr* zatvoríte okno bez prepojenia.

### 2. Vložte zdroj do knižnice

1. Vyberte *Zdroje › Spravovať › Zdroje*. Panel zdrojov prevezme pracovnú plochu. Vždy sa otvorí na *Projekt*, aj pri prepojenom projekte.
2. Vpravo hore vyberte *Knižnica*. Nad tabuľkou je text *Toto upravuje knižnicu a platí pre všetky projekty. Nedá sa vrátiť späť.*
3. Kliknite na *Nový zdroj v knižnici*. Dole v tabuľke sa objaví prázdny riadok.
4. Zadajte názov, napríklad *Bricklayer*, a stlačte Enter. Zdroj je teraz v knižnici a hneď sa otvorí prázdny riadok pre ďalší. Keď skončíte, stlačte Esc. Bez názvu aplikácia nič nevytvorí.
5. Vyplňte zvyšok riadka. Predvolená hodnota pre *Typ* je *Práca*. Pri poli *Maximálny počet jednotiek* zadáte, koľko je tohto zdroja celkovo, napríklad 3 pre troch murárov. Prehľad obsadenosti použije toto číslo ako kapacitu. Pole *Štandardná sadzba/hod* je nepovinné. Pole *Jednotka* môžete vyplniť iba pri type *Materiál*. Pri poli *Kalendár* vyberte kalendár z knižnice, alebo *+ Kalendár zdrojov* a vytvorte nový, pozrite si [Nastavenie kalendára zdrojov](docs://howto-resourcekalender-instellen). Aplikácia uloží názov, štandardnú sadzbu a jednotku, keď opustíte pole. Ostatné polia uloží hneď.

Každá zmena v knižnici sa hneď prejaví v nezmenených kópiách vo vašich otvorených projektoch.

### 3. Priraďte zdroj k svojmu projektu

1. V zobrazení *Knižnica* vyberte pri zdroji *Priradiť k projektu*. Nad tabuľkou je text *Pridané.* Ak kliknete znova, je tam text *Už je v projekte.* a druhá kópia sa neobjaví.
2. Vyberte *Projekt*. Kópia je v tabuľke s malou ikonou knižnice pri názve. Označenie je *Z knižnice*. Názov, typ, štandardná sadzba a jednotka sú obyčajný text. Ak nad nimi podržíte myš, uvidíte text *Hodnota z knižnice — upravte ju v zobrazení Knižnica, alebo tento zdroj odpojte od knižnice.*
3. Nastavte *Maximálny počet jednotiek* pre tento projekt. Pole začína hodnotou z knižnice a v projekte ho môžete upraviť.
4. Teraz priraďte zdroj k úlohám ako každý iný zdroj, pozrite si [Priradenie zdrojov s krivkou](docs://howto-resource-toewijzen). *Zdroje › Priradenie › Priradiť* zobrazí iba zdroje, ktoré sú už v projekte. Preto najprv zdroj z knižnice priraďte k projektu týmto spôsobom.

*Priradiť k projektu* existuje iba v zobrazení *Knižnica* projektu, ktorý je prepojený s touto knižnicou.

### 4. Zdroj z projektu pridajte do knižnice

Robíte to pri zdroji, ktorý ste vytvorili v projekte a používate ho častejšie, napríklad pri prenajatom žeriave.

1. V zobrazení *Projekt* vyberte pri zdroji *Presunúť do knižnice*. Tlačidlo sa zobrazí iba pri zdroji, ktorý má názov a ešte nepochádza z knižnice, v prepojenom projekte.
2. Prečítajte si správu nad tabuľkou.

Správa môže oznámiť tri veci:

- *Pridané.* Knižnica nemala položku s týmto názvom. Vytvorila sa nová položka a váš zdroj je k nej prepojený.
- *Už bolo v knižnici. Teraz je prepojené.* Existovala položka s rovnakým názvom a rovnakými údajmi. Váš zdroj je k nej prepojený.
- *Prepojené s existujúcou položkou knižnice. Hodnoty sa líšia, pozrite si označenie.* Existovala položka s rovnakým názvom, ale s inými údajmi. Váš zdroj je prepojený a hneď je označený *sa líši — rozhodnite*. Pokračujte krokom 6.

### 5. Odpojte kópiu

Ak chcete v jednom projekte použiť iné hodnoty než v knižnici, napríklad inú štandardnú sadzbu, kópiu odpojte.

1. V zobrazení *Projekt* kliknite na ikonu *Odpojiť od knižnice* na konci riadka.
2. Zdroj je teraz bežný zdroj projektu. Všetky polia sú upraviteľné a už nesleduje knižnicu. Kalendár, ktorý prišiel so zdrojom, sa tiež odpojí, pokiaľ ho nesleduje ešte iný zdroj v tomto projekte.

Tlačidlom *Vrátiť späť* (Ctrl+Z) odpojenie vrátite späť.

### 6. Vyriešte odchýlku

Kópia, ktorá hovorí *sa líši — rozhodnite*, sa líši od položky knižnice. Aplikácia nevyberá, kto má pravdu.

1. Kliknite na označenie *sa líši — rozhodnite* pri zdroji. Otvorí sa okno *Prepojiť knižnicu zdrojov*. Otvorí sa aj samo, keď otvoríte súbor s takouto kópiou.
2. V časti *Odchýlky* vyberte, čo chcete pre položku. Pozrite nižšie.
3. Ak sa ešte nechcete rozhodnúť, kliknite na tlačidlo *Rozhodnúť neskôr*. Okno sa zatvorí a označenie zostane.

Pri odchýlke máte dve možnosti:

- *Použiť hodnoty z knižnice*: kópia dostane údaje z knižnice.
- *Prevziať hodnoty zo súboru do knižnice*: knižnica dostane údaje z vašej kópie. Pod tým je text *Pozor: toto zmení knižnicu a platí pre všetky vaše projekty.* Kópie v ostatných otvorených projektoch sa prispôsobia.

## Časté problémy a čo vtedy urobí aplikácia

**Ukážkové projekty majú vlastnú knižnicu.** Ak otvoríte jeden z troch ukážkových príkladov (*Súbor › Príklady*, alebo cez odkaz v Pomocníkovi), aplikácia raz vytvorí knižnicu *Demo knižnica zdrojov* a projekt k nej prepojí. Zdroje projektu s rovnakým názvom ako položka knižnice sa hneď prepoja, kalendáre nie. Vaše vlastné knižnice sa nemenia. Ak otvoríte dve ukážky vedľa seba, spolu ukážu konflikty v [Používanie prehľadu obsadenosti](docs://howto-bezettingsoverzicht-gebruiken), napríklad pri zdroji *Masonry crew* medzi *Refurbishment & Extension of a Family Home* a *6 New Terraced Houses, De Akkers*.

**Nevidíte prepínač.** Projekt nie je prepojený s knižnicou. Urobte krok 1.

**Knižnicu upravíte omylom.** Panel sa vždy otvorí na *Projekt*, aby sa tomu zabránilo. Zmeny v zobrazení *Knižnica* platia pre všetky projekty a sú mimo funkcie *Vrátiť späť*.

**Zdroj odstránite z knižnice.** Aplikácia najprv zobrazí otázku *Odstrániť „Bricklayer“ z knižnice? Platí to pre všetky projekty a nedá sa to vrátiť späť.* Kópie vo vašich projektoch zostanú a ďalej fungujú. Dostanú označenie *už nie je v knižnici* a sú plne upraviteľné. Tlačidlom *Odstrániť z projektu* kópiu z projektu odstránite.

**V poli *Knižnica zdrojov* vyberiete inú knižnicu alebo možnosť *žiadna knižnica (samostatný projekt)*.** Označenia pôvodu z predchádzajúcej knižnice zmiznú. Zdroje ostanú v projekte ako bežné zdroje projektu. Pri inej knižnici aplikácia znova hľadá zdroje s rovnakým názvom.

**Zdroj nemá návrh v *Rozpoznané*.** Hovorí *Žiadny návrh — vyberte ručne*, ale okno pre to nemá tlačidlo. Zdá sa to ako nedostatok. Pridajte taký zdroj do knižnice pomocou *Presunúť do knižnice* (krok 4).

## Pozri tiež

- [Knižnica zdrojov](docs://uitleg-resourcebibliotheek): čo rozhoduje knižnica, čo rozhoduje projekt a ako kópie sledujú zmeny.
- [Správa a zdieľanie knižníc zdrojov](docs://howto-bibliotheken-beheren): vytváranie, exportovanie a importovanie knižníc.
- [Používanie prehľadu obsadenosti](docs://howto-bezettingsoverzicht-gebruiken): zistiť, či dva projekty žiadajú rovnaký zdroj naraz.
- [Správa zdrojov](docs://howto-resources-beheren): zdroje jedného projektu.

# Používanie prehľadu obsadenosti

Cieľ: zistiť, v ktoré dni dva alebo viac otvorených projektov spolu vyžadujú od zdroja viac, než má knižnica zdrojov.

## Kedy to potrebujete

Vaša parta murárov pracuje na fasádach v jednom projekte a na garážach v inom. Každý projekt ukazuje, že parta je dobre naplánovaná, pretože histogram a preťaženie jedného projektu sa pozerajú len na tento projekt. Až keď projekty položíte vedľa seba, ukáže sa, že v tých istých dňoch spolu potrebujú viac murárov, než máte k dispozícii. Prehľad obsadenosti toto porovnanie urobí za vás.

Prehľad počíta len zdroje, ktoré pochádzajú z knižnice zdrojov, v projektoch prepojených s tou istou knižnicou. Ako sa to počíta, zistíte v článku [Knižnica zdrojov](docs://uitleg-resourcebibliotheek).

## Postup

### 1. Pripravte projekty

1. Otvorte projekty, ktoré chcete porovnať, každý na vlastnej karte, pozrite si [Práca s viacerými projektmi naraz](docs://howto-meerdere-projecten). Prehľad vidí len projekty otvorené v tomto programe.
2. Prepojte každý projekt s rovnakou knižnicou a použite zdroj z knižnice vo všetkých projektoch. Bez prepojenia s knižnicou panel zdrojov prehľad nezobrazí. Pozrite si [Používanie knižnice zdrojov](docs://howto-resourcebibliotheek-gebruiken).
3. Prepočítajte projekty príkazom *Prepočítať* (F5) alebo zapnite *Automatický prepočet*. Čo prehľad robí so zastaranými projektmi, je opísané nižšie, v časti Problémy a čo aplikácia potom robí.

### 2. Otvorte prehľad

1. Prejdite do jedného z projektov a zvoľte *Zdroje › Zostava › Zdroje*.
2. Vpravo hore zvoľte *Obsadenosť*. Prehľad patrí ku knižnici projektu, v ktorom sa nachádzate. V tomto paneli nemôžete nič meniť: je to okno iba na čítanie.

### 3. Prečítajte tabuľku

Každý zdroj z knižnice, ktorý je rezervovaný aspoň v jednom otvorenom projekte, dostane riadok. Zdroje bez rezervácie sa nezobrazia. Riadky s najväčším počtom dní s preťažením sú hore, potom podľa abecedy.

- *Dokumenty* hovorí, v koľkých projektoch je zdroj rezervovaný, napríklad *2 dokumenty*.
- *Obdobie* ide od prvého do posledného dňa so zaťažením, zapísané ako rrrr-mm-dd, napríklad *2027-06-07 – 2027-06-14*.
- *Špička / Kapacita* uvádza najvyššie denné zaťaženie všetkých projektov spolu v porovnaní s kapacitou zdroja v knižnici, napríklad *4,0 / 3,0*. Ak je aspoň jeden deň s preťažením, zobrazí sa červene.
- Červená značka za riadkom, napríklad *3 dni s preťažením*, počíta dni, v ktorých je súčet väčší ako kapacita. Ak nad ňou podržíte kurzor myši, uvidíte dátumy.

### 4. Pozrite sa na jednotlivé projekty

1. Kliknite na malú šípku pred názvom zdroja. Riadok sa rozbalí.
2. Hore sú dátumy s preťažením: prvých päť a potom *… a ďalšie 3*, ak je ich viac. Pod nimi je pri každom projekte jeho názov s obdobím a špičkou samotného projektu, napríklad *Houses North 2027-06-07 – 2027-06-11 Špička: 2,0*.
3. Kliknite na samotný riadok, aby ste dole videli histogram. Každý projekt má vlastnú farbu a stĺpce sú naukladané nad sebou. Prerušovaná čiara je kapacita knižnice. Ak sa mení v čase, uvidíte schody. Dni s preťažením majú za stĺpcami červený pás. Kliknutím na riadok ešte raz histogram zavriete. Bez vybraného riadku sa zobrazí *Vyberte zdroj, aby sa zobrazil histogram.*

### 5. Vyriešte to

Prehľad ukáže problém, ale nevyrieši ho. Máte dve možnosti:

- Presuňte úlohu v jednom z projektov alebo jej priraďte menej jednotiek priradenia za deň. Potom ten projekt prepočítajte klávesom F5.
- Ak naozaj pribudne ďalší človek, zvýšte *Maximálny počet jednotiek* zdroja v knižnici. Urobíte to v *Zdroje › Zostava › Zdroje*, v zobrazení *Knižnica*.

*Vyvažovať…* na páse s nástrojmi tu nepomôže: pozerá sa na zdroje jedného projektu, v ktorom ste. Pozrite si [Vyvažovanie zdrojov](docs://uitleg-nivelleren).

## Problémy a čo aplikácia potom robí

**Prehľad je prázdny.** Zobrazí sa *V otvorených dokumentoch nie sú rezervované žiadne zdroje z knižnice.* Potom žiadny otvorený projekt nemá na žiadnej úlohe zdroj z knižnice.

**Tlačidlo *Obsadenosť* nevidíte.** Projekt, v ktorom sa nachádzate, nie je prepojený so žiadnou knižnicou.

**Projekt sa nepočíta.** Nie je otvorený v tomto programe, je prepojený s inou knižnicou, alebo je zdroj v ňom vlastným zdrojom projektu. Na spodku prehľadu je vždy: *Tento prehľad vidí len dokumenty otvorené v tomto programe.* Kópia zdroja, ktorý sa medzitým odstránil z knižnice, sa tiež nepočíta.

**Kópia alebo variant sa počíta celý.** Počíta sa každý otvorený projekt prepojený s knižnicou, aj keď je kópiou alebo variantom iného otvoreného projektu, napríklad variantom, ktorý vytvoril AI asistent pomocou `planner_duplicate_document`. Pôvodný projekt a variant spolu potom môžu ukázať preťaženie, ktoré v skutočnosti existuje len raz. Prehľad to potichu nefiltruje: zatvorte na chvíľu variant, alebo pri čítaní túto skutočnosť zohľadnite.

**Projekt je zastaraný.** Projekt je zastaraný, ak ste niečo v pláne zmenili bez prepočítania. Prehľad potom s týmto projektom zaobchádza takto:

- Pri projekte, ktorý nie je aktívnou kartou, prehľad sám vopred prepočíta, bez zmeny projektu. Nad tabuľkou potom stojí: *Zmenené dokumenty boli pre tento prehľad vopred prepočítané; stlačte F5 v dokumente alebo zapnite „Automatický prepočet“, aby sa to dialo trvale.* Za projektom stojí: *Pre tento prehľad je už vopred prepočítané — samotný dokument zobrazuje staršie dátumy, kým v ňom nestlačíte F5 alebo nezapnete „Automatický prepočet“.* Ak je *Automatický prepočet* zapnutý (*Nastavenia › Projekt › Nastavenia*, karta *Plán*), aplikácia takéto projekty naozaj prepočíta hneď, ako si prehľad otvoríte, a správa zmizne. Ak je zastaraný aj aktívny projekt, nad tabuľkou sa namiesto toho zobrazí správa z ďalšieho bodu.
- Prehľad nepočíta projekt, v ktorom ste, sám. Ak je tento projekt zastaraný, zobrazí sa: *Zmenený dokument ešte nebol prepočítaný; zobrazuje sa tu s naposledy prepočítanými údajmi. Stlačte F5 v tomto dokumente alebo zapnite „Automatický prepočet“.* Za projektom stojí: *Zastarané: toto sú naposledy prepočítané údaje — stlačte F5 v tomto dokumente.* Pozor: výraz *naposledy prepočítané údaje* nie je celkom presný. Prehľad použije staré počiatočné dátumy, ale už zmenené trvanie alebo priradenie. Údaje sa preto môžu líšiť od starého aj od nového plánu a od pruhov v diagrame Gantt. Dôverujte im až po stlačení F5.
- Ak prehľad projekt nedokáže prepočítať, napríklad kvôli slučke v závislostiach, projekt sa nepočíta. Stále je v zozname, s hláškou: *Nepočíta sa: plán nie je prepočítaný — aktivujte tento dokument a stlačte F5.* Nad tabuľkou je: *Aspoň jeden dokument nie je prepočítaný a nepočíta sa do obsadenosti.*

**Prehľad nezodpovedá tomu, čo očakávate.** Kapacita pochádza z knižnice (*Maximálny počet jednotiek* položky v knižnici alebo jej *Časovo fázovaná kapacita* v ten deň), nie z *Maximálny počet jednotiek* kópie v projekte. Súčet rovný kapacite nie je konflikt.

## Pozrite si aj

- [Knižnica zdrojov](docs://uitleg-resourcebibliotheek): ako sa obsadenosť počíta, s príkladom.
- [Používanie knižnice zdrojov](docs://howto-resourcebibliotheek-gebruiken): prepojenie projektov a priraďovanie zdrojov.
- [Riešenie preťaženia](docs://howto-overbezetting-oplossen): preťaženie v rámci jedného projektu.

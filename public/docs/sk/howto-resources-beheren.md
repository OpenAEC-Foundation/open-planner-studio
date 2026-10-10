# Správa zdrojov

Cieľ: vytvárať, upravovať a odstraňovať zdroje (ľudí, stroje a materiál) vo vašom projekte, aby ste ich mohli priradiť k úlohám.

## Kedy to potrebujete

Skôr než k úlohe priradíte bricklayer alebo žeriav, musí tento človek alebo stroj existovať ako zdroj. Zdroj eviduje, koľko ho je a v ktoré dni pracuje. Aplikácia na tomto základe zistí, či od neho na jeden deň žiadate priveľa. Zdroj upravíte, keď sa zmení obsadenie, napríklad keď pribudne druhý bricklayer.

Dva pojmy. **Maximálny počet jednotiek** je kapacita za pracovný deň: 1 je jeden človek alebo stroj, 2 sú dva z nich. **Priradenie** je zdroj na úlohe (pozri [Priradenie zdrojov s krivkou](docs://howto-resource-toewijzen)).

## Kroky

### Vytvorenie zdroja

1. Vyberte *Zdroje › Zostava › Nový zdroj*. Panel zdrojov prevezme pracovný priestor a na spodku tabuľky sa objaví prázdny riadok. Panel môžete otvoriť aj cez *Zdroje › Zostava › Zdroje* a potom vyberte *Nový zdroj v projekte*.
2. Zadajte názov, napríklad *Bricklayer*.
3. Vyberte *Typ*: *Práca* (predvolená), *Zariadenie*, *Materiál*, *Subdodávateľ* alebo *Pracovná zmena*.
4. Vyplňte ostatné polia, ak treba. Všetko má predvolenú hodnotu: *Maximálny počet jednotiek* je 1 a *Kalendár* je *Kalendár projektu*. *Štandardná sadzba/hod* je prázdna. Pole *Jednotka* môžete vyplniť iba pri type *Materiál*, napríklad m³.
5. Stlačte Enter alebo kliknite mimo riadku. Zdroj je v tabuľke. S klávesom Enter sa pod ním hneď otvorí prázdny riadok pre ďalší zdroj. Ak máte hotovo, stlačte Esc.

Riadok sa stane zdrojom až vtedy, keď má názov. Ak stlačíte Esc alebo kliknete mimo riadku bez názvu, aplikácia nevytvorí nič. Poradie, v akom vyplňujete údaje, nie je dôležité: typ môžete vybrať ako prvý a potom zadať názov.

### Úprava zdroja

Upravte polia v riadku. Aplikácia uloží názov, štandardnú sadzbu a jednotku, keď opustíte pole. Ostatné polia uloží hneď.

- Aplikácia prijme *Maximálny počet jednotiek* iba vtedy, ak je hodnota väčšia ako 0. Pri 0 alebo menej dostane pole červený rámik a vráti sa na predchádzajúcu hodnotu.
- *Kalendár* určuje, v ktoré dni zdroj pracuje. Vyberte *Kalendár projektu* alebo vlastný kalendár. Tlačidlom *+ Kalendár zdroja* vytvoríte nový kalendár a ceruzka (*Upraviť…*) otvorí vybraný kalendár. Ak úloha pracuje v deň, keď je zdroj podľa svojho kalendára voľný, ten deň sa počíta ako preťaženie. Ako vytvoriť kalendár zdroja, je opísané v [Nastavenie kalendára zdroja](docs://howto-resourcekalender-instellen).
- *Štandardná sadzba/hod* a *Celkom*: *Celkom* je počet zaťažených hodín daného zdroja vynásobený štandardnou sadzbou. Omietkár, ktorý je zaťažený 32 hodinami so štandardnou sadzbou 50 za hodinu, dosiahne 1 600,00. Na spodku tabuľky je súčet všetkých zdrojov.
- *Pracovná zmena* zoskupí zdroj pod zdroj typu *Pracovná zmena*. Ide iba o zoskupenie: aplikácia nesčítava kapacitu ani zaťaženie členov do pracovnej zmeny.
- Farebný štvorček vľavo je farba zdroja. Slúži len na zobrazenie a nemá vplyv na plán.

### Kapacita, ktorá sa mení v čase

Prichádza váš druhý bricklayer až 19. júla? Kliknite na šípku vedľa *Maximálny počet jednotiek*. Pod *Časovo fázovaná kapacita* vyberte *Pridať krok*. Každý krok má dátum (*Od*) a číslo (*Maximálny počet jednotiek*). Od tohto dátumu platí toto číslo. Bez krokov vždy platí stála hodnota.

Nový krok začne dnešným dátumom a 1 jednotkou. Zmeňte oboje, inak platí kapacita 1 od dnešného dňa.

### Odstránenie zdroja

1. Kliknite na kôš v riadku.
2. Ak zdroj má priradenia, aplikácia požiada o potvrdenie, napríklad *„Bricklayer“ má počet priradení: 4 — odstrániť?* Kliknutím na značku zdroj odstránite, kliknutím na krížik akciu zrušíte. Bez priradení zdroj zmizne hneď.

Priradenia zdroja sa odstránia spolu s ním. Ak úloha má pravidlo práce iné ako *Pevné trvanie a jednotky priradenia*, aplikácia rozdelí prácu odstráneného zdroja medzi zostávajúce zdroje. Podľa pravidla sa tým zmenia ich jednotky alebo trvanie úlohy. Ak sa zmení trvanie, plán už nie je aktuálny.

Vytváranie, úpravy a odstránenie zdroja môžete vrátiť pomocou *Vrátiť späť* (Ctrl+Z).

### Malý prehľad v bočnom paneli

*Zdroje › Zostava › Ukotvený panel zdrojov* zobrazí kompaktný prehľad v pravom bočnom paneli vedľa *Vlastnosti*. Tam vidíte názov a farbu každého zdroja a výstražný znak (*Preťažený*) pri zdroji, ktorý je preťažený. Tu môžete zmeniť iba *Maximálny počet jednotiek*. Ak vyberiete jednu alebo viac úloh, prehľad zobrazí iba zdroje týchto úloh.

## Úskalia a čo aplikácia potom urobí

**Iba typ *Materiál* mení výpočet.** Typy *Práca*, *Zariadenie*, *Subdodávateľ* a *Pracovná zmena* sa spracúvajú rovnako. Materiál sa nepočíta do trvania úlohy a nevyrovnáva sa. V histograme riadok *Všetky zdroje* materiál tiež nepočíta.

**Bez názvu nie je zdroj.** Prázdny riadok zmizne bez stopy.

**Nový krok v kapacite.** Ak zabudnete zmeniť dátum a číslo, kapacita je od dnešného dňa 1.

**Odstránenie zdroja, ktorý ešte potrebujete.** Ak ho odstránite omylom, hneď stlačte Ctrl+Z. Priradenia sa vrátia tiež.

## Pozri tiež

- [Priradenie zdrojov s krivkou](docs://howto-resource-toewijzen): zdroj priradíte k úlohe.
- [Nastavenie kalendára zdroja](docs://howto-resourcekalender-instellen): nastavenie pracovných dní jedného zdroja.
- [Riešenie preťaženia](docs://howto-overbezetting-oplossen): čo robiť, ak má zdroj v jednom dni priveľa práce.
- [Panel zdrojov](docs://ref-resourcepaneel): všetky polia a tlačidlá panela zdrojov.

# Typy úloh: trvanie, jednotky priradenia a práca

Na úlohu plastering priradíte jedného omietkára a úloha trvá štyri dni. Ak pridáte druhého omietkára, prácu možno urobiť za dva dni. Môže to trvať aj štyri dni, ale s dvojnásobným množstvom práce. Obe možnosti dávajú zmysel. Ktorú z týchto dvoch možností aplikácia zvolí, závisí od **typu úlohy** danej úlohy. V tomto článku sa dozviete, ako aplikácia spája trvanie, jednotky priradenia a prácu a čo každý typ úlohy drží konštantné.

## Princíp

Tri veličiny sú navzájom späté:

- **Trvanie**: ako dlho úloha trvá, v pracovných dňoch alebo v hodinách.
- **Jednotky priradenia**: koľko zdroja pracuje na úlohe za pracovný deň. V paneli *Vlastnosti* sa to volá *Jednotky priradenia*, v iných oknách *Jedn./deň*. Jednotky priradenia 1 znamenajú jedného omietkára na celý deň, 2 znamenajú dvoch omietkárov a 0,5 znamená pol dňa.
- **Práca**: celkový počet hodín, ktoré zdroj strávi na úlohe.

Vzorec je: práca = trvanie × jednotky priradenia × hodiny za pracovný deň. Hodiny za pracovný deň pochádzajú z kalendára úlohy. Úloha plastering so štyrmi pracovnými dňami s jedným omietkárom je pri 8-hodinovom pracovnom dni 4 × 1 × 8 = 32 hodín práce.

Ak zmeníte jednu z troch veličín, aspoň jedna z ostatných sa musí zmeniť tiež. Inak vzorec neplatí. Typ úlohy rozhodne, ktorá to bude. Nastavíte ho pre každú úlohu v paneli *Vlastnosti*. Aplikácia zobrazí typ úlohy a prácu až vtedy, keď ich zapnete. Ako to funguje, je opísané v článku [Výber typu úlohy](docs://howto-werkregel-kiezen).

Typ úlohy platí len pre bežné úlohy. Medzníky, fázy (súhrnné úlohy), hamaky a úlohy, ktorých *Typ trvania* je *Uplynulé trvanie*, ho nemajú: pole *Typ úlohy* tam nie je. Materiál, napríklad betón alebo omietková malta, sa tiež nepočíta. Množstvo materiálu nikdy neurčí trvanie a aplikácia ho kvôli typu úlohy nikdy neupraví.

## Ako aplikácia počíta

### Typ úlohy pôsobí na to, čo zmeníte

Aplikácia prepočíta trvanie, jednotky priradenia a prácu iba vo chvíli, keď zmeníte niektorú z nich: trvanie úlohy, jednotky priradenia, prácu, pridaný alebo odstránený zdroj, alebo hodiny za deň v kalendári. **Prepočítať** (F5) nezmení žiadnu z nich: F5 iba vypočíta dátumy. Ani výber typu úlohy nezmení jediné číslo. Typ úlohy sa uplatní pri vašej ďalšej zmene.

Ak typ úlohy zmení trvanie úlohy, plán je zastaraný. Stavový riadok potom zobrazí *Zastaralé — prepočítajte (F5)*, pokiaľ nie je zapnutý *Automatický prepočet*.

### Štyri typy úloh

V paneli *Vlastnosti* je vedľa rozbaľovacieho zoznamu *Typ úlohy* ikona i. Ukážte na ňu, kliknite na ňu alebo ťuknite na ňu a aplikácia vysvetlí typ úlohy, ktorý platí teraz. V otvorenom rozbaľovacom zozname má aj každá možnosť takúto ikonu i. Vysvetlenie začína tučnou vetou. Štyri typy úloh s touto vetou z aplikácie:

- **Pevné trvanie a jednotky priradenia** (*Práca sa vypočíta z trvania a jednotiek priradenia.*). Toto je predvolené nastavenie. Aplikácia nikdy sama nemení trvanie a práca vyplynie z trvania a jednotiek priradenia. Ak prácu zadáte sami, aplikácia upraví jednotky priradenia, pretože trvanie je pevné.
- **Pevné trvanie a práca** (*Jednotky priradenia sa vypočítajú z trvania a práce.*). Aplikácia nikdy sama nemení trvanie. Ak zmeníte trvanie, práca zostane a jednotky priradenia sa upravia.
- **Pevná práca** (*Trvanie sa vypočíta z práce a jednotiek priradenia.*). Práca je pevná a trvanie vyplynie z práce a jednotiek priradenia.
- **Pevné jednotky priradenia** (*Trvanie sa vypočíta z práce a jednotiek priradenia.*). Jednotky priradenia sú pevné a trvanie vyplynie z práce.

Dva typy úloh teda nechávajú trvanie na pokoji. Pri ostatných dvoch sa trvanie zmení, keď zmeníte jednotky priradenia, prácu alebo počet zdrojov. Pri jednom zdroji sa typy *Pevná práca* a *Pevné jednotky priradenia* správajú presne rovnako. Líšia sa, keď trvanie zmeníte sami: pri type *Pevná práca* práca zostane a jednotky sa upravia, pri type *Pevné jednotky priradenia* jednotky zostanú a práca sa zvýši. Líšia sa aj vtedy, keď je na úlohe viac zdrojov (pozri nižšie).

Príklady nižšie ukazujú, čo každý typ úlohy robí.

### Zaokrúhľovanie

Trvanie, ktoré vyplynie zo súčtu, aplikácia zaokrúhli nahor. Pri úlohe v dňoch sa zaokrúhli na celé pracovné dni, pri úlohe v hodinách na celé minúty. Práca a jednotky priradenia zostanú také, aké ste zadali, alebo aké aplikácia prevzala zo súčtu. Vzorec preto niekedy presne neplatí. Príklad nižšie ukazuje, čo sa vtedy stane.

### Viac zdrojov

Ak má úloha viac zdrojov, platia dve pravidlá. Pri typoch *Pevné trvanie a práca*, *Pevná práca* a *Pevné jednotky priradenia* zostane celková práca rovnaká, keď pridáte alebo odstránite zdroj. Aplikácia ju potom rozdelí úmerne jednotkám priradenia. Pri type *Pevné trvanie a jednotky priradenia* prinesie nový zdroj namiesto toho vlastnú prácu. Pri typoch *Pevná práca* a *Pevné jednotky priradenia* rozhodne o trvaní najpomalší zdroj: pri každom zdroji je to práca delená jednotkami priradenia a rozhodne najväčší výsledok.

Príklad: dva zdroje majú každý 32 hodín práce a jednotky priradenia 1. Spolu trvajú 4 pracovné dni. Jednotky priradenia prvého zdroja nastavíte na 0,5. Trvanie sa potom zmení na 8 pracovných dní. Pri type *Pevná práca* druhý zdroj zachová svoje 32 hodín práce a jeho jednotky priradenia klesnú na 0,5. Pri type *Pevné jednotky priradenia* druhý zdroj zachová jednotky priradenia 1 a jeho práca sa zvýši na 64 hodín.

### Postup

Ak úloha už má postup, typ úlohy pôsobí na zostávajúcu časť: na zostávajúce trvanie a zostávajúcu prácu. V paneli *Vlastnosti* je táto práca v stĺpci *Práca (h)*. To, čo je hotové, zostane.

### Úlohy v hodinách

Úloha, ktorú plánujete v hodinách, sa počíta rovnako, ale v minútach. Ak je na úlohe s trvaním 5 hodín len žeriav, je to 5 hodín práce. Pri type *Pevná práca* sa trvanie pri jednotkách priradenia 2 zmení na 2,5 hodiny. Na úlohe hollow-core floor v praktickom projekte pracuje aj tesárska čata. Úloha stále potrebuje 5 hodín práce a je najpomalšia, a preto trvanie zostane 5 hodín. Ako súvisia hodiny a dni, je vysvetlené v článku [Dni a hodiny](docs://uitleg-dagen-en-uren).

## Príklad s výpočtom: plastering

Príklad je praktický projekt z návodov *House extension*. V návode 5 si to vypočítate sami a skontrolujete čísla. Tu si prečítate, čo každý typ úlohy robí.

Úloha plastering trvá 4 pracovné dni. Je na nej priradený jeden omietkár s jednotkami priradenia 1 a pracovný deň má 8 hodín. Práca je teda 32 hodín.

### Pevné trvanie a jednotky priradenia

- Trvanie nastavíte na 6 pracovných dní: práca vzrastie na 48 hodín, jednotky priradenia zostanú 1.
- Jednotky priradenia nastavíte na 2: trvanie zostane 4 pracovné dni, práca bude 64 hodín.
- Do poľa *Práca (h)* zadáte 48 hodín: trvanie zostane 4 pracovné dni, jednotky priradenia budú 1,5.
- Priradíte druhý zdroj, napríklad *Plasterer 2*, s jednotkami priradenia 1: trvanie zostane 4 pracovné dni a ten druhý prinesie 32 hodín práce, spolu 64 hodín.

### Pevné trvanie a práca

- Trvanie nastavíte na 6 pracovných dní: práca zostane 32 hodín, jednotky priradenia klesnú na 0,67.
- Jednotky priradenia nastavíte na 2: trvanie zostane 4 pracovné dni. Pretože trvanie je pevné, práca vzrastie na 64 hodín.
- Do poľa *Práca (h)* zadáte 16 hodín: trvanie zostane 4 pracovné dni, jednotky priradenia budú 0,5.
- Priradíte druhý zdroj, napríklad *Plasterer 2*, s jednotkami priradenia 1: 32 hodín sa rozdelí, po 16 hodinách, a jednotky priradenia budú pre oboch 0,5. Trvanie zostane 4 pracovné dni.

### Pevná práca

- Trvanie nastavíte na 6 pracovných dní: práca zostane 32 hodín, jednotky priradenia klesnú na 0,67.
- Jednotky priradenia nastavíte na 2: práca zostane 32 hodín a trvanie bude 2 pracovné dni. Tento krok urobíte v návode 5.
- Do poľa *Práca (h)* zadáte 48 hodín: jednotky priradenia zostanú 1 a trvanie bude 6 pracovných dní.
- Priradíte druhý zdroj, napríklad *Plasterer 2*, s jednotkami priradenia 1: 32 hodín sa rozdelí, po 16 hodinách, a trvanie bude 2 pracovné dni. Ak ten druhý zdroj zase odstránite, trvanie bude znova 4 pracovné dni.

### Pevné jednotky priradenia

- Trvanie nastavíte na 6 pracovných dní: jednotky priradenia zostanú 1, práca vzrastie na 48 hodín.
- Jednotky priradenia nastavíte na 2: práca zostane 32 hodín a trvanie bude 2 pracovné dni.
- Do poľa *Práca (h)* zadáte 48 hodín: jednotky priradenia zostanú 1 a trvanie bude 6 pracovných dní.
- Priradíte druhý zdroj, napríklad *Plasterer 2*, s jednotkami priradenia 1: 32 hodín sa rozdelí, po 16 hodinách, a trvanie bude 2 pracovné dni.

### Keď vzorec nevychádza

Pri type *Pevná práca* nastavíte jednotky priradenia na 3. Práca je 32 hodín, takže trvanie bude 32 ÷ (3 × 8) = 1,33 pracovného dňa. Aplikácia to zaokrúhli nahor na 2 pracovné dni. Práca (32 hodín) a jednotky priradenia (3) zostanú, ale 2 × 3 × 8 je 48 hodín. Histogram preto rozloží 32 hodín na 2 pracovné dni: 2 jednotky priradenia za deň, nie 3. Pri poli *Práca (h)* sa zobrazí výstražná značka *Líši sa od jednotiek priradenia × trvania*, ktorá to ukazuje.

Pri dvoch zdrojoch s rozdielnymi jednotkami priradenia to funguje rovnako. Ak pri type *Pevná práca* pridáte druhý zdroj, napríklad *Plasterer 2*, s jednotkami priradenia 2 k omietkárovi s jednotkami priradenia 1, aplikácia rozdelí 32 hodín v pomere 1 : 2, teda 10,7 a 21,3 hodiny. Obaja potom potrebujú 1,33 pracovného dňa. Trvanie bude 2 pracovné dni.

Súbor z Primavera P6 alebo MS Project môže obsahovať aj *Práca (zostáva)*, ktorá sa nerovná jednotkám priradenia × zostávajúcemu trvaniu. Rovnaká výstražná značka sa potom tiež zobrazí. Aplikácia túto prácu sama nezmení. Ak zmeníte trvanie takejto úlohy, aplikácia sa riadi typom úlohy, aj keď zostávajúca práca pochádza zo súboru. Pri type *Pevné trvanie a jednotky priradenia* a type *Pevné jednotky priradenia* sa zostávajúca práca rovná jednotkám priradenia × novému zostávajúcemu trvaniu. Pri type *Pevné trvanie a práca* a type *Pevná práca* práca zostane a jednotky priradenia sa upravia. Ak zostávajúca práca zo súboru takto zmizne, dostanete upozornenie so starým a novým počtom hodín. Ctrl+Z obnoví pôvodnú hodnotu. Vysvetlenie pri výstražnej značke vám pre každú úlohu povie, ktorý z týchto dvoch prípadov nastane.

### Iný kalendár

Pri type *Pevná práca* sa pracovný deň v kalendári zmení z 8 na 6 hodín. Práca zostane 32 hodín, takže trvanie bude 32 ÷ 6 = 5,33, zaokrúhlené nahor na 6 pracovných dní. Ako aplikácia počíta pracovné dni a pracovnú dobu, je vysvetlené v článku [Kalendáre a pracovné dni](docs://uitleg-kalenders). Aplikácia zobrazí: *Po zmene kalendára typ úlohy upravil trvanie pri jednej úlohe (práca zostáva, pracovné hodiny za deň sa zmenili).*

### Úloha s postupom

Úloha inner cavity leaf trvá 5 pracovných dní a je hotová na 40 %: 2 pracovné dni sú hotové a 3 pracovné dni (24 hodín) zostávajú. Pri type *Pevná práca* nastavíte jednotky priradenia z 1 na 2. Zostávajúca práca zostane 24 hodín a zostávajúce trvanie bude 1,5, zaokrúhlené nahor na 2 pracovné dni. Úloha teraz trvá 2 + 2 = 4 pracovné dni a postup je 50 %. Percento sa posunie, pretože hotová časť zostane rovnaká a zvyšok sa skráti.

## Dôsledky a nedorozumenia

**„Pevná práca znamená, že trvanie je pevné.“** Nie, je to naopak. Pri typoch *Pevné trvanie a jednotky priradenia* a *Pevné trvanie a práca* je trvanie pevné. Pri typoch *Pevná práca* a *Pevné jednotky priradenia* vyplynie trvanie z ostatných dvoch.

**„Ak zvolím typ úlohy, môj plán sa zmení.“** Nie. Výber nezmení žiadne číslo. Až pri vašej ďalšej zmene rozhodne typ úlohy, čo sa posunie. Pri type, ktorý chráni prácu, aplikácia prácu v okamihu výberu pevne určí, takže je čo chrániť. Taká úloha potom má uloženú hodnotu *Práca (h)*.

**„Trvanie sa zmenilo bez môjho zásahu.“** To sa môže stať po zmene jednotiek priradenia, práce, počtu zdrojov alebo hodín za deň, pri type *Pevná práca* alebo *Pevné jednotky priradenia*. Stavový riadok potom zobrazí, že plán je zastaraný. Stlačte **Prepočítať** (F5), aby ste videli nové dátumy.

**Bez priradenia typ úlohy nič nerobí.** Vtedy nie sú žiadne jednotky priradenia ani práca, ktoré by sa viazali na trvanie.

**Súbory z MS Project alebo Primavera P6 vždy zobrazia typ úlohy.** Pri úlohe z MS Project aplikácia niekedy ponechá nastavenie riadené úsilím. Toto uložené nastavenie mení dva prípady. Pri type *Pevné trvanie a práca* a nastavení riadené úsilím sa práca posunie, keď zmeníte trvanie, namiesto jednotiek priradenia. Pri type *Pevné jednotky priradenia* a nastavení, ktoré nie je riadené úsilím, sa práca posunie, keď pridáte alebo odstránite zdroj, a trvanie zostane. Úlohy, ktoré vytvoríte v aplikácii, toto nastavenie nemajú. Vysvetlenie za ikonou i toto nastavenie zohľadňuje.

## Pozri aj

- [Výber typu úlohy](docs://howto-werkregel-kiezen): kroky na nastavenie typu úlohy pre úlohu.
- [Priraďovanie zdrojov s krivkou](docs://howto-resource-toewijzen): zdroj priradíte k úlohe s jednotkami priradenia a rozložením práce.
- [Dni a hodiny](docs://uitleg-dagen-en-uren): ako aplikácia prevádza dni na hodiny.
- [Kalendáre a pracovné dni](docs://uitleg-kalenders): ako aplikácia počíta pracovné dni a pracovnú dobu.

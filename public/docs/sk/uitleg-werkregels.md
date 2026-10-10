# Pravidlá práce: trvanie, jednotky priradenia a práca

Na úlohu plastering priradíte jedného omietkára a úloha trvá štyri dni. Ak pridáte druhého omietkára, prácu možno urobiť za dva dni. Môže to trvať aj štyri dni, ale s dvojnásobným množstvom práce. Obe možnosti dávajú zmysel. Ktorú z týchto možností aplikácia zvolí, závisí od **pravidla práce** úlohy. V tomto článku sa dozviete, ako aplikácia spája trvanie, jednotky priradenia a prácu a čo každé pravidlo drží konštantné.

## Pojem

Tri veličiny sú navzájom späté:

- **Trvanie**: ako dlho úloha trvá, v pracovných dňoch alebo v hodinách.
- **Jednotky priradenia**: koľko zdroja pracuje na úlohe za pracovný deň. V aplikácii sa to volá *Jedn./deň*. Jednotky priradenia 1 znamenajú jedného omietkára na celý deň, 2 znamenajú dvoch omietkárov a 0,5 znamená pol dňa.
- **Práca**: celkový počet hodín, ktoré zdroj strávi na úlohe.

Súčet je: práca = trvanie × jednotky priradenia × hodiny za pracovný deň. Hodiny za pracovný deň pochádzajú z kalendára úlohy. Úloha plastering, ktorá trvá štyri pracovné dni s jedným omietkárom, predstavuje, ak pracovný deň má 8 hodín, 4 × 1 × 8 = 32 hodín práce.

Ak zmeníte jednu z troch veličín, aspoň jedna z ostatných sa musí zmeniť tiež. Inak súčet neplatí. Pravidlo práce rozhodne, ktorá to bude. Nastavíte ho pre každú úlohu v paneli *Vlastnosti*. Aplikácia zobrazí pravidlo práce a prácu, až keď ich zapnete. Ako to funguje, je opísané v článku [Výber pravidla práce](docs://howto-werkregel-kiezen).

Pravidlo práce funguje len pri bežných úlohách. Medzníky, fázy (súhrnné úlohy), hamaky a úlohy, ktorých *Typ trvania* je *Uplynulé trvanie*, ho nemajú: pole *Pravidlo práce* tam nie je. Materiál, napríklad betón alebo omietková malta, sa tiež neberie do úvahy. Množstvo materiálu nikdy neurčuje trvanie a aplikácia ho kvôli pravidlu práce nikdy neupraví.

## Ako aplikácia počíta

### Pravidlo pôsobí na to, čo zmeníte

Aplikácia prepočíta trvanie, jednotky priradenia a prácu iba vo chvíli, keď zmeníte niektorú z nich: trvanie úlohy, jednotky priradenia, prácu, pridaný alebo odstránený zdroj či hodiny za deň v kalendári. **Prepočítať** (F5) nezmení žiadnu z nich: F5 iba vypočíta dátumy. Ani výber pravidla nezmení jediné číslo. Pravidlo sa uplatní pri vašej ďalšej zmene.

Ak pravidlo práce zmení trvanie úlohy, plán je zastaraný. Stavový riadok potom zobrazí *Zastaralé — prepočítajte (F5)*, ak nie je zapnutý *Automatický prepočet*.

### Štyri pravidlá

V paneli *Vlastnosti* pod rozbaľovacím zoznamom aplikácia zobrazí, čo zvolené pravidlo chráni. Štyri pravidlá s textom aplikácie:

- **Pevné trvanie a jednotky priradenia** (*Chránené: trvanie a jednotky priradenia (práca nasleduje)*). Toto je predvolené nastavenie. Aplikácia nikdy sama nemení trvanie a práca vyplynie z trvania a jednotiek priradenia. Ak prácu zadáte sami, aplikácia upraví jednotky priradenia, pretože trvanie je pevné.
- **Pevné trvanie a práca** (*Chránené: trvanie a práca (jednotky nasledujú)*). Aplikácia nikdy sama nemení trvanie. Ak zmeníte trvanie, práca zostane a jednotky priradenia sa upravia.
- **Pevná práca** (*Chránené: práca (trvanie sa riadi jednotkami)*). Práca je pevná a trvanie vyplynie z práce a jednotiek priradenia.
- **Pevné jednotky priradenia** (*Chránené: jednotky priradenia (trvanie sa riadi prácou)*). Jednotky priradenia sú pevné a trvanie vyplynie z práce.

Dve pravidlá teda nechávajú trvanie na pokoji. Pri ostatných dvoch sa trvanie zmení, keď zmeníte jednotky priradenia, prácu alebo počet zdrojov. Pri jednom zdroji sa pravidlá *Pevná práca* a *Pevné jednotky priradenia* správajú presne rovnako. Líšia sa, keď trvanie zmeníte sami: pri pravidle *Pevná práca* práca zostane a jednotky sa upravia, pri pravidle *Pevné jednotky priradenia* jednotky zostanú a práca sa zvýši. Líšia sa aj vtedy, keď je na úlohe viac zdrojov (pozri nižšie).

Príklady nižšie ukazujú, čo každé pravidlo robí.

### Zaokrúhľovanie

Trvanie, ktoré vyplynie zo súčtu, aplikácia zaokrúhli nahor. Pri úlohe v dňoch sa zaokrúhli na celé pracovné dni, pri úlohe v hodinách na celé minúty. Práca a jednotky priradenia zostanú také, aké ste zadali, alebo aké aplikácia prevzala zo súčtu. Súčet preto niekedy presne neplatí. Príklad nižšie ukazuje, čo sa vtedy stane.

### Viac zdrojov

Ak má úloha viac zdrojov, platia dve pravidlá. Pri pravidlách *Pevné trvanie a práca*, *Pevná práca* a *Pevné jednotky priradenia* zostane celková práca rovnaká, keď pridáte alebo odstránite zdroj. Aplikácia ju potom rozdelí úmerne jednotkám priradenia. Pri pravidle *Pevné trvanie a jednotky priradenia* prinesie nový zdroj namiesto toho vlastnú prácu. Pri pravidlách *Pevná práca* a *Pevné jednotky priradenia* rozhoduje o trvaní najpomalší zdroj: pri každom zdroji je to práca delená jednotkami priradenia a rozhoduje najväčší výsledok.

Príklad: dva zdroje majú každý 32 hodín práce a jednotky priradenia 1. Spolu trvajú 4 pracovné dni. Jednotky priradenia prvého zdroja nastavíte na 0,5. Trvanie sa potom zmení na 8 pracovných dní. Pri pravidle *Pevná práca* druhý zdroj zachová svojich 32 hodín práce a jeho jednotky priradenia klesnú na 0,5. Pri pravidle *Pevné jednotky priradenia* druhý zdroj zachová jednotky priradenia 1 a jeho práca sa zvýši na 64 hodín.

### Postup

Ak úloha už má postup, pravidlo pôsobí na zostávajúcu časť: na zostávajúce trvanie a zostávajúcu prácu. V aplikácii sa táto práca volá *Práca (zostáva)*. To, čo je hotové, zostane.

### Úlohy v hodinách

Hodinová úloha, ktorú plánujete v hodinách, sa počíta rovnako, ale v minútach. Ak je na úlohe s trvaním 5 hodín len žeriav, je to 5 hodín práce. Pri pravidle *Pevná práca* sa trvanie pri jednotkách priradenia 2 zmení na 2,5 hodiny. Na úlohe hollow-core floor v praktickom projekte pracuje aj tesárska čata. Úloha stále potrebuje 5 hodín práce a je najpomalšia, a preto trvanie zostane 5 hodín. Ako súvisia hodiny a dni, je vysvetlené v článku [Dni a hodiny](docs://uitleg-dagen-en-uren).

## Príklad s výpočtom: plastering

Príklad je praktický projekt návodov, *House extension*. V návode 5 si to vypočítate sami a skontrolujete čísla. Tu si prečítate, čo každé pravidlo robí.

Úloha plastering trvá 4 pracovné dni. Na nej je priradený jeden omietkár s jednotkami priradenia 1 a pracovný deň má 8 hodín. Práca je teda 32 hodín.

### Pevné trvanie a jednotky priradenia

- Trvanie nastavíte na 6 pracovných dní: práca vzrastie na 48 hodín, jednotky priradenia zostanú 1.
- Jednotky priradenia nastavíte na 2: trvanie zostane 4 pracovné dni, práca bude 64 hodín.
- Do poľa *Práca (zostáva)* zadáte 48 hodín: trvanie zostane 4 pracovné dni, jednotky priradenia budú 1,5.
- Priradíte druhý zdroj, napríklad *Plasterer 2*, s jednotkami priradenia 1: trvanie zostane 4 pracovné dni a ten druhý prinesie 32 hodín práce, spolu 64 hodín.

### Pevné trvanie a práca

- Trvanie nastavíte na 6 pracovných dní: práca zostane 32 hodín, jednotky priradenia klesnú na 0.67.
- Jednotky priradenia nastavíte na 2: trvanie zostane 4 pracovné dni. Pretože trvanie je pevné, práca vzrastie na 64 hodín.
- Do poľa *Práca (zostáva)* zadáte 16 hodín: trvanie zostane 4 pracovné dni, jednotky priradenia budú 0,5.
- Priradíte druhý zdroj, napríklad *Plasterer 2*, s jednotkami priradenia 1: 32 hodín sa rozdelí, po 16 hodín, a jednotky priradenia budú pre oboch 0,5. Trvanie zostane 4 pracovné dni.

### Pevná práca

- Trvanie nastavíte na 6 pracovných dní: práca zostane 32 hodín, jednotky priradenia klesnú na 0.67.
- Jednotky priradenia nastavíte na 2: práca zostane 32 hodín a trvanie bude 2 pracovné dni. Tento krok urobíte v návode 5.
- Do poľa *Práca (zostáva)* zadáte 48 hodín: jednotky priradenia zostanú 1 a trvanie bude 6 pracovných dní.
- Priradíte druhý zdroj, napríklad *Plasterer 2*, s jednotkami priradenia 1: 32 hodín sa rozdelí, po 16 hodín, a trvanie bude 2 pracovné dni. Ak ten druhý zdroj zase odstránite, trvanie bude znova 4 pracovné dni.

### Pevné jednotky priradenia

- Trvanie nastavíte na 6 pracovných dní: jednotky priradenia zostanú 1, práca vzrastie na 48 hodín.
- Jednotky priradenia nastavíte na 2: práca zostane 32 hodín a trvanie bude 2 pracovné dni.
- Do poľa *Práca (zostáva)* zadáte 48 hodín: jednotky priradenia zostanú 1 a trvanie bude 6 pracovných dní.
- Priradíte druhý zdroj, napríklad *Plasterer 2*, s jednotkami priradenia 1: 32 hodín sa rozdelí, po 16 hodinách, a trvanie bude 2 pracovné dni.

### Keď súčet nevychádza

Pri pravidle *Pevná práca* nastavíte jednotky priradenia na 3. Práca je 32 hodín, takže trvanie bude 32 ÷ (3 × 8) = 1,33 pracovného dňa. Aplikácia to zaokrúhli nahor na 2 pracovné dni. Práca (32 hodín) a jednotky priradenia (3) zostanú, ale 2 × 3 × 8 je 48 hodín. Histogram preto rozloží 32 hodín na 2 pracovné dni: 2 jednotky priradenia za deň, nie 3. Vedľa *Práca (zostáva)* sa zobrazí výstražná značka *Líši sa od jednotiek priradenia × trvania*, ktorá to ukazuje.

Pri dvoch zdrojoch s rozdielnymi jednotkami priradenia to funguje rovnako. Ak pri pravidle *Pevná práca* pridáte druhý zdroj, napríklad *Plasterer 2*, s jednotkami priradenia 2 k omietkárovi s jednotkami priradenia 1, aplikácia rozdelí 32 hodín v pomere 1 : 2, teda 10,7 a 21,3 hodiny. Obaja potom potrebujú 1,33 pracovného dňa. Trvanie bude 2 pracovné dni.

### Iný kalendár

Pri pravidle *Pevná práca* sa pracovný deň v kalendári zmení z 8 na 6 hodín. Práca zostane 32 hodín, takže trvanie bude 32 ÷ 6 = 5,33, zaokrúhlené nahor na 6 pracovných dní. Ako aplikácia počíta pracovné dni a pracovnú dobu, je vysvetlené v článku [Kalendáre a pracovné dni](docs://uitleg-kalenders). Aplikácia zobrazí: *Pravidlo práce po zmene kalendára upravilo trvanie jednej úlohy (práca zostáva, hodiny za deň sa zmenili).*

### Úloha s postupom

Úloha inner cavity leaf trvá 5 pracovných dní a je hotová na 40%: 2 pracovné dni sú hotové a 3 pracovné dni (24 hodín) zostávajú. Pri pravidle *Pevná práca* nastavíte jednotky priradenia z 1 na 2. Zostávajúca práca zostane 24 hodín a zostávajúce trvanie bude 1,5, zaokrúhlené nahor na 2 pracovné dni. Úloha teraz trvá 2 + 2 = 4 pracovné dni a postup je 50%. Percento sa posunie, pretože hotová časť zostane rovnaká a zvyšok sa skráti.

## Dôsledky a nedorozumenia

**„Pevná práca znamená, že trvanie je pevné.“** Nie, je to naopak. Pri pravidlách *Pevné trvanie a jednotky priradenia* a *Pevné trvanie a práca* je trvanie pevné. Pri pravidlách *Pevná práca* a *Pevné jednotky priradenia* vyplynie trvanie z ostatných dvoch.

**„Ak zvolím pravidlo, môj plán sa zmení.“** Nie. Výber nezmení žiadne číslo. Až pri vašej ďalšej zmene pravidlo rozhodne, čo sa posunie. Pri pravidle, ktoré chráni prácu, aplikácia prácu v okamihu výberu pevne určí, takže je čo chrániť. Taká úloha potom má uloženú hodnotu *Práca (zostáva)*.

**„Trvanie sa zmenilo bez môjho zásahu.“** To sa môže stať po zmene jednotiek priradenia, práce, počtu zdrojov alebo hodín za deň, pri pravidlách *Pevná práca* alebo *Pevné jednotky priradenia*. Stavový riadok potom zobrazí, že plán je zastaraný. Stlačte **Prepočítať** (F5), aby ste videli nové dátumy.

**Bez priradenia pravidlo práce nič nerobí.** Vtedy nie sú žiadne jednotky priradenia ani práca, ktoré by sa viazali na trvanie.

**Súbory z MS Project alebo Primavera P6 vždy zobrazia pravidlo práce.** Pri úlohe z MS Project sa pod pravidlom niekedy zobrazí text *Z MS Project: riadené úsilím* alebo *Z MS Project: nie je riadené úsilím*. Toto uložené nastavenie mení dva prípady. Pri pravidle *Pevné trvanie a práca* a nastavení riadené úsilím sa práca posunie, keď zmeníte trvanie, namiesto jednotiek priradenia. Pri pravidle *Pevné jednotky priradenia* a nastavení nie je riadené úsilím sa práca posunie, keď pridáte alebo odstránite zdroj, a trvanie zostane. Úlohy, ktoré vytvoríte v aplikácii, toto nastavenie nemajú.

## Pozri aj

- [Výber pravidla práce](docs://howto-werkregel-kiezen): kroky na nastavenie pravidla práce úlohy.
- [Priraďovanie zdrojov s krivkou](docs://howto-resource-toewijzen): zdroj priradíte k úlohe s jednotkami priradenia a rozložením práce.
- [Dni a hodiny](docs://uitleg-dagen-en-uren): ako aplikácia prevádza dni na hodiny.
- [Kalendáre a pracovné dni](docs://uitleg-kalenders): ako aplikácia počíta pracovné dni a pracovnú dobu.

# Výber pravidla práce

Cieľ: pre každú úlohu nastavte, čo aplikácia upraví, keď zmeníte trvanie, jednotky priradenia alebo prácu: samotné trvanie, jednotky priradenia alebo prácu.

## Kedy to potrebujete

Na úlohu ste priradili zdroje a chcete, aby aplikácia počítala tak, ako vy. Jeden príklad: žeriav je prenajatý na jeden deň a ten deň je pevný. Iný príklad: viete, že je v nej 160 hodín murárskych prác, a chcete zistiť, ako dlho to potrvá s tromi ľuďmi namiesto dvoch. Tieto dve situácie potrebujú iné pravidlo práce.

Pravidlo určuje, ktorá z troch veličín – trvanie, jednotky priradenia alebo práca – sa prispôsobí, keď zmeníte inú. Pozadie a vypracované príklady nájdete v článku [Pravidlá práce: trvanie, jednotky priradenia a práca](docs://uitleg-werkregels).

## Postup

### Zobrazenie pravidla práce

Pravidlo práce sa predvolene nezobrazuje. Zapnite ho raz:

1. Vyberte *Nastavenia › Projekt › Nastavenia*, kartu *Plán*.
2. Pod nadpisom *Prepočítanie* zaškrtnite *Zobraziť pravidla práce a prácu*.
3. Okno zatvorte tlačidlom *Zavrieť*.

Toto je nastavenie aplikácie, nie projektového súboru. Ak súbor už obsahuje pravidlá práce alebo uloženú prácu, napríklad súbor z MS Project alebo Primavera P6, aplikácia zobrazí pravidlo práce pre tento súbor aj bez tohto nastavenia. Rovnako to platí, keď v súbore sami vyberiete pravidlo práce: zobrazenie potom zostane zapnuté pre tento súbor, aj keď nastavenie znova vypnete. Zostane zapnuté, kým je súbor otvorený, a po opätovnom otvorení, kým súbor obsahuje pravidlo práce alebo uloženú prácu.

### Výber pravidla

1. Vyberte úlohu. Panel *Vlastnosti* je vpravo. Ak ho nevidíte, zapnite ho cez *Zobrazenie › Panely › Vlastnosti*.
2. V poli *Pravidlo práce* vyberte jednu z piatich možností: *Štandard projektu (Pevné trvanie a jednotky priradenia)*, *Pevné trvanie a jednotky priradenia*, *Pevné trvanie a práca*, *Pevná práca* alebo *Pevné jednotky priradenia*. Ak zvolíte *Štandard projektu*, úloha nasleduje štandard projektu.
3. Pod rozbaľovacím zoznamom aplikácia zobrazí, čo pravidlo chráni, napríklad *Chránené: práca (trvanie sa riadi jednotkami)*.

*Štandard projektu* je prvá možnosť a úloha ju má predvolene. Pravidlo v zátvorkách je pravidlo, ktoré má projekt teraz ako štandard. Aplikácia nemá tlačidlo na zmenu tohto štandardu projektu: štandard pochádza z importu (napríklad z MS Project alebo Primavera P6) alebo z pripojenia MCP. Ak chcete pre jednu úlohu iné pravidlo, vyberte ho tu.

Pravidlo môžete vybrať aj v tabuľke. Kliknite na **+** vpravo v hlavičke tabuľky úloh (*Pridať stĺpec*) a v skupine *Plánovanie* vyberte stĺpec *Pravidlo práce*.

Úloha bez priradenia nemá, čo spájať, takže pravidlo tam nič nerobí. Najprv priraďte zdroj (pozrite [Priraďovanie zdrojov s krivkou](docs://howto-resource-toewijzen)).

### Zobrazenie a zmena práce

Pri úlohe s priradeniami sa v bloku *Priradenia* na paneli *Vlastnosti* objaví stĺpec *Práca (zostáva)* vedľa *Jedn./deň*. Je to zostávajúca práca daného zdroja v hodinách. Malý zámok nad stĺpcom ukazuje, čo pravidlo drží pevné: pri pravidlách *Pevné trvanie a jednotky priradenia* a *Pevné jednotky priradenia* je to *Jedn./deň*, pri pravidlách *Pevné trvanie a práca* a *Pevná práca* je to *Práca (zostáva)*.

Ak chcete prácu zmeniť sami, zapíšte hodiny do poľa a stlačte Enter. Aplikácia neprijme hodnotu 0 alebo menej: pole sa vráti na predchádzajúcu hodnotu.

### Zistenie, čo sa stane

Ak vyberiete pravidlo, zatiaľ sa žiadne číslo nezmení. Pri pravidle, ktoré chráni prácu, aplikácia len zafixuje aktuálnu prácu, takže *Práca (zostáva)* má uloženú hodnotu. Pravidlo rozhodne, čo sa prispôsobí, až pri ďalšej zmene. Zmeňte napríklad *Jedn./deň* a pozrite sa, čo sa stane s trvaním a prácou.

Ak sa tým zmení trvanie úlohy, stavový riadok zobrazí *Zastaralé — prepočítajte (F5)*. Stlačte **Prepočítať** (F5), napríklad cez *Domov › Plán › Prepočítať*, aby ste videli nové dátumy. Ak je zapnutý *Automatický prepočet* (na tej istej karte *Plán*, pod nadpisom *Prepočítanie*), aplikácia to urobí sama.

## Ktoré pravidlo sa hodí

- **Pevné trvanie a jednotky priradenia** sa hodí, keď je trvanie dohodnuté a jednotky zadávate vy. Práca z nich vyplýva. Toto je predvolená voľba. Žeriav prenajatý na jeden deň patrí sem: deň je pevný a vy určíte, koľko žeriavov na ňom je.
- **Pevné trvanie a práca** sa hodí, keď sa úloha musí dokončiť v pevnom období a viete, koľko práce v nej je. Ak sa trvanie zmení, aplikácia upraví jednotky priradenia.
- **Pevná práca** sa hodí, keď viete, koľko hodín práce v nej je, a chcete vidieť, ako sa trvanie mení s počtom ľudí. Sem patrí 160 hodín murárskych prác s tromi ľuďmi namiesto dvoch. Omietanie v cvičnom projekte dostáva toto pravidlo.
- **Pevné jednotky priradenia** sa hodí, keď sú jednotky pevné, napríklad jeden žeriav, a práca určí trvanie.

## Časté chyby a čo aplikácia vtedy urobí

**Pole *Pravidlo práce* chýba.** Vtedy je nastavenie *Zobraziť pravidlá práce a prácu* vypnuté a súbor zatiaľ nemá pravidlá práce, alebo ste vybrali medzník, fázu, hamak alebo úlohu s typom trvania *Uplynulé trvanie*. Tam pravidlo práce nie je. Vyberte bežnú úlohu.

**Trvanie sa zmení, hoci ho nemeníte.** Pri pravidlách *Pevná práca* a *Pevné jednotky priradenia* vyplýva trvanie z jednotiek a práce. Ak zmeníte jednu z nich alebo počet zdrojov, aplikácia upraví trvanie a zaokrúhli ho nahor na celé pracovné dni. Pri úlohe v hodinách aplikácia zaokrúhli nahor na celé minúty.

**Práca presne nezodpovedá jednotkám priradenia × trvaniu.** Môže to spôsobiť zaokrúhľovanie. Vedľa *Práca (zostáva)* sa potom zobrazí výstražný znak *Líši sa od jednotiek priradenia × trvania*. Histogram zobrazuje uloženú prácu.

**Materiál sa nepočíta.** Pri materiálovom zdroji *Práca (zostáva)* zobrazuje pomlčku. Materiál nikdy neurčuje trvanie.

**Úloha s postupom.** Pravidlo pracuje so zostávajúcou časťou úlohy. *Práca (zostáva)* preto zobrazuje len to, čo ešte musí prebehnúť.

**Vrátenie zmeny.** Výber pravidla a každá zmena, ktorú pravidlo vypočíta, je jeden krok. *Vrátiť späť* (Ctrl+Z) to vráti naraz. Pravidlo sa potom zruší, ale pole *Pravidlo práce* zostane zobrazené.

## Pozrite tiež

- [Pravidlá práce: trvanie, jednotky priradenia a práca](docs://uitleg-werkregels): ako aplikácia spája trvanie, jednotky priradenia a prácu, s vypracovanými príkladmi.
- [Priraďovanie zdrojov s krivkou](docs://howto-resource-toewijzen): zdroj priradíte k úlohe.

# Výber typu úlohy

Cieľ: pre každú úlohu nastavte, čo aplikácia upraví, keď zmeníte trvanie, jednotky priradenia alebo prácu: samotné trvanie, jednotky priradenia alebo prácu.

## Kedy to potrebujete

Na úlohu ste priradili zdroje a chcete, aby aplikácia počítala tak, ako vy. Jeden príklad: žeriav je prenajatý na jeden deň a ten deň je pevný. Iný príklad: viete, že je v nej 160 hodín murárskych prác, a chcete zistiť, ako dlho to potrvá s tromi ľuďmi namiesto dvoch. Tieto dve situácie potrebujú iný typ úlohy.

Typ úlohy určuje, ktorá z troch veličín – trvanie, jednotky priradenia alebo práca – sa prispôsobí, keď zmeníte inú. Pozadie a vypracované príklady nájdete v článku [Typy úloh: trvanie, jednotky priradenia a práca](docs://uitleg-werkregels).

## Postup

### Zobrazenie typu úlohy

Typ úlohy sa predvolene nezobrazuje. Zapnite ho raz:

1. Vyberte *Nastavenia › Projekt › Nastavenia aplikácie*, kartu *Plán*.
2. Pod nadpisom *Prepočítanie* zaškrtnite *Používať typy úloh*.
3. Okno zatvorte tlačidlom *Zavrieť*.

Toto je nastavenie aplikácie, nie projektového súboru. Ak súbor už obsahuje typy úloh alebo uloženú prácu, napríklad súbor z MS Project alebo Primavera P6, aplikácia zobrazí typ úlohy pre tento súbor aj bez tohto nastavenia. Rovnako to platí, keď v súbore sami vyberiete typ úlohy: zobrazenie potom zostane zapnuté pre tento súbor, aj keď nastavenie znova vypnete. Zostane zapnuté, kým je súbor otvorený, a po opätovnom otvorení, kým súbor obsahuje typ úlohy alebo uloženú prácu.

### Nastavenie typu úlohy

1. Vyberte úlohu. Panel *Vlastnosti* je vpravo. Ak ho nevidíte, zapnite ho cez *Zobrazenie › Panely › Vlastnosti*.
2. V poli *Typ úlohy* vyberte jednu z piatich možností: *Štandard projektu (Pevné trvanie a jednotky priradenia)*, *Pevné trvanie a jednotky priradenia*, *Pevné trvanie a práca*, *Pevná práca* alebo *Pevné jednotky priradenia*. Ak zvolíte *Štandard projektu*, úloha nasleduje štandard projektu.
3. Chcete vedieť, čo možnosť robí? V otvorenom rozbaľovacom zozname má každá možnosť ikonu i. Ukážte na ňu, kliknite na ňu alebo ťuknite na ňu, aby sa zobrazilo vysvetlenie. Kliknutie na ikonu i ešte nevyberie daný typ úlohy.
4. Vedľa zatvoreného poľa je tiež ikona i. Vysvetľuje typ úlohy, ktorý platí teraz, napríklad *Trvanie sa vypočíta z práce a jednotiek priradenia.* Pri možnosti *Štandard projektu* je to typ úlohy v zátvorkách.

*Štandard projektu* je prvá možnosť a úloha ju má predvolene. Typ úlohy v zátvorkách je ten, ktorý má projekt teraz ako štandard. Aplikácia nemá tlačidlo na zmenu tohto štandardu projektu: štandard pochádza z importu (napríklad z MS Project alebo Primavera P6) alebo z pripojenia MCP. Ak chcete pre jednu úlohu iný typ úlohy, vyberte ho tu.

Typ úlohy môžete vybrať aj v tabuľke. Kliknite na **+** vpravo v hlavičke tabuľky úloh (*Pridať stĺpec*) a v skupine *Plánovanie* vyberte stĺpec *Typ úlohy*.

Úloha bez priradenia nemá, čo spájať, takže typ úlohy tam nič nerobí. Najprv priraďte zdroj (pozrite [Priraďovanie zdrojov s krivkou](docs://howto-resource-toewijzen)).

### Zobrazenie a zmena práce

Pri úlohe s priradeniami sa v bloku *Priradenia* na paneli *Vlastnosti* vedľa stĺpca *Jednotky priradenia* zobrazí stĺpec *Práca (h)*. Je to zostávajúca práca tohto zdroja v hodinách. Malý zámok nad stĺpcom ukazuje, čo typ úlohy drží pevné. Ak je typ *Pevné trvanie a jednotky priradenia* alebo *Pevné jednotky priradenia*, zámok drží *Jednotky priradenia*. Ak je typ *Pevné trvanie a práca* alebo *Pevná práca*, zámok drží *Práca (h)*.

Ak chcete prácu zmeniť sami, zapíšte hodiny do poľa a stlačte Enter. Aplikácia neprijme hodnotu 0 alebo menej: pole sa vráti na predchádzajúcu hodnotu.

### Zistenie, čo sa stane

Ak vyberiete typ úlohy, zatiaľ sa žiadne číslo nezmení. Ak typ úlohy chráni prácu, aplikácia len zafixuje aktuálnu prácu, takže *Práca (h)* má uloženú hodnotu. Typ úlohy rozhodne, čo sa prispôsobí, až pri ďalšej zmene. Zmeňte napríklad *Jednotky priradenia* a pozrite sa, čo sa stane s trvaním a prácou.

Ak sa tým zmení trvanie úlohy, stavový riadok zobrazí *Zastaralé — prepočítajte (F5)*. Stlačte **Prepočítať** (F5), napríklad cez *Domov › Plán › Prepočítať*, aby ste videli nové dátumy. Ak je zapnutý *Automatický prepočet* (na tej istej karte *Plán*, pod nadpisom *Prepočítanie*), aplikácia to urobí sama.

## Ktorý typ úlohy sa hodí

- **Pevné trvanie a jednotky priradenia** sa hodí, keď je trvanie dohodnuté a jednotky zadávate vy. Práca z nich vyplýva. Toto je predvolená voľba. Žeriav prenajatý na jeden deň patrí sem: deň je pevný a vy určíte, koľko žeriavov na ňom je.
- **Pevné trvanie a práca** sa hodí, keď sa úloha musí dokončiť v pevnom období a viete, koľko práce v nej je. Ak sa trvanie zmení, aplikácia upraví jednotky priradenia.
- **Pevná práca** sa hodí, keď viete, koľko hodín práce v nej je, a chcete vidieť, ako sa trvanie mení s počtom ľudí. Sem patrí 160 hodín murárskych prác s tromi ľuďmi namiesto dvoch. Omietanie v cvičnom projekte dostáva tento typ úlohy.
- **Pevné jednotky priradenia** sa hodí, keď sú jednotky pevné, napríklad jeden žeriav, a práca určí trvanie.

## Časté chyby a čo aplikácia vtedy urobí

**Pole *Typ úlohy* chýba.** Vtedy je nastavenie *Používať typy úloh* vypnuté a súbor zatiaľ nemá typy úloh, alebo ste vybrali medzník, fázu, hamak alebo úlohu s typom trvania *Uplynulé trvanie*. Typ úlohy tam nie je. Vyberte bežnú úlohu.

**Trvanie sa zmení, hoci ho nemeníte.** Ak je typ úlohy *Pevná práca* alebo *Pevné jednotky priradenia*, vyplýva trvanie z jednotiek a práce. Ak zmeníte jednu z nich alebo počet zdrojov, aplikácia upraví trvanie a zaokrúhli ho nahor na celé pracovné dni. Pri úlohe v hodinách aplikácia zaokrúhli nahor na celé minúty.

**Práca presne nezodpovedá jednotkám priradenia × trvaniu.** Môže to spôsobiť zaokrúhľovanie. V poli *Práca (h)* sa potom zobrazí výstražný znak *Líši sa od jednotiek priradenia × trvania*. Histogram zobrazuje uloženú prácu.

**Materiál sa nepočíta.** Pri materiálovom zdroji *Práca (h)* zobrazuje pomlčku. Materiál nikdy neurčuje trvanie.

**Úloha s postupom.** Typ úlohy pracuje so zostávajúcou časťou úlohy. Preto *Práca (h)* zobrazuje len to, čo ešte musí prebehnúť.

**Vrátenie zmeny.** Výber typu úlohy a každá zmena, ktorú typ úlohy vypočíta, je jeden krok. *Vrátiť späť* (Ctrl+Z) to vráti naraz. Typ úlohy sa potom zruší, ale pole *Typ úlohy* zostane zobrazené.

## Pozrite tiež

- [Typy úloh: trvanie, jednotky priradenia a práca](docs://uitleg-werkregels): ako aplikácia spája trvanie, jednotky priradenia a prácu, s vypracovanými príkladmi.
- [Priraďovanie zdrojov s krivkou](docs://howto-resource-toewijzen): zdroj priradíte k úlohe.

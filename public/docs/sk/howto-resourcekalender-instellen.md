# Nastavenie kalendára zdroja

Cieľ: zaznamenať, v ktoré dni je zdroj k dispozícii, aby s tým histogram, preťaženie a vyvažovanie počítali.

## Kedy to potrebujete

Murárska čata pracuje len od pondelka do štvrtka. Žeriav je v prvých dvoch augustových týždňoch na inom projekte. Subdodávateľ má štyri pevné pracovné dni. Bez vlastného kalendára aplikácia predpokladá, že zdroj pracuje v dňoch projektového kalendára.

Kalendár zdroja nemení žiadny dátum úlohy. Určuje len, kedy je zdroj k dispozícii. Ak úloha beží v deň, keď zdroj nepracuje, kapacita v ten deň je 0 a deň sa počíta ako preťažený. Ak chcete, aby úloha bežala v iné dni, dajte úlohe vlastný kalendár ([Vytvorenie a priradenie kalendára](docs://howto-kalender-maken-en-toewijzen)). Rozdiel je popísaný v [Kalendáre a pracovné dni](docs://uitleg-kalenders).

## Postup

### Vytvorenie nového kalendára zdroja

1. Vyberte *Zdroje › Spravovať › Zdroje*. Otvorí sa panel zdrojov. Ak zdroj ešte neexistuje, vytvorte ho pomocou *Nový zdroj v projekte*.
2. Nájdite riadok zdroja. V stĺpci *Kalendár* je predvolená hodnota *Projektový kalendár*: zdroj potom používa projektový kalendár.
3. V tomto zozname vyberte *+ Kalendár zdroja*. Otvorí sa okno *Kalendár zdroja*. Má rovnaké polia ako formulár kalendára: *Názov*, *Pracovné dni*, pracovné časy a *Sviatky*. Nový kalendár je na začiatku kópiou štandardného kalendára a volá sa *Kalendár zdroja*.
4. Dajte kalendáru názov, ktorý sa hodí k zdroju, napríklad *Crew Mon–Thu*. Nastavte pracovné dni: kliknite na piatok a vypnite ho v časti *Pracovné dni*. Sviatky a prestoje zadajte do zoznamu *Sviatky* pomocou *Pridať sviatok*.
5. Kliknite na *Použiť*. Kalendár je teraz v knižnici projektu a priradený zdroju v jednom kroku, ktorý vrátite pomocou *Vrátiť späť*. Pomocou *Zrušiť* sa nič nevytvorí.

### Výber alebo úprava existujúceho kalendára

V stĺpci *Kalendár* vyberte kalendár zo zoznamu. *Projektový kalendár* odstráni vlastný kalendár zdroja. Ak chcete upraviť zvolený kalendár, kliknite na ceruzku vedľa zoznamu (*Upraviť…*). Otvorí sa okno *Kalendár zdroja* s aktuálnym kalendárom.

### Kontrola výsledku

1. Ak stavový riadok zobrazí *Zastaralé — prepočítajte (F5)*, stlačte **Prepočítať** (F5).
2. Vyberte *Zdroje › Histogram › Histogram* a kliknite na zdroj v zozname vľavo od histogramu. Červené sú dni, keď zdroj nepracuje, ale je v nich naplánovaný. Ak podržíte myš nad jedným z nich, zobrazí sa napríklad text *Podľa kalendára „Crew Mon–Thu“ sa v tento deň nepracuje*.
3. V časti *Zdroje › Preťaženie* je počet preťažených zdrojov a stavový riadok zobrazí napríklad *Preťažené zdroje: 1*.

## Časté chyby a čo vtedy aplikácia urobí

**Počítajú sa len dni, nie hodiny.** Kalendár zdroja určuje, v ktoré dni zdroj pracuje. Koľko jednotiek je v ten deň k dispozícii, vyplýva z *Maximálny počet jednotiek* zdroja, nie z pracovných časov v kalendári.

**Vyvažovanie tento problém nie vždy vyrieši.** Ak neexistuje okno, v ktorom každý deň úlohy pripadá na pracovný deň zdroja, posúvanie nepomôže. Vyberte *Zdroje › Vyvažovanie › Vyvažovať…* a kliknite na *Prepočítať*. Úloha je potom v časti *Zostávajúce konflikty* s dôvodom *Zdroj v niektoré dni, ktoré táto úloha potrebuje, nepracuje — posunutie to nevyrieši.* Potom priraďte úlohu inému zdroju alebo jej dajte vlastný kalendár.

**Zdieľaný kalendár.** Zoznam zobrazuje všetky kalendáre projektu, teda aj projektový kalendár a kalendáre úloh. Ak takýto kalendár upravíte ceruzkou, zmení sa aj plán úloh, ktoré ho používajú, a stavový riadok zobrazí *Zastaralé — prepočítajte (F5)*. Radšej vytvorte pre zdroj vlastný kalendár.

**Preťaženie nie je vždy spôsobené kalendárom.** Zdroj, ktorý pracuje každý deň, môže byť tiež preťažený. Text nápovedy spomenie kalendár len vtedy, ak deň nie je pracovný deň zdroja.

## Pozri aj

- [Kalendáre a pracovné dni](docs://uitleg-kalenders): prečo kalendár zdroja neposúva žiadne dátumy.
- [Vytvorenie a priradenie kalendára](docs://howto-kalender-maken-en-toewijzen): polia formulára kalendára.
- [Generovanie sviatkov a stavebnej dovolenky](docs://howto-feestdagen-genereren): zadávanie sviatkov a prestojov do kalendára.
- [Okná kalendára](docs://ref-kalenders): všetky polia okien kalendára.

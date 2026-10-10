# Kritická cesta a časová rezerva

Prečo je dokončenie vášho projektu práve na tomto dátume? A ktorá úloha môže meškať 1 deň bez posunu odovzdania? Na tieto otázky odpovedá kritická cesta. Tento článok presne vysvetľuje, čo aplikácia počíta, na vypracovanom príklade.

## Pojem

Plán je sieť úloh, medzi ktorými sú **závislosti**: dohody, napríklad „okenné rámy sa osadia až po uzavretí strechy“. Závislosti spájajú úlohy. Niektoré reťazce úloh sú dlhšie ako iné. Najdlhší reťazec určuje, ako dlho trvá celý projekt.

Najdlhší reťazec je **kritická cesta**. Ak jedna úloha na nej mešká 1 deň, odovzdanie sa posunie o 1 deň. Na nej nie je žiadny čas navyše.

Úlohy mimo kritickej cesty čas navyše naozaj majú. Tento čas navyše sa volá **časová rezerva**. Murár, ktorý buduje outer cavity leaf, môže začať o 2 dni neskôr a nikto si to nevšimne. Tieto 2 dni sú časová rezerva tejto úlohy.

Označenie kritická teda nič nehovorí o dôležitosti úlohy. Hovorí len, že na nej nie je žiadny čas navyše.

Metóda výpočtu sa volá **CPM** (Critical Path Method). Preto sa časť s výsledkami na paneli *Vlastnosti* volá *Výsledok CPM*.

## Ako aplikácia počíta

Aplikácia neprepočítava plán sama. Výpočet začína príkazom **Prepočítať** (F5), napríklad cez *Domov › Plán › Prepočítať*. Ak sa niečo zmenilo od posledného výpočtu, stavový riadok zobrazí *Zastaralé — prepočítajte (F5)*. Ak je zapnutý *Automatický prepočet* (v *Nastavenia › Projekt › Nastavenia*, na karte *Plán*, v nadpise *Prepočítanie*), aplikácia to urobí sama.

Výpočet prejde sieťou 2 razy.

### Dopredný prechod

Aplikácia začne na začiatku projektu a ide po závislostiach: od predchádzajúcej úlohy na nasledujúcu úlohu. Pre každú úlohu aplikácia nájde najskorší deň, kedy sa môže úloha začať. Ak má úloha viacero predchádzajúcich úloh, čaká, kým sa dokončí posledná z nich. Tak každá úloha dostane svoj **skorý začiatok** a **skoré dokončenie**. Najneskoršie skoré dokončenie zo všetkých úloh je dokončenie projektu.

### Spätný prechod

Potom aplikácia ide späť od dokončenia projektu k jeho začiatku. Pre každú úlohu zistí posledný deň, kedy musí byť úloha dokončená bez posunu dokončenia projektu. Ak má úloha viacero nasledujúcich úloh, rozhodujúca je tá, ktorá musí začať ako prvá. Tak vznikne **neskorý začiatok** a **neskoré dokončenie**.

### Celková a voľná časová rezerva

Rozdiel medzi neskorými a skorými dátumami úlohy je jej **celková časová rezerva**: počet pracovných dní, o ktoré môže úloha meškať alebo začať neskôr, kým sa posunie dokončenie projektu. Aplikácia počíta v pracovných dňoch kalendára danej úlohy. Víkend ani štátny sviatok sa nepočítajú.

**Voľná časová rezerva** je prísnejšia. Je to čas navyše, ktorý úloha má, kým by sa niektorá z jej nasledujúcich úloh musela začať neskôr. Tento čas môžete využiť bez toho, aby si to iná úloha všimla.

Celková časová rezerva sa môže zdieľať. Ak za sebou nasledujú 2 nekritické úlohy, zdieľajú tú istú časovú rezervu. Ak prvá úloha ju použije celú, druhá už nemá nič. Prvá úloha potom má celkovú časovú rezervu, ale žiadnu voľnú časovú rezervu. Časť celkovej časovej rezervy, ktorá nie je voľná, sa volá **zasahujúca časová rezerva**: ak ju použijete, posunú sa aj úlohy za ňou. Príklad nižšie to ukáže na číslach.

### Záporná časová rezerva

Časová rezerva môže byť aj záporná. To nastane, ak má úloha termín alebo obmedzenie, ktoré ukladá najneskorší dátum, a ten leží pred dátumom, ktorý aplikácia pre úlohu vypočíta. Na papieri úloha už mešká a úloha aj reťazec pred ňou sa stanú kritickými.

### Kedy je úloha kritická?

Ak nie je nastavené inak, úloha je kritická, ak je jej celková časová rezerva 0 alebo menej. Toto sa dá zmeniť v *Nastavenia › Projekt › Info o projekte*, v časti *Profil výpočtu a možnosti výpočtu*, pri položke *Možnosti výpočtu tohto projektu*. Keď kliknete na *Použiť*, aplikácia plán hneď prepočíta. Možnosti patria do súboru projektu, nie do aplikácie.

- **Definícia kritickej úlohy** pomocou voľby *Celková časová rezerva ≤ prahová hodnota* a poľa *Prahová hodnota (pracovné dni)*. Predvolená prahová hodnota je 0. Ak chcete chrániť časovú rezervu, nastavte prahovú hodnotu napríklad na 2: každá úloha s 2 pracovnými dňami časovej rezervy alebo menej sa potom počíta ako kritická a dostane červený pruh.
- **Označiť takmer kritické** s vlastnou hodnotou v poli *Prahová hodnota*. Predvolená hodnota je 2 pracovné dni. Úloha s časovou rezervou väčšou ako 0, ale najviac touto hodnotou, dostane oranžový pruh. Tak je vidieť, ktoré úlohy majú už takmer žiadnu rezervu, bez toho, aby sa nazývali kritické.
- **Úlohy s otvoreným koncom sú kritické**: úloha bez nasledujúcej úlohy, ktorá ešte nie je dokončená, sa počíta ako kritická. Je to užitočná poistka proti zabudnutým závislostiam (pozri nižšie časť o mylných predstavách).
- **Výpočet časovej rezervy** určuje, či sa celková časová rezerva meria na začiatku úlohy, na jej dokončení, alebo ako menšia z oboch hodnôt. Nové projekty sa nastavia na *Automaticky (predvolené)*. Ak chcete postupovať podľa spôsobu výpočtu programu Primavera P6, *Použiť predvolené možnosti tohto profilu* nastaví túto voľbu na hodnotu *Časová rezerva dokončenia*. Pri programe MS Project nastaví to isté tlačidlo voľbu späť na *Automaticky (predvolené)*: ak je nastavený dátum kontroly stavu, MS Project sám takto počíta.

### Kde to vidíte

Kritické úlohy majú červený pruh v diagrame Gantt. Za nekritickým pruhom je zelený pás až po neskoré dokončenie úlohy: to je časová rezerva. Pás zapnete alebo vypnete cez *Zobrazenie › Smerné plány a postup › Pás časovej rezervy*.

Pri vybranej úlohe panel *Vlastnosti* uvádza všetko pod názvom *Výsledok CPM*: skorý a neskorý začiatok a dokončenie, celkovú, voľnú a zasahujúcu časovú rezervu a to, či je úloha na kritickej ceste. Časová rezerva všetkých úloh vedľa seba je v stĺpcoch pod názvom *Vypočítané* (**+** vpravo v hlavičke tabuľky), napríklad *Celková časová rezerva*, *Voľná časová rezerva*, *Kritická* a *Takmer kritická*.

Stavový riadok dole počíta kritické úlohy, napríklad *Kritická cesta: 21 úloh, 45 pracovných dní*.

## Vypracovaný príklad: House extension

Príklad je praktický projekt z návodov *House extension* v stave, keď sú všetky závislosti zadané. V návode 2, „Závislosti a kritická cesta“, si ho postavíte sami a overíte si čísla. Tu si prečítate, prečo sú čísla také, aké sú.

Prístavba začína v pondelok 7. júna 2027. Po výpočte je odovzdanie v piatok 6. augusta 2027 a stavový riadok ukazuje *Kritická cesta: 21 úloh, 45 pracovných dní*. 2 úlohy nie sú kritické: *Build outer cavity leaf* a *Painting*.

### Dve reťazce, ktoré sa stretnú

Po konštrukčnej podlahe (*Lay hollow-core floor*, dokončená v pondelok 28. júna) sa stavba rozdelí na 2 reťazce. Oba končia pri úlohe *Install window frames*:

- Vnútro: *Build inner cavity leaf* (5 pracovných dní), potom *Place roof elements* (1), potom *Apply roofing* (2). Okenné rámy sa môžu osadiť až po uzavretí strechy.
- Vonkajšok: *Build outer cavity leaf* (6 pracovných dní). Rámy sú osadené vo fasáde, preto musí byť dokončená aj fasáda.

**Dopredu.** Obe dutinové vrstvy môžu začať v utorok 29. júna. Vnútorná vrstva je dokončená v pondelok 5. júla. Strešné prvky sa osadia v utorok 6. júla a strešná krytina nasleduje v stredu 7. a vo štvrtok 8. júla. Vonkajšia vrstva je dokončená v utorok 6. júla. *Install window frames* čaká na neskoršie z oboch reťazcov, teda na strešnú krytinu, a začne v piatok 9. júla.

**Dozadu.** Rámy musia začať najneskôr v piatok 9. júla, inak sa odovzdanie posunie. Vonkajšia vrstva preto musí byť dokončená najneskôr vo štvrtok 8. júla. 6 pracovných dní dozadu je to neskorý začiatok vo štvrtok 1. júla.

**Časová rezerva.** Vonkajšia vrstva môže začať najskôr 29. júna a musí začať najneskôr 1. júla. Medzi tým sú 2 pracovné dni: streda 30. júna a štvrtok 1. júla. To je jej celková časová rezerva; panel ukazuje *Celková časová rezerva: 2 dni* a *Kritická cesta: nie*. Voľná časová rezerva je tiež 2 dni, pretože jej jediná nasledujúca úloha, *Install window frames*, je na kritickej ceste.

Vnútorný reťazec nemá žiadnu časovú rezervu. Každý deň meškania tam posunie rámy aj všetko za nimi.

### Painting

*Painting* (3 pracovné dni) začína po omietaní v pondelok 26. júla a je dokončená v stredu 28. júla. Nasledujúca úloha, *Snagging and cleaning*, tiež čaká na obkladanie. Tá je dokončená až vo štvrtok 5. augusta, pretože poter musí najprv 5 pracovných dní schnúť. *Painting* môže teda trvať až do štvrtka 5. augusta. Výsledkom je 6 pracovných dní časovej rezervy: 29. a 30. júla a 2. až 5. augusta. Aj tu sa voľná časová rezerva rovná celkovej časovej rezerve, pretože nasledujúca úloha je kritická.

### Keď vonkajšia vrstva mešká

Ak vonkajšia vrstva trvá 8 pracovných dní namiesto 6, je dokončená vo štvrtok 8. júla. To je presne jej neskoré dokončenie. Časová rezerva je preč a úloha dostane červený pruh. Oba reťazce sú potom kritické a stavový riadok počíta 22 kritických úloh. Odovzdanie zostáva v piatok 6. augusta.

Ak trvá 9 pracovných dní, vonkajšia vrstva je dokončená až v piatok 9. júla. Rámy sa presunú na pondelok 12. júla a odovzdanie na pondelok 9. augusta: o 1 pracovný deň neskôr. Vonkajší reťazec je teraz kritická cesta; stavový riadok ukazuje *Kritická cesta: 19 úloh, 46 pracovných dní*.

Vnútorný reťazec potom má 1 pracovný deň celkovej časovej rezervy, ale ten deň sa zdieľa:

- *Build inner cavity leaf*: celková časová rezerva 1, voľná časová rezerva 0, zasahujúca časová rezerva 1. Ak vnútorná vrstva mešká o 1 deň, strešné prvky sa posunú s ňou.
- *Place roof elements*: celková časová rezerva 1, voľná časová rezerva 0, zasahujúca časová rezerva 1.
- *Apply roofing*: celková časová rezerva 1, voľná časová rezerva 1. Až tu deň meškania nikoho nestojí nič.

Je to ten istý jediný deň, zdieľaný celým reťazcom. Ak ho vnútorná vrstva použije, pre strešné prvky a strešnú krytinu už nie je.

### Takmer kritické a záporná časová rezerva

Ak je *Označiť takmer kritické* zapnuté a prahová hodnota je predvolená, t. j. 2 pracovné dni, vonkajšia vrstva s presne 2 dňami časovej rezervy dostane oranžový pruh. Pruh úlohy *Painting* so 6 dňami zostane modrý.

Ak odovzdanie dostane termín v stredu 4. augusta, 2 pracovné dni pred vypočítaným odovzdaním, časová rezerva sa stane záporná. Všetkých 21 úloh na kritickej ceste dostane celkovú časovú rezervu −2 pracovné dni. Vonkajšia vrstva nemá žiadnu časovú rezervu a tiež sa stane kritickou; *Painting* si zachová 4 pracovné dni.

## Dôsledky a mylné predstavy

**„Kritické znamená dôležité.“** Nie. Kontrola môže byť rozhodujúca a predsa mať časovú rezervu. Naopak, jednoduchá úloha môže byť kritická: v príklade je *Snagging and cleaning* na kritickej ceste. Kritické sa týka len času: nezostáva žiadna rezerva.

**„Úloha má časovú rezervu, takže môže počkať.“** Najprv sa pozrite na voľnú časovú rezervu. Ak úloha má celkovú časovú rezervu, ale nie voľnú, každý deň meškania ubere časovú rezervu úlohám za ňou, ako pri vnútornej vrstve v prípade 9 pracovných dní.

**Zabudnutá závislosť dáva falošnú časovú rezervu.** Úloha bez nasledujúcej úlohy dostane časovú rezervu až do dokončenia projektu. Ak by v príklade chýbala závislosť z vonkajšej vrstvy na rámy, vonkajšia vrstva by mala zrazu 23 pracovných dní časovej rezervy, až do odovzdania 6. augusta. Na papieri by mohla byť o týždne neskoro a rámy by nečakali. Ak je zapnutá voľba *Úlohy s otvoreným koncom sú kritické*, vonkajšia vrstva sa v tom prípade stane kritickou a chyba sa ukáže.

**Kritická cesta nie je pevná.** Ak nekritická úloha mešká viac, než je jej časová rezerva, najdlhším reťazcom sa stane iný reťazec. Videli ste to vyššie pri 9 dňoch murovania. Plán sa preto musí prepočítať po každej zmene. Kým stavový riadok hovorí *Zastaralé*, červené pruhy stále patria k predchádzajúcemu výpočtu.

**Časová rezerva sa počíta v pracovných dňoch.** Časová rezerva úlohy *Painting* so 6 pracovnými dňami siaha od štvrtka 29. júla do štvrtka 5. augusta: v diári je to 8 dní, pretože víkend sa nepočíta. Ani štátny sviatok alebo stavebná dovolenka v kalendári sa nepočítajú.

## Pozri tiež

- [Pridanie závislostí](docs://howto-relaties-leggen): kroky na prepojenie úloh a nastavenie oneskorenia.
- [Závislosti a oneskorenie](docs://uitleg-relaties): ako závislosti a oneskorenie určujú skoré dátumy.
- [Obmedzenia a termíny](docs://uitleg-constraints): ako obmedzenie alebo termín vytvára zápornú časovú rezervu.
- [Sledovanie cesty](docs://howto-pad-traceren): sledovanie reťazca, ktorý stojí za úlohou.
- [Možnosti výpočtu a pravidlá výpočtu](docs://ref-rekenopties-en-conventies): definícia kritickej úlohy, takmer kritická úloha a výpočet časovej rezervy, možnosť po možnosti.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): veľký projekt s viacerými cestami časovej rezervy, takmer kritickými úlohami (prahová hodnota 3 pracovné dni), hamakom, pevne zafixovanou úlohou a prepojením medzi projektmi.

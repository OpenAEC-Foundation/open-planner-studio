# Výber režimu postupu

Cieľ: rozhodnúť, ako aplikácia naplánuje zostávajúcu prácu úlohy, ktorá už začala, kým jej predchádzajúca úloha ešte beží: podľa závislosti (Retained Logic) alebo podľa toho, čo sa skutočne stane (Progress Override).

## Kedy to potrebujete

Na stavbe práca často predbieha logiku. Maliar už začína v miestnostiach, ktoré sú omietnuté, kým omietkar je ešte zaneprázdnený inde. V pláne ide napríklad o závislosť typu dokončenie-začiatok, pri ktorej nasledujúca úloha začína skôr, než sa predchádzajúca úloha dokončí. Aplikácia to nazýva **postup mimo poradia**. Ak stavový riadok zobrazí *Závislosti mimo poradia: N*, máte taký prípad a režim postupu rozhodne, ako aplikácia naplánuje zostávajúcu prácu nasledujúcej úlohy. Čo robia oba režimy, s príkladom, nájdete v článku [Postup, dátum kontroly stavu a pôvodný plán](docs://uitleg-voortgang).

## Kroky

1. Aktualizujte postup a nastavte dátum kontroly stavu, ako je opísané v článku [Aktualizácia postupu](docs://howto-voortgang-bijwerken).
2. Prejdite na *Plán › Smerné plány a postup › Režim postupu* a otvorte zoznam.
3. Vyberte *Retained Logic* alebo *Progress Override*.
4. Stlačte **Prepočítať** (F5), napríklad cez *Plán › Plán › Prepočítať*. Táto voľba urobí plán zastaralým: stavový riadok zobrazí *Zastaralé — prepočítajte (F5)*. Ak je zapnuté *Automatický prepočet*, aplikácia to urobí sama.

Ako vyberiete?

- **Retained Logic** je predvolené nastavenie. Závislosť zostáva v platnosti: zostávajúca práca nasledujúcej úlohy sa začne až po dokončení predchádzajúcej úlohy. Vyberte toto, ak je poradie naozaj pevné, alebo ak chcete plánovať opatrne.
- **Progress Override** nechá rozhodovať skutočnosť. Zostávajúca práca nasledujúcej úlohy sa začne k dátumu kontroly stavu, bez čakania na predchádzajúcu úlohu. Vyberte toto, ak nasledujúca úloha naozaj pokračuje v práci a dátum dokončenia nemá závisieť od predchádzajúcej úlohy, ktorá ešte beží.

## Kontrola výsledku

- Kliknite na hlásenie *Závislosti mimo poradia: N* v stavovom riadku. Otvorí sa panel *Upozornenia*, ktorý nájdete aj cez *Plán › Plán › Upozornenia*. V paneli je každá závislosť s textom *Mimo poradia: postup nasledujúcej úlohy je v rozpore so závislosťou*, napríklad *4.2 Plastering → 4.5 Painting (FS)*.
- Pozrite sa na pruh nasledujúcej úlohy. Pri Retained Logic pruh trvá až po dokončení predchádzajúcej úlohy. Pri Progress Override sa dokončí skôr. V príklade z vysvetlenia ide o utorok 27. júla oproti štvrtku 22. júla.

## Úskalia a čo aplikácia robí

**Žiadny rozdiel.** Režim pôsobí len na úlohy, ktoré už začali, kým ich predchádzajúca úloha ešte nie je dokončená. Bez takej úlohy sa nič nezmení.

**Hlásenie zostane.** Progress Override nevyrieší hlásenie o postupe mimo poradia. Režim rozhodne, ako aplikácia počíta; rozpor medzi závislosťou a postupom zostane. Ak závislosť už nie je správna, zmeňte ju ([Pridanie závislostí](docs://howto-relaties-leggen)).

**Patrí k projektu.** Voľba sa uloží so súborom projektu, platí pre celý projekt a dá sa vrátiť pomocou Ctrl+Z. Nový projekt je nastavený na Retained Logic.

**Súbor P6.** Ak otvoríte súbor Primavera P6 (.xer), aplikácia prevezme režim zo súboru. Okrem Retained Logic a Progress Override má P6 ešte Actual Dates. Aplikácia tretí režim nepozná; takýto súbor sa počíta ako Retained Logic. Hlásenie pri importe to eviduje ako *1 nastavenie plánu P6 s bezpečnou záložnou hodnotou.*

**Profil výpočtu.** V profile Primavera P6 Progress Override pôsobí aj spätne, na neskoré dátumy a voľnú časovú rezervu predchádzajúcej úlohy (pravidlo výpočtu *Progress Override ignoruje začatú nasledujúcu úlohu aj pri spätnom výpočte*). V profiloch Open Planner Studio a Microsoft Project to neplatí. Pravidlá výpočtu nájdete v *Nastavenia › Projekt › Info o projekte*, v bloku *Profil výpočtu a možnosti výpočtu*. V príklade z vysvetlenia sa tento spätný účinok nedá vidieť.

## Pozri tiež

- [Postup, dátum kontroly stavu a pôvodný plán](docs://uitleg-voortgang): rozdiel medzi oboma režimami, s číslami.
- [Aktualizácia postupu](docs://howto-voortgang-bijwerken): zadanie postupu, s ktorým režim pracuje.
- [Pridanie závislostí](docs://howto-relaties-leggen): zmena závislosti, ktorá už nie je správna.

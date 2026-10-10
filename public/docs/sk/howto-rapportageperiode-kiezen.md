# Výber obdobia zostavy

Cieľ: rozhodnite, ktoré časové obdobie zostava pokrýva, napríklad nasledujúce štyri týždne alebo mesiac jún.

## Kedy to potrebujete

Týždenná porada chce vedieť, čo sa stane v nasledujúcich štyroch týždňoch. Mesačná zostava pokrýva jún. Bez obdobia dostanete celý plán na papieri. Päť zostáv preto používa pole *Obdobie zostavy:*: *Look-ahead*, *Zostava postupu*, *Zaťaženie zdrojov*, *Priradenia zdrojov* a *Diagram zdrojov*. Ostatné zostavy obdobie nemajú.

Obdobie nie je viazané na kalendárny mesiac, ale na **referenčný deň**: dátum kontroly stavu vášho projektu (deň, keď meriate postup, pozri [Postup, dátum kontroly stavu a pôvodný plán](docs://uitleg-voortgang)), alebo dnešok, ak projekt nemá dátum kontroly stavu. *Nasledujúce 4 týždne* sa počíta od tohto dňa. Ak posuniete dátum kontroly stavu, okno sa posunie spolu s ním.

## Kroky

### 1. Nastavte dátum kontroly stavu

Ak pracujete s relatívnou voľbou, napríklad *Nasledujúce 4 týždne* alebo *Predchádzajúci mesiac*, nastavte najprv dátum kontroly stavu. Vyberte *Plán › Smerné plány a postup* a vyplňte pole *Dátum kontroly stavu*. Krížikom vedľa neho (*Vymazať dátum kontroly stavu*) dátum znova odstránite. Ak pracujete s pevným obdobím (krok 4), toto nepotrebujete.

### 2. Vyberte zostavu s obdobím

Otvorte kartu *Zostava* a vyberte jednu z piatich zostáv v poli *Typ zostavy*. Zoznam *Obdobie zostavy:* je v časti *Možnosti zostavy*. Pri Diagrame zdrojov je v časti *Nastavenia*, pod štyrmi zaškrtávacími políčkami tejto zostavy.

Každá zostava si pamätá svoje vlastné obdobie. Toto sú počiatočné hodnoty:

- *Look-ahead*: *Nasledujúci mesiac*.
- *Zostava postupu*: *Predchádzajúci mesiac*.
- *Zaťaženie zdrojov*, *Priradenia zdrojov* a *Diagram zdrojov*: *Celý projekt*.

### 3. Vyberte obdobie zo zoznamu

Zoznam obsahuje *Nasledujúci týždeň*, *Nasledujúce 2 týždne*, *Nasledujúce 4 týždne*, *Nasledujúcich 6 týždňov*, *Nasledujúcich 8 týždňov*, *Nasledujúcich 12 týždňov*, *Nasledujúci mesiac*, tých istých sedem možností pre predchádzajúce obdobia, *Celý projekt* a *Vlastné*. Pod zoznamom sú *Od* a *Do* s dátumami, ktoré voľba vytvorí. Tu ich môžete len čítať.

Oba dni sa rátajú. Ak je dátum kontroly stavu štvrtok 20. mája, *Nasledujúci týždeň* trvá od 20. do 26. mája vrátane a *Nasledujúce 4 týždne* od 20. mája do 16. júna vrátane (28 dní). *Nasledujúci mesiac* trvá do jedného dňa pred rovnakým dátumom v budúcom mesiaci, tu do 19. júna vrátane. *Predchádzajúce 2 týždne* trvajú od 7. do 20. mája vrátane.

*Celý projekt* zoberie plán od prvého začiatku po posledné dokončenie.

### 4. Alebo vyberte Vlastné

Pri voľbe *Vlastné* sa *Od* a *Do* zmenia na dve polia s dátumom. Začínajú s dátumami voľby, ktorú ste mali predtým. Vyplňte oba, napríklad 1. a 14. júna. Ak vstup nie je správny, zostava zostane pri poslednom platnom období a zobrazí to červeným písmom:

- *Dátum konca je pred dátumom začiatku*, ak je *Do* skôr ako *Od*.
- *Vyplňte oba dátumy*, ak je jeden z oboch prázdny.

### 5. Prečítajte si obdobie v zostave

Pri zostavách *Look-ahead*, *Zaťaženie zdrojov* a *Priradenia zdrojov* je obdobie pod nadpisom, napríklad *Obdobie: 20-05-2027 – 19-06-2027*. Ak vyberiete *Celý projekt*, za dátumy sa pridá *Celý projekt*. Zostava postupu zobrazí obdobie v súhrne, v riadku *Obdobie*. Diagram zdrojov nechá časovú os presne pokrývať obdobie.

### Čo obdobie robí v jednotlivých zostavách

Obdobie nefunguje v každej zostave rovnako.

- **Look-ahead** zahŕňa nedokončené úlohy, ktoré sa dotýkajú obdobia, aj keď obdobie celé pokrývajú. Úlohy po termíne z dní pred referenčným dňom sa zahrnú tiež, pokiaľ obdobie nekončí pred referenčným dňom. Vlastné obdobie celé v minulosti je spätný pohľad: ukáže len to, čo v tom čase prebiehalo a ešte nebolo dokončené, bez dnešného zaostávania.
- **Zostava postupu** používa obdobie pre *Dokončené v predchádzajúcom období*. Časť *Začínajú v nasledujúcom období* hľadí dopredu od dátumu kontroly stavu, až po dátum v riadku *Výhľad do* v súhrne. Ak zvolíte minulé obdobie, zostava hľadí dopredu rovnako ďaleko, ako hľadí dozadu: pri voľbe *Predchádzajúce 2 týždne* a dátume kontroly stavu 20. mája zobrazí *Výhľad do* 3. júna. Vlastné obdobie alebo *Celý projekt*, ktoré leží celé v minulosti, sa nepremieta do budúcnosti.
- **Zaťaženie zdrojov** zobrazí každý týždeň alebo mesiac, ktorého sa obdobie dotýka, celý. Ak vaše obdobie ide od stredy do stredy, uvidíte preto celé týždne, takže riadok vždy ukáže rovnaké číslo ako histogram.
- **Priradenia zdrojov** zobrazí priradenia úloh, ktoré sa dotýkajú obdobia. Pri voľbe *Celý projekt* sa nefiltruje podľa dátumu.
- **Diagram zdrojov** zobrazí len úlohy, ktoré sa dotýkajú obdobia. V súhrne *Mimo obdobia:* spočíta, koľko úloh vynechal.

## Úskalia a čo aplikácia robí

**Nie je nastavený dátum kontroly stavu.** Aplikácia potom použije dnešok. Pri štyroch tabuľkových zostavách s obdobím (*Look-ahead*, *Zostava postupu*, *Zaťaženie zdrojov* a *Priradenia zdrojov*) to hore uvedie pri relatívnom období: *Nie je nastavený dátum kontroly stavu — zostava počíta s dnešným dňom (29-09-2026).* s dnešným dátumom vo vašom zápise. Diagram zdrojov toto neuvádza. Pozrite sa preto na *Od* a *Do*: tie sú potom okolo dnešného dňa, nie okolo vášho plánu.

**Obdobie leží mimo vášho plánu.** Potom je zostava prázdna. Diagram zdrojov to povie hláškou *V sledovanom období nie sú žiadne úlohy — vyberte iné obdobie alebo Celý projekt.* (v zozname sa táto voľba volá *Celý projekt*). V ostatných zostavách vidíte nula úloh alebo žiadne riadky.

**Dátumy sú vo vašom zápise.** *Od* a *Do* nasledujú zápis dátumu z vašich nastavení, okrem polí s dátumom pri voľbe *Vlastné*: tie ukazujú zápis vášho prehliadača.

**Obdobie sa posúva.** Relatívna voľba, napríklad *Nasledujúci mesiac*, sa určí znova zakaždým: ak sa zmení dátum kontroly stavu, alebo ak dátum nie je nastavený a je o deň neskôr, obdobie sa hneď posunie. Ak chcete pevné obdobie, zvoľte *Vlastné*.

**Voľba platí pre všetky vaše projekty.** Vlastné obdobie platí aj pre všetky vaše projekty na tomto zariadení, nielen pre otvorený projekt.

## Pozri tiež

- [Vytvorenie a tlač zostavy](docs://howto-rapport-maken-en-afdrukken): celý postup od typu zostavy po PDF.
- [Postup, dátum kontroly stavu a pôvodný plán](docs://uitleg-voortgang): čo je dátum kontroly stavu a prečo s ním aplikácia počíta.
- [Riešenie preťaženia](docs://howto-overbezetting-oplossen): čo robiť s preťaženými týždňami zo Zaťaženia zdrojov.
- [Typy zostáv](docs://ref-rapporttypes): všetky typy zostáv a ich možnosti.

# Okná kalendárov

Okno *Kalendáre* spravuje knižnicu kalendárov projektu: aké pracovné dni, pracovné časy a dni voľna platia a ktorý kalendár je kalendár projektu. Formulár vedľa zoznamu je rovnaký ako v okne *Kalendár zdroja*. Tento článok pri každom poli hovorí, čo robí, aký je predvolený stav a čo si z neho všimnete. Ako vytvoriť kalendár a priradiť ho úlohám, je v [Vytvorenie a priradenie kalendára](docs://howto-kalender-maken-en-toewijzen); ako aplikácia počíta pracovné dni, je v [Kalendáre a pracovné dni](docs://uitleg-kalenders).

## Kde ho nájdete

- **Kalendáre** — *Plán › Kalendár › Kalendár* alebo *Nastavenia › Kalendár › Kalendár*.
- **Kalendár úlohy** — pole *Kalendár* v okne *Upraviť úlohu* alebo v paneli *Vlastnosti*. Pozri [Dialóg úlohy a panel vlastností](docs://ref-taak-eigenschappen).
- **Kalendár zdroja** — panel *Zdroje*, stĺpec *Kalendár*: vyberte kalendár, alebo pre nový kalendár vyberte *+ Kalendár zdroja*, alebo kliknite na ceruzku (*Upraviť…*) pri zvolenom kalendári. Pozri [Panel zdrojov](docs://ref-resourcepaneel).

## Knižnica v okne Kalendáre

Vľavo je zoznam kalendárov, vpravo formulár zvoleného kalendára. Kalendár projektu má hviezdičku. Kalendár s neplatnými údajmi má červený trojuholník (*Tento kalendár obsahuje neplatné údaje*).

- **Nový kalendár** (tlačidlo s plusom) — pridá kalendár s názvom *Nový kalendár* s predvoleným obsahom aplikácie: pondelok až piatok, 07:00 až 16:00, 8 čistých hodín. Ak je *Zapnúť stavebný režim* zapnuté (predvolene), sú v ňom aj holandské sviatky, bez stavebnej dovolenky; ak je vypnuté, zoznam je prázdny. Ak tieto sviatky nechcete, vyberte *Vygenerovať sviatky…* a v ňom *Žiadne sviatky*. (Názvy Bouwkalender NL a Standaardkalender zostávajú v každom jazyku holandské.)
- **Duplikovať** — skopíruje zvolený kalendár pod názvom *{name} (duplikát)*.
- **Odstrániť** (ikona koša) — odstráni zvolený kalendár. Nedostupné, keď zostáva iba jeden kalendár. Ak to bol kalendár projektu, prvý zostávajúci kalendár sa stane kalendárom projektu. Úlohy a zdroje, ktoré kalendár používali, prejdú na kalendár projektu.
- **Nastaviť ako predvolený pre projekt** — zvolený kalendár sa stane kalendárom projektu. Na kalendári, ktorý ním už je, sa zobrazí *Projektový kalendár* s hviezdičkou. Účinok: každá úloha bez vlastného kalendára sa počíta v tomto kalendári, rovnako aj zdroj bez vlastného kalendára. Úloha, ktorej ste kalendár priradili sami, si ho ponechá.
- **Použiť** — zapíše všetky zmeny celého zoznamu do projektu naraz, spustí prepočítanie plánu a zavrie okno. Ak sa celkovo nič nezmenilo, prepočítanie sa nespustí. Je neaktívne, kým je v niektorom kalendári neplatný vstup. Enter v bežnom textovom poli urobí to isté, ale okno nechá otvorené.
- **Zrušiť** — zavrie okno a zahodí všetko, čo ste zmenili od otvorenia (alebo od posledného Enteru). Esc a krížik fungujú ako *Zrušiť*. Kliknutie vedľa okna nič neurobí, takže nestratíte zadané údaje.

Predvolene má projekt kalendár *Bouwkalender NL* (stavebný režim zapnutý) alebo *Standaardkalender* (stavebný režim vypnutý), s pondelkom až piatkom 07:00 až 16:00.

## Formulár

### Základné údaje

- **Názov** — názov v zozname a v rozbaľovacích ponukách pre úlohy a zdroje.
- **Pracovné dni** — tlačidlo pre každý deň v týždni, od *Po* do *Ne*; stlačené tlačidlo je pracovný deň. Poradie sa riadi podľa *Týždeň začína* (*Nastavenia*, karta *Plán*). Predvolené: *Po* až *Pi*. Dve rýchle tlačidlá: *Po–Pi* nastaví pondelok až piatok, 07:00 až 16:00, 8 hodín; nastavená prestávka sa vráti na predvolenú prestávku 12:00, 60 minút; *Nepretržite (24/7)* nastaví všetkých sedem dní, 00:00 až 24:00, 24 hodín. Účinok: úloha pracuje iba v pracovných dňoch. Aplikácia nedokáže kalendár vypočítať bez pracovných dní (*Kalendár nemá nastavené žiadne pracovné dni*).
- **Začiatok (hodina)** a **Dokončenie (hodina)** — začiatok a koniec pracovného dňa, vo formáte HH:MM, 24-hodinový zápis. Predvolené: 07:00 a 16:00. Šípky (alebo klávesy so šípkami) upravujú po 15 minútach; koniec môže byť 24:00, začiatok musí byť skôr ako koniec. Účinok: spolu s prestávkou určujú čisté hodiny za deň. Pre dátumy úloh v dňoch sa nepočítajú; pre úlohy v hodinách sa počítajú. Tieto polia zmiznú, keď je zapnuté *Zapnúť plánovanie v hodinách* a kalendár má pracovné časy pre jednotlivé dni v týždni; tie majú potom prednosť.
- **Začiatok prestávky** a **Trvanie prestávky (minúty)** — začiatok a dĺžka prestávky, s rovnakými 15-minútovými krokmi. Predvolené: 12:00 a 60 minút. Ak nastavíte trvanie na 0, pracovný deň je nepretržitý. Prestávka musí byť úplne v rámci pracovného dňa a nesmie zabrať celý pracovný deň. Účinok: čisté hodiny sú koniec mínus začiatok mínus prestávka; pri úlohe v hodinách sa počas prestávky nepracuje. Tie isté polia zmiznú za rovnakej podmienky ako *Začiatok (hodina)*.
- **Čisté hodiny za deň** — iba na čítanie: odvodená dĺžka pracovného dňa s dvoma desatinnými miestami, napríklad *8,00 h*. Predvolené: 8. Účinok: je to dĺžka dňa pri prevode medzi dňami a hodinami a pri úlohách v hodinách. Pozri [Dni a hodiny](docs://uitleg-dagen-en-uren).

### Pracovné časy

Tento blok je tu iba vtedy, keď je zapnuté *Zapnúť plánovanie v hodinách* (*Nastavenia*, karta *Plán*). Tu nastavíte pracovné časy a pracovné zmeny pre jednotlivé dni v týždni. Pozri [Nastavenie pracovných časov](docs://howto-werktijden-instellen).

- **Predvoľby** — tlačidlá, ktoré nastavia pracovné časy naraz: *Denná pracovná zmena* (Po–Pi 08:00 až 16:00, bežný denný kalendár), *2 pracovné zmeny* (Po–Pi 06:00 až 22:00, 16 hodín), *3 pracovné zmeny* (Po–Pi 06:00 až 06:00 nasledujúci deň, 24 hodín), *Nočná pracovná zmena* (Po–Pi 22:00 až 06:00, 8 hodín) a *24/7* (všetky dni 00:00 až 24:00). Za vstavanými tlačidlami sú vaše vlastné predvoľby, s krížikom na ich odstránenie.
- **Uložiť ako predvoľbu…** — uloží aktuálne pracovné časy ako vašu vlastnú predvoľbu na tomto zariadení, aby ste ju mohli použiť v ľubovoľnom projekte. Zadáte názov (*Názov vlastnej predvoľby*) a kliknete na *Uložiť* alebo *Zrušiť*.
- **Nastaviť podľa dňa…** — premení denný kalendár na hodinový kalendár: aktuálne časy sa stanú blokmi pracovného času každého pracovného dňa, s prestávkou ako medzerou. Pri hodinovom kalendári sa tlačidlo volá *Skryť pracovnú dobu* alebo *Zobraziť pracovnú dobu* a zbalí alebo rozbalí editor. Pri hodinovom kalendári je editor predvolene otvorený.
- **Editor** — pre každý deň v týždni zoznam blokov (*blok*) so začiatkom a koncom. Zaškrtnutie *nasledujúci deň* umožní, aby blok bežal cez polnoc (nočná zmena). *Pridať blok* (tlačidlo plus) pridá 08:00 až 16:00. *Kopírovať na pracovné dni* (iba pri Po–Pi) skopíruje bloky tohto dňa na pondelok až piatok. Deň bez blokov sa volá *Nepracovný deň*. Dole je *Odvodené hodiny/deň:* a hneď ako má deň viac ako jeden blok, zobrazí sa text *Medzera medzi dvoma blokmi je prestávka — upravte časy podľa potreby.* Účinok: bloky majú prednosť. Deň v týždni s blokmi je pracovný deň a polia *Začiatok (hodina)*, *Dokončenie (hodina)* a prestávka zmiznú.

### Sviatky

- **Vygenerovať sviatky…** — otvorí generátor. *Krajina* vyberie *Holandsko*, *Nemecko*, *Belgicko*, *Francúzsko*, *Spojené kráľovstvo*, *Rakúsko*, *Švajčiarsko* alebo *Žiadne sviatky*. *Región* sa zobrazí, iba ak krajina má regióny; predvolene *Celoštátne*. *Stavebná dovolenka* sa zobrazí iba pre Holandsko a keď je *Zapnúť stavebný režim* zapnuté, s voľbami *Žiadna* (predvolené), *Sever*, *Stred* a *Juh* a textom *Odporúčané dátumy — overte u Bouwend Nederland*. Riadok s náhľadom ukazuje, koľko sviatkov príde (*… sviatkov, …–…*); dá sa rozbaliť na zoznam. *Vygenerovať* vloží výsledok do kalendára, ktorý upravujete (platí až po *Použiť*); *Zrušiť* zavrie generátor. Účinok: celý zoznam *Sviatky* sa nahradí, vrátane toho, čo ste pridali sami. Roky, ktoré generátor pokrýva, sú od roka pred začiatkom projektu po rok za koncom projektu vrátane (bez konca projektu: najviac tri roky po začiatku). Pozri [Generovanie sviatkov a stavebnej dovolenky](docs://howto-feestdagen-genereren).
- **Vygenerovať znova** — zobrazí sa vedľa tlačidla *Vygenerovať sviatky…*, keď vygenerované sviatky už nepokrývajú obdobie projektu, s textom *Sviatky pokrývajú …–…; projekt beží do …. Chcete ich vygenerovať znova?* Kliknutím sa vygeneruje znova rovnaká voľba (krajina, región, stavebná dovolenka) pre nové obdobie. Bez toho sú dni mimo vygenerovaných rokov bežné pracovné dni.
- **Sviatky** — zoznam dní voľna: *Popis*, *Od* a *Do* a kôš pri každom riadku. *Pridať sviatok* pridá riadok s dnešným dátumom ako *Od* a prázdnym *Do*. Prázdne *Do* znamená jeden deň. Bez riadkov sa zobrazí *Zatiaľ žiadne sviatky.* Účinok: všetky dni v období sú nepracovné dni v tomto kalendári, pre úlohy v tomto kalendári a pre zdroje, ktoré ho používajú. Neplatný riadok dostane červený rámček a text (*Zadajte platný dátum začiatku.*, *Zadajte platný dátum konca, alebo pole nechajte prázdne pre jeden deň.* alebo *Dátum konca je pred dátumom začiatku.*) a blokuje *Použiť*.

### Chybové hlásenia a výnimky

Chyby v pracovných časoch sa zobrazia pod poľami a blokujú *Použiť*: *Zadajte platný čas začiatku vo formáte HH:MM.*, *Zadajte platný čas ukončenia vo formáte HH:MM.*, *Čas začiatku musí byť skôr ako čas ukončenia.*, *Zadajte platný čas prestávky vo formáte HH:MM.*, *Trvanie prestávky musí byť celé číslo minút, najmenej 0.*, *Prestávka musí byť úplne v rámci nastaveného pracovného dňa.* a *Prestávka nesmie zaberať celý pracovný deň.*

Kalendár pozná dni voľna iba ako výnimku. Kalendár zo súboru MS Project alebo Primavera môže mať aj výnimky pracovných dní, teda ďalší pracovný deň; okno ich nezobrazuje ani neupravuje.

## Okno Kalendár zdroja

- **Kalendár zdroja** — formulár vyššie, v okne iba s *Použiť* a *Zrušiť*. Esc a krížik fungujú ako *Zrušiť*; kliknutie vedľa okna nič neurobí a Enter tu tiež nič neurobí. V ňom upravujete jeden kalendár: existujúci alebo nový s predvoleným názvom *Kalendár zdroja*, ktorý sa po *Použiť* prepojí so zdrojom (*Zrušiť* nič neuloží). Ak ho otvoríte v zobrazení *Knižnica* na paneli zdrojov, upravujete kalendár v knižnici; v zobrazení *Projekt* upravujete kalendár projektu, aj keď pochádza z knižnice. Účinok: kalendár zdroja určuje, kedy je zdroj dostupný v histograme, pri preťažení a vo vyvažovaní; nemení dátumy úlohy. *Použiť* prepočítanie nespustí. Ak je kalendár aj na úlohách alebo je kalendárom projektu, plán sa zmení: označí sa ako neaktuálny a príkaz *Prepočítať* ho prepočíta. Pozri [Nastavenie kalendára zdroja](docs://howto-resourcekalender-instellen).

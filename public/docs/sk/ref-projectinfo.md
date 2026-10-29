# Nový projekt a Nastavenia projektu

Polia okna *Nový projekt* a *Nastavenia projektu*: čo každé pole robí, aká je predvolená hodnota a kde sa prejaví. Sú to dve strany rovnakého formulára. *Nový projekt* vytvorí nový projekt a má niekoľko ďalších polí. *Nastavenia projektu* mení projekt, ktorý máte otvorený.

## Otvorenie

**Nový projekt** — *Súbor › Vytvoriť*, Ctrl+N, alebo plus vpravo od kariet dokumentov (*Začať projekt*, potom *Nový projekt*). Okno sa otvorí s kurzorom v poli *Názov projektu*.

**Nastavenia projektu** — *Nastavenia › Projekt › Nastavenia projektu* otvorí formulár ako okno s názvom *Nastavenia projektu*. *Súbor › Nastavenia projektu* zobrazí rovnaký formulár na obrazovke *Súbor*. Blok *Profil výpočtu a možnosti výpočtu* je dole na oboch miestach; čo v ňom je, nájdete v [Možnosti výpočtu a pravidlá výpočtu](docs://ref-rekenopties-en-conventies).

## Vytvoriť, Použiť a zrušiť

**Vytvoriť** (v okne *Nový projekt*) vytvorí projekt. Ak je vaša aktuálna karta prázdna a nezmenená, aplikácia použije túto kartu. Inak sa projekt otvorí na novej karte. **Použiť** (v okne *Nastavenia projektu*) zapíše vaše zmeny do projektu.

- **Iba v kroku *Použiť*.** Píšete do konceptu. Projekt sa mení, až keď kliknete na *Použiť*. *Použiť* zapíše iba to, čo ste skutočne zmenili, v jednom kroku v *Vrátiť späť*. Ak kliknete na *Použiť* bez zmeny, nič sa nestane a krok sa nepridá.
- **Zrušiť, krížik a Esc** zavrú okno bez uloženia čohokoľvek. Kliknutie mimo okna ho nezavrie: zostane to, čo ste napísali.
- **Enter** urobí to isté ako *Vytvoriť* alebo *Použiť*, okrem poľa *Popis* a otvoreného rozbaľovacieho zoznamu.
- **Na obrazovke Súbor** *Nastavenia projektu* zobrazí na spodku *Zmeny nie sú použité — kliknite na Použiť, aby ste ich uložili.* Text sa zobrazí, dokiaľ sa váš koncept líši. Ak potom obrazovku opustíte, aplikácia sa spýta, či chcete použiť, zahodiť alebo zrušiť. Pozrite [Pás s nástrojmi, karta po karte](docs://ref-lint).
- **Vlastný profil výpočtu bez názvu** blokuje *Použiť* a *Vytvoriť*. Dajte mu názov alebo zmenu zahoďte.

## Polia v oboch oknách

**Názov projektu** — názov projektu v záhlaví okna, na karte a v názve súboru pri uložení. Predvolené: prázdne. Prázdne pole je povolené: projekt sa potom volá *Nový plán*, zobrazený sivým textom v poli. Kde: celá obrazovka.

**Popis** — voľný text. Predvolené: prázdne. Účinok: uloží sa s projektom, v súbore IFC a pri exporte do Primavera P6 XML, a nemá vplyv na plán.

**Autor** — voľný text. Predvolené: prázdne. Účinok: dostane sa do súboru IFC a zobrazí sa ako *Autor:* v záhlaví zostavy, kde ho nemôžete prepísať.

**Knižnica zdrojov** — ku ktorej knižnici zdrojov je projekt prepojený. Vyberte z možností *žiadna knižnica (samostatný projekt)*, vaše existujúce knižnice a *+ Nová knižnica zdrojov*. Predvolené: v okne *Nový projekt* predvolená knižnica, v okne *Nastavenia projektu* aktuálne prepojenie. Účinok: pozrite [Používanie knižnice zdrojov](docs://howto-resourcebibliotheek-gebruiken). Ak zvolíte *+ Nová knižnica zdrojov*, zadáte názov do poľa pod ním. Knižnica sa vytvorí až pri *Vytvoriť* alebo *Použiť*, takže zrušením nezostane nič. Prepojenie v okne *Nastavenia projektu* sa zmení, iba ak sami zmeníte toto pole.

**Klient/organizácia** — voľný text. Predvolené: prázdne. Účinok: dostane sa do súboru IFC a zobrazí sa ako *Spoločnosť:* v záhlaví zostavy.

**Dátum začiatku** — začiatok projektu. Predvolené: v okne *Nový projekt* dnešný deň. Čo pole robí, nájdete nižšie v časti *Čo robí dátum začiatku*.

**Dátum dokončenia** — plánované dokončenie projektu. Predvolené: prázdne. Účinok: ide o informáciu, nie o požiadavku: aplikácia neplánuje smerom k tomuto dátumu. Zobrazí sa v záhlaví zostavy a v exportoch a určuje, do ktorého roku sa generujú sviatky. Iba pri súbore Primavera s nastavením *Prepočítať časovú rezervu do dokončenia projektu* (pozrite [Možnosti výpočtu a pravidlá výpočtu](docs://ref-rekenopties-en-conventies)) sa výpočet časovej rezervy vykoná až do tohto dátumu.

**Predvolená jednotka pre nové úlohy** — pole sa zobrazí iba vtedy, keď je zapnuté *Zapnúť plánovanie v hodinách*. Vyberte z možností *Dni* a *Hodiny*. Predvolené: *Dni*. Účinok a podmienky: pozrite [Zapnutie plánovania v hodinách](docs://howto-urenplanning-aanzetten).

**Profil výpočtu a možnosti výpočtu** — v okne *Nastavenia projektu* celý blok, v okne *Nový projekt* iba rozbaľovací zoznam *Profil výpočtu* s možnosťami *Primavera P6*, *Microsoft Project* a *Open Planner Studio*. Predvolené: *Open Planner Studio*. Výber profilu nastaví aj predvolené možnosti tohto profilu. Pozrite [Možnosti výpočtu a pravidlá výpočtu](docs://ref-rekenopties-en-conventies).

## Iba v Nastaveniach projektu

**Schéma IFC pri ukladaní** — ktorá schéma IFC je v záhlaví uloženého súboru. Výber: *IFC 4.3 ADD2 (predvolené)*, *IFC 4.3* a *IFC4*. Predvolené: *IFC 4.3 ADD2 (predvolené)*; pri otvorenom súbore IFC je to schéma tohto súboru. Účinok: mení sa iba záhlavie súboru, nie obsah. Použite to, keď chcete spojiť plán s modelom budovy v rovnakej schéme. Ak má otvorený súbor inú schému ako predvolenú, aplikácia sa pri prvom uložení spýta, či túto schému zachovať. Výber tu sa počíta ako odpoveď. Ďalší výber tu nie je krok v *Vrátiť späť*: schéma patrí k súboru. Pozrite [Výber schémy IFC](docs://howto-ifc-schema-kiezen).

## Iba v okne Nový projekt

**Šablóna fáz** — ktoré fázy projekt na začiatku obsahuje. Vyberte z možností *Prázdny*, *Bytová výstavba* a *Nebytová výstavba / rekonštrukcia*. Predvolené: *Prázdny*. Účinok: *Prázdny* vytvorí projekt bez úloh. Ostatné dve pripravia osem úloh fáz, každú s trvaním 5 v predvolenej jednotke projektu (5 pracovných dní, alebo 5 hodín, ak v *Predvolená jednotka pre nové úlohy* vyberiete *Hodiny*) a bez závislostí. Úlohy si sami premenujete, presuniete a predĺžite. Šablóna *Bytová výstavba* obsahuje tieto úlohy: Bouwplaats & grondwerk, Fundering, Ruwbouw / casco, Dak, Gevel & afbouw, Installaties (W/E), Afwerking a Oplevering. Šablóna *Nebytová výstavba / rekonštrukcia* obsahuje: Sloop & strip-out, Grondwerk & fundering, Hoofddraagconstructie, Gevel & dak, Installaties (W/E), Afbouw, Inregelen & testen a Oplevering. Názvy sú údaje vášho projektu a zostávajú holandské, aj keď je rozhranie v inom jazyku. Ak nie je zapnutý *Zapnúť stavebný režim*, existuje iba *Prázdny*. Pozrite [Nastavenia aplikácie](docs://ref-instellingen).

**Pracovná zmena** — pole sa zobrazí iba vtedy, keď je zapnuté *Zapnúť plánovanie v hodinách*. Vyberte z možností *Denná pracovná zmena*, *2 pracovné zmeny*, *3 pracovné zmeny* a *24/7*. Predvolené: *Denná pracovná zmena*. Účinok: *Denná pracovná zmena* ponechá štandardný kalendár tak, ako je, teda bežný denný kalendár od pondelka do piatka. Ostatné tri umiestnia bloky pracovného času do kalendára projektu, rovnako ako tlačidlá s rovnakým názvom v okne *Kalendáre*. Aké časy to sú, nájdete v [Nastavenie pracovných časov](docs://howto-werktijden-instellen). Ak je zvolená *Denná pracovná zmena*, nedá sa vybrať *Hodiny* pod *Predvolená jednotka pre nové úlohy*, lebo denný kalendár nemá bloky pracovného času.

**Súbor sviatkov** — ktoré voľné dni dostane kalendár projektu. V poli *Krajina* vyberiete *Holandsko* (predvolené), *Nemecko*, *Belgicko*, *Francúzsko*, *Spojené kráľovstvo*, *Rakúsko*, *Švajčiarsko*, *Žiadne sviatky* alebo *Vlastné…*. Ak krajina má regióny, pridá sa rozbaľovací zoznam *Región*. Pri výbere *Holandsko* navyše, ak je zapnuté *Zapnúť stavebný režim*, sa zobrazí *Stavebná dovolenka*: *Žiadna* (predvolené), *Sever*, *Stred* alebo *Juh*. Pod tým je riadok, napríklad *Sviatky: 36, 2025–2029*, ktorý rozbalíte, ak chcete zoznam. Roky idú od roka pred dátumom začiatku po rok za dátumom dokončenia, alebo do troch rokov po roku začiatku, ak nie je dátum dokončenia. *Vlastné…* vytvorí kalendár bez sviatkov a hneď po vytvorení otvorí okno *Kalendáre*, aby ste ich mohli doplniť sami. Kalendár projektu sa volá *Bouwkalender NL*, alebo *Standaardkalender*, ak nie je zapnuté *Zapnúť stavebný režim*. Výber je potom aj *Žiadne sviatky*. Ako generátor funguje, nájdete v [Generovanie sviatkov a stavebnej dovolenky](docs://howto-feestdagen-genereren).

## Čo robí dátum začiatku

Dátum začiatku je kotva projektu. Tri pravidlá:

- **Nové úlohy začínajú na dátume začiatku.** Pridaná úloha sa naplánuje na začiatok projektu.
- **Úloha s predchádzajúcou úlohou nikdy nezačne pred dátumom začiatku.** Ak je dokončenie predchádzajúcej úlohy skoršie, úloha čaká do dátumu začiatku. Úloha *bez* predchádzajúcej úlohy si ponechá svoj dátum, aj keď leží pred dátumom začiatku. Je to potrebné, aby sa plán z MS Project alebo Primavery zobrazil tak, ako ho zobrazuje zdrojový program. Obmedzenie *Musí začať dňa (MSO)* alebo *Musí skončiť dňa (MFO)* porušuje obe pravidlá: taká úloha ostáva na svojom dátume, aj keď ten pripadne pred dátumom začiatku.
- **Neskorší dátum začiatku posunie voľné úlohy.** Ak nastavíte dátum začiatku neskôr v okne *Nastavenia projektu* a kliknete na *Použiť*, úlohy, ktoré ležia pred novým dátumom, sa posunú na tento dátum. Ide o úlohy bez predchádzajúcej úlohy a bez obmedzenia, ktoré nastavuje spodnú hranicu: *Začiatok nie skôr ako*, *Dokončiť nie skôr ako*, *Musí začať dňa* alebo *Musí skončiť dňa*. Posun je v tom istom kroku v *Vrátiť späť*. Aplikácia povie, koľko úloh sa posunulo. Stane sa to iba vtedy, keď dátum začiatku zmeníte sami, nikdy pri otvorení súboru. Neskorší dátum začiatku nepresúva zvyšok plánu: to robí *Presunúť projekt*, pozrite [Presun projektu](docs://howto-project-verplaatsen).

## Pozri tiež

- [Možnosti výpočtu a pravidlá výpočtu](docs://ref-rekenopties-en-conventies): blok *Profil výpočtu a možnosti výpočtu*.
- [Profily výpočtu a pravidlá výpočtu](docs://uitleg-rekenprofielen): prečo profil mení výsledok.
- [Presun projektu](docs://howto-project-verplaatsen): celý plán na iný začiatok.
- [Pridanie úloh a medzníkov](docs://howto-taken-en-mijlpalen-toevoegen): ako začať s prvými úlohami.
- [Generovanie sviatkov a stavebnej dovolenky](docs://howto-feestdagen-genereren): súbor sviatkov podrobne.
- [Výber schémy IFC](docs://howto-ifc-schema-kiezen): uloženie pre model budovy v IFC4.

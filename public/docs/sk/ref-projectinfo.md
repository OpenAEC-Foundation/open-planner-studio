# Nový projekt a Info o projekte

Polia okna *Nový projekt* a okna *Info o projekte*: čo každé pole robí, aká je predvolená hodnota a kde sa prejaví. Sú to dve strany rovnakého formulára. *Nový projekt* vytvorí nový projekt a má niekoľko ďalších polí. *Info o projekte* mení projekt, ktorý máte otvorený.

## Otvorenie

**Nový projekt** — *Súbor › Nová*, Ctrl+N, alebo tlačidlo plus vpravo od kariet dokumentov (*Začať projekt*, potom *Nový projekt*). Okno sa otvorí s kurzorom v poli *Názov projektu*.

**Info o projekte** — *Nastavenia › Projekt › Info o projekte* otvorí formulár ako okno s názvom *Informácie o projekte*. *Súbor › Info o projekte* zobrazí rovnaký formulár na obrazovke *Súbor*. Blok *Profil výpočtu a možnosti výpočtu* je dole na oboch miestach. Čo v ňom je, nájdete v [Možnosti výpočtu a pravidlá výpočtu](docs://ref-rekenopties-en-conventies).

## Vytvoriť, Použiť a zrušiť

**Vytvoriť** (v okne *Nový projekt*) vytvorí projekt a otvorí ho na vlastnej karte. **Použiť** (v okne *Info o projekte*) zapíše vaše zmeny do projektu.

- **Iba pri Použiť.** Zadávate údaje do konceptu. Projekt sa mení, až keď kliknete na *Použiť*. *Použiť* zapíše iba to, čo ste skutočne zmenili, ako jeden krok, ktorý sa dá vrátiť cez *Vrátiť späť*. Ak kliknete na *Použiť* bez zmeny, nič sa nestane a krok sa nepridá.
- **Zrušiť, krížik a Esc** zavrú okno bez uloženia čohokoľvek. Kliknutie vedľa okna ho nezavrie: to, čo ste napísali, zostane.
- **Enter** urobí to isté ako *Vytvoriť* alebo *Použiť*, okrem poľa *Popis* a otvoreného rozbaľovacieho zoznamu.
- **Na obrazovke Súbor** zobrazí *Info o projekte* na konci *Zmeny nie sú použité — kliknite na Použiť, aby ste ich uložili.*, kým sa váš koncept líši. Ak potom obrazovku opustíte, aplikácia sa spýta, či chcete zmeny použiť, zahodiť alebo zrušiť. Pozrite si [Pás s nástrojmi, karta po karte](docs://ref-lint).
- **Vlastný profil výpočtu bez názvu** blokuje *Použiť* a *Vytvoriť*. Zadajte mu názov alebo zmenu zahoďte.

## Polia v oboch oknách

**Názov projektu** — názov projektu v titulnom riadku, na karte a v názve súboru pri uložení. Predvolené: prázdne. Prázdne pole je povolené: projekt sa potom volá *Nový plán*, zobrazený sivým textom v poli. Kde: celá obrazovka.

**Popis** — voľný text. Predvolené: prázdne. Účinok: uloží sa s projektom, v súbore IFC a pri exporte do Primavera P6 XML. Nemá vplyv na plán.

**Autor** — voľný text. Predvolené: prázdne. Účinok: zapíše sa do súboru IFC a zobrazí sa ako *Autor:* v hlavičke zostavy, kde ho nemôžete znova zadať.

**Knižnica zdrojov** — s ktorou knižnicou zdrojov je projekt prepojený. Vyberte z možností *žiadna knižnica (samostatný projekt)*, vaše existujúce knižnice a *+ Nová knižnica zdrojov…*. Predvolené: v okne *Nový projekt* predvolená knižnica, v okne *Info o projekte* aktuálne prepojenie. Účinok: pozrite si [Používanie knižnice zdrojov](docs://howto-resourcebibliotheek-gebruiken). Pri *+ Nová knižnica zdrojov…* zadáte názov do poľa nižšie. Knižnica sa vytvorí až pri *Vytvoriť* alebo *Použiť*, takže zrušenie nezanechá nič. Prepojenie v *Info o projekte* sa zmení, iba ak sami upravíte toto pole.

**Klient/organizácia** — voľný text. Predvolené: prázdne. Účinok: zapíše sa do súboru IFC a zobrazí sa ako *Spoločnosť:* v hlavičke zostavy.

**Dátum začiatku** — začiatok projektu. Predvolené: v okne *Nový projekt* dnešný deň. Čo pole robí, nájdete nižšie v časti *Čo robí dátum začiatku*.

**Dátum konca** — plánované dokončenie projektu. Predvolené: prázdne. Účinok: ide o informáciu, nie o požiadavku. Aplikácia podľa tohto dátumu neplánuje. Zobrazí sa v hlavičke zostavy a v exportoch. Určuje, do ktorého roka sa generujú sviatky. Iba pri súbore Primavera s nastavením *Prepočítať časovú rezervu do dokončenia projektu* (pozrite si [Možnosti výpočtu a pravidlá výpočtu](docs://ref-rekenopties-en-conventies)) sa výpočet časovej rezervy vykoná až do tohto dátumu.

**Predvolená jednotka pre nové úlohy** — je viditeľné, iba keď je zapnutá možnosť *Zapnúť plánovanie v hodinách*. Vyberte z možností *Dni* a *Hodiny*. Predvolené: *Dni*. Účinok a podmienky: pozrite si [Zapnutie plánovania v hodinách](docs://howto-urenplanning-aanzetten).

**Profil výpočtu a možnosti výpočtu** — v okne *Info o projekte* celý blok. V okne *Nový projekt* iba rozbaľovací zoznam *Profil výpočtu* s možnosťami *Primavera P6*, *Microsoft Project* a *Open Planner Studio*. Predvolené: *Open Planner Studio*. Keď vyberiete profil, nastavia sa aj jeho predvolené možnosti. Pozrite si [Možnosti výpočtu a pravidlá výpočtu](docs://ref-rekenopties-en-conventies).

## Iba v okne Nový projekt

**Šablóna fáz** — s ktorými fázami projekt začína. Vyberte z možností *Prázdny*, *Bytová výstavba* a *Nebytová výstavba / rekonštrukcia*. Predvolené: *Prázdny*. Účinok: *Prázdny* vytvorí projekt bez úloh. Ostatné dve pripravia osem úloh fáz. Každá má trvanie 5 v predvolenej jednotke projektu (5 pracovných dní, alebo 5 hodín, ak vyberiete *Hodiny* v poli *Predvolená jednotka pre nové úlohy*). Úlohy nemajú závislosti. Názvy, presun a rozšírenie úloh robíte sami. Pre *Bytová výstavba* sú to: Bouwplaats & grondwerk, Fundering, Ruwbouw / casco, Dak, Gevel & afbouw, Installaties (W/E), Afwerking a Oplevering. Pre *Nebytová výstavba / rekonštrukcia* sú to: Sloop & strip-out, Grondwerk & fundering, Hoofddraagconstructie, Gevel & dak, Installaties (W/E), Afbouw, Inregelen & testen a Oplevering. Názvy sú údaje vášho projektu a zostávajú v holandčine, aj keď je jazyk rozhrania iný. Ak je *Zapnúť stavebný režim* vypnuté, existuje iba *Prázdny*. Pozrite si [Nastavenia](docs://ref-instellingen).

**Pracovná zmena** — viditeľné, iba keď je zapnutá možnosť *Zapnúť plánovanie v hodinách*. Vyberte z možností *Denná pracovná zmena*, *2 pracovné zmeny*, *3 pracovné zmeny* a *24/7*. Predvolené: *Denná pracovná zmena*. Účinok: *Denná pracovná zmena* nechá štandardný kalendár, teda bežný denný kalendár od pondelka do piatka. Ostatné tri pridajú bloky pracovného času do kalendára projektu. Robia to tak ako tlačidlá s rovnakým názvom v okne *Kalendáre*. Aké časy to sú, nájdete v [Nastavenie pracovných časov](docs://howto-werktijden-instellen). Pri možnosti *Denná pracovná zmena* sa *Hodiny* nedá vybrať v poli *Predvolená jednotka pre nové úlohy*, lebo denný kalendár nemá bloky pracovného času.

**Súbor sviatkov** — ktoré sviatky dostane kalendár projektu. V poli *Krajina* vyberiete *Holandsko* (predvolené), *Nemecko*, *Belgicko*, *Francúzsko*, *Spojené kráľovstvo*, *Rakúsko*, *Švajčiarsko*, *Žiadne sviatky* alebo *Vlastný…*. Ak krajina má regióny, pridá sa rozbaľovací zoznam *Región*. Pre Holandsko vyberiete aj, ak je zapnuté *Zapnúť stavebný režim*, *Stavebná dovolenka*: *Žiadna* (predvolené), *Sever*, *Stred* alebo *Juh*. Pod tým je riadok, napríklad *Sviatky: 36, 2025–2029*. Ten rozbalíte a zobrazíte zoznam. Roky idú od roka pred dátumom začiatku po rok za dátumom konca. Ak dátum konca nie je, ide to až do troch rokov po roku začiatku. *Vlastný…* dá kalendár bez sviatkov a hneď po vytvorení otvorí okno *Kalendáre*, aby ste ich mohli doplniť sami. Kalendár projektu sa volá *Bouwkalender NL*, alebo *Standaardkalender*, ak je *Zapnúť stavebný režim* vypnuté. Výber je potom aj *Žiadne sviatky*. Ako generátor funguje, nájdete v [Generovanie sviatkov a stavebnej dovolenky](docs://howto-feestdagen-genereren).

## Čo robí dátum začiatku

Dátum začiatku je kotva projektu. Tri pravidlá:

- **Nové úlohy začínajú na dátume začiatku.** Úloha, ktorú pridáte, dostane začiatok projektu ako plánovaný začiatok.
- **Úloha s predchádzajúcou úlohou nikdy nezačne pred dátumom začiatku.** Ak je dokončenie predchádzajúcej úlohy skoršie, úloha čaká do dátumu začiatku. Úloha *bez* predchádzajúcej úlohy si zachová svoj dátum, aj keď je pred dátumom začiatku. Je to potrebné, aby sa plán z MS Project alebo Primavera zobrazil tak, ako ho ukazuje zdrojový program. Obmedzenie *Musí začať dňa (MSO)* alebo *Musí skončiť dňa (MFO)* porušuje obe pravidlá. Taká úloha zostane na svojom dátume, aj keď ten padne pred dátumom začiatku.
- **Neskorší dátum začiatku posunie voľné úlohy.** Ak nastavíte dátum začiatku neskôr v *Info o projekte* a kliknete na *Použiť*, posunú sa na nový dátum úlohy bez predchádzajúcej úlohy a bez obmedzenia, ktoré nastavuje spodnú hranicu (*Začiatok nie skôr ako*, *Musí začať dňa*, *Dokončiť nie skôr ako* alebo *Musí skončiť dňa*). Posunú sa iba vtedy, ak by ležali pred novým dátumom. Posun prebehne ako jeden krok, ktorý sa dá vrátiť cez *Vrátiť späť*. Aplikácia oznámi, koľko úloh sa posunulo. Stáva sa to iba vtedy, keď dátum začiatku zmeníte sami, nikdy pri otvorení súboru. Neskorší dátum začiatku neposúva zvyšok plánu. To robí *Presunúť projekt*. Pozrite si [Presun projektu](docs://howto-project-verplaatsen).

## Pozrite tiež

- [Možnosti výpočtu a pravidlá výpočtu](docs://ref-rekenopties-en-conventies): blok *Profil výpočtu a možnosti výpočtu*.
- [Profily výpočtu a pravidlá výpočtu](docs://uitleg-rekenprofielen): prečo profil mení výsledok.
- [Presun projektu](docs://howto-project-verplaatsen): celý plán na iný začiatok.
- [Pridávanie úloh a medzníkov](docs://howto-taken-en-mijlpalen-toevoegen): ako začať s prvými úlohami.
- [Generovanie sviatkov a stavebnej dovolenky](docs://howto-feestdagen-genereren): súbor sviatkov podrobne.

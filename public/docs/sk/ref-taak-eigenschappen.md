# Okno úlohy a panel vlastností

Úlohu môžete upraviť na dvoch miestach: v okne *Upraviť úlohu* a na paneli *Vlastnosti*. Takmer všetky polia sú na oboch miestach rovnaké. Tento článok pre každé pole popisuje, čo robí, aká je predvolená hodnota a čo sa z nej prejaví. Ako vytvoriť a nastaviť úlohu, nájdete v článku [Pridávanie úloh a medzníkov](docs://howto-taken-en-mijlpalen-toevoegen). Prečo výpočet vychádza tak, ako vychádza, je v článku [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad).

## Dve miesta

- **Upraviť úlohu** — okno pre prvú vybranú úlohu. Otvorte ho klávesom F2, dvojklikom na pruh v diagrame Gantt alebo kliknutím pravým tlačidlom myši na úlohu v diagrame Gantt alebo v tabuľke a výberom *Upraviť...*. Vaše zmeny zostanú v koncepte, kým nekliknete na *Uložiť* (Enter). *Zrušiť* (Esc) ich zahodí. *Uložiť* je neaktívne, kým je názov prázdny. Uloženie je jeden krok v *Vrátiť späť*. To platí aj pre to, čo ste urobili v častiach *Pravidlo práce*, *Závislosti*, *Priradenia* a *Kódy a polia*. Tie už počas úprav pôsobia na projekt. *Zrušiť* ich vráti späť.
- **Vlastnosti** — panel v pravom stĺpci pre aktívnu úlohu. Každá zmena sa uplatní hneď. Po sebe idúce zmeny rovnakého poľa sa počítajú ako jeden krok v *Vrátiť späť*. Bez úlohy panel zobrazí *Vyberte úlohu, ak chcete zobraziť vlastnosti*. Zapnite ho alebo vypnite cez *Zobrazenie › Panely › Vlastnosti*. Predvolené: zapnuté. Panel je vedľa diagramu Gantt a na karte *Tabuľka*. Nie je na karte *IFC* ani na karte *Zostava* a nie je pod celým panelom zdrojov.

Iba v okne sú *Nadradená úloha* a tlačidlá *Uložiť* a *Zrušiť*. Iba na paneli sú ikona koša *Odstrániť úlohu*, tlačidlo *Prepočítať* dole, časť *Prestávky*, tri značky v časti *Pravidlo práce* (dlhý nepracovný čas, MS Project, zaznamenané dátumy) a pridávanie závislostí a skok na prepojenú úlohu v časti *Závislosti*. Všetky ostatné polia sú na oboch miestach. Okno zobrazí *Závislosti*, *Priradenia* a *Kódy a polia* iba pri existujúcej úlohe.

Ak ste zmenili niečo, čo mení termíny, stlačte *Prepočítať*. Prepočet sa nespustí sám, pokiaľ nie je zapnutý *Automatický prepočet*.

## Všeobecné

- **Názov** (v okne *Názov \**) — názov úlohy v diagrame Gantt, v tabuľke a v zostavách. Povinné: prázdny názov sa neuloží. Predvolený názov novej úlohy: *Nová úloha*.
- **Kód WBS** — štruktúrny kód úlohy, napríklad `RB-301`. Povinné. Ak je zapnuté *Plán › Štruktúra › WBS automaticky*, pole je zablokované (text nápovedy: *Kódy WBS sa číslujú automaticky (Plán → Štruktúra)*), lebo kódy potom spravuje aplikácia.
- **Popis** — voľný text. Nemá vplyv na výpočet. Môžete ho zobraziť ako stĺpec *Popis* v tabuľke.
- **Typ** — typ úlohy. Zoznam má skupiny *Vstavané typy* (*Stavba*, *Inštalácia*, *Demolácia*, *Logistika*, *Kontrola/inšpekcia*, *Presun*, *Rekonštrukcia*, *Údržba*), *Moje typy úloh* a *Z tohto projektu*. Typ *Iné* sa zobrazí, len ak úloha tento typ už má. Dole sú *+ Vytvoriť typ úlohy…* a *Spravovať typy úloh…*. Predvolené: typ nadradenej úlohy, inak *Stavba* (režim stavby je zapnutý predvolene) alebo *Iné*. Vplyv: žiadny na výpočet. Podľa typu môžete zoskupovať, filtrovať a farbiť pruhy. Aplikácia drží vlastný typ na vašom zariadení. Keď ho vyberiete, kópia sa uloží do projektu (*Z tohto projektu*). Ak zadáte názov pri *+ Vytvoriť typ úlohy…* a taký už je v *Moje typy úloh*, aj s inými veľkými písmenami, aplikácia nevytvorí druhý typ, ale vyberie existujúci. V *Spravovať typy úloh…* upravíte alebo odstránite iba svoje typy. Prázdny názov alebo názov, ktorý už existuje, sa neuloží. Ak odstránite typ, ktorý otvorený projekt používa, aplikácia sa najprv opýta a kópia v projekte zostane. Typ pod *Z tohto projektu*, napríklad zo súboru iného autora, sa dostane do vášho zoznamu až vtedy, keď v *Spravovať typy úloh…* kliknete na *Pridať do mojich typov úloh*.
- **Kalendár** — kalendár, v ktorom úloha počíta svoje trvanie, dátum dokončenia a časovú rezervu. Predvolené: *Projektový kalendár: {name}*. Vplyv: úloha vo vlastnom kalendári pracuje iné dni ako projektový kalendár. Po zmene stlačte *Prepočítať*, aby sa dátumy prepočítali. Pozri [Kalendáre a pracovné dni](docs://uitleg-kalenders).
- **Nadradená úloha** (iba v okne) — presunie úlohu pod inú úlohu. Predvolené: súčasná nadradená úloha. *- Žiadna (koreň) -* ju presunie na najvyššiu úroveň. Voľba, ktorá by vytvorila cyklus v závislostiach, sa pri *Uložiť* odmietne hlásením a okno zostane otvorené.

## Poznámky

- **Poznámky** — kontrolný zoznam úlohy. *Pridať poznámku* pridá riadok. Značka (*Hotovo*) ho prečiarkne. Ikona koša (*Odstrániť*) ho zmaže. Bez riadkov zobrazí *Zatiaľ žiadne poznámky*. Nemá vplyv na výpočet. Stĺpec *Poznámky* v tabuľke ich zobrazí so značkou ✓ alebo ○ pred textom.

## Medzník

- **Medzník** — z úlohy urobí medzník. Predvolené: vypnuté. Vplyv: trvanie sa zmení na 0. Aplikácia to pri súhrnnej úlohe (úloha s čiastkovými úlohami) a pri úlohe s priradeniami zdrojov odmietne hlásením. Najskôr odstráňte priradenia. Ak to znova odškrtnete, zmiznú *Typ medzníka* a *Povinný (zmluvný)*.
- **Typ medzníka** (iba pre medzník) — *Automaticky*, *Medzník začiatku* alebo *Medzník dokončenia*. Predvolené: *Automaticky*. Vplyv: medzník začiatku je na začiatku dňa, medzník dokončenia na konci dňa. Ak je *Typ medzníka* nastavený na *Automaticky*, medzník sa počíta ako medzník začiatku, keď je predchádzajúcou úlohou, a je na začiatku dňa.
- **Povinný (zmluvný)** (iba pre medzník) — označuje zmluvný medzník, napríklad kontrolu alebo odovzdanie. Predvolené: vypnuté. Vplyv: značka pre diagram Gantt a zostavy. Nechráni termín. Na to použite obmedzenie alebo termín.

## Čas

- **Začiatok** (v okne *Dátum začiatku*) — zobrazí vypočítaný začiatok. Je to rovnaký dátum ako pruh v diagrame Gantt a ako stĺpec *Začiatok*, nie surový plánovací údaj. Povinné: prázdne pole sa vráti na pôvodnú hodnotu. Vplyv zadania: nový dátum sa stane plánovaným začiatkom (stĺpec *Plánovaný začiatok*). Ak úloha má predchádzajúcu úlohu a ešte sa nezačala, aplikácia zapíše nový začiatok ako obmedzenie *Začiatok nie skôr ako (SNET)* na tento dátum (alebo presunie existujúce SNET) a zobrazí hlásenie. Po *Prepočítať* sa úloha preto nezačne skôr. Ak existuje obmedzenie iné ako *ASAP* alebo *SNET*, aplikácia začiatok nepoužije a povie, ktoré obmedzenie určuje začiatok.
- **Trvanie** — ako dlho úloha trvá. Napíšte `5d` pre dni, alebo `12h` či `1h 30m` pre hodiny. Číslo bez jednotky platí v jednotke úlohy. Dni sú vždy celé. Hodiny môžu mať desatinnú časť. Neplatný zápis zobrazí hlásenie *Zadajte celé číslo dní alebo hodín, napríklad 2d alebo 12h.* a pole sa vráti späť. Predvolené pre novú úlohu: 5 dní (medzník: 0). Pole je zablokované pri súhrnnej úlohe, pri hamaku a pri medzníku s trvaním 0. Ich trvanie vyplýva z iných úloh alebo je nula. Úloha v hodinách je zablokovaná, kým nie je zapnuté *Zapnúť plánovanie v hodinách*. Je to tlačidlo s rovnakým názvom. Vplyv: po *Prepočítať* trvanie určí dokončenie v kalendári úlohy. Ak má úloha zdroje a pravidlo práce, pravidlo rozhodne, či sa pohybuje práca alebo jednotky. Ak je úloha čiastočne hotová, aplikácia odmietne trvanie kratšie, než je vykonaná práca. Pozri [Dni a hodiny](docs://uitleg-dagen-en-uren).
- **Jednotka trvania** — voľba *Dni* alebo *Hodiny*, s tlačidlom nápovedy vedľa nej. Je viditeľná, iba keď sú zapnuté *Zapnúť plánovanie v hodinách* a *Povoliť zmiešané plánovanie dní/hodín*. Ten je predvolene zapnutý, keď je plánovanie v hodinách zapnuté. Vplyv: aplikácia prevedie hodnotu iba vtedy, keď je výsledok presný. Potom navrhne zmenu (*Použiť návrh*) alebo ponechanie (*Ponechať*). Ak výsledok nie je presný, jednotka zostane a aplikácia to povie. Kalendár bez platných pracovných časov prepnutie odmietne.
- **Pravidlo práce** — ktoré dve veličiny zostanú pevné, keď sa zmení tretia. Vzťah je trvanie × jednotky = práca. Voľby: *Štandard projektu (Pevné trvanie a jednotky priradenia)*, *Pevné trvanie a jednotky priradenia*, *Pevné trvanie a práca*, *Pevná práca* a *Pevné jednotky priradenia*. Predvolené: štandard projektu. Pod voľbou je to, čo pravidlo chráni (*Chránené: …*). Pri úlohe z MS Project je to *Z MS Project: riadené úsilím* alebo *Z MS Project: nie je riadené úsilím*. Pravidlo je viditeľné, iba keď je zapnuté *Zobraziť pravidla práce a prácu* (*Nastavenia*, karta *Plán*, nadpis *Prepočítanie*). Alebo keď súbor sám nesie pravidlá práce či uloženú prácu. Iba pri bežnej úlohe: nie pri súhrnnej úlohe, medzníku, hamaku ani pri úlohe s uplynulým trvaním. Pozri [Pravidlá práce: trvanie, jednotky a práca](docs://uitleg-werkregels).

## Hamak

- **Hamak (odvodené trvanie)** — nechá trvanie vyplynúť z dvoch iných úloh namiesto vlastného trvania. Predvolené: vypnuté. Iba pre bežnú úlohu, nie pre medzník ani súhrnnú úlohu. Keď je zapnuté: *Určujúca závislosť začiatku* zobrazí predchádzajúce úlohy so závislosťou dokončenie-začiatok alebo začiatok-začiatok. *Určujúca závislosť dokončenia* zobrazí tie so závislosťou dokončenie-dokončenie alebo začiatok-dokončenie, každú s typom závislosti za ňou. Ak nemáte určujúcu závislosť dokončenia, zobrazí sa *Žiadna určujúca závislosť dokončenia (FF/SF) — rozpätie sa nastaví na nulovú dĺžku.* a trvanie je nula. Pozri [Vytvorenie hamaka](docs://howto-hammock).

## Obmedzenie a termín

Na súhrnnej úlohe nemá obmedzenie ani termín žiadny vplyv. Výpočet počíta iba úlohy bez čiastkových úloh. Dátumy súhrnnej úlohy sa odvodia z jej čiastkových úloh.

- **Obmedzenie** — dátumový limit pre úlohu. Možnosti: *Čo najskôr (ASAP)*, *Čo najneskôr (ALAP)*, *Začiatok nie skôr ako (SNET)*, *Začiatok nie neskôr ako (SNLT)*, *Dokončiť nie skôr ako (FNET)*, *Dokončiť nie neskôr ako (FNLT)*, *Musí začať dňa (MSO)* a *Musí skončiť dňa (MFO)*. Predvolené: *Čo najskôr (ASAP)*, čo je bez obmedzenia. Ak zvolíte *ASAP*, všetky obmedzenia úlohy zmiznú. Ak zvolíte *ALAP*, zmizne sekundárne obmedzenie. Vplyv po *Prepočítať*: limit úlohu presunie alebo spôsobí zápornú časovú rezervu. Pozri [Obmedzenia a termíny](docs://uitleg-constraints).
- **Dátum obmedzenia** — dátum patriaci k obmedzeniu. Viditeľný pri každom obmedzení okrem *ALAP*. Povinné. Nové obmedzenie dostane ako dátum plánovaný začiatok.
- **Povinné (logika pripnutia)** — iba pre *MSO* a *MFO*. Predvolené: vypnuté. Zapnuté: dátum je pevný, prepíše závislosti a pripne pruh aj pred jeho predchádzajúcimi úlohami. Porušenie spôsobí zápornú časovú rezervu vyššie v sieti. Pri prvom zapnutí sa raz zobrazí vysvetlenie.
- **Sekundárne obmedzenie** a **Sekundárny dátum** — druhý limit, iba jeden z *SNET*, *FNET*, *SNLT* alebo *FNLT* (alebo *(žiadne)*). Je viditeľný, hneď ako existuje primárne obmedzenie, ktoré nie je *ASAP*, *ALAP* ani pevné pripnutie. Je vždy mäkké. Zakázaná kombinácia dostane červený okraj a dôvod. Sekundárne obmedzenie nesmie byť pevné, nesmie byť s *MSO* alebo *MFO* ani s pevným pripnutím, nesmie byť s *ASAP* alebo *ALAP* a musí ísť o hranicu. Primárne a sekundárne obmedzenie nesmú ohraničovať tú istú stranu. Platný pár je napríklad SNET s FNLT.
- **Termín** — cieľový dátum dokončenia. Prázdne pole znamená žiadny termín. Vplyv: úloha sa kvôli nemu nepresúva. Ak je skoré dokončenie neskôr, časová rezerva je záporná a aplikácia ohlási *Termín … zmeškaný — skoré dokončenie …*.

## Postup

- **Postup (%)** — posúvač od 0 do 100. Predvolené: 0. Vplyv: nad 0 aplikácia doplní chýbajúci *Skutočný začiatok* a hodnota 100 doplní *Skutočné dokončenie*. Stav sa mení: *Nezačaté* bez skutočného začiatku, *Prebieha* so skutočným začiatkom a *Dokončené* so skutočným dokončením. Zostávajúce trvanie (*Zostáva*) je trvanie × (1 − postup), zaokrúhlené na celé dni pri úlohe v dňoch a na celé minúty pri úlohe v hodinách. Vykonaná práca sa počíta do dátumu kontroly stavu. Ak ešte nie je nastavený, aplikácia ho nastaví na dnešný dátum a povie to. Pri súhrnnej úlohe je pole zablokované. Jej postup vyplýva z čiastkových úloh po *Prepočítať* (*Odvodené z čiastkových úloh: postup tam zmeňte. Súhrnná úloha sa aktualizuje po prepočítaní (F5).*).
- **Skutočný začiatok** — dátum, kedy úloha naozaj začala. Dátum po skutočnom dokončení alebo po dátume kontroly stavu sa odmietne. Ak sa úloha plánuje začať až po dátume kontroly stavu a teraz dostane postup, okno sa opýta *Zadajte skutočný začiatok*. Pri medzníku je namiesto *Skutočný začiatok* a *Skutočné dokončenie* jedno pole *Skutočný dátum*.
- **Skutočné dokončenie** — dátum, kedy bola úloha naozaj hotová. Vyplnením sa postup nastaví na 100 a stav na *Dokončené*. Vymazaním sa postup vráti na 0 a stav na *Prebieha*. Rovnaké odmietnutia ako pri poli *Skutočný začiatok*.
- **Zostáva** — iba na čítanie (nie pri medzníku): koľko trvania ešte zostáva, v jednotke úlohy.

Okno použije tieto pravidlá na koncept. Platia až po *Uložiť*. Pozri [Postup, dátum kontroly stavu a pôvodný plán](docs://uitleg-voortgang).

## Výsledok CPM

- **Výsledok CPM** — iba na čítanie: posledný výpočet. Zobrazí *Skorý začiatok*, *Skoré dokončenie*, *Neskorý začiatok*, *Neskoré dokončenie*, *Celková časová rezerva*, *Voľná časová rezerva*, *Interferujúca časová rezerva* a *Kritická cesta* (*Áno* alebo *Nie*). Časová rezerva je v pracovných dňoch, na dve desatinné miesta. Je výsledok zastaraný alebo ešte nevypočítaný? Stlačte *Prepočítať*.

## Závislosti

- **Závislosti** — závislosti tejto úlohy, jeden riadok na závislosť: prepojená úloha (na paneli kód WBS, alebo názov, ak kód chýba; v okne názov), ikona blesku, ak je závislosť určujúca (*Určujúca závislosť (driving)*, po výpočte), typ závislosti (*FS*, *SS*, *FF* alebo *SF*), oneskorenie a ikona koša. Na paneli je kód WBS tlačidlo: keď na neho ukážete, zobrazí sa úloha, kliknutím na ňu prejdete. Malá značka pred kódom ukazuje rolu úlohy v závislosti: zlatý okrúhly znak pre predchádzajúcu úlohu a fialový štvorcový pre nasledujúcu úlohu. Sú to rovnaké farby ako v [Sledovanie cesty](docs://howto-pad-traceren). Rola úlohy je aj v názve tlačidla, pre čítačku obrazovky. V okne je to obyčajný text a sekciu vidíte len vtedy, keď má úloha závislosti.
- **Oneskorenie** — zadajte číslo s jednotkou: `2d` pracovné dni, `3ed` kalendárne dni, `2u` alebo `2h` hodiny pracovnej doby, `3eu` alebo `3eh` kalendárne hodiny, `50%` percento trvania predchádzajúcej úlohy, `-25e%` percento v kalendárnom čase. Znamienko mínus urobí z oneskorenia predstih. Bez jednotky sa počíta v pracovných dňoch. Neplatný zápis označí pole červenou farbou a pole sa vráti späť. Pozri [Závislosti a oneskorenie](docs://uitleg-relaties).
- **Pridať závislosť** (iba na paneli) — otvorí koncept riadka. V poli *Smer* vyberte *Predchádzajúca úloha* alebo *Nasledujúca úloha*. Úlohu nájdite pomocou *Hľadať úlohu…* podľa kódu WBS alebo názvu, vyberte typ a oneskorenie a potvrďte *Vytvoriť závislosť* (alebo *Zrušiť*). Duplicitná závislosť alebo závislosť na vlastnú nadradenú úlohu sa odmietne hlásením a riadok zostane.

## Prestávky

Iba v paneli. Nie pri medzníku, súhrnnej úlohe, hamaku, úlohe s uplynulým trvaním, manuálne plánovanej úlohe ani pri úlohe, ktorá je na prestávku príliš krátka.

- **Prestávky** — prerušenia práce úlohy. Jeden riadok na jednu prestávku: *po* (koľko práce je pred prestávkou), *prestávka* (dĺžka) a jednotka (*pracovné dni*, pri úlohe v hodinách *hodiny*). Pod riadkom je rozsah od–do časti, ktorá nasleduje. Prestávka, ktorú vytvorilo *vyvažovanie*, nesie odznak *vyvažovanie*. Prestávka s dĺžkou 0 sa odstráni. Ikona koša pri riadku (*Odstrániť prestávku*) ju odstráni tiež. Účinok: pruh sa vykreslí prerušený a po *Prepočítať* sa dokončenie posunie o dĺžku prestávky.
- **Pridať prestávku** — pridá prestávku s dĺžkou jednej jednotky do stredu najdlhšej časti. Je zablokované, keď na prestávku nie je miesto.
- **Odstrániť všetky prestávky** — zobrazí sa, keď prestávky pochádzajú zo zdrojového súboru v tvare, ktorý sa tu nedá upraviť (*Tieto prestávky pochádzajú zo zdrojového súboru v tvare, ktorý sa tu nedá upraviť.*). Potom vidíte iba dátumy.

Pozrite si [Rozdelenie úlohy](docs://howto-taak-splitsen).

## Priradenia

- **Priradenia** — zdroje tejto úlohy. Pri každom zdroji: názov s ikonou koša (*Odstrániť*), *Jedn./deň*, *Práca (zostáva)*, *Krivka*, tlačidlo *Upraviť rozloženie práce…* a *Presunúť na…*. Dole je zoznam *Priradiť zdroj*; ten priradí zdroj s 1 jednotkou priradenia za deň. Bez zdrojov sa zobrazí *Najprv vytvorte zdroje (karta Zdroje).*; keď sú všetky zdroje priradené, zobrazí sa *Všetky zdroje sú už priradené.* Pri medzníku alebo pri súhrnnej úlohe sa zobrazí, že priradenie nie je možné.
- **Jedn./deň** — koľko zo zdroja úloha využíva za deň, číslo väčšie ako 0. Účinok: zaťaženie v histograme a preťaženie; pri pravidle práce aj práca.
- **Práca (zostáva)** — zostávajúca práca v hodinách pre tento zdroj. Zobrazí sa iba vtedy, keď sú pravidlá práce viditeľné a úloha jedno z nich má. Pri materiáli je tam pomlčka. Zámok ukazuje, ktorý roh trojuholníka chráni pravidlo práce (*Chránené pravidlom práce …*). Výstražný trojuholník (*Líši sa od jednotiek priradenia × trvania*) znamená, že uložená práca sa nerovná jednotkám priradenia × zostávajúcemu trvaniu. Histogram potom sleduje uloženú prácu.
- **Krivka** — spôsob, akým sa práca rozloží na trvanie: *Rovnomerný*, *Zaťaženie vpredu*, *Zaťaženie vzadu*, *Zvonový tvar*, *Skorý vrchol*, *Neskorý vrchol*, *Dvojitý vrchol* alebo *Korytnačka*. Predvolené: *Rovnomerný*. Ak má priradenie vlastné rozloženie práce, zobrazí sa *Rozvrh práce* a rozbaľovací zoznam je vypnutý. Importovaná krivka sa volá *Importovaná krivka*.
- **Upraviť rozloženie práce…** — otvorí rozloženie práce po pracovných dňoch pre toto priradenie. Pozrite si [Úprava rozloženia práce po hodinách](docs://howto-urenverdeling-aanpassen).
- **Presunúť na…** — presunie priradenie na inú úlohu bez čiastkových úloh, ktorá ešte nemá tento zdroj. Zobrazí sa iba vtedy, keď taká úloha existuje.

## Kódy a vlastné polia

- **Kódy a vlastné polia** — zobrazí sa iba vtedy, keď má projekt kódy aktivít alebo vlastné polia. Každý kód aktivity je zoznam s *(žiadne)* a hodnotami vo tvare `kód — popis`. Pri každom type vyberiete najviac jednu hodnotu. Každé vlastné pole má vstup, ktorý zodpovedá jeho typu: *Text*, *Číslo*, *Celé číslo*, *Náklad*, *Dátum* alebo *Áno/nie*. Účinok: nemá vplyv na výpočet; podľa nich môžete zoskupovať a filtrovať a zobraziť ich ako stĺpce. Pozrite si [Kódy a vlastné polia](docs://howto-codes-en-velden).

## Značky pod pravidlom práce

Iba v paneli a iba vtedy, keď platia.

- **Dlhé nepracovné obdobie** — *Táto úloha prechádza nepracovným obdobím (… až …, počet dní: …).*, alebo s pridaným názvom sviatku alebo stavebnej prestávky. Zobrazí sa, keď úloha prechádza súvislým obdobím dlhým 8 dní alebo viac, ktoré obsahuje aspoň jeden sviatok. Je to upozornenie, nie zamietnutie. Skontrolujte, či má plán byť takto nastavený.
- **Značka MS Project** — odznak *Riadi sa rozložením práce z MS Project*, *Okno dátumov z MS Project sa po úprave už neuplatňuje — …*, alebo *Vlastné rozloženie práce*, s *Čítať viac*. Ukazuje, či rozloženie práce zo súboru MS Project stále riadi dátumy.
- **Zapísané dátumy** — odznak pre importovaný súbor so zapísanými dátumami: *Zobrazuje dátumy tak, ako sú pre túto úlohu zapísané v súbore* (pri súbore Primavera *Zobrazuje vlastné uložené dátumy Primavery pre túto úlohu*), *Líši sa od uložených dátumov* alebo *Záznam je čiastočne neúplný — pozrite stĺpce pre neskoré dátumy a časovú rezervu*, s *Čítať viac*. Pozrite si [Dátumy tak, ako sú zapísané](docs://uitleg-datums-zoals-opgeslagen).

## Hlavička a päta panela

- **Odstrániť úlohu** — ikona koša vedľa nadpisu *Úloha*; odstráni túto úlohu spolu s jej čiastkovými úlohami ako jeden krok, ktorý sa dá vrátiť späť pomocou *Vrátiť späť*. Plán potom nie je aktuálny, kým nestlačíte *Prepočítať*.
- **Prepočítať** — tlačidlo dole; rovnaký výpočet ako *Domov › Plán › Prepočítať*.

## Čo tu nenájdete

- **Priorita vyvažovania** — nie je v okne ani v paneli. Nastavíte ju pravým kliknutím a výberom *Priorita* (*Nízka* = 100, *Normálna* = 500, *Vysoká* = 900), alebo zadáte číslo od 0 do 1000 do stĺpca *Priorita vyvažovania*. Predvolené: 500. Účinok: vyvažovanie najprv nepresúva úlohy s vyššou prioritou. Úloha s hodnotou 1000 sa pripne, takže ju vyvažovanie nikdy nepresunie. Pozrite si [Vyvažovanie](docs://uitleg-nivelleren).
- **Ostatné údaje o úlohe** — ostatné údaje, ktoré úloha obsahuje, napríklad stĺpce *Manuálne plánovaná*, *Farba* a technické stĺpce, sú iba v tabuľke. Pozrite si [Stĺpce tabuľky](docs://ref-tabelkolommen).

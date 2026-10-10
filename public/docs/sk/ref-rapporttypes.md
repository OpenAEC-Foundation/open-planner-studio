# Typy zostáv

Každá zostava na karte *Zostava*, s možnosťami, ktoré k nej patria: čo robia, predvolená hodnota, čo sa v zostave zmení a kde ich nájdete. Ako zostavu vytvoriť a uložiť ako PDF, je opísané v článku [Vytvorenie a tlač zostavy](docs://howto-rapport-maken-en-afdrukken).

## Ako funguje okno zostavy

Otvorte kartu *Zostava* (alebo stlačte Ctrl+P). Vľavo je stĺpec *Zostava* s rozbaľovacím zoznamom *Typ zostavy*, časť *Súhrn* s počtami, časť *Nastavenia* alebo *Možnosti zostavy* a dole tlačidlo *Exportovať PDF*. Vpravo je náhľad. To, čo vidíte v náhľade, ide do PDF.

**Typ zostavy** — ktorú zostavu vidíte. Na výber sú jedenásť zostáv. Predvolené: *Gantt-zostava*. Kde: *Zostava*, hore v stĺpci *Zostava*.

**Exportovať PDF** — vytvorí PDF. Účinok: výsledok je len PDF; aplikácia nič nepošle na tlačiareň. Ak je plán zastaraný, aplikácia ho najprv vypočíta. Ak výpočet zlyhá, napríklad kvôli slučke v závislostiach, tlačidlo nevytvorí žiadny súbor a zobrazí chybu. Kde: *Zostava*, dole v stĺpci *Zostava*.

**Zapamätané.** Aplikácia uchováva všetky možnosti zostavy na tomto zariadení, pre všetky vaše projekty. Nepatria do súboru projektu. Iba pole *Spoločnosť:* v Gantt-zostave sa neukladá.

**Aktuálny plán.** Zostavy používajú posledný výpočet. Ak sa plán od neho zmenil, tabuľkové zostavy zobrazia hore: *Plán sa zmenil od posledného prepočtu — stlačte Prepočítať (F5) pre aktuálne hodnoty.* Ak sa nikdy nič nepočítalo, zobrazí sa *Ešte nie je prepočítané — stlačte Prepočítať (F5) pre dátumy a časovú rezervu.* Ak je projekt v zobrazení *Zaznamenané dátumy*, zostavy zobrazia dátumy zo zdrojového súboru a o tom zobrazí upozornenie.

**Skratky.** *pd* sú pracovné dni. *TF* je celková časová rezerva, *FF* je voľná časová rezerva.

## Papier a orientácia

**Papier:** — veľkosť papiera PDF. Na výber sú A4, A3, A2 a A1. Predvolené: A3. Účinok: strany sa rozložia pre túto veľkosť. Platí jedna voľba pre všetky zostavy: čo vyberiete pre jednu zostavu, platí aj pre ostatné. Na výške A4 sa široká tabuľka zmenší, lebo sa prispôsobí šírke strany. Kde: *Nastavenia* (Gantt-zostava a Diagram zdrojov) alebo *Možnosti zostavy* (sedem tabuľkových zostáv). Prehľad medzníkov a Odchýlka nemajú žiadne voľby.

**Orientácia:** — na šírku alebo na výšku. Na výber sú *Na šírku* a *Na výšku*. Predvolené: *Na šírku*. Účinok: ako pri *Papier:*. Kde: na rovnakom mieste ako *Papier:*.

## Gantt-zostava

Plán ako pruhový graf, s tabuľkou vľavo a časovou osou vpravo, podľa potreby cez viac strán. Náhľad ukazuje papier s hlavičkou strany, tabuľkou, časovou osou a legendou. Časť *Súhrn* počíta *Úlohy:*, *Listové úlohy:*, *Kritické:* a *Závislosti:*. Všetky možnosti sú pod *Nastavenia*.

**Spoločnosť:** — spoločnosť v hlavičke strany. Predvolené: spoločnosť z info o projekte. Účinok: iba hlavička zostavy; čo tu napíšete, sa neukladá. Zmeňte spoločnosť v *Nastavenia › Projekt › Info o projekte*, v poli *Objednávateľ/organizácia*, a potvrďte tlačidlom *Použiť*.

**Autor:** — autor v hlavičke strany. Iba na čítanie: aplikácia ho prevezme z info o projekte.

**Veľkosť písma:** — veľkosť textu a tabuľky v zostave. Na výber sú 90%, 100%, 110% a 125%. Predvolené: 100%. Účinok: pri väčšom písme rastú text, riadky a tabuľka a časová os stratí šírku. Nezávisí od *Veľkosť textu* v nastaveniach.

**Farby pruhov:** — od čoho závisí farba pruhu. Na výber sú *Kritická cesta*, *Podľa úlohy — automaticky* a *Podľa kategórie*, s rozbaľovacím zoznamom *Pole kategórie* pre *Podľa kategórie*. Predvolené: *Kritická cesta*. Účinok: je to rovnaká voľba ako *Farby pruhov* na karte *Zobrazenie*: ak ju tu zmeníte, zmení sa aj Gantt na obrazovke. Ak vybrané pole v tomto projekte neexistuje, zobrazí sa *Toto pole v tomto projekte neexistuje. Dočasne sa používa typ úlohy.*

**Čiara stavu:** — čiara pri dátume kontroly stavu. Na výber sú *Žiadna*, *Čiara dátumu kontroly stavu* a *Čiara postupu*. Predvolené: *Žiadna*. Účinok: *Čiara dátumu kontroly stavu* nakreslí čiaru pri dátume kontroly stavu; *Čiara postupu* nakreslí klikatú čiaru, ktorá sa vychyľuje k postupu každej úlohy. Ak projekt nemá dátum kontroly stavu, zobrazí sa *Najprv nastavte dátum kontroly stavu* a zostava nenakreslí nič.

**Sledovať zobrazenie (filter, zoskupenie, zoradenie)** — iba pre Gantt-zostavu. Predvolené: vypnuté. Účinok: vypnuté dá na papier celý strom úloh. Zapnuté nakreslí presne riadky na obrazovke: s vaším filtrom, zoskupením, zoradením a zbalenými fázami.

**Prispôsobiť papieru** — zmení mierku časovej osi na šírku strany. Predvolené: zapnuté. Účinok: zapnuté prispôsobí časovú os šírke strany; počet strán vyplynie z výšky. Vypnuté použije pevnú mierku (*Priblíženie:*) a časová os sa rozdelí aj cez šírku, čo rýchlo dá veľa strán.

**Priblíženie:** — pevná mierka časovej osi. Viditeľné len, keď je *Prispôsobiť papieru* vypnuté. Posuvník od 1 do 40. Predvolené: 22. Účinok: väčšia hodnota urobí časovú os širšou, takže cez šírku bude viac strán.

**Časová os cez:** — rozloží časovú os na viac šírok strany. Výber od 1 do 8 strán. Predvolené: 1 strana. Účinok: iba pri *Prispôsobiť papieru*; inak je voľba vypnutá a zobrazí sa *Len pri auto-prispôsobení*. Hodí sa pre dlhý plán, ktorý chcete vytlačiť v čitateľnej veľkosti.

**Opakovať hlavičku na každej strane** — Predvolené: zapnuté. Účinok: zapnuté dá hlavičku strany na každú stranu; vypnuté iba na prvú.

**Opakovať pätičku na každej strane** — Predvolené: zapnuté. Účinok: zapnuté dá pätičku (názov projektu, dátum tlače a legendu) na každú stranu; vypnuté iba na poslednú. Podklad bez legendy sa nedá čítať, preto je to zapnuté.

**Názvy úloh na pruhoch** — Predvolené: zapnuté. Účinok: názov úlohy na pruhu, kde je na to dosť miesta.

**Zobraziť percento dokončenia** — Predvolené: zapnuté. Účinok: tmavšia časť pruhu až po postup úlohy a stĺpec *Dok* v tabuľke.

**Skrátiť názvy úloh** — Predvolené: zapnuté. Účinok: zapnuté skráti názvy v tabuľke na šírku *Stĺpec názvov:*. Vypnuté nechá stĺpec rásť podľa najdlhšieho názvu; potom sa zobrazí *Stĺpec názvov sa prispôsobí najdlhšiemu názvu úlohy*.

**Stĺpec názvov:** — šírka stĺpca názvov. Viditeľné len, keď je zapnuté *Skrátiť názvy úloh*. Posuvník od 60 do 400. Predvolené: 130.

**Zobraziť prekrytie pôvodného plánu** — aktívny pôvodný plán vedľa pruhov. Predvolené: vypnuté. Účinok: tenký pruh vo farbe pôvodného plánu pod pruhom úlohy, iba pre úlohy, ktoré sú v pôvodnom pláne.

**Kritická cesta** — Predvolené: zapnuté. Účinok: ovláda len červené čiary závislostí medzi dvoma kritickými úlohami a riadok v legende. Samotné pruhy sa riadia podľa *Farby pruhov:* bez ohľadu na toto políčko.

**Zobraziť časovú rezervu** — Predvolené: zapnuté. Účinok: časová rezerva ako pás za nekritickými pruhmi.

**Závislosti** — čiary závislostí. Predvolené: zapnuté. Účinok: kreslí šípky medzi pruhmi.

**Zobraziť len pracovné dni** — zhustí časovú os v tejto zostave. Predvolené: vypnuté. Účinok: víkendy a sviatky sa preskočia a namiesto tieňovania víkendov sa zobrazia týždenné pásy. Nezávisí od rovnakého nastavenia pre Gantt na obrazovke.

**Víkendy** — Predvolené: zapnuté. Účinok: vytieňuje víkendy a sviatky na časovej osi, pokiaľ mierka umožňuje rozlíšiť dni. Pri zhustenej osi (*Zobraziť len pracovné dni*) toto začiarkavacie políčko nemá účinok.

**Legenda** — Predvolené: zapnuté. Účinok: legenda v pätičke.

**Kvalita náhľadu** — ostrosť náhľadu. Na výber sú *Štandardná*, *Vysoká* a *Maximálna*. Predvolené: *Vysoká*. Účinok: iba ostrosť náhľadu na obrazovke; PDF sa nemení. Kde: *Zostava*, nad náhľadom.

## Diagram zdrojov

Rovnaké pruhy ako v Gantt-zostave, zoskupené podľa zdrojov: kto čo robí a kedy. Časť *Súhrn* počíta *Zdroje:*, *Priradenia:* a *Bez zdroja:* (pri období aj *Mimo obdobia:*). Diagram má všetky možnosti Gantt-zostavy okrem *Sledovať zobrazenie (filter, zoskupenie, zoradenie)*, *Kritická cesta* a *Závislosti*: riadky nepochádzajú z obrazovky, úloha sa môže objaviť pri viacerých zdrojoch a závislosti sa tu nekreslia. Začiarkavacie políčko *Kritická cesta* je skryté a zapnuté. K tomu patria možnosti Gantt-zostavy pod *Nastavenia*, s týmito štyrmi začiarkavacími políčkami a obdobím:

**Každý zdroj na novej strane** — Predvolené: vypnuté. Účinok: každý zdroj začína na novej strane, takže môžete dať list pre každý tím alebo zamestnanca. Vypnuté dá jeden súvislý dokument.

**Zahrnúť úlohy bez zdroja** — Predvolené: vypnuté. Účinok: úlohy bez zdroja sú ako posledný riadok v diagrame, aby ste videli, čo zatiaľ nikto nerobí.

**Zoskupiť podľa typu zdroja** — Predvolené: vypnuté. Účinok: vrstva navrchu: najprv riadok pre každý typ zdroja (pracovníci, tím, subdodávateľ, zariadenie, materiál), v ňom podľa zdrojov.

**Zobraziť jednotky za deň a krivku** — Predvolené: zapnuté. Účinok: dva stĺpce za názvom úlohy s jednotkami priradenia za deň a krivkou rozloženia práce zdroja tohto riadku. Ak je na časovú os málo miesta, zostava stĺpce vynechá a zobrazí *Stĺpce Jedn./d a Krivka boli vynechané: …*; viac miesta dá väčší papier alebo na šírku, menšia veľkosť písma alebo užšia tabuľka.

**Obdobie zostavy:** — iba úlohy, ktoré sa dotýkajú obdobia. Predvolené: *Celý projekt*. Účinok: časová os presne pokrýva obdobie. Ak v období nie je nič, zobrazí sa *V sledovanom období nie sú žiadne úlohy — vyberte iné obdobie alebo Celý projekt.* Pozrite *Obdobie zostavy* nižšie.

## Prehľad medzníkov

Všetky medzníky projektu v tabuľke. Nemá vlastné možnosti. Časť *Súhrn* počíta *Medzníky*, *Povinný* a *Neskoro*. Stĺpce sú *WBS*, *Názov*, *Typ* (*Automaticky*, *Začiatok* alebo *Dokončenie*), *Dátum*, *Obmedzenie/termín*, *Časová rezerva*, *Povinný* a *Stav*. Stav je *Neskoro*, ak je porušené obmedzenie, termín je zmeškaný alebo celková časová rezerva je záporná; inak *Kritická*, ak je medzník kritický podľa kritickej definície projektu; inak *Podľa plánu*. Bez medzníkov sa zobrazí *V tomto projekte nie sú žiadne medzníky.* PDF používa papier a orientáciu, ktoré ste naposledy zvolili pre inú zostavu.

## Odchýlka

Aktuálny plán vedľa aktívneho pôvodného plánu, pre listové úlohy. Nemá vlastné možnosti. Časť *Súhrn* počíta *Úlohy*, *Neskoro* a *Skôr* a ukazuje *Dokončenie projektu: +3 pracovných dní* (rozdiel v pracovných dňoch medzi dokončením pôvodného plánu a aktuálnym dokončením). Stĺpce sú *WBS*, *Názov*, *Pôvodný plán: začiatok*, *Pôvodný plán: dokončenie*, *Skutočný začiatok*, *Aktuálne dokončenie*, *Δ začiatok (pd)*, *Δ dokončenie (pd)* a *Stav*. Stav sleduje dokončenie: *Neskoro*, ak je dokončenie neskôr ako v pôvodnom pláne, *Skôr*, ak je skôr, inak *Podľa plánu*. *Nová* je úloha, ktorá nie je v pôvodnom pláne. *Vypustená* je úloha, ktorá je v pôvodnom pláne, ale už nie je v pláne. Bez aktívneho pôvodného plánu sa zobrazí *Žiadny aktívny pôvodný plán — uložte pôvodný plán alebo nastavte jeden ako aktívny.* PDF používa papier a orientáciu, ktoré ste naposledy zvolili pre inú zostavu.

## Výhľad

Čo beží alebo začína v období: zoznam pre týždenné stretnutie. Možnosti sú pod *Možnosti zostavy*.

**Obdobie zostavy:** — okno zostavy. Predvolené: *Nasledujúci mesiac*. Účinok: zostava obsahuje nedokončené úlohy, ktoré sa dotýkajú obdobia, aj keď ho pokrývajú celé, plus oneskorené úlohy z času pred referenčným dňom, pokiaľ obdobie nekončí pred referenčným dňom.

**Takmer kritická ≤ (pd):** — prahová hodnota pre *Takmer kritická*. Číslo od 0 do 60. Predvolené: 5. Účinok: úloha s celkovou časovou rezervou väčšou ako 0 a najviac toľkými pracovnými dňami sa počíta ako takmer kritická. Pri 0 platí len to, čo označí možnosť výpočtu projektu *Označiť takmer kritické*.

Časť *Súhrn* počíta *Úlohy*, *Oneskorené*, *Prebieha*, *Malo sa začať*, *Začína*, *Kritická* a *Takmer kritická*. Stav v každom riadku je vždy vzhľadom na referenčný deň: *Oneskorené* (nedokončené a dokončenie je pred referenčným dňom), *Malo sa začať* (nezačaté, hoci začiatok bol pred referenčným dňom), *Prebieha*, *Začína* (ešte nezačaté, začína v okne). Stĺpce sú *WBS*, *Názov*, *Začiatok*, *Dokončenie*, *Zost. (pd)*, *Dok*, *TF (pd)*, *Kritická*, *Zdroje* a *Stav*.

## Kritické a takmer kritické

Úlohy, ktoré určujú dokončenie projektu, a úlohy, ktoré sú mu blízko. Možnosť je pod *Možnosti zostavy*.

**Takmer kritická ≤ (pd):** — Predvolené: 5. Číslo od 0 do 60. Účinok a význam ako pri výhľade. Podnadpis uvádza zvolenú prahovú hodnotu.

Zostava obsahuje nedokončené úlohy, ktoré sú kritické (podľa výpočtu a kritickej definície projektu) alebo takmer kritické. Sú zoradené podľa cesty časovej rezervy, potom podľa celkovej časovej rezervy a potom podľa začiatku. Časť *Súhrn* počíta *Kritická*, *Takmer kritická*, *Kritické reťazce* a *Listové úlohy*. Stĺpce sú *WBS*, *Názov*, *Začiatok*, *Dokončenie*, *Zost. (pd)*, *TF (pd)*, *FF (pd)*, *Cesta* a *Stav*. Stĺpec *Cesta* ukazuje cestu časovej rezervy, ak je zapnutá možnosť výpočtu *Viacero ciest časovej rezervy*, inak pomlčku.

## Zostava postupu

Kde je projekt k dátumu kontroly stavu. Možnosti sú pod *Možnosti zostavy*.

**Obdobie zostavy:** — Predvolené: *Predchádzajúci mesiac*. Účinok: *Dokončené v predchádzajúcom období* sa počítajú v rámci obdobia. *Začínajú v nasledujúcom období* hľadí dopredu od dátumu kontroly stavu, až po *Výhľad do*; pri období *Predchádzajúci mesiac* hľadí dopredu rovnako ďaleko, ako obdobie hľadí dozadu.

**Takmer kritická ≤ (pd):** — Predvolené: 5. Ako pri výhľade.

Časť *Súhrn* ukazuje *Dátum kontroly stavu*, *Obdobie*, *Výhľad do*, *Pôvodný plán: dokončenie*, *Predpokladané dokončenie*, *Δ dokončenie (pd)*, *Plánované* (s *(pôvodný plán)* alebo *(súčasný plán)*), *Skutočné* a počty *Dokončená*, *Prebieha*, *Nezačaté*, *Oneskorené* a *Kritická*. Plánované a skutočné sa vážia podľa trvania úloh. Plánované sa meria voči pôvodnému plánu, ak je aktívny, inak voči súčasnému plánu. Sekcie sú *Dokončené v predchádzajúcom období*, *Prebieha*, *Začínajú v nasledujúcom období*, *Oneskorené* a *Otvorené kritické úlohy*; úloha môže byť vo viac ako jednej sekcii.

## Zdravie plánu

Kontrola samotného plánu na chyby a nezvyčajné hodnoty, s 14-bodovým hodnotením DCMA na začiatku. Možnosti nájdete v časti *Možnosti zostavy*.

**Vysoká časová rezerva > (wd):** — Číslo od 1 do 365. Predvolené: 44. Účinok: nedokončená úloha s väčšou celkovou časovou rezervou, než je táto hodnota, patrí do kontroly *Vysoká časová rezerva*.

**Dlhé trvanie > (wd):** — Číslo od 1 do 365. Predvolené: 44. Účinok: nedokončená úloha, nie medzník, s dlhším trvaním patrí do kontroly *Dlhé trvanie*.

**Oneskorenie > (wd):** — Číslo od 0 do 365. Predvolené: 10. Účinok: závislosť s väčším oneskorením patrí do kontroly *Dlhé oneskorenie*. Predstih (negatívne oneskorenie) sa vždy uvádza.

**Takmer kritická ≤ (wd):** — Číslo od 0 do 60. Predvolené: 5. Účinok: určuje kontrolu *Takmer kritická*.

Ako prvá je časť *14-bodové hodnotenie DCMA*. Nasleduje štrnásť kontrol amerického Defense Contract Management Agency, so vzorcami a prahovými hodnotami z ich *EVMS Program Analysis Pamphlet* (DCMA-EA PAM 200.1, október 2012). Pri každom bode vidíte *Počet*, *Z* (celkový počet, nad ktorým sa počítalo), *Hodnota*, *Norma*, *Výsledok* a *Detail*. Výsledok je *Vyhovuje*, *Označené* alebo *n/a*; pri n/a je dôvod v podrobnostiach. Označenie nie je zlyhanie: pamflet ho označuje ako dôvod na ďalšiu kontrolu. Prahové hodnoty v časti *Možnosti zostavy* sa na túto časť nevzťahujú; tá vždy používa normy z pamfletu.

Počíta nedokončené listové úlohy bez medzníkov a hamakov a závislosti do takýchto úloh. Poznámka nad zostavou uvádza obe čísla. Štrnásť bodov:

- *Logika*: úlohy bez predchádzajúcej alebo nasledujúcej úlohy. Norma: najviac 5%.
- *Predstihy*: závislosti so záporným oneskorením. Norma: žiadna.
- *Oneskorenia*: závislosti s kladným oneskorením, aj krátkym. Norma: najviac 5%.
- *Typy závislostí*: podiel závislostí FS. Norma: najmenej 90%.
- *Pevné obmedzenia*: úlohy s povinným obmedzením alebo s MSO, MFO, SNLT či FNLT. Norma: najviac 5%.
- *Vysoká časová rezerva*: úlohy s celkovou časovou rezervou väčšou ako 44 pracovných dní. Norma: najviac 5%. Vyžaduje výpočet.
- *Záporná časová rezerva*: úlohy s celkovou časovou rezervou pod 0. Norma: žiadna. Vyžaduje výpočet.
- *Vysoké trvanie*: úlohy dlhšie ako 44 pracovných dní. Počíta pôvodné trvanie, ak je úloha v aktívnom pôvodnom pláne, inak aktuálne trvanie. Norma: najviac 5%.
- *Neplatné dátumy*: skutočný začiatok alebo skutočné dokončenie po dátume kontroly stavu, alebo predpokladaný začiatok či predpokladané dokončenie pred dátumom kontroly stavu. Norma: žiadna. Vyžaduje dátum kontroly stavu.
- *Zdroje*: úlohy bez zdroja. Norma: žiadna. Len ak projekt používa zdroje; inak n/a.
- *Zmeškané úlohy*: z úloh, ktoré mali podľa pôvodného plánu byť dokončené k dátumu kontroly stavu alebo skôr, podiel tých, ktoré skončia neskôr alebo sú predpokladané neskôr. Norma: najviac 5%. Vyžaduje dátum kontroly stavu a aktívny pôvodný plán.
- *Test kritickej cesty*: aplikácia predĺži kritickú úlohu o 100 pracovných dní a prepočíta na kópii bez zmeny projektu. Test vyhovuje, ak potom posledná úloha projektu neskončí pred touto úlohou. Testuje kritickú, nedokončenú úlohu s najskorším skorým začiatkom; v podrobnostiach je názov úlohy a počet pracovných dní, o ktoré sa dokončenie posunulo.
- *CPLI*: (dĺžka kritickej cesty + časová rezerva) / dĺžka kritickej cesty. Dĺžka sa počíta v pracovných dňoch od dátumu kontroly stavu po dokončenie poslednej úlohy; časová rezerva je rozdiel oproti dokončeniu tejto úlohy v pôvodnom pláne, alebo vypočítaná časová rezerva, ak úloha v pôvodnom pláne nie je. Norma: najmenej 0,95. Vyžaduje dátum kontroly stavu.
- *BEI* (index plnenia pôvodného plánu): počet úloh dokončených k dátumu kontroly stavu, delený počtom úloh, ktoré pôvodný plán označuje ako dokončené do tohto dňa, plus úlohy bez pôvodného plánu. Norma: najmenej 0,95. Vyžaduje dátum kontroly stavu a aktívny pôvodný plán.

Dva body sa od pamfletu líšia, lebo aplikácia tento pojem nemá: *Vysoké trvanie* počíta každú nedokončenú úlohu, kým pamflet ju obmedzuje na podrobné plánovacie obdobie (rolling wave), a *Zdroje* sledujú len priradené zdroje, nie náklady. Pamflet pre test kritickej cesty nedáva žiadne číslo; 100 pracovných dní je voľba aplikácie.

Kontroly sú v tomto poradí, so svojou závažnosťou. Chyba: *Záporná časová rezerva*, *Zmeškaný termín*, *Porušené obmedzenie* a *Nekonzistentný postup* (skutočný začiatok alebo skutočné dokončenie po dátume kontroly stavu, predpokladaný začiatok alebo predpokladané dokončenie pred dátumom kontroly stavu, 100% bez skutočného dokončenia, skutočné dokončenie, ale nie 100%, postup bez skutočného začiatku). Upozornenie: *Bez predchádzajúcej úlohy (otvorený začiatok)* a *Bez nasledujúcej úlohy (otvorené dokončenie)* (nie medzníky), *Dlhé trvanie*, *Predstih (negatívne oneskorenie)*, *Pevné obmedzenie* (povinné obmedzenie alebo MSO, MFO, SNLT či FNLT), *Postup mimo poradia* a *Zmeškaná úloha (oproti pôvodnému plánu)*. Informácie: *Takmer kritická*, *Vysoká časová rezerva*, *Dlhé oneskorenie*, *Závislosť iná ako FS* a *Bez zdroja* (len ak projekt používa zdroje). Zostava sleduje len listové úlohy, ktoré nie sú hamaky. Blok *Súhrn* počíta *Označenia DCMA*, *Chyby*, *Upozornenia*, *Informácie*, *Listové úlohy* a *Závislosti*; pod časťou DCMA sú časť *Prehľad* (pri každej kontrole závažnosť a počet) a časť *Zistenia* (každá úloha alebo závislosť). Bez výpočtu chýbajú kontroly, ktoré vyžadujú časovú rezervu.

## Zaťaženie zdrojov

Pre každý zdroj a každý týždeň alebo mesiac: čo je požadované oproti tomu, čo je dostupné. Možnosti nájdete v časti *Možnosti zostavy*.

**Obdobie zostavy:** — Predvolené: *Celý projekt*. Účinok: každý týždeň alebo mesiac, ktorý zasahuje do obdobia, sa zahrnie celý. Takto riadok ukazuje rovnaké číslo ako histogram.

**Agregácia:** — Vyberte *Týždenne* alebo *Mesačne*. Predvolené: *Týždenne*. Účinok: jeden riadok na kalendárny týždeň (stĺpec *Týždeň od*, s pondelkom) alebo na kalendárny mesiac (stĺpec *Mesiac*).

**Len preťažené obdobia** — Predvolené: vypnuté. Účinok: zapnuté zobrazí len týždne alebo mesiace s aspoň jedným preťaženým dňom.

Stĺpce sú *Zdroj*, *Typ*, *Týždeň od* alebo *Mesiac*, *Požadované*, *Dostupné*, *Odchýlky* (dostupné mínus požadované; záporné číslo je nedostatok), *Špička/deň* a *Preťažené*. *Požadované* je súčet jednotiek priradenia vynásobených dňami. Sú v ňom len týždne alebo mesiace s dopytom. Blok *Súhrn* počíta *Zdroje*, *Týždne* alebo *Mesiace*, *Preťažené týždne* alebo *Preťažené mesiace* a *Preťažené zdroje*.

## Priradenia zdrojov

Pre každý zdroj úlohy, ku ktorým je priradený: čo táto partia alebo žeriav robí? Možnosti nájdete v časti *Možnosti zostavy*.

**Obdobie zostavy:** — Predvolené: *Celý projekt*. Účinok: s obdobím sa zahrnú len priradenia úloh, ktoré do obdobia zasahujú, plus omeškaná práca z obdobia pred referenčným dňom. *Celý projekt* nefiltruje podľa dátumu.

**Zahrnúť dokončené úlohy** — Predvolené: vypnuté. Účinok: zapnuté zahrnie aj priradenia dokončených úloh.

Riadky sú podľa zdroja a v rámci zdroja podľa začiatku. Blok *Súhrn* počíta *Zdroje*, *Priradenia* a *Úlohy bez zdroja*. Stĺpce zahŕňajú zdroj, úlohu, začiatok a dokončenie, *Zost. (pd)*, *Jedn./deň*, *Dok*, *Kritická* a *Stav*.

## Súhrn WBS

Plán zhrnutý podľa prvkov WBS: prehľad pre vedenie. Možnosti nájdete v časti *Možnosti zostavy*.

**Úroveň:** — až po akú úroveň sa WBS zobrazí. Vyberte *Úplná WBS* alebo úrovne 1 až 8. Predvolené: úroveň 2. Účinok: podnadpis hovorí *Až po úroveň 2*.

**Zobraziť úlohy** — Predvolené: vypnuté. Účinok: zapnuté zobrazí pod každým prvkom aj samotné listové úlohy.

Stĺpce zahŕňajú *WBS*, *Názov*, *Začiatok*, *Dokončenie*, *Pôvodný plán: začiatok*, *Pôvodný plán: dokončenie*, *Trvanie (wd)*, *Dok*, *Δ dokončenie (wd)*, *Min. TF*, *Úl* (počet úloh), *Krit*, *Aktívny* a *Hotovo*. Začiatok a dokončenie súhrnnej úlohy pochádzajú z posledného výpočtu. Postup je vážený trvaním listových úloh. *Min. TF* a počty sa týkajú listových úloh nižšie. Blok *Súhrn* počíta *Prvky WBS* a *Úlohy*.

## Obdobie zostavy

Štyri tabuľkové zostavy a *Diagram zdrojov* pracujú s rozbaľovacím zoznamom *Obdobie zostavy:*: *Look-ahead*, *Zostava postupu*, *Zaťaženie zdrojov*, *Priradenia zdrojov* a *Diagram zdrojov*. Každá zostava si pamätá vlastné obdobie. Pod rozbaľovacím zoznamom sú *Od* a *Do* s dátumami, ktoré voľba vytvorí.

**Referenčný deň.** Obdobie s voľbou *Nasledujúci* alebo *Predchádzajúci* sa počíta od dátumu kontroly stavu projektu, alebo od dneška, ak dátum kontroly stavu nie je nastavený. Tabuľkové zostavy potom zobrazia: *Nie je nastavený dátum kontroly stavu — zostava počíta s dnešným dňom (…).* Ak posuniete dátum kontroly stavu, okno sa posunie spolu s ním. Oba dni sa počítajú.

**Nasledujúci týždeň, Nasledujúce 2 týždne, Nasledujúce 4 týždne, Nasledujúcich 6 týždňov, Nasledujúcich 8 týždňov, Nasledujúcich 12 týždňov** — od referenčného dňa; každý týždeň má 7 dní. Ak je dátum kontroly stavu štvrtok 20. mája, *Nasledujúci týždeň* trvá od 20. do 26. mája a *Nasledujúce 4 týždne* od 20. mája do 16. júna.

**Predchádzajúci týždeň, Predchádzajúce 2 týždne, Predchádzajúce 4 týždne, Predchádzajúcich 6 týždňov, Predchádzajúcich 8 týždňov, Predchádzajúcich 12 týždňov** — tie isté šesť možností, ale počítané dozadu; každý týždeň má 7 dní, až po referenčný deň. Pri 20. máji trvajú *Predchádzajúce 2 týždne* od 7. do 20. mája.

**Nasledujúci mesiac, Predchádzajúci mesiac** — kalendárny mesiac dopredu alebo dozadu, až do dňa pred rovnakým dátumom v inom mesiaci. *Nasledujúci mesiac* trvá do 19. júna pri 20. máji; *Predchádzajúci mesiac* trvá od 21. apríla do 20. mája.

**Celý projekt** — od prvého začiatku po posledné dokončenie plánu.

**Vlastné** — vaše vlastné obdobie. Účinok: *Od* a *Do* sa zmenia na dve polia s dátumom. Začínajú s dátumami voľby, ktorú ste mali predtým. Dátum konca nesmie byť pred dátumom začiatku (*Dátum konca je pred dátumom začiatku.*) a obe polia musia byť vyplnené (*Vyplňte oba dátumy.*). Ak vstup nie je správny, zostava zostane na poslednom platnom období.

## Pozrite aj

- [Vytvorenie a tlač zostavy](docs://howto-rapport-maken-en-afdrukken): celá cesta od typu zostavy po PDF.
- [Výber obdobia zostavy](docs://howto-rapportageperiode-kiezen): kroky a príklady.
- [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad): čo znamená kritická a takmer kritická.
- [Postup, dátum kontroly stavu a pôvodný plán](docs://uitleg-voortgang): dátum kontroly stavu a pôvodný plán, s ktorým zostavy pracujú.
- [Riešenie preťaženia](docs://howto-overbezetting-oplossen): čo robiť s preťaženými týždňami zo zaťaženia zdrojov.
- [Formáty importu a exportu](docs://ref-import-exportformaten): PDF popri ostatných formátoch.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): dva pôvodné plány s postupom a dátumom kontroly stavu, na pozretie zostavy odchýlok.

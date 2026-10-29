# Oznámenia a upozornenia

Aplikácia vám hovorí, čo sa deje, na štyroch miestach: v stavovom riadku dole, v paneli *Upozornenia* v pravom stĺpci, v oznámeniach, ktoré sa krátko objavia dole na obrazovke, a v pásoch pod pásom s nástrojmi. Tento článok hovorí pre každé miesto, čo uvidíte, kedy sa objaví a čo s tým môžete urobiť. Prečo je plán kritický alebo preťažený, je v [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad); riešenie preťaženia je v [Riešenie preťaženia](docs://howto-overbezetting-oplossen); vytváranie závislostí je v [Vytváranie závislostí](docs://howto-relaties-leggen).

## Rozdiel medzi všetkými štyrmi

- **Stavový riadok** — pevný riadok s počítadlami. Počítadlá vychádzajú z posledného prepočítania a zostávajú, kým znova prepočítate.
- **Panel Upozornenia** — zoznam za počítadlami, s tým, čo našlo posledné prepočítanie. Kliknutím prejdete na úlohu, závislosť alebo zdroj. Odvodzuje sa z posledného prepočítania; nič sa neukladá.
- **Oznámenia** — krátke správy o tom, čo ste práve urobili (uloženie zlyhalo, závislosť odmietnutá, import prečítaný). Informácia zmizne sama, chyba zostane, kým ju nezavriete. Nie sú v paneli.
- **Pás pod pásom s nástrojmi** — farebný pás s vysvetlením a jedným tlačidlom. Patrí k stavu dokumentu alebo k režimu a zostáva, kým tento stav platí. Pozrite *Pásy pod pásom s nástrojmi*.

## Stavový riadok

Riadok dole ukazuje, zľava doprava:

- **Úlohy:** — počet úloh bez podúloh (súhrnné úlohy sa nepočítajú).
- **Medzníky:** — počet medzníkov.
- **Kritická cesta: N úloh, N pracovných dní** — počet kritických úloh a trvanie projektu. Viditeľné len po prepočítaní.
- **Dokončenie:** — dokončenie projektu z prepočítania. Viditeľné len po prepočítaní; prázdny projekt ho nemá.
- **N zmeškaných termínov**, **N porušených obmedzení**, **N závislostí mimo poradia** a **N preťažených zdrojov** — každé je tlačidlo s výstražnou značkou, viditeľné len vtedy, keď je počet vyšší ako 0 a existuje prepočítanie. Kliknutím sa otvorí panel *Upozornenia* (popis: *Otvoriť panel Upozornenia (podrobnosti a navigácia)*). Ak ste na karte *IFC* alebo *Zostava*, aplikácia zároveň prejde na *Domov*, pretože pravý stĺpec tam neexistuje. Počítadlo preťažených zdrojov sa obnoví aj po zmenách zdrojov a priradení; ostatné počítadlá sa menia len po stlačení tlačidla *Prepočítať*. Tieto štyri počítadlá sú len výber: to, čo panel ukazuje navyše (skrátený predstih, ignorovaná závislosť, hamak bez určujúcej závislosti dokončenia, orezaný dátum dokončenia, chyba plánu), nie je v stavovom riadku.
- **Zastaraný plán — prepočítajte (F5)** — s výstražnou značkou (popis: *Plán je zastaraný — prepočítajte (F5)*). Viditeľné hneď, keď zmeníte niečo, čo ovplyvní plán, a ešte ste neprepočítali. Ak je zapnutý *Automatický prepočet*, zostane skrytý, okrem prípadu, keď výpočet vrátil chybu; vtedy zostane viditeľný.
- **Výber: N úloh** — počet vybraných úloh. Viditeľné len pri výbere.
- **Časová škála:** a **Zoom: Npx/deň** — časová škála osi času a úroveň priblíženia. Časová škála vyplýva z priblíženia.
- **Neuložené** — kým má dokument zmeny, ktoré nie sú v súbore.
- **AI** — farebná bodka so slovom AI, len keď je režim AI zapnutý. Popis ukazuje *Most AI:* s hodnotami *Vypnuté*, *Aktívny na porte N*, *Port N je obsadený* alebo *Chyba*. Kliknutím sa otvorí karta *AI*.
- **Ladiaci terminál** — terminálové tlačidlo, len keď je ladiaci terminál zapnutý; zobrazí alebo skryje terminál (*Zobraziť ladiaci terminál* / *Skryť ladiaci terminál*).

## Panel Upozornenia

- **Otvorenie** — *Plán › Plán › Upozornenia*, *Zobrazenie › Panely › Upozornenia* alebo počítadlo v stavovom riadku. Panel je v pravom stĺpci, pod panelom *Vlastnosti* a panelom zdrojov, a rozbalí stĺpec, ak je zbalený. Predvolene je zatvorený a nepamätá sa medzi reláciami. Výšku panelu zmeníte ťahaním za okraj, keď je pod inými panelmi; táto výška sa pamätá. Krížik v pravom hornom rohu panel zavrie (*Zavrieť upozornenia*).
- **Riadok hlavičky** — *Chyby: N, upozornenia: N*. Ak sa ešte nič neprepočítalo, zobrazí sa *Ešte nie je prepočítané — stlačte Prepočítať (F5) a spustite kontroly*.
- **Prepočítať** — tlačidlo v riadku hlavičky, viditeľné, kým je plán zastaraný alebo ešte nie je prepočítaný. Robí to isté ako *Prepočítať* na páse s nástrojmi.
- **Výstražná značka v riadku hlavičky** — keď je plán zastaraný, s popisom *Plán je zastaraný — tento zoznam pochádza z posledného prepočítania. Prepočítajte (F5).* Zoznam sa neskryje, len sa označí ako zastaraný.
- **Prázdny zoznam** — *Žiadne upozornenia. Plán spĺňa všetky kontroly.*
- **Riadok** — hore miesto (úloha, závislosť, zdroj alebo projekt) a pod ním popis. Chyba má vlastnú osemuholníkovú značku, upozornenie trojuholníkovú značku. Úloha sa zobrazí ako `názov WBS`. Závislosť sa zobrazí ako `predchádzajúca úloha → nasledujúca úloha (FS+2d)`, s typom a oneskorením. Kliknutím prejdete na miesto (popis *Prejsť na: …*), pozri nižšie. Riadok, ktorý patrí vašej aktívnej úlohe (pri závislosti jej nasledujúcej úlohe) alebo zdroju vybranému v histograme, je zvýraznený.
- **Poradie** — najskôr chyby; potom podľa druhu v poradí zoznamu nižšie; v rámci druhu v poradí dokumentu (pri závislosti podľa nasledujúcej úlohy, pri zdroji podľa zoznamu zdrojov). Úloha, závislosť alebo zdroj, ktorý ste po poslednom prepočítaní zmazali, zo zoznamu zmizne.

### Druhy upozornení

- **Chyba plánu** — *Plán sa nedal prepočítať: …* s dôvodom za tým, pozri nižšie. Kliknutie: pri cykle aplikácia vyberie všetky úlohy v cykle a prejde na prvú. Pri iných chybách nie je kam prejsť a riadok nie je tlačidlo.
- **Zmeškaný termín** — *Termín {date} zmeškaný — skoré dokončenie {date}*. Úloha má termín a prepočítanie ho nespĺňa. Kliknutím prejdete na úlohu. Na opravu upravte logiku alebo trvanie, alebo presuňte termín.
- **Porušené obmedzenie** — *Logika plánu prekračuje obmedzenie {type and date} (záporná časová rezerva)*. Obmedzenie sa nedá splniť bez porušenia logiky; časová rezerva je záporná. Kliknutím prejdete na úlohu. Pozri [Obmedzenia](docs://uitleg-constraints).
- **Mimo poradia** — *Mimo poradia: postup nasledujúcej úlohy je v rozpore so závislosťou*. Postup nasledujúcej úlohy nezodpovedá typu závislosti, napríklad nasledujúca úloha je už v postupe, hoci predchádzajúca úloha ešte nie je dokončená pri závislosti dokončenie-začiatok. Kliknutím sa vyberú obe úlohy, nasledujúca je aktívna. Skontrolujte skutočné dátumy alebo závislosť.
- **Predstih skrátený** — *Predstih bol skrátený začiatkom projektu — závislosť nie je využitá v plnom rozsahu*. Predstih závislosti siaha pred začiatok projektu. Kliknutím sa vyberú obe úlohy.
- **Závislosť ignorovaná** — *Závislosť sa ignoruje: predchádzajúca úloha alebo nasledujúca úloha chýba, alebo nie je úloha bez podúloh*. Výpočet túto závislosť nepoužije. Kliknutím sa vyberú úlohy, ktoré ešte existujú. Pozri [Závislosti](docs://uitleg-relaties).
- **Hamak bez určujúcej závislosti dokončenia** — *Hamak bez určujúcej závislosti dokončenia (bez predchádzajúcej úlohy FF/SF): trvanie sa vráti na nulu*. Kliknutím prejdete na úlohu. Pozri [Úlohy typu hamak](docs://howto-hammock).
- **Dátum dokončenia orezaný** — *Dátum dokončenia orezaný: kalendár nenechá pre túto úlohu žiadne pracovné okno*. Výpočet narazil na limit počtu dní, ktoré prehľadáva, napríklad kvôli veľmi dlhému súvislému úseku voľna v kalendári. Kliknutím prejdete na úlohu. Pozri [Kalendáre a pracovné dni](docs://uitleg-kalenders).
- **Preťaženie** — *Preťaženie, počet dní: N (first – last)*. Ku správe sa pridá *zdroj v tieto dni nepracuje podľa svojho kalendára*, ak sú všetky dni voľno, alebo *z toho N dní zdroj podľa svojho kalendára nepracuje*, ak ide o zmes. Kliknutím sa vyberú úlohy s priradením na tom zdroji, zapne sa histogram a v ňom sa vyberie ten zdroj. Z kariet *Tabuľka*, *IFC* alebo *Zostava* aplikácia prejde na *Zdroje*. Pozri [Panel zdrojov](docs://ref-resourcepaneel).

### Dôvody chyby plánu

- *Kruhová závislosť medzi úlohami: {path}* — závislosti tvoria cyklus. Úlohy sú v tejto ceste; obráťte alebo odstráňte jednu závislosť.
- *Kalendár nemá nastavené žiadne pracovné dni* — dajte kalendáru aspoň jeden pracovný deň, pozri [Okná kalendára](docs://ref-kalenders).
- *Neplatné trvanie v dňoch pre úlohu '{task}'* a *Neplatné trvanie v hodinách pre úlohu '{task}'* — trvanie úlohy nie je platné číslo.
- *Hodinová úloha '{task}' nemá v svojom kalendári platnú pracovnú dobu* — úloha v hodinách v kalendári bez pracovnej doby.
- *Neplatný dátum začiatku pre úlohu '{task}'* — dátum začiatku úlohy nie je platný.

## Pásy pod pásom s nástrojmi

Pás je hneď pod pásom s nástrojmi, nad pracovnou plochou. Má text a jedno tlačidlo. Pás pre režim nemá krížik. Ostatné pásy zatvoríte krížikom. Päť pásov:

- **Režim závislostí** — *Režim závislostí: potiahnite v Gantt z jedného pruhu na druhý a vytvorte závislosť. Esc ukončí režim.* Pás zostáva, kým je zapnutý režim závislostí. Tlačidlo: *Zastaviť*. Pozrite [Vytváranie závislostí](docs://howto-relaties-leggen).
- **Rozdelená úloha** — *Kliknite na pruh v deň, keď prestávka začína, a potiahnite doprava pre jej trvanie. Esc ukončí.* Pás zostáva, kým je zapnutá možnosť *Rozdeliť úlohu*. Tlačidlo: *Zastaviť*.
- **Plánovanie v hodinách v súbore** — *Tento súbor obsahuje plánovanie v hodinách.* Zobrazí sa, keď otvorený súbor obsahuje plánovanie v hodinách a možnosť *Zapnúť plánovanie v hodinách* je vypnutá. Tlačidlo: *Zapnúť plánovanie v hodinách*. Pozrite [Zapnutie plánovania v hodinách](docs://howto-urenplanning-aanzetten).
- **Štruktúra zamknutá** — *Nedostupné počas filtrovania, zoskupovania a triedenia*. Zobrazí sa, keď sa nedá znížiť úroveň ani zvýšiť úroveň úlohy, lebo tabuľka úloh je filtrovaná, zoskupená alebo zoradená. Tlačidlo: *Vymazať*. Odstráni filter, zoskupenie a triedenie.
- **Dátumy tak, ako sú uložené** — po otvorení súboru, kde prepočítanie presunulo dátumy: *Prepočítanie presunulo N z M úloh od dátumov v súbore.* s tlačidlom *Zobraziť uložené dátumy*. Kým je zobrazenie zapnuté: *Zobrazujete dátumy tak, ako sú uložené v súbore …* s tlačidlom *Prepočítať*. Pozrite [Dátumy tak, ako sú uložené](docs://uitleg-datums-zoals-opgeslagen).

## Upozornenia

Upozornenia sa zobrazujú dole na obrazovke, tiež v tabuľke, v Backstage a v prezentačnom režime. Upozornenie je *chyba* alebo *informácia*. Chyba je červená a zostáva, kým na ňu nekliknete krížikom. Informácia zmizne po 5 sekundách. Upozornenie s veľkým množstvom vysvetlenia zostáva dlhšie. Tieto časovače sa znova spustia vždy, keď sa zmení zásobník upozornení. Každé upozornenie má vpravo hore krížik (popis *Zavrieť oznámenie*), ktorý ho hneď zavrie. Kliknutie na text upozornenia nič nerobí. Odmietnutie je vždy chyba: upozornenie, že aplikácia nevykonala niečo, čo ste urobili, napríklad odmietnutú závislosť, trvanie, začiatok alebo medzník. Tak ho neprehliadnete, ak sa na chvíľu odvrátite. Odmietnutie zmizne po Ctrl+Z alebo Ctrl+Y a tiež pri prechode na iný dokument, lebo už nie je správne. Iná chyba, napríklad *Uloženie zlyhalo*, zostáva. Platí to aj vtedy, keď sa zvyšok tej istej akcie podaril, napríklad pri vkladaní do viacerých buniek. Ak sa týka viacerých úloh, riadok pod upozornením povie, ktoré úlohy sa nezmenili, napríklad *Nezmenené: Foundation, Masonry.* Pri viac ako piatich úlohách riadok končí textom *a ešte {N} úloh*. Rovnaké odmietnutie sa pri opakovaní zlúči do jedného riadka s počítadlom. Naraz sa zobrazujú najviac tri upozornenia. Ak príde štvrté, najprv zmizne najstaršia informácia. Ak nie je žiadna informácia, najprv zmizne najstaršie odmietnutie, potom najstaršie trvalé upozornenie pri otvorení a až potom najstaršia chyba. Informácia alebo odmietnutie preto nikdy nevytlačí inú chybu, napríklad *Uloženie zlyhalo*. Zásobník sa posunie preč od tlačidiel otvoreného dialógu a od trvalých panelov akcií. Upozornenie pri otvorení súboru zostáva tiež, kým naň nekliknete krížikom, ak aplikácia pri otváraní doplnila, nahradila, opravila alebo vynechala údaje. Patrí sem riadok o nálezoch analyzátora alebo kalendára, o problémoch so zápisom čísel, o záložných hodnotách výčtu, o nastaveniach plánu P6 s bezpečnou záložnou hodnotou, o ochrannej záložnej hodnote pôvodného plánu, o ignorovaných odkazoch na pôvodný plán, o úlohách bez plánovaného začiatku, ktorým sa začiatok nastavil, o prepojeniach medzi projektmi alebo úlohách bez projektu, ktoré sa pri importe P6 XML nenačítali, o niečom zo súboru MS Project, čo sa nenačítalo (MS Project XML a `.mpp`), alebo o nepoužiteľnom zdrojovom archíve XER. Patria sem aj upozornenia o duplicitných ID a o závislostiach, ktoré sa nevypočítajú. Ak obsahuje len informácie bez takej zmeny, napríklad počet projektov, dokumentov alebo kódovanie textu, zmizne po 5 sekundách.

- **Počítadlo ×N** — upozornenie s pevným kľúčom zlúči opakovanie do jedného riadka s počítadlom, napríklad chybu pri ukladaní, ktorá sa stále vracia, alebo odmietnutú závislosť, ktorú opakujete. Nie každé upozornenie to robí.
- **Čítať viac** — niektoré upozornenia majú odkaz *Čítať viac* alebo vlastnú tému (napríklad *Vysvetlenie typov úloh*) do príručky v Backstage › Pomoc.
- **Tlačidlo akcie** — upozornenie na profil výpočtu má tlačidlo *Otvoriť profil výpočtu*, ktoré vedie do *Informácie o projekte*.

Zoznam nižšie je výber, zoskupený podľa tém. Ak nie je uvedené inak, ide o informáciu.

### Ukladanie, otváranie a obnovenie

- **Ukladanie zlyhalo** (chyba) — *Uloženie zlyhalo* s dôvodom pod ním. Pri ukladaní, pri *Uložiť ako* a pri exporte zostavy.
- **Uložené ako stiahnutie** (informácia) — *Uložené ako stiahnutie: „{name}“ je teraz vo vašej zložke na stiahnuté súbory. …* Pri *Uložiť ako* a pri exportoch, keď prostredie nedovolí aplikácii zapisovať priamo na miesto, ktoré ste vybrali. Dve stiahnutia hneď za sebou sa zlúčia.
- **Uložené ako stiahnutie (vysvetlenie)** (informácia, 15 sekúnd) — *Uložené ako stiahnutie: „{name}“ je vo vašej zložke na stiahnuté súbory. Tento prehliadač nedovolí aplikácii zapisovať na vlastné miesto, …* Pri *Uložiť* v prehliadači, ktorý ukladá len cez stiahnutie. Raz za reláciu, s odkazom na vysvetlenie súborov.
- **Prehliadač nezapisuje späť** (informácia, 15 sekúnd) — *Tento prehliadač nedovolí aplikácii zapisovať späť do „{name}“. …* Pri *Uložiť* projektu, ktorý má súbor, keď musí prehliadač znova pýtať miesto. Raz za reláciu, s odkazom na vysvetlenie súborov.
- **Automatické ukladanie zlyhalo** (chyba) — *Automatické ukladanie zlyhalo* s dôvodom. Platí pre automatické ukladanie do súboru a pre zotavenie zo zlyhania.
- **Knižnicu sa nepodarilo uložiť** (chyba) — *Knižnicu sa nepodarilo uložiť*, pri ukladaní knižnice zdrojov.
- **Otvorenie súboru zlyhalo** (chyba) — *Otvorenie súboru zlyhalo* s dôvodom. Napríklad pri nedávnom súbore alebo importovanom súbore.
- **Starý alebo chránený .mpp** (chyba) — *Tento .mpp súbor používa starší formát (Project 2007 alebo skorší)…* alebo *Tento .mpp súbor je chránený heslom…*, obe s odporúčaním exportovať ho ako XML v MS Project a otvoriť tento súbor.
- **Neplatný súbor XER** (chyba) — jeden z textov *XER…*, napríklad *Tento súbor nie je platný alebo podporovaný súbor XER.* alebo *Súbor XER obsahuje duplicitnú tabuľku.*, s pridaným dôvodom.
- **IFC sa nepodarilo prečítať** (chyba) — *IFC sa nepodarilo prečítať* s dôvodom, v zobrazení IFC.
- **Obnovenie** (chyba) — *Obnovený súbor sa nepodarilo prečítať*, *Obnovenie zlyhalo* a *{N} súborov na obnovenie sa nepodarilo načítať a boli preskočené.* Pri obnovení po neočakávanom vypnutí.
- **Vetva uložená ako šablóna** (informácia) — *Vetva uložená ako šablóna „{name}“*.
- **Hlásenie z rozšírenia** (informácia, alebo chyba, ak rozšírenie hlási chybu) — *Rozšírenie {name}: {message}*. Rozšírenie smie zobraziť najviac tri nové hlásenia za 10 sekúnd, aby nezaplnilo zásobník. Ak krok sprievodcu rozšírenia zlyhá, zobrazí sa *Krok rozšírenia {name} zlyhal. Sprievodca pokračuje.* Ak sa projektový súbor rozšírenia nedá otvoriť, zobrazí sa *Súbor projektu {file} rozšírenia {name} sa nepodarilo otvoriť.* Obe upozornenia sú chyby.
- **Zmena medzitým** (chyba) — *Zmena od AI asistenta alebo rozšírenia prišla medzitým. …* Keď zrušíte dialóg úlohy, kým AI asistent alebo rozšírenie medzitým niečo zmenilo, úpravy úloh urobené pred touto zmenou sa nevrátia a zostanú ako bežné kroky pod *Vrátiť späť*.

### Výpočet

- **Plán sa nepodarilo prepočítať** (chyba) — *Plán sa nepodarilo prepočítať* s dôvodom pod ním (pozri *Dôvody chyby plánu*). Pri *Prepočítať*, pri prepínaní dokumentov a pri otváraní súboru.
- **Dátum kontroly stavu nastavený na dnešok** (informácia) — *Dátum stavu nastavený na dnešok ({date}).* Pri zapisovaní postupu v projekte bez dátumu kontroly stavu. Aplikácia meria postup až do dátumu kontroly stavu, takže bez neho nemôže postup spracovať. Iný dátum nastavíte v *Plán › Smerné plány a postup › Dátum kontroly stavu*. S odkazom *Čítať viac* na [Postup, dátum kontroly stavu a pôvodný plán](docs://uitleg-voortgang).
- **Trvanie kratšie ako vykonaná práca** (chyba) — *Úloha „{name}“ je už hotová na {N} %: trvanie kratšie ako už vykonaná práca nie je možné. Trvanie nebolo zmenené.*

### Závislosti a hierarchia

- **Odmietnutá závislosť** (chyba) — *Táto závislosť už existuje*, *Závislosť medzi úlohou a jej vlastnou súhrnnou úlohou (aj vyššou) nie je povolená.* alebo *Táto závislosť by v pláne vytvorila cyklus ({cycle}) a nebola vytvorená.* Cyklus pomenúva úlohy, takže viete, ktorú závislosť treba najskôr odstrániť alebo obrátiť.
- **Odmietnutý presun** (chyba) — *Toto presunutie by v pláne vytvorilo cyklus ({cycle}): závislosti súhrnnej úlohy platia aj pre jej čiastkové úlohy. Nič sa nepresunulo.*
- **Závislosti po presune vypadnú** (informácia) — *Po presune spája {N} závislostí úlohu s jej vlastnou súhrnnou úlohou; už sa nezapočítavajú do výpočtu.*
- **Závislosti pri vložení vynechané** (chyba) — *{N} závislostí nebolo vytvorených: neplatné prepojenie…*, pri vkladaní alebo pri vložení vetvy. Riadok pod ním povie, ktoré závislosti, napríklad *Nevytvorené: Foundation → Masonry.*
- **Závislosti nezapočítané po importe** (informácia) — *Počet závislostí, ktoré sa nepodarilo zahrnúť do výpočtu: {N}. Skontrolujte stĺpce Predchádzajúce úlohy a Nasledujúce úlohy.*
- **Duplicitné ID po importe** (informácia) — *Objekty s duplicitným ID v tomto súbore: {N}. Dostali vlastné ID…*

### Úprava úloh

- **Začiatok zapísaný ako obmedzenie** (informácia) — *„{name}“ sa nezačne pred {date} (SNET).* Pri zmene začiatku úlohy s predchádzajúcou úlohou. Predchádzajúca úloha určuje začiatok, takže aplikácia zapíše váš dátum ako obmedzenie začiatok nie skôr ako (SNET). Po prepočítaní (F5) sa úloha nezačne pred týmto dátumom. Ak mala úloha už také obmedzenie, zobrazí sa *„{name}“ sa teraz nezačne pred {date} (SNET).*; pri viacerých úlohách naraz sa uvedie ich počet. S odkazom *Čítať viac* na [Obmedzenia a termíny](docs://uitleg-constraints).
- **Začiatok sa nepoužil** (chyba) — *Nový začiatok „{name}“ sa nepoužil: úloha má predchádzajúcu úlohu a obmedzenie {type} {date}, a tie určujú jej začiatok. Ak chcete začiatok posunúť, zmeňte toto obmedzenie.*
- **Odmietnutý medzník** (chyba) — *„{task}“ má priradenia zdrojov a nemôže sa stať medzníkom. Najprv odstráňte priradenia.* alebo *„{task}“ je súhrnná úloha s čiastkovými úlohami a nemôže sa stať medzníkom.* Pri prevode v dialógu úlohy, v paneli vlastností, v kontextovej ponuke a v tabuľke.
- **Priradenia presunuté do čiastkovej úlohy** (informácia) — *Priradenie presunuté do čiastkovej úlohy „{child}“.* alebo *{N} priradení presunutých do čiastkovej úlohy „{child}“.* Keď rozšírenie dá čiastkové úlohy úlohe s priradeniami. Tá úloha sa stane súhrnnou úlohou a súhrnná úloha nemá žiadne priradenia. Preto sa presunú do prvej novej čiastkovej úlohy. V samotnej aplikácii to vyberiete v okne *Úloha sa stane súhrnnou úlohou*; toto upozornenie sa neobjaví. S odkazom *Čítať viac* na [Úprava štruktúry](docs://howto-structuur-aanpassen).
- **Príznak medzníka odstránený** (informácia) — *„{phase}“ už nie je medzník.* Keď medzník dostane čiastkové úlohy. Medzník je okamih bez čiastkových úloh; s čiastkovými úlohami sa stane súhrnnou úlohou. S odkazom *Čítať viac* na [Úprava štruktúry](docs://howto-structuur-aanpassen).
- **Otázka je zastaraná** (chyba) — *Úlohy alebo priradenia sa zmenili, kým bola otázka otvorená. Nič sa nezmenilo; skúste to znova.* Keď v okne *Úloha sa stane súhrnnou úlohou* vyberiete možnosť, ale otázka už nezodpovedá.
- **Súhrnná úloha odmietnutá** (chyba) — *„{phase}“ nemôže sa stať súhrnnou úlohou: …* s dôvodom a *Nič sa nezmenilo.* Keď rozšírenie dá čiastkové úlohy úlohe s priradeniami a priradenia sa nedajú presunúť do prvej novej čiastkovej úlohy. V samotnej aplikácii sa toto upozornenie neobjaví: tam sa okno *Úloha sa stane súhrnnou úlohou* opýta, čo urobiť, a *Presunúť* je potom nedostupné.
- **Bunky preskočené pri vkladaní** (chyba) — *{N} buniek preskočených: sú iba na čítanie (napríklad automaticky číslované kódy WBS alebo vypočítané stĺpce).*
- **Odkazy vymazané pri vložení** (informácia) — *{N} odkazov v tomto dokumente neexistovalo a bolo vymazaných (kalendárov úloh, vlastných druhov prác, kódov aktivít alebo vlastných polí zo zdrojového dokumentu).*
- **Štruktúra je uzamknutá** (chyba, červený pruh pod pásom s nástrojmi) — *Nedostupné počas filtrovania, zoskupovania a triedenia*, s tlačidlom *Vymazať*. Keď je zoznam filtrovaný, zoskupený alebo zoradený: pri presúvaní, znižovaní a zvyšovaní úrovne a pri *Vložiť nad* a *Vložiť pod* (ponuka pravým tlačidlom alebo skratka). Pruh zostane, kým naň nekliknete krížikom, nepoužijete Ctrl+Z alebo Ctrl+Y, alebo neprejdete na iný dokument. Pozri [Úprava štruktúry](docs://howto-structuur-aanpassen).
- **Úloha pridaná na koniec** (chyba) — *Nová úloha je na konci. Počas filtrovania, zoskupovania alebo triedenia ju aplikácia nemôže vložiť pod váš výber.* S tlačidlom *Vymazať*. Pri *Úloha* a *Medzník ▾*, keď je vybraná úloha a zoznam je filtrovaný, zoskupený alebo zoradený. Úloha sa pridá, ale na spodok. *Vymazať* odstráni filter, zoskupenie a triedenie a zavrie upozornenie. Pozri [Pridávanie úloh a medzníkov](docs://howto-taken-en-mijlpalen-toevoegen).
- **Typ úlohy upravil trvanie** (informácia) — *Po zmene kalendára typ úlohy upravil trvanie pri {N} úlohách (práca zostáva, pracovné hodiny za deň sa zmenili).* S odkazom *Vysvetlenie typov úloh*.

### Primavera P6 XML

- **Súbor P6 XML otvorený** (informácia) — *Súbor P6 XML bol otvorený: {N} projektových dokumentov.* Po otvorení súboru P6 XML.
- **Nie je importované** (zostáva) — *{N} závislostí medzi projektmi nebolo prevzatých ako závislosti.* a *{N} úloh bez projektu nebolo načítaných.* Skontrolujte, či je váš plán úplný.
- **Prázdny alebo nepoužiteľný** (chyba) — nič sa neotvorí. Tri dôvody: *Tento súbor neobsahuje žiadne úlohy, ktoré aplikácia dokáže prečítať.*, *Úlohy nemajú ObjectId. …* a *Súbor používa názvy stĺpcov XER … Otvorte samotný súbor .xer.*

### Primavera (XER)

- **Súbor XER otvorený** (informácia) — *Súbor XER otvorený: {N} projektových dokumentov.* Jedno upozornenie na súbor, aj keď súbor otvorí viac projektov, s odkazom *Čítať viac* a riadkami s podrobnosťami pod ním. Vždy *{N} projektov nájdených.* Len keď je číslo vyššie ako 0: *{N} prázdnych projektov preskočených.*, *{N} projektov pôvodného plánu vylúčených.*, *{N} pôvodných plánov vytvorených.*, *{N} osamelých odkazov na pôvodný plán ignorovaných.*, *Použila sa ochranná záloha pôvodného plánu.* a *{N} prepojení medzi projektmi zachovaných.* Len pri inom kódovaní než UTF-8: *Kódovanie textu určené ako {encoding}.* Ďalej, keď je číslo vyššie ako 0: *{N} nálezov analyzátora.*, *{N} nálezov kalendára.*, *{N} problémov so zápisom čísel.*, *{N} záložných hodnôt výčtu.* a *{N} nastavení plánu P6 s bezpečnou záložnou hodnotou.*
- **Dátumy tak, ako ich zaznamenala Primavera** (riadok podrobností v tom istom upozornení) — *{N} úloh zobrazuje dátumy tak, ako ich uložil Primavera (bez prepočítania).* {N} počíta každú úlohu, pri ktorej súbor zaznamenal dátumy, aj tie, ktoré sa nelíšia. Alebo, ak sa režim nezapol: *{N} úloh sa líši od dátumov v súbore — môžete ich zobraziť.*
- **Zdrojový archív XER nepoužiteľný** (informácia) — *Zdrojový archív XER v tomto súbore nie je použiteľný a bol vynechaný; samotný projekt bol otvorený úplne.* s dôvodom (napríklad *Dôvod: kontrolný súčet nezodpovedá zdrojovým bajtom — archív je poškodený.*) a s dôsledkom (*Plán, profil výpočtu a všetky projektové údaje z IFC sú úplné. …*). Pri otvorení súboru IFC, v ktorom sa predtým uložený zdrojový archív XER nedá použiť. Aj pri obnovení po neočakávanom vypnutí, ak úložisko obnovenia už nemá zdrojový archív.
- **Export stratí údaje XER** (informácia) — *Pri exporte do {format} sa stratia údaje o pôvode XER.* Po úspešnom exporte do iného formátu než IFC z projektu, ktorý má údaje existujúce len v súbore XER. S odkazom *Čítať viac*.

### Import, export a profil výpočtu

- **Dátumy ako v súbore** (informácia) — *{N} úloh zobrazuje dátumy tak, ako sú uvedené v súbore (bez prepočítania).* ({N} počíta každú úlohu so zaznamenanými dátumami) alebo *{N} úloh sa líši od dátumov v súbore — môžete ich zobraziť.* Pri otvorení súboru so zaznamenanými dátumami.
- **Práca a typy úloh viditeľné** (informácia) — *Tento súbor obsahuje uloženú prácu alebo typy úloh; typ úlohy a zostávajúca práca sú pre tento projekt viditeľné.*
- **Plán MS Project načítaný** (informácia) — *Tento súbor MS Project obsahuje {N} úloh s prestávkami, vyvažovaním alebo plánom riadeným zdrojmi. Načítajú sa a zobrazia sa takto.*
- **Prestávky nie sú exportované** (informácia) — *{N} úloh s prestávkami bolo exportovaných bez prestávok: MS Project a P6 ich poznajú len ako rozloženie práce.* Pri exporte do MS Project alebo Primavery.
- **Začiatok projektu posunutý** (informácia) — *{N} úloh sa posunulo so začiatkom projektu.* Keď nastavíte začiatok projektu neskôr. Na ten dátum sa posunú len úlohy bez predchádzajúcej úlohy a bez obmedzenia, ktoré by ležalo pred novým dátumom začiatku. S odkazom *Čítať viac* na [Nový projekt a Informácie o projekte](docs://ref-projectinfo).
- **Dátumové okno už neriadi** (informácia) — *Dátumové okno MS Project už po tejto úprave neriadi {N} úloh; …* Raz za dokument.
- **Oneskorenie pri vyvažovaní zaokrúhlené** (informácia) — *Vyvažovanie zaokrúhľuje minútovo presné oneskorenie pri vyvažovaní z MS Project na celé pracovné dni. Týka sa to {N} úloh.* Raz za dokument.
- **Profil výpočtu použitý** (informácia) — *Tento projekt sa počíta ako „{profile}“. Zmeniť ho môžete v ponuke Súbor → Informácie o projekte → Profil výpočtu a možnosti výpočtu.* S tlačidlom *Otvoriť profil výpočtu*. Po použití profilu sa v prípade potreby zobrazí *Po použití bolo posunutých {N} úloh.*

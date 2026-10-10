# Oznámenia a upozornenia

Aplikácia vám hovorí, čo sa deje, na troch miestach: v stavovom riadku dole, v paneli *Upozornenia* v pravom stĺpci a v oznámeniach, ktoré sa krátko objavia dole na obrazovke. Tento článok hovorí pre každé miesto, čo uvidíte, kedy sa objaví a čo s tým môžete urobiť. Prečo je úloha kritická alebo zdroj preťažený, je v [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad); riešenie preťaženia je v [Riešenie preťaženia](docs://howto-overbezetting-oplossen); vytváranie závislostí je v [Vytváranie závislostí](docs://howto-relaties-leggen).

## Rozdiel medzi týmito tromi

- **Stavový riadok** — pevný riadok s počítadlami. Počítadlá vychádzajú z posledného prepočítania a zostávajú, kým znova prepočítate.
- **Panel Upozornenia** — zoznam za počítadlami, s tým, čo našlo posledné prepočítanie. Kliknutím prejdete na úlohu, závislosť alebo zdroj. Odvodzuje sa z posledného prepočítania; nič sa neukladá.
- **Oznámenia** — krátke správy o tom, čo ste práve urobili (uloženie zlyhalo, závislosť odmietnutá, import prečítaný). Zmiznú a nie sú v paneli.

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

## Oznámenia

Oznámenia sa zobrazujú v dolnej časti obrazovky, aj v tabuľke, v Backstage a v režime prezentácie. Oznámenie je *chyba* alebo *info*. Chyba zostane zobrazená, kým na ňu nekliknete. Info zmizne po 5 sekundách. Tieto časovače sa znova spustia, hneď ako sa zmení zásobník. Kliknutím na oznámenie ho zavriete (popisok *Zavrieť oznámenie*). Naraz sa zobrazia najviac tri oznámenia. Ak príde štvrté, najskôr zmizne najstaršie info. Ak žiadne info nie je, zmizne najstaršie oznámenie. Chyba preto nikdy nezmizne kvôli info. Zásobník sa posunie preč od tlačidiel otvoreného dialógového okna a od pevných panelov s akciami.

- **Počítadlo ×N** — oznámenie s pevným kľúčom spojí opakovanie do jedného riadku s počítadlom. Príklad: chyba pri ukladaní, ktorá sa stále vracia, alebo odmietnutá závislosť, ktorú zopakujete. Nie každé oznámenie to robí.
- **Čítať viac** — niektoré oznámenia majú odkaz *Čítať viac* alebo vlastnú tému (napríklad *Pravidlá práce vysvetlené*). Ten vedie do sprievodcu v Backstage › Pomocník.
- **Tlačidlo akcie** — oznámenie o profile výpočtu má tlačidlo *Otvoriť profil výpočtu*. To vedie do info o projekte.

Zoznam nižšie je výber, zoskupený podľa témy. Ak nie je uvedené inak, ide o info.

### Ukladanie, otváranie a obnovenie

- **Ukladanie zlyhalo** (chyba) — *Uloženie zlyhalo* s dôvodom pod ním. Pri ukladaní, pri ukladaní ako a pri exporte zostavy.
- **Uložené ako sťahovanie** (info) — *Uložené ako sťahovanie: „{name}“ je teraz v priečinku na sťahovanie. …* Pri *Uložiť ako* a pri exporte, keď prostredie neumožní aplikácii zapisovať priamo na miesto, ktoré ste vybrali. Dve sťahovania hneď po sebe sa spoja.
- **Uložené ako sťahovanie (vysvetlenie)** (info) — *Uložené ako sťahovanie: „{name}“ je v priečinku na sťahovanie. Tento prehliadač neumožní aplikácii zapisovať na vlastné miesto, …* Pri *Uložiť* v prehliadači, ktorý ukladá len sťahovaním. Raz za reláciu, s odkazom na vysvetlenie súborov.
- **Prehliadač nezapisuje späť** (info) — *Tento prehliadač neumožní aplikácii zapisovať späť do „{name}“. …* Pri *Uložiť* projektu, ktorý má súbor, keď musí prehliadač znova pýtať miesto. Raz za reláciu, s odkazom na vysvetlenie súborov.
- **Automatické ukladanie zlyhalo** (chyba) — *Automatické ukladanie zlyhalo* s dôvodom. Platí pre automatické ukladanie do súboru a pre zotavenie zo zlyhania.
- **Knižnicu sa nepodarilo uložiť** (chyba) — *Knižnicu sa nepodarilo uložiť*, pri ukladaní knižnice zdrojov.
- **Otvorenie súboru zlyhalo** (chyba) — *Otvorenie súboru zlyhalo* s dôvodom. Napríklad pri nedávnom súbore alebo pri importovanom súbore.
- **Starý alebo chránený .mpp** (chyba) — *Tento súbor .mpp používa starší formát (Project 2007 alebo skorší)…* alebo *Tento súbor .mpp je chránený heslom…* Obe hlásenia obsahujú radu: exportujte ho ako XML v MS Project a otvorte ten súbor.
- **Neplatný súbor XER** (chyba) — jeden z textov *XER…*, napríklad *Tento súbor nie je platný alebo podporovaný súbor XER.* alebo *Súbor XER obsahuje duplicitnú tabuľku.* K textu sa pridá dôvod.
- **IFC sa nepodarilo prečítať** (chyba) — *IFC sa nepodarilo prečítať* s dôvodom, v zobrazení IFC.
- **Zotavenie zo zlyhania** (chyba) — *Obnovený súbor sa nepodarilo prečítať*, *Obnovenie zlyhalo* a *N súborov na obnovenie sa nepodarilo načítať a boli preskočené.* Pri zotavení po neočakávanom vypnutí.
- **Vetva uložená ako šablóna** (info) — *Vetva uložená ako šablóna „{name}“*.
- **Hlásenie z rozšírenia** (info, alebo chyba, ak rozšírenie nahlási chybu) — *Rozšírenie {name}: {message}*. Rozšírenie smie zobraziť najviac tri nové oznámenia za 10 sekúnd, aby nezaplnilo zásobník. Ak krok sprievodcu rozšírenia zlyhá, zobrazí sa *Krok rozšírenia {name} zlyhal. Sprievodca pokračuje.* Ak sa nedá otvoriť súbor projektu rozšírenia, zobrazí sa *Súbor projektu {file} rozšírenia {name} sa nepodarilo otvoriť.* Obe sú chyby.
- **Medzitým prišla zmena** (info) — *Zmena od AI asistenta alebo rozšírenia prišla medzitým. …* Keď zrušíte dialógové okno úlohy, kým AI alebo rozšírenie medzitým niečo zmenili: úpravy úloh z obdobia pred touto zmenou sa nevrátia späť. Zostanú ako bežné kroky pod *Vrátiť späť*.

### Výpočet

- **Plán sa nepodarilo prepočítať** (chyba) — *Plán sa nepodarilo prepočítať* s dôvodom pod ním (pozrite *Príčiny chyby plánu*). Pri *Prepočítať*, pri prepínaní dokumentov a pri otváraní súboru.
- **Dátum kontroly stavu nastavený na dnešok** (info) — *Dátum stavu ešte nebol nastavený: teraz je nastavený na dnešok ({date}), pretože postup sa meria do dátumu stavu. Zmeniť ho môžete na karte Plán → Dátum stavu.* Pri zadávaní postupu v projekte bez dátumu kontroly stavu.
- **Trvanie kratšie ako vykonaná práca** (info) — *Úloha „{name}“ je už hotová na {N} %: trvanie kratšie ako už vykonaná práca nie je možné. Trvanie nebolo zmenené.*

### Závislosti a hierarchia

- **Závislosť vytvorená** (info) — *Závislosť vytvorená: {predecessor} → {successor}*.
- **Závislosť odmietnutá** (info) — *Táto závislosť už existuje*, *Závislosť medzi úlohou a jej vlastnou súhrnnou úlohou (aj vyššou) nie je povolená.* alebo *Táto závislosť by v pláne vytvorila cyklus ({cycle}) a nebola vytvorená.* Cyklus uvádza názvy úloh. Zistíte tak, ktorú závislosť najskôr odstrániť alebo obrátiť.
- **Presun odmietnutý** (info) — *Toto presunutie by v pláne vytvorilo cyklus ({cycle}): závislosti súhrnnej úlohy platia aj pre jej čiastkové úlohy. Nič sa nepresunulo.*
- **Závislosti po presune prestanú platiť** (info) — *Po presune spája N závislostí úlohu s jej vlastnou súhrnnou úlohou; už sa nezapočítavajú do výpočtu.*
- **Závislosti pri vložení preskočené** (info) — *N závislostí sa nevytvorilo: neplatná závislosť…*, pri vložení alebo pri vložení vetvy.
- **Závislosti po importe nezapočítané** (info) — *Počet závislostí, ktoré sa nepodarilo zahrnúť do výpočtu: N. Skontrolujte stĺpce Predchádzajúce úlohy a Nasledujúce úlohy.*
- **Duplicitné ID po importe** (info) — *Objekty s duplicitným ID v tomto súbore: N. Dostali vlastné ID…*

### Úprava úloh

- **Začiatok zapísaný ako obmedzenie** (info) — *„{name}“ má predchádzajúcu úlohu: nový začiatok je nastavený ako obmedzenie Začiatok nie skôr ako (SNET) {date}. Po prepočítaní (F5) sa úloha nezačne pred týmto dátumom.* Keď zmeníte začiatok úlohy s predchádzajúcou úlohou. Ak úloha už mala takéto obmedzenie, oznámenie uvádza, že sa presunulo. Pri viacerých úlohách naraz uvádza počet.
- **Začiatok sa neuplatnil** (info) — *Nový začiatok úlohy „{name}“ sa neuplatnil: úloha má predchádzajúcu úlohu a obmedzenie {type} {date}, a tie určujú jej začiatok. Zmeňte to obmedzenie, aby sa začiatok posunul.*
- **Medzník odmietnutý** (info) — *'{task}' má priradenia zdrojov a nemôže sa stať medzníkom. Najprv odstráňte priradenia.* alebo *'{task}' je súhrnná úloha s čiastkovými úlohami a nemôže sa stať medzníkom.* Pri zmene na medzník v dialógovom okne úlohy, na paneli vlastností, v kontextovej ponuke a v tabuľke.
- **Priradenia presunuté do čiastkovej úlohy** (info) — *Priradenie pre {resources} bolo presunuté z '{phase}' do novej čiastkovej úlohy '{child}': súhrnná úloha sama nenesie priradenia.* Pri úlohe s priradeniami, ktorá dostane čiastkové úlohy.
- **Príznak medzníka odstránený** (info) — *Medzník '{phase}' má teraz čiastkové úlohy a stal sa súhrnnou úlohou; označenie medzníka bolo odstránené.*
- **Súhrnná úloha odmietnutá** (info) — *„{phase}“ nemôže sa stať súhrnnou úlohou: …* s dôvodom a *Nič sa nezmenilo.*
- **Bunky pri vložení preskočené** (info) — *N buniek preskočených: sú iba na čítanie (napríklad automaticky číslované kódy WBS alebo vypočítané stĺpce).*
- **Odkazy pri vložení vymazané** (info) — *N odkazov v tomto dokumente neexistovalo a bolo vymazaných (kalendárov úloh, vlastných typov úloh, kódov aktivít alebo vlastných polí zo zdrojového dokumentu).*
- **Pravidlo práce upravilo trvanie** (info) — *Pravidlo práce po zmene kalendára upravilo trvanie N úloh (práca zostáva, hodiny za deň sa zmenili).* S odkazom *Pravidlá práce vysvetlené*.

### Primavera (XER)

- **Súbor XER otvorený** (info) — *Súbor XER otvorený: N projektových dokumentov.* Jedno oznámenie na súbor, aj keď súbor otvorí viac projektov. Má odkaz *Čítať viac* a riadky s podrobnosťami pod ním. Vždy *N projektov nájdených.* Len keď je počet vyšší ako 0: *N prázdnych projektov preskočených.*, *N projektov pôvodného plánu vylúčených.*, *N pôvodných plánov vytvorených.*, *N osamelých odkazov na pôvodný plán ignorovaných.*, *Použila sa ochranná záloha pôvodného plánu.* a *N prepojení medzi projektmi zachovaných.* Len pri inom kódovaní ako UTF-8: *Kódovanie textu určené ako {encoding}.* Ďalej, keď je počet vyšší ako 0: *N nálezov analyzátora.*, *N nálezov kalendára.*, *N problémov so zápisom čísel.*, *N záložných hodnôt výčtu* a *N nastavení plánu P6 s bezpečnou záložnou hodnotou.*
- **Dátumy tak, ako ich uložil Primavera** (riadok s podrobnosťami v tomto oznámení) — *N úloh zobrazuje dátumy tak, ako ich uložil Primavera (bez prepočítania).* alebo, ak sa režim nezapol, *N úloh sa líši od dátumov v súbore. Môžete ich zobraziť.*
- **Zdrojový archív XER nie je použiteľný** (info) — *Zdrojový archív XER v tomto súbore nie je použiteľný a bol vynechaný; samotný projekt bol otvorený úplne.* s dôvodom (napríklad *Dôvod: kontrolný súčet nezodpovedá zdrojovým bajtom — archív je poškodený.*) a s dôsledkom (*Plán, profil výpočtu a všetky údaje projektu z IFC sú úplné. …*). Pri otváraní súboru IFC, v ktorom uložený zdrojový archív XER nie je možné použiť.
- **Export stratí údaje o pôvode XER** (info) — *Pri exporte do {format} sa stratia údaje o pôvode XER.* Zobrazí sa po úspešnom exporte projektu do iného formátu ako IFC, ak má údaje, ktoré existujú len v súbore XER. S odkazom *Čítať viac*.

### Import, export a profil výpočtu

- **Dátumy ako v súbore** (info) — *N úloh zobrazuje dátumy tak, ako sú uvedené v súbore (bez prepočítania).* alebo *N úloh sa líši od dátumov v súbore. Môžete ich zobraziť.* Pri otváraní súboru so zaznamenanými dátumami.
- **Práca a pravidlá práce viditeľné** (info) — *Tento súbor obsahuje uloženú prácu alebo vlastné pravidlá práce; pravidlo práce a zostávajúca práca sú pre tento projekt viditeľné.*
- **Plán MS Project načítaný** (info) — *Tento súbor MS Project obsahuje N úloh s prestávkami, vyvažovaním alebo plánom riadeným zdrojmi. Načítajú sa a zobrazia sa takto.*
- **Prestávky sa neexportovali** (info) — *N úloh s prestávkami bolo exportovaných bez prestávok: MS Project a P6 ich poznajú len ako rozloženie práce.* Pri exporte do MS Project alebo Primavery.
- **Začiatok projektu zmenený** (info) — *Začiatok projektu zmenený: N úloh bez predchádzajúcej úlohy alebo obmedzenia sa posunulo na nový dátum začiatku.*
- **Okno dátumov už neriadi úlohy** (info) — *Okno dátumov z MS Project už po tejto úprave neriadi N úloh; …* Raz za dokument.
- **Oneskorenie pri vyvažovaní zaokrúhlené** (info) — *Vyvažovanie zaokrúhľuje minútovo presné oneskorenie pri vyvažovaní z MS Project na celé pracovné dni. Týka sa to N úloh.* Raz za dokument.
- **Profil výpočtu použitý** (info) — *Tento projekt sa počíta ako {profile}. Zmeniť ho môžete v ponuke Súbor → Informácie o projekte → Profil výpočtu a možnosti výpočtu.* S tlačidlom *Otvoriť profil výpočtu*. Po použití profilu nasleduje, ak je to potrebné, *Po použití bolo posunutých N úloh.*

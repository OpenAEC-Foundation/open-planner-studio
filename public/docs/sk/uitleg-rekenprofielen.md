# Profily výpočtu a pravidlá výpočtu

Rovnaký plán môže dať iné dátumy, podľa toho, ktoré výpočtové pravidlá použijete. Tento článok vysvetľuje, prečo Primavera P6 a Microsoft Project počítajú v niekoľkých bodoch inak, ako aplikácia tento rozdiel zapisuje do **profilu výpočtu** a ako sa profil výpočtu líši od možností výpočtu, ktoré nastavujete sami pre každý projekt. Príklad s jednou malou sieťou ukazuje, čo to urobí s dátumami.

## Pojem

Úlohy, závislosti a kalendár určujú väčšinu plánu, ale nie všetko. Čo sa stane s prácou, ktorá ešte nezačala, keď nastavíte dátum kontroly stavu? Kde začína zostávajúca práca úlohy, ktorá už beží? Aká je voľná časová rezerva úlohy, keď sa termín zmešká? Sieť o tom nič nehovorí. Plánovací program musí pre to zvoliť pravidlo. Aplikácia pozná niekoľko bodov, v ktorých sa pravidlo Primavera P6 a pravidlo Microsoft Project líšia.

Aplikácia takú voľbu nazýva **pravidlo výpočtu**. **Profil výpočtu** je sada pravidiel výpočtu, ktorá patrí k jednému programu. Aplikácia má tri profily:

- *Open Planner Studio*: profil výpočtu, podľa ktorého sa počíta nový projekt. Žiadne pravidlo výpočtu nie je zapnuté.
- *Primavera P6*: pravidlá výpočtu, ktoré aplikácia pozná z P6.
- *Microsoft Project*: pravidlá výpočtu, ktoré aplikácia pozná z programu Microsoft Project.

Profil výpočtu teda hovorí, ako daný program počíta. Čo chcete pre svoj projekt, do profilu nepatrí. To sú **možnosti výpočtu**: voľby, napríklad koľko časovej rezervy ešte urobí úlohu kritickou, alebo v akom kalendári sa počíta oneskorenie. Tieto voľby nastavujete pre každý projekt zvlášť.

## Ako aplikácia počíta

### Pravidlá výpočtu a možnosti výpočtu

Pravidlo výpočtu je prepínač: zapnutý alebo vypnutý. Profil výpočtu určuje, ktoré prepínače sú zapnuté. Možnosť výpočtu je voľba, ktorú urobíte vy. Rozdiel vidíte priamo v aplikácii, v bloku *Profil výpočtu a možnosti výpočtu*:

- **Pravidlá výpočtu** sú pod *Pravidlá výpočtu tohto profilu*, zoskupené podľa témy, napríklad *Postup a dokončená práca*, *Závislosti a oneskorenie* a *Časová rezerva a neskoré dátumy*. Každý riadok je začiarkavacie políčko, za ktorým je hodnota profilu výpočtu (*základ: zapnuté* alebo *základ: vypnuté*). Ak sa vaša voľba od tejto hodnoty líši, riadok sa zvýrazní a zobrazí sa *Späť na základ*. Šípka pred riadkom otvorí vysvetlenie tohto pravidla výpočtu. Ak chcete pravidlo výpočtu zmeniť, najprv si ho prečítajte.
- **Možnosti výpočtu** sú pod *Možnosti výpočtu tohto projektu*: okrem iného *Definícia kritického stavu*, *Výpočet časovej rezervy*, *Úlohy s otvoreným koncom sú kritické*, *Označiť takmer kritické* a *Kalendár oneskorenia*. Hovoria, čo chcete pre tento projekt, nie ako daný program počíta. Čo tieto možnosti robia, je vysvetlené v článkoch [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad) a [Závislosti a oneskorenie](docs://uitleg-relaties).

Príklad ku každému. „Úloha je kritická, ak je jej celková časová rezerva 0 alebo menej“ je možnosť výpočtu: prahovú hodnotu môžete nastaviť na 4. Potom je kritické všetko s časovou rezervou 4 pracovné dni alebo menej. „Nezačatá práca sa presunie na dátum kontroly stavu“ je pravidlo výpočtu: Open Planner Studio a Primavera P6 to robia, Microsoft Project nie.

Profil výpočtu a možnosti výpočtu patria k súboru projektu, nie k aplikácii. Ak projekt uložíte, uložia sa spolu s ním. Dva projekty v tej istej aplikácii preto môžu počítať s rôznymi profilmi výpočtu. Projekt bez profilu výpočtu sa počíta ako Open Planner Studio.

Ak existujú možnosti výpočtu, ktoré pozná len Primavera P6, zobrazí blok na konci aj *Nastavenia zo zdrojového súboru*. To platí pre projekt z .xer file, ale aj vtedy, keď v okne *Nový projekt* vyberiete *Primavera P6* alebo použijete predvolené možnosti profilu Primavera P6. Tieto nastavenia tu nemôžete zmeniť.

### Kde profil výpočtu vyberiete

Pri novom projekte je profil výpočtu v okne *Nový projekt*, ktoré otvoríte cez *Domov › Súbor › Vytvoriť*. Tam je *Profil výpočtu* rozbaľovací zoznam. Ak tam vyberiete profil, aplikácia nahradí možnosti výpočtu, ktoré ste už vyplnili, predvolenými hodnotami tohto profilu. Zostanú len nastavenia zo zdrojového súboru. Pri *Primavera P6* je potom *Výpočet časovej rezervy* nastavený na *Časová rezerva dokončenia*. Pri *Microsoft Project* a *Open Planner Studio* má každá možnosť výpočtu predvolenú hodnotu, takže *Výpočet časovej rezervy* je *Automaticky (predvolené)*. Pri dátume kontroly stavu tak počíta aj sám MS Project: úloha, ktorá už začala, dostane časovú rezervu dokončenia a každá ďalšia úloha menšiu z časovej rezervy začiatku a časovej rezervy dokončenia.

Pri existujúcom projekte vyberiete profil výpočtu pod *Nastavenia › Projekt › Info o projekte*, v bloku *Profil výpočtu a možnosti výpočtu*, v rozbaľovacom zozname *Profil výpočtu*. Na to isté miesto sa dostanete aj cez *Súbor › Info o projekte*. Zmena profilu tu mení iba pravidlá výpočtu. Vaše možnosti výpočtu sa nezmenia. Ak chcete aj predvolené možnosti výpočtu nového profilu, vyberte *Použiť predvolené možnosti tohto profilu*.

Kým nestlačíte *Použiť*, zmena je len vo formulári. Po stlačení *Použiť* aplikácia okamžite prepočíta plán, aj keď je *Automatický prepočet* vypnutý. Ak sa úlohy posunuli, aplikácia povie koľko, napríklad *Po použití boli posunuté 4 úlohy.* Celá zmena je jeden krok pre *Vrátiť späť*.

Ak v profile výpočtu zapnete alebo vypnete jedno pravidlo výpočtu, aplikácia z neho urobí vlastný profil výpočtu. Volá sa *Kópia Open Planner Studio*, alebo *Kópia* profilu, z ktorého ste začali. Môžete mu dať iný názov a uložiť ho cez *Uložiť ako šablónu* pre ďalšie projekty v tejto aplikácii. Projekt má vždy vlastnú kópiu: ak šablónu neskôr zmeníte, projekt sa s ňou nezmení.

### Kedy aplikácia vyberie profil sama

Keď otvoríte súbor, aplikácia navrhne profil podľa formátu:

- Súbor .mpp (Microsoft Project) sa otvorí s profilom *Microsoft Project*.
- Súbor .xer (Primavera P6) sa otvorí s profilom *Primavera P6*.
- Súbor vo formáte *MS Project XML*, *Primavera P6 XML* alebo *CSV (oddelené bodkočiarkou)* sa otvorí s *Open Planner Studio* bez hlásenia o profile výpočtu.
- Váš vlastný projekt (.ifc) sa otvorí s profilom, ktorý je v ňom uložený.

Pri súbore .mpp alebo .xer aplikácia oznámi profil: *Tento projekt sa počíta ako Microsoft Project. Zmeniť ho môžete v ponuke Súbor → Informácie o projekte → Profil výpočtu a možnosti výpočtu.* Tlačidlo *Otvoriť profil výpočtu* v hlásení vás priamo prenesie do *Info o projekte*. Pri súbore .xer je tento riadok prvým podrobným riadkom hlásenia, ktoré sa zobrazí pri otvorení súboru. Viac o hlásení nájdete v článkoch [Otvorenie súboru Primavera P6 (.xer)](docs://howto-xer-openen) a [Otvorenie súboru MS Project (.mpp)](docs://howto-mpp-openen).

Pri súbore .mpp aplikácia nastaví iba profil výpočtu. Možnosti výpočtu zostanú prázdne, rovnako ako pri novom projekte s profilom *Microsoft Project*: *Výpočet časovej rezervy* je *Automaticky (predvolené)*. Otvorený súbor .mpp a nový projekt s *Microsoft Project* preto počítajú časovú rezervu rovnako.

## Príklad: jedna sieť, tri profily

Príklad je malá sieť. Kalendár má pracovný týždeň od pondelka do piatka a v týchto týždňoch nie sú žiadne voľné dni. Režim postupu je Retained Logic (predvolený). Začiatok projektu je v pondelok 7. júna 2027. Trvanie všetkých úloh je v pracovných dňoch.

- *Pour foundation*: 5 pracovných dní, plánované od pondelka 7. júna.
- *Lay walls*: 5 pracovných dní, po *Pour foundation* (dokončenie-začiatok).
- *Order window frames*: 3 pracovné dni, bez predchádzajúcej úlohy, plánované od pondelka 7. júna.
- *Fit roof*: 2 pracovné dni, po *Lay walls* a po *Order window frames*. Dokončenie tejto úlohy je odovzdanie.

Čísla vypočítal výpočtový modul aplikácie. Nájdete ich v paneli *Vlastnosti* pod *Výsledok CPM*.

**Bez dátumu kontroly stavu a bez postupu počítajú tri profily túto sieť rovnako.** *Pour foundation* beží od pondelka 7. do piatka 11. júna, *Lay walls* od pondelka 14. do piatka 18. júna a *Fit roof* v pondelok 21. a v utorok 22. júna. Odovzdanie je v utorok 22. júna. *Order window frames* (od pondelka 7. do stredy 9. júna) má celkovú časovú rezervu 7 pracovných dní.

Teraz zaznamenáte stav. Dátum kontroly stavu je streda 9. júna. Úloha *Pour foundation* začala v pondelok 7. júna a je hotová na 60 %. Zostávajúca práca je preto 2 pracovné dni (5 × 40 %). *Order window frames* ešte nezačala. Ako fungujú [postup a dátum kontroly stavu](docs://uitleg-voortgang), je popísané v tom článku. Tu ide o to, čo s tým profil výpočtu urobí.

### Open Planner Studio

Zostávajúca práca úlohy *Pour foundation* začína dátumom kontroly stavu: streda 9. a štvrtok 10. júna. Skorý začiatok zostáva skutočný začiatok, pondelok 7. júna. Skoré dokončenie je štvrtok 10. júna. *Lay walls* beží od piatku 11. do štvrtka 17. júna a *Fit roof* v piatok 18. a v pondelok 21. júna.

*Order window frames* bola plánovaná na pondelok 7. júna, ale ešte nezačala. Práca, ktorá nezačala, nemôže ležať v minulosti. Aplikácia ju preto presunie na dátum kontroly stavu: streda 9. až piatok 11. júna, s 4 pracovnými dňami celkovej časovej rezervy. Odovzdanie je v pondelok 21. júna.

### Primavera P6

Všetko je rovnaké ako v Open Planner Studio, s jedným rozdielom: skorý začiatok úlohy *Pour foundation* je streda 9. júna. To je začiatok zostávajúcej práce, nie skutočný začiatok. Robí to pravidlo výpočtu *Úloha v priebehu: skorý začiatok = začiatok zostávajúcej práce*, v skupine *Postup a dokončená práca*. Dokončenie ani časová rezerva sa kvôli tomu nemenia. Odovzdanie je v pondelok 21. júna.

### Microsoft Project

Tu sa dátumy líšia. Za to sú zodpovedné dve pravidlá výpočtu v skupine *Postup ako v Microsoft Project*.

*Nepresúvať nezačaté úlohy na dátum kontroly stavu*: *Order window frames* ostáva od pondelka 7. do stredy 9. júna, aj keď to čiastočne leží pred dátumom kontroly stavu. Celková časová rezerva je 7 pracovných dní.

*Zostávajúca práca pokračuje po uplynulom trvaní*: zostávajúca práca začína najskôr dátumom kontroly stavu a najskôr skutočným začiatkom plus trvaním, ktoré už uplynulo. Pri 60 % z 5 pracovných dní sú hotové 3 pracovné dni. Pondelok 7. júna plus 3 pracovné dni je štvrtok 10. júna. To je po dátume kontroly stavu, takže zostávajúca práca beží vo štvrtok 10. a v piatok 11. júna. *Lay walls* beží od pondelka 14. do piatka 18. júna a *Fit roof* v pondelok 21. a v utorok 22. júna. Odovzdanie je v utorok 22. júna: o jeden pracovný deň neskôr ako pri ostatných dvoch profiloch.

### Čo ak

**Úloha Pour foundation je na 20 % namiesto 60 %.** Zostávajúca práca je potom 4 pracovné dni. Pri všetkých troch profiloch sa *Pour foundation* dokončí v pondelok 14. júna a odovzdanie je v stredu 23. júna. Pravidlo výpočtu Microsoft Project pre zostávajúcu prácu tu nič nemení: pondelok 7. júna plus 1 uplynulý pracovný deň je utorok 8. júna, a to je pred dátumom kontroly stavu. Takéto pravidlo je dolná hranica. Môže zostávajúcu prácu iba posunúť neskôr. *Order window frames* a skorý začiatok pri Primavera P6 sa stále líšia, ako je uvedené vyššie. Pri Microsoft Project potom *Order window frames* má 8 pracovných dní celkovej časovej rezervy.

**Nastavíte len dátum kontroly stavu a nezadáte žiadny postup.** Pri Open Planner Studio a Primavera P6 sa celá sieť presunie na stredu 9. júna. Úloha *Pour foundation* potom beží od stredy 9. do utorka 15. júna a odovzdanie sa presunie na štvrtok 24. júna: o dva pracovné dni neskôr ako bez dátumu kontroly stavu. Pri Microsoft Project zostane všetko tak, ako bolo, a odovzdanie je v utorok 22. júna.

**Profil výpočtu si zostavíte sami.** Ak pri Open Planner Studio zapnete iba *Nepresúvať nezačaté úlohy na dátum kontroly stavu*, vznikne vlastný profil výpočtu, *Kópia Open Planner Studio*. Pri 60 % postupu si *Pour foundation* ponechá dátumy z profilu Open Planner Studio (dokončenie vo štvrtok 10. júna, odovzdanie v pondelok 21. júna). *Order window frames* naozaj ostáva od pondelka 7. do stredy 9. júna, s 6 pracovnými dňami celkovej časovej rezervy. Profil výpočtu je teda sada oddelených prepínačov a môžete ich meniť jeden po druhom.

**Možnosť výpočtu namiesto pravidla výpočtu.** Ak pri Open Planner Studio nastavíte *Definícia kritického stavu* (*Celková časová rezerva ≤ prahová hodnota*) a *Prahová hodnota (pracovné dni)* na 4, *Order window frames* sa stane kritickou, pretože jej celková časová rezerva je presne 4. Žiadny dátum sa nemení. Možnosť výpočtu je vaša voľba pre projekt a nezávisí od profilu výpočtu.

**Termín, ktorý sa zmeškal.** Nastavte úlohe *Fit roof* termín v piatok 18. júna. Pri Open Planner Studio je celková časová rezerva *Fit roof* potom −1 pracovný deň a voľná časová rezerva je tiež −1. Pri Primavera P6 zostáva celková časová rezerva −1, ale voľná časová rezerva je 0. To robí pravidlo výpočtu *Voľná časová rezerva nie je záporná* v skupine *Časová rezerva a neskoré dátumy*. Pri Microsoft Project sú obe −2, pretože odovzdanie tam vyjde o deň neskôr. Ako termín funguje, je popísané v článku [Obmedzenia a termíny](docs://uitleg-constraints).

## Dôsledky a nedorozumenia

**„Profil je nastavenie aplikácie.“** Nie. Profil a možnosti výpočtu patria projektu a prenášajú sa v súbore. Aplikácii patria len šablóny, ktoré si ponecháte. Projekt si vždy ponechá vlastnú kópiu.

**„Ak exportujem, môj profil ide spolu s ním.“** Profil ide so súborom len vo vlastnom formáte projektu (.ifc). Ak exportujete do *MS Project XML*, *Primavera P6 XML* alebo *CSV (oddelené bodkočiarkou)*, profil v súbore nie je. Z možností výpočtu zapíše export do MS Project XML najviac prahovú hodnotu kritickosti. Aplikácia na to upozorní iba pri projekte, ktorý pochádza z .xer file. Pri projekte, ktorý ste vytvorili sami, žiadne upozornenie nedostanete. Súbor sa potom otvorí ako Open Planner Studio, bez upozornenia na profil. Vezmite príklad s profilom Microsoft Project a 60 % postupu. Ak ho exportujete do *MS Project XML* a znovu ho otvoríte, aplikácia najprv zobrazí dátumy zo súboru, s odovzdaním v utorok 22. júna. Ak necháte aplikáciu, aby plán sama prepočítala, bude to pondelok 21. júna. Čo ešte export stratí, nájdete v [Súbory a formáty](docs://uitleg-bestanden).

**„Profil Primavera P6 dáva rovnaký výsledok ako P6.“** Aplikácia to nemôže sľúbiť. Profil zapína pravidlá výpočtu, ktoré aplikácia pozná z P6. Tie však nie sú všetky nastavenia P6. Okrem Retained Logic a Progress Override má P6 ešte tretí režim postupu, Actual Dates. Aplikácia ho nepozná. Taký .xer file sa vypočíta ako Retained Logic a upozornenie pri otvorení to uvedie, napríklad ako *1 nastavenie plánu P6 s bezpečnou záložnou hodnotou.* Niektoré pravidlá výpočtu profilu Primavera P6 fungujú aj len pri úlohách z .xer file, napríklad *Nezačatá LOE použije cieľové okno* a *Skutočné dátumy prevziať presne*. Pri niektorých to vysvetlenie výslovne uvádza: „only tasks with P6 provenance“. Pri úlohách, ktoré vytvoríte sami, tieto pravidlá nič nerobia.

**„Režim postupu je súčasťou profilu.“** Nie. Retained Logic alebo Progress Override je samostatná voľba pre každý projekt. Nastavíte ju oddelene od profilu. Pozrite si [Výber režimu postupu](docs://howto-voortgangsmodus-kiezen). Jedno pravidlo P6, *Progress Override ignoruje začatú nasledujúcu úlohu aj pri spätnom výpočte*, robí niečo iba pri Progress Override.

**„Len prepnem profil a uvidím, čo sa stane.“** Môžete, lebo *Použiť* sa dá zrušiť jedným krokom: *Vrátiť späť* vráti profil aj dátumy spolu. Dátumy sa však naozaj môžu posunúť. V príklade sa prepnutím z Open Planner Studio na Microsoft Project posunú všetky 4 úlohy. Upozornenie ich za vás spočíta. Pozrite si potom plán, skôr než budete pokračovať. Ak aplikácia po otvorení súboru .xer alebo .mpp stále zobrazuje dátumy zo súboru, prepnutie profilu tento pohľad opustí a aplikácia plán vypočíta sama. Ako to funguje, je v článku [Dátumy tak, ako sú uložené](docs://uitleg-datums-zoals-opgeslagen).

**Príklad ukazuje štyri pravidlá výpočtu a zoznam v aplikácii je dlhší.** Každý riadok v príklade má vlastné vysvetlenie. Najprv si ho prečítajte. Pozrite si aj skupinu *Len pre vlastné profily*. Tieto pravidlá sú vypnuté v každom vstavanom profile, vrátane Primavera P6. Ak niektoré zapnete, profil sa stane vlastným profilom.

## Pozri aj

- [Postup, dátum kontroly stavu a pôvodný plán](docs://uitleg-voortgang): čo robia dátum kontroly stavu a zostávajúca práca, s rozdielmi podľa profilu.
- [Výber režimu postupu](docs://howto-voortgangsmodus-kiezen): výber Retained Logic alebo Progress Override.
- [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad): možnosti výpočtu pre kritické úlohy a časovú rezervu.
- [Závislosti a oneskorenie](docs://uitleg-relaties): možnosť výpočtu *Kalendár oneskorenia*.
- [Súbory a formáty](docs://uitleg-bestanden): čo export prenesie a čo nie.
- [Export](docs://howto-exporteren): export projektu.
- [Aktualizácia postupu](docs://howto-voortgang-bijwerken): zadanie percenta, skutočného začiatku a dátumu kontroly stavu.
- [Dátumy tak, ako sú uložené](docs://uitleg-datums-zoals-opgeslagen): prečo sa importované dátumy môžu líšiť od dátumov, ktoré aplikácia vypočíta sama.
- [Možnosti výpočtu a pravidlá výpočtu](docs://ref-rekenopties-en-conventies): všetky pravidlá a možnosti výpočtu v jednom zozname.

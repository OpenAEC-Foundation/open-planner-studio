# Dátumy tak, ako sú uložené

Otvoríte plán z Primavery alebo MS Project a dátumy sa líšia od toho, čo ste videli v tom programe. Nepokazil sa import? Zvyčajne nie. V tomto článku si prečítate, prečo aplikácia prepočítava sama, kedy zobrazuje dátumy zo súboru, čo vtedy zostane prázdne a ako sa vrátite k vlastnému výpočtu. Príklad na konci sleduje dve úlohy celým priebehom.

## Pojem

Súbor plánu obsahuje dva druhy údajov. Prvý je logika: úlohy, trvania, závislosti, kalendáre a obmedzenia. Druhý sú dátumy, ktoré z nich vypočítal program, ktorý súbor vytvoril. Pri otvorení Open Planner Studio použije logiku a vypočíta si dátumy sám. Dátumy v súbore preto nie sú vstup.

Ak výpočet aplikácie skončí na iných dátumoch, než je uvedené v súbore, neviete, ktorá strana má pravdu. V súbore môže chýbať logika, ktorú program použil. Program môže aj v niektorom bode počítať inak než aplikácia. Preto môže aplikácia zobraziť dátumy **tak, ako sú uložené**: dátumy, ktoré druhý program zapísal do súboru. Tak porovnáte s tým, čo ste videli v tom programe.

## Ako s tým aplikácia pracuje

### Aký profil výpočtu aplikácia používa

Aplikácia počíta s **profilom výpočtu**: súbor pravidiel výpočtu, ktoré rozhodujú napríklad o tom, ako sa zaobchádza s plánovaným začiatkom úlohy a s obmedzeniami. Pozrite [Profily výpočtu a pravidlá výpočtu](docs://uitleg-rekenprofielen). Sú tri vstavané profily: *Primavera P6*, *Microsoft Project* a *Open Planner Studio*. Súbor `.xer` sa otvorí s profilom *Primavera P6* a súbor `.mpp` s profilom *Microsoft Project*. CSV, MS Project XML a Primavera P6 XML sa otvoria s profilom *Open Planner Studio*. Profil projektu nájdete v *Súbor › Info o projekte*, v poli *Profil výpočtu a možnosti výpočtu*. Súbor IFC z aplikácie si svoj profil zachová.

### Kedy aplikácia porovnáva

Pri otvorení aplikácia zapíše, čo súbor uvádza, a porovná to s vlastným výsledkom. Robí to pri:

- súbore Primavera (`.xer`) a Primavera P6 XML;
- MS Project XML a súboroch MS Project (`.mpp`);
- súbore IFC z iného programu, pre úlohy, ktorých skoré dátumy sú v súbore;
- súbore IFC z aplikácie samotnej, ktorý si zapamätal svoj pôvod. Nižšie je uvedené, kedy je to tak.

Aplikácia nikdy neporovnáva súbor CSV: začiatočný dátum v CSV je vstup, nie výsledok výpočtu. Ani súbor IFC z aplikácie bez zapamätaného pôvodu sa neporovnáva.

Ak sa žiadna úloha nelíši, nič si nevšimnete. Ak sa aspoň jedna úloha líši v súbore, ktorý práve importujete, aplikácia zobrazenie hneď zapne.

Pri súbore Primavera počíta aplikácia s profilom výpočtu *Primavera P6*. Ten zachová plánovaný začiatok zo súboru ako skorý začiatok. Úloha, ktorá je v súbore neskôr, než vyžadujú závislosti, ale je tam aj naplánovaná, preto zostane tam, kde je: vtedy nie je rozdiel.

### Čo vidíte

Pod pásom s nástrojmi je lišta: *Zobrazujete dátumy tak, ako sú uložené v súbore; pri prepočítaní sa posunú 4 úlohy.* Pri zdroji Primavera (`.xer` alebo Primavera P6 XML) je text *Zobrazujete plán tak, ako ho uložil Primavera; pri prepočítaní sa posunie 1 úloha.* Vpravo na lište je tlačidlo *Prepočítať*. Lišta nemá krížik.

Zobrazí sa aj hlásenie: *4 úlohy zobrazujú dátumy tak, ako sú uvedené v súbore (bez prepočítania).* Iba pri súbore `.xer` znie hlásenie *1 úloha zobrazuje dátumy tak, ako ich uložil Primavera (bez prepočítania).* Každá úloha, pri ktorej súbor zaznamenal dátumy, má v paneli *Vlastnosti* značku: *Zobrazuje vlastné uložené dátumy Primavery pre túto úlohu* pri zdroji Primavera, alebo *Zobrazuje dátumy tak, ako sú pre túto úlohu zapísané v súbore* pri inom zdroji. Gantt, tabuľka úloh a stavový riadok zobrazujú dátumy zo súboru.

### Čo v tomto zobrazení zostáva prázdne

V tomto zobrazení aplikácia nič nepočíta. Zobrazuje len to, čo súbor zaznamenal. Časovú rezervu a kritickú cestu uvidíte preto len vtedy, keď ich súbor obsahuje. Ak súbor nezaznamenal žiadne kritické úlohy, stavový riadok ukazuje 0 kritických úloh. To nič nehovorí o kritickej ceste v samotnom programe. Čo vzniká len pri výpočte, v tomto zobrazení neexistuje: ktoré závislosti riadia plán, porušené obmedzenia, úlohy mimo poradia a takmer kritické úlohy.

Ak súbor pre úlohu nezaznamenal všetko, v paneli *Vlastnosti* uvidíte značku *Záznam je čiastočne neúplný — pozrite stĺpce pre neskoré dátumy a časovú rezervu*. Pri exporte do CSV zostanú pri takej úlohe stĺpce *Kritické* a *Celková časová rezerva* prázdne, namiesto vymyslenej nuly.

### Opustenie zobrazenia

Zobrazenie opustíte dvoma spôsobmi:

- Kliknite na tlačidlo *Prepočítať* na lište alebo vyberte *Prepočítať* (F5). Aplikácia počíta podľa vlastných pravidiel.
- Zmeňte niečo, čo môže zmeniť dátumy, napríklad trvanie úlohy alebo novú úlohu. Aplikácia zobrazenie opustí a hneď prepočíta, aj keď je *Automatický prepočet* vypnutý. Zmena názvu to nespôsobí: zobrazenie zostane zapnuté.

Po opustení nie je tlačidlo, ktorým by ste sa do zobrazenia vrátili. Ctrl+Z ho vráti späť, hneď po prepočítaní alebo hneď po takej úprave. Inak môžete znovu otvoriť zdrojový súbor. Pri súbore `.xer` otvorenie súboru IFC, ktorý ste uložili po prepočítaní, ale neupravili, takisto zapne zobrazenie znovu.

### Zotavenie zo zlyhania

Ak obnovíte projekt po páde, ktorý bol v zobrazení, zobrazenie zostane zapnuté. Aktívny projekt zobrazí rovnakú lištu ako predtým. Projekt na inej karte zobrazí lištu bez čísla: *Zobrazujete dátumy tak, ako sú uložené v súbore. Nič sa neprepočítalo.* Pozrite [Obnovenie po páde](docs://howto-herstellen-na-een-crash).

### Ukladanie a opätovné otváranie

Ak uložíte, kým používate zobrazenie, aplikácia zapíše zobrazené dátumy do súboru IFC spolu so zdrojovým formátom. Ak potom znovu otvoríte ten súbor IFC a od importu ste ho neupravili, zobrazenie je znovu zapnuté, bez nového hlásenia.

Ak ste medzitým upravili a uložili, záleží to od zdroja. Pri súbore Primavera si súbor IFC ponechá pôvodný `.xer`. Aplikácia potom znovu porovná a ponúkne zobrazenie: *Prepočítanie posunulo 1 úlohu z 2 oproti dátumom v súbore.* K tomu patrí tlačidlo *Zobraziť uložené dátumy* a krížik. Pri každej odchýlenej úlohe v paneli *Vlastnosti* je značka *Líši sa od uložených dátumov*. *Zobraziť uložené dátumy* zapne zobrazenie; Ctrl+Z to vráti späť. Krížik ponuku skryje.

Pri súbore MS Project XML, `.mpp`, Primavera P6 XML alebo súbore IFC z iného programu súbor IFC zdroj neuchová. Ak takýto projekt upravíte a uložíte, aplikácia pri opätovnom otvorení už neporovnáva.

## Príklad: prístavba

Predpokladajme, že otvoríte súbor Primavera *Uitbouw* (prístavba) s dvoma úlohami v kalendári bez sviatkov. V roku 2027 je 6. mája Nanebovstúpenie Pána a 17. mája Svätodušný pondelok: so sviatkami v kalendári vyjdú dátumy inak. *Fundering storten* (vylievanie základov) trvá 5 pracovných dní, *Metselwerk* (murovanie) trvá 10 pracovných dní a Metselwerk nadväzuje na Fundering závislosťou dokončenie-začiatok. Súbor zaznamenáva, že Fundering prebieha od pondelka 3. mája do piatka 7. mája 2027 a Metselwerk od pondelka 17. mája do piatka 28. mája 2027: o týždeň neskôr, než je skorý začiatok, ktorý dovoľuje závislosť. Plánovaný začiatok Metselwerk v súbore je pondelok 10. mája 2027.

Hneď po otvorení vidíte dátumy zo súboru. Stavový riadok ukazuje *Dokončenie: 28-05-2027* a *Kritická cesta: 2 úlohy, 20 pracovných dní*. Lišta hlási, že pri prepočítaní sa líši 1 úloha, a obe úlohy zobrazujú *Zobrazuje vlastné uložené dátumy Primavery pre túto úlohu*.

Po kliknutí na tlačidlo *Prepočítať* zostáva Fundering od 3. do 7. mája. Metselwerk teraz začína v pondelok 10. mája, na pracovný deň po skončení Fundering, a končí v piatok 21. mája. Plán končí 21. mája 2027 a trvá 15 pracovných dní namiesto 20. Kritickú cestu tvoria rovnaké 2 úlohy.

Čo ak je to inak?

- Ak je Metselwerk v súbore plánovaný aj na pondelok 17. mája, profil výpočtu *Primavera P6* zachová tento začiatok. Výpočet dá Metselwerku dátumy od 17. do 28. mája, rozdiel nie je a zobrazenie sa nezapne.
- Pridáte úlohu v zobrazení: rovnaké prepočítanie. Metselwerk sa posunie na 10. až 21. mája.
- Uložíte v zobrazení a znovu otvoríte súbor IFC bez úprav: Metselwerk je späť na 17. až 28. mája.
- Prepočítate, uložíte bez ďalších úprav a znovu otvoríte súbor IFC: zobrazenie je znovu zapnuté a Metselwerk je na 17. až 28. mája.
- Upravíte, uložíte a znovu otvoríte: aplikácia ponúkne zobrazenie s hlásením *Prepočítanie posunulo 1 úlohu z 2 oproti dátumom v súbore.* Metselwerk zobrazuje *Líši sa od uložených dátumov*.

## Dôsledky a nedorozumenia

**Rozdiel nie je chyba importu.** Aplikácia počíta podľa vlastných pravidiel: pri `.xer` s profilom výpočtu *Primavera P6*, pri `.mpp` s *Microsoft Project*, pri CSV, MS Project XML a Primavera P6 XML s *Open Planner Studio*. Dôvod, prečo dátumy v zdrojovom programe vyšli inak, môže byť v súbore alebo v programe. Zobrazenie vám ukáže, *že* sa líšia.

**Zobrazenie nie je výsledok výpočtu.** Aplikácia dátumy nepočítala. Neberte ich jednoducho ako výsledok vášho vlastného plánu.

**Uloženie v zobrazení zachová dátumy zdrojového programu.** Súbor IFC potom obsahuje to, čo tvrdil zdrojový program, nie to, čo by aplikácia vypočítala.

**Tlačidlo *Zobraziť uložené dátumy* sa nezobrazí pri každom importe.** Pri novo otvorenom súbore je zobrazenie už zapnuté. Tlačidlo sa objaví len pri znovu otvorenom súbore IFC so zdrojom Primavera, ktorý ste od importu upravili.

## Pozri aj

- [Súbory a formáty](docs://uitleg-bestanden): čo aplikácia uchováva v súbore a čo nesie import alebo export.
- [Otvorenie súboru Primavera P6 (.xer)](docs://howto-xer-openen): kroky a hlásenia pre súbor `.xer`.
- [Otvorenie súboru MS Project (.mpp)](docs://howto-mpp-openen): kroky a hlásenia pre súbor `.mpp`.
- [Obnovenie po páde](docs://howto-herstellen-na-een-crash): čo sa s týmto projektom stane po páde.
- [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad): ako aplikácia počíta časovú rezervu a kritickosť, keď počíta.

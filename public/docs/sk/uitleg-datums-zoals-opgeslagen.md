# Dátumy tak, ako sú uložené

Otvoríte plán z Primavery alebo MS Project a dátumy sa líšia od toho, čo ste videli v tom programe. Nepokazil sa import? Zvyčajne nie. V tomto článku si prečítate, prečo aplikácia prepočítava sama, kedy zobrazuje dátumy zo súboru, čo vtedy zostane prázdne a ako sa vrátite k vlastnému výpočtu. Príklad na konci sleduje dve úlohy celým priebehom.

## Pojem

Súbor plánu obsahuje dva druhy údajov. Prvý je logika: úlohy, trvania, závislosti, kalendáre a obmedzenia. Druhý sú dátumy, ktoré z nich vypočítal program, ktorý súbor vytvoril. Pri otvorení Open Planner Studio použije logiku a vypočíta si dátumy sám. Dátumy v súbore preto nie sú vstup.

Ak výpočet aplikácie skončí na iných dátumoch, než je uvedené v súbore, neviete, ktorá strana má pravdu. V súbore môže chýbať logika, ktorú program použil. Program môže aj v niektorom bode počítať inak než aplikácia. Preto môže aplikácia zobraziť dátumy **tak, ako sú uložené**: dátumy, ktoré druhý program zapísal do súboru. Tak porovnáte s tým, čo ste videli v tom programe.

## Ako s tým aplikácia pracuje

### Aký profil výpočtu aplikácia používa

Aplikácia počíta s **profilom výpočtu**: súborom pravidiel výpočtu, ktoré rozhodujú napríklad o tom, ako sa zaobchádza s plánovaným začiatkom úlohy a s obmedzeniami. Pozrite [Profily výpočtu a pravidlá výpočtu](docs://uitleg-rekenprofielen). Sú tri vstavané profily: *Primavera P6*, *Microsoft Project* a *Open Planner Studio*. Súbor `.xer` sa otvorí s profilom *Primavera P6* a súbor `.mpp` s profilom *Microsoft Project*. CSV, MS Project XML a Primavera P6 XML sa otvoria s profilom *Open Planner Studio*. Profil projektu nájdete v *Súbor › Nastavenia projektu*, v poli *Profil výpočtu a možnosti výpočtu*. Súbor IFC z aplikácie si svoj profil zachová.

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

Zobrazí sa aj hlásenie: *12 úloh zobrazuje dátumy tak, ako sú uvedené v súbore (bez prepočítania).* Iba pri súbore `.xer` znie hlásenie: *12 úloh zobrazuje dátumy tak, ako ich uložil Primavera (bez prepočítania).* Toto číslo počíta každú úlohu, pri ktorej súbor zaznamenal dátumy, aj úlohy, ktoré sa nelíšia. Počet úloh, ktoré sa po prepočítaní líšia, je na lište. Každá úloha, pri ktorej súbor zaznamenal dátumy, má v paneli *Vlastnosti* priamo nad poľom *Začiatok* oranžový blok: *Vidíte dátumy, ktoré uložila Primavera, nie výpočet aplikácie.* Pri inom zdroji je text: *Vidíte dátumy, ktoré boli v súbore, nie výpočet aplikácie.* Druhý riadok hovorí, čo sa stane s touto úlohou pri prepočítaní: *Pri prepočítaní sa táto úloha zmení.* alebo *Pri prepočítaní táto úloha zostane rovnaká.* Gantt, tabuľka úloh a stavový riadok zobrazujú dátumy zo súboru.

### Úlohy, ktoré sa začali alebo sú dokončené

Dokončená úloha sa zobrazuje na dňoch, keď sa skutočne odohrala: od skutočného začiatku po skutočné dokončenie. Úloha, ktorá prebieha, začína dňom, keď sa skutočne začala. Skončí na vypočítanom dokončení. Toto platí v tomto zobrazení, po prepočítaní a s každým profilom výpočtu, ako v Primavere a v MS Project.

Pri takej úlohe súbor často zaznamenáva iné skoré dátumy. Primavera nastaví skorý začiatok úlohy, ktorá prebieha alebo je dokončená, na dátum kontroly stavu. Tieto dátumy vidíte v stĺpcoch *Skorý začiatok* a *Skoré dokončenie*, nie v stĺpcoch *Začiatok* a *Dokončenie*. Dokončená úloha sa preto nikdy nepočíta ako rozdiel. Úloha, ktorá prebieha, sa počíta len vtedy, keď sa líši jej dokončenie.

Pri úlohe, ktorá sa začala, už nemôžete zadať začiatok. V tabuľke úloh, v paneli *Vlastnosti* a v okne *Upraviť úlohu* sa začiatok vtedy nedá upraviť. Pri dokončenej úlohe to platí aj pre dokončenie v tabuľke úloh. Zmeňte namiesto toho *Skutočný začiatok* alebo *Skutočné dokončenie* v rámci postupu. V diagrame Gantt sa pruh takej úlohy nepohne. Zobrazí sa hlásenie.

### Čo v tomto zobrazení zostáva prázdne

V tomto zobrazení aplikácia nič nepočíta. Zobrazuje len to, čo súbor zaznamenal. Časovú rezervu a kritickú cestu preto uvidíte len vtedy, keď ich súbor obsahuje. Ak súbor nezaznamenal žiadne kritické úlohy, stavový riadok ukazuje 0 kritických úloh. To nič nehovorí o kritickej ceste v samotnom zdrojovom súbore. Čo vzniká len pri výpočte, v tomto zobrazení neexistuje: ktoré závislosti riadia plán, porušené obmedzenia, úlohy mimo poradia a takmer kritické úlohy.

Ak súbor pre úlohu nezaznamenal všetko, oranžový blok v paneli *Vlastnosti* dostane tretí riadok, napríklad: *Primavera pre túto úlohu neuložila všetko. Chýba: voľná časová rezerva.* Pri inom zdroji je text: *Súbor pre túto úlohu neobsahuje všetko.* Prvé dva riadky zostávajú: aj pri takej úlohe teda vidíte, že dátumy pochádzajú zo súboru, a či sa úloha pri prepočítaní zmení. Chýbajúce hodnoty majú rovnaké názvy ako stĺpce v tabuľke úloh. Pri exporte do CSV zostanú pri takej úlohe stĺpce *Kritické* a *Celková časová rezerva* prázdne, namiesto vymyslenej nuly.

### Opustenie zobrazenia

Zobrazenie opustíte dvoma spôsobmi:

- Kliknite na *Prepočítať* na lište alebo vyberte *Prepočítať* (F5). Aplikácia počíta podľa vlastných pravidiel.
- Zmeňte niečo, čo môže zmeniť dátumy, napríklad trvanie úlohy alebo novú úlohu. Aplikácia zobrazenie opustí a hneď prepočíta, aj keď je *Automatický prepočet* vypnutý. Zmena názvu, popisu, druhu prác alebo typu úlohy to nespôsobí: zobrazenie zostane zapnuté.

Zmena kalendára z knižnice zdrojov nechá zobrazenie zapnuté a dátumy zo súboru bez zmeny, ale aktualizuje číslo na lište.

Po opustení nie je tlačidlo, ktorým by ste sa do zobrazenia vrátili. Ctrl+Z ho vráti späť, hneď po prepočítaní alebo hneď po takej úprave. Inak môžete znovu otvoriť zdrojový súbor. Pri súbore `.xer` otvorenie súboru IFC, ktorý ste uložili po prepočítaní, ale neupravili, zobrazenie takisto zapne znovu.

### Zotavenie zo zlyhania

Ak obnovíte projekt po páde, ktorý bol v zobrazení, zobrazenie zostane zapnuté. Ak zobrazenie nebolo zapnuté, aplikácia zabudne dátumy zo súboru. Aktívny projekt zobrazuje rovnakú lištu ako predtým. Projekt na inej karte zobrazuje lištu bez čísla: *Zobrazujete dátumy tak, ako sú uložené v súbore. Nič sa neprepočítalo.* Pozrite [Obnovenie po páde](docs://howto-herstellen-na-een-crash).

### Ukladanie a opätovné otváranie

Ak uložíte, kým používate zobrazenie, aplikácia zapíše zobrazené dátumy do súboru IFC spolu so zdrojovým formátom. Ak potom znovu otvoríte ten súbor IFC, zobrazenie je znovu zapnuté, bez nového hlásenia. To platí aj vtedy, ak ste v zobrazení zmenili niečo, čo dátumy neovplyvní, napríklad názov. Aplikácia otvorí súbor tak, ako ste ho nechali.

Ak uložíte až po opustení zobrazenia, prepočítaním alebo úpravou, ktorá môže zmeniť dátumy, súbor obsahuje vlastný výpočet aplikácie. Pri opätovnom otvorení vidíte tento výpočet, bez lišty a bez bloku v paneli *Vlastnosti*. Jedna výnimka: súbor `.xer`, ktorý ste iba prepočítali a neupravili (pozrite vyššie). Váš upravený plán je teraz plán, ktorý platí; staré dátumy zo zdrojového súboru k nemu už nepatria. Ak ich chcete ešte vidieť, znovu otvorte zdrojový súbor.

## Príklad: prístavba

Predpokladajte, že otvoríte súbor Primavera *Uitbouw* (prístavba) s dvoma úlohami v kalendári bez sviatkov. V roku 2027 pripadá 6. mája na Nanebovstúpenie Pána a 17. mája na Svätodušný pondelok: so sviatkami v kalendári vyjdú dátumy inak. *Fundering storten* (vylievanie základov) trvá 5 pracovných dní, *Metselwerk* (murovanie) trvá 10 pracovných dní a Metselwerk nadväzuje na Fundering závislosťou dokončenie-začiatok. Súbor zaznamenáva, že Fundering prebieha od pondelka 3. mája do piatka 7. mája 2027 a Metselwerk od pondelka 17. mája do piatka 28. mája 2027: o týždeň neskôr, než je skorý začiatok, ktorý dovoľuje závislosť. Plánovaný začiatok Metselwerk v súbore je pondelok 10. mája 2027.

Hneď po otvorení vidíte dátumy zo súboru. Stavový riadok ukazuje *Dokončenie: 28-05-2027* a *Kritická cesta: 2 úlohy, 20 pracovných dní*. Lišta hlási, že pri prepočítaní sa líši 1 úloha. Obe úlohy zobrazujú oranžový blok *Vidíte dátumy, ktoré uložila Primavera, nie výpočet aplikácie.* Pod ním Metselwerk hovorí *Pri prepočítaní sa táto úloha zmení.* a Fundering hovorí *Pri prepočítaní táto úloha zostane rovnaká.*

Po kliknutí na *Prepočítať* zostáva Fundering od 3. do 7. mája. Metselwerk teraz začína v pondelok 10. mája, na pracovný deň po skončení úlohy Fundering, a končí v piatok 21. mája. Plán končí 21. mája 2027 a trvá 15 pracovných dní namiesto 20. Kritickú cestu tvoria rovnaké 2 úlohy.

Čo ak je to inak?

- Ak je Metselwerk v súbore plánovaný aj na pondelok 17. mája, profil výpočtu *Primavera P6* zachová tento začiatok. Výpočet dá úlohe Metselwerk dátumy od 17. do 28. mája, rozdiel nie je a zobrazenie sa nezapne.
- Pridáte úlohu v zobrazení: rovnaké prepočítanie. Metselwerk sa posunie na 10. až 21. mája.
- Uložíte v zobrazení a znovu otvoríte súbor IFC bez úprav: Metselwerk je späť na 17. až 28. mája.
- Prepočítate, uložíte bez ďalších úprav a znovu otvoríte súbor IFC: zobrazenie je znovu zapnuté a Metselwerk je na 17. až 28. mája.
- Zmeníte len názov úlohy Metselwerk v zobrazení, uložíte a znovu otvoríte: zobrazenie je znovu zapnuté a Metselwerk je na 17. až 28. mája.
- Pridáte úlohu v zobrazení, uložíte a znovu otvoríte: aplikácia zabudne dátumy zo súboru. Metselwerk je na 10. až 21. mája, bez lišty a bez bloku.
- Úloha Fundering je v súbore už dokončená: skutočne sa začala 3. mája a skutočne sa skončila 7. mája. Súbor ako jej skorý začiatok zaznamenáva dátum kontroly stavu. Pruh úlohy Fundering zostáva aj tak na 3. až 7. mája, v zobrazení aj po prepočítaní. Fundering sa nepočíta ako rozdiel.

## Dôsledky a nedorozumenia

**Rozdiel nie je chyba importu.** Aplikácia počíta podľa vlastných pravidiel: pri `.xer` s profilom výpočtu *Primavera P6*, pri `.mpp` s *Microsoft Project* a pri CSV, MS Project XML a Primavera P6 XML s *Open Planner Studio*. Prečo dátumy v zdrojovom súbore vyšli inak, môže ležať v samotnom súbore alebo v programe, ktorý ho vytvoril. Zobrazenie vám ukáže, *že* sa líšia.

**Zobrazenie nie je výsledok výpočtu.** Aplikácia dátumy nevypočítala. Neberte ich jednoducho ako výsledok vášho vlastného plánu.

**Uloženie v zobrazení zachová dátumy zdrojového súboru.** Súbor IFC potom obsahuje to, čo uvádzal zdrojový súbor, nie to, čo by aplikácia vypočítala.

**Po úprave, ktorá môže zmeniť dátumy, sa dátumy zo súboru nevrátia.** Ak ste zobrazenie opustili takouto úpravou, vidíte vlastný výpočet aplikácie až po uložení a znovu otvorení. Zmena názvu sa nepočíta: zobrazenie potom zostane zapnuté (pozrite *Ukladanie a opätovné otváranie*). Ak chcete vidieť dátumy zo zdrojového súboru, znovu ho otvorte.

## Pozri aj

- [Súbory a formáty](docs://uitleg-bestanden): čo aplikácia uchováva v súbore a čo nesie import alebo export.
- [Otvorenie súboru Primavera P6 (.xer)](docs://howto-xer-openen): kroky a hlásenia pre súbor `.xer`.
- [Otvorenie súboru MS Project (.mpp)](docs://howto-mpp-openen): kroky a hlásenia pre súbor `.mpp`.
- [Obnovenie po páde](docs://howto-herstellen-na-een-crash): čo sa s týmto projektom stane po páde.
- [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad): ako aplikácia počíta časovú rezervu a kritickosť, keď počíta.

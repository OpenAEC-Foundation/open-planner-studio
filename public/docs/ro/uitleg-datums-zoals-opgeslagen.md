# Date salvate

Deschideți o planificare din Primavera sau MS Project, iar datele diferă de ceea ce ați văzut în acel pachet. A dat greș importul? De obicei nu. În acest articol aflați de ce aplicația recalculează singură, când arată datele din fișier, ce rămâne gol atunci și cum reveniți la propriul calcul. Exemplul de la sfârșit urmărește două activități prin tot procesul.

## Conceptul

Un fișier de planificare conține două feluri de date. Mai întâi logica: activități, durate, dependențe, calendare și restricții. Apoi datele pe care pachetul însuși le-a calculat din ele. La deschidere, Open Planner Studio folosește logica și calculează singur. Deci datele din fișier nu sunt date de intrare.

Dacă propriul calcul ajunge la alte date decât cele din fișier, nu știți care parte are dreptate. Fișierul poate să nu conțină logica pe care pachetul a folosit-o. Pachetul poate calcula și altfel decât aplicația, într-un anumit punct. De aceea aplicația poate arăta datele **așa cum au fost salvate**: datele pe care cealaltă aplicație le-a pus în fișier. Astfel comparați cu ceea ce ați văzut în acel pachet.

## Cum tratează aplicația acest lucru

### Ce profil de calcul folosește aplicația

Aplicația calculează cu un **profil de calcul**: un set de reguli de calcul (convenții) care decide, de exemplu, cum tratează data de început planificată a unei activități și restricțiile. Vezi [Profiluri de calcul și convenții de calcul](docs://uitleg-rekenprofielen). Există trei profiluri încorporate: *Primavera P6*, *Microsoft Project* și *Open Planner Studio*. Un `.xer` se deschide cu *Primavera P6* și un `.mpp` cu *Microsoft Project*. CSV, XML MS Project și XML Primavera P6 se deschid cu *Open Planner Studio*. Profilul unui proiect se află la *Fișier › Setări proiect*, la *Profil de calcul și opțiuni de calcul*. Un fișier IFC din aplicație își păstrează profilul.

### Când compară aplicația

La deschidere, aplicația notează ce spunea fișierul și compară aceasta cu rezultatul propriu. Face asta pentru:

- un fișier Primavera (`.xer`) și XML Primavera P6;
- XML MS Project și fișiere MS Project (`.mpp`);
- un fișier IFC de la alt program, pentru activitățile ale căror date de început cele mai devreme sunt în fișier;
- un fișier IFC din aplicație care și-a reținut originea. Mai jos citiți când este cazul.

Aplicația nu compară niciodată un fișier CSV: data de început dintr-un CSV este dată de intrare, nu rezultatul unui calcul. Nici un fișier IFC din aplicație fără origine reținută nu este comparat.

Dacă nicio activitate nu diferă, nu observați nimic. Dacă cel puțin o activitate diferă într-un fișier pe care îl importați chiar acum, aplicația activează imediat vizualizarea.

Cu un fișier Primavera, aplicația calculează cu profilul de calcul *Primavera P6*. Acesta păstrează data de început planificată din fișier ca început cel mai devreme. O activitate care este mai târziu în fișier decât cer dependențele, dar care este și planificată acolo, rămâne deci pe loc: atunci nu există nicio diferență.

### Ce vedeți

Sub panglică există o bară: *Vizualizați datele așa cum sunt în fișier; la recalculare, 4 activități s-ar deplasa.* Cu o sursă Primavera (un `.xer` sau XML Primavera P6) scrie *Vizualizați planificarea așa cum a salvat-o Primavera; la recalculare, 1 activitate s-ar deplasa.* În dreapta bării se află butonul *Recalculare*. Bara nu are cruce.

Există și un mesaj: *12 activități afișează datele așa cum sunt în fișier (nerecalculate).* Doar cu un `.xer` apare *12 activități afișează datele așa cum le-a salvat Primavera (nerecalculate).* Acest număr cuprinde fiecare activitate pentru care fișierul a înregistrat date, inclusiv activitățile care nu diferă. Numărul de activități care diferă după recalculare se află în bară. Fiecare activitate pentru care fișierul a înregistrat date are un bloc portocaliu în panoul *Proprietăți*, chiar deasupra *Început*: *Vedeți datele salvate de Primavera, nu calculul aplicației.* Cu altă sursă scrie *Vedeți datele care se aflau în fișier, nu calculul aplicației.* Un al doilea rând arată ce se întâmplă cu această activitate la recalculare: *La recalculare, această activitate se modifică.* sau *La recalculare, această activitate rămâne neschimbată.* Diagrama Gantt, tabelul de activități și bara de stare arată datele din fișier.

### Activități începute sau finalizate

O activitate finalizată se află pe zilele în care s-a desfășurat în realitate: de la începutul efectiv până la sfârșitul efectiv. O activitate în curs de desfășurare începe în ziua în care a început efectiv. Ea se termină la sfârșitul calculat. Acest lucru se aplică în această vizualizare, după recalculare și cu fiecare profil de calcul, ca în Primavera și Microsoft Project.

Pentru o asemenea activitate, fișierul înregistrează adesea alte date de început cele mai devreme. Primavera pune începutul cel mai devreme al unei activități în curs sau finalizate pe data raportului de stare. Vedeți acele date în coloanele *Început cel mai devreme* și *Sfârșit cel mai devreme*, nu în *Început* și *Sfârșit*. Așadar, o activitate finalizată nu se numără niciodată drept diferență. O activitate în curs de desfășurare se numără doar dacă diferă sfârșitul ei.

Pentru o activitate care a început, nu mai puteți scrie începutul. În tabelul de activități, în panoul *Proprietăți* și în *Editare activitate* începutul este atunci doar în citire. Pentru o activitate finalizată, acest lucru se aplică și sfârșitului din tabelul de activități. Modificați în locul acestora *Început efectiv* sau *Sfârșit efectiv*, prin progres. În Gantt, bara unei asemenea activități nu se mută; atunci primiți un mesaj.

### Ce rămâne gol în această vizualizare

În această vizualizare aplicația nu calculează nimic. Ea arată doar ce a înregistrat fișierul. Deci vedeți marjă și drumul critic doar dacă fișierul le conține. Dacă fișierul nu înregistrează activități critice, bara de stare afișează 0 activități critice. Asta nu spune nimic despre drumul critic din pachetul însuși. Ce apare doar dintr-un calcul nu există în această vizualizare: ce dependențe conduc planificarea, restricțiile încălcate, activitățile care nu mai respectă ordinea și activitățile aproape critice.

Dacă fișierul nu înregistrează totul pentru o activitate, blocul portocaliu din panoul *Proprietăți* primește un al treilea rând, de exemplu *Primavera nu a salvat totul pentru această activitate. Lipsește: Marjă liberă.* Cu altă sursă scrie *Fișierul nu conține totul pentru această activitate.* Primele două rânduri rămân: deci pentru o asemenea activitate vedeți și că datele provin din fișier și dacă activitatea se modifică la recalculare. Valorile lipsă au aceleași nume ca și coloanele din tabelul de activități. Într-un export CSV rămân goale coloanele *Critic* și *Marjă totală* pentru o asemenea activitate, în loc de un zero inventat.

### Părăsirea vizualizării

Ieșiți din vizualizare în două moduri:

- Faceți clic pe *Recalculare* în bară, sau alegeți *Calculare* (F5). Aplicația calculează cu propriile reguli.
- Modificați ceva ce poate influența datele, de exemplu durata unei activități sau o activitate nouă. Aplicația iese din vizualizare și recalculează imediat, chiar dacă *Calculare automată* este dezactivată. Modificarea unui nume, a unei descrieri, a unei categorii de lucrări sau a unui tip de activitate nu face asta: vizualizarea rămâne activă.

O modificare de calendar din biblioteca de resurse lasă vizualizarea activă și datele din fișier nemodificate, dar actualizează numărul din bară.

După ce ieșiți, nu există niciun buton pentru a reveni la vizualizare. Ctrl+Z o readuce, chiar după recalculare sau chiar după o astfel de modificare. Altfel puteți deschide din nou fișierul sursă. Cu un `.xer`, deschiderea unui fișier IFC pe care l-ați salvat după recalculare, dar fără să-l modificați, activează și ea din nou vizualizarea.

### Refacere în urma unei căderi

Dacă recuperați un proiect după o cădere care era în vizualizare, vizualizarea rămâne activă. Dacă vizualizarea era dezactivată, aplicația uită datele din fișier. Proiectul care era activ arată aceeași bară ca înainte. Un proiect de pe o altă filă arată bara fără număr: *Vizualizați datele așa cum sunt în fișier. Nu s-a făcut nicio recalculare.* Vezi [Refacere în urma unei căderi](docs://howto-herstellen-na-een-crash).

### Salvare și redeschidere

Dacă salvați în timp ce folosiți vizualizarea, aplicația scrie datele afișate în fișierul IFC, împreună cu formatul sursă. Dacă deschideți din nou mai târziu acel fișier IFC, vizualizarea este din nou activă, fără un mesaj nou. Acest lucru se aplică și dacă ați modificat ceva în vizualizare care nu influențează datele, de exemplu un nume. Aplicația deschide fișierul așa cum l-ați lăsat.

Dacă salvați după ce ați ieșit din vizualizare, prin recalculare sau printr-o modificare care poate influența datele, fișierul conține calculul propriu al aplicației. La redeschidere vedeți acel calcul, fără bară și fără bloc în panoul *Proprietăți*. Există o excepție: un `.xer` pe care l-ați doar recalculat și nu l-ați modificat (vezi mai sus). Planificarea modificată de dumneavoastră devine acum planificarea; datele vechi din pachetul sursă nu mai aparțin de ea. Dacă doriți totuși să le vedeți, deschideți din nou fișierul sursă.

## Exemplu practic: extinderea

Să presupunem că deschideți un fișier Primavera *Uitbouw* (extindere) cu două activități, pe un calendar fără sărbători. În 2027, 6 mai este Înălțarea Domnului și 17 mai este Lunea Rusaliilor: cu sărbători în calendar, datele ies altfel. *Fundering storten* (turnare fundație) durează 5 zile lucrătoare, *Metselwerk* (zidărie) 10 zile lucrătoare, iar Metselwerk urmează după Fundering cu o dependență sfârșit-început. Fișierul înregistrează că Fundering rulează de luni, 3 mai, până vineri, 7 mai 2027, iar Metselwerk de luni, 17 mai, până vineri, 28 mai 2027: cu o săptămână după începutul cel mai devreme permis de dependență. Data de început planificată a activității Metselwerk în fișier este luni, 10 mai 2027.

Imediat după deschidere vedeți datele din fișier. Bara de stare arată *Sfârșit: 28-05-2027* și *Drum critic: 2 activități, 20 zile lucrătoare*. Bara arată că 1 activitate s-ar deplasa la recalculare. Ambele activități afișează blocul portocaliu *Vedeți datele salvate de Primavera, nu calculul aplicației.* Sub el, Metselwerk scrie *La recalculare, această activitate se modifică.* iar Fundering scrie *La recalculare, această activitate rămâne neschimbată.*

La *Recalculare*, Fundering rămâne între 3 și 7 mai. Metselwerk începe acum luni, 10 mai, ziua lucrătoare de după sfârșitul activității Fundering, și se termină vineri, 21 mai. Planificarea se termină la 21 mai 2027 și durează 15 zile lucrătoare în loc de 20. Drumul critic este format din aceleași 2 activități.

Ce se întâmplă dacă este altfel?

- Dacă Metselwerk este planificată și în fișier pe luni, 17 mai, profilul de calcul *Primavera P6* păstrează acel început. Calculul se termină între 17 și 28 mai, nu există nicio diferență și vizualizarea nu se activează.
- Adăugați o activitate în vizualizare: aceeași recalculare. Metselwerk se mută între 10 și 21 mai.
- Salvați în vizualizare și deschideți din nou fișierul IFC, fără să-l modificați: Metselwerk este din nou planificată între 17 și 28 mai.
- Recalculați, salvați fără alte modificări și deschideți din nou fișierul IFC: vizualizarea este din nou activă, iar Metselwerk este planificată între 17 și 28 mai.
- Modificați doar numele Metselwerk în vizualizare, salvați și deschideți din nou: vizualizarea este din nou activă, iar Metselwerk este planificată între 17 și 28 mai.
- Adăugați o activitate în vizualizare, salvați și deschideți din nou: aplicația uită datele din fișier. Metselwerk se află între 10 și 21 mai, fără bară și fără bloc.
- Fundering este deja finalizată în fișier: a început efectiv pe 3 mai și s-a terminat efectiv pe 7 mai. Fișierul înregistrează data raportului de stare drept începutul cel mai devreme. Bara lui Fundering rămâne pe 3 până pe 7 mai, în vizualizare și după recalculare. Fundering nu se numără drept diferență.

## Consecințe și neînțelegeri

**O diferență nu este o eroare de import.** Aplicația calculează cu propriile reguli: cu un `.xer` și profilul de calcul *Primavera P6*, cu un `.mpp` și *Microsoft Project*, cu CSV, XML MS Project și XML Primavera P6 și *Open Planner Studio*. De ce datele din pachetul sursă au ieșit altfel poate ține de fișier sau de pachet. Vizualizarea vă arată *că* ele diferă.

**Vizualizarea nu este un rezultat de calcul.** Aplicația nu a calculat datele. Nu le luați direct drept rezultatul propriei planificări.

**Salvarea în vizualizare păstrează datele din pachetul sursă.** Fișierul IFC conține atunci ce spunea pachetul sursă, nu ce ar calcula aplicația.

**După o modificare care poate influența datele, datele din fișier nu mai revin.** Dacă ați ieșit din vizualizare printr-o asemenea modificare, vedeți calculul propriu al aplicației abia după salvare și redeschidere. Modificarea unui nume nu contează: vizualizarea rămâne atunci activă (vezi *Salvare și redeschidere*). Deschideți din nou fișierul sursă dacă doriți să vedeți datele din pachetul sursă.

## Vezi și

- [Fișiere și formate](docs://uitleg-bestanden): ce păstrează aplicația într-un fișier și ce transportă un import sau un export.
- [Deschiderea unui fișier Primavera P6 (.xer)](docs://howto-xer-openen): pașii și mesajele pentru un fișier `.xer`.
- [Deschiderea unui fișier MS Project (.mpp)](docs://howto-mpp-openen): pașii și mesajele pentru un fișier `.mpp`.
- [Refacere în urma unei căderi](docs://howto-herstellen-na-een-crash): ce se întâmplă cu acest proiect după o cădere.
- [Drum critic și marjă](docs://uitleg-kritiek-pad): cum calculează aplicația marja și criticitatea, când calculează.

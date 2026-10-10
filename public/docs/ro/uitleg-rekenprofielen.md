# Profiluri de calcul și convenții

Aceeași planificare poate produce date diferite. Asta depinde de regulile de calcul pe care le aplicați. Acest articol explică de ce Primavera P6 și Microsoft Project calculează diferit în câteva puncte. Explică și cum notează aplicația această diferență într-un **profil de calcul**. Și explică în ce se deosebește un profil de opțiunile de calcul pe care le setați dumneavoastră, pe fiecare proiect. Un exemplu practic cu o rețea mică arată ce înseamnă asta pentru date.

## Conceptul

Activitățile, dependențele și calendarul decid cea mai mare parte a planificării, dar nu totul. Ce se întâmplă cu lucrul care nu a început, când setați data raportului de stare? De unde începe lucrul rămas al unei activități care este deja în curs? Care este marja liberă a unei activități, când nu se respectă un termen limită? Rețeaua nu spune nimic despre asta. Un pachet de planificare trebuie să aleagă o regulă pentru asta. Aplicația cunoaște mai multe puncte în care regula Primavera P6 și regula Microsoft Project diferă.

Aplicația numește o asemenea alegere o **convenție de calcul**. Un **profil de calcul** este setul de convenții care aparține unui pachet. Aplicația are trei:

- *Open Planner Studio*: profilul cu care calculează un proiect nou. Nicio convenție nu este activată.
- *Primavera P6*: convențiile pe care aplicația le cunoaște din P6.
- *Microsoft Project*: convențiile pe care aplicația le cunoaște din Microsoft Project.

Profilul arată deci cum calculează un pachet. Ce doriți dumneavoastră pentru proiect nu face parte din el. Acestea sunt **opțiunile de calcul**: alegeri precum cât de puțină marjă face o activitate critică sau în ce calendar se numără un decalaj. Dumneavoastră setați aceste opțiuni pe fiecare proiect.

## Cum calculează aplicația

### Convenții și opțiuni de calcul

O convenție este un comutator: activat sau dezactivat. Profilul decide care comutatoare sunt activate. O opțiune de calcul este o alegere pe care o faceți dumneavoastră. Diferența se vede chiar în aplicație, în blocul *Profil de calcul și opțiuni de calcul*:

- **Convențiile de calcul** se află sub *Convențiile de calcul ale acestui profil*, grupate pe subiect, de exemplu *Progres și lucru finalizat*, *Dependențe și decalaj* și *Marjă și date târzii*. Fiecare rând este o casetă de bifare, cu valoarea profilului după el (*bază: activat* sau *bază: dezactivat*). Dacă alegerea dumneavoastră diferă de aceasta, rândul se evidențiază și apare *revenire la bază*. Săgeata din fața unui rând deschide explicația convenției. Citiți-o mai întâi, dacă doriți să schimbați o convenție.
- **Opțiunile de calcul** se află sub *Opțiunile de calcul ale acestui proiect*: printre altele *Definiția drumului critic*, *Calculul marjei*, *Activități cu sfârșit deschis, critice*, *Marcare activități aproape critice* și *Calendar pentru decalaj*. Ele arată ce doriți pentru acest proiect, nu cum calculează un pachet. Ce fac ele este explicat în [Drumul critic și marja](docs://uitleg-kritiek-pad) și [Dependențe și decalaj](docs://uitleg-relaties).

Un exemplu din fiecare. "O activitate este critică dacă marja ei totală este 0 sau mai mică" este o opțiune de calcul: puteți seta pragul la 4. Atunci este critic tot ce are 4 zile lucrătoare de marjă sau mai puțin. "Lucrul care nu a început se mută la data raportului de stare" este o convenție: Open Planner Studio și Primavera P6 o fac, Microsoft Project nu.

Profilul și opțiunile de calcul aparțin fișierului proiectului, nu aplicației. Dacă salvați proiectul, ele merg împreună cu el. Două proiecte din aceeași aplicație pot deci calcula cu profiluri diferite. Un proiect fără profil calculează ca Open Planner Studio.

Dacă există opțiuni de calcul pe care le cunoaște numai Primavera, blocul afișează jos și *Setări din fișierul sursă*. Asta se întâmplă pentru un proiect dintr-un .xer file, dar și dacă alegeți *Primavera P6* în *Creare proiect nou* sau aplicați opțiunile implicite ale Primavera P6. Aici nu le puteți modifica.

### Unde alegeți profilul

Pentru un proiect nou, profilul se află în fereastra *Creare proiect nou*, pe care o deschideți prin *Acasă › Fișier › Nou*. Acolo, *Profil de calcul* este o listă derulantă. Dacă alegeți acolo un profil, aplicația înlocuiește opțiunile de calcul deja completate cu valorile implicite ale profilului. Rămân doar setările din fișierul sursă. Cu *Primavera P6*, *Calculul marjei* devine atunci *Marjă de sfârșit*. Cu *Microsoft Project* și *Open Planner Studio*, fiecare opțiune de calcul are valoarea implicită, deci *Calculul marjei* este *Automat (implicit)*. Așa calculează și MS Project, când există o dată a raportului de stare: o activitate începută primește marja de sfârșit, iar fiecare altă activitate primește cea mai mică dintre marja de început și marja de sfârșit.

Pentru un proiect existent alegeți profilul sub *Setări › Proiect › Informații proiect*, în blocul *Profil de calcul și opțiuni de calcul*, în lista derulantă *Profil de calcul*. Același loc îl puteți deschide și prin *Fișier › Informații proiect*. Schimbarea profilului aici modifică doar convențiile. Opțiunile dumneavoastră de calcul rămân cum sunt. Dacă doriți și opțiunile implicite de calcul ale noului profil, alegeți *Aplicare opțiuni implicite ale acestui profil*.

Până apăsați *Aplicare*, modificarea există doar în formular. Cu *Aplicare*, aplicația recalculează planificarea imediat, chiar dacă *Calculare automată* este dezactivată. Dacă au fost mutate activități, aplicația arată câte, de exemplu *După aplicare, 4 activități au fost deplasate.* Întreaga schimbare se anulează dintr-un singur pas cu *Anulare*.

Dacă activați sau dezactivați o convenție într-un profil, aplicația îl transformă într-un profil propriu. Acesta se numește *Copie a Open Planner Studio*, sau *Copie a* profilului de la care ați pornit. Îi puteți da alt nume și îl puteți păstra cu *Salvare ca șablon*, pentru alte proiecte din această aplicație. Proiectul are întotdeauna propria lui copie: dacă modificați șablonul mai târziu, proiectul nu se schimbă odată cu el.

### Când alege aplicația singură un profil

Când deschideți un fișier, aplicația propune un profil pe baza formatului:

- Un fișier .mpp (Microsoft Project) se deschide cu profilul *Microsoft Project*.
- Un .xer file (Primavera P6) se deschide cu profilul *Primavera P6*.
- Un fișier în formatul *MS Project XML*, *Primavera P6 XML* sau *CSV (separat prin punct și virgulă)* se deschide cu *Open Planner Studio*, fără mesaj despre profil.
- Proiectul dumneavoastră (.ifc) se deschide cu profilul salvat în el.

Pentru un fișier .mpp sau .xer, aplicația anunță profilul: *Acest proiect se calculează conform profilului Microsoft Project. Modificați din Fișier → Informații proiect → Profil de calcul și opțiuni de calcul.* Butonul *Deschidere profil de calcul* din mesaj vă duce direct la Informații proiect. Pentru un .xer file, această linie este prima linie de detalii din mesajul de deschidere al fișierului. Mai multe despre mesaj găsiți în [Deschiderea unui fișier Primavera P6 (.xer)](docs://howto-xer-openen) și [Deschiderea unui fișier MS Project (.mpp)](docs://howto-mpp-openen).

Pentru un fișier .mpp aplicația stabilește doar profilul. Opțiunile de calcul rămân goale, la fel ca într-un proiect nou cu profilul *Microsoft Project*: *Calculul marjei* este *Automat (implicit)*. Un fișier .mpp deschis și un proiect nou cu *Microsoft Project* calculează deci marja în același fel.

## Exemplu practic: o rețea, trei profiluri

Exemplul este o rețea mică. Calendarul are o săptămână lucrătoare de luni până vineri și nicio zi liberă în aceste săptămâni. Modul de progres este Retained Logic (implicit). Proiectul începe luni, 7 iunie 2027. Toate activitățile sunt în zile lucrătoare.

- *Pour foundation*: 5 zile lucrătoare, planificată de luni, 7 iunie.
- *Lay walls*: 5 zile lucrătoare, după *Pour foundation* (sfârșit-început).
- *Order window frames*: 3 zile lucrătoare, fără predecesor, planificată de luni, 7 iunie.
- *Fit roof*: 2 zile lucrătoare, după *Lay walls* și după *Order window frames*. Sfârșitul acestei activități este predarea.

Cifrele au fost obținute cu motorul de calcul al aplicației. Le citiți în panoul *Proprietăți*, sub *Rezultat CPM*.

**Fără dată a raportului de stare și fără progres, cele trei profiluri calculează această rețea la fel.** *Pour foundation* se desfășoară de la luni, 7, până vineri, 11 iunie. *Lay walls* se desfășoară de la luni, 14, până vineri, 18 iunie, iar *Fit roof* luni, 21, și marți, 22 iunie. Predarea este marți, 22 iunie. *Order window frames* (de luni, 7, până miercuri, 9 iunie) are o marjă totală de 7 zile lucrătoare.

Acum înregistrați starea. Miercuri, 9 iunie, este data raportului de stare. Fundația a început luni, 7 iunie, și este finalizată în proporție de 60 %. Lucrul rămas este deci de 2 zile lucrătoare (5 × 40 %). *Order window frames* nu a început. Acel articol explică cum funcționează [progresul și data raportului de stare](docs://uitleg-voortgang). Aici întrebarea este ce face profilul cu aceasta.

### Open Planner Studio

Lucrul rămas al fundației începe la data raportului de stare: miercuri, 9, și joi, 10 iunie. Începutul cel mai devreme rămâne începutul efectiv, luni, 7 iunie. Sfârșitul cel mai devreme este joi, 10 iunie. *Lay walls* se desfășoară de la vineri, 11, până joi, 17 iunie, iar *Fit roof* vineri, 18, și luni, 21 iunie.

*Order window frames* era planificată pentru luni, 7 iunie, dar nu a început. Lucrul care nu a început nu poate fi în trecut. Deci aplicația o mută la data raportului de stare: de la miercuri, 9, până vineri, 11 iunie, cu o marjă totală de 4 zile lucrătoare. Predarea este luni, 21 iunie.

### Primavera P6

Totul este la fel ca în Open Planner Studio, cu o excepție: începutul cel mai devreme al activității *Pour foundation* este miercuri, 9 iunie. Acesta este începutul lucrului rămas, nu începutul efectiv. Asta se face prin convenția *Activitate în curs: început cel mai devreme = începutul lucrului rămas*, din grupul *Progres și lucru finalizat*. Sfârșitul și marja nu se schimbă din cauza ei. Predarea este luni, 21 iunie.

### Microsoft Project

Aici datele diferă. Două convenții din grupul *Progres ca în Microsoft Project* cauzează asta.

*Activități nepornite nu se mută la data raportului de stare*: *Order window frames* rămâne de la luni, 7, până miercuri, 9 iunie, deși această perioadă se află parțial înaintea datei raportului de stare. Marja totală este de 7 zile lucrătoare.

*Lucrul rămas se reia după timpul scurs*: lucrul rămas începe cel mai devreme la data raportului de stare și cel mai devreme la începutul efectiv plus timpul deja scurs. La 60 % din 5 zile lucrătoare, 3 zile lucrătoare sunt deja realizate. Luni, 7 iunie, plus 3 zile lucrătoare este joi, 10 iunie. Asta este după data raportului de stare, deci lucrul rămas se desfășoară joi, 10, și vineri, 11 iunie. *Lay walls* se desfășoară de la luni, 14, până vineri, 18 iunie, iar *Fit roof* luni, 21, și marți, 22 iunie. Predarea este marți, 22 iunie: cu o zi lucrătoare mai târziu decât în celelalte două profiluri.

### Ce se întâmplă dacă

**Fundația este la 20 % în loc de 60 %.** Lucrul rămas este atunci de 4 zile lucrătoare. În toate cele trei profiluri, fundația se termină luni, 14 iunie, iar predarea este miercuri, 23 iunie. Convenția Microsoft Project pentru lucrul rămas nu face aici nicio diferență: luni, 7 iunie, plus 1 zi lucrătoare scursă este marți, 8 iunie, adică înainte de data raportului de stare. O asemenea convenție este o limită inferioară, care poate doar să întârzie lucrul rămas. *Order window frames* și începutul cel mai devreme din Primavera P6 diferă în continuare, ca mai sus. În Microsoft Project, *Order window frames* are atunci o marjă totală de 8 zile lucrătoare.

**Setați doar o dată a raportului de stare, fără progres.** În Open Planner Studio și Primavera P6, întreaga rețea se mută la miercuri, 9 iunie. Fundația se desfășoară atunci de la miercuri, 9, până marți, 15 iunie, iar predarea devine joi, 24 iunie: cu două zile lucrătoare mai târziu decât fără dată a raportului de stare. În Microsoft Project, totul rămâne pe locul lui, iar predarea este marți, 22 iunie.

**Alcătuiți singur un profil.** Dacă activați doar *Activități nepornite nu se mută la data raportului de stare* în Open Planner Studio, acesta devine un profil propriu, *Copie a Open Planner Studio*. Cu progresul de 60 %, fundația păstrează atunci datele din Open Planner Studio (sfârșit joi, 10 iunie, predare luni, 21 iunie). *Order window frames* rămâne într-adevăr de la luni, 7, până miercuri, 9 iunie, cu o marjă totală de 6 zile lucrătoare. Deci un profil este un set de comutatoare separate, și le puteți schimba pe rând.

**O opțiune de calcul în locul unei convenții.** Dacă setați *Definiția drumului critic* (*Marjă totală ≤ prag*) cu *Prag (zile lucrătoare)* 4 în Open Planner Studio, *Order window frames* devine critică, pentru că marja ei totală este exact 4. Nicio dată nu se schimbă. O opțiune de calcul este alegerea dumneavoastră pentru proiect și nu depinde de profil.

**Un termen limită care nu este respectat.** Dați activității *Fit roof* un termen limită vineri, 18 iunie. În Open Planner Studio, marja totală a activității *Fit roof* este atunci de −1 zi lucrătoare, iar marja liberă este tot −1. În Primavera P6, marja totală rămâne −1, dar marja liberă devine 0. Asta face convenția *Marjă liberă niciodată negativă*, din grupul *Marjă și date târzii*. În Microsoft Project, ambele sunt −2, pentru că predarea cade acolo cu o zi mai târziu. [Restricții și termene limită](docs://uitleg-constraints) explică cum funcționează un termen limită.

## Consecințe și neînțelegeri

**"Profilul este o setare a aplicației."** Nu. Profilul și opțiunile de calcul aparțin proiectului și se află în fișier. Numai șabloanele pe care le păstrați aparțin aplicației, iar un proiect își păstrează întotdeauna propria copie.

**"Dacă exportez, profilul meu merge și el."** Numai în formatul propriu de proiect (.ifc). Dacă exportați în *MS Project XML*, *Primavera P6 XML* sau *CSV (separat prin punct și virgulă)*, profilul nu se află în fișier. Dintre opțiunile de calcul, exportul în *MS Project XML* scrie cel mult pragul critic. Aplicația avertizează despre aceasta numai pentru un proiect care provine dintr-un .xer file. Pentru un proiect creat de dumneavoastră nu primiți niciun mesaj. Fișierul se deschide apoi ca Open Planner Studio, fără un mesaj despre profil. Luați ca exemplu profilul Microsoft Project și 60 % progres. Dacă îl exportați în *MS Project XML* și îl deschideți din nou, aplicația arată mai întâi datele din fișier, cu predarea pe marți, 22 iunie. Dacă lăsați aplicația să recalculeze singură, predarea devine luni, 21 iunie. Ce mai pierde un export se află în [Fișiere și formate](docs://uitleg-bestanden).

**"Profilul Primavera P6 dă același rezultat ca P6."** Aplicația nu poate garanta asta. Profilul activează convențiile de calcul pe care aplicația le cunoaște din P6, iar acestea nu sunt toate setările din P6. Pe lângă Retained Logic și Progress Override, P6 are un al treilea mod de progres, Actual Dates. Aplicația nu îl cunoaște: un astfel de .xer file calculează ca Retained Logic, iar mesajul de deschidere anunță aceasta, de exemplu ca *1 setare de planificare P6 a folosit o revenire sigură.* Unele convenții de calcul ale profilului Primavera P6 funcționează de asemenea numai pentru activitățile care provin dintr-un .xer file, de exemplu *LOE nepornit ia fereastra țintă* și *Păstrare exactă a datelor reale*. Pentru unele dintre ele, explicația spune acest lucru: "doar activități cu proveniență P6". Pentru activitățile create de dumneavoastră, aceste convenții de calcul nu fac nimic.

**"Modul de progres face parte din profil."** Nu. Retained Logic sau Progress Override este o alegere separată, pentru fiecare proiect. Îl setați separat de profil. Consultați [Alegerea modului de progres](docs://howto-voortgangsmodus-kiezen). O convenție Primavera P6, *Progress Override ignoră un succesor început și în calculul înapoi*, face ceva numai cu Progress Override.

**"Pur și simplu schimb profilul ca să văd ce se întâmplă."** Puteți, pentru că *Aplicare* se anulează printr-un singur pas, cu *Anulare*: profilul și datele revin împreună. Dar datele se pot schimba cu adevărat. În exemplu, trecerea de la Open Planner Studio la Microsoft Project mută toate cele 4 activități. Mesajul le numără pentru dumneavoastră. Uitați-vă apoi la planificare, înainte de a continua. Dacă aplicația arată în continuare datele din fișier după deschiderea unui .xer sau .mpp, o schimbare de profil părăsește acea vizualizare, iar aplicația calculează singură. Modul în care funcționează este descris în [Datele cum au fost înregistrate](docs://uitleg-datums-zoals-opgeslagen).

**Exemplul arată patru convenții de calcul, iar lista din aplicație este mai lungă.** Fiecare rând din bloc are propria explicație. Citiți-o mai întâi. Uitați-vă și la grupul *Doar pentru profiluri proprii*: aceste convenții de calcul sunt dezactivate în fiecare profil integrat, inclusiv Primavera P6. Dacă activați una dintre ele, profilul devine un profil propriu.

## Vezi și

- [Progres, data raportului de stare și referință](docs://uitleg-voortgang): ce fac data raportului de stare și lucrul rămas, cu diferențele pe profil.
- [Alegerea modului de progres](docs://howto-voortgangsmodus-kiezen): alegerea între Retained Logic și Progress Override.
- [Drum critic și marjă](docs://uitleg-kritiek-pad): opțiunile de calcul pentru critic și marjă.
- [Dependențe și decalaj](docs://uitleg-relaties): opțiunea de calcul *Calendar pentru decalaj*.
- [Fișiere și formate](docs://uitleg-bestanden): ce duce un export și ce nu.
- [Exportul](docs://howto-exporteren): exportul unui proiect.
- [Actualizarea progresului](docs://howto-voortgang-bijwerken): introducerea procentului, a începutului efectiv și a datei raportului de stare.
- [Datele cum au fost înregistrate](docs://uitleg-datums-zoals-opgeslagen): de ce datele importate pot fi altele decât cele pe care aplicația le calculează singură.
- [Opțiuni de calcul și convenții de calcul](docs://ref-rekenopties-en-conventies): toate convențiile de calcul și opțiunile de calcul într-o singură listă.

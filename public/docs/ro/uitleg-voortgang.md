# Progres, data raportului de stare și referința

O planificare este o prognoză. Odată ce lucrarea este în desfășurare, doriți să știți ce este terminat, ce mai rămâne de făcut și ce înseamnă aceasta pentru predare. Acest articol explică modul în care aplicația procesează progresul: ce face data raportului de stare, cum calculează aplicația lucrul rămas, de ce o activitate care a început deja uneori încă așteaptă predecesorul ei și cum comparați starea curentă cu acordul inițial. Un exemplu lucrat arată cifrele.

## Conceptul

**Progresul** este ce s-a întâmplat de fapt. Pentru fiecare activitate, aplicația înregistrează trei lucruri: un procent, un **început efectiv** și un **sfârșit efectiv**. Ce a prevăzut planificarea rămâne alături de acestea; cel efectiv este ce s-a întâmplat cu adevărat.

**Data raportului de stare** este ziua în care faceți bilanțul. Tot ce s-a întâmplat înainte de această zi este un fapt. Tot ce mai trebuie făcut, aplicația îl planifică de la începutul acelei zile. O dată reală poate cădea în data raportului de stare, dar niciodată după ea.

**Lucrul rămas** este ce mai trebuie făcut la o activitate. O activitate de 4 zile lucrătoare care este finalizată în proporție de 25% are 3 zile lucrătoare de lucru rămas.

O **referință** este o copie a planificării la un anumit moment, de obicei momentul în care s-a aprobat acordul. Mai târziu, puneți planificarea curentă alături de ea și vedeți cât de mult se abate execuția.

## Cum calculează aplicația

Exemplul de mai jos folosește profilul de calcul *Open Planner Studio*, cu care calculează un proiect nou. Mai jos puteți citi ce este diferit în profilurile Primavera P6 și Microsoft Project.

Aplicația nu recalculează singură. După fiecare modificare a progresului sau a datei raportului de stare, bara de stare afișează *Învechit — recalculați (F5)*. Apăsați **Calculare** (F5), de exemplu prin *Planificare › Planificare › Calculare*. Dacă *Calculare automată* este activată (sub *Setări › Proiect › Setări*, fila *Planificare*, secțiunea *Calculare*), aplicația face asta singură.

### Data raportului de stare

Data raportului de stare face trei lucruri.

În primul rând, aplicația refuză o dată reală după data raportului de stare. O dată chiar în data raportului de stare este în regulă.

În al doilea rând, lucrul care nu a început nu poate fi în trecut. Dacă o astfel de activitate este planificată înainte de data raportului de stare, aplicația o mută în data raportului de stare. Același lucru se aplică activităților de după ea, care se mută prin dependențele lor. Efectul se vede în exemplul de mai jos. În profilul Microsoft Project, aplicația nu face asta.

În al treilea rând, lucrul rămas al unei activități care rulează deja începe chiar în data raportului de stare. Aplicația tratează data raportului de stare ca începutul acelei zile. Dacă faceți bilanțul vineri, după terminarea programului, setați deci data raportului de stare pe luni. Dacă o setați pe vineri, aplicația planifică lucrul rămas tot în acea vineri.

Dacă nu aveți încă o dată a raportului de stare și introduceți progres, aplicația setează data raportului de stare pe azi și vă anunță. Fără dată a raportului de stare, aplicația calculează o activitate în curs înainte cu durata rămasă, dar înapoi cu durata completă; marja iese atunci negativă, iar activitatea pare critică fără motiv.

### Procent de finalizare, date efective și durată rămasă

Câmpurile depind unul de altul. Dacă completați unul, aplicația completează celelalte.

- Un procent peste 0 înseamnă că activitatea a început. Dacă nu dați un început efectiv, aplicația ia începutul planificat. Dacă activitatea este planificată să înceapă după data raportului de stare, aplicația vă întreabă mai întâi când a început de fapt.
- Un procent de 100 înseamnă că activitatea este finalizată. Dacă nu dați un sfârșit efectiv, acesta devine data raportului de stare, chiar dacă lucrul s-a terminat de fapt mai devreme.
- Un sfârșit efectiv face activitatea 100%. Dacă readuceți o activitate finalizată sub 100%, sfârșitul efectiv se șterge. Dacă ștergeți sfârșitul efectiv, procentul revine la 0, iar activitatea rămâne *În curs* până când ștergeți și începutul efectiv.
- **Durata rămasă** este durata înmulțită cu ce mai trebuie făcut, rotunjită la zile lucrătoare întregi. Pentru o activitate de 2 zile lucrătoare, 0% și 25% dau amândouă 2 zile lucrătoare de lucru rămas, iar 50% și 75% dau amândouă 1. La 90% aplicația rotunjește la 0: lucrul rămas se termină atunci în data raportului de stare. O activitate exprimată în ore se numără în minute întregi: o activitate de 5 ore la 40% are 3 ore de lucru rămas.
- Un jalon are doar o singură dată reală.
- O fază (activitate rezumat) nu are progres propriu. După calcul, procentul ei urmează din activitățile de sub ea: media ponderată a procentelor lor, cu durata în zile lucrătoare ca pondere. Un jalon are pondere 0.

Dacă schimbați durata unei activități care rulează deja, lucrul deja efectuat rămâne efectuat. Procentul se ajustează: o activitate de 5 zile lucrătoare la 60%, pe care o setați la 10 zile lucrătoare, ajunge la 30%. Aplicația refuză o durată mai scurtă decât lucrul deja efectuat.

### Activități finalizate și în curs

O activitate finalizată este fixată pe datele ei reale. Nu se mai mută și, cu o dată a raportului de stare, nu este niciodată critică. Fără dată a raportului de stare, o activitate finalizată poate fi totuși critică.

O activitate în curs își păstrează începutul efectiv. Se mută doar lucrul rămas. Locul de unde începe lucrul rămas depinde de modul de progres.

### Retained Logic și Progress Override

Ce face aplicația dacă o activitate a început deja, în timp ce predecesorul ei încă rulează? O astfel de dependență se numește **progres în afara secvenței**: progresul contrazice ordinea. Gândiți-vă la zugravul care începe deja într-o cameră care a fost tencuită, în timp ce tencuitorul este încă ocupat în altă parte.

Două moduri de progres stabilesc cum calculează aplicația acest caz:

- **Retained Logic** (implicit): dependența rămâne în vigoare. Lucrul rămas al succesorului urmează dependența: cu sfârșit-început, începe doar după ce predecesorul s-a terminat și niciodată înainte de data raportului de stare.
- **Progress Override**: realitatea câștigă. Lucrul rămas al succesorului începe în data raportului de stare, fără să aștepte predecesorul.

În acest profil, diferența constă doar în lucrul rămas al activităților care au început deja, în timp ce predecesorul lor nu s-a terminat încă. Celelalte activități se calculează la fel în ambele moduri. Aplicația raportează o astfel de dependență în ambele moduri: în bara de stare ca *1 dependență(e) în afara secvenței* și în panoul *Avertismente*.

### Referințe și varianță

Când salvați, aplicația înregistrează pentru fiecare activitate fără subactivități începutul cel mai devreme, sfârșitul cel mai devreme, durata și tipul de jalon. Fazele nu sunt incluse. Ce modificați după aceea nu atinge referința. Puteți păstra mai multe referințe; exact una este **activă**. Diagrama Gantt, raportul de varianță și raportul de progres folosesc referința activă.

**Varianța** este diferența, în zile lucrătoare, dintre referință și planificarea curentă. Un plus înseamnă mai târziu, un minus mai devreme. Aplicația numără în calendarul proiectului. Raportul de varianță dă varianța de început și de sfârșit pe activitate. Statusul rezultă doar din sfârșit: *Întârziată* pentru un plus, *Devansată* pentru un minus, altfel *Conform planificării*. O activitate adăugată după referință se numește *Nouă*; o activitate care nu mai există este *Eliminată*.

Două observații. Varianța duratei se află în tabelul de activități (coloana *Varianță de durată*), nu în raportul de varianță. Ea compară durata planificată a activității acum cu cea din referință. Progresul nu schimbă această durată planificată: o activitate planificată la două zile, care a durat trei zile, are deci o varianță de sfârșit de +1, dar o varianță de durată de 0. Și dacă salvați o referință după ce ați introdus progres, aceasta înregistrează starea cu acele date reale; varianța este atunci zero.

Raportul de progres pune progresul planificat alături de progresul real. Ambele sunt ponderate cu zilele lucrătoare. Planificat este partea din fiecare activitate care ar fi trebuit să fie finalizată în data raportului de stare, conform referinței. Real este procentul introdus.

### Unde vedeți acestea

În diagrama Gantt, o linie punctată marchează data raportului de stare, cu data în antet. La fiecare activitate în curs, linia se curbează spre punctul din bară care corespunde procentului. Aceasta este **linia de progres**. Dacă dezactivați linia de progres, dar lăsați activată linia datei raportului de stare, rămâne o linie dreaptă. Dacă dezactivați pe amândouă, dispar linia și eticheta. Butoanele *Suprapunere referință*, *Linia de progres* și *Linia datei raportului de stare* se află sub *Vizualizare › Referințe și progres*. Ele nu modifică nimic în calcul. Referința apare ca o bară subțire sub fiecare bară de activitate. Tabelul de activități are coloane pentru progres și, pentru fiecare referință, pentru varianță. Pe fila *Raport* găsiți tipurile de raport *Varianță* și *Raport de progres*.

## Exemplu lucrat: extinderea după trei săptămâni

Exemplul este proiectul de exercițiu *House extension* din tutoriale, în starea după ce au fost adăugate toate dependențele: fără concediu colectiv din construcții, resurse sau ore. În tutorialul 6 faceți acest lucru singur, în proiectul de exercițiu. Acel proiect are până atunci mai multe lucruri, deci cifrele de acolo diferă. Aici citiți de ce cifrele sunt cum sunt.

Extinderea începe luni, 7 iunie 2027. Pe planificarea calculată, aplicația salvează o referință numită *Referință*: predare vineri, 6 august 2027, 45 de zile lucrătoare.

### Starea de luni, 28 iunie

Data raportului de stare este luni, 28 iunie 2027. Iată ce s-a întâmplat:

- *Start of construction*, *Set up site*, *Clear garden and paving* și *Set out the extension* sunt finalizate conform planificării, din 7 până în 10 iunie.
- *Excavate foundation trench* era planificată la 2 zile lucrătoare (vineri, 11 iunie, și luni, 14 iunie) și a durat 3: din 11 până în 15 iunie.
- *Foundation formwork and reinforcement* rulează din 16 până în 18 iunie. *Reinforcement inspection* este pe 18 iunie, *Pour foundation* pe luni, 21 iunie.
- *Foundation brickwork* (2 zile lucrătoare) a început vineri, 25 iunie, și este la 50%.

După **Calculare**, aplicația calculează astfel:

- Lucrul rămas al activității foundation brickwork este 2 × (1 − 0,5) = 1 zi lucrătoare. Începe în data raportului de stare, deci se termină luni, 28 iunie.
- *Lay hollow-core floor* urmează marți, 29 iunie. Ca urmare, *Build inner cavity leaf* începe miercuri, 30 iunie, în loc de marți, 29 iunie. Predarea vine luni, 9 august: cu o zi lucrătoare mai târziu decât referința. Ziua suplimentară de săpătură este deci întârzierea întregului proiect, pentru că acea activitate era pe drumul critic.
- Bara de stare afișează *Drum critic: 13 activități, 46 zile lucrătoare*, față de 21 de activități și 45 de zile lucrătoare înainte de introducerea progresului. Cele opt activități finalizate care erau pe drumul critic nu mai contează.
- Faza *Foundations* este la 77,8%. Activitățile din ea cântăresc 2 + 3 + 1 + 2 + 1 = 9 zile lucrătoare. Finalizate sunt 2 + 3 + 1 zile lucrătoare, plus jumătate din 2: 7 în total. Iar 7 din 9 fac 77,8%. Jalonul *Reinforcement inspection* are pondere 0.

Raportul de varianță pune aceasta alături de referință:

- *Excavate foundation trench*: început 0, sfârșit +1 (sfârșit de referință 14 iunie, acum 15 iunie).
- *Foundation brickwork*: început +1 (24 iunie a devenit 25 iunie), sfârșit +1.
- *Build outer cavity leaf*: +1, +1. Activitatea aceea nu este încă critică: avea 2 zile lucrătoare de marjă și le păstrează.
- *Handover*: +1. Sfârșitul proiectului se abate cu 1 zi lucrătoare.
- În total, 19 activități au statusul *Întârziată* și 4 au statusul *Conform planificării*; nicio activitate nu are statusul *Devansată*.

Raportul de progres arată *Planificat* 28,3% și *Real* 23,9%. Activitățile cântăresc 46 de zile lucrătoare împreună. Conform referinței, 13 ar fi trebuit să fie finalizate: 4 zile lucrătoare pentru pregătire, 2 pentru săpătură, 3 pentru armare, 1 pentru turnare, 2 pentru foundation brickwork și 1 pentru hollow-core floor. În realitate sunt finalizate 11: 4 + 2 + 3 + 1, plus jumătatea de zi a activității foundation brickwork.

### Ce se întâmplă dacă mutați data raportului de stare?

Același progres, cu altă dată a raportului de stare. Lucrul rămas al activității foundation brickwork începe mereu în data raportului de stare, deci predarea se mută cu el:

- Data raportului de stare vineri, 25 iunie: lucrul rămas cade vineri, 25 iunie. Predarea rămâne vineri, 6 august.
- Luni, 28 iunie: predare luni, 9 august.
- Marți, 29 iunie: predare marți, 10 august, cu 2 zile lucrătoare mai târziu decât referința.

### Ce se întâmplă dacă schimbați procentul de finalizare?

Activitatea foundation brickwork are 2 zile lucrătoare. La 0% sau 25% lucrul rămas este de 2 zile lucrătoare: se termină marți, 29 iunie, iar predarea devine marți, 10 august. La 50% sau 75% este de 1 zi lucrătoare: luni, 28 iunie, predare luni, 9 august. La 90% lucrul rămas este 0, iar activitatea se termină în data raportului de stare.

### Ce se întâmplă dacă setați o dată a raportului de stare fără să introduceți progres?

Dacă setați doar data raportului de stare pe luni, 28 iunie, și nu introduceți nimic, atunci conform planificării nimic nu s-a întâmplat încă. Lucrul care nu a început nu poate fi în trecut. Aplicația mută deci totul la 28 iunie: *Start of construction* este atunci în acea zi, iar predarea vine vineri, 27 august, cu 15 zile lucrătoare după referință. Introduceți deci mai întâi progresul care există.

## Exemplu lucrat: tencuitor și zugrav

Acum un exemplu pentru modul de progres. Același proiect de extindere, dar o altă stare: este miercuri, 21 iulie 2027. Totul până la *Install building services*, inclusiv, este încheiat conform planului. *Plastering* (4 zile lucrătoare) a început marți 20 iulie și are 25%. *Painting* (3 zile lucrătoare) urmează tencuirii, dar zugravul a început deja azi și are 33%.

Fără progres, tencuirea era planificată de marți 20 până vineri 23 iulie, iar zugrăvirea de luni 26 până miercuri 28 iulie. Bara de stare afișează acum *1 dependență(e) în afara secvenței*: zugrăvirea a început, deși tencuirea nu este încheiată. În panoul *Avertismente* apare: *În afara secvenței: progresul succesorului contrazice dependența*.

Lucrul rămas la tencuire: 4 × (1 − 0,25) = 3 zile lucrătoare, adică 21, 22 și 23 iulie. Lucrul rămas la zugrăvire: 3 × (1 − 0,33) = 2 zile lucrătoare.

- Cu **Retained Logic**, lucrul rămas poate începe abia după ce tencuirea este încheiată. Aceasta este vineri 23 iulie, deci zugrăvirea începe luni 26 iulie și se încheie marți 27 iulie. Bara merge de la începutul efectiv, 21 iulie, până la 27 iulie. Marja totală este de 7 zile lucrătoare.
- Cu **Progress Override**, lucrul rămas începe la data raportului de stare. Zugrăvirea se încheie joi 22 iulie, înainte ca tencuirea să fie încheiată. Marja totală este de 10 zile lucrătoare.

Predarea rămâne vineri 6 august în ambele cazuri: zugrăvirea avea oricum marjă.

### Alte profiluri de calcul

În profilurile Primavera P6 și Microsoft Project, zugrăvirea din acest exemplu se încheie la aceleași date (27 și 22 iulie). Ele se deosebesc în următoarele puncte. Acestea sunt convenții de calcul ale profilului; le găsiți sub *Setări › Proiect › Informații proiect*, în blocul *Profil de calcul și opțiuni de calcul*.

- În profilul Microsoft Project, lucrul care nu a început nu se mută la data raportului de stare (convenția de calcul *Activități nepornite nu se mută la data raportului de stare*). Dacă în exemplul de mai sus setați doar o dată a raportului de stare și nu introduceți nimic, predarea în acest profil rămâne vineri 6 august.
- În profilul Microsoft Project, lucrul rămas nu începe nici mai devreme decât începutul efectiv plus timpul scurs (convenția de calcul *Lucrul rămas se reia după timpul scurs*). Aceasta este o limită inferioară suplimentară, pe lângă data raportului de stare: contează cea mai târzie dintre cele două. Luați *Build inner cavity leaf* (5 zile lucrătoare), început marți 29 iunie, cu data raportului de stare miercuri 30 iunie și la 40% (două echipe zidesc în același timp, deci 40% este deja realizat după o zi). Tot ce precede activitatea este încheiat conform planului. Open Planner Studio și Primavera P6 lasă activitatea să se încheie vineri 2 iulie; Microsoft Project o lasă să se încheie luni 5 iulie, deoarece marți 29 iunie plus 2 zile lucrătoare scurse este joi 1 iulie, adică după data raportului de stare.
- Primavera P6 afișează ca început cel mai devreme al unei activități în curs începutul lucrului rămas, nu începutul efectiv (în exemplul stratului interior, miercuri 30 iunie).
- În profilul Primavera P6, la Progress Override, dependența față de un succesor care a început deja nu contează nici pentru predecesor: ea nu mai limitează datele târzii și marja liberă ale predecesorului (convenția de calcul *Progress Override ignoră un succesor început și în calculul înapoi*). În exemplul cu tencuitorul și zugravul nu se vede acest lucru, deoarece tencuirea este oricum critică prin șapa de egalizare: datele ei târzii și marja liberă sunt aceleași la Retained Logic și la Progress Override.
- Când deschideți un .xer file, aplicația preia modul de progres din fișier. Modul Datele reale, al treilea mod P6, nu este cunoscut aplicației; un astfel de fișier se calculează ca Retained Logic.

## Consecințe și neînțelegeri

**„Mut doar data raportului de stare înainte.”** Dacă o mutați, lucrul rămas al activităților în curs începe la noua dată, iar lucrul care nu a început încă nu poate fi niciodată înainte de această dată. Mutați deci data raportului de stare doar împreună cu înregistrarea progresului.

**„Introducerea a 100% înregistrează sfârșitul efectiv.”** Numai dacă introduceți și sfârșitul efectiv. Dacă setați o activitate la 100% fără sfârșit efectiv, sfârșitul ei devine data raportului de stare. Dacă ea s-a încheiat de fapt mai devreme, completați sfârșitul efectiv.

**„0% înseamnă nepornit.”** Dacă o activitate are un început efectiv, ea se consideră pornită, chiar și la 0%. Lucrul rămas este atunci durata întreagă și începe la data raportului de stare. Ștergeți începutul efectiv, pentru ca ea să fie din nou considerată nepornită.

**„Progress Override rezolvă avertismentul.”** Mesajul despre dependența în afara secvenței rămâne. Modul decide doar cum calculează aplicația. Dacă dependența nu mai este corectă, modificați dependența.

**„Pauza dintr-o activitate scindată dispare.”** Nu: o pauză în partea care mai este de făcut rămâne în lucrul rămas. Luați o activitate de 5 zile lucrătoare, cu o pauză de 1 zi după 2 zile lucrătoare, începută marți 29 iunie și, cu data raportului de stare miercuri 30 iunie, la 40%. Lucrul rămas de 3 zile lucrătoare începe la data raportului de stare și trece peste pauză: sfârșitul este luni 5 iulie. Fără pauză, era vineri 2 iulie.

**Ore și data raportului de stare.** Nu puteți introduce o oră în panglică: completați data raportului de stare ca dată. Dacă faceți bilanțul după orele de lucru, setați data raportului de stare la următoarea zi lucrătoare. O activitate în ore calculează lucrul rămas de la începutul zilei raportului de stare. Luați *Lay hollow-core floor* din proiectul de exercițiu, după tutorialul 4: 5 ore, luni 28 iunie, zi lucrătoare de la 07:00. Cu data raportului de stare luni 28 iunie și activitatea la 40%, are lucru rămas de 3 ore, care se desfășoară de la 07:00 până la 10:00, chiar dacă s-a lucrat deja în dimineața aceea. Modul în care aplicația numără orele este explicat în [Zilele și orele](docs://uitleg-dagen-en-uren).

**Modificarea unei referințe.** Acest lucru nu este posibil. Salvați una nouă și ștergeți-o pe cea veche. Dacă mutați proiectul, datele reale și data raportului de stare se mută odată cu el, dar referințele nu se mută în mod implicit: astfel, deplasarea rămâne vizibilă ca varianță. Vedeți [Mutarea unui proiect](docs://howto-project-verplaatsen).

## Vedeți și

- [Înregistrarea progresului](docs://howto-voortgang-bijwerken): setarea datei raportului de stare și introducerea progresului.
- [Importarea progresului dintr-o foaie de calcul](docs://howto-voortgang-importeren): citirea progresului de la personalul de pe șantier dintr-o dată.
- [Alegerea modului de progres](docs://howto-voortgangsmodus-kiezen): setarea Retained Logic sau Progress Override.
- [Salvarea și gestionarea unei referințe](docs://howto-baseline-opslaan-en-beheren): înregistrarea unei referințe și folosirea ei.
- [Mutarea unui proiect](docs://howto-project-verplaatsen): ce se întâmplă cu datele reale, cu data raportului de stare și cu referințele.
- [Drumul critic și marja](docs://uitleg-kritiek-pad): de ce o activitate este critică și ce înseamnă marja.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): progres și o dată a raportului de stare în mijlocul proiectului (20 mai 2027).

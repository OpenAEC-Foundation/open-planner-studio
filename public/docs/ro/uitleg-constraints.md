# Restricții și termene limită

Cărămizile sunt livrate abia pe 21 iunie. Autorizația nu a sosit încă. Acoperișul trebuie închis înainte de sărbătoarea de construcție. Dependențele înregistrează că o activitate așteaptă o altă activitate, dar înțelegerile despre o dată nu decurg din ordinea lucrărilor. Pentru asta sunt restricțiile și termenele limită. În acest articol citiți ce face fiecare tip, când se mută o activitate și când se modifică doar marja, ce este o fixare strictă și cum raportează aplicația un conflict.

Regulile și exemplele se aplică unui proiect nou, cu profilul de calcul *Open Planner Studio* și o săptămână de lucru de luni până vineri.

## Conceptul

O **restricție** este o limită de dată pentru o singură activitate, independentă de dependențele ei. O astfel de limită poate funcționa în două moduri:

- Ea **împinge**: activitatea nu poate începe sau să se încheie mai devreme de dată. Dacă activitatea ar începe mai devreme din cauza dependențelor, se mută la dată.
- Ea **verifică**: activitatea trebuie să înceapă sau să se încheie cel mai târziu la dată. Aplicația nu mută nimic. Dacă planificarea nu respectă data, **marja** activității și a lanțului dinaintea ei devine negativă. Marja este spațiul pe care îl are o activitate înainte ca data de sfârșit a proiectului să se mute; negativ înseamnă că, pe hârtie, sunteți deja în întârziere (vezi [Drumul critic și marja](docs://uitleg-kritiek-pad)).

Un **termen limită** este o formă mai simplă de verificare: o dată țintă pentru sfârșitul unei activități, fără ca activitatea să fie mutată de ceva.

Toate restricțiile sunt **flexibile**: calcularea continuă chiar dacă o dată nu este respectată. Există o excepție, **fixarea strictă**, care trece peste dependențe. Mai multe despre aceasta mai jos.

## Cum calculează aplicația

### Cele opt tipuri

Alegeți tipul din câmpul *Restricție* din panoul *Proprietăți*. Așa calculează fiecare tip:

- *Cât mai devreme posibil (ASAP)*: fără limită. Aceasta este opțiunea implicită: activitatea începe cât permit dependențele.
- *Cât mai târziu posibil (ALAP)*: activitatea se mută cât mai târziu posibil, fără ca un succesor să trebuiască să înceapă mai târziu. Ea consumă deci marja liberă. Dacă mai are marjă totală după aceasta, pentru că succesorii au loc propriu, rămâne necritică; dacă și aceasta este consumată, devine critică.
- *Nu începe înainte de (SNET)*: o limită inferioară pentru început. Dacă activitatea ar începe mai devreme, se mută la dată; dacă data este mai devreme decât permit dependențele, restricția nu face nimic.
- *Nu se termină mai devreme de (FNET)*: la fel, dar pentru sfârșitul activității.
- *Nu începe după (SNLT)* și *Nu se termină mai târziu de (FNLT)*: o limită superioară pentru început sau sfârșit. Ele nu mută nimic. Dacă limita nu este respectată, aplicația raportează o restricție încălcată, iar marja devine negativă.
- *Trebuie să înceapă la (MSO)* și *Trebuie să se termine la (MFO)*: o limită inferioară și una superioară deodată. Activitatea se mută la dată dacă aceasta este mai târziu decât cer dependențele. Dacă data este mai devreme decât permit dependențele, activitatea rămâne unde o pun dependențele, iar marja devine negativă.

Dacă o dată cade sâmbătă, duminică sau într-o zi liberă, aplicația o citește ca zi lucrătoare: o limită inferioară (SNET, FNET) ca următoarea zi lucrătoare, o limită superioară (SNLT, FNLT) ca ziua lucrătoare precedentă.

### Ce înseamnă marja negativă

O limită superioară funcționează invers. Dacă restricția pune data târzie a unei activități înaintea datei devreme, marja totală devine negativă. Același lucru se aplică și activităților dinaintea ei: dacă zidăria trebuie să înceapă cel mai târziu vineri 11 iunie și nu poate începe înainte de luni 14 iunie, activitățile dinaintea zidăriei sunt și ele cu o zi lucrătoare în întârziere. Toate activitățile cu marjă negativă sunt critice; modul în care funcționează aceasta este explicat în [Drumul critic și marja](docs://uitleg-kritiek-pad).

Barele nu se mută din cauza unei limite superioare. Conflictul îl vedeți în *Marjă totală* cu valoare negativă, într-un romb roșu deasupra barei, în mesajul din bara de stare (de exemplu *1 restricție(i) încălcată(e)*) și în panoul *Avertismente*.

### Fixarea strictă

Cu MSO și MFO apare caseta de bifare *Obligatoriu (logica de fixare)*. Cu această bifă fixați activitatea la dată, chiar dacă predecesorii ei nu sunt încheiați până atunci. Dependențele sunt suprascrise:

- Activitatea este la dată (cu MSO începe acolo, cu MFO se încheie acolo) și se suprapune cu predecesorii ei.
- Predecesorii primesc marjă negativă, iar aplicația raportează o restricție încălcată imediat ce dependențele ar lăsa activitatea să înceapă mai târziu decât fixarea. Activitatea fixată însăși păstrează marja 0.
- Succesorii calculează pornind de la activitatea fixată. Ei pot deci să înceapă mai devreme decât fără fixare, chiar dacă logica dinaintea ei nu este încheiată. În exemplul de mai jos, sfârșitul proiectului se mută cu trei zile lucrătoare înainte din cauza ei.

Prima dată când activați fixarea, aplicația afișează o scurtă explicație: o fixare strictă trece peste dependențe, bara este fixată la dată, chiar înaintea predecesorilor ei.

### Restricția secundară

O activitate are o singură **restricție primară**. Dacă doriți și o a doua limită, de exemplu pentru o activitate care nu poate începe înainte de 14 iunie și trebuie încheiată până la 17 iunie, adăugați o **restricție secundară**. Aceasta trebuie să fie o limită reală (SNET, FNET, SNLT sau FNLT) și să limiteze în sens opus față de cea primară: o limită inferioară (SNET sau FNET) cu o limită superioară (SNLT sau FNLT). SNET cu SNLT este deci permis, SNET cu FNET nu. Aplicația marchează cu roșu celelalte combinații, împreună cu motivul, de exemplu *Restricția primară și cea secundară nu pot limita aceeași parte.* Cu ASAP, ALAP, MSO, MFO și o fixare strictă nu este permisă o restricție secundară.

### Termenul limită

Un termen limită este o dată separată pentru o activitate, alături de restricție. Este o limită superioară pentru sfârșit: nu mută nimic, dar face marja negativă dacă activitatea nu se încheie la timp. Aplicația raportează atunci în panoul *Avertismente* *Termen limită … depășit — sfârșit cel mai devreme …*, iar bara de stare numără termenele limită depășite. În Gantt există o săgeată în jos la data termenului limită: verde atât timp cât activitatea se încheie la timp, roșie din momentul în care este în întârziere. Un termen limită sâmbătă se socotește până inclusiv vinerea dinainte.

Pentru marjă, un termen limită face același lucru ca FNLT. Deosebirea ține de felul în care îl folosiți. Un termen limită este o dată țintă pe care doriți să o verificați; el este separat de restricție, deci o activitate poate avea și restricție, și termen limită. FNLT este o restricție: o încălcare apare ca restricție încălcată, nu ca termen limită depășit.

### Ce nu face o restricție

- Pe o **fază** (activitate rezumat) restricția sau termenul limită nu contează: aplicația calculează cu activitățile din fază. Puneți-o pe activitatea însăși.
- O activitate care are deja un început efectiv sau progres își păstrează începutul. Un SNET cu o dată mai târzie nu o mută.
- **Introducerea unei date de început** la o activitate cu predecesor nu funcționează ca un început fix: predecesorul continuă să decidă. De aceea aplicația o transformă într-un SNET la data pe care ați introdus-o, în panoul *Proprietăți*, în *Editare activitate*, în tabel și când mutați bara în Gantt. Aplicația vă spune aceasta. Dacă activitatea are deja altă restricție (de exemplu ALAP sau MSO), aplicația nu aplică noul început și vă spune și aceasta; schimbați atunci acea restricție.

Toate modificările apar abia după **Calculare** (F5).

## Exemplu lucrat

Exemplul este o mică rețea pentru o extindere a unei case. Începe luni, 7 iunie 2027:

- *Groundwork* (3 zile lucrătoare): luni 7 până miercuri 9 iunie.
- *Pour foundation* (2): joi 10 și vineri 11 iunie.
- *Brickwork* (5): luni 14 până vineri 18 iunie.
- *Roofing* (3): luni 21 până miercuri 23 iunie.
- *Scaffolding* (2): urmează după *Pour foundation* și vine înainte de *Roofing*. Se desfășoară luni 14 și marți 15 iunie și are 3 zile lucrătoare de marjă.

Drumul critic este *Groundwork*, *Pour foundation*, *Brickwork* și *Roofing*. Proiectul se încheie miercuri 23 iunie. Ce se schimbă cu o restricție pe *Brickwork*?

- **SNET luni 21 iunie** (cărămizile sosesc abia atunci): *Brickwork* rulează de luni 21 până vineri 25 iunie, *Roofing* de luni 28 până miercuri 30 iunie. Proiectul se încheie miercuri 30 iunie. *Groundwork* și *Pour foundation* au acum 5 zile lucrătoare de marjă și nu mai sunt critice, *Scaffolding* are 8.
- **SNET miercuri 9 iunie**: fără efect. Dependențele îl lasă oricum pe *Brickwork* să înceapă abia luni 14 iunie.
- **SNLT miercuri 16 iunie**: fără efect. *Brickwork* începe luni 14 iunie și respectă limita fără probleme.
- **SNLT vineri 11 iunie**: prea strâns. *Brickwork* începe totuși luni 14 iunie, cu o zi lucrătoare întârziere. *Groundwork*, *Pour foundation* și *Brickwork* primesc −1 zi lucrătoare de marjă, iar aplicația raportează *Restricția Nu începe după (SNLT) 11-06-2027 este suprascrisă de logică (marjă negativă)*. Nimic nu se mută.
- **MSO miercuri 16 iunie** (fără fixare strictă): *Brickwork* se mută la miercuri 16 iunie și se încheie marți 22 iunie. *Roofing* rulează de miercuri 23 până vineri 25 iunie, proiectul se încheie vineri 25 iunie.
- **MSO vineri 11 iunie** (fără fixare strictă): data este mai devreme decât permit dependențele. *Brickwork* începe oricum luni 14 iunie, iar marja devine −1, la fel ca la SNLT.
- **MSO miercuri 9 iunie cu fixare strictă**: *Brickwork* începe miercuri 9 iunie și se încheie marți 15 iunie, în timp ce *Pour foundation* continuă până vineri 11 iunie. *Roofing* rulează de miercuri 16 până vineri 18 iunie: proiectul se încheie cu trei zile lucrătoare mai devreme decât fără fixare. *Groundwork* și *Pour foundation* primesc −3 zile lucrătoare de marjă.

Și cu o restricție sau un termen limită pe o altă activitate:

- **ALAP pe** *Scaffolding*: activitatea se mută joi 17 și vineri 18 iunie, cel mai târziu moment înaintea lui *Roofing*. *Roofing* este singurul ei succesor și avea loc exact pentru cele 3 zile lucrătoare de marjă; acestea sunt consumate acum, iar *Scaffolding* este critică.
- **SNET sâmbătă 19 iunie pe** *Scaffolding*: limita se socotește ca luni 21 iunie. *Scaffolding* rulează luni 21 și marți 22 iunie, iar *Roofing* se mută odată cu el, la miercuri 23 până vineri 25 iunie.
- **Termen limită vineri 18 iunie pe** *Roofing*: nimic nu se mută, *Roofing* rămâne de luni 21 până miercuri 23 iunie. *Groundwork*, *Pour foundation*, *Brickwork* și *Roofing* primesc −3 zile lucrătoare de marjă, iar aplicația raportează *Termen limită 18-06-2027 depășit — sfârșit cel mai devreme 23-06-2027*. *Scaffolding* păstrează 0 zile lucrătoare de marjă și devine și ea critică.
- **SNET luni 21 iunie pe** *Brickwork*, **termen limită vineri 25 iunie pe** *Roofing*: restricția împinge zidăria cu o săptămână mai târziu, iar termenul limită arată că *Roofing* este în întârziere miercuri 30 iunie. *Brickwork* și *Roofing* primesc −3 zile lucrătoare de marjă; *Groundwork* și *Pour foundation* păstrează 2 zile lucrătoare.

În tutorialul 3 stabiliți dumneavoastră o restricție și un termen limită în proiectul tutorial și vedeți cum se mută planificarea.

## Consecințe și concepții greșite

**"O restricție mută activitatea."** Doar SNET, FNET, MSO și MFO pot pune o activitate mai târziu decât cer dependențele ei, iar ALAP o poate muta mai târziu, în limita marjei libere. SNLT și FNLT nu mută niciodată nimic: ele doar avertizează. Respectarea datei înseamnă atunci să scurtați lanțul dinaintea ei.

**"Marja negativă este o eroare a aplicației."** Este semnalul că planificarea intră în conflict cu înțelegerea dumneavoastră despre date. Îl rezolvați prin scurtarea lanțului, prin relaxarea înțelegerii sau prin acceptarea conflictului în mod intenționat.

**"O fixare strictă rezolvă conflictul."** O fixare strictă ascunde conflictul: activitatea este la dată, dar predecesorii ei nu sunt pregătiți pentru ea, iar succesorii calculează ca și cum ar fi. Folosiți-o numai pentru o dată care este cu adevărat fixă, de exemplu o dată legală de predare, și nu ca mod de a pune o activitate la o dată.

**"Pur și simplu introduc o dată de început."** La o activitate cu predecesor, aceasta devine un SNET. Dacă data este mai devreme decât permite predecesorul, nu face nimic.

**"Termen limită sau FNLT?"** Alegeți un termen limită pentru o dată țintă pe care doriți să o verificați, și o restricție pentru o dată care este cu adevărat o condiție de limită pentru planificare.

**"O restricție pe fază."** Asta nu contează. Puneți-o pe activitatea însăși.

## Vezi și

- [Stabilirea unei restricții sau a unui termen limită](docs://howto-constraint-deadline-zetten): pașii pentru a stabili o restricție sau un termen limită.
- [Dependențe și decalaj](docs://uitleg-relaties): dependențele alături de care stau restricțiile.
- [Drumul critic și marja](docs://uitleg-kritiek-pad): cum apare marja negativă și ce face cu drumul critic.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): o fixare strictă (*Trebuie să înceapă la (MSO)*) pe *Municipal road closure (permitted closure period)* și o restricție secundară (*Nu începe după (SNLT)*) pe *Lift supply & installation — Tower A*.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): un termen limită care nu este respectat, cu marjă negativă.

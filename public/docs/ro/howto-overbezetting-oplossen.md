# Rezolvarea supraalocării

Scop: vedeți unde are o resursă prea mult de lucru într-o zi și rezolvați acest lucru, de obicei prin redistribuirea activităților.

## Când aveți nevoie de acest lucru

Pe hârtie, planificarea dumneavoastră funcționează. Dar zidarul lucrează la doi pereți care se execută în aceleași zile. Aplicația numește asta **supraalocare**. O resursă este supraalocată într-o zi lucrătoare dacă planificarea cere de la ea mai mult decât capacitatea ei (*Capacitate maximă*), sau dacă nu lucrează în ziua respectivă conform calendarului ei.

Mai întâi căutați supraalocarea. Apoi alegeți o soluție. **Redistribuirea** este soluția pe care aplicația o calculează pentru dumneavoastră: ea face ca activitățile să înceapă mai târziu, până când resursa poate face față. Despre modul în care se calculează, citiți în [Redistribuirea resurselor](docs://uitleg-nivelleren).

## Pași

### 1. Găsiți supraalocarea

1. Uitați-vă în panglică la *Resurse › Supraalocare*. Acolo scrie *Niciuna* sau, cu roșu, numărul de resurse supraalocate, de exemplu *1 resursă*. După un calcul, bara de stare afișează și *⚠ 1 resursă(e) supraalocată(e)*.
2. Faceți clic pe acest mesaj din bara de stare. Se deschide panoul *Avertismente* din dreapta, cu o linie pentru fiecare resursă, de exemplu *Bricklayer* cu *Supraalocare în 5 zi(le) (29-06-2027 – 05-07-2027)*.
3. Faceți clic pe acea linie. Aplicația activează histograma, alege resursa și selectează toate activitățile la care lucrează resursa.
4. Uitați-vă la histograma de sub diagrama Gantt. Barele roșii sunt zilele supraalocate. Dacă treceți cu mouse-ul peste o zi, vedeți ce activități contribuie, de exemplu *2 activități contribuie la 2027-06-30*, cu numele lor dedesubt.

Puteți activa și dumneavoastră histograma cu *Resurse › Histogramă › Histogramă*. Alegeți o resursă din lista din stânga sau parcurgeți resursele cu *Anterior* și *Următorul*. Un punct roșu din listă înseamnă că resursa este supraalocată. Rândul *Toate resursele* adună resursele, fără materiale.

Dacă este selectată o activitate, histograma arată doar încărcarea dată de acea activitate și doar resursele ei. Apăsați Esc pentru a anula selecția și a vedea din nou întregul proiect.

### 2. Alegeți o soluție

- **Mai multă capacitate.** Dacă vine cu adevărat un al doilea zidar, setați *Capacitate maximă* la 2 (vezi [Gestionarea resurselor](docs://howto-resources-beheren)). Atunci supraalocarea nu mai există.
- **Mai puține unități de atribuire pe zi.** Micșorați *Unit./zi* sau alegeți o altă curbă pentru atribuire (vezi [Atribuirea resurselor cu o curbă](docs://howto-resource-toewijzen)).
- **Puneți activitățile una după alta.** Adăugați o dependență între cele două activități, astfel încât a doua să înceapă doar după ce prima activitate s-a încheiat (vezi [Adăugarea dependențelor](docs://howto-relaties-leggen)).
- **Redistribuire.** Aplicația face ca o activitate să înceapă mai târziu.

### 3. Redistribuire

1. Asigurați-vă că planificarea a fost calculată cu **Calculare** (F5), de exemplu prin *Acasă › Planificare › Calculare*.
2. Alegeți *Resurse › Redistribuire › Nivel…*. Se deschide fereastra *Redistribuire resurse*.
3. Decideți dacă data de sfârșit a proiectului are voie să se mute. Dacă nu activați caseta *Redistribuire numai în limita marjei — data de sfârșit a proiectului rămâne fixă*, data de sfârșit se poate deplasa. Dacă o activați, aplicația mută activitățile doar în limitele marjei lor.
4. Sub *Resurse* sunt resursele care vor fi redistribuite. Implicit, toate resursele sunt bifate, cu excepția materialelor. Debifați o resursă pe care vreți s-o lăsați neschimbată.
5. Faceți clic pe *Calculare*. Cât timp calculează, apare *Se calculează…*, și puteți opri cu *Oprire*. Planificarea încă nu se schimbă: aceasta este o propunere.
6. Citiți propunerea. Sus este data de sfârșit, de exemplu *Data de sfârșit a proiectului: neschimbată (30-08-2027)* sau *Data de sfârșit a proiectului: 25-08-2027 → 30-08-2027*. Dedesubt este un tabel cu, pentru fiecare activitate, *Început vechi*, *Început nou* și *Zile deplasate*, de exemplu *Build outer cavity leaf*, 29-06-2027, 06-07-2027 și *5 d*.
7. Alegeți *Aplicare*. Aplicația scrie întârzierile în activități și recalculează planificarea imediat. Nu trebuie să apăsați F5. *Anulare* închide fereastra fără nicio modificare.
8. Verificați *Resurse › Supraalocare*. Acum scrie *Niciuna*.

Dacă modificați o opțiune din fereastră după ce ați apăsat pe *Calculare*, propunerea dispare. Apăsați atunci din nou pe *Calculare*. Dacă planificarea se modifică în timp ce aplicația calculează, apare *Planificarea s-a modificat în timpul calculului. Apăsați din nou pe Calculare.*

### Decideți ce activitate rămâne pe loc

Aplicația plasează activitățile una câte una. Activitățile care vin primele rămân unde sunt. Activitățile cu cea mai mare prioritate merg primele. La prioritate egală, merge primă activitatea cu cea mai mică marjă.

Dacă vreți să decideți singur ce activitate rămâne pe loc, dați-i o prioritate mai mare. Faceți clic dreapta pe bara activității în diagrama Gantt și alegeți *Prioritate*, apoi *Scăzută* (100), *Normală* (500) sau *Ridicată* (900). *Normală* este valoarea implicită. Puteți scrie și dumneavoastră un număr de la 0 la 1000 în coloana *Prioritate de redistribuire*: faceți clic pe **+** din dreapta antetului tabelului de activități (*Adăugare coloană*) și alegeți acea coloană sub *Planificare*. Un număr mai mare înseamnă că activitatea are mai multe șanse să rămână pe loc. Aplicația nu acceptă un număr peste 1000. O activitate cu prioritatea 1000 nu se mută niciodată din cauza capacității.

### Anulare și refacere

- *Anulare* (Ctrl+Z) inversează *Aplicare* dintr-un pas.
- *Resurse › Redistribuire › Ștergere redistribuire* elimină toată redistribuirea din activități. Butonul este gri atât timp cât nu există nicio redistribuire. Supraalocarea reapare astfel.
- Dacă ați modificat între timp planificarea, alegeți pur și simplu din nou *Nivel…*. Aplicația pornește atunci de la zero: întârzierile vechi nu contează.

## Capcane și ce face aplicația atunci

**Încă nu este calculată.** Dacă planificarea nu a fost calculată, fereastra afișează *Calculați mai întâi planificarea (F5) înainte de redistribuire.* Butonul *Calculare* nu este disponibil.

**Conflicte rămase.** Nu fiecare supraalocare se poate rezolva prin deplasare. Activitățile rămase sunt listate sub *Conflicte rămase*, cu numărul de zile și motivul:

- *Capacitate liberă insuficientă în marjă pentru a rezolva acest conflict.* Vedeți acest lucru cu *netezire*: în marja activității nu există niciun moment liber. Debifați caseta, și data de sfârșit se poate muta.
- *Resursa nu lucrează în toate zilele necesare acestei activități — deplasarea nu rezolvă acest lucru.* Resursa are zile libere în calendarul ei, în mijlocul activității. Modificați calendarul sau activitatea.
- *Bricklayer atinge la vârf 2 unit./zi, capacitatea este 1 — nu se poate rezolva prin deplasare.* Prin curba ei, activitatea singură cere într-o zi mai mult decât poate furniza resursa. Alegeți altă curbă sau micșorați unitățile de atribuire.

**Apare** *Nicio activitate nu trebuie mutată — planificarea este deja fără conflicte.* Dacă această linie apare împreună cu lista *Conflicte rămase* din propunere, credeți lista. Linia spune doar că nu există nimic de deplasat. Dacă linia apare fără listă, iar *Resurse › Supraalocare* mai indică o resursă, atunci toate activitățile care se bat cu altele sunt fixate la prioritatea 1000 sau au deja început. Ele nu se mută, iar fereastra nu le raportează ca conflict. Așadar, după aplicare, verificați întotdeauna *Supraalocare*.

**Activități care nu se deplasează.** O activitate care a început deja sau este încheiată nu se deplasează niciodată. Încărcarea ei contează totuși. Jaloanele și fazele nu se deplasează nici ele.

**Materialele nu sunt redistribuite.** Dacă o resursă de tip material cere într-o zi mai mult decât *Capacitate maximă*, ea contează ca supraalocată în *Supraalocare*, dar nu apare în fereastra de redistribuire.

**Redistribuirea nu se adaptează.** Întârzierile rămân cum au fost calculate. Dacă modificați mai târziu durata unei activități, o activitate redistribuită rămâne unde este, chiar dacă acel loc nu mai este necesar. Atunci faceți din nou redistribuirea.

**Supraalocată din cauza calendarului.** Dacă resursa nu lucrează într-o zi conform calendarului ei, panoul *Avertismente* afișează, de exemplu, *Supraalocare în 5 zi(le) (29-06-2027 – 05-07-2027), dintre care 1 zi(le) în care resursa nu lucrează conform calendarului său*. Dacă o activitate trece mereu peste o astfel de zi, adică al doilea motiv de mai sus, redistribuirea nu rezolvă acest lucru.

## Vezi și

- [Redistribuirea resurselor](docs://uitleg-nivelleren): ce deplasează redistribuirea, în marjă și dincolo de ea, și ce nu face.
- [Gestionarea resurselor](docs://howto-resources-beheren): ajustarea capacității și a calendarului unei resurse.
- [Adăugarea dependențelor](docs://howto-relaties-leggen): punerea activităților una după alta.
- [Notificări și avertismente](docs://ref-meldingen): avertismentul de supraalocare din panoul *Avertismente*.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): tencuitorii sunt supraalocați în 5 zile. Cu *Redistribuire numai în limita marjei — data de sfârșit a proiectului rămâne fixă* activată, data de sfârșit rămâne la 17 august 2027 și rămâne un conflict. Cu caseta neactivată (implicit), totul se rezolvă și data de sfârșit se mută la 24 august 2027.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): macaraua-turn este supraalocată 65 de zile, iar tencuitorii 15 zile. Redistribuirea cu caseta *Redistribuire numai în limita marjei — data de sfârșit a proiectului rămâne fixă* neactivată mută data de sfârșit de la 9 mai la 12 octombrie 2028.

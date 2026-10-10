# Adăugarea dependențelor

Obiectiv: lega activitățile între ele, astfel încât o activitate să înceapă abia când lucrarea dinaintea ei este terminată, și să adauge un timp de așteptare (decalaj) între ele, acolo unde este nevoie.

## Când aveți nevoie de aceasta

Fără dependențe, aplicația nu știe că zidarul poate începe abia după ce a fost turnată fundația. Fiecare activitate începe atunci la începutul proiectului, iar data de sfârșit nu înseamnă nimic. O **dependență** înregistrează această ordine. Prima activitate este **predecesorul**, a doua **succesorul**.

Adăugați dependențe când construiți o planificare, când se adaugă o activitate sau când două lucrări se dovedesc, până la urmă, dependente una de alta. Un **decalaj** este timp de așteptare între două activități, de exemplu beton care trebuie să se întărească sau șapă de pardoseală care trebuie să se usuce.

Dependența implicită este **FS** (sfârșit-început): succesorul poate începe abia când predecesorul este terminat. Aplicația cunoaște și SS, FF și SF, care leagă un început sau un sfârșit de un început sau un sfârșit; de exemplu, cu SS (început-început), tencuiala poate începe abia când au început instalațiile.

Nu știți sigur ce tip vă trebuie? Sub alegerea tipului, o propoziție cu numele reale ale activităților explică tipul, de exemplu *Metselwerk poate începe abia când se termină Fundering.* Alegeți alt tip și propoziția se schimbă odată cu el. O vedeți în fereastra *Tip de dependență*, în blocul *Dependențe* și în coloana *Predecesori* sau *Succesori*.

## Pași

Există patru moduri de a adăuga o dependență. Toate creează aceeași dependență; alegeți modul care se potrivește cel mai bine situației dumneavoastră.

### Legarea a două activități selectate

Util când lucrați în tabelul de activități.

1. În tabelul de activități, faceți clic pe activitatea care vine prima: predecesorul.
2. Țineți apăsat Ctrl (⌘ pe Mac) și faceți clic pe activitatea care urmează: succesorul.
3. Alegeți *Acasă › Activități › Dependență ▾ › Legare activități selectate*. Același buton se află și în *Planificare › Dependențe*.

Aplicația creează o dependență sfârșit-început fără decalaj și afișează, de exemplu, *Dependență creată: Foundation brickwork → Lay hollow-core floor*. Butonul funcționează doar dacă sunt selectate exact două activități.

### Trasarea unei dependențe în Gantt

Util când adăugați mai multe dependențe una după alta.

1. Alegeți *Acasă › Activități › Dependență ▾ › Trasare dependență*. Deasupra graficului Gantt apare mesajul *Mod de dependență: trageți în Gantt de la o bară la alta pentru a crea o dependență. Apăsați Esc pentru a opri.*
2. Apăsați pe bara de la predecesor și trageți până la bara de la succesor. O linie întreruptă cu o săgeată vă urmărește.
3. Eliberați butonul mouse-ului. Apare o fereastră mică *Tip de dependență*, cu tipul (implicit FS) și un câmp pentru decalaj.
4. Dacă este nevoie, modificați tipul sau decalajul și apăsați Enter, sau faceți clic în afara ferestrei. Dependența este creată.
5. Adăugați imediat următoarea: modul rămâne activ. Opriți cu Esc, cu butonul *Oprire* din mesaj, sau alegând din nou *Trasare dependență*.

Dacă apăsați Esc în fereastra *Tip de dependență*, nu se înregistrează nimic. Pentru o singură dependență nu trebuie să activați modul: țineți apăsat Shift în timp ce trageți de la o bară la alta. *Creare dependență de aici* din meniul de clic dreapta al unei bare activează modul de dependență; tragerea o faceți tot dumneavoastră. Pe fila *Tabel*, fără Gantt, *Trasare dependență* este dezactivată.

### Adăugarea unei dependențe în panoul de proprietăți

Util când vă uitați la o singură activitate și doriți să adăugați predecesorii sau succesorii ei.

1. Selectați activitatea. Panoul *Proprietăți* se află în dreapta; dacă nu îl vedeți, activați-l cu *Vizualizare › Panouri › Proprietăți*.
2. În blocul *Dependențe*, faceți clic pe *Adăugare dependență*.
3. Lăsați direcția pe *Predecesor* dacă cealaltă activitate vine prima, sau alegeți *Succesor*.
4. Scrieți o parte din numele celeilalte activități. Alegeți activitatea corectă cu tastele săgeată și Enter, sau faceți clic pe ea.
5. Alegeți tipul (implicit FS) și completați decalajul, dacă este nevoie.
6. Apăsați Enter sau faceți clic pe bifa (*Creare dependență*).

Dependențele apar apoi în *Dependențe*, fiecare cu numărul WBS al celeilalte activități, tipul și decalajul.

### Scrierea dependențelor în coloana Predecesori

Util când lucrați rapid cu tastatura și cunoașteți numerele WBS.

1. Faceți clic pe **+** din dreapta antetului din tabelul de activități (*Adăugare coloană*) și, sub *Dependențe*, alegeți coloana *Predecesori*. Coloana *Succesori* funcționează la fel.
2. În coloana *Predecesori*, faceți clic pe celula succesorului.
3. Scrieți numărul WBS al unui predecesor, un spațiu și tipul, de exemplu `2.6 FS`. Adăugați decalajul imediat după el: `2.6 FS+1d`. Separați mai mulți predecesori cu punct și virgulă sau cu virgulă: `3.1 FS; 3.2 SS+2d`.
4. Apăsați Enter.

Ce scrieți înlocuiește toată celula. Dacă există deja predecesori în ea, scrieți-i și pe aceștia (vezi Capcane și ce face aplicația). Dacă apăsați Enter sau F2 în celulă în loc să scrieți, se deschide un câmp care păstrează dependențele existente: căutați o activitate după numărul WBS sau după nume și alegeți tipul și decalajul pentru fiecare dependență.

### Stabilirea sau modificarea decalajului

Scrieți decalajul în câmpul de lângă tip, indiferent de modul de mai sus. Modificați un decalaj existent în *Dependențe*: faceți clic în câmpul decalajului, scrieți noua valoare și apăsați Enter.

- `3` sau `3d`: 3 zile lucrătoare. Weekendul nu se numără. Aplicația afișează `+3d`.
- `3ed`: 3 zile calendaristice. Weekendul se numără, ca la betonul care se întărește și sâmbăta și duminica.
- `-1`: un decalaj negativ (devans). Succesorul poate începe cu o zi mai devreme, astfel încât activitățile se suprapun.
- `4h`: 4 ore de lucru; aplicația îl afișează ca `+4u`. Dacă predecesorul este o activitate pe zile, pe un calendar fără intervale proprii de timp de lucru, cum este calendarul standard, aplicația convertește decalajul în zile lucrătoare întregi, rotunjit la cea mai apropiată zi: `4h` devine atunci 1 zi, `2h` devine 0. Pe un calendar cu intervale proprii de timp de lucru, sau după o activitate pe ore, decalajul se numără exact în ore.
- `50%`: jumătate din durata predecesorului.

Exemplu: betonul fundației trebuie să se întărească înainte ca zidarul să poată lucra pe el, deci *Pour foundation → Foundation brickwork* primește o dependență FS cu decalajul `3`. Dacă turnarea este vineri, 18 iunie 2027, zidăria începe după **Calculare** joi, 24 iunie: de luni până miercuri este timp de așteptare. Cu `3ed`, weekendul se numără și zidăria începe marți, 22 iunie.

### La final: recalculați

O dependență nouă nu mută încă nicio bară; bara de stare afișează *Învechit — recalculați (F5)*. Apăsați **Calculare** (F5), de exemplu prin *Acasă › Planificare › Calculare*. Abia atunci succesorii primesc noile date. Dacă doriți ca aplicația să facă aceasta în locul dumneavoastră, activați *Calculare automată* din *Setări › Proiect › Setări*, fila *Planificare*.

## Capcane și ce face aplicația

**Ordine inversată.** La *Legare activități selectate* contează ordinea în care faceți clic, nu ordinea din listă. Dacă faceți clic întâi pe activitatea care vine mai târziu, dependența este în sens invers. Ștergeți-o din *Dependențe* cu pictograma coșului de gunoi și adăugați-o din nou.

**Scrierea în coloană șterge ce era acolo.** Dacă celula conține `3.4 FS; 3.2 FS` și scrieți numai `3.2 FS`, dependența cu 3.4 dispare, fără niciun mesaj. Scrieți toți predecesorii, folosiți Enter sau F2 pentru a adăuga la ei, sau anulați cu Ctrl+Z.

**Ciclu.** Dacă adăugați o dependență care duce înapoi la o activitate aflată mai devreme în lanț, planificarea nu ar putea începe niciodată. Aplicația refuză o astfel de dependență: *Această dependență ar crea un ciclu în planificare (…) și nu a fost creată*, cu activitățile ciclului între paranteze. Mai întâi ștergeți dependența care închide ciclul.

**Activitate și propria fază.** O dependență între o activitate și activitatea rezumat în care se află nu este posibilă. Aplicația afișează *O dependență între o activitate și propria activitate rezumat părinte sau strămoș nu este permisă.*

**Duplicat.** Dacă dependența există deja, aplicația afișează *Această dependență există deja* și nu se modifică nimic.

**Mesaje mai scurte în coloană.** Coloana *Predecesori* dă aceleași refuzuri, cu un text mai scurt sub celulă: *Această modificare ar crea un ciclu în planificare.*, *Această dependență există deja.* sau *O activitate nu poate avea o dependență cu propria activitate rezumat.* Dacă scrieți numai un număr WBS, de exemplu `3.1`, lipsește tipul, iar celula afișează *Utilizați, de exemplu, 1.2 FS+2d.* Celula rămâne deschisă; corectați intrarea sau apăsați Esc pentru a anula.

**Niciun decalaj cu jumătăți de zi.** Un decalaj în zile este întotdeauna un număr întreg: `1.5` devine `+2d`, iar un decalaj în ore după o activitate pe zile, pe un calendar fără intervale proprii de timp de lucru, se rotunjește la zile lucrătoare întregi. Intrarea ilizibilă, de exemplu un cuvânt, nu se salvează: câmpul revine la valoarea anterioară.

## Vezi și

- [Drum critic și marjă](docs://uitleg-kritiek-pad): ce calculează aplicația din dependențele dumneavoastră și de ce o activitate devine critică.
- [Dependențe și decalaj](docs://uitleg-relaties): ce fac cele patru tipuri de dependență și un decalaj asupra datelor.
- [Urmărirea unui drum](docs://howto-pad-traceren): afișarea lanțului de predecesori și succesori.
- [Dialogul pentru activitate și panoul de proprietăți](docs://ref-taak-eigenschappen): câmpurile pentru dependențe și decalaj din panou și din dialog.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): un lanț de dependențe sfârșit-început, cu una început-început (pereți și acoperiș, decalaj de 2 zile) și una sfârșit-sfârșit (placaje și vopsire, decalaj de 1 zi).

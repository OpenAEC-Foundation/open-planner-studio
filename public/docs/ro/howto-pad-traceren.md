# Urmărirea traseului

Scop: să faceți vizibil lanțul de activități dinaintea sau de după o activitate. Astfel vedeți ce fixează o activitate la data ei și ce se mută dacă întârzie.

## Când aveți nevoie de aceasta

Acoperișul începe abia peste trei săptămâni și vreți să știți ce activitate decide asta. Sau zidarul întârzie o săptămână și vreți să vedeți ce activități de după el se mută. Într-o planificare cu zeci de dependențe nu puteți vedea asta din linii. Cu **urmărire traseu**, aplicația colorează toți **predecesori** (activități care vin înainte de activitatea aleasă, direct sau prin alte activități) și **succesori** (activități care vin după ea) și estompează restul.

## Pași

1. Selectați activitatea al cărei traseu doriți să-l vedeți, în tabelul de activități sau pe bara ei din Gantt. Dacă selectați mai multe activități, aplicația urmărește traseul de la activitatea selectată prima.
2. Alegeți *Planificare › Urmărire traseu › Predecesori* pentru tot ce vine înainte de activitate, sau *Planificare › Urmărire traseu › Succesori* pentru tot ce vine după ea. Ambele butoane pot fi active în același timp. Aceleași două butoane sunt pe fila *Tabel*, în grupul *Urmărire traseu*.
3. Dacă doriți ambele direcții deodată, faceți clic dreapta pe activitate, în Gantt sau în tabelul de activități, și alegeți *Urmărire traseu*.
4. Uitați-vă la rezultat în Gantt și în tabelul de activități. Cum se citește, este explicat mai jos.
5. Opriți urmărirea făcând clic din nou pe butonul activ, făcând clic dreapta pe o activitate și alegând *Oprire urmărire traseu*, sau apăsând Esc. Esc șterge și selecția.

Dacă selectați altă activitate în timpul urmăririi, traseul urmează noua selecție.

## Cum citiți rezultatul

- Predecesorii sunt aurii, iar succesorii sunt violet. În Gantt, barele își schimbă culoarea. În tabelul de activități apare o dungă în stânga rândului: continuă pentru predecesori, întreruptă pentru succesori. Activitatea aleasă are un contur.
- O culoare mai închisă, iar în tabelul de activități o dungă mai groasă cu text îngroșat, marchează lanțul de **legături determinante**, adică dependențele care fixează de fapt datele. Ce înseamnă asta este explicat în [Dependențe și decalaj](docs://uitleg-relaties).
- Toate activitățile în afara traseului sunt estompate. Liniile de dependență care nu aparțin traseului sunt mai slabe și punctate.

## Capcane și ce face aplicația

**Nicio activitate selectată.** Fără o activitate selectată nu există nimic de urmărit: butonul este activ, dar pe ecran nu se schimbă nimic. Selectați mai întâi o activitate.

**Nicio evidențiere a lanțului de legături determinante.** Evidențierea vine din ultimul calcul. Dacă planificarea nu a fost calculată încă, sau dacă la calcul apare o eroare, aplicația colorează toți predecesorii și succesorii la fel de puternic. Apăsați **Calculare** (F5), de exemplu din *Acasă › Planificare › Calculare*, și uitați-vă din nou la traseu. După o modificare, evidențierea rămâne la calculul anterior cât timp bara de stare afișează *Învechit — recalculați (F5)*.

**O dependență pe o fază.** Urmărirea urmează dependențele așa cum le-ați stabilit. O dependență de la sau către o fază (activitate rezumat) leagă chiar faza. Pentru calcul se aplică fiecărei activități din fază, dar traseul nu continuă către activitățile din interiorul ei. Dacă urmăriți o activitate din interiorul unei faze care este legată de altă activitate printr-o dependență pe fază însăși, nu vedeți acea dependență. În acest caz selectați chiar faza.

**Doar direcția aleasă.** Dacă este activ doar *Predecesori*, nu vedeți ce vine după activitate, și invers.

## Vezi și

- [Dependențe și decalaj](docs://uitleg-relaties): de ce o dependență este o legătură determinantă și cum calculează aplicația data de început a unei activități.
- [Drum critic și marjă](docs://uitleg-kritiek-pad): ce lanț fixează sfârșitul proiectului.
- [Adăugarea dependențelor](docs://howto-relaties-leggen): adăugați o dependență dacă vă lipsește o legătură din traseu.

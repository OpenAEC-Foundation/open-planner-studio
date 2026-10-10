# Exportare

Scop: predați planificarea dumneavoastră ca fișier într-un alt format, pentru cineva care nu citește IFC sau pentru un alt pachet software.

## Când aveți nevoie de aceasta

Consultantul lucrează în MS Project, clientul în Primavera, subantreprenorul dorește activitățile în Excel, sau trimiteți dumneavoastră o planificare unui pachet software care nu poate citi IFC. Un export este o copie într-un alt format. Dacă doriți să păstrați chiar proiectul, salvați-l: așa se scrie IFC și se păstrează tot. Ce păstrează fiecare format și ce nu păstrează este descris în [Fișiere și formate](docs://uitleg-bestanden).

## Pași

1. Alegeți *Acasă › Fișier › Exportare* și selectați un format din listă, sau alegeți *Fișier › Exportare*. Acolo fiecare format este un card cu o scurtă descriere.
2. În fereastră alegeți un nume și un loc. Aplicația propune numele proiectului, cu extensia formatului. Foile de progres se numesc *projectname-voortgang* și se deschid în folderul de descărcări, dacă este posibil.
3. Confirmați. Nu apare niciun mesaj dacă exportul reușește, în afară de mesajele de mai jos. Din *Fișier › Exportare* reveniți după aceea la fila *Acasă*, chiar dacă anulați fereastra. Dacă anulați fereastra pentru un export din lista de pe fila *Acasă*, nu se întâmplă nimic.

Dacă browserul dumneavoastră salvează doar printr-o descărcare (de exemplu Firefox), fișierul se află în folderul de descărcări imediat după pasul 1. Vedeți mesajul *Salvat ca descărcare: „name.xml” se află acum în folderul de descărcări. Acest mediu nu permite aplicației să scrie direct în locația aleasă.*

### Ce format alegeți?

Lista de pe fila *Acasă* și cardurile din *Fișier › Exportare* oferă aceleași formate:

- *Progres (Excel)* și *Progres (CSV)*, pe cardurile *Foaie de progres (Excel)* și *Foaie de progres (CSV)*: o foaie simplă cu id, WBS, nume, date și procent de finalizare, pe care o trimiteți celor care completează progresul.
- *CSV (;)*, pe cardul *CSV (separat prin punct și virgulă)*: un tabel de activități pe care îl deschideți într-o foaie de calcul.
- *MS Project XML*: se poate deschide în Microsoft Project.
- *Primavera P6 XML*: pentru Oracle Primavera P6.
- *IFC 4x3*: formatul propriu al aplicației, cu tot ce conține.

### Un export IFC cu un fișier de bibliotecă

Dacă proiectul dumneavoastră este legat de o bibliotecă de resurse, caseta *Salvare fișier bibliotecă alături* se află sub cardurile din *Fișier › Exportare*. Dacă o bifați și alegeți *IFC 4x3*, aplicația cere un loc de două ori: întâi pentru proiect, apoi pentru *projectname-bibliotheek.ifc*. Această casetă este doar în *Fișier › Exportare*, nu în lista de pe fila *Acasă*.

### Reîncărcarea unei foi de progres

Reîncărcați o foaie de progres completată prin *Fișier › Importare*. Vedeți [Importarea progresului dintr-o foaie de calcul](docs://howto-voortgang-importeren).

## Capcane și ce face aplicația atunci

**Proiectul dumneavoastră nu se modifică.** Fișierul proiectului rămâne același, iar marcajul *Nesalvat* rămâne dacă era acolo.

**Planificarea învechită se recalculează mai întâi.** Astfel primiți datele actuale, chiar dacă ați uitat să apăsați *Calculare*.

**Un export apare și în Recente.** Acest lucru nu se aplică foilor de progres. Dacă deschideți acolo un export, se deschide ca import al acelui format.

**Un export nu păstrează totul.** Un fișier CSV nu are resurse sau restricții, P6 XML nu are referințe și termene limită. Nici profilul de calcul nu se păstrează: un export redeschis se calculează ca *Open Planner Studio*. Doar IFC păstrează totul. Găsiți un exemplu cu cifre în [Fișiere și formate](docs://uitleg-bestanden).

**Două formate cu aceeași extensie.** MS Project XML și Primavera P6 XML primesc amândouă numele *projectname.xml*. Dați-le singuri nume diferite, altfel nu veți ști mai târziu ce fișier are ce format.

**O planificare cu o dependență circulară nu se exportă.** Aplicația calculează întâi și se oprește dacă există o buclă. Pe fila *Acasă* primiți mesajul *Planificarea nu a putut fi calculată*, iar dedesubt, de exemplu, *Dependență circulară între activități: Set up site → Demolish existing extension → Set up site*. În *Fișier › Exportare* apare pe pagină doar al doilea text. Eliminați bucla și exportați din nou.

**Un proiect din Primavera pierde informațiile sursă.** Dacă exportați un astfel de proiect în CSV, MS Project XML sau P6 XML, aplicația afișează: *La exportul în CSV se pierd informațiile sursă din XER.* Pentru MS Project XML apare *MSPDI*, pentru P6 XML apare *P6*. Vedeți [Deschiderea unui fișier Primavera P6 (.xer)](docs://howto-xer-openen).

**Activitățile scindate își pierd scindările.** MS Project și Primavera cunosc o scindare doar ca distribuție a orelor. Dacă proiectul dumneavoastră conține activități scindate fără distribuție a orelor, aplicația afișează după un export în MS Project XML sau P6 XML: *2 activități cu întreruperi au fost exportate fără întreruperile lor: MS Project și P6 cunosc întreruperile doar ca distribuție a lucrului.* Pentru o singură activitate apare *1 activitate cu întreruperi a fost exportată fără întreruperile ei: MS Project și P6 cunosc întreruperile doar ca distribuție a lucrului.* Vedeți [Scindarea unei activități](docs://howto-taak-splitsen).

**O planificare în vizualizarea *Datele înregistrate*.** Dacă exportați în CSV cât timp vedeți datele din fișierul sursă, aplicația lasă goale `Critical` și `Total Float` pentru activitățile pentru care fișierul sursă nu a înregistrat acest lucru. Vedeți [Datele înregistrate](docs://uitleg-datums-zoals-opgeslagen).

## Vezi și

- [Fișiere și formate](docs://uitleg-bestanden): ce păstrează fiecare format și ce nu.
- [Deschiderea și salvarea unui fișier](docs://howto-bestand-openen-en-opslaan): păstrarea proiectului ca IFC.
- [Importarea progresului dintr-o foaie de calcul](docs://howto-voortgang-importeren): citirea unei foi de progres completate.
- [Formate de import și export](docs://ref-import-exportformaten): pentru fiecare format, ce se păstrează și ce nu.

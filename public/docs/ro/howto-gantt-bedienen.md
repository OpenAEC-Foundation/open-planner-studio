# Tragerea, derularea și zoom-ul în Gantt

Scop: utilizați linia de timp cu mouse-ul: mutați o bară sau modificați durata ei, deplasați linia de timp, selectați activități cu un cadru de selecție și măriți sau micșorați.

## Când aveți nevoie de asta

Vedeți în Gantt că zidăria trebuie să înceapă cu două zile mai târziu sau că turnarea durează o zi mai mult. Doriți să faceți asta direct pe bară. Sau aveți un proiect de câteva luni și vreți să derulați rapid până la sărbătoarea de șantier. Mouse-ul are câteva gesturi pentru asta. Ce gest face ce depinde de locul de unde începeți tragerea și de setarea de derulare.

## Pași

### Mutarea unei bare

1. Apăsați pe mijlocul unei bare a activității și trageți orizontal. Începutul și sfârșitul se mută împreună, în zile întregi. Durata rămâne aceeași.
2. Eliberați butonul. Bara rămâne la noul loc. Planificarea nu mai este actualizată: apăsați *Calculare* (F5) sau lăsați aplicația să o facă singură, dacă este activată *Calculare automată*.

Dacă activitatea are un predecesor, aplicația înregistrează noul început ca restricție *Nu începe înainte de (SNET)* și spune asta după ce eliberați butonul. Motivul și ce se întâmplă cu o altă restricție sunt descrise în [Restricții și termene limită](docs://uitleg-constraints). Dacă trageți înapoi la începutul inițial, revine și restricția inițială.

Dacă trageți mai ales în sus sau în jos, nu lateral, mutați activitatea pe alt rând, iar datele rămân. Direcția pe care o alegeți în primii câțiva pixeli se aplică la toată tragerea. Astfel, un singur gest nu modifică niciodată datele și structura în același timp. Consultați [Modificarea structurii](docs://howto-structuur-aanpassen).

### Modificarea duratei

1. Mutați mouse-ul pe marginea dreaptă a barei. Cursorul devine o săgeată care arată spre stânga și spre dreapta.
2. Trageți de margine. În timpul tragerii, o pastilă mică în culoarea de accent a temei (portocalie în mod implicit) arată durata pe care ar avea-o activitatea acum, de exemplu *4d*. Pastila se actualizează în timp real, deci vedeți noua durată înainte de a elibera butonul. La marginea dreaptă, pastila este în interiorul barei. La marginea stângă, pastila este chiar în stânga ei. Pastila arată durata în același mod ca în coloana duratei.
3. Eliberați butonul. Durata este cea arătată de pastilă.

Marginea stângă mută începutul și lasă sfârșitul neschimbat, deci activitatea devine mai scurtă sau mai lungă în față. Aceeași regulă SNET se aplică ca la mutare. Când trageți de mijlocul barei, pastila nu apare: durata nu se modifică.

Durata numără zilele lucrătoare din calendarul activității. Weekendurile și zilele libere nu se numără. O activitate pe zile nu poate deveni mai scurtă decât o zi lucrătoare. Pentru o activitate pe ore, aplicația rotunjește la pasul liniei de timp de sub mouse: cel puțin o oră, sau un sfert de oră dacă măriți suficient și este activată *Afișare sferturi de oră la zoom mare*.

O tragere este un singur pas în *Anulare*, indiferent cât trageți. La o bară a unei activități scindate, marginile funcționează altfel. Consultați [Scindarea unei activități](docs://howto-taak-splitsen).

### Deplasarea liniei de timp

Ce face o tragere pe fundalul gol depinde de modul de derulare. Îl alegeți în *Setări*, fila *Afișare*, sub *Gantt › Derulare și zoom*, la *Mod*:

- **Zoom + tragere** (implicit): dacă trageți pe fundalul gol cu butonul stâng al mouse-ului, linia de timp se mișcă împreună cu mouse-ul, ca pe o hartă. Cursorul este o mână. Pe o bară, tragerea pornește un gest pe bară.
- **Poziție** și **Taste**: aceeași tragere face un cadru de selecție. Deplasați linia de timp cu rotița (consultați [Setări](docs://ref-instellingen)) sau cu butonul din mijloc al mouse-ului.

**Butonul din mijloc al mouse-ului** (rotița apăsată) deplasează linia de timp în fiecare mod, și dacă începeți pe o bară. Nu funcționează cât timp este în desfășurare alt gest, de exemplu tragerea unei bare.

### Selectarea activităților cu un cadru de selecție

Un cadru de selecție selectează toate activitățile din rândurile pe care le atinge. Contează numai înălțimea cadrului, nu axa timpului.

1. Începeți pe fundalul gol. Cu *Zoom + tragere* țineți apăsată tasta Ctrl (⌘ pe Mac) în timp ce faceți asta. Cu *Poziție* și *Taste* nu este necesar.
2. Trageți peste rândurile pe care vreți să le selectați. Selecția primește un contur.
3. Eliberați butonul. Cu Esc în timpul tragerii anulați cadrul, iar selecția rămâne cum era.

Mai multe despre selectare: [Selectarea, ștergerea și anularea activităților](docs://howto-taken-selecteren-verwijderen). Pe spațiul gol din tabelul de activități, tragerea nu face nimic.

### Mărirea și micșorarea

1. Folosiți *Zoom +* și *Zoom -* (*Început › Zoom*) sau tastele + și -. Rotița face zoom și ea. În ce condiții, depinde de modul de derulare (consultați [Setări](docs://ref-instellingen)).
2. Dacă vreți să vedeți tot proiectul, alegeți *Vizualizare › Scară de timp › Potrivire la proiect* sau apăsați Ctrl+0. *Resetare* (pe fila *Vizualizare*) sau tasta 0 readuce zoom-ul la valoarea implicită.
3. În colțul din dreapta jos, în bara de stare, vedeți zoom-ul în pixeli pe zi, de exemplu *Zoom: 15 px/zi*.

Cu cât micșorați mai mult, cu atât sunt mai puține linii de grilă. La 8 pixeli pe zi sau mai mult există o linie pentru fiecare zi, cu o linie mai groasă la limita săptămânii. Între 2 și 8 pixeli pe zi rămâne doar limita săptămânii. Sub 2 pixeli pe zi, la nivel de an, rămân doar limitele lunilor. În caz contrar, canvasul ar deveni un model uniform de dungi, în care barele dispar. Weekendurile gri și zilele libere, precum și benzile de săptămână colorate alternativ, rămân la orice nivel. Ele păstrează structura săptămânilor când liniile dispar. În antetul liniei de timp, numerele săptămânilor și ale zilelor apar doar când este loc pentru ele. De la 40 de pixeli pe zi, ziua din săptămână se afișează și înaintea numărului zilei.

## Capcane și ce face aplicația atunci

**Începutul nu se mută.** Dacă activitatea are un predecesor și o altă restricție decât SNET, de exemplu *Cât mai târziu posibil (ALAP)*, aplicația nu aplică noul început. După ce eliberați butonul, aplicația arată ce restricție ține începutul pe loc. Modificați acea restricție ca să mutați începutul. Marginea dreaptă funcționează, pentru că modifică numai durata.

**Gestul face altceva.** În modul de dependență și în modul de scindare, gesturile pe bară funcționează altfel. Esc oprește aceste moduri. Dacă țineți apăsat Shift când trageți de la o bară, creați o dependență în loc să mutați bara. Consultați [Adăugarea dependențelor](docs://howto-relaties-leggen).

**În modul Poziție sau Taste, butonul stâng al mouse-ului nu derulează.** Atunci vedeți un cursor normal în loc de o mână. Folosiți rotița sau butonul din mijloc al mouse-ului, sau setați modul pe *Zoom + tragere*.

**Un clic într-o pauză a unei bare scindate** selectează activitatea și nu pornește nicio tragere și niciun cadru de selecție.

## Vezi și

- [Meniurile cu clic dreapta](docs://ref-contextmenus): meniurile de pe o bară, de pe un rând și de pe antetul unui grup.
- [Scurtăturile de la tastatură](docs://ref-sneltoetsen): tastele pentru zoom și pentru anularea unui gest.
- [Setări](docs://ref-instellingen): modul de derulare și axa timpului.
- [Restricții și termene limită](docs://uitleg-constraints): de ce un început mutat devine o restricție.

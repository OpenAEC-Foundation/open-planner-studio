# Lucrul cu mai multe proiecte în același timp

Scop: avea mai multe planificări deschise, a comuta între ele și a le închide separat.

## Când aveți nevoie de asta

Lucrați la ansamblul rezidențial din cartier, dar și ședința de șantier privește renovarea clubului. Sau doriți să păstrați o variantă lângă original. Fiecare proiect este în propria filă, cu propriile activități, calcul și fereastră de timp. Comutarea se face dintr-un clic, iar nu pierdeți nimic.

## Pași

### Deschiderea unui al doilea proiect

1. Faceți clic pe semnul plus din dreapta filelor (*Pornire proiect*). Se deschide fereastra *Pornire proiect*.
2. Alegeți *Proiect nou* pentru o planificare goală, sau *Deschidere proiect existent* pentru a selecta un fișier. *Anulare* închide fereastra.
3. Pentru *Proiect nou*, completați fereastra *Creare proiect nou* și faceți clic pe *Creare*.

Proiectul apare în propria filă și este activ imediat. *Nou* și *Deschidere* din panglică, Ctrl+O și exemplele din *Fișier › Exemple* deschid, de asemenea, un proiect într-o filă nouă. Se reutilizează doar o planificare nouă și goală, la care nu ați lucrat încă, în loc să se adauge o filă.

### Comutarea între proiecte

- Faceți clic pe fila proiectului.
- Apăsați Ctrl+1 până la Ctrl+9 (⌘ în loc de Ctrl pe macOS) pentru proiectul de pe poziția respectivă din rând, numărată de la stânga la dreapta.
- Faceți clic pe pictograma de meniu din stânga filelor (*Toate proiectele*). Prezentarea generală *Proiecte deschise* arată câte un card pentru fiecare proiect, cu numele, numele fișierului (dacă proiectul are un fișier), o miniatură a planificării, numărul de activități, numărul de activități critice și data de final. Faceți clic pe un card pentru a ajunge acolo. Tasta Esc închide prezentarea generală.

Fiecare filă are un punct colorat care aparține proiectului. O filă cu un punct mic lângă ea are modificări nesalvate.

### Închiderea unui proiect

Faceți clic pe crucea de lângă numele din filă (*Închidere*) sau pe crucea de pe un card din prezentarea generală. Un proiect fără modificări se închide imediat. Dacă are modificări nesalvate, aplicația afișează *Modificări nesalvate* cu trei opțiuni:

- *Salvare* salvează proiectul și apoi îl închide.
- *Fără salvare* închide proiectul și renunță la modificări.
- *Anulare* lasă proiectul deschis.

Dacă renunțați la salvare, de exemplu prin închiderea ferestrei de salvare, proiectul rămâne deschis.

Dacă închideți ultimul proiect, rămâne o planificare goală, numită *Planificare nouă*.

### Alegerea stilului de comutare

Filele sunt o alegere. Deschideți fereastra de setări cu roata dințată din bara de titlu, accesați fila *Afișare* și, la *Stil de comutare a documentelor*, alegeți:

- *File orizontale*: valoarea implicită. Un rând de file sub panglică.
- *File verticale*: o bară îngustă în stânga, cu un buton pentru fiecare proiect (primele litere ale numelui) și un semn plus. Dacă treceți cu mouse-ul peste un buton, vedeți numele, numele fișierului, numărul de activități, numărul de activități critice și data de final. Butonul de sus deschide prezentarea generală.
- *Pastilă*: o pastilă în bara de titlu, cu numele proiectului activ și un contor, de exemplu *2 deschise*. Faceți clic pe ea pentru a deschide prezentarea generală și a comuta acolo.

Toate cele trei stiluri deschid aceeași prezentare generală, iar Ctrl+1 până la Ctrl+9 funcționează în fiecare stil.

## Capcane și ce face aplicația

**Ce aparține proiectului și ce este comun.** Fiecare proiect are propria vizualizare: zoom și poziție, un aspect activ cu filtru, grupare sau sortare, vizualizare împărțită, liniile de dependență și fazele restrânse. Dacă treceți la alt proiect, vedeți acolo propria vizualizare. Comune tuturor proiectelor sunt fila selectată din panglică, mini-harta, suprapunerile (suprapunerea de referință, linia de progres și restul), alegerea dumneavoastră de coloane, aspectele dumneavoastră și alegerile pentru rapoarte.

**Nu puteți comuta cu o casetă de dialog deschisă.** Atâta timp cât o casetă de dialog este deschisă, de exemplu fereastra de setări sau fereastra unei activități, Ctrl+1 până la Ctrl+9 nu fac nimic în aplicație. În browser, ele comută atunci filele browserului. Închideți mai întâi caseta de dialog. O modificare neaplicată în *Informații proiect* din Backstage blochează, de asemenea, comutarea.

**Ctrl+1 până la Ctrl+9 numără după ordine.** Comanda rapidă merge la proiectul de pe poziția respectivă din rând. Dacă închideți un proiect, celelalte poziții se mută în sus. Dacă aveți mai mult de nouă proiecte deschise, ajungeți la restul numai prin file sau prin prezentarea generală.

**Calculare și rapoarte se aplică proiectului activ.** Calculare (F5), *Exportare PDF* și rapoartele se referă la proiectul care este activ acum.

## Vezi și

- [Crearea și utilizarea unui aspect](docs://howto-layouts-gebruiken): configurarea unei vizualizări pentru fiecare proiect.
- [Crearea și tipărirea unui raport](docs://howto-rapport-maken-en-afdrukken): raportul proiectului activ.

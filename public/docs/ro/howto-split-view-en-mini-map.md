# Vizualizarea împărțită și mini-harta

Scop: vedeți două intervale de timp din graficul Gantt una lângă alta și parcurgeți rapid o planificare lungă.

## Când aveți nevoie de aceasta

Discutați începutul fundației și, în același timp, predarea cu nouă luni mai târziu. Fără ajutor, măriți și micșorați mereu imaginea și pierdeți din vedere unde erați. Cu **vizualizarea împărțită** vedeți aceeași planificare de două ori, una lângă alta, fiecare cu propriul interval de timp. Cu **mini-harta** vedeți întreaga perioadă a proiectului într-o bandă îngustă și săriți cu un clic la partea pe care o căutați.

## Pași

### Activarea vizualizării împărțite

1. Alegeți fila *Vizualizare*. În grupul *Prezentare* se află *Prezentare*, *Vizualizare împărțită* și *Mini-hartă*.
2. Faceți clic pe *Vizualizare împărțită*. Graficul Gantt se împarte în două. Ambele ferestre încep cu zoomul și poziția vizualizării curente.

Cele două ferestre au în comun tabelul de activități, rândurile și derularea verticală. Fiecare fereastră are propria scară de timp: zoomul și poziția orizontală.

### Fiecare fereastră cu propriul interval de timp

- Faceți zoom și derulați în fereastra peste care se află mouse-ul. Cu setarea implicită pentru *Derulare și zoom* (*Zoom + tragere*), rotița mouse-ului face zoom în acea fereastră, centrat pe mouse. Dacă setarea dumneavoastră urmează alt mod, rotița face în ambele ferestre ce indică acel mod.
- Cu setarea implicită derulați rândurile cu Shift și rotița mouse-ului. Aceasta se aplică în ambele ferestre deodată.
- Butoanele *Zoom +* și *Zoom -* și lista scării de timp (de exemplu *Trimestru*) funcționează doar în fereastra din stânga. Astfel, măriți fereastra din dreapta cu rotița mouse-ului.
- Trageți separatorul dintre cele două ferestre spre stânga sau spre dreapta, ca ferestrele să fie mai late sau mai înguste. La început, fiecare are jumătate.

### Dezactivarea vizualizării împărțite

Faceți din nou clic pe *Vizualizare împărțită*. Rămâne o fereastră, cu vizualizarea ferestrei din stânga. O nouă vizualizare împărțită pornește din nou cu vizualizarea din acel moment.

### Activarea mini-hărții

1. În grupul *Prezentare*, faceți clic pe *Mini-hartă*.
2. Sub graficul Gantt apare o bandă a întregii perioade a proiectului. Activitățile din vizualizarea curentă apar ca linii subțiri (deci, după un filtru, doar activitățile pe care le arată filtrul) și un cadru în jurul părții pe care o vedeți acum.
3. Faceți clic oriunde pe bandă, ca cadrul să ajungă acolo. Fereastra se centrează pe acel punct. Sau apucați cadrul și trageți-l.

Mini-harta mută doar fereastra de timp. Rândurile rămân cum sunt.

Dacă vizualizarea împărțită este activă, fiecare fereastră are propria bandă, sub propria parte a graficului. Fiecare bandă controlează doar fereastra de deasupra ei.

## Capcane și ce face aplicația

**Mini-harta nu face nimic dacă întregul proiect este deja vizibil.** Dacă micșorați atât de mult încât întreaga planificare încape pe ecran, nu există unde să mergeți, iar clicul nu are efect. Mai întâi măriți.

**Mini-harta există doar pe Gantt.** În filele *Tabel*, *IFC* și *Raport* și în panoul de resurse complet (*Resurse*, nu *Andocare resurse*) nu există grafic de timp, deci nici mini-hartă, nici vizualizare împărțită. Ele revin imediat ce reveniți la o vizualizare cu graficul Gantt.

**Vizualizarea împărțită aparține proiectului, mini-harta nu.** Vizualizarea împărțită se aplică proiectului deschis: dacă treceți la alt proiect și apoi reveniți, ea este încă acolo. Mini-harta este o alegere pentru toate proiectele și rămâne activată sau dezactivată după o repornire. Ambele sunt alegeri de ecran: nu intră în fișierul proiectului, nu fac proiectul „modificat” și nu apar în *Anulare*.

**Vizualizarea împărțită și prezentarea.** Ambele rămân vizibile când porniți modul de prezentare (vedeți [Prezentarea pe un ecran mare](docs://howto-presentatie)). Deoarece panglica dispare atunci, nu le mai puteți activa sau dezactiva în acest mod. Configurați-le deci corect înainte de a începe.

## Vedeți și

- [Prezentarea pe un ecran mare](docs://howto-presentatie): graficul Gantt pe tot ecranul, fără panglică.
- [Crearea și utilizarea unui aspect](docs://howto-layouts-gebruiken): scara de timp poate fi salvată și ca parte a unui aspect.

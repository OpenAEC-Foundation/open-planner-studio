# Deschiderea unui fișier MS Project (.mpp)

Scop: deschideți o planificare din Microsoft Project direct în aplicație, fără a o exporta mai întâi.

## Când aveți nevoie de aceasta

Un antreprenor, un consultant sau un client vă trimite planificarea sub forma unui fișier `.mpp`. Doriți să o vizualizați, să o calculați sau să o dezvoltați mai departe. Aplicația citește fișiere `.mpp` de la MS Project 2010 până la 2021, inclusiv. Aplicația doar citește: nu scrie fișiere `.mpp` și nu modifică niciodată fișierul dumneavoastră. Din fișier preia planificarea propriu-zisă: activități cu structură, durată și restricții, dependențe cu decalaj, calendare, resurse, atribuiri și progres. Aplicația citește și datele și marjele pe care le-a calculat MS Project, dar le folosește doar pentru vizualizarea *Datele așa cum sunt înregistrate*, niciodată ca date de intrare.

## Pași

1. Alegeți *Acasă › Fișier › Deschidere* sau apăsați Ctrl+O. Alegeți fișierul `.mpp`.
2. Proiectul se deschide într-o filă nouă sau în fila curentă, dacă aceasta era încă goală și nemodificată. Proiectul nu are fișier. *Salvare* scrie mai târziu un fișier IFC nou.
3. Citiți mesajul de jos: *Acest proiect se calculează conform profilului Microsoft Project. Modificați din Fișier → Informații proiect → Profil de calcul și opțiuni de calcul*. Aplicația calculează acest proiect cu regulile de calcul ale MS Project, adică profilul de calcul *Microsoft Project*. Cu *Deschidere profil de calcul* ajungeți la setare. *Citiți mai multe* deschide Ajutorul despre profilurile de calcul.
4. Verificați dacă sub panglică există o bară de mesaje: *Vizualizați datele așa cum sunt în fișier; la recalculare, 4 activități s-ar deplasa*. Pentru aceste activități, rezultatul aplicației diferă de datele salvate de Microsoft Project. Sub mesajul de la pasul 3 apare și o linie: *4 activități afișează datele așa cum sunt în fișier (nerecalculate)*. Ce înseamnă aceasta și cum treceți la calculul propriu al aplicației este descris în [Datele așa cum sunt înregistrate](docs://uitleg-datums-zoals-opgeslagen).
5. Dacă apare *Acest fișier conține planificare pe ore* cu butonul *Activare planificare pe ore*, fișierul conține date în ore. Consultați [Activarea planificării pe ore](docs://howto-urenplanning-aanzetten).

Dacă fișierul conține activități cu o planificare fragmentată, redistribuită sau ghidată de resurse, se adaugă un alt mesaj, de exemplu *Acest fișier MS Project conține 3 activități cu o planificare fragmentată, redistribuită sau ghidată de resurse. Sunt importate și afișate ca atare*. Pentru o singură activitate, mesajul apare la singular.

## Probleme posibile și ce face aplicația atunci

**Nu totul se preia.** Aplicația nu preia referințele, costurile, tarifele standard, notele și câmpurile particularizate din Microsoft Project. Un cod WBS pe care l-ați completat chiar dumneavoastră în Microsoft Project se preia; altfel, aplicația numerotează activitățile după structură.

**Un fișier din MS Project 2007 sau mai vechi.** Aplicația îl refuză și afișează: *Acest fișier .mpp are un format mai vechi (Project 2007 sau anterior). În MS Project, exportați-l ca XML (Fișier → Salvare ca → XML) și deschideți acel fișier*. Sub mesaj, aplicația adaugă un motiv tehnic în engleză.

**Un fișier cu parolă.** Aplicația afișează: *Acest fișier .mpp este protejat cu parolă. În MS Project, exportați-l ca XML (Fișier → Salvare ca → XML) și deschideți acel fișier*. Aici, mesajul vine și el cu un motiv tehnic în engleză.

**Un fișier care nu este, de fapt, un `.mpp`.** Primiți mesajul *Deschiderea fișierului a eșuat*, cu un motiv tehnic.

**Varianta XML calculează altfel.** Dacă deschideți exportul XML din MS Project în locul fișierului `.mpp`, aplicația calculează cu profilul de calcul *Open Planner Studio* și nu vedeți mesajul despre *Microsoft Project*. Datele pot fi atunci altele decât la fișierul `.mpp`.

**O modificare renunță la controlul MS Project.** Dacă modificați o activitate a cărei planificare era controlată de fereastra de date din MS Project, aplicația afișează o singură dată pentru fiecare proiect: *Fereastra de date din MS Project nu mai ghidează 2 activități după această modificare; distribuția orelor rămâne valabilă și este păstrată în fișier*. Pentru o singură activitate, mesajul apare la singular.

**Salvarea nu suprascrie niciodată fișierul `.mpp`.** Proiectul nu are fișier. *Salvare* întreabă unde trebuie salvat noul fișier IFC.

## Vezi și

- [Fișiere și formate](docs://uitleg-bestanden): de ce un `.mpp` este doar citit și ce scrie salvarea.
- [Datele așa cum sunt înregistrate](docs://uitleg-datums-zoals-opgeslagen): vizualizarea datelor proprii din MS Project.
- [Activarea planificării pe ore](docs://howto-urenplanning-aanzetten): dacă fișierul conține date în ore.
- [Deschiderea unui fișier Primavera P6 (.xer)](docs://howto-xer-openen): același lucru pentru Primavera.
- [Formate de import și export](docs://ref-import-exportformaten): pentru fiecare format, ce se preia și ce nu.
- [Profiluri de calcul și convenții de calcul](docs://uitleg-rekenprofielen): de ce un fișier MS Project se deschide cu propriul profil de calcul.

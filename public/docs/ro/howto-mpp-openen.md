# Deschiderea unui fișier MS Project (.mpp)

Scop: deschideți o planificare din Microsoft Project direct în aplicație, fără a o exporta mai întâi.

## Când aveți nevoie de aceasta

Un antreprenor, un consultant sau un client vă trimite planificarea sub forma unui fișier `.mpp`. Doriți să o vizualizați, să o calculați sau să o dezvoltați mai departe. Aplicația citește fișiere `.mpp` de la MS Project 2010 până la 2021, inclusiv. Aplicația doar citește: nu scrie fișiere `.mpp` și nu modifică niciodată fișierul dumneavoastră. Din fișier preia planificarea propriu-zisă: activități cu structură, durată și restricții, dependențe cu decalaj, calendare, resurse, atribuiri și progres. Aplicația citește și datele și marjele pe care le-a calculat MS Project, dar le folosește doar pentru vizualizarea *Datele așa cum sunt înregistrate*, niciodată ca date de intrare.

## Pași

1. Alegeți *Acasă › Fișier › Deschidere* sau apăsați Ctrl+O. Alegeți fișierul `.mpp`.
2. Proiectul se deschide într-o filă nouă sau în fila curentă, dacă aceasta era încă goală și nemodificată. Proiectul nu are fișier: *Salvare* scrie mai târziu un fișier IFC nou. Apoi apare pe scurt o fereastră care explică ce a preluat aplicația din fișier și cum funcționează salvarea; consultați [Deschiderea și salvarea unui fișier](docs://howto-bestand-openen-en-opslaan).
3. Citiți mesajul de jos: *Acest proiect se calculează ca Microsoft Project. Modificați din Fișier → Informații despre proiect → Profil de calcul și opțiuni de calcul.* Aplicația calculează acest proiect cu regulile de calcul ale MS Project, adică profilul de calcul *Microsoft Project*. Cu *Deschidere profil de calcul* ajungeți la setare, iar *Citiți mai multe* deschide Ajutorul despre profilurile de calcul.
4. Verificați dacă sub panglică apare o bară de mesaje: *Vizualizați datele așa cum sunt în fișier; la recalculare, 4 activități s-ar deplasa.* Pentru aceste activități, rezultatul aplicației diferă de datele salvate de Microsoft Project. Sub mesajul de la pasul 3 apare și o linie: *4 activități afișează datele așa cum sunt în fișier (nerecalculate).* Ce înseamnă aceasta și cum treceți la calculul propriu al aplicației este descris în [Datele așa cum sunt înregistrate](docs://uitleg-datums-zoals-opgeslagen).
5. Dacă apare *Acest fișier conține planificare pe ore.* cu butonul *Activare planificare pe ore*, fișierul conține date în ore. Consultați [Activarea planificării pe ore](docs://howto-urenplanning-aanzetten).

Dacă fișierul conține activități cu o planificare fragmentată, redistribuită sau ghidată de resurse, se adaugă un alt mesaj, de exemplu *Acest fișier MS Project conține 3 activități cu o planificare fragmentată, redistribuită sau ghidată de resurse. Sunt importate și afișate ca atare.* Pentru o singură activitate, mesajul apare la singular.

## Probleme posibile și ce face aplicația atunci

**Nu totul se preia.** După deschidere, aplicația vă spune într-un singur mesaj ce nu a preluat: *Nu totul din acest fișier MS Project a fost preluat.* Sub el este câte o linie pentru fiecare element, cu numărul, de exemplu *2 referințe nu au fost preluate.* Pentru un `.mpp`, fraza despre profilul de calcul de la pasul 3 este atunci prima linie din acest mesaj. Mesajul rămâne până faceți clic pe crucea de închidere. Dacă nu se pierde nimic, nu primiți acest mesaj. O linie poate fi despre:

- proiecte inserate (subproiecte): aplicația le citește ca pe o activitate obișnuită, fără legătura cu celălalt fișier;
- activități externe dintr-un alt proiect: aplicația le citește ca pe o activitate obișnuită;
- referințe: dintr-un `.mpp` aplicația nu preia nicio referință; din XML-ul MS Project preia doar referința 0 a activităților și, din ea, doar datele și durata (pentru o activitate în ore, și ora; nu lucrul și costul și nicio referință pentru resurse și atribuiri);
- la XML-ul MS Project: o atribuire a cărei referință are alte date decât activitatea sa. Aplicația păstrează doar referința activității; dacă datele sunt aceleași, nu se pierde nimic și aplicația nu afișează nimic. Și o oră diferită în aceeași zi contează ca o diferență;
- câmpuri particularizate cu valori, de exemplu câmpuri particularizate, valori dintr-un tabel de căutare și coduri de structură (aplicația nu numără câmpurile da/nu dintr-un `.mpp`);
- note (și o notă cu doar o imagine) la resurse și atribuiri și, dintr-un `.mpp`, și la activități (din XML-ul MS Project, nota unei activități se preia ca descriere a ei);
- hiperlegături;
- costurile fixe ale activităților;
- tarifele resurselor: dintr-un `.mpp` niciun tarif, din XML-ul MS Project doar tarif standard;
- doar la XML-ul MS Project: activitățile planificate manual (aplicația le planifică automat), activitățile inactive (intră în calcul) și întârzierea prin redistribuire;
- doar la un `.mpp`: pragul critic din MS Project; aplicația folosește pragul 0.

Un cod WBS pe care l-ați completat chiar dumneavoastră în MS Project se preia; altfel, aplicația numerotează activitățile după structură.

**Un fișier din MS Project 2007 sau mai vechi.** Aplicația îl refuză și afișează: *Acest fișier .mpp are un format mai vechi (Project 2007 sau anterior). În MS Project, exportați-l ca XML (Fișier → Salvare ca → XML) și deschideți acel fișier.* Sub mesaj, aplicația adaugă un motiv tehnic în engleză.

**Un fișier cu parolă.** Aplicația afișează: *Acest fișier .mpp este protejat cu parolă. În MS Project, exportați-l ca XML (Fișier → Salvare ca → XML) și deschideți acel fișier.* Și aici mesajul vine cu un motiv tehnic în engleză.

**Un fișier care nu este, de fapt, un `.mpp`.** Primiți mesajul *Deschiderea fișierului a eșuat*, cu un motiv tehnic.

**Varianta XML calculează altfel.** Dacă deschideți exportul XML din MS Project în locul fișierului `.mpp`, aplicația calculează cu profilul de calcul *Open Planner Studio* și nu vedeți mesajul despre *Microsoft Project*. Datele pot fi atunci altele decât la fișierul `.mpp`. Și la exportul XML, aplicația vă spune ce nu preia; consultați *Nu totul se preia*.

**O modificare renunță la controlul MS Project.** Dacă modificați o activitate a cărei planificare era ghidată de fereastra de date din MS Project, aplicația afișează o singură dată pentru fiecare proiect: *Fereastra de date din MS Project nu mai ghidează 2 activități după această modificare; distribuția orelor rămâne valabilă și este păstrată în fișier.* Pentru o singură activitate, mesajul apare la singular.

**Salvarea nu suprascrie niciodată fișierul `.mpp`.** Proiectul nu are fișier. *Salvare* întreabă unde trebuie salvat noul fișier IFC.

## Vezi și

- [Fișiere și formate](docs://uitleg-bestanden): de ce un `.mpp` este doar citit și ce scrie salvarea.
- [Datele așa cum sunt înregistrate](docs://uitleg-datums-zoals-opgeslagen): vizualizarea datelor proprii din MS Project.
- [Activarea planificării pe ore](docs://howto-urenplanning-aanzetten): dacă fișierul conține date în ore.
- [Deschiderea unui fișier Primavera P6 (.xer)](docs://howto-xer-openen): același lucru pentru Primavera.
- [Formate de import și export](docs://ref-import-exportformaten): pentru fiecare format, ce se preia și ce nu.
- [Profiluri de calcul și convenții de calcul](docs://uitleg-rekenprofielen): de ce un fișier MS Project se deschide cu propriul profil de calcul.

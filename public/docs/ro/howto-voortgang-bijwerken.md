# Actualizarea progresului

Scop: introduceți starea reală a lucrării în planificare și recalculați planificarea: care activități sunt finalizate, care sunt în curs și cât lucru mai rămâne.

## Când aveți nevoie de acest lucru

Dumneavoastră actualizați progresul la momente fixe, de exemplu în fiecare vineri, când conducătorul șantierului raportează starea. Astfel planificarea vede ce s-a întâmplat efectiv și calculează lucrul rămas de la data raportului de stare. De ce aplicația funcționează în acest fel este explicat în [Progres, data raportului de stare și referința](docs://uitleg-voortgang).

## Pași

### 1. Setați data raportului de stare

Data raportului de stare este ziua în care faceți inventarul. Setați-o înainte de a introduce progresul.

1. Mergeți la *Planificare › Referințe și progres › Data raportului de stare*.
2. Introduceți data în cele trei câmpuri pentru zi, lună și an (în ordinea notației dumneavoastră de dată), de exemplu 28, 06 și 2027, și apăsați Enter. Aplicația trece singură la următorul câmp.
3. Cu crucea mică de lângă câmp goliți din nou data raportului de stare.

Dacă faceți inventarul vineri, după orele de lucru, setați data raportului de stare la următoarea zi lucrătoare, luni. Aplicația planifică lucrul rămas de la începutul datei raportului de stare.

Dacă introduceți progres, dar încă nu există o dată a raportului de stare, aplicația o setează la azi și afișează: *Încă nu exista o dată a raportului de stare: a fost setată la azi (…), deoarece progresul se măsoară până la data raportului de stare. O puteți modifica din Planificare → Data raportului de stare.* Este mai bine să setați dumneavoastră data mai întâi.

### 2. Introduceți progresul

Alegeți modul potrivit pentru situația dumneavoastră. Toate dau același rezultat.

**O activitate în panoul de proprietăți.** Util când actualizați o singură activitate.

1. Faceți clic pe activitate. Dacă nu vedeți panoul *Proprietăți*, activați-l cu *Vizualizare › Panouri › Proprietăți*.
2. Trageți cursorul *Progres (%)* până la procentul realizat.
3. Dacă este necesar, completați *Început efectiv* și *Sfârșit efectiv*, în același mod ca data raportului de stare. Aplicația calculează singură câmpul *Rămas*; aici nu îl puteți modifica.

Un jalon are un singur câmp, *Dată reală*.

**Alegerea unui procent din meniu.** Util pentru o stare rapidă.

1. Faceți clic dreapta pe bara activității din diagrama Gantt.
2. Alegeți *Progres*, apoi 0%, 25%, 50%, 75% sau 100%.

**Mai multe activități în tabelul de activități.** Util când actualizați o listă întreagă.

1. Faceți clic pe **+** din dreapta antetului tabelului de activități (*Adăugare coloană*) și deschideți categoria *Progres*. Adăugați coloanele *Început efectiv*, *Sfârșit efectiv*, *Rămas* și *Stare*. Coloana *Progres* există deja pe fila *Tabel*.
2. Faceți dublu clic pe o celulă, introduceți valoarea și apăsați Enter. Introduceți un procent ca `50` sau `50%`, o dată ca `25-06-2027`, o durată rămasă ca `1`.
3. Pentru *Stare*, după dublu clic apăsați Enter și alegeți *Nepornită*, *În curs* sau *Finalizată*.

Dacă introduceți o durată rămasă, aplicația calculează înapoi procentul: pentru o activitate de 2 zile lucrătoare, un rest de 1 dă un procent de 50. Un rest de 0 finalizează activitatea. Dacă alegeți *Nepornită* la *Stare*, procentul devine 0, iar datele reale dispar.

**Toate datele unei activități în fereastra de editare.** Faceți clic dreapta pe activitate și alegeți *Editare...*. Câmpurile de progres se află și ele acolo. Ele se aplică abia după ce faceți clic pe *Salvare*.

**Mai multe activități deodată dintr-o foaie de calcul.** Vezi [Importul progresului dintr-o foaie de calcul](docs://howto-voortgang-importeren).

### 3. Recalculați planificarea

Fiecare modificare a progresului sau a datei raportului de stare face planificarea învechită: bara de stare afișează *Învechit — recalculați (F5)*. Apăsați **Calculare** (F5), de exemplu prin *Planificare › Planificare › Calculare*. Dacă *Calculare automată* este activată (sub *Setări › Proiect › Setări*, fila *Planificare*), aplicația face acest lucru singură.

## Verificarea rezultatului

- La data raportului de stare, diagrama Gantt afișează o linie punctată cu data în antet. La activitățile în curs, linia se curbează până la procentul din bară. Le activați sau dezactivați cu *Vizualizare › Referințe și progres › Linia de progres* și *Linia datei raportului de stare*.
- Activitățile finalizate nu sunt niciodată roșii: cu o dată a raportului de stare, o activitate finalizată nu este critică.
- Fazele arată un procent calculat, iar sfârșitul planificării s-ar putea să se fi mutat.
- Dacă ați salvat o referință, planificarea originală apare sub fiecare bară, iar tipul de raport *Varianță* arată varianța.

## Capcane și ce face aplicația

**O dată după data raportului de stare.** Aplicația refuză un început efectiv sau un sfârșit efectiv după data raportului de stare. În panou, sub câmpuri, apare *Valorile reale nu pot fi după data raportului de stare*; în tabel, celula afișează *Data reală este după data raportului de stare.* Setați mai întâi data raportului de stare mai târziu sau corectați data.

**O activitate care ar începe abia după data raportului de stare.** Dacă introduceți progres pentru o activitate care, după planificare, nu ar fi început încă, se deschide fereastra *Introduceți începutul efectiv*. Aceasta întreabă când a început efectiv activitatea; sugestia este data raportului de stare. Cu *Aplicare progres* îl înregistrați, cu *Anulare* nu se schimbă nimic.

**100% fără date.** Dacă setați o activitate la 100% fără sfârșit efectiv, sfârșitul efectiv devine data raportului de stare, chiar dacă activitatea a fost finalizată mai devreme. Completați apoi sfârșitul efectiv dumneavoastră.

**Un procent sub 100%.** Dacă reduceți o activitate finalizată sub 100%, sfârșitul efectiv se elimină. Dacă ștergeți numai sfârșitul efectiv, procentul devine 0, iar activitatea rămâne *În curs*. Dacă vreți ca activitatea să fie din nou nepornită, ștergeți și începutul efectiv sau alegeți *Nepornită* la *Stare* în tabel.

**Modificarea duratei unei activități în curs.** Lucrul deja făcut rămâne făcut, iar procentul se ajustează. O activitate de 5 zile lucrătoare la 60%, pe care o setați la 10 zile lucrătoare, ajunge la 30%. Aplicația refuză o durată mai scurtă decât lucrul deja făcut: *Activitatea „Build inner cavity leaf” este deja realizată în proporție de 60%: o durată mai scurtă decât lucrul deja efectuat nu este posibilă. Durata nu a fost modificată.* În tabel, celula afișează *Această durată este mai scurtă decât lucrul deja efectuat.*

**Durata rămasă se rotunjește.** Aplicația rotunjește durata rămasă la zile lucrătoare întregi. Pentru o activitate de 2 zile lucrătoare, 50% și 75% dau ambele un rest de 1 zi lucrătoare.

**O fază.** O fază nu are progres propriu. În panou apare *Derivat din subactivități: modificați progresul acolo. Activitatea rezumat urmează după calculare (F5)*. În tabel, celula afișează *Progresul unei activități rezumat se calculează din subactivități și nu poate fi modificat aici.*

**Mutarea datei raportului de stare mai târziu.** Lucrul rămas al activităților în curs începe la noua dată a raportului de stare, iar lucrul care nu a început încă nu poate fi înaintea acelei date. Mutați deci data numai împreună cu o actualizare a progresului. Dacă setați o dată a raportului de stare fără să introduceți și progres, tot lucrul care nu a început încă se mută la acea dată (cu excepția profilului Microsoft Project).

**O greșeală.** Fiecare modificare a progresului este un singur pas pentru Ctrl+Z.

## Vezi și

- [Progres, data raportului de stare și referința](docs://uitleg-voortgang): cum calculează aplicația lucrul rămas și data raportului de stare, cu un exemplu.
- [Importul progresului dintr-o foaie de calcul](docs://howto-voortgang-importeren): citirea progresului pentru mai multe activități deodată.
- [Alegerea modului de progres](docs://howto-voortgangsmodus-kiezen): ce face aplicația cu o activitate care a început cât timp predecesorul ei este încă în curs.
- [Salvarea și gestionarea unei referințe](docs://howto-baseline-opslaan-en-beheren): înregistrarea planificării originale pentru a compara progresul cu ea.

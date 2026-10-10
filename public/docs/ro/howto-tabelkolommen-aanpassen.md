# Ajustarea coloanelor tabelului

Scop: alegeți ce coloane vedeți în tabelul de activități, în ce ordine și cât de late.

## Când aveți nevoie de asta

În ședință doriți să vedeți termenul limită și marja totală lângă fiecare activitate. Managerul de șantier vrea doar începutul și sfârșitul lângă nume. Sau o coloană este atât de îngustă încât antetul ei este tăiat. Tabelul de activități se compune din coloane pe care le alegeți singur: sunt zeci, de la *Nume activitate* și *Durată* până la *Termen limită*, *Marjă liberă* și *Resurse atribuite*.

Există două tabele de activități, fiecare cu propriile coloane:

- **Tabelul de activități lângă diagrama Gantt** se află în stânga liniei de timp, pe filele, printre altele, *Acasă*, *Planificare* și *Vizualizare*. Implicit are *WBS*, *Nume activitate* și *Durată*, ca să rămână loc pentru linia de timp.
- **Tabelul de pe fila** *Tabel* are întreg spațiul de lucru. Implicit are *WBS*, *Nume activitate*, *Durată*, *Început*, *Sfârșit*, *Tip de activitate*, *Critic*, *Marjă totală* și *Progres*, plus o coloană pentru fiecare cod de activitate și câmp particularizat al proiectului.

O modificare la un tabel nu modifică celălalt.

## Pași

### Adăugarea unei coloane

1. Faceți clic pe semnul plus (**+**) din dreapta antetului tabelului. Pe fila *Tabel* puteți folosi și *Tabel › Configurare coloane › Coloane…*. Se deschide fereastra *Alegere coloană*.
2. Găsiți coloana. Sus, dacă ați ales deja coloane înainte, se află *Utilizate recent*. Scrieți o parte din nume la *Căutare*, de exemplu *termen* pentru *Termen limită*, sau deschideți o categorie: *Activitate*, *Planificare*, *Restricții*, *Dependențe*, *Resurse*, *Progres*, *Calculat*, *Referință*, *Particularizat* sau *Tehnic*.
3. Faceți clic pe coloană. Ea se adaugă la sfârșitul tabelului, iar fereastra se închide.

O coloană care este deja în tabel apare cenușie și nu poate fi aleasă.

### Eliminarea unei coloane

Faceți clic pe semnul minus din antetul coloanei (*Eliminare: Termen limită*). Sau faceți clic dreapta pe antet și alegeți *Eliminare: Termen limită*. Cu Ctrl+Z recuperați coloana, sau o alegeți din nou cu plusul.

### Ajustarea lățimii

Trageți marginea din dreapta antetului coloanei spre stânga sau spre dreapta. Faceți dublu clic pe această margine sau alegeți *Potrivire automată* în meniul antetului (butonul din dreapta al mouse-ului), ca lățimea coloanei să fie suficientă pentru conținut, până la maximum 480 de pixeli. Dacă marginea are focusul, tastele cu săgeți măresc sau micșorează coloana pas cu pas.

### Fixarea coloanelor

Faceți clic dreapta pe antet și alegeți *Fixare*. Coloanele fixate trec în față și rămân în stânga când derulați orizontal. Acest lucru funcționează atât timp cât, împreună, nu sunt mai late decât fereastra. *Eliberare* le așază din nou în rând.

### Schimbarea ordinii

Trageți un antet de coloană în alt loc. O coloană fixată o mutați printre coloanele fixate, iar o coloană obișnuită printre coloanele obișnuite.

### Revenirea la implicit

Deschideți fereastra *Alegere coloană* și faceți clic pe *Restabilire implicită*, jos. Butonul este cenușiu dacă coloanele sunt deja cele implicite. Pentru tabelul de pe fila *Tabel*, se adaugă și câte o coloană pentru fiecare cod de activitate și câmp particularizat al proiectului, chiar dacă le-ați eliminat mai devreme. Aceste coloane aparțin proiectului în care se află codul sau câmpul. Despre aceste coduri și câmpuri puteți citi în [Coduri și câmpuri particularizate](docs://howto-codes-en-velden).

## Capcane și ce face aplicația

**Antetul este tăiat.** O coloană îngustă taie numele ei, de exemplu de la *Marjă totală* la *Marj…*. Faceți dublu clic pe marginea antetului ca să potriviți coloana.

**Ajustați tabelul greșit.** Coloanele tabelului de activități de lângă diagrama Gantt și cele de pe fila *Tabel* sunt separate. Dacă sunteți pe fila *Vizualizare* sau *Acasă*, ajustați tabelul de lângă diagrama Gantt. Plusul de pe fila *Tabel* ajustează tabelul mare.

**Un aspect restabilește coloanele.** Dacă un aspect are bifată partea *Coloane*, un clic pe butonul aspectului readuce coloanele tabelului de activități de lângă diagrama Gantt la starea salvată. Tabelul de pe fila *Tabel* rămâne neschimbat. Vezi [Crearea și utilizarea unui aspect](docs://howto-layouts-gebruiken).

**Coloanele sunt pe dispozitivul dumneavoastră, nu în proiect.** Aplicația păstrează alegerea dumneavoastră de coloane pentru toate proiectele dumneavoastră de pe acest dispozitiv și nu o salvează în fișierul proiectului. De asemenea, nu marchează proiectul ca „modificat”. Puteți anula fiecare modificare a coloanelor cu *Anulare* (Ctrl+Z); pașii se numesc, de exemplu, *Adăugare coloană Termen limită* și *Redimensionare coloană Nume activitate*.

## Vezi și

- [Crearea și utilizarea unui aspect](docs://howto-layouts-gebruiken): punerea coloanelor pe un buton, împreună cu un filtru sau cu o sortare.
- [Coduri și câmpuri particularizate](docs://howto-codes-en-velden): crearea propriilor coloane pe care le puteți alege aici.
- [Coloanele tabelului](docs://ref-tabelkolommen): toate coloanele și ce afișează ele.

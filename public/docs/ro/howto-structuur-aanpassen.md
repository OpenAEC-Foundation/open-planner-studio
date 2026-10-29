# Ajustarea structurii

Scop: aranjați activitățile în faze și subactivități, schimbați ordinea lor și mențineți numerele WBS corecte.

## Când aveți nevoie de aceasta

Planificarea dumneavoastră este un arbore: faze (activități rezumat) cu subactivități dedesubt, de exemplu *Foundation* cu *Groundwork*, *Reinforcement* și *Pouring*. Modificați acel arbore când doriți să atașați activități sub o fază, să scoateți o activitate dintr-o fază sau când ordinea este greșită. **Codul WBS** (1, 1.1, 1.2, 2, …) este numărul unei activități în acel arbore.

## Pași

### Indentați o activitate

1. Selectați activitatea. Puteți selecta mai multe activități.
2. Alegeți *Planificare › Structură › Indenta*. Puteți folosi și Alt+→ (sau Alt+Shift+→) sau *Indenta* din meniul contextual.

Activitatea devine ultima subactivitate a activității anterioare de același nivel. Activitatea anterioară devine, ca urmare, o activitate rezumat. Dacă selectați un bloc continuu, blocul se indentează ca un întreg. Dacă activitatea nu are o activitate anterioară de același nivel, nu se întâmplă nimic și nu apare niciun mesaj.

### Indentați negativ o activitate

Alegeți *Planificare › Structură › Indenta negativ*, apăsați Alt+← (sau Alt+Shift+←) sau alegeți *Indenta negativ* din meniul contextual.

Activitatea devine o activitate de același nivel, imediat după faza de care era atașată. Propriile subactivități merg cu ea. Activitățile care veneau după ea în acea fază rămân în faza respectivă. O activitate de la cel mai înalt nivel nu se mai poate indenta negativ.

### Mutarea unei activități

Există trei moduri.

- **Cu tastatura.** Alt+↑ și Alt+↓ inversează activitatea cu vecina ei de același nivel. O activitate rezumat își ia subactivitățile cu ea. La prima sau ultima poziție din nivel nu se întâmplă nimic. Dacă sunt selectate mai multe activități, se mută doar activitatea pe care ați dat clic primul.
- **Tragere în tabelul de activități.** Apăsați pe un rând și trageți pe verticală. Sfertul de sus al unui rând înseamnă *înainte*, sfertul de jos *după*. Mijlocul unei activități rezumat atașează activitatea sub ea ca ultimă subactivitate. Mijlocul unei activități obișnuite contează ca cea mai apropiată margine. Dacă trageți un rând care face parte dintr-o selecție multiplă, se mută toată selecția.
- **Tragere în diagrama Gantt.** Trageți bara pe verticală, la alt rând. Funcționează la fel ca tragerea în tabelul de activități și nu modifică datele. Dacă trageți pe orizontală, se modifică datele.

Fiecare mutare este un singur pas pentru *Anulare* (Ctrl+Z).

### Menținerea numerelor WBS la zi

Uitați-vă la butonul *WBS automat* din *Planificare › Structură*.

- **Pornit (implicit într-un proiect nou).** Este pornit și după ce deschideți un fișier fără această setare, dacă toate codurile WBS corespund deja numerotării arborelui (1, 1.1, 1.2 …). Codurile nu se modifică. Un fișier gol fără această setare primește, de asemenea, valoarea *pornit*, ca un proiect nou. Aplicația renumerotează întregul arbore la fiecare adăugare, ștergere și mutare. Codul WBS este atunci doar în citire: nu îl puteți scrie în tabel sau în panoul *Proprietăți*. *Renumerotare WBS* este dezactivată.
- **Oprit.** Este valoarea implicită la un fișier cu coduri proprii, de exemplu *A1000*, sau la un fișier cu un cod care diferă de arbore. Codurile rămân cum sunt, și după ce mutați sau indentați activități. Le introduceți singur, în coloana *WBS* sau în câmpul *Cod WBS* din *Proprietăți*, ori le renumerotați o singură dată cu *Renumerotare WBS*. Aceasta suprascrie și codurile pe care le-ați introdus singur.

Dacă activați *WBS automat*, aplicația numerotează arborele imediat. Atât *WBS automat*, cât și *Renumerotare WBS* pot fi anulate cu *Anulare*.

## Capcane și ce face aplicația

**Filtrarea, gruparea sau sortarea este activă.** Ordinea pe care o vedeți nu este atunci ordinea din planificare, de aceea aplicația blochează structura. *Indenta* și *Indenta negativ* sunt dezactivate, cu indicația *Indisponibil la filtrare, grupare sau sortare*. Alt+→ și tragerea afișează același text într-o bandă roșie, cu butonul *Ștergere*. Acesta elimină dintr-o dată filtrul, gruparea și sortarea, iar Ctrl+Z nu le readuce. Banda rămâne până apăsați pe cruce, folosiți Ctrl+Z sau Ctrl+Y ori treceți la alt document. *Indenta* și *Indenta negativ* lipsesc atunci din meniul contextual.

Alt+↑ și Alt+↓ funcționează în asemenea vedere, fără mesaj. Dacă aveți doar un filtru, vedeți imediat noua ordine. La sortare, ordinea din planificare se modifică, dar o vedeți abia după *Ștergere*.

**WBS automat este oprit.** Se întâmplă la un fișier cu coduri proprii sau la un fișier care salvează setarea ca *oprit*. O activitate nouă primește codul care corespunde locului ei în arbore, chiar dacă o altă activitate are deja acel cod. Astfel pot apărea numere duplicate. Și după ce ați indentat, codurile nu mai corespund arborelui. *Renumerotare WBS* corectează ambele.

**Un jalon primește subactivități.** Un jalon este un moment și nu are subactivități. Aplicația elimină indicatorul de jalon și vă informează.

**O activitate cu atribuiri de resurse primește subactivități.** O activitate rezumat nu poartă ea însăși atribuiri. Aplicația vă întreabă mai întâi ce să faceți cu ele, în fereastra *Activitatea devine activitate rezumat*. Acest lucru se întâmplă când indentați, când folosiți *Adăugare subactivitate* sau *Adăugare jalon* pe o activitate, când inserați un șablon și în *Editare activitate*, când alegeți o nouă *Activitate superioară*: atât pentru o activitate existentă, cât și pentru una nouă. În *Editare activitate*, întrebarea apare înainte de salvare. Dacă alegeți *Anulare* acolo, *Editare activitate* rămâne deschisă cu modificările dumneavoastră. Alegeți:

- *Anulare*: nimic nu se modifică, iar structura rămâne și ea cum era.
- *Ștergere atribuire*: activitatea primește subactivități, iar atribuirile ei se elimină. Se elimină și lucrul real al acestor atribuiri.
- *Mutare la '…'*: atribuirile trec la prima subactivitate nouă care le poate prelua, împreună cu lucrul real. Un jalon sau o activitate rezumat nu poartă atribuiri.

Dacă acea subactivitate are deja aceeași resursă, sau dacă nu există nicio subactivitate potrivită, *Mutare* este dezactivată. Un bloc portocaliu din fereastră vă spune de ce.

Dacă o atribuire are deja lucru real, blocul portocaliu vă spune câte ore are fiecare resursă, de exemplu *Atribuirea pentru Metselaar are deja 8 ore de lucru real. Ștergerea elimină lucrul real.* *Anulare* este atunci butonul implicit: Enter nu modifică nimic. Dacă totuși doriți să ștergeți atribuirea, faceți clic singur pe *Ștergere atribuire*.

Cât timp fereastra este deschisă, nicio scurtătură din afara ferestrei nu funcționează, inclusiv *Anulare*, *Lipire*, Delete, F5 și Ctrl+S. Dacă o acțiune creează deodată mai multe activități rezumat, fereastra arată resursele pentru fiecare activitate, iar alegerea dumneavoastră se aplică tuturor. O singură *Anulare* (Ctrl+Z) anulează toată acțiunea.

**O dependență ar crea un ciclu.** Dependențele unei activități rezumat se aplică și subactivităților ei. Dacă o mutare ar crea din această cauză un ciclu, aplicația o refuză, cu mesajul *Această mutare ar crea un ciclu în planificare (…)*. Nimic nu se modifică.

**O dependență între o activitate și propria ei fază.** Dacă puneți o activitate sub o fază cu care are deja o dependență, dependența rămâne, dar nu mai intră în calcul. Aplicația vă informează. Puteți citi mai multe despre dependențele activităților rezumat în [Dependențe și decalaj](docs://uitleg-relaties).

**Planificarea nu mai este actualizată.** O mutare către o altă fază poate modifica datele. Apăsați **Calculare** (F5). Doar schimbarea ordinii în cadrul aceleiași faze nu modifică datele.

## Vezi și

- [Adăugarea activităților și a jaloanelor](docs://howto-taken-en-mijlpalen-toevoegen): puneți activitățile noi la locul potrivit.
- [Salvarea și inserarea șabloanelor WBS](docs://howto-wbs-sjablonen): refolosiți o fază întreagă.
- [Adăugarea dependențelor](docs://howto-relaties-leggen): legați activitățile între ele.
- [Selectarea, ștergerea și anularea activităților](docs://howto-taken-selecteren-verwijderen): anulați o mutare.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): patru faze cu subactivitățile lor, așa cum le construiți când indentați activități.

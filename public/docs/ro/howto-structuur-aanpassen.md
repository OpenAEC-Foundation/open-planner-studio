# Ajustarea structurii

Scop: aranjați activitățile în faze și subactivități, schimbați ordinea lor și mențineți numerele WBS corecte.

## Când aveți nevoie de aceasta

Planificarea dumneavoastră este un arbore: faze (activități rezumat) cu subactivități dedesubt, de exemplu *Foundation* cu *Groundwork*, *Reinforcement* și *Pouring*. Modificați acel arbore când doriți să atașați activități sub o fază, să scoateți o activitate dintr-o fază sau când ordinea este greșită. **Codul WBS** (1, 1.1, 1.2, 2, …) este numărul unei activități în acel arbore.

## Pași

### Indentați o activitate

1. Selectați activitatea. Puteți selecta mai multe activități.
2. Alegeți *Planificare › Structură › Indenta*. Puteți folosi și Alt+→ (sau Alt+Shift+→) sau *Indenta* din meniul contextual.

Activitatea devine ultima subactivitate a activității anterioare de același nivel. Această activitate devine, ca urmare, o activitate rezumat. Dacă selectați un bloc continuu, blocul se indentează ca un întreg. Dacă activitatea nu are o activitate anterioară de același nivel, nu se întâmplă nimic și nu apare niciun mesaj.

### Indentați negativ o activitate

Alegeți *Planificare › Structură › Indenta negativ*, apăsați Alt+← (sau Alt+Shift+←) sau alegeți *Indenta negativ* din meniul contextual.

Activitatea devine o activitate de același nivel, imediat după faza de care era atașată. Propriile subactivități merg cu ea. Activitățile care veneau după ea în acea fază rămân în faza respectivă. O activitate de la cel mai înalt nivel nu se mai poate indenta negativ.

### Mutarea unei activități

Există trei moduri.

- **Cu tastatura.** Alt+↑ și Alt+↓ inversează activitatea cu vecina ei de același nivel. O activitate rezumat își ia subactivitățile cu ea. La prima sau ultima poziție din nivel nu se întâmplă nimic. Dacă sunt selectate mai multe activități, se mută doar activitatea pe care ați dat clic primul.
- **Tragere în tabelul de activități.** Apăsați pe un rând și trageți pe verticală. Sfertul de sus al unui rând înseamnă *înainte*, sfertul de jos *după*. Mijlocul unei activități rezumat atașează activitatea sub ea ca ultimă subactivitate. Mijlocul unei activități obișnuite contează ca cea mai apropiată margine. Dacă trageți un rând care face parte dintr-o selecție multiplă, se mută toată selecția.
- **Tragere în diagrama Gantt.** Trageți bara pe verticală, la alt rând. Funcționează la fel ca tragerea în tabel și nu modifică datele. Dacă trageți pe orizontală, se modifică datele.

Fiecare mutare este un singur pas pentru *Anulare* (Ctrl+Z).

### Menținerea numerelor WBS la zi

Uitați-vă la butonul *WBS automat* din *Planificare › Structură*.

- **Pornit (implicit într-un proiect nou).** Aplicația renumerotează întregul arbore la fiecare adăugare, ștergere și mutare. Codul WBS este atunci doar în citire: nu îl puteți scrie în tabel sau în panoul *Proprietăți*. *Renumerotare WBS* este dezactivată.
- **Oprit.** Codurile rămân cum sunt, și după ce mutați sau indentați activități. Le introduceți singur, în coloana *WBS* sau în câmpul *Cod WBS* din *Proprietăți*, ori le renumerotați o singură dată cu *Renumerotare WBS*. Aceasta suprascrie și codurile pe care le-ați introdus singur.

Dacă activați *WBS automat*, aplicația numerotează arborele imediat. Atât *WBS automat*, cât și *Renumerotare WBS* pot fi anulate cu *Anulare*.

## Capcane și ce face aplicația

**Filtrarea, gruparea sau sortarea este activă.** Ordinea pe care o vedeți nu mai este ordinea din planificare, de aceea aplicația blochează structura. *Indenta* și *Indenta negativ* sunt dezactivate, cu indicația *Indisponibil la filtrare, grupare sau sortare*. Alt+→ și tragerea afișează același text într-o bandă, cu butonul *Ștergere*. Acesta elimină dintr-o dată filtrul, gruparea și sortarea, iar Ctrl+Z nu le readuce. *Indenta* și *Indenta negativ* lipsesc atunci din meniul contextual.

Alt+↑ și Alt+↓ funcționează în asemenea vedere, fără mesaj. Dacă aveți doar un filtru, vedeți imediat noua ordine. La sortare, ordinea din planificare se modifică, dar o vedeți abia după *Ștergere*.

**WBS automat este oprit.** O activitate nouă primește codul care corespunde locului ei în arbore, chiar dacă o altă activitate are deja acel cod. Astfel pot apărea numere duplicate. Și după ce ați indentat, codurile nu mai corespund arborelui. *Renumerotare WBS* corectează ambele.

**Un jalon primește subactivități.** Un jalon este un moment și nu are subactivități. Aplicația elimină indicatorul de jalon și vă informează.

**O activitate cu atribuiri de resurse primește subactivități.** O activitate rezumat nu poartă ea însăși atribuiri. Aplicația le mută la prima subactivitate nouă care le poate prelua și vă informează. Dacă nu există o asemenea subactivitate, sau dacă aceasta are deja aceeași resursă, nu se întâmplă nimic, iar mesajul explică motivul.

**O dependență ar crea un ciclu.** Dependențele unei activități rezumat se aplică și subactivităților ei. Dacă o mutare ar crea din această cauză un ciclu, aplicația o refuză, cu mesajul *Această mutare ar crea un ciclu în planificare (…)*. Nimic nu se modifică.

**O dependență între o activitate și propria ei fază.** Dacă puneți o activitate sub o fază cu care are deja o dependență, dependența rămâne, dar nu mai intră în calcul. Aplicația vă informează. Puteți citi mai multe despre dependențele activităților rezumat în [Dependențe și decalaj](docs://uitleg-relaties).

**Planificarea nu mai este actualizată.** O mutare către o altă fază poate modifica datele. Apăsați **Calculare** (F5). Doar schimbarea ordinii în cadrul aceleiași faze nu modifică datele.

## Vezi și

- [Adăugarea activităților și a jaloanelor](docs://howto-taken-en-mijlpalen-toevoegen): puneți activitățile noi la locul potrivit.
- [Salvarea și inserarea șabloanelor WBS](docs://howto-wbs-sjablonen): refolosiți o fază întreagă.
- [Adăugarea dependențelor](docs://howto-relaties-leggen): legați activitățile între ele.
- [Selectarea, ștergerea și anularea activităților](docs://howto-taken-selecteren-verwijderen): anulați o mutare.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): patru faze cu subactivitățile lor, așa cum le construiți când indentați activități.

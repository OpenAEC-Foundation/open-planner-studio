# Meniuri cu clic dreapta

Acest articol explică ce meniuri deschide butonul din dreapta al mouse-ului în Gantt și în tabelul de activități. Explică și ce face fiecare element și la ce activități se aplică. Elementele care există și ca buton sau ca scurtătură sunt în [Panglica, filă cu filă](docs://ref-lint) și în [Comenzi rapide de la tastatură](docs://ref-sneltoetsen).

## Ce meniu unde

Există patru meniuri. Meniul pe care îl obțineți depinde de locul unde faceți clic:

- **Pe o bară a activității în Gantt** — meniul activității, cu *Creare dependență de aici* în partea de sus.
- **Pe o activitate din tabelul de activități** — același meniu al activității, fără acel element din partea de sus. Acest lucru este valabil pentru tabelul de activități din stânga diagramei Gantt și pentru fila *Tabel*.
- **Pe antetul unui grup din tabelul de activități** — un meniu mic pentru extinderea și restrângerea grupurilor. Anteturile de grup apar doar când grupați, de exemplu cu aspectul *Diagrama resurselor*.
- **Pe spațiul gol** — în Gantt, lângă sau sub bare, și în tabelul de activități, sub ultima activitate sau pe rândul gri *Creare activitate*. Meniul are *Creare activitate*, *Adăugare jalon* și *Lipire*; în Gantt are și *Resetare zoom* și *Potrivire la proiect*. O activitate nouă sau un jalon nou ajunge la capătul listei. În Gantt începe la data la care ați făcut clic; în tabelul de activități se deschide imediat celula cu numele, ca să scrieți direct.

Pe zona unui antet de grup din Gantt, butonul din dreapta al mouse-ului nu deschide niciun meniu. Nici un clic dreapta în antetul liniei de timp nu face nimic. Antetele coloanelor din tabelul de activități au meniul lor, descris în [Ajustarea coloanelor tabelului](docs://howto-tabelkolommen-aanpassen).

**La ce activități se aplică un element?** Faceți clic pe o singură activitate, dar selecția stabilește domeniul. Dacă activitatea pe care faceți clic face parte din selecție, elementul se aplică la toată selecția. Dacă nu face parte din ea, elementul se aplică doar la acea activitate. Cu clic dreapta pe o bară din Gantt sau pe un rând din tabelul de activități, activitatea respectivă înlocuiește selecția dacă nu făcea parte din ea. Fiecare element care modifică ceva corespunde unui singur pas în *Anulare*, și pentru o selecție întreagă.

## Meniul activității

Elementele sunt în această ordine. O linie între grupuri este un separator în meniu.

**Creare dependență de aici** — doar în Gantt, pe o bară. Activează modul dependență cu această activitate selectată; apoi trageți până la succesor. Consultați [Adăugarea dependențelor](docs://howto-relaties-leggen).

**Eliminare întrerupere** și **Eliminare tuturor întreruperilor** — doar în Gantt, pe o bară cu întreruperi. *Eliminare întrerupere* apare doar dacă faceți clic pe o întrerupere sau pe porțiunea de după ea, iar întreruperea se poate edita; elimină doar acea întrerupere. *Eliminare tuturor întreruperilor* le elimină pe toate, inclusiv întreruperile dintr-un fișier sursă pe care nu le puteți edita. Consultați [Împărțirea unei activități](docs://howto-taak-splitsen).

**Editare...** — deschide fereastra *Editare activitate* pentru această activitate. Consultați [Fereastra activității și panoul de proprietăți](docs://ref-taak-eigenschappen).

**Inserare deasupra** și **Inserare dedesubt** — inserează o activitate nouă deasupra activității de sus sau sub activitatea de jos din domeniu, la același nivel. Funcționează doar în vizualizarea arbore pură, fără filtru, grupare sau sortare; altfel aplicația refuză și afișează un mesaj. Consultați [Adăugarea activităților și jaloanelor](docs://howto-taken-en-mijlpalen-toevoegen).

**Adăugare subactivitate** — adaugă o activitate nouă ca subactivitate a activității pe care ați făcut clic, la sfârșitul subactivităților ei. Doar pentru acea activitate, nu pentru toată selecția.

**Adăugare jalon** — adaugă un jalon ca subactivitate a activității pe care ați făcut clic. Doar pentru acea activitate.

**Adăugare dependență** — face același lucru ca *Creare dependență de aici*: activează modul dependență cu această activitate selectată. În tabelul de activități elementul este dezactivat dacă Gantt nu este vizibilă, cu textul de ajutor *Disponibil doar când diagrama Gantt este vizibilă*.

**Indentează** și **Indentează negativ** — mută activitățile din domeniu cu un nivel mai adânc sau cu un nivel mai sus în WBS. Aceste două sunt doar în vizualizarea arbore pură. Consultați [Ajustarea structurii](docs://howto-structuur-aanpassen).

**Comutare jalon** — transformă activitatea în jalon sau invers. Noua stare depinde de activitatea pe care ați făcut clic și se aplică la tot domeniul: dacă aceea este o activitate, toate activitățile din domeniu devin jaloane. O activitate rezumat și o activitate cu atribuiri nu devin jalon; restul domeniului se transformă, iar primiți câte un mesaj pentru fiecare motiv.

**Atribuire calendar ▸** — un submeniu cu *Calendar de proiect* (activitatea nu are atunci un calendar propriu) și dedesubt calendarele disponibile. Alegerea actuală are un semn de bifare. O activitate care este deja pe acel calendar nu contează și nu creează un pas suplimentar în *Anulare*. Consultați [Crearea și atribuirea unui calendar](docs://howto-kalender-maken-en-toewijzen).

**Progres ▸** — un submeniu cu 0%, 25%, 50%, 75% și 100%. Valoarea actuală are un semn de bifare. O activitate rezumat nu are progres propriu: dacă există una în domeniu, activitățile ei fără subactivități primesc procentul. Dacă nu este setată data raportului de stare, aplicația o setează la data de azi și afișează un mesaj. O activitate planificată să înceapă abia după data raportului de stare și care nu are încă un început efectiv duce mai întâi la o întrebare despre începutul efectiv; dacă anulați, nu se schimbă nimic. Consultați [Actualizarea progresului](docs://howto-voortgang-bijwerken).

**Prioritate ▸** — un submeniu cu *Scăzută* (100), *Normală* (500) și *Ridicată* (900), prioritatea de redistribuire a activității. Valoarea actuală are un semn de bifare. Consultați [Redistribuirea resurselor](docs://uitleg-nivelleren).

**Urmărire traseu** — afișează predecesorii și succesorii acestei activități. Dacă urmărirea este deja activă, elementul se numește *Oprire urmărire traseu*. Consultați [Urmărirea unui traseu](docs://howto-pad-traceren).

**Restrângere**, **Extindere** și **Salvare ramură ca șablon** — doar pentru o activitate rezumat. *Restrângere* și *Extindere* sunt mereu amândouă acolo, chiar dacă activitatea este deja restrânsă sau extinsă, și se aplică la tot domeniul. *Salvare ramură ca șablon* salvează activitatea cu subactivitățile ei și dependențele dintre ele ca șablon WBS. Consultați [Salvarea și inserarea șabloanelor WBS](docs://howto-wbs-sjablonen).

**Ștergere** — șterge activitățile din domeniu, împreună cu subactivitățile lor. Nu se cere confirmare; le recuperați cu Ctrl+Z, printr-un singur pas pentru tot domeniul. Consultați [Selectarea, ștergerea și anularea activităților](docs://howto-taken-selecteren-verwijderen).

## Meniul antetului de grup

Acest meniu există doar în tabelul de activități, pe un antet de grup:

**Restrângere grup** sau **Extindere grup** — restrânge sau extinde doar acest grup. Elementul arată ce puteți face.

**Extindere toate** și **Restrângere toate** — extinde sau restrânge toate grupurile deodată.

Gruparea se configurează cu un aspect. Consultați [Crearea și utilizarea unui aspect](docs://howto-layouts-gebruiken).

## Vezi și

- [Tragerea, deplasarea și zoomul în Gantt](docs://howto-gantt-bedienen): ce face tragerea cu butoanele stânga și din mijloc ale mouse-ului.
- [Panglica, filă cu filă](docs://ref-lint): butoanele cu aceleași acțiuni.
- [Comenzi rapide de la tastatură](docs://ref-sneltoetsen): tastele care le corespund.
